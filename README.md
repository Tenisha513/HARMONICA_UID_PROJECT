# Harmonica

A browser-based music studio you can open without installing anything. Compose on a piano roll, mix tracks, try starter templates, and let the mood generator sketch ideas for you — all in a dark, studio-style interface.

Built as a UID (User Interface Design) project. Everything runs in the browser.

---

## What you get

**Login** — Sign in with email and password (demo credentials below), or skip straight to the dashboard with the social buttons.

**Dashboard** — Browse eight demo projects, search by name, switch grid/list view, create a blank project, or delete ones you do not need. Each card shows BPM, track count, and a soft waveform preview.

**Studio** — The main workspace:
- Piano roll: click to add notes, right-click to remove, select to edit in the side panel
- Tracks mixer: volume, pan, mute, solo, add/delete tracks
- Five **templates** in the left sidebar (below your track list): EDM Beat, Lofi Beat, Cinematic Theme, Horror Ambience, Piano Melody
- **AI Mood Composer** in the footer: nine moods plus a text prompt and Generate button
- Live audio visualizers (frequency bars, circular spectrum, waveform) with teal-to-beige gradients
- Virtual keyboard, BPM/key/scale controls, save, reset, and JSON export

**Account** — Profile and security UI (simulated — nothing is sent to a server).

**About** — Meet the team behind The Harmonica Lab, with links to member portfolios.

There is also a separate `portfolio/index.html` train animation page if you want to see the team showcase on its own.

---

## Live at:
> https://tenisha5132.github.io/HARMONICA_UID_PROJECT/studio.html

**Demo login**

| Field | Value |
|-------|-------|
| Email | `producer@studio.local` |
| Password | `Harmonica_2026!` |

---

## How to move through the app

```
Login → Dashboard → Studio (with ?id=projectId)
              ↓
        Account / About
```

1. Log in (or use Apple ID / Google to bypass).
2. Pick or create a project on the dashboard.
3. Compose in the studio — click once to allow audio.
4. Save locally; your work stays in `localStorage` on this browser only.

---

## Studio layout (what goes where)

**Left sidebar (top to bottom)**

1. **Tracks** — Your mixer channels  
2. **Templates** — One-click starter arrangements (same card style as tracks)  
3. **Add Track** button  

**Center** — Piano roll, timeline, virtual keyboard  

**Right panel (wide screens)** — Track/note properties and audio monitors  

**Footer (bottom bar)**

Designed to stay inside the window — it will not eat the whole screen.

| Left → right | What it is |
|--------------|------------|
| Grid info | `GRID: 1/16` and Harmonica label (no divider line) |
| Master volume | Slider + speaker icon |
| Transport | Timer, play, stop, rewind, record |
| AI Mood Composer | Prompt, Generate, scrollable mood pills |

On smaller screens the footer stacks and scrolls if needed. Scroll inside the mood area to see all nine moods.

---

## Templates

| Template | BPM | What's inside |
|----------|-----|----------------|
| EDM Beat | 128 | Kick, Bass, Lead, Pad |
| Lofi Beat | 82 | Piano, Keys, Bass |
| Cinematic Theme | 90 | Strings, Piano, Brass |
| Horror Ambience | 65 | Drone, Texture, Hits |
| Piano Melody | 100 | Solo piano |

Click a template to replace the current arrangement. The project title updates to match.

---

## AI Mood Composer (nine moods)

Pick a mood, then hit **Generate**. This is a built-in pattern engine — not a real AI API — but it fills the grid quickly with something that fits the vibe.

| Mood | BPM | Feel |
|------|-----|------|
| Chill | 88 | Relaxed, sparse |
| Epic | 135 | Big and dense |
| Dark | 72 | Moody, minor |
| Dreamy | 95 | Soft pads |
| Happy | 112 | Bright, upbeat |
| Groovy | 105 | Funk-ish groove |
| Ambient | 68 | Airy, minimal |
| Retro | 118 | Synthwave energy |
| Intense | 152 | Fast and busy |

You can also type a theme in the prompt box (for your own notes — generation still uses the selected mood).

---

## Keyboard shortcuts

| Key | Does |
|-----|------|
| `Space` | Play / pause |
| `Delete` or `Backspace` | Delete selected note |
| Virtual keyboard | Play notes on the active track |

Shortcuts pause while you are typing in an input field.

---

## Saving your work

Projects are stored under `harmonica_projects` in `localStorage`.

Older saves from previous names (`harmonic_projects`, `resonance_projects`) still load if you had them.

Clearing browser data will wipe your projects — there is no cloud backup.

---

## Tech under the hood

- HTML, CSS, vanilla JavaScript  
- [Tone.js](https://tonejs.github.io/) for sound  
- Tailwind CSS (CDN) + Harmonica design tokens in `css/harmonica-ds.css`  
- Canvas for the piano roll and visualizers  

### Project files

```
uid project/
├── index.html          Login
├── dashboard.html      Projects
├── studio.html         DAW
├── account.html        Settings
├── about.html          Team
├── css/
│   ├── harmonica-ds.css
│   └── main.css
├── js/
│   ├── auth.js
│   ├── dashboard.js
│   ├── studio.js
│   ├── account.js
│   └── tailwind-config.js
└── portfolio/          Team train page + photos
```

---

## Team

| Name | Portfolio |
|------|-----------|
| Akhila | https://tenisha5132.github.io/My_Portfolio/ |
| Utkarsh | https://uthkarsh031.github.io/portfolio/ |
| Jagapathi | https://jaggu-cpu-afk.github.io/portfolio/ |

---

**Harmonica** — Orchestrate your sound.

A Tip: u can delete a 
