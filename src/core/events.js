// A tiny event bus so the protocol layer never touches the DOM.
// The UI subscribes; devices, receivers and the rules engine only emit.
export const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => bus.addEventListener(type, e => fn(e.detail));

/** Something changed that the UI may want to redraw. `force` redraws even while a field has focus. */
export const changed = (force = false) => emit('changed', { force });
/** Short status message for the user. kind: 'ok' | 'err' */
export const toast = (msg, kind = 'ok') => emit('toast', { msg, kind });
