/**
 * McMaster Book Club — Our Team page
 * The exec team as a flippable book (js/flipbook.js). Members are edited in
 * Pages CMS → data/team.json; list order = book order.
 */
(function () {
  'use strict';

  var root = document.getElementById('team-book');
  if (!root || typeof FlipBook !== 'function') return;

  function esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str == null ? '' : String(str)));
    return d.innerHTML.replace(/"/g, '&quot;');
  }

  // "/images/ourteam/Maddie Co-President.jpg" → URL-safe, keeping the slashes
  function encodePath(path) {
    return String(path).split('/').map(encodeURIComponent).join('/');
  }

  function folio(n) {
    return '<span class="scrap-folio">— ' + n + ' —</span>';
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  // ── Pages ───────────────────────────────────────────────
  function titlePage(data) {
    return '<div class="scrap-page scrap-page--left pe-titlepage">'
      + '<p class="scrap-runhead">McMaster Book Club</p>'
      + '<div class="pe-titlepage-body">'
      +   '<img class="team-book-logo" src="images/logo.png" alt="McMaster Book Club logo">'
      +   '<p class="scrap-chapter">meet the characters</p>'
      +   '<h2 class="pe-titlepage-title">Our Team</h2>'
      +   '<p class="pe-titlepage-sub">Every great story has a cast. These are the people behind ours.</p>'
      +   (data.year ? '<p class="scrap-meta">' + esc(data.year) + '</p>' : '')
      + '</div>'
      + '<p class="pe-hint">Turn the page →</p>'
      + '</div>';
  }

  function castPage(members) {
    var items = members.map(function (m, i) {
      return '<li><button type="button" class="pe-toc-item" data-goto="' + (i + 1) + '">'
        + '<span class="pe-toc-num">' + pad(i + 1) + '</span>'
        + '<span class="pe-toc-title">' + esc(m.full_name || m.name)
        +   '<span class="pe-toc-year">' + esc(m.role) + '</span></span>'
        + '<span class="pe-toc-page">' + (i * 2 + 2) + '</span>'
        + '</button></li>';
    }).join('');
    return '<div class="scrap-page scrap-page--right pe-contents">'
      + '<p class="scrap-runhead">Dramatis Personae</p>'
      + '<ol class="pe-toc pe-toc--compact">' + items + '</ol>'
      + '</div>';
  }

  function portraitPage(m, i) {
    var photo = m.photo
      ? '<img src="' + encodePath(m.photo) + '" alt="' + esc((m.full_name || m.name) + ', ' + m.role) + '">'
      : '<span class="team-portrait-empty" aria-hidden="true">' + esc((m.name || '?').charAt(0)) + '</span>';
    return '<div class="scrap-page scrap-page--left team-portrait-page">'
      + '<p class="scrap-runhead">Meet the Characters</p>'
      + '<figure class="scrap-polaroid scrap-polaroid--portrait">'
      +   '<div class="team-portrait">' + photo + '</div>'
      +   '<figcaption>' + esc(m.name) + '</figcaption>'
      +   '<span class="scrap-tape" aria-hidden="true"></span>'
      + '</figure>'
      + folio(i * 2 + 2)
      + '</div>';
  }

  function sheetRow(label, valueHtml) {
    return '<div class="team-sheet-row"><dt>' + label + '</dt><dd>' + valueHtml + '</dd></div>';
  }

  function sheetPage(m, i) {
    var rows = '';
    if (m.email) rows += sheetRow('Email', '<a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a>');
    if (m.instagram) {
      var handle = String(m.instagram).replace(/^@/, '');
      rows += sheetRow('Instagram', '<a href="https://www.instagram.com/' + encodeURIComponent(handle) + '/" target="_blank" rel="noopener">@' + esc(handle) + '</a>');
    }
    if (m.linkedin && /^https:\/\//.test(m.linkedin)) {
      rows += sheetRow('LinkedIn', '<a href="' + esc(m.linkedin) + '" target="_blank" rel="noopener">' + esc(m.full_name || m.name) + '</a>');
    }
    if (m.favourite_book) rows += sheetRow('Favourite book', '<em>' + esc(m.favourite_book) + '</em>');
    if (m.currently_reading) rows += sheetRow('Currently reading', '<em>' + esc(m.currently_reading) + '</em>');

    return '<div class="scrap-page scrap-page--right team-sheet-page">'
      + '<p class="scrap-runhead">The Cast</p>'
      + '<p class="scrap-chapter">Character No. ' + pad(i + 1) + '</p>'
      + '<h2 class="scrap-title">' + esc(m.full_name || m.name) + '</h2>'
      + '<p class="team-character-role">' + esc(m.role) + '</p>'
      + '<span class="team-sheet-rule" aria-hidden="true"></span>'
      + (rows ? '<dl class="team-sheet">' + rows + '</dl>' : '')
      + '<span class="team-stamp" aria-hidden="true">' + esc(m.role) + '</span>'
      + folio(i * 2 + 3)
      + '</div>';
  }

  function endPages() {
    return {
      left: '<div class="scrap-page scrap-page--left pe-end">'
        + '<p class="scrap-runhead">McMaster Book Club</p>'
        + '<div class="pe-titlepage-body">'
        +   '<p class="scrap-chapter">the final page</p>'
        +   '<h2 class="pe-titlepage-title">The End?</h2>'
        +   '<p class="pe-titlepage-sub">Not quite. There’s always another chapter.</p>'
        + '</div>'
        + '</div>',
      right: '<div class="scrap-page scrap-page--right pe-end pe-end--right">'
        + '<p class="scrap-runhead">Casting call</p>'
        + '<p class="scrap-note">Want to be part of the story?</p>'
        + '<div class="scrap-actions">'
        +   '<a class="chapter-view-btn scrap-open" href="join.html">Join the club</a>'
        +   '<button type="button" class="pe-toc-back" data-goto="0">Back to the cast list</button>'
        + '</div>'
        + '</div>'
    };
  }

  function buildSpreads(data) {
    var members = (data && Array.isArray(data.members) ? data.members : [])
      .filter(function (m) { return m && (m.name || m.full_name) && m.role; });
    var spreads = [{ label: 'Cast list', left: titlePage(data), right: castPage(members) }];
    members.forEach(function (m, i) {
      spreads.push({
        label: (m.full_name || m.name) + ' · ' + m.role,
        left: portraitPage(m, i),
        right: sheetPage(m, i)
      });
    });
    var end = endPages();
    spreads.push({ label: 'The End?', left: end.left, right: end.right });
    return spreads;
  }

  fetch('data/team.json', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('Could not load data/team.json');
      return res.json();
    })
    .then(function (data) {
      FlipBook(root, {
        spreads: buildSpreads(data),
        ariaLabel: 'Our Team book',
        autoplay: { interval: 4000 }
      });
    })
    .catch(function (err) {
      console.warn('Team load error:', err);
      root.innerHTML = '<p class="chapters-empty">The cast is getting ready. Check back soon!</p>';
    });
})();
