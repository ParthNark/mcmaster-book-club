/**
 * McMaster Book Club — Chapters page
 * Renders past events as one flippable scrapbook (data/past-events.json), with a photo gallery.
 */
(function () {
  'use strict';

  var container = document.getElementById('chapters-container');
  if (!container) return;

  // Past events are edited in Pages CMS → data/past-events.json.
  // List order = page order (newest at the top); the first 3 photos are the thumbnails.
  var DATA_URL = 'data/past-events.json';
  var MAX_PHOTOS = 15;

  var chaptersWithPreviews = [];
  var currentFullscreenImage = null;
  var currentChapterIndex = null;
  var fullscreenModal = null;

  function initChapters(data) {
    var chapters = (data && Array.isArray(data.chapters)) ? data.chapters : [];
    chapters = chapters.filter(function(chapter) {
      return chapter && chapter.title && Array.isArray(chapter.photos) && chapter.photos.length > 0;
    });
    chaptersWithPreviews = chapters.map(function(chapter, i) {
      var photos = chapter.photos.filter(Boolean).slice(0, MAX_PHOTOS);
      var num = chapters.length - i;  // bottom chapter is 01
      return {
        num: num,
        number: String(num).padStart(2, '0'),
        title: chapter.title,
        year: chapter.date_label || '',
        captions: Array.isArray(chapter.captions) ? chapter.captions : [],
        note: chapter.note || '',
        allImages: photos,
        previewImages: photos.slice(0, 3)
      };
    });
  }

  function toRoman(n) {
    var map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
               [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    var out = '';
    map.forEach(function(pair) {
      while (n >= pair[0]) { out += pair[1]; n -= pair[0]; }
    });
    return out;
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  // "/images/events/a b/01.jpg" → URL-safe path, keeping the slashes
  function encodePath(path) {
    return String(path).split('/').map(function(segment) {
      return encodeURIComponent(segment);
    }).join('/');
  }

  // One taped polaroid; clicking it opens the album
  function buildPolaroidHtml(chapter, index, photoIndex, extraClass) {
    var src = chapter.previewImages[photoIndex];
    if (!src) return '';
    var caption = chapter.captions[photoIndex] || '';
    return '<figure class="scrap-polaroid ' + extraClass + '">'
      + '<button type="button" class="chapter-photo" data-chapter-index="' + index + '" '
      +   'aria-label="Open all photos from ' + escapeHtml(chapter.title) + '">'
      +   '<img src="' + encodePath(src) + '" alt="' + escapeHtml(chapter.title) + ' - Photo ' + (photoIndex + 1) + '">'
      + '</button>'
      + (caption ? '<figcaption>' + escapeHtml(caption) + '</figcaption>' : '')
      + '<span class="scrap-tape" aria-hidden="true"></span>'
      + '</figure>';
  }

  // ── The pages ─────────────────────────────────────────────
  // The book is a list of spreads: a title page + contents, one spread per
  // event (newest first, same order as Pages CMS), then "The End?".

  function folio(text) {
    return '<span class="scrap-folio">— ' + text + ' —</span>';
  }

  function titlePageHtml() {
    var newest = chaptersWithPreviews[0];
    var oldest = chaptersWithPreviews[chaptersWithPreviews.length - 1];
    var range = (oldest && oldest.year && newest && newest.year && oldest.year !== newest.year)
      ? oldest.year + ' – ' + newest.year : (newest ? newest.year : '');
    return '<div class="scrap-page scrap-page--left pe-titlepage">'
      + '<p class="scrap-runhead">McMaster Book Club</p>'
      + '<div class="pe-titlepage-body">'
      +   '<p class="scrap-chapter">a scrapbook of</p>'
      +   '<h2 class="pe-titlepage-title">The Chapters</h2>'
      +   '<p class="pe-titlepage-sub">Everything we’ve read, played, eaten and laughed about together.</p>'
      +   (range ? '<p class="scrap-meta">' + escapeHtml(range) + '</p>' : '')
      + '</div>'
      + '<p class="pe-hint">Turn the page →</p>'
      + '</div>';
  }

  function contentsPageHtml() {
    var items = chaptersWithPreviews.map(function(chapter, i) {
      return '<li><button type="button" class="pe-toc-item" data-goto="' + (i + 1) + '">'
        + '<span class="pe-toc-num">' + toRoman(chapter.num) + '</span>'
        + '<span class="pe-toc-title">' + escapeHtml(chapter.title)
        +   (chapter.year ? '<span class="pe-toc-year">' + escapeHtml(chapter.year) + '</span>' : '') + '</span>'
        + '<span class="pe-toc-page">' + (chapter.num * 2) + '</span>'
        + '</button></li>';
    }).join('');
    return '<div class="scrap-page scrap-page--right pe-contents">'
      + '<p class="scrap-runhead">Contents</p>'
      + '<ol class="pe-toc">' + items + '</ol>'
      + '</div>';
  }

  function chapterLeftHtml(chapter, index) {
    return '<div class="scrap-page scrap-page--left">'
      + '<p class="scrap-runhead">McMaster Book Club</p>'
      + '<p class="scrap-chapter">Chapter ' + toRoman(chapter.num) + '</p>'
      + '<h2 class="scrap-title">' + escapeHtml(chapter.title) + '</h2>'
      + (chapter.year ? '<p class="scrap-meta">' + escapeHtml(chapter.year) + '</p>' : '')
      + '<div class="scrap-small">'
      +   buildPolaroidHtml(chapter, index, 1, 'scrap-polaroid--left')
      +   buildPolaroidHtml(chapter, index, 2, 'scrap-polaroid--right')
      + '</div>'
      + folio(chapter.num * 2)
      + '</div>';
  }

  function chapterRightHtml(chapter, index) {
    var count = chapter.allImages.length;
    var note = chapter.note || (count + (count === 1 ? ' photo' : ' photos') + ' in this chapter. Flip through them all!');
    return '<div class="scrap-page scrap-page--right">'
      + '<p class="scrap-runhead">Past Events</p>'
      + buildPolaroidHtml(chapter, index, 0, 'scrap-polaroid--big')
      + '<p class="scrap-note">' + escapeHtml(note) + '</p>'
      + '<div class="scrap-actions">'
      +   '<button type="button" class="chapter-view-btn scrap-open" data-chapter-index="' + index + '">Open the album</button>'
      + '</div>'
      + folio(chapter.num * 2 + 1)
      + '</div>';
  }

  function endLeftHtml() {
    return '<div class="scrap-page scrap-page--left pe-end">'
      + '<p class="scrap-runhead">McMaster Book Club</p>'
      + '<div class="pe-titlepage-body">'
      +   '<p class="scrap-chapter">the final page</p>'
      +   '<h2 class="pe-titlepage-title">The End?</h2>'
      +   '<p class="pe-titlepage-sub">Not quite. There’s always another chapter.</p>'
      + '</div>'
      + '</div>';
  }

  function endRightHtml() {
    return '<div class="scrap-page scrap-page--right pe-end pe-end--right">'
      + '<p class="scrap-runhead">Coming soon</p>'
      + '<p class="scrap-note">Chapter ' + toRoman(chaptersWithPreviews.length + 1) + ' could have you in it.</p>'
      + '<div class="scrap-actions">'
      +   '<a class="chapter-view-btn scrap-open" href="join.html">Join the club</a>'
      +   '<button type="button" class="pe-toc-back" data-goto="0">Back to contents</button>'
      + '</div>'
      + '</div>';
  }

  function buildSpreads() {
    var spreads = [{ label: 'Contents', left: titlePageHtml(), right: contentsPageHtml() }];
    chaptersWithPreviews.forEach(function(chapter, i) {
      spreads.push({
        label: 'Chapter ' + toRoman(chapter.num) + ': ' + chapter.title,
        left: chapterLeftHtml(chapter, i),
        right: chapterRightHtml(chapter, i)
      });
    });
    spreads.push({ label: 'The End?', left: endLeftHtml(), right: endRightHtml() });
    return spreads;
  }

  function isModalOpen() {
    var gallery = document.getElementById('chapter-gallery-modal');
    var fullscreen = document.getElementById('chapter-fullscreen-modal');
    return !!((gallery && !gallery.hidden) || (fullscreen && !fullscreen.hidden));
  }

  // The book itself (page turning, contents links, keys, swipes) is js/flipbook.js
  function renderChapters() {
    FlipBook(container, {
      spreads: buildSpreads(),
      ariaLabel: 'Past events book',
      isBlocked: isModalOpen
    });

    // Polaroids and "Open the album" open that chapter's photos
    container.addEventListener('click', function(e) {
      var albumBtn = e.target.closest('.chapter-photo, button.chapter-view-btn');
      if (albumBtn && albumBtn.hasAttribute('data-chapter-index')) {
        openGallery(parseInt(albumBtn.getAttribute('data-chapter-index'), 10));
      }
    });
  }

  function createFullscreenModal() {
    var modal = document.createElement('div');
    modal.id = 'chapter-fullscreen-modal';
    modal.className = 'chapter-fullscreen-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.hidden = true;

    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'chapter-fullscreen-close';
    closeButton.setAttribute('aria-label', 'Close fullscreen image');
    closeButton.textContent = '×';
    closeButton.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      closeFullscreen();
    };

    var image = document.createElement('img');
    image.className = 'chapter-fullscreen-image';
    image.src = '';
    image.alt = '';

    var counter = document.createElement('div');
    counter.className = 'chapter-fullscreen-counter';
    counter.textContent = '';

    modal.appendChild(closeButton);
    modal.appendChild(image);
    modal.appendChild(counter);
    document.body.appendChild(modal);
    return modal;
  }

  function createGalleryModal() {
    var modal = document.createElement('div');
    modal.id = 'chapter-gallery-modal';
    modal.className = 'chapter-gallery-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.hidden = true;

    var content = document.createElement('div');
    content.className = 'chapter-gallery-content';

    var header = document.createElement('div');
    header.className = 'chapter-gallery-header';

    var title = document.createElement('h2');
    title.className = 'chapter-gallery-title';
    title.textContent = '';

    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'chapter-gallery-close';
    closeButton.setAttribute('aria-label', 'Close gallery');
    closeButton.textContent = '×';
    closeButton.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      closeGallery();
    };

    var grid = document.createElement('div');
    grid.className = 'chapter-gallery-grid';
    grid.setAttribute('role', 'grid');

    header.appendChild(title);
    header.appendChild(closeButton);
    content.appendChild(header);
    content.appendChild(grid);
    modal.appendChild(content);
    document.body.appendChild(modal);
    return modal;
  }

  function openGallery(chapterIndex) {
    if (chapterIndex < 0 || chapterIndex >= chaptersWithPreviews.length) return;

    var chapter = chaptersWithPreviews[chapterIndex];
    currentChapterIndex = chapterIndex;

    var galleryModal = document.getElementById('chapter-gallery-modal') || createGalleryModal();
    var galleryTitle = galleryModal.querySelector('.chapter-gallery-title');
    var gridEl = galleryModal.querySelector('.chapter-gallery-grid');

    galleryTitle.textContent = chapter.title;
    gridEl.innerHTML = '';

    chapter.allImages.forEach(function(img, idx) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'chapter-gallery-thumb';
      button.setAttribute('aria-label', 'Open photo ' + (idx + 1) + ' of ' + chapter.allImages.length);
      button.setAttribute('data-img-index', String(idx));
      button.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        openFullscreen(chapterIndex, idx);
      };

      var image = document.createElement('img');
      image.src = encodePath(img);
      image.alt = chapter.title + ' - Photo ' + (idx + 1);
      button.appendChild(image);
      gridEl.appendChild(button);
    });

    galleryModal.hidden = false;
    document.body.classList.add('chapter-gallery-open');
    document.body.classList.remove('chapter-fullscreen-open');
  }

  function closeGallery() {
    var galleryModal = document.getElementById('chapter-gallery-modal');
    if (galleryModal) galleryModal.hidden = true;
    document.body.classList.remove('chapter-gallery-open');
  }

  function openFullscreen(chapterIndex, imageIndex) {
    if (chapterIndex < 0 || chapterIndex >= chaptersWithPreviews.length) return;
    var chapter = chaptersWithPreviews[chapterIndex];
    if (imageIndex < 0 || imageIndex >= chapter.allImages.length) return;

    closeGallery();
    currentChapterIndex = chapterIndex;
    currentFullscreenImage = imageIndex;

    var modal = document.getElementById('chapter-fullscreen-modal') || createFullscreenModal();
    var imgEl = modal.querySelector('.chapter-fullscreen-image');
    var counterEl = modal.querySelector('.chapter-fullscreen-counter');

    imgEl.src = encodePath(chapter.allImages[imageIndex]);
    imgEl.alt = chapter.title + ' - Photo ' + (imageIndex + 1);
    counterEl.textContent = (imageIndex + 1) + ' / ' + chapter.allImages.length;

    modal.hidden = false;
    document.body.classList.remove('chapter-gallery-open');
    document.body.classList.add('chapter-fullscreen-open');
  }

  function closeFullscreen() {
    var modal = document.getElementById('chapter-fullscreen-modal');
    if (modal) modal.hidden = true;
    currentFullscreenImage = null;
    document.body.classList.remove('chapter-fullscreen-open');
    document.body.classList.remove('chapter-gallery-open');
  }

  function nextFullscreenImage() {
    if (currentChapterIndex === null) return;
    var chapter = chaptersWithPreviews[currentChapterIndex];
    var nextIdx = (currentFullscreenImage + 1) % chapter.allImages.length;
    openFullscreen(currentChapterIndex, nextIdx);
  }

  function prevFullscreenImage() {
    if (currentChapterIndex === null) return;
    var chapter = chaptersWithPreviews[currentChapterIndex];
    var prevIdx = (currentFullscreenImage - 1 + chapter.allImages.length) % chapter.allImages.length;
    openFullscreen(currentChapterIndex, prevIdx);
  }

  function bindEvents() {
    document.addEventListener('keydown', function(e) {
      var fullscreenModal = document.getElementById('chapter-fullscreen-modal');
      var galleryModal = document.getElementById('chapter-gallery-modal');

      if (fullscreenModal && !fullscreenModal.hidden) {
        if (e.key === 'Escape') {
          closeFullscreen();
          e.preventDefault();
        } else if (e.key === 'ArrowRight') {
          nextFullscreenImage();
          e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
          prevFullscreenImage();
          e.preventDefault();
        }
        return;
      }

      if (galleryModal && !galleryModal.hidden) {
        if (e.key === 'Escape') {
          closeGallery();
          e.preventDefault();
        }
      }
    });
  }

  // Initialize
  fetch(DATA_URL, { cache: 'no-cache' })
    .then(function(res) {
      if (!res.ok) throw new Error('Could not load ' + DATA_URL);
      return res.json();
    })
    .then(function(data) {
      initChapters(data);
      renderChapters();
    })
    .catch(function(err) {
      console.warn('Past events load error:', err);
      container.innerHTML = '<p class="chapters-empty">Photos are on their way! Check back soon.</p>';
    });
  bindEvents();
})();
