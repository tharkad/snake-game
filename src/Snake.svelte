<script>
  import SnakeBody from "./SnakeBody.svelte";
  export let snakeBodies = [];
  export let direction;
  export let scale
</script>

{#each snakeBodies as snakeBody, i}
  <SnakeBody 
    isHead = {i == 0}
    top={snakeBody.top} 
    left={snakeBody.left}
    {direction}
    {scale}
  />
{/each}
