/**
 * McMaster Book Club — Homepage
 * Fills the hero from Pages CMS data so it updates itself:
 *   • covers  ← current books in data/books.json (Pages CMS cover upload, else Open Library)
 *   • ticket  ← soonest upcoming event in data/events.json
 *   • ticker  ← next event, Campus Store deal per current book, voting when open
 * Plus the reading lamp, which switches to the warm lamplight theme.
 */
(function () {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var INSTAGRAM = 'https://www.instagram.com/mcmasterbooks/';

  function esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str == null ? '' : String(str)));
    return d.innerHTML.replace(/"/g, '&quot;');
  }

  function isoToDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function isToday(d) {
    var now = new Date();
    return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }

  function eventLabel(ev, d) {
    if (isToday(d)) return 'Today';
    return /discussion/i.test(ev.title) ? 'Next discussion' : 'Next event';
  }

  // ── Reading lamp ───────────────────────────────────────
  var root = document.documentElement;
  var chain = document.getElementById('lamp-chain');
  var lampText = document.getElementById('lamp-text');

  function renderLamp() {
    var on = root.classList.contains('lamp-on');
    if (!chain) return;
    chain.setAttribute('aria-pressed', on ? 'true' : 'false');
    chain.setAttribute('aria-label', on ? 'Turn the reading lamp off' : 'Turn the reading lamp on');
    lampText.textContent = on ? 'Lamp on' : 'Pull for lamp';
  }

  if (chain) {
    chain.addEventListener('click', function () {
      var on = root.classList.toggle('lamp-on');
      try { localStorage.setItem('mbc_lamp', on ? 'on' : 'off'); } catch (e) { /* storage off */ }
      renderLamp();
    });
    renderLamp();
  }

  // ── Kicker: "Now reading · November 2026" ──────────────
  var kicker = document.getElementById('home-kicker');
  var now = new Date();
  if (kicker) kicker.textContent = 'Now reading · ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();

  // ── Covers ─────────────────────────────────────────────
  var coversEl = document.getElementById('home-covers');

  function fallbackCover(book) {
    return '<span class="home-cover-fallback">'
      + '<span class="home-cover-fallback-title">' + esc(book.title || 'This month’s read') + '</span>'
      + (book.author ? '<span class="home-cover-fallback-author">' + esc(book.author) + '</span>' : '')
      + '</span>';
  }

  function renderCovers(books, details) {
    if (!coversEl) return;
    if (!books.length) {
      coversEl.innerHTML = '<a class="home-cover home-cover--front" href="current-read.html">'
        + fallbackCover({ title: 'Next pick coming soon' }) + '</a>';
      return;
    }
    coversEl.classList.toggle('home-covers--single', books.length === 1);
    coversEl.innerHTML = books.map(function (b, i) {
      var ol = details[i] || {};
      var title = ol.title || b.title;
      var author = (ol.authors && ol.authors[0]) || b.author;
      var src = ol.coverUrl || b.cover || '';
      var cls = i === 0 ? 'home-cover--front' : 'home-cover--back';
      return '<a class="home-cover ' + cls + '" href="current-read.html#' + esc(b.id) + '" aria-label="' + esc(title + (author ? ' by ' + author : '')) + '">'
        + (src ? '<img src="' + esc(src) + '" alt="" data-title="' + esc(title) + '" data-author="' + esc(author || '') + '">' : fallbackCover({ title: title, author: author }))
        + '</a>';
    }).reverse().join('');  // back cover first so the front one sits on top

    // Missing or broken cover image → a typeset cover instead
    coversEl.querySelectorAll('img').forEach(function (img) {
      img.addEventListener('error', function () {
        img.outerHTML = fallbackCover({ title: img.getAttribute('data-title'), author: img.getAttribute('data-author') });
      });
    });
  }

  // ── Ticket for the next event ──────────────────────────
  var ticketEl = document.getElementById('home-ticket');

  function renderTicket(ev) {
    if (!ticketEl) return;
    if (!ev) {
      ticketEl.href = INSTAGRAM;
      ticketEl.target = '_blank';
      ticketEl.rel = 'noopener';
      ticketEl.innerHTML = '<span class="home-ticket-stub"><span class="home-ticket-day">…</span></span>'
        + '<span class="home-ticket-body"><span class="home-ticket-label">More events soon</span>'
        + '<span class="home-ticket-title">Follow @mcmasterbooks</span>'
        + '<span class="home-ticket-meta">for the next dates</span></span>';
      ticketEl.hidden = false;
      return;
    }
    var d = isoToDate(ev.iso_date);
    var meta = [ev.time, ev.location].filter(Boolean).join(' · ');
    ticketEl.setAttribute('aria-label', eventLabel(ev, d) + ': ' + ev.title + ', ' + ev.date + (meta ? ', ' + meta : ''));
    ticketEl.innerHTML = '<span class="home-ticket-stub" aria-hidden="true">'
      +   '<span class="home-ticket-month">' + (d ? MONTHS[d.getMonth()].slice(0, 3) : '') + '</span>'
      +   '<span class="home-ticket-day">' + (d ? d.getDate() : '') + '</span>'
      +   '<span class="home-ticket-weekday">' + (d ? DAYS[d.getDay()] : '') + '</span>'
      + '</span>'
      + '<span class="home-ticket-body" aria-hidden="true">'
      +   '<span class="home-ticket-label">' + esc(eventLabel(ev, d)) + ' · Admit one</span>'
      +   '<span class="home-ticket-title">' + esc(ev.title) + '</span>'
      +   (meta ? '<span class="home-ticket-meta">' + esc(meta) + '</span>' : '')
      + '</span>';
    ticketEl.hidden = false;
  }

  // ── News ticker ────────────────────────────────────────
  var tickerWrap = document.getElementById('home-ticker-wrap');
  var tickerTrack = document.getElementById('home-ticker');

  function tickerItems(cfg, ev) {
    var items = [];
    if (ev) {
      var d = isoToDate(ev.iso_date);
      items.push({
        label: eventLabel(ev, d),
        text: [ev.date, ev.time, ev.location, ev.title].filter(Boolean).join(' · '),
        href: 'meetings-events.html'
      });
    }
    if (cfg.store_deal) {
      cfg.books.forEach(function (b) {
        if (!b.isbn) return;
        items.push({
          label: cfg.store_deal,
          text: 'Pick up ' + (b.title || 'this month’s read') + ' at the McMaster Campus Store',
          href: 'https://campusstore.mcmaster.ca/Item?item=' + encodeURIComponent(b.isbn.replace(/[-\s]/g, '')),
          external: true
        });
      });
    }
    if (cfg.voting_open && cfg.vote_form_url) {
      items.push({ label: 'Vote now', text: 'Help choose next month’s read', href: cfg.vote_form_url, external: true });
    }
    if (!items.length) {
      items.push({ label: 'Follow us', text: '@mcmasterbooks on Instagram for events, picks and polls', href: INSTAGRAM, external: true });
    }
    return items;
  }

  function itemHtml(item, hidden) {
    return '<a class="home-ticker-item" href="' + esc(item.href) + '"'
      + (item.external ? ' target="_blank" rel="noopener"' : '')
      + (hidden ? ' tabindex="-1"' : '') + '>'
      + '<span class="home-ticker-label">' + esc(item.label) + '</span>'
      + '<span class="home-ticker-text">' + esc(item.text) + '</span>'
      + '</a><span class="home-ticker-dot" aria-hidden="true"></span>';
  }

  function renderTicker(items) {
    if (!tickerWrap || !tickerTrack) return;
    var group = items.map(function (it) { return itemHtml(it, false); }).join('');
    var copy = items.map(function (it) { return itemHtml(it, true); }).join('');
    // Two identical halves scroll by exactly one half, so the loop is seamless
    tickerTrack.innerHTML = '<div class="home-ticker-group">' + group + '</div>'
      + '<div class="home-ticker-group" aria-hidden="true">' + copy + '</div>';
    var chars = items.reduce(function (n, it) { return n + it.label.length + it.text.length; }, 0);
    tickerTrack.style.animationDuration = Math.max(22, Math.round(chars * 0.28)) + 's';
    tickerWrap.hidden = false;
  }

  // ── Load everything from the CMS data files ────────────
  if (typeof getCurrent !== 'function' || typeof getEvents !== 'function') return;

  Promise.all([
    getCurrent().catch(function () { return { books: [] }; }),
    getEvents().catch(function () { return []; })
  ]).then(function (res) {
    var cfg = res[0];
    var ev = res[1][0] || null;
    renderTicket(ev);
    renderTicker(tickerItems(cfg, ev));

    var books = (cfg.books || []).slice(0, 2);
    var lookups = books.map(function (b) {
      return typeof fetchBookFromOpenLibrary === 'function'
        ? fetchBookFromOpenLibrary(b).catch(function () { return {}; })
        : Promise.resolve({});
    });
    return Promise.all(lookups).then(function (details) { renderCovers(books, details); });
  });
})();
