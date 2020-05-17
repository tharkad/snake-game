<script>
  export let foodTop;
  export let foodLeft;
  export let scale;
</script>

<style>
  .food {
    position: absolute;
    border: solid black 1px;
    background-color: red;
    border-radius: 50%;
    z-index: 0;
  }
</style>

<div class="food" 
  style="left: {foodLeft}px; top: {foodTop}px; width: {scale - 2}px; height: {scale - 2}px"
/>
