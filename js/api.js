/**
 * McMaster Book Club — API Client
 * ================================
 * Shared fetch functions for talking to the Google Apps Script backend.
 * Loaded via <script src="js/api.js"></script> (no modules, no bundler).
 *
 * SETUP: Replace the URL below with your deployed Web App URL.
 */

/* ──────────────────────────────────────────────
   CONFIGURATION — Paste your Web App URL here
   ────────────────────────────────────────────── */
var API_BASE = "https://script.google.com/macros/s/AKfycbw67ph3OYHViwRxvnW-4WWkLznD4esvpDYcfsOm_KVlNZzXRgksT0JIl70bOHmJhAHcwA/exec";
/* ────────────────────────────────────────────── */

// ─── Session cache for API responses (avoids re-fetching on page nav) ───────
var API_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function _apiCacheGet(key) {
  try {
    var raw = sessionStorage.getItem('api_' + key);
    if (!raw) return null;
    var cached = JSON.parse(raw);
    if (Date.now() - cached._ts > API_CACHE_TTL) {
      sessionStorage.removeItem('api_' + key);
      return null;
    }
    return cached.data;
  } catch (e) { return null; }
}

function _apiCacheSet(key, data) {
  try {
    sessionStorage.setItem('api_' + key, JSON.stringify({ data: data, _ts: Date.now() }));
  } catch (e) { /* storage full */ }
}


/**
 * Fetch the current-read data from the "current" sheet tab.
 * Always returns { books: [{...}, ...], voting_open: bool, vote_form_url: string }.
 * Handles edge cases: old flat format, missing books array, empty responses.
 * Cached in sessionStorage for 5 minutes.
 * @returns {Promise<Object>}
 */
function getCurrent() {
  var cached = _apiCacheGet('current');
  if (cached) return Promise.resolve(_normalizeCurrent(cached));

  return fetch(API_BASE + "?path=current")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      _apiCacheSet('current', data);
      return _normalizeCurrent(data);
    });
}

/**
 * Normalize the API response so every consumer sees a stable shape:
 *   { books: [{id, isbn, ...}, ...], voting_open: bool, vote_form_url: string }
 */
function _normalizeCurrent(data) {
  if (!data) return { books: [], voting_open: false, vote_form_url: '' };

  // Ensure books is always an array
  var books;
  if (Array.isArray(data.books)) {
    books = data.books;
  } else if (data.isbn || data.work_id || data.title) {
    // Old flat format — wrap in array
    books = [data];
  } else {
    books = [];
  }

  // Filter out books that lack any identifier (isbn, work_id, or title)
  books = books.filter(function (b) {
    return (b.isbn && b.isbn.trim() !== '') ||
           (b.work_id && b.work_id.trim() !== '') ||
           (b.title && b.title.trim() !== '');
  });

  // Ensure each book has an id
  for (var i = 0; i < books.length; i++) {
    if (!books[i].id) books[i].id = 'book' + (i + 1);
    // Ensure tags and discussion_prompts are always arrays
    if (books[i].tags && typeof books[i].tags === 'string') {
      books[i].tags = books[i].tags.split(';').map(function(t) { return t.trim(); }).filter(Boolean);
    }
    if (!Array.isArray(books[i].tags)) books[i].tags = [];
    if (books[i].discussion_prompts && typeof books[i].discussion_prompts === 'string') {
      books[i].discussion_prompts = books[i].discussion_prompts.split('|').map(function(t) { return t.trim(); }).filter(Boolean);
    }
    if (!Array.isArray(books[i].discussion_prompts)) books[i].discussion_prompts = [];
  }

  return {
    books: books,
    voting_open: data.voting_open === true || String(data.voting_open).toUpperCase() === 'TRUE',
    vote_form_url: data.vote_form_url || ''
  };
}

/**
 * Fetch past reads from the "past" sheet tab.
 * Cached in sessionStorage for 5 minutes.
 * @returns {Promise<Array>} — [{ title, author, month, short_blurb }, ...]
 */
function getPast() {
  var cached = _apiCacheGet('past');
  if (cached) return Promise.resolve(cached);

  return fetch(API_BASE + "?path=past")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      _apiCacheSet('past', data);
      return data;
    });
}

/**
 * Fetch events from the "events" sheet tab.
 * Cached in sessionStorage for 5 minutes.
 * @returns {Promise<Array>} — [{ title, date, time, location, description, instagram_embed_url, rsvp_url }, ...]
 */
function getEvents() {
  var cached = _apiCacheGet('events');
  if (cached) return Promise.resolve(cached);

  return fetch(API_BASE + "?path=events")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      _apiCacheSet('events', data);
      return data;
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
