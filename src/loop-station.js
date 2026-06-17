/**
 * loop-station.js
 * Loop Recording & Playback Station.
 * Captures audio output via Tone.Recorder and plays back
 * multiple looping layers via Tone.Player.
 *
 * Gesture-driven flow:
 *   Circle → startRecording()
 *   Open palm → stopRecording() → creates loop
 *   Swipe up → addLayer() (record new layer over existing)
 *   Swipe down → removeLastLayer()
 *   Thumbs up → toggleAllPlayback()
 *   Thumbs down → stopAll()
 */

import * as Tone from "tone";

/**
 * Creates a LoopStation instance.
 * @returns {Object} Loop station API
 */
export function createLoopStation() {
  /** @type {Array<{id: number, player: Tone.Player, buffer: AudioBuffer}>} */
  const layers = [];
  let nextId = 1;
  let recorder = null;
  let isRecording = false;
  /** Callback fired on state changes: ({ state, loopCount, recording }) */
  let onStateChange = null;

  // ─── Internal Helpers ─────────────────────────────────────────────

  /** Notify the UI callback with current state */
  function emitState() {
    if (onStateChange) {
      onStateChange({
        state: isRecording ? "recording" : layers.length > 0 ? "playing" : "idle",
        loopCount: layers.length,
        recording: isRecording,
      });
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────

  /**
   * Begin recording audio from the master output.
   * Existing layers continue playing uninterrupted.
   */
  async function startRecording() {
    if (isRecording) return;
    try {
      recorder = new Tone.Recorder();
      Tone.Destination.connect(recorder);
      await recorder.start();
      isRecording = true;
      emitState();
    } catch (err) {
      console.error("LoopStation: recording start failed", err);
    }
  }

  /**
   * Stop recording and create a new looping layer from the captured audio.
   * @returns {Promise<Object|null>} The new layer, or null on failure
   */
  async function stopRecording() {
    if (!isRecording || !recorder) return null;
    try {
      const buffer = await recorder.stop();
      Tone.Destination.disconnect(recorder);
      recorder.dispose();
      recorder = null;
      isRecording = false;

      // Create a looping player from the recorded buffer
      const player = new Tone.Player(buffer).toDestination();
      player.loop = true;

      const layer = { id: nextId++, player, buffer };
      layers.push(layer);

      // Start playback immediately
      player.start();

      emitState();
      return layer;
    } catch (err) {
      console.error("LoopStation: recording stop failed", err);
      // Clean up recorder even on error
      if (recorder) {
        Tone.Destination.disconnect(recorder);
        recorder.dispose();
        recorder = null;
      }
      isRecording = false;
      emitState();
      return null;
    }
  }

  /**
   * Remove the most recently added layer.
   */
  function removeLastLayer() {
    if (layers.length === 0) return;
    const last = layers.pop();
    try {
      if (last.player.state === "started") {
        last.player.stop();
      }
      last.player.dispose();
    } catch (e) {
      // Ignore disposal errors
    }
    emitState();
  }

  /**
   * Toggle playback of all layers between playing and stopped.
   * Returns true if now playing, false if now stopped.
   */
  function toggleAllPlayback() {
    if (layers.length === 0) return false;
    const allStopped = layers.every((l) => l.player.state === "stopped");
    if (allStopped) {
      layers.forEach((l) => {
        if (l.player.state === "stopped") {
          l.player.start();
        }
      });
      emitState();
      return true;
    } else {
      layers.forEach((l) => {
        if (l.player.state === "started") {
          l.player.stop();
        }
      });
      emitState();
      return false;
    }
  }

  /**
   * Stop all layers immediately.
   */
  function stopAll() {
    layers.forEach((l) => {
      try {
        if (l.player.state === "started") {
          l.player.stop();
        }
      } catch (e) {
        // Ignore
      }
    });
    emitState();
  }

  /**
   * Get current loop station state.
   * @returns {{ state: string, loopCount: number, recording: boolean }}
   */
  function getState() {
    return {
      state: isRecording ? "recording" : layers.length > 0 ? "playing" : "idle",
      loopCount: layers.length,
      recording: isRecording,
    };
  }

  /**
   * Register a callback for state changes.
   * @param {function} cb - Callback receiving state object
   */
  function setOnStateChange(cb) {
    onStateChange = cb;
  }

  /**
   * Full cleanup — stops recording, disposes all players and recorder.
   */
  function cleanup() {
    // Stop any in-progress recording
    if (isRecording && recorder) {
      try {
        Tone.Destination.disconnect(recorder);
        recorder.dispose();
      } catch (e) {
        // Ignore
      }
      recorder = null;
      isRecording = false;
    }
    // Dispose all layers
    layers.forEach((l) => {
      try {
        if (l.player.state === "started") {
          l.player.stop();
        }
        l.player.dispose();
      } catch (e) {
        // Ignore
      }
    });
    layers.length = 0;
  }

  return {
    startRecording,
    stopRecording,
    removeLastLayer,
    toggleAllPlayback,
    stopAll,
    getState,
    setOnStateChange,
    cleanup,
  };
}
