// Protocol log, kept in memory and shown on the Help page.
import { emit } from './events.js';


export const logLines = [];
export const MAX = 600;

export function log(s) {
  logLines.push(`[${new Date().toLocaleTimeString()}] ${s}`);
  if (logLines.length > MAX) logLines.splice(0, logLines.length - MAX);
  emit('log');
}
export function clearLog() { logLines.length = 0; emit('log'); }
