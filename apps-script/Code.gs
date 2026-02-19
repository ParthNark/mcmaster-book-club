/**
 * McMaster Book Club — Google Apps Script Backend
 * ================================================
 * This web app serves data from a Google Sheet and accepts newsletter signups.
 *
 * SETUP:
 *   1. Create a Google Sheet with tabs: "current", "past", "newsletter"
 *   2. Paste this code into Apps Script (Extensions > Apps Script)
 *   3. Set SHEET_ID below to your Sheet's ID
 *   4. Deploy as Web App → "Anyone" access
 *   5. Copy the Web App URL into js/api.js
 *
 * ENDPOINTS:
 *   GET  ?path=current      → JSON object of current book data
 *   GET  ?path=past          → JSON array of past reads
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


// ─── GET HANDLER ────────────────────────────────────────────────────────────

function doGet(e) {
  var path = (e && e.parameter && e.parameter.path) ? e.parameter.path : "";

  try {
    if (path === "current") {
      return getCurrent();
    } else if (path === "past") {
      return getPast();
    } else {
      return jsonResponse({ error: "Unknown path. Use ?path=current or ?path=past" }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/**
 * Read the "current" tab (key/value pairs) and return as a single JSON object.
 *
 * Expected Sheet layout:
 *   Column A: key    Column B: value
 *   title            The Great Gatsby
 *   author           F. Scott Fitzgerald
 *   ...
 */
function getCurrent() {
  var sheet = getSheet("current");
  var data  = sheet.getDataRange().getValues();
  var result = {};

  // Skip header row (row 0)
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim().toLowerCase();
    var val = String(data[i][1]).trim();
    if (!key) continue;

    // Parse special fields
    if (key === "tags") {
      result[key] = val.split(",").map(function(t) { return t.trim(); }).filter(Boolean);
    } else if (key === "discussion_prompts") {
      result[key] = val.split("|").map(function(t) { return t.trim(); }).filter(Boolean);
    } else if (key === "voting_open") {
      result[key] = (val.toUpperCase() === "TRUE");
    } else {
      result[key] = val;
    }
  }

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
