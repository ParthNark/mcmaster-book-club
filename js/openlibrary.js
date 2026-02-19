/**
 * McMaster Book Club — Open Library Integration
 * ===============================================
 * Fetches book metadata (cover, title, authors, description) from Open Library.
 * Falls back gracefully at every step if data is missing.
 *
 * Loaded via: <script src="js/openlibrary.js"></script>
 *
 * Exposes one global function:
 *   fetchBookFromOpenLibrary(config) => Promise<Object>
 *
 * Where config has: { isbn, work_id, title, author, custom_summary, tags }
 * Returns a normalized object:
 *   { title, authors, description, coverUrl, subjects }
 *
 * Performance: Results are cached in sessionStorage per ISBN/work_id for instant
 *              repeat loads. All sub-requests run in parallel where possible.
 */

// ─── Session cache helpers ──────────────────────────────────────────────────

function _olCacheKey(config) {
  return 'olcache_' + (config.isbn || config.work_id || config.title || '').replace(/\s+/g, '_');
}

function _olCacheGet(config) {
  try {
    var key = _olCacheKey(config);
    var raw = sessionStorage.getItem(key);
    if (!raw) return null;
    var cached = JSON.parse(raw);
    // Cache valid for 10 minutes
    if (Date.now() - cached._ts > 10 * 60 * 1000) {
      sessionStorage.removeItem(key);
      return null;
    }
    return cached;
  } catch (e) { return null; }
}

function _olCacheSet(config, data) {
  try {
    data._ts = Date.now();
    sessionStorage.setItem(_olCacheKey(config), JSON.stringify(data));
  } catch (e) { /* storage full or unavailable */ }
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Main entry point. Tries ISBN → work_id → title search, in order.
 * @param {Object} config — from Google Sheets / data/current.json
 * @returns {Promise<Object>} normalized book data
 */
async function fetchBookFromOpenLibrary(config) {
  // Check session cache first
  var cached = _olCacheGet(config);
  if (cached) {
    delete cached._ts;
    return cached;
  }

  var result = {
    title: config.title || '',
    authors: config.author ? [config.author] : [],
    description: config.custom_summary || '',
    coverUrl: '',
    subjects: config.tags || []
  };

  try {
    if (config.isbn) {
      result = await fetchByISBN(config.isbn, result, config);
    } else if (config.work_id) {
      result = await fetchByWorkId(config.work_id, result, config);
    } else if (config.title) {
      result = await fetchBySearch(config.title, config.author || '', result, config);
    }
  } catch (err) {
    console.warn('Open Library fetch failed, using config fallback:', err);
  }

  // Cache the result
  _olCacheSet(config, result);
  return result;
}

// ─── Strategy 1: Fetch by ISBN (parallelized) ───────────────────────────────

async function fetchByISBN(isbn, result, config) {
  var cleanISBN = isbn.replace(/[-\s]/g, '');

  // Cover image URL (no API call needed — direct URL)
  result.coverUrl = 'https://covers.openlibrary.org/b/isbn/' + cleanISBN + '-L.jpg?default=false';

  // Fetch ISBN metadata
  var res = await fetch('https://openlibrary.org/isbn/' + cleanISBN + '.json');
  if (!res.ok) throw new Error('ISBN lookup failed: ' + res.status);
  var data = await res.json();

  // Title
  if (data.title) result.title = data.title;

  // Fire authors + work description in PARALLEL (these are independent)
  var authorPromise = resolveAuthors(data.authors || []);
  var workPromise = (data.works && data.works.length > 0)
    ? fetch('https://openlibrary.org' + data.works[0].key + '.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
    : Promise.resolve(null);

  var results = await Promise.all([authorPromise, workPromise]);
  var authorNames = results[0];
  var workData = results[1];

  if (authorNames.length > 0) result.authors = authorNames;

  // Description — try edition first, then work
  var desc = extractDescription(data);
  if (!desc && workData) {
    desc = extractDescription(workData);
    // Subjects from work if we don't have tags
    if ((!result.subjects || result.subjects.length === 0) && workData.subjects) {
      result.subjects = workData.subjects.slice(0, 5);
    }
  }
  if (desc) result.description = desc;

  if (!result.description && config.custom_summary) {
    result.description = config.custom_summary;
  }

  return result;
}

// ─── Strategy 2: Fetch by Open Library Work ID ──────────────────────────────

async function fetchByWorkId(workId, result, config) {
  var res = await fetch('https://openlibrary.org/works/' + workId + '.json');
  if (!res.ok) throw new Error('Work lookup failed: ' + res.status);
  var data = await res.json();

  if (data.title) result.title = data.title;

  // Cover from covers array
  if (data.covers && data.covers.length > 0) {
    result.coverUrl = 'https://covers.openlibrary.org/b/id/' + data.covers[0] + '-L.jpg';
  }

  // Authors from work.authors[].author.key
  if (data.authors && data.authors.length > 0) {
    var authorRefs = data.authors.map(function (a) {
      return { key: a.author ? a.author.key : a.key };
    }).filter(function (a) { return a.key; });
    var names = await resolveAuthors(authorRefs);
    if (names.length > 0) result.authors = names;
  }

  // Description
  var desc = extractDescription(data);
  if (desc) result.description = desc;
  if (!result.description && config.custom_summary) {
    result.description = config.custom_summary;
  }

  // Subjects
  if (data.subjects && data.subjects.length > 0 && (!result.subjects || result.subjects.length === 0)) {
    result.subjects = data.subjects.slice(0, 5);
  }

  return result;
}

// ─── Strategy 3: Title + Author search fallback ─────────────────────────────

async function fetchBySearch(title, author, result, config) {
  var url = 'https://openlibrary.org/search.json?title=' +
    encodeURIComponent(title) +
    (author ? '&author=' + encodeURIComponent(author) : '') +
    '&limit=1';

  var res = await fetch(url);
  if (!res.ok) throw new Error('Search failed: ' + res.status);
  var data = await res.json();

  if (!data.docs || data.docs.length === 0) return result;

  var doc = data.docs[0];
  if (doc.title) result.title = doc.title;
  if (doc.author_name && doc.author_name.length > 0) result.authors = doc.author_name;

  // Cover from ISBN or cover_i
  if (doc.isbn && doc.isbn.length > 0) {
    result.coverUrl = 'https://covers.openlibrary.org/b/isbn/' + doc.isbn[0] + '-L.jpg?default=false';
  } else if (doc.cover_i) {
    result.coverUrl = 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-L.jpg';
  }

  // Try fetching description from the work key
  if (doc.key) {
    try {
      var workRes = await fetch('https://openlibrary.org' + doc.key + '.json');
      if (workRes.ok) {
        var workData = await workRes.json();
        var desc = extractDescription(workData);
        if (desc) result.description = desc;
      }
    } catch (e) {
      console.warn('Work description fetch failed:', e);
    }
  }

  if (!result.description && config.custom_summary) {
    result.description = config.custom_summary;
  }

  if (doc.subject && doc.subject.length > 0 && (!result.subjects || result.subjects.length === 0)) {
    result.subjects = doc.subject.slice(0, 5);
  }

  return result;
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

/**
 * Resolve author keys (e.g. /authors/OL1234A) into human-readable names.
 * Fetches each author endpoint in parallel.
 */
async function resolveAuthors(authorRefs) {
  if (!authorRefs || authorRefs.length === 0) return [];

  var promises = authorRefs.map(function (ref) {
    var key = ref.key || '';
    if (!key) return Promise.resolve(null);
    return fetch('https://openlibrary.org' + key + '.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return d ? (d.name || d.personal_name || null) : null; })
      .catch(function () { return null; });
  });

  var names = await Promise.all(promises);
  return names.filter(Boolean);
}

/**
 * Extract a plain-text description from an Open Library edition or work object.
 * OL stores descriptions as either a string or { type, value }.
 */
function extractDescription(obj) {
  if (!obj) return '';
  var desc = obj.description;
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (desc.value) return desc.value;
  return '';
}
