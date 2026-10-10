// Keep startup failures visible when the module graph cannot load.
addEventListener(
  'error',
  () => {
    const message =
      location.protocol === 'file:'
        ? 'Serve this folder over HTTP using npm start, then open http://localhost:8000'
        : 'Force-reload the page (Ctrl / Cmd + Shift + R)';
    const indicator = document.querySelector('#ink.boot .ink-wait');
    if (indicator) {
      indicator.innerHTML = '<p>Failed to load<small></small></p>';
      indicator.querySelector('small').textContent = message;
    }
  },
  true,
);
