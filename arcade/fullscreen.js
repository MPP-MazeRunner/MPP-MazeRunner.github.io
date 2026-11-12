"use strict";

const gameShell = document.querySelector(".game-shell");
const gameCanvasWrap = document.querySelector(".game-canvas-wrap");
const gameCanvas = document.querySelector("#game");
const fullscreenButton = document.querySelector("#fullscreen");
const gameStatus = document.querySelector("#game-status");

function syncFullscreenButton() {
  const isFullscreen = document.fullscreenElement === gameShell;
  fullscreenButton.textContent = isFullscreen ? "Exit fullscreen" : "Fullscreen";
  fullscreenButton.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
  fullscreenButton.setAttribute("aria-pressed", String(isFullscreen));
}

function fitFullscreenCanvas() {
  if (document.fullscreenElement !== gameShell) {
    gameCanvas.style.width = "";
    return;
  }
  const { width, height } = gameCanvasWrap.getBoundingClientRect();
  gameCanvas.style.width = `${Math.floor(Math.min(width, height * 4 / 3))}px`;
}

function enterFullscreenForPlay() {
  if (document.fullscreenElement === gameShell || !document.fullscreenEnabled || !gameShell.requestFullscreen) return;
  gameShell.requestFullscreen().then(() => {
    syncFullscreenButton();
    fitFullscreenCanvas();
  }).catch(() => {
    gameStatus.textContent = "Fullscreen could not be opened. Check your browser permissions and try again.";
  });
}

window.enterArcadeFullscreen = enterFullscreenForPlay;

if (!document.fullscreenEnabled || !gameShell.requestFullscreen) {
  fullscreenButton.disabled = true;
  fullscreenButton.title = "Fullscreen is not supported by this browser.";
} else {
  fullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === gameShell) await document.exitFullscreen();
      else await gameShell.requestFullscreen();
      syncFullscreenButton();
      fitFullscreenCanvas();
    } catch {
      gameStatus.textContent = "Fullscreen could not be opened. Check your browser permissions and try again.";
    }
  });
  document.addEventListener("fullscreenchange", () => {
    syncFullscreenButton();
    requestAnimationFrame(fitFullscreenCanvas);
  });
  window.addEventListener("resize", fitFullscreenCanvas);
}
