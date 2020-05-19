<script>
  import Snake from "./Snake.svelte";
  import Food from "./Food.svelte";
  let scale = 50;
  let interval = 400;
  let foodLeft = scale;
  let foodTop = scale * 4;
  let foodType = "normal";
  let boardWidth = 1200;
  let boardHeight = 700;
  let direction = "right";
  let snakeBodies = [];
  let sizes = [25, 50, 100];
  let sizeSelected = scale;
  let gameOver = false;
  let slowLeft = scale * 5;
  let slowTop = scale * 5;
  let showSlow = false;
  let slowTickShown = 0;

  $: score = snakeBodies.length - 3;
  $: speed = Math.floor(scale/interval * 100);

  function gameLoop() {
    if (!gameOver) {
      let newSnakeBodies = [...snakeBodies];
      newSnakeBodies.pop();

      let {left, top} = newSnakeBodies[0];

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
      newSnakeBodies = [newHead, ...newSnakeBodies];

      if (isGameOver(newSnakeBodies)) {
        gameOver = true;
      }
      else {
        snakeBodies = [...newSnakeBodies];

        if (isCollide(newHead, {left: foodLeft, top: foodTop})) {
          snakeAteFood();
        } else if (isCollide(newHead, {left: slowLeft, top: slowTop})) {
          snakeAteSlow();
        }       

        if (showSlow) {
          slowTickShown += 1;
          if (Math.random() < (slowTickShown/2000)) {
            showSlow = false;
            slowTickShown = 0;
            moveSlow();
          }
        } else {
          if (Math.random() > 0.995) {
            moveSlow();
            showSlow = true;
          }
        }
      }
    }

    setTimeout(gameLoop, interval);
  };
    
  function isCollide(a, b) {
    return !(
      a.top < b.top ||
      a.top > b.top ||
      a.left < b.left ||
      a.left > b.left
    );
  }

  function snakeAteFood() {
    if (foodType === "normal") {
      snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]];
    } else if (foodType === "threeX") {
      snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]];
      snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]];
      snakeBodies = [...snakeBodies, snakeBodies[snakeBodies.length - 1]];
    }
    moveFood();
    let newSpeed = scale / interval;
    newSpeed = newSpeed * 1.05;
    interval = Math.floor(scale / newSpeed);
    speed = Math.floor(Math.floor((scale/interval) * 10000) / 100);
  }

  function snakeAteSlow() {
    showSlow = false;
    slowTickShown = 0;
    let newSpeed = scale / interval;
    newSpeed = newSpeed * 0.75;
    interval = Math.floor(scale / newSpeed);
    speed = Math.floor(Math.floor((scale/interval) * 10000) / 100);
  }

  function moveFood() {
    let goodFood = false;
    while (!goodFood) {
      foodTop = Math.floor((Math.random() * (Math.floor(boardHeight/scale) - 1))) * scale;
      foodLeft = Math.floor((Math.random() * (Math.floor(boardWidth/scale) - 1))) * scale;
      const foodInSnake = snakeBodies.filter(sb => isCollide(sb, {left: foodLeft, top: foodTop}));
      goodFood = (foodInSnake.length == 0);
    }
    if (Math.random() > 0.8) {
      foodType = "threeX";
    } else {
      foodType = "normal";
    }
  }

  function moveSlow() {
    let goodFood = false;
    while (!goodFood) {
      slowTop = Math.floor((Math.random() * (Math.floor(boardHeight/scale) - 1))) * scale;
      slowLeft = Math.floor((Math.random() * (Math.floor(boardWidth/scale) - 1))) * scale;
      const foodInSnake = snakeBodies.filter(sb => isCollide(sb, {left: slowLeft, top: slowTop}));
      goodFood = (foodInSnake.length == 0);
    }
  }

  function isGameOver(newSnakeBodies) {
    const snakeBodiesNoHead = newSnakeBodies.slice(1);
    const snakeCollisions = snakeBodiesNoHead.filter(sb => isCollide(sb, newSnakeBodies[0]));
    if (snakeCollisions.length > 0) {
      return true;
    }

    const {top, left} = newSnakeBodies[0];
    if (top >= boardHeight || top < 0 || left < 0 || left >= boardWidth) {
      return true;
    }

    return false;
  }

  function resetGame() {
    gameOver = false;
    showSlow = false;
    moveFood();
    moveSlow();
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
    if (gameOver && e.keyCode === 13) {
      resetGame();
    }
    const newDirection = getDirectionFromKeyCode(e.keyCode);
    if (newDirection) {
      direction = newDirection;
    }
  };

  resetGame();
  setTimeout(gameLoop, interval);
</script>

<style>
  main {
    border: solid black 1px;
    position: relative;
    margin: 20px auto;
    background-image: url("../background.jpg");
    background-size: cover;
  }
  .sizeForm {
    text-align: center;
  }
  table {
    border:1px solid black;
    margin-left:auto;
    margin-right:auto;
    font-size: 2em;
    align-content: center;
  }
  td, th {
    text-align: center;
    align-items: center;
    align-content: center;
    padding: 4px;
  }
</style>

<table>
  <tr>
    <th colspan="3">
      {#if gameOver}
        Game Over - Press Enter
      {:else}
        Snake Game
      {/if}
  </tr>
  <tr>
    <td>Food<Food {scale} foodType='legendNormal' /></td>
    <td>3X Food<Food {scale} foodType='legendThreeX' /></td>
    <td>Slow<Food {scale} foodType='legendSlow' /></td>
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
  <Food {foodTop} {foodLeft} {scale} {foodType} />
  {#if showSlow}
    <Food foodTop={slowTop} foodLeft={slowLeft} {scale} foodType='slow' />
  {/if}
</main>


<svelte:window on:keydown={onKeyDown}/> 