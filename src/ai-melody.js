/**
 * ai-melody.js
 * AI Melody Generator using Magenta.js MusicRNN.
 * Provides melody continuation based on hand gesture input.
 *
 * Architecture:
 *   Magenta.js is loaded dynamically from CDN to avoid npm dependency issues.
 *   Once loaded, the MusicRNN model generates melody continuations
 *   that are played through the current Tone.js synth.
 */

// ─── CDN Script URLs ────────────────────────────────────────────────────

const MAGENTA_CDN = "https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/dist/magentamusic.js";
const TENSORFLOW_CDN = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js";

const MODEL_CHECKPOINT =
  "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn";

// ─── Module State ───────────────────────────────────────────────────────

let mm = null;            // Magenta.js module reference
let model = null;          // MusicRNN model instance
let isLoaded = false;
let isLoading = false;
let loadPromise = null;
let loadError = null;

// Current melodic context for continuation
let currentMelody = [];
let maxMelodyNotes = 20;
let lastGenerationTime = 0;
const GENERATION_COOLDOWN = 2000; // ms between AI generations

// Callback for when a new melody is generated
let onMelodyGenerated = null;

// ─── Script Loading ──────────────────────────────────────────────────────

/**
 * Load TensorFlow.js then Magenta.js from CDN.
 * @returns {Promise<boolean>} true if loaded successfully
 */
export async function loadMagenta() {
  if (isLoaded) return true;
  if (isLoading) return loadPromise;
  isLoading = true;

  loadPromise = (async () => {
    try {
      // Step 1: Load TensorFlow.js
      await loadScript(TENSORFLOW_CDN, "tf");

      // Step 2: Load Magenta.js
      await loadScript(MAGENTA_CDN, "mm");

      // Step 3: Get references
      mm = window.mm;
      if (!mm) {
        // Try dynamic import as fallback
        mm = await import(MAGENTA_CDN);
      }

      isLoaded = true;
      isLoading = false;
      return true;
    } catch (err) {
      loadError = err;
      isLoading = false;
      console.error("AI Melody: Failed to load Magenta.js", err);
      return false;
    }
  })();

  return loadPromise;
}

/**
 * Dynamically load a script tag.
 */
function loadScript(url, globalVar) {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window[globalVar]) {
      resolve();
      return;
    }

    // Check if script tag already exists
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      // Wait for it to load
      const check = () => {
        if (window[globalVar]) resolve();
        else setTimeout(check, 100);
      };
      check();
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      // Give a frame for the script to initialize
      setTimeout(() => {
        if (window[globalVar]) resolve();
        else reject(new Error(`${globalVar} not found after script load`));
      }, 100);
    };
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(script);
  });
}

// ─── Model Initialization ───────────────────────────────────────────────

/**
 * Initialize the MusicRNN model for melody continuation.
 * Must call loadMagenta() first.
 * @returns {Promise<boolean>}
 */
export async function initMelodyModel() {
  if (model) return true;
  if (!isLoaded) {
    const loaded = await loadMagenta();
    if (!loaded) return false;
  }

  try {
    // Use the global mm if available, otherwise use imported module
    const magenta = window.mm || mm;
    if (!magenta) {
      console.error("AI Melody: Magenta.js not available");
      return false;
    }

    model = new magenta.MusicRNN(MODEL_CHECKPOINT);
    await model.initialize();
    console.log("AI Melody: MusicRNN model loaded");
    return true;
  } catch (err) {
    console.error("AI Melody: Model init failed", err);
    loadError = err;
    return false;
  }
}

// ─── Melody Management ──────────────────────────────────────────────────

/**
 * Add a note to the current melodic context.
 * @param {string} noteName - e.g. "C4"
 * @param {number} duration - Duration in beats
 */
export function addNoteToContext(noteName, duration = 0.5) {
  const pitch = noteNameToMidiPitch(noteName);
  currentMelody.push({ pitch, duration });

  // Keep only the most recent notes
  if (currentMelody.length > maxMelodyNotes) {
    currentMelody = currentMelody.slice(-maxMelodyNotes);
  }
}

/**
 * Clear the melodic context.
 */
export function clearMelodyContext() {
  currentMelody = [];
}

/**
 * Get the current melodic context as a NoteSequence for Magenta.
 */
function buildNoteSequence() {
  let currentTime = 0;
  const notes = currentMelody.map((n) => {
    const note = {
      pitch: n.pitch,
      startTime: currentTime,
      endTime: currentTime + n.duration,
      velocity: 80,
    };
    currentTime += n.duration;
    return note;
  });

  return {
    notes,
    totalTime: currentTime || 1,
    tempos: [{ qpm: 120, time: 0 }],
    timeSignatures: [{ numerator: 4, denominator: 4, time: 0 }],
  };
}

// ─── Generation ─────────────────────────────────────────────────────────

/**
 * Generate a melody continuation from the current context.
 * @param {number} [steps=8] - Number of steps to generate
 * @param {number} [temperature=1.0] - Randomness (0.5=conservative, 1.5=creative)
 * @returns {Promise<Array<{pitch: number, duration: number}>>} Generated notes
 */
export async function generateMelody(steps = 8, temperature = 1.0) {
  // Cooldown check
  const now = Date.now();
  if (now - lastGenerationTime < GENERATION_COOLDOWN) {
    return [];
  }

  if (!model) {
    const initialized = await initMelodyModel();
    if (!initialized) return [];
  }

  try {
    const magenta = window.mm || mm;
    if (!magenta) return [];

    // Build the input sequence
    const seedSequence = buildNoteSequence();

    // If no notes in context, create a simple seed
    if (seedSequence.notes.length === 0) {
      seedSequence.notes = [{ pitch: 60, startTime: 0, endTime: 1, velocity: 80 }];
      seedSequence.totalTime = 1;
    }

    // Generate continuation
    const result = await model.continueSequence(seedSequence, steps, temperature);
    lastGenerationTime = now;

    if (!result || !result.notes) return [];

    // Extract only the newly generated notes (after the seed)
    const seedDuration = seedSequence.totalTime;
    const newNotes = result.notes.filter((n) => n.startTime >= seedDuration);

    if (newNotes.length === 0) return [];

    // Convert to our format
    const generated = newNotes.map((n) => ({
      pitch: n.pitch,
      duration: n.endTime - n.startTime,
      startTime: n.startTime - seedDuration,
    }));

    // Notify callback
    if (onMelodyGenerated) {
      onMelodyGenerated(generated);
    }

    return generated;
  } catch (err) {
    console.error("AI Melody: Generation failed", err);
    return [];
  }
}

/**
 * Set a callback for when a new melody is generated.
 * @param {Function} cb - Callback receiving array of {pitch, duration, startTime}
 */
export function setOnMelodyGenerated(cb) {
  onMelodyGenerated = cb;
}

/**
 * Check if the model is loaded and ready.
 */
export function isModelReady() {
  return isLoaded && model !== null;
}

/**
 * Get any load error.
 */
export function getLoadError() {
  return loadError;
}

/**
 * Get loading state.
 */
export function getLoadingState() {
  if (isLoaded && model) return "ready";
  if (isLoading) return "loading";
  if (loadError) return "error";
  return "unloaded";
}

// ─── Helper ─────────────────────────────────────────────────────────────

function noteNameToMidiPitch(noteName) {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const match = noteName.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 60;
  const noteIndex = noteNames.indexOf(match[1]);
  const octave = parseInt(match[2]);
  if (noteIndex < 0) return 60;
  return (octave + 1) * 12 + noteIndex;
}
