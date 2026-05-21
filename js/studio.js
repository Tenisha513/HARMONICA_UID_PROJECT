/* Harmonica Web DAW Studio Sequencer Logic */

const APP_STATE = {
  activeProject: "Neon Horizon Mix",
  isPlaying: false,
  bpm: 120,
  activeTrackId: 0,
  selectedNoteId: null,
  notes: [],
  tracks: [
    { id: 0, name: 'Piano', color: '#ffc174', synthType: 'PolySynth', mute: false, solo: false, vol: 0, pan: 0, effects: { Reverb: true, Delay: false, Chorus: false } },
    { id: 1, name: 'Bass', color: '#d0bcff', synthType: 'MonoSynth', mute: false, solo: false, vol: -6, pan: -0.2, effects: { Reverb: false, Delay: false, Chorus: false } },
    { id: 2, name: 'Lead', color: '#7fd0ff', synthType: 'AMSynth', mute: false, solo: false, vol: -3, pan: 0, effects: { Reverb: true, Delay: true, Chorus: true } },
    { id: 3, name: 'Pad', color: '#ffb4ab', synthType: 'PolySynth', mute: false, solo: false, vol: -8, pan: 0.3, effects: { Reverb: true, Delay: true, Chorus: true } },
    { id: 4, name: 'Guitar', color: '#ffddb8', synthType: 'PolySynth', mute: false, solo: false, vol: -4, pan: -0.3, effects: { Reverb: true, Delay: false, Chorus: false } }
  ],
  gridConfig: {
    bars: 16,
    beatsPerBar: 4,
    subdivisions: 4,
    cellWidth: 24, // Optimized layout
    rowHeight: 24, // Matched with keys height
    minOctave: 3,
    maxOctave: 4,
  },
  synths: {},
  channels: {}, // Isolated track volume and pan channel mapping
  mood: null,
  noteIdCounter: 0
};

// --- Storage Logic ---
window.currentProjectId = new URLSearchParams(window.location.search).get('id');
if (window.currentProjectId) {
  const projects = JSON.parse(localStorage.getItem('harmonica_projects') || localStorage.getItem('harmonic_projects') || localStorage.getItem('resonance_projects') || '[]');
  const loaded = projects.find(p => p.id === window.currentProjectId);
  if (loaded) {
    APP_STATE.activeProject = loaded.title || "Untitled Project";
    APP_STATE.bpm = loaded.bpm || 120;
    APP_STATE.tracks = loaded.tracks || APP_STATE.tracks;
    APP_STATE.notes = loaded.notes || [];
    APP_STATE.noteIdCounter = APP_STATE.notes.length > 0 ? Math.max(...APP_STATE.notes.map(n => n.id)) + 1 : 0;
  }
} else {
  window.currentProjectId = "proj_" + Date.now();
}
// ----------------------

const TOTAL_KEYS = 24;
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Map flat names (Bb, Eb) to sharp names used on the grid
const PITCH_ALIASES = { Bb: 'A#', Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#' };

function normalizePitch(pitch) {
  if (!pitch || pitch.length < 2) return pitch;
  const oct = pitch.match(/\d+$/)?.[0] ?? '';
  const note = pitch.slice(0, pitch.length - oct.length);
  return (PITCH_ALIASES[note] || note) + oct;
}

// 1. Audio Routing Architecture (Guarantees isolation to fix sound bleed)
const masterBus = new Tone.Volume(0).toDestination();

// Analysers read from master bus in parallel (visualization tap)
const fftAnalyser = new Tone.Analyser("fft", 512);
const waveformAnalyser = new Tone.Analyser("waveform", 512);
masterBus.connect(fftAnalyser);
masterBus.connect(waveformAnalyser);

// Smoothed visualizer state for lively motion between frames
const VIS_STATE = {
  barHeights: new Array(32).fill(0),
  circleRadii: new Array(64).fill(0),
  wavePhase: 0
};

const globalEffects = {
  Reverb: new Tone.Freeverb({ roomSize: 0.8, dampening: 3000, wet: 0.45 }).connect(masterBus),
  Delay: new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.35, wet: 0.4 }).connect(masterBus),
  Chorus: new Tone.Chorus({ frequency: 3.8, delayTime: 2.8, depth: 0.45, wet: 0.5 }).connect(masterBus),
  Equalizer: new Tone.EQ3({ low: 3, mid: -2, high: 2 }).connect(masterBus)
};
globalEffects.Chorus.start();

function setupAudio() {
  APP_STATE.tracks.forEach(t => {
    // Create dedicated isolated channel for each track
    const channel = new Tone.Channel({
      volume: t.vol,
      pan: t.pan,
      mute: t.mute
    }).connect(masterBus);
    
    APP_STATE.channels[t.id] = channel;

    // Load instruments
    let synth;
    if (t.synthType === 'PolySynth') {
      synth = new Tone.PolySynth(Tone.Synth).connect(channel);
    } else if (t.synthType === 'MonoSynth') {
      synth = new Tone.MonoSynth().connect(channel);
    } else if (t.synthType === 'AMSynth') {
      synth = new Tone.AMSynth().connect(channel);
    }
    APP_STATE.synths[t.id] = synth;
    
    // Connect dynamic effects send paths
    updateTrackEffects(t.id);
  });
  
  Tone.Transport.bpm.value = APP_STATE.bpm;
}

function updateTrackEffects(trackId) {
  const channel = APP_STATE.channels[trackId];
  if (!channel) return;
  
  const track = APP_STATE.tracks.find(t => t.id === trackId);
  if (!track) return;
  
  // Disconnect from send paths
  channel.disconnect();
  // Always connect back directly to standard master output
  channel.connect(masterBus);
  
  // Conditionally hook sends
  if (track.effects.Reverb) {
    channel.connect(globalEffects.Reverb);
  }
  if (track.effects.Delay) {
    channel.connect(globalEffects.Delay);
  }
  if (track.effects.Chorus) {
    channel.connect(globalEffects.Chorus);
  }
  if (track.effects.Equalizer) {
    channel.connect(globalEffects.Equalizer);
  }
}

function playNoteAudio(trackId, pitch, duration, time) {
  const synth = APP_STATE.synths[trackId];
  if (!synth) return;
  synth.triggerAttackRelease(pitch, duration, time);
}

// 2. DOM Rendering & Synchronized Visuals
document.addEventListener("DOMContentLoaded", () => {
  // Load local active project title if available
  const storedPrj = localStorage.getItem("harmonica_active_project") || localStorage.getItem("harmonic_active_project") || localStorage.getItem("resonance_active_project");
  if (storedPrj) {
    APP_STATE.activeProject = storedPrj;
    const titleEl = document.getElementById("activeProjectTitle");
    if (titleEl) titleEl.textContent = storedPrj;
  }

  let isAudioInitialized = false;
  // Audio start trigger on initial click interaction
  window.addEventListener("click", async () => {
    if (!isAudioInitialized) {
      isAudioInitialized = true;
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
      setupAudio();
      const statusIndicator = document.getElementById("engineStatus");
      if (statusIndicator) {
        statusIndicator.classList.remove("bg-primary", "animate-pulse");
        statusIndicator.classList.add("bg-[#5eff8a]"); // Signal locked glow
        statusIndicator.title = "Audio Engine Connected";
      }
      showToast("✦ Sound Engine Core Initialized");
    }
  });

  // Sync keyboard y-scroll with central sequencer grid
  const gridContainer = document.getElementById("gridContainer");
  const keysCol = document.getElementById("keysCol");
  if (gridContainer && keysCol) {
    gridContainer.addEventListener("scroll", () => {
      keysCol.scrollTop = gridContainer.scrollTop;
    });
  }

  // Add Track Custom Modal Logic
  const addTrackModal = document.getElementById("addTrackModal");
  const addTrackModalContent = document.getElementById("addTrackModalContent");
  const newTrackNameInput = document.getElementById("newTrackName");
  const newTrackTypeSelect = document.getElementById("newTrackType");
  
  function closeAddTrackModal() {
    addTrackModal.classList.remove("opacity-100");
    addTrackModalContent.classList.remove("scale-100");
    setTimeout(() => {
      addTrackModal.classList.add("hidden");
    }, 300);
  }

  document.getElementById("addTrackBtn").addEventListener("click", () => {
    addTrackModal.classList.remove("hidden");
    // Trigger browser reflow to enable transition animation
    void addTrackModal.offsetWidth;
    addTrackModal.classList.add("opacity-100");
    addTrackModalContent.classList.add("scale-100");
    
    newTrackNameInput.value = `Track ${APP_STATE.tracks.length + 1}`;
    newTrackNameInput.focus();
    newTrackNameInput.select();
  });

  document.getElementById("cancelAddTrack").addEventListener("click", closeAddTrackModal);
  
  document.getElementById("confirmAddTrack").addEventListener("click", () => {
    const name = newTrackNameInput.value.trim() || `Track ${APP_STATE.tracks.length + 1}`;
    const synthType = newTrackTypeSelect.value;
    
    closeAddTrackModal();

    const newId = APP_STATE.tracks.length > 0 ? Math.max(...APP_STATE.tracks.map(t => t.id)) + 1 : 0;
    const colors = ["#ffc174", "#d0bcff", "#7fd0ff", "#ffb4ab", "#ffddb8"];
    
    const newTrack = {
      id: newId,
      name: name.substring(0, 20),
      color: colors[newId % colors.length],
      synthType: synthType,
      mute: false,
      solo: false,
      vol: -4,
      pan: 0,
      effects: { Reverb: false, Delay: false, Chorus: false }
    };
    
    APP_STATE.tracks.push(newTrack);
    
    // Wire synthesis channel routing
    if (Tone.context.state === 'running') {
      const channel = new Tone.Channel({
        volume: newTrack.vol,
        pan: newTrack.pan,
        mute: false
      }).connect(masterBus);
      APP_STATE.channels[newId] = channel;
      
      let synth;
      if (synthType === 'PolySynth') synth = new Tone.PolySynth(Tone.Synth).connect(channel);
      else if (synthType === 'MonoSynth') synth = new Tone.MonoSynth().connect(channel);
      else if (synthType === 'AMSynth') synth = new Tone.AMSynth().connect(channel);
      
      APP_STATE.synths[newId] = synth;
      updateTrackEffects(newId);
    }
    
    renderTracks();
    drawGrid();
    showToast(`✦ Added ${newTrack.name}`);
  });

  // Track property inputs
  const propVolume = document.getElementById("propVolume");
  const volumeVal = document.getElementById("volumeVal");
  propVolume.addEventListener("input", (e) => {
    const dbVal = parseFloat(e.target.value);
    volumeVal.textContent = dbVal === -60 ? "-∞ dB" : `${dbVal.toFixed(1)} dB`;
    
    const activeTrack = APP_STATE.tracks.find(t => t.id === APP_STATE.activeTrackId);
    if (activeTrack) {
      activeTrack.vol = dbVal;
      const channel = APP_STATE.channels[activeTrack.id];
      if (channel) {
        channel.volume.value = dbVal;
      }
    }
  });

  const propPan = document.getElementById("propPan");
  const panVal = document.getElementById("panVal");
  propPan.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    panVal.textContent = val === 0 ? "Center" : (val < 0 ? `L ${Math.abs(val).toFixed(1)}` : `R ${val.toFixed(1)}`);
    
    const activeTrack = APP_STATE.tracks.find(t => t.id === APP_STATE.activeTrackId);
    if (activeTrack) {
      activeTrack.pan = val;
      const channel = APP_STATE.channels[activeTrack.id];
      if (channel) {
        channel.pan.value = val;
      }
    }
  });

  // Quantize button trigger
  document.getElementById("btnQuantize").addEventListener("click", () => {
    if (APP_STATE.selectedNoteId !== null) {
      const note = APP_STATE.notes.find(n => n.id === APP_STATE.selectedNoteId);
      if (note) {
        // Snap to nearest 1/16 beat subdivision
        note.time = Math.round(note.time * 4) / 4;
        drawGrid();
        showToast("Note start quantized");
      }
    }
  });

  // Bind Effects rack buttons
  ["Reverb", "Delay", "Chorus", "Equalizer"].forEach(eff => {
    const btn = document.getElementById(`eff${eff}`);
    const indicator = document.getElementById(`eff${eff}Indicator`);
    
    if (btn) {
      btn.addEventListener("click", () => {
        const track = APP_STATE.tracks.find(t => t.id === APP_STATE.activeTrackId);
        if (track) {
          track.effects[eff] = !track.effects[eff];
          
          // Toggle styling
          if (track.effects[eff]) {
            indicator.classList.remove("bg-transparent");
            indicator.classList.add("bg-primary");
          } else {
            indicator.classList.add("bg-transparent");
            indicator.classList.remove("bg-primary");
          }
          
          updateTrackEffects(track.id);
          updateSignalChainUI(track);
        }
      });
    }
  });

  // Transport Controller bindings
  document.getElementById("btnPlay").addEventListener("click", togglePlay);
  document.getElementById("btnStop").addEventListener("click", stopPlay);
  document.getElementById("btnRewind").addEventListener("click", () => {
    Tone.Transport.position = 0;
    updatePosDisplay();
    if (!APP_STATE.isPlaying) {
      document.getElementById("playhead").style.left = "64px";
    }
  });

  // Synchronized BPM Input Handlers (Mobile & Desktop)
  const bpmMobile = document.getElementById("bpmInput");
  const bpmDesktop = document.getElementById("bpmInputDesktop");
  
  function updateBpm(newBpm) {
    newBpm = Math.max(40, Math.min(240, newBpm));
    APP_STATE.bpm = newBpm;
    Tone.Transport.bpm.value = newBpm;
    if (bpmMobile) bpmMobile.value = newBpm;
    if (bpmDesktop) bpmDesktop.value = newBpm;
  }
  
  if (bpmMobile) {
    bpmMobile.addEventListener("change", (e) => updateBpm(parseInt(e.target.value)));
  }
  if (bpmDesktop) {
    bpmDesktop.addEventListener("change", (e) => updateBpm(parseInt(e.target.value)));
  }

  // Key & Scale Event Handlers
  const keyMobile = document.getElementById("keySelectMobile");
  const keyDesktop = document.getElementById("keySelect");
  const scaleMobile = document.getElementById("scaleSelectMobile");
  const scaleDesktop = document.getElementById("scaleSelect");

  function updateKey(newKey) {
    APP_STATE.key = newKey;
    if (keyMobile) keyMobile.value = newKey;
    if (keyDesktop) keyDesktop.value = newKey;
    showToast(`Key set to ${newKey}`);
  }

  function updateScale(newScale) {
    APP_STATE.scale = newScale;
    if (scaleMobile) scaleMobile.value = newScale;
    if (scaleDesktop) scaleDesktop.value = newScale;
    showToast(`Scale set to ${newScale}`);
  }

  if (keyMobile) keyMobile.addEventListener("change", (e) => updateKey(e.target.value));
  if (keyDesktop) keyDesktop.addEventListener("change", (e) => updateKey(e.target.value));
  if (scaleMobile) scaleMobile.addEventListener("change", (e) => updateScale(e.target.value));
  if (scaleDesktop) scaleDesktop.addEventListener("change", (e) => updateScale(e.target.value));

  // Template picker
  document.querySelectorAll('.template-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const shimmer = document.getElementById('loadingShimmer');
      if (shimmer) {
        shimmer.classList.remove('hidden');
        shimmer.classList.add('flex');
      }
      setTimeout(async () => {
        await applyTemplate(btn.dataset.template);
        if (shimmer) {
          shimmer.classList.add('hidden');
          shimmer.classList.remove('flex');
        }
      }, 600);
    });
  });

  // AI Mood Composer — render pills & bind selection
  renderMoodPills();
  bindMoodPills();

  const moodInput = document.getElementById('moodInput');
  const moodInputMobile = document.getElementById('moodInputMobile');
  if (moodInput && moodInputMobile) {
    moodInput.addEventListener('input', () => { moodInputMobile.value = moodInput.value; });
    moodInputMobile.addEventListener('input', () => { moodInput.value = moodInputMobile.value; });
  }

  document.getElementById("btnGenerate").addEventListener("click", () => {
    if (!APP_STATE.mood) {
      showToast("Please choose a theme template first");
      return;
    }
    
    if (APP_STATE.isPlaying) {
      stopPlay();
    }
    
    const shimmer = document.getElementById("loadingShimmer");
    shimmer.classList.remove("hidden");
    shimmer.classList.add("flex");
    
    setTimeout(() => {
      generateMoodMusic(APP_STATE.mood);
      shimmer.classList.add("hidden");
      shimmer.classList.remove("flex");
      document.getElementById("genText").textContent = "Regenerate";
      showToast(`✨ Generated new ${APP_STATE.mood} arrangement`);
    }, 1400);
  });

  // Rename Project Modal Logic
  const renameModal = document.getElementById("renameModal");
  const renameModalContent = document.getElementById("renameModalContent");
  const renameInput = document.getElementById("renameInput");
  const activeProjectTitle = document.getElementById("activeProjectTitle");
  const activeProjectTitle2 = document.getElementById("activeProjectTitle2");
  
  function closeRenameModal() {
    renameModal.classList.remove("opacity-100");
    renameModalContent.classList.remove("scale-100");
    setTimeout(() => renameModal.classList.add("hidden"), 300);
  }

  function openRenameModal() {
    renameModal.classList.remove("hidden");
    void renameModal.offsetWidth;
    renameModal.classList.add("opacity-100");
    renameModalContent.classList.add("scale-100");
    
    renameInput.value = APP_STATE.activeProject;
    renameInput.focus();
    renameInput.select();
  }

  const titleContainer = document.getElementById("projectTitleContainer");
  if (titleContainer) {
    titleContainer.addEventListener("click", openRenameModal);
  }
  const titleContainer2 = document.getElementById("projectTitleContainer2");
  if (titleContainer2) {
    titleContainer2.addEventListener("click", openRenameModal);
  }

  document.getElementById("cancelRename").addEventListener("click", closeRenameModal);
  
  document.getElementById("confirmRename").addEventListener("click", () => {
    const newName = renameInput.value.trim() || "Untitled Project";
    APP_STATE.activeProject = newName;
    if (activeProjectTitle) activeProjectTitle.textContent = newName;
    if (activeProjectTitle2) activeProjectTitle2.textContent = newName;
    closeRenameModal();
    showToast(`Project renamed to ${newName}`);
  });

  // Save Project
  document.getElementById("btnSave").addEventListener("click", () => {
    const indicator = document.getElementById("saveStateIndicator");
    indicator.textContent = "Saving...";
    indicator.classList.add("text-primary");
    
    const projectData = {
      id: window.currentProjectId,
      title: APP_STATE.activeProject,
      bpm: APP_STATE.bpm,
      notes: APP_STATE.notes,
      tracks: APP_STATE.tracks,
      modifiedAt: new Date().toISOString()
    };
    
    let projects = JSON.parse(localStorage.getItem('harmonica_projects') || localStorage.getItem('harmonic_projects') || localStorage.getItem('resonance_projects') || '[]');
    const existingIndex = projects.findIndex(p => p.id === window.currentProjectId);
    if (existingIndex > -1) {
      projects[existingIndex] = projectData;
    } else {
      projects.push(projectData);
    }
    localStorage.setItem('harmonica_projects', JSON.stringify(projects));
    
    setTimeout(() => {
      indicator.textContent = "Saved Just Now";
      indicator.classList.remove("text-primary");
      showToast("💾 Project saved locally");
    }, 400);
  });
  // Reset Template Custom Modal
  const resetModal = document.getElementById("resetModal");
  const resetModalContent = document.getElementById("resetModalContent");
  
  function closeResetModal() {
    resetModal.classList.remove("opacity-100");
    resetModalContent.classList.remove("scale-100");
    setTimeout(() => resetModal.classList.add("hidden"), 300);
  }
  
  const btnReset = document.getElementById("btnReset");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (APP_STATE.isPlaying) stopPlay();
      resetModal.classList.remove("hidden");
      void resetModal.offsetWidth;
      resetModal.classList.add("opacity-100");
      resetModalContent.classList.add("scale-100");
    });
  }

  document.getElementById("cancelReset").addEventListener("click", closeResetModal);
  
  document.getElementById("confirmReset").addEventListener("click", () => {
      closeResetModal();
      
      APP_STATE.notes = [];
      APP_STATE.noteIdCounter = 0;
      
      // Keep only default track structure without nodes, then reinit
      const track1 = APP_STATE.tracks[0] || { id: 0, name: 'Piano', color: '#ffc174', synthType: 'PolySynth', mute: false, solo: false, vol: 0, pan: 0, effects: { Reverb: true, Delay: false, Chorus: false, Equalizer: false } };
      
      APP_STATE.tracks.forEach(t => {
        if (APP_STATE.channels[t.id]) APP_STATE.channels[t.id].dispose();
        if (APP_STATE.synths[t.id]) APP_STATE.synths[t.id].dispose();
      });
      
      APP_STATE.channels = {};
      APP_STATE.synths = {};
      APP_STATE.tracks = [track1];
      APP_STATE.activeTrackId = track1.id;
      APP_STATE.selectedNoteId = null;
      
      setupAudio();
      renderTracks();
      drawGrid();
      updatePropertiesPanel();
      showToast("Project has been reset");
  });

  // Master Volume Control
  const masterVolume = document.getElementById("masterVolume");
  if (masterVolume) {
    masterVolume.addEventListener("input", (e) => {
      const dbVal = parseFloat(e.target.value);
      if (dbVal <= -60) {
        Tone.Destination.mute = true;
      } else {
        Tone.Destination.mute = false;
        Tone.Destination.volume.rampTo(dbVal, 0.05);
      }
    });
  }

  // Export JSON file
  document.getElementById("btnExport").addEventListener("click", () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(APP_STATE.notes));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${APP_STATE.activeProject.toLowerCase().replace(/ /g, "_")}_arr.json`);
    downloadAnchor.click();
  });

  // Share trigger
  document.getElementById("btnShare").addEventListener("click", () => {
    showToast("✦ Arrangement share link saved to clipboard!");
  });

  // Key Event bindings
  window.addEventListener("keydown", e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'Delete' || e.code === 'Backspace') {
      if (APP_STATE.selectedNoteId !== null) {
        APP_STATE.notes = APP_STATE.notes.filter(n => n.id !== APP_STATE.selectedNoteId);
        APP_STATE.selectedNoteId = null;
        drawGrid();
        updatePropertiesPanel();
      }
    }
  });

  // Note pitch duration editor change
  const propDuration = document.getElementById("propDuration");
  if (propDuration) {
    propDuration.addEventListener("change", (e) => {
      if (APP_STATE.selectedNoteId !== null) {
        const note = APP_STATE.notes.find(n => n.id === APP_STATE.selectedNoteId);
        if (note) {
          const val = e.target.value;
          note.duration = val === "16n" ? 0.25 : (val === "8n" ? 0.5 : (val === "4n" ? 1.0 : (val === "2n" ? 2.0 : 4.0)));
          drawGrid();
        }
      }
    });
  }

  const propVelocity = document.getElementById("propVelocity");
  const velocityVal = document.getElementById("velocityVal");
  if (propVelocity) {
    propVelocity.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      velocityVal.textContent = val;
      if (APP_STATE.selectedNoteId !== null) {
        const note = APP_STATE.notes.find(n => n.id === APP_STATE.selectedNoteId);
        if (note) {
          note.velocity = val;
        }
      }
    });
  }

  // Sequencer canvas listener
  const gridCanvas = document.getElementById("gridCanvas");
  if (gridCanvas) {
    gridCanvas.addEventListener("mousedown", handleCanvasMouseDown);
    gridCanvas.addEventListener("mousemove", handleCanvasMouseMove);
    gridCanvas.addEventListener("contextmenu", e => e.preventDefault());
  }
  
  window.addEventListener("mouseup", () => {
    isDragging = false;
    dragNote = null;
    dragType = null;
  });

  // Initialize
  renderTracks();
  renderPianoKeys();
  drawGrid();
  
  // Set UI elements based on loaded state
  const loadedTitleEl = document.getElementById("activeProjectTitle");
  if(loadedTitleEl) loadedTitleEl.textContent = APP_STATE.activeProject;
  const loadedTitleEl2 = document.getElementById("activeProjectTitle2");
  if(loadedTitleEl2) loadedTitleEl2.textContent = APP_STATE.activeProject;
  
  const loadedBpmEl = document.getElementById("bpmInput");
  if(loadedBpmEl) loadedBpmEl.value = APP_STATE.bpm;
  const loadedBpmDesktopEl = document.getElementById("bpmInputDesktop");
  if(loadedBpmDesktopEl) loadedBpmDesktopEl.value = APP_STATE.bpm;

  // Initialize key & scale selections from state
  const loadedKeyMobile = document.getElementById("keySelectMobile");
  if(loadedKeyMobile) loadedKeyMobile.value = APP_STATE.key || "C";
  const loadedKeyDesktop = document.getElementById("keySelect");
  if(loadedKeyDesktop) loadedKeyDesktop.value = APP_STATE.key || "C";
  const loadedScaleMobile = document.getElementById("scaleSelectMobile");
  if(loadedScaleMobile) loadedScaleMobile.value = APP_STATE.scale || "Major";
  const loadedScaleDesktop = document.getElementById("scaleSelect");
  if(loadedScaleDesktop) loadedScaleDesktop.value = APP_STATE.scale || "Major";
  
  // Set up horizontal scroll coordinate mapping
  gridContainer.addEventListener("scroll", () => {
    document.getElementById("rulerCanvas").style.left = `-${gridContainer.scrollLeft}px`;
  });

  // ══ Virtual Keyboard Event Handlers ══
  const virtualKeyboard = document.getElementById("virtualKeyboard");
  const sustainToggle = document.getElementById("keyboardSustain");

  if (virtualKeyboard) {
    const playVirtualKey = (keyEl) => {
      const pitch = keyEl.dataset.note;
      if (!pitch) return;
      
      // Determine duration based on sustain checkbox state
      const isSustain = sustainToggle && sustainToggle.checked;
      const duration = isSustain ? "1n" : "8n";
      
      // Trigger note on active track synth
      playNoteAudio(APP_STATE.activeTrackId, pitch, duration, Tone.now());
      
      // Add active visual state
      keyEl.classList.add("active-key");
    };

    const stopVirtualKey = (keyEl) => {
      keyEl.classList.remove("active-key");
    };

    // Add event listeners to all keys
    const keys = virtualKeyboard.querySelectorAll("[data-note]");
    keys.forEach(keyEl => {
      // Touch support
      keyEl.addEventListener("touchstart", (e) => {
        e.preventDefault();
        playVirtualKey(keyEl);
      }, { passive: false });

      keyEl.addEventListener("touchend", (e) => {
        e.preventDefault();
        stopVirtualKey(keyEl);
      }, { passive: false });

      // Mouse support
      keyEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        playVirtualKey(keyEl);
      });

      keyEl.addEventListener("mouseup", (e) => {
        e.preventDefault();
        stopVirtualKey(keyEl);
      });

      keyEl.addEventListener("mouseleave", (e) => {
        e.preventDefault();
        stopVirtualKey(keyEl);
      });
    });
  }

  // Start the visualizer animation loop (always runs)
  requestAnimationFrame(drawVisualizers);

  // Re-size visualizer canvases when inspector panel becomes visible
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      ['freqCanvas', 'circleCanvas', 'waveCanvas'].forEach(id => {
        const c = document.getElementById(id);
        if (c) resizeCanvasToDisplaySize(c);
      });
    });
    const audioMonitors = document.getElementById('audioMonitors');
    if (audioMonitors) ro.observe(audioMonitors);
  }
});

// Canvas roundRect helper
function roundRect(ctx, x, y, width, height, radius = 4) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function getSynthDisplayName(type) {
  if (type === 'PolySynth') return 'Classic Synth';
  if (type === 'MonoSynth') return 'Bass Synth';
  if (type === 'AMSynth') return 'Modulated Synth';
  return type;
}

function renderTracks() {
  const list = document.getElementById('trackList');
  if (!list) return;
  list.innerHTML = '';

  APP_STATE.tracks.forEach(t => {
    const div = document.createElement('div');
    div.className = `px-4 py-3 mx-2 rounded border transition-all flex items-center justify-between group cursor-pointer ${
      t.id === APP_STATE.activeTrackId 
        ? 'bg-primary/10 border-primary text-primary shadow-[0_0_8px_rgba(255,193,116,0.1)]' 
        : 'bg-surface-container border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high'
    }`;
    
    div.onclick = () => selectTrack(t.id);
    
    div.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-[20px] ${t.id === APP_STATE.activeTrackId ? 'text-primary' : 'text-on-surface-variant/80'}" style="font-variation-settings: 'FILL' 1;">
          ${t.synthType === 'MonoSynth' ? 'graphic_eq' : 'piano'}
        </span>
        <div class="flex flex-col">
          <span class="font-headline-sm text-headline-sm font-semibold tracking-tight">${t.name}</span>
          <span class="font-label-mono text-[9px] text-on-surface-variant/50">${getSynthDisplayName(t.synthType)}</span>
        </div>
      </div>
      <div class="flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
        <button class="w-7 h-7 flex items-center justify-center rounded font-label-mono text-[10px] shadow-sm border transition-all hover:bg-error/20 hover:text-error hover:border-error/50 text-on-surface-variant bg-surface-container-highest border-outline-variant/20" onclick="event.stopPropagation(); deleteTrack(${t.id})" title="Delete Track">
          <span class="material-symbols-outlined text-[14px]">delete</span>
        </button>
        <button class="w-7 h-7 flex items-center justify-center rounded font-label-mono text-[10px] shadow-sm border transition-all ${
          t.mute 
            ? 'bg-error text-on-error border-error' 
            : 'bg-surface-container-highest border-outline-variant/20 hover:border-outline-variant text-on-surface-variant'
        }" onclick="event.stopPropagation(); toggleMute(${t.id})">M</button>
        <button class="w-7 h-7 flex items-center justify-center rounded font-label-mono text-[10px] shadow-sm border transition-all ${
          t.solo 
            ? 'bg-tertiary text-on-tertiary border-tertiary' 
            : 'bg-surface-container-highest border-outline-variant/20 hover:border-outline-variant text-on-surface-variant'
        }" onclick="event.stopPropagation(); toggleSolo(${t.id})">S</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function renderPianoKeys() {
  const keysCol = document.getElementById('keysCol');
  if (!keysCol) return;
  let html = '';
  for (let i = TOTAL_KEYS - 1; i >= 0; i--) {
    const octave = Math.floor(i / 12) + APP_STATE.gridConfig.minOctave;
    const noteIndex = i % 12;
    const noteName = NOTE_NAMES[noteIndex];
    const isBlack = noteName.includes('#');
    
    if (isBlack) {
      html += `
        <div class="w-full bg-[#1b1b1d] border-b border-background flex items-center justify-end pr-2 text-[8px] font-label-mono text-on-surface-variant/60 font-semibold relative select-none" style="height: ${APP_STATE.gridConfig.rowHeight}px;">
          <div class="absolute left-0 top-0 bottom-0 w-10 bg-[#000000] border-y border-outline-variant/10 rounded-r shadow"></div>
          ${noteName}${octave}
        </div>`;
    } else {
      html += `
        <div class="w-full bg-[#ffffff] text-[#1c1a1e] border-b border-outline-variant/10 flex items-center justify-end pr-2 text-[9px] font-label-mono font-bold select-none" style="height: ${APP_STATE.gridConfig.rowHeight}px;">
          ${noteName}${octave}
        </div>`;
    }
  }
  keysCol.innerHTML = html;
}

function drawGrid() {
  const c = APP_STATE.gridConfig;
  const totalWidth = c.bars * c.beatsPerBar * c.subdivisions * c.cellWidth;
  const totalHeight = TOTAL_KEYS * c.rowHeight;

  const gridCanvas = document.getElementById('gridCanvas');
  const rulerCanvas = document.getElementById('rulerCanvas');
  if (!gridCanvas || !rulerCanvas) return;

  const ctx = gridCanvas.getContext('2d');
  const rulerCtx = rulerCanvas.getContext('2d');

  gridCanvas.width = totalWidth;
  gridCanvas.height = totalHeight;
  rulerCanvas.width = totalWidth;
  rulerCanvas.height = 32;

  // 1. Draw ruler
  rulerCtx.clearRect(0, 0, totalWidth, 32);
  rulerCtx.fillStyle = '#0e0e10';
  rulerCtx.fillRect(0, 0, totalWidth, 32);
  rulerCtx.fillStyle = 'rgba(229,225,228,0.4)';
  rulerCtx.font = '500 10px JetBrains Mono';
  rulerCtx.textBaseline = 'middle';

  for (let bar = 0; bar < c.bars; bar++) {
    const x = bar * c.beatsPerBar * c.subdivisions * c.cellWidth;
    rulerCtx.fillText(`BAR ${bar + 1}`, x + 8, 16);
    rulerCtx.fillStyle = 'rgba(255,193,116,0.3)';
    rulerCtx.fillRect(x, 0, 1, 32);
    rulerCtx.fillStyle = 'rgba(229,225,228,0.4)';
  }

  // 2. Draw grid background & gridlines
  ctx.clearRect(0, 0, totalWidth, totalHeight);
  
  for (let i = 0; i < TOTAL_KEYS; i++) {
    const y = i * c.rowHeight;
    const noteIndex = (TOTAL_KEYS - 1 - i) % 12;
    const isBlack = NOTE_NAMES[noteIndex].includes('#');
    
    ctx.fillStyle = isBlack ? '#171719' : '#1b1b1d';
    ctx.fillRect(0, y, totalWidth, c.rowHeight);
    
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, y, totalWidth, 1);
  }

  for (let col = 0; col <= c.bars * c.beatsPerBar * c.subdivisions; col++) {
    const x = col * c.cellWidth;
    const isBar = col % (c.beatsPerBar * c.subdivisions) === 0;
    const isBeat = col % c.subdivisions === 0;
    
    ctx.fillStyle = isBar ? 'rgba(255,255,255,0.08)' : (isBeat ? 'rgba(255,255,255,0.03)' : 'transparent');
    if (ctx.fillStyle !== 'transparent') {
      ctx.fillRect(x, 0, 1, totalHeight);
    }
  }

  // 3. Draw notes (active track bright, others dimmed)
  APP_STATE.notes.forEach(note => {
    const track = APP_STATE.tracks.find(t => t.id === note.trackId);
    if (!track) return;

    const pitchIndex = getPitchIndex(note.pitch);
    if (pitchIndex < 0 || pitchIndex >= TOTAL_KEYS) return;

    const isActiveTrack = note.trackId === APP_STATE.activeTrackId;
    const baseColor = track.color;
    const y = (TOTAL_KEYS - 1 - pitchIndex) * c.rowHeight;
    const x = note.time * c.subdivisions * c.cellWidth;
    const width = note.duration * c.subdivisions * c.cellWidth;
    const height = c.rowHeight - 2;
    const isSelected = note.id === APP_STATE.selectedNoteId;

    ctx.save();
    ctx.globalAlpha = isActiveTrack ? 1 : 0.28;
    ctx.shadowColor = isSelected ? '#ffffff' : baseColor;
    ctx.shadowBlur = isSelected ? 12 : (isActiveTrack ? 6 : 2);
    
    const grad = ctx.createLinearGradient(x, y, x, y + height);
    if (isSelected) {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#ffc174');
    } else {
      grad.addColorStop(0, baseColor);
      grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    }
    ctx.fillStyle = grad;
    
    roundRect(ctx, x + 1, y + 1, width - 2, height, 4);
    ctx.fill();
    ctx.restore();

    const glossGrad = ctx.createLinearGradient(x, y, x, y + height * 0.4);
    glossGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
    glossGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glossGrad;
    roundRect(ctx, x + 1, y + 1, width - 2, height * 0.4, 4);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, x + width - 6, y + 2, 3, height - 4, 1.5);
    ctx.fill();
  });
}

function getPitchIndex(pitch) {
  const normalized = normalizePitch(pitch);
  const oct = parseInt(normalized.slice(-1), 10);
  const note = normalized.slice(0, -1);
  const noteIdx = NOTE_NAMES.indexOf(note);
  if (noteIdx === -1 || isNaN(oct)) return -1;
  return (oct - APP_STATE.gridConfig.minOctave) * 12 + noteIdx;
}

function getPitchFromIndex(index) {
  const oct = Math.floor(index / 12) + APP_STATE.gridConfig.minOctave;
  const note = NOTE_NAMES[index % 12];
  return `${note}${oct}`;
}

function selectTrack(id) {
  APP_STATE.activeTrackId = id;
  APP_STATE.selectedNoteId = null;
  renderTracks();
  drawGrid();
  updatePropertiesPanel();
}

function refreshTrackAudibility() {
  const hasSolo = APP_STATE.tracks.some(track => track.solo);
  APP_STATE.tracks.forEach(track => {
    const channel = APP_STATE.channels[track.id];
    if (channel) {
      const shouldSilence = track.mute || (hasSolo && !track.solo);
      // Premium hardware clickless fade ramp
      channel.volume.rampTo(shouldSilence ? -100 : track.vol, 0.05);
    }
  });
}

function toggleMute(id) {
  const t = APP_STATE.tracks.find(track => track.id === id);
  if (!t) return;
  t.mute = !t.mute;
  refreshTrackAudibility();
  renderTracks();
}

function toggleSolo(id) {
  const t = APP_STATE.tracks.find(track => track.id === id);
  if (!t) return;
  t.solo = !t.solo;
  refreshTrackAudibility();
  renderTracks();
}

function deleteTrack(id) {
  if (APP_STATE.tracks.length <= 1) {
    showToast("Cannot delete the last track");
    return;
  }
  if (APP_STATE.isPlaying) stopPlay();
  
  // Dispose audio nodes to prevent memory leak and sound playing
  const channel = APP_STATE.channels[id];
  if (channel) {
    channel.dispose();
    delete APP_STATE.channels[id];
  }
  
  const synth = APP_STATE.synths[id];
  if (synth) {
    synth.dispose();
    delete APP_STATE.synths[id];
  }

  APP_STATE.tracks = APP_STATE.tracks.filter(t => t.id !== id);
  
  // Delete all notes on this track
  APP_STATE.notes = APP_STATE.notes.filter(n => n.trackId !== id);
  
  if (APP_STATE.activeTrackId === id) {
    APP_STATE.activeTrackId = APP_STATE.tracks[0].id;
    APP_STATE.selectedNoteId = null;
    updatePropertiesPanel();
  }
  
  renderTracks();
  drawGrid();
  showToast("✦ Track Deleted");
}

function updatePropertiesPanel() {
  const trackTab = document.getElementById("trackProps");
  const noteTab = document.getElementById("noteProps");
  const header = document.getElementById("propHeader");
  const inspectorIcon = document.getElementById("inspectorIcon");

  if (APP_STATE.selectedNoteId !== null) {
    header.innerText = 'Note';
    inspectorIcon.innerText = 'music_note';
    trackTab.classList.add("hidden");
    noteTab.classList.remove("hidden");
    
    const note = APP_STATE.notes.find(n => n.id === APP_STATE.selectedNoteId);
    if (note) {
      document.getElementById('propPitch').innerText = note.pitch;
      document.getElementById('propVelocity').value = note.velocity;
      document.getElementById('velocityVal').textContent = note.velocity;
      
      const noteDur = note.duration;
      const selectVal = noteDur === 0.25 ? "16n" : (noteDur === 0.5 ? "8n" : (noteDur === 1.0 ? "4n" : (noteDur === 2.0 ? "2n" : "1n")));
      document.getElementById("propDuration").value = selectVal;
    }
  } else {
    trackTab.classList.remove("hidden");
    noteTab.classList.add("hidden");
    
    const track = APP_STATE.tracks.find(t => t.id === APP_STATE.activeTrackId);
    if (track) {
      header.innerText = track.name;
      inspectorIcon.innerText = track.synthType === 'MonoSynth' ? 'graphic_eq' : 'piano';
      
      document.getElementById('propVolume').value = track.vol;
      document.getElementById('volumeVal').textContent = track.vol === -60 ? "-∞ dB" : `${track.vol.toFixed(1)} dB`;
      
      document.getElementById('propPan').value = track.pan;
      document.getElementById('panVal').textContent = track.pan === 0 ? "Center" : (track.pan < 0 ? `L ${Math.abs(track.pan).toFixed(1)}` : `R ${track.pan.toFixed(1)}`);
      
      // Update send button state displays
      ["Reverb", "Delay", "Chorus"].forEach(eff => {
        const indicator = document.getElementById(`eff${eff}Indicator`);
        if (indicator) {
          if (track.effects[eff]) {
            indicator.classList.remove("bg-transparent");
            indicator.classList.add("bg-primary");
          } else {
            indicator.classList.add("bg-transparent");
            indicator.classList.remove("bg-primary");
          }
        }
      });
      
      updateSignalChainUI(track);
    }
  }
}

function updateSignalChainUI(track) {
  const chain = document.getElementById("effectChain");
  if (!chain) return;
  
  const activeSends = [];
  if (track.effects.Reverb) activeSends.push("Reverb");
  if (track.effects.Delay) activeSends.push("Echo");
  if (track.effects.Chorus) activeSends.push("Chorus");
  
  if (activeSends.length === 0) {
    chain.innerHTML = `${track.name} &rarr; Master Out`;
  } else {
    chain.innerHTML = `${track.name} &rarr; ${activeSends.join(" &rarr; ")} &rarr; Master Out`;
  }
}

// 3. Sequencer Coordinate Mapping & Note Drag Handles
let isDragging = false;
let dragNote = null;
let dragType = null;
let dragStartCol = 0;

function getGridCoordinates(e) {
  const rect = document.getElementById("gridCanvas").getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return { x, y };
}

function handleCanvasMouseDown(e) {
  const coords = getGridCoordinates(e);
  const c = APP_STATE.gridConfig;
  const clickCol = Math.floor(coords.x / c.cellWidth);
  const clickRow = Math.floor(coords.y / c.rowHeight);
  const pitchIndex = TOTAL_KEYS - 1 - clickRow;
  const pitch = getPitchFromIndex(pitchIndex);
  const time = clickCol / c.subdivisions;

  const activeNotes = APP_STATE.notes.filter(n => n.trackId === APP_STATE.activeTrackId);
  const clickedNote = activeNotes.find(n => {
    const noteStartCol = n.time * c.subdivisions;
    const noteEndCol = noteStartCol + n.duration * c.subdivisions;
    const notePitchIdx = getPitchIndex(n.pitch);
    return pitchIndex === notePitchIdx && clickCol >= noteStartCol && clickCol < noteEndCol;
  });

  // Right click to erase
  if (e.button === 2) {
    if (clickedNote) {
      if (APP_STATE.isPlaying) stopPlay();
      APP_STATE.notes = APP_STATE.notes.filter(n => n.id !== clickedNote.id);
      APP_STATE.selectedNoteId = null;
      drawGrid();
      updatePropertiesPanel();
      showToast("Note deleted");
    }
    return;
  }

  if (clickedNote) {
    APP_STATE.selectedNoteId = clickedNote.id;
    isDragging = true;
    dragNote = clickedNote;
    const noteEndCol = clickedNote.time * c.subdivisions + clickedNote.duration * c.subdivisions;
    // Handle rightmost drag boundary for resizing notes
    dragType = clickCol >= noteEndCol - 0.7 ? 'resize' : 'move';
    dragStartCol = clickCol;
    updatePropertiesPanel();
    drawGrid();
  } else {
    if (APP_STATE.isPlaying) stopPlay();
    // Determine drawing duration from select field
    const selectEl = document.getElementById("propDuration");
    const val = selectEl ? selectEl.value : "4n";
    const durBeats = val === "16n" ? 0.25 : (val === "8n" ? 0.5 : (val === "4n" ? 1.0 : (val === "2n" ? 2.0 : 4.0)));
    
    const newNote = {
      id: APP_STATE.noteIdCounter++, 
      trackId: APP_STATE.activeTrackId,
      time,
      duration: durBeats,
      pitch,
      velocity: 100
    };
    APP_STATE.notes.push(newNote);
    APP_STATE.selectedNoteId = newNote.id;
    
    // Preview single pitch triggers
    if (Tone.context.state === 'running') {
      playNoteAudio(APP_STATE.activeTrackId, pitch, '8n', Tone.now());
    }
    
    updatePropertiesPanel();
    drawGrid();
  }
}

function handleCanvasMouseMove(e) {
  if (!isDragging || !dragNote) return;
  const coords = getGridCoordinates(e);
  const c = APP_STATE.gridConfig;
  const col = Math.floor(coords.x / c.cellWidth);
  const row = Math.floor(coords.y / c.rowHeight);
  
  if (dragType === 'move') {
    dragNote.time = Math.max(0, col / c.subdivisions);
    const pitchIdx = TOTAL_KEYS - 1 - row;
    if (pitchIdx >= 0 && pitchIdx < TOTAL_KEYS) {
      dragNote.pitch = getPitchFromIndex(pitchIdx);
    }
  } else if (dragType === 'resize') {
    const startCol = dragNote.time * c.subdivisions;
    const newDurCols = Math.max(1, col - startCol + 1);
    dragNote.duration = newDurCols / c.subdivisions;
  }
  
  if (APP_STATE.isPlaying) stopPlay();
  drawGrid();
  if (APP_STATE.selectedNoteId === dragNote.id) {
    document.getElementById('propPitch').innerText = dragNote.pitch;
  }
}

// 4. Transport Playback Scheduling Engine
function togglePlay() {
  if (Tone.context.state !== 'running') return;
  
  const playIcon = document.getElementById("playIcon");
  
  if (APP_STATE.isPlaying) {
    Tone.Transport.pause();
    if (playIcon) playIcon.textContent = "play_arrow";
    APP_STATE.isPlaying = false;
  } else {
    scheduleNotes();
    Tone.Transport.start();
    if (playIcon) playIcon.textContent = "pause";
    APP_STATE.isPlaying = true;
    requestAnimationFrame(updatePlayhead);
  }
}

function stopPlay() {
  if (Tone.context.state !== 'running') return;
  
  Tone.Transport.stop();
  Tone.Transport.cancel(0);
  Tone.Transport.position = 0;
  
  document.getElementById("playIcon").textContent = "play_arrow";
  APP_STATE.isPlaying = false;
  document.getElementById("playhead").style.left = "64px";
  updatePosDisplay();
}

function scheduleNotes() {
  Tone.Transport.cancel(0);
  const hasSolo = APP_STATE.tracks.some(track => track.solo);
  
  APP_STATE.notes.forEach(note => {
    const t = APP_STATE.tracks.find(tr => tr.id === note.trackId);
    if (!t || t.mute || (hasSolo && !t.solo)) return;

    const bars = Math.floor(note.time / APP_STATE.gridConfig.beatsPerBar);
    const beats = Math.floor(note.time % APP_STATE.gridConfig.beatsPerBar);
    const sixteenths = Math.round((note.time % 1) * 4);
    const timeStr = `${bars}:${beats}:${sixteenths}`;

    Tone.Transport.schedule((time) => {
      playNoteAudio(note.trackId, note.pitch, `${note.duration * 4}n`, time);
    }, timeStr);
  });
}

function updatePlayhead() {
  if (!APP_STATE.isPlaying) return;
  
  const ticks = Tone.Transport.ticks;
  const ticksPerBeat = Tone.Transport.PPQ;
  const totalBeats = ticks / ticksPerBeat;
  
  const c = APP_STATE.gridConfig;
  const pxPerBeat = c.subdivisions * c.cellWidth;
  const offset = 64; // adjusted key column spacer offset width
  
  const gridContainer = document.getElementById("gridContainer");
  const scrollOffset = gridContainer ? gridContainer.scrollLeft : 0;
  
  const x = offset + totalBeats * pxPerBeat - scrollOffset;
  document.getElementById("playhead").style.left = `${x}px`;
  
  updatePosDisplay();
  requestAnimationFrame(updatePlayhead);
}

function updatePosDisplay() {
  const pos = Tone.Transport.position.split(':');
  const bar = parseInt(pos[0]) + 1;
  const beat = parseInt(pos[1]) + 1;
  const tick = Math.floor(parseFloat(pos[2] || 0));
  const text = `${String(bar).padStart(3, '0')} : ${beat} : ${String(tick).padStart(2, '0')}`;
  
  // Update both mobile and desktop posDisplay elements (duplicate IDs in responsive layout)
  document.querySelectorAll("#posDisplay").forEach(el => { el.innerText = text; });
}

// 5. Project Templates
const n = (id, trackId, pitch, time, duration, velocity) => ({ id, trackId, pitch, time, duration, velocity });

const TEMPLATES = {
  edm: {
    name: 'EDM Beat',
    title: 'EDM Beat',
    bpm: 128,
    tracks: [
      { id: 0, name: 'Kick',  color: '#ffb4ab', synthType: 'AMSynth',   mute: false, solo: false, vol: -2, pan: 0,    effects: { Reverb: false, Delay: false, Chorus: false } },
      { id: 1, name: 'Bass',  color: '#d0bcff', synthType: 'MonoSynth', mute: false, solo: false, vol: -5, pan: 0,    effects: { Reverb: false, Delay: false, Chorus: false } },
      { id: 2, name: 'Lead',  color: '#7fd0ff', synthType: 'AMSynth',   mute: false, solo: false, vol: -4, pan: 0.2,  effects: { Reverb: true,  Delay: true,  Chorus: false } },
      { id: 3, name: 'Pad',   color: '#ffc174', synthType: 'PolySynth', mute: false, solo: false, vol: -10, pan: 0,    effects: { Reverb: true,  Delay: false, Chorus: true  } },
    ],
    notes: [
      n(0,0,'C2',0,0.25,120), n(1,0,'C2',1,0.25,115), n(2,0,'C2',2,0.25,120), n(3,0,'C2',3,0.25,115),
      n(4,0,'C2',4,0.25,120), n(5,0,'C2',5,0.25,115), n(6,0,'C2',6,0.25,120), n(7,0,'C2',7,0.25,115),
      n(8,1,'C2',0,0.5,110),  n(9,1,'G2',0.5,0.5,105), n(10,1,'C2',1,0.5,110), n(11,1,'G2',1.5,0.5,105),
      n(12,1,'C2',2,0.5,110), n(13,1,'G2',2.5,0.5,105), n(14,1,'C2',3,0.5,110), n(15,1,'G2',3.5,0.5,105),
      n(16,2,'G4',0,0.25,90), n(17,2,'A4',0.5,0.25,85), n(18,2,'B4',1,0.5,95), n(19,2,'C5',2,0.5,100),
      n(20,2,'G4',4,0.25,90), n(21,2,'A4',4.5,0.25,85), n(22,2,'B4',5,0.5,95), n(23,2,'C5',6,0.5,100),
      n(24,3,'C3',0,2,55), n(25,3,'G3',2,2,50), n(26,3,'C3',4,2,55), n(27,3,'G3',6,2,50),
    ]
  },
  lofi: {
    name: 'Lofi Beat',
    title: 'Lofi Beat',
    bpm: 82,
    tracks: [
      { id: 0, name: 'Piano', color: '#ffc174', synthType: 'PolySynth', mute: false, solo: false, vol: -3, pan: -0.2, effects: { Reverb: true,  Delay: true,  Chorus: false } },
      { id: 1, name: 'Keys',  color: '#d0bcff', synthType: 'PolySynth', mute: false, solo: false, vol: -8, pan: 0.3,  effects: { Reverb: true,  Delay: true,  Chorus: true  } },
      { id: 2, name: 'Bass',  color: '#7fd0ff', synthType: 'MonoSynth', mute: false, solo: false, vol: -6, pan: 0,    effects: { Reverb: false, Delay: false, Chorus: false } },
    ],
    notes: [
      n(0,0,'E3',0,1.5,75), n(1,0,'G3',1.5,1,70), n(2,0,'A3',2.5,1.5,72), n(3,0,'B3',4,1,68),
      n(4,0,'D4',5,1.5,75), n(5,0,'E4',6.5,2,70),
      n(6,1,'E4',0,4,45), n(7,1,'B3',4,4,42),
      n(8,2,'E2',0,1,95), n(9,2,'B2',1,1,90), n(10,2,'A2',2,1,88), n(11,2,'G2',3,1,85),
      n(12,2,'E2',4,1,95), n(13,2,'B2',5,1,90), n(14,2,'A2',6,1,88), n(15,2,'G2',7,1,85),
    ]
  },
  cinematic: {
    name: 'Cinematic Theme',
    title: 'Cinematic Theme',
    bpm: 90,
    tracks: [
      { id: 0, name: 'Strings', color: '#d0bcff', synthType: 'PolySynth', mute: false, solo: false, vol: -6, pan: 0,    effects: { Reverb: true,  Delay: false, Chorus: true  } },
      { id: 1, name: 'Piano',   color: '#ffc174', synthType: 'PolySynth', mute: false, solo: false, vol: -2, pan: -0.1, effects: { Reverb: true,  Delay: true,  Chorus: false } },
      { id: 2, name: 'Brass',   color: '#ffb4ab', synthType: 'AMSynth',   mute: false, solo: false, vol: -5, pan: 0.2,  effects: { Reverb: true,  Delay: false, Chorus: false } },
    ],
    notes: [
      n(0,0,'C3',0,4,60), n(1,0,'E3',0,4,58), n(2,0,'G3',0,4,55), n(3,0,'C4',0,4,52),
      n(4,0,'A2',4,4,58), n(5,0,'C3',4,4,55), n(6,0,'E3',4,4,52), n(7,0,'A3',4,4,50),
      n(8,1,'C4',2,1,85), n(9,1,'E4',3,1,80), n(10,1,'G4',4,1,88), n(11,1,'A4',5,2,82),
      n(12,1,'G4',7,1,78), n(13,1,'E4',8,1,75),
      n(14,2,'C4',0,2,70), n(15,2,'G4',2,2,68), n(16,2,'C5',4,3,75), n(17,2,'E5',7,2,72),
    ]
  },
  horror: {
    name: 'Horror Ambience',
    title: 'Horror Ambience',
    bpm: 65,
    tracks: [
      { id: 0, name: 'Drone',   color: '#534434', synthType: 'PolySynth', mute: false, solo: false, vol: -6, pan: 0,    effects: { Reverb: true,  Delay: true,  Chorus: true  } },
      { id: 1, name: 'Texture', color: '#7fd0ff', synthType: 'AMSynth',   mute: false, solo: false, vol: -10, pan: -0.3, effects: { Reverb: true,  Delay: true,  Chorus: false } },
      { id: 2, name: 'Hits',    color: '#ffb4ab', synthType: 'MonoSynth', mute: false, solo: false, vol: -2, pan: 0.2,  effects: { Reverb: true,  Delay: false, Chorus: false } },
    ],
    notes: [
      n(0,0,'C3',0,8,45), n(1,0,'D#3',0,8,40),
      n(2,1,'F#4',1,0.5,55), n(3,1,'G4',3,0.5,50), n(4,1,'A#4',5,0.5,52), n(5,1,'C5',7,0.5,48),
      n(6,2,'C3',0,0.5,110), n(7,2,'C3',4,0.5,100), n(8,2,'C3',6,0.5,105),
      n(9,0,'D#3',4,4,42), n(10,0,'A#3',4,4,38),
    ]
  },
  piano: {
    name: 'Piano Melody',
    title: 'Piano Melody',
    bpm: 100,
    tracks: [
      { id: 0, name: 'Piano', color: '#ffc174', synthType: 'PolySynth', mute: false, solo: false, vol: 0, pan: 0, effects: { Reverb: true, Delay: false, Chorus: false } },
    ],
    notes: [
      n(0,0,'C4',0,0.5,88), n(1,0,'E4',0.5,0.5,82), n(2,0,'G4',1,0.5,85), n(3,0,'A4',1.5,0.5,80),
      n(4,0,'G4',2,0.5,78), n(5,0,'E4',2.5,0.5,75), n(6,0,'C4',3,1,85),
      n(7,0,'D4',4,0.5,82), n(8,0,'F4',4.5,0.5,78), n(9,0,'A4',5,0.5,80), n(10,0,'B4',5.5,0.5,76),
      n(11,0,'C5',6,1.5,90),
      n(12,0,'E4',8,0.5,80), n(13,0,'G4',8.5,0.5,78), n(14,0,'C5',9,1,85), n(15,0,'G4',10,1,75),
    ]
  }
};

const TRACK_CARD_ACTIVE = 'bg-primary/10 border-primary text-primary shadow-[0_0_8px_rgba(255,193,116,0.1)]';
const TRACK_CARD_IDLE = 'bg-surface-container border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high';

function setActiveTemplateItem(templateId) {
  document.querySelectorAll('.template-item').forEach(btn => {
    const isActive = btn.dataset.template === templateId;
    btn.className = `template-item w-[calc(100%-1rem)] mx-2 px-4 py-3 rounded border transition-all flex items-center gap-3 cursor-pointer ${
      isActive ? TRACK_CARD_ACTIVE : TRACK_CARD_IDLE
    }`;
    const icon = btn.querySelector('.material-symbols-outlined');
    if (icon) {
      icon.classList.toggle('text-primary', isActive);
      icon.classList.toggle('text-on-surface-variant/80', !isActive);
    }
    const title = btn.querySelector('.font-headline-sm');
    if (title) {
      title.classList.toggle('text-primary', isActive);
      title.classList.toggle('text-on-surface', !isActive);
    }
  });
}

function disposeAllAudio() {
  APP_STATE.tracks.forEach(t => {
    if (APP_STATE.channels[t.id]) APP_STATE.channels[t.id].dispose();
    if (APP_STATE.synths[t.id]) APP_STATE.synths[t.id].dispose();
  });
  APP_STATE.channels = {};
  APP_STATE.synths = {};
}

async function applyTemplate(templateId) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) return;

  if (Tone.context.state !== 'running') {
    await Tone.start();
  }

  if (APP_STATE.isPlaying) stopPlay();

  disposeAllAudio();

  APP_STATE.bpm = tpl.bpm;
  APP_STATE.tracks = JSON.parse(JSON.stringify(tpl.tracks));
  APP_STATE.notes = tpl.notes.map((note, i) => ({ ...note, id: i }));
  APP_STATE.noteIdCounter = APP_STATE.notes.length;
  APP_STATE.activeTrackId = 0;
  APP_STATE.selectedNoteId = null;
  APP_STATE.activeProject = tpl.title;

  const bpmMobile = document.getElementById('bpmInput');
  const bpmDesktop = document.getElementById('bpmInputDesktop');
  if (bpmMobile) bpmMobile.value = tpl.bpm;
  if (bpmDesktop) bpmDesktop.value = tpl.bpm;
  Tone.Transport.bpm.value = tpl.bpm;

  document.querySelectorAll('#activeProjectTitle, #activeProjectTitle2').forEach(el => {
    if (el) el.textContent = tpl.title;
  });

  setActiveTemplateItem(templateId);

  setupAudio();
  renderTracks();
  drawGrid();
  updatePropertiesPanel();

  const statusIndicator = document.getElementById("engineStatus");
  if (statusIndicator) {
    statusIndicator.classList.remove("bg-primary", "animate-pulse");
    statusIndicator.classList.add("bg-[#5eff8a]");
    statusIndicator.title = "Audio Engine Connected";
  }

  showToast(`Loaded ${tpl.name} — click tracks to view each part`);
}

// 6. Mood / Vibe Arrange Synthesis Engine
const MOODS = {
  'Chill':    { bpm: 88,  scale: [0,2,3,5,7,8,10], density: 0.35, octave: 3, pad: false },
  'Epic':     { bpm: 135, scale: [0,2,4,5,7,9,11],  density: 0.75, octave: 3, pad: true  },
  'Dark':     { bpm: 72,  scale: [0,1,3,5,7,8,10], density: 0.45, octave: 2, pad: true  },
  'Dreamy':   { bpm: 95,  scale: [0,2,4,7,9],       density: 0.3,  octave: 4, pad: true  },
  'Happy':    { bpm: 112, scale: [0,2,4,7,9],       density: 0.55, octave: 3, pad: false },
  'Groovy':   { bpm: 105, scale: [0,2,4,5,7,9],     density: 0.6,  octave: 3, pad: false },
  'Ambient':  { bpm: 68,  scale: [0,3,5,7,10],      density: 0.22, octave: 4, pad: true  },
  'Retro':    { bpm: 118, scale: [0,2,3,7,8],       density: 0.5,  octave: 3, pad: true  },
  'Intense':  { bpm: 152, scale: [0,1,3,6,8,10],    density: 0.85, octave: 3, pad: false }
};

const MOOD_ORDER = ['Chill', 'Epic', 'Dark', 'Dreamy', 'Happy', 'Groovy', 'Ambient', 'Retro', 'Intense'];

function renderMoodPills() {
  const pillHtml = MOOD_ORDER.map(mood => {
    const cfg = MOODS[mood];
    return `<button type="button" class="mood-pill px-3 py-2 text-[10px] md:text-[11px] rounded-md font-label-caps border border-outline-variant/20 bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high hover:border-primary/30 transition-all cursor-pointer" data-mood="${mood}" title="${cfg.bpm} BPM">${mood.toUpperCase()}</button>`;
  }).join('');

  const desktop = document.getElementById('moodPillsContainer');
  const mobile = document.getElementById('moodPillsContainerMobile');
  if (desktop) desktop.innerHTML = pillHtml;
  if (mobile) mobile.innerHTML = pillHtml;

  const countEl = document.getElementById('moodCount');
  if (countEl) countEl.textContent = `${MOOD_ORDER.length} moods`;
}

function bindMoodPills() {
  document.querySelectorAll('.mood-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.mood-pill').forEach(p => {
        p.classList.remove('bg-primary', 'text-on-primary', 'border-primary', 'shadow-md');
        p.classList.add('bg-surface-container', 'text-on-surface-variant', 'border-outline-variant/20');
      });
      pill.classList.add('bg-primary', 'text-on-primary', 'border-primary', 'shadow-md');
      pill.classList.remove('bg-surface-container', 'text-on-surface-variant', 'border-outline-variant/20');
      APP_STATE.mood = pill.getAttribute('data-mood');
    });
  });
}

function generateMoodMusic(moodName) {
  const config = MOODS[moodName];
  if (!config) return;

  // Apply BPM parameters
  APP_STATE.bpm = config.bpm;
  const bpmMobile = document.getElementById("bpmInput");
  const bpmDesktop = document.getElementById("bpmInputDesktop");
  if (bpmMobile) bpmMobile.value = config.bpm;
  if (bpmDesktop) bpmDesktop.value = config.bpm;
  Tone.Transport.bpm.value = config.bpm;

  APP_STATE.notes = [];
  APP_STATE.noteIdCounter = 0;

  const bars = APP_STATE.gridConfig.bars;
  const tracks = APP_STATE.tracks;
  const n = tracks.length;

  // Helper: pick a random note from a scale at a given octave
  function pickNote(scale, octave, offsetSemis = 0) {
    const step = scale[Math.floor(Math.random() * scale.length)];
    const midiNote = (octave + 1) * 12 + step + offsetSemis;
    const noteName = NOTE_NAMES[midiNote % 12];
    const noteOctave = Math.floor(midiNote / 12) - 1;
    return `${noteName}${Math.max(1, Math.min(7, noteOctave))}`;
  }

  // Helper: push a note safely (only if trackIdx within bounds)
  function pushNote(trackIdx, time, duration, pitch, velocity) {
    if (trackIdx >= n) return;
    const trackId = tracks[trackIdx].id;
    APP_STATE.notes.push({
      id: APP_STATE.noteIdCounter++,
      trackId,
      time: Math.round(time * 100) / 100,
      duration,
      pitch,
      velocity: Math.round(Math.min(127, Math.max(30, velocity)))
    });
  }

  const sc = config.scale;
  const oct = config.octave;

  // ── Per-mood generation strategies ──────────────────────────────────
  for (let bar = 0; bar < bars; bar++) {
    const bt = bar * 4; // bar start in beats

    if (moodName === 'Chill') {
      // Sparse: bass on 1 & 3, piano melody with space, no arp
      pushNote(0, bt,       2.0,  pickNote(sc, oct),       70 + Math.random()*15);  // Bass root
      if (Math.random() > 0.4) pushNote(0, bt + 2, 2.0, pickNote(sc, oct), 60 + Math.random()*15);
      // Gentle melody every 2 beats
      [0, 2].forEach(b => {
        if (Math.random() > 0.45) {
          pushNote(1, bt + b, 1.0, pickNote(sc, oct + 1), 55 + Math.random()*20);
        }
      });
      // Soft pad chord on beat 1
      if (n > 2 && Math.random() > 0.3) pushNote(2, bt, 4.0, pickNote(sc, oct + 1, 4), 40 + Math.random()*15);

    } else if (moodName === 'Epic') {
      // Dense: driving bass every beat, fast arp 8ths, heavy chords on pad
      pushNote(0, bt,       1.0, pickNote(sc, oct - 1),   110);
      pushNote(0, bt + 1,   1.0, pickNote(sc, oct - 1),   100);
      pushNote(0, bt + 2,   1.0, pickNote(sc, oct - 1),   108);
      pushNote(0, bt + 3,   1.0, pickNote(sc, oct - 1),   95);
      // 8th-note arp
      for (let s = 0; s < 8; s++) {
        pushNote(1, bt + s * 0.5, 0.4, pickNote(sc, oct + 1), 75 + Math.random()*25);
      }
      // Power chord pad every 2 beats
      if (n > 2) {
        pushNote(2, bt,       2.0, pickNote(sc, oct,  0), 85);
        pushNote(2, bt,       2.0, pickNote(sc, oct,  7), 80);
        pushNote(2, bt + 2,   2.0, pickNote(sc, oct,  0), 80);
        pushNote(2, bt + 2,   2.0, pickNote(sc, oct,  7), 75);
      }
      // Lead fills every other bar
      if (n > 3 && bar % 2 === 0) {
        [0, 0.5, 1, 1.5].forEach(b => pushNote(3, bt + b, 0.4, pickNote(sc, oct + 2), 90 + Math.random()*20));
      }

    } else if (moodName === 'Dark') {
      // Minor: bass drone on 1, dissonant off-beats, brooding melody
      pushNote(0, bt,       4.0, `C${oct}`,              105);  // root drone
      if (Math.random() > 0.5) pushNote(0, bt + 2, 1.0, `G${oct - 1}`, 90);
      // Eerie arp on off-beats (8th-triplet feel)
      [0.33, 1.0, 1.66, 2.33, 3.0, 3.66].forEach(b => {
        if (Math.random() > 0.35) pushNote(1, bt + b, 0.3, pickNote(sc, oct + 1), 50 + Math.random()*30);
      });
      // Slow brooding melody
      if (n > 2) {
        const darkPitches = [0, 2]; // choose beat positions
        darkPitches.forEach(b => {
          if (Math.random() > 0.3) pushNote(2, bt + b, 1.5, pickNote(sc, oct + 1), 65 + Math.random()*20);
        });
      }
      // Heavy pad held note every bar
      if (n > 3) pushNote(3, bt, 4.0, pickNote(sc, oct, 3), 55 + Math.random()*15);

    } else if (moodName === 'Dreamy') {
      // Very sparse, held pads, floaty high melody
      pushNote(0, bt, 4.0, pickNote(sc, oct), 50 + Math.random()*20);  // long bass/pad
      // Floating melody, 1-2 notes per bar
      const dreamBeats = [0, 1.5, 3].filter(() => Math.random() > 0.5);
      dreamBeats.forEach(b => pushNote(1, bt + b, 1.0, pickNote(sc, oct + 2), 45 + Math.random()*25));
      // Pad cluster every 2 bars
      if (n > 2 && bar % 2 === 0) {
        pushNote(2, bt, 8.0, pickNote(sc, oct + 1, 0), 40);
        pushNote(2, bt, 8.0, pickNote(sc, oct + 1, 7), 35);
      }

    } else if (moodName === 'Happy') {
      // Upbeat pentatonic: bouncy bass, staccato melody, no dissonance
      pushNote(0, bt,     1.0, pickNote(sc, oct),       95);
      pushNote(0, bt + 2, 1.0, pickNote(sc, oct),       88);
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].forEach(b => {
        if (Math.random() > 0.42) pushNote(1, bt + b, 0.4, pickNote(sc, oct + 1), 70 + Math.random()*25);
      });
      if (n > 2 && bar % 2 === 0) pushNote(2, bt, 2.0, pickNote(sc, oct + 1, 4), 60 + Math.random()*15);

    } else if (moodName === 'Groovy') {
      // Syncopated bass on 1 & "and of 2", funky ghost notes, offbeat accents
      pushNote(0, bt,       0.5, pickNote(sc, oct),       115); // beat 1
      pushNote(0, bt + 0.5, 0.25, pickNote(sc, oct),      65);  // ghost
      pushNote(0, bt + 1.5, 0.5, pickNote(sc, oct),       100); // & of 2
      pushNote(0, bt + 2,   0.5, pickNote(sc, oct),       88);
      pushNote(0, bt + 3.5, 0.5, pickNote(sc, oct),       105); // & of 4
      // Funky 16th-note arp with accent on beat 3
      [0, 0.25, 0.75, 1, 1.5, 2, 2.25, 2.75, 3, 3.25, 3.75].forEach(b => {
        const vel = (b === 2) ? 100 : 55 + Math.random()*25;
        if (Math.random() > 0.3) pushNote(1, bt + b, 0.2, pickNote(sc, oct + 1), vel);
      });
      if (n > 2 && bar % 2 === 1) pushNote(2, bt, 2.0, pickNote(sc, oct + 1), 70 + Math.random()*15);

    } else if (moodName === 'Ambient') {
      // Ultra-sparse: very long notes, almost no rhythm
      if (bar % 4 === 0) {
        // New chord block every 4 bars
        pushNote(0, bt, 8.0, `C${oct}`,                    45 + Math.random()*15);
        if (n > 1) pushNote(1, bt, 8.0, pickNote(sc, oct + 1, 0), 35 + Math.random()*15);
        if (n > 2) pushNote(2, bt, 8.0, pickNote(sc, oct + 1, 4), 30 + Math.random()*10);
        if (n > 3) pushNote(3, bt, 8.0, pickNote(sc, oct + 1, 7), 28 + Math.random()*10);
      }
      // Occasional single floating note
      if (Math.random() > 0.72) {
        const randBeat = Math.floor(Math.random() * 4);
        pushNote(1, bt + randBeat, 1.5, pickNote(sc, oct + 2), 35 + Math.random()*20);
      }

    } else if (moodName === 'Retro') {
      // 8-bit / chiptune feel: staccato 8th bass, arpeggiated chords, short notes
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].forEach((b, idx) => {
        // Alternating root and fifth bass pattern
        const bassNote = (idx % 4 < 2) ? `C${oct}` : `G${oct}`;
        pushNote(0, bt + b, 0.4, bassNote, 90 + (idx % 2 === 0 ? 15 : 0));
      });
      // Fast chord arp (up): 16th notes
      const chordTones = [sc[0], sc[2], sc[4] || sc[3], sc[0]];
      for (let s = 0; s < 8; s++) {
        const tone = chordTones[s % chordTones.length];
        const name = NOTE_NAMES[tone % 12];
        pushNote(1, bt + s * 0.5, 0.35, `${name}${oct + 2}`, 80 + (s % 4 === 0 ? 20 : 0));
      }
      // Short melody hits on beats 1 and 3
      if (n > 2) {
        pushNote(2, bt,     0.25, pickNote(sc, oct + 2), 100);
        pushNote(2, bt + 2, 0.25, pickNote(sc, oct + 2), 95);
        if (Math.random() > 0.5) pushNote(2, bt + 3.5, 0.25, pickNote(sc, oct + 2), 90);
      }

    } else if (moodName === 'Intense') {
      // Maximum density: 16th-note bass, furious arp, no space
      for (let s = 0; s < 16; s++) {
        pushNote(0, bt + s * 0.25, 0.2, pickNote(sc, oct - 1), 90 + (s % 4 === 0 ? 25 : 0));
      }
      for (let s = 0; s < 16; s++) {
        pushNote(1, bt + s * 0.25, 0.2, pickNote(sc, oct + 1), 70 + Math.random()*30);
      }
      if (n > 2) {
        [0, 1, 2, 3].forEach(b => pushNote(2, bt + b, 0.9, pickNote(sc, oct), 100 + Math.random()*15));
      }
      if (n > 3) {
        [0, 0.5, 1.5, 2, 3, 3.5].forEach(b => pushNote(3, bt + b, 0.4, pickNote(sc, oct + 2), 80 + Math.random()*25));
      }
    }
  }

  drawGrid();
  if (APP_STATE.isPlaying) scheduleNotes();
}


// Global UI Toast banner helper
function showToast(msg) {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toastMsg");
  if (toast && msgEl) {
    msgEl.textContent = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, 0)";
    
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translate(-50%, 16px)";
    }, 2500);
  }
}

// Visualizer helper to resize canvases dynamically and avoid blurry rendering
function resizeCanvasToDisplaySize(canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}

function visLerp(current, target, speed = 0.22) {
  return current + (target - current) * speed;
}

/** Teal (left) → warm beige (right), t in 0..1 */
function visGradientColor(t, alpha = 1) {
  const r = Math.round(143 + (255 - 143) * t);
  const g = Math.round(213 + (193 - 213) * t);
  const b = Math.round(255 + (116 - 255) * t);
  return `rgba(${r},${g},${b},${alpha})`;
}

function smoothSamples(values, radius = 3) {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) {
      sum += values[j];
      count++;
    }
    out[i] = sum / count;
  }
  return out;
}

function drawSmoothWave(ctx, points, w, h, options = {}) {
  const {
    lineWidth = 1.5,
    centerY = h / 2,
    amplitudeScale = 0.38,
    gradientFill = true
  } = options;

  if (points.length < 2) return;

  const toY = (v) => centerY - v * h * amplitudeScale;
  const xAt = (i) => (i / (points.length - 1)) * w;

  const traceCurve = () => {
    ctx.moveTo(xAt(0), toY(points[0]));
    for (let i = 1; i < points.length; i++) {
      const xc = (xAt(i - 1) + xAt(i)) / 2;
      const yc = (toY(points[i - 1]) + toY(points[i])) / 2;
      ctx.quadraticCurveTo(xAt(i - 1), toY(points[i - 1]), xc, yc);
    }
    ctx.lineTo(xAt(points.length - 1), toY(points[points.length - 1]));
  };

  if (gradientFill) {
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    traceCurve();
    ctx.lineTo(w, centerY);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, 0, w, 0);
    fillGrad.addColorStop(0, visGradientColor(0, 0.22));
    fillGrad.addColorStop(0.5, visGradientColor(0.45, 0.14));
    fillGrad.addColorStop(1, visGradientColor(1, 0.1));
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }

  ctx.beginPath();
  traceCurve();
  const strokeGrad = ctx.createLinearGradient(0, 0, w, 0);
  strokeGrad.addColorStop(0, visGradientColor(0, 0.95));
  strokeGrad.addColorStop(0.55, visGradientColor(0.5, 0.9));
  strokeGrad.addColorStop(1, visGradientColor(1, 0.95));
  ctx.strokeStyle = strokeGrad;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = visGradientColor(0.35, 0.4);
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// Real-time Canvas Rendering loop for Frequency Bars, Circular Spectrum, and Waveform Monitor
function drawVisualizers() {
  requestAnimationFrame(drawVisualizers);

  const freqCanvas = document.getElementById("freqCanvas");
  const circleCanvas = document.getElementById("circleCanvas");
  const waveCanvas = document.getElementById("waveCanvas");
  const now = performance.now() / 1000;
  VIS_STATE.wavePhase += 0.04;

  // 1. Frequency Bars — smooth bounce, teal → beige left to right
  if (freqCanvas) {
    resizeCanvasToDisplaySize(freqCanvas);
    const ctx = freqCanvas.getContext("2d");
    const w = freqCanvas.width;
    const h = freqCanvas.height;
    if (w > 0 && h > 0) {
    ctx.fillStyle = "#0e0e10";
    ctx.fillRect(0, 0, w, h);

    const values = fftAnalyser.getValue();
    const numBars = VIS_STATE.barHeights.length;
    const barWidth = w / numBars;
    const gap = 1.5;
    const maxH = h - 10;
    let totalEnergy = 0;

    for (let i = 0; i < numBars; i++) {
      const binStart = Math.floor((i / numBars) * values.length);
      const binEnd = Math.floor(((i + 1) / numBars) * values.length);
      let sum = 0;
      for (let b = binStart; b < binEnd; b++) sum += values[b];
      const avgDb = sum / (binEnd - binStart || 1);
      const fftNorm = isFinite(avgDb) ? Math.max(0, (avgDb + 85) / 85) : 0;
      totalEnergy += fftNorm;

      const idleWave = 0.12 + Math.sin(now * 2.1 + i * 0.35) * 0.08
                     + Math.sin(now * 0.7 + i * 0.12) * 0.05;
      const target = Math.max(idleWave, fftNorm * 0.92) * maxH;
      VIS_STATE.barHeights[i] = visLerp(VIS_STATE.barHeights[i], target, totalEnergy > 0.08 ? 0.28 : 0.14);

      const barH = VIS_STATE.barHeights[i];
      const x = i * barWidth;
      const y = h - barH;
      const t = i / (numBars - 1);

      const grad = ctx.createLinearGradient(x, h, x + barWidth, 0);
      grad.addColorStop(0, visGradientColor(t, 0.55));
      grad.addColorStop(0.6, visGradientColor(Math.min(1, t + 0.15), 0.75));
      grad.addColorStop(1, visGradientColor(Math.min(1, t + 0.35), 0.95));

      const radius = Math.min(4, (barWidth - gap * 2) / 2);
      ctx.fillStyle = grad;
      roundRect(ctx, x + gap, y, barWidth - gap * 2, barH, radius);
      ctx.fill();

      if (barH > maxH * 0.35) {
        ctx.fillStyle = visGradientColor(t, 0.35);
        ctx.fillRect(x + gap, y - 1, barWidth - gap * 2, 2);
      }
    }
    }
  }

  // 2. Circular Spectrum — beat pump in/out (synced to BPM), teal left / beige right
  if (circleCanvas) {
    resizeCanvasToDisplaySize(circleCanvas);
    const ctx = circleCanvas.getContext("2d");
    const w = circleCanvas.width;
    const h = circleCanvas.height;
    if (w > 0 && h > 0) {
    ctx.fillStyle = "#0e0e10";
    ctx.fillRect(0, 0, w, h);

    const values = fftAnalyser.getValue();
    const cx = w / 2;
    const cy = h / 2;
    const baseR = Math.min(w, h) * 0.18;
    const maxSpike = Math.min(w, h) * 0.3;
    const numPoints = VIS_STATE.circleRadii.length;

    // Beat pump: expand on beat, contract between (forth and back)
    const bpm = APP_STATE.bpm || 120;
    const beatHz = bpm / 60;
    const beatPhase = now * beatHz * Math.PI * 2;
    const beatPump = 0.42 + 0.58 * Math.pow(Math.max(0, Math.sin(beatPhase)), 1.4);

    const ringPulse = 0.15 + beatPump * 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * (0.92 + beatPump * 0.08), 0, Math.PI * 2);
    const ringGrad = ctx.createRadialGradient(cx, cy, baseR * 0.4, cx, cy, baseR);
    ringGrad.addColorStop(0, visGradientColor(0, 0.06));
    ringGrad.addColorStop(1, visGradientColor(0.5, ringPulse));
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    let fftEnergy = 0;
    const angles = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
      angles.push(angle);
      const valIdx = Math.floor((i / numPoints) * values.length);
      const db = values[valIdx];
      const fftNorm = isFinite(db) ? Math.max(0, (db + 85) / 85) : 0;
      fftEnergy += fftNorm;

      const wobble = Math.sin(now * 3 + i * 0.4) * 0.03;
      const spikeBase = 0.12 + beatPump * 0.22 + wobble;
      const targetLen = baseR + Math.max(spikeBase, fftNorm * 0.9 * beatPump) * maxSpike;
      VIS_STATE.circleRadii[i] = visLerp(VIS_STATE.circleRadii[i], targetLen, fftEnergy > 0.06 ? 0.32 : 0.18);
    }

    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
      const px = cx + Math.cos(angles[i]) * VIS_STATE.circleRadii[i];
      const py = cy + Math.sin(angles[i]) * VIS_STATE.circleRadii[i];
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const blobGrad = ctx.createRadialGradient(cx - baseR * 0.3, cy, 0, cx, cy, baseR + maxSpike);
    blobGrad.addColorStop(0, visGradientColor(0, 0.14));
    blobGrad.addColorStop(0.55, visGradientColor(0.45, 0.07));
    blobGrad.addColorStop(1, visGradientColor(1, 0.04));
    ctx.fillStyle = blobGrad;
    ctx.fill();

    for (let i = 0; i < numPoints; i++) {
      const angle = angles[i];
      const valIdx = Math.floor((i / numPoints) * values.length);
      const db = values[valIdx];
      const fftNorm = isFinite(db) ? Math.max(0, (db + 85) / 85) : 0;
      const x1 = cx + Math.cos(angle) * baseR;
      const y1 = cy + Math.sin(angle) * baseR;
      const x2 = cx + Math.cos(angle) * VIS_STATE.circleRadii[i];
      const y2 = cy + Math.sin(angle) * VIS_STATE.circleRadii[i];
      const t = (Math.cos(angle) + 1) / 2;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = visGradientColor(t, 0.4 + (VIS_STATE.circleRadii[i] - baseR) / maxSpike * 0.5);
      ctx.lineWidth = fftNorm > 0.05 ? 2 : 1.25;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    }
  }

  // 3. Waveform Monitor — flowing gradient wave, drifts when idle
  if (waveCanvas) {
    resizeCanvasToDisplaySize(waveCanvas);
    const ctx = waveCanvas.getContext("2d");
    const w = waveCanvas.width;
    const h = waveCanvas.height;
    if (w > 0 && h > 0) {
    const centerY = h / 2;

    ctx.fillStyle = "#0e0e10";
    ctx.fillRect(0, 0, w, h);

    const raw = waveformAnalyser.getValue();
    const smoothed = smoothSamples(raw, 3);
    const amp = smoothed.reduce((s, v) => s + Math.abs(v), 0) / smoothed.length;
    const step = Math.max(1, Math.floor(smoothed.length / 80));
    const points = [];
    const drift = VIS_STATE.wavePhase;

    for (let i = 0; i < smoothed.length; i += step) {
      const idx = i / smoothed.length;
      let v = smoothed[i];
      if (amp < 0.02) {
        const t = idx * Math.PI * 4 + drift;
        v = Math.sin(t) * 0.14 + Math.sin(t * 1.7 + 1.2) * 0.06 + Math.sin(t * 0.4) * 0.03;
      } else {
        v = v * 0.9 + Math.sin(idx * Math.PI * 6 + drift * 0.5) * 0.02;
      }
      points.push(v);
    }

    drawSmoothWave(ctx, points, w, h, {
      centerY,
      amplitudeScale: amp < 0.02 ? 0.36 : 0.4,
      lineWidth: 1.75
    });
    }
  }
}
