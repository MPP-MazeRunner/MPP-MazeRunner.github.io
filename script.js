"use strict";

document.documentElement.classList.add("js");

window.addEventListener("pageshow", (event) => {
  const navigationType = performance.getEntriesByType("navigation")[0]?.type;
  if (!event.persisted && !window.location.hash && navigationType !== "back_forward") {
    window.scrollTo(0, 0);
  }
});

const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#main-nav");

function closeMenu() {
  menuButton.setAttribute("aria-expanded", "false");
  navigation.classList.remove("is-open");
}

menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  navigation.classList.toggle("is-open", open);
});

navigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
    closeMenu();
    menuButton.focus();
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".header-inner")) closeMenu();
});

window.matchMedia("(min-width: 641px)").addEventListener("change", closeMenu);

document.querySelector("#copyright-year").textContent = String(new Date().getFullYear());

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const pumpkinColors = ["#ad431f", "#e7b85e", "#8c3215", "#c46b2b"];
let pumpkinLayer = null;

function random(min, max) {
  return min + Math.random() * (max - min);
}

function buildPumpkins() {
  if (pumpkinLayer) return;
  pumpkinLayer = document.createElement("div");
  pumpkinLayer.className = "falling-pumpkins";
  pumpkinLayer.setAttribute("aria-hidden", "true");
  const svgNS = "http://www.w3.org/2000/svg";
  const count = window.innerWidth < 641 ? 8 : 14;
  for (let i = 0; i < count; i += 1) {
    const pumpkin = document.createElement("div");
    pumpkin.className = "falling-pumpkin";
    pumpkin.style.left = `${random(0, 98)}%`;
    pumpkin.style.color = pumpkinColors[i % pumpkinColors.length];
    pumpkin.style.setProperty("--size", `${random(13, 26).toFixed(1)}px`);
    pumpkin.style.setProperty("--fall-time", `${random(10, 20).toFixed(2)}s`);
    // Negative delays scatter pumpkins mid-fall instead of dropping in a wave.
    pumpkin.style.setProperty("--fall-delay", `${random(-20, 0).toFixed(2)}s`);
    pumpkin.style.setProperty("--drift", `${random(-90, 90).toFixed(0)}px`);
    pumpkin.style.setProperty("--sway-time", `${random(2.2, 4.2).toFixed(2)}s`);
    pumpkin.style.setProperty("--sway-delay", `${random(-4, 0).toFixed(2)}s`);
    pumpkin.style.setProperty("--tilt-from", `${random(-80, -20).toFixed(0)}deg`);
    pumpkin.style.setProperty("--tilt-to", `${random(20, 80).toFixed(0)}deg`);
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    const use = document.createElementNS(svgNS, "use");
    use.setAttribute("href", "#pumpkin");
    svg.appendChild(use);
    pumpkin.appendChild(svg);
    pumpkinLayer.appendChild(pumpkin);
  }
  document.body.appendChild(pumpkinLayer);
}

function syncPumpkins() {
  if (reducedMotion.matches) {
    if (pumpkinLayer) {
      pumpkinLayer.remove();
      pumpkinLayer = null;
    }
  } else {
    buildPumpkins();
  }
}

reducedMotion.addEventListener("change", syncPumpkins);
syncPumpkins();

const backgroundMusic = document.querySelector("#background-music");
const musicPrompt = document.querySelector("#music-prompt");
const musicToggle = document.querySelector("#music-toggle");
const musicStatus = document.querySelector("#music-status");
backgroundMusic.volume = 0.25;

function updateMusicToggle() {
  const playing = !backgroundMusic.paused;
  musicToggle.textContent = playing ? "Pause music" : "Play music";
  musicToggle.setAttribute("aria-label", playing ? "Pause background music" : "Play background music");
  musicToggle.setAttribute("aria-pressed", String(playing));
}

function playBackgroundMusic() {
  backgroundMusic.play().then(() => {
    musicStatus.textContent = "Background music is playing.";
    updateMusicToggle();
  }).catch(() => {
    musicStatus.textContent = "Music could not be played. Select Play music to try again.";
    updateMusicToggle();
  });
}

document.querySelector("#music-accept").addEventListener("click", () => {
  playBackgroundMusic();
  musicPrompt.close();
});

document.querySelector("#music-decline").addEventListener("click", () => {
  musicPrompt.close();
  musicStatus.textContent = "Background music is off.";
});

musicPrompt.addEventListener("close", () => {
  musicToggle.hidden = false;
});

musicToggle.addEventListener("click", () => {
  if (backgroundMusic.paused) {
    playBackgroundMusic();
  } else {
    backgroundMusic.pause();
    musicStatus.textContent = "Background music is paused.";
    updateMusicToggle();
  }
});

backgroundMusic.addEventListener("play", updateMusicToggle);
backgroundMusic.addEventListener("pause", updateMusicToggle);
musicPrompt.showModal();
