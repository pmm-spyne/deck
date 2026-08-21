/**
 * Export the full pitch demo (allAgents) as one standalone HTML deck.
 *
 * Usage:
 *   node docs/client-deck/export-client-deck-html.mjs
 *   EXPORT_BASE_URL=http://127.0.0.1:5174 node docs/client-deck/export-client-deck-html.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { injectStudioOsIntoDeckHtml } from './studio-os-slides.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(__dirname);
const OUT_PATH = join(OUT_DIR, 'client-deck.html');
const BASE = process.env.EXPORT_BASE_URL || 'http://127.0.0.1:5174';
const WIDTH = 1920;
const HEIGHT = 1080;

const HIDE_CHROME = `
  .dpf-prodIndex,
  .dpf-secNav,
  .dpf-topbarReveal,
  .dpf-engagement,
  [data-demo-cta="modify_metrics"] {
    display: none !important;
  }
  html, body {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #fff;
  }
  .dpf-pitchDeck {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
  }
  .dpf-pitchDeck-frame {
    display: none;
  }
  .dpf-pitchDeck-frame.is-on {
    display: block !important;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }
  .client-deck-hud {
    position: fixed;
    right: 18px;
    bottom: 16px;
    z-index: 90;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(20, 18, 26, 0.78);
    color: #fff;
    font: 600 12px/1.2 Inter, system-ui, sans-serif;
    letter-spacing: 0.04em;
    pointer-events: none;
    user-select: none;
  }
  /* —— Phone / tablet: native vertical scroll (desktop unchanged) —— */
  html[data-deck-mode="pdf"] {
    height: auto !important;
    min-height: 100% !important;
    background: #525659 !important;
    /* Do NOT set overflow-x:hidden on html/body — breaks iOS momentum scroll */
    overflow-y: scroll !important;
    overflow-x: scroll !important;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: auto;
    touch-action: pan-x pan-y pinch-zoom;
    scroll-snap-type: none;
  }
  html[data-deck-mode="pdf"] body {
    height: auto !important;
    min-height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    background: #525659 !important;
    touch-action: pan-x pan-y pinch-zoom;
  }
  html[data-deck-mode="pdf"] .dpf-pitchDeck {
    position: relative !important;
    inset: auto !important;
    width: 1920px !important;
    max-width: 1920px !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 auto;
    background: #525659 !important;
    padding: 8px 0 calc(48px + env(safe-area-inset-bottom, 0px)) !important;
    box-sizing: border-box;
    overflow: visible !important;
    touch-action: pan-x pan-y pinch-zoom;
  }
  html[data-deck-mode="pdf"] .dpf-pitchDeck-stage {
    position: relative !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 8px !important;
    width: 1920px !important;
    height: auto !important;
    overflow: visible !important;
    background: transparent !important;
    touch-action: pan-x pan-y pinch-zoom;
  }
  html[data-deck-mode="pdf"] .dpf-pitchDeck-frame,
  html[data-deck-mode="pdf"] .dpf-pitchDeck-frame.is-on {
    display: block !important;
    position: relative !important;
    inset: auto !important;
    width: 1920px !important;
    height: 1080px !important;
    max-width: 1920px !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    z-index: 1 !important;
    overflow: hidden !important;
    background: #fff !important;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.28);
    flex: 0 0 auto !important;
    transition: none !important;
    touch-action: pan-x pan-y pinch-zoom;
  }
  html[data-deck-mode="pdf"] .dpf-pitchDeck-frame > .dpf-pitchSlide {
    width: 1920px !important;
    height: 1080px !important;
    touch-action: pan-x pan-y pinch-zoom;
  }
  /* Default: clip tall slides — deck browse only until zoomed */
  html[data-deck-mode="pdf"] .dpf-pitchSlide--scroll {
    overflow: hidden !important;
  }
  /* Pinch-zoom or selected-zoom: allow scrolling inside tall slides */
  html[data-deck-mode="pdf"].is-pdf-zoomed .dpf-pitchDeck-frame.is-pdf-can-scroll > .dpf-pitchSlide,
  html[data-deck-mode="pdf"].is-pdf-zoomed .dpf-pitchDeck-frame.is-pdf-can-scroll > .dpf-pitchSlide--scroll,
  html[data-deck-mode="pdf"] .dpf-pitchDeck-frame.is-pdf-slide-zoom > .dpf-pitchSlide,
  html[data-deck-mode="pdf"] .dpf-pitchDeck-frame.is-pdf-slide-zoom > .dpf-pitchSlide--scroll {
    overflow-x: auto !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-x pan-y pinch-zoom;
  }
  html[data-deck-mode="pdf"].is-pdf-zoomed .dpf-pitchDeck-frame.is-pdf-can-scroll > .dpf-pitchSlide > .dpf-pitchSlide-inner,
  html[data-deck-mode="pdf"] .dpf-pitchDeck-frame.is-pdf-slide-zoom > .dpf-pitchSlide > .dpf-pitchSlide-inner {
    height: auto !important;
    min-height: min-content !important;
    justify-content: flex-start !important;
  }
  /* Selected slide soft-zoom (fills viewport; then inner scroll works) */
  html[data-deck-mode="pdf"] .dpf-pitchDeck-frame.is-pdf-slide-zoom {
    position: fixed !important;
    left: 50% !important;
    top: 50% !important;
    width: 1920px !important;
    height: 1080px !important;
    max-width: none !important;
    margin: 0 !important;
    z-index: 320 !important;
    transform: translate(-50%, -50%) scale(var(--pdf-slide-zoom, 1)) !important;
    transform-origin: center center !important;
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
    overflow: hidden !important;
  }
  html[data-deck-mode="pdf"].is-pdf-slide-zoom-on,
  html[data-deck-mode="pdf"].is-pdf-slide-zoom-on body {
    overflow: hidden !important;
    overscroll-behavior: none;
  }
  html[data-deck-mode="pdf"].is-pdf-slide-zoom-on body {
    position: fixed !important;
    top: var(--pdf-lock-top, 0px);
    left: 0;
    right: 0;
    width: 100%;
  }
  html[data-deck-mode="pdf"].is-pdf-slide-zoom-on .dpf-pitchDeck::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 310;
    background: rgba(20, 18, 26, 0.55);
    pointer-events: auto;
  }
  html[data-deck-mode="pdf"] .dpf-pitchDeck-nav {
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    top: 0 !important;
    bottom: auto !important;
    z-index: 200 !important;
    pointer-events: none !important;
  }
  html[data-deck-mode="pdf"] .dpf-pitchDeck-progress {
    height: 3px !important;
  }
  html[data-deck-mode="pdf"] .client-deck-hud {
    right: max(12px, env(safe-area-inset-right)) !important;
    bottom: max(12px, env(safe-area-inset-bottom)) !important;
    font-size: 11px !important;
    padding: 6px 10px !important;
    opacity: 0.9;
    pointer-events: none !important;
  }
  html[data-deck-mode="pdf"] .client-deck-overlayHost,
  html[data-deck-mode="pdf"] .client-deck-overlayHost .dpf-calcModal-backdrop,
  html[data-deck-mode="pdf"] .client-deck-overlayHost .dpf-storyModal-backdrop,
  html[data-deck-mode="pdf"] .client-deck-overlayHost .dpf-soChatModal-backdrop,
  html[data-deck-mode="pdf"] .client-deck-overlayHost .dpf-soChat-backdrop,
  html[data-deck-mode="pdf"] .client-deck-overlayHost .dpf-soBenefits-backdrop,
  html[data-deck-mode="pdf"] .client-deck-overlayHost > [class*="backdrop"] {
    position: fixed !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    max-height: 100dvh !important;
    overflow: auto !important;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y pinch-zoom;
  }
  /* DMS Analysis — campaign types only (V1-style list; CRM Analysis untouched) */
  .cad--typesOnly .cad-scan,
  .cad--typesOnly .cad-replay,
  .cad--typesOnly .cad-stats,
  .cad--typesOnly .cad-note,
  .cad--typesOnly .cad-cNum,
  .cad--typesOnly .cad-cSpan {
    display: none !important;
  }
  .cad--typesOnly .cad-tHead,
  .cad--typesOnly .cad-tRow {
    grid-template-columns: 28px minmax(0, 1fr) !important;
  }
  .cad--typesOnly .cad-tHead span:first-child {
    grid-column: 1 / 3;
  }
  /* Closing block — single call recording link */
  .dpf-viniDoV2--singleLink .dpf-viniDoV2-inner {
    max-width: 640px;
  }
  .dpf-clientRecLink {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    margin-top: 28px;
    padding: 28px 32px;
    border-radius: 18px;
    border: 1px solid #ebe4f8;
    background: linear-gradient(180deg, #ffffff 0%, #faf7ff 100%);
    box-shadow: 0 10px 28px rgba(88, 48, 160, 0.08);
    text-decoration: none;
    color: inherit;
  }
  .dpf-clientRecLink-tag {
    display: inline-flex;
    padding: 5px 10px;
    border-radius: 999px;
    background: #7c3aed;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .dpf-clientRecLink-title {
    font-family: "Plus Jakarta Sans", Inter, system-ui, sans-serif;
    font-size: clamp(22px, 2.4vw, 30px);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
    color: #17131f;
  }
  .dpf-clientRecLink-meta {
    font-size: 13px;
    font-weight: 500;
    color: #6f6a80;
  }
  .dpf-clientRecLink-cta {
    margin-top: 6px;
    font-size: 15px;
    font-weight: 700;
    color: #7537e0;
  }
`;

const DECK_VIEWPORT_BOOT = `
  (function () {
    function isPdfMode() {
      var touch = false;
      try { touch = window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches; } catch (e) {}
      touch = touch || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      var sw = Math.min(screen.width || 0, screen.height || 0);
      var sh = Math.max(screen.width || 0, screen.height || 0);
      var ow = window.outerWidth || 0;
      var visual = 0;
      try { visual = (window.visualViewport && window.visualViewport.width) || 0; } catch (e) {}
      if (sw && sw <= 1024 && touch) return true;
      if (touch && sh && sh <= 1366 && sw && sw <= 1180) return true;
      if (visual && visual <= 920) return true;
      if (ow && ow <= 900) return true;
      return false;
    }
    function deviceFitWidth() {
      var a = screen.width || 0;
      var b = screen.height || 0;
      if (!a && !b) return window.outerWidth || 390;
      var landscape = false;
      try { landscape = window.matchMedia('(orientation: landscape)').matches; } catch (e) {}
      return landscape ? Math.max(a, b) : Math.min(a, b);
    }
    function apply() {
      var pdf = isPdfMode();
      document.documentElement.setAttribute('data-deck-mode', pdf ? 'pdf' : 'deck');
      var meta = document.getElementById('client-deck-viewport');
      if (!meta) return;
      if (pdf) {
        var designW = 1920;
        var fitW = deviceFitWidth() || designW;
        var scale = Math.min(1, fitW / designW);
        meta.setAttribute(
          'content',
          'width=' + designW + ', initial-scale=' + scale.toFixed(5) +
          ', minimum-scale=0.1, maximum-scale=3, user-scalable=yes, viewport-fit=cover'
        );
      } else {
        meta.setAttribute('content', 'width=1920, initial-scale=1, viewport-fit=cover');
      }
    }
    apply();
    window.addEventListener('orientationchange', function () { setTimeout(apply, 80); });
    window.addEventListener('resize', function () {
      clearTimeout(window.__deckPdfResizeT);
      window.__deckPdfResizeT = setTimeout(apply, 120);
    });
  })();
`;

const DECK_SCRIPT = `
(function () {
  var frames = Array.prototype.slice.call(document.querySelectorAll('.dpf-pitchDeck-frame'));
  var fill = document.querySelector('.dpf-pitchDeck-progressFill');
  var hud = document.querySelector('[data-client-deck-hud]');
  var i = 0;
  var scrollT = null;
  var scrolling = false;
  var zoomedFrame = null;
  var lockY = 0;
  var baseScale = 1;
  var lastTap = { t: 0, x: 0, y: 0, frame: null };
  var touchPan = { active: false, x: 0, y: 0, sx: 0, sy: 0 };

  function isPdf() {
    return document.documentElement.getAttribute('data-deck-mode') === 'pdf';
  }

  function slideOf(frame) {
    return frame ? (frame.querySelector('[data-pitch-slide]') || frame.firstElementChild) : null;
  }

  function canSlideScroll(frame) {
    var slide = slideOf(frame);
    if (!slide) return false;
    if (slide.getAttribute('data-pitch-scroll') === '1') return true;
    if (slide.classList.contains('dpf-pitchSlide--scroll')) return true;
    return (slide.scrollHeight - slide.clientHeight) > 16;
  }

  function markScrollableFrames() {
    frames.forEach(function (frame) {
      frame.classList.toggle('is-pdf-can-scroll', isPdf() && canSlideScroll(frame));
    });
  }

  function currentScale() {
    try {
      if (window.visualViewport && typeof window.visualViewport.scale === 'number') {
        return window.visualViewport.scale || 1;
      }
    } catch (e) {}
    return 1;
  }

  function captureBaseScale() {
    baseScale = currentScale() || 1;
  }

  function syncPinchZoomClass() {
    if (!isPdf()) {
      document.documentElement.classList.remove('is-pdf-zoomed');
      return;
    }
    var scale = currentScale();
    var zoomed = scale > (baseScale * 1.06 + 0.001);
    document.documentElement.classList.toggle('is-pdf-zoomed', zoomed);
    if (zoomed) markScrollableFrames();
  }

  function slideZoomFactor() {
    var vw = (window.visualViewport && window.visualViewport.width) || window.innerWidth || 390;
    var vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight || 700;
    // Slightly larger than fit-contain so the selected slide feels zoomed in
    var fit = Math.min(vw / 1920, vh / 1080);
    return Math.max(fit * 1.18, fit + 0.04);
  }

  function clearSlideZoom() {
    if (!zoomedFrame && !document.documentElement.classList.contains('is-pdf-slide-zoom-on')) return;
    if (zoomedFrame) zoomedFrame.classList.remove('is-pdf-slide-zoom');
    zoomedFrame = null;
    document.documentElement.classList.remove('is-pdf-slide-zoom-on');
    document.documentElement.style.removeProperty('--pdf-lock-top');
    document.documentElement.style.removeProperty('--pdf-slide-zoom');
    window.scrollTo(0, lockY || 0);
  }

  function openSlideZoom(frame) {
    if (!isPdf() || !frame || !canSlideScroll(frame)) return;
    if (zoomedFrame === frame) return;
    clearSlideZoom();
    markScrollableFrames();
    lockY = window.scrollY || window.pageYOffset || 0;
    try { frame.scrollIntoView({ block: 'nearest', behavior: 'auto' }); } catch (e) {}
    lockY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.style.setProperty('--pdf-lock-top', (-lockY) + 'px');
    document.documentElement.style.setProperty('--pdf-slide-zoom', String(slideZoomFactor()));
    zoomedFrame = frame;
    frame.classList.add('is-pdf-slide-zoom');
    document.documentElement.classList.add('is-pdf-slide-zoom-on');
    var idx = frames.indexOf(frame);
    if (idx >= 0) setChrome(idx, true);
  }

  function setChrome(idx, writeHash) {
    i = idx;
    if (fill) {
      fill.style.width = (frames.length > 1 ? (i / (frames.length - 1)) * 100 : 100) + '%';
    }
    if (hud) hud.textContent = (i + 1) + ' / ' + frames.length;
    if (writeHash !== false) {
      try { history.replaceState(null, '', '#slide-' + (i + 1)); } catch (e) {}
    }
  }

  function revealAllPdfPages() {
    frames.forEach(function (frame, idx) {
      frame.classList.add('is-on');
      frame.setAttribute('aria-hidden', 'false');
      frame.setAttribute('data-pdf-page', String(idx + 1));
    });
    markScrollableFrames();
  }

  function showDeck(next) {
    if (!frames.length) return;
    clearSlideZoom();
    i = Math.max(0, Math.min(frames.length - 1, next));
    frames.forEach(function (frame, idx) {
      var on = idx === i;
      frame.classList.toggle('is-on', on);
      frame.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    setChrome(i);
  }

  function jumpPdf(next, smooth) {
    if (!frames.length) return;
    clearSlideZoom();
    i = Math.max(0, Math.min(frames.length - 1, next));
    revealAllPdfPages();
    setChrome(i);
    var target = frames[i];
    if (!target || !target.scrollIntoView) return;
    scrolling = true;
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    setTimeout(function () { scrolling = false; }, smooth ? 450 : 80);
  }

  function show(next, smooth) {
    if (isPdf()) jumpPdf(next, !!smooth);
    else showDeck(next);
  }

  function fromHash() {
    var m = (location.hash || '').match(/slide-(\\d+)/i);
    return m ? parseInt(m[1], 10) - 1 : 0;
  }

  function syncFromScroll() {
    if (!isPdf() || !frames.length || scrolling || zoomedFrame) return;
    var y = window.scrollY || window.pageYOffset || 0;
    var viewH = window.innerHeight || 1;
    var mid = y + viewH * 0.4;
    var best = 0;
    var bestDist = Infinity;
    for (var n = 0; n < frames.length; n++) {
      var top = frames[n].offsetTop;
      var dist = Math.abs(top - mid);
      if (dist < bestDist) { bestDist = dist; best = n; }
    }
    if (best !== i) setChrome(best, true);
  }

  function onModeChange() {
    if (isPdf()) {
      captureBaseScale();
      revealAllPdfPages();
      setChrome(Math.max(0, Math.min(frames.length - 1, i)), false);
      syncPinchZoomClass();
    } else {
      clearSlideZoom();
      document.documentElement.classList.remove('is-pdf-zoomed');
      frames.forEach(function (frame) {
        frame.classList.remove('is-pdf-can-scroll', 'is-pdf-slide-zoom');
      });
      showDeck(i);
    }
  }

  document.addEventListener('keydown', function (e) {
    if (isPdf()) {
      if (e.key === 'Escape' && zoomedFrame) {
        e.preventDefault();
        clearSlideZoom();
      }
      return;
    }
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      show(i + 1, true);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      show(i - 1, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      show(0, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      show(frames.length - 1, true);
    }
  });

  // Sensitive one-finger pan while browsing (not while zoomed into a slide)
  window.addEventListener('touchstart', function (e) {
    if (!isPdf() || zoomedFrame || e.touches.length !== 1) {
      touchPan.active = false;
      return;
    }
    if (document.documentElement.classList.contains('is-pdf-zoomed')) {
      touchPan.active = false;
      return;
    }
    touchPan.active = true;
    touchPan.x = e.touches[0].clientX;
    touchPan.y = e.touches[0].clientY;
    touchPan.sx = window.scrollX || window.pageXOffset || 0;
    touchPan.sy = window.scrollY || window.pageYOffset || 0;
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    if (!touchPan.active || !isPdf() || zoomedFrame || e.touches.length !== 1) return;
    if (document.documentElement.classList.contains('is-pdf-zoomed')) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    var x = e.touches[0].clientX;
    var y = e.touches[0].clientY;
    var dx = touchPan.x - x;
    var dy = touchPan.y - y;
    // Amplify finger travel so up/down/left/right feels more sensitive
    var gain = 1.55;
    window.scrollTo(touchPan.sx + dx * gain, touchPan.sy + dy * gain);
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchend', function () { touchPan.active = false; }, { passive: true });
  window.addEventListener('touchcancel', function () { touchPan.active = false; }, { passive: true });

  document.addEventListener('click', function (e) {
    if (!isPdf()) {
      if (e.target.closest('button, a, input, select, textarea, [role="button"], [data-demo-cta]')) return;
      var x = e.clientX / window.innerWidth;
      if (x > 0.62) show(i + 1);
      else if (x < 0.38) show(i - 1);
      return;
    }
    if (e.target.closest('.client-deck-overlayHost')) return;

    // Dimmed backdrop / outside: exit selected zoom
    if (zoomedFrame) {
      var onZoomed = e.target.closest('.dpf-pitchDeck-frame.is-pdf-slide-zoom');
      if (!onZoomed) {
        clearSlideZoom();
        return;
      }
      // clicks inside zoomed slide (controls) stay; no-op
      return;
    }

    var frame = e.target.closest('.dpf-pitchDeck-frame');
    if (!frame || !canSlideScroll(frame)) return;

    // Selecting a tall slide zooms it; then inner scroll works
    var now = Date.now();
    var isDouble = (now - lastTap.t) < 320 &&
      Math.abs(e.clientX - lastTap.x) < 40 &&
      Math.abs(e.clientY - lastTap.y) < 40 &&
      lastTap.frame === frame;
    lastTap = { t: now, x: e.clientX, y: e.clientY, frame: frame };

    if (e.target.closest('button, a, input, select, textarea, [role="button"], [data-demo-cta]')) {
      // Still allow select-zoom via double-tap near controls; single tap keeps control behavior
      if (isDouble) openSlideZoom(frame);
      return;
    }
    openSlideZoom(frame);
  }, { passive: false });

  window.addEventListener('scroll', function () {
    if (!isPdf()) return;
    clearTimeout(scrollT);
    scrollT = setTimeout(syncFromScroll, 40);
  }, { passive: true });

  function onViewportChange() {
    syncPinchZoomClass();
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportChange, { passive: true });
    window.visualViewport.addEventListener('scroll', onViewportChange, { passive: true });
  }

  window.addEventListener('resize', function () {
    clearTimeout(window.__deckNavResizeT);
    window.__deckNavResizeT = setTimeout(function () {
      onModeChange();
      if (zoomedFrame) {
        document.documentElement.style.setProperty('--pdf-slide-zoom', String(slideZoomFactor()));
      }
    }, 140);
  }, { passive: true });

  var startIdx = fromHash();
  if (isPdf()) {
    captureBaseScale();
    revealAllPdfPages();
    setChrome(Math.max(0, startIdx), false);
    syncPinchZoomClass();
    if (startIdx > 0 && frames[startIdx]) {
      requestAnimationFrame(function () {
        jumpPdf(startIdx, false);
      });
    } else {
      requestAnimationFrame(markScrollableFrames);
    }
  } else {
    showDeck(startIdx);
  }
})();
`;

async function collectCss(page) {
  return page.evaluate(async () => {
    const chunks = [];
    for (const sheet of [...document.styleSheets]) {
      try {
        for (const rule of sheet.cssRules) chunks.push(rule.cssText);
      } catch {
        try {
          const res = await fetch(sheet.href);
          if (res.ok) chunks.push(await res.text());
        } catch {
          /* cross-origin or missing */
        }
      }
    }
    for (const tag of document.querySelectorAll('style')) {
      if (tag.textContent) chunks.push(tag.textContent);
    }
    return chunks.join('\n');
  });
}

async function inlineAssets(page, html, baseUrl) {
  const urls = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
  const unique = [...new Set(urls.filter((u) => !u.endsWith('.html')))];
  let out = html;
  for (const path of unique) {
    try {
      const res = await page.request.get(`${baseUrl}${path}`);
      if (!res.ok()) continue;
      const buf = await res.body();
      const ct = res.headers()['content-type'] || 'application/octet-stream';
      const b64 = buf.toString('base64');
      const dataUrl = `data:${ct};base64,${b64}`;
      out = out.split(`"${path}"`).join(`"${dataUrl}"`);
      out = out.split(`'${path}'`).join(`'${dataUrl}'`);
      out = out.split(`url(${path})`).join(`url(${dataUrl})`);
    } catch {
      /* skip missing assets */
    }
  }
  return out;
}

async function captureActiveFrame(page) {
  return page.evaluate(() => {
    const frame = document.querySelector('.dpf-pitchDeck-frame.is-on');
    if (!frame) return '';
    const clone = frame.cloneNode(true);
    clone.classList.remove('is-on');
    clone.setAttribute('aria-hidden', 'true');
    const liveCanvases = [...frame.querySelectorAll('canvas')];
    const cloneCanvases = [...clone.querySelectorAll('canvas')];
    liveCanvases.forEach((canvas, idx) => {
      const target = cloneCanvases[idx];
      if (!target) return;
      try {
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.alt = '';
        img.className = canvas.className;
        if (canvas.getAttribute('style')) img.setAttribute('style', canvas.getAttribute('style'));
        img.width = canvas.width;
        img.height = canvas.height;
        target.replaceWith(img);
      } catch {
        /* tainted canvas */
      }
    });
    return clone.outerHTML;
  });
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});

await page.route('**/api/**', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{}',
  }),
);

await page.goto(`${BASE}/v2-export/user?allAgents=1&slide=0`, {
  waitUntil: 'networkidle',
  timeout: 60_000,
});
await page.waitForSelector('.dpf-pitchDeck-frame.is-on [data-pitch-slide]', { timeout: 30_000 });
await page.addStyleTag({ content: HIDE_CHROME });
await page.evaluate(() => document.fonts.ready).catch(() => {});
await page.waitForTimeout(500);

const labels = await page.$$eval('[data-pitch-slide]', (els) =>
  els.map((el, i) => el.getAttribute('data-pitch-label') || `Slide ${i + 1}`),
);

if (!labels.length) {
  throw new Error('No pitch slides found. Is the v2 deck rendering?');
}

const frames = [];
for (let idx = 0; idx < labels.length; idx += 1) {
  if (idx > 0) {
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(
      (want) => {
        const on = document.querySelector('.dpf-pitchDeck-frame.is-on [data-pitch-slide]');
        const all = [...document.querySelectorAll('[data-pitch-slide]')];
        return on && all.indexOf(on) === want;
      },
      idx,
      { timeout: 12_000 },
    );
  }
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(350);

  // CRM / DMS Analysis open on a scanning takeover; skip to the result table
  // so the static deck shows the analysis slide, not the loading state.
  const hasScan = await page.$('.dpf-pitchDeck-frame.is-on .cad--scan .cad-scan');
  if (hasScan) {
    await hasScan.click({ force: true });
    await page.waitForSelector('.dpf-pitchDeck-frame.is-on .cad-result', {
      timeout: 8_000,
    });
    await page.waitForTimeout(250);
  }

  // How it works: collapse every step so the client deck is static (no open accordion).
  await page.evaluate(() => {
    const root = document.querySelector('.dpf-pitchDeck-frame.is-on');
    if (!root?.querySelector('.dpf-soHow-steps')) return;
    root.querySelectorAll('.dpf-soHow-step--active').forEach((el) => {
      el.classList.remove('dpf-soHow-step--active');
      el.setAttribute('aria-selected', 'false');
      el.setAttribute('aria-expanded', 'false');
      el.querySelectorAll('.dpf-soHow-stepBody, .dpf-soHow-stepChips').forEach((n) => n.remove());
    });
  });

  // DMS Analysis only: campaign types list (V1-style). Do not touch CRM Analysis.
  await page.evaluate(() => {
    const root = document.querySelector('.dpf-pitchDeck-frame.is-on');
    const label = root?.querySelector('[data-pitch-label]')?.getAttribute('data-pitch-label');
    if (label !== 'DMS Analysis') return;
    const cad = root.querySelector('.cad');
    if (!cad) return;
    cad.classList.add('cad--typesOnly');
    cad.classList.remove('cad--leadTiers', 'cad--scan');
    root.querySelector('.cad-scan')?.remove();
    root.querySelector('.cad-replay')?.remove();
    root.querySelector('.cad-stats')?.remove();
    root.querySelector('.cad-note')?.remove();
    root.querySelectorAll('.cad-tHead .cad-cNum, .cad-tRow .cad-cNum, .cad-tHead .cad-cSpan, .cad-tRow .cad-cSpan').forEach((n) => n.remove());
    // Keep header as a single "Campaign type" label
    const head = root.querySelector('.cad-tHead');
    if (head) {
      head.querySelectorAll('[role="columnheader"]').forEach((el, i) => {
        if (i > 0) el.remove();
      });
    }
  });

  // Vini Set-Up: show IMS as API (not Concierge) for the client deck.
  await page.evaluate(() => {
    const root = document.querySelector('.dpf-pitchDeck-frame.is-on');
    const label = root?.querySelector('[data-pitch-label]')?.getAttribute('data-pitch-label');
    if (label !== 'Vini Set-Up') return;
    root.querySelectorAll('.viniSetupPage-intCard.is-concierge').forEach((card) => {
      const name = card.querySelector('.viniSetupPage-intName')?.textContent || '';
      if (!/IMS/i.test(name)) return;
      card.classList.remove('is-concierge');
      card.classList.add('is-api');
      const mode = card.querySelector('.viniSetupPage-intMode');
      if (mode) mode.textContent = 'API';
    });
  });

  // Closing block: replace multi-recording player with one Google Vids link.
  await page.evaluate(() => {
    const root = document.querySelector('.dpf-pitchDeck-frame.is-on');
    const label = root?.querySelector('[data-pitch-label]')?.getAttribute('data-pitch-label');
    if (label !== 'Closing block') return;
    const lead = root.querySelector('.dpf-resources-lead');
    if (lead) {
      lead.textContent =
        'One call recording, plus integrations, case studies, compliance, and more — jump in during the conversation.';
    }
    const railLabel = root.querySelector('.dpf-resources-railBtn.is-on span:last-child');
    if (railLabel && /Call Recordings/i.test(railLabel.textContent || '')) {
      railLabel.textContent = 'Call recording';
    }
    const panel = root.querySelector('.dpf-resources-panel.is-on');
    if (!panel) return;
    const url =
      'https://docs.google.com/videos/d/14eas3hl8YXbKuHHkZYkXPr2MxjjtPr_4QyQl687cb7U/edit?scene=id.p#scene=id.p';
    panel.innerHTML = `
      <section class="dpf-viniDoV2 dpf-viniDoV2--singleLink" aria-labelledby="dpf-viniDo-heading">
        <div class="dpf-viniDoV2-inner">
          <h2 id="dpf-viniDo-heading" class="dpf-viniDoV2-title">Proof, not pitch</h2>
          <p class="dpf-viniDoV2-sub">Hear Vini on a real sales inbound call.</p>
          <a class="dpf-clientRecLink" href="${url}" target="_blank" rel="noopener noreferrer">
            <span class="dpf-clientRecLink-tag">Sales Inbound</span>
            <span class="dpf-clientRecLink-title">Vini Sales Recording</span>
            <span class="dpf-clientRecLink-meta">Google Vids · open to play</span>
            <span class="dpf-clientRecLink-cta">Open call recording →</span>
          </a>
        </div>
      </section>`;
  });

  // Skip Service Outbound Impact + Tech stack for the client deck.
  const labelNow = labels[idx];
  const frameHtml = await captureActiveFrame(page);
  if (
    labelNow === 'Impact' &&
    (frameHtml.includes('Service Outbound delivers') ||
      frameHtml.includes('Vini Service Outbound delivers'))
  ) {
    console.log(`skipped ${idx + 1}/${labels.length}: ${labelNow} (service)`);
    continue;
  }
  if (labelNow === 'Tech stack') {
    console.log(`skipped ${idx + 1}/${labels.length}: ${labelNow}`);
    continue;
  }

  const html = frameHtml;
  frames.push(html);
  console.log(`captured ${idx + 1}/${labels.length}: ${labels[idx]}`);
}

const css = await collectCss(page);

const firstOn = frames
  .map((html, idx) =>
    idx === 0
      ? html.replace('class="dpf-pitchDeck-frame"', 'class="dpf-pitchDeck-frame is-on"')
      : html,
  )
  .join('\n');

let body = `<div class="dpf-pitchDeck" aria-label="Client pitch deck">
  <div class="dpf-pitchDeck-stage" aria-live="polite">
${firstOn}
  </div>
  <div class="dpf-pitchDeck-nav" aria-hidden="true">
    <div class="dpf-pitchDeck-progress">
      <span class="dpf-pitchDeck-progressFill" style="width: 0%"></span>
    </div>
  </div>
  <div class="client-deck-hud" data-client-deck-hud>1 / ${frames.length}</div>
</div>
<script>${DECK_SCRIPT}</script>`;

body = await inlineAssets(page, body, BASE);
const cssInlined = await inlineAssets(page, css, BASE);
await browser.close();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${WIDTH}, initial-scale=1, viewport-fit=cover" id="client-deck-viewport" />
  <script>${DECK_VIEWPORT_BOOT}</script>
  <title>Vini client deck</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${HIDE_CHROME}\n${cssInlined}</style>
</head>
<body>
${body}
</body>
</html>`;

writeFileSync(OUT_PATH, html, 'utf8');
console.log(`\nWrote ${labels.length} slides → ${OUT_PATH}`);
console.log(labels.map((label, i) => `${i + 1}. ${label}`).join('\n'));

// Append Studio OS merchandising block after Pricing (client-deck-only).
{
  const withStudio = injectStudioOsIntoDeckHtml(html);
  writeFileSync(OUT_PATH, withStudio, 'utf8');
  const studioLabels = [...withStudio.matchAll(/data-pitch-label="([^"]+)"/g)].map((m) => m[1]);
  console.log(`\nInjected Studio OS → ${studioLabels.length} slides total`);
  console.log(studioLabels.map((label, i) => `${i + 1}. ${label}`).join('\n'));
}