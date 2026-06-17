/**
 * midi-exporter.js
 * MIDI Event Recorder + File Export (zero dependencies).
 * Records note-on/note-off events during performance and exports
 * them as Standard MIDI Files (.mid) for use in any DAW.
 *
 * Usage:
 *   const recorder = createMidiRecorder();
 *   recorder.noteOn(60, 100, time);  // C4, velocity 100
 *   recorder.noteOff(60, time);
 *   const blob = recorder.exportMidi(120);  // Blob at 120 BPM
 *   downloadBlob(blob, "performance.mid");
 */

// ─── MIDI Binary Writer ─────────────────────────────────────────────────

/**
 * Write a variable-length quantity (VLQ) used for delta times in MIDI files.
 */
function writeVLQ(value) {
  const bytes = [];
  do {
    bytes.unshift(value & 0x7f);
    value >>= 7;
  } while (value > 0);
  // Set continuation bit on all bytes except the last (most significant)
  for (let i = 0; i < bytes.length - 1; i++) {
    bytes[i] |= 0x80;
  }
  return bytes;
}

/**
 * Write a 16-bit big-endian value.
 */
function writeUint16(value) {
  return [(value >> 8) & 0xff, value & 0xff];
}

/**
 * Write a 32-bit big-endian value.
 */
function writeUint32(value) {
  return [
    (value >> 24) & 0xff,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ];
}

/**
 * Converts note name like "C4" to MIDI pitch number (0-127).
 * C4 = 60, A4 = 69, etc.
 */
function noteNameToMidiPitch(noteName) {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const match = noteName.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 60;
  const noteIndex = noteNames.indexOf(match[1]);
  const octave = parseInt(match[2]);
  if (noteIndex < 0) return 60;
  return (octave + 1) * 12 + noteIndex;
}

// ─── MIDI Recorder ──────────────────────────────────────────────────────

/**
 * Creates a MIDI event recorder that captures note-on/note-off events.
 * @returns {Object} Recorder API
 */
export function createMidiRecorder() {
  /** @type {Array<{type: string, pitch: number, velocity: number, time: number, channel?: number}>} */
  const events = [];
  let isRecording = false;

  /**
   * Start recording - resets any previous events.
   */
  function startRecording() {
    events.length = 0;
    isRecording = true;
  }

  /**
   * Stop recording and return captured events.
   * @returns {Array} Captured events
   */
  function stopRecording() {
    isRecording = false;
    return events;
  }

  /**
   * Record a note-on event.
   * @param {string|number} note - Note name ("C4") or MIDI pitch number (60)
   * @param {number} velocity - Velocity 0-127 (default 100)
   * @param {number} [time] - Timestamp in seconds (default: now relative to start)
   */
  function noteOn(note, velocity = 100, time) {
    if (!isRecording) return;
    const pitch = typeof note === "string" ? noteNameToMidiPitch(note) : note;
    const t = time != null ? time : (performance.now() / 1000);
    events.push({ type: "noteOn", pitch, velocity: Math.round(velocity), time: t, channel: 0 });
  }

  /**
   * Record a note-off event.
   * @param {string|number} note - Note name or MIDI pitch
   * @param {number} [time] - Timestamp in seconds
   */
  function noteOff(note, time) {
    if (!isRecording) return;
    const pitch = typeof note === "string" ? noteNameToMidiPitch(note) : note;
    const t = time != null ? time : (performance.now() / 1000);
    events.push({ type: "noteOff", pitch, velocity: 0, time: t, channel: 0 });
  }

  /**
   * @returns {boolean} Whether currently recording
   */
  function getIsRecording() {
    return isRecording;
  }

  /**
   * @returns {number} Number of events captured
   */
  function getEventCount() {
    return events.length;
  }

  /**
   * Clear all recorded events.
   */
  function clear() {
    events.length = 0;
    isRecording = false;
  }

  return { startRecording, stopRecording, noteOn, noteOff, getIsRecording, getEventCount, clear };
}

// ─── MIDI File Export ───────────────────────────────────────────────────

const TICKS_PER_BEAT = 480;

/**
 * Convert recorded events to a Standard MIDI File (.mid) ArrayBuffer.
 * @param {Array} events - Array of {type, pitch, velocity, time, channel}
 * @param {number} bpm - Beats per minute (default 120)
 * @returns {ArrayBuffer} MIDI file as ArrayBuffer
 */
export function eventsToMidiFile(events, bpm = 120) {
  if (events.length === 0) {
    // Return minimal MIDI file with just a tempo event
    return createEmptyMidiFile(bpm);
  }

  // Sort events by time
  const sorted = [...events].sort((a, b) => a.time - b.time);

  // Find the start time
  const firstTime = sorted[0].time;

  // Build track events (MIDI binary)
  const trackBytes = [];

  // 1. Tempo event (meta event at time 0)
  const microsPerBeat = Math.round(60000000 / bpm);
  const tempoBytes = [
    0x00, // Delta time = 0
    0xff, 0x51, 0x03, // Meta event: set tempo
    (microsPerBeat >> 16) & 0xff,
    (microsPerBeat >> 8) & 0xff,
    microsPerBeat & 0xff,
  ];
  trackBytes.push(...tempoBytes);

  // 2. Time signature event (4/4)
  const timeSigBytes = [
    0x00, // Delta time = 0
    0xff, 0x58, 0x04, // Meta event: time signature
    0x04, // numerator (4)
    0x02, // denominator (2 = quarter note: 2^2 = 4)
    0x18, // clocks per tick (24)
    0x08, // 32nd notes per quarter (8)
  ];
  trackBytes.push(...timeSigBytes);

  // 3. Track name
  const trackName = "Gesture Music Studio";
  const nameBytes = [
    0x00, // Delta time = 0
    0xff, 0x03, trackName.length,
    ...trackName.split("").map(c => c.charCodeAt(0)),
  ];
  trackBytes.push(...nameBytes);

  // 4. Note events
  let lastTime = 0;
  let runningStatus = null;

  for (const evt of sorted) {
    const deltaSeconds = evt.time - firstTime;
    const deltaTicks = Math.round((deltaSeconds / 60) * bpm * TICKS_PER_BEAT);
    const deltaFromLast = Math.max(0, deltaTicks - lastTime);
    lastTime = deltaTicks;

    const deltaBytes = writeVLQ(deltaFromLast);
    trackBytes.push(...deltaBytes);

    if (evt.type === "noteOn") {
      const status = 0x90 | (evt.channel || 0);
      if (status !== runningStatus) {
        trackBytes.push(status);
        runningStatus = status;
      }
      trackBytes.push(evt.pitch & 0x7f);
      trackBytes.push(Math.min(evt.velocity, 127));
    } else if (evt.type === "noteOff") {
      const status = 0x80 | (evt.channel || 0);
      if (status !== runningStatus) {
        trackBytes.push(status);
        runningStatus = status;
      }
      trackBytes.push(evt.pitch & 0x7f);
      trackBytes.push(0x40); // Release velocity (64)
    }
  }

  // 5. End of track
  const endBytes = [0x00, 0xff, 0x2f, 0x00];
  trackBytes.push(...endBytes);

  // Build complete MIDI file
  const headerChunk = [
    ..."MThd".split("").map(c => c.charCodeAt(0)),
    ...writeUint32(6),       // Header length
    ...writeUint16(0),       // Format 0 (single track)
    ...writeUint16(1),       // 1 track
    ...writeUint16(TICKS_PER_BEAT),
  ];

  const trackLength = trackBytes.length;
  const trackChunk = [
    ..."MTrk".split("").map(c => c.charCodeAt(0)),
    ...writeUint32(trackLength),
    ...trackBytes,
  ];

  const allBytes = new Uint8Array([...headerChunk, ...trackChunk]);
  return allBytes.buffer;
}

/**
 * Create a minimal MIDI file with tempo, time signature & track name (empty performance).
 */
function createEmptyMidiFile(bpm = 120) {
  const microsPerBeat = Math.round(60000000 / bpm);
  const trackName = "Gesture Music Studio";
  const trackBytes = [
    // Tempo meta event
    0x00, 0xff, 0x51, 0x03,
    (microsPerBeat >> 16) & 0xff,
    (microsPerBeat >> 8) & 0xff,
    microsPerBeat & 0xff,
    // Time signature meta event (4/4)
    0x00, 0xff, 0x58, 0x04,
    0x04, 0x02, 0x18, 0x08,
    // Track name meta event
    0x00, 0xff, 0x03, trackName.length,
    ...trackName.split("").map(c => c.charCodeAt(0)),
    // End of track
    0x00, 0xff, 0x2f, 0x00,
  ];

  const headerChunk = [
    ..."MThd".split("").map(c => c.charCodeAt(0)),
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00, // Format 0
    0x00, 0x01, // 1 track
    (TICKS_PER_BEAT >> 8) & 0xff, TICKS_PER_BEAT & 0xff,
  ];

  const trackChunk = [
    ..."MTrk".split("").map(c => c.charCodeAt(0)),
    0x00, 0x00, 0x00, trackBytes.length,
    ...trackBytes,
  ];

  return new Uint8Array([...headerChunk, ...trackChunk]).buffer;
}

/**
 * Export recorded events as a downloadable Blob.
 * @param {Array} events - Events array from the recorder
 * @param {number} bpm - BPM for timing
 * @returns {Blob} MIDI file as a Blob
 */
export function exportAsMidiBlob(events, bpm = 120) {
  const buffer = eventsToMidiFile(events, bpm);
  return new Blob([buffer], { type: "audio/midi" });
}

/**
 * Trigger a browser download of a MIDI file.
 * @param {Blob} blob - MIDI blob
 * @param {string} [filename] - Download filename
 */
export function downloadMidiBlob(blob, filename = `gesture-music-${Date.now()}.mid`) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * High-level: export recorded events directly as a MIDI download.
 * @param {Array} events - Events from the recorder
 * @param {number} bpm - BPM
 * @param {string} [label] - Optional label for filename
 */
export function exportEventsToMidi(events, bpm = 120, label = "performance") {
  const blob = exportAsMidiBlob(events, bpm);
  downloadMidiBlob(blob, `gesture-music-${label}-${Date.now()}.mid`);
}
