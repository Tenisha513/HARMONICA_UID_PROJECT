// Harmonica Dashboard Logic

let currentSort = 'newest';
let currentFilter = 'all';
let currentView = 'grid';

document.addEventListener("DOMContentLoaded", () => {
  // Force reseed if localStorage has old sparse data (no named tracks)
  // Force reseed if localStorage has old sparse data (no named tracks)
  const raw = localStorage.getItem('harmonica_projects') || localStorage.getItem('harmonic_projects') || localStorage.getItem('resonance_projects');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const isOld = parsed.length < 4 || !parsed[0].tracks || !parsed[0].tracks[0] || !parsed[0].tracks[0].name;
      if (isOld) {
        localStorage.removeItem('harmonica_projects');
        localStorage.removeItem('harmonic_projects');
        localStorage.removeItem('resonance_projects');
      }
    } catch(e) {
      localStorage.removeItem('harmonica_projects');
      localStorage.removeItem('harmonic_projects');
      localStorage.removeItem('resonance_projects');
    }
  }

  renderProjects();

  // ── Filter Tabs ──────────────────────────────────────────────
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(b => {
        b.classList.remove('bg-secondary-container','text-on-secondary-container');
        b.classList.add('hover:bg-surface-variant','text-on-surface-variant');
      });
      btn.classList.add('bg-secondary-container','text-on-secondary-container');
      btn.classList.remove('hover:bg-surface-variant','text-on-surface-variant');
      currentFilter = btn.dataset.filter;
      renderProjects();
    });
  });

  // ── View Toggle ──────────────────────────────────────────────
  document.getElementById('btnListView')?.addEventListener('click', () => setView('list'));
  document.getElementById('btnGridView')?.addEventListener('click', () => setView('grid'));

  // ── Sort ─────────────────────────────────────────────────────
  document.getElementById('btnSort')?.addEventListener('click', () => {
    currentSort = currentSort === 'newest' ? 'oldest' : 'newest';
    showToast(currentSort === 'newest' ? '↓ Sorted: Newest first' : '↑ Sorted: Oldest first');
    renderProjects();
  });

  // ── Import ───────────────────────────────────────────────────
  document.getElementById('btnImport')?.addEventListener('click', () => {
    showToast('Import (.res files) — coming soon');
  });

  // ── Search ───────────────────────────────────────────────────
  document.getElementById('globalSearchInput')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.project-card-wrap').forEach(wrap => {
      wrap.style.display = (wrap.dataset.title || '').toLowerCase().includes(q) ? '' : 'none';
    });
  });
});

function showToast(msg) {
  let t = document.getElementById('dashToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'dashToast';
    t.className = 'fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[999] bg-surface-container border border-outline-variant/30 text-on-surface font-label-mono text-[12px] px-5 py-2.5 rounded-full shadow-xl transition-opacity duration-300 opacity-0 pointer-events-none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.remove('opacity-0');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('opacity-0'), 2500);
}

function setView(view) {
  currentView = view;
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  const btnList = document.getElementById('btnListView');
  const btnGrid = document.getElementById('btnGridView');
  if (view === 'list') {
    grid.className = 'flex flex-col gap-3';
    btnList?.classList.add('bg-surface-variant','text-primary');
    btnGrid?.classList.remove('bg-surface-variant','text-primary');
  } else {
    grid.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-gutter';
    btnGrid?.classList.add('bg-surface-variant','text-primary');
    btnList?.classList.remove('bg-surface-variant','text-primary');
  }
}

function createNewProject() {
  const newId = "proj_" + Date.now();
  window.location.href = `studio.html?id=${newId}`;
}

function timeAgo(dateString) {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

function deleteProject(id, event) {
  event.stopPropagation();
  let projects = JSON.parse(localStorage.getItem('harmonica_projects') || localStorage.getItem('harmonic_projects') || localStorage.getItem('resonance_projects') || '[]');
  projects = projects.filter(p => p.id !== id);
  localStorage.setItem('harmonica_projects', JSON.stringify(projects));
  renderProjects();
}

function renderProjects() {
  const grid = document.getElementById("projectsGrid");
  if (!grid) return;
  
  let projectsStr = localStorage.getItem('harmonica_projects') || localStorage.getItem('harmonic_projects') || localStorage.getItem('resonance_projects');
  let projects;
  
  if (!projectsStr) {
    // Helper: build a note object
    const n = (id, trackId, pitch, time, duration, velocity) => ({ id, trackId, pitch, time, duration, velocity });

    projects = [
      {
        id: "proj_demo1",
        title: "Neon Horizon Mix",
        bpm: 120,
        tracks: [
          { id: 0, name: 'Piano',  color: '#ffc174', synthType: 'PolySynth', mute: false, solo: false, vol: 0,   pan: 0,    effects: { Reverb: true,  Delay: false, Chorus: false } },
          { id: 1, name: 'Bass',   color: '#d0bcff', synthType: 'MonoSynth', mute: false, solo: false, vol: -6,  pan: -0.2, effects: { Reverb: false, Delay: false, Chorus: false } },
          { id: 2, name: 'Lead',   color: '#7fd0ff', synthType: 'AMSynth',   mute: false, solo: false, vol: -3,  pan: 0,    effects: { Reverb: true,  Delay: true,  Chorus: true  } },
          { id: 3, name: 'Pad',    color: '#ffb4ab', synthType: 'PolySynth', mute: false, solo: false, vol: -8,  pan: 0.3,  effects: { Reverb: true,  Delay: true,  Chorus: true  } },
        ],
        notes: [
          n(0,0,'C4',0,1,100),  n(1,0,'E4',1,1,90),   n(2,0,'G4',2,1,95),  n(3,0,'A4',3,1,88),
          n(4,0,'C4',4,1,100),  n(5,0,'F4',5,1,85),   n(6,0,'E4',6,1,90),  n(7,0,'D4',7,1,80),
          n(8,1,'C3',0,2,110),  n(9,1,'G3',2,2,105),  n(10,1,'A3',4,2,108),n(11,1,'F3',6,2,100),
          n(12,2,'G5',0.5,0.5,75),n(13,2,'A5',1,0.5,80),n(14,2,'C6',2,1,85),n(15,2,'B5',3,0.5,70),
          n(16,3,'C3',0,4,60),  n(17,3,'F3',4,4,55),
        ],
        modifiedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
      },
      {
        id: "proj_demo2",
        title: "Subterranean Bass",
        bpm: 140,
        tracks: [
          { id: 0, name: 'Bass',   color: '#d0bcff', synthType: 'MonoSynth', mute: false, solo: false, vol: -4, pan: 0,    effects: { Reverb: false, Delay: false, Chorus: false } },
          { id: 1, name: 'Kick',   color: '#ffb4ab', synthType: 'AMSynth',   mute: false, solo: false, vol: -2, pan: 0,    effects: { Reverb: false, Delay: false, Chorus: false } },
        ],
        notes: [
          n(0,0,'C2',0,0.5,120),n(1,0,'C2',0.5,0.5,100),n(2,0,'E2',1,0.5,115),n(3,0,'G2',1.5,0.5,105),
          n(4,0,'A2',2,1,110),  n(5,0,'F2',3,0.5,108), n(6,0,'G2',3.5,0.5,100),
          n(7,1,'C1',0,0.25,127),n(8,1,'C1',2,0.25,127),n(9,1,'C1',3,0.25,127),n(10,1,'C1',3.5,0.25,110),
        ],
        modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
      },
      {
        id: "proj_demo3",
        title: "Echoes in Stone",
        bpm: 95,
        tracks: [
          { id: 0, name: 'Piano',  color: '#ffc174', synthType: 'PolySynth', mute: false, solo: false, vol: 0,  pan: 0,    effects: { Reverb: true,  Delay: true,  Chorus: false } },
          { id: 1, name: 'Pad',    color: '#d0bcff', synthType: 'PolySynth', mute: false, solo: false, vol: -8, pan: 0.4,  effects: { Reverb: true,  Delay: true,  Chorus: true  } },
          { id: 2, name: 'Lead',   color: '#7fd0ff', synthType: 'AMSynth',   mute: false, solo: false, vol: -5, pan: -0.3, effects: { Reverb: true,  Delay: true,  Chorus: false } },
        ],
        notes: [
          n(0,0,'A3',0,2,85),  n(1,0,'C4',2,1,80),   n(2,0,'E4',3,1,88),  n(3,0,'D4',4,2,75),
          n(4,0,'F4',6,1,82),  n(5,0,'E4',7,1,78),
          n(6,1,'A2',0,8,45),  n(7,2,'E5',1,0.5,70),  n(8,2,'G5',1.5,0.5,65),n(9,2,'A5',2,1,72),
          n(10,2,'C6',3,2,68), n(11,2,'B5',5,1,60),   n(12,2,'A5',6,2,65),
        ],
        modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString()
      },
      {
        id: "proj_demo4",
        title: "Midnight Circuit",
        bpm: 128,
        tracks: [
          { id: 0, name: 'Synth',  color: '#7fd0ff', synthType: 'AMSynth',   mute: false, solo: false, vol: -3, pan: 0,    effects: { Reverb: true,  Delay: true,  Chorus: true  } },
          { id: 1, name: 'Bass',   color: '#ffc174', synthType: 'MonoSynth', mute: false, solo: false, vol: -5, pan: -0.1, effects: { Reverb: false, Delay: false, Chorus: false } },
          { id: 2, name: 'Arp',    color: '#ffb4ab', synthType: 'AMSynth',   mute: false, solo: false, vol: -6, pan: 0.5,  effects: { Reverb: true,  Delay: true,  Chorus: false } },
        ],
        notes: [
          n(0,0,'D4',0,1,95),  n(1,0,'F4',1,1,90),   n(2,0,'A4',2,1,95),  n(3,0,'C5',3,1,88),
          n(4,0,'D5',4,2,100), n(5,0,'A4',6,1,85),   n(6,0,'F4',7,1,80),
          n(7,1,'D2',0,2,112), n(8,1,'A2',2,2,108),  n(9,1,'D2',4,2,112), n(10,1,'G2',6,2,105),
          n(11,2,'D5',0,0.25,70),n(12,2,'F5',0.25,0.25,65),n(13,2,'A5',0.5,0.25,70),n(14,2,'C6',0.75,0.25,65),
          n(15,2,'D6',1,0.25,72),n(16,2,'A5',1.25,0.25,65),n(17,2,'F5',1.5,0.25,68),n(18,2,'D5',1.75,0.25,60),
        ],
        modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
      },
      {
        id: "proj_demo5",
        title: "Solar Drift",
        bpm: 82,
        tracks: [
          { id: 0, name: 'Guitar', color: '#ffddb8', synthType: 'PolySynth', mute: false, solo: false, vol: -2, pan: -0.3, effects: { Reverb: true,  Delay: false, Chorus: true  } },
          { id: 1, name: 'Keys',   color: '#d0bcff', synthType: 'PolySynth', mute: false, solo: false, vol: -5, pan: 0.2,  effects: { Reverb: true,  Delay: true,  Chorus: false } },
          { id: 2, name: 'Bass',   color: '#7fd0ff', synthType: 'MonoSynth', mute: false, solo: false, vol: -6, pan: 0,    effects: { Reverb: false, Delay: false, Chorus: false } },
        ],
        notes: [
          n(0,0,'E3',0,2,88),  n(1,0,'G3',2,1,82),   n(2,0,'A3',3,1,85),  n(3,0,'B3',4,2,80),
          n(4,0,'D4',6,2,85),
          n(5,1,'E4',0,4,55),  n(6,1,'A3',4,4,52),
          n(7,2,'E2',0,1,105), n(8,2,'B2',1,1,100),  n(9,2,'A2',2,1,102), n(10,2,'E2',3,1,98),
          n(11,2,'D2',4,1,105),n(12,2,'A2',5,1,100), n(13,2,'G2',6,1,102),n(14,2,'D2',7,1,95),
        ],
        modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()
      },
      {
        id: "proj_demo6",
        title: "Crimson Frequency",
        bpm: 160,
        tracks: [
          { id: 0, name: 'Lead',   color: '#ffb4ab', synthType: 'AMSynth',   mute: false, solo: false, vol: -2, pan: 0,    effects: { Reverb: false, Delay: true,  Chorus: false } },
          { id: 1, name: 'Pad',    color: '#ffc174', synthType: 'PolySynth', mute: false, solo: false, vol: -9, pan: 0,    effects: { Reverb: true,  Delay: false, Chorus: true  } },
          { id: 2, name: 'Bass',   color: '#d0bcff', synthType: 'MonoSynth', mute: false, solo: false, vol: -4, pan: 0,    effects: { Reverb: false, Delay: false, Chorus: false } },
          { id: 3, name: 'Arp',    color: '#7fd0ff', synthType: 'AMSynth',   mute: false, solo: false, vol: -7, pan: 0.6,  effects: { Reverb: true,  Delay: true,  Chorus: true  } },
        ],
        notes: [
          n(0,0,'B4',0,0.5,100),n(1,0,'A4',0.5,0.5,95),n(2,0,'G4',1,0.5,100),n(3,0,'F#4',1.5,0.5,90),
          n(4,0,'E4',2,1,105), n(5,0,'D4',3,0.5,95),  n(6,0,'E4',3.5,0.5,100),n(7,0,'B4',4,2,110),
          n(8,1,'E3',0,8,40),
          n(9,2,'E2',0,0.5,120),n(10,2,'E2',0.5,0.5,110),n(11,2,'A2',1,1,115),n(12,2,'B2',2,1,112),
          n(13,2,'G2',3,0.5,108),n(14,2,'A2',3.5,0.5,105),n(15,2,'E2',4,2,120),
          n(16,3,'E5',0,0.25,65),n(17,3,'B5',0.25,0.25,60),n(18,3,'E6',0.5,0.25,65),n(19,3,'B5',0.75,0.25,60),
        ],
        modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString()
      },
      {
        id: "proj_demo7",
        title: "Lunar Phase",
        bpm: 75,
        tracks: [
          { id: 0, name: 'Piano',  color: '#ffc174', synthType: 'PolySynth', mute: false, solo: false, vol: 0,  pan: 0,    effects: { Reverb: true,  Delay: false, Chorus: false } },
          { id: 1, name: 'Strings',color: '#d0bcff', synthType: 'PolySynth', mute: false, solo: false, vol: -6, pan: 0,    effects: { Reverb: true,  Delay: false, Chorus: true  } },
        ],
        notes: [
          n(0,0,'C4',0,1,80),  n(1,0,'Eb4',1,1,75),  n(2,0,'G4',2,1,82),  n(3,0,'Bb4',3,2,78),
          n(4,0,'Ab4',5,1,75), n(5,0,'G4',6,1,80),   n(6,0,'F4',7,1,72),
          n(7,0,'C4',8,0.5,78),n(8,0,'D4',8.5,0.5,72),n(9,0,'Eb4',9,2,80),
          n(10,1,'C3',0,4,50), n(11,1,'Ab3',4,4,48),  n(12,1,'G3',8,4,52),
        ],
        modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString()
      },
      {
        id: "proj_demo8",
        title: "Velocity Storm",
        bpm: 175,
        tracks: [
          { id: 0, name: 'Lead',   color: '#7fd0ff', synthType: 'AMSynth',   mute: false, solo: false, vol: -3, pan: 0,    effects: { Reverb: false, Delay: true,  Chorus: false } },
          { id: 1, name: 'Bass',   color: '#ffb4ab', synthType: 'MonoSynth', mute: false, solo: false, vol: -5, pan: 0,    effects: { Reverb: false, Delay: false, Chorus: false } },
          { id: 2, name: 'Synth',  color: '#ffddb8', synthType: 'PolySynth', mute: false, solo: false, vol: -7, pan: 0.4,  effects: { Reverb: true,  Delay: true,  Chorus: true  } },
        ],
        notes: [
          n(0,0,'E5',0,0.25,110),n(1,0,'G5',0.25,0.25,105),n(2,0,'A5',0.5,0.25,115),n(3,0,'B5',0.75,0.25,108),
          n(4,0,'C6',1,0.5,120),  n(5,0,'B5',1.5,0.25,110),n(6,0,'A5',1.75,0.25,105),
          n(7,0,'G5',2,0.5,112),  n(8,0,'F#5',2.5,0.5,108),n(9,0,'E5',3,1,115),
          n(10,1,'E2',0,0.5,127), n(11,1,'B2',0.5,0.5,120),n(12,1,'E2',1,0.5,127),n(13,1,'A2',1.5,0.5,115),
          n(14,1,'E2',2,0.5,127), n(15,1,'G2',2.5,0.5,120),n(16,1,'E2',3,1,127),
          n(17,2,'E4',0,2,55),    n(18,2,'A4',2,2,52),    n(19,2,'B4',4,2,58),   n(20,2,'G4',6,2,50),
        ],
        modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 21).toISOString()
      },
    ];
    localStorage.setItem('harmonica_projects', JSON.stringify(projects));
  } else {
    projects = JSON.parse(projectsStr);
  }
  
  // Reconstruct the "Create Blank Project" card separately so its event listener can be re-attached
  const createBlankHtml = `
    <div class="group bg-surface-container/50 border-2 border-dashed border-outline-variant/30 rounded-lg overflow-hidden hover:border-primary/50 hover:bg-surface-container transition-all cursor-pointer flex flex-col items-center justify-center min-h-[320px]" id="createBlankProjectCard" onclick="createNewProject()">
        <div class="w-16 h-16 rounded-full bg-surface-variant border border-outline-variant/20 flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:text-primary group-hover:scale-110 transition-all duration-300">
            <span class="material-symbols-outlined text-[32px] text-on-surface-variant group-hover:text-primary transition-colors">add</span>
        </div>
        <h3 class="font-headline-sm text-headline-sm text-on-surface mb-1">Create Blank Project</h3>
        <p class="font-label-mono text-label-mono text-on-surface-variant/70 text-center px-6">Start a new session from scratch or use a default template.</p>
    </div>
  `;
  
  // Sort: newest or oldest based on currentSort state
  projects.sort((a, b) => {
    const diff = new Date(b.modifiedAt) - new Date(a.modifiedAt);
    return currentSort === 'oldest' ? -diff : diff;
  });

  // Filter: recent = modified within 7 days
  let filtered = projects;
  if (currentFilter === 'recent') {
    const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
    filtered = projects.filter(p => new Date(p.modifiedAt) >= week);
  }

  let html = '';
  
  filtered.forEach(p => {
    const trackCount = p.tracks ? p.tracks.length : 0;
    const noteCount = p.notes ? p.notes.length : 0;
    const bpm = p.bpm || 120;
    const title = p.title || 'Untitled Project';
    const pid = p.id;
    const modText = timeAgo(p.modifiedAt);
    
    // Soft waveform preview bars — gentle, even heights per project
    let seed = 0;
    for (let i = 0; i < title.length; i++) seed += title.charCodeAt(i);
    const bars = Array.from({ length: 16 }, (_, i) => {
      const wave = Math.sin((i / 16) * Math.PI * 2 + seed * 0.1) * 0.5 + 0.5;
      const h = 28 + wave * 42;
      return `<div class="w-full bg-primary/25 rounded-full" style="height:${h}%"></div>`;
    }).join('');
    
    html += `
      <div class="project-card-wrap" data-title="${title.toLowerCase()}">
        <div class="project-card bg-surface-container border border-outline-variant/20 rounded-lg overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all group flex flex-col h-[320px] cursor-pointer" onclick="window.location.href='studio.html?id=${pid}'" data-title="${title.toLowerCase()}">
            <!-- Thumbnail Area -->
            <div class="h-[180px] bg-surface-container-low border-b border-outline-variant/10 relative overflow-hidden flex flex-col justify-end p-4">
                <!-- Waveform visual abstraction -->
                <div class="absolute inset-0 opacity-20 flex items-end justify-between px-2 pb-2 gap-1 pointer-events-none">
                    ${bars}
                </div>
                <div class="absolute bottom-2 right-2 bg-surface-container-lowest/80 backdrop-blur-sm border border-outline-variant/20 px-2 py-0.5 rounded font-label-mono text-label-mono text-on-surface text-[10px]">
                    BPM: ${bpm}
                </div>
                <div class="absolute top-2 left-2 bg-primary border border-outline-variant/30 px-2 py-1 rounded shadow-sm flex items-center gap-1 backdrop-blur-md text-on-primary">
                    <span class="material-symbols-outlined text-[12px]">graphic_eq</span>
                    <span class="font-label-caps text-label-caps text-[9px]">LOCAL SAVED</span>
                </div>
            </div>
            <div class="p-4 flex flex-col flex-1">
                <div class="flex justify-between items-start mb-1">
                    <h3 class="font-headline-sm text-headline-sm text-on-surface truncate pr-2 group-hover:text-primary transition-colors">${title}</h3>
                    <button class="text-on-surface-variant hover:text-error -mt-1 -mr-1 p-1 rounded-full hover:bg-surface-variant transition-colors z-10" onclick="deleteProject('${pid}', event)">
                        <span class="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                </div>
                <div class="flex items-center gap-2 mb-4">
                    <span class="w-2 h-2 rounded-full bg-secondary"></span>
                    <span class="font-label-mono text-label-mono text-on-surface-variant text-[11px] uppercase tracking-wider">${noteCount} Notes / ${trackCount} Tracks</span>
                </div>
                <div class="mt-auto pt-4 border-t border-outline-variant/10 flex justify-between items-center">
                    <div class="flex flex-col gap-0.5">
                        <span class="font-label-mono text-label-mono text-on-surface-variant/60 text-[10px]">LAST MODIFIED</span>
                        <span class="font-label-mono text-label-mono text-on-surface-variant">${modText}</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    `;
  });
  
  grid.innerHTML = html + createBlankHtml;
}

