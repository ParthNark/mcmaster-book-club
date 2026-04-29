/**
 * McMaster Book Club — Google Apps Script Backend
 * ================================================
 * This web app serves data from a Google Sheet and accepts newsletter signups.
 *
 * SETUP:
 *   1. Create a Google Sheet with tabs: "current", "past", "events", "newsletter"
 *   2. Paste this code into Apps Script (Extensions > Apps Script)
 *   3. Set SHEET_ID below to your Sheet's ID
 *   4. Deploy as Web App → "Anyone" access
 *   5. Copy the Web App URL into js/api.js
 *
 * ENDPOINTS:
 *   GET  ?path=current      → JSON with { books: [{...}, {...}], voting_open, ... }
 *   GET  ?path=past          → JSON array of past reads
 *   GET  ?path=events        → JSON array of upcoming events
 *   POST ?path=newsletter    → Accepts { email, source_page }
 */

// ─── CONFIG ─────────────────────────────────────────────────────────────────
// Replace with your Google Sheet ID (the long string in the Sheet URL)
const SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE";

// Placeholder admin password for trivia uploads.
// IMPORTANT: Replace this with a secure value or a more secure auth flow before public use.
const ADMIN_PASSWORD = "CHANGE_ME";

// Rate-limit window (milliseconds). Same email cannot submit twice within this.
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours
// ─────────────────────────────────────────────────────────────────────────────


// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Build a JSON response with CORS headers.
 */
function jsonResponse(data, statusCode) {
  var output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Open the configured spreadsheet.
 */
function getSheet(tabName) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheetByName(tabName);
}

/**
 * Format a Date object into a clean date string: "Mon, Feb 23, 2026"
 */
function formatDate(d) {
  var days  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return days[d.getDay()] + ", " + months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}

/**
 * Format a Date object into a clean time string: "7:00 PM"
 */
function formatTime(d) {
  var h = d.getHours();
  var m = d.getMinutes();
  var ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return h + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
}

/**
 * Format a Date object into "Mon, Feb 23, 2026 — 7:00 PM"
 * If time is midnight (00:00), only show the date.
 */
function formatDateTime(d) {
  var datePart = formatDate(d);
  if (d.getHours() === 0 && d.getMinutes() === 0) return datePart;
  return datePart + " — " + formatTime(d);
}

/**
 * Convert a cell value to a clean string.
 * If it's a Date, format it as date+time. Otherwise use String().
 */
function cellToString(val) {
  if (val instanceof Date) return formatDateTime(val);
  return String(val).trim();
}

/**
 * Normalize a sheet header to lower_snake_case.
 */
function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Safely parse a date from a sheet cell or string.
 */
function parseDateValue(val) {
  if (val instanceof Date) return val;
  var d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d;
}


// ─── GET HANDLER ────────────────────────────────────────────────────────────

function doGet(e) {
  var path = (e && e.parameter && e.parameter.path) ? e.parameter.path : "";
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";

  try {
    if (action === "leaderboards") {
      return getTriviaLeaderboards();
    } else if (path === "current") {
      return getCurrent();
    } else if (path === "past") {
      return getPast();
    } else if (path === "events") {
      return getEvents();
    } else {
      return jsonResponse({ error: "Unknown path. Use ?path=current, ?path=past, or ?path=events" }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/**
 * Read the "current" tab (key/value pairs) and return two books + global settings.
 *
 * Expected Sheet layout (Option 1 — namespaced keys):
 *   Column A: key              Column B: value
 *   book1_isbn                 9780593638910
 *   book1_work_id              (optional)
 *   book1_custom_summary       ...
 *   book1_tags                 Fiction, Romance
 *   book1_meeting_time         Thursday, March 5 — 6 PM
 *   book1_meeting_location     Blue Lounge, The Hub
 *   book1_meeting_notes        (optional)
 *   book1_discussion_prompts   Q1|Q2|Q3
 *   book1_goodreads_url        https://...
 *   book1_rating_text          4.2 ★
 *   book2_isbn                 9780743273565
 *   book2_work_id              ...
 *   ... (same fields for book2)
 *   voting_open                FALSE
 *   vote_form_url              ...
 *
 * Returns: { books: [book1Obj, book2Obj], voting_open, vote_form_url }
 */
function getCurrent() {
  var sheet = getSheet("current");
  var data  = sheet.getDataRange().getValues();
  var raw   = {};

  // Skip header row (row 0)
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim().toLowerCase();
    var val = cellToString(data[i][1]);
    if (!key) continue;
    raw[key] = val;
  }

  // ── Parse books ──
  var books = [];
  var prefixes = ["book1_", "book2_"];

  for (var p = 0; p < prefixes.length; p++) {
    var prefix = prefixes[p];
    var bookId = prefix.replace("_", ""); // "book1" or "book2"

    // Only include a book if it has at minimum isbn OR work_id OR title
    var hasIsbn   = raw[prefix + "isbn"]   && raw[prefix + "isbn"]   !== "";
    var hasWorkId = raw[prefix + "work_id"] && raw[prefix + "work_id"] !== "";
    var hasTitle  = raw[prefix + "title"]   && raw[prefix + "title"]  !== "";
    if (!hasIsbn && !hasWorkId && !hasTitle) continue;

    var bookObj = { id: bookId };

    // Iterate all raw keys that start with this prefix
    for (var k in raw) {
      if (k.indexOf(prefix) === 0) {
        var fieldName = k.substring(prefix.length);
        var fieldVal  = raw[k];

        if (fieldName === "tags") {
          // Split on semicolon (;) — trim whitespace, drop empties
          bookObj[fieldName] = fieldVal.split(";").map(function(t) { return t.trim(); }).filter(Boolean);
        } else if (fieldName === "discussion_prompts") {
          // Split on pipe (|) — trim whitespace, drop empties
          bookObj[fieldName] = fieldVal.split("|").map(function(t) { return t.trim(); }).filter(Boolean);
        } else {
          // Store non-empty strings, otherwise omit the key
          bookObj[fieldName] = fieldVal;
        }
      }
    }
    books.push(bookObj);
  }

  // ── Global settings ──
  var result = {
    books: books,
    voting_open: (raw["voting_open"] || "").toUpperCase() === "TRUE",
    vote_form_url: raw["vote_form_url"] || ""
  };

  return jsonResponse(result);
}

/**
 * Read the "past" tab and return as a JSON array.
 *
 * Expected Sheet layout:
 *   title | author | month | short_blurb
 */
function getPast() {
  var sheet = getSheet("past");
  var data  = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = String(data[i][j]).trim();
    }
    // Only include rows that have a title
    if (row.title) {
      results.push(row);
    }
  }

  return jsonResponse(results);
}

/**
 * Read the "events" tab and return as a JSON array.
 *
 * Expected Sheet layout:
 *   title | date | time | location | description | instagram_embed_url | rsvp_url
 */
function getEvents() {
  var sheet = getSheet("events");
  if (!sheet) return jsonResponse([]);

  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim().toLowerCase().replace(/\s+/g, "_"); });
  var results = [];

  // Normalise common header variations so the frontend always sees the same keys
  var headerAliases = {
    "instagram_url": "instagram_embed_url"
  };

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      var hdr = headerAliases[headers[j]] || headers[j];
      // For the "date" column use date-only format; otherwise use cellToString
      var cellVal = data[i][j];
      if (hdr === "date" && cellVal instanceof Date) {
        row[hdr] = formatDate(cellVal);
      } else if (hdr === "time" && cellVal instanceof Date) {
        row[hdr] = formatTime(cellVal);
      } else {
        row[hdr] = cellToString(cellVal);
      }
    }
    // Skip completely empty rows
    if (row.title) {
      results.push(row);
    }
  }

  return jsonResponse(results);
}


// ─── POST HANDLER ───────────────────────────────────────────────────────────

function doPost(e) {
  var path = (e && e.parameter && e.parameter.path) ? e.parameter.path : "";
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";

  if (!action && e && e.postData && e.postData.contents) {
    try {
      var parsedBody = JSON.parse(e.postData.contents);
      if (parsedBody && parsedBody.action) {
        action = String(parsedBody.action);
      }
    } catch (parseErr) {
      // Ignore invalid JSON when routing.
    }
  }

  try {
    if (action === "upload-kahoot") {
      return handleTriviaUpload(e);
    } else if (path === "newsletter") {
      return handleNewsletter(e);
    } else {
      return jsonResponse({ error: "Unknown POST path. Use ?path=newsletter" }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/**
 * Handle newsletter signup POST.
 * Body: { "email": "...", "source_page": "index", "website": "" }
 *
 * - "website" is a honeypot field: if filled, reject silently.
 * - Rate-limits same email to once per 24 hours.
 */
function handleNewsletter(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (parseErr) {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  var email      = (body.email || "").trim().toLowerCase();
  var sourcePage = (body.source_page || "unknown").trim();
  var honeypot   = (body.website || "").trim();
  var userAgent  = (e && e.parameter && e.parameter.ua) ? e.parameter.ua : "";

  // ── Honeypot check ──
  if (honeypot !== "") {
    // Silently pretend success so bots don't know
    return jsonResponse({ ok: true, message: "Subscribed!" });
  }

  // ── Basic email validation ──
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return jsonResponse({ ok: false, error: "Invalid email address." }, 400);
  }

  // ── Rate-limit check ──
  var sheet = getSheet("newsletter");
  var data  = sheet.getDataRange().getValues();
  var now   = new Date();

  for (var i = data.length - 1; i >= 1; i--) {
    var rowEmail = String(data[i][1]).trim().toLowerCase();
    if (rowEmail === email) {
      var rowTime = new Date(data[i][0]);
      if (now.getTime() - rowTime.getTime() < RATE_LIMIT_MS) {
        return jsonResponse({ ok: false, error: "You've already subscribed recently. Try again later." });
      }
      break; // Only check the most recent entry for this email
    }
  }

  // ── Append row ──
  sheet.appendRow([
    now.toISOString(),   // timestamp
    email,               // email
    sourcePage,          // source_page
    userAgent            // user_agent
  ]);

  return jsonResponse({ ok: true, message: "Subscribed!" });
}

// ─── TRIVIA / KAHOOT LEADERBOARDS ─────────────────────────────────────────

function getTriviaLeaderboards() {
  var kahoots = readKahoots();
  var scores = readScores();

  var kahootById = {};
  kahoots.forEach(function (k) { kahootById[k.kahoot_id] = k; });

  // All-time leaderboard
  var allTime = buildLeaderboard(scores, null);

  // Last 4 months leaderboard
  var cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 4);
  var recentIds = {};
  kahoots.forEach(function (k) {
    if (k.dateObj && k.dateObj.getTime() >= cutoff.getTime()) {
      recentIds[k.kahoot_id] = true;
    }
  });
  var lastFourMonths = buildLeaderboard(scores, recentIds);

  // Latest kahoot
  var latest = null;
  kahoots.forEach(function (k) {
    if (!latest || (k.sortTime > latest.sortTime)) {
      latest = k;
    }
  });

  var latestKahoot = null;
  if (latest) {
    var latestScores = scores
      .filter(function (s) { return s.kahoot_id === latest.kahoot_id; })
      .sort(function (a, b) {
        var ra = (a.rank === null || a.rank === undefined) ? 999999 : a.rank;
        var rb = (b.rank === null || b.rank === undefined) ? 999999 : b.rank;
        if (ra !== rb) return ra - rb;
        return (b.score || 0) - (a.score || 0);
      });

    latestKahoot = {
      kahoot: {
        kahoot_id: latest.kahoot_id,
        title: latest.title,
        theme: latest.theme,
        date: latest.date,
        winner: latest.winner,
        notes: latest.notes
      },
      scores: latestScores
    };
  }

  // Archive
  var kahootArchive = kahoots
    .sort(function (a, b) { return b.sortTime - a.sortTime; })
    .map(function (k) {
      return {
        kahoot_id: k.kahoot_id,
        title: k.title,
        theme: k.theme,
        date: k.date,
        winner: k.winner,
        notes: k.notes
      };
    });

  return jsonResponse({
    allTime: allTime,
    lastFourMonths: lastFourMonths,
    latestKahoot: latestKahoot,
    kahootArchive: kahootArchive
  });
}

function readKahoots() {
  var sheet = getSheet("kahoots");
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];

  var headers = data[0].map(normalizeHeader);
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }

    if (!row.kahoot_id) continue;

    var dateObj = parseDateValue(row.date);
    var dateStr = dateObj ? formatDate(dateObj) : String(row.date || "").trim();

    var createdObj = parseDateValue(row.created_at);
    var sortTime = createdObj ? createdObj.getTime() : (dateObj ? dateObj.getTime() : 0);

    results.push({
      kahoot_id: String(row.kahoot_id).trim(),
      title: String(row.title || "").trim(),
      theme: String(row.theme || "").trim(),
      winner: String(row.winner || "").trim(),
      notes: String(row.notes || "").trim(),
      date: dateStr,
      dateObj: dateObj,
      sortTime: sortTime
    });
  }

  return results;
}

function readScores() {
  var sheet = getSheet("scores");
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];

  var headers = data[0].map(normalizeHeader);
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }

    if (!row.kahoot_id || !row.player_name) continue;

    var scoreVal = Number(row.score);
    var rankVal = Number(row.rank);

    results.push({
      kahoot_id: String(row.kahoot_id).trim(),
      player_name: String(row.player_name).trim(),
      score: isNaN(scoreVal) ? 0 : scoreVal,
      rank: isNaN(rankVal) ? null : rankVal,
      created_at: String(row.created_at || "").trim()
    });
  }

  return results;
}

function buildLeaderboard(scores, allowedKahootIds) {
  var map = {};

  scores.forEach(function (s) {
    if (allowedKahootIds && !allowedKahootIds[s.kahoot_id]) return;

    var name = String(s.player_name || "").trim();
    if (!name) return;

    var key = name.toLowerCase();
    if (!map[key]) {
      map[key] = {
        player_name: name,
        total_score: 0,
        games_played: 0,
        wins: 0
      };
    }

    map[key].total_score += Number(s.score) || 0;
    map[key].games_played += 1;
    if (Number(s.rank) === 1) map[key].wins += 1;
  });

  var arr = Object.keys(map).map(function (k) { return map[k]; });
  arr.sort(function (a, b) { return b.total_score - a.total_score; });
  return arr.slice(0, 10);
}

function handleTriviaUpload(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (parseErr) {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  var password = String(body.password || "").trim();
  if (!password || password !== ADMIN_PASSWORD) {
    return jsonResponse({ ok: false, error: "Unauthorized." }, 403);
  }

  var title = String(body.title || "").trim();
  var theme = String(body.theme || "").trim();
  var notes = String(body.notes || "").trim();
  var dateStr = String(body.date || "").trim();
  var results = Array.isArray(body.results) ? body.results : [];

  if (!title || results.length === 0) {
    return jsonResponse({ ok: false, error: "Title and results are required." }, 400);
  }

  var dateObj = parseDateValue(dateStr) || new Date();
  var createdAt = new Date().toISOString();
  var kahootId = "kahoot_" + Utilities.getUuid();

  // Determine winner (rank 1)
  var winner = "";
  for (var i = 0; i < results.length; i++) {
    if (Number(results[i].rank) === 1) {
      winner = String(results[i].player_name || "").trim();
      break;
    }
  }

  if (!winner && results.length > 0) {
    winner = String(results[0].player_name || "").trim();
  }

  // Append kahoot row
  var kahootsSheet = getSheet("kahoots");
  if (!kahootsSheet) {
    return jsonResponse({ ok: false, error: "Missing 'kahoots' sheet." }, 500);
  }

  kahootsSheet.appendRow([
    kahootId,
    dateObj,
    title,
    theme,
    winner,
    notes,
    createdAt
  ]);

  // Append scores
  var scoresSheet = getSheet("scores");
  if (!scoresSheet) {
    return jsonResponse({ ok: false, error: "Missing 'scores' sheet." }, 500);
  }

  for (var r = 0; r < results.length; r++) {
    var row = results[r] || {};
    var player = String(row.player_name || "").trim();
    if (!player) continue;

    scoresSheet.appendRow([
      kahootId,
      player,
      Number(row.score) || 0,
      Number(row.rank) || null,
      createdAt
    ]);
  }

  return jsonResponse({ ok: true, kahoot_id: kahootId });
}
