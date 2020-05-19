var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    /* src\SnakeBody.svelte generated by Svelte v3.22.2 */

    function create_if_block(ctx) {
    	let div0;
    	let t;
    	let div1;

    	return {
    		c() {
    			div0 = element("div");
    			t = space();
    			div1 = element("div");
    			attr(div0, "id", "leftEye");
    			attr(div0, "class", "eyes svelte-r68v0v");
    			attr(div1, "id", "rightEye");
    			attr(div1, "class", "eyes svelte-r68v0v");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t, anchor);
    			insert(target, div1, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t);
    			if (detaching) detach(div1);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let div_class_value;
    	let if_block = /*isHead*/ ctx[2] && create_if_block();

    	return {
    		c() {
    			div = element("div");
    			if (if_block) if_block.c();
    			set_style(div, "width", /*scale*/ ctx[4] - 2 + "px");
    			set_style(div, "height", /*scale*/ ctx[4] - 2 + "px");
    			set_style(div, "left", /*left*/ ctx[1] + "px");
    			set_style(div, "top", /*top*/ ctx[0] + "px");
    			attr(div, "class", div_class_value = "snake-body " + /*direction*/ ctx[3] + " svelte-r68v0v");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    		},
    		p(ctx, [dirty]) {
    			if (/*isHead*/ ctx[2]) {
    				if (if_block) ; else {
    					if_block = create_if_block();
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*scale*/ 16) {
    				set_style(div, "width", /*scale*/ ctx[4] - 2 + "px");
    			}

    			if (dirty & /*scale*/ 16) {
    				set_style(div, "height", /*scale*/ ctx[4] - 2 + "px");
    			}

    			if (dirty & /*left*/ 2) {
    				set_style(div, "left", /*left*/ ctx[1] + "px");
    			}

    			if (dirty & /*top*/ 1) {
    				set_style(div, "top", /*top*/ ctx[0] + "px");
    			}

    			if (dirty & /*direction*/ 8 && div_class_value !== (div_class_value = "snake-body " + /*direction*/ ctx[3] + " svelte-r68v0v")) {
    				attr(div, "class", div_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { top } = $$props;
    	let { left } = $$props;
    	let { isHead = false } = $$props;
    	let { direction = "right" } = $$props;
    	let { scale } = $$props;

    	$$self.$set = $$props => {
    		if ("top" in $$props) $$invalidate(0, top = $$props.top);
    		if ("left" in $$props) $$invalidate(1, left = $$props.left);
    		if ("isHead" in $$props) $$invalidate(2, isHead = $$props.isHead);
    		if ("direction" in $$props) $$invalidate(3, direction = $$props.direction);
    		if ("scale" in $$props) $$invalidate(4, scale = $$props.scale);
    	};

    	return [top, left, isHead, direction, scale];
    }

    class SnakeBody extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			top: 0,
    			left: 1,
    			isHead: 2,
    			direction: 3,
    			scale: 4
    		});
    	}
    }

    /* src\Snake.svelte generated by Svelte v3.22.2 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	child_ctx[5] = i;
    	return child_ctx;
    }

    // (8:0) {#each snakeBodies as snakeBody, i}
    function create_each_block(ctx) {
    	let current;

    	const snakebody = new SnakeBody({
    			props: {
    				isHead: /*i*/ ctx[5] == 0,
    				top: /*snakeBody*/ ctx[3].top,
    				left: /*snakeBody*/ ctx[3].left,
    				direction: /*direction*/ ctx[1],
    				scale: /*scale*/ ctx[2]
    			}
    		});

    	return {
    		c() {
    			create_component(snakebody.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(snakebody, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const snakebody_changes = {};
    			if (dirty & /*snakeBodies*/ 1) snakebody_changes.top = /*snakeBody*/ ctx[3].top;
    			if (dirty & /*snakeBodies*/ 1) snakebody_changes.left = /*snakeBody*/ ctx[3].left;
    			if (dirty & /*direction*/ 2) snakebody_changes.direction = /*direction*/ ctx[1];
    			if (dirty & /*scale*/ 4) snakebody_changes.scale = /*scale*/ ctx[2];
    			snakebody.$set(snakebody_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(snakebody.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(snakebody.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(snakebody, detaching);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*snakeBodies*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*snakeBodies, direction, scale*/ 7) {
    				each_value = /*snakeBodies*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { snakeBodies = [] } = $$props;
    	let { direction } = $$props;
    	let { scale } = $$props;

    	$$self.$set = $$props => {
    		if ("snakeBodies" in $$props) $$invalidate(0, snakeBodies = $$props.snakeBodies);
    		if ("direction" in $$props) $$invalidate(1, direction = $$props.direction);
    		if ("scale" in $$props) $$invalidate(2, scale = $$props.scale);
    	};

    	return [snakeBodies, direction, scale];
    }

    class Snake extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { snakeBodies: 0, direction: 1, scale: 2 });
    	}
    }

    /* src\Food.svelte generated by Svelte v3.22.2 */

    function create_if_block_5(ctx) {
    	let div;
    	let div_class_value;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", div_class_value = "" + (null_to_empty(/*foodType*/ ctx[3]) + " svelte-rrnddt"));
    			set_style(div, "width", 25 - 2 + "px");
    			set_style(div, "height", 25 - 2 + "px");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*foodType*/ 8 && div_class_value !== (div_class_value = "" + (null_to_empty(/*foodType*/ ctx[3]) + " svelte-rrnddt"))) {
    				attr(div, "class", div_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (68:38) 
    function create_if_block_4(ctx) {
    	let div;
    	let div_class_value;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", div_class_value = "" + (null_to_empty(/*foodType*/ ctx[3]) + " svelte-rrnddt"));
    			set_style(div, "width", 25 - 2 + "px");
    			set_style(div, "height", 25 - 2 + "px");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*foodType*/ 8 && div_class_value !== (div_class_value = "" + (null_to_empty(/*foodType*/ ctx[3]) + " svelte-rrnddt"))) {
    				attr(div, "class", div_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (66:38) 
    function create_if_block_3(ctx) {
    	let div;
    	let div_class_value;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", div_class_value = "" + (null_to_empty(/*foodType*/ ctx[3]) + " svelte-rrnddt"));
    			set_style(div, "width", 25 - 10 + "px");
    			set_style(div, "height", 25 - 10 + "px");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*foodType*/ 8 && div_class_value !== (div_class_value = "" + (null_to_empty(/*foodType*/ ctx[3]) + " svelte-rrnddt"))) {
    				attr(div, "class", div_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (64:30) 
    function create_if_block_2(ctx) {
    	let div;
    	let div_class_value;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", div_class_value = "" + (null_to_empty(/*foodType*/ ctx[3]) + " svelte-rrnddt"));
    			set_style(div, "left", /*foodLeft*/ ctx[1] + "px");
    			set_style(div, "top", /*foodTop*/ ctx[0] + "px");
    			set_style(div, "width", /*scale*/ ctx[2] - 2 + "px");
    			set_style(div, "height", /*scale*/ ctx[2] - 2 + "px");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*foodType*/ 8 && div_class_value !== (div_class_value = "" + (null_to_empty(/*foodType*/ ctx[3]) + " svelte-rrnddt"))) {
    				attr(div, "class", div_class_value);
    			}

    			if (dirty & /*foodLeft*/ 2) {
    				set_style(div, "left", /*foodLeft*/ ctx[1] + "px");
    			}

    			if (dirty & /*foodTop*/ 1) {
    				set_style(div, "top", /*foodTop*/ ctx[0] + "px");
    			}

    			if (dirty & /*scale*/ 4) {
    				set_style(div, "width", /*scale*/ ctx[2] - 2 + "px");
    			}

    			if (dirty & /*scale*/ 4) {
    				set_style(div, "height", /*scale*/ ctx[2] - 2 + "px");
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (62:32) 
    function create_if_block_1(ctx) {
    	let div;
    	let div_class_value;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", div_class_value = "" + (null_to_empty(/*foodType*/ ctx[3]) + " svelte-rrnddt"));
    			set_style(div, "left", /*foodLeft*/ ctx[1] + "px");
    			set_style(div, "top", /*foodTop*/ ctx[0] + "px");
    			set_style(div, "width", /*scale*/ ctx[2] - 2 + "px");
    			set_style(div, "height", /*scale*/ ctx[2] - 2 + "px");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*foodType*/ 8 && div_class_value !== (div_class_value = "" + (null_to_empty(/*foodType*/ ctx[3]) + " svelte-rrnddt"))) {
    				attr(div, "class", div_class_value);
    			}

    			if (dirty & /*foodLeft*/ 2) {
    				set_style(div, "left", /*foodLeft*/ ctx[1] + "px");
    			}

    			if (dirty & /*foodTop*/ 1) {
    				set_style(div, "top", /*foodTop*/ ctx[0] + "px");
    			}

    			if (dirty & /*scale*/ 4) {
    				set_style(div, "width", /*scale*/ ctx[2] - 2 + "px");
    			}

    			if (dirty & /*scale*/ 4) {
    				set_style(div, "height", /*scale*/ ctx[2] - 2 + "px");
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (60:0) {#if foodType === "normal"}
    function create_if_block$1(ctx) {
    	let div;
    	let div_class_value;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", div_class_value = "" + (null_to_empty(/*foodType*/ ctx[3]) + " svelte-rrnddt"));
    			set_style(div, "left", /*foodLeft*/ ctx[1] + 5 + "px");
    			set_style(div, "top", /*foodTop*/ ctx[0] + 5 + "px");
    			set_style(div, "width", /*scale*/ ctx[2] - 10 + "px");
    			set_style(div, "height", /*scale*/ ctx[2] - 10 + "px");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*foodType*/ 8 && div_class_value !== (div_class_value = "" + (null_to_empty(/*foodType*/ ctx[3]) + " svelte-rrnddt"))) {
    				attr(div, "class", div_class_value);
    			}

    			if (dirty & /*foodLeft*/ 2) {
    				set_style(div, "left", /*foodLeft*/ ctx[1] + 5 + "px");
    			}

    			if (dirty & /*foodTop*/ 1) {
    				set_style(div, "top", /*foodTop*/ ctx[0] + 5 + "px");
    			}

    			if (dirty & /*scale*/ 4) {
    				set_style(div, "width", /*scale*/ ctx[2] - 10 + "px");
    			}

    			if (dirty & /*scale*/ 4) {
    				set_style(div, "height", /*scale*/ ctx[2] - 10 + "px");
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*foodType*/ ctx[3] === "normal") return create_if_block$1;
    		if (/*foodType*/ ctx[3] === "threeX") return create_if_block_1;
    		if (/*foodType*/ ctx[3] === "slow") return create_if_block_2;
    		if (/*foodType*/ ctx[3] === "legendNormal") return create_if_block_3;
    		if (/*foodType*/ ctx[3] === "legendThreeX") return create_if_block_4;
    		if (/*foodType*/ ctx[3] === "legendSlow") return create_if_block_5;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (if_block) {
    				if_block.d(detaching);
    			}

    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { foodTop } = $$props;
    	let { foodLeft } = $$props;
    	let { scale } = $$props;
    	let { foodType } = $$props;

    	$$self.$set = $$props => {
    		if ("foodTop" in $$props) $$invalidate(0, foodTop = $$props.foodTop);
    		if ("foodLeft" in $$props) $$invalidate(1, foodLeft = $$props.foodLeft);
    		if ("scale" in $$props) $$invalidate(2, scale = $$props.scale);
    		if ("foodType" in $$props) $$invalidate(3, foodType = $$props.foodType);
    	};

    	return [foodTop, foodLeft, scale, foodType];
    }

    class Food extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			foodTop: 0,
    			foodLeft: 1,
    			scale: 2,
    			foodType: 3
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.22.2 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	return child_ctx;
    }

    // (236:6) {:else}
    function create_else_block(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Snake Game");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (234:6) {#if gameOver}
    function create_if_block_1$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Game Over - Press Enter");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (250:10) {#each sizes as size}
    function create_each_block$1(ctx) {
    	let option;
    	let t0_value = /*size*/ ctx[25] + "";
    	let t0;
    	let t1;
    	let option_value_value;

    	return {
    		c() {
    			option = element("option");
    			t0 = text(t0_value);
    			t1 = space();
    			option.__value = option_value_value = /*size*/ ctx[25];
    			option.value = option.__value;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t0);
    			append(option, t1);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    // (264:2) {#if showSlow}
    function create_if_block$2(ctx) {
    	let current;

    	const food = new Food({
    			props: {
    				foodTop: /*slowTop*/ ctx[9],
    				foodLeft: /*slowLeft*/ ctx[8],
    				scale: /*scale*/ ctx[0],
    				foodType: "slow"
    			}
    		});

    	return {
    		c() {
    			create_component(food.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(food, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const food_changes = {};
    			if (dirty & /*slowTop*/ 512) food_changes.foodTop = /*slowTop*/ ctx[9];
    			if (dirty & /*slowLeft*/ 256) food_changes.foodLeft = /*slowLeft*/ ctx[8];
    			if (dirty & /*scale*/ 1) food_changes.scale = /*scale*/ ctx[0];
    			food.$set(food_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(food.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(food.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(food, detaching);
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	let table;
    	let tr0;
    	let th;
    	let t0;
    	let tr1;
    	let td0;
    	let t1;
    	let t2;
    	let td1;
    	let t3;
    	let t4;
    	let td2;
    	let t5;
    	let t6;
    	let tr2;
    	let td3;
    	let t7;
    	let t8;
    	let td4;
    	let t9;
    	let t10;
    	let t11;
    	let td5;
    	let form;
    	let t12;
    	let select;
    	let t13;
    	let main;
    	let t14;
    	let t15;
    	let current;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*gameOver*/ ctx[7]) return create_if_block_1$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	const food0 = new Food({
    			props: {
    				scale: /*scale*/ ctx[0],
    				foodType: "legendNormal"
    			}
    		});

    	const food1 = new Food({
    			props: {
    				scale: /*scale*/ ctx[0],
    				foodType: "legendThreeX"
    			}
    		});

    	const food2 = new Food({
    			props: {
    				scale: /*scale*/ ctx[0],
    				foodType: "legendSlow"
    			}
    		});

    	let each_value = /*sizes*/ ctx[13];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const snake = new Snake({
    			props: {
    				snakeBodies: /*snakeBodies*/ ctx[5],
    				direction: /*direction*/ ctx[4],
    				scale: /*scale*/ ctx[0]
    			}
    		});

    	const food3 = new Food({
    			props: {
    				foodTop: /*foodTop*/ ctx[2],
    				foodLeft: /*foodLeft*/ ctx[1],
    				scale: /*scale*/ ctx[0],
    				foodType: /*foodType*/ ctx[3]
    			}
    		});

    	let if_block1 = /*showSlow*/ ctx[10] && create_if_block$2(ctx);

    	return {
    		c() {
    			table = element("table");
    			tr0 = element("tr");
    			th = element("th");
    			if_block0.c();
    			t0 = space();
    			tr1 = element("tr");
    			td0 = element("td");
    			t1 = text("Food");
    			create_component(food0.$$.fragment);
    			t2 = space();
    			td1 = element("td");
    			t3 = text("3X Food");
    			create_component(food1.$$.fragment);
    			t4 = space();
    			td2 = element("td");
    			t5 = text("Slow");
    			create_component(food2.$$.fragment);
    			t6 = space();
    			tr2 = element("tr");
    			td3 = element("td");
    			t7 = text("Score ");
    			t8 = text(/*score*/ ctx[11]);
    			td4 = element("td");
    			t9 = text("Speed ");
    			t10 = text(/*speed*/ ctx[12]);
    			t11 = space();
    			td5 = element("td");
    			form = element("form");
    			t12 = text("Size: ");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t13 = space();
    			main = element("main");
    			create_component(snake.$$.fragment);
    			t14 = space();
    			create_component(food3.$$.fragment);
    			t15 = space();
    			if (if_block1) if_block1.c();
    			attr(th, "colspan", "3");
    			attr(th, "class", "svelte-1c5k3zr");
    			attr(td0, "class", "svelte-1c5k3zr");
    			attr(td1, "class", "svelte-1c5k3zr");
    			attr(td2, "class", "svelte-1c5k3zr");
    			attr(td3, "class", "svelte-1c5k3zr");
    			attr(td4, "class", "svelte-1c5k3zr");
    			if (/*sizeSelected*/ ctx[6] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[24].call(select));
    			attr(form, "class", "sizeForm svelte-1c5k3zr");
    			attr(td5, "class", "svelte-1c5k3zr");
    			attr(table, "class", "svelte-1c5k3zr");
    			set_style(main, "width", boardWidth + "px");
    			set_style(main, "height", boardHeight + "px");
    			attr(main, "class", "svelte-1c5k3zr");
    		},
    		m(target, anchor, remount) {
    			insert(target, table, anchor);
    			append(table, tr0);
    			append(tr0, th);
    			if_block0.m(th, null);
    			append(table, t0);
    			append(table, tr1);
    			append(tr1, td0);
    			append(td0, t1);
    			mount_component(food0, td0, null);
    			append(tr1, t2);
    			append(tr1, td1);
    			append(td1, t3);
    			mount_component(food1, td1, null);
    			append(tr1, t4);
    			append(tr1, td2);
    			append(td2, t5);
    			mount_component(food2, td2, null);
    			append(table, t6);
    			append(table, tr2);
    			append(tr2, td3);
    			append(td3, t7);
    			append(td3, t8);
    			append(tr2, td4);
    			append(td4, t9);
    			append(td4, t10);
    			append(tr2, t11);
    			append(tr2, td5);
    			append(td5, form);
    			append(form, t12);
    			append(form, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*sizeSelected*/ ctx[6]);
    			insert(target, t13, anchor);
    			insert(target, main, anchor);
    			mount_component(snake, main, null);
    			append(main, t14);
    			mount_component(food3, main, null);
    			append(main, t15);
    			if (if_block1) if_block1.m(main, null);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen(window, "keydown", /*onKeyDown*/ ctx[15]),
    				listen(select, "change", /*select_change_handler*/ ctx[24]),
    				listen(select, "change", /*scaleChanged*/ ctx[14])
    			];
    		},
    		p(ctx, [dirty]) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(th, null);
    				}
    			}

    			const food0_changes = {};
    			if (dirty & /*scale*/ 1) food0_changes.scale = /*scale*/ ctx[0];
    			food0.$set(food0_changes);
    			const food1_changes = {};
    			if (dirty & /*scale*/ 1) food1_changes.scale = /*scale*/ ctx[0];
    			food1.$set(food1_changes);
    			const food2_changes = {};
    			if (dirty & /*scale*/ 1) food2_changes.scale = /*scale*/ ctx[0];
    			food2.$set(food2_changes);
    			if (!current || dirty & /*score*/ 2048) set_data(t8, /*score*/ ctx[11]);
    			if (!current || dirty & /*speed*/ 4096) set_data(t10, /*speed*/ ctx[12]);

    			if (dirty & /*sizes*/ 8192) {
    				each_value = /*sizes*/ ctx[13];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*sizeSelected*/ 64) {
    				select_option(select, /*sizeSelected*/ ctx[6]);
    			}

    			const snake_changes = {};
    			if (dirty & /*snakeBodies*/ 32) snake_changes.snakeBodies = /*snakeBodies*/ ctx[5];
    			if (dirty & /*direction*/ 16) snake_changes.direction = /*direction*/ ctx[4];
    			if (dirty & /*scale*/ 1) snake_changes.scale = /*scale*/ ctx[0];
    			snake.$set(snake_changes);
    			const food3_changes = {};
    			if (dirty & /*foodTop*/ 4) food3_changes.foodTop = /*foodTop*/ ctx[2];
    			if (dirty & /*foodLeft*/ 2) food3_changes.foodLeft = /*foodLeft*/ ctx[1];
    			if (dirty & /*scale*/ 1) food3_changes.scale = /*scale*/ ctx[0];
    			if (dirty & /*foodType*/ 8) food3_changes.foodType = /*foodType*/ ctx[3];
    			food3.$set(food3_changes);

    			if (/*showSlow*/ ctx[10]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*showSlow*/ 1024) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block$2(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(main, null);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(food0.$$.fragment, local);
    			transition_in(food1.$$.fragment, local);
    			transition_in(food2.$$.fragment, local);
    			transition_in(snake.$$.fragment, local);
    			transition_in(food3.$$.fragment, local);
    			transition_in(if_block1);
    			current = true;
    		},
    		o(local) {
    			transition_out(food0.$$.fragment, local);
    			transition_out(food1.$$.fragment, local);
    			transition_out(food2.$$.fragment, local);
    			transition_out(snake.$$.fragment, local);
    			transition_out(food3.$$.fragment, local);
    			transition_out(if_block1);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(table);
    			if_block0.d();
    			destroy_component(food0);
    			destroy_component(food1);
    			destroy_component(food2);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(t13);
    			if (detaching) detach(main);
    			destroy_component(snake);
    			destroy_component(food3);
    			if (if_block1) if_block1.d();
    			run_all(dispose);
    		}
    	};
    }

    let boardWidth = 1200;
    let boardHeight = 700;

    function isCollide(a, b) {
    	return !(a.top < b.top || a.top > b.top || a.left < b.left || a.left > b.left);
    }

    function isGameOver(newSnakeBodies) {
    	const snakeBodiesNoHead = newSnakeBodies.slice(1);
    	const snakeCollisions = snakeBodiesNoHead.filter(sb => isCollide(sb, newSnakeBodies[0]));

    	if (snakeCollisions.length > 0) {
    		return true;
    	}

    	const { top, left } = newSnakeBodies[0];

    	if (top >= boardHeight || top < 0 || left < 0 || left >= boardWidth) {
    		return true;
    	}

    	return false;
    }

    function getDirectionFromKeyCode(keyCode) {
    	if (keyCode === 38) {
    		return "up";
    	} else if (keyCode === 39) {
    		return "right";
    	} else if (keyCode === 37) {
    		return "left";
    	} else if (keyCode === 40) {
    		return "down";
    	}

    	return false;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let scale = 50;
    	let interval = 400;
    	let foodLeft = scale;
    	let foodTop = scale * 4;
    	let foodType = "normal";
    	let direction = "right";
    	let snakeBodies = [];
    	let sizes = [25, 50, 100];
    	let sizeSelected = scale;
    	let gameOver = false;
    	let slowLeft = scale * 5;
    	let slowTop = scale * 5;
    	let showSlow = false;
    	let slowTickShown = 0;

    	function gameLoop() {
    		if (!gameOver) {
    			let newSnakeBodies = [...snakeBodies];
    			newSnakeBodies.pop();
    			let { left, top } = newSnakeBodies[0];

    			if (direction === "up") {
    				top -= scale;
    			} else if (direction === "down") {
    				top += scale;
    			} else if (direction === "left") {
    				left -= scale;
    			} else if (direction === "right") {
    				left += scale;
    			}

    			const newHead = { left, top };
    			newSnakeBodies = [newHead, ...newSnakeBodies];

    			if (isGameOver(newSnakeBodies)) {
    				$$invalidate(7, gameOver = true);
    			} else {
    				$$invalidate(5, snakeBodies = [...newSnakeBodies]);

    				if (isCollide(newHead, { left: foodLeft, top: foodTop })) {
    					snakeAteFood();
    				} else if (isCollide(newHead, { left: slowLeft, top: slowTop })) {
    					snakeAteSlow();
    				}

    				if (showSlow) {
    					slowTickShown += 1;

    					if (Math.random() < slowTickShown / 2000) {
    						$$invalidate(10, showSlow = false);
    						slowTickShown = 0;
    						moveSlow();
    					}
    				} else {
    					if (Math.random() > 0.995) {
    						moveSlow();
    						$$invalidate(10, showSlow = true);
    					}
    				}
    			}
    		}

    		setTimeout(gameLoop, interval);
    	}

    	

    	function snakeAteFood() {
    		if (foodType === "normal") {
    			$$invalidate(5, snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]]);
    		} else if (foodType === "threeX") {
    			$$invalidate(5, snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]]);
    			$$invalidate(5, snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]]);
    			$$invalidate(5, snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]]);
    		}

    		moveFood();
    		let newSpeed = scale / interval;
    		newSpeed = newSpeed * 1.05;
    		$$invalidate(16, interval = Math.floor(scale / newSpeed));
    		$$invalidate(12, speed = Math.floor(Math.floor(scale / interval * 10000) / 100));
    	}

    	function snakeAteSlow() {
    		$$invalidate(10, showSlow = false);
    		slowTickShown = 0;
    		let newSpeed = scale / interval;
    		newSpeed = newSpeed * 0.75;
    		$$invalidate(16, interval = Math.floor(scale / newSpeed));
    		$$invalidate(12, speed = Math.floor(Math.floor(scale / interval * 10000) / 100));
    	}

    	function moveFood() {
    		let goodFood = false;

    		while (!goodFood) {
    			$$invalidate(2, foodTop = Math.floor(Math.random() * (Math.floor(boardHeight / scale) - 1)) * scale);
    			$$invalidate(1, foodLeft = Math.floor(Math.random() * (Math.floor(boardWidth / scale) - 1)) * scale);
    			const foodInSnake = snakeBodies.filter(sb => isCollide(sb, { left: foodLeft, top: foodTop }));
    			goodFood = foodInSnake.length == 0;
    		}

    		if (Math.random() > 0.8) {
    			$$invalidate(3, foodType = "threeX");
    		} else {
    			$$invalidate(3, foodType = "normal");
    		}
    	}

    	function moveSlow() {
    		let goodFood = false;

    		while (!goodFood) {
    			$$invalidate(9, slowTop = Math.floor(Math.random() * (Math.floor(boardHeight / scale) - 1)) * scale);
    			$$invalidate(8, slowLeft = Math.floor(Math.random() * (Math.floor(boardWidth / scale) - 1)) * scale);
    			const foodInSnake = snakeBodies.filter(sb => isCollide(sb, { left: slowLeft, top: slowTop }));
    			goodFood = foodInSnake.length == 0;
    		}
    	}

    	function resetGame() {
    		$$invalidate(7, gameOver = false);
    		$$invalidate(10, showSlow = false);
    		moveFood();
    		moveSlow();
    		$$invalidate(4, direction = "right");
    		$$invalidate(16, interval = Math.floor(scale * 8));
    		$$invalidate(5, snakeBodies = [{ left: scale * 2, top: 0 }, { left: scale, top: 0 }, { left: 0, top: 0 }]);
    	}

    	

    	function scaleChanged(e) {
    		$$invalidate(0, scale = sizeSelected);
    		e.currentTarget.blur();
    		resetGame();
    	}

    	function onKeyDown(e) {
    		if (gameOver && e.keyCode === 13) {
    			resetGame();
    		}

    		const newDirection = getDirectionFromKeyCode(e.keyCode);

    		if (newDirection) {
    			$$invalidate(4, direction = newDirection);
    		}
    	}

    	
    	resetGame();
    	setTimeout(gameLoop, interval);

    	function select_change_handler() {
    		sizeSelected = select_value(this);
    		$$invalidate(6, sizeSelected);
    		$$invalidate(13, sizes);
    	}

    	let score;
    	let speed;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*snakeBodies*/ 32) {
    			 $$invalidate(11, score = snakeBodies.length - 3);
    		}

    		if ($$self.$$.dirty & /*scale, interval*/ 65537) {
    			 $$invalidate(12, speed = Math.floor(scale / interval * 100));
    		}
    	};

    	return [
    		scale,
    		foodLeft,
    		foodTop,
    		foodType,
    		direction,
    		snakeBodies,
    		sizeSelected,
    		gameOver,
    		slowLeft,
    		slowTop,
    		showSlow,
    		score,
    		speed,
    		sizes,
    		scaleChanged,
    		onKeyDown,
    		interval,
    		slowTickShown,
    		gameLoop,
    		snakeAteFood,
    		snakeAteSlow,
    		moveFood,
    		moveSlow,
    		resetGame,
    		select_change_handler
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
