/**
 * McMaster Book Club — FlipBook
 * A book you can page through: two-page spreads on wide screens, one page at a
 * time on phones (≤768px). Each turn lifts the page and curls it over, showing
 * the next page on its back. Used by Past Events (chapters.js) and Our Team (team.js).
 *
 *   var book = FlipBook(rootEl, {
 *     spreads: [{ label: 'Contents', left: '<div class="scrap-page">…</div>', right: '…' }, …],
 *     ariaLabel: 'Past events book',
 *     autoplay: { interval: 4500 },        // optional: turns by itself until someone interacts
 *     isBlocked: function () { return modalOpen; }  // optional: ignore arrow keys while true
 *   });
 *   book.goTo(spreadIndex);
 *
 * Inside page HTML: [data-goto="N"] jumps to spread N, [data-turn="1"|"-1"] turns.
 * Styles: the .pe-* rules in style.css.
 */
(function () {
  'use strict';

  var TURN_MS = 850;

  window.FlipBook = function (root, opts) {
    var spreads = opts.spreads || [];
    var singleQuery = window.matchMedia('(max-width: 768px)');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var pos = 0;          // spread index (wide) or page index (phone)
    var turning = false;
    var autoplay = opts.autoplay || null;
    var playing = !!autoplay && !reducedMotion.matches;
    var timer = null;

    var arrowPrev = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var arrowNext = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var iconPause = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
    var iconPlay = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>';

    root.innerHTML = ''
      + '<div class="pe-book" tabindex="0">'
      +   '<div class="pe-spread">'
      +     '<div class="pe-slot pe-slot--left"></div>'
      +     '<div class="pe-slot pe-slot--right"></div>'
      +   '</div>'
      + '</div>'
      + '<div class="pe-controls">'
      +   '<button type="button" class="pe-arrow" data-turn="-1" aria-label="Previous page">' + arrowPrev + '</button>'
      +   '<p class="pe-label" aria-live="polite"></p>'
      +   '<button type="button" class="pe-arrow" data-turn="1" aria-label="Next page">' + arrowNext + '</button>'
      +   (autoplay ? '<button type="button" class="pe-arrow pe-play" data-play aria-pressed="true"></button>' : '')
      + '</div>';

    var bookEl = root.querySelector('.pe-book');
    var slotLeft = root.querySelector('.pe-slot--left');
    var slotRight = root.querySelector('.pe-slot--right');
    var prevBtn = root.querySelector('[data-turn="-1"]');
    var nextBtn = root.querySelector('.pe-controls [data-turn="1"]');
    var labelEl = root.querySelector('.pe-label');
    var playBtn = root.querySelector('[data-play]');
    bookEl.setAttribute('aria-label', (opts.ariaLabel || 'Book') + '. Use the arrow keys to turn pages.');

    function isSingle() { return singleQuery.matches; }
    function lastPos() { return isSingle() ? spreads.length * 2 - 1 : spreads.length - 1; }

    // Page n on a phone: spread floor(n/2), its left page when n is even
    function pageHtml(n) {
      var s = spreads[Math.floor(n / 2)];
      return n % 2 === 0 ? s.left : s.right;
    }

    function positionLabel() {
      if (!isSingle()) return spreads[pos].label;
      return spreads[Math.floor(pos / 2)].label + ' · page ' + (pos + 1) + ' of ' + (lastPos() + 1);
    }

    function render() {
      if (isSingle()) {
        slotLeft.innerHTML = pageHtml(pos);
        slotRight.innerHTML = '';
      } else {
        slotLeft.innerHTML = spreads[pos].left;
        slotRight.innerHTML = spreads[pos].right;
      }
      labelEl.textContent = positionLabel();
      prevBtn.disabled = pos <= 0;
      nextBtn.disabled = pos >= lastPos();
      renderPlay();
      schedule();
    }

    function makeLeaf(sideClass, frontHtml, backHtml) {
      var leaf = document.createElement('div');
      leaf.className = 'pe-leaf ' + sideClass;
      leaf.setAttribute('aria-hidden', 'true');
      leaf.innerHTML = '<div class="pe-face pe-face--front">' + frontHtml + '</div>'
        + '<div class="pe-face pe-face--back">' + backHtml + '</div>';
      return leaf;
    }

    var blankPage = '<div class="scrap-page pe-blank"></div>';

    // Animate one page turn from `pos` to `target`, then show `target`
    function animateTo(target, done) {
      var from = pos;
      var forward = target > from;
      var leaf;

      if (isSingle()) {
        if (forward) {
          slotLeft.innerHTML = pageHtml(target);
          leaf = makeLeaf('pe-leaf--full', pageHtml(from), blankPage);
        } else {
          leaf = makeLeaf('pe-leaf--full pe-leaf--from-left', pageHtml(target), blankPage);
        }
      } else if (forward) {
        slotRight.innerHTML = spreads[target].right;
        leaf = makeLeaf('pe-leaf--right', spreads[from].right, spreads[target].left);
      } else {
        slotLeft.innerHTML = spreads[target].left;
        leaf = makeLeaf('pe-leaf--left', spreads[from].left, spreads[target].right);
      }

      bookEl.appendChild(leaf);
      leaf.getBoundingClientRect();  // start the transition from the resting position
      leaf.classList.add('is-turning');

      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        leaf.remove();
        pos = target;
        render();
        done();
      }
      leaf.addEventListener('transitionend', finish);
      setTimeout(finish, TURN_MS + 120);
    }

    function goTo(target) {
      target = Math.max(0, Math.min(lastPos(), target));
      if (turning || target === pos) return;
      clearTimeout(timer);
      if (reducedMotion.matches) {
        pos = target;
        render();
        return;
      }
      turning = true;
      animateTo(target, function () { turning = false; });
    }

    function turn(dir) { goTo(pos + dir); }

    // ── Autoplay: turns on its own until someone interacts ──
    function renderPlay() {
      if (!playBtn) return;
      playBtn.innerHTML = playing ? iconPause : iconPlay;
      playBtn.setAttribute('aria-label', playing ? 'Pause automatic page turning' : 'Turn pages automatically');
      playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    }

    function schedule() {
      clearTimeout(timer);
      if (!playing || document.hidden) return;
      timer = setTimeout(function () {
        if (pos >= lastPos()) goTo(0);  // back to the start and keep going
        else turn(1);
      }, autoplay.interval || 4500);
    }

    function pause() {
      if (!playing) return;
      playing = false;
      clearTimeout(timer);
      renderPlay();
    }

    document.addEventListener('visibilitychange', schedule);

    // ── Input: buttons, contents links, keys, swipes ──
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-play]')) {
        playing = !playing;
        render();
        return;
      }
      var gotoEl = e.target.closest('[data-goto]');
      if (gotoEl) {
        pause();
        var spread = parseInt(gotoEl.getAttribute('data-goto'), 10);
        goTo(isSingle() ? spread * 2 : spread);
        return;
      }
      var turnEl = e.target.closest('[data-turn]');
      if (turnEl) {
        pause();
        turn(parseInt(turnEl.getAttribute('data-turn'), 10));
        return;
      }
      if (bookEl.contains(e.target)) pause();  // clicking a page = reading it
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if (opts.isBlocked && opts.isBlocked()) return;
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      pause();
      turn(e.key === 'ArrowRight' ? 1 : -1);
      e.preventDefault();
    });

    var startX = null;
    bookEl.addEventListener('touchstart', function (e) {
      startX = e.changedTouches[0].clientX;
      pause();
    }, { passive: true });
    bookEl.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1);
    }, { passive: true });

    // Phone <-> desktop: stay on the same place in the book
    var onModeChange = function () {
      pos = isSingle() ? pos * 2 : Math.floor(pos / 2);
      render();
    };
    if (singleQuery.addEventListener) singleQuery.addEventListener('change', onModeChange);
    else singleQuery.addListener(onModeChange);

    render();
    return { goTo: goTo, turn: turn, pause: pause };
  };
})();
