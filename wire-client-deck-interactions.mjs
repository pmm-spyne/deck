/**
 * Wire interactive CTAs/modals into docs/client-deck/client-deck.html
 * by capturing overlays from the live v2 demo.
 *
 * Usage:
 *   node docs/client-deck/wire-client-deck-interactions.mjs
 *   EXPORT_BASE_URL=http://127.0.0.1:5174 node docs/client-deck/wire-client-deck-interactions.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK_PATH = join(__dirname, 'client-deck.html');
const BASE = process.env.EXPORT_BASE_URL || 'http://127.0.0.1:5174';
const WIDTH = 1920;
const HEIGHT = 1080;

const MODAL_CTAS = [
  'si_impact_table_open',
  'svi_impact_table_open',
  'cold_leads_calc_open',
  'service_customers_calc_open',
  'so_sample_chats_open',
  'svo_sample_chats_open',
  'so_product_demo_open',
  'so_why_outbound_open',
  'svo_why_outbound_open',
];

/** Client-deck-only: professional titles (does not change src/). */
const SAMPLE_CHAT_TITLE_RENAMES = {
  'The Slow Burn': 'Multi-day follow-up',
  'The 97-Day Ghost': 'Aged lead reactivation',
  'The Credit-Shy Lead': 'Credit-hesitant lead',
  'The Declined Repair Recall': 'Declined repair follow-up',
  'The Sunday Night Save': 'After-hours lead response',
  'The Trade-In Tease': 'Trade equity outreach',
  'The Recall Reminder': 'Safety recall follow-up',
  'The Overdue Oil Change': 'Overdue oil change',
};

const HIDE_CHROME = `
  .dpf-prodIndex,
  .dpf-secNav,
  .dpf-topbarReveal,
  .dpf-engagement,
  [data-demo-cta="modify_metrics"] {
    display: none !important;
  }
`;

function applyTitleRenamesToHtml(html) {
  let out = html;
  for (const [from, to] of Object.entries(SAMPLE_CHAT_TITLE_RENAMES)) {
    out = out.split(from).join(to);
  }
  return out;
}

/** Client-deck-only: drop the service-customers math tagline paragraph. */
function stripServiceCustomersCalcTagline(html) {
  return html.replace(
    /<p class="dpf-coldLeadsExplain-tagline">Cars sold per month, projected over 3 years of DMS history and shown as a range so it reads like an estimate, not a promise\. Recalls and overdue work live in that book\.<\/p>/g,
    '',
  );
}

async function gotoSlide(page, idx) {
  await page.goto(`${BASE}/v2-export/user?allAgents=1&slide=${idx}`, {
    waitUntil: 'networkidle',
    timeout: 60_000,
  });
  await page.waitForSelector('.dpf-pitchDeck-frame.is-on [data-pitch-slide]', {
    timeout: 30_000,
  });
  await page.addStyleTag({ content: HIDE_CHROME });
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(300);

  const scan = await page.$('.dpf-pitchDeck-frame.is-on .cad--scan .cad-scan');
  if (scan) {
    await scan.click({ force: true });
    await page.waitForSelector('.dpf-pitchDeck-frame.is-on .cad-result', {
      timeout: 8_000,
    }).catch(() => {});
    await page.waitForTimeout(200);
  }
}

async function renameSampleChatTitlesInDom(page) {
  await page.evaluate((renames) => {
    document.querySelectorAll('.dpf-soChat-listItemTitle').forEach((el) => {
      const next = renames[el.textContent.trim()];
      if (next) el.textContent = next;
    });
  }, SAMPLE_CHAT_TITLE_RENAMES);
}

async function captureOpenOverlay(page, preferredSelector = null) {
  return page.evaluate((preferred) => {
    const pick =
      (preferred && document.querySelector(preferred)) ||
      document.querySelector('.dpf-soChatModal-backdrop') ||
      document.querySelector('.dpf-calcModal-backdrop') ||
      document.querySelector('.dpf-storyModal-backdrop') ||
      document.querySelector('.dpf-soBuilderModal-backdrop') ||
      document.querySelector('.dpf-soChat-backdrop') ||
      document.querySelector('.dpf-soBenefits-backdrop') ||
      document.querySelector('[role="dialog"]')?.closest('[class*="backdrop"]') ||
      document.querySelector('[aria-modal="true"]')?.closest('[class*="backdrop"], [class*="Backdrop"]') ||
      document.querySelector('[aria-modal="true"]');
    if (!pick) return null;
    // Reject wrong modals (e.g. tech-stack form accidentally open)
    if (
      preferred?.includes('soChat') &&
      !pick.classList.contains('dpf-soChatModal-backdrop') &&
      !pick.querySelector?.('.dpf-soChat')
    ) {
      return null;
    }
    const clone = pick.cloneNode(true);
    clone.querySelectorAll('[href^="javascript:"]').forEach((a) => a.removeAttribute('href'));
    return clone.outerHTML;
  }, preferredSelector);
}

async function captureSampleChatOverlay(page, cta) {
  await page.waitForSelector('.dpf-soChatModal-backdrop .dpf-soChat-listItem', {
    timeout: 8_000,
  });
  await renameSampleChatTitlesInDom(page);
  await page.waitForTimeout(150);

  const chatPreviews = {};
  const tabs = await page.$$('.dpf-soChatModal-backdrop .dpf-soChat-listItem');
  for (const tab of tabs) {
    const key = await tab.getAttribute('data-demo-cta');
    await tab.click({ force: true });
    await page.waitForTimeout(200);
    await renameSampleChatTitlesInDom(page);
    const previewHtml = await page.$eval(
      '.dpf-soChatModal-backdrop .dpf-soChat-previewCol',
      (el) => el.outerHTML,
    );
    if (key) chatPreviews[key] = applyTitleRenamesToHtml(previewHtml);
  }

  // Leave first tab selected for the shell capture
  if (tabs[0]) {
    await tabs[0].click({ force: true });
    await page.waitForTimeout(150);
    await renameSampleChatTitlesInDom(page);
  }

  const html = await captureOpenOverlay(page, '.dpf-soChatModal-backdrop');
  if (!html || !html.includes('dpf-soChat')) {
    console.warn(`sample chat overlay invalid for ${cta}`);
    return { html: null, chatPreviews: {} };
  }
  return {
    html: applyTitleRenamesToHtml(html),
    chatPreviews,
  };
}

async function closeOverlay(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const close = await page.$(
    '.dpf-soChatModal-close, .dpf-calcModal-close, .dpf-fuStoryModal-close, .dpf-soChat-close, [aria-label*="Close" i]',
  );
  if (close) {
    await close.click({ force: true }).catch(() => {});
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => {
    document
      .querySelectorAll(
        '.dpf-calcModal-backdrop, .dpf-storyModal-backdrop, .dpf-soChatModal-backdrop, .dpf-soChat-backdrop, .dpf-soBenefits-backdrop, .ts-stackModal-panel',
      )
      .forEach((n) => n.remove());
  });
}

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

await gotoSlide(page, 0);
const labels = await page.$$eval('[data-pitch-slide]', (els) =>
  els.map((el, i) => el.getAttribute('data-pitch-label') || `Slide ${i + 1}`),
);

const overlays = {};
const chatPreviews = {};
const partnerPanels = {};

for (let idx = 0; idx < labels.length; idx += 1) {
  await gotoSlide(page, idx);

  for (const cta of MODAL_CTAS) {
    if (overlays[cta]) continue;
    const btn = await page.$(`[data-demo-cta="${cta}"]`);
    if (!btn) continue;
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) continue;

    await btn.click({ force: true });
    await page.waitForTimeout(500);

    if (cta === 'so_sample_chats_open' || cta === 'svo_sample_chats_open') {
      const captured = await captureSampleChatOverlay(page, cta);
      if (captured.html) {
        overlays[cta] = captured.html;
        Object.assign(chatPreviews, captured.chatPreviews);
        console.log(
          `captured overlay: ${cta} (+${Object.keys(captured.chatPreviews).length} chat tabs) (slide ${idx + 1}: ${labels[idx]})`,
        );
      } else {
        console.warn(`no sample-chat overlay for ${cta} on slide ${idx + 1}`);
      }
    } else {
      const preferred =
        cta.includes('impact_table') || cta.includes('calc')
          ? '.dpf-calcModal-backdrop'
          : cta.includes('why_outbound')
            ? '.dpf-soBenefits-backdrop, .dpf-storyModal-backdrop'
            : null;
      let html = await captureOpenOverlay(page, preferred);
      if (html && !html.includes('ts-stackModal')) {
        if (cta === 'service_customers_calc_open') {
          html = stripServiceCustomersCalcTagline(html);
        }
        overlays[cta] = html;
        console.log(`captured overlay: ${cta} (from slide ${idx + 1}: ${labels[idx]})`);
      } else {
        console.warn(`no overlay for ${cta} on slide ${idx + 1}`);
      }
    }
    await closeOverlay(page);
  }

  if (labels[idx] === 'Closing block') {
    const casesBtn = await page.$('.dpf-resources-railBtn:has-text("Case Studies")');
    if (casesBtn) {
      await casesBtn.click({ force: true });
      await page.waitForTimeout(300);
    }
    const tabs = await page.$$('.dpf-pPartner-tab');
    for (const tab of tabs) {
      const key = await tab.getAttribute('data-demo-cta');
      if (!key) continue;
      await tab.click({ force: true });
      await page.waitForTimeout(250);
      const panelHtml = await page.$eval('#dpf-pPartner-panel', (el) => el.outerHTML);
      partnerPanels[key] = panelHtml;
      console.log(`captured partner panel: ${key}`);
    }
  }
}

await browser.close();

console.log(`\nOverlays: ${Object.keys(overlays).length}`);
console.log(`Chat previews: ${Object.keys(chatPreviews).length}`);
console.log(`Partner panels: ${Object.keys(partnerPanels).length}`);

let deck = readFileSync(DECK_PATH, 'utf8');

deck = deck.replace(
  /<!-- CLIENT_DECK_INTERACTIVITY_START -->[\s\S]*?<!-- CLIENT_DECK_INTERACTIVITY_END -->\n?/g,
  '',
);

const INTERACTIVITY_CSS = `
.client-deck-overlayHost[hidden] { display: none !important; }
.client-deck-overlayHost {
  position: fixed;
  inset: 0;
  z-index: 9999;
}
.client-deck-overlayHost .dpf-calcModal-backdrop,
.client-deck-overlayHost .dpf-storyModal-backdrop,
.client-deck-overlayHost .dpf-soChatModal-backdrop,
.client-deck-overlayHost .dpf-soChat-backdrop,
.client-deck-overlayHost .dpf-soBenefits-backdrop,
.client-deck-overlayHost > [class*="backdrop"] {
  position: fixed;
  inset: 0;
  z-index: 9999;
}
[data-demo-cta] { cursor: pointer; }
.dpf-resources-railBtn { cursor: pointer; }
.dpf-pPartner-tab { cursor: pointer; }
.dpf-soChat-listItem { cursor: pointer; }
.dpf-soSeam-carsInput {
  cursor: text !important;
  caret-color: #fff;
  width: 4.8ch;
  max-width: 6.5ch;
}
.dpf-soSeam-carsInput:focus {
  outline: none;
}

`;

const payload = {
  overlays,
  chatPreviews,
  partnerPanels,
};

const INTERACTIVITY_JS = `
(function () {
  var dataEl = document.getElementById('client-deck-interaction-data');
  var DATA = dataEl ? JSON.parse(dataEl.textContent) : { overlays: {}, chatPreviews: {}, partnerPanels: {} };
  window.__deckInteractionData = DATA;
  var host = document.querySelector('[data-client-deck-overlay-host]');
  if (!host) return;

  function stopDeckNav(e) {
    e.stopPropagation();
  }

  function wireSampleChatTabs(root) {
    var list = root.querySelector('.dpf-soChat-list');
    if (!list) return;
    var items = Array.prototype.slice.call(list.querySelectorAll('.dpf-soChat-listItem'));
    items.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var key = btn.getAttribute('data-demo-cta');
        var previewHtml = key && DATA.chatPreviews[key];
        items.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('dpf-soChat-listItem--active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        if (!previewHtml) return;
        var col = root.querySelector('.dpf-soChat-previewCol');
        if (!col) return;
        var wrap = document.createElement('div');
        wrap.innerHTML = previewHtml;
        var next = wrap.firstElementChild;
        if (next) col.replaceWith(next);
      });
    });
  }

  function openOverlay(cta) {
    var html = DATA.overlays[cta];
    if (!html) return false;
    host.innerHTML = html;
    host.hidden = false;
    host.addEventListener('click', stopDeckNav);
    var root = host.firstElementChild;
    if (!root) return true;
    if (window.__deckRefreshMetricOverlay && /cold_leads_calc_open|service_customers_calc_open/.test(cta)) {
      try { window.__deckRefreshMetricOverlay(root); } catch (err) {}
      requestAnimationFrame(function () {
        try { window.__deckRefreshMetricOverlay(root); } catch (err2) {}
      });
    }
    root.addEventListener('click', function (e) {
      if (e.target === root) closeOverlay();
    });
    host.querySelectorAll(
      '.dpf-calcModal-close, .dpf-fuStoryModal-close, .dpf-soChatModal-close, .dpf-soChat-close, [aria-label*="Close" i], [aria-label*="close" i]'
    ).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeOverlay();
      });
    });
    host.querySelectorAll('[role="dialog"], .dpf-calcModal, .dpf-fuStoryModal, .dpf-soChatModal, .dpf-soChat, .dpf-soBenefits').forEach(function (dlg) {
      dlg.addEventListener('click', function (e) { e.stopPropagation(); });
    });
    if (cta.indexOf('sample_chats') !== -1) wireSampleChatTabs(host);
    return true;
  }

  function closeOverlay() {
    host.hidden = true;
    host.innerHTML = '';
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !host.hidden) {
      e.preventDefault();
      e.stopPropagation();
      closeOverlay();
    }
  }, true);

  document.querySelectorAll('.dpf-resources').forEach(function (section) {
    var buttons = Array.prototype.slice.call(section.querySelectorAll('.dpf-resources-railBtn'));
    var panels = Array.prototype.slice.call(section.querySelectorAll('.dpf-resources-panel'));
    if (!buttons.length || buttons.length !== panels.length) return;
    buttons.forEach(function (btn, i) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        buttons.forEach(function (b, j) {
          b.classList.toggle('is-on', j === i);
          b.setAttribute('aria-selected', j === i ? 'true' : 'false');
        });
        panels.forEach(function (p, j) {
          p.classList.toggle('is-on', j === i);
        });
      });
    });
  });

  document.querySelectorAll('.dpf-pPartner-tabs').forEach(function (tabs) {
    var buttons = Array.prototype.slice.call(tabs.querySelectorAll('.dpf-pPartner-tab'));
    var panel = tabs.parentElement && tabs.parentElement.querySelector('#dpf-pPartner-panel');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var key = btn.getAttribute('data-demo-cta');
        var html = key && DATA.partnerPanels[key];
        buttons.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('dpf-pPartner-tab--active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        if (html && panel) {
          var wrap = document.createElement('div');
          wrap.innerHTML = html;
          var next = wrap.firstElementChild;
          if (next) panel.replaceWith(next);
          panel = tabs.parentElement.querySelector('#dpf-pPartner-panel');
          if (panel && btn.id) panel.setAttribute('aria-labelledby', btn.id);
        }
      });
    });
  });

  function formatCars(n) {
    return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  }

  function parseCars(text) {
    var n = parseInt(String(text || '').replace(/[^0-9]/g, ''), 10);
    if (!isFinite(n) || n < 1) return null;
    if (n > 99999) n = 99999;
    return n;
  }

  function mountCarsInput(fromEl) {
    if (!fromEl || fromEl.getAttribute('data-cars-mounted') === '1') return fromEl;
    var sourceText = fromEl.tagName === 'INPUT' ? fromEl.value : fromEl.textContent;
    var current = parseCars(sourceText) || 200;
    var input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.pattern = '[0-9]*';
    input.className = 'dpf-soSeam-carsInput';
    input.value = String(current);
    input.setAttribute('data-cars-mounted', '1');
    input.setAttribute('data-demo-cta', 'cars_seam_edit_open');
    input.setAttribute('aria-label', fromEl.getAttribute('aria-label') || 'Edit cars sold per month');
    input.setAttribute('title', 'Type a number — saved until you refresh');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');

    function commit() {
      var next = parseCars(input.value);
      if (next == null) next = current;
      current = next;
      input.value = formatCars(next);
    }

    ['pointerdown', 'mousedown', 'click', 'mouseup', 'touchstart'].forEach(function (type) {
      input.addEventListener(type, function (ev) { ev.stopPropagation(); }, true);
    });
    input.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commit();
        input.blur();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        input.value = formatCars(current);
        input.blur();
      }
    });
    input.addEventListener('focus', function () {
      var raw = parseCars(input.value);
      input.value = raw != null ? String(raw) : '';
      setTimeout(function () { try { input.select(); } catch (err) {} }, 0);
    });
    input.addEventListener('blur', commit);
    input.addEventListener('input', function () {
      var caret = input.selectionStart;
      var before = input.value;
      var cleaned = before.replace(/[^0-9]/g, '').slice(0, 5);
      if (cleaned !== before) {
        input.value = cleaned;
        var delta = before.length - cleaned.length;
        try { input.setSelectionRange(Math.max(0, caret - delta), Math.max(0, caret - delta)); } catch (err) {}
      }
    });

    if (fromEl.parentElement) fromEl.replaceWith(input);
    return input;
  }

  function startCarsSeamEdit(btn) {
    var input = mountCarsInput(btn);
    if (input && input.focus) {
      input.focus();
      try { input.select(); } catch (err) {}
    }
  }

  document.querySelectorAll('.dpf-soSeam-carsValue, input.dpf-soSeam-carsInput').forEach(function (el) {
    mountCarsInput(el);
  });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-demo-cta]');
    if (!el) return;
    var cta = el.getAttribute('data-demo-cta');
    if (!cta) return;
    if (cta.indexOf('Case Studies:') === 0) return;
    if (cta.indexOf('Customer Demo:') === 0) return;
    if (cta.indexOf('_sample_chat_') !== -1) return;
    if (cta === 'modify_metrics') return;
    if (cta === 'cars_seam_edit_open') {
      e.preventDefault();
      e.stopPropagation();
      if (el.tagName === 'INPUT') {
        el.focus();
        try { el.select(); } catch (err) {}
      } else {
        startCarsSeamEdit(el.closest('.dpf-soSeam-carsValue') || el);
      }
      return;
    }
    if (DATA.overlays[cta]) {
      e.preventDefault();
      e.stopPropagation();
      openOverlay(cta);
    }
  }, true);

  document.querySelectorAll('[data-demo-cta$="_open"]').forEach(function (el) {
    el.style.cursor = 'pointer';
    if (!el.getAttribute('title') && /impact_table_open|calc_open|why_outbound|sample_chats|product_demo|cars_seam/.test(el.getAttribute('data-demo-cta') || '')) {
      el.setAttribute('title', 'Click to open');
    }
  });
})();
`;

const injection = `<!-- CLIENT_DECK_INTERACTIVITY_START -->
<style>${INTERACTIVITY_CSS}</style>
<div class="client-deck-overlayHost" data-client-deck-overlay-host hidden></div>
<script type="application/json" id="client-deck-interaction-data">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>
<script>${INTERACTIVITY_JS}</script>
<!-- CLIENT_DECK_INTERACTIVITY_END -->
`;

if (deck.includes('</body>')) {
  deck = deck.replace('</body>', `${injection}</body>`);
} else {
  deck += injection;
}

writeFileSync(DECK_PATH, deck, 'utf8');
console.log(`\nUpdated ${DECK_PATH}`);
console.log('Wired overlays:', Object.keys(overlays).join(', ') || '(none)');
console.log('Title renames:', Object.entries(SAMPLE_CHAT_TITLE_RENAMES).map(([a, b]) => `${a} → ${b}`).join('; '));
