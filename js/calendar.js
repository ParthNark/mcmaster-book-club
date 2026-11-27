/**
 * McMaster Book Club — Meetings & Events wall calendar
 * Reads data/events.json (edited in Pages CMS) through getAllEvents() in api.js.
 * Each event is stamped on its day; picking one shows its ticket on the side.
 */
(function () {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var TYPES = {
    discussion: { label: 'Discussions', color: '#7a003c' },
    social: { label: 'Socials', color: '#a8431a' },
    deadline: { label: 'Deadlines', color: '#4f5e43' },
    other: { label: 'Other', color: '#26344f' }
  };

  var el = {
    month: document.getElementById('cal-month'),
    prev: document.getElementById('cal-prev'),
    next: document.getElementById('cal-next'),
    chips: document.getElementById('cal-chips'),
    days: document.getElementById('cal-days'),
    side: document.getElementById('cal-side'),
    upnext: document.getElementById('cal-upnext')
  };
  if (!el.days) return;

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var state = { events: [], month: null, selected: -1, filter: 'all', minMonth: null, maxMonth: null };

  function esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str == null ? '' : str)));
    return d.innerHTML;
  }

  function typeOf(ev) {
    var t = String(ev.type || '').toLowerCase();
    if (TYPES[t]) return t;
    if (/^book discussion/i.test(ev.title)) return 'discussion';
    return 'social';
  }

  function stampText(ev) {
    return ev.title.replace(/^book discussion:\s*/i, '');
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

  function visible(ev) { return state.filter === 'all' || ev.kind === state.filter; }

  function inMonth(ev, m) { return ev.date.getFullYear() === m.getFullYear() && ev.date.getMonth() === m.getMonth(); }

  // Today's event, else the next one coming up this month, else the last one that happened.
  function defaultSelection(m) {
    var idx = -1, i, ev;
    for (i = 0; i < state.events.length; i++) {
      ev = state.events[i];
      if (!inMonth(ev, m) || !visible(ev)) continue;
      if (ev.date >= today) return i;
      idx = i;
    }
    return idx;
  }

  // ─── Calendar sheet ─────────────────────────────────────────
  function renderSheet() {
    var m = state.month;
    el.month.innerHTML = esc(MONTHS[m.getMonth()]) + ' <span>' + m.getFullYear() + '</span>';
    el.prev.disabled = m <= state.minMonth;
    el.next.disabled = m >= state.maxMonth;

    var offset = m.getDay();
    var daysIn = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    var cells = Math.ceil((offset + daysIn) / 7) * 7;
    var html = '';

    for (var c = 0; c < cells; c++) {
      var n = c - offset + 1;
      if (n < 1 || n > daysIn) { html += '<div class="cal-day is-blank" aria-hidden="true"></div>'; continue; }

      var date = new Date(m.getFullYear(), m.getMonth(), n);
      var isPast = date < today;
      var isToday = sameDay(date, today);
      var stamps = '';
      var count = 0;

      state.events.forEach(function (ev, i) {
        if (!sameDay(ev.date, date) || !visible(ev)) return;
        count++;
        var sel = i === state.selected;
        stamps += '<button type="button" class="cal-stamp' + (sel ? ' is-selected' : '') + '" data-idx="' + i + '"'
          + ' style="--stamp:' + TYPES[ev.kind].color + ';--tilt:' + (n % 2 ? -3 : 2) + 'deg"'
          + ' aria-pressed="' + sel + '"'
          + ' aria-label="' + esc(MONTHS[m.getMonth()] + ' ' + n + ': ' + ev.title) + '">'
          + '<span class="cal-stamp-text">' + esc(stampText(ev)) + '</span></button>';
      });

      html += '<div class="cal-day' + (isPast ? ' is-past' : '') + (isToday ? ' is-today' : '') + (count ? ' has-event' : '') + '">'
        + '<span class="cal-num"' + (isToday ? ' aria-label="Today, ' + n + '"' : '') + '>' + n + '</span>'
        + (isPast && !count ? '<span class="cal-cross" aria-hidden="true">✕</span>' : '')
        + (count ? '<div class="cal-stamps">' + stamps + '</div>' : '')
        + '</div>';
    }
    el.days.innerHTML = html;
  }

  function renderChips() {
    var present = {};
    state.events.forEach(function (ev) { present[ev.kind] = true; });
    var kinds = Object.keys(TYPES).filter(function (k) { return present[k]; });
    if (kinds.length < 2) { el.chips.hidden = true; return; }
    var html = '<button type="button" class="cal-chip" data-filter="all" aria-pressed="' + (state.filter === 'all') + '">All</button>';
    kinds.forEach(function (k) {
      html += '<button type="button" class="cal-chip" data-filter="' + k + '" aria-pressed="' + (state.filter === k) + '">'
        + '<span class="cal-chip-dot" style="background:' + TYPES[k].color + '" aria-hidden="true"></span>' + TYPES[k].label + '</button>';
    });
    el.chips.innerHTML = html;
    el.chips.hidden = false;
  }

  // ─── Side: ticket for the picked event ───────────────────────
  function renderSide() {
    var ev = state.events[state.selected];
    if (!ev || !inMonth(ev, state.month)) {
      el.side.innerHTML = '<p class="cal-kicker">' + esc(MONTHS[state.month.getMonth()].toUpperCase()) + '</p>'
        + '<div class="cal-note"><p class="cal-note-title">Nothing on the calendar this month' + (state.filter !== 'all' ? ' for this filter' : '') + '.</p>'
        + '<p class="cal-note-hand">follow <a href="https://www.instagram.com/mcmasterbooks/" target="_blank" rel="noopener">@mcmasterbooks</a> so you don\'t miss new dates</p></div>';
      return;
    }
    var past = ev.date < today;
    var kicker = sameDay(ev.date, today) ? 'TODAY' : (past ? 'ALREADY HAPPENED' : 'COMING UP');
    var meta = [ev.time, ev.location].filter(Boolean).join(' · ');

    var actions = '';
    if (ev.rsvp_url) actions += '<a class="cal-btn cal-btn--solid" href="' + esc(ev.rsvp_url) + '" target="_blank" rel="noopener">RSVP</a>';
    if (!past) actions += '<button type="button" class="cal-btn ' + (ev.rsvp_url ? 'cal-btn--line' : 'cal-btn--solid') + '" data-ics="' + state.selected + '">Add to calendar</button>';
    if (ev.instagram_url) actions += '<a class="cal-btn cal-btn--line" href="' + esc(ev.instagram_url) + '" target="_blank" rel="noopener">See on Instagram</a>';
    if (past) actions += '<a class="cal-btn cal-btn--line" href="chapters.html">See Past Events</a>';

    el.side.innerHTML = '<p class="cal-kicker">' + kicker + '</p>'
      + '<article class="cal-ticket">'
      +   '<div class="cal-ticket-stub" style="background:' + TYPES[ev.kind].color + '">'
      +     '<span>' + MON[ev.date.getMonth()] + '</span>'
      +     '<strong>' + ev.date.getDate() + '</strong>'
      +     '<span>' + DAYS[ev.date.getDay()] + '</span>'
      +   '</div>'
      +   '<div class="cal-ticket-body">'
      +     '<h3>' + esc(ev.title) + '</h3>'
      +     (meta ? '<p class="cal-ticket-meta">' + esc(meta) + '</p>' : '')
      +     (ev.description ? '<p class="cal-ticket-desc">' + esc(ev.description) + '</p>' : '')
      +   '</div>'
      + '</article>'
      + (actions ? '<div class="cal-actions">' + actions + '</div>' : '');
  }

  function renderUpNext() {
    var upcoming = [];
    state.events.forEach(function (ev, i) {
      if (ev.date >= today && i !== state.selected && upcoming.length < 3) upcoming.push(i);
    });
    if (!upcoming.length) {
      el.upnext.innerHTML = '<p class="cal-upnext-label">NEXT UP</p>'
        + '<div class="cal-note"><p class="cal-note-title">New dates are coming soon.</p>'
        + '<p class="cal-note-hand">follow <a href="https://www.instagram.com/mcmasterbooks/" target="_blank" rel="noopener">@mcmasterbooks</a> so you don\'t miss them</p></div>';
      return;
    }
    var html = '<p class="cal-upnext-label">NEXT UP</p><ol class="cal-upnext-list">';
    upcoming.forEach(function (i) {
      var ev = state.events[i];
      html += '<li><button type="button" data-jump="' + i + '">'
        + '<span class="cal-upnext-date" style="color:' + TYPES[ev.kind].color + '">' + MON[ev.date.getMonth()] + ' ' + ev.date.getDate() + '</span>'
        + '<span class="cal-upnext-title">' + esc(ev.title) + '</span></button></li>';
    });
    el.upnext.innerHTML = html + '</ol>';
  }

  function render() { renderChips(); renderSheet(); renderSide(); renderUpNext(); }

  // ─── Add to calendar (.ics) ──────────────────────────────────
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n'); }

  function to24(h, mer) {
    h = Number(h);
    mer = (mer || '').toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    return h;
  }

  function downloadIcs(ev) {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//McMaster Book Club//Events//EN', 'BEGIN:VEVENT',
      'UID:' + ev.iso_date + '-' + ev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '@mcmasterbookclub',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')];
    var m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i.exec(ev.time || '');
    var startMer = m && (m[3] || m[6]);
    if (m && startMer) {
      var sh = to24(m[1], m[3] || m[6]), sm = Number(m[2] || 0);
      var eh, em;
      if (m[4]) { eh = to24(m[4], m[6] || m[3]); em = Number(m[5] || 0); } else { eh = sh + 1; em = sm; }
      lines.push('DTSTART:' + ymd(ev.date) + 'T' + pad(sh) + pad(sm) + '00');
      lines.push('DTEND:' + ymd(ev.date) + 'T' + pad(Math.min(eh, 23)) + pad(em) + '00');
    } else {
      var next = new Date(ev.date.getFullYear(), ev.date.getMonth(), ev.date.getDate() + 1);
      lines.push('DTSTART;VALUE=DATE:' + ymd(ev.date));
      lines.push('DTEND;VALUE=DATE:' + ymd(next));
    }
    lines.push('SUMMARY:' + icsEsc('McMaster Book Club: ' + ev.title));
    if (ev.location) lines.push('LOCATION:' + icsEsc(ev.location));
    if (ev.description) lines.push('DESCRIPTION:' + icsEsc(ev.description));
    lines.push('END:VEVENT', 'END:VCALENDAR');

    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ev.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() + '.ics';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // ─── Events ─────────────────────────────────────────────────
  function goToMonth(m) {
    state.month = m;
    state.selected = defaultSelection(m);
    render();
  }

  el.prev.addEventListener('click', function () { goToMonth(addMonths(state.month, -1)); });
  el.next.addEventListener('click', function () { goToMonth(addMonths(state.month, 1)); });

  el.chips.addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (!b) return;
    state.filter = b.getAttribute('data-filter');
    var cur = state.events[state.selected];
    if (!cur || !visible(cur) || !inMonth(cur, state.month)) state.selected = defaultSelection(state.month);
    render();
  });

  el.days.addEventListener('click', function (e) {
    var b = e.target.closest('[data-idx]');
    if (!b) return;
    state.selected = Number(b.getAttribute('data-idx'));
    render();
    var again = el.days.querySelector('[data-idx="' + state.selected + '"]');
    if (again) again.focus();
    if (window.matchMedia('(max-width: 900px)').matches) el.side.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  el.side.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ics]');
    if (b) downloadIcs(state.events[Number(b.getAttribute('data-ics'))]);
  });

  el.upnext.addEventListener('click', function (e) {
    var b = e.target.closest('[data-jump]');
    if (!b) return;
    var i = Number(b.getAttribute('data-jump'));
    state.filter = 'all';
    state.month = monthStart(state.events[i].date);
    state.selected = i;
    render();
  });

  // ─── Load ───────────────────────────────────────────────────
  getAllEvents().then(function (events) {
    state.events = events.map(function (ev) { ev.kind = typeOf(ev); return ev; });
    var thisMonth = monthStart(today);
    var first = events.length ? monthStart(events[0].date) : thisMonth;
    var last = events.length ? monthStart(events[events.length - 1].date) : thisMonth;
    state.minMonth = first < thisMonth ? first : thisMonth;
    state.maxMonth = last > thisMonth ? last : thisMonth;

    // Open on this month, unless it's empty and something is coming up later.
    var start = thisMonth;
    var hasThisMonth = events.some(function (ev) { return inMonth(ev, thisMonth); });
    var nextUp = events.filter(function (ev) { return ev.date >= today; })[0];
    if (!hasThisMonth && nextUp) start = monthStart(nextUp.date);
    goToMonth(start);
  }).catch(function (err) {
    console.warn('Calendar load error:', err);
    state.events = [];
    state.minMonth = state.maxMonth = monthStart(today);
    goToMonth(monthStart(today));
  });
})();
