// Errors returned by HID++ 1.0 (sub-ID 0x8F) and 2.0 (0xFF) replies.
export class HidppError extends Error {
  constructor(msg, code, v) { super(msg); this.code = code; this.v = v; }
  get offline() { return this.code === 'timeout' || (this.v === 1 && (this.code === 8 || this.code === 9 || this.code === 4)); }
}
