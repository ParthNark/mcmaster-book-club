/**
 * McMaster Book Club — Chapters page
 * Renders editorial chapter blocks with lazy-loaded gallery.
 */
(function () {
  'use strict';

  var container = document.getElementById('chapters-container');
  if (!container || typeof CHAPTERS_DATA === 'undefined') return;

  var chaptersWithPreviews = [];
  var currentFullscreenImage = null;
  var currentChapterIndex = null;
  var fullscreenModal = null;

  function getRandomPreviewImages(images, count) {
    if (!images || images.length === 0) return [];
    if (images.length <= count) return images.slice();

    var shuffled = images.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }

    return shuffled.slice(0, count);
  }

  // Initialize chapters with random preview images
  function initChapters() {
    chaptersWithPreviews = CHAPTERS_DATA.map(function(chapter) {
      return {
        number: chapter.number,
        title: chapter.title,
        year: chapter.year,
        imageFolder: chapter.imageFolder,
        allImages: chapter.images,
        previewImages: getRandomPreviewImages(chapter.images, 3)
      };
    });
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  function encodeImagePath(imageFolder, filename) {
    var parts = imageFolder.split('/').concat(filename.split('/'));
    return parts.map(function(segment) {
      return encodeURIComponent(segment);
    }).join('/');
  }

  function buildCollageHtml(chapter, index) {
    var imgs = chapter.previewImages;
    if (!imgs || imgs.length === 0) return '';

    var html = '<div class="chapter-collage" role="group" aria-label="' + escapeHtml(chapter.title) + ' preview photos">';

    // Feature image
    html += '<button type="button" class="chapter-photo chapter-photo--feature" '
      + 'data-chapter-index="' + index + '" '
      + 'aria-label="View all photos from ' + escapeHtml(chapter.title) + '">'
      + '<img src="' + encodeImagePath(chapter.imageFolder, imgs[0]) + '" alt="' + escapeHtml(chapter.title) + ' - Photo 1" loading="lazy">'
      + '</button>';

    // Secondary images
    if (imgs.length > 1) {
      html += '<button type="button" class="chapter-photo chapter-photo--secondary chapter-photo--a" '
        + 'data-chapter-index="' + index + '" '
        + 'aria-label="View all photos from ' + escapeHtml(chapter.title) + '">'
        + '<img src="' + encodeImagePath(chapter.imageFolder, imgs[1]) + '" alt="' + escapeHtml(chapter.title) + ' - Photo 2" loading="lazy">'
        + '</button>';
    }

    if (imgs.length > 2) {
      html += '<button type="button" class="chapter-photo chapter-photo--secondary chapter-photo--b" '
        + 'data-chapter-index="' + index + '" '
        + 'aria-label="View all photos from ' + escapeHtml(chapter.title) + '">'
        + '<img src="' + encodeImagePath(chapter.imageFolder, imgs[2]) + '" alt="' + escapeHtml(chapter.title) + ' - Photo 3" loading="lazy">'
        + '</button>';
    }

    html += '</div>';
    return html;
  }

  function buildChapterHtml(chapter, index) {
    var layoutClass = index % 2 === 0 ? 'chapter--text-left' : 'chapter--text-right';

    return '<article class="chapter-block ' + layoutClass + '" data-chapter-index="' + index + '">'
      + '<div class="chapter-text">'
      +   '<p class="chapter-label">Chapter ' + escapeHtml(chapter.number) + '</p>'
      +   '<h2 class="chapter-title">' + escapeHtml(chapter.title) + '</h2>'
      +   '<p class="chapter-year">' + escapeHtml(chapter.year) + '</p>'
      +   '<div class="chapter-rule" aria-hidden="true"></div>'
      +   '<button type="button" class="chapter-view-btn" data-chapter-index="' + index + '" aria-label="View all photos from ' + escapeHtml(chapter.title) + '">'
      +     '<span>View Chapter</span>'
      +     '<svg class="chapter-view-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      +   '</button>'
      + '</div>'
      + buildCollageHtml(chapter, index)
      + '</article>';
  }

  function renderChapters() {
    var html = '';
    for (var i = 0; i < chaptersWithPreviews.length; i++) {
      html += buildChapterHtml(chaptersWithPreviews[i], i);
    }
    container.innerHTML = html;
    bindChapterButtonEvents();
  }

  function bindChapterButtonEvents() {
    var viewButtons = container.querySelectorAll('.chapter-view-btn');
    viewButtons.forEach(function(button) {
      button.onclick = function() {
        var index = parseInt(button.getAttribute('data-chapter-index'), 10);
        openGallery(index);
      };
    });

    var photoButtons = container.querySelectorAll('.chapter-photo');
    photoButtons.forEach(function(button) {
      button.onclick = function() {
        var index = parseInt(button.getAttribute('data-chapter-index'), 10);
        openGallery(index);
      };
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
      image.src = encodeImagePath(chapter.imageFolder, img);
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

    imgEl.src = encodeImagePath(chapter.imageFolder, chapter.allImages[imageIndex]);
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

  function initScrollReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var blocks = container.querySelectorAll('.chapter-block');
    if (!('IntersectionObserver' in window)) {
      blocks.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    blocks.forEach(function (el) { observer.observe(el); });
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
  initChapters();
  renderChapters();
  initScrollReveal();
  bindEvents();
})();
