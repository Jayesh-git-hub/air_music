/**
 * hand-tracker.js
 * MediaPipe hand tracking module.
 * Initializes the GestureRecognizer and processes webcam frames
 * to extract 21 hand landmarks and gesture classifications.
 */

import { GestureRecognizer, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task";

/**
 * Creates a HandTracker instance.
 * @param {HTMLVideoElement} videoEl - The video element for webcam feed
 * @param {HTMLCanvasElement} canvasEl - The canvas element for drawing overlay
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.numHands=2] - Maximum number of hands to track
 * @param {number} [options.minDetectionConfidence=0.5] - Min confidence for detection
 * @param {number} [options.minTrackingConfidence=0.5] - Min confidence for tracking
 */
export async function createHandTracker(videoEl, canvasEl, options = {}) {
  const {
    numHands = 2,
    minDetectionConfidence = 0.5,
    minTrackingConfidence = 0.5,
  } = options;

  // Initialize MediaPipe
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

  const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands,
    minHandDetectionConfidence: minDetectionConfidence,
    minHandTrackingConfidence: minTrackingConfidence,
  });

  const canvasCtx = canvasEl.getContext("2d");
  const drawingUtils = new DrawingUtils(canvasCtx);

  let lastVideoTime = -1;
  let onFrameCallback = null;
  let animationId = null;
  let isRunning = false;
  let frameCount = 0;
  let watchdogId = null;
  let lastFrameCount = -1;

  /** Callback receives { landmarks, gestures, handedness, timestamp } */
  function setOnFrame(callback) {
    onFrameCallback = callback;
  }

  function processFrame(timestamp) {
    if (!isRunning) return;

    const video = videoEl;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;

      const results = gestureRecognizer.recognizeForVideo(video, timestamp);

      // Clear canvas
      canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);

      if (results.landmarks && results.landmarks.length > 0) {
        // Draw hand connections for each detected hand
        for (const landmarks of results.landmarks) {
          drawingUtils.drawConnectors(
            landmarks,
            GestureRecognizer.HAND_CONNECTIONS,
            { color: "#00FF88", lineWidth: 2 }
          );
          drawingUtils.drawLandmarks(
            landmarks,
            { color: "#FFFFFF", lineWidth: 1, radius: 3 }
          );
        }

        // Extract data for each hand
        const handsData = [];
        for (let i = 0; i < results.landmarks.length; i++) {
          const landmarks = results.landmarks[i];
          const gesture =
            results.gestures[i]?.length > 0
              ? {
                  name: results.gestures[i][0].categoryName,
                  score: results.gestures[i][0].score,
                }
              : null;
          const handedness =
            results.handedness[i]?.length > 0
              ? results.handedness[i][0].categoryName
              : "Unknown";

          handsData.push({ landmarks, gesture, handedness });
        }

        if (onFrameCallback) {
          try {
            onFrameCallback({
              hands: handsData,
              timestamp,
            });
          } catch (err) {
            console.error("HandTracker: frame callback error (animation loop kept alive):", err);
          }
        }
      }
    }

    frameCount++;
    animationId = requestAnimationFrame(processFrame);
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    frameCount = 0;
    lastFrameCount = -1;
    animationId = requestAnimationFrame(processFrame);
    // Watchdog: check every 2 seconds that the animation loop is alive
    watchdogId = setInterval(() => {
      if (!isRunning) {
        if (watchdogId) {
          clearInterval(watchdogId);
          watchdogId = null;
        }
        return;
      }
      // If frameCount hasn't increased, the animation loop died — restart it
      if (frameCount === lastFrameCount && lastFrameCount !== -1) {
        console.warn("HandTracker: watchdog detected stalled loop, restarting...");
        if (animationId) cancelAnimationFrame(animationId);
        animationId = requestAnimationFrame(processFrame);
      }
      lastFrameCount = frameCount;
    }, 2000);
  }

  function stop() {
    isRunning = false;
    if (watchdogId) {
      clearInterval(watchdogId);
      watchdogId = null;
    }
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  function close() {
    stop();
    gestureRecognizer.close();
  }

  /** Get the current frame count (for health monitoring) */
  function getFrameCount() {
    return frameCount;
  }

  /** Check if the tracking loop is actively running */
  function isTrackingActive() {
    return isRunning && animationId !== null;
  }

  return {
    setOnFrame,
    start,
    stop,
    close,
    getFrameCount,
    isTrackingActive,
  };

}
