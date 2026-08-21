# Couch Society — Minimal Online Pong

> *"Just Pong. Nothing else."*

A calm, minimal, slightly retro, and premium 2-player real-time online Pong platform. Built with a server-authoritative game loop, sub-millisecond input intent streaming, responsive HTML5 Canvas rendering with linear interpolation, procedural Web Audio sound effects, and zero-setup room codes.

---

## Table of Contents
- [1. Project Overview](#1-project-overview)
- [2. Features](#2-features)
- [3. Tech Stack](#3-tech-stack)
- [4. Local Development Setup](#4-local-development-setup)
- [5. Environment Variables](#5-environment-variables)
- [6. Frontend Deployment (Vercel)](#6-frontend-deployment-vercel)
- [7. Backend Deployment (Render)](#7-backend-deployment-render)
- [8. How Socket.IO Works](#8-how-socketio-works)
- [9. Known Limitations](#9-known-limitations)

---

## 1. Project Overview

**Couch Society** was designed as an antidote to bloated gaming sites with excessive gradients, neon overload, and cumbersome login walls. Two players can jump into a match in seconds simply by sharing a 5-character room code or link.

All game physics, collisions, scoring, and lifecycle states are computed authoritatively on the server at **60Hz**, eliminating client-side desynchronization and cheating while keeping the client lightweight and responsive.

---

## 2. Features

- **Authoritative Server Physics**: 60Hz tick loop owns ball velocities, deflection angles, paddle boundaries, and score increments up to 10 points.
- **Intent-Based Directional Streaming**: Clients transmit only directional intent (`{ direction: -1 | 0 | 1 }`). No client-side coordinates or scores are trusted.
- **Butter-Smooth Client Interpolation**: HTML5 Canvas runs an uncoupled `requestAnimationFrame` loop with linear interpolation (LERP) rendering at 60Hz–144Hz.
- **Mutual Handshakes**:
  - **Ready Up**: Both players must click `READY UP` to trigger the `3 → 2 → 1 → GO!` kickoff countdown.
  - **Rematch**: Both players must click `REQUEST REMATCH` to reset and replay.
- **Robust Host Migration & Edge Case Handling**:
  - If the host departs, Player 2 is automatically promoted to host and the room reverts cleanly to the lobby waiting for a new challenger.
  - Fast heartbeat ping detection (2–3s) detects tab closures or connection drops instantly.
  - Empty rooms are protected by a 30-second grace timer before memory cleanup.
- **Mobile Touch Controls**:
  - Direct canvas touch-and-drag (touch above paddle center to move up, below to move down).
  - Dedicated tactile on-screen D-Pad buttons (`▲ UP` / `▼ DOWN`) with `touch-action: none` to prevent page scrolling.
  - Responsive canvas auto-scaling to device DPI in portrait and landscape modes.
- **Procedural Web Audio Synthesizer**:
  - Organic, minimal sound effects synthesized dynamically via the Web Audio API for paddle hits, wall bounces, scoring chimes, countdown ticks, and victory arpeggios.
  - Global `[ 🔊 SFX / 🔇 MUTED ]` toggle persisted in `localStorage`.
- **Offline 2-Player Local Mode**:
  - Single-keyboard mode (`W`/`S` vs `↑`/`↓`) or dual-side mobile touchscreen play at `/game`.

---

## 3. Tech Stack

### Frontend Client
- **Framework**: React 18 with TypeScript
- **Bundler**: Vite 8
- **Styling**: Tailwind CSS v4 + Monospace Typography (`Space Mono`)
- **Routing**: React Router v6
- **Real-Time Client**: Socket.IO Client (`socket.io-client`)
- **Audio**: Web Audio API (Synthesized Oscillators)

### Backend Server
- **Runtime**: Node.js (TypeScript with `tsx` & `tsc`)
- **Server Framework**: Express 4
- **WebSockets**: Socket.IO 4 with CORS origin verification
- **Architecture**: In-Memory Server-Authoritative Session Manager (Zero Database Dependency)

---

## 4. Local Development Setup

### Prerequisites
- Node.js `v18.0.0` or later
- `npm` `v9.0.0` or later

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/couch-society.git
   cd couch-society
   ```

2. Install all dependencies across the monorepo:
   ```bash
   npm run install:all
   ```

3. Start both backend and frontend concurrently:
   ```bash
   npm run dev
   ```

- **Frontend Application**: `http://localhost:5173`
- **Backend WebSocket Server**: `http://localhost:3001`
- **Health Check**: `http://localhost:3001/api/health`

---

## 5. Environment Variables

### Root / Backend Server (`server/.env`)
| Variable | Description | Default (Dev) | Example (Prod) |
| :--- | :--- | :--- | :--- |
| `PORT` | Port number for Express & Socket.IO server | `3001` | `10000` (Render default) |
| `CLIENT_URL` | Allowed frontend origin(s) for CORS (comma-separated) | `http://localhost:5173` | `https://couch-society.vercel.app` |
| `NODE_ENV` | Runtime environment mode | `development` | `production` |

### Frontend Client (`client/.env`)
| Variable | Description | Default (Dev) | Example (Prod) |
| :--- | :--- | :--- | :--- |
| `VITE_BACKEND_URL` | Full URL of the deployed backend WebSocket server | `http://localhost:3001` | `https://couch-society-server.onrender.com` |

---

## 6. Frontend Deployment (Vercel)

1. Push your code to GitHub.
2. Sign in to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your GitHub repository.
4. Configure project settings:
   - **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Add Environment Variable:
   - `VITE_BACKEND_URL`: `https://your-backend-service.onrender.com` *(your deployed Render backend URL)*
6. Click **Deploy**.

> **Note**: The repository includes [`client/vercel.json`](file:///client/vercel.json) to handle single-page application route rewrites (`/room/:roomCode`, `/game`, `/404`).

---

## 7. Backend Deployment (Render)

Render provides persistent WebSocket support on Web Services.

1. Sign in to [Render](https://render.com) and select **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure service settings:
   - **Name**: `couch-society-server`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free` or `Starter`
4. In **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `CLIENT_URL`: `https://your-frontend.vercel.app` *(your Vercel frontend URL, comma-separated for custom domains)*
5. Click **Create Web Service**.
6. Copy the assigned URL (e.g. `https://couch-society-server.onrender.com`) and paste it as `VITE_BACKEND_URL` in your Vercel frontend configuration.

---

## 8. How Socket.IO Works

```
Client 1 (P1 Host)                 Node.js Server (Authoritative)              Client 2 (P2 Guest)
       |                                      |                                         |
       |--- create-room --------------------->| (Creates room: 5-char code)             |
       |<-- { room, gameState } --------------|                                         |
       |                                      |                                         |
       |                                      |<-- join-room { roomCode } --------------|
       |<-- player-joined (P2 connected) -----|--- { room, gameState } ---------------->|
       |                                      |                                         |
       |--- player-ready { ready: true } ---->|                                         |
       |                                      |<-- player-ready { ready: true } --------|
       |                                      |                                         |
       |<-- game-start (countdown: 3) --------|--- game-start (countdown: 3) ---------->|
       |<-- game-state (60Hz tick loop) ------|--- game-state (60Hz tick loop) -------->|
       |                                      |                                         |
       |--- player-input { direction: -1 } -->| (Calculates paddle & ball collision)   |
       |<-- score-update { score: 1 - 0 } ----|--- score-update { score: 1 - 0 } ------>|
```

### Event Contracts

#### Client → Server
| Event | Payload | Description |
| :--- | :--- | :--- |
| `create-room` | `callback(response)` | Creates a new room and assigns socket as Player 1. |
| `join-room` | `{ roomCode }` | Joins an existing room as Player 2. |
| `player-ready` | `{ ready: boolean }` | Toggles player readiness. Countdown begins when both ready. |
| `player-input` | `{ direction: -1 \| 0 \| 1 }` | Streams directional paddle movement intent. |
| `rematch` | `void` | Requests a rematch. Countdown restarts when both click rematch. |
| `leave-room` | `{ roomCode }` | Explicitly leaves the active room. |

#### Server → Client
| Event | Payload | Description |
| :--- | :--- | :--- |
| `room-state` | `RoomState` | Synchronizes room occupants and presence. |
| `game-state` | `AuthoritativeGameState` | Broadcasts 60Hz physics, positions, scores, and status. |
| `player-joined` | `{ player, roomState }` | Notifies host when opponent connects. |
| `player-left` | `{ playerId, roomState }` | Notifies remaining player of departure. |
| `game-start` | `{ countdown: number }` | Initiates the 3-second serve countdown. |
| `score-update` | `{ score, scorer }` | Broadcasts goal event. |
| `game-over` | `{ winner, score }` | Broadcasts victory/defeat when a player reaches 10 points. |
| `player-disconnected`| `{ playerId, message }`| Notifies opponent of connection loss and resets to lobby. |

---

## 9. Known Limitations

1. **In-Memory Volatility**: Active room sessions are held in Node.js server memory. If the backend process restarts or sleeps, active matches reset.
2. **Horizontal Scaling**: Multi-instance horizontal scaling (across multiple server nodes) requires a Redis adapter (`@socket.io/redis-adapter`) for inter-process socket communication.
3. **Single Matchmaking Mode**: Matches are code/link-based. A global auto-matchmaking queue can be added as a future feature.

---

## License
MIT © [Couch Society](https://github.com/your-username/couch-society)
