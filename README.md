# SupoClip x Opus — Autonomous Short-Form Video Studio

An automated short-form video editing application inspired by **SupoClip**, **Opus Clip**, and **CapCut**, engineered for viral workflows across TikTok, YouTube Shorts, and Instagram Reels. Optimized for modern web browsers and desktop packaging with hardware-accelerated WebCodecs rendering and zero compression degradation.

---

## ⚡ Key Features

### 1. 7 Official SupoClip Caption Templates
Ported directly from SupoClip's animated ASS subtitle engine:
* **Alex Hormozi**: Bold uppercase text, bright green (`#00FF66`) active karaoke word wrapped in a solid green pill background box (`#00BF49`), 5px black stroke.
* **MrBeast**: High-energy yellow base (`#FFFF00`) with vibrant red pop highlight (`#FF2D2D`), 6px black outline, and emojis.
* **TikTok Pink**: Signature TikTok pink (`#FE2C55`) active word pop with drop shadow.
* **Cyber Neon**: Glowing cyan (`#00FFFF`) text with magenta (`#FF00FF`) active highlight and dark blue neon glow.
* **Minimal Dark**: Clean white typography inside a translucent dark pill (`rgba(0, 0, 0, 0.65)`).
* **Podcast Gold**: Warm gold accent (`#FFB800`) with semi-transparent dark pill (`rgba(26, 26, 26, 0.85)`).
* **Default (Viral Pop)**: Active karaoke pop with yellow `#FFE000` highlight and contextual emojis (`🛑`, `🔥`, `🚀`, `👀`, `🤖`).

### 2. AI Hook Title Headline Banner
* Replicates SupoClip's burned-in top headline: an AI-written viral hook (e.g. `"THE #1 SECRET NOBODY TELLS YOU"`) displayed in the top 15% safe area during the opening 4.5 seconds.
* High-contrast gradient pill background with glowing drop shadow and bold uppercase typography.

### 3. Multi-Dimensional Virality Scorecard & Moments Dashboard
* Dedicated **Viral Moments Panel** in the sidebar that scans footage and ranks top short-form clips:
  * **Overall Virality**: e.g. `96/100 🔥 Viral`
  * **Hook Score** (0–100)
  * **Engagement Score** (0–100)
  * **Value Score** (0–100)
  * **Shareability Score** (0–100)
  * **Hook Type Badge** (*Curiosity Gap*, *Contrarian Take*, *Shock & Awe*, *High Stakes Question*, *Actionable Secret*)
  * **AI Reasoning** explaining why the clip triggers retention algorithms.
* 1-Click to load any ranked viral clip directly onto the timeline.

### 4. Smart Face-Centered Auto-Framing
* Port of SupoClip's `smooth_face_crop_trajectory`: dynamically keeps the speaker centered in the vertical 9:16 frame with exponential moving average easing so camera pans never jitter.

### 5. Multi-Track Sequential Timeline Engine
* Dedicated tracks for Overlays/Stickers, Video Clips, and Synchronized Audio/SFX.
* Snappy Split / Blade tool (`S` or `Ctrl+B`) and Delete tool (`Del` / `Backspace`).
* Millisecond-precision playhead scrubber with dynamic timeline zoom (`-` / `+`).

### 6. Automated Jump-Cuts & Silence Trimming
* RMS (Root-Mean-Square) sliding window audio analyzer detecting dead air below configurable dB threshold (`-55 dB` to `-20 dB`).
* Consonant safety padding (`40 ms`) preventing clipped speech.
* Slices raw footage into rapid, high-retention jump-cuts.

### 7. Real-Time Canvas Transitions
* Shaders applied directly at cut points between clips:
  * **Whip Pan**: High-velocity horizontal sweep with motion blur streaks.
  * **Cross Dissolve**: Smooth alpha cross-blend.
  * **Zoom Push In / Out**: Rapid camera scale push with perspective illusion.
  * **RGB Glitch**: Horizontal band displacement with chromatic aberration (cyan/magenta split).

### 8. Synchronized Viral Stickers & Procedural SFX
* Library of curated stickers (🔥, 🤯, 🚀, 💡, 💰, ⚡, 📸).
* Procedural Web Audio API sound synthesizer producing instant, zero-latency SFX (`pop`, `ding`, `swoosh`, `vine-boom`, `camera-shutter`, `laser`, `cash`) without relying on network downloads.
* Trigger-based audio pairing: whenever a sticker appears, its linked SFX track node triggers synchronously.

### 9. Dynamic Punch Zooms (1.1x to 1.35x Scale)
* Configurable speaker focal center (Speaker Face at `(0.5, 0.45)`, Center Action, Upper Third).
* Snappy 80ms ease-out spring zooms creating visual pattern interrupts.
* One-click "Add Punch Zoom at Playhead" and "Auto-Rhythm Punch Zooms" across the entire video.

### 10. Lossless & High-Bitrate Export Pipeline
* **In-Browser WebCodecs + MP4-Muxer**: Frame-by-frame deterministic rendering stepping through the timeline at exact intervals (\(1/\text{fps}\)). Encodes using `VideoEncoder` (`avc1.640034`) at bitrates up to 50 Mbps (visually lossless CRF 18 equivalent) up to 4K resolution (2160x3840) at 60fps with zero dropped frames.
* **Desktop FFmpeg CLI Script Generator**: Ready-to-run FFmpeg commands and downloadable `.bat` scripts with `-c:v libx264 -crf 18 -preset slow -c:a aac -b:a 320k` for native desktop execution.

---

## 🚀 Getting Started

### Prerequisites
* Node.js v18+ (tested on Node v24)
* npm or pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/ahmadtilllast786-cpu/supoclip-opus-studio.git
cd supoclip-opus-studio

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173/` in your browser.

### Building for Production

```bash
npm run build
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Play / Pause |
| <kbd>S</kbd> or <kbd>Ctrl+B</kbd> | Split clip at current playhead |
| <kbd>Delete</kbd> or <kbd>Backspace</kbd> | Delete selected clip or overlay |
| <kbd>←</kbd> / <kbd>→</kbd> | Step backward / forward 1 frame |

---

## 🛠️ Tech Stack

* **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
* **Video Engine**: HTML5 Canvas 2D Compositor, WebCodecs API (`VideoEncoder`, `AudioEncoder`), `mp4-muxer`
* **Audio Engine**: Web Audio API, OfflineAudioContext, Procedural Waveform & SFX Synthesizers
* **Bundler**: Vite 8

---

## 📜 License

MIT License. Inspired by [SupoClip](https://github.com/FujiwaraChoki/supoclip) and [Opus Clip](https://www.opus.pro/).
