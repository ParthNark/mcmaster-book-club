/**
 * McMaster Book Club — Join page
 * Live member-card preview and the newsletter slip. Joining itself happens on Rubric.
 */
(function () {
  'use strict';

  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var STORAGE_KEY = 'mbc_card';

  var nameIn = document.getElementById('card-name');
  var shelfIn = document.getElementById('card-shelf');
  if (!nameIn || !shelfIn) return;

  var out = {
    name: document.getElementById('card-name-out'),
    shelf: document.getElementById('card-shelf-out'),
    number: document.getElementById('card-number'),
    since: document.getElementById('card-since'),
    term: document.getElementById('card-term'),
    barcode: document.getElementById('card-barcode')
  };

  // School year runs Sept–Aug: Nov 2026 → "2026–27"
  var now = new Date();
  var startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  var term = 'Reader · ' + startYear + '–' + String(startYear + 1).slice(-2);
  var since = 'Member since ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();

  // Small stable hash so the same name always gets the same number and barcode
  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function cardData() {
    var name = nameIn.value.trim() || 'Your Name';
    var h = hash(name.toLowerCase());
    return {
      name: name,
      shelf: shelfIn.value,
      number: 'MBC-' + startYear + '-' + String(h % 10000).padStart(4, '0'),
      bars: barWidths(h)
    };
  }

  function barWidths(h) {
    var bars = [];
    var seed = h || 1;
    for (var i = 0; i < 22; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      bars.push(1 + (seed >>> 16) % 4);
    }
    return bars;
  }

  function render() {
    var d = cardData();
    out.name.textContent = d.name;
    out.shelf.textContent = d.shelf;
    out.number.textContent = d.number;
    out.since.textContent = since;
    out.term.textContent = term;
    out.barcode.innerHTML = '';
    d.bars.forEach(function (w) {
      var bar = document.createElement('span');
      bar.style.width = w + 'px';
      out.barcode.appendChild(bar);
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: nameIn.value, shelf: shelfIn.value })); } catch (e) { /* storage off */ }
  }

  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved) {
      nameIn.value = saved.name || '';
      if (saved.shelf) shelfIn.value = saved.shelf;
    }
  } catch (e) { /* storage off */ }

  nameIn.addEventListener('input', render);
  shelfIn.addEventListener('change', render);
  render();

  // ── Newsletter return slip ──────────────────────────────
  var nForm = document.getElementById('newsletter-form');
  var nEmail = document.getElementById('newsletter-email');
  var nHoney = document.getElementById('newsletter-website');
  var nBtn = document.getElementById('newsletter-submit');
  var nMsg = document.getElementById('newsletter-msg');
  if (!nForm || !nEmail) return;

  nForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = nEmail.value.trim();
    nMsg.className = 'return-slip-msg';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nMsg.textContent = 'Please enter a valid email address.';
      nMsg.classList.add('is-error');
      return;
    }
    if (typeof postNewsletter !== 'function') {
      nMsg.textContent = 'Signups are down right now. Try again later.';
      nMsg.classList.add('is-error');
      return;
    }
    nBtn.disabled = true;
    nBtn.textContent = 'Sending…';
    postNewsletter(email, 'join', nHoney ? nHoney.value : '')
      .then(function (res) {
        if (res && res.ok) {
          nMsg.textContent = "Thanks! You're on the list.";
          nMsg.classList.add('is-success');
          nEmail.value = '';
        } else {
          nMsg.textContent = (res && res.error) || 'Something went wrong. Try again.';
          nMsg.classList.add('is-error');
        }
      })
      .catch(function () {
        nMsg.textContent = 'Network error. Please try again.';
        nMsg.classList.add('is-error');
      })
      .then(function () {
        nBtn.disabled = false;
        nBtn.textContent = 'Subscribe';
      });
  });
})();
