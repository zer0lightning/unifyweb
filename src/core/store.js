// Persistent storage (localStorage) with a namespace, plus user preferences.
export const store = {
  get(k, d) { try { const v = localStorage.getItem('uweb:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('uweb:' + k, JSON.stringify(v)); } catch {} }
};

export const prefs = {
  /** Re-apply each saved setting whenever a device reconnects. */
  get restore() { return store.get('restore', true); },
  set restore(v) { store.set('restore', !!v); }
};
