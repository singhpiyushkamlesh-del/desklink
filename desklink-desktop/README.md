# DeskLink Desktop

Electron + React + TypeScript desktop companion for DeskLink.

## Prerequisites

- Node.js 20+
- npm 10+

## Development

```bash
npm install
npm run dev
```

This starts the Vite dev server and launches Electron with hot reload.

## Build

```bash
npm run build
```

## Windows installer

```bash
npm run dist:win
```

Produces `release/DeskLink-Setup-0.1.0.exe`. For an unpacked app folder: `npm run pack`.

The installer is unsigned — Windows SmartScreen may warn on first run. Allow DeskLink through the firewall when prompted (port 9847).

If packaging fails with a symbolic-link error on Windows, enable **Developer Mode** in Windows Settings → System → For developers, or run the terminal as Administrator.

## Project layout

```
electron/
  main/       # Electron main process (WebSocket, JSON store, IPC)
  preload/    # Context bridge API
  shared/     # Protocol types shared with renderer
src/
  app/        # Root React app
  pages/      # Route pages
  components/ # Reusable UI
  store/      # Zustand state
  services/   # IPC wrapper helpers
```

## MVP complete

All 8 stages implemented: pairing, notifications, SMS, photos, clipboard, settings polish.

- Unpair from Settings (removes device data + disconnects live session)
- Clipboard sync toggle in Settings
- Sync logs viewer
- Error banners on sync pages; disconnected banner on Dashboard

## Testing

See [testing checklist](../docs/testing-checklist.md) and [architecture limitations](../docs/architecture.md#known-mvp-limitations).
