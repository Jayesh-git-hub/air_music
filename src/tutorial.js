/**
 * tutorial.js
 * Interactive Tutorial — Guided Gesture Exercises.
 * Walks users through each gesture step-by-step with visual cues.
 * Auto-advances when the user successfully performs each exercise.
 */

// ─── Exercise Definitions ────────────────────────────────────────────────

const EXERCISES = [
  {
    id: "show_hand",
    title: "👋 Show Your Hand",
    description: "Hold your hand up to the camera so the system can see it.",
    detail: "Make sure your whole hand is visible in the frame. A green skeleton overlay will appear over your fingers.",
    gesture: null,
    check: (data) => data.hasHand,
    duration: 1000, // Hold for 1 second
    successMsg: "✅ Hand detected!",
    icon: "🖐️",
  },
  {
    id: "move_up_down",
    title: "↕️ Pitch Control",
    description: "Move your hand UP and DOWN to change notes.",
    detail: "Hand up = higher pitch. Hand down = lower pitch. Try to reach the top and bottom of the frame!",
    gesture: null,
    check: (data) => {
      if (!data.hasHand) return false;
      const range = Math.abs(data.smoothedY - 0.5) * 2;
      return range > 0.6;
    },
    duration: 800,
    successMsg: "✅ You moved through the pitch range!",
    icon: "🎵",
  },
  {
    id: "move_left_right",
    title: "↔️ Filter Control",
    description: "Move your hand LEFT and RIGHT to sweep the filter.",
    detail: "Left = darker sound (low-pass filter). Right = brighter sound (open filter).",
    gesture: null,
    check: (data) => {
      if (!data.hasHand) return false;
      const range = Math.abs(data.smoothedX - 0.5) * 2;
      return range > 0.6;
    },
    duration: 800,
    successMsg: "✅ Filter sweep complete!",
    icon: "🎛️",
  },
  {
    id: "open_close",
    title: "🖐️✊ Open & Close",
    description: "Open your hand wide, then close it into a fist.",
    detail: "Open hand = more reverb and delay (spacy sound). Closed fist = tight, dry sound.",
    gesture: null,
    check: (data) => {
      if (!data.hasHand) return false;
      return data.openness > 0.7 || data.openness < 0.3;
    },
    duration: 600,
    successMsg: "✅ Openness detected!",
    icon: "🎚️",
  },
  {
    id: "make_fist",
    title: "✊ Make a Fist",
    description: "Close your hand into a tight fist.",
    detail: "This also sets the tempo! The app detects fist pumps to calculate BPM.",
    gesture: "Closed_Fist",
    check: (data) => data.gesture?.name === "Closed_Fist" && data.gestureJustChanged,
    duration: 0,
    successMsg: "✅ Fist detected! 👊",
    icon: "✊",
  },
  {
    id: "open_palm",
    title: "✋ Open Palm",
    description: "Open your hand with all fingers spread wide.",
    detail: "Open palm adds reverb to your sound and can stop loop recording.",
    gesture: "Open_Palm",
    check: (data) => data.gesture?.name === "Open_Palm" && data.gestureJustChanged,
    duration: 0,
    successMsg: "✅ Open palm detected!",
    icon: "✋",
  },
  {
    id: "peace",
    title: "✌️ Peace Sign",
    description: "Make a peace sign (index + middle finger up).",
    detail: "The Victory gesture is one of several MediaPipe-recognized hand signs!",
    gesture: "Victory",
    check: (data) => data.gesture?.name === "Victory" && data.gestureJustChanged,
    duration: 0,
    successMsg: "✅ Peace! ✌️",
    icon: "✌️",
  },
  {
    id: "thumbs_up",
    title: "👍 Thumbs Up",
    description: "Give a thumbs up!",
    detail: "Thumbs up toggles loop playback. Try it with the Loop Station!",
    gesture: "Thumb_Up",
    check: (data) => data.gesture?.name === "Thumb_Up" && data.gestureJustChanged,
    duration: 0,
    successMsg: "✅ Thumbs up! 👍",
    icon: "👍",
  },
  {
    id: "circle",
    title: "🔄 Draw a Circle",
    description: "Draw a circle in the air with your hand.",
    detail: "Circles start recording in the Loop Station. Move your hand in a smooth circle!",
    gesture: null,
    check: (data) => data.movementGesture === "circle" && data.movementGestureJustChanged,
    duration: 0,
    successMsg: "✅ Circle detected! 🔄",
    icon: "⭕",
  },
  {
    id: "swipe_up",
    title: "⬆️ Swipe Up",
    description: "Swipe your hand upward quickly.",
    detail: "Swipe up adds a new layer to your loop while existing layers keep playing.",
    gesture: null,
    check: (data) => data.movementGesture === "swipe_up" && data.movementGestureJustChanged,
    duration: 0,
    successMsg: "✅ Swipe up! ⬆️",
    icon: "⬆️",
  },
  {
    id: "complete",
    title: "🎉 Tutorial Complete!",
    description: "You've learned all the gestures!",
    detail: "Try switching to different instruments (Air Drums, FX Pad) and exploring on your own. You're ready to make music! 🎵",
    gesture: null,
    check: () => false, // Never auto-advance
    duration: 0,
    successMsg: "",
    icon: "🏆",
    isComplete: true,
  },
];

// ─── Tutorial Engine ─────────────────────────────────────────────────────

export function createTutorial() {
  let currentStep = 0;
  let isActive = false;
  let stepStartTime = 0;
  let holdStartTime = 0;
  let isHolding = false;
  let onUpdate = null; // Callback for UI updates
  let onComplete = null; // Callback when tutorial finishes

  /** Get the current exercise */
  function getCurrentExercise() {
    return EXERCISES[currentStep] || EXERCISES[0];
  }

  /** Get the current step index */
  function getCurrentStep() {
    return currentStep;
  }

  /** Get total number of exercises (excluding the completion step) */
  function getTotalSteps() {
    return EXERCISES.length - 1; // Exclude the completion step
  }

  /** Check if tutorial is active */
  function getIsActive() {
    return isActive;
  }

  /** Start the tutorial */
  function start() {
    currentStep = 0;
    isActive = true;
    stepStartTime = Date.now();
    holdStartTime = 0;
    isHolding = false;
    notifyUpdate();
  }

  /** Stop the tutorial */
  function stop() {
    isActive = false;
    currentStep = 0;
    holdStartTime = 0;
    isHolding = false;
    notifyUpdate();
  }

  /** Skip to a specific step */
  function goToStep(step) {
    if (step < 0) step = 0;
    if (step >= EXERCISES.length) step = EXERCISES.length - 1;
    currentStep = step;
    stepStartTime = Date.now();
    holdStartTime = 0;
    isHolding = false;
    notifyUpdate();
  }

  /** Advance to the next step */
  function nextStep() {
    if (currentStep < EXERCISES.length - 1) {
      currentStep++;
      stepStartTime = Date.now();
      holdStartTime = 0;
      isHolding = false;

      // Check if we hit the completion step
      if (EXERCISES[currentStep].isComplete && onComplete) {
        onComplete();
      }

      notifyUpdate();
    }
  }

  /** Go back one step */
  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      stepStartTime = Date.now();
      holdStartTime = 0;
      isHolding = false;
      notifyUpdate();
    }
  }

  /**
   * Process hand data each frame to check exercise completion.
   * Call this from the hand tracking pipeline.
   * @param {Object} data - Interpreted gesture data from gesture-interpreter
   */
  function processFrame(data) {
    if (!isActive) return;

    const exercise = getCurrentExercise();

    // Completion step never auto-advances
    if (exercise.isComplete) return;

    const now = Date.now();

    // Check if gesture condition is met
    const conditionMet = exercise.check(data);

    if (conditionMet) {
      if (!isHolding) {
        isHolding = true;
        holdStartTime = now;
      }

      const holdDuration = now - holdStartTime;
      const progress = exercise.duration > 0 ? Math.min(holdDuration / exercise.duration, 1) : 1;

      if (progress >= 1) {
        // Exercise complete! Advance to next step
        nextStep();
        return;
      }

      notifyUpdate(progress);
    } else {
      if (isHolding) {
        isHolding = false;
        holdStartTime = 0;
        notifyUpdate(0);
      }
    }
  }

  /** Get the current hold progress (0-1) */
  function getProgress() {
    if (!isHolding) return 0;
    const exercise = getCurrentExercise();
    if (exercise.duration <= 0) return 1;
    const elapsed = Date.now() - holdStartTime;
    return Math.min(elapsed / exercise.duration, 1);
  }

  /** Register a callback for UI updates */
  function setOnUpdate(cb) {
    onUpdate = cb;
  }

  /** Register a callback for tutorial completion */
  function setOnComplete(cb) {
    onComplete = cb;
  }

  function notifyUpdate(progress) {
    if (onUpdate) {
      onUpdate({
        isActive,
        step: currentStep,
        total: EXERCISES.length,
        exercise: getCurrentExercise(),
        progress: progress != null ? progress : getProgress(),
        isComplete: EXERCISES[currentStep]?.isComplete || false,
        isHolding,
      });
    }
  }

  return {
    start,
    stop,
    nextStep,
    prevStep,
    goToStep,
    processFrame,
    getCurrentExercise,
    getCurrentStep,
    getTotalSteps,
    getIsActive,
    getProgress,
    setOnUpdate,
    setOnComplete,
  };
}
