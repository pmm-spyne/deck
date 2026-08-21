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

  function deckFormatLeadCount(n) {
    var r = Math.round(Number(n) || 0);
    if (!isFinite(r)) return '—';
    return r.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  function deckFloorToNiceZeros(n) {
    var r = Math.max(0, Math.round(Number(n) || 0));
    if (!isFinite(r) || r === 0) return 0;
    var step = r >= 1000 ? 1000 : r >= 100 ? 100 : r >= 10 ? 10 : 1;
    return Math.floor(r / step) * step;
  }
  function deckFormatPlusFloorCount(n) {
    var r = Math.max(0, Math.round(Number(n) || 0));
    var floored = deckFloorToNiceZeros(n);
    if (floored === 0) return '0';
    var compact = floored >= 1000 && floored % 1000 === 0
      ? (floored / 1000) + 'K'
      : floored.toLocaleString('en-US', { maximumFractionDigits: 0 });
    return r === floored ? ('+' + compact) : (compact + '+');
  }
  function deckRangeFromMid(mid) {
    var m = Math.max(0, Math.round(Number(mid) || 0));
    var delta = m > 0 ? Math.max(50, Math.round(m / 6 / 50) * 50) : 0;
    var lo = Math.max(0, m - delta);
    return { mid: m, lo: lo, hi: m + delta, delta: delta, shown: deckFloorToNiceZeros(lo), plusLabel: deckFormatPlusFloorCount(lo) };
  }
  function deckReadCars() {
    var best = 200;
    try {
      var stored = parseInt(sessionStorage.getItem('deckCarsSeam') || '', 10);
      if (stored > 0) best = stored;
    } catch (e) {}
    document.querySelectorAll('.dpf-soSeam-carsInput, .dpf-pricing-carsInput, .dpf-soSeam-carsValue').forEach(function (el) {
      var raw = el.tagName === 'INPUT' ? el.value : el.textContent;
      var n = parseInt(String(raw || '').replace(/[^0-9]/g, ''), 10) || 0;
      if (n > 0) best = n;
      if (document.activeElement === el && n > 0) best = n;
    });
    return Math.max(1, Math.min(50000, best));
  }
  function deckDeriveCarsMath(cars) {
    cars = Math.max(1, Math.min(50000, Math.round(Number(cars) || 200)));
    var leadsPerCar = 10;
    var monthlyLeads = cars * leadsPerCar;
    return {
      cars: cars,
      leadsPerCar: leadsPerCar,
      monthlyLeads: monthlyLeads,
      sales: deckRangeFromMid(monthlyLeads * 36),
      service: deckRangeFromMid(cars * 36)
    };
  }
  /** Mirrors DemoPlatformFunnelPage seamExplainOpen modal */
  function deckBuildSeamExplainHtml(isService, cars) {
    var d = deckDeriveCarsMath(cars);
    var range = isService ? d.service : d.sales;
    var carsN = d.cars;
    var monthlyBase = isService ? carsN : d.monthlyLeads;
    var title = isService
      ? 'How we estimated service customers in your CRM'
      : 'How we estimated cold leads in your CRM';
    var tagline = isService
      ? 'Cars sold per month, projected over 3 years of DMS history and shown as a range so it reads like an estimate, not a promise. Recalls and overdue work live in that book.'
      : 'Monthly leads, projected over 3 years of CRM history and shown as a range so it reads like an estimate, not a promise.';
    var inputs = '<dl class="dpf-coldLeadsExplain-inputs"><div class="dpf-coldLeadsExplain-inputRow"><dt>Cars sold / month</dt><dd>'
      + deckFormatLeadCount(carsN) + '</dd></div>';
    if (!isService) {
      inputs += '<div class="dpf-coldLeadsExplain-inputRow"><dt>Leads per car</dt><dd>'
        + deckFormatLeadCount(d.leadsPerCar) + '</dd></div>';
    }
    inputs += '</dl>';
    var hint = isService
      ? '<p class="dpf-coldLeadsExplain-inputHint"><strong>Cars sold / month</strong>: used as a proxy for customers who stay in your DMS and can be reached for recalls and overdue service.</p>'
      : '<p class="dpf-coldLeadsExplain-inputHint"><strong>Leads per car</strong>: inbound leads (calls, chats, form fills) per car sold, used as a proxy for total lead volume.</p>';
    var step1 = isService
      ? ('<p class="dpf-coldLeadsExplain-stepVal"><span class="dpf-coldLeadsExplain-stepHl">'
        + deckFormatLeadCount(carsN) + ' cars/mo</span></p>')
      : ('<p class="dpf-coldLeadsExplain-stepVal">' + deckFormatLeadCount(carsN) + ' × '
        + deckFormatLeadCount(d.leadsPerCar) + ' = <span class="dpf-coldLeadsExplain-stepHl">'
        + deckFormatLeadCount(d.monthlyLeads) + ' leads/mo</span></p>');
    var unit = isService ? 'customers' : 'leads';
    var resultSpan = isService
      ? 'service customers sitting in your CRM'
      : 'cold leads sitting in your CRM';
    return (
      '<div class="dpf-calcModal-backdrop dpf-coldLeadsExplain-backdrop" role="presentation">'
      + '<div class="dpf-calcModal dpf-coldLeadsExplain-modal" role="dialog" aria-modal="true" aria-labelledby="dpf-coldLeadsExplain-title">'
      + '<button type="button" class="dpf-coldLeadsExplain-close" aria-label="Close calculation">×</button>'
      + '<p class="dpf-coldLeadsExplain-eyebrow">The math</p>'
      + '<h3 id="dpf-coldLeadsExplain-title" class="dpf-coldLeadsExplain-title">' + title + '</h3>'
      + '<p class="dpf-coldLeadsExplain-tagline">' + tagline + '</p>'
      + inputs + hint
      + '<div class="dpf-coldLeadsExplain-steps" role="list">'
      + '<div class="dpf-coldLeadsExplain-step" role="listitem"><span class="dpf-coldLeadsExplain-stepNum">01</span><div class="dpf-coldLeadsExplain-stepBody"><p class="dpf-coldLeadsExplain-stepLabel">'
      + (isService ? 'Monthly cars sold' : 'Monthly leads') + '</p>' + step1 + '</div></div>'
      + '<div class="dpf-coldLeadsExplain-step" role="listitem"><span class="dpf-coldLeadsExplain-stepNum">02</span><div class="dpf-coldLeadsExplain-stepBody"><p class="dpf-coldLeadsExplain-stepLabel">3-year midpoint</p><p class="dpf-coldLeadsExplain-stepVal">'
      + deckFormatLeadCount(monthlyBase) + ' × 36 months = <span class="dpf-coldLeadsExplain-stepHl">'
      + deckFormatLeadCount(range.mid) + ' ' + unit + '</span></p></div></div>'
      + '<div class="dpf-coldLeadsExplain-step" role="listitem"><span class="dpf-coldLeadsExplain-stepNum">03</span><div class="dpf-coldLeadsExplain-stepBody"><p class="dpf-coldLeadsExplain-stepLabel">Range spread</p><p class="dpf-coldLeadsExplain-stepVal">Applied <span class="dpf-coldLeadsExplain-stepHl">±'
      + deckFormatLeadCount(range.delta) + '</span> (about a sixth of the midpoint, rounded)</p></div></div>'
      + '</div>'
      + '<div class="dpf-coldLeadsExplain-result"><p class="dpf-coldLeadsExplain-resultLabel">Shown on the seam</p>'
      + '<p class="dpf-coldLeadsExplain-resultVal">' + range.plusLabel + ' <span>' + resultSpan + '</span></p></div>'
      + '</div></div>'
    );
  }
  function deckUpdateSeamHighlights(cars) {
    var d = deckDeriveCarsMath(cars);
    document.querySelectorAll('.dpf-soSeam').forEach(function (seam) {
      if (!seam.querySelector('.dpf-soSeam-carsInput, .dpf-soSeam-carsValue, .dpf-soSeam-carsTxt')) return;
      var hi = seam.querySelector('.dpf-soSeam-highlight');
      if (!hi) return;
      var isService = !!seam.querySelector('[data-demo-cta="service_customers_calc_open"]');
      hi.textContent = isService
        ? (d.service.plusLabel + ' service customers')
        : (d.sales.plusLabel + ' cold leads');
    });
    // Keep both seam inputs + pricing in sync
    document.querySelectorAll('.dpf-soSeam-carsInput, .dpf-pricing-carsInput').forEach(function (inp) {
      if (document.activeElement === inp) return;
      inp.value = String(d.cars);
    });
    document.querySelectorAll('.dpf-soSeam-carsValue').forEach(function (el) {
      el.textContent = String(d.cars);
    });
    try { sessionStorage.setItem('deckCarsSeam', String(d.cars)); } catch (e) {}
    // Live-refresh open math modal
    var hostEl = document.querySelector('[data-client-deck-overlay-host], .client-deck-overlayHost');
    if (hostEl && !hostEl.hidden && hostEl.querySelector('.dpf-coldLeadsExplain-modal')) {
      var title = (hostEl.querySelector('.dpf-coldLeadsExplain-title') || {}).textContent || '';
      var isService = /service customers/i.test(title);
      var html = deckBuildSeamExplainHtml(isService, d.cars);
      hostEl.innerHTML = html;
      // re-bind close on new nodes happens via openOverlay listeners only once —
      // re-bind simply here:
      var root = hostEl.firstElementChild;
      if (root) {
        root.addEventListener('click', function (ev) {
          if (ev.target === root) {
            hostEl.hidden = true;
            hostEl.innerHTML = '';
          }
        });
        hostEl.querySelectorAll('.dpf-coldLeadsExplain-close, [aria-label*="Close" i]').forEach(function (btn) {
          btn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            hostEl.hidden = true;
            hostEl.innerHTML = '';
          });
        });
      }
    }
    if (window.__deckApplyCarsSeam) {
      try { window.__deckApplyCarsSeam(d.cars); } catch (e) {}
    }
    return d;
  }
  window.__deckBuildMetricOverlay = function (cta) {
    var cars = deckReadCars();
    if (cta === 'cold_leads_calc_open') return deckBuildSeamExplainHtml(false, cars);
    if (cta === 'service_customers_calc_open') return deckBuildSeamExplainHtml(true, cars);
    return null;
  };
  window.__deckSeamApplyCars = deckUpdateSeamHighlights;

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
    if (window.__deckInlineApplyCars) {
      try { window.__deckInlineApplyCars(); } catch (e0) {}
    }
    var html = null;
    if (window.__deckBuildMetricOverlay) {
      try { html = window.__deckBuildMetricOverlay(cta); } catch (err) { html = null; }
    }
    if (!html) html = DATA.overlays[cta];
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
      if (window.__deckSeamApplyCars) {
        try { window.__deckSeamApplyCars(current); } catch (err) {}
      } else if (window.__deckInlineApplyCars) {
        try { window.__deckInlineApplyCars(current); } catch (err) {}
      } else if (window.__deckApplyCarsSeam) {
        try { window.__deckApplyCarsSeam(current); } catch (err) {}
      }
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
      var live = parseCars(input.value);
      if (live != null) {
        if (window.__deckSeamApplyCars) {
          try { window.__deckSeamApplyCars(live); } catch (err) {}
        } else if (window.__deckInlineApplyCars) {
          try { window.__deckInlineApplyCars(live); } catch (err) {}
        } else if (window.__deckApplyCarsSeam) {
          try { window.__deckApplyCarsSeam(live); } catch (err) {}
        }
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

  // —— Live cars math (seam highlight + info modal), self-contained fallback ——
  (function wireInlineCarsMath() {
    var LEADS_PER_CAR = 10;

    function formatLeadCount(n) {
      var r = Math.round(Number(n) || 0);
      if (!isFinite(r)) return '—';
      return r.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    function floorToNiceZeros(n) {
      var r = Math.max(0, Math.round(Number(n) || 0));
      if (!isFinite(r) || r === 0) return 0;
      var step = r >= 1000 ? 1000 : r >= 100 ? 100 : r >= 10 ? 10 : 1;
      return Math.floor(r / step) * step;
    }
    function formatPlusFloorCount(n) {
      var r = Math.max(0, Math.round(Number(n) || 0));
      var floored = floorToNiceZeros(n);
      if (floored === 0) return '0';
      var compact = floored >= 1000 && floored % 1000 === 0
        ? (floored / 1000) + 'K'
        : floored.toLocaleString('en-US', { maximumFractionDigits: 0 });
      return r === floored ? ('+' + compact) : (compact + '+');
    }
    function rangeFromMid(mid) {
      var m = Math.max(0, Math.round(Number(mid) || 0));
      var delta = m > 0 ? Math.max(50, Math.round(m / 6 / 50) * 50) : 0;
      var lo = Math.max(0, m - delta);
      return { mid: m, lo: lo, delta: delta, shown: floorToNiceZeros(lo), plusLabel: formatPlusFloorCount(lo) };
    }
    function readCars() {
      var best = 200;
      try {
        var stored = parseInt(sessionStorage.getItem('deckCarsSeam') || '', 10);
        if (stored > 0) best = stored;
      } catch (e) {}
      document.querySelectorAll('.dpf-soSeam-carsInput, .dpf-pricing-carsInput, .dpf-soSeam-carsValue').forEach(function (el) {
        var raw = el.tagName === 'INPUT' ? el.value : el.textContent;
        var n = parseInt(String(raw || '').replace(/[^0-9]/g, ''), 10) || 0;
        if (n > 0) best = n;
      });
      return Math.max(1, Math.min(50000, best));
    }
    function derive(cars) {
      cars = Math.max(1, Math.min(50000, Math.round(Number(cars) || 200)));
      var sales = rangeFromMid(cars * LEADS_PER_CAR * 36);
      var service = rangeFromMid(cars * 36);
      return { cars: cars, leadsPerCar: LEADS_PER_CAR, monthlyLeads: cars * LEADS_PER_CAR, sales: sales, service: service };
    }
    function updateHighlights(d) {
      document.querySelectorAll('.dpf-soSeam').forEach(function (seam) {
        if (!seam.querySelector('.dpf-soSeam-carsInput, .dpf-soSeam-carsValue, .dpf-soSeam-carsTxt')) return;
        var hi = seam.querySelector('.dpf-soSeam-highlight');
        if (!hi) return;
        var isService = !!seam.querySelector('[data-demo-cta="service_customers_calc_open"]');
        hi.textContent = isService
          ? (d.service.plusLabel + ' service customers')
          : (d.sales.plusLabel + ' cold leads');
      });
    }
    function buildOverlay(isService, cars) {
      var d = derive(cars);
      var range = isService ? d.service : d.sales;
      var carsN = d.cars;
      var monthly = isService ? carsN : d.monthlyLeads;
      var title = isService
        ? 'How we estimated service customers in your CRM'
        : 'How we estimated cold leads in your CRM';
      var tagline = isService ? '' : '<p class="dpf-coldLeadsExplain-tagline">Monthly leads, projected over 3 years of CRM history and shown as a range so it reads like an estimate, not a promise.</p>';
      var inputs = isService
        ? ('<dl class="dpf-coldLeadsExplain-inputs"><div class="dpf-coldLeadsExplain-inputRow"><dt>Cars sold / month</dt><dd>' + formatLeadCount(carsN) + '</dd></div></dl><p class="dpf-coldLeadsExplain-inputHint"><strong>Cars sold / month</strong>: used as a proxy for customers who stay in your DMS and can be reached for recalls and overdue service.</p>')
        : ('<dl class="dpf-coldLeadsExplain-inputs"><div class="dpf-coldLeadsExplain-inputRow"><dt>Cars sold / month</dt><dd>' + formatLeadCount(carsN) + '</dd></div><div class="dpf-coldLeadsExplain-inputRow"><dt>Leads per car</dt><dd>' + d.leadsPerCar + '</dd></div></dl><p class="dpf-coldLeadsExplain-inputHint"><strong>Leads per car</strong>: inbound leads (calls, chats, form fills) per car sold, used as a proxy for total lead volume.</p>');
      var steps = isService
        ? ('<div class="dpf-coldLeadsExplain-steps" role="list"><div class="dpf-coldLeadsExplain-step" role="listitem"><span class="dpf-coldLeadsExplain-stepNum">01</span><div class="dpf-coldLeadsExplain-stepBody"><p class="dpf-coldLeadsExplain-stepLabel">Monthly cars sold</p><p class="dpf-coldLeadsExplain-stepVal"><span class="dpf-coldLeadsExplain-stepHl">' + formatLeadCount(carsN) + ' cars/mo</span></p></div></div><div class="dpf-coldLeadsExplain-step" role="listitem"><span class="dpf-coldLeadsExplain-stepNum">02</span><div class="dpf-coldLeadsExplain-stepBody"><p class="dpf-coldLeadsExplain-stepLabel">3-year midpoint</p><p class="dpf-coldLeadsExplain-stepVal">' + formatLeadCount(carsN) + ' × 36 months = <span class="dpf-coldLeadsExplain-stepHl">' + formatLeadCount(range.mid) + ' customers</span></p></div></div><div class="dpf-coldLeadsExplain-step" role="listitem"><span class="dpf-coldLeadsExplain-stepNum">03</span><div class="dpf-coldLeadsExplain-stepBody"><p class="dpf-coldLeadsExplain-stepLabel">Range spread</p><p class="dpf-coldLeadsExplain-stepVal">Applied <span class="dpf-coldLeadsExplain-stepHl">±' + formatLeadCount(range.delta) + '</span> (about a sixth of the midpoint, rounded)</p></div></div></div>')
        : ('<div class="dpf-coldLeadsExplain-steps" role="list"><div class="dpf-coldLeadsExplain-step" role="listitem"><span class="dpf-coldLeadsExplain-stepNum">01</span><div class="dpf-coldLeadsExplain-stepBody"><p class="dpf-coldLeadsExplain-stepLabel">Monthly leads</p><p class="dpf-coldLeadsExplain-stepVal">' + formatLeadCount(carsN) + ' × ' + d.leadsPerCar + ' = <span class="dpf-coldLeadsExplain-stepHl">' + formatLeadCount(monthly) + ' leads/mo</span></p></div></div><div class="dpf-coldLeadsExplain-step" role="listitem"><span class="dpf-coldLeadsExplain-stepNum">02</span><div class="dpf-coldLeadsExplain-stepBody"><p class="dpf-coldLeadsExplain-stepLabel">3-year midpoint</p><p class="dpf-coldLeadsExplain-stepVal">' + formatLeadCount(monthly) + ' × 36 months = <span class="dpf-coldLeadsExplain-stepHl">' + formatLeadCount(range.mid) + ' leads</span></p></div></div><div class="dpf-coldLeadsExplain-step" role="listitem"><span class="dpf-coldLeadsExplain-stepNum">03</span><div class="dpf-coldLeadsExplain-stepBody"><p class="dpf-coldLeadsExplain-stepLabel">Range spread</p><p class="dpf-coldLeadsExplain-stepVal">Applied <span class="dpf-coldLeadsExplain-stepHl">±' + formatLeadCount(range.delta) + '</span> (about a sixth of the midpoint, rounded)</p></div></div></div>');
      var suffix = isService ? 'service customers sitting in your CRM' : 'cold leads sitting in your CRM';
      return '<div class="dpf-calcModal-backdrop dpf-coldLeadsExplain-backdrop" role="presentation"><div class="dpf-calcModal dpf-coldLeadsExplain-modal" role="dialog" aria-modal="true" aria-labelledby="dpf-coldLeadsExplain-title"><button type="button" class="dpf-coldLeadsExplain-close" aria-label="Close calculation">×</button><p class="dpf-coldLeadsExplain-eyebrow">The math</p><h3 id="dpf-coldLeadsExplain-title" class="dpf-coldLeadsExplain-title">' + title + '</h3>' + tagline + inputs + steps + '<div class="dpf-coldLeadsExplain-result"><p class="dpf-coldLeadsExplain-resultLabel">Shown on the seam</p><p class="dpf-coldLeadsExplain-resultVal">' + range.plusLabel + ' <span>' + suffix + '</span></p></div></div></div>';
    }

    function applyInline(cars) {
      if (cars == null || cars === '' || !isFinite(Number(cars)) || Number(cars) <= 0) cars = readCars();
      var d = derive(cars);
      try { sessionStorage.setItem('deckCarsSeam', String(d.cars)); } catch (e) {}
      updateHighlights(d);
      // Prefer modules full sync when available
      if (window.__deckApplyCarsSeam) {
        try { window.__deckApplyCarsSeam(d.cars); } catch (e) {}
      }
      // Always keep overlay builder current (modules or fallback)
      window.__deckBuildMetricOverlay = function (cta) {
        if (cta === 'cold_leads_calc_open') return buildOverlay(false, readCars());
        if (cta === 'service_customers_calc_open') return buildOverlay(true, readCars());
        return null;
      };
      if (window.__deckInteractionData && window.__deckInteractionData.overlays) {
        window.__deckInteractionData.overlays.cold_leads_calc_open = buildOverlay(false, d.cars);
        window.__deckInteractionData.overlays.service_customers_calc_open = buildOverlay(true, d.cars);
      }
      return d;
    }

    window.__deckInlineApplyCars = applyInline;
    if (!window.__deckBuildMetricOverlay) {
      window.__deckBuildMetricOverlay = function (cta) {
        if (cta === 'cold_leads_calc_open') return buildOverlay(false, readCars());
        if (cta === 'service_customers_calc_open') return buildOverlay(true, readCars());
        return null;
      };
    }

    document.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !t.classList) return;
      if (!t.classList.contains('dpf-soSeam-carsInput') && !t.classList.contains('dpf-pricing-carsInput')) return;
      var n = parseInt(String(t.value || '').replace(/[^0-9]/g, ''), 10) || 0;
      if (n > 0) applyInline(n);
    }, true);

    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.classList) return;
      if (!t.classList.contains('dpf-soSeam-carsInput') && !t.classList.contains('dpf-pricing-carsInput')) return;
      applyInline(parseInt(String(t.value || '').replace(/[^0-9]/g, ''), 10) || 200);
    }, true);

    // Patch info-button opens even if modules load late
    var _open = window.open;
    setTimeout(function () { applyInline(readCars()); }, 0);
    setTimeout(function () { applyInline(readCars()); }, 300);
  })();


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
    if (cta === 'cold_leads_calc_open' || cta === 'service_customers_calc_open') {
      e.preventDefault();
      e.stopPropagation();
      // Always rebuild from live cars input (production DemoPlatformFunnelPage behavior)
      var carsNow = (typeof deckReadCars === 'function') ? deckReadCars() : 200;
      if (window.__deckSeamApplyCars) {
        try { window.__deckSeamApplyCars(carsNow); } catch (errA) {}
      }
      var liveHtml = window.__deckBuildMetricOverlay ? window.__deckBuildMetricOverlay(cta) : null;
      if (liveHtml) {
        host.innerHTML = liveHtml;
        host.hidden = false;
        var rootLive = host.firstElementChild;
        if (rootLive) {
          rootLive.addEventListener('click', function (ev) {
            if (ev.target === rootLive) {
              host.hidden = true;
              host.innerHTML = '';
            }
          });
          host.querySelectorAll('.dpf-coldLeadsExplain-close, [aria-label*="Close" i], [aria-label*="close" i]').forEach(function (btn) {
            btn.addEventListener('click', function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              host.hidden = true;
              host.innerHTML = '';
            });
          });
        }
        return;
      }
      openOverlay(cta);
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
