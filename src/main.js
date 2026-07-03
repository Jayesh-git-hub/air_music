/**
 * main.js
 * Gesture Music Studio — Entry Point
 * Wires together webcam, MediaPipe hand tracking, and Tone.js audio engine.
 */

import { createHandTracker } from "./hand-tracker.js";
import { createGestureInterpreter, SCALES, normalizedToNote } from "./gesture-interpreter.js";
import { createAudioVisualizer } from "./visualizer.js";
import { createLoopStation } from "./loop-station.js";
import { capturePreset, loadPresetList, savePreset, deletePreset, toggleAudioExport, isExportRecording, generateShareUrl, copyShareUrlToClipboard, checkUrlForSharedPreset } from "./presets.js";
import { createMidiRecorder, exportEventsToMidi } from "./midi-exporter.js";
import { loadMagenta, initMelodyModel, generateMelody, setOnMelodyGenerated, addNoteToContext, clearMelodyContext, isModelReady, getLoadingState } from "./ai-melody.js";
import { createTutorial } from "./tutorial.js";
import { createSongGuide } from "./song-guide.js";
import * as Tone from "tone";

// ─── DOM References ───────────────────────────────────────────────────────

const videoEl = document.getElementById("webcam");
const overlayCanvas = document.getElementById("hand-overlay");
const visualizerCanvas = document.getElementById("visualizer");
const statusEl = document.getElementById("status");
const startupOverlay = document.getElementById("startup-overlay");
const startupHint = document.getElementById("startup-hint");
const instrumentSelect = document.getElementById("instrument-select");
const scaleSelect = document.getElementById("scale-select");
const infoPanel = document.getElementById("info-panel");
const bpmSlider = document.getElementById("bpm-slider");
const bpmDisplay = document.getElementById("bpm-display");
const metronomeBtn = document.getElementById("metronome-btn");
const quantizeSelect = document.getElementById("quantize-select");
const loopLayerCount = document.getElementById("loop-layer-count");
const loopRecIndicator = document.getElementById("loop-rec-indicator");
const loopLayersContainer = document.getElementById("loop-layers");
const vizModeBtns = document.querySelectorAll(".viz-mode-btn");
const vizModeLabel = document.getElementById("viz-mode-label");
const arpToggleBtn = document.getElementById("arp-toggle");
const arpPatternSelect = document.getElementById("arp-pattern");
const fxAxisControls = document.getElementById("fx-axis-controls");
const fxXParamSelect = document.getElementById("fx-x-param");
const fxYParamSelect = document.getElementById("fx-y-param");
const presetSaveBtn = document.getElementById("preset-save-btn");
const presetLoadSelect = document.getElementById("preset-load-select");
const presetDeleteBtn = document.getElementById("preset-delete-btn");
const exportBtn = document.getElementById("export-btn");
const exportMidiBtn = document.getElementById("export-midi-btn");
const shareLinkBtn = document.getElementById("share-link-btn");
const aiMelodyToggle = document.getElementById("ai-melody-toggle");
const aiMelodyStatus = document.getElementById("ai-melody-status");
const tutorialBtn = document.getElementById("tutorial-btn");
const tutorialPanel = document.getElementById("tutorial-panel");
const tutorialCloseBtn = document.getElementById("tutorial-close-btn");
const tutorialPrevBtn = document.getElementById("tutorial-prev-btn");
const tutorialSkipBtn = document.getElementById("tutorial-skip-btn");
const drumMappingSelect = document.getElementById("drum-mapping-select");
const drumChip = document.getElementById("drum-chip");
const healthIndicator = document.getElementById("health-indicator");
const healthFps = document.getElementById("health-fps");
const healthFrame = document.getElementById("health-frame");
const tutorialProgressFill = document.getElementById("tutorial-progress-fill");
const tutorialHoldFill = document.getElementById("tutorial-hold-fill");
const tutorialStepCounter = document.getElementById("tutorial-step-counter");
const tutorialIcon = document.getElementById("tutorial-icon");
const tutorialTitle = document.getElementById("tutorial-title");
const tutorialDescription = document.getElementById("tutorial-description");
const tutorialDetail = document.getElementById("tutorial-detail");

// ─── Song Guide DOM Refs ──────────────────────────────────────────────
const songGuideBtn = document.getElementById("song-guide-btn");
const songGuidePanel = document.getElementById("song-guide-panel");
const songGuideBody = document.getElementById("song-guide-body");
const songGuideSelect = document.getElementById("song-guide-select");
const songGuideFooter = document.getElementById("song-guide-footer");
const songGuidePrevBtn = document.getElementById("song-guide-prev-btn");
const songGuideNextBtn = document.getElementById("song-guide-next-btn");
const songGuideApplyBtn = document.getElementById("song-guide-apply-btn");
const songGuideCloseBtn = document.getElementById("song-guide-close-btn");
const songGuideStepCounter = document.getElementById("song-guide-step-counter");

// ─── New UI DOM Refs ────────────────────────────────────────────────────
const instrumentNavBtns = document.querySelectorAll(".instrument-btn");
const layerStack = document.getElementById("layer-stack");
const layerEmptyMsg = document.getElementById("layer-empty-msg");
const addLayerBtn = document.getElementById("add-layer-btn");
const stageInstrumentName = document.getElementById("stage-instrument-name");
const stageInstrumentDesc = document.getElementById("stage-instrument-desc");
const chordModeBtn = document.getElementById("chord-mode-btn");
const droneBtn = document.getElementById("drone-btn");
const drumMappingRow = document.getElementById("drum-mapping-row");
const scaleRow = document.getElementById("scale-row");
const chordRow = document.getElementById("chord-row");
const droneRow = document.getElementById("drone-row");
const arpSection = document.getElementById("arp-section");
const aiSection = document.getElementById("ai-section");
const aiRow = document.getElementById("ai-row");

// ─── Looper DOM Refs ────────────────────────────────────────────────────
const btnLoopRecord = document.getElementById("btn-loop-record");
const btnLoopStop = document.getElementById("btn-loop-stop");
const btnLoopClear = document.getElementById("btn-loop-clear");
const btnLoopPlay = document.getElementById("btn-loop-play");
const loopLayerCountDisplay = document.getElementById("loop-layer-count");
const loopRecIndicatorDisplay = document.getElementById("loop-rec-indicator");

// ─── State ────────────────────────────────────────────────────────────────

let handTracker = null;
let gestureInterpreter = null;
let visualizer = null;
let synth = null;
let currentInstrument = "theremin";
let currentScale = "pentatonic";
let isAudioReady = false;
let previousNote = null;
let lastGain = -1;
let lastFilter = -1;
let lastWet = -1;
let currentEffects = [];
let instrumentMaster = null; // Master bus for the current active instrument
const CHANGE_THRESHOLD = 0.02; // Only schedule audio param changes > 2%

// MIDI event recorder
let midiRecorder = createMidiRecorder();
let isMidiRecording = false;

// Tutorial state
let tutorial = null;

// ─── Instrument Layer State ─────────────────────────────────────────────
// Layers allow multiple instruments to play simultaneously.
// Each layer has { id, type, synth, effects, volumeNode, volume }
let instrumentLayers = [];  // array of active layers
let layerIdCounter = 0;
const MAX_LAYERS = 3;

// ─── Chord Mode State ───────────────────────────────────────────────────
// Chord mode plays a 3-note chord instead of a single note.
let isChordModeOn = false;
let previousChordNotes = []; // track currently sounding chord notes

// ─── Ambient Drone State ────────────────────────────────────────────────
// A background ambient drone pad that slowly evolves.
let isDroneOn = false;
let droneSynth = null;
let droneEffects = [];
let droneNote = "C2";

// AI Melody state
let isAiMelodyOn = false;
let aiMelodyNotes = []; // Generated notes to play
let aiMelodyIndex = 0;
let aiMelodyEventId = null;
let isAiGenerating = false; // Guard for concurrent generation

// Loop station
let loopStation = null;

// Tempo & Metronome state
let isMetronomeOn = false;
let metronomeEventId = null;
let metronomeSynth = null;
let currentQuantize = "off";

// Tap tempo state
const TAP_WINDOW = 2000; // 2 second window to consider taps as a sequence
let tapTimestamps = [];
let lastFistGesture = false;

// Health indicator
let healthFpsFrames = 0;
let healthFpsLastTime = 0;
let healthFpsValue = 0;
let healthLastCallbackTime = 0;
let healthStallCheckId = null;

// Volume meter
let volumeAnalyser = null;
let currentVolume = 0;

// FX Pad state
let fxXParam = "reverbMix";
let fxYParam = "delayTime";
let lastFxValues = {};

// Arpeggiator state
let isArpeggiatorOn = false;
let arpeggiatorPattern = "up";
let arpeggiatorEventId = null;
let arpIndex = 0;
let arpDirection = 1;
let lastArpRoot = 0.5; // Normalized Y position for root note
let lastArpOpenness = -1;

const ARP_LABELS = { up: "↑ Up", down: "↓ Down", upDown: "↕ Up/Dn", random: "🎲 Random" };

const FX_PARAM_LABELS = {
  reverbMix: "Reverb Mix",
  delayTime: "Delay Time",
  delayFeedback: "Delay Fdbk",
  filterFreq: "Filter Freq",
  filterRes: "Filter Res",
  distortion: "Distortion",
  chorusDepth: "Chorus Depth",
};

function getFxLabel(key) {
  return FX_PARAM_LABELS[key] || key;
}

// ─── Preset Helpers ──────────────────────────────────────────────────

/** Show a brief toast notification */
function showToast(msg, type = "success") {
  const existing = document.querySelector(".preset-toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = "preset-toast";
  el.textContent = msg;
  el.style.borderColor = type === "error" ? "var(--accent-red)" : "var(--accent-green)";
  el.style.color = type === "error" ? "var(--accent-red)" : "var(--accent-green)";
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity 0.3s"; setTimeout(() => el.remove(), 300); }, 2000);
}

/** Refresh the preset load dropdown from localStorage */
function refreshPresetList() {
  if (!presetLoadSelect) return;
  const presets = loadPresetList();
  const currentValue = presetLoadSelect.value;
  presetLoadSelect.innerHTML = `<option value="">Load Preset...</option>`;
  presets.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.name;
    const date = p.savedAt ? new Date(p.savedAt).toLocaleDateString() : "";
    opt.textContent = `${p.name}${date ? ` (${date})` : ""}`;
    presetLoadSelect.appendChild(opt);
  });
  if (currentValue && presets.some((p) => p.name === currentValue)) {
    presetLoadSelect.value = currentValue;
  }
  // Show/hide delete button
  if (presetDeleteBtn) {
    presetDeleteBtn.style.display = presets.length > 0 ? "inline-block" : "none";
  }
}

/** Apply a preset to the current app state */
function applyPreset(preset) {
  if (!preset) return;
  
  if (preset.instrument && instrumentSelect) {
    instrumentSelect.value = preset.instrument;
    currentInstrument = preset.instrument;
    createInstrument(preset.instrument);
  }
  if (preset.scale && scaleSelect) {
    scaleSelect.value = preset.scale;
    currentScale = preset.scale;
    if (gestureInterpreter) gestureInterpreter.setScale(preset.scale);
  }
  if (preset.bpm) {
    Tone.Transport.bpm.value = preset.bpm;
    if (bpmSlider) bpmSlider.value = preset.bpm;
    if (bpmDisplay) bpmDisplay.textContent = preset.bpm;
  }
  if (preset.quantize && quantizeSelect) {
    quantizeSelect.value = preset.quantize;
    currentQuantize = preset.quantize;
  }
  if (preset.metronome !== undefined && preset.metronome !== isMetronomeOn) {
    metronomeBtn.click();
  }
  if (preset.arpOn !== undefined && preset.arpOn !== isArpeggiatorOn && arpToggleBtn) {
    arpToggleBtn.click();
  }
  if (preset.arpPattern && arpPatternSelect) {
    arpPatternSelect.value = preset.arpPattern;
    arpeggiatorPattern = preset.arpPattern;
    if (isArpeggiatorOn) startArpeggiator();
  }
  if (preset.vizMode && visualizer) {
    visualizer.setMode(preset.vizMode);
    vizModeBtns.forEach((b) => {
      b.classList.toggle("viz-mode-active", b.dataset.mode === preset.vizMode);
    });
    const labels = { spectrum: "3D Spectrum", particles: "Particles", circular: "Circular", heatmap: "Heatmap" };
    if (vizModeLabel) vizModeLabel.textContent = `${labels[preset.vizMode] || preset.vizMode} • Move your hand to shape the sound`;
  }
  if (preset.fxXParam && fxXParamSelect) {
    fxXParamSelect.value = preset.fxXParam;
    fxXParam = preset.fxXParam;
  }
  if (preset.fxYParam && fxYParamSelect) {
    fxYParamSelect.value = preset.fxYParam;
    fxYParam = preset.fxYParam;
  }
  if (preset.drumMapping && drumMappingSelect) {
    drumMappingSelect.value = preset.drumMapping;
    currentDrumMapping = preset.drumMapping;
  }
  
  previousNote = null;
  lastGain = -1;
  lastFilter = -1;
  lastWet = -1;
}

/** Render the X/Y pad canvas showing current hand position */
function renderFxPadCanvas() {
  const canvas = document.getElementById("fx-pad-canvas");
  if (!canvas || !canvas.parentElement) return;
  
  const parent = canvas.parentElement;
  const rect = parent.getBoundingClientRect();
  canvas.width = rect.width || 120;
  canvas.height = rect.height || 120;
  
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  
  // Background
  ctx.fillStyle = "#0a0a1a";
  ctx.fillRect(0, 0, w, h);
  
  // Grid lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const x = (w / 4) * i;
    const y = (h / 4) * i;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  
  // Crosshair center (default position)
  const cx = w * (lastFxValues.xVal !== undefined ? lastFxValues.xVal / 100 : 0.5);
  const cy = h * (lastFxValues.yVal !== undefined ? lastFxValues.yVal / 100 : 0.5);
  
  // Crosshair lines
  ctx.strokeStyle = "rgba(0, 255, 136, 0.2)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
  ctx.setLineDash([]);
  
  // Target dot
  ctx.fillStyle = "#00FF88";
  ctx.shadowColor = "#00FF88";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  
  // Outer ring
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0, 255, 136, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.stroke();
  
  // Axis labels
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.font = "9px 'Inter', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(getFxLabel(fxXParam), w / 2, h - 4);
  ctx.textAlign = "left";
  ctx.save();
  ctx.translate(8, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(getFxLabel(fxYParam), 0, 0);
  ctx.restore();
}

/** Map openness (0-1) to arpeggiator speed interval */
function getArpInterval(openness) {
  if (openness > 0.85) return "16n";
  if (openness > 0.65) return "8n";
  if (openness > 0.45) return "4n";
  if (openness > 0.25) return "2n";
  return "1n";
}

/** Start the arpeggiator's Transport schedule */
function startArpeggiator() {
  stopArpeggiator();
  if (!isArpeggiatorOn || !synth) return;

  const interval = getArpInterval(lastArpOpenness >= 0 ? lastArpOpenness : 0.5);

  arpeggiatorEventId = Tone.Transport.scheduleRepeat((time) => {
    if (!isArpeggiatorOn || !synth || !gestureInterpreter) return;

    const scaleName = gestureInterpreter.getScale();
    const scaleNotes = SCALES[scaleName] || SCALES.pentatonic;
    if (scaleNotes.length === 0) return;

    // Determine which note to play based on pattern
    let noteIdx;
    switch (arpeggiatorPattern) {
      case "up":
        noteIdx = arpIndex % scaleNotes.length;
        arpIndex++;
        break;
      case "down":
        noteIdx = scaleNotes.length - 1 - (arpIndex % scaleNotes.length);
        arpIndex++;
        break;
      case "upDown":
        noteIdx = arpIndex;
        arpIndex += arpDirection;
        if (arpIndex >= scaleNotes.length - 1 || arpIndex <= 0) arpDirection *= -1;
        noteIdx = Math.min(Math.max(noteIdx, 0), scaleNotes.length - 1);
        break;
      case "random":
        noteIdx = Math.floor(Math.random() * scaleNotes.length);
        break;
      default:
        noteIdx = arpIndex % scaleNotes.length;
        arpIndex++;
    }

    // Compute note name from scale
    const semitone = scaleNotes[noteIdx];
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const noteName = noteNames[semitone];
    // Map root Y to octave range 3-6
    const octave = 3 + Math.round((1 - lastArpRoot) * 3);
    const note = `${noteName}${octave}`;
    const gain = Math.max(1 - lastArpRoot * 0.9, 0.1);

    // Play the note through the current synth
    if (synth.triggerAttackRelease) {
      synth.triggerAttackRelease(note, interval, time, gain);
    }
  }, interval);
}

function stopArpeggiator() {
  if (arpeggiatorEventId !== null) {
    Tone.Transport.clear(arpeggiatorEventId);
    arpeggiatorEventId = null;
  }
  arpIndex = 0;
  arpDirection = 1;
}

function toggleArpeggiator() {
  isArpeggiatorOn = !isArpeggiatorOn;
  if (isArpeggiatorOn) {
    startArpeggiator();
  } else {
    stopArpeggiator();
  }
  return isArpeggiatorOn;
}

// Drum kit state
const DRUM_FINGERS = ["thumb", "index", "middle", "ring", "pinky"];
const DRUM_CURL_THRESHOLD = 0.55;
const DRUM_RELEASE_THRESHOLD = 0.35;
let drumTriggered = {
  thumb: false,
  index: false,
  middle: false,
  ring: false,
  pinky: false,
};

// Drum mapping presets: maps each finger index → sound name
const DRUM_MAPPINGS = {
  default: {
    label: "🥁 Standard",
    map: { thumb: "kick", index: "snare", middle: "hihatClosed", ring: "hihatOpen", pinky: "clap" },
  },
  reversed: {
    label: "🔄 Reversed",
    map: { thumb: "clap", index: "hihatOpen", middle: "hihatClosed", ring: "snare", pinky: "kick" },
  },
  electronic: {
    label: "⚡ Electronic",
    map: { thumb: "kick", index: "clap", middle: "hihatClosed", ring: "hihatOpen", pinky: "snare" },
  },
  lofi: {
    label: "🎧 Lo-Fi",
    map: { thumb: "kick", index: "hihatClosed", middle: "snare", ring: "clap", pinky: "hihatOpen" },
  },
};
let currentDrumMapping = "default";

// Per-finger velocity from curl: hard curl → loud hit
function curlToVelocity(curl) {
  return Math.min(127, Math.max(1, 40 + Math.round(curl * 80)));
}

/** Safely dispose the current synth (handles both single Tone.js instruments and drum kit objects) */
function disposeSynth() {
  if (!synth) return;
  if (synth.kick && synth.snare && typeof synth === "object") {
    // Drum kit: dispose each individual instrument
    Object.values(synth).forEach((inst) => {
      if (inst && typeof inst.dispose === "function") inst.dispose();
    });
  } else if (typeof synth.dispose === "function") {
    synth.dispose();
  }
  synth = null;
}

/** Create/dispose metronome click synth and schedule */
function setupMetronome(on) {
  // Clean up old metronome
  if (metronomeEventId !== null) {
    Tone.Transport.clear(metronomeEventId);
    metronomeEventId = null;
  }
  if (metronomeSynth) {
    metronomeSynth.dispose();
    metronomeSynth = null;
  }

  if (on) {
    metronomeSynth = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.04, sustain: 0.001, release: 0.04 },
    }).toDestination();

    metronomeEventId = Tone.Transport.scheduleRepeat((time) => {
      const pos = Tone.Transport.position.split(":");
      const beat = parseInt(pos[1]);
      const isDownbeat = beat === 0;

      // Downbeat (beat 0) = higher pitch accent
      if (isDownbeat) {
        metronomeSynth.triggerAttackRelease("C5", "32n", time);
      } else {
        metronomeSynth.triggerAttackRelease("C4", "32n", time);
      }

      // Visual beat flash
      if (visualizer && typeof visualizer.triggerBeatFlash === "function") {
        visualizer.triggerBeatFlash(isDownbeat);
      }
    }, "4n"); // Every quarter note
  }
}
/** Handle tap tempo from fist gesture */
function handleTapTempo() {
  const now = Date.now();
  // Filter out old taps outside the window
  tapTimestamps = tapTimestamps.filter((t) => now - t < TAP_WINDOW);
  tapTimestamps.push(now);

  if (tapTimestamps.length >= 3) {
    // Calculate average interval between consecutive taps
    let totalInterval = 0;
    for (let i = 1; i < tapTimestamps.length; i++) {
      totalInterval += tapTimestamps[i] - tapTimestamps[i - 1];
    }
    const avgInterval = totalInterval / (tapTimestamps.length - 1);
    const bpm = Math.round(60000 / avgInterval);
    const clampedBpm = Math.min(Math.max(bpm, 40), 200);

    Tone.Transport.bpm.value = clampedBpm;
    if (bpmSlider) bpmSlider.value = clampedBpm;
    if (bpmDisplay) bpmDisplay.textContent = clampedBpm;
  }
}

// ─── Audio Engine ─────────────────────────────────────────────────────────

function createInstrument(type) {
  // Dispose old synth & effects
  disposeSynth();
  currentEffects.forEach((fx) => fx.dispose());
  currentEffects = [];
  
  if (!instrumentMaster) {
    instrumentMaster = new Tone.Gain(1).toDestination();
  }

  switch (type) {
    // THEREMIN — Lush cello/theremin hybrid
    // Two detuned oscillators, slow vibrato LFO, chorus for stereo width,
    // long plate reverb + analog delay. Sounds like a real theremin/cello.
    case "theremin": {
      const thRevPlate = new Tone.Reverb({ decay: 4.5, wet: 0.38, preDelay: 0.02 });
      const thDelay    = new Tone.FeedbackDelay({ delayTime: "6n", feedback: 0.22, wet: 0.18 });
      const thChorus   = new Tone.Chorus({ frequency: 0.6, delayTime: 3.5, depth: 0.5, wet: 0.4 });
      const thFilter   = new Tone.Filter({ frequency: 2400, type: "lowpass", Q: 0.8 });
      const thVibrato  = new Tone.Vibrato({ frequency: 5.2, depth: 0.06, wet: 0.55 });

      // Main voice: warm triangle with 8 harmonics (cello-like fundamental)
      const thVoice1 = new Tone.MonoSynth({
        oscillator: { type: "triangle8" },
        envelope: { attack: 0.12, decay: 0.2, sustain: 0.85, release: 2.2 },
        filter: { Q: 2, type: "lowpass", frequency: 3000 },
        filterEnvelope: {
          attack: 0.18, decay: 0.35, sustain: 0.6, release: 2.0,
          baseFrequency: 180, octaves: 2.8,
        },
      });

      // Second voice: detuned sine for warmth (natural beating effect)
      const thVoice2 = new Tone.MonoSynth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.18, decay: 0.2, sustain: 0.75, release: 2.8 },
        filter: { Q: 1, type: "lowpass", frequency: 1800 },
        filterEnvelope: {
          attack: 0.22, decay: 0.3, sustain: 0.5, release: 2.2,
          baseFrequency: 150, octaves: 2.2,
        },
        volume: -8,
      });

      const thMix = new Tone.Gain(0.75);
      thVoice1.chain(thVibrato, thMix);
      thVoice2.connect(thMix);
      thMix.chain(thFilter, thChorus, thRevPlate, thDelay, instrumentMaster);

      // Slow detune drift LFO for natural feel
      const thDetuneLFO = new Tone.LFO({ frequency: 0.15, min: -4, max: 4 }).start();
      thDetuneLFO.connect(thVoice2.detune);
      synth = {
        _v1: thVoice1, _v2: thVoice2,
        triggerAttack: (note, time, vel) => { thVoice1.triggerAttack(note, time, vel); thVoice2.triggerAttack(note, time, (vel || 0.7) * 0.6); },
        triggerRelease: (time) => { thVoice1.triggerRelease(time); thVoice2.triggerRelease(time); },
        triggerAttackRelease: (note, dur, time, vel) => { thVoice1.triggerAttackRelease(note, dur, time, vel); thVoice2.triggerAttackRelease(note, dur, time, (vel || 0.7) * 0.6); },
        set: (params) => { if (params.filterFrequency !== undefined) { thVoice1.set({ filterFrequency: params.filterFrequency }); thVoice2.set({ filterFrequency: params.filterFrequency * 0.75 }); } },
        get volume() { return thVoice1.volume; },
        dispose: () => { thDetuneLFO.stop().dispose(); thVoice1.dispose(); thVoice2.dispose(); thMix.dispose(); },
      };
      currentEffects = [thRevPlate, thDelay, thChorus, thFilter, thVibrato, thMix];
      return;
    }

    // DRUM KIT — Studio-quality acoustic kit
    case "drumkit": {
      const drumComp   = new Tone.Compressor({ ratio: 5, threshold: -18, attack: 0.002, release: 0.15, knee: 6 });
      const drumHiPass = new Tone.Filter({ frequency: 40,    type: "highpass", Q: 0.5 });
      const drumLoPass = new Tone.Filter({ frequency: 14000, type: "lowpass",  Q: 0.7 });
      const drumEQ     = new Tone.EQ3({ low: 2, mid: -1, high: 1, lowFrequency: 250, highFrequency: 4000 });
      const drumRev    = new Tone.Reverb({ decay: 1.2, wet: 0.12, preDelay: 0.005 });
      const drumGain   = new Tone.Gain(0.9);
      drumComp.chain(drumHiPass, drumEQ, drumLoPass, drumRev, drumGain, instrumentMaster);

      const kickSub   = new Tone.MembraneSynth({ pitchDecay: 0.055, octaves: 9,  envelope: { attack: 0.001, decay: 0.55, sustain: 0.0, release: 0.7  } });
      const kickBody  = new Tone.MembraneSynth({ pitchDecay: 0.025, octaves: 5,  envelope: { attack: 0.001, decay: 0.22, sustain: 0.0, release: 0.25 } });
      const kickClick = new Tone.NoiseSynth({ noise: { type: "white" },          envelope: { attack: 0.0005, decay: 0.012, sustain: 0.0, release: 0.02 } });
      kickSub.volume.value = -3; kickBody.volume.value = -8;
      const kickClickF = new Tone.Filter({ frequency: 4500, type: "bandpass", Q: 2 });
      kickSub.chain(drumComp); kickBody.chain(drumComp); kickClick.chain(kickClickF, drumComp);
      const kick = {
        triggerAttackRelease: (note, duration, time, velocity) => {
          const v = velocity ?? 0.85;
          kickSub.triggerAttackRelease("C1",  duration, time, v);
          kickBody.triggerAttackRelease("C2", duration, time, v * 0.65);
          kickClick.triggerAttackRelease(duration, time, v * 0.5);
        },
        dispose: () => { kickSub.dispose(); kickBody.dispose(); kickClick.dispose(); kickClickF.dispose(); },
      };

      const snareBody  = new Tone.MembraneSynth({ pitchDecay: 0.045, octaves: 2.5, envelope: { attack: 0.001, decay: 0.19, sustain: 0.0, release: 0.18 } });
      snareBody.volume.value = -4;
      const snareWires = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.135, sustain: 0.0, release: 0.18 } });
      const sWiresHP = new Tone.Filter({ frequency: 1800, type: "highpass", Q: 1.2 });
      const sWiresLP = new Tone.Filter({ frequency: 8000, type: "lowpass",  Q: 0.8 });
      const snareCrack  = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.0005, decay: 0.025, sustain: 0.0, release: 0.03 } });
      const sCrackF = new Tone.Filter({ frequency: 2800, type: "bandpass", Q: 3 });
      snareBody.chain(drumComp);
      snareWires.chain(sWiresHP, sWiresLP, drumComp);
      snareCrack.chain(sCrackF, drumComp);
      const snare = {
        triggerAttackRelease: (note, duration, time, velocity) => {
          const v = velocity ?? 0.82;
          snareBody.triggerAttackRelease("D3", duration, time, v * 0.55);
          snareWires.triggerAttackRelease(duration, time, v * 0.7);
          snareCrack.triggerAttackRelease(duration, time, v * 0.45);
        },
        dispose: () => { snareBody.dispose(); snareWires.dispose(); snareCrack.dispose(); sWiresHP.dispose(); sWiresLP.dispose(); sCrackF.dispose(); },
      };

      // Hi-Hat Closed: crisp, bright
      const hihatClosed = new Tone.MetalSynth({ frequency: 520, envelope: { attack: 0.0003, decay: 0.055, sustain: 0.0, release: 0.06 }, harmonicity: 11.2, modulationIndex: 62, resonance: 4200, octaves: 1.8 });
      hihatClosed.volume.value = -7; hihatClosed.chain(drumComp);

      // Hi-Hat Open: longer ring
      const hihatOpen = new Tone.MetalSynth({ frequency: 420, envelope: { attack: 0.0005, decay: 0.38, sustain: 0.01, release: 0.5 }, harmonicity: 8.5, modulationIndex: 42, resonance: 3000, octaves: 1.5 });
      hihatOpen.volume.value = -9; hihatOpen.chain(drumComp);

      // Clap: 4 staggered noise bursts
      const mkClap = () => new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.075, sustain: 0.0, release: 0.1 } });
      const cB1 = mkClap(), cB2 = mkClap(), cB3 = mkClap();
      const cBody = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.003, decay: 0.22, sustain: 0.0, release: 0.28 } });
      const cHP = new Tone.Filter({ frequency: 900,  type: "highpass", Q: 1.5 });
      const cLP = new Tone.Filter({ frequency: 9000, type: "lowpass",  Q: 0.6 });
      cB1.chain(cHP, cLP, drumComp); cB2.chain(cHP, cLP, drumComp);
      cB3.chain(cHP, cLP, drumComp); cBody.chain(cHP, cLP, drumComp);
      const clap = {
        triggerAttackRelease: (note, duration, time, velocity) => {
          const v = velocity ?? 0.75; const t = time ?? Tone.now();
          cB1.triggerAttackRelease(duration, t,           v);
          cB2.triggerAttackRelease(duration, t + 0.007,   v * 0.85);
          cB3.triggerAttackRelease(duration, t + 0.013,   v * 0.7);
          cBody.triggerAttackRelease(duration, t + 0.005, v * 0.45);
        },
        dispose: () => { cB1.dispose(); cB2.dispose(); cB3.dispose(); cBody.dispose(); cHP.dispose(); cLP.dispose(); },
      };

      synth = { kick, snare, hihatClosed, hihatOpen, clap };
      currentEffects = [drumComp, drumHiPass, drumEQ, drumLoPass, drumRev, drumGain];
      drumTriggered = { thumb: false, index: false, middle: false, ring: false, pinky: false };
      return;
    }


    // FX PAD — Evolving cinematic orchestra drone
    // PolySynth on a rich 5-note chord, tremolo, slow filter sweep LFO,
    // concert-hall reverb. Sounds like a real strings/orchestra section.
    case "fxpad": {
      const fxReverb     = new Tone.Reverb({ decay: 6, wet: 0.45, preDelay: 0.04 });
      const fxDelay      = new Tone.FeedbackDelay({ delayTime: "4n", feedback: 0.28, wet: 0.22 });
      const fxFilter     = new Tone.Filter({ frequency: 900, type: "lowpass", Q: 1.5 });
      const fxDistortion = new Tone.Distortion({ distortion: 0, oversample: "2x" });
      const fxChorus     = new Tone.Chorus({ frequency: 0.35, delayTime: 4, depth: 0.65, wet: 0.5 });
      const fxTremolo    = new Tone.Tremolo({ frequency: 0.18, depth: 0.35, wet: 0.5 }).start();
      const fxEQ         = new Tone.EQ3({ low: 3, mid: 0, high: -2 });

      // Rich polyphonic voice with sawtooth harmonics (orchestral swell)
      const droneVoice = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth4" },
        envelope: { attack: 3.5, decay: 3, sustain: 0.65, release: 6.0 },
        volume: -10,
      });

      droneVoice.chain(fxEQ, fxDistortion, fxChorus, fxFilter, fxTremolo, fxReverb, fxDelay, instrumentMaster);
      // 5-note orchestral chord: root, octave, fifth, third, seventh
      droneVoice.triggerAttack(["C2", "C3", "G3", "E4", "B4"]);

      // Filter sweeps slowly for organic evolution
      const filterLFO = new Tone.LFO({ frequency: 0.04, min: 400, max: 1800 }).start();
      filterLFO.connect(fxFilter.frequency);

      synth = droneVoice;
      synth._fxReverb     = fxReverb;
      synth._fxDelay      = fxDelay;
      synth._fxFilter     = fxFilter;
      synth._fxDistortion = fxDistortion;
      synth._fxChorus     = fxChorus;
      synth._filterLFO    = filterLFO;
      synth._fxTremolo    = fxTremolo;

      currentEffects = [fxReverb, fxDelay, fxFilter, fxDistortion, fxChorus, fxTremolo, fxEQ, filterLFO];
      return;
    }

    // KAOSS PAD — 3-voice supersaw cinematic pad
    // Three slightly detuned FMSynths for a classic supersaw chorus effect
    // (inspired by Roland JP-8000). Phaser + chorus + lush reverb.
    case "kaoss": {
      const kaossReverb = new Tone.Reverb({ decay: 5,   wet: 0.42, preDelay: 0.03 });
      const kaossDelay  = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.3, wet: 0.22 });
      const kaossChorus = new Tone.Chorus({ frequency: 0.45, delayTime: 5, depth: 0.8, wet: 0.55 });
      const kaossPhaser = new Tone.Phaser({ frequency: 0.3, octaves: 3, baseFrequency: 700, wet: 0.5 });
      const kaossFilter = new Tone.Filter({ frequency: 1800, type: "lowpass", Q: 2.5 });
      const kaossEQ     = new Tone.EQ3({ low: 2, mid: 0, high: -1 });
      const kaosMix     = new Tone.Gain(0.72);

      // Three slightly detuned sawtooth FMSynths (supersaw voices)
      const mkKaoss = (detune, vol) => new Tone.FMSynth({
        harmonicity: 3.5, modulationIndex: 8, detune,
        oscillator:         { type: "sawtooth6" },
        envelope:           { attack: 0.08, decay: 0.4, sustain: 0.7, release: 2.5 },
        modulation:         { type: "square" },
        modulationEnvelope: { attack: 0.1, decay: 0.5, sustain: 0.6, release: 2.0 },
        volume: vol,
      });
      const kV1 = mkKaoss(0, -8); const kV2 = mkKaoss(7, -13); const kV3 = mkKaoss(-7, -13);
      kV1.connect(kaosMix); kV2.connect(kaosMix); kV3.connect(kaosMix);
      kaosMix.chain(kaossEQ, kaossFilter, kaossPhaser, kaossChorus, kaossReverb, kaossDelay, instrumentMaster);

      synth = {
        _v1: kV1, _v2: kV2, _v3: kV3,
        triggerAttack: (note, time, vel) => {
          kV1.triggerAttack(note, time, vel);
          kV2.triggerAttack(note, time, (vel || 0.7) * 0.7);
          kV3.triggerAttack(note, time, (vel || 0.7) * 0.7);
        },
        triggerRelease: (time) => {
          kV1.triggerRelease(time); kV2.triggerRelease(time); kV3.triggerRelease(time);
        },
        triggerAttackRelease: (note, dur, time, vel) => {
          kV1.triggerAttackRelease(note, dur, time, vel);
          kV2.triggerAttackRelease(note, dur, time, (vel || 0.7) * 0.7);
          kV3.triggerAttackRelease(note, dur, time, (vel || 0.7) * 0.7);
        },
        set: (params) => { kV1.set(params); kV2.set(params); kV3.set(params); },
        get volume() { return kV1.volume; },
        dispose: () => { kV1.dispose(); kV2.dispose(); kV3.dispose(); kaosMix.dispose(); },
      };

      currentEffects = [kaossReverb, kaossDelay, kaossChorus, kaossPhaser, kaossFilter, kaossEQ, kaosMix];
      return;
    }

    default:
      synth = new Tone.Synth().connect(instrumentMaster);
      currentEffects = [];
  }
  
  // Wire the new instrument to the Loop Station for isolated recording
  if (loopStation) {
    loopStation.setRecordingSource(instrumentMaster);
  }
}

function getAnalyser() {
  const waveform = new Tone.Analyser("waveform", 1024);    const frequency = new Tone.Analyser("fft", 1024);
  Tone.getDestination().connect(waveform);
  Tone.getDestination().connect(frequency);
  return { waveform, frequency };
}

// ─── Webcam ───────────────────────────────────────────────────────────────

let mediaStream = null;

async function startWebcam() {
  // Detect mobile via user agent and touch support
  const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) ||
    ('ontouchstart' in window && window.innerWidth < 800);

  // Mobile: use front camera with lower res for performance
  // Desktop: standard 640x480
  const videoConstraints = isMobile
    ? { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" }
    : { width: 640, height: 480, facingMode: "user" };

  mediaStream = await navigator.mediaDevices.getUserMedia({
    video: videoConstraints,
    audio: false,
  });
  videoEl.srcObject = mediaStream;
  
  // Wait for video metadata with a timeout to prevent hanging forever
  await Promise.race([
    new Promise((resolve) => {
      videoEl.onloadedmetadata = () => {
        videoEl.play();
        overlayCanvas.width = videoEl.videoWidth;
        overlayCanvas.height = videoEl.videoHeight;
        visualizerCanvas.width = 640;
        visualizerCanvas.height = 200;
        resolve();
      };
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Webcam timeout — camera not responding")), 10000)
    ),
  ]);
}

function stopWebcam() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  videoEl.srcObject = null;
}

// ─── Hand Tracking Pipeline ─────────────────────────────────────────────

async function initHandTracking() {
  handTracker = await createHandTracker(videoEl, overlayCanvas, {
    numHands: 2,
  });

  gestureInterpreter = createGestureInterpreter({ scale: currentScale });

  handTracker.setOnFrame((handData) => {
    const interpreted = gestureInterpreter.interpret(handData);

    // Auto-start audio when hand is first detected (fallback if initial Tone.start() failed)
    if (!isAudioReady && interpreted.hasHand && window.__deferredAudioStart) {
      window.__deferredAudioStart();
    }

    // Tap tempo: detect fist gesture just changed to Closed_Fist
    if (interpreted.gesture && interpreted.gestureJustChanged) {
      if (interpreted.gesture.name === "Closed_Fist") {
        handleTapTempo();
      }
    }

    // ─── Loop Station Gesture Controls ──────────────────────────────
    if (loopStation) {
      // Circle → start recording
      if (interpreted.movementGesture === "circle" && interpreted.movementGestureJustChanged) {
        loopStation.startRecording();
      }

      // Swipe up → add new layer (while existing loops play)
      if (interpreted.movementGesture === "swipe_up" && interpreted.movementGestureJustChanged) {
        loopStation.startRecording();
      }

      // Swipe down → remove last layer
      if (interpreted.movementGesture === "swipe_down" && interpreted.movementGestureJustChanged) {
        loopStation.removeLastLayer();
      }

      // MediaPipe gestures for loop control
      if (interpreted.gesture && interpreted.gestureJustChanged) {
        switch (interpreted.gesture.name) {
          case "Open_Palm":
            // Open palm → stop recording (if recording)
            loopStation.stopRecording();
            break;
          case "Thumb_Up":
            // Thumbs up → toggle all playback
            loopStation.toggleAllPlayback();
            break;
          case "Thumb_Down":
            // Thumbs down → stop all
            loopStation.stopAll();
            break;
        }
      }
    }

    // Update arpeggiator state from hand data
    if (interpreted.hasHand) {
      lastArpRoot = interpreted.smoothedY;
      // Restart arpeggiator if openness changed significantly
      const newOpenness = interpreted.openness;
      if (isArpeggiatorOn && Math.abs(newOpenness - lastArpOpenness) > 0.15) {
        lastArpOpenness = newOpenness;
        startArpeggiator();
      } else if (lastArpOpenness < 0) {
        lastArpOpenness = newOpenness;
      }
    }

    // MIDI recording: feed note events
    if (isMidiRecording && interpreted.hasHand && interpreted.currentNote && midiRecorder) {
      if (interpreted.currentNote !== previousMidiNote) {
        if (previousMidiNote) {
          midiRecorder.noteOff(previousMidiNote);
        }
        midiRecorder.noteOn(interpreted.currentNote, Math.round((1 - interpreted.smoothedY) * 100 + 20));
        previousMidiNote = interpreted.currentNote;
      }
    }

    // AI Melody: feed notes and trigger generation
    if (isAiMelodyOn && interpreted.hasHand && interpreted.currentNote) {
      if (interpreted.currentNote !== previousAiNote) {
        if (previousAiNote) {
          addNoteToContext(previousAiNote, 0.25);
        }
        previousAiNote = interpreted.currentNote;
        // Trigger AI generation periodically (rate-limited to prevent overlap)
        if (!isAiGenerating && Math.random() < 0.008) {
          isAiGenerating = true;
          generateMelody(4, 1.0).then((notes) => {
            isAiGenerating = false;
            if (notes.length > 0) {
              aiMelodyNotes = notes;
              aiMelodyIndex = 0;
            }
          }).catch(() => { isAiGenerating = false; });
        }
      }
    }

    // Tutorial: process frame for gesture detection
    if (tutorial && tutorial.getIsActive()) {
      tutorial.processFrame(interpreted);
    }

    // Read volume level from analyser (compute RMS from waveform Float32Array)
    if (volumeAnalyser) {
      const vol = volumeAnalyser.getValue();
      if (vol instanceof Float32Array && vol.length > 0) {
        // Compute RMS (root-mean-square) for an accurate volume level
        let sumSq = 0;
        for (let i = 0; i < vol.length; i += 4) {
          sumSq += vol[i] * vol[i];
        }
        currentVolume = Math.sqrt(sumSq / (vol.length / 4));
      } else if (typeof vol === "number") {
        currentVolume = Math.abs(vol);
      }
    }

    updateAudio(interpreted);
    updateUI(interpreted);
    if (visualizer) {
      visualizer.updateGestureData(interpreted);
    }

    // ─── Health Indicator Update ─────────────────────────────────────
    if (handTracker && healthFps && healthFrame) {
      const fc = typeof handTracker.getFrameCount === "function" ? handTracker.getFrameCount() : 0;
      healthFrame.textContent = `#${fc}`;
      healthLastCallbackTime = performance.now();

      // Compute FPS every ~15 frames
      healthFpsFrames++;
      if (healthFpsFrames >= 15) {
        const now = performance.now();
        if (healthFpsLastTime > 0) {
          const elapsed = (now - healthFpsLastTime) / 1000;
          healthFpsValue = Math.round(healthFpsFrames / elapsed);
          healthFps.textContent = `${healthFpsValue} FPS`;
        }
        healthFpsLastTime = now;
        healthFpsFrames = 0;
      }

      // Remove stalled state on any frame callback
      if (healthIndicator) {
        healthIndicator.classList.remove("stalled");
      }
    }
  });

  handTracker.start();
}

// ─── Gesture → Audio Mapping (throttled) ─────────────────────────────────

function updateAudio(data) {
  if (!synth || !isAudioReady) return;

  // Only single-note synths (theremin, kaoss) have triggerRelease
  const isSingleSynth = currentInstrument === "theremin" || currentInstrument === "kaoss";

  if (!data.hasHand) {
    if (isSingleSynth) synth.triggerRelease();
    // Also release chord notes
    if (isChordModeOn && previousChordNotes.length > 0) {
      previousChordNotes = [];
    }
    previousNote = null;
    previousMidiNote = null;
    previousAiNote = null;
    // Update layers
    updateLayerAudio(data);
    return;
  }

  const { smoothedX, smoothedY, openness, currentNote } = data;

  // Map Y (up-down) to volume/gain
  const gain = Math.max(1 - smoothedY * 0.9, 0.05);

  // Map X (left-right) to filter cutoff
  const filterFreq = Tone.Frequency(80 + smoothedX * 4000, "hz").toFrequency();

  // Openness mapped to reverb/delay wetness
  const wetAmount = openness * 0.6;

  switch (currentInstrument) {
    case "theremin": {
      // Chord mode: play a full chord instead of a single note
      if (isChordModeOn) {
        if (currentNote !== previousNote) {
          // Release old chord
          if (synth.triggerRelease) synth.triggerRelease();
          // Build and trigger new chord
          const chordNotes = buildChord(currentNote, data);
          chordNotes.forEach((n) => {
            try { synth.triggerAttack(n, undefined, gain * 0.6); } catch(e) {}
          });
          previousNote = currentNote;
          previousChordNotes = chordNotes;
          lastGain = gain;
        }
        // Throttled volume
        if (Math.abs(gain - lastGain) > CHANGE_THRESHOLD) {
          synth.volume.rampTo(Tone.gainToDb(gain * 0.6), 0.04);
          lastGain = gain;
        }
        break;
      }

      // Trigger note only when it changes
      if (currentNote !== previousNote) {
        // Play AI melody notes if available
        if (isAiMelodyOn && aiMelodyNotes.length > 0 && aiMelodyIndex < aiMelodyNotes.length) {
          const aiNote = aiMelodyNotes[aiMelodyIndex];
          const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
          const octave = 4 + Math.floor(aiNote.pitch / 12);
          const noteIndex = aiNote.pitch % 12;
          const aiNoteName = `${noteNames[noteIndex]}${octave}`;
          const aiDuration = Math.max(aiNote.duration, 0.1);
          synth.triggerAttackRelease(aiNoteName, `${aiDuration * 2}n`, undefined, gain * 0.7);
          aiMelodyIndex++;
          if (aiMelodyIndex >= aiMelodyNotes.length) {
            aiMelodyIndex = 0;
          }
          previousNote = currentNote;
          break;
        }

        synth.triggerRelease();
        // Quantize if enabled
        const qTime = currentQuantize !== "off" ? `+${currentQuantize}` : undefined;
        synth.triggerAttack(currentNote, qTime, gain);
        previousNote = currentNote;
        lastGain = gain;
      }

      // Throttled volume updates
      if (Math.abs(gain - lastGain) > CHANGE_THRESHOLD) {
        synth.volume.rampTo(Tone.gainToDb(gain), 0.04);
        lastGain = gain;
      }

      // Throttled filter updates — use set() for proper parameter control
      if (Math.abs(filterFreq - lastFilter) > 20) {
        synth.set({ filterFrequency: filterFreq });
        lastFilter = filterFreq;
      }

      // Throttled reverb updates — use stored effects reference
      if (Math.abs(wetAmount - lastWet) > CHANGE_THRESHOLD) {
        const rev = currentEffects.find((fx) => fx instanceof Tone.Reverb);
        if (rev) {
          rev.wet.rampTo(wetAmount, 0.04);
        }
        lastWet = wetAmount;
      }
      break;
    }

    case "fxpad": {
      // X/Y Pad: map hand position to selected effect parameters
      const fx = synth._fxReverb && synth._fxDelay ? synth : null;
      if (!fx) break;

      // Compute parameter values from hand position
      const xVal = data.smoothedX; // 0-1
      const yVal = data.smoothedY; // 0-1

      // Build all possible effect parameter values
      const paramValues = {};

      // Reverb Mix: 0-0.9
      paramValues.reverbMix = yVal * 0.85;
      // Delay Time: continuous 32n to 1n (about 0.08s to 0.5s at 120bpm)
      // Use a continuous 32nd→1st mapping via exponential curve
      const delay32n = 0.125 / (Tone.Transport.bpm.value / 120); // 32nd note duration in sec
      const delay1n = 2.0 / (Tone.Transport.bpm.value / 120);    // whole note duration in sec
      paramValues.delayTime = delay32n + xVal * xVal * (delay1n - delay32n);
      // Delay Feedback: 0-0.9
      paramValues.delayFeedback = xVal * 0.85;
      // Filter Frequency: 80-6000 Hz (exponential for musical feel)
      paramValues.filterFreq = 80 + Math.pow(xVal, 0.6) * 5920;
      // Filter Resonance: 0.5-12
      paramValues.filterRes = 0.5 + yVal * 11.5;
      // Distortion: 0-0.9
      paramValues.distortion = (1 - yVal) * 0.85;
      // Chorus Depth: 0-1
      paramValues.chorusDepth = yVal;

      // Apply X parameter
      const xParam = fxXParam || "reverbMix";
      switch (xParam) {
        case "reverbMix":
          fx._fxReverb.wet.rampTo(paramValues.reverbMix, 0.04);
          break;
        case "delayTime":
          fx._fxDelay.delayTime.rampTo(paramValues.delayTime, 0.04);
          break;
        case "delayFeedback":
          fx._fxDelay.feedback.rampTo(paramValues.delayFeedback, 0.04);
          break;
        case "filterFreq":
          fx._fxFilter.frequency.rampTo(paramValues.filterFreq, 0.04);
          break;
        case "filterRes":
          fx._fxFilter.Q.rampTo(paramValues.filterRes, 0.04);
          break;
        case "distortion":
          fx._fxDistortion.distortion = paramValues.distortion;
          break;
        case "chorusDepth":
          if (fx._fxChorus) fx._fxChorus.depth.rampTo(paramValues.chorusDepth, 0.04);
          break;
      }

      // Apply Y parameter
      const yParam = fxYParam || "delayTime";
      switch (yParam) {
        case "reverbMix":
          fx._fxReverb.wet.rampTo(paramValues.reverbMix, 0.04);
          break;
        case "delayTime":
          fx._fxDelay.delayTime.rampTo(paramValues.delayTime, 0.04);
          break;
        case "delayFeedback":
          fx._fxDelay.feedback.rampTo(paramValues.delayFeedback, 0.04);
          break;
        case "filterFreq":
          fx._fxFilter.frequency.rampTo(paramValues.filterFreq, 0.04);
          break;
        case "filterRes":
          fx._fxFilter.Q.rampTo(paramValues.filterRes, 0.04);
          break;
        case "distortion":
          fx._fxDistortion.distortion = paramValues.distortion;
          break;
        case "chorusDepth":
          if (fx._fxChorus) fx._fxChorus.depth.rampTo(paramValues.chorusDepth, 0.04);
          break;
      }

      // Store current values for UI display
      lastFxValues = {
        reverbMix: Math.round(paramValues.reverbMix * 100),
        delayTime: (paramValues.delayTime * 1000).toFixed(0) + "ms",
        delayFeedback: Math.round(paramValues.delayFeedback * 100),
        filterFreq: Math.round(paramValues.filterFreq) + "Hz",
        filterRes: paramValues.filterRes.toFixed(1),
        distortion: Math.round(paramValues.distortion * 100),
        chorusDepth: Math.round(paramValues.chorusDepth * 100),
        xParam,
        yParam,
        xVal: Math.round(xVal * 100),
        yVal: Math.round(yVal * 100),
      };
      break;
    }

    case "kaoss": {
      if (currentNote !== previousNote) {
        // Play AI melody notes if available
        if (isAiMelodyOn && aiMelodyNotes.length > 0 && aiMelodyIndex < aiMelodyNotes.length) {
          const aiNote = aiMelodyNotes[aiMelodyIndex];
          const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
          const octave = 4 + Math.floor(aiNote.pitch / 12);
          const noteIndex = aiNote.pitch % 12;
          const aiNoteName = `${noteNames[noteIndex]}${octave}`;
          const aiDuration = Math.max(aiNote.duration, 0.1);
          synth.triggerAttackRelease(aiNoteName, `${aiDuration * 2}n`, undefined, gain * 0.7);
          aiMelodyIndex++;
          if (aiMelodyIndex >= aiMelodyNotes.length) {
            aiMelodyIndex = 0;
          }
          previousNote = currentNote;
          break;
        }

        synth.triggerRelease();
        const qTime = currentQuantize !== "off" ? `+${currentQuantize}` : undefined;
        synth.triggerAttack(currentNote, qTime, gain);
        previousNote = currentNote;
      }

      synth.set({
        modulationIndex: 1 + smoothedX * 5,
        harmonicity: 0.5 + smoothedX * 2,
      });

      if (Math.abs(gain - lastGain) > CHANGE_THRESHOLD) {
        synth.volume.rampTo(Tone.gainToDb(gain), 0.04);
        lastGain = gain;
      }
      break;
    }

    case "drumkit": {
      if (!data.fingerCurls) break;

      const mapping = DRUM_MAPPINGS[currentDrumMapping]?.map || DRUM_MAPPINGS.default.map;

      const DRUM_DURATIONS = {
        kick: "8n",
        snare: "16n",
        hihatClosed: "64n",
        hihatOpen: "2n",
        clap: "16n",
      };

      for (const finger of DRUM_FINGERS) {
        const curl = data.fingerCurls[finger];
        const soundName = mapping[finger];
        const drum = synth[soundName];
        if (!drum) continue;

        if (curl > DRUM_CURL_THRESHOLD && !drumTriggered[finger]) {
          drumTriggered[finger] = true;
          const velocity = curlToVelocity(curl);
          const freq = drum.frequency ? drum.frequency.value : undefined;
          const qTime = currentQuantize !== "off" ? `+${currentQuantize}` : undefined;
          drum.triggerAttackRelease(
            soundName === "kick" ? "C2" : freq,
            DRUM_DURATIONS[soundName],
            qTime,
            velocity / 127
          );
        } else if (curl < DRUM_RELEASE_THRESHOLD) {
          drumTriggered[finger] = false;
        }
      }
      break;
    }

    default:
      if (currentNote !== previousNote) {
        synth.triggerRelease();
        synth.triggerAttack(currentNote, undefined, gain);
        previousNote = currentNote;
      }
  }

  // Feed note to all active layers
  updateLayerAudio(data);
}

// ─── UI Updates ──────────────────────────────────────────────────────────

const gestureNameMap = {
  Closed_Fist: "✊ Fist",
  Open_Palm: "✋ Open Palm",
  Pointing_Up: "☝️ Pointing",
  Thumb_Up: "👍 Thumbs Up",
  Thumb_Down: "👎 Thumbs Down",
  Victory: "✌️ Peace",
  ILoveYou: "🤟 I Love You",
};

const fingerEmojis = {
  thumb: "👍",
  index: "☝️",
  middle: "🖕",
  ring: "💍",
  pinky: "🤙",
};

const fingerSoundNames = {
  thumb: "Kick",
  index: "Snare",
  middle: "HH▽",
  ring: "HH△",
  pinky: "Clap",
};

function updateUI(data) {
  if (!data.hasHand) {
    statusEl.textContent = "No hand detected — show your hand to the camera";
    statusEl.className = "status-idle";
    infoPanel.innerHTML =
      '<div class="info-placeholder">Show your hand to the camera</div>';
    return;
  }

  statusEl.textContent = "Hand detected! 🖐️";
  statusEl.className = "status-active";

  let html = "";

  if (currentInstrument === "drumkit") {
    // Drum mode: show finger curl values + velocity
    html = `<div class="info-section-title">🥁 Air Drums</div>`;

    // Show current mapping name
    const mappingLabel = DRUM_MAPPINGS[currentDrumMapping]?.label || "🥁 Standard";
    html += `<div class="info-row mapping-row"><span class="label">Mapping</span><span class="value">${mappingLabel}</span></div>`;

    if (data.fingerCurls) {
      const mapping = DRUM_MAPPINGS[currentDrumMapping]?.map || DRUM_MAPPINGS.default.map;
      for (const finger of DRUM_FINGERS) {
        const curl = data.fingerCurls[finger];
        const pct = Math.round(curl * 100);
        const isTriggered = curl > DRUM_CURL_THRESHOLD;
        const emoji = fingerEmojis[finger];
        const soundName = mapping[finger];
        const displaySound = soundName
          .replace(/^hihatClosed$/, "HH Closed")
          .replace(/^hihatOpen$/, "HH Open")
          .replace(/^(.)/, (_, c) => c.toUpperCase());
        const velocity = curlToVelocity(curl);

        html += `
          <div class="info-row drum-curl-row ${isTriggered ? "drum-triggered" : ""}">
            <span class="label">${emoji} ${finger}</span>
            <span class="value drum-curl-bar-container">
              <span class="drum-curl-bar" style="width:${pct}%; background:${isTriggered ? "#FF4466" : "#00FF88"}"></span>
              <span class="drum-curl-pct">${displaySound} ${pct}% <span class="drum-velocity">vel:${velocity}</span></span>
            </span>
          </div>
        `;
      }
    }

    if (data.gesture) {
      const displayName =
        gestureNameMap[data.gesture.name] || data.gesture.name.replace(/_/g, " ");
      html += `
        <div class="info-row gesture-row">
          <span class="label">Gesture</span>
          <span class="value gesture-value">${displayName}</span>
        </div>
      `;
    }
  } else if (currentInstrument === "fxpad") {
    // FX Pad mode: show X/Y pad and effect parameter grid
    html = `<div class="info-section-title">🎚️ FX Pad</div>`;

    // X/Y Pad canvas container
    html += `
      <div class="fx-pad-container">
        <div class="fx-pad-canvas-wrap">
          <canvas id="fx-pad-canvas"></canvas>
          <span class="fx-axis-label x-label">${getFxLabel(fxXParam)}</span>
          <span class="fx-axis-label y-label">${getFxLabel(fxYParam)}</span>
        </div>
      </div>
    `;

    // Effect parameter grid
    html += `<div class="fx-params-grid">`;
    const fxParams = [
      { key: "reverbMix", label: "Reverb Mix", active: fxXParam === "reverbMix" || fxYParam === "reverbMix" },

      { key: "delayTime", label: "Delay Time", active: fxXParam === "delayTime" || fxYParam === "delayTime" },
      { key: "delayFeedback", label: "Delay Fdbk", active: fxXParam === "delayFeedback" || fxYParam === "delayFeedback" },
      { key: "filterFreq", label: "Filter Freq", active: fxXParam === "filterFreq" || fxYParam === "filterFreq" },
      { key: "filterRes", label: "Filter Res", active: fxXParam === "filterRes" || fxYParam === "filterRes" },
      { key: "distortion", label: "Distortion", active: fxXParam === "distortion" || fxYParam === "distortion" },
    ];
    for (const p of fxParams) {
      const val = lastFxValues[p.key] ?? "—";
      const isX = fxXParam === p.key;
      const isY = fxYParam === p.key;
      const activeClass = isX ? "x-active" : isY ? "y-active" : "neutral";
      const marker = isX ? " [X]" : isY ? " [Y]" : "";
      html += `
        <div class="fx-param-item">
          <span class="fx-param-label">${p.label}${marker}</span>
          <span class="fx-param-value ${activeClass}">${val}</span>
        </div>
      `;
    }
    html += `</div>`;

    // Volume/Filter/Openness info
    html += `
      <div class="info-row"><span class="label">Volume</span><span class="value">${Math.round((1 - data.smoothedY) * 100)}%</span></div>
      <div class="info-row"><span class="label">Filter</span><span class="value">${Math.round(data.smoothedX * 100)}%</span></div>
      <div class="info-row"><span class="label">Openness</span><span class="value">${Math.round(data.openness * 100)}%</span></div>
    `;

  } else {
    // Normal mode: show note/volume/filter/scale/BPM
    const scaleNames = {
      pentatonic: "Pentatonic",
      major: "Major",
      minor: "Minor",
      chromatic: "Chromatic",
      blues: "Blues",
    };
    const bpm = Math.round(Tone.Transport.bpm.value);
    const quantLabels = { off: "Off", "1m": "1 bar", "2n": "1/2", "4n": "1/4", "8n": "1/8", "16n": "1/16" };

    // Loop station status
    let loopHtml = "";
    if (loopStation) {
      const ls = loopStation.getState();
      const recIcon = ls.recording ? '<span class="loop-rec-dot">🔴</span>' : "";
      const layersText = ls.loopCount > 0 ? `${ls.loopCount} layer${ls.loopCount > 1 ? "s" : ""}` : "none";
      loopHtml = `
        <div class="info-row loop-row">
          <span class="label">${recIcon} Loops</span>
          <span class="value loop-value ${ls.recording ? "loop-recording" : ""}">
            ${layersText}${ls.recording ? " <span class=\"rec-badge\">REC</span>" : ""}
          </span>
        </div>
      `;
    }

    html = `
      <div class="info-row"><span class="label">Note</span><span class="value">${data.currentNote}</span></div>
      <div class="info-row"><span class="label">Scale</span><span class="value scale-value">${scaleNames[currentScale] || "Pentatonic"}</span></div>
      <div class="info-row"><span class="label">BPM</span><span class="value bpm-value">${bpm} ${isMetronomeOn ? "🎵" : ""}</span></div>
      <div class="info-row"><span class="label">Quantize</span><span class="value">${quantLabels[currentQuantize] || "Off"}</span></div>
      <div class="info-row"><span class="label">Arpeggiator</span><span class="value arp-value">${ARP_LABELS[arpeggiatorPattern] || "Up"}${isArpeggiatorOn ? '<span class="arp-active-indicator">ON</span>' : ''}</span></div>
      ${loopHtml}
      <div class="info-row"><span class="label">Volume</span><span class="value">${Math.round((1 - data.smoothedY) * 100)}%</span></div>
      <div class="info-row"><span class="label">Filter</span><span class="value">${Math.round(data.smoothedX * 100)}%</span></div>
      <div class="info-row"><span class="label">Openness</span><span class="value">${Math.round(data.openness * 100)}%</span></div>
    `;

    if (data.gesture) {
      const displayName =
        gestureNameMap[data.gesture.name] || data.gesture.name.replace(/_/g, " ");
      html += `
        <div class="info-row gesture-row">
          <span class="label">Gesture</span>
          <span class="value gesture-value">${displayName}</span>
        </div>
      `;
    }
  }

  // Volume meter bar (shown in all modes when audio is ready)
  if (isAudioReady) {
    const volPct = Math.min(100, Math.round(currentVolume * 100));
    let volColor;
    if (volPct < 40) volColor = "var(--accent-green)";
    else if (volPct < 70) volColor = "var(--accent-yellow)";
    else volColor = "var(--accent-red)";

    html += `
      <div class="info-row volume-meter-row">
        <span class="label">🔊 Level</span>
        <span class="value volume-meter-container">
          <span class="volume-meter-bar" style="width:${volPct}%; background:${volColor};"></span>
          <span class="volume-meter-pct" style="color:${volColor};">${volPct}%</span>
        </span>
      </div>
    `;
  }

  for (let i = 0; i < data.hands.length; i++) {
    const hand = data.hands[i];
    html += `
      <div class="info-row hand-info ${hand.handedness.toLowerCase()}">
        <span class="label">${hand.handedness} Hand</span>
        <span class="value">X:${Math.round(hand.palmX * 100)} Y:${Math.round(hand.palmY * 100)}</span>
      </div>
    `;
  }

  infoPanel.innerHTML = html;

  // Render X/Y pad canvas for fxpad mode
  if (currentInstrument === "fxpad") {
    renderFxPadCanvas();
  }

  // Update drum guide items to show triggered state
  if (currentInstrument === "drumkit" && data.fingerCurls) {
    for (const finger of DRUM_FINGERS) {
      const curl = data.fingerCurls[finger];
      const isTriggered = curl > DRUM_CURL_THRESHOLD;
      const item = document.querySelector(`.drum-item[data-finger="${finger}"]`);
      if (item) {
        item.classList.toggle("drum-item-active", isTriggered);
        if (isTriggered) {
          item.classList.add("drum-item-hit");
          setTimeout(() => item.classList.remove("drum-item-hit"), 150);
        }
      }
    }
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────

function cleanup() {
  // Stop metronome
  if (metronomeEventId !== null) {
    Tone.Transport.clear(metronomeEventId);
    metronomeEventId = null;
  }
  if (metronomeSynth) {
    metronomeSynth.dispose();
    metronomeSynth = null;
  }

  // Stop arpeggiator
  stopArpeggiator();

  // Stop AI Melody
  stopAiMelodyScheduler();
  isAiMelodyOn = false;

  // Clean up loop station  // Clean up loop station
  if (loopStation) {
    loopStation.cleanup();
    loopStation = null;
  }

  if (healthStallCheckId) {
    clearInterval(healthStallCheckId);
    healthStallCheckId = null;
  }

  if (handTracker) {
    handTracker.stop();
    handTracker.close();
    handTracker = null;
  }
  disposeSynth();
  currentEffects.forEach((fx) => fx.dispose());
  currentEffects = [];

  // Dispose all layers
  disposeLayers();

  // Stop drone
  stopDrone();

  if (volumeAnalyser) {
    Tone.getDestination().disconnect(volumeAnalyser);
    volumeAnalyser.dispose();
    volumeAnalyser = null;
  }
  if (visualizer) {
    visualizer.stop();
    visualizer = null;
  }
  stopWebcam();

  // Stop Transport
  Tone.Transport.stop();
}

// ─── Instrument Layers System ────────────────────────────────────────────

/**
 * Creates a new instrument layer of the given type and routes it to destination.
 * Returns the layer object { id, type, synth, effects, volumeNode, volume }.
 */
function createLayer(type) {
  if (instrumentLayers.length >= MAX_LAYERS) {
    showToast(`Max ${MAX_LAYERS} layers reached`, "error");
    return null;
  }
  const id = ++layerIdCounter;
  const volumeNode = new Tone.Volume(-6); // default -6dB for layers
  volumeNode.toDestination();

  // Build a simplified synth per type
  let layerSynth = null;
  let layerEffects = [];

  switch (type) {
    case "theremin": {
      const rev = new Tone.Reverb({ decay: 2, wet: 0.25 });
      layerSynth = new Tone.MonoSynth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 1.5 },
      });
      layerSynth.chain(rev, volumeNode);
      layerEffects = [rev];
      break;
    }
    case "kaoss": {
      const freeverb = new Tone.Freeverb({ roomSize: 0.5, wet: 0.25 });
      layerSynth = new Tone.FMSynth({ harmonicity: 1.5, modulationIndex: 2 });
      layerSynth.chain(freeverb, volumeNode);
      layerEffects = [freeverb];
      break;
    }
    case "fxpad": {
      const rev = new Tone.Reverb({ decay: 3, wet: 0.35 });
      layerSynth = new Tone.FMSynth({ harmonicity: 0.5, modulationIndex: 0.5 });
      layerSynth.chain(rev, volumeNode);
      layerSynth.triggerAttack("C3");
      layerEffects = [rev];
      break;
    }
    default: {
      layerSynth = new Tone.Synth();
      layerSynth.connect(volumeNode);
    }
  }

  const layer = { id, type, synth: layerSynth, effects: layerEffects, volumeNode, volume: -6 };
  instrumentLayers.push(layer);
  renderLayerStack();
  return layer;
}

/** Dispose and remove a specific layer by id. */
function removeLayer(id) {
  const idx = instrumentLayers.findIndex((l) => l.id === id);
  if (idx === -1) return;
  const layer = instrumentLayers[idx];
  // Stop any playing note
  if (layer.synth && layer.synth.triggerRelease) {
    try { layer.synth.triggerRelease(); } catch(e) {}
  }
  // Dispose
  if (layer.synth) {
    if (typeof layer.synth.dispose === "function") layer.synth.dispose();
  }
  layer.effects.forEach((fx) => { try { fx.dispose(); } catch(e) {} });
  layer.volumeNode.dispose();
  instrumentLayers.splice(idx, 1);
  renderLayerStack();
}

/** Dispose all layers (called on cleanup). */
function disposeLayers() {
  while (instrumentLayers.length > 0) {
    removeLayer(instrumentLayers[0].id);
  }
}

/** Feed a note event to all active layers. */
function updateLayerAudio(data) {
  if (!isAudioReady || instrumentLayers.length === 0) return;
  const { currentNote, smoothedY, hasHand } = data;
  const gain = Math.max(1 - smoothedY * 0.9, 0.05);

  for (const layer of instrumentLayers) {
    if (!layer.synth) continue;
    try {
      if (!hasHand) {
        if (layer.synth.triggerRelease) layer.synth.triggerRelease();
        layer._prevNote = null;
        continue;
      }
      // For melodic layers: trigger note on change
      if (layer.type !== "drumkit" && layer.synth.triggerAttack && layer.synth.triggerRelease) {
        if (currentNote !== layer._prevNote) {
          layer.synth.triggerRelease();
          layer.synth.triggerAttack(currentNote, undefined, gain * 0.7);
          layer._prevNote = currentNote;
        }
        // Update volume
        if (layer.volumeNode) {
          layer.volumeNode.volume.rampTo(Tone.gainToDb(gain * 0.7), 0.05);
        }
      }
    } catch (e) { /* ignore transient errors on layer audio */ }
  }
}

/** Render the layer stack UI in the sidebar. */
const INSTRUMENT_ICONS = {
  theremin: "🎹",
  drumkit:  "🥁",
  kaoss:    "🎛️",
  fxpad:    "🎚️",
};

const INSTRUMENT_NAMES = {
  theremin: "Theremin",
  drumkit:  "Drums",
  kaoss:    "Kaoss Pad",
  fxpad:    "FX Pad",
};

function renderLayerStack() {
  if (!layerStack) return;

  if (instrumentLayers.length === 0) {
    layerStack.innerHTML = `<div class="layer-empty" id="layer-empty-msg"><span>No layers — main instrument playing</span></div>`;
    return;
  }

  layerStack.innerHTML = "";
  for (const layer of instrumentLayers) {
    const card = document.createElement("div");
    card.className = "layer-card";
    card.dataset.layerId = layer.id;
    card.innerHTML = `
      <span class="layer-icon">${INSTRUMENT_ICONS[layer.type] || "🎵"}</span>
      <span class="layer-name">${INSTRUMENT_NAMES[layer.type] || layer.type}</span>
      <input type="range" class="layer-volume" min="-30" max="0" value="${layer.volume}" step="1" title="Layer volume" />
      <button class="layer-remove" title="Remove layer">✕</button>
    `;

    // Volume slider
    const slider = card.querySelector(".layer-volume");
    slider.addEventListener("input", (e) => {
      layer.volume = parseInt(e.target.value);
      if (layer.volumeNode) {
        layer.volumeNode.volume.rampTo(layer.volume, 0.05);
      }
    });

    // Remove button
    const removeBtn = card.querySelector(".layer-remove");
    removeBtn.addEventListener("click", () => {
      removeLayer(layer.id);
      showToast(`Removed ${INSTRUMENT_NAMES[layer.type]} layer`);
    });

    layerStack.appendChild(card);
  }
}

// ─── Chord Mode ─────────────────────────────────────────────────────────

/**
 * Given a root note name (e.g. "C4"), build a chord based on current scale.
 * gesture controls voicing: open = major triad, fist = minor, peace = suspended
 */
function buildChord(rootNote, gestureData) {
  // Parse note name and octave (e.g. "C4" → ["C", 4])
  const match = rootNote.match(/^([A-G]#?)([0-9])$/);
  if (!match) return [rootNote];
  const noteName = match[1];
  const octave = parseInt(match[2]);
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const rootIdx = noteNames.indexOf(noteName);
  if (rootIdx === -1) return [rootNote];

  // Gesture → chord voicing intervals in semitones
  const gestureName = gestureData?.gesture?.name || "";
  let intervals;
  if (gestureName === "Victory") {
    intervals = [0, 5, 7];    // Suspended 4th
  } else if (gestureName === "Closed_Fist") {
    intervals = [0, 3, 7];    // Minor triad
  } else {
    intervals = [0, 4, 7];    // Major triad (default)
  }

  return intervals.map((semitones) => {
    const newIdx = (rootIdx + semitones) % 12;
    const newOctave = octave + Math.floor((rootIdx + semitones) / 12);
    return `${noteNames[newIdx]}${newOctave}`;
  });
}

/** Toggle chord mode on/off. Returns new state. */
function toggleChordMode() {
  isChordModeOn = !isChordModeOn;
  if (!isChordModeOn) {
    // Release any held chord notes
    if (synth && synth.triggerRelease) {
      try { synth.triggerRelease(); } catch(e) {}
    }
    previousChordNotes = [];
    previousNote = null;
  }
  return isChordModeOn;
}

// ─── Ambient Drone Mode ──────────────────────────────────────────────────

/** Start the ambient drone. Creates a pad synth that sustains and evolves slowly. */
function startDrone() {
  if (droneSynth) stopDrone();

  const droneRev = new Tone.Reverb({ decay: 8, wet: 0.7 });
  const droneChor = new Tone.Chorus({ frequency: 0.2, delayTime: 3.5, depth: 0.6 });
  const droneFilter = new Tone.Filter(300, "lowpass");
  const droneGain = new Tone.Volume(-18);

  droneSynth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 0.5,
    modulationIndex: 1,
    envelope: { attack: 3, decay: 4, sustain: 0.5, release: 6 },
    oscillator: { type: "sine" },
  });

  droneSynth.chain(droneFilter, droneChor, droneRev, droneGain, Tone.Destination);
  droneEffects = [droneFilter, droneChor, droneRev, droneGain];

  // Play a gentle pad chord
  droneNote = "C2";
  const droneChord = ["C2", "G2", "E3"];
  droneSynth.triggerAttack(droneChord);

  // Slowly evolve filter frequency
  droneSynth._droneFilterInterval = setInterval(() => {
    if (!droneFilter || !isDroneOn) return;
    const f = 200 + Math.sin(Date.now() / 8000) * 150;
    droneFilter.frequency.rampTo(f, 4);
  }, 4000);
}

/** Stop and dispose the ambient drone. */
function stopDrone() {
  if (droneSynth) {
    if (droneSynth._droneFilterInterval) {
      clearInterval(droneSynth._droneFilterInterval);
    }
    try { droneSynth.releaseAll(); } catch (e) {}
    setTimeout(() => {
      try { droneSynth.dispose(); } catch (e) {}
      droneEffects.forEach((fx) => { try { fx.dispose(); } catch(e) {} });
      droneEffects = [];
    }, 200);
    droneSynth = null;
  }
}

/** Toggle drone. Returns new state. */
function toggleDrone() {
  isDroneOn = !isDroneOn;
  if (isDroneOn) {
    if (isAudioReady) startDrone();
  } else {
    stopDrone();
  }
  return isDroneOn;
}

// ─── Theme Switcher ──────────────────────────────────────────────────────

const THEME_NAMES = { dark: "Dark", neon: "Neon", warm: "Warm" };

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });
  localStorage.setItem("gms_theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("gms_theme") || "dark";
  applyTheme(saved);
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.theme);
      showToast(`${THEME_NAMES[btn.dataset.theme]} theme applied`);
    });
  });
}

// ─── Personal Greeting ───────────────────────────────────────────────────

function updateGreeting() {
  const greetingEl = document.getElementById("greeting-text");
  if (!greetingEl) return;
  const hour = new Date().getHours();
  let timeGreeting;
  if (hour < 6)       timeGreeting = "Good night";
  else if (hour < 12) timeGreeting = "Good morning";
  else if (hour < 17) timeGreeting = "Good afternoon";
  else if (hour < 21) timeGreeting = "Good evening";
  else                timeGreeting = "Good night";
  greetingEl.textContent = `${timeGreeting}, Jayesh`;
}

// ─── Sidebar Nav Update ──────────────────────────────────────────────────

const STAGE_DESCRIPTIONS = {
  theremin: "Move hand up/down for pitch · left/right for filter · openness for reverb",
  drumkit:  "Curl each finger to trigger kick, snare, hi-hat, clap · fist for drum fill",
  kaoss:    "X controls modulation · Y controls volume · open/close for expression",
  fxpad:    "X and Y axes control chosen effect parameters on a sustained drone",
};

/** Update sidebar nav highlighting and stage header text. */
function updateInstrumentUI(instrument) {
  // Update nav buttons
  document.querySelectorAll(".instrument-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.instrument === instrument);
  });
  // Update stage header
  if (stageInstrumentName) {
    stageInstrumentName.textContent = INSTRUMENT_NAMES[instrument] || instrument;
  }
  if (stageInstrumentDesc) {
    stageInstrumentDesc.textContent = STAGE_DESCRIPTIONS[instrument] || "";
  }
  // Show/hide right-panel sections
  const isDrum = instrument === "drumkit";
  const isFx   = instrument === "fxpad";
  if (scaleRow)        scaleRow.style.display      = (isDrum || isFx) ? "none" : "flex";
  if (chordRow)        chordRow.style.display      = (isDrum || isFx) ? "none" : "flex";
  if (drumMappingRow)  drumMappingRow.style.display = isDrum ? "flex" : "none";
  if (fxAxisControls)  fxAxisControls.style.display = isFx  ? "block" : "none";
  if (arpSection)      arpSection.style.display     = isDrum ? "none" : "block";
  if (aiRow)           aiRow.style.display          = isDrum ? "none" : "flex";
  // Show gesture guides
  const gTheremin = document.getElementById("gesture-guide-theremin");
  const gDrum     = document.getElementById("gesture-guide-drum");
  const gFxpad    = document.getElementById("gesture-guide-fxpad");
  if (gTheremin) gTheremin.style.display = (!isDrum && !isFx) ? "block" : "none";
  if (gDrum)     gDrum.style.display     = isDrum ? "block" : "none";
  if (gFxpad)    gFxpad.style.display    = isFx   ? "block" : "none";
}

// Track previous MIDI/AI notes
let previousMidiNote = null;
let previousAiNote = null;

// ─── AI Melody Scheduling ────────────────────────────────────────────────

/** Start the AI melody playback schedule */
function startAiMelodyScheduler() {
  stopAiMelodyScheduler();
  if (!isAiMelodyOn || !synth) return;

  aiMelodyEventId = Tone.Transport.scheduleRepeat((time) => {
    if (!isAiMelodyOn || !synth || aiMelodyNotes.length === 0) return;

    const idx = aiMelodyIndex % aiMelodyNotes.length;
    const aiNote = aiMelodyNotes[idx];
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const octave = 4 + Math.floor(aiNote.pitch / 12);
    const noteIndex = aiNote.pitch % 12;
    const aiNoteName = `${noteNames[noteIndex]}${octave}`;
    const duration = Math.max(aiNote.duration * 0.8, 0.05);

    if (synth.triggerAttackRelease) {
      synth.triggerAttackRelease(aiNoteName, `+${duration}`, time, 0.5);
    }
    aiMelodyIndex++;
  }, "4n");
}

function stopAiMelodyScheduler() {
  if (aiMelodyEventId !== null) {
    Tone.Transport.clear(aiMelodyEventId);
    aiMelodyEventId = null;
  }
  aiMelodyIndex = 0;
}

/** Toggle AI melody on/off */
async function toggleAiMelody() {
  isAiMelodyOn = !isAiMelodyOn;
  if (isAiMelodyOn) {
    // Try to load Magenta if not already loaded
    const state = getLoadingState();
    if (state === "unloaded" || state === "error") {
      if (aiMelodyStatus) aiMelodyStatus.textContent = "Loading AI model...";
      const loaded = await loadMagenta();
      if (loaded) {
        await initMelodyModel();
      }
    }
    const s = getLoadingState();
    if (aiMelodyStatus) {
      aiMelodyStatus.textContent = s === "ready" ? "AI Ready" : s === "loading" ? "Loading..." : "AI Offline";
    }
    clearMelodyContext();
    startAiMelodyScheduler();
  } else {
    stopAiMelodyScheduler();
    if (aiMelodyStatus) aiMelodyStatus.textContent = "";
  }
}

// ─── Song Guide Renderer ────────────────────────────────────────────────

/** Render the song guide body with song info and step-by-step instructions */
function renderSongGuide(state) {
  if (!songGuideBody) return;
  const { currentSong, currentSection, currentStep, currentStepIndex, totalSteps, totalSections } = state;

  if (!currentSong) {
    songGuideBody.innerHTML = `
      <div class="song-guide-empty">
        <span class="song-guide-empty-icon">🎶</span>
        <p class="song-guide-empty-text">Select a song from the dropdown above to see step-by-step instructions.</p>
      </div>
    `;
    return;
  }

  let html = '';

  // ─── Song Info Card ─────────────────────────────────────────────
  html += `
    <div class="song-guide-card">
      <div class="song-guide-icon">${currentSong.image || '🎵'}</div>
      <div class="song-guide-info">
        <div class="song-guide-song-title">${currentSong.title}</div>
        <div class="song-guide-artist">${currentSong.artist}</div>
        <div class="song-guide-meta">
          <span class="song-guide-meta-tag instrument">🎹 ${currentSong.instrument}</span>
          <span class="song-guide-meta-tag scale">🎼 ${currentSong.scale}</span>
          <span class="song-guide-meta-tag bpm">⏱ ${currentSong.bpm} BPM</span>
          <span class="song-guide-meta-tag difficulty">${currentSong.difficulty}</span>
        </div>
        <div class="song-guide-description">${currentSong.description}</div>
      </div>
    </div>
  `;

  // ─── Current Section ───────────────────────────────────────────
  if (currentSection) {
    html += `<div class="song-guide-section-label">${currentSection.label}</div>`;
    if (currentSection.notes) {
      html += `<div class="song-guide-section-notes">${currentSection.notes}</div>`;
    }

    // ─── Steps List ─────────────────────────────────────────────
    html += `<div class="song-guide-steps">`;
    for (let i = 0; i < currentSection.steps.length; i++) {
      const step = currentSection.steps[i];
      const isActive = i === currentStepIndex;
      const isDone = i < currentStepIndex;
      const typeClass = `step-${step.type || 'play'}`;
      const stateClass = isActive ? 'step-active' : isDone ? 'step-done' : '';

      // Pick icon based on step type
      let icon = '🎵';
      switch (step.type) {
        case 'setup': icon = '⚙️'; break;
        case 'play': icon = '👆'; break;
        case 'rest': icon = '⏸️'; break;
        case 'repeat': icon = '🔁'; break;
        case 'tip': icon = '💡'; break;
        default: icon = '🎵';
      }

      html += `
        <div class="song-guide-step ${stateClass} ${typeClass}">
          <span class="song-guide-step-icon">${isDone ? '✅' : icon}</span>
          <div class="song-guide-step-content">
            <div class="song-guide-step-instruction">${step.instruction}</div>
            <div class="song-guide-step-detail">${step.detail}</div>
          </div>
        </div>
      `;
    }
    html += `</div>`;
  }

  songGuideBody.innerHTML = html;

  // Update step counter
  if (songGuideStepCounter && currentSection) {
    const total = currentSection.steps.length;
    const sectionCount = totalSections > 1 ? ` (Section ${state.currentSectionIndex + 1}/${totalSections})` : '';
    songGuideStepCounter.textContent = `${currentStepIndex + 1}/${total}${sectionCount}`;
  }

  // Scroll the active step into view
  const activeStep = songGuideBody.querySelector('.song-guide-step.step-active');
  if (activeStep) {
    activeStep.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────

async function init() {
  try {
    statusEl.textContent = "Starting webcam...";
    await startWebcam();

    statusEl.textContent = "Loading hand tracking AI model...";
    await initHandTracking();

    statusEl.textContent = "Ready! Show your hand to the camera.";

    // Create initial instrument
    createInstrument(currentInstrument);

    // Setup visualizer
    visualizer = createAudioVisualizer(visualizerCanvas);
    const analyser = getAnalyser();
    visualizer.setAnalyser(analyser);
    visualizer.start();

    // Create volume level analyser (use waveform type and compute RMS)
    volumeAnalyser = new Tone.Analyser("waveform", 256);
    Tone.getDestination().connect(volumeAnalyser);

    // Wire arpeggiator controls
    if (arpToggleBtn) {
      arpToggleBtn.addEventListener("click", () => {
        const on = toggleArpeggiator();
        arpToggleBtn.classList.toggle("active", on);
        arpToggleBtn.textContent = on ? "On" : "Off";
      });
    }
    if (arpPatternSelect) {
      arpPatternSelect.addEventListener("change", (e) => {
        arpeggiatorPattern = e.target.value;
        if (isArpeggiatorOn) startArpeggiator();
      });
    }

    // Wire visual mode buttons
    vizModeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        if (!visualizer || !mode) return;
        visualizer.setMode(mode);
        // Update active button styling
        vizModeBtns.forEach((b) => b.classList.remove("viz-mode-active"));
        btn.classList.add("viz-mode-active");
        // Update hint label
        const labels = {
          spectrum: "3D Spectrum",
          particles: "Particles",
          circular: "Circular",
          heatmap: "Heatmap",
        };
        if (vizModeLabel) vizModeLabel.textContent = `${labels[mode] || mode} • Move your hand to shape the sound`;
      });
    });

    // Initialize loop station
    loopStation = createLoopStation();
    loopStation.setOnStateChange((state) => {
      // Update loop station DOM
      if (loopLayerCountDisplay) {
        loopLayerCountDisplay.textContent = `${state.loopCount} active loop${state.loopCount !== 1 ? "s" : ""}`;
      }
      if (loopRecIndicatorDisplay) {
        loopRecIndicatorDisplay.style.display = state.recording ? "block" : "none";
      }
      
      // Update buttons
      if (btnLoopRecord) {
        btnLoopRecord.disabled = state.recording;
        btnLoopRecord.style.opacity = state.recording ? "0.5" : "1";
      }
      if (btnLoopStop) {
        btnLoopStop.disabled = !state.recording;
      }
      if (btnLoopClear) {
        btnLoopClear.disabled = state.loopCount === 0;
      }
      if (btnLoopPlay) {
        btnLoopPlay.disabled = state.loopCount === 0;
        btnLoopPlay.innerHTML = state.state === "playing" ? "⏸ Pause" : "▶️ Play";
      }
    });
    
    // Wire Looper buttons
    if (btnLoopRecord) btnLoopRecord.addEventListener("click", () => loopStation && loopStation.startRecording());
    if (btnLoopStop) btnLoopStop.addEventListener("click", () => loopStation && loopStation.stopRecording());
    if (btnLoopClear) btnLoopClear.addEventListener("click", () => loopStation && loopStation.removeLastLayer());
    if (btnLoopPlay) btnLoopPlay.addEventListener("click", () => loopStation && loopStation.toggleAllPlayback());

    // Initialize Transport BPM from slider
    Tone.Transport.bpm.value = parseInt(bpmSlider.value) || 120;

    // ─── Init new features ──────────────────────────────────────────────

    // Personal greeting
    updateGreeting();

    // Theme switcher
    initTheme();

    // Init instrument UI for default instrument
    updateInstrumentUI(currentInstrument);

    // Sidebar instrument nav buttons
    document.querySelectorAll(".instrument-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const inst = btn.dataset.instrument;
        if (!inst) return;
        // Fire change via the hidden select
        instrumentSelect.value = inst;
        instrumentSelect.dispatchEvent(new Event("change"));
      });
    });

    // Add Layer button
    if (addLayerBtn) {
      addLayerBtn.addEventListener("click", () => {
        if (instrumentLayers.length >= MAX_LAYERS) {
          showToast(`Max ${MAX_LAYERS} layers reached`, "error");
          return;
        }
        // Default to adding a kaoss or theremin layer depending on current instrument
        const layerType = currentInstrument === "drumkit" ? "theremin" : currentInstrument;
        const layer = createLayer(layerType);
        if (layer) {
          showToast(`Added ${INSTRUMENT_NAMES[layerType]} layer (${instrumentLayers.length}/${MAX_LAYERS})`);
        }
      });
    }

    // Chord mode toggle
    if (chordModeBtn) {
      chordModeBtn.addEventListener("click", () => {
        const on = toggleChordMode();
        chordModeBtn.classList.toggle("active", on);
        chordModeBtn.textContent = on ? "On" : "Off";
        showToast(on ? "Chord Mode ON — hand gestures control voicing" : "Chord Mode OFF");
      });
    }

    // Drone toggle
    if (droneBtn) {
      droneBtn.addEventListener("click", () => {
        const on = toggleDrone();
        droneBtn.classList.toggle("active", on);
        droneBtn.textContent = on ? "On" : "Off";
        showToast(on ? "Ambient Drone ON — background pad is playing" : "Ambient Drone OFF");
      });
    }

    // Wire preset controls
    refreshPresetList();

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Check URL for shared preset
    const sharedPreset = checkUrlForSharedPreset();
    if (sharedPreset) {
      // Load shared preset after a brief delay to let app initialize
      setTimeout(() => {
        applyPreset(sharedPreset);
        showToast(`📂 Shared preset "${sharedPreset.name || "Shared"}" loaded from URL!`);
      }, 500);
    }
    // Wire MIDI export button
    if (exportMidiBtn) {
      exportMidiBtn.addEventListener("click", () => {
        if (!midiRecorder || midiRecorder.getEventCount() === 0) {
          showToast("ℹ️ No notes recorded yet — start playing first");
          return;
        }
        const events = midiRecorder.stopRecording();
        if (events.length === 0) {
          showToast("ℹ️ No MIDI events to export");
          return;
        }
        const bpm = Math.round(Tone.Transport.bpm.value);
        exportEventsToMidi(events, bpm);
        showToast(`🎵 Exported ${events.length} MIDI events`);
        // Restart recording for continuous capture
        midiRecorder.startRecording(Tone.now());
        isMidiRecording = true;
      });
    }

    // Wire share link button
    if (shareLinkBtn) {
      shareLinkBtn.addEventListener("click", () => {
        const preset = capturePreset({
          name: "Shared",
          instrument: currentInstrument,
          scale: currentScale,
          bpm: Math.round(Tone.Transport.bpm.value),
          quantize: currentQuantize,
          metronome: isMetronomeOn,
          arpOn: isArpeggiatorOn,
          arpPattern: arpeggiatorPattern,
          vizMode: visualizer ? visualizer.getMode() : "spectrum",
          fxXParam,
          fxYParam,
          drumMapping: currentDrumMapping,
        });
        const url = generateShareUrl(preset);
        if (url) {
          copyShareUrlToClipboard(url).then((ok) => {
            if (ok) showToast("🔗 Share URL copied to clipboard!");
            else showToast("❌ Could not copy URL", "error");
          });
        } else {
          showToast("❌ Failed to generate share URL", "error");
        }
      });
    }

    // Wire drum mapping selector
    if (drumMappingSelect) {
      drumMappingSelect.addEventListener("change", (e) => {
        currentDrumMapping = e.target.value;
        showToast(`🥁 Drum mapping: ${DRUM_MAPPINGS[currentDrumMapping]?.label || "Standard"}`);
      });
    }

    // ─── Initialize Song Guide ────────────────────────────────────
    const songGuide = createSongGuide();
    songGuide.setOnUpdate((state) => {
      if (!songGuidePanel) return;
      songGuidePanel.style.display = state.isActive ? "block" : "none";
      if (songGuideFooter) {
        songGuideFooter.style.display = state.currentSong ? "flex" : "none";
      }
      renderSongGuide(state);
    });
    songGuide.setOnClose(() => {
      if (songGuideSelect) songGuideSelect.value = "";
    });

    // Populate song select dropdown
    function populateSongDropdown() {
      if (!songGuideSelect) return;
      songGuideSelect.innerHTML = '';
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = 'Choose a song...';
      songGuideSelect.appendChild(emptyOpt);
      const songs = songGuide.getSongs();
      // Group by genre
      const grouped = {};
      for (const song of songs) {
        if (!grouped[song.genre]) grouped[song.genre] = [];
        grouped[song.genre].push(song);
      }
      for (const [genre, genreSongs] of Object.entries(grouped)) {
        const optGroup = document.createElement('optgroup');
        optGroup.label = genre;
        for (const song of genreSongs) {
          const opt = document.createElement('option');
          opt.value = song.id;
          opt.textContent = `${song.image} ${song.title} — ${song.artist} ${song.difficulty}`;
          optGroup.appendChild(opt);
        }
        songGuideSelect.appendChild(optGroup);
      }
    }
    populateSongDropdown();

    // Wire song guide button
    if (songGuideBtn) {
      songGuideBtn.addEventListener('click', () => {
        // Close tutorial if open
        if (tutorial && tutorial.getIsActive()) {
          tutorial.stop();
        }
        songGuide.open();
        showToast('🎵 Open song guide — choose a song to learn!');
      });
    }

    // Wire tutorial button to close song guide
    if (tutorialBtn) {
      tutorialBtn.addEventListener('click', () => {
        if (songGuide.getState().isActive) {
          songGuide.close();
        }
      });
    }

    // Wire song guide close button
    if (songGuideCloseBtn) {
      songGuideCloseBtn.addEventListener('click', () => {
        songGuide.close();
      });
    }

    // Wire song select
    if (songGuideSelect) {
      songGuideSelect.addEventListener('change', (e) => {
        const songId = e.target.value;
        if (songId) {
          songGuide.selectSong(songId);
        }
      });
    }

    // Wire prev/next buttons
    if (songGuidePrevBtn) {
      songGuidePrevBtn.addEventListener('click', () => {
        songGuide.prevStep();
      });
    }
    if (songGuideNextBtn) {
      songGuideNextBtn.addEventListener('click', () => {
        songGuide.nextStep();
      });
    }

    // Wire apply settings button
    if (songGuideApplyBtn) {
      songGuideApplyBtn.addEventListener('click', () => {
        const state = songGuide.getState();
        if (!state.currentSong) return;
        const settings = songGuide.getSongSettings(state.currentSongId);
        if (settings) {
          // Apply BPM
          if (settings.bpm && bpmSlider) {
            bpmSlider.value = settings.bpm;
            Tone.Transport.bpm.value = settings.bpm;
            if (bpmDisplay) bpmDisplay.textContent = settings.bpm;
          }
          // Apply scale
          if (settings.scale && scaleSelect) {
            scaleSelect.value = settings.scale;
            currentScale = settings.scale;
            if (gestureInterpreter) gestureInterpreter.setScale(settings.scale);
            previousNote = null;
          }
          // Apply instrument
          if (settings.instrument && instrumentSelect) {
            instrumentSelect.value = settings.instrument;
            instrumentSelect.dispatchEvent(new Event('change'));
          }
          showToast(`⚙️ Applied settings: ${settings.bpm} BPM, ${settings.scale} scale, ${settings.instrument}`);
        }
      });
    }

    // Wire AI Melody toggle
    // Initialize tutorial
    tutorial = createTutorial();
    tutorial.setOnUpdate((state) => {
      if (!tutorialPanel) return;
      
      // Update panel visibility
      tutorialPanel.style.display = state.isActive ? "block" : "none";
      
      if (state.isActive && state.exercise) {
        // Update icon
        if (tutorialIcon) tutorialIcon.textContent = state.exercise.icon || "🎯";
        // Update title
        if (tutorialTitle) tutorialTitle.textContent = state.exercise.title;
        // Update description
        if (tutorialDescription) tutorialDescription.textContent = state.exercise.description;
        // Update detail
        if (tutorialDetail) tutorialDetail.textContent = state.exercise.detail;
        // Update progress bar
        const total = state.total || 10;
        const pct = Math.round((state.step / total) * 100);
        if (tutorialProgressFill) tutorialProgressFill.style.width = `${pct}%`;
        // Update step counter
        if (tutorialStepCounter) tutorialStepCounter.textContent = `${state.step + 1}/${total}`;
        // Update hold bar (for exercises requiring hold)
        if (tutorialHoldFill) {
          tutorialHoldFill.style.width = `${state.progress * 100}%`;
        }
      }
    });
    tutorial.setOnComplete(() => {
      showToast("🎉 Tutorial complete! You're ready to make music!");
    });

    // Wire tutorial button
    if (tutorialBtn) {
      tutorialBtn.addEventListener("click", () => {
        if (tutorial && !tutorial.getIsActive()) {
          tutorial.start();
          showToast("📖 Starting tutorial — follow the steps!");
        }
      });
    }

    // Wire tutorial close button
    if (tutorialCloseBtn) {
      tutorialCloseBtn.addEventListener("click", () => {
        if (tutorial) tutorial.stop();
      });
    }

    // Wire tutorial prev/next buttons
    if (tutorialPrevBtn) {
      tutorialPrevBtn.addEventListener("click", () => {
        if (tutorial) tutorial.prevStep();
      });
    }
    if (tutorialSkipBtn) {
      tutorialSkipBtn.addEventListener("click", () => {
        if (tutorial) tutorial.nextStep();
      });
    }

    if (aiMelodyToggle) {
      aiMelodyToggle.addEventListener("click", () => {
        toggleAiMelody();
        aiMelodyToggle.classList.toggle("active", isAiMelodyOn);
        aiMelodyToggle.textContent = isAiMelodyOn ? "On" : "Off";
      });
    }

    if (presetSaveBtn) {
      presetSaveBtn.addEventListener("click", () => {
        const name = prompt("Preset name:", `Preset ${loadPresetList().length + 1}`);
        if (!name) return;
        const preset = capturePreset({
          name,
          instrument: currentInstrument,
          scale: currentScale,
          bpm: Math.round(Tone.Transport.bpm.value),
          quantize: currentQuantize,
          metronome: isMetronomeOn,
          arpOn: isArpeggiatorOn,
          arpPattern: arpeggiatorPattern,
          vizMode: visualizer ? visualizer.getMode() : "spectrum",
          fxXParam,
          fxYParam,
          drumMapping: currentDrumMapping,
        });
        savePreset(preset);
        refreshPresetList();
        showToast(`✅ Preset "${name}" saved!`);
      });
    }
    if (presetLoadSelect) {
      presetLoadSelect.addEventListener("change", (e) => {
        const name = e.target.value;
        if (!name) return;
        const presets = loadPresetList();
        const preset = presets.find((p) => p.name === name);
        if (preset) {
          applyPreset(preset);
          showToast(`📂 Preset "${name}" loaded`);
        }
        e.target.value = "";
      });
    }
    if (presetDeleteBtn) {
      presetDeleteBtn.addEventListener("click", () => {
        const name = presetLoadSelect ? presetLoadSelect.value : "";
        if (!name) {
          // Delete last preset from list
          const presets = loadPresetList();
          if (presets.length === 0) return;
          const last = presets[presets.length - 1];
          if (confirm(`Delete preset "${last.name}"?`)) {
            deletePreset(last.name);
            refreshPresetList();
            showToast(`🗑️ Preset "${last.name}" deleted`);
          }
          return;
        }
        if (confirm(`Delete preset "${name}"?`)) {
          deletePreset(name);
          refreshPresetList();
          showToast(`🗑️ Preset "${name}" deleted`);
        }
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener("click", async () => {
        const recording = isExportRecording();
        if (recording) {
          await toggleAudioExport();
          exportBtn.classList.remove("export-active");
          exportBtn.textContent = "📼";
          showToast("✅ Audio exported as WAV!");
        } else {
          const started = await toggleAudioExport();
          if (started) {
            exportBtn.classList.add("export-active");
            exportBtn.textContent = "⏺️";
            showToast("⏺️ Recording audio... Click again to stop & export");
          } else {
            showToast("❌ Failed to start recording", "error");
          }
        }
      });
    }

    // Wire FX Pad axis selectors
    if (fxXParamSelect) {
      fxXParamSelect.addEventListener("change", (e) => {
        fxXParam = e.target.value;
        // Update gesture guide label
        const guideX = document.getElementById("fx-guide-x");
        if (guideX) guideX.textContent = getFxLabel(fxXParam);
      });
    }
    if (fxYParamSelect) {
      fxYParamSelect.addEventListener("change", (e) => {
        fxYParam = e.target.value;
        // Update gesture guide label
        const guideY = document.getElementById("fx-guide-y");
        if (guideY) guideY.textContent = getFxLabel(fxYParam);
      });
    }

    // Initialize controls visibility
    const isFxpad = currentInstrument === "fxpad";
    const isDrumkit = currentInstrument === "drumkit";
    if (scaleSelect) {
      scaleSelect.style.display = isDrumkit ? "none" : isFxpad ? "none" : "inline-block";
    }
    if (arpToggleBtn) {
      arpToggleBtn.style.display = isDrumkit ? "none" : "inline-block";
    }
    if (arpPatternSelect) {
      arpPatternSelect.style.display = isDrumkit ? "none" : "inline-block";
    }
    if (aiMelodyToggle) {
      aiMelodyToggle.style.display = isDrumkit ? "none" : "inline-block";
    }
    if (aiMelodyStatus) {
      aiMelodyStatus.style.display = isDrumkit ? "none" : "inline-block";
    }
    if (fxAxisControls) {
      fxAxisControls.style.display = isFxpad ? "flex" : "none";
    }
    if (drumMappingSelect) {
      drumMappingSelect.style.display = isDrumkit ? "inline-block" : "none";
      if (drumChip) drumChip.style.display = isDrumkit ? "inline-block" : "none";
    }

    // Start MIDI recording (works without active AudioContext — just captures note events)
    isMidiRecording = true;
    if (midiRecorder) {
      midiRecorder.startRecording();
    }

    // ─── Health Indicator Stall Checker ───────────────────────────
    // Check every 2 seconds if the frame callback has stopped firing
    if (healthStallCheckId) clearInterval(healthStallCheckId);
    healthStallCheckId = setInterval(() => {
      if (!handTracker || !healthIndicator) return;
      const elapsed = performance.now() - healthLastCallbackTime;
      if (elapsed > 3000 && healthLastCallbackTime > 0) {
        // No callback for 3+ seconds — loop likely stalled
        healthIndicator.classList.add("stalled");
        if (healthFps) healthFps.textContent = "STALL";
      }
    }, 2000);

    // Auto-start audio now that everything is ready
    // Browser autoplay policies: getUserMedia counts as a user gesture,
    // so Tone.start() should succeed since the user granted camera access.
    try {
      await Tone.start();
      isAudioReady = true;
      Tone.Transport.start();
      // Start drone if it was toggled before audio was ready
      if (isDroneOn && !droneSynth) startDrone();
      hideStartupOverlay();
      statusEl.textContent = "Move your hand to make music!";
    } catch (audioErr) {
      console.warn("Auto-start audio failed:", audioErr);
      // Fallback: start audio when the first hand is detected or on click
      setupDeferredAudioStart();
    }
  } catch (err) {
    console.error("Init error:", err);
    statusEl.textContent = `❌ ${err.message} — tap to retry`;
    statusEl.className = "status-error";
    // Clean up any partial state before retry
    try { cleanup(); } catch (e) { /* ignore cleanup errors */ }
    // Reload the page on click to get a clean slate
    document.addEventListener("click", () => location.reload(), { once: true });
    // Also update overlay hint in case startup overlay is still visible
    if (startupHint) {
      startupHint.textContent = `❌ ${err.message} — tap screen to retry`;
    }
  }
}

// ─── Auto-Start Audio ────────────────────────────────────────────────────

/** Hide the startup overlay with a fade-out animation */
function hideStartupOverlay() {
  if (!startupOverlay) return;
  startupOverlay.style.opacity = "0";
  startupOverlay.style.pointerEvents = "none";
  setTimeout(() => {
    startupOverlay.style.display = "none";
  }, 500);
}

/**
 * Set up deferred audio start: tries on first hand detection, 
 * falls back to any click on the page.
 */
function setupDeferredAudioStart() {
  // Update overlay hint
  if (startupHint) {
    startupHint.textContent = "👆 Click anywhere or show your hand to start music";
  }
  
  // Set up a flag for audio start
  let audioStarted = false;
  
  // Create a shared function for deferred audio start
  window.__deferredAudioStart = async () => {
    if (audioStarted || isAudioReady) return;
    audioStarted = true;
    try {
      await Tone.start();
      isAudioReady = true;
      Tone.Transport.start();
      hideStartupOverlay();
      statusEl.textContent = "🎵 Move your hand to make music!";
    } catch (err) {
      console.warn("Deferred audio start failed:", err);
      audioStarted = false;
    }
  };
  
  // Allow clicking anywhere to start
  document.addEventListener("click", window.__deferredAudioStart, { once: true });
}

// BPM slider
bpmSlider.addEventListener("input", () => {
  const bpm = parseInt(bpmSlider.value);
  Tone.Transport.bpm.value = bpm;
  if (bpmDisplay) bpmDisplay.textContent = bpm;
});

// Metronome toggle
metronomeBtn.addEventListener("click", () => {
  isMetronomeOn = !isMetronomeOn;
  setupMetronome(isMetronomeOn);
  metronomeBtn.classList.toggle("active", isMetronomeOn);
  metronomeBtn.textContent = isMetronomeOn ? "On" : "Off";
});

// Quantization selector
quantizeSelect.addEventListener("change", (e) => {
  currentQuantize = e.target.value;
});

instrumentSelect.addEventListener("change", (e) => {
  currentInstrument = e.target.value;
  createInstrument(currentInstrument);
  previousNote = null;
  lastGain = -1;
  lastFilter = -1;
  lastWet = -1;

  // Show/hide controls based on mode
  const isDrumkit = currentInstrument === "drumkit";
  const isFxpad = currentInstrument === "fxpad";
  if (scaleSelect) {
    scaleSelect.style.display = isDrumkit ? "none" : isFxpad ? "none" : "inline-block";
  }
  if (arpToggleBtn) {
    arpToggleBtn.style.display = isDrumkit ? "none" : "inline-block";
  }
  if (arpPatternSelect) {
    arpPatternSelect.style.display = isDrumkit ? "none" : "inline-block";
  }
  if (aiMelodyToggle) {
    aiMelodyToggle.style.display = isDrumkit ? "none" : "inline-block";
  }
  if (aiMelodyStatus) {
    aiMelodyStatus.style.display = isDrumkit ? "none" : "inline-block";
  }
  if (fxAxisControls) {
    fxAxisControls.style.display = isFxpad ? "flex" : "none";
  }
  if (drumMappingSelect) {
    drumMappingSelect.style.display = isDrumkit ? "inline-block" : "none";
    if (drumChip) drumChip.style.display = isDrumkit ? "inline-block" : "none";
  }

  // Auto-stop arpeggiator when switching to drumkit (drum synth doesn't support it)
  if (isDrumkit && isArpeggiatorOn) {
    toggleArpeggiator();
    if (arpToggleBtn) {
      arpToggleBtn.classList.remove("active");
      arpToggleBtn.textContent = "Off";
    }
  }

  // Auto-stop AI melody when switching to drumkit
  if (isDrumkit && isAiMelodyOn && aiMelodyToggle) {
    aiMelodyToggle.click();
  }

  // Update sidebar nav + stage header
  updateInstrumentUI(currentInstrument);
});

// Scale selector event
scaleSelect.addEventListener("change", (e) => {
  currentScale = e.target.value;
  if (gestureInterpreter) {
    gestureInterpreter.setScale(currentScale);
  }
  // Retrigger note with new scale on next frame
  previousNote = null;
});

// Cleanup on page unload
window.addEventListener("beforeunload", cleanup);

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────

const QUANTIZE_OPTIONS = ["off", "1m", "2n", "4n", "8n", "16n"];
const VIZ_MODES = ["spectrum", "particles", "circular", "heatmap"];
const SCALE_OPTIONS = ["pentatonic", "major", "minor", "blues", "chromatic"];

function selectInstrumentByKey(value) {
  if (instrumentSelect && instrumentSelect.value !== value) {
    instrumentSelect.value = value;
    instrumentSelect.dispatchEvent(new Event("change"));
  }
}

function adjustBpm(delta) {
  const current = Math.round(Tone.Transport.bpm.value);
  const newBpm = Math.min(200, Math.max(40, current + delta));
  Tone.Transport.bpm.value = newBpm;
  if (bpmSlider) bpmSlider.value = newBpm;
  if (bpmDisplay) bpmDisplay.textContent = newBpm;
}

function cycleQuantize() {
  const idx = QUANTIZE_OPTIONS.indexOf(currentQuantize);
  const next = QUANTIZE_OPTIONS[(idx + 1) % QUANTIZE_OPTIONS.length];
  currentQuantize = next;
  if (quantizeSelect) quantizeSelect.value = next;
  showToast(`🔁 Quantize: ${next === "off" ? "Off" : next}`);
}

function cycleVisualizerMode() {
  if (!visualizer) return;
  const currentMode = visualizer.getMode();
  const idx = VIZ_MODES.indexOf(currentMode);
  const nextMode = VIZ_MODES[(idx + 1) % VIZ_MODES.length];
  visualizer.setMode(nextMode);
  vizModeBtns.forEach((b) => {
    b.classList.toggle("viz-mode-active", b.dataset.mode === nextMode);
  });
  const labels = { spectrum: "3D Spectrum", particles: "Particles", circular: "Circular", heatmap: "Heatmap" };
  if (vizModeLabel) vizModeLabel.textContent = `${labels[nextMode] || nextMode} • Move your hand to shape the sound`;
  showToast(`🎨 Visualizer: ${labels[nextMode] || nextMode}`);
}

function cycleScale() {
  const idx = SCALE_OPTIONS.indexOf(currentScale);
  const nextScale = SCALE_OPTIONS[(idx + 1) % SCALE_OPTIONS.length];
  currentScale = nextScale;
  if (scaleSelect) scaleSelect.value = nextScale;
  if (gestureInterpreter) gestureInterpreter.setScale(nextScale);
  previousNote = null;
  const scaleNames = { pentatonic: "Pentatonic", major: "Major", minor: "Minor", blues: "Blues", chromatic: "Chromatic" };
  showToast(`🎼 Scale: ${scaleNames[nextScale] || nextScale}`);
}

function cycleDrumMapping() {
  if (currentInstrument !== "drumkit") return;
  const keys = Object.keys(DRUM_MAPPINGS);
  const idx = keys.indexOf(currentDrumMapping);
  const nextMap = keys[(idx + 1) % keys.length];
  currentDrumMapping = nextMap;
  if (drumMappingSelect) drumMappingSelect.value = nextMap;
  showToast(`🥁 Drum mapping: ${DRUM_MAPPINGS[nextMap]?.label || "Standard"}`);
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Don't intercept when user is focused on a form control or button
    // (buttons already respond to Space/Enter natively)
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") return;

    const key = e.key.toLowerCase();
    // Prevent default for recognized shortcuts to avoid browser side-effects
    switch (key) {
      case "1": selectInstrumentByKey("theremin"); break;
      case "2": selectInstrumentByKey("drumkit"); break;
      case "3": selectInstrumentByKey("kaoss"); break;
      case "4": selectInstrumentByKey("fxpad"); break;
      case "m": metronomeBtn?.click(); break;
      case "a": arpToggleBtn?.click(); break;
      case "+": case "=": adjustBpm(5); break;
      case "-": case "_": adjustBpm(-5); break;
      case "q": cycleQuantize(); break;
      case "v": cycleVisualizerMode(); break;
      case "t": tutorialBtn?.click(); break;
      case "g": songGuideBtn?.click(); break;
      case "s": cycleScale(); break;
      case "r": cycleDrumMapping(); break;
      default: return; // Don't preventDefault for unrecognized keys
    }
    e.preventDefault();
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────

init().catch(console.error);
