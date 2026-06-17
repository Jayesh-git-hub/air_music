<div align="center">

# 🎵 Gesture Music Studio

### Make music with hand gestures — no instruments, no controllers, just your webcam.

[![Built with Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![MediaPipe](https://img.shields.io/badge/Powered%20by-MediaPipe-00C853?logo=google&logoColor=white)](https://mediapipe.dev/)
[![Tone.js](https://img.shields.io/badge/Synth-Tone.js-FF6F00)](https://tonejs.github.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

https://github.com/user-attachments/assets/76794be9-4482-42b3-96ea-e3c81f86b2d8

*A browser-based music studio that uses real-time hand tracking via your webcam. Move your hands in the air to play synths, drums, and effects — no instruments or controllers needed.*

---

## ✨ Features

### 🎹 Four Instruments
| Instrument | Description |
|---|---|
| **Air Theremin** | Move your hand up/down for pitch, left/right for filter sweep |
| **🥁 Air Drums** | Curl individual fingers to trigger kick, snare, hi-hat, and clap sounds |
| **🎛️ Kaoss Pad** | X/Y control over FM synthesis parameters |
| **🎚️ FX Pad** | Control 7 effect parameters (reverb, delay, filter, distortion, chorus) on a drone |

### 🧠 AI-Powered Melodies
- Magenta.js MusicRNN generates melodies based on what you play
- Feed the AI a few notes with your hand, and it continues the melody

### 🔄 Loop Station
- Draw a circle to record, open palm to stop
- Layer multiple loops on top of each other
- Swipe up/down to add or remove layers

### 🎼 Musical Tools
- 5 scales: Pentatonic, Major, Minor, Blues, Chromatic
- Arpeggiator with 4 patterns (Up, Down, Up/Down, Random)
- Tempo: 40-200 BPM with tap tempo (fist pump 3x)
- Metronome with downbeat accent
- Quantization: Off through 1/16 notes

### 🎨 Visualizers
| Mode | What it shows |
|---|---|
| **📊 3D Spectrum** | Frequency bars with depth and rotation |
| **✨ Particles** | Glowing particle trails following your hand |
| **⭕ Circular** | Waveform wrapped in a circle |
| **🌡️ Heatmap** | Gesture trail heat map |

### 💾 Save, Share & Export
- Save/load/delete instrument presets (localStorage)
- Export MIDI files of your performance
- Export audio as WAV
- Share presets via URL

### 📖 Learn
- **Song Guide**: Step-by-step instructions for 6 popular songs
- **Tutorial Mode**: 10 guided gesture exercises for beginners
- **Gesture Guide**: Visual reference for all controls

---

## 🚀 Quick Start

### Prerequisites
- **Chrome** (recommended — webcam + WebGPU support)
- A webcam

### Setup

```bash
# Clone the repo
git clone https://github.com/Jayesh-git-hub/air_music.git
cd air_music

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open **http://localhost:3000** in Chrome, allow camera access, and show your hand!

> **Note:** The app requires a webcam and works best in Chrome on desktop. Mobile browsers have limited support.

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |

---

## 🎮 How to Play

### Basic Gestures

| Gesture | Action |
|---|---|
| ✋ Open hand | Controls pitch (theremin) / starts/stops loops |
| ✊ Fist | Tight, dry sound / tap tempo (3x fist pump) |
| ✌️ Peace sign | Unused (reserved) |
| 👍 Thumbs up | Play all loops |
| 👎 Thumbs down | Stop all loops |
| 🔄 Draw circle | Start loop recording |
| ⬆️ Swipe up | Add new loop layer |
| ⬇️ Swipe down | Remove last loop layer |

### 🎹 Air Theremin
- **Y-axis** (up/down): Pitch — reach higher for higher notes
- **X-axis** (left/right): Filter cutoff — sweep for brightness
- **Openness**: More open hand = more reverb

### 🥁 Air Drums
| Finger | Default Sound | Technique |
|---|---|---|
| 👍 Thumb | Kick Drum | Curl thumb toward palm |
| ☝️ Index | Snare (layered) | Curl index finger |
| 🖕 Middle | Closed Hi-Hat | Curl middle finger |
| 💍 Ring | Open Hi-Hat | Curl ring finger |
| 🤙 Pinky | Clap / Crash | Curl pinky |
| ✊ Fist | Drum fill | Make a fist |

4 drum mappings available: Standard, Reversed, Electronic, Lo-Fi.

### 🎛️ Kaoss Pad
- **X-axis**: Modulation index and harmonicity
- **Y-axis**: Volume
- Open/close hand for additional expression

### 🎚️ FX Pad
- Assignable X/Y axis controls over 7 effect parameters
- Reverb Mix, Delay Time, Delay Feedback, Filter Frequency,
  Filter Resonance, Distortion, Chorus Depth
- Drone synth sustains while you shape the sound

---

## ⌨️ Keyboard Shortcuts

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
| `G` | Open Song Guide |
| `S` | Cycle Scale |
| `R` | Cycle Drum Mapping |
| `+` / `-` | Adjust BPM (up/down 5) |

---

## 🏗️ Architecture

```
Webcam → MediaPipe (hand landmarks) → Gesture Interpreter (smooth + map)
                                              ↓
                                        Tone.js Engine
                                     (synth → effects → master)
                                              ↓
                                   Visualizer + Info Panel + MIDI Recorder
                                              ↓
                                     Loop Station / AI Melody / Export
```

### Tech Stack

| Technology | Purpose |
|---|---|
| [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer) | Real-time hand tracking (21 landmarks, gesture classification) |
| [Tone.js](https://tonejs.github.io/) | Web Audio API synthesis, effects, sequencing |
| [Vite](https://vitejs.dev/) | Dev server and bundler |
| [Magenta.js](https://magenta.tensorflow.org/js/) | AI melody generation (MusicRNN) |
| [Vitest](https://vitest.dev/) | Unit testing |

---

## 📁 Project Structure

```
gesture-music-app/
├── index.html                 # Main page with all UI panels
├── style.css                  # Dark neon theme, 600+ lines
├── package.json               # Dependencies & scripts
├── vite.config.js             # Vite dev server config
├── vitest.config.js           # Vitest test config
├── ROADMAP.md                 # Development roadmap
└── src/
    ├── main.js                # Entry point — wires everything together
    ├── hand-tracker.js        # MediaPipe hand landmark detection
    ├── gesture-interpreter.js # Smoothing, note mapping, finger curls, gesture detection
    ├── visualizer.js          # 4 visualization modes (3D, particles, circular, heatmap)
    ├── loop-station.js        # Audio loop recording + layered playback
    ├── midi-exporter.js       # MIDI event recorder + Standard MIDI File export
    ├── presets.js             # Preset save/load/delete, WAV export, URL sharing
    ├── ai-melody.js           # Magenta.js MusicRNN melody generator
    ├── tutorial.js            # Interactive gesture tutorial (10 exercises)
    ├── song-guide.js          # Song learning guide (6 songs)
    ├── gesture-interpreter.test.js  # Unit tests
    └── midi-exporter.test.js  # Unit tests
```

---

## 🧪 Running Tests

```bash
npm test
```

---

## 📋 Roadmap

The project has completed **11 phases** including hand tracking, air drums, arpeggiator, loop station, MIDI export, AI melody generation, song guide, and tutorial mode.

### Future Ideas
- Multi-user jam (WebRTC)
- Visual themes
- Mobile support (front-facing camera)
- Voice + gesture hybrid control
- Hardware MIDI controller bridge (WebMIDI)
- Export to Ableton Live Set
- Social sharing (record video performance)

---

<div align="center">

**[🎵 Try it live](https://github.com/Jayesh-git-hub/air_music)** &nbsp;·&nbsp;
**[📖 Report a bug](https://github.com/Jayesh-git-hub/air_music/issues)** &nbsp;·&nbsp;
**[⭐ Star on GitHub](https://github.com/Jayesh-git-hub/air_music)**

Built with ❤️ using MediaPipe, Tone.js, and Vite

</div>
