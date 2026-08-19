import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../types';

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL;
const BACKEND_URL = rawBackendUrl
  ? rawBackendUrl.replace(/\/$/, '')
  : (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : window.location.origin);

export const RESOLVED_BACKEND_URL = BACKEND_URL;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(BACKEND_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

// ============================================================================
// [TEMPORARY DIAGNOSTICS - LATENCY & TRANSPORT TELEMETRY]
// ============================================================================
export interface DiagnosticInfo {
  connected: boolean;
  socketId: string | null;
  transportName: string;
  backendUrl: string;
  rttLatencyMs: number | null;
  upgraded: boolean;
  history: string[];
}

const diagState: DiagnosticInfo = {
  connected: false,
  socketId: null,
  transportName: 'initializing',
  backendUrl: BACKEND_URL,
  rttLatencyMs: null,
  upgraded: false,
  history: [],
};

const listeners = new Set<(state: DiagnosticInfo) => void>();

function notifyDiagListeners() {
  const snapshot = { ...diagState, history: [...diagState.history] };
  listeners.forEach((fn) => fn(snapshot));
}

function logDiag(msg: string) {
  const timestamp = new Date().toISOString().substring(11, 19);
  const entry = `[${timestamp}] ${msg}`;
  console.log(`[Diagnostic] ${entry}`);
  diagState.history = [entry, ...diagState.history.slice(0, 15)];
  notifyDiagListeners();
}

socket.on('connect', () => {
  diagState.connected = true;
  diagState.socketId = socket.id || null;
  const engine = socket.io.engine;
  if (engine) {
    diagState.transportName = engine.transport.name;
    logDiag(`Connected with transport: ${engine.transport.name}`);

    engine.on('upgrade', (transport) => {
      diagState.transportName = transport.name;
      diagState.upgraded = true;
      logDiag(`Transport upgraded to: ${transport.name}`);
    });

    let pingStartTime = 0;
    engine.on('ping', () => {
      pingStartTime = performance.now();
    });

    engine.on('pong', () => {
      if (pingStartTime > 0) {
        diagState.rttLatencyMs = Math.round(performance.now() - pingStartTime);
        notifyDiagListeners();
      }
    });
  }
  notifyDiagListeners();
});

socket.on('disconnect', (reason) => {
  diagState.connected = false;
  diagState.transportName = 'disconnected';
  diagState.rttLatencyMs = null;
  logDiag(`Disconnected: ${reason}`);
  notifyDiagListeners();
});

socket.on('connect_error', (error) => {
  logDiag(`Connection Error: ${error.message}`);
  notifyDiagListeners();
});

export function subscribeDiagnostics(callback: (state: DiagnosticInfo) => void): () => void {
  callback({ ...diagState, history: [...diagState.history] });
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
// ============================================================================
