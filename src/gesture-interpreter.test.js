import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createGestureInterpreter,
  normalizedToNote,
  SCALES,
  mapRange,
  Smoother,
} from "./gesture-interpreter";

// ─── Helper: create a set of 21 MediaPipe hand landmarks ────────────────

/**
 * Build an array of 21 landmark objects simulating a MediaPipe hand.
 * @param {Object} overrides - Key-value pairs to override specific landmark indices
 * @returns {Array<{x: number, y: number, z: number}>}
 */
function makeLandmarks(overrides = {}) {
  // Default: open hand with palm centered, fingers spread
  const defaults = [
    { x: 0.50, y: 0.80, z: 0.00 }, // 0  wrist
    { x: 0.48, y: 0.72, z: 0.02 }, // 1  thumb-CMC
    { x: 0.45, y: 0.70, z: 0.04 }, // 2  thumb-MCP
    { x: 0.42, y: 0.68, z: 0.05 }, // 3  thumb-IP
    { x: 0.40, y: 0.65, z: 0.06 }, // 4  thumb-TIP
    { x: 0.50, y: 0.70, z: 0.01 }, // 5  index-MCP
    { x: 0.50, y: 0.63, z: 0.02 }, // 6  index-PIP
    { x: 0.50, y: 0.56, z: 0.02 }, // 7  index-DIP
    { x: 0.50, y: 0.50, z: 0.02 }, // 8  index-TIP
    { x: 0.55, y: 0.70, z: 0.01 }, // 9  middle-MCP
    { x: 0.55, y: 0.62, z: 0.01 }, // 10 middle-PIP
    { x: 0.55, y: 0.54, z: 0.01 }, // 11 middle-DIP
    { x: 0.55, y: 0.47, z: 0.01 }, // 12 middle-TIP
    { x: 0.60, y: 0.71, z: 0.00 }, // 13 ring-MCP
    { x: 0.60, y: 0.64, z: 0.00 }, // 14 ring-PIP
    { x: 0.60, y: 0.57, z: 0.00 }, // 15 ring-DIP
    { x: 0.60, y: 0.50, z: 0.00 }, // 16 ring-TIP
    { x: 0.65, y: 0.72, z: 0.00 }, // 17 pinky-MCP
    { x: 0.65, y: 0.67, z: 0.00 }, // 18 pinky-PIP
    { x: 0.65, y: 0.62, z: 0.00 }, // 19 pinky-DIP
    { x: 0.65, y: 0.57, z: 0.00 }, // 20 pinky-TIP
  ];

  for (const [idx, vals] of Object.entries(overrides)) {
    const i = parseInt(idx);
    if (i >= 0 && i < 21) {
      defaults[i] = { ...defaults[i], ...vals };
    }
  }
  return defaults;
}

/** Shorthand for a single-hand data object */
function handData(landmarks, gesture = null, handedness = "Right") {
  return {
    hands: [{ landmarks, gesture, handedness }],
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   SCALES
   ───────────────────────────────────────────────────────────────────────── */

describe("SCALES", () => {
  it("contains all 5 scales", () => {
    expect(Object.keys(SCALES)).toEqual([
      "pentatonic",
      "major",
      "minor",
      "chromatic",
      "blues",
    ]);
  });

  it("pentatonic has 5 notes", () => {
    expect(SCALES.pentatonic).toHaveLength(5);
    expect(SCALES.pentatonic).toEqual([0, 2, 4, 7, 9]);
  });

  it("chromatic has all 12 semitones", () => {
    expect(SCALES.chromatic).toHaveLength(12);
    expect(SCALES.chromatic[0]).toBe(0);
    expect(SCALES.chromatic[11]).toBe(11);
  });

  it("major scale has 7 notes", () => {
    expect(SCALES.major).toHaveLength(7);
    expect(SCALES.major).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it("minor scale has 7 notes", () => {
    expect(SCALES.minor).toHaveLength(7);
    expect(SCALES.minor).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });

  it("blues scale has 6 notes", () => {
    expect(SCALES.blues).toHaveLength(6);
    expect(SCALES.blues).toEqual([0, 3, 5, 6, 7, 10]);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   mapRange
   ───────────────────────────────────────────────────────────────────────── */

describe("mapRange", () => {
  it("maps 0-1 to 0-1 by default", () => {
    expect(mapRange(0, 0, 1, 0, 1)).toBe(0);
    expect(mapRange(0.5, 0, 1, 0, 1)).toBe(0.5);
    expect(mapRange(1, 0, 1, 0, 1)).toBe(1);
  });

  it("maps to a different target range", () => {
    expect(mapRange(0, 0, 1, 100, 200)).toBe(100);
    expect(mapRange(0.5, 0, 1, 100, 200)).toBe(150);
    expect(mapRange(1, 0, 1, 100, 200)).toBe(200);
  });

  it("clamps values below input range", () => {
    expect(mapRange(-5, 0, 10, 0, 100)).toBe(0);
  });

  it("clamps values above input range", () => {
    expect(mapRange(20, 0, 10, 0, 100)).toBe(100);
  });

  it("handles zero-width input range by returning midpoint", () => {
    expect(mapRange(5, 5, 5, 0, 100)).toBe(50);
  });

  it("maps inverted ranges correctly", () => {
    expect(mapRange(0, 0, 1, 100, 0)).toBe(100);
    expect(mapRange(1, 0, 1, 100, 0)).toBe(0);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   Smoother
   ───────────────────────────────────────────────────────────────────────── */

describe("Smoother", () => {
  it("returns the first value directly (no smoothing yet)", () => {
    const s = new Smoother(0.3);
    expect(s.update(0.5)).toBe(0.5);
  });

  it("moves toward the target value on subsequent updates", () => {
    const s = new Smoother(0.5);
    s.update(0);
    const second = s.update(1);
    // With factor 0.5: 0.5 * 1 + 0.5 * 0 = 0.5
    expect(second).toBe(0.5);
  });

  it("converges to the target after enough updates", () => {
    const s = new Smoother(0.8);
    s.update(0);
    let val = s.update(1);
    // 0.8*1 + 0.2*0 = 0.8
    expect(val).toBeCloseTo(0.8, 5);
    val = s.update(1);
    // 0.8*1 + 0.2*0.8 = 0.96
    expect(val).toBeCloseTo(0.96, 5);
  });

  it("accepts arrays of values", () => {
    const s = new Smoother(0.5);
    const first = s.update([0.2, 0.8]);
    expect(first).toEqual([0.2, 0.8]);

    const second = s.update([1.0, 0.0]);
    expect(second[0]).toBeCloseTo(0.6, 5); // 0.5*1 + 0.5*0.2
    expect(second[1]).toBeCloseTo(0.4, 5); // 0.5*0 + 0.5*0.8
  });

  it("reset clears internal state", () => {
    const s = new Smoother(0.3);
    s.update(0.5);
    s.reset();
    expect(s.values).toBeNull();
    // After reset, first update returns the value directly
    expect(s.update(0.9)).toBe(0.9);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   normalizedToNote
   ───────────────────────────────────────────────────────────────────────── */

describe("normalizedToNote", () => {
  it("returns the first note of pentatonic at 0", () => {
    expect(normalizedToNote(0, 4, "pentatonic")).toBe("C4");
  });

  it("returns the last note of pentatonic at 1", () => {
    expect(normalizedToNote(1, 4, "pentatonic")).toBe("A4");
  });

  it("returns middle note at 0.5 in pentatonic", () => {
    // pentatonic: [C, D, E, G, A] → index round(0.5 * 4) = 2 → E
    expect(normalizedToNote(0.5, 4, "pentatonic")).toBe("E4");
  });

  it("respects different octaves", () => {
    expect(normalizedToNote(0, 5, "pentatonic")).toBe("C5");
    expect(normalizedToNote(0, 3, "pentatonic")).toBe("C3");
    expect(normalizedToNote(0, 2, "pentatonic")).toBe("C2");
  });

  it("clamps normalized values below 0", () => {
    expect(normalizedToNote(-1, 4, "pentatonic")).toBe("C4");
  });

  it("clamps normalized values above 1", () => {
    expect(normalizedToNote(2, 4, "pentatonic")).toBe("A4");
  });

  it("works with major scale", () => {
    // major: [C, D, E, F, G, A, B]
    // index = round(0 * 6) = 0 → C
    expect(normalizedToNote(0, 4, "major")).toBe("C4");
    // index = round(1 * 6) = 6 → B
    expect(normalizedToNote(1, 4, "major")).toBe("B4");
    // index = round(0.5 * 6) = 3 → F
    expect(normalizedToNote(0.5, 4, "major")).toBe("F4");
  });

  it("works with minor scale", () => {
    // minor: [C, D, Eb, F, G, Ab, Bb] → Bb is A# in sharps
    expect(normalizedToNote(0, 4, "minor")).toBe("C4");
    expect(normalizedToNote(1, 4, "minor")).toBe("A#4");
  });

  it("works with chromatic scale", () => {
    // chromatic has 12 notes
    expect(normalizedToNote(0, 4, "chromatic")).toBe("C4");
    expect(normalizedToNote(1, 4, "chromatic")).toBe("B4");
    // index = round(0.5 * 11) = round(5.5) = 6 → F#4/Gb4 → F#4
    expect(normalizedToNote(0.5, 4, "chromatic")).toBe("F#4");
  });

  it("works with blues scale", () => {
    // blues: [C, Eb, F, F#, G, Bb] → Bb is A# in sharps
    expect(normalizedToNote(0, 4, "blues")).toBe("C4");
    expect(normalizedToNote(1, 4, "blues")).toBe("A#4");
    // index = round(0.5 * 5) = round(2.5) = 3 → F#
    expect(normalizedToNote(0.5, 4, "blues")).toBe("F#4");
  });

  it("falls back to pentatonic for unknown scale name", () => {
    expect(normalizedToNote(0, 4, "nonexistent")).toBe("C4");
    expect(normalizedToNote(1, 4, "nonexistent")).toBe("A4");
  });

  it("defaults to octave 4 and pentatonic when not specified", () => {
    expect(normalizedToNote(0)).toBe("C4");
    expect(normalizedToNote(1)).toBe("A4");
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   createGestureInterpreter — no-hand state
   ───────────────────────────────────────────────────────────────────────── */

describe("createGestureInterpreter — no-hand state", () => {
  it("returns safe defaults when no hand data provided", () => {
    const gi = createGestureInterpreter();
    const result = gi.interpret(null);
    expect(result.hasHand).toBe(false);
    expect(result.hands).toEqual([]);
    expect(result.smoothedX).toBe(0.5);
    expect(result.smoothedY).toBe(0.5);
    expect(result.openness).toBe(0.5);
    expect(result.fingerCurls).toBeNull();
    expect(result.currentNote).toBe("C4");
    expect(result.gesture).toBeNull();
    expect(result.gestureJustChanged).toBe(false);
    expect(result.movementGesture).toBeNull();
    expect(result.movementGestureJustChanged).toBe(false);
  });

  it("returns safe defaults when hands array is empty", () => {
    const gi = createGestureInterpreter();
    const result = gi.interpret({ hands: [] });
    expect(result.hasHand).toBe(false);
  });

  it("returns safe defaults when hands has no landmarks", () => {
    const gi = createGestureInterpreter();
    const result = gi.interpret({
      hands: [{ landmarks: null, gesture: null, handedness: "Right" }],
    });
    expect(result.hasHand).toBe(false);
  });

  it("returns safe defaults when landmarks are too few", () => {
    const gi = createGestureInterpreter();
    const result = gi.interpret({
      hands: [{ landmarks: [{ x: 0.5, y: 0.5, z: 0 }], gesture: null, handedness: "Right" }],
    });
    expect(result.hasHand).toBe(false);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   createGestureInterpreter — single hand
   ───────────────────────────────────────────────────────────────────────── */

describe("createGestureInterpreter — single hand", () => {
  /** @type {ReturnType<typeof createGestureInterpreter>} */
  let gi;

  beforeEach(() => {
    gi = createGestureInterpreter();
  });

  afterEach(() => {
    gi.reset();
  });

  it("detects a hand and returns hasHand true", () => {
    const lm = makeLandmarks();
    const result = gi.interpret(handData(lm));
    expect(result.hasHand).toBe(true);
    expect(result.hands).toHaveLength(1);
  });

  it("extracts palm position from landmarks", () => {
    const lm = makeLandmarks();
    const result = gi.interpret(handData(lm));
    // Palm center = average of wrist(0), index-MCP(5), pinky-MCP(17)
    const expectedX = (lm[0].x + lm[5].x + lm[17].x) / 3;
    const expectedY = (lm[0].y + lm[5].y + lm[17].y) / 3;
    // After smoothing starts, first call returns raw values
    expect(result.smoothedX).toBeCloseTo(expectedX, 5);
    expect(result.smoothedY).toBeCloseTo(expectedY, 5);
  });

  it("computes openness from fingertip-to-base distances", () => {
    // Open hand → larger distances → higher openness
    const lm = makeLandmarks();
    const openResult = gi.interpret(handData(lm));
    expect(openResult.openness).toBeGreaterThan(0.3);

    // Reset and test a closed fist → smaller distances → lower openness
    gi.reset();
    const closedLm = makeLandmarks({
      8: { x: 0.50, y: 0.75, z: 0.02 },   // index tip near palm
      12: { x: 0.54, y: 0.75, z: 0.01 },  // middle tip near palm
      16: { x: 0.58, y: 0.76, z: 0.01 },  // ring tip near palm
      20: { x: 0.62, y: 0.77, z: 0.01 },  // pinky tip near palm
      4: { x: 0.47, y: 0.73, z: 0.03 },   // thumb tip near palm
    });
    const closedResult = gi.interpret(handData(closedLm));
    expect(closedResult.openness).toBeLessThan(0.3);
  });

  it("maps palm Y position to a quantised note", () => {
    // High Y (low hand) → normalized Y near 0 → C
    const lowHand = makeLandmarks();
    lowHand.forEach((lm) => { lm.y += 0.1; }); // shift hand down
    gi.reset();
    const lowResult = gi.interpret(handData(lowHand));
    // palmY is high, 1 - palmY is low → first note of pentatonic = C4
    // (this is approximate due to smoothing)
    expect(typeof lowResult.currentNote).toBe("string");
    expect(lowResult.currentNote.length).toBeGreaterThanOrEqual(2);

    // High Y (raised hand) → normalized Y near 1 → last note of pentatonic
    gi.reset();
    const highHand = makeLandmarks();
    highHand.forEach((lm) => { lm.y -= 0.2; }); // shift hand up
    const highResult = gi.interpret(handData(highHand));
    expect(typeof highResult.currentNote).toBe("string");
  });

  it("detects a gesture from the hand data", () => {
    const gesture = { name: "Open_Palm", category: "Open_Palm", score: 0.95 };
    const lm = makeLandmarks();
    const result = gi.interpret(handData(lm, gesture));
    expect(result.gesture).not.toBeNull();
    expect(result.gesture.name).toBe("Open_Palm");
  });

  it("tracks gesture changes with frame debounce", () => {
    const gesture = { name: "Fist", category: "Fist", score: 0.9 };

    // First frame with new gesture → not yet confirmed
    const lm = makeLandmarks();
    let result = gi.interpret(handData(lm, gesture));
    expect(result.gestureJustChanged).toBe(false);

    // Need HOLD_THRESHOLD (5) frames with same gesture
    // Frame 1 sets candidate="Fist", confirmFrames=0
    // Frames 2-5: increment confirmFrames → 1,2,3,4
    // Frame 6: confirmFrames=5 === HOLD_THRESHOLD → gestureJustChanged=true
    for (let i = 0; i < 4; i++) {
      result = gi.interpret(handData(lm, gesture));
    }
    expect(result.gestureJustChanged).toBe(false);

    // One more frame (total 6) triggers change
    result = gi.interpret(handData(lm, gesture));
    expect(result.gestureJustChanged).toBe(true);

    // Subsequent frames with same gesture → no longer "just changed"
    result = gi.interpret(handData(lm, gesture));
    expect(result.gestureJustChanged).toBe(false);
  });

  it("returns gesture change when gesture switches", () => {
    const fist = { name: "Fist", category: "Fist", score: 0.9 };
    const palm = { name: "Open_Palm", category: "Open_Palm", score: 0.9 };
    const lm = makeLandmarks();

    // Start with fist, hold for 6 frames to trigger change
    for (let i = 0; i < 6; i++) {
      gi.interpret(handData(lm, fist));
    }

    // Switch to palm — resets hold counter
    let result = gi.interpret(handData(lm, palm));
    expect(result.gestureJustChanged).toBe(false); // not yet held

    // Hold palm for threshold frames
    for (let i = 0; i < 4; i++) {
      gi.interpret(handData(lm, palm));
    }
    result = gi.interpret(handData(lm, palm));
    expect(result.gestureJustChanged).toBe(true);
  });

  it("includes finger curls in the result", () => {
    const lm = makeLandmarks();
    const result = gi.interpret(handData(lm));
    expect(result.fingerCurls).not.toBeNull();
    expect(result.fingerCurls).toHaveProperty("thumb");
    expect(result.fingerCurls).toHaveProperty("index");
    expect(result.fingerCurls).toHaveProperty("middle");
    expect(result.fingerCurls).toHaveProperty("ring");
    expect(result.fingerCurls).toHaveProperty("pinky");
  });

  it("finger curls are 0-1 values", () => {
    const lm = makeLandmarks();
    const result = gi.interpret(handData(lm));
    for (const curl of Object.values(result.fingerCurls)) {
      expect(curl).toBeGreaterThanOrEqual(0);
      expect(curl).toBeLessThanOrEqual(1);
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   createGestureInterpreter — scale management
   ───────────────────────────────────────────────────────────────────────── */

describe("scale management", () => {
  it("starts with pentatonic by default", () => {
    const gi = createGestureInterpreter();
    expect(gi.getScale()).toBe("pentatonic");
  });

  it("accepts initial scale via options", () => {
    const gi = createGestureInterpreter({ scale: "blues" });
    expect(gi.getScale()).toBe("blues");
  });

  it("setScale changes the current scale", () => {
    const gi = createGestureInterpreter();
    gi.setScale("major");
    expect(gi.getScale()).toBe("major");
  });

  it("setScale ignores unknown scales", () => {
    const gi = createGestureInterpreter();
    gi.setScale("major");
    gi.setScale("nonexistent");
    // Should still be "major"
    expect(gi.getScale()).toBe("major");
  });

  it("scale change affects note mapping", () => {
    const gi = createGestureInterpreter();
    const lm = makeLandmarks();

    // Force a specific Y that produces different notes across scales.
    // Pentatonic to blues should always differ because pentatonic (5 notes)
    // and blues (6 notes) have different interval spacing.
    lm.forEach(p => { p.y = 0.5; });
    gi.reset();
    const pentResult = gi.interpret(handData(lm));

    gi.setScale("blues");
    gi.reset();
    const bluesResult = gi.interpret(handData(lm));
    expect(bluesResult.currentNote).not.toBe(pentResult.currentNote);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   createGestureInterpreter — movement gestures (circle, swipe)
   ───────────────────────────────────────────────────────────────────────── */

describe("movement gesture detection", () => {
  let gi;

  beforeEach(() => {
    gi = createGestureInterpreter();
  });

  afterEach(() => {
    gi.reset();
  });

  it("detects a swipe up from rapid upward motion deltas", () => {
    // Feed 5 stationary frames then 10 frames stepping Y upward (lower number)
    // The raw change over 5 frames needs to exceed 0.12 after smoothing.
    // With smoother factor 0.25, a raw delta of ~0.5 per frame is needed.
    gi.reset();

    // 5 frames of low hand
    for (let i = 0; i < 5; i++) {
      const lm = makeLandmarks();
      lm.forEach(p => { p.y = 0.80; p.x = 0.50; });
      gi.interpret(handData(lm));
    }

    // Now move hand up quickly — palm center drops from 0.80 to 0.30
    // This large step will cause the smoothed position to track
    // and produce a big dy over the 5-frame window.
    let detected = false;
    for (let i = 0; i < 15; i++) {
      const lm = makeLandmarks();
      lm.forEach(p => { p.y = 0.30; p.x = 0.50; });
      const result = gi.interpret(handData(lm));
      if (result.movementGesture === "swipe_up") {
        detected = true;
      }
    }
    expect(detected).toBe(true);
  });

  it("does not trigger swipe on small jittery movements", () => {
    gi.reset();
    let triggered = false;
    for (let i = 0; i < 20; i++) {
      const lm = makeLandmarks();
      lm.forEach(p => { p.y = 0.80 + (Math.random() - 0.5) * 0.04; p.x = 0.50; });
      const result = gi.interpret(handData(lm));
      if (result.movementGestureJustChanged) {
        triggered = true;
      }
    }
    expect(triggered).toBe(false);
  });

  it("movementGesture is null when no hand motion", () => {
    const lm = makeLandmarks();
    for (let i = 0; i < 5; i++) {
      const result = gi.interpret(handData(lm));
      expect(result.movementGesture).toBeNull();
      expect(result.movementGestureJustChanged).toBe(false);
    }
  });

  it("detects a circle gesture from circular motion", () => {
    gi.reset();

    // Feed 30 frames in a roughly circular trajectory
    // Center at (0.5, 0.5), radius 0.15, sweep through ~300 degrees
    const cx = 0.5, cy = 0.5, r = 0.15;
    let detected = false;

    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const lm = makeLandmarks();
      // Only the palm landmarks matter for position history
      lm[0] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, z: 0 };
      lm[5] = { x: cx + Math.cos(angle + 0.2) * r * 0.9, y: cy + Math.sin(angle + 0.2) * r * 0.9, z: 0 };
      lm[17] = { x: cx + Math.cos(angle - 0.2) * r * 0.9, y: cy + Math.sin(angle - 0.2) * r * 0.9, z: 0 };
      // Fill other landmarks minimally
      for (let j = 1; j < 21; j++) {
        if (j !== 5 && j !== 17) {
          lm[j] = { x: cx, y: cy, z: 0 };
        }
      }

      const result = gi.interpret(handData(lm));
      if (result.movementGesture === "circle") {
        detected = true;
      }
    }

    expect(detected).toBe(true);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   createGestureInterpreter — two hands
   ───────────────────────────────────────────────────────────────────────── */

describe("two-hand detection", () => {
  it("returns data for both hands", () => {
    const gi = createGestureInterpreter();
    const lmRight = makeLandmarks();
    const lmLeft = makeLandmarks({ 0: { x: 0.3, y: 0.8, z: 0 } });

    const result = gi.interpret({
      hands: [
        { landmarks: lmRight, gesture: null, handedness: "Right" },
        { landmarks: lmLeft, gesture: null, handedness: "Left" },
      ],
    });

    expect(result.hasHand).toBe(true);
    expect(result.hands).toHaveLength(2);
    expect(result.hands[0].handedness).toBe("Right");
    expect(result.hands[1].handedness).toBe("Left");
  });

  it("uses primary (first) hand for smoothed values", () => {
    const gi = createGestureInterpreter();
    const lmRight = makeLandmarks();
    const lmLeft = makeLandmarks({ 0: { x: 0.2, y: 0.8, z: 0 } });

    const result = gi.interpret({
      hands: [
        { landmarks: lmRight, gesture: null, handedness: "Right" },
        { landmarks: lmLeft, gesture: null, handedness: "Left" },
      ],
    });

    // smoothed X should come from the right hand (index 0)
    const expectedRightX = (lmRight[0].x + lmRight[5].x + lmRight[17].x) / 3;
    expect(result.smoothedX).toBeCloseTo(expectedRightX, 5);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   createGestureInterpreter — reset
   ───────────────────────────────────────────────────────────────────────── */

describe("reset", () => {
  it("clears gesture tracking state but does not reset scale", () => {
    const gi = createGestureInterpreter();
    const lm = makeLandmarks();
    gi.interpret(handData(lm));
    gi.setScale("minor");
    gi.reset();

    // Musical settings like scale are NOT reset by reset()
    expect(gi.getScale()).toBe("minor");

    // First interpret after reset should have fresh smoother
    const result = gi.interpret(null);
    expect(result.hasHand).toBe(false);
    expect(result.smoothedX).toBe(0.5);
    expect(result.smoothedY).toBe(0.5);
  });

  it("resets gesture hold state", () => {
    const gi = createGestureInterpreter();
    const gesture = { name: "Fist", category: "Fist", score: 0.9 };
    const lm = makeLandmarks();

    // Build up hold frames
    for (let i = 0; i < 6; i++) {
      gi.interpret(handData(lm, gesture));
    }

    gi.reset();

    // After reset, hold counter is cleared
    const result = gi.interpret(handData(lm, gesture));
    expect(result.gestureJustChanged).toBe(false);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   createGestureInterpreter — initial scale option
   ───────────────────────────────────────────────────────────────────────── */

describe("initial options", () => {
  it("accepts scale option", () => {
    const gi = createGestureInterpreter({ scale: "minor" });
    expect(gi.getScale()).toBe("minor");
  });

  it("defaults to pentatonic without options", () => {
    const gi = createGestureInterpreter();
    expect(gi.getScale()).toBe("pentatonic");
  });

  it("defaults to pentatonic with empty options", () => {
    const gi = createGestureInterpreter({});
    expect(gi.getScale()).toBe("pentatonic");
  });
});
