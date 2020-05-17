<script>
  import Snake from "./Snake.svelte";
  import Food from "./Food.svelte";
  let scale = 50;
  let interval = 400;
  let foodLeft = scale;
  let foodTop = scale * 4;
  let boardWidth = 1200;
  let boardHeight = 900;
  let direction = "right";
  let snakeBodies = [];
  
  $: score = snakeBodies.length - 3;

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
      if (interval > 100) {
        interval -= 10;
      }
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
</style>

<h1>Snake Game</h1>
<main style="width: {boardWidth}px; height: {boardHeight}px">
  <Snake {snakeBodies} {direction} {scale}/>
  <Food {foodTop} {foodLeft} {scale}/>
</main>
<h2>Score {score}</h2>
<svelte:window on:keydown={onKeyDown}/>