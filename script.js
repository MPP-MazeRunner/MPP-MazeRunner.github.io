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

const filters = document.querySelectorAll("[data-filter]");
const activities = document.querySelectorAll("[data-category]");
const activityCount = document.querySelector(".activity-count");

filters.forEach((filter) => {
  filter.addEventListener("click", () => {
    const selected = filter.dataset.filter;
    filters.forEach((button) => {
      const active = button === filter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    let count = 0;
    activities.forEach((activity) => {
      const visible = selected === "all" || activity.dataset.category.split(" ").includes(selected);
      activity.hidden = !visible;
      if (visible) count += 1;
    });
    activityCount.textContent = `${count} ${count === 1 ? "way" : "ways"} to play`;
  });
});

document.querySelector("#copyright-year").textContent = String(new Date().getFullYear());

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const leafColors = ["#ad431f", "#e7b85e", "#8c3215", "#6b6d60"];
let leafLayer = null;

function random(min, max) {
  return min + Math.random() * (max - min);
}

function buildLeaves() {
  if (leafLayer) return;
  leafLayer = document.createElement("div");
  leafLayer.className = "falling-leaves";
  leafLayer.setAttribute("aria-hidden", "true");
  const svgNS = "http://www.w3.org/2000/svg";
  const count = window.innerWidth < 641 ? 8 : 14;
  for (let i = 0; i < count; i += 1) {
    const leaf = document.createElement("div");
    leaf.className = "falling-leaf";
    leaf.style.left = `${random(0, 98)}%`;
    leaf.style.color = leafColors[i % leafColors.length];
    leaf.style.setProperty("--size", `${random(13, 26).toFixed(1)}px`);
    leaf.style.setProperty("--fall-time", `${random(10, 20).toFixed(2)}s`);
    // Negative delays scatter leaves mid-fall on load instead of dropping in a wave.
    leaf.style.setProperty("--fall-delay", `${random(-20, 0).toFixed(2)}s`);
    leaf.style.setProperty("--drift", `${random(-90, 90).toFixed(0)}px`);
    leaf.style.setProperty("--sway-time", `${random(2.2, 4.2).toFixed(2)}s`);
    leaf.style.setProperty("--sway-delay", `${random(-4, 0).toFixed(2)}s`);
    leaf.style.setProperty("--tilt-from", `${random(-80, -20).toFixed(0)}deg`);
    leaf.style.setProperty("--tilt-to", `${random(20, 80).toFixed(0)}deg`);
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    const use = document.createElementNS(svgNS, "use");
    use.setAttribute("href", "#leaf");
    svg.appendChild(use);
    leaf.appendChild(svg);
    leafLayer.appendChild(leaf);
  }
  document.body.appendChild(leafLayer);
}

function syncLeaves() {
  if (reducedMotion.matches) {
    if (leafLayer) {
      leafLayer.remove();
      leafLayer = null;
    }
  } else {
    buildLeaves();
  }
}

reducedMotion.addEventListener("change", syncLeaves);
syncLeaves();
