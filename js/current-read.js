/**
 * McMaster Book Club — Current Read: the open book
 * Reads data/books.json (Pages CMS). Tabs hold this month's books: every
 * "current" book plus any "past" book discussed in the same month.
 * Covers and missing blurbs come from Open Library (js/openlibrary.js).
 */
(function () {
  'use strict';

  var MON3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  // A cover that fails to load becomes a plain cloth cover.
  var MISSING = "this.onerror=null;this.removeAttribute('src');this.alt='';this.classList.add('cr-cover--blank')";
  var DEFAULT_PROMPTS = ['What stood out?', 'Favourite moment or person?', 'Key theme?', 'Would you recommend it?'];

  var el = {
    stage: document.getElementById('cr-stage'),
    tabs: document.getElementById('cr-tabs'),
    left: document.getElementById('cr-page-left'),
    right: document.getElementById('cr-page-right'),
    vote: document.getElementById('cr-vote'),
    past: document.getElementById('cr-past')
  };
  if (!el.stage) return;

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var state = { books: [], current: 0, flipped: {}, storeDeal: '' };

  function esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str == null ? '' : str)));
    return d.innerHTML;
  }

  // "Thu, Nov 26, 2026 — 6:00–7:00 PM" → Date (local midnight) or null
  function parseMeetingDate(str) {
    var m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(String(str || ''));
    if (!m) return null;
    var mi = MON3.indexOf(m[1].toLowerCase());
    if (mi < 0) return null;
    return new Date(Number(m[3]), mi, Number(m[2]));
  }

  function meetingTime(str) {
    var parts = String(str || '').split(/\s+[—–-]\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }

  function sameDay(a, b) { return a && b && a.getTime() === b.getTime(); }

  // Trim long Open Library descriptions to a couple of sentences.
  function shorten(text, max) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    var cut = text.slice(0, max);
    var stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    return stop > max * 0.5 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, '') + '…';
  }

  function list(val) {
    return Array.isArray(val) ? val.map(function (v) { return String(v).trim(); }).filter(Boolean) : [];
  }

  function normalize(b, id) {
    return {
      id: id,
      status: String(b.status || '').toLowerCase(),
      isbn: String(b.isbn || '').replace(/[-\s]/g, ''),
      work_id: b.work_id || '',
      title: b.title || '',
      author: b.author || '',
      month: b.month || '',
      custom_summary: b.summary || '',
      tags: list(b.tags),
      meeting_time: b.meeting_time || '',
      meeting_location: b.meeting_location || '',
      meeting_notes: b.meeting_notes || '',
      discussion_prompts: list(b.discussion_prompts),
      goodreads_url: b.goodreads_url || '',
      cover: b.cover || '',
      date: parseMeetingDate(b.meeting_time)
    };
  }

  // ─── Rendering ──────────────────────────────────────────────
  function renderTabs() {
    if (state.books.length < 2) { el.tabs.hidden = true; return; }
    el.tabs.hidden = false;
    el.tabs.innerHTML = state.books.map(function (b, i) {
      var on = i === state.current;
      return '<button type="button" role="tab" class="cr-tab" id="cr-tab-' + i + '" aria-controls="cr-stage"'
        + ' aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-book="' + i + '">'
        + (b.date ? '<span class="cr-tab-date">' + MON[b.date.getMonth()].toUpperCase() + ' ' + b.date.getDate() + '</span>' : '')
        + '<span class="cr-tab-title">' + esc(b.title) + '</span></button>';
    }).join('');
    el.stage.setAttribute('aria-labelledby', 'cr-tab-' + state.current);
  }

  // The note already shows the date, so the label only says when it falls.
  function whenLabel(b) {
    if (!b.date) return 'DISCUSSION · DATE TBA';
    if (sameDay(b.date, today)) return 'DISCUSSION · TONIGHT';
    return b.date < today ? 'DISCUSSED' : 'DISCUSSION';
  }

  function renderLeft(b) {
    var info = b.ol || {};
    var cover = info.coverUrl || b.cover || '';
    var author = (info.authors && info.authors.length) ? info.authors.join(', ') : b.author;
    var blurb = shorten(b.custom_summary || info.description || '', 340);
    var tags = b.tags.slice(0, 4);   // only tags set in Pages CMS; Open Library subjects are too noisy
    var past = b.date && b.date < today;
    var time = meetingTime(b.meeting_time);
    var where = [time, b.meeting_location].filter(Boolean).join(' · ');

    var links = '';
    var gr = b.goodreads_url || (b.isbn ? 'https://www.goodreads.com/search?q=' + b.isbn : '');
    if (gr) links += '<a class="cr-btn cr-btn--line" href="' + esc(gr) + '" target="_blank" rel="noopener">Goodreads</a>';
    if (b.isbn && !past) {
      links += '<a class="cr-btn cr-btn--line" href="https://campusstore.mcmaster.ca/Item?item=' + esc(b.isbn) + '" target="_blank" rel="noopener">'
        + 'Buy' + (state.storeDeal ? ' · ' + esc(state.storeDeal) : '') + '</a>';
    }

    var cta = past
      ? '<a class="cr-btn cr-btn--solid" href="meetings-events.html">See what\'s coming up</a>'
      : '<a class="cr-btn cr-btn--solid" href="meetings-events.html">' + (sameDay(b.date, today) ? 'See you tonight · details' : 'Find it on the calendar') + '</a>';

    el.left.innerHTML =
      '<div class="cr-cover-wrap">'
      +   (cover
            ? '<img class="cr-cover" src="' + esc(cover) + '" alt="Cover of ' + esc(b.title) + '" onerror="' + MISSING + '">'
            : '<span class="cr-cover cr-cover--blank" aria-hidden="true"></span>')
      +   '<div class="cr-note">'
      +     '<span class="cr-note-when">' + whenLabel(b) + '</span>'
      +     (b.date ? '<span class="cr-note-date">' + DAY[b.date.getDay()] + ' ' + MON[b.date.getMonth()] + ' ' + b.date.getDate() + '</span>' : '')
      +     (where ? '<span class="cr-note-where">' + esc(where) + '</span>' : '')
      +   '</div>'
      + '</div>'
      + '<div class="cr-info">'
      +   (b.month ? '<p class="cr-kicker">' + esc(b.month) + '</p>' : '')
      +   '<h1 class="cr-title">' + esc(b.title) + '</h1>'
      +   (author ? '<p class="cr-author">by ' + esc(author) + '</p>' : '')
      +   (tags.length ? '<ul class="cr-tags-list">' + tags.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '')
      +   (blurb ? '<p class="cr-blurb">' + esc(blurb) + '</p>' : '')
      +   (b.meeting_notes ? '<p class="cr-notes">' + esc(b.meeting_notes) + '</p>' : '')
      +   '<div class="cr-actions">' + cta + (links ? '<div class="cr-actions-row">' + links + '</div>' : '') + '</div>'
      + '</div>';
  }

  function renderRight(b) {
    var prompts = (b.discussion_prompts.length ? b.discussion_prompts : DEFAULT_PROMPTS).slice(0, 4);
    var cards = prompts.map(function (q, i) {
      var on = !!state.flipped[i];
      return '<li><button type="button" class="cr-card' + (on ? ' is-flipped' : '') + '" data-card="' + i + '" aria-pressed="' + on + '"'
        + ' aria-label="' + (on ? esc(q) : 'Card ' + NUMERALS[i] + ', tap to flip') + '">'
        + '<span class="cr-card-inner">'
        +   '<span class="cr-card-face cr-card-back" aria-hidden="true"><span class="cr-card-label">CARD ' + NUMERALS[i] + '</span><span class="cr-card-num">' + NUMERALS[i] + '</span></span>'
        +   '<span class="cr-card-face cr-card-front" aria-hidden="true"><span class="cr-card-label">CARD ' + NUMERALS[i] + '</span><span class="cr-card-q">' + esc(q) + '</span></span>'
        + '</span></button></li>';
    }).join('');

    var other = '';
    if (state.books.length > 1) {
      var oi = (state.current + 1) % state.books.length;
      var o = state.books[oi];
      var oCover = (o.ol && o.ol.coverUrl) || o.cover || '';
      var oImg = oCover
        ? '<img src="' + esc(oCover) + '" alt="" onerror="' + MISSING + '">'
        : '<span class="cr-cover--blank" aria-hidden="true"></span>';
      var oWhen = o.date
        ? (sameDay(o.date, today) ? 'DISCUSSION TONIGHT' : (o.date < today ? 'DISCUSSED ' : 'DISCUSSION ') + DAY[o.date.getDay()].toUpperCase() + ' ' + MON[o.date.getMonth()].toUpperCase() + ' ' + o.date.getDate())
        : '';
      other = '<button type="button" class="cr-other" data-book="' + oi + '">'
        + oImg
        + '<span class="cr-other-text"><span class="cr-other-when">ALSO THIS MONTH' + (oWhen ? ' · ' + oWhen : '') + '</span>'
        + '<span class="cr-other-title">' + esc(o.title) + (o.author ? ', ' + esc(o.author) : '') + ' →</span></span></button>';
    }

    el.right.innerHTML =
      '<p class="cr-kicker">Bring these to the table</p>'
      + '<p class="cr-hand">tap a card to flip it</p>'
      + '<ul class="cr-cards">' + cards + '</ul>'
      + other;
  }

  function render() {
    var b = state.books[state.current];
    renderTabs();
    renderLeft(b);
    renderRight(b);
  }

  function select(i, focusTab) {
    if (i === state.current) return;
    state.current = i;
    state.flipped = {};
    render();
    if (focusTab) {
      var t = document.getElementById('cr-tab-' + i);
      if (t) t.focus();
    }
    try { history.replaceState(null, '', '#' + state.books[i].id); } catch (e) { /* file:// or sandboxed */ }
  }

  // ─── Interaction ────────────────────────────────────────────
  el.tabs.addEventListener('click', function (e) {
    var b = e.target.closest('[data-book]');
    if (b) select(Number(b.getAttribute('data-book')));
  });

  el.tabs.addEventListener('keydown', function (e) {
    var n = state.books.length;
    var i = state.current;
    if (e.key === 'ArrowRight') i = (i + 1) % n;
    else if (e.key === 'ArrowLeft') i = (i - 1 + n) % n;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = n - 1;
    else return;
    e.preventDefault();
    select(i, true);
  });

  el.right.addEventListener('click', function (e) {
    var card = e.target.closest('[data-card]');
    if (card) {
      var i = Number(card.getAttribute('data-card'));
      state.flipped[i] = !state.flipped[i];
      var on = state.flipped[i];
      var b = state.books[state.current];
      var q = (b.discussion_prompts.length ? b.discussion_prompts : DEFAULT_PROMPTS)[i];
      card.classList.toggle('is-flipped', on);
      card.setAttribute('aria-pressed', String(on));
      card.setAttribute('aria-label', on ? q : 'Card ' + NUMERALS[i] + ', tap to flip');
      return;
    }
    var other = e.target.closest('[data-book]');
    if (other) {
      select(Number(other.getAttribute('data-book')));
      el.stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ─── Vote slip + past reads ─────────────────────────────────
  function renderVote(data) {
    if (data.voting_open === true && data.vote_form_url) {
      el.vote.innerHTML = '<p class="cr-kicker">Next month</p>'
        + '<h2 class="cr-side-title">Voting is open</h2>'
        + '<p class="cr-side-text">Pick what we read next. It takes a minute.</p>'
        + '<a class="cr-btn cr-btn--solid" href="' + esc(data.vote_form_url) + '" target="_blank" rel="noopener">Vote for the next book</a>';
    } else {
      el.vote.innerHTML = '<p class="cr-kicker">Next month</p>'
        + '<h2 class="cr-side-title">Voting opens soon</h2>'
        + '<p class="cr-side-text">Members pick each month\'s read. The vote link shows up here when it opens.</p>'
        + '<p class="cr-hand">follow <a href="https://www.instagram.com/mcmasterbooks/" target="_blank" rel="noopener">@mcmasterbooks</a> for the reminder</p>';
    }
  }

  function renderPast(pastBooks, shownIds) {
    var rows = pastBooks.filter(function (b) { return shownIds.indexOf(b.id) < 0; });
    if (!rows.length) { el.past.hidden = true; return; }
    el.past.innerHTML = '<p class="cr-kicker">Checked out before</p>'
      + '<h2 class="cr-side-title">Past reads</h2>'
      + '<ol class="cr-ledger">' + rows.map(function (b) {
        return '<li><span class="cr-ledger-title">' + esc(b.title) + '</span>'
          + (b.author ? '<span class="cr-ledger-author">' + esc(b.author) + '</span>' : '')
          + (b.month ? '<span class="cr-ledger-month">' + esc(b.month) + '</span>' : '') + '</li>';
      }).join('') + '</ol>';
  }

  // ─── Load ───────────────────────────────────────────────────
  _loadDataFile('data/books.json').then(function (data) {
    var all = (data && Array.isArray(data.books)) ? data.books : [];
    state.storeDeal = data.store_deal || '';

    var current = [], past = [];
    all.forEach(function (raw) {
      if (!raw || !(raw.title || raw.isbn || raw.work_id)) return;
      var s = String(raw.status || '').toLowerCase();
      if (s === 'current') current.push(normalize(raw, 'book' + (current.length + 1)));
      else if (s === 'past' && raw.title) past.push(normalize(raw, 'past' + (past.length + 1)));
    });

    // Past books discussed in the same month as a current book are "also this month".
    var months = current.filter(function (b) { return b.date; }).map(function (b) { return b.date.getFullYear() * 12 + b.date.getMonth(); });
    var also = past.filter(function (b) { return b.date && months.indexOf(b.date.getFullYear() * 12 + b.date.getMonth()) >= 0; });
    state.books = current.concat(also);

    renderVote(data);
    renderPast(past, also.map(function (b) { return b.id; }));

    if (!state.books.length) {
      el.stage.innerHTML = '<div class="cr-empty"><p class="cr-side-title">This month\'s book is on its way.</p>'
        + '<p class="cr-hand">follow <a href="https://www.instagram.com/mcmasterbooks/" target="_blank" rel="noopener">@mcmasterbooks</a> to hear first</p></div>';
      return;
    }

    var hash = location.hash.slice(1);
    var fromHash = state.books.map(function (b) { return b.id; }).indexOf(hash);
    state.current = fromHash >= 0 ? fromHash : 0;
    render();

    // Covers and blurbs fill in as Open Library answers.
    state.books.forEach(function (b) {
      fetchBookFromOpenLibrary(b).then(function (info) {
        b.ol = info;
        render();
      }).catch(function () { /* keep the CMS details */ });
    });
  }).catch(function (err) {
    console.error('Current Read load error:', err);
    el.stage.innerHTML = '<div class="cr-empty"><p class="cr-side-title">Couldn\'t load this month\'s book. Please refresh.</p></div>';
  });
})();
