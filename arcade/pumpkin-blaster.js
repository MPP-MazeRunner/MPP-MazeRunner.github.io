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
const FIELD_WIDTH = 540;
const FIELD_HEIGHT = 720;
const FIELD_X = 210;
const PLAYER_Y = 660;
const DUAL_GAP = 22;
const BONUS_LIFE = 30000;
const keys = new Set();
const logo = new Image();
logo.src = "pumpkin-blaster-logo.png";

let state = "title";
let stateTimer = 0;
let titleTimer = 0;
let score = 0;
let bestScore = 0;
let lives = 3;
let stage = 0;
let player = null;
let playerActive = true;
let dual = false;
let captive = null;
let capturedBy = null;
let enemies = [];
let playerShots = [];
let enemyShots = [];
let particles = [];
let stars = Array.from({ length: 110 }, (_, index) => ({
  x: (index * 197 + 31) % WIDTH,
  y: (index * 113 + 17) % HEIGHT,
  size: 0.6 + (index % 4) * 0.45,
  speed: 10 + (index % 9) * 3,
  color: index % 12 === 0 ? "#f37c60" : index % 5 === 0 ? "#b9d1ed" : "#fcE8be",
}));
let formationStartTimer = 3.5;
let diveTimer = 3.5;
let enemyShotTimer = 1.2;
let fireCooldown = 0;
let respawnTimer = 0;
let invulnerable = 0;
let shotsFired = 0;
let hitsScored = 0;
let bestBonusLife = BONUS_LIFE;
let animationTime = 0;
let lastFrame = 0;
let highScores = [];
let initials = ["A", "A", "A"];
let initialsCursor = 0;
let highScoreSaveFailed = false;
let pointerDown = false;
let pointerTarget = null;
let touchDirection = 0;
let touchFire = false;
let previousButtons = new Set();

try {
  bestScore = Number(localStorage.getItem("mpp-pumpkin-blaster-best")) || 0;
  const savedScores = JSON.parse(localStorage.getItem("mpp-pumpkin-blaster-scores") || "[]");
  if (Array.isArray(savedScores)) highScores = savedScores.filter((entry) => entry && Number.isFinite(entry.score) && typeof entry.name === "string").slice(0, 10);
} catch {
  bestScore = 0;
  highScores = [];
}

function announce(message) {
  statusOutput.textContent = message;
}

function syncHud() {
  scoreOutput.value = String(score);
  bestOutput.value = String(bestScore);
  livesOutput.value = String(lives);
  levelOutput.value = String(stage);
}

function burst(x, y, color) {
  for (let index = 0; index < 12; index += 1) {
    const angle = Math.PI * 2 * index / 12;
    const speed = 26 + (index % 3) * 12;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      life: 0.3 + (index % 4) * 0.06,
    });
  }
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

function gameSpeed() {
  return Math.min(250 + stage * 14, 420);
}

function diveInterval() {
  return Math.max(0.6, 2.4 - stage * 0.18);
}

function shotSpeed() {
  return Math.min(250 + stage * 12, 420);
}

function newGame() {
  score = 0;
  lives = 3;
  stage = 0;
  bestBonusLife = BONUS_LIFE;
  dual = false;
  captive = null;
  capturedBy = null;
  playerActive = true;
  startStage();
  canvas.focus();
}

function startStage() {
  stage += 1;
  enemies = [];
  playerShots = [];
  enemyShots = [];
  particles = [];
  player = { x: FIELD_WIDTH / 2, y: PLAYER_Y };
  playerActive = true;
  dual = false;
  captive = null;
  capturedBy = null;
  respawnTimer = 0;
  invulnerable = 1.5;
  shotsFired = 0;
  hitsScored = 0;
  const rows = [
    { kind: "king", row: 0, cols: [3, 4, 5, 6] },
    { kind: "jack", row: 1, cols: [1, 2, 3, 4, 5, 6, 7, 8] },
    { kind: "jack", row: 2, cols: [1, 2, 3, 4, 5, 6, 7, 8] },
    { kind: "pumpkin", row: 3, cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { kind: "pumpkin", row: 4, cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  ];
  for (const row of rows) {
    for (const col of row.cols) {
      const king = row.kind === "king";
      const homeX = FIELD_WIDTH / 2 + (col - 4.5) * 44;
      const homeY = 80 + row.row * 42;
      enemies.push({
        id: `${row.kind}-${row.row}-${col}`,
        kind: row.kind,
        x: homeX,
        y: homeY,
        homeX,
        homeY,
        row: row.row,
        col,
        hp: king ? 2 : 1,
        state: "waiting",
        wait: 0,
        path: [],
        pathIndex: 0,
        pathOffset: 0,
        dive: false,
        returning: false,
        escortKing: null,
        escortIds: [],
        beamTimer: 0,
        captive: false,
        captiveTimer: 0,
        phase: (row.row * 7 + col * 3) * 0.41,
      });
    }
  }
  assignEntryGroups();
  formationStartTimer = 2;
  diveTimer = 3.5;
  enemyShotTimer = 1.2;
  fireCooldown = 0;
  state = "stageIntro";
  stateTimer = 2.5;
  pauseButton.textContent = "Pause";
  syncHud();
  announce(stage === 1 ? "Stage 1. Blast those pumpkins!" : `Stage ${stage}. The pumpkin fleet is back!`);
}

function assignEntryGroups() {
  const kingGroup = enemies.filter((enemy) => enemy.kind === "king");
  const jacks = enemies.filter((enemy) => enemy.kind === "jack");
  const pumpkins = enemies.filter((enemy) => enemy.kind === "pumpkin");
  const groups = [
    [...kingGroup, ...jacks.slice(0, 2)],
    jacks.slice(2, 8),
    jacks.slice(8),
    pumpkins.slice(0, 10),
    pumpkins.slice(10),
  ];
  let startAt = 2;
  groups.forEach((group, groupIndex) => {
    group.forEach((enemy, index) => {
      enemy.group = groupIndex;
      enemy.wait = startAt + (group.length > 4 ? Math.floor(index / 2) * 0.16 : index * 0.14);
      enemy.entryPath = groupIndex % 2 === 0 ? "top" : "side";
      enemy.entrySide = index % 2 ? 1 : -1;
    });
    startAt += group.length > 4 ? 2.3 : 1.5;
  });
}

function addScore(points) {
  score += points;
  if (score > bestScore) {
    bestScore = score;
    try {
      localStorage.setItem("mpp-pumpkin-blaster-best", String(bestScore));
    } catch {
      highScoreSaveFailed = true;
    }
  }
  while (score >= bestBonusLife) {
    lives += 1;
    bestBonusLife += BONUS_LIFE;
    announce("Bonus fighter!");
  }
  syncHud();
}

function fire() {
  if (fireCooldown > 0 || !playerActive || playerShots.length >= 2 * (dual ? 2 : 1)) return;
  const lanes = dual ? [-DUAL_GAP, DUAL_GAP] : [0];
  for (const offset of lanes) {
    playerShots.push({ x: player.x + offset, y: PLAYER_Y - 18, speed: 760 });
    shotsFired += 1;
  }
  fireCooldown = 0.16;
}

function clampPlayer() {
  const margin = dual ? 26 + DUAL_GAP : 26;
  player.x = Math.max(margin, Math.min(FIELD_WIDTH - margin, player.x));
}

function playerMovement(seconds) {
  const left = keys.has("ArrowLeft") || keys.has("a") || keys.has("A") || touchDirection < 0;
  const right = keys.has("ArrowRight") || keys.has("d") || keys.has("D") || touchDirection > 0;
  if (playerActive) {
    if (left) player.x -= 330 * seconds;
    if (right) player.x += 330 * seconds;
    if (pointerDown && pointerTarget !== null) {
      const amount = Math.sign(pointerTarget - player.x) * Math.min(Math.abs(pointerTarget - player.x), 330 * seconds);
      player.x += amount;
    }
    clampPlayer();
  }
  if (keys.has(" ") || touchFire) fire();
}

function startDive(enemy) {
  if (!enemy || enemy.state !== "formation") return;
  enemy.state = "diving";
  enemy.dive = true;
  enemy.returning = false;
  enemy.pathIndex = 0;
  enemy.pathOffset = 0;
  const side = Math.random() < 0.5 ? -1 : 1;
  const targetX = playerActive ? player.x : FIELD_WIDTH / 2;
  enemy.path = [
    { x: enemy.homeX, y: enemy.homeY },
    { x: enemy.homeX + side * 72, y: enemy.homeY + 92 },
    { x: Math.max(40, Math.min(FIELD_WIDTH - 40, targetX + side * 62)), y: 270 },
    { x: targetX - side * 110, y: 470 },
    { x: targetX + side * 80, y: FIELD_HEIGHT + 45 },
  ];
  if (enemy.kind === "king") {
    if (canUseBeam() && Math.random() < 0.5) {
      enemy.beamTimer = 0;
      enemy.beam = false;
      enemy.state = "beamDive";
      enemy.path = [
        { x: enemy.homeX, y: enemy.homeY },
        { x: enemy.homeX + side * 55, y: 160 },
        { x: targetX, y: FIELD_HEIGHT - 330 },
      ];
    } else {
      attachEscorts(enemy);
    }
  }
  enemy.diveShotsRemaining = stage < 3 ? 1 : stage < 6 ? 2 : 3;
}

function canUseBeam() {
  return playerActive && !dual && !captive && !capturedBy && lives > 0 &&
    !enemies.some((enemy) => enemy.beam || enemy.captive || enemy.state === "beamDive");
}

function attachEscorts(king) {
  const available = enemies.filter((enemy) => enemy.kind === "jack" && enemy.state === "formation" && enemy.row === 1 && !enemy.escortKing);
  const candidates = available.sort((a, b) => Math.abs(a.x - king.x) - Math.abs(b.x - king.x)).slice(0, 2);
  king.escortIds = candidates.map((enemy) => enemy.id);
  for (const escort of candidates) {
    escort.escortKing = king.id;
    escort.state = "escorting";
    escort.diveShotsRemaining = 1;
  }
}

function releaseEscorts(king, returning = false) {
  for (const id of king.escortIds || []) {
    const escort = enemies.find((enemy) => enemy.id === id);
    if (!escort) continue;
    escort.escortKing = null;
    escort.state = returning ? "returning" : "formation";
    escort.dive = returning;
    escort.path = returning ? [{ x: escort.x, y: escort.y }, { x: escort.homeX, y: escort.homeY }] : [];
    escort.pathIndex = 0;
  }
  king.escortIds = [];
}

function moveOnPath(entity, seconds, speed) {
  let distance = speed * seconds;
  while (distance > 0 && entity.pathIndex < entity.path.length - 1) {
    const target = entity.path[entity.pathIndex + 1];
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const length = Math.hypot(dx, dy);
    if (length <= distance || length < 0.001) {
      entity.x = target.x;
      entity.y = target.y;
      distance -= length;
      entity.pathIndex += 1;
    } else {
      entity.x += dx / length * distance;
      entity.y += dy / length * distance;
      distance = 0;
    }
  }
  return entity.pathIndex >= entity.path.length - 1;
}

function finishDive(enemy) {
  enemy.beam = false;
  enemy.beamTimer = 0;
  if (enemy.state === "diving") {
    enemy.state = "returning";
    enemy.pathIndex = 0;
    enemy.path = [{ x: enemy.x, y: enemy.y }, { x: enemy.homeX, y: enemy.homeY }];
    releaseEscorts(enemy, true);
  } else if (enemy.state === "returning") {
    enemy.dive = false;
    enemy.state = "formation";
    enemy.x = enemy.homeX;
    enemy.y = enemy.homeY;
    if (enemy.kind === "king") releaseEscorts(enemy);
  }
}

function startRescue(king) {
  const inTransit = king.state === "tractor" && capturedBy === king && captive?.state === "tractor";
  if (!king.captive && !inTransit) return;
  king.captive = false;
  const saved = {
    x: captive?.x ?? king.x,
    y: captive?.y ?? king.y + 34,
    state: "rescue",
    path: [],
    pathIndex: 0,
  };
  captive = saved;
  capturedBy = null;
  king.beam = false;
  announce("Fighter rescued! Bring the ship home!");
}

function rescueSide() {
  if (!playerActive || dual) return 0;
  return player.x + DUAL_GAP * 2 <= FIELD_WIDTH - 26 ? 1 : -1;
}

function completeRescue() {
  captive = null;
  capturedBy = null;
  if (playerActive && !dual) {
    player.x = Math.max(26 + DUAL_GAP, Math.min(FIELD_WIDTH - 26 - DUAL_GAP, player.x + rescueSide() * DUAL_GAP));
    dual = true;
    state = "playing";
    invulnerable = 1.5;
    announce("Fighter rescued! Dual ships online.");
  } else {
    lives += 1;
    state = playerActive ? "playing" : "respawn";
    announce("Fighter rescued! One ship back in reserve.");
  }
  syncHud();
}

function beamExtension(enemy) {
  if (enemy.state === "tractor") return 1;
  const elapsed = 4.2 - enemy.beamTimer;
  return Math.max(0, Math.min(1, elapsed / 0.6, enemy.beamTimer / 0.6));
}

function checkBeamCapture(king) {
  if (!king.beam || king.captive || !playerActive || dual || capturedBy || lives <= 0 || invulnerable > 0) return;
  const extension = beamExtension(king);
  const beamX = king.x;
  const beamTop = king.y + 20;
  const beamBottom = king.y + (PLAYER_Y - king.y) * extension;
  if (extension >= 1 && Math.abs(player.x - beamX) < 46 && PLAYER_Y >= beamTop && PLAYER_Y <= beamBottom) {
    king.state = "tractor";
    king.path = [];
    king.pathIndex = 0;
    king.beam = false;
    capturedBy = king;
    captive = { x: player.x, y: PLAYER_Y, state: "tractor", path: [], pathIndex: 0 };
    playerActive = false;
    lives -= 1;
    respawnTimer = 99;
    state = "respawn";
    enemyShots = [];
    announce("FIGHTER CAPTURED! Shoot the king to rescue it!");
    syncHud();
  }
}

function fireEnemy(enemy) {
  if (!playerActive || enemy.y <= 120 || enemy.y >= FIELD_HEIGHT - 260) return false;
  const dx = player.x - enemy.x;
  const vy = shotSpeed();
  const dy = Math.max(80, PLAYER_Y - enemy.y);
  const vx = Math.max(-140, Math.min(140, dx / dy * vy));
  enemyShots.push({ x: enemy.x, y: enemy.y + 16, vx, vy, kind: enemy.kind === "king" ? "king" : "seed" });
  return true;
}

function updateEnemies(seconds) {
  const speed = gameSpeed();
  for (const enemy of [...enemies]) {
    if (enemy.state === "waiting") {
      enemy.wait -= seconds;
      if (enemy.wait <= 0) {
        enemy.state = "entering";
        const side = enemy.entrySide || 1;
        const path = enemy.entryPath === "top"
          ? [{ x: side < 0 ? 230 : FIELD_WIDTH - 230, y: -40 }, { x: side < 0 ? 210 : FIELD_WIDTH - 210, y: 120 }, { x: side < 0 ? 150 : FIELD_WIDTH - 150, y: 300 }, { x: side < 0 ? 90 : FIELD_WIDTH - 90, y: 400 }, { x: side < 0 ? 150 : FIELD_WIDTH - 150, y: 470 }, { x: side < 0 ? 240 : FIELD_WIDTH - 240, y: 420 }, { x: enemy.homeX, y: enemy.homeY }]
          : [{ x: side < 0 ? -40 : FIELD_WIDTH + 40, y: 560 }, { x: side < 0 ? 90 : FIELD_WIDTH - 90, y: 520 }, { x: side < 0 ? 220 : FIELD_WIDTH - 220, y: 430 }, { x: side < 0 ? 300 : FIELD_WIDTH - 300, y: 330 }, { x: side < 0 ? 250 : FIELD_WIDTH - 250, y: 240 }, { x: side < 0 ? 170 : FIELD_WIDTH - 170, y: 260 }, { x: enemy.homeX, y: enemy.homeY }];
        enemy.path = path;
        enemy.pathIndex = 0;
        enemy.x = path[0].x;
        enemy.y = path[0].y;
      }
    } else if (enemy.state === "entering") {
      if (moveOnPath(enemy, seconds, speed)) {
        enemy.state = "formation";
        enemy.x = enemy.homeX;
        enemy.y = enemy.homeY;
      }
    } else if (enemy.state === "formation") {
      const breathe = 1 + Math.sin(animationTime * 0.8 + enemy.phase) * 0.035;
      enemy.x = FIELD_WIDTH / 2 + (enemy.col - 4.5) * 44 * breathe + Math.sin(animationTime * 0.55 + enemy.row) * 5;
      enemy.y = 80 + enemy.row * 42 * breathe;
    } else if (enemy.state === "beamDive") {
      if (moveOnPath(enemy, seconds, speed * 1.05)) {
        enemy.state = "beam";
        enemy.beam = true;
        enemy.beamTimer = 4.2;
        enemy.path = [];
        enemy.pathIndex = 0;
      }
    } else if (enemy.state === "beam") {
      enemy.beamTimer -= seconds;
      checkBeamCapture(enemy);
      if (enemy.state === "beam" && enemy.beamTimer <= 0) {
        enemy.beam = false;
        enemy.state = "diving";
        enemy.path = [{ x: enemy.x, y: enemy.y }, { x: enemy.x, y: FIELD_HEIGHT + 45 }];
        enemy.pathIndex = 0;
      }
    } else if (enemy.state === "diving" || enemy.state === "returning") {
      if (enemy.captive) {
        if (moveOnPath(enemy, seconds, speed * 1.05)) finishDive(enemy);
      } else if (moveOnPath(enemy, seconds, speed * 1.05)) {
        finishDive(enemy);
      }
      if (enemy.state === "diving" && enemy.diveShotsRemaining > 0 &&
          enemy.y > 120 && enemy.y < FIELD_HEIGHT - 260 && Math.random() < seconds * 1.8) {
        if (fireEnemy(enemy)) enemy.diveShotsRemaining -= 1;
      }
    } else if (enemy.state === "tractor") {
      enemy.beam = false;
    } else if (enemy.state === "escorting") {
      const king = enemies.find((candidate) => candidate.id === enemy.escortKing);
      if (king) {
        const index = king.escortIds.indexOf(enemy.id);
        enemy.x = king.x + (index === 0 ? -32 : 32);
        enemy.y = king.y + 21;
        if (enemy.diveShotsRemaining > 0 && enemy.y > 120 && enemy.y < FIELD_HEIGHT - 260 &&
            Math.random() < seconds * 1.8 && fireEnemy(enemy)) enemy.diveShotsRemaining -= 1;
      } else {
        enemy.escortKing = null;
        enemy.state = "formation";
      }
    }
  }
  if (captive?.state === "tractor" && capturedBy) {
    const targetX = capturedBy.x;
    const targetY = capturedBy.y + 34;
    const dx = targetX - captive.x;
    const dy = targetY - captive.y;
    const distance = Math.hypot(dx, dy);
    const step = 130 * seconds;
    if (distance <= step) {
      captive.x = targetX;
      captive.y = targetY;
      captive.state = "captured";
      capturedBy.captive = true;
      capturedBy.state = "returning";
      capturedBy.path = [{ x: capturedBy.x, y: capturedBy.y }, { x: capturedBy.homeX, y: capturedBy.homeY }];
      capturedBy.pathIndex = 0;
      respawnTimer = 2;
      announce("Fighter captured! Shoot the king to rescue it.");
    } else {
      captive.x += dx / distance * step;
      captive.y += dy / distance * step;
    }
  } else if (captive?.state === "captured" && capturedBy) {
    captive.x = capturedBy.x;
    captive.y = capturedBy.y + 34;
  } else if (captive?.state === "rescue") {
    const side = rescueSide();
    const targetX = playerActive && side ? player.x + side * DUAL_GAP * 2 : FIELD_WIDTH / 2;
    const dx = targetX - captive.x;
    const dy = PLAYER_Y - captive.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 18) completeRescue();
    else {
      captive.x += dx / distance * Math.min(distance, speed * seconds);
      captive.y += dy / distance * Math.min(distance, speed * seconds);
    }
  }
}

function updateFormationAndDives(seconds) {
  if (!playerActive) return;
  const allEntered = enemies.every((enemy) => ["formation", "diving", "returning", "escorting", "beamDive", "beam", "tractor"].includes(enemy.state));
  if (!allEntered) return;
  diveTimer -= seconds;
  if (diveTimer > 0) return;
  const ordinaryDivers = enemies.filter((enemy) => ["diving", "returning", "beamDive", "beam", "tractor"].includes(enemy.state) && enemy.kind !== "king").length;
  const maxDivers = 2 + Math.floor(stage / 2);
  if (ordinaryDivers < maxDivers) {
    const candidates = enemies.filter((enemy) => enemy.state === "formation" && !enemy.escortKing);
    if (candidates.length) {
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      startDive(chosen);
    }
  }
  diveTimer = diveInterval() * (0.7 + Math.random() * 0.6);
}

function updateShots(seconds) {
  for (const shot of playerShots) shot.y -= 760 * seconds;
  playerShots = playerShots.filter((shot) => shot.y > -20);
  for (const shot of enemyShots) {
    shot.x += shot.vx * seconds;
    shot.y += shot.vy * seconds;
  }
  enemyShots = enemyShots.filter((shot) => shot.y < FIELD_HEIGHT + 24);
  for (const particle of particles) {
    particle.x += particle.vx * seconds;
    particle.y += particle.vy * seconds;
    particle.life -= seconds;
  }
  particles = particles.filter((particle) => particle.life > 0);

  for (const shot of playerShots) {
    if (shot.dead) continue;
    const target = enemies.find((enemy) => {
      if (enemy.state === "waiting") return false;
      const radius = enemy.kind === "king" ? 22 : enemy.kind === "jack" ? 18 : 17;
      return Math.abs(enemy.x - shot.x) < radius && Math.abs(enemy.y - shot.y) < radius;
    });
    if (!target) continue;
    shot.dead = true;
    hitsScored += 1;
    target.hp -= 1;
    if (target.hp > 0) {
      target.bruised = true;
      burst(target.x, target.y, "#b278c4");
      continue;
    }
    const capturedKing = target.kind === "king" && target.captive;
    const rescueInTransit = target.kind === "king" && target.state === "tractor" &&
      capturedBy === target && captive?.state === "tractor";
    if ((capturedKing && ["diving", "returning"].includes(target.state)) || rescueInTransit) {
      startRescue(target);
      enemies = enemies.filter((enemy) => enemy !== target);
      addScore(["diving", "returning"].includes(target.state) ? 400 : 150);
      burst(target.x, target.y, "#ffc86e");
      continue;
    }
    if (capturedKing && target.state === "formation") {
      spawnHostileCaptive(target);
      if (capturedBy === target) {
        capturedBy = null;
        captive = null;
      }
    }
    const diving = ["diving", "returning", "escorting"].includes(target.state) ||
      target.dive && target.state !== "tractor";
    const points = target.kind === "king"
      ? diving ? 400 : 150
      : target.kind === "jack" ? diving ? 160 : 80
      : target.kind === "captive" ? diving ? 1000 : 500
      : diving ? 100 : 50;
    addScore(points);
    burst(target.x, target.y, target.kind === "king" ? "#ffc86e" : "#f37c60");
    if (target.kind === "king") releaseEscorts(target);
    enemies = enemies.filter((enemy) => enemy !== target);
  }
  playerShots = playerShots.filter((shot) => !shot.dead);
  for (const shot of enemyShots) {
    if (invulnerable > 0 || !playerActive || shot.dead) continue;
    const playerX = player.x;
    if (Math.abs(shot.x - playerX) < 22 && Math.abs(shot.y - PLAYER_Y) < 24) {
      shot.dead = true;
      loseFighter("A pumpkin seed hit your ship.");
    }
  }
  enemyShots = enemyShots.filter((shot) => !shot.dead);
  if (playerActive && invulnerable <= 0) {
    const collision = enemies.some((enemy) => ["diving", "returning", "entering", "beamDive", "beam", "tractor"].includes(enemy.state) &&
      Math.abs(enemy.x - player.x) < 26 && Math.abs(enemy.y - PLAYER_Y) < 28);
    if (collision) loseFighter("A pumpkin diver clipped your ship.");
  }
}

function spawnHostileCaptive(king) {
  enemies.push({
    id: `captive-${animationTime}-${enemies.length}`,
    kind: "captive",
    x: king.x,
    y: king.y + 34,
    homeX: king.homeX,
    homeY: king.homeY - 34,
    row: king.row - 0.8,
    col: king.col,
    hp: 1,
    state: "returning",
    path: [{ x: king.x, y: king.y + 34 }, { x: king.homeX, y: king.homeY - 34 }],
    pathIndex: 0,
    dive: true,
    phase: Math.random() * Math.PI * 2,
    beam: false,
    beamTimer: 0,
  });
}

function loseFighter(message) {
  if (invulnerable > 0 || !playerActive) return;
  burst(player.x, PLAYER_Y, "#f37c60");
  playerShots = [];
  enemyShots = [];
  if (dual) {
    dual = false;
    player.x = FIELD_WIDTH / 2;
    invulnerable = 2;
    announce(`${message} Wing fighter lost. One ship remains.`);
    return;
  }
  lives -= 1;
  playerActive = false;
  respawnTimer = 2.5;
  state = lives > 0 || captive ? "respawn" : "gameover";
  announce(`${message} ${Math.max(0, lives)} ships left.`);
  syncHud();
  if (lives <= 0 && !captive) {
    state = "gameover";
    announce(`Game over. Final score ${score}.`);
  }
}

function updateGame(seconds) {
  animationTime += seconds;
  for (const star of stars) {
    star.y += star.speed * seconds * (state === "stageClear" ? 8 : 1);
    if (star.y > HEIGHT) {
      star.y = 0;
      star.x = (star.x + 113) % WIDTH;
    }
  }
  if (state === "title") {
    titleTimer += seconds;
    if (titleTimer >= 12) {
      startStage();
      state = "demo";
      enemies.forEach((enemy) => { enemy.state = "formation"; enemy.wait = 0; });
      formationStartTimer = 0;
      stateTimer = 40;
    }
    return;
  }
  if (state === "demo") {
    stateTimer -= seconds;
    if (stateTimer <= 0) {
      state = "title";
      titleTimer = 0;
      enemies = [];
      playerShots = [];
      enemyShots = [];
      stage = 0;
      syncHud();
      return;
    }
    player.x = FIELD_WIDTH / 2 + Math.sin(animationTime * 0.7) * 175;
    fireCooldown = Math.max(0, fireCooldown - seconds);
    if (Math.random() < seconds * 4) fire();
    updateEnemies(seconds);
    updateFormationAndDives(seconds);
    for (const shot of playerShots) shot.y -= 760 * seconds;
    playerShots = playerShots.filter((shot) => shot.y > -20);
    for (const shot of enemyShots) {
      shot.x += shot.vx * seconds;
      shot.y += shot.vy * seconds;
    }
    enemyShots = enemyShots.filter((shot) => shot.y < FIELD_HEIGHT + 24);
    return;
  }
  if (state === "stageIntro" || state === "stageClear") {
    stateTimer -= seconds;
    if (stateTimer <= 0) {
      if (state === "stageClear") startStage();
      else {
        state = "playing";
        announce(`Stage ${stage}. Hold the line!`);
      }
    }
    return;
  }
  if (state === "gameover" || state === "initials" || state === "scores" || state === "paused") {
    if (state === "scores") {
      stateTimer -= seconds;
      if (stateTimer <= 0) {
        state = "title";
        titleTimer = 0;
      }
    }
    return;
  }
  if (state !== "playing" && state !== "respawn") return;
  fireCooldown = Math.max(0, fireCooldown - seconds);
  invulnerable = Math.max(0, invulnerable - seconds);
  playerMovement(seconds);
  formationStartTimer -= seconds;
  updateEnemies(seconds);
  if (formationStartTimer <= 0) updateFormationAndDives(seconds);
  enemyShotTimer -= seconds;
  if (enemyShotTimer <= 0) {
    const eligible = enemies.filter((enemy) => ["formation", "diving", "entering"].includes(enemy.state));
    if (eligible.length) {
      const shooter = eligible[Math.floor(Math.random() * eligible.length)];
      if (shooter.state === "diving" || stage >= 3 && shooter.state === "entering" && Math.random() < 0.08) fireEnemy(shooter);
    }
    enemyShotTimer = Math.max(0.45, 1.2 - stage * 0.035);
  }
  updateShots(seconds);
  if (state === "respawn") {
    respawnTimer -= seconds;
    const rescuePending = captive?.state === "tractor" || captive?.state === "rescue";
    const noDivers = !enemies.some((enemy) => ["diving", "returning", "beamDive", "beam", "tractor"].includes(enemy.state));
    if (!rescuePending && respawnTimer <= 0 && (respawnTimer < -4 || noDivers)) {
      if (lives > 0) {
        playerActive = true;
        player.x = FIELD_WIDTH / 2;
        invulnerable = 2;
        state = "playing";
        announce("Back in the harvest skies!");
      } else {
        state = "gameover";
        announce(`Game over. Final score ${score}.`);
      }
    }
  }
  if (!enemies.length && state === "playing" && !captive) {
    state = "stageClear";
    stateTimer = 2.5;
    const ratio = shotsFired ? Math.round(hitsScored / shotsFired * 100) : 0;
    announce(`Stage clear! Hit ratio ${ratio} percent.`);
  }
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

function drawLogo(x, y, width, height) {
  if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, x - width / 2, y - height / 2, width, height);
  else {
    drawText("PUMPKIN", x, y - 10, 30, "#f37c60");
    drawText("BLASTER", x, y + 24, 30, "#f37c60");
  }
}

function drawPumpkin(x, y, kind, hp = 1, radius = null) {
  const size = radius ?? (kind === "king" ? 20 : kind === "jack" ? 16 : 15);
  const normal = kind === "pumpkin";
  const jack = kind === "jack";
  const bruised = kind === "king" && hp === 1;
  const body = bruised ? "#b278c4" : normal || kind === "king" ? "#f37c60" : "#ec6828";
  const shade = bruised ? "#784696" : normal || kind === "king" ? "#cd5058" : "#be401e";
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#5e1a3e";
  ctx.beginPath();
  ctx.ellipse(0, 4, size + 2, size * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let rib = -2; rib <= 2; rib += 1) {
    ctx.fillStyle = rib === 0 ? body : shade;
    ctx.beginPath();
    ctx.ellipse(rib * size * 0.32, 0, size * 0.34, size * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#5e1a3e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let rib = -2; rib <= 2; rib += 1) {
    ctx.ellipse(rib * size * 0.32, 0, size * 0.34, size * 0.62, 0, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.fillStyle = "#96d264";
  ctx.beginPath();
  ctx.moveTo(-2, -size * 0.46);
  ctx.lineTo(-1, -size * 0.91);
  ctx.lineTo(3, -size * 0.68);
  ctx.lineTo(6, -size * 0.95);
  ctx.lineTo(5, -size * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#79ad54";
  ctx.beginPath();
  ctx.ellipse(6, -size * 0.7, 7, 3, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fbc580";
  ctx.beginPath();
  ctx.ellipse(-size * 0.5, -size * 0.32, 4, 2.5, -0.6, 0, Math.PI * 2);
  ctx.fill();
  if (kind === "king") {
    if (bruised) {
      ctx.fillStyle = "#e7d2ef";
      ctx.beginPath();
      ctx.arc(-size * 0.34, -1, 3, 0, Math.PI * 2);
      ctx.arc(size * 0.34, -1, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#4a2038";
      ctx.beginPath();
      ctx.moveTo(-10, -5); ctx.lineTo(-3, -8); ctx.lineTo(0, -4);
      ctx.moveTo(2, -4); ctx.lineTo(6, -8); ctx.lineTo(11, -5);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffc86e";
    ctx.beginPath();
    ctx.moveTo(-13, -size * 0.56); ctx.lineTo(-11, -size * 1.2); ctx.lineTo(-5, -size * 0.83);
    ctx.lineTo(0, -size * 1.32); ctx.lineTo(6, -size * 0.84); ctx.lineTo(11, -size * 1.18);
    ctx.lineTo(14, -size * 0.52); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff5a78";
    for (const jewelX of [-10, 0, 10]) {
      ctx.beginPath();
      ctx.arc(jewelX, -size * (jewelX === 0 ? 1.05 : 0.88), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (jack) {
    ctx.fillStyle = "#ffe878";
    ctx.beginPath();
    ctx.moveTo(-size * 0.55, -2); ctx.lineTo(-size * 0.28, -size * 0.58); ctx.lineTo(-1, -1); ctx.closePath();
    ctx.moveTo(1, -1); ctx.lineTo(size * 0.28, -size * 0.58); ctx.lineTo(size * 0.55, -2); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.58, size * 0.18);
    ctx.lineTo(-size * 0.34, size * 0.02);
    ctx.lineTo(-size * 0.15, size * 0.22);
    ctx.lineTo(0, size * 0.02);
    ctx.lineTo(size * 0.17, size * 0.22);
    ctx.lineTo(size * 0.34, size * 0.02);
    ctx.lineTo(size * 0.58, size * 0.18);
    ctx.lineTo(size * 0.48, size * 0.42);
    ctx.lineTo(-size * 0.45, size * 0.42);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = "#59263b";
    ctx.beginPath();
    ctx.ellipse(-4, -2, 2.1, 3.2, 0, 0, Math.PI * 2);
    ctx.ellipse(4, -2, 2.1, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#59263b";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5, 5); ctx.quadraticCurveTo(0, 8, 5, 5); ctx.stroke();
  }
  if (bruised) {
    ctx.strokeStyle = "#6b3b76";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -5); ctx.lineTo(3, 5); ctx.lineTo(-1, 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShip(x, y, captiveShip = false, flame = true) {
  ctx.save();
  ctx.translate(FIELD_X + x, y - 20);
  if (captiveShip) {
    ctx.scale(1, -1);
    ctx.translate(0, -40);
  }
  ctx.fillStyle = "#5e1a3e";
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(22, 38); ctx.lineTo(11, 34); ctx.lineTo(0, 43);
  ctx.lineTo(-11, 34); ctx.lineTo(-22, 38); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = captiveShip ? "#ff6e82" : "#fce8be";
  ctx.beginPath();
  ctx.moveTo(0, 2); ctx.lineTo(18, 35); ctx.lineTo(8, 31); ctx.lineTo(0, 38);
  ctx.lineTo(-8, 31); ctx.lineTo(-18, 35); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f37c60";
  ctx.beginPath();
  ctx.moveTo(-16, 29); ctx.lineTo(-8, 34); ctx.lineTo(-10, 24); ctx.closePath();
  ctx.moveTo(16, 29); ctx.lineTo(8, 34); ctx.lineTo(10, 24); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fcE8be";
  ctx.strokeStyle = "#5e1a3e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-13, 30); ctx.lineTo(-8, 35); ctx.lineTo(-8, 27);
  ctx.moveTo(13, 30); ctx.lineTo(8, 35); ctx.lineTo(8, 27);
  ctx.stroke();
  ctx.fillStyle = "#6ec8f0";
  ctx.beginPath();
  ctx.ellipse(0, 14, 5.5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5e1a3e";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#96d264";
  ctx.beginPath();
  ctx.moveTo(-7, 28); ctx.lineTo(-5, 36); ctx.lineTo(0, 32);
  ctx.lineTo(5, 36); ctx.lineTo(7, 28); ctx.closePath();
  ctx.fill();
  if (flame) {
    const flicker = Math.sin(animationTime * 30 + x) * 4;
    ctx.fillStyle = "#f37c60";
    ctx.beginPath();
    ctx.moveTo(-5, 34); ctx.lineTo(0, 48 + flicker); ctx.lineTo(5, 34); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffc86e";
    ctx.beginPath();
    ctx.moveTo(-2, 35); ctx.lineTo(0, 43 + flicker); ctx.lineTo(2, 35); ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawMiniShip(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#fce8be";
  ctx.strokeStyle = "#5e1a3e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -13); ctx.lineTo(9, 7); ctx.lineTo(0, 4); ctx.lineTo(-9, 7); ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  if (playerActive && (invulnerable <= 0 || Math.floor(animationTime * 10) % 2 === 0)) {
    if (dual) {
      drawShip(player.x - DUAL_GAP, PLAYER_Y);
      drawShip(player.x + DUAL_GAP, PLAYER_Y);
    } else {
      drawShip(player.x, PLAYER_Y);
    }
  }
  if (captive) drawShip(captive.x, captive.y, true, false);
}

function drawSidePanels() {
  ctx.fillStyle = "#020106";
  ctx.fillRect(0, 0, FIELD_X, HEIGHT);
  ctx.fillRect(FIELD_X + FIELD_WIDTH, 0, WIDTH - FIELD_X - FIELD_WIDTH, HEIGHT);
  drawLogo(FIELD_X / 2, 205, 190, 145);
  drawText("PUMPKIN", FIELD_X / 2, 310, 39, "#f37c60");
  drawText("BLASTER", FIELD_X / 2, 350, 39, "#f37c60");
  drawText("CANDY CORN AWAY!", FIELD_X / 2, 400, 16, "#e6cda0");
  const rightX = FIELD_X + FIELD_WIDTH + 105;
  drawText("HIGH SCORE", rightX, 70, 16, "#e6cda0");
  drawText(String(bestScore).padStart(6, "0"), rightX, 108, 24, "#fce8be");
  drawText("SCORE", rightX, 190, 16, "#e6cda0");
  drawText(String(score).padStart(6, "0"), rightX, 228, 24, "#fce8be");
  drawText("STAGE", rightX, 310, 16, "#e6cda0");
  drawText(String(stage), rightX, 348, 24, "#fce8be");
  drawText("SHIPS", rightX, 430, 16, "#e6cda0");
  for (let index = 0; index < Math.min(lives, 6); index += 1) {
    drawMiniShip(rightX - (index % 3) * 21 - 20, 485 + Math.floor(index / 3) * 45);
  }
  drawText("BONUS SHIP EVERY", rightX, 590, 12, "#ffc86e");
  drawText("30000 PTS", rightX, 612, 14, "#e6cda0");
  if (highScoreSaveFailed) drawText("SCORE NOT SAVED", rightX, 682, 10, "#f37c60");
  ctx.strokeStyle = "#5e1a3e";
  ctx.lineWidth = 2;
  ctx.strokeRect(FIELD_X, 0, FIELD_WIDTH, HEIGHT);
}

function drawPumpkinSeed(x, y) {
  ctx.save();
  ctx.translate(FIELD_X + x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#f37c60";
  ctx.strokeStyle = "#5e1a3e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffc86e";
  ctx.beginPath();
  ctx.ellipse(-1, -2, 1.4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCandyCorn(x, y) {
  ctx.save();
  ctx.translate(FIELD_X + x, y);
  ctx.fillStyle = "#fce8be";
  ctx.strokeStyle = "#5e1a3e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffc86e";
  ctx.fillRect(-4, 2, 8, 3);
  ctx.fillStyle = "#f37c60";
  ctx.fillRect(-5, 5, 10, 2);
  ctx.restore();
}

function drawBeam(enemy) {
  if (!enemy.beam && enemy.state !== "tractor") return;
  const pulse = (animationTime * 22) % 14;
  const extend = beamExtension(enemy);
  const beamBottom = enemy.state === "tractor" && captive?.state === "tractor"
    ? captive.y
    : enemy.y + (PLAYER_Y - enemy.y) * extend;
  for (let y = enemy.y + 18 + pulse; y < beamBottom; y += 14) {
    ctx.fillStyle = Math.floor(y / 14) % 2 ? "rgba(70,200,255,.55)" : "rgba(150,60,230,.52)";
    ctx.fillRect(FIELD_X + enemy.x - 12, y, 24, 14);
  }
  ctx.strokeStyle = "#a9efff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(FIELD_X + enemy.x - 12, enemy.y + 18);
  ctx.lineTo(FIELD_X + enemy.x - 12, beamBottom);
  ctx.moveTo(FIELD_X + enemy.x + 12, enemy.y + 18);
  ctx.lineTo(FIELD_X + enemy.x + 12, beamBottom);
  ctx.stroke();
}

function drawTitle() {
  for (let i = 0; i < 8; i += 1) {
    const x = i < 4 ? 70 + i * 36 : 890 - (i - 4) * 36;
    const y = 390 + Math.sin(animationTime * 0.8 + i) * 22;
    drawPumpkin(x, y, i % 2 ? "jack" : "pumpkin", 1, 20 + i % 3 * 4);
  }
  drawLogo(WIDTH / 2, 200, 440, 337);
  drawText("PUMPKIN BLASTER", WIDTH / 2, 420, 72, "#f37c60");
  drawText("PRESS SPACE TO START", WIDTH / 2, 510, 34, "#fce8be");
  drawText(`HIGH SCORE  ${bestScore}`, 120, 45, 18, "#ffc86e", "left");
  if (state === "demo") drawText("DEMO", WIDTH / 2, 570, 20, "#e6cda0");
}

function drawOverlay(title, subtitle, titleSize = 58, titleColor = "#f37c60") {
  ctx.fillStyle = "rgba(2,1,6,.86)";
  ctx.fillRect(FIELD_X + 18, 265, FIELD_WIDTH - 36, 185);
  drawText(title, WIDTH / 2, 326, titleSize, titleColor);
  drawText(subtitle, WIDTH / 2, 382, 23, "#fce8be");
}

function drawInitials() {
  drawOverlay("NEW HIGH SCORE!", "UP / DOWN TO CHANGE • ENTER TO SAVE", 40);
  initials.forEach((letter, index) => drawText(letter, WIDTH / 2 - 35 + index * 35, 440, 40, index === initialsCursor ? "#ffc86e" : "#fce8be"));
}

function drawScoreTable() {
  drawOverlay("PUMPKIN HIGH SCORES", "PRESS ENTER TO RETURN", 42);
  highScores.slice(0, 10).forEach((entry, index) => {
    drawText(`${String(index + 1).padStart(2, "0")}  ${entry.name}  ${String(entry.score).padStart(6, "0")}`, WIDTH / 2, 270 + index * 30, 20, "#fce8be");
  });
}

function render() {
  ctx.fillStyle = "#020106";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (const star of stars) {
    ctx.globalAlpha = 0.3 + Math.sin(animationTime * 2 + star.x) * 0.18 + star.size * 0.12;
    ctx.fillStyle = star.color;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
  if (state === "title") {
    drawTitle();
    return;
  }
  drawSidePanels();
  for (const enemy of enemies) {
    if (enemy.state === "waiting") continue;
    drawBeam(enemy);
    if (enemy.kind === "captive") drawShip(enemy.x, enemy.y, true, false);
    else drawPumpkin(FIELD_X + enemy.x, enemy.y, enemy.kind, enemy.hp);
  }
  if (captive) drawShip(captive.x, captive.y, true, false);
  for (const shot of playerShots) drawCandyCorn(shot.x, shot.y);
  for (const shot of enemyShots) drawPumpkinSeed(shot.x, shot.y);
  for (const particle of particles) {
    ctx.globalAlpha = Math.min(1, particle.life * 2);
    ctx.fillStyle = particle.color;
    ctx.fillRect(FIELD_X + particle.x, particle.y, 4, 4);
  }
  ctx.globalAlpha = 1;
  drawPlayer();
  if (state === "demo") drawText("DEMO", WIDTH / 2, 35, 18, "#e6cda0");
  if (state === "stageIntro") {
    drawOverlay(`STAGE ${stage}`, stage === 1 ? "BLAST THOSE PUMPKINS!" : "THE HARVEST FLEET RETURNS", 64);
  } else if (state === "stageClear") {
    const ratio = shotsFired ? Math.round(hitsScored / shotsFired * 100) : 0;
    drawOverlay("STAGE CLEAR!", `HIT RATIO ${ratio}%`, 60, "#ffc86e");
  } else if (state === "paused") {
    drawOverlay("PAUSED", "PRESS P OR RESUME TO CONTINUE");
  } else if (state === "gameover") {
    drawOverlay("GAME OVER", `SCORE ${score}`, 76);
  } else if (state === "initials") {
    drawInitials();
  } else if (state === "scores") {
    drawScoreTable();
  }
}

function saveInitials() {
  highScores.push({ name: initials.join(""), score });
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, 10);
  try {
    localStorage.setItem("mpp-pumpkin-blaster-scores", JSON.stringify(highScores));
  } catch {
    highScoreSaveFailed = true;
  }
  state = "scores";
  stateTimer = 8;
  announce("High score saved.");
}

function qualifiesForHighScore() {
  return highScores.length < 10 || score > highScores[highScores.length - 1].score;
}

function updateGamepad() {
  const pad = navigator.getGamepads?.().find(Boolean);
  if (!pad) return;
  const horizontal = pad.axes[0] || 0;
  touchDirection = Math.abs(horizontal) > 0.35 ? Math.sign(horizontal) : 0;
  if (pad.buttons.some((button, index) => index < 4 && button.pressed)) fire();
  if (pad.buttons[9]?.pressed && !previousButtons.has(9)) togglePause();
  previousButtons = new Set(pad.buttons.flatMap((button, index) => button.pressed ? [index] : []));
}

function frame(timestamp) {
  const seconds = Math.min(0.05, (timestamp - (lastFrame || timestamp)) / 1000);
  lastFrame = timestamp;
  updateGamepad();
  updateGame(seconds);
  render();
  requestAnimationFrame(frame);
}

document.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  keys.add(event.key);
  if (event.key === "p" || event.key === "P") {
    togglePause();
    return;
  }
  if ((state === "title" || state === "demo") && [" ", "Enter"].includes(event.key)) {
    newGame();
    return;
  }
  if (state === "gameover" && event.key === "Enter") {
    if (qualifiesForHighScore()) {
      initials = ["A", "A", "A"];
      initialsCursor = 0;
      state = "initials";
      announce("New high score! Enter your initials.");
    } else {
      state = "scores";
      stateTimer = 8;
    }
    return;
  }
  if (state === "scores" && event.key === "Enter") {
    state = "title";
    titleTimer = 0;
    return;
  }
  if (state === "initials") {
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
  }
});
document.addEventListener("keyup", (event) => keys.delete(event.key));
window.addEventListener("blur", () => keys.clear());
canvas.addEventListener("pointerdown", (event) => {
  pointerDown = true;
  canvas.setPointerCapture(event.pointerId);
  const rect = canvas.getBoundingClientRect();
  pointerTarget = (event.clientX - rect.left) * WIDTH / rect.width - FIELD_X;
  if (state === "title" || state === "demo" || state === "gameover") newGame();
});
canvas.addEventListener("pointermove", (event) => {
  if (!pointerDown) return;
  const rect = canvas.getBoundingClientRect();
  pointerTarget = Math.max(0, Math.min(FIELD_WIDTH, (event.clientX - rect.left) * WIDTH / rect.width - FIELD_X));
});
canvas.addEventListener("pointerup", () => { pointerDown = false; pointerTarget = null; });
canvas.addEventListener("pointercancel", () => { pointerDown = false; pointerTarget = null; });

document.querySelectorAll("[data-action]").forEach((button) => {
  const press = () => {
    if (button.dataset.action === "left") touchDirection = -1;
    else if (button.dataset.action === "right") touchDirection = 1;
    else touchFire = true;
    button.classList.add("is-pressed");
  };
  const release = () => {
    if (button.dataset.action === "fire") touchFire = false;
    else touchDirection = 0;
    button.classList.remove("is-pressed");
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    press();
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
});
document.querySelector("#start").addEventListener("click", () => {
  if (state === "title" || state === "demo" || state === "gameover") newGame();
  else if (state === "paused") togglePause();
});
pauseButton.addEventListener("click", togglePause);

syncHud();
requestAnimationFrame(frame);
