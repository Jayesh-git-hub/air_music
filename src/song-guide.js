/**
 * song-guide.js
 * Song Guide — Step-by-step instructions for playing popular melodies
 * using hand gestures and the gesture music studio instruments.
 *
 * Each song includes:
 *  - Title, artist, genre
 *  - Recommended instrument, scale, BPM
 *  - Step-by-step breakdown with note sequences and hand positions
 *  - Difficulty rating
 */

const SONGS = [
  {
    id: "my-girl",
    title: "My Girl",
    artist: "The Temptations",
    genre: "🎵 Soul / Motown",
    difficulty: "⭐ Easy",
    image: "🎤",
    bpm: 105,
    scale: "pentatonic",
    instrument: "theremin",
    description:
      "One of the most recognizable melodies ever written — every note fits perfectly in the C Pentatonic scale.",
    intro:
      "The iconic guitar intro uses only 4 notes. Move your hand up and down smoothly to follow the pattern.",
    sections: [
      {
        label: "🎸 Opening Riff",
        notes: "Played twice — the famous guitar intro",
        bpm: 105,
        steps: [
          {
            instruction: "Set BPM to 105",
            detail: "Slide the BPM slider to 105 (default scale: Pentatonic ✓)",
            type: "setup",
          },
          {
            instruction: "C — Hand LOW (waist level)",
            detail: "Hold your hand low near your waist. This is the root note C4.",
            type: "play",
          },
          {
            instruction: "E — Hand MID-UP (chest level)",
            detail: "Raise your hand smoothly to chest height for E4.",
            type: "play",
          },
          {
            instruction: "D — Hand SLIGHTLY DOWN",
            detail: "Lower your hand just a bit from E to reach D4.",
            type: "play",
          },
          {
            instruction: "C — Hand BACK TO LOW (waist)",
            detail: "Return your hand to the starting low position for C4.",
            type: "play",
          },
          {
            instruction: "🎵 REST — Pause for one beat",
            detail: "Keep your hand still. Don't play anything for one beat.",
            type: "rest",
          },
          {
            instruction: "🔁 REPEAT the entire pattern above",
            detail: "C → E → D → C again. The riff is played twice.",
            type: "repeat",
          },
        ],
      },
      {
        label: "🎤 Verse Melody",
        notes: '"I\'ve got sunshine..."',
        bpm: 105,
        steps: [
          {
            instruction: "C — Hand LOW (waist level)",
            detail: "\"I've got...\" — start low.",
            type: "play",
          },
          {
            instruction: "C — Hand LOW (held)",
            detail: "\"...sunshine...\" — same note, held slightly longer.",
            type: "play",
          },
          {
            instruction: "C — Hand LOW",
            detail: "\"...on a...\" — keep it low.",
            type: "play",
          },
          {
            instruction: "C — Hand LOW",
            detail: "\"...cloudy...\" — still low.",
            type: "play",
          },
          {
            instruction: "G — Hand HIGH (head level)",
            detail: "\"...day!\" — raise your hand to head height for G4.",
            type: "play",
          },
          {
            instruction: "A — Hand HIGHER (above head)",
            detail: "\"...When it's...\" — stretch up a bit higher for A4.",
            type: "play",
          },
          {
            instruction: "G — Hand BACK TO HIGH",
            detail: "\"...cold...\" — back down to G (head level).",
            type: "play",
          },
          {
            instruction: "E — Hand MID-UP",
            detail: "\"...outside.\" — down to E (chest level).",
            type: "play",
          },
        ],
      },
      {
        label: "🔄 Practice Tips",
        notes: "Master the song",
        bpm: 70,
        steps: [
          {
            instruction: "🐢 Slow it down first",
            detail: "Set BPM to 70. Nail each hand position, then gradually speed up.",
            type: "tip",
          },
          {
            instruction: "🔄 Use the Loop Station",
            detail: "Draw a circle to start recording, play the riff once, then open your palm (✋) to stop. The loop plays back so you can layer harmonies!",
            type: "tip",
          },
          {
            instruction: "🎹 Add the Arpeggiator",
            detail: "Press the 'A' key or click the Arp button, set pattern to 'Up', and it will arpeggiate the pentatonic scale as an accompaniment.",
            type: "tip",
          },
          {
            instruction: "✊ Tap Tempo with Fists",
            detail: "Make a fist 3 times in rhythm to set the BPM automatically — no slider needed!",
            type: "tip",
          },
        ],
      },
    ],
  },
  {
    id: "amazing-grace",
    title: "Amazing Grace",
    artist: "Traditional Hymn",
    genre: "⛪ Hymn / Spiritual",
    difficulty: "⭐ Easy",
    image: "🙏",
    bpm: 80,
    scale: "pentatonic",
    instrument: "theremin",
    description:
      "A timeless melody that's beautiful and slow — perfect for learning hand-position control.",
    intro:
      "This melody moves step-by-step through the pentatonic scale. Focus on smooth, steady hand movements.",
    sections: [
      {
        label: "🎵 Main Melody (Verse)",
        notes: '"Amazing Grace, how sweet the sound..."',
        bpm: 80,
        steps: [
          {
            instruction: "G — Hand HIGH (head level)",
            detail: "\"A-\" — start at G4 (head height).",
            type: "play",
          },
          {
            instruction: "A — Hand HIGHER (above head)",
            detail: "\"-ma-\" — up to A4 (reach up).",
            type: "play",
          },
          {
            instruction: "C — Hand VERY HIGH (stretch up)",
            detail: "\"-zing\" — stretch up to C5 (highest note).",
            type: "play",
          },
          {
            instruction: "D — Hand HIGHER THAN C (max)",
            detail: "\"Grace,\" — reach as high as you can for D5.",
            type: "play",
          },
          {
            instruction: "C — Hand DOWN to C5",
            detail: "\"How\" — back to C5.",
            type: "play",
          },
          {
            instruction: "A — Hand DOWN to A4",
            detail: "\"sweet\" — down to A4.",
            type: "play",
          },
          {
            instruction: "G — Hand DOWN to G4 (head level)",
            detail: "\"the\" — back to G4.",
            type: "play",
          },
          {
            instruction: "E — Hand MID-UP (chest level)",
            detail: "\"sound\" — end on E4.",
            type: "play",
          },
        ],
      },
      {
        label: "🔄 Practice Tips",
        notes: "Master the flow",
        bpm: 70,
        steps: [
          {
            instruction: "🐢 Start very slow",
            detail: "Set BPM to 60. This song is about smooth transitions between notes.",
            type: "tip",
          },
          {
            instruction: "📏 Focus on hand distance",
            detail: "Practice moving between G (head) and A (slightly above) — feel the small distance.",
            type: "tip",
          },
        ],
      },
    ],
  },
  {
    id: "hallelujah",
    title: "Hallelujah",
    artist: "Leonard Cohen",
    genre: "🎸 Folk / Rock",
    difficulty: "⭐⭐ Medium",
    image: "🎶",
    bpm: 72,
    scale: "major",
    instrument: "theremin",
    description:
      "The hauntingly beautiful chorus melody — simple yet powerful, all within the C Major scale.",
    intro:
      "The chorus uses a gentle descending pattern. Switch to Major scale for the fuller harmony.",
    sections: [
      {
        label: "🎵 Chorus Melody",
        notes: '"Hallelujah, Hallelujah..."',
        bpm: 72,
        steps: [
          {
            instruction: "⚙️ Set Scale to MAJOR",
            detail: "Switch the scale dropdown from Pentatonic to Major for the full 7-note range.",
            type: "setup",
          },
          {
            instruction: "A — Hand HIGH (above head)",
            detail: "\"Hal-le-\" — start at A4.",
            type: "play",
          },
          {
            instruction: "C — Hand VERY HIGH (stretch up)",
            detail: "\"-lu-\" — reach up to C5.",
            type: "play",
          },
          {
            instruction: "G — Hand DOWN to G4 (head)",
            detail: "\"-jah\" — down to G4.",
            type: "play",
          },
          {
            instruction: "E — Hand DOWN to MID (chest)",
            detail: "\"Hal-le-\" — down to E4.",
            type: "play",
          },
          {
            instruction: "C — Hand LOW (waist level)",
            detail: "\"-lu-\" — low to C4.",
            type: "play",
          },
          {
            instruction: "G — Hand BACK UP to G4 (head)",
            detail: "\"-jah\" — back up to G4 for the resolution.",
            type: "play",
          },
        ],
      },
      {
        label: "🔄 Practice Tips",
        notes: "Master the emotion",
        bpm: 65,
        steps: [
          {
            instruction: "🎭 Feel the descent",
            detail: "The magic is in the descending pattern A→C→G→E→C→G. Practice the downward sweep smoothly.",
            type: "tip",
          },
          {
            instruction: "✋ Use openness for reverb",
            detail: "Open your hand wide during the long notes for a cathedral-like reverb effect.",
            type: "tip",
          },
        ],
      },
    ],
  },
  {
    id: "auld-lang-syne",
    title: "Auld Lang Syne",
    artist: "Traditional / New Year's",
    genre: "🎉 Traditional / Folk",
    difficulty: "⭐ Easy",
    image: "🎊",
    bpm: 90,
    scale: "pentatonic",
    instrument: "theremin",
    description:
      "The world-famous New Year's melody — simple, stepwise motion perfect for beginners.",
    intro:
      "A gentle, stepwise melody that moves up and down the pentatonic scale. Great for practicing smooth hand transitions.",
    sections: [
      {
        label: "🎵 Main Melody",
        notes: '"Should auld acquaintance be forgot..."',
        bpm: 90,
        steps: [
          {
            instruction: "C — Hand LOW (waist level)",
            detail: "\"Should\" — start on C4.",
            type: "play",
          },
          {
            instruction: "G — Hand HIGH (head level)",
            detail: "\"auld\" — jump up to G4.",
            type: "play",
          },
          {
            instruction: "A — Hand HIGHER (above head)",
            detail: "\"ac-\" — up to A4.",
            type: "play",
          },
          {
            instruction: "E — Hand MID-UP (chest level)",
            detail: "\"-quain-\" — down to E4.",
            type: "play",
          },
          {
            instruction: "D — Hand SLIGHTLY DOWN",
            detail: "\"-tance\" — lower slightly to D4.",
            type: "play",
          },
          {
            instruction: "C — Hand LOW (waist level)",
            detail: "\"be\" — back to C4.",
            type: "play",
          },
        ],
      },
    ],
  },
  {
    id: "when-the-saints",
    title: "When the Saints Go Marching In",
    artist: "Traditional Jazz",
    genre: "🎺 Jazz / Dixieland",
    difficulty: "⭐⭐ Medium",
    image: "🎺",
    bpm: 120,
    scale: "pentatonic",
    instrument: "theremin",
    description:
      "A feel-good jazz classic with a bouncy, upbeat melody that's instantly recognizable.",
    intro:
      "This melody has a call-and-response feel. The notes jump around more — practice the quick hand movements!",
    sections: [
      {
        label: "🎵 Main Melody",
        notes: '"Oh, when the saints go marching in..."',
        bpm: 120,
        steps: [
          {
            instruction: "C — Hand LOW (waist level)",
            detail: "\"Oh\" — start low.",
            type: "play",
          },
          {
            instruction: "E — Hand MID-UP (chest level)",
            detail: "\"when\" — up to E4.",
            type: "play",
          },
          {
            instruction: "G — Hand HIGH (head level)",
            detail: "\"the\" — up to G4.",
            type: "play",
          },
          {
            instruction: "A — Hand HIGHER (above head)",
            detail: "\"saints\" — up to A4.",
            type: "play",
          },
          {
            instruction: "G — Hand BACK DOWN (head level)",
            detail: "\"go\" — back to G4.",
            type: "play",
          },
          {
            instruction: "E — Hand DOWN (chest level)",
            detail: "\"mar-\" — down to E4.",
            type: "play",
          },
          {
            instruction: "C — Hand LOW (waist level)",
            detail: "\"-ching\" — back to C4.",
            type: "play",
          },
          {
            instruction: "D — Hand SLIGHTLY UP",
            detail: "\"in\" — nudge up to D4.",
            type: "play",
          },
          {
            instruction: "C — Hand LOW",
            detail: "\"!\" — finish on C4.",
            type: "play",
          },
        ],
      },
      {
        label: "🔄 Practice Tips",
        notes: "Jazz it up",
        bpm: 100,
        steps: [
          {
            instruction: "🎺 Use the Kaoss Pad instrument",
            detail: "Switch to Kaoss Pad (press '3') for a brassier tone that suits the jazz feel.",
            type: "tip",
          },
          {
            instruction: "✋ Add palm for dynamics",
            detail: "Open your hand for more reverb during the held notes at the end of each phrase.",
            type: "tip",
          },
        ],
      },
    ],
  },
  {
    id: "stand-by-me",
    title: "Stand By Me",
    artist: "Ben E. King",
    genre: "🎵 Soul / R&B",
    difficulty: "⭐⭐ Medium",
    image: "🎤",
    bpm: 88,
    scale: "major",
    instrument: "theremin",
    description:
      "One of the most beloved basslines and melodies in music history — rich and soulful.",
    intro:
      "The bassline walks down the major scale while the melody floats above. Set to Major scale for the full harmony.",
    sections: [
      {
        label: "🎵 Verse Melody",
        notes: '"When the night has come..."',
        bpm: 88,
        steps: [
          {
            instruction: "⚙️ Set Scale to MAJOR, BPM to 88",
            detail: "Switch the scale dropdown to Major for this song.",
            type: "setup",
          },
          {
            instruction: "E — Hand MID-UP (chest level)",
            detail: "\"When the\" — start on E4.",
            type: "play",
          },
          {
            instruction: "G — Hand HIGH (head level)",
            detail: "\"night\" — up to G4.",
            type: "play",
          },
          {
            instruction: "A — Hand HIGHER (above head)",
            detail: "\"has\" — up to A4.",
            type: "play",
          },
          {
            instruction: "G — Hand DOWN (head level)",
            detail: "\"come\" — back to G4.",
            type: "play",
          },
          {
            instruction: "E — Hand DOWN (chest level)",
            detail: "\"and the\" — down to E4.",
            type: "play",
          },
          {
            instruction: "D — Hand SLIGHTLY DOWN",
            detail: "\"land\" — down to D4.",
            type: "play",
          },
          {
            instruction: "C — Hand LOW (waist level)",
            detail: "\"is\" — down to C4.",
            type: "play",
          },
          {
            instruction: "D — Hand SLIGHTLY UP",
            detail: "\"dark\" — back to D4 to end the phrase.",
            type: "play",
          },
        ],
      },
      {
        label: "🎵 Chorus Melody",
        notes: '"Stand by me..."',
        bpm: 88,
        steps: [
          {
            instruction: "G — Hand HIGH (head level)",
            detail: "\"Stand\" — start on G4.",
            type: "play",
          },
          {
            instruction: "E — Hand DOWN (chest level)",
            detail: "\"by\" — down to E4.",
            type: "play",
          },
          {
            instruction: "D — Hand SLIGHTLY DOWN",
            detail: "\"me-\" — down to D4.",
            type: "play",
          },
          {
            instruction: "E — Hand BACK UP (chest level)",
            detail: "\"-e-e\" — slide back up to E4.",
            type: "play",
          },
          {
            instruction: "C — Hand LOW (waist level)",
            detail: "\"when the\" — down to C4.",
            type: "play",
          },
          {
            instruction: "G — Hand HIGH (head level)",
            detail: "\"night\" — jump up to G4.",
            type: "play",
          },
          {
            instruction: "E — Hand DOWN (chest level)",
            detail: "\"comes\" — back to E4.",
            type: "play",
          },
          {
            instruction: "C — Hand LOW",
            detail: "\"down\" — finish on C4.",
            type: "play",
          },
        ],
      },
    ],
  },
];

// ─── Song Guide Engine ─────────────────────────────────────────────────

export function createSongGuide() {
  let isActive = false;
  let currentSongId = null;
  let currentSectionIndex = 0;
  let currentStepIndex = 0;
  let onUpdate = null;
  let onClose = null;

  /** Get the full list of songs */
  function getSongs() {
    return SONGS;
  }

  /** Get current song object */
  function getCurrentSong() {
    return SONGS.find((s) => s.id === currentSongId) || null;
  }

  /** Get current song's current section */
  function getCurrentSection() {
    const song = getCurrentSong();
    if (!song) return null;
    return song.sections[currentSectionIndex] || null;
  }

  /** Get current step */
  function getCurrentStep() {
    const section = getCurrentSection();
    if (!section) return null;
    return section.steps[currentStepIndex] || null;
  }

  /** Get total number of songs */
  function getSongCount() {
    return SONGS.length;
  }

  /** Get current state */
  function getState() {
    return {
      isActive,
      currentSongId,
      currentSong: getCurrentSong(),
      currentSection: getCurrentSection(),
      currentSectionIndex,
      currentStep: getCurrentStep(),
      currentStepIndex,
      totalSections: getCurrentSong()?.sections.length || 0,
      totalSteps: getCurrentSection()?.steps.length || 0,
    };
  }

  /** Open the song guide and select a song */
  function open(songId) {
    isActive = true;
    if (songId) {
      selectSong(songId);
    } else {
      currentSongId = null;
      currentSectionIndex = 0;
      currentStepIndex = 0;
    }
    notifyUpdate();
  }

  /** Close the song guide */
  function close() {
    isActive = false;
    currentSongId = null;
    currentSectionIndex = 0;
    currentStepIndex = 0;
    notifyUpdate();
    if (onClose) onClose();
  }

  /** Select a song and reset to its first step */
  function selectSong(songId) {
    const song = SONGS.find((s) => s.id === songId);
    if (!song) return;
    currentSongId = songId;
    currentSectionIndex = 0;
    currentStepIndex = 0;
    notifyUpdate();
  }

  /** Go to next step (or next section) */
  function nextStep() {
    const section = getCurrentSection();
    if (!section) return;
    if (currentStepIndex < section.steps.length - 1) {
      currentStepIndex++;
      notifyUpdate();
    } else if (currentSectionIndex < getCurrentSong().sections.length - 1) {
      // Advance to next section
      currentSectionIndex++;
      currentStepIndex = 0;
      notifyUpdate();
    }
  }

  /** Go to previous step (or previous section) */
  function prevStep() {
    if (currentStepIndex > 0) {
      currentStepIndex--;
      notifyUpdate();
    } else if (currentSectionIndex > 0) {
      // Go to previous section's last step
      currentSectionIndex--;
      const prevSection = getCurrentSong().sections[currentSectionIndex];
      currentStepIndex = prevSection.steps.length - 1;
      notifyUpdate();
    }
  }

  /** Apply song settings to the app (BPM, scale, instrument) */
  function getSongSettings(songId) {
    const song = SONGS.find((s) => s.id === songId);
    if (!song) return null;
    return {
      bpm: song.bpm,
      scale: song.scale,
      instrument: song.instrument,
    };
  }

  /** Register update callback */
  function setOnUpdate(cb) {
    onUpdate = cb;
  }

  /** Register close callback */
  function setOnClose(cb) {
    onClose = cb;
  }

  function notifyUpdate() {
    if (onUpdate) {
      onUpdate(getState());
    }
  }

  return {
    getSongs,
    getCurrentSong,
    getCurrentSection,
    getCurrentStep,
    getState,
    open,
    close,
    selectSong,
    nextStep,
    prevStep,
    getSongSettings,
    setOnUpdate,
    setOnClose,
  };
}
