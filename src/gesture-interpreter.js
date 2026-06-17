/**
 * gesture-interpreter.js
 * Smooths raw MediaPipe hand landmark data and maps it to
 * musical parameters (frequency, volume, effects, etc.).
 */

/**
 * Exponential moving average smoother to reduce jitter in hand tracking.
 */
class Smoother {
  constructor(factor = 0.3) {
    this.factor = factor;
    this.values = null;
  }

  /** Smooth a new value (or array of values) */
  update(input) {
    if (this.values === null) {
      this.values = Array.isArray(input) ? [...input] : input;
      return this.values;
    }

    if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i++) {
        this.values[i] =
          this.factor * input[i] + (1 - this.factor) * this.values[i];
      }
      return this.values;
    }

    this.values = this.factor * input + (1 - this.factor) * this.values;
    return this.values;
  }

  reset() {
    this.values = null;
  }
}

/**
 * Maps a value from one range to another, clamping to the target range.
 */
function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMin === inMax) return (outMin + outMax) / 2;
  const normalized = (value - inMin) / (inMax - inMin);
  return outMin + Math.min(Math.max(normalized, 0), 1) * (outMax - outMin);
}

/**
 * Finger landmark indices for curl detection.
 * MediaPipe provides 21 landmarks per hand:
 *   0=wrist, 1-4=thumb, 5-8=index, 9-12=middle, 13-16=ring, 17-20=pinky
 *   Each finger: MCP (base), PIP, DIP, TIP
 */
const FINGERS = {
  thumb:  { tip: 4, mcp: 2 },
  index:  { tip: 8, mcp: 5 },
  middle: { tip: 12, mcp: 9 },
  ring:   { tip: 16, mcp: 13 },
  pinky:  { tip: 20, mcp: 17 },
};

/**
 * Compute per-finger curl values from hand landmarks.
 * Returns an object with finger names mapped to 0 (fully open) to 1 (fully curled).
 *
 * Uses the ratio of tip-to-MCP distance to MCP-to-wrist distance:
 *   curl = 1 - (tip→mcp) / (mcp→wrist)
 *
 * When fully open: tip→mcp ≈ 2× (mcp→wrist) → curl ≈ 0 (clamped)
 * When fully curled: tip→mcp ≈ 0             → curl ≈ 1
 *
 * This normalizes for each finger's natural range (thumb vs index vs pinky).
 */
function computeFingerCurls(landmarks) {
  const wrist = landmarks[0];
  const curls = {};

  for (const [name, { tip: tipIdx, mcp: mcpIdx }] of Object.entries(FINGERS)) {
    const tip = landmarks[tipIdx];
    const mcp = landmarks[mcpIdx];

    // 3D distance from fingertip to MCP (finger base)
    const tipToMcp = Math.sqrt(
      (tip.x - mcp.x) ** 2 + (tip.y - mcp.y) ** 2 + (tip.z - mcp.z) ** 2
    );
    // 3D distance from MCP (finger base) to wrist (proxy for finger length)
    const mcpToWrist = Math.sqrt(
      (mcp.x - wrist.x) ** 2 + (mcp.y - wrist.y) ** 2 + (mcp.z - wrist.z) ** 2
    );

    // Normalize: open = tip far from MCP → ratio >= 1 → curl ≈ 0
    //            curled = tip close to MCP → ratio ≈ 0 → curl ≈ 1
    const ratio = mcpToWrist > 0.001 ? tipToMcp / mcpToWrist : 2.0;
    const curl = Math.max(0, Math.min(1, 1 - ratio));
    curls[name] = curl;
  }

  return curls;
}

/**
 * Musical scales (note indices within an octave).
 * C, C#, D, D#, E, F, F#, G, G#, A, A#, B = indices 0-11
 */
const SCALES = {
  pentatonic: [0, 2, 4, 7, 9],                   // C, D, E, G, A
  major: [0, 2, 4, 5, 7, 9, 11],                 // C, D, E, F, G, A, B
  minor: [0, 2, 3, 5, 7, 8, 10],                 // C, D, Eb, F, G, Ab, Bb
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // All 12 semitones
  blues: [0, 3, 5, 6, 7, 10],                    // C, Eb, F, F#, G, Bb
};

/**
 * Converts a normalized 0-1 value to the nearest note in the given scale.
 * @param {number} normalized - Value from 0 to 1
 * @param {number} octave - Octave number (e.g., 4 for middle C)
 * @param {string} scale - Scale name from SCALES
 * @returns {string} Note name like "C4", "E4", "G#5"
 */
function normalizedToNote(normalized, octave = 4, scale = "pentatonic") {
  const scaleNotes = SCALES[scale] || SCALES.pentatonic;
  const index = Math.round(normalized * (scaleNotes.length - 1));
  const clampedIndex = Math.min(Math.max(index, 0), scaleNotes.length - 1);
  const semitone = scaleNotes[clampedIndex];
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteName = noteNames[semitone];
  return `${noteName}${octave}`;
}

/**
 * Creates a GestureInterpreter instance.
 * Processes raw hand data into smoothed, musical-ready values.
 */
export function createGestureInterpreter(options = {}) {
  const positionSmoother = new Smoother(0.25);

  /** Current musical scale for note mapping */
  let currentScale = options.scale || "pentatonic";

  /** Track gesture state changes with clean confirmed/unconfirmed state */
  let lastConfirmedGesture = null; // The last gesture that passed the debounce
  let currentCandidateGesture = null; // Gesture currently being tracked
  let gestureConfirmFrames = 0; // How many consecutive frames we've seen the candidate
  const HOLD_THRESHOLD = 5; // frames to confirm a gesture transition

  // ─── Movement Gesture Detection ───────────────────────────────────

  /** Circular buffer of recent palm positions for movement analysis */
  const POSITION_HISTORY_LENGTH = 30;
  const positionHistory = [];

  /** Cooldown counters to prevent gesture spam */
  let swipeCooldown = 0;
  let circleCooldown = 0;
  const SWIPE_COOLDOWN_FRAMES = 45; // ~750ms
  const CIRCLE_COOLDOWN_FRAMES = 90; // ~1.5s

  /**
   * Detect circular hand movement from position history.
   * Checks if the recent path covers enough angular range and returns near start.
   */
  function detectCircle(positions) {
    if (positions.length < 20) return false;

    // Compute center of the path
    let cx = 0, cy = 0;
    for (const p of positions) {
      cx += p.x;
      cy += p.y;
    }
    cx /= positions.length;
    cy /= positions.length;

    // Compute bounding box and angular coverage
    let minAngle = Infinity, maxAngle = -Infinity;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const p of positions) {
      const angle = Math.atan2(p.y - cy, p.x - cx);
      minAngle = Math.min(minAngle, angle);
      maxAngle = Math.max(maxAngle, angle);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    // Need enough physical spread (not just jitter)
    const spreadX = maxX - minX;
    const spreadY = maxY - minY;
    if (spreadX < 0.08 || spreadY < 0.08) return false;

    // Angular coverage: need at least ~270 degrees
    let totalAngle = maxAngle - minAngle;
    if (totalAngle < 0) totalAngle += Math.PI * 2;
    if (totalAngle < Math.PI * 1.5) return false; // < 270 degrees

    // Check start-to-end proximity (should form a closed loop)
    const start = positions[0];
    const end = positions[positions.length - 1];
    const dist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    if (dist > Math.max(spreadX, spreadY) * 0.5) return false;

    return true;
  }

  /**
   * Analyze recent hand movement for swipe and circle gestures.
   * Updates internal state and returns detected movement gestures.
   * @param {number} palmX - Current raw palm X (0-1)
   * @param {number} palmY - Current raw palm Y (0-1)
   * @returns {{ swipeUp: boolean, swipeDown: boolean, circle: boolean }}
   */
  function detectMovementGestures(palmX, palmY) {
    // Add to position history buffer
    positionHistory.push({ x: palmX, y: palmY });
    if (positionHistory.length > POSITION_HISTORY_LENGTH) {
      positionHistory.shift();
    }

    const result = { swipeUp: false, swipeDown: false, circle: false };

    // Decrease cooldowns
    if (swipeCooldown > 0) swipeCooldown--;
    if (circleCooldown > 0) circleCooldown--;

    // Swipe detection: check velocity over last ~5 frames
    if (positionHistory.length >= 5 && swipeCooldown === 0) {
      const recent = positionHistory.slice(-5);
      const first = recent[0];
      const last = recent[recent.length - 1];
      const dy = last.y - first.y;
      const dx = last.x - first.x;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Vertical motion must dominate horizontal motion (swipe is mostly vertical)
      if (dist > 0.12 && Math.abs(dy) > Math.abs(dx) * 1.5) {
        if (dy < -0.12) {
          result.swipeUp = true;
          swipeCooldown = SWIPE_COOLDOWN_FRAMES;
        } else if (dy > 0.12) {
          result.swipeDown = true;
          swipeCooldown = SWIPE_COOLDOWN_FRAMES;
        }
      }
    }

    // Circle detection
    if (positionHistory.length >= 20 && circleCooldown === 0) {
      if (detectCircle(positionHistory)) {
        result.circle = true;
        circleCooldown = CIRCLE_COOLDOWN_FRAMES;
      }
    }

    return result;
  }

  /** Set the active musical scale */
  function setScale(scaleName) {
    if (SCALES[scaleName]) {
      currentScale = scaleName;
    }
  }

  /** Get the current scale name */
  function getScale() {
    return currentScale;
  }

  /**
   * Process raw hand data from hand-tracker.
   * @param {Object} handData - Raw hand data from hand tracker
   * @returns {Object} Interpreted gesture data
   */
  function interpret(handData) {
    if (!handData || !handData.hands || handData.hands.length === 0) {
      // No hand detected — reset all gesture state immediately
      lastConfirmedGesture = null;
      currentCandidateGesture = null;
      gestureConfirmFrames = 0;
      return {
        hasHand: false,
        hands: [],
        smoothedX: 0.5,
        smoothedY: 0.5,
      openness: 0.5,
      fingerCurls: null,
      currentNote: "C4",
      gesture: null,
      gestureJustChanged: false,
      movementGesture: null,
      movementGestureJustChanged: false,
    };
  }

    const results = [];

    for (const hand of handData.hands) {
      const { landmarks, gesture, handedness } = hand;

      if (!landmarks || landmarks.length < 21) {
        results.push({
          handedness,
          hasHand: false,
          gesture: null,
          palmX: 0.5,
          palmY: 0.5,
          openness: 0.5,
          note: "C4",
        });
        continue;
      }

      // Palm center = landmark 0 (wrist) or average of key points
      const wrist = landmarks[0];
      const indexMCP = landmarks[5]; // Index finger base
      const pinkyMCP = landmarks[17]; // Pinky finger base
      const palmX = (wrist.x + indexMCP.x + pinkyMCP.x) / 3;
      const palmY = (wrist.y + indexMCP.y + pinkyMCP.y) / 3;

      // Hand openness: distance between fingertip and palm base
      // Average of all 5 fingers' tip-to-MCP distances
      const fingerTips = [4, 8, 12, 16, 20]; // Thumb, index, middle, ring, pinky tips
      const fingerMCPs = [2, 5, 9, 13, 17]; // Corresponding bases
      let totalDist = 0;
      for (let i = 0; i < fingerTips.length; i++) {
        const tip = landmarks[fingerTips[i]];
        const base = landmarks[fingerMCPs[i]];
        const dist = Math.sqrt(
          (tip.x - base.x) ** 2 + (tip.y - base.y) ** 2 + (tip.z - base.z) ** 2
        );
        totalDist += dist;
      }
      const openness = Math.min(totalDist, 1);

      // Detect gesture changes (debounced) — only on primary hand (first in loop)
      let gestureJustChanged = false;
      if (gesture && results.length === 0) {
        if (gesture.name === currentCandidateGesture) {
          // Same gesture as last frame — increment confirm counter
          gestureConfirmFrames++;
          // When confirmed and different from the last CONFIRMED gesture: fire event
          if (gestureConfirmFrames === HOLD_THRESHOLD &&
              gesture.name !== lastConfirmedGesture) {
            gestureJustChanged = true;
            lastConfirmedGesture = gesture.name;
          }
        } else {
          // New gesture candidate — start counting
          currentCandidateGesture = gesture.name;
          gestureConfirmFrames = 0;
        }
      } else if (!gesture && results.length === 0) {
        // No gesture this frame — gently decay confirm count (handles dropped frames)
        gestureConfirmFrames = Math.max(0, gestureConfirmFrames - 1);
      }

      // Per-finger curl detection for drum mode
      const fingerCurls = computeFingerCurls(landmarks);

      // Map palm position to note using the current scale
      const note = normalizedToNote(1 - palmY, 4, currentScale);

      results.push({
        handedness,
        hasHand: true,
        gesture: gesture || null,
        gestureJustChanged,
        palmX,
        palmY,
        openness,
        note,
        landmarks,
        fingerCurls,
        // Movement gesture will be filled in after smoothing
        movementGesture: null,
        movementGestureJustChanged: false,
      });
    }

    // Smooth the primary hand's position
    const primaryHand = results[0];
    const smoothed = positionSmoother.update(
      primaryHand ? [primaryHand.palmX, primaryHand.palmY] : [0.5, 0.5]
    );

    // Detect movement gestures only from the PRIMARY hand's smoothed position
    // (called once, outside the per-hand loop, to avoid position history corruption)
    let movementGesture = null;
    let movementGestureJustChanged = false;
    if (primaryHand) {
      const movement = detectMovementGestures(smoothed[0], smoothed[1]);
      movementGesture = movement.circle ? "circle" : movement.swipeUp ? "swipe_up" : movement.swipeDown ? "swipe_down" : null;
      movementGestureJustChanged = movement.circle || movement.swipeUp || movement.swipeDown;
    }

    return {
      hasHand: results.some((h) => h.hasHand === true),
      hands: results,
      smoothedX: smoothed[0],
      smoothedY: smoothed[1],
      openness: primaryHand?.openness ?? 0.5,
      fingerCurls: primaryHand?.fingerCurls ?? null,
      currentNote: primaryHand?.note ?? "C4",
      gesture: primaryHand?.gesture ?? null,
      gestureJustChanged: primaryHand?.gestureJustChanged ?? false,
      // Movement-based gestures (circle, swipe_up, swipe_down) from primary hand
      movementGesture,
      movementGestureJustChanged,
    };
  }

  function reset() {
    positionSmoother.reset();
    lastConfirmedGesture = null;
    currentCandidateGesture = null;
    gestureConfirmFrames = 0;
    positionHistory.length = 0;
    swipeCooldown = 0;
    circleCooldown = 0;
  }

  return { interpret, reset, setScale, getScale };
}

export { normalizedToNote, SCALES, mapRange, Smoother };
