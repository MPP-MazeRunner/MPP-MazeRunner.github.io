"use strict";

const soundButton = document.querySelector("#sound");
const soundStatus = document.querySelector("#game-status");
const gameName = document.body.dataset.game;
const musicDirectory = gameName === "blaster" ? "audio/pumpkin-blaster/" : "audio/patchman/";
const musicVolume = gameName === "patchman" ? 0.3 : 0.32;
const contextConstructor = window.AudioContext || window.webkitAudioContext;
let context = null;
let musicGain = null;
let effectGain = null;
let soundEnabled = false;
let gamePaused = false;
let gestureHandled = false;
let currentMusicIndex = null;
let currentMusicSource = null;
let musicGeneration = 0;
let chompIndex = 0;
const musicBuffers = new Map();
const sounds = new Map();
const loopingSounds = new Map();
const desiredLoops = new Set();
const activeEffects = new Map();

function updateButton() {
  soundButton.textContent = soundEnabled ? "Sound: On" : "Sound: Off";
  soundButton.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
}

function getContext() {
  if (context) return context;
  if (!contextConstructor) throw new Error("Web Audio is not supported in this browser.");
  context = new contextConstructor();
  musicGain = context.createGain();
  effectGain = context.createGain();
  musicGain.gain.value = 1;
  effectGain.gain.value = 1;
  musicGain.connect(context.destination);
  effectGain.connect(context.destination);
  createSoundBank();
  return context;
}

function bufferFromSamples(samples) {
  const buffer = context.createBuffer(1, samples.length, context.sampleRate);
  buffer.copyToChannel(Float32Array.from(samples), 0);
  return buffer;
}

function makeWave(duration, startFrequency, endFrequency, volume, kind, envelope = "decay") {
  const count = Math.max(1, Math.floor(context.sampleRate * duration));
  const samples = new Array(count);
  let phase = 0;
  let noise = 0;
  for (let index = 0; index < count; index += 1) {
    const time = index / count;
    const previousPhase = phase;
    phase += (startFrequency + (endFrequency - startFrequency) * time) / context.sampleRate;
    let value;
    if (kind === "square") value = phase % 1 < 0.5 ? 1 : -1;
    else if (kind === "tri") value = 4 * Math.abs(phase % 1 - 0.5) - 1;
    else if (kind === "noise") {
      if (Math.floor(phase) !== Math.floor(previousPhase)) noise = Math.random() * 2 - 1;
      value = noise;
    } else value = Math.sin(2 * Math.PI * phase);
    const fade = envelope === "decay"
      ? (1 - time) ** 2
      : Math.min(1, time * 40, (1 - time) * 6);
    samples[index] = value * fade * volume;
  }
  return bufferFromSamples(samples);
}

function makeSweep(duration, startFrequency, endFrequency, volume) {
  const count = Math.max(1, Math.floor(context.sampleRate * duration));
  const samples = new Array(count);
  let phase = 0;
  for (let index = 0; index < count; index += 1) {
    const time = index / count;
    const frequency = startFrequency * (endFrequency / startFrequency) ** time +
      40 * Math.sin(2 * Math.PI * 11 * index / context.sampleRate);
    phase += frequency / context.sampleRate;
    samples[index] = (phase % 1 < 0.5 ? 1 : -1) * Math.min(1, (1 - time) * 5) * volume;
  }
  return bufferFromSamples(samples);
}

function makeWarble(duration, startFrequency, depth, lfoFrequency, volume, fade = true) {
  const count = Math.max(1, Math.floor(context.sampleRate * duration));
  const samples = new Array(count);
  let phase = 0;
  for (let index = 0; index < count; index += 1) {
    const frequency = startFrequency + depth * Math.sin(2 * Math.PI * lfoFrequency * index / context.sampleRate);
    phase += frequency / context.sampleRate;
    const envelope = fade
      ? Math.min(1, index / (context.sampleRate * 0.1), (count - index) / (context.sampleRate * 0.3))
      : 1;
    samples[index] = (4 * Math.abs(phase % 1 - 0.5) - 1) * envelope * volume;
  }
  return bufferFromSamples(samples);
}

function makeJingle(notes, noteDuration, volume) {
  const noteBuffers = notes.map((frequency) => frequency === 0
    ? new Array(Math.floor(context.sampleRate * noteDuration)).fill(0)
    : Array.from(makeWave(noteDuration, frequency, frequency, volume, "square", "note").getChannelData(0)));
  return bufferFromSamples(noteBuffers.flat());
}

function addSound(name, buffer) {
  sounds.set(name, buffer);
}

function createSoundBank() {
  if (gameName === "patchman") {
    addSound("chomp_a", makeWave(0.08, 300, 640, 0.22, "tri"));
    addSound("chomp_b", makeWave(0.08, 640, 300, 0.22, "tri"));
    addSound("power", makeWave(0.3, 200, 900, 0.22, "square"));
    addSound("fright", makeWarble(1.2, 260, 90, 5, 0.12, false));
    addSound("eyes", makeWarble(0.6, 1100, 350, 10, 0.08, false));
    addSound("eat_ghost", makeWave(0.4, 180, 1600, 0.25, "square"));
    addSound("fruit", makeJingle([784, 988, 1175, 1568], 0.06, 0.25));
    addSound("extra", makeJingle([660, 880, 990, 1320], 0.08, 0.25));
    addSound("death", makeSweep(1.5, 950, 90, 0.25));
    addSound("start", makeJingle([294, 0, 349, 440, 587, 0, 523, 440, 349, 440, 587, 698, 880, 0, 587, 0, 440, 523, 587, 0, 0, 0, 0, 0], 0.13, 0.22));
    addSound("clear", makeJingle([523, 659, 784, 1046], 0.12, 0.25));
    addSound("over", makeJingle([392, 330, 262, 196], 0.22, 0.3));
    addSound("blip", makeWave(0.05, 900, 900, 0.18, "square"));
    return;
  }
  addSound("shot", makeWave(0.12, 1400, 500, 0.22, "square"));
  addSound("hit", makeWave(0.18, 900, 120, 0.35, "noise"));
  addSound("king_hit", makeWave(0.15, 500, 900, 0.3, "square"));
  addSound("boom", makeWave(0.9, 400, 40, 0.5, "noise"));
  addSound("dive", makeWave(0.35, 900, 300, 0.12, "tri"));
  addSound("extra", makeJingle([660, 880, 990, 1320], 0.08, 0.25));
  addSound("start", makeJingle([392, 523, 659, 784, 659, 784, 1046], 0.11, 0.25));
  addSound("clear", makeJingle([523, 659, 784, 1046], 0.12, 0.25));
  addSound("over", makeJingle([392, 330, 262, 196], 0.22, 0.3));
  addSound("blip", makeWave(0.05, 900, 900, 0.18, "square"));
  addSound("beam", makeWarble(4.2, 420, 140, 7, 0.16));
  addSound("captured", makeJingle([523, 494, 440, 392, 349, 330], 0.13, 0.25));
  addSound("rescue", makeJingle([523, 659, 784, 1046, 784, 1046, 1318], 0.09, 0.25));
}

function playBuffer(buffer, destination = effectGain, loop = false) {
  if (!buffer || !soundEnabled || gamePaused || context?.state !== "running") return null;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  source.connect(destination);
  source.start();
  return source;
}

function updateMusicVolume() {
  if (!musicGain || !context) return;
  const frightened = desiredLoops.has("fright");
  const volume = gameName === "patchman" && frightened ? 0.12 : musicVolume;
  musicGain.gain.setTargetAtTime(volume, context.currentTime, 0.025);
}

function loadMusic(index) {
  if (!musicBuffers.has(index)) {
    const url = `${musicDirectory}song_${index + 1}.wav`;
    const pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load original soundtrack (${response.status}).`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data));
    musicBuffers.set(index, pending);
    pending.catch(() => musicBuffers.delete(index));
  }
  return musicBuffers.get(index);
}

async function playCurrentMusic(generation) {
  if (currentMusicIndex === null || !soundEnabled || gamePaused || !context || context.state !== "running") return;
  try {
    const buffer = await loadMusic(currentMusicIndex);
    if (generation !== musicGeneration || !soundEnabled || gamePaused || context.state !== "running") return;
    if (currentMusicSource) currentMusicSource.stop();
    currentMusicSource = playBuffer(buffer, musicGain, true);
    updateMusicVolume();
  } catch (error) {
    soundStatus.textContent = `Original game music could not be loaded: ${error.message}`;
  }
}

function startMusic(level) {
  currentMusicIndex = (Math.max(1, level) - 1) % 3;
  musicGeneration += 1;
  if (!soundEnabled || !context) return;
  void playCurrentMusic(musicGeneration);
}

function stopMusic() {
  currentMusicIndex = null;
  musicGeneration += 1;
  if (!currentMusicSource || !context) return;
  const source = currentMusicSource;
  currentMusicSource = null;
  const gain = context.createGain();
  source.disconnect();
  source.connect(gain);
  gain.connect(musicGain);
  gain.gain.setValueAtTime(1, context.currentTime);
  gain.gain.linearRampToValueAtTime(0.0001, context.currentTime + 0.3);
  window.setTimeout(() => {
    try { source.stop(); } catch {}
    source.disconnect();
    gain.disconnect();
  }, 350);
}

function setLoop(name, enabled) {
  if (enabled) desiredLoops.add(name);
  else desiredLoops.delete(name);
  if (enabled && !loopingSounds.has(name)) {
    const source = playBuffer(sounds.get(name), effectGain, true);
    if (source) loopingSounds.set(name, source);
  } else if (!enabled && loopingSounds.has(name)) {
    loopingSounds.get(name).stop();
    loopingSounds.delete(name);
  }
  if (name === "fright") updateMusicVolume();
}

function playEffect(name) {
  if (name === "chomp") {
    chompIndex = 1 - chompIndex;
    name = chompIndex ? "chomp_a" : "chomp_b";
  }
  const source = playBuffer(sounds.get(name));
  if (name === "beam" && source) {
    activeEffects.set(name, source);
    source.addEventListener("ended", () => {
      if (activeEffects.get(name) === source) activeEffects.delete(name);
    }, { once: true });
  }
}

function stopEffect(name) {
  const source = activeEffects.get(name);
  if (!source) return;
  activeEffects.delete(name);
  source.stop();
}

async function enableSound() {
  try {
    const audio = getContext();
    if (gamePaused) await audio.suspend();
    else await audio.resume();
    soundEnabled = true;
    updateButton();
    if (currentMusicIndex !== null && !currentMusicSource) void playCurrentMusic(musicGeneration);
    for (const name of desiredLoops) {
      if (!loopingSounds.has(name)) setLoop(name, true);
    }
  } catch (error) {
    soundEnabled = false;
    updateButton();
    soundStatus.textContent = `Sound could not be started: ${error.message}`;
  }
}

function disableSound() {
  soundEnabled = false;
  updateButton();
  if (context?.state === "running") {
    context.suspend().catch((error) => {
      soundStatus.textContent = `Sound could not be paused: ${error.message}`;
    });
  }
}

function setPaused(paused) {
  gamePaused = paused;
  if (!context) return;
  const resumeAudio = soundEnabled && !document.hidden;
  const operation = paused ? context.suspend() : resumeAudio ? context.resume() : Promise.resolve();
  operation.then(() => {
    if (paused || !resumeAudio) return;
    if (currentMusicIndex !== null && !currentMusicSource) void playCurrentMusic(musicGeneration);
    for (const name of desiredLoops) {
      if (!loopingSounds.has(name)) setLoop(name, true);
    }
  }).catch((error) => {
    soundStatus.textContent = `Game audio could not be ${paused ? "paused" : "resumed"}: ${error.message}`;
  });
}

function startFromFirstGesture(event) {
  if (gestureHandled || event.target.closest?.("#sound")) return;
  gestureHandled = true;
  void enableSound();
}

soundButton.addEventListener("click", () => {
  gestureHandled = true;
  if (soundEnabled) disableSound();
  else void enableSound();
});
document.addEventListener("pointerdown", startFromFirstGesture, true);
document.addEventListener("keydown", startFromFirstGesture, true);
document.addEventListener("visibilitychange", () => {
  if (!context || !soundEnabled) return;
  if (document.hidden) {
    context.suspend().catch((error) => {
      soundStatus.textContent = `Sound could not be paused: ${error.message}`;
    });
  } else if (!gamePaused) {
    context.resume().then(() => {
      if (currentMusicIndex !== null && !currentMusicSource) void playCurrentMusic(musicGeneration);
    }).catch((error) => {
      soundStatus.textContent = `Sound could not be resumed: ${error.message}`;
    });
  }
});

updateButton();
window.arcadeAudio = Object.freeze({ playEffect, stopEffect, setLoop, startMusic, stopMusic, setPaused });
