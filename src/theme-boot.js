// Runs in <head> before the page paints, so the chosen theme never flashes. Kept tiny and dependency-free.
(function () {
  var t = 'system';
  try { t = JSON.parse(localStorage.getItem('uweb:theme') || '"system"'); } catch (e) { /* storage blocked */ }
  var dark = t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
