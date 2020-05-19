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
    border-radius: 30%;
    z-index: 0;
  }

  .slow {
    position: absolute;
    border: solid black 1px;
    background-color: rgb(202, 83, 182);
    border-radius: 10%;
    z-index: 0;
  }

  .legendNormal {
    margin: 0 auto;
    border: solid black 1px;
    background-color: greenyellow;
    border-radius: 50%;
    z-index: 0;
  }

  .legendThreeX {
    margin: 0 auto;
    border: solid black 1px;
    background-color: red;
    border-radius: 30%;
    z-index: 0;
  }

  .legendSlow {
    margin: 0 auto;
    border: solid black 1px;
    background-color: rgb(202, 83, 182);
    border-radius: 10%;
    z-index: 0;
  }


</style>

{#if foodType === "normal"}
  <div class={foodType} style="left: {foodLeft + 5}px; top: {foodTop + 5}px; width: {scale - 10}px; height: {scale - 10}px" />
{:else if foodType === "threeX"}
  <div class={foodType} style="left: {foodLeft}px; top: {foodTop}px; width: {scale - 2}px; height: {scale - 2}px" />
{:else if foodType === "slow"}
  <div class={foodType} style="left: {foodLeft}px; top: {foodTop}px; width: {scale - 2}px; height: {scale - 2}px" />
{:else if foodType === "legendNormal"}
  <div class={foodType} style="width: {25 - 10}px; height: {25 - 10}px" />
{:else if foodType === "legendThreeX"}
  <div class={foodType} style="width: {25 - 2}px; height: {25 - 2}px" />
{:else if foodType === "legendSlow"}
  <div class={foodType} style="width: {25 - 2}px; height: {25 - 2}px" />
{/if}