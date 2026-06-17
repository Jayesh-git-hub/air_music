/**
 * presets.js
 * Preset management (save/load/delete) and audio export for Gesture Music Studio.
 *
 * Presets saves: instrument, scale, bpm, quantize, metronome, arp settings,
 *   visualizer mode, fx pad params.
 * Audio Export uses Tone.Recorder to capture master output → WAV download.
 */

import * as Tone from "tone";

const PRESETS_KEY = "gesture-music-presets";

// ─── Preset Management ─────────────────────────────────────────────────

/**
 * Collect current app state into a serializable object.
 * @param {Object} state — references to all current UI/audio state
 * @returns {Object} serializable preset
 */
export function capturePreset(state) {
  return {
    name: state.name || "Untitled",
    instrument: state.instrument || "theremin",
    scale: state.scale || "pentatonic",
    bpm: state.bpm || 120,
    quantize: state.quantize || "off",
    metronome: !!state.metronome,
    arpOn: !!state.arpOn,
    arpPattern: state.arpPattern || "up",
    vizMode: state.vizMode || "spectrum",
    fxXParam: state.fxXParam || "reverbMix",
    fxYParam: state.fxYParam || "delayTime",
    drumMapping: state.drumMapping || "default",
    savedAt: Date.now(),
  };
}

/**
 * Load all saved presets from localStorage.
 * @returns {Array<Object>}
 */
export function loadPresetList() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save a new preset (or overwrite one with the same name).
 * @param {Object} preset
 */
export function savePreset(preset) {
  const list = loadPresetList();
  const idx = list.findIndex((p) => p.name === preset.name);
  if (idx >= 0) {
    list[idx] = preset;
  } else {
    list.push(preset);
  }
  localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
}

/**
 * Delete a preset by name.
 * @param {string} name
 */
export function deletePreset(name) {
  const list = loadPresetList().filter((p) => p.name !== name);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
}

// ─── Audio Export ──────────────────────────────────────────────────────

let exportRecorder = null;
let isExporting = false;

/**
 * Start recording the master audio output for export.
 * @returns {Promise<boolean>} true if recording started
 */
export async function startAudioExport() {
  if (isExporting) return false;
  try {
    exportRecorder = new Tone.Recorder();
    Tone.Destination.connect(exportRecorder);
    await exportRecorder.start();
    isExporting = true;
    return true;
  } catch (err) {
    console.error("Export: recording start failed", err);
    return false;
  }
}

/**
 * Stop recording and download the captured audio as a WAV file.
 * @returns {Promise<boolean>} true if download was triggered
 */
export async function stopAudioExport() {
  if (!isExporting || !exportRecorder) return false;
  try {
    const buffer = await exportRecorder.stop();
    Tone.Destination.disconnect(exportRecorder);
    exportRecorder.dispose();
    exportRecorder = null;
    isExporting = false;

    // Convert AudioBuffer to WAV Blob and trigger download
    const wavBlob = audioBufferToWav(buffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gesture-music-${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error("Export: recording stop failed", err);
    if (exportRecorder) {
      Tone.Destination.disconnect(exportRecorder);
      exportRecorder.dispose();
      exportRecorder = null;
    }
    isExporting = false;
    return false;
  }
}

/**
 * Export a loop station layer's AudioBuffer as a WAV download.
 * @param {AudioBuffer} buffer
 * @param {string} label — optional label for filename
 */
export function exportLayer(buffer, label = "layer") {
  if (!buffer) return;
  const wavBlob = audioBufferToWav(buffer);
  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gesture-music-${label}-${Date.now()}.wav`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Toggle audio export on/off. Returns new state.
 * @returns {Promise<boolean>}
 */
export async function toggleAudioExport() {
  if (isExporting) {
    await stopAudioExport();
    return false;
  } else {
    const started = await startAudioExport();
    return started;
  }
}

/**
 * @returns {boolean} whether export recording is active
 */
export function isExportRecording() {
  return isExporting;
}

// ─── WAV Conversion ────────────────────────────────────────────────────

/**
 * Convert an AudioBuffer to a WAV Blob (16-bit PCM, mono).
 * @param {AudioBuffer} audioBuffer
 * @returns {Blob}
 */
function audioBufferToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;

  // Use first channel for mono WAV
  const channelData = audioBuffer.getChannelData(0);
  const dataLength = channelData.length * (bitsPerSample / 8);
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, format, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < channelData.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// ─── URL Sharing ─────────────────────────────────────────

/**
 * Encode a preset object into a URL-safe base64 string for sharing.
 * @param {Object} preset - The preset object to share
 * @returns {string} URL-safe base64 string
 */
export function encodePresetToShare(preset) {
  try {
    // Remove savedAt timestamp for clean sharing
    const shareData = { ...preset };
    delete shareData.savedAt;
    const json = JSON.stringify(shareData);
    // Use btoa with UTF-8 encoding, then make URL-safe
    const utf8Bytes = new TextEncoder().encode(json);
    let binary = "";
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const base64 = btoa(binary);
    // URL-safe: replace + with -, / with _, remove =
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (err) {
    console.error("URL Share: encoding failed", err);
    return null;
  }
}

/**
 * Decode a URL-safe base64 string back into a preset object.
 * @param {string} encoded - URL-safe base64 string
 * @returns {Object|null} Decoded preset, or null on failure
 */
export function decodePresetFromShare(encoded) {
  try {
    // Restore standard base64
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding
    const padded = base64 + "===".slice(0, (4 - (base64.length % 4)) % 4);
    const binaryStr = atob(padded);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch (err) {
    console.error("URL Share: decoding failed", err);
    return null;
  }
}

/**
 * Generate a shareable URL from the current preset.
 * @param {Object} preset - The preset to share
 * @returns {string|null} Full shareable URL, or null on failure
 */
export function generateShareUrl(preset) {
  const encoded = encodePresetToShare(preset);
  if (!encoded) return null;
  const url = new URL(window.location.href);
  url.hash = `#preset=${encoded}`;
  return url.toString();
}

/**
 * Check the current URL for a shared preset (hash fragment).
 * @returns {Object|null} Decoded preset, or null if none found
 */
export function checkUrlForSharedPreset() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith("#preset=")) return null;
  const encoded = hash.replace("#preset=", "");
  return decodePresetFromShare(encoded);
}

/**
 * Copy a share URL to the clipboard.
 * @param {string} url - The URL to copy
 * @returns {Promise<boolean>} Whether copy succeeded
 */
export async function copyShareUrlToClipboard(url) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    // Fallback: create a temporary input
    const input = document.createElement("input");
    input.value = url;
    document.body.appendChild(input);
    input.select();
    const success = document.execCommand("copy");
    document.body.removeChild(input);
    return success;
  }
}
