"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreOutput = document.querySelector("#score");
const bestOutput = document.querySelector("#best");
const livesOutput = document.querySelector("#lives");
const levelOutput = document.querySelector("#level");
const statusOutput = document.querySelector("#game-status");
const pauseButton = document.querySelector("#pause");
const WIDTH = 960;
const HEIGHT = 720;
const COLS = 28;
const ROWS = 31;
const TILE = 22;
const PX = 172;
const MY = 19;
const BASE_SPEED = 9;
const BG = "#020106";
const PATH = "#0a0706";
const CORN = "#0e2814";
const directionOrder = ["up", "left", "down", "right"];
const vectors = {
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  down: { x: 0, y: 1 },
  right: { x: 1, y: 0 },
};
const keysToDirection = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowDown: "down", s: "down", S: "down",
  ArrowRight: "right", d: "right", D: "right",
};
const horizontalSegments = [
  [1, 1, 12], [5, 1, 13], [8, 1, 6], [8, 9, 12],
  [11, 9, 13], [14, 0, 9], [17, 9, 13], [20, 1, 12],
  [23, 1, 13], [26, 1, 6], [26, 9, 12], [29, 1, 13],
];
const verticalSegments = [
  [1, 1, 8], [6, 1, 26], [12, 1, 5], [9, 5, 8],
  [12, 8, 11], [9, 11, 20], [12, 17, 20], [1, 20, 23],
  [3, 23, 26], [9, 23, 26], [12, 26, 29], [1, 26, 29],
];
const ghostDefinitions = [
  { name: "Blaze", color: "#e23a28", shade: "#a8221c", scatter: { x: 25, y: -3 }, target: "chaser" },
  { name: "Pepper", color: "#f480b2", shade: "#c85486", scatter: { x: 2, y: -3 }, target: "ambusher" },
  { name: "Frost", color: "#eeeae0", shade: "#b9b4a8", scatter: { x: 27, y: 31 }, target: "trickster" },
  { name: "Squash", color: "#ec6828", shade: "#be401e", scatter: { x: 0, y: 31 }, target: "shy" },
];
const frightenedDurations = [6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1];
const fruitBonuses = [100, 300, 500, 500, 1000, 1000, 2000, 2000];
const modesForLevel = (value) => value === 1 ? [7, 20, 7, 20, 5, 20, 5] : value < 5 ? [7, 20, 7, 20, 5] : [5, 20, 5, 20, 5];
const releaseThresholds = (value) => value === 1 ? [0, 0, 30, 60] : value === 2 ? [0, 0, 0, 50] : [0, 0, 0, 0];
const levelSpeeds = (value) => {
  if (value === 1) return { player: 0.8, ghost: 0.75, frightened: 0.5, playerFrightened: 0.9, tunnel: 0.4 };
  if (value <= 4) return { player: 0.9, ghost: 0.85, frightened: 0.55, playerFrightened: 0.95, tunnel: 0.45 };
  return { player: 1, ghost: 0.95, frightened: 0.6, playerFrightened: 1, tunnel: 0.5 };
};
const logo = new Image();
logo.src = "patchman-logo.png";

let maze = [];
let dots = new Set();
let powers = new Set();
let actors = [];
let player;
let level = 1;
let score = 0;
let bestScore = 0;
let lives = 3;
let eatenCount = 0;
let houseDots = 0;
let ghostChain = 0;
let fruitIndex = 0;
let fruitTimer = 0;
let fruit = null;
let modeIndex = 0;
let modeTimer = 0;
let frightenedTimer = 0;
let releaseTimer = 0;
let state = "title";
let stateTimer = 0;
let lastFrame = 0;
let animationTime = 0;
let highScores = [];
let initials = ["A", "A", "A"];
let initialsCursor = 0;
let gamepadDirection = null;
let gamepadFire = false;
let highScoreSaveFailed = false;

try {
  bestScore = Number(localStorage.getItem("mpp-patchman-best")) || 0;
  const savedScores = JSON.parse(localStorage.getItem("mpp-patchman-scores") || "[]");
  if (Array.isArray(savedScores)) highScores = savedScores.filter((entry) => entry && Number.isFinite(entry.score) && typeof entry.name === "string").slice(0, 10);
} catch {
  bestScore = 0;
  highScores = [];
}

function makeActor(x, y, direction, role, index = -1) {
  return { x, y, direction, wanted: direction, role, index, mode: role === "player" ? "active" : index === 0 ? "active" : "house", releaseAt: 0, deathTimer: 0, anim: 0 };
}

function keyOf(x, y) {
  return `${x},${y}`;
}

function cellOf(actor) {
  return { x: Math.floor(actor.x), y: Math.round(actor.y) };
}

function isOpen(x, y, allowHouse = false) {
  const col = ((Math.floor(x) % COLS) + COLS) % COLS;
  const row = Math.round(y);
  if (row < 0 || row >= ROWS) return false;
  if (!maze[row]?.[col]) return false;
  if (allowHouse) return true;
  return !(col >= 9 && col <= 18 && row >= 11 && row <= 17);
}

function buildMaze() {
  maze = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const open = (col, row) => {
    if (row < 0 || row >= ROWS) return;
    maze[row][col] = true;
    maze[row][COLS - 1 - col] = true;
  };
  for (const [row, start, end] of horizontalSegments) {
    for (let col = start; col <= end; col += 1) open(col, row);
  }
  for (const [col, start, end] of verticalSegments) {
    for (let row = start; row <= end; row += 1) open(col, row);
  }
  for (let row = 12; row <= 16; row += 1) {
    for (let col = 10; col <= 17; col += 1) maze[row][col] = true;
  }
  const excluded = new Set(["13,23", "14,23"]);
  dots = new Set();
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (!maze[row][col] || row === 14 || (col >= 9 && col <= 18 && row >= 11 && row <= 17)) continue;
      if (!excluded.has(keyOf(col, row))) dots.add(keyOf(col, row));
    }
  }
  powers = new Set(["1,3", "26,3", "1,26", "26,26"]);
  for (const key of powers) dots.delete(key);
}

function resetActors(afterDeath = false) {
  player = makeActor(13.5, 23, "left", "player");
  actors = [
    makeActor(13.5, 11, "left", "ghost", 0),
    makeActor(13.5, 14, "down", "ghost", 1),
    makeActor(11.5, 14, "up", "ghost", 2),
    makeActor(15.5, 14, "up", "ghost", 3),
  ];
  const thresholds = afterDeath ? [0, 7, 17, 32] : releaseThresholds(level);
  actors.forEach((ghost, index) => {
    ghost.mode = index === 0 ? "active" : "house";
    ghost.releaseAt = thresholds[index];
  });
  frightenedTimer = 0;
  ghostChain = 0;
  releaseTimer = 0;
  modeIndex = 0;
  modeTimer = modesForLevel(level)[0];
}

function newGame() {
  score = 0;
  lives = 3;
  level = 1;
  eatenCount = 0;
  houseDots = 0;
  fruitIndex = 0;
  fruit = null;
  fruitTimer = 0;
  buildMaze();
  resetActors();
  state = "ready";
  stateTimer = 4;
  pauseButton.textContent = "Pause";
  announce("Ready! Guide Patch Man through the corn maze.");
  syncHud();
  canvas.focus();
}

function advanceLevel() {
  level += 1;
  eatenCount = 0;
  houseDots = 0;
  fruit = null;
  fruitTimer = 0;
  buildMaze();
  resetActors();
  state = "ready";
  stateTimer = 2;
  announce(`Level ${level}. The jacks are quicker now!`);
  syncHud();
}

function syncHud() {
  scoreOutput.value = String(score);
  bestOutput.value = String(bestScore);
  livesOutput.value = String(lives);
  levelOutput.value = String(level);
}

function announce(message) {
  statusOutput.textContent = message;
}

function addScore(points) {
  score += points;
  if (score > bestScore) {
    bestScore = score;
    try {
      localStorage.setItem("mpp-patchman-best", String(bestScore));
    } catch {
      highScoreSaveFailed = true;
    }
  }
  if (score >= 20000 && Math.floor((score - points) / 20000) < Math.floor(score / 20000)) {
    lives += 1;
    announce("Bonus scarecrow!");
  }
  syncHud();
}

function togglePause() {
  if (state === "playing") {
    state = "paused";
    pauseButton.textContent = "Resume";
    announce("Game paused.");
  } else if (state === "paused") {
    state = "playing";
    pauseButton.textContent = "Pause";
    announce("Game resumed.");
  }
}

function beginDeath() {
  if (state !== "playing") return;
  state = "dying";
  stateTimer = 3.4;
  announce("Oh no! Patch Man was caught.");
}

function completeDeath() {
  lives -= 1;
  if (lives <= 0) {
    finishGame();
    return;
  }
  houseDots = 0;
  resetActors(true);
  state = "ready";
  stateTimer = 2;
  announce(`${lives} lives left. Keep gathering candy corn!`);
  syncHud();
}

function finishGame() {
  const qualifies = highScores.length < 10 || score > highScores[highScores.length - 1].score;
  if (qualifies && score > 0) {
    initials = ["A", "A", "A"];
    initialsCursor = 0;
    state = "initials";
    announce("New high score! Enter your initials.");
  } else {
    state = "over";
    announce(`Game over. Final score ${score}.`);
  }
}

function saveInitials() {
  highScores.push({ name: initials.join(""), score });
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, 10);
  try {
    localStorage.setItem("mpp-patchman-scores", JSON.stringify(highScores));
  } catch {
    highScoreSaveFailed = true;
  }
  state = "scores";
  stateTimer = 8;
  announce("High score saved.");
}

function beginFrightened() {
  const duration = frightenedDurations[Math.min(level - 1, frightenedDurations.length - 1)];
  frightenedTimer = duration;
  ghostChain = 0;
  for (const ghost of actors) {
    if (ghost.mode === "active") ghost.direction = opposite(ghost.direction);
  }
}

function opposite(direction) {
  return ({ up: "down", down: "up", left: "right", right: "left" })[direction];
}

function distanceX(a, b) {
  const dx = Math.abs(a - b);
  return Math.min(dx, COLS - dx);
}

function wrappedDistance(a, b) {
  return Math.hypot(distanceX(a.x, b.x), a.y - b.y);
}

function closestTarget(ghost, target) {
  const candidates = [
    { x: target.x, y: target.y },
    { x: target.x - COLS, y: target.y },
    { x: target.x + COLS, y: target.y },
  ];
  return candidates.reduce((best, candidate) => {
    const currentDistance = Math.hypot(candidate.x - ghost.x, candidate.y - ghost.y);
    const bestDistance = Math.hypot(best.x - ghost.x, best.y - ghost.y);
    return currentDistance < bestDistance ? candidate : best;
  });
}

function playerTarget() {
  const cell = cellOf(player);
  const vector = vectors[player.direction];
  return { x: cell.x, y: cell.y, ahead: { x: cell.x + vector.x * 4, y: cell.y + vector.y * 4 } };
}

function targetFor(ghost) {
  const target = playerTarget();
  const definition = ghostDefinitions[ghost.index];
  if (modeIndex % 2 === 0) return definition.scatter;
  if (definition.target === "chaser") {
    if (dots.size < 20) return { x: target.x, y: target.y };
    return { x: target.x, y: target.y };
  }
  if (definition.target === "ambusher") return target.ahead;
  if (definition.target === "trickster") {
    const blaze = actors[0];
    const point = { x: target.ahead.x, y: target.ahead.y };
    const raw = { x: 2 * point.x - cellOf(blaze).x, y: 2 * point.y - cellOf(blaze).y };
    return { x: ((raw.x % COLS) + COLS) % COLS, y: raw.y };
  }
  if (wrappedDistance(ghost, { x: target.x + 0.5, y: target.y }) > 8) return { x: target.x, y: target.y };
  return definition.scatter;
}

function legalDirections(actor, allowReverse = false, allowHouse = false) {
  const result = [];
  for (const direction of directionOrder) {
    if (!allowReverse && direction === opposite(actor.direction)) continue;
    const vector = vectors[direction];
    if (isOpen(actor.x + vector.x, actor.y + vector.y, allowHouse)) result.push(direction);
  }
  return result;
}

function shortestDirections(start, target, actor, allowHouse = false) {
  const queue = [{ x: start.x, y: start.y, first: null }];
  const visited = new Set([keyOf(start.x, start.y)]);
  const wantedX = ((Math.floor(target.x) % COLS) + COLS) % COLS;
  const wantedY = Math.max(0, Math.min(ROWS - 1, Math.round(target.y)));
  let targetX = wantedX;
  let targetY = wantedY;
  if (!isOpen(targetX + 0.5, targetY, allowHouse)) {
    let bestDistance = Infinity;
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!isOpen(x + 0.5, y, allowHouse)) continue;
        const distance = Math.abs(x - wantedX) + Math.abs(y - wantedY);
        if (distance < bestDistance) {
          targetX = x;
          targetY = y;
          bestDistance = distance;
        }
      }
    }
  }
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.x === targetX && current.y === targetY) return [current.first || actor.direction];
    for (const direction of directionOrder) {
      if (current.first === null && !allowHouse && direction === opposite(actor.direction)) continue;
      const vector = vectors[direction];
      let x = current.x + vector.x;
      const y = current.y + vector.y;
      if (x < 0) x = COLS - 1;
      if (x >= COLS) x = 0;
      const id = keyOf(x, y);
      if (visited.has(id) || !isOpen(x + 0.5, y, allowHouse)) continue;
      visited.add(id);
      queue.push({ x, y, first: current.first || direction });
    }
  }
  const options = legalDirections(actor, false, allowHouse);
  return options.length ? options : legalDirections(actor, true, allowHouse);
}

function bestDirection(actor, target, allowHouse = false) {
  const options = shortestDirections(cellOf(actor), target, actor, allowHouse);
  if (!options.length) return actor.direction;
  return options[0];
}

function moveActor(actor, direction, speed, seconds, allowHouse = false) {
  if (!direction || !vectors[direction]) return;
  const vector = vectors[direction];
  let distance = speed * seconds;
  actor.direction = direction;
  while (distance > 0) {
    const tileCenterX = Math.floor(actor.x) + 0.5;
    const tileCenterY = Math.round(actor.y);
    const atCenter = Math.abs(actor.x - tileCenterX) < 0.0001 && Math.abs(actor.y - tileCenterY) < 0.0001;
    if (!atCenter) {
      const toX = vector.x ? (vector.x > 0 ? Math.ceil(actor.x - 0.5) + 0.5 : Math.floor(actor.x - 0.5) + 0.5) : actor.x;
      const toY = vector.y ? (vector.y > 0 ? Math.ceil(actor.y) : Math.floor(actor.y)) : actor.y;
      const step = Math.min(distance, vector.x ? Math.abs(toX - actor.x) : Math.abs(toY - actor.y));
      actor.x += vector.x * step;
      actor.y += vector.y * step;
      distance -= step;
      if (step === 0) break;
      continue;
    }
    let nextCol = Math.floor(actor.x) + vector.x;
    const nextRow = Math.round(actor.y) + vector.y;
    if (nextCol < 0) nextCol = COLS - 1;
    if (nextCol >= COLS) nextCol = 0;
    if (!isOpen(nextCol + 0.5, nextRow, allowHouse)) break;
    const nextY = actor.y + vector.y;
    const step = Math.min(distance, 1);
    actor.x += vector.x * step;
    actor.y += vector.y * step;
    distance -= step;
    if (actor.x <= -0.5) actor.x = COLS - 0.5;
    if (actor.x >= COLS + 0.5) actor.x = 0.5;
    if (step < 1) break;
  }
}

function movePlayer(seconds) {
  const speeds = levelSpeeds(level);
  const cell = cellOf(player);
  if (Math.abs(player.x - (cell.x + 0.5)) < 0.06 && Math.abs(player.y - cell.y) < 0.06) {
    const vector = vectors[player.wanted];
    if (vector && isOpen(player.x + vector.x, player.y + vector.y)) player.direction = player.wanted;
    const facing = vectors[player.direction];
    if (!facing || !isOpen(player.x + facing.x, player.y + facing.y)) return;
  }
  const tunnel = Math.round(player.y) === 14;
  const speed = BASE_SPEED * (frightenedTimer > 0 ? speeds.playerFrightened : speeds.player) * (tunnel ? speeds.tunnel : 1);
  moveActor(player, player.direction, speed, seconds);
  const tile = cellOf(player);
  const key = keyOf(tile.x, tile.y);
  if (dots.delete(key)) {
    eatenCount += 1;
    if (actors.some((ghost) => ghost.mode === "house")) houseDots += 1;
    addScore(10);
    if ([70, 170].includes(eatenCount)) {
      fruit = { x: 13.5, y: 17, kind: Math.min(fruitIndex, fruitBonuses.length - 1) };
      fruitTimer = 9 + Math.random();
    }
  }
  if (powers.delete(key)) {
    eatenCount += 1;
    if (actors.some((ghost) => ghost.mode === "house")) houseDots += 1;
    addScore(50);
    beginFrightened();
  }
  if (fruit && wrappedDistance(player, fruit) < 0.55) {
    addScore(fruitBonuses[Math.min(fruitIndex, fruitBonuses.length - 1)]);
    fruitIndex += 1;
    fruit = null;
    fruitTimer = 0;
    announce("A sweet harvest bonus!");
  }
  if (!dots.size && !powers.size) {
    state = "level-clear";
    stateTimer = 2.8;
    announce(`Level ${level} cleared!`);
  }
}

function releaseGhosts(seconds) {
  releaseTimer += seconds;
  const levelTime = level < 5 ? 4 : 3;
  for (const ghost of actors) {
    if (ghost.mode === "house" && (houseDots >= ghost.releaseAt || releaseTimer >= levelTime)) {
      ghost.mode = "leaving";
      ghost.wanted = "up";
    }
  }
}

function moveGhost(ghost, seconds) {
  const definition = ghostDefinitions[ghost.index];
  if (ghost.mode === "house") return;
  const centerX = Math.abs(ghost.x - (Math.floor(ghost.x) + 0.5)) < 0.06;
  const centerY = Math.abs(ghost.y - Math.round(ghost.y)) < 0.06;
  if (centerX && centerY) {
    if (ghost.mode === "leaving") {
      ghost.direction = bestDirection(ghost, { x: 13, y: 11 }, true);
      if (Math.round(ghost.y) <= 11) ghost.mode = "active";
    } else if (ghost.mode === "eyes") {
      ghost.direction = bestDirection(ghost, { x: 13, y: 11 }, true);
      if (Math.floor(ghost.x) === 13 && Math.round(ghost.y) <= 11) {
        ghost.mode = "house";
        ghost.x = 13.5;
        ghost.y = 14;
        ghost.direction = "down";
      }
    } else if (frightenedTimer > 0) {
      const options = legalDirections(ghost);
      if (options.length) ghost.direction = options[Math.floor(Math.random() * options.length)];
    } else {
      ghost.direction = bestDirection(ghost, targetFor(ghost));
    }
  }
  const speeds = levelSpeeds(level);
  const tile = cellOf(ghost);
  const tunnel = tile.y === 14 && (tile.x <= 5 || tile.x >= 22);
  let factor = ghost.mode === "eyes" ? 1.9 : ghost.mode === "leaving" ? 0.45 :
    frightenedTimer > 0 ? speeds.frightened : speeds.ghost;
  if (ghost.index === 0 && dots.size < 20 && ghost.mode === "active" && frightenedTimer <= 0) factor = Math.min(1, factor * 1.15);
  if (tunnel && ghost.mode === "active") factor = speeds.tunnel;
  moveActor(ghost, ghost.direction, BASE_SPEED * factor, seconds, ghost.mode === "leaving" || ghost.mode === "eyes");
}

function checkCollisions() {
  for (const ghost of actors) {
    if (!["active", "eyes"].includes(ghost.mode) || wrappedDistance(player, ghost) >= 0.6) continue;
    if (frightenedTimer > 0 && ghost.mode === "active") {
      const chainScore = 200 * (2 ** Math.min(ghostChain, 3));
      ghostChain += 1;
      addScore(chainScore);
      ghost.mode = "eyes";
      announce(`${ghostDefinitions[ghost.index].name} spooked! ${chainScore} points.`);
    } else if (ghost.mode === "active") {
      beginDeath();
      return;
    }
  }
}

function updateMode(seconds) {
  if (frightenedTimer > 0) {
    frightenedTimer = Math.max(0, frightenedTimer - seconds);
    return;
  }
  modeTimer -= seconds;
  if (modeTimer <= 0) {
    const schedule = modesForLevel(level);
    modeIndex = Math.min(modeIndex + 1, schedule.length);
    modeTimer = schedule[modeIndex] ?? Infinity;
    for (const ghost of actors) if (ghost.mode === "active") ghost.direction = opposite(ghost.direction);
  }
}

function updateGame(seconds) {
  animationTime += seconds;
  if (state === "ready" || state === "level-clear") {
    stateTimer -= seconds;
    if (stateTimer <= 0) {
      if (state === "level-clear") advanceLevel();
      else {
        state = "playing";
        announce("Collect every kernel and avoid the pumpkin jacks.");
      }
    }
    return;
  }
  if (state === "dying") {
    stateTimer -= seconds;
    if (stateTimer <= 0) completeDeath();
    return;
  }
  if (state !== "playing") return;
  updateMode(seconds);
  if (fruit) {
    fruitTimer -= seconds;
    if (fruitTimer <= 0) fruit = null;
  }
  releaseGhosts(seconds);
  movePlayer(seconds);
  for (const ghost of actors) moveGhost(ghost, seconds);
  checkCollisions();
}

function drawText(text, x, y, size, color, align = "center", outline = "#5e1a3e", outlineWidth = 3) {
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.font = `bold ${size}px Arial, sans-serif`;
  ctx.lineJoin = "round";
  ctx.lineWidth = outlineWidth;
  ctx.strokeStyle = outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawCornWall(col, row) {
  const x = PX + col * TILE;
  const y = MY + row * TILE;
  const seed = (col * 37 + row * 53) % 17;
  ctx.fillStyle = CORN;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = "#3a7830";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 11, y + 20);
  ctx.lineTo(x + 11 + (seed % 3 - 1) * 2, y + 3);
  ctx.moveTo(x + 11, y + 14);
  ctx.quadraticCurveTo(x + 2, y + 11, x + 3, y + 7);
  ctx.lineTo(x + 10, y + 11);
  ctx.moveTo(x + 11, y + 17);
  ctx.quadraticCurveTo(x + 19, y + 13, x + 19, y + 8);
  ctx.lineTo(x + 12, y + 14);
  ctx.stroke();
  ctx.strokeStyle = "#96d264";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(x + 11, y + 20);
  ctx.lineTo(x + 11, y + 7);
  ctx.moveTo(x + 11, y + 14);
  ctx.lineTo(x + 4, y + 9);
  ctx.moveTo(x + 12, y + 16);
  ctx.lineTo(x + 18, y + 10);
  ctx.stroke();
  if (seed % 7 === 0) {
    ctx.fillStyle = "#e2ba48";
    ctx.beginPath();
    ctx.ellipse(x + 15, y + 7, 2.2, 4.2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#718438";
    ctx.beginPath();
    ctx.moveTo(x + 15, y + 4);
    ctx.lineTo(x + 16, y + 1);
    ctx.stroke();
  }
}

function drawMaze() {
  ctx.fillStyle = PATH;
  ctx.fillRect(PX, MY, COLS * TILE, ROWS * TILE);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (!maze[row][col]) drawCornWall(col, row);
    }
  }
  ctx.strokeStyle = "#96d264";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (!maze[row][col]) continue;
      const x = PX + col * TILE;
      const y = MY + row * TILE;
      if (!maze[row - 1]?.[col]) { ctx.moveTo(x, y + 1); ctx.lineTo(x + TILE, y + 1); }
      if (!maze[row + 1]?.[col]) { ctx.moveTo(x, y + TILE - 1); ctx.lineTo(x + TILE, y + TILE - 1); }
      if (!maze[row][col - 1] && col !== 0) { ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + TILE); }
      if (!maze[row][col + 1] && col !== COLS - 1) { ctx.moveTo(x + TILE - 1, y); ctx.lineTo(x + TILE - 1, y + TILE); }
    }
  }
  ctx.stroke();
  ctx.strokeStyle = "#966034";
  ctx.lineWidth = 4;
  ctx.strokeRect(PX + 9 * TILE, MY + 11 * TILE, 10 * TILE, 7 * TILE);
  ctx.strokeStyle = "#ffaaC8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(PX + 13 * TILE, MY + 11 * TILE);
  ctx.lineTo(PX + 15 * TILE, MY + 11 * TILE);
  ctx.stroke();
  for (const key of dots) {
    const [col, row] = key.split(",").map(Number);
    const pulse = 1 + Math.sin(animationTime * 5 + col + row) * 0.15;
    ctx.fillStyle = "#fce8be";
    ctx.beginPath();
    ctx.arc(PX + (col + 0.5) * TILE, MY + (row + 0.5) * TILE, 2.5 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  if (frightenedTimer > 0 || Math.floor(animationTime * 3) % 2 === 0) {
    for (const key of powers) {
      const [col, row] = key.split(",").map(Number);
      ctx.shadowColor = "#ffec78";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ffec78";
      ctx.beginPath();
      ctx.arc(PX + (col + 0.5) * TILE, MY + (row + 0.5) * TILE, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  if (fruit) drawFruit(PX + fruit.x * TILE, MY + (fruit.y + 0.5) * TILE, fruit.kind);
}

function drawFruit(x, y, kind) {
  const palette = ["#d94a39", "#e68e35", "#c93447", "#ba53aa", "#f0d649", "#55a94d", "#55b8cc", "#ca7b43"];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = palette[kind % palette.length];
  ctx.beginPath();
  ctx.ellipse(-4, 2, 6, 7, -0.4, 0, Math.PI * 2);
  ctx.ellipse(4, 2, 6, 7, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#81b957";
  ctx.beginPath();
  ctx.ellipse(4, -7, 5, 2.5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawScarecrow() {
  const cx = PX + player.x * TILE;
  const cy = MY + (player.y + 0.5) * TILE;
  const rotation = ({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 })[player.direction] || 0;
  const mouth = Math.sin(animationTime * 14) > 0.25;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.fillStyle = "#5e1a3e";
  ctx.beginPath();
  ctx.ellipse(0, 5, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e26a50";
  ctx.beginPath();
  ctx.ellipse(0, 4, 7.7, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0c684";
  ctx.beginPath();
  ctx.ellipse(0, -5, 9, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ba905e";
  ctx.beginPath();
  ctx.ellipse(-2, -7, 4, 5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a1c24";
  ctx.beginPath();
  ctx.arc(3, -6, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ad3d34";
  if (mouth) {
    ctx.beginPath();
    ctx.ellipse(2, -1, 2.1, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(1, -2, 4, 1.5);
  }
  ctx.strokeStyle = "#5e1a3e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5, -1); ctx.lineTo(-2, -2); ctx.lineTo(-5, -3);
  ctx.stroke();
  ctx.fillStyle = "#f6ce5c";
  ctx.beginPath();
  ctx.moveTo(-12, -9); ctx.lineTo(0, -18); ctx.lineTo(11, -9); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#c43c34";
  ctx.fillRect(-10, -10, 20, 2.5);
  ctx.strokeStyle = "#5e1a3e";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  for (let i = 0; i < 5; i += 1) {
    const x = -10 + i * 5;
    ctx.strokeStyle = i % 2 ? "#f8dc87" : "#c99339";
    ctx.beginPath();
    ctx.moveTo(x, -6);
    ctx.lineTo(x - 3, -2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGhost(ghost) {
  const definition = ghostDefinitions[ghost.index];
  const x = PX + ghost.x * TILE;
  const y = MY + (ghost.y + 0.5) * TILE;
  if (ghost.mode === "eyes") {
    ctx.fillStyle = "#fff4d6";
    ctx.beginPath();
    ctx.arc(x - 4, y - 2, 4, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#452348";
    ctx.beginPath();
    ctx.arc(x - 3, y - 1, 1.7, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 1, 1.7, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const frightened = frightenedTimer > 0 && ghost.mode === "active";
  const flash = frightened && frightenedTimer < 2 && Math.floor(animationTime * 8) % 2 === 0;
  const body = frightened ? (flash ? "#eeeae0" : "#544ac4") : definition.color;
  const shade = frightened ? (flash ? "#b9b4a8" : "#382e96") : definition.shade;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#5e1a3e";
  ctx.beginPath();
  ctx.ellipse(0, 4, 11, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let rib = -1; rib <= 1; rib += 1) {
    ctx.fillStyle = rib === 0 ? body : shade;
    ctx.beginPath();
    ctx.ellipse(rib * 5, 0, 5.3, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#66833d";
  ctx.beginPath();
  ctx.moveTo(-2, -7); ctx.lineTo(-1, -13); ctx.lineTo(2, -8); ctx.lineTo(5, -12); ctx.lineTo(4, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = frightened ? "#ffec78" : "#ffec78";
  if (frightened) {
    ctx.beginPath();
    ctx.moveTo(-7, -1); ctx.lineTo(-4, -4); ctx.lineTo(-1, -1); ctx.lineTo(2, -4); ctx.lineTo(6, -1);
    ctx.lineTo(6, 2); ctx.lineTo(2, 4); ctx.lineTo(-1, 2); ctx.lineTo(-4, 4); ctx.lineTo(-7, 2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-7, -2); ctx.lineTo(-5, -7); ctx.lineTo(-2, -2); ctx.closePath();
    ctx.moveTo(2, -2); ctx.lineTo(5, -7); ctx.lineTo(8, -2); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3b1520";
    ctx.fillRect(-8, 3, 3, 1.3);
    ctx.fillRect(-3, 4, 3, 1.3);
    ctx.fillRect(2, 3, 3, 1.3);
    ctx.fillRect(6, 4, 2, 1.3);
  }
  ctx.restore();
}

function drawLogo(x, y, width, height) {
  if (logo.complete && logo.naturalWidth) {
    ctx.drawImage(logo, x - width / 2, y - height / 2, width, height);
  } else {
    drawText("PATCH", x, y - 9, 28, "#f37c60");
    drawText("MAN", x, y + 20, 28, "#f37c60");
  }
}

function drawSidePanels() {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#fcE8be";
  drawLogo(PX / 2, 90, 150, 115);
  drawText("PATCH", PX / 2, 172, 43, "#f37c60");
  drawText("MAN", PX / 2, 213, 43, "#f37c60");
  drawText("DON'T GET", PX / 2, 259, 18, "#e6cda0");
  drawText("CARVED!", PX / 2, 282, 20, "#e6cda0");
  ghostDefinitions.forEach((ghost, index) => {
    drawMiniGhost(37 + (index % 2) * 72, 382 + Math.floor(index / 2) * 48, ghost);
    drawText(ghost.name.toUpperCase(), 74 + (index % 2) * 70, 407 + Math.floor(index / 2) * 48, 11, "#e6cda0", "center", "#3b1424", 2);
  });
  drawText("CANDY CORN  10", PX / 2, 625, 14, "#fce8be", "center", "#3b1424", 2);
  drawText("CARAMEL APPLE  50", PX / 2, 648, 12, "#ffc86e", "center", "#3b1424", 2);
  drawText("JACK-O'-LANTERN  200+", PX / 2, 671, 11, "#fce8be", "center", "#3b1424", 2);

  const rx = PX + COLS * TILE + 86;
  drawText("HIGH SCORE", rx, 60, 16, "#e6cda0");
  drawText(String(bestScore).padStart(6, "0"), rx, 94, 24, "#fce8be");
  drawText("SCORE", rx, 160, 16, "#e6cda0");
  drawText(String(score).padStart(6, "0"), rx, 194, 24, "#fce8be");
  drawText("LEVEL", rx, 260, 16, "#e6cda0");
  drawText(String(level), rx, 294, 24, "#fce8be");
  drawText("LIVES", rx, 360, 16, "#e6cda0");
  for (let i = 0; i < Math.min(lives, 6); i += 1) drawMiniScarecrow(rx - 25 + (i % 3) * 25, 392 + Math.floor(i / 3) * 28);
  drawText("HARVEST", rx, 480, 16, "#e6cda0");
  drawText(`${dots.size} kernels left`, rx, 516, 15, "#fce8be");
  if (fruit) drawFruit(rx, 551, fruit.kind);
  drawText("BONUS LIFE", rx, 630, 14, "#ffc86e");
  drawText("EVERY 20000 PTS", rx, 653, 11, "#e6cda0");
  if (highScoreSaveFailed) drawText("SCORE NOT SAVED", rx, 690, 10, "#f37c60");
}

function drawMiniGhost(x, y, definition) {
  ctx.fillStyle = definition.shade;
  ctx.beginPath();
  ctx.ellipse(x, y + 3, 10, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = definition.color;
  for (let rib = -1; rib <= 1; rib += 1) {
    ctx.beginPath();
    ctx.ellipse(x + rib * 4, y, 4.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffec78";
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 2); ctx.lineTo(x - 4, y - 6); ctx.lineTo(x - 1, y - 2);
  ctx.moveTo(x + 1, y - 2); ctx.lineTo(x + 4, y - 6); ctx.lineTo(x + 7, y - 2);
  ctx.fill();
  ctx.fillStyle = "#66833d";
  ctx.fillRect(x - 1, y - 11, 3, 5);
}

function drawMiniScarecrow(x, y) {
  ctx.fillStyle = "#e2be84";
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6ce5c";
  ctx.fillRect(x - 9, y - 8, 18, 2);
  ctx.fillStyle = "#c43c34";
  ctx.fillRect(x - 5, y + 8, 10, 8);
}

function drawTitle() {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < 90; i += 1) {
    const x = (i * 127 + 41) % WIDTH;
    const y = (i * 79 + 19) % 530;
    ctx.fillStyle = i % 7 === 0 ? "#ffc86e" : "#fce8be";
    ctx.globalAlpha = 0.35 + ((i * 13) % 55) / 100;
    ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#f8e6ae";
  ctx.beginPath();
  ctx.arc(840, 110, 39, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BG;
  ctx.beginPath();
  ctx.arc(858, 96, 38, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 17; i += 1) {
    const x = i * 62;
    const h = 70 + (i * 19) % 60;
    ctx.strokeStyle = i % 2 ? "#3d7c32" : "#5c9d43";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, HEIGHT);
    ctx.lineTo(x + (i % 2 ? 4 : -3), HEIGHT - h);
    ctx.moveTo(x + 1, HEIGHT - h * 0.6);
    ctx.lineTo(x - 17, HEIGHT - h * 0.73);
    ctx.moveTo(x + 1, HEIGHT - h * 0.48);
    ctx.lineTo(x + 18, HEIGHT - h * 0.67);
    ctx.stroke();
  }
  drawLogo(WIDTH / 2, 130, 240, 184);
  drawText("PATCH MAN", WIDTH / 2, 320, 86, "#f37c60");
  drawText("CORN MAZE • CANDY CORN • JACK-O'-LANTERNS", WIDTH / 2, 384, 22, "#e6cda0");
  drawText(`HIGH SCORE  ${bestScore}`, 120, 45, 18, "#ffc86e", "left");
  drawText("ARROWS / WASD TO MOVE  •  SPACE TO START", WIDTH / 2, 610, 22, "#fce8be");
  drawText("PRESS ENTER", WIDTH / 2, 648, 18, "#f37c60");
}

function drawInitials() {
  drawOverlay("NEW HIGH SCORE!", "UP / DOWN TO CHANGE • ENTER TO SAVE");
  for (let index = 0; index < initials.length; index += 1) {
    drawText(initials[index], WIDTH / 2 - 35 + index * 35, HEIGHT / 2 + 40, 42, index === initialsCursor ? "#ffc86e" : "#fce8be");
  }
}

function drawScores() {
  drawOverlay("HARVEST HIGH SCORES", "PRESS ENTER TO RETURN");
  highScores.slice(0, 10).forEach((entry, index) => {
    drawText(`${String(index + 1).padStart(2, "0")}  ${entry.name}  ${String(entry.score).padStart(6, "0")}`, WIDTH / 2, 255 + index * 32, 20, "#fce8be");
  });
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = "rgba(2,1,6,.86)";
  ctx.fillRect(PX + 28, 255, COLS * TILE - 56, 205);
  drawText(title, WIDTH / 2, 310, 35, "#f37c60");
  drawText(subtitle, WIDTH / 2, 365, 16, "#fce8be");
}

function render() {
  if (state === "title") {
    drawTitle();
    return;
  }
  drawSidePanels();
  drawMaze();
  for (const ghost of actors) drawGhost(ghost);
  if (state !== "dying" || Math.floor(animationTime * 12) % 2 === 0) drawScarecrow();
  if (state === "ready") {
    drawText(`LEVEL ${level}`, WIDTH / 2, HEIGHT / 2 - 28, 29, "#fce8be");
    drawText("READY!", WIDTH / 2, HEIGHT / 2 + 14, 34, "#f37c60");
  } else if (state === "paused") {
    drawOverlay("PAUSED", "PRESS P OR RESUME TO CONTINUE");
  } else if (state === "level-clear") {
    drawOverlay("HARVEST COMPLETE!", `LEVEL ${level} CLEARED`);
  } else if (state === "dying") {
    drawText("OH NO!", WIDTH / 2, HEIGHT / 2, 34, "#f37c60");
  } else if (state === "over") {
    drawOverlay("GAME OVER", `FINAL SCORE  ${score}`);
  } else if (state === "initials") {
    drawInitials();
  } else if (state === "scores") {
    drawScores();
  }
}

function updateGamepad() {
  const pad = navigator.getGamepads?.().find(Boolean);
  if (!pad) {
    gamepadDirection = null;
    gamepadFire = false;
    return;
  }
  const horizontal = pad.axes[0] || 0;
  const vertical = pad.axes[1] || 0;
  gamepadDirection = Math.abs(horizontal) > Math.abs(vertical)
    ? horizontal < -0.35 ? "left" : horizontal > 0.35 ? "right" : null
    : vertical < -0.35 ? "up" : vertical > 0.35 ? "down" : null;
  gamepadFire = pad.buttons.some((button, index) => index < 4 && button.pressed);
}

function saveScoreIfNeeded() {
  if (!highScores.length || score > highScores[highScores.length - 1].score) {
    state = "initials";
    initials = ["A", "A", "A"];
    initialsCursor = 0;
    announce("New high score! Enter your initials.");
  } else {
    state = "over";
    announce(`Game over. Final score ${score}.`);
  }
}

function frame(timestamp) {
  const seconds = Math.min(0.05, (timestamp - (lastFrame || timestamp)) / 1000);
  lastFrame = timestamp;
  updateGamepad();
  if (gamepadDirection && state === "playing") player.wanted = gamepadDirection;
  if (gamepadFire && (state === "title" || state === "over")) newGame();
  updateGame(seconds);
  render();
  requestAnimationFrame(frame);
}

document.addEventListener("keydown", (event) => {
  const direction = keysToDirection[event.key];
  if (direction) {
    event.preventDefault();
    if (player) player.wanted = direction;
    return;
  }
  if (event.key === "p" || event.key === "P") {
    togglePause();
    return;
  }
  if (state === "title" && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    newGame();
  } else if ((state === "over" || state === "scores") && event.key === "Enter") {
    newGame();
  } else if (state === "initials") {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
      const current = alphabet.indexOf(initials[initialsCursor]);
      initials[initialsCursor] = alphabet[(current + (event.key === "ArrowUp" ? 1 : alphabet.length - 1)) % alphabet.length];
    } else if (event.key === "ArrowRight" || event.key === "Enter") {
      initialsCursor += 1;
      if (initialsCursor >= 3) saveInitials();
    } else if (event.key === "ArrowLeft") {
      initialsCursor = Math.max(0, initialsCursor - 1);
    }
  } else if (event.key === "Enter" && state === "over") {
    saveScoreIfNeeded();
  }
});

document.querySelectorAll("[data-dir]").forEach((button) => {
  button.addEventListener("click", () => { if (player) player.wanted = button.dataset.dir; });
});
document.querySelector("#start").addEventListener("click", () => {
  if (state === "title" || state === "over") newGame();
  else if (state === "paused") togglePause();
});
pauseButton.addEventListener("click", togglePause);

buildMaze();
resetActors();
syncHud();
requestAnimationFrame(frame);
