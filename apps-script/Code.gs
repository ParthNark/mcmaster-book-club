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


// ─── GET HANDLER ────────────────────────────────────────────────────────────

function doGet(e) {
  var path = (e && e.parameter && e.parameter.path) ? e.parameter.path : "";

  try {
    if (path === "current") {
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

  try {
    if (path === "newsletter") {
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
