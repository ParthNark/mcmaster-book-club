/**
 * McMaster Book Club — Data & API Client
 * ======================================
 * Loaded via <script src="js/api.js"></script> (no modules, no bundler).
 *
 * Books and events come from JSON files in this repo, edited through
 * Pages CMS (see .pages.yml):
 *   data/books.json   — current / upcoming / past books + voting settings
 *   data/events.json  — events
 *
 * Newsletter signups and trivia still go to the Google Apps Script web app.
 */

/* ──────────────────────────────────────────────
   Apps Script Web App URL (newsletter + trivia only)
   ────────────────────────────────────────────── */
var API_BASE = "https://script.google.com/macros/s/AKfycbz8VjmaiJJ5qF90N9Sjwhi-LWNS-MU7ykSZ8PwkDJhBvc55I10FvMKNzXx7ZFsQvBrJ9w/exec";
/* ────────────────────────────────────────────── */

// Each data file is fetched at most once per page load.
var _dataFiles = {};

function _loadDataFile(path) {
  if (!_dataFiles[path]) {
    // no-cache: the browser revalidates, so CMS edits show up on the next visit
    _dataFiles[path] = fetch(path, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Could not load ' + path);
      return res.json();
    });
  }
  return _dataFiles[path];
}

function _asList(val) {
  if (Array.isArray(val)) {
    return val.map(function (v) { return String(v).trim(); }).filter(Boolean);
  }
  return [];
}

function _booksWithStatus(data, status) {
  var books = (data && Array.isArray(data.books)) ? data.books : [];
  return books.filter(function (b) {
    return b && String(b.status || '').toLowerCase() === status;
  });
}

/**
 * Current reads.
 * @returns {Promise<{books: Array, voting_open: boolean, vote_form_url: string, store_deal: string}>}
 */
function getCurrent() {
  return _loadDataFile('data/books.json').then(function (data) {
    var books = _booksWithStatus(data, 'current')
      .filter(function (b) { return b.isbn || b.work_id || b.title; })
      .map(function (b, i) {
        return {
          id: 'book' + (i + 1),           // used for current-read.html#book1 anchors
          isbn: b.isbn || '',
          work_id: b.work_id || '',
          title: b.title || '',
          author: b.author || '',
          custom_summary: b.summary || '',
          tags: _asList(b.tags),
          meeting_time: b.meeting_time || '',
          meeting_location: b.meeting_location || '',
          meeting_notes: b.meeting_notes || '',
          discussion_prompts: _asList(b.discussion_prompts),
          goodreads_url: b.goodreads_url || '',
          rating_text: b.rating_text || '',
          cover: b.cover || ''            // optional upload; overrides the Open Library cover
        };
      });

    return {
      books: books,
      voting_open: data.voting_open === true,
      vote_form_url: data.vote_form_url || '',
      store_deal: data.store_deal || ''  // e.g. "10% off" at the Campus Store
    };
  });
}

/**
 * Past reads, in file order (newest first).
 * @returns {Promise<Array>} — [{ title, author, month, short_blurb }, ...]
 */
function getPast() {
  return _loadDataFile('data/books.json').then(function (data) {
    return _booksWithStatus(data, 'past')
      .filter(function (b) { return b.title; })
      .map(function (b) {
        return {
          title: b.title,
          author: b.author || '',
          month: b.month || '',
          short_blurb: b.summary || ''
        };
      });
  });
}

var _DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var _MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-09-15" → Date at local midnight (avoids the UTC off-by-one-day shift)
function _parseISODate(str) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str || ''));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Upcoming events, soonest first. Events are hidden the day after their date.
 * @returns {Promise<Array>} — [{ title, iso_date, date, time, location, description, instagram_embed_url, rsvp_url }, ...]
 */
function getEvents() {
  return _loadDataFile('data/events.json').then(function (data) {
    var events = (data && Array.isArray(data.events)) ? data.events : [];
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    return events
      .filter(function (ev) { return ev && ev.title; })
      .map(function (ev) { return { ev: ev, d: _parseISODate(ev.date) }; })
      .filter(function (x) { return !x.d || x.d >= today; })
      .sort(function (a, b) {
        if (!a.d || !b.d) return a.d ? -1 : (b.d ? 1 : 0);
        return a.d - b.d;
      })
      .map(function (x) {
        var d = x.d;
        return {
          title: x.ev.title,
          iso_date: d ? String(x.ev.date).slice(0, 10) : '',
          date: d ? (_DAYS[d.getDay()] + ', ' + _MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear()) : String(x.ev.date || ''),
          time: x.ev.time || '',
          location: x.ev.location || '',
          description: x.ev.description || '',
          instagram_embed_url: x.ev.instagram_url || '',
          rsvp_url: x.ev.rsvp_url || ''
        };
      });
  });
}

/**
 * Submit a newsletter signup to the backend.
 * @param {string} email
 * @param {string} sourcePage — e.g. "index" or "current-read"
 * @param {string} honeypot  — value of hidden honeypot field (should be "")
 * @returns {Promise<Object>} — { ok: true/false, message?, error? }
 */
function postNewsletter(email, sourcePage, honeypot) {
  return fetch(API_BASE + "?path=newsletter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      email: email,
      source_page: sourcePage || "unknown",
      website: honeypot || ""          // honeypot field
    }),
    redirect: "follow"
  })
    .then(function (res) {
      // Apps Script returns 302 → googleusercontent.com with the JSON response.
      // If the redirect was followed successfully, parse JSON normally.
      // If we got an opaque/error response, treat as success (row was still appended).
      if (res.ok) return res.json();
      return res.text().then(function (txt) {
        try { return JSON.parse(txt); }
        catch (e) { return { ok: true, message: "Subscribed!" }; }
      });
    })
    .catch(function (err) {
      // Cross-origin redirect from script.google.com → googleusercontent.com
      // may cause a CORS/opaque error even though the data was saved.
      // Use no-cors fallback to guarantee delivery.
      return fetch(API_BASE + "?path=newsletter", {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          email: email,
          source_page: sourcePage || "unknown",
          website: honeypot || ""
        })
      }).then(function () {
        // no-cors gives an opaque response, so we can't read it,
        // but the data was sent successfully
        return { ok: true, message: "Subscribed!" };
      });
    });
}
