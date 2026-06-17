/**
 * visualizer.js
 * Canvas-based visualizations with 4 display modes:
 *   spectrum  — 3D frequency bars + waveform
 *   particles — Hand trail particle system reacting to audio
 *   circular  — Waveform wrapped around a circle
 *   heatmap   — Fading hand position history overlay
 *
 * Always-on: beat indicator, note glow, gesture info overlay.
 */

// ─── Particle System ──────────────────────────────────────────────────

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.3 + Math.random() * 0.8;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 0.3;
    this.life = 1.0;
    this.decay = 0.008 + Math.random() * 0.012;
    this.size = 1.5 + Math.random() * 3;
    this.color = color;
    this.hue = Math.random() * 60 + 120; // green-cyan range
  }

  update(audioIntensity = 0) {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.01; // gravity
    this.life -= this.decay + audioIntensity * 0.005;
    this.size *= 0.995;
    return this.life > 0;
  }

  draw(ctx) {
    const alpha = this.life * 0.7;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color || `hsl(${this.hue}, 80%, 60%)`;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8 * this.life;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(this.size, 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Visualizer ───────────────────────────────────────────────────────

export function createAudioVisualizer(canvasEl) {
  const ctx = canvasEl.getContext("2d");
  let animationId = null;
  let analyserNode = null;
  let gestureData = null;

  // ─── Mode state ────────────────────────────────────────────────────
  let currentMode = "spectrum"; // "spectrum" | "particles" | "circular" | "heatmap"
  let currentModeLabel = "3D Spectrum";

  const modeLabels = {
    spectrum: "3D Spectrum",
    particles: "Particles",
    circular: "Circular",
    heatmap: "Heatmap",
  };

  // ─── Beat indicator ────────────────────────────────────────────────
  let beatFlashIntensity = 0;
  let beatFlashColor = "#00FF88";

  // ─── Note glow ─────────────────────────────────────────────────────
  let noteGlowIntensity = 0;
  let noteGlowColor = "#00FF88";
  let lastNoteName = "";

  // ─── Particle system state ─────────────────────────────────────────
  let particles = [];
  const MAX_PARTICLES = 200;

  // ─── Heatmap state ─────────────────────────────────────────────────
  let heatPoints = [];
  const MAX_HEAT_POINTS = 100;
  let heatFrame = 0;

  // ─── Audio data cache (reused to avoid GC) ─────────────────────────
  const BUFFER_SIZE = 1024;
  const timeData = new Uint8Array(BUFFER_SIZE);
  const freqData = new Uint8Array(BUFFER_SIZE);

  // ─── Equalizer smoothing state ────────────────────────────────────
  const EQ_BAR_COUNT = 30;
  let eqBarHeights = new Array(EQ_BAR_COUNT).fill(0);
  const EQ_SMOOTHING = 0.15; // How fast bars follow audio (lower = smoother)

  // ─── Public API ────────────────────────────────────────────────────

  function setAnalyser(analyser) {
    analyserNode = analyser;
  }

  function updateGestureData(data) {
    gestureData = data;
  }

  function triggerBeatFlash(isDownbeat = false) {
    beatFlashIntensity = 1.0;
    beatFlashColor = isDownbeat ? "#FFCC00" : "#00FF88";
  }

  function setMode(mode) {
    if (modeLabels[mode]) {
      currentMode = mode;
      currentModeLabel = modeLabels[mode];
      // Clear dynamic state on mode switch
      if (mode === "particles") particles = [];
      if (mode === "heatmap") heatPoints = [];
    }
  }

  function getMode() {
    return currentMode;
  }

  function getModeLabel() {
    return currentModeLabel;
  }

  // ─── Drawing helpers ───────────────────────────────────────────────

  /** Get audio data if analyser is available */
  function getAudioData() {
    if (!analyserNode) return null;
    try {
      const waveform = analyserNode.waveform.getValue();
      const frequency = analyserNode.frequency.getValue();
      if (!waveform || !waveform.length) return null;
      // Convert Float32Array (-1..1 for waveform, 0..1 for frequency) to 0..255 byte range
      const len = Math.min(waveform.length, BUFFER_SIZE);
      const flen = Math.min(frequency.length, BUFFER_SIZE);
      for (let i = 0; i < len; i++) {
        timeData[i] = Math.max(0, Math.min(255, Math.round((waveform[i] + 1) * 127.5)));
      }
      for (let i = 0; i < flen; i++) {
        freqData[i] = Math.max(0, Math.min(255, Math.round(frequency[i] * 255)));
      }
      return { timeData, freqData };
    } catch (e) {
      return null;
    }
  }

  /** Draw the animated dark background with subtle gradient */
  let bgHue = 140;
  function drawBackground(w, h) {
    // Subtly shift hue based on gesture data presence
    if (gestureData && gestureData.hasHand) {
      bgHue += 0.15;
    } else {
      bgHue += 0.05;
    }
    
    // Create a subtle animated gradient background
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, `hsl(${bgHue % 360}, 15%, 6%)`);
    grad.addColorStop(0.5, `hsl(${(bgHue + 30) % 360}, 12%, 5%)`);
    grad.addColorStop(1, `hsl(${(bgHue + 60) % 360}, 10%, 4%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Draw subtle grid dots
    ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
    const spacing = 32;
    for (let x = 0; x < w; x += spacing) {
      for (let y = 0; y < h; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Draw the gesture info text overlay */
  function drawGestureInfo(w, h) {
    if (!gestureData) return;
    ctx.font = "13px 'Inter', sans-serif";
    ctx.textAlign = "left";
    const infoY = 22;
    const infoX = 14;

    if (gestureData.hasHand) {
      ctx.fillStyle = "#00FF88";
      ctx.fillText("● Hand Detected", infoX, infoY);
      if (gestureData.gesture) {
        const g = gestureData.gesture.name.replace(/_/g, " ");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(`Gesture: ${g}`, infoX, infoY + 22);
      }
      ctx.fillStyle = "#FFCC00";
      ctx.fillText(`Note: ${gestureData.currentNote}`, infoX, infoY + 44);
      ctx.fillStyle = "#88CCFF";
      ctx.fillText(`Openness: ${Math.round(gestureData.openness * 100)}%`, infoX, infoY + 66);
      for (let i = 0; i < gestureData.hands.length; i++) {
        const h = gestureData.hands[i];
        ctx.fillStyle = i === 0 ? "#00FF88" : "#FF8844";
        ctx.fillText(
          `${h.handedness}: (${Math.round(h.palmX * 100)}, ${Math.round(h.palmY * 100)})`,
          infoX, infoY + 88 + i * 18
        );
      }
    } else {
      ctx.fillStyle = "rgba(255, 100, 100, 0.7)";
      ctx.fillText("○ No Hand Detected", infoX, infoY);
    }
  }

  /** Draw the beat indicator (top-right pulsing circle) */
  function drawBeatIndicator(w, h) {
    if (beatFlashIntensity <= 0.01) return;
    const cx = w - 45;
    const cy = 32;
    const radius = 5 + beatFlashIntensity * 25;
    const alpha = Math.min(beatFlashIntensity * 0.5, 0.35);

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, `rgba(0, 255, 136, ${alpha})`);
    glow.addColorStop(1, "rgba(0, 255, 136, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = beatFlashColor;
    ctx.shadowColor = beatFlashColor;
    ctx.shadowBlur = 8 * beatFlashIntensity;
    ctx.beginPath();
    ctx.arc(cx, cy, 3 + beatFlashIntensity * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    beatFlashIntensity *= 0.92;
  }

  /** Draw the note glow (flash effect when note changes) */
  function drawNoteGlow(w, h) {
    if (noteGlowIntensity <= 0.01) return;
    const alpha = noteGlowIntensity * 0.15;
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    grad.addColorStop(0, noteGlowColor);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1.0;
    noteGlowIntensity *= 0.88;
  }

  /** Check if note changed and trigger glow */
  function checkNoteGlow(data) {
    if (!data || !data.currentNote) return;
    if (data.currentNote !== lastNoteName) {
      lastNoteName = data.currentNote;
      noteGlowIntensity = 1.0;
      // Color based on note name (roughly map to hue)
      const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      const noteIndex = noteNames.indexOf(data.currentNote.replace(/\d/, ""));
      const hue = noteIndex >= 0 ? (noteIndex / 12) * 360 : 120;
      noteGlowColor = `hsl(${hue}, 90%, 60%)`;
    }
  }

  // ─── Mode renderers ────────────────────────────────────────────────

  /**
   * Draw a rounded rectangle with a flat bottom and rounded top.
   * Used for equalizer bars — like Spotify's pill-shaped bars.
   */
  function drawRoundedBar(ctx, x, y, w, h, radius) {
    if (h < radius * 2) {
      // Too short to round; just draw a rect
      ctx.fillRect(x, y, w, h);
      return;
    }
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  /** Mode: Spectrum — Spotify-style equalizer with smooth rounded bars */
  function renderSpectrum(w, h, audio) {
    if (!audio) return;
    const { freqData, timeData } = audio;
    const barCount = EQ_BAR_COUNT;
    const gap = 2; // px gap between bars
    const barWidth = (w / barCount) - gap;
    const radius = Math.min(barWidth / 2, 6); // Rounded top radius
    const maxBarHeight = h * 0.85;
    const minBarHeight = 2;

    // ─── 1. Smooth bar heights ───────────────────────────────────────
    // Map frequency bins to bar indices with non-linear spacing
    // (more bars for low frequencies, fewer for high — like Spotify)
    for (let i = 0; i < barCount; i++) {
      // Non-linear frequency mapping: bias toward low frequencies
      const freqIndex = Math.floor(Math.pow(i / barCount, 0.8) * 80);
      const raw = freqData[Math.min(freqIndex, freqData.length - 1)] / 255;

      // Add some energy from neighboring bins for fullness
      const nextIdx = Math.min(freqIndex + 2, freqData.length - 1);
      const neighbor = freqData[nextIdx] / 255;
      const value = raw * 0.7 + neighbor * 0.3;

      // Apply minimum height and scale
      const targetHeight = minBarHeight + value * (maxBarHeight - minBarHeight);

      // Smooth toward target (fast attack, slow decay)
      const current = eqBarHeights[i];
      if (targetHeight > current) {
        // Attack: follow up quickly
        eqBarHeights[i] = current + (targetHeight - current) * 0.4;
      } else {
        // Decay: fall smoothly
        eqBarHeights[i] = current + (targetHeight - current) * EQ_SMOOTHING;
      }
    }

    // ─── 2. Draw glow beneath the bars ────────────────────────────────
    ctx.save();
    const glowGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
    glowGrad.addColorStop(0, "rgba(29, 185, 84, 0)");
    glowGrad.addColorStop(0.5, "rgba(29, 185, 84, 0.04)");
    glowGrad.addColorStop(1, "rgba(29, 185, 84, 0.08)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // ─── 3. Draw equalizer bars ────────────────────────────────────
    for (let i = 0; i < barCount; i++) {
      const barHeight = Math.max(minBarHeight, eqBarHeights[i]);
      const x = i * (barWidth + gap);
      const y = h - barHeight;

      // Color: green at bottom → cyan at top, with brightness boost for taller bars
      const ratio = barHeight / maxBarHeight;
      const brightness = 55 + ratio * 30;

      // Gradient for each bar (bottom to top)
      const grad = ctx.createLinearGradient(0, y, 0, h);
      grad.addColorStop(0, `hsl(145, 85%, ${brightness - 10}%)`);
      grad.addColorStop(0.5, `hsl(170, 80%, ${brightness}%)`);
      grad.addColorStop(1, `hsl(195, 75%, ${brightness - 15}%)`);

      ctx.fillStyle = grad;

      // Draw rounded bar
      drawRoundedBar(ctx, x, y, barWidth, barHeight, radius);

      // ─── 3b. Subtle highlight on top of tall bars ────────────────
      if (ratio > 0.5) {
        ctx.save();
        ctx.globalAlpha = (ratio - 0.5) * 0.3;
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        const highlightH = Math.min(4, barHeight * 0.1);
        drawRoundedBar(ctx, x + 1, y, barWidth - 2, highlightH, radius * 0.5);
        ctx.restore();
      }
    }

    // ─── 4. Subtle waveform overlay (transparent, thin) ──────────────
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    const sliceWidth = w / timeData.length;
    let wx = 0;
    for (let i = 0; i < timeData.length; i += 4) {
      const v = timeData[i] / 128.0;
      const wy = (v * h) / 2;
      if (i === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
      wx += sliceWidth * 4;
    }
    ctx.stroke();
  }

  /** Mode: Particles — hand trail particle system reacting to audio */
  function renderParticles(w, h, audio) {
    // Emit particles from hand positions
    if (gestureData && gestureData.hasHand) {
      for (const hand of gestureData.hands) {
        const px = hand.palmX * w;
        const py = hand.palmY * h;
        const count = audio ? 2 + Math.floor(audio.freqData[0] / 80) : 2;
        for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
          particles.push(new Particle(
            px + (Math.random() - 0.5) * 20,
            py + (Math.random() - 0.5) * 20
          ));
        }
      }
    }

    // Audio reactivity: intensity from average of low-mid frequencies
    let audioIntensity = 0;
    if (audio) {
      let sum = 0;
      for (let i = 0; i < 20; i++) sum += audio.freqData[i];
      audioIntensity = sum / (20 * 255);
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p.update(audioIntensity)) {
        particles.splice(i, 1);
        continue;
      }
      p.draw(ctx);
    }

    // Draw a faint center glow based on audio energy
    if (audioIntensity > 0.05) {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.3 * audioIntensity);
      grad.addColorStop(0, `rgba(0, 255, 136, ${audioIntensity * 0.1})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // Particle count display
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = "11px 'Inter', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${particles.length} particles`, w - 14, h - 10);
  }

  /** Mode: Circular — waveform wrapped around a circle */
  function renderCircular(w, h, audio) {
    if (!audio) return;
    const { timeData, freqData } = audio;
    const cx = w / 2;
    const cy = h / 2;
    const baseRadius = Math.min(w, h) * 0.3;

    // Outer ring: frequency spectrum
    const ringCount = 48;
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2 - Math.PI / 2;
      const amp = freqData[i * 2] / 255;
      const r = baseRadius + amp * 40;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      const hue = 120 + amp * 120;
      ctx.fillStyle = `hsl(${hue}, 100%, ${50 + amp * 30}%)`;
      ctx.beginPath();
      ctx.arc(x, y, 2 + amp * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Inner ring: waveform
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#00FF88";
    ctx.beginPath();
    const slice = timeData.length / 200;
    for (let i = 0; i < 200; i++) {
      const idx = Math.floor(i * slice);
      const v = timeData[idx] / 128.0;
      const r = baseRadius * 0.6 + (v - 1) * 20;
      const angle = (i / 200) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Center dot
    ctx.fillStyle = "#00FF88";
    ctx.shadowColor = "#00FF88";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /** Mode: Heatmap — fading record of hand positions */
  function renderHeatmap(w, h, audio) {
    heatFrame++;

    // Add current hand positions as heat points
    if (gestureData && gestureData.hasHand) {
      for (const hand of gestureData.hands) {
        heatPoints.push({
          x: hand.palmX * w,
          y: hand.palmY * h,
          frame: heatFrame,
          energy: audio ? audio.freqData[0] / 255 : 0.5,
        });
      }
    }

    // Remove old points
    while (heatPoints.length > MAX_HEAT_POINTS) heatPoints.shift();

    // Draw heat trails
    for (const pt of heatPoints) {
      const age = heatFrame - pt.frame;
      const maxAge = MAX_HEAT_POINTS;
      const alpha = Math.max(0, 1 - age / maxAge) * 0.6;
      const radius = 8 + pt.energy * 20;
      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
      grad.addColorStop(0, `rgba(0, 255, 136, ${alpha})`);
      grad.addColorStop(0.5, `rgba(0, 200, 200, ${alpha * 0.5})`);
      grad.addColorStop(1, `rgba(136, 68, 255, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw grid overlay for spatial reference
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const x = (w / 4) * i;
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw audio-reactive pulse at center
    if (audio && audio.freqData[0] > 30) {
      const intensity = audio.freqData[0] / 255;
      const pulseRadius = 10 + intensity * 60;
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, pulseRadius);
      grad.addColorStop(0, `rgba(255, 204, 0, ${intensity * 0.15})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, pulseRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ─── Main draw loop ────────────────────────────────────────────────

  function draw() {
    const w = canvasEl.width;
    const h = canvasEl.height;

    ctx.clearRect(0, 0, w, h);
    drawBackground(w, h);

    // Check for note change → trigger glow
    checkNoteGlow(gestureData);

    // Get audio data
    const audio = getAudioData();

    // Render active mode
    switch (currentMode) {
      case "spectrum":
        renderSpectrum(w, h, audio);
        break;
      case "particles":
        renderParticles(w, h, audio);
        break;
      case "circular":
        renderCircular(w, h, audio);
        break;
      case "heatmap":
        renderHeatmap(w, h, audio);
        break;
    }

    // Always-on overlays
    drawBeatIndicator(w, h);
    drawNoteGlow(w, h);
    drawGestureInfo(w, h);

    // Mode label (bottom-left)
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "11px 'Inter', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(currentModeLabel, 14, h - 10);

    animationId = requestAnimationFrame(draw);
  }

  function start() {
    if (animationId) return;
    animationId = requestAnimationFrame(draw);
  }

  function stop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    particles = [];
    heatPoints = [];
  }

  return {
    setAnalyser,
    updateGestureData,
    triggerBeatFlash,
    setMode,
    getMode,
    getModeLabel,
    start,
    stop,
  };
}
