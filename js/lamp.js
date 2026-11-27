/**
 * McMaster Book Club — Reading lamp (every page)
 * Pulling the chain toggles html.lamp-on (the warm lamplight theme) and
 * remembers the choice in localStorage, so it carries across pages.
 * Each page's <head> restores the class before first paint to avoid a flash.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var chain = document.getElementById('lamp-chain');
  var lampText = document.getElementById('lamp-text');
  if (!chain) return;

  function render() {
    var on = root.classList.contains('lamp-on');
    chain.setAttribute('aria-pressed', on ? 'true' : 'false');
    chain.setAttribute('aria-label', on ? 'Turn the reading lamp off' : 'Turn the reading lamp on');
    if (lampText) lampText.textContent = on ? 'Lamp on' : 'Pull for lamp';
  }

  chain.addEventListener('click', function () {
    var on = root.classList.toggle('lamp-on');
    try { localStorage.setItem('mbc_lamp', on ? 'on' : 'off'); } catch (e) { /* storage off */ }
    render();
  });

  // Another tab pulled the chain: follow it.
  window.addEventListener('storage', function (e) {
    if (e.key !== 'mbc_lamp') return;
    root.classList.toggle('lamp-on', e.newValue === 'on');
    render();
  });

  render();
})();
