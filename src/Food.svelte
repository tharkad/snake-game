<script>
  export let foodTop;
  export let foodLeft;
  export let scale;
  export let foodType;
</script>

<style>
  .normal {
    position: absolute;
    border: solid black 1px;
    background-color: greenyellow;
    border-radius: 50%;
    z-index: 0;
  }

  .threeX {
    position: absolute;
    border: solid black 1px;
    background-color: red;
    border-radius: 20%;
    z-index: 0;
  }
</style>

{#if foodType === "normal"}
  <div class={foodType} style="left: {foodLeft + 5}px; top: {foodTop + 5}px; width: {scale - 10}px; height: {scale - 10}px" />
{:else}
  <div class={foodType} style="left: {foodLeft}px; top: {foodTop}px; width: {scale - 2}px; height: {scale - 2}px" />
{/if}