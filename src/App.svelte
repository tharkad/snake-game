<script>
  import Snake from "./Snake.svelte";
  import Food from "./Food.svelte";
  let scale = 50;
  let interval = 400;
  let foodLeft = scale;
  let foodTop = scale * 4;
  let boardWidth = 1200;
  let boardHeight = 700;
  let direction = "right";
  let snakeBodies = [];
  let sizes = [25, 50, 100];
  let sizeSelected = scale;

  
  $: score = snakeBodies.length - 3;
  $: speed = Math.floor(scale/interval * 100);

  function gameLoop() {
    snakeBodies.pop();

    let {left, top} = snakeBodies[0];

    if (direction === "up") {
      top -= scale;
    } else if (direction === "down") {
      top += scale;
    } else if (direction === "left") {
      left -= scale;
    } else if (direction === "right") {
      left += scale;
    }

    const newHead = {left, top};
    snakeBodies = [newHead, ...snakeBodies];

    if (isCollide(newHead, {left: foodLeft, top: foodTop})) {
      moveFood();
      snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]];
      let newSpeed = scale / interval;
      newSpeed = newSpeed * 1.05;
      console.log(scale, interval, newSpeed);
      console.log(newSpeed * interval);
      interval = Math.floor(scale / newSpeed);
      console.log(interval);
      speed = Math.floor(Math.floor((scale/interval) * 10000) / 100);
    }

    if (isGameOver()) {
      resetGame();
    }

    setTimeout(gameLoop, interval);
  };

  setTimeout(gameLoop, interval);
    
  function isCollide(a, b) {
    return !(
      a.top < b.top ||
      a.top > b.top ||
      a.left < b.left ||
      a.left > b.left
    );
  }

  function moveFood() {
    let goodFood = false;
    while (!goodFood) {
      foodTop = Math.floor((Math.random() * (Math.floor(boardHeight/scale) - 1))) * scale;
      foodLeft = Math.floor((Math.random() * (Math.floor(boardWidth/scale) - 1))) * scale;
      const foodInSnake = snakeBodies.filter(sb => isCollide(sb, {left: foodLeft, top: foodTop}));
      goodFood = (foodInSnake.length == 0);
    }
  }

  function isGameOver() {
    const snakeBodiesNoHead = snakeBodies.slice(1);
    const snakeCollisions = snakeBodiesNoHead.filter(sb => isCollide(sb, snakeBodies[0]));
    if (snakeCollisions.length > 0) {
      return true;
    }

    const {top, left} = snakeBodies[0];
    if (top >= boardHeight || top < 0 || left < 0 || left >= boardWidth) {
      return true;
    }

    return false;
  }

  function resetGame() {
    moveFood();
    direction = "right";
    interval = Math.floor(scale * 8);
    snakeBodies = [
      {
        left: scale * 2,
        top: 0
      },
      {
        left: scale,
        top: 0
      },
      {
        left: 0,
        top: 0
      }
    ];
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
  };

  function scaleChanged(e) {
    scale = sizeSelected;
    e.currentTarget.blur();
    resetGame();
  }

  function onKeyDown(e) {
    const newDirection = getDirectionFromKeyCode(e.keyCode);
    if (newDirection) {
      direction = newDirection;
    }
  };

  resetGame();
</script>

<style>
  main {
    border: solid black 1px;
    position: relative;
    margin: 20px auto;
    background-image: url("../background.jpg");
    background-size: cover;
  }
  h2,
  h1 {
    text-align: center;
  }
  .sizeForm {
    text-align: center;
  }
  table {
    border:1px solid black;
    margin-left:auto;
    margin-right:auto;
    font-size: 2em;
  }
  td {
    padding: 10px;
  }
</style>

<table>
  <tr>
    <th colspan="3">Snake Game</th>
  </tr>
  <tr>
    <td>Score {score}</td><td>Speed {speed}</td>
    <td>
      <form class="sizeForm">
        Size: <select bind:value={sizeSelected} on:change={scaleChanged}>
          {#each sizes as size}
            <option value={size}>
              {size}
            </option>
          {/each}
        </select>
      </form>    
    </td>
  </tr>
</table>

<main style="width: {boardWidth}px; height: {boardHeight}px">
  <Snake {snakeBodies} {direction} {scale}/>
  <Food {foodTop} {foodLeft} {scale}/>
</main>


<svelte:window on:keydown={onKeyDown}/> 