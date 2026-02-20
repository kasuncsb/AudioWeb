<img src="public/images/aw-logo.svg" alt="AudioWeb Logo" width="100" height="100">

# AudioWeb

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-CA8A04)
![React](https://img.shields.io/badge/React-19.2.4-F97316)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-2563EB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.x-7C3AED)

A web-based audio player built with Next.js, React, and TypeScript. Runs entirely in the browser with no backend or account required.

Live at [aw.kasunc.uk](https://aw.kasunc.uk)

## Features

- Supports MP3, FLAC, WAV, OGG and other common audio formats
- Drag and drop file loading
- Playlist management with shuffle and repeat modes
- 10-band equalizer with presets
- Synchronized lyrics display (.lrc)
- Album art extraction from embedded metadata
- Sleep timer
- Media Session API integration (browser/OS media controls)
- Responsive layout for desktop, tablet, and mobile

## Getting Started

**Requirements:** Node.js 18 or higher

```bash
git clone https://github.com/KasunCSB/AudioWeb.git
cd AudioWeb
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| Arrow Left / Right | Previous / Next track |
| Arrow Up / Down | Volume up / down |
| M | Mute / Unmute |
| S | Toggle shuffle |
| R | Cycle repeat modes |

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lottie React](https://github.com/Gamote/lottie-react) - Animations
- [JSMediaTags](https://github.com/aadsm/jsmediatags) - Audio metadata

## License

MIT - see [LICENSE](LICENSE) for details.
