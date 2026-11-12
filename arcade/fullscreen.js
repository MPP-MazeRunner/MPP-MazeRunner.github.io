"use strict";

const gameShell = document.querySelector(".game-shell");
const gameCanvasWrap = document.querySelector(".game-canvas-wrap");
const gameCanvas = document.querySelector("#game");
const fullscreenButton = document.querySelector("#fullscreen");
const gameStatus = document.querySelector("#game-status");
let windowedFullscreen = false;
let savedScroll = { x: 0, y: 0 };

function syncFullscreenButton() {
  const isFullscreen = document.fullscreenElement === gameShell || windowedFullscreen;
  gameShell.classList.toggle("is-fullscreen", isFullscreen);
  fullscreenButton.textContent = isFullscreen ? "Exit fullscreen" : "Fullscreen";
  fullscreenButton.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
  fullscreenButton.setAttribute("aria-pressed", String(isFullscreen));
}

function fitFullscreenCanvas() {
  if (document.fullscreenElement !== gameShell && !windowedFullscreen) {
    gameCanvas.style.width = "";
    return;
  }
  if (windowedFullscreen) {
    const viewport = window.visualViewport;
    gameShell.style.top = `${viewport?.offsetTop || 0}px`;
    gameShell.style.left = `${viewport?.offsetLeft || 0}px`;
    gameShell.style.width = `${viewport?.width || window.innerWidth}px`;
    gameShell.style.height = `${viewport?.height || window.innerHeight}px`;
  }
  const { width, height } = gameCanvasWrap.getBoundingClientRect();
  gameCanvas.style.width = `${Math.floor(Math.min(width, height * 4 / 3))}px`;
}

function enterWindowedFullscreen() {
  savedScroll = { x: window.scrollX, y: window.scrollY };
  windowedFullscreen = true;
  document.documentElement.classList.add("arcade-fullscreen-open");
  gameShell.classList.add("is-windowed-fullscreen");
  syncFullscreenButton();
  fitFullscreenCanvas();
  gameStatus.textContent = "Game expanded to fill the browser window. Browser controls may remain visible. Use Exit fullscreen to return.";
}

async function enterFullscreenForPlay() {
  if (document.fullscreenElement === gameShell || windowedFullscreen) return;
  if (!document.fullscreenEnabled || !gameShell.requestFullscreen) {
    enterWindowedFullscreen();
    return;
  }
  try {
    await gameShell.requestFullscreen();
    syncFullscreenButton();
    fitFullscreenCanvas();
  } catch {
    enterWindowedFullscreen();
  }
}

window.enterArcadeFullscreen = enterFullscreenForPlay;

function exitWindowedFullscreen() {
  windowedFullscreen = false;
  gameShell.classList.remove("is-windowed-fullscreen");
  document.documentElement.classList.remove("arcade-fullscreen-open");
  for (const property of ["top", "left", "width", "height"]) gameShell.style.removeProperty(property);
  syncFullscreenButton();
  fitFullscreenCanvas();
  window.scrollTo(savedScroll.x, savedScroll.y);
  fullscreenButton.focus({ preventScroll: true });
}

fullscreenButton.addEventListener("click", async () => {
  if (windowedFullscreen) exitWindowedFullscreen();
  else if (document.fullscreenElement === gameShell) {
    try {
      await document.exitFullscreen();
    } catch {
      gameStatus.textContent = "Fullscreen could not be closed. Use your browser's fullscreen exit control.";
    }
  } else await enterFullscreenForPlay();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && windowedFullscreen) exitWindowedFullscreen();
});
document.addEventListener("fullscreenchange", () => {
  syncFullscreenButton();
  requestAnimationFrame(fitFullscreenCanvas);
});
window.addEventListener("resize", fitFullscreenCanvas);
window.visualViewport?.addEventListener("resize", fitFullscreenCanvas);
window.visualViewport?.addEventListener("scroll", fitFullscreenCanvas);
new ResizeObserver(fitFullscreenCanvas).observe(gameCanvasWrap);
syncFullscreenButton();
