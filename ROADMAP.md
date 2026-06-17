# 🎵 Gesture Music Studio — Roadmap

> A browser-based music making website where users control instruments
> with hand gestures via webcam and MediaPipe AI.

---

## ✅ Phase 1: Project Scaffold + Hand Tracking (DONE)

**What was built:**
| File | Purpose |
|---|---|
| `index.html` | Main page with webcam, canvas overlays, instrument selector, gesture guide |
| `style.css` | Dark neon theme with responsive layout |
| `src/main.js` | App entry point wiring webcam → MediaPipe → Tone.js → visualizer |
| `src/hand-tracker.js` | MediaPipe GestureRecognizer — 21 hand landmarks + gesture classification |
| `src/gesture-interpreter.js` | Smoothing (EMA filter), note mapping to pentatonic scale, openness detection |
| `src/visualizer.js` | Waveform display, frequency bars, gesture info overlay |

**Working features:**
- [x] Webcam capture and display
- [x] MediaPipe hand tracking (21 landmarks per hand, up to 2 hands)
- [x] Hand skeleton overlay on canvas (green connections, white landmarks)
- [x] Gesture classification (fist, open palm, peace, pointing, thumbs up/down, etc.)
- [x] Gesture smoothing (exponential moving average)
- [x] Air Theremin instrument (Y = pitch, X = filter cutoff)
- [x] FM Synth / Kaoss Pad instrument (X = modulation, Y = volume)
- [x] Effects chain (reverb + delay serial routing)
- [x] Throttled audio parameter updates (no zipper noise)
- [x] Waveform + frequency spectrum visualizer
- [x] Real-time info panel (note, volume, filter, openness, gesture name)
- [x] Scale quantizer (pentatonic scale — always sounds good)
- [x] Proper cleanup on page unload (webcam, audio, ML model)

**Architecture:**
```
Webcam → MediaPipe (hand landmarks) → Gesture Interpreter (smooth + map)
                                                    ↓
                                              Tone.js Engine
                                           (synth → reverb → delay → master)
                                                    ↓
                                         Visualizer + Info Panel
```

**Tech stack:**
- `@mediapipe/tasks-vision` — real-time hand tracking in browser via WebGPU
- `Tone.js` — Web Audio API framework for synthesis and effects
- `Vite` — dev server and bundler

---

## ✅ Phase 2: Air Drum Kit (DONE)

**Goal:** Map individual finger curls to drum sounds.

| Finger | Sound |
|---|---|
| Thumb | Kick drum (layered `Tone.MembraneSynth` with pitch sweep) |
| Index | Snare drum (shell body + wire buzz — dual layer) |
| Middle | Closed hi-hat (crisp `Tone.MetalSynth`) |
| Ring | Open hi-hat (longer `Tone.MetalSynth`) |
| Pinky | Clap / Crash (white + brown noise layers) |
| Fist | Drum fill / transition effect |

**What was built:**
- [x] Finger curl detection via fingertip-to-palm distances (landmarks 4,8,12,16,20 → 0,5,17)
- [x] Debounce with threshold-based triggering (`DRUM_CURL_THRESHOLD = 0.55`, release at 0.35)
- [x] Professional drum synth engine: compressor bus, high/low-pass filters, room reverb, slap delay
- [x] Layered snare (MembraneSynth body + filtered NoiseSynth wires)
- [x] Dual-layer clap (white noise attack + brown noise body)
- [x] 4 drum mapping presets: Standard, Reversed, Electronic, Lo-Fi
- [x] Velocity-sensitive hits (curl amount → MIDI velocity 1-127)
- [x] Visual feedback: curl bars, triggered indicators, hit animations
- [x] Drum mode gesture guide with finger-to-sound mapping
- [x] Quantize support for drum hits

**What was built:**
| File | Changes |
|---|---|
| `src/main.js` | Full drum kit `createInstrument("drumkit")` with bus processing, 5 sounds, velocity, 4 mappings |
| `src/gesture-interpreter.js` | `fingerCurls` output (thumb → pinky curl values 0-1) |
| `index.html` | Drum mode guide grid, drum mapping selector, `data-finger` attributes for visual feedback |
| `style.css` | Drum grid layout, curl bars, hit animations, `.drum-triggered` styles |

---

## ✅ Phase 3: Note Scale Selector + Arpeggiator (DONE)

**Goal:** Let users switch between musical scales and add rhythmic patterns.

**Scales supported:**
- [x] Pentatonic (happy, safe — default)
- [x] Major (bright, diatonic)
- [x] Minor (dark, emotional)
- [x] Chromatic (all notes — experimental)
- [x] Blues (minor pentatonic + flat 5th)

**Arpeggiator:**
- [x] 4 patterns: Up, Down, Up/Down, Random
- [x] Speed controlled by hand openness (open = faster, closed = slower)
- [x] Visual indicator in info panel
- [x] Keyboard shortcut `A` to toggle

**What was built:**
| File | Changes |
|---|---|
| `src/gesture-interpreter.js` | All 5 scales defined, `setScale()` API, `getScale()` API |
| `src/main.js` | Full arpeggiator engine: `startArpeggiator()`, `stopArpeggiator()`, `toggleArpeggiator()` |
| `index.html` | Scale dropdown, arp toggle button, arp pattern selector |

---

## ✅ Phase 4: Loop Station (DONE)

**Goal:** Record gesture performances and layer them as audio loops.

**Flow:**
1. Draw circle in air → start recording
2. Play normally — all audio is captured
3. Open palm → stop recording, loop it
4. Swipe up → add new layer (record over existing loops)
5. Swipe down → remove last layer
6. Thumbs up → play all loops
7. Thumbs down → stop all loops

**What was built:**
- [x] `Tone.Recorder` captures master output in real-time
- [x] `Tone.Player` with `loop = true` for seamless playback
- [x] Gesture-driven: circle → record, open palm → stop, swipe up/down → add/remove
- [x] Thumbs up/down for play/stop all
- [x] Layer count display with visual chips
- [x] Recording indicator with pulsing REC badge
- [x] Proper cleanup on dispose

**What was built:**
| File | Purpose |
|---|---|
| `src/loop-station.js` (new) | `createLoopStation()` — full recording + layered playback API |
| `src/main.js` | Gesture → loop station wiring in frame callback |
| `index.html` | Loop station UI: layer count, rec indicator, gesture hints |
| `style.css` | Loop station styles, layer chips, REC pulse animation |

---

## ✅ Phase 5: Tempo & Beat Controls (DONE)

**Goal:** Set BPM with gestures and quantize everything to the beat.

**Features:**
- [x] Tap tempo: fist pump 3+ times to set BPM (2-second tap window)
- [x] Metronome click track with accent on downbeat (C5 vs C4)
- [x] Quantize note triggers: Off, 1 bar, 1/2, 1/4, 1/8, 1/16
- [x] Visual beat flash on downbeat (via `visualizer.triggerBeatFlash()`)
- [x] BPM slider UI (40-200 BPM) with keyboard shortcuts `+`/`-`

**What was built:**
| File | Changes |
|---|---|
| `src/main.js` | `handleTapTempo()`, `setupMetronome()`, quantize routing in `updateAudio()`, keyboard shortcuts |
| `src/visualizer.js` | `triggerBeatFlash()` — pulsing beat indicator |
| `index.html` | BPM slider with display, metronome toggle, quantize dropdown |

---

## ✅ Phase 6: Enhanced Visualizers (DONE)

**Goal:** Make the visualizer look amazing.

**Visual modes:**
- [x] 3D Spectrum bars — frequency bars with depth and rotation
- [x] Particle system — hand trail leaves glowing particle trails
- [x] Circular visualizer — waveform wrapped in a circle
- [x] Hand heat map — show where hands have been (gesture trail heatmap)
- [x] Note glow — flash color per note played
- [x] Beat flash indicator — pulsing on downbeats
- [x] Gesture data overlay (openness, note, volume)
- [x] Mode switching via buttons or keyboard shortcut `V`

**What was built:**
| File | Changes |
|---|---|
| `src/visualizer.js` | `setMode()` — 4 visualization modes, `triggerBeatFlash()`, `updateGestureData()` |
| `index.html` | Mode selection buttons, mode label |
| `style.css` | Visualizer container, mode button styles |

---

## ✅ Phase 7: Dedicated FX Pad (DONE)

**Goal:** A dedicated mode where hand position controls effect parameters on a drone.

**X/Y Axis control (user-selectable):**
| Parameter | Range |
|---|---|
| Reverb Mix | 0 — 0.9 |
| Delay Time | 32nd note to whole note (exponential) |
| Delay Feedback | 0 — 0.9 |
| Filter Frequency | 80 — 6000 Hz (exponential) |
| Filter Resonance | 0.5 — 12 |
| Distortion | 0 — 0.9 |
| Chorus Depth | 0 — 1 |

**What was built:**
- [x] FM Synth drone with full effects chain (distortion → chorus → filter → reverb → delay)
- [x] 7 effect parameters assignable to X or Y axis via dropdowns
- [x] Real-time grid display with parameter values and axis indicators
- [x] Visual X/Y pad canvas with crosshair and target dot
- [x] Openness mapped to additional expression

**What was built:**
| File | Changes |
|---|---|
| `src/main.js` | `createInstrument("fxpad")` — drone synth + 5 effects with X/Y mapping |
| `index.html` | FX axis selectors, X/Y pad canvas, FX guide |
| `style.css` | FX pad canvas, grid display, axis labels |

---

## 🏆 Phase 8: MIDI Export, Presets & Sharing (DONE)

**Goal:** Save, share, and export your creations.

**Features:**
- [x] Save instrument presets (JSON with all parameters) via localStorage
- [x] Load presets from a list
- [x] Delete presets
- [x] Export recorded performance as MIDI file (Standard MIDI File .mid)
- [x] Export as audio (WAV download) via Tone.Recorder
- [x] Share link (URL-encoded preset) — copies shareable URL to clipboard

**What was built:**
| File | Purpose |
|---|---|
| `src/midi-exporter.js` (new) | Pure-JS MIDI event recorder + Standard MIDI File generator (no deps) |
| `src/presets.js` (updated) | Added `generateShareUrl()`, `copyShareUrlToClipboard()`, `checkUrlForSharedPreset()`, `encodePresetToShare()`, `decodePresetFromShare()` |
| `src/main.js` (updated) | MIDI recording pipeline in hand tracking frame, export/share/AI melody button handlers |
| `index.html` (updated) | MIDI export button (🎵 MIDI), share link button (🔗), AI melody toggle (🤖 AI) |
| `style.css` (updated) | `.btn-midi`, `.btn-share`, `.btn-ai`, `.ai-status` styles |

---

## 🏆 Phase 9: AI Melody Generator (DONE)

**Goal:** AI-generated melodies using Magenta.js MusicRNN.

**AI melodies (Magenta.js):**
- [x] Magenta.js loaded dynamically from CDN (no npm dependency)
- [x] MusicRNN melody continuation model
- [x] Hand-played notes feed the AI context
- [x] Generated melodies play through current synth
- [x] Toggle on/off with button in header
- [x] AI model loads on first activation

**What was built:**
| File | Purpose |
|---|---|
| `src/ai-melody.js` (new) | Magenta.js CDN loader, MusicRNN init, `generateMelody()`, `addNoteToContext()` |
| `src/main.js` (updated) | AI melody toggle + scheduler, feeds gesture notes to AI context |

**Architecture:**
```
Hand gestures → notes played → added to AI context (NoteSequence)
                                                    ↓
                                           MusicRNN model
                                           (melody continuation)
                                                    ↓
                                        Generated notes played
                                        through current Tone.js synth
```

**How to use:**
1. Select Air Theremin or Kaoss Pad
2. Click "🤖 AI" button in the header
3. Play some notes with your hand — the AI learns your style
4. Generated melodies will play through your synth
5. Click again to disable

## 🥇 Phase 10: Song Guide (DONE)

**Goal:** Step-by-step instructions for playing popular melodies with hand gestures.

**Songs included:**
| Song | Artist | Difficulty | Scale |
|---|---|---|---|
| My Girl | The Temptations | ⭐ Easy | Pentatonic |
| Amazing Grace | Traditional Hymn | ⭐ Easy | Pentatonic |
| Hallelujah | Leonard Cohen | ⭐⭐ Medium | Major |
| Auld Lang Syne | Traditional | ⭐ Easy | Pentatonic |
| When the Saints Go Marching In | Traditional Jazz | ⭐⭐ Medium | Pentatonic |
| Stand By Me | Ben E. King | ⭐⭐ Medium | Major |

**What was built:**
| File | Purpose |
|---|---|
| `src/song-guide.js` (new) | `createSongGuide()` — 6 songs with sections, steps, settings |
| `src/main.js` | Song guide UI rendering, navigation, "Apply Settings" button |
| `index.html` | Song guide panel with dropdown, step nav, apply button |
| `style.css` | Song guide card, step list, meta tags |

---

## 🥇 Phase 11: Tutorial Mode (DONE)

**Goal:** Guided gesture exercises for new users.

**Exercises (10 steps):**
1. 👋 Show Your Hand
2. ↕️ Pitch Control
3. ↔️ Filter Control
4. 🖐️✊ Open & Close
5. ✊ Make a Fist
6. ✋ Open Palm
7. ✌️ Peace Sign
8. 👍 Thumbs Up
9. 🔄 Draw a Circle
10. 🎉 Complete

**What was built:**
| File | Purpose |
|---|---|
| `src/tutorial.js` (new) | `createTutorial()` — exercise definitions, hold detection, progress tracking |
| `src/main.js` | Tutorial wiring in frame pipeline, UI updates, completion callback |
| `index.html` | Tutorial panel with progress bar, hold bar, nav buttons |
| `style.css` | Tutorial panel, progress bars, hold fill animation |

---

## 📦 Other Features

### Health Indicator
- Real-time FPS counter (15-frame rolling average)
- Frame counter (# of frames processed)
- Stalled detection (3+ seconds without callback → "STALL" warning)
- Green dot indicator with stalled state styling

### Keyboard Shortcuts
| Key | Action |
|---|---|
| `1` | Air Theremin |
| `2` | Air Drums |
| `3` | Kaoss Pad |
| `4` | FX Pad |
| `M` | Toggle Metronome |
| `A` | Toggle Arpeggiator |
| `Q` | Cycle Quantize |
| `V` | Cycle Visualizer Mode |
| `T` | Open Tutorial |
| `S` | Cycle Scale |
| `R` | Cycle Drum Mapping |
| `+` / `-` | Adjust BPM |

### Drum Mappings
| Mapping | Thumb | Index | Middle | Ring | Pinky |
|---|---|---|---|---|---|
| 🥁 Standard | Kick | Snare | HH Closed | HH Open | Clap |
| 🔄 Reversed | Clap | HH Open | HH Closed | Snare | Kick |
| ⚡ Electronic | Kick | Clap | HH Closed | HH Open | Snare |
| 🎧 Lo-Fi | Kick | HH Closed | Snare | Clap | HH Open |

### Visualizer Modes
- 📊 3D Spectrum — frequency bars with depth/rotation
- ✨ Particles — hand trail leaves glowing particle trails
- ⭕ Circular — waveform wrapped in a circle
- 🌡️ Heatmap — gesture trail heat map

### Test Files
| File | Purpose |
|---|---|
| `src/gesture-interpreter.test.js` | Gesture interpreter unit tests |
| `src/midi-exporter.test.js` | MIDI exporter unit tests |
| `vitest.config.js` | Vitest configuration |

---

## 🧪 Future Ideas

- [ ] Multi-user jam (WebRTC — play music together remotely)
- [ ] Visual themes (light/dark/custom colors)
- [ ] Mobile support (front-facing camera on phones)
- [ ] Voice control hybrid (hand + voice commands)
- [ ] Hardware MIDI controller bridge (WebMIDI)
- [ ] Export to Ableton Live Set
- [ ] Social sharing (record video of your performance)

---

## 📁 Project Structure

```
gesture-music-app/
├── index.html                # Main HTML page
├── style.css                 # Dark theme, drum grid, loop station, FX pad, tutorial styles
├── package.json              # Dependencies
├── vite.config.js            # Dev server config
├── vitest.config.js          # Test configuration
├── ROADMAP.md                # This file
└── src/
    ├── main.js               # Entry point — wires everything together
    ├── hand-tracker.js       # MediaPipe hand landmark detection
    ├── gesture-interpreter.js  # Smoothing, note mapping, finger curls, gesture detection
    ├── gesture-interpreter.test.js  # Gesture interpreter unit tests
    ├── visualizer.js         # 4 visualization modes (3D spectrum, particles, circular, heatmap)
    ├── loop-station.js       # Audio loop recording + layered playback via Tone.Recorder/Player
    ├── midi-exporter.js      # MIDI event recorder + Standard MIDI File export
    ├── midi-exporter.test.js # MIDI exporter unit tests
    ├── presets.js            # Preset save/load/delete, WAV export, URL sharing
    ├── ai-melody.js          # Magenta.js MusicRNN melody generator
    ├── tutorial.js           # Interactive gesture tutorial (10 exercises)
    └── song-guide.js         # Song learning guide (6 songs with step-by-step instructions)
```

## 🚀 How to Run

```bash
cd gesture-music-app
npm install
npm run dev
# Open http://localhost:3000 in Chrome (requires webcam)
```
