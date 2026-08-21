(function () {
"use strict";

  var PROPOSAL_AGENT_KEYS = ['salesInbound', 'salesOutbound', 'serviceInbound', 'serviceOutbound'];
  var PROPOSAL_AGENT_META = {
    salesInbound: { name: 'Sales Inbound AI', dept: 'Sales', channel: 'Inbound' },
    salesOutbound: { name: 'Sales Outbound AI', dept: 'Sales', channel: 'Outbound' },
    serviceInbound: { name: 'Service Inbound AI', dept: 'Service', channel: 'Inbound' },
    serviceOutbound: { name: 'Service Outbound AI', dept: 'Service', channel: 'Outbound' }
  };
  var SERVICE_EXPECTED_APPT_VALUE = 200;

/**
 * Customer-facing VINI pricing calculator — logic layer.
 *
 * Mirrors the discount mechanics of the standalone Spyne pricing calculator
 * (rooftop volume tiers, car-count slabs, all-agent bundle, offer codes,
 * priced integrations) but exposes pure functions instead of DOM code, and
 * reuses agent copy from `proposalCatalog.js` so descriptions stay in sync
 * with the proposal generator.
 *
 * Tiers / bundle / volume / offers / integrations below are kept in sync with the
 * standalone Spyne Pricing Calculator's `window.PRICING_DEFAULTS.vini` (config.js)
 * — that file is the source of truth; update both together.
 */

/** Smallest slab that covers a given car count. Price is per agent, per rooftop, per month. */
var VINI_PRICING_TIERS = [
  { cars: 50, salesInbound: 750, salesOutbound: 750, serviceInbound: 750, serviceOutbound: 750 },
  { cars: 100, salesInbound: 1250, salesOutbound: 1250, serviceInbound: 1250, serviceOutbound: 1250 },
  { cars: 150, salesInbound: 1725, salesOutbound: 1725, serviceInbound: 1725, serviceOutbound: 1725 },
  { cars: 200, salesInbound: 2100, salesOutbound: 2100, serviceInbound: 2100, serviceOutbound: 2100 },
  { cars: 250, salesInbound: 2500, salesOutbound: 2500, serviceInbound: 2500, serviceOutbound: 2500 },
  { cars: 300, salesInbound: 2850, salesOutbound: 2850, serviceInbound: 2850, serviceOutbound: 2850 },
  { cars: 350, salesInbound: 3150, salesOutbound: 3150, serviceInbound: 3150, serviceOutbound: 3150 },
  { cars: 400, salesInbound: 3400, salesOutbound: 3400, serviceInbound: 3400, serviceOutbound: 3400 },
  { cars: 450, salesInbound: 3600, salesOutbound: 3600, serviceInbound: 3600, serviceOutbound: 3600 },
  { cars: 500, salesInbound: 3750, salesOutbound: 3750, serviceInbound: 3750, serviceOutbound: 3750 },
];

var VINI_AGENT_ORDER = PROPOSAL_AGENT_KEYS;

/** Short, pricing-card-sized descriptions — one short line each. */
const VINI_AGENT_SHORT_DESCRIPTIONS = {
  salesInbound: 'Answers new and pre-owned inquiries 24/7 across call, text, and chat.',
  salesOutbound: 'Re-engages aged leads and equity opportunities with compliant dialing.',
  serviceInbound: 'Handles service inquiries 24/7 across call, text, and chat.',
  serviceOutbound: 'Runs recall and retention outreach with booking and escalation.',
};

/** Expandable benefit bullets shown when a sales agent toggle is on. Service agents stay collapsed. */
const VINI_AGENT_HIGHLIGHTS_STATIC = {
  salesInbound: [
    '0% missed calls — available 24×7',
    '100% lead coverage — so that no leads are lost',
    '<60 sec response time with speed to lead',
    '14 day follow-up — so that you can get the most out of every lead',
  ],
};

/**
 * Benefit bullets for the pricing agent expand panel.
 * Sales Outbound appts = cars ÷ 10. Service Outbound appts = cars × 0.25.
 */
function pricingAgentHighlights(agentKey, cars = 0) {
  if (agentKey === 'salesInbound') return VINI_AGENT_HIGHLIGHTS_STATIC.salesInbound;
  if (agentKey === 'salesOutbound') {
    const appts = Math.max(0, Math.round((Number(cars) || 0) / 10));
    return [
      `Get ${appts.toLocaleString('en-US')} appts per rooftop from outbound campaigns`,
      'Campaign Intelligence — identify the right campaign for the right lead',
      'Reach out to 1000s of leads without scaling headcount',
    ];
  }
  if (agentKey === 'serviceOutbound') {
    const appts = Math.max(0, Math.round((Number(cars) || 0) * 0.25));
    return [
      `Get ${appts.toLocaleString('en-US')} appts per rooftop from outbound campaigns`,
      'Campaign Intelligence — identify the right campaign for the right customer',
      'Reach out to 1000s of service customers without scaling headcount',
    ];
  }
  return [];
}

/** Agent display copy for the pricing cards — name reused from the proposal catalog. */
var VINI_PRICING_AGENTS = VINI_AGENT_ORDER.map((key, i) => {
  const meta = PROPOSAL_AGENT_META[key];
  return {
    key,
    idx: String(i + 1).padStart(2, '0'),
    name: meta.name,
    dept: meta.dept,
    channel: meta.channel,
    description: VINI_AGENT_SHORT_DESCRIPTIONS[key],
  };
});

/** Maps the pre-demo agent picker's snake_case keys (`demoAgents`) to this module's camelCase agent keys. */
const DEMO_AGENT_KEY_MAP = {
  sales_inbound: 'salesInbound',
  sales_outbound: 'salesOutbound',
  service_inbound: 'serviceInbound',
  service_outbound: 'serviceOutbound',
};

/** Default agent toggle state — only the agents picked earlier in the demo flow start selected. */
function defaultAgentStateFromDemoAgents(demoAgentKeys) {
  const picked = new Set(
    (Array.isArray(demoAgentKeys) ? demoAgentKeys : []).map((k) => DEMO_AGENT_KEY_MAP[k]).filter(Boolean)
  );
  return Object.fromEntries(VINI_PRICING_AGENTS.map((a) => [a.key, picked.has(a.key)]));
}

var VINI_BUNDLE_DISCOUNT = 0.1;

/** Rooftop volume discount: 5% at 2–3, 10% at 4–6, 15% at 7+. */
var VINI_VOLUME = { min: 2, t1: 4, t2: 7, r0: 0.05, r1: 0.1, r2: 0.15 };

/** Above this cars/rooftop count, multi-rooftop deals use a flat 5% (only when rooftops > 5). */
var VINI_HIGH_CAR_FLAT_THRESHOLD = 350;
var VINI_HIGH_CAR_FLAT_ROOFTOPS = 5;
var VINI_HIGH_CAR_FLAT_RATE = 0.05;

/** Inventory is high enough that progressive rooftop tiers do not apply. */
function isHighCarInventory(cars) {
  return Math.max(0, Number(cars) || 0) > VINI_HIGH_CAR_FLAT_THRESHOLD;
}

/** Flat 5% is actively applied (high cars + rooftops > 5). */
function isHighCarFlatDiscount(cars, rooftops) {
  return isHighCarInventory(cars)
    && Math.max(0, Number(rooftops) || 0) > VINI_HIGH_CAR_FLAT_ROOFTOPS;
}

var VINI_OFFER_CODES = [
  { code: 'VINI10', discount: 0.1, label: '10% offer' },
];
var VINI_OFFER_VALIDITY_DAYS = 7;

/**
 * Pass-through integrations, keyed by product category.
 * `live: false` → UI shows a red marker + "YTD"; cost is not charged until live.
 * `cost` is monthly $/rooftop when live (0 is a real price).
 */
var VINI_INTEGRATIONS = [
  // Sales CRM
  { key: 'sales-crm-vinsolutions', name: 'Vinsolutions', category: 'sales_crm', live: false, cost: 40 },
  { key: 'sales-crm-elead', name: 'Elead', category: 'sales_crm', live: true, cost: 0 },
  { key: 'sales-crm-dealersocket-solera', name: 'Dealersocket (Solera)', category: 'sales_crm', live: false, cost: 200 },
  { key: 'sales-crm-tekion', name: 'Tekion', category: 'sales_crm', live: true, cost: 10 },
  { key: 'sales-crm-dealersync', name: 'Dealersync', category: 'sales_crm', live: true, cost: 0 },
  { key: 'sales-crm-promax-ncc', name: 'ProMax (NCC)', category: 'sales_crm', live: false, cost: null },
  { key: 'sales-crm-dealercenter', name: 'DealerCenter', category: 'sales_crm', live: false, cost: null },
  { key: 'sales-crm-carwars', name: 'CarWars', category: 'sales_crm', live: false, cost: null },
  { key: 'sales-crm-drivecentric', name: 'DriveCentric', category: 'sales_crm', live: true, cost: 99 },
  { key: 'sales-crm-autorevo', name: 'AutoRevo', category: 'sales_crm', live: false, cost: null },
  { key: 'sales-crm-quorum', name: 'Quorum', category: 'sales_crm', live: false, cost: null },
  { key: 'sales-crm-reynolds-sales', name: 'Reynolds Sales', category: 'sales_crm', live: false, cost: 747 },
  { key: 'sales-crm-light-speed', name: 'Light Speed', category: 'sales_crm', live: false, cost: null },
  { key: 'sales-crm-autoraptor', name: 'AutoRaptor', category: 'sales_crm', live: false, cost: null },
  { key: 'sales-crm-momentum', name: 'Momentum CRM', category: 'sales_crm', live: false, cost: null },
  { key: 'sales-crm-dealerpeak', name: 'Dealerpeak', category: 'sales_crm', live: false, cost: null },

  // IMS
  { key: 'ims-vauto', name: 'vAuto', category: 'ims', live: true, cost: 0 },
  { key: 'ims-reynolds-inventory', name: 'Reynolds Inventory', category: 'ims', live: false, cost: null },
  { key: 'ims-vincue', name: 'Vincue', category: 'ims', live: true, cost: 0 },
  { key: 'ims-homenet', name: 'Homenet', category: 'ims', live: true, cost: 0 },
  { key: 'ims-inventory-plus', name: 'inventory-plus', category: 'ims', live: true, cost: 0 },
  { key: 'ims-dealersync', name: 'Dealersync', category: 'ims', live: true, cost: 0 },
  { key: 'ims-dealercarsearch', name: 'Dealercarsearch', category: 'ims', live: true, cost: 0 },
  { key: 'ims-maxdigital-acv', name: 'maxDigital (ACV)', category: 'ims', live: true, cost: 0 },
  { key: 'ims-homenet-cox', name: 'HomeNet (Cox)', category: 'ims', live: true, cost: 0 },
  { key: 'ims-vin-solutions', name: 'Vin solutions', category: 'ims', live: true, cost: 0 },
  { key: 'ims-redline-predian', name: 'Redline/Predian', category: 'ims', live: true, cost: 0 },
  { key: 'ims-jd-power', name: 'JD Power', category: 'ims', live: true, cost: 0 },
  { key: 'ims-1-source-trader', name: '1 Source Trader', category: 'ims', live: true, cost: 0 },
  { key: 'ims-tekion-inventory', name: 'Tekion Inventory', category: 'ims', live: true, cost: 0 },

  // Service Scheduler
  { key: 'svc-xtime', name: 'xTime', category: 'service_scheduler', live: true, cost: 75 },
  { key: 'svc-mykaarma', name: 'MyKaarma', category: 'service_scheduler', live: true, cost: 75 },
  { key: 'svc-status-plus', name: 'Status Plus', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-update-promise', name: 'Update Promise', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-protractor', name: 'Protractor', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-autoloop', name: 'AutoLoop', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-auto-live', name: 'Auto Live', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-omnique', name: 'Omnique', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-tcc', name: 'TCC', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-light-speed', name: 'Light Speed', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-cdk-service-scheduler', name: 'CDK Service scheduler', category: 'service_scheduler', live: true, cost: 20 },
  { key: 'svc-reynolds-services', name: 'Reynolds Services', category: 'service_scheduler', live: false, cost: 629 },
  { key: 'svc-dealerlogix', name: 'DealerLogix (wi Advisor)', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-servicedrive', name: 'ServiceDrive', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-autopoint-solera', name: 'AutoPoint (Solera)', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-rapid-recon', name: 'Rapid Recon', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-dealerfx', name: 'DealerFX', category: 'service_scheduler', live: true, cost: 0 },
  { key: 'svc-auto-dot-live', name: 'Auto.live', category: 'service_scheduler', live: false, cost: null },
  { key: 'svc-tekion', name: 'Tekion', category: 'service_scheduler', live: true, cost: 10 },
  { key: 'svc-pbs', name: 'PBS', category: 'service_scheduler', live: true, cost: 0 },
  { key: 'svc-evenflow', name: 'Evenflow', category: 'service_scheduler', live: true, cost: 0 },
  { key: 'svc-redcap-solera', name: 'Redcap- Solera', category: 'service_scheduler', live: true, cost: 0 },

  // DMS
  { key: 'dms-cdk', name: 'CDK DMS', category: 'dms', live: true, cost: 0 },
  { key: 'dms-reynolds', name: 'Reynolds DMS', category: 'dms', live: false, cost: null },
  { key: 'dms-dealertrack', name: 'Dealertrack DMS', category: 'dms', live: false, cost: null },
  { key: 'dms-automate-solera', name: 'Automate (Solera)', category: 'dms', live: false, cost: null },
  { key: 'dms-dealerbuilt', name: 'Dealerbuilt', category: 'dms', live: false, cost: null },
  { key: 'dms-tekion', name: 'Tekion', category: 'dms', live: true, cost: 10 },
  { key: 'dms-affinitiv-autoloop', name: 'Affinitiv/AutoLoop', category: 'dms', live: false, cost: null },
  { key: 'dms-light-speed', name: 'Light Speed', category: 'dms', live: false, cost: null },
  { key: 'dms-dominion', name: 'Dominion DMS', category: 'dms', live: false, cost: null },
  { key: 'dms-pbs', name: 'PBS', category: 'dms', live: true, cost: 0 },
  { key: 'dms-frazer', name: 'Frazer', category: 'dms', live: true, cost: 40 },
];

var VINI_INTEGRATION_CATEGORIES = [
  { key: 'sales_crm', label: 'Sales CRM', requiredFor: 'Sales agents' },
  { key: 'ims', label: 'IMS', requiredFor: 'Sales agents' },
  { key: 'service_scheduler', label: 'Service Scheduler', requiredFor: 'Service agents' },
  { key: 'dms', label: 'DMS', requiredFor: 'Service agents' },
];

function fmtUsd(n) {
  return '$' + Math.round(Math.max(0, Number(n) || 0)).toLocaleString('en-US');
}

/** Billable monthly $/rooftop for an integration (Not Live / YTD → 0). */
function integrationBillableCost(it) {
  if (!it?.live) return 0;
  return Math.max(0, Number(it.cost) || 0);
}

/** Display price: Live → $amount (incl. $0); Not Live → YTD. */
function formatIntegrationPrice(it) {
  if (!it?.live) return 'YTD';
  return fmtUsd(it.cost ?? 0);
}

/** Integrations for a category, Live first (sheet order preserved within each group). */
function integrationsForCategory(categoryKey) {
  const items = VINI_INTEGRATIONS.filter((it) => it.category === categoryKey);
  return [
    ...items.filter((it) => it.live),
    ...items.filter((it) => !it.live),
  ];
}

/** @deprecated Prefer `it.category` / `VINI_INTEGRATION_CATEGORIES`. */
function integrationCategory(typeOrCategory) {
  const t = String(typeOrCategory || '').toLowerCase();
  if (t === 'sales_crm' || t === 'ims' || t === 'service_scheduler' || t === 'dms') return t;
  if (t === 'sales') return 'sales_crm';
  if (t === 'service') return 'service_scheduler';
  return t || 'sales_crm';
}

function fmtOfferDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function tierCars(t) {
  return t.cars;
}

/** Smallest slab that covers `cars`; caps at the top slab. */
function resolveTier(cars) {
  const n = Math.max(0, Number(cars) || 0);
  let idx = VINI_PRICING_TIERS.findIndex((t) => tierCars(t) >= n);
  if (idx < 0) idx = VINI_PRICING_TIERS.length - 1;
  if (n <= 0) idx = 0;
  return { index: idx, tier: VINI_PRICING_TIERS[idx] };
}

/** Volume discount starts at VOL.min rooftops. 1 rooftop = 0%.
 * When cars/rooftop > 350, only a flat 5% applies (and only if rooftops > 5). */
function groupDiscount(rooftops, cars = 0) {
  if (isHighCarInventory(cars)) {
    return Math.max(0, Number(rooftops) || 0) > VINI_HIGH_CAR_FLAT_ROOFTOPS
      ? VINI_HIGH_CAR_FLAT_RATE
      : 0;
  }
  const { min, t1, t2, r0, r1, r2 } = VINI_VOLUME;
  if (rooftops < min) return 0;
  if (rooftops >= t2) return r2;
  if (rooftops >= t1) return r1;
  return r0 || 0;
}

/** Next volume milestone, for nudge copy. Returns null at top tier or when flat is applied. */
function nextVolumeStep(rooftops, cars = 0) {
  if (isHighCarInventory(cars)) {
    if (rooftops > VINI_HIGH_CAR_FLAT_ROOFTOPS) return null;
    const at = VINI_HIGH_CAR_FLAT_ROOFTOPS + 1;
    return { need: at - rooftops, rate: VINI_HIGH_CAR_FLAT_RATE, at };
  }
  const { min, t1, t2, r0, r1, r2 } = VINI_VOLUME;
  if (rooftops < min) return { need: min - rooftops, rate: r0, at: min };
  if (rooftops < t1) return { need: t1 - rooftops, rate: r1, at: t1 };
  if (rooftops < t2) return { need: t2 - rooftops, rate: r2, at: t2 };
  return null;
}

/** "Add X more agent(s) to unlock Y%." / "Applied. Saving $Z/mo per rooftop." copy for the bundle discount row. */
function bundleBenefitText({ activeCount, bundleAmt }) {
  if (activeCount >= VINI_PRICING_AGENTS.length) {
    return `Applied. Saving ${fmtUsd(bundleAmt)}/mo per rooftop.`;
  }
  const remaining = VINI_PRICING_AGENTS.length - activeCount;
  return `Add ${remaining} more agent${remaining === 1 ? '' : 's'} to unlock ${Math.round(VINI_BUNDLE_DISCOUNT * 100)}%.`;
}

/** Volume-commitment copy for the discounts card. */
function volumeBenefitText(rooftops, cars = 0) {
  if (isHighCarInventory(cars)) {
    if (rooftops > VINI_HIGH_CAR_FLAT_ROOFTOPS) {
      return `Applied: flat ${Math.round(VINI_HIGH_CAR_FLAT_RATE * 100)}% when rooftops exceed ${VINI_HIGH_CAR_FLAT_ROOFTOPS}.`;
    }
    return `Flat ${Math.round(VINI_HIGH_CAR_FLAT_RATE * 100)}% once rooftops exceed ${VINI_HIGH_CAR_FLAT_ROOFTOPS}.`;
  }
  const { min, t1, t2, r0, r1, r2 } = VINI_VOLUME;
  const r0p = Math.round((r0 || 0) * 100);
  const r1p = Math.round(r1 * 100);
  const r2p = Math.round(r2 * 100);
  if (rooftops < min) return `Starts at ${min} rooftops for ${r0p}%.`;
  if (rooftops < t1) return `Reach ${t1} rooftops for ${r1p}%.`;
  if (rooftops < t2) return `Reach ${t2} rooftops for ${r2p}%.`;
  return 'Top tier reached.';
}

/** Volume tier pill definitions for the discounts card (rate + rooftop-range label). */
function volumeTierDefs() {
  const { min, t1, t2, r0, r1, r2 } = VINI_VOLUME;
  const midLabel = t1 === min ? `${t1}` : t1 - min <= 1 ? `${min}` : `${min} to ${t1 - 1}`;
  return [
    { rate: r0 || 0, label: midLabel },
    { rate: r1, label: t2 - t1 <= 1 ? `${t1}` : `${t1} to ${t2 - 1}` },
    { rate: r2, label: `${t2} or more` },
  ];
}

function findOfferCode(raw) {
  const code = String(raw || '').trim().toUpperCase();
  return VINI_OFFER_CODES.find((c) => c.code === code) || null;
}

function applyOfferCode(raw) {
  const match = findOfferCode(raw);
  if (!match) return null;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + VINI_OFFER_VALIDITY_DAYS);
  return { code: match.code, pct: match.discount, label: match.label, expiresAt };
}

/**
 * Full pricing breakdown for the current calculator state.
 * @param {{ cars: number, rooftops: number, agents: Record<string, boolean>, integrations: Record<string, boolean>, offer: { code: string, pct: number, expiresAt: Date } | null }} state
 */
function computeViniPricing(state) {
  const { tier } = resolveTier(state.cars);
  const rooftops = Math.max(1, Math.round(state.rooftops || 1));
  const activeAgents = VINI_PRICING_AGENTS.filter((a) => state.agents?.[a.key]);
  const allFour = activeAgents.length === VINI_PRICING_AGENTS.length;

  const agentLines = activeAgents.map((a) => ({ key: a.key, name: a.name, price: tier[a.key] }));
  const subtotal = agentLines.reduce((s, a) => s + a.price, 0);

  const gDisc = groupDiscount(rooftops, state.cars);
  const bundleAmt = allFour ? subtotal * VINI_BUNDLE_DISCOUNT : 0;
  const afterBundle = subtotal - bundleAmt;
  const volumeAmt = afterBundle * gDisc;
  const afterVolume = afterBundle - volumeAmt;
  const offerPct = state.offer?.pct || 0;
  const offerAmt = offerPct > 0 ? afterVolume * offerPct : 0;
  const agentsPerRooftop = afterVolume - offerAmt;

  const activeIntegrations = VINI_INTEGRATIONS.filter((it) => state.integrations?.[it.key]);
  const intCost = activeIntegrations.reduce((s, it) => s + integrationBillableCost(it), 0);

  const perRooftop = agentsPerRooftop + intCost;
  const agentsMonthly = agentsPerRooftop * rooftops;
  const intMonthly = intCost * rooftops;
  const monthlyTotal = agentsMonthly + intMonthly;

  const savings = [];
  if (bundleAmt > 0.5) {
    savings.push({ key: 'bundle', label: 'All 4 agents bundle', hint: `${Math.round(VINI_BUNDLE_DISCOUNT * 100)}% off agents`, amount: bundleAmt });
  }
  if (volumeAmt > 0.5) {
    savings.push({ key: 'volume', label: 'Rooftop commitment', hint: `${Math.round(gDisc * 100)}% volume discount`, amount: volumeAmt });
  }
  if (offerAmt > 0.5) {
    savings.push({ key: 'offer', label: 'Applied offer', hint: `${state.offer.code} · ${Math.round(offerPct * 100)}%`, amount: offerAmt });
  }

  return {
    tier,
    rooftops,
    allFour,
    activeCount: activeAgents.length,
    agentLines,
    subtotal,
    bundleAmt,
    gDisc,
    volumeAmt,
    offerAmt,
    agentsPerRooftop,
    activeIntegrations,
    intCost,
    perRooftop,
    agentsMonthly,
    intMonthly,
    monthlyTotal,
    annualTotal: monthlyTotal * 12,
    savings,
    nextVolume: nextVolumeStep(rooftops, state.cars),
    highCarFlat: isHighCarFlatDiscount(state.cars, rooftops),
    highCarInventory: isHighCarInventory(state.cars),
  };
}

const SALES_AGENT_KEYS = new Set(['salesInbound', 'salesOutbound']);
const SERVICE_AGENT_KEYS = new Set(['serviceInbound', 'serviceOutbound']);

/** Funnel defaults — keep in sync with `DemoPlatformFunnelPage` INPUT_DEFAULTS. */
var PRICING_PAYBACK_DEFAULTS = {
  showPct: 45,
  closeRateAfterShow: 50,
  avgGrossProfitPerSale: 3500,
  gpPerServiceAppt: SERVICE_EXPECTED_APPT_VALUE,
};

function clampPct(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

function money(n) {
  return Math.max(0, Number(n) || 0);
}

/**
 * Extra booked appointments (per rooftop / month) needed to cover discounted agent cost.
 * Integrations are excluded. Mixed sales+service splits cost by list-price share.
 *
 * @param {ReturnType<typeof computeViniPricing>} pricing
 * @param {{ showPct?: number, closeRateAfterShow?: number, avgGrossProfitPerSale?: number, gpPerServiceAppt?: number }} [assumptions]
 */
function computePricingPayback(pricing, assumptions = {}) {
  const showPct = clampPct(assumptions.showPct, PRICING_PAYBACK_DEFAULTS.showPct);
  const closePct = clampPct(
    assumptions.closeRateAfterShow,
    PRICING_PAYBACK_DEFAULTS.closeRateAfterShow,
  );
  const gpPerSale = money(assumptions.avgGrossProfitPerSale)
    || PRICING_PAYBACK_DEFAULTS.avgGrossProfitPerSale;
  const gpPerServiceAppt = money(assumptions.gpPerServiceAppt)
    || PRICING_PAYBACK_DEFAULTS.gpPerServiceAppt;

  const gpPerSalesAppt = (showPct / 100) * (closePct / 100) * gpPerSale;
  const agentCostPerRooftop = money(pricing?.agentsPerRooftop);
  const lines = Array.isArray(pricing?.agentLines) ? pricing.agentLines : [];
  const salesList = lines
    .filter((line) => SALES_AGENT_KEYS.has(line.key))
    .reduce((sum, line) => sum + money(line.price), 0);
  const serviceList = lines
    .filter((line) => SERVICE_AGENT_KEYS.has(line.key))
    .reduce((sum, line) => sum + money(line.price), 0);
  const listTotal = salesList + serviceList;

  if (listTotal <= 0 || agentCostPerRooftop <= 0) {
    return {
      enabled: false,
      showPct,
      closePct,
      gpPerSale,
      gpPerSalesAppt,
      gpPerServiceAppt,
      agentCostPerRooftop: 0,
      salesCost: 0,
      serviceCost: 0,
      salesApptsRaw: 0,
      serviceApptsRaw: 0,
      salesAppts: 0,
      serviceAppts: 0,
      hasSales: false,
      hasService: false,
    };
  }

  const salesCost = agentCostPerRooftop * (salesList / listTotal);
  const serviceCost = agentCostPerRooftop * (serviceList / listTotal);
  const hasSales = salesCost > 0.5;
  const hasService = serviceCost > 0.5;
  const salesApptsRaw = hasSales && gpPerSalesAppt > 0 ? salesCost / gpPerSalesAppt : 0;
  const serviceApptsRaw = hasService && gpPerServiceAppt > 0 ? serviceCost / gpPerServiceAppt : 0;

  return {
    enabled: true,
    showPct,
    closePct,
    gpPerSale,
    gpPerSalesAppt,
    gpPerServiceAppt,
    agentCostPerRooftop,
    salesCost,
    serviceCost,
    salesApptsRaw,
    serviceApptsRaw,
    salesAppts: salesApptsRaw > 0 ? Math.ceil(salesApptsRaw) : 0,
    serviceAppts: serviceApptsRaw > 0 ? Math.ceil(serviceApptsRaw) : 0,
    hasSales,
    hasService,
  };
}


  var AGENT_KEYS = ['salesInbound', 'salesOutbound', 'serviceInbound', 'serviceOutbound'];
  var AGENT_NAMES = {
    salesInbound: 'Sales Inbound AI',
    salesOutbound: 'Sales Outbound AI',
    serviceInbound: 'Service Inbound AI',
    serviceOutbound: 'Service Outbound AI'
  };
  var CHECK_SVG = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 10.5l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

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
  function coldLeadsRangeFromMid(mid) {
    var m = Math.max(0, Math.round(Number(mid) || 0));
    var delta = m > 0 ? Math.max(50, Math.round(m / 6 / 50) * 50) : 0;
    var lo = Math.max(0, m - delta);
    var hi = m + delta;
    return {
      mid: m,
      lo: lo,
      hi: hi,
      delta: delta,
      shown: floorToNiceZeros(lo),
      plusLabel: formatPlusFloorCount(lo),
    };
  }

  function formatLeadCount(n) {
    var r = Math.round(Number(n) || 0);
    if (!isFinite(r)) return '—';
    return r.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  function compactLeadK(n) {
    var shown = Math.max(0, Math.round(Number(n) || 0));
    if (shown >= 1000) return Math.round(shown / 1000).toLocaleString('en-US') + 'K';
    return formatLeadCount(shown);
  }

  function salesApptsRangeFromMid(midpoint) {
    var mid = Math.max(0, Math.round(Number(midpoint) || 0));
    var delta = mid <= 15 ? 1 : mid <= 35 ? 3 : mid <= 70 ? 6 : 9;
    var lo = Math.max(0, mid - delta);
    var hi = mid + delta;
    return {
      lo: lo,
      hi: hi,
      mid: mid,
      label: lo === hi ? formatLeadCount(lo) : (formatLeadCount(lo) + '\u2013' + formatLeadCount(hi)),
    };
  }

  /** Baseline CRM book — keep in sync with CrmAnalysisDeck.jsx */
  var CRM_BASE_UNIVERSE = 27400;
  var CRM_SALES_OUTBOUND_FACTOR = 0.8;
  var CRM_BASE_APPTS_YR = Math.round(216 * CRM_SALES_OUTBOUND_FACTOR);
  var CRM_BASE_HOT_LEADS = Math.round(2160 * CRM_SALES_OUTBOUND_FACTOR);
  var CRM_HOT_LEADS_PCT = 0.08;
  var CRM_ADDITIONAL_HOT_PCT = 0.08;
  var CRM_SALES_ROWS = [
    { id: 'agedLead', label: 'Aged Lead Followups', leads: 18400, appts: 66, hotLeads: 660 },
    { id: 'noShow', label: 'No-Show Recovery', leads: 3000, appts: 30, hotLeads: 300 },
    { id: 'inventoryMatch', label: 'Inventory Match', leads: 3000, appts: 40, hotLeads: 400 },
    { id: 'equityMining', label: 'Equity Mining', leads: 1000, appts: 30, hotLeads: 300 },
    { id: 'leaseEnd', label: 'Lease-End Renewal', leads: 1000, appts: 30, hotLeads: 300 },
    { id: 'buyback', label: 'Buy-Back / Repurchase', leads: 1000, appts: 20, hotLeads: 200 },
  ];

  function deriveDeckMetrics(cars, leadsPerCar) {
    cars = Math.max(0, Math.min(50000, Math.round(Number(cars) || 0)));
    leadsPerCar = Math.max(0, Math.round(Number(leadsPerCar) || 10));
    var monthlyLeads = cars * leadsPerCar;
    var sales = coldLeadsRangeFromMid(monthlyLeads * 36);
    var service = coldLeadsRangeFromMid(cars * 36);
    var salesShown = sales.shown;
    var serviceShown = service.shown;
    var scale = salesShown > 0 ? salesShown / CRM_BASE_UNIVERSE : 0;
    var appts = salesApptsRangeFromMid(Math.max(0, Math.round(CRM_BASE_APPTS_YR * scale)));
    var crmHot = Math.round(CRM_BASE_HOT_LEADS * scale);
    var impactHot = Math.round(salesShown * CRM_HOT_LEADS_PCT);
    return {
      cars: cars,
      leadsPerCar: leadsPerCar,
      monthlyLeads: monthlyLeads,
      sales: sales,
      service: service,
      salesShown: salesShown,
      serviceShown: serviceShown,
      scale: scale,
      appts: appts,
      crmHot: crmHot,
      impactHot: impactHot,
    };
  }

  function wireCarsSeamRecalc() {
    var LEADS_PER_CAR = 10;
    var liveT = null;
    var lastCars = 200;

    function frameByLabel(label) {
      return document.querySelector('.dpf-pitchDeck-frame [data-pitch-label="' + label + '"]')
        || document.querySelector('[data-pitch-label="' + label + '"]');
    }

    function syncCarInputs(cars, skipEl) {
      document.querySelectorAll('.dpf-soSeam-carsInput, .dpf-soSeam-carsValue').forEach(function (inp) {
        if (inp === skipEl || document.activeElement === inp) return;
        if (inp.tagName === 'INPUT') inp.value = String(cars);
        else inp.textContent = String(cars);
      });
      var pricingRoot = document.querySelector('.dpf-pricing');
      var pricingInput = pricingRoot && pricingRoot.querySelector('.dpf-pricing-carsInput');
      if (pricingInput && pricingInput !== skipEl && document.activeElement !== pricingInput) {
        pricingInput.value = String(cars);
      }
    }

    function updateSeamHighlights(d) {
      document.querySelectorAll('.dpf-soSeam').forEach(function (seam) {
        // Only metric seams (have cars input) — never the "talk service" callout
        if (!seam.querySelector('.dpf-soSeam-carsInput, .dpf-soSeam-carsValue, .dpf-soSeam-carsTxt')) return;
        var isService = !!seam.querySelector('[data-demo-cta="service_customers_calc_open"]');
        var hi = seam.querySelector('.dpf-soSeam-highlight');
        if (!hi) return;
        if (isService) {
          hi.textContent = d.service.plusLabel + ' service customers';
        } else {
          hi.textContent = d.sales.plusLabel + ' cold leads';
        }
      });
    }

    function updateStorySlides(d) {
      var outboundProblem = frameByLabel('Outbound problem');
      if (outboundProblem) {
        var hl = outboundProblem.querySelector('.dpf-sviProblem-hl');
        if (hl) hl.textContent = compactLeadK(d.salesShown) + ' untouched leads';
      }

      var outboundSolution = frameByLabel('Outbound solution');
      if (outboundSolution) {
        outboundSolution.querySelectorAll('.dpf-sviProblem-issueTitle').forEach(function (el) {
          if (/scans and analyses your/i.test(el.textContent) || /CRM leads/i.test(el.textContent)) {
            el.textContent = 'Vini scans and analyses your ' + formatLeadCount(d.salesShown) + ' CRM leads';
          }
        });
      }

      var serviceProblem = frameByLabel('Service outbound problem');
      if (serviceProblem) {
        serviceProblem.querySelectorAll('.dpf-sviProblem-issueTitle').forEach(function (el) {
          if (/higher-ticket/i.test(el.textContent) || /idle in your DMS/i.test(el.textContent)) {
            el.textContent = 'You have ' + formatLeadCount(d.serviceShown) + ' potential higher-ticket leads idle in your DMS';
          }
        });
      }
    }

    function updateCrmAnalysis(d) {
      var slide = frameByLabel('CRM Analysis');
      if (!slide) return;
      var cad = slide.querySelector('.cad');
      if (!cad) return;
      var universe = Math.max(0, d.salesShown);
      cad.setAttribute('data-cad-scan-target', String(universe || CRM_BASE_UNIVERSE));

      var scanCount = cad.querySelector('.cad-scanCount');
      if (scanCount) {
        var val = scanCount.querySelector('.cad-scanCountVal');
        var current = val ? val.textContent : '0';
        scanCount.innerHTML = '<b class="cad-scanCountVal">' + current + '</b> of ' + formatLeadCount(universe) + ' leads scanned';
      }

      cad.querySelectorAll('.cad-stat').forEach(function (stat) {
        var labelEl = stat.querySelector('.l');
        var valEl = stat.querySelector('.v');
        if (!labelEl || !valEl) return;
        var label = (labelEl.textContent || '').trim();
        if (/Lead universe/i.test(label)) valEl.textContent = formatLeadCount(universe);
        else if (/Potential appointments/i.test(label)) valEl.textContent = d.appts.label;
        else if (/Hot leads/i.test(label)) valEl.textContent = formatLeadCount(d.crmHot);
      });

      var scale = d.scale;
      cad.querySelectorAll('.cad-tRow').forEach(function (row) {
        var type = row.querySelector('.cad-cType b');
        if (!type) return;
        var name = (type.textContent || '').trim();
        var base = CRM_SALES_ROWS.find(function (r) { return r.label === name; });
        if (!base || base.leads == null) return;
        var leadsLive = Math.round(base.leads * scale * CRM_SALES_OUTBOUND_FACTOR);
        var hotLive = base.hotLeads != null
          ? Math.round(base.hotLeads * scale * CRM_SALES_OUTBOUND_FACTOR)
          : Math.round(leadsLive * CRM_ADDITIONAL_HOT_PCT);
        var apptsMid = base.appts != null
          ? Math.round(base.appts * scale * CRM_SALES_OUTBOUND_FACTOR)
          : Math.max(1, Math.round(leadsLive * ((1 / 100) * 12) / 36));
        var appts = salesApptsRangeFromMid(Math.max(1, apptsMid));
        var cells = row.querySelectorAll('.cad-cNum');
        if (cells[0]) cells[0].textContent = formatLeadCount(leadsLive);
        if (cells[1]) cells[1].textContent = appts.label;
        if (cells[2]) cells[2].textContent = formatLeadCount(hotLive);
      });
    }

    function updateImpact(d) {
      var slide = frameByLabel('Impact');
      if (!slide) return;
      var lead = slide.querySelector('.dpf-soRoi-lead');
      if (lead) lead.textContent = 'For ' + formatLeadCount(d.salesShown) + ' leads, Vini Sales Outbound delivers';
      var num = slide.querySelector('.dpf-soRoi-num');
      if (num) num.textContent = d.appts.label;
      var bonus = slide.querySelector('.dpf-soRoi-bonusNum');
      if (bonus) bonus.textContent = '+' + formatLeadCount(d.impactHot);
    }

    function patchMetricOverlay(root, d) {
      if (!root) return;
      var title = (root.querySelector('.dpf-coldLeadsExplain-title') || {}).textContent || '';
      var isService = /service customers/i.test(title);
      var range = isService ? d.service : d.sales;
      var cars = d.cars;
      var monthly = isService ? cars : d.monthlyLeads;
      var mid = range.mid;
      var delta = range.delta;

      root.querySelectorAll('.dpf-coldLeadsExplain-inputRow').forEach(function (row) {
        var dt = row.querySelector('dt');
        var dd = row.querySelector('dd');
        if (!dt || !dd) return;
        var label = (dt.textContent || '').trim().toLowerCase();
        if (label.indexOf('cars sold') !== -1) dd.textContent = formatLeadCount(cars);
        else if (label.indexOf('leads per car') !== -1) dd.textContent = String(d.leadsPerCar);
      });

      var steps = root.querySelectorAll('.dpf-coldLeadsExplain-step');
      if (isService) {
        if (steps[0]) {
          var hl0 = steps[0].querySelector('.dpf-coldLeadsExplain-stepHl');
          if (hl0) hl0.textContent = formatLeadCount(cars) + ' cars/mo';
        }
        if (steps[1]) {
          var val1 = steps[1].querySelector('.dpf-coldLeadsExplain-stepVal');
          if (val1) {
            val1.innerHTML = formatLeadCount(cars) + ' × 36 months = <span class="dpf-coldLeadsExplain-stepHl">'
              + formatLeadCount(mid) + ' customers</span>';
          }
        }
      } else {
        if (steps[0]) {
          var val0 = steps[0].querySelector('.dpf-coldLeadsExplain-stepVal');
          if (val0) {
            val0.innerHTML = formatLeadCount(cars) + ' × ' + d.leadsPerCar + ' = <span class="dpf-coldLeadsExplain-stepHl">'
              + formatLeadCount(monthly) + ' leads/mo</span>';
          }
        }
        if (steps[1]) {
          var val1b = steps[1].querySelector('.dpf-coldLeadsExplain-stepVal');
          if (val1b) {
            val1b.innerHTML = formatLeadCount(monthly) + ' × 36 months = <span class="dpf-coldLeadsExplain-stepHl">'
              + formatLeadCount(mid) + ' leads</span>';
          }
        }
      }
      if (steps[2]) {
        var hl2 = steps[2].querySelector('.dpf-coldLeadsExplain-stepHl');
        if (hl2) hl2.textContent = '\u00b1' + formatLeadCount(delta);
      }
      var result = root.querySelector('.dpf-coldLeadsExplain-resultVal');
      if (result) {
        var suffix = result.querySelector('span');
        var suffixText = suffix
          ? suffix.textContent
          : (isService ? 'service customers sitting in your CRM' : 'cold leads sitting in your CRM');
        result.innerHTML = range.plusLabel + ' <span>' + suffixText + '</span>';
      }
    }

    function refreshOpenOverlays(d) {
      document.querySelectorAll(
        '.client-deck-overlayHost .dpf-coldLeadsExplain-modal, .dpf-coldLeadsExplain-modal, .client-deck-overlayHost .dpf-coldLeadsExplain-backdrop'
      ).forEach(function (modal) {
        patchMetricOverlay(modal, d);
      });
    }

    function readLiveCars() {
      var best = lastCars > 0 ? lastCars : 200;
      var nodes = document.querySelectorAll('.dpf-soSeam-carsInput, .dpf-pricing-carsInput, .dpf-soSeam-carsValue');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var raw = el.tagName === 'INPUT' ? el.value : el.textContent;
        var n = parseInt(String(raw || '').replace(/[^0-9]/g, ''), 10) || 0;
        if (n > 0) {
          best = n;
          // Prefer the focused field when present
          if (document.activeElement === el) return n;
        }
      }
      try {
        var stored = parseInt(sessionStorage.getItem('deckCarsSeam') || '', 10);
        if (stored > 0) best = stored;
      } catch (err) {}
      return best;
    }

    function persistCars(cars) {
      try { sessionStorage.setItem('deckCarsSeam', String(cars)); } catch (err) {}
    }

    function syncOverlayTemplates(d) {
      // Keep static overlay HTML in sync so reopen always shows current cars/math
      var data = window.__deckInteractionData;
      if (!data || !data.overlays) return;
      ['cold_leads_calc_open', 'service_customers_calc_open'].forEach(function (key) {
        var html = data.overlays[key];
        if (!html) return;
        var wrap = document.createElement('div');
        wrap.innerHTML = html;
        patchMetricOverlay(wrap, d);
        data.overlays[key] = wrap.innerHTML;
      });
    }

    function updateDerived(cars, opts) {
      opts = opts || {};
      var d = deriveDeckMetrics(cars, LEADS_PER_CAR);
      lastCars = d.cars > 0 ? d.cars : lastCars;
      if (d.cars > 0) persistCars(d.cars);
      updateSeamHighlights(d);
      if (!opts.highlightsOnly) {
        updateStorySlides(d);
        updateCrmAnalysis(d);
        updateImpact(d);
        refreshOpenOverlays(d);
        syncOverlayTemplates(d);
      } else {
        refreshOpenOverlays(d);
      }
      return d;
    }

    function applyCars(cars, opts) {
      opts = opts || {};
      var live = !!opts.live;
      cars = Math.max(live ? 0 : 1, Math.min(50000, Math.round(Number(cars) || 0)));
      if (!live && cars < 1) cars = 200;

      if (live) {
        updateDerived(cars, { highlightsOnly: true });
        return;
      }

      syncCarInputs(cars, opts.skipEl);
      updateDerived(cars);

      if (!opts.skipPricing) {
        var pricingRoot = document.querySelector('.dpf-pricing');
        if (pricingRoot && pricingRoot.__deckPricing) {
          pricingRoot.__deckPricing.setCars(Math.max(1, cars), true);
        }
      }
    }

    window.__deckApplyCarsSeam = function (cars, opts) {
      applyCars(cars, opts || { live: false });
    };
    window.__deckRefreshMetricOverlay = function (root) {
      var cars = readLiveCars();
      var d = deriveDeckMetrics(cars, LEADS_PER_CAR);
      lastCars = d.cars;
      patchMetricOverlay(root, d);
      return d;
    };
    window.__deckGetCarsSeam = function () { return readLiveCars(); };

    function readCarsFromInput(el) {
      return parseInt(String(el && el.value || '').replace(/[^0-9]/g, ''), 10) || 0;
    }

    document.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !t.classList) return;
      var fromSeam = t.classList.contains('dpf-soSeam-carsInput');
      var fromPricing = t.classList.contains('dpf-pricing-carsInput');
      if (!fromSeam && !fromPricing) return;
      var n = readCarsFromInput(t);
      clearTimeout(liveT);
      if (n > 0) updateDerived(n, { highlightsOnly: false });
      liveT = setTimeout(function () {
        if (n > 0) applyCars(n, { live: false, skipEl: t, skipPricing: fromPricing });
      }, 120);
    }, true);

    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.classList) return;
      if (!t.classList.contains('dpf-soSeam-carsInput') && !t.classList.contains('dpf-pricing-carsInput')) return;
      var n = readCarsFromInput(t) || 200;
      applyCars(n, { live: false, skipEl: t, skipPricing: t.classList.contains('dpf-pricing-carsInput') });
    }, true);

    document.addEventListener('blur', function (e) {
      var t = e.target;
      if (!t || !t.classList) return;
      var fromSeam = t.classList.contains('dpf-soSeam-carsInput');
      var fromPricing = t.classList.contains('dpf-pricing-carsInput');
      if (!fromSeam && !fromPricing) return;
      clearTimeout(liveT);
      var n = readCarsFromInput(t);
      if (!n) n = fromPricing ? 100 : 200;
      applyCars(n, { live: false, skipEl: t, skipPricing: fromPricing });
      if (fromPricing) {
        var pricingRoot = document.querySelector('.dpf-pricing');
        if (pricingRoot && pricingRoot.__deckPricing) {
          pricingRoot.__deckPricing.setCars(n, true);
        }
      }
    }, true);

    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (!t || !t.classList) return;
      if (!t.classList.contains('dpf-soSeam-carsInput') && !t.classList.contains('dpf-pricing-carsInput')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        t.blur();
      }
    }, true);

    // Whenever a calc overlay is injected, re-patch from live cars
    var host = document.querySelector('[data-client-deck-overlay-host], .client-deck-overlayHost');
    if (host && window.MutationObserver) {
      var mo = new MutationObserver(function () {
        if (host.hidden) return;
        var modal = host.querySelector('.dpf-coldLeadsExplain-modal, .dpf-coldLeadsExplain-backdrop');
        if (modal) window.__deckRefreshMetricOverlay(modal);
      });
      mo.observe(host, { childList: true, subtree: true });
    }

    // Initial sync so all slides share the default book
    setTimeout(function () {
      var seed = readLiveCars();
      applyCars(seed, { live: false });
    }, 0);
  }

  function wirePricing() {
    var root = document.querySelector('.dpf-pricing');
    if (!root) return;

    var state = {
      cars: 200,
      rooftops: 1,
      agents: { salesInbound: true, salesOutbound: true, serviceInbound: true, serviceOutbound: true },
      integrations: {},
      offer: null,
      openCategory: null
    };

    // seed from DOM
    var carsInput = root.querySelector('.dpf-pricing-carsInput');
    var stepVal = root.querySelector('.dpf-pricing-stepperVal');
    if (carsInput) state.cars = parseInt(carsInput.value, 10) || 200;
    if (stepVal) state.rooftops = parseInt(stepVal.textContent, 10) || 1;
    root.querySelectorAll('.dpf-pricing-agentRow').forEach(function (row, i) {
      var key = AGENT_KEYS[i];
      if (!key) return;
      row.setAttribute('data-agent-key', key);
      var cb = row.querySelector('input[type="checkbox"]');
      state.agents[key] = !!(cb && cb.checked) || row.classList.contains('is-on');
    });

    function stop(e) { e.preventDefault(); e.stopPropagation(); }

    function render() {
      var pricing = computeViniPricing(state);
      var payback = computePricingPayback(pricing);

      if (stepVal) stepVal.textContent = String(state.rooftops);
      if (carsInput && document.activeElement !== carsInput) carsInput.value = String(state.cars);

      var hints = root.querySelectorAll('.dpf-pricing-configItem .dpf-pricing-configHint');
      if (hints[0]) {
        var next = pricing.nextVolume;
        if (next && next.need > 0) {
          hints[0].textContent = 'Add ' + next.need + ' more rooftop' + (next.need === 1 ? '' : 's') + ' to unlock ' + Math.round(next.rate * 100) + '% off';
        } else if (pricing.gDisc > 0) {
          hints[0].textContent = Math.round(pricing.gDisc * 100) + '% volume discount applied';
        } else {
          hints[0].textContent = 'Add rooftops to unlock volume discounts';
        }
      }
      if (hints[1]) {
        var totalCars = state.cars * state.rooftops;
        hints[1].textContent = 'Total cars · ' + totalCars.toLocaleString('en-US')
          + (state.rooftops > 1 ? (' (' + state.rooftops + ' × ' + state.cars.toLocaleString('en-US') + ')') : '');
      }

      root.querySelectorAll('.dpf-pricing-agentRow').forEach(function (row) {
        var key = row.getAttribute('data-agent-key');
        if (!key) return;
        var on = !!state.agents[key];
        row.classList.toggle('is-on', on);
        var cb = row.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = on;
        var price = row.querySelector('.dpf-pricing-agentPrice');
        if (price) price.textContent = fmtUsd(pricing.tier[key]);
        var expand = row.querySelector('.dpf-pricing-agentExpand');
        var highlights = pricingAgentHighlights(key, state.cars);
        if (highlights.length) {
          if (!expand) {
            expand = document.createElement('div');
            expand.className = 'dpf-pricing-agentExpand';
            var main = row.querySelector('.dpf-pricing-agentMain');
            if (main) main.appendChild(expand);
          }
          expand.classList.toggle('is-open', on);
          expand.innerHTML = '<div class="dpf-pricing-agentExpandInner"><ul class="dpf-pricing-agentChecklist">'
            + highlights.map(function (h) { return '<li>' + CHECK_SVG + h + '</li>'; }).join('')
            + '</ul></div>';
        } else if (expand) {
          expand.remove();
        }
      });

      // summary
      var badge = root.querySelector('.dpf-pricing-summaryBadge');
      if (badge) badge.textContent = pricing.activeCount + ' agent' + (pricing.activeCount === 1 ? '' : 's');
      var ctx = root.querySelector('.dpf-pricing-summaryCtx');
      if (ctx) ctx.innerHTML = '<b>' + (state.cars * state.rooftops).toLocaleString('en-US') + '</b> total cars · <b>' + state.rooftops + '</b> rooftop' + (state.rooftops === 1 ? '' : 's');
      var amount = root.querySelector('.dpf-pricing-summaryAmount');
      if (amount) amount.textContent = fmtUsd(pricing.perRooftop);
      var metrics = root.querySelectorAll('.dpf-pricing-summaryMetricVal');
      if (metrics[0]) metrics[0].textContent = fmtUsd(pricing.monthlyTotal);
      if (metrics[1]) metrics[1].textContent = fmtUsd(pricing.annualTotal);

      var linesHost = root.querySelector('.dpf-pricing-summaryBody > div:not(.dpf-pricing-summarySavings)');
      // structure: summaryBody has sectionLabel, div(lines), summarySavings
      var body = root.querySelector('.dpf-pricing-summaryBody');
      if (body) {
        var lineWrap = body.querySelector(':scope > div:not(.dpf-pricing-summarySavings)');
        if (!lineWrap) {
          lineWrap = document.createElement('div');
          var sav = body.querySelector('.dpf-pricing-summarySavings');
          if (sav) body.insertBefore(lineWrap, sav); else body.appendChild(lineWrap);
        }
        lineWrap.innerHTML = pricing.agentLines.map(function (l) {
          return '<div class="dpf-pricing-summaryLine"><span>' + l.name + '</span><span>' + fmtUsd(l.price) + '</span></div>';
        }).join('') + (pricing.intCost > 0
          ? '<div class="dpf-pricing-summaryLine"><span>Integrations</span><span>' + fmtUsd(pricing.intCost) + '</span></div>'
          : '');
        var savWrap = body.querySelector('.dpf-pricing-summarySavings');
        if (!savWrap) {
          savWrap = document.createElement('div');
          savWrap.className = 'dpf-pricing-summarySavings';
          body.appendChild(savWrap);
        }
        savWrap.innerHTML = pricing.savings.map(function (s) {
          return '<div class="dpf-pricing-summaryLine dpf-pricing-summaryLine--save"><span>' + s.label + '<small>' + s.hint + '</small></span><span>− ' + fmtUsd(s.amount) + '</span></div>';
        }).join('');
      }

      var intSummary = root.querySelector('.dpf-pricing-intSummary');
      if (intSummary) {
        var n = pricing.activeIntegrations.length;
        intSummary.innerHTML = n === 0 ? 'None selected' : ('<b>' + n + '</b> selected · <b>' + fmtUsd(pricing.intCost) + '</b>/rooftop');
      }

      // offers link
      var offersLink = root.querySelector('.dpf-pricing-offersLink');
      if (offersLink) {
        var offerCount = (pricing.bundleAmt > 0.5 ? 1 : 0) + (pricing.volumeAmt > 0.5 ? 1 : 0) + (pricing.offerAmt > 0.5 ? 1 : 0);
        // React shows "1 offer applied" for bundle; keep similar
        var applied = pricing.savings.length;
        offersLink.textContent = applied > 0 ? (applied + ' offer' + (applied > 1 ? 's' : '') + ' applied') : 'View current offers';
      }

      // payback
      var nums = root.querySelector('.dpf-pricing-paybackNums');
      if (nums && payback.enabled) {
        var html = '';
        if (payback.hasSales) html += '<p class="dpf-pricing-paybackStat"><b>' + payback.salesAppts + '</b><span>extra sales appointments</span></p>';
        if (payback.hasService) html += '<p class="dpf-pricing-paybackStat"><b>' + payback.serviceAppts + '</b><span>extra service appointments</span></p>';
        nums.classList.toggle('is-split', payback.hasSales && payback.hasService);
        nums.innerHTML = html || '<p class="dpf-pricing-paybackStat"><b>—</b><span>select an agent</span></p>';
      } else if (nums) {
        nums.innerHTML = '<p class="dpf-pricing-paybackStat"><b>—</b><span>select an agent</span></p>';
      }
    }

    function setCars(n, skipSeam) {
      state.cars = Math.max(1, Math.min(99999, Math.round(Number(n) || 0)));
      render();
      if (!skipSeam && window.__deckApplyCarsSeam) window.__deckApplyCarsSeam(state.cars);
      else if (!skipSeam) {
        document.querySelectorAll('.dpf-soSeam-carsInput').forEach(function (inp) {
          if (document.activeElement !== inp) inp.value = String(state.cars);
        });
      }
    }

    root.__deckPricing = { setCars: setCars, render: render, state: state };

    // Rooftop steppers
    var stepper = root.querySelector('.dpf-pricing-stepper');
    if (stepper) {
      var btns = stepper.querySelectorAll('button');
      if (btns[0]) btns[0].addEventListener('click', function (e) { stop(e); state.rooftops = Math.max(1, state.rooftops - 1); render(); });
      if (btns[1]) btns[1].addEventListener('click', function (e) { stop(e); state.rooftops = Math.min(999, state.rooftops + 1); render(); });
    }

    if (carsInput) {
      carsInput.addEventListener('click', function (e) { e.stopPropagation(); });
      carsInput.addEventListener('keydown', function (e) { e.stopPropagation(); });
      carsInput.addEventListener('input', function () {
        var n = parseInt(String(carsInput.value).replace(/\D/g, ''), 10) || 0;
        state.cars = n || state.cars;
        render();
        // Live deck-wide sync is handled by wireCarsSeamRecalc input listener
      });
      carsInput.addEventListener('blur', function () {
        if (!state.cars) state.cars = 100;
        render();
        if (window.__deckApplyCarsSeam) window.__deckApplyCarsSeam(state.cars, { skipPricing: true });
      });
    }

    root.querySelectorAll('.dpf-pricing-agentRow').forEach(function (row) {
      var key = row.getAttribute('data-agent-key');
      var cb = row.querySelector('input[type="checkbox"]');
      var label = row.querySelector('.dpf-pricing-switch');
      function toggle(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        state.agents[key] = !state.agents[key];
        render();
      }
      if (cb) cb.addEventListener('change', function (e) { e.stopPropagation(); state.agents[key] = !!cb.checked; render(); });
      if (label) label.addEventListener('click', function (e) { e.stopPropagation(); });
      row.addEventListener('click', function (e) {
        if (e.target.closest('.dpf-pricing-switch') || e.target.closest('input')) return;
        // optional: click row toggles
      });
    });

    // Integrations dropdowns
    var INT_BY_CAT = {};
    VINI_INTEGRATION_CATEGORIES.forEach(function (cat) {
      INT_BY_CAT[cat.label] = integrationsForCategory(cat.key);
    });

    root.querySelectorAll('.dpf-pricing-intGroup').forEach(function (group) {
      var label = (group.querySelector('.dpf-pricing-intGroupLabel') || {}).textContent || '';
      var cat = VINI_INTEGRATION_CATEGORIES.find(function (c) { return c.label === label; });
      if (!cat) return;
      group.setAttribute('data-int-cat', cat.key);
      var dropdown = group.querySelector('.dpf-pricing-intDropdown');
      var trigger = group.querySelector('.dpf-pricing-intTrigger');
      if (!dropdown || !trigger) return;

      function ensureMenu() {
        var menu = dropdown.querySelector('.dpf-pricing-intMenu');
        if (menu) return menu;
        menu = document.createElement('div');
        menu.className = 'dpf-pricing-intMenu';
        menu.setAttribute('role', 'listbox');
        menu.setAttribute('aria-label', cat.label + ' integrations');
        integrationsForCategory(cat.key).forEach(function (it) {
          var opt = document.createElement('div');
          opt.className = 'dpf-pricing-intOpt' + (it.live ? '' : ' is-not-live');
          opt.setAttribute('role', 'option');
          opt.setAttribute('data-int-key', it.key);
          opt.innerHTML = '<span class="dpf-pricing-intOptLeft"><span class="dpf-pricing-intCheckbox"></span><span class="dpf-pricing-intOptName">' + it.name + '</span></span><span class="dpf-pricing-intCost">' + (!it.live ? '<span class="dpf-pricing-intNotLiveDot" aria-hidden="true"></span>' : '') + formatIntegrationPrice(it) + '</span>';
          opt.addEventListener('click', function (e) {
            stop(e);
            state.integrations[it.key] = !state.integrations[it.key];
            renderIntGroup();
            render();
          });
          menu.appendChild(opt);
        });
        dropdown.appendChild(menu);
        return menu;
      }

      function renderIntGroup() {
        var items = integrationsForCategory(cat.key);
        var selected = items.filter(function (it) { return state.integrations[it.key]; });
        var span = trigger.querySelector('span');
        if (span) span.textContent = selected.length === 0 ? 'Select' : (selected.length + ' selected');
        dropdown.classList.toggle('is-open', state.openCategory === cat.key);
        var menu = dropdown.querySelector('.dpf-pricing-intMenu');
        if (menu) {
          menu.querySelectorAll('.dpf-pricing-intOpt').forEach(function (opt) {
            var k = opt.getAttribute('data-int-key');
            opt.classList.toggle('is-on', !!state.integrations[k]);
            opt.setAttribute('aria-selected', state.integrations[k] ? 'true' : 'false');
          });
        }
        var tags = group.querySelector('.dpf-pricing-intSelected');
        if (!tags) {
          tags = document.createElement('div');
          tags.className = 'dpf-pricing-intSelected';
          group.appendChild(tags);
        }
        tags.innerHTML = selected.map(function (it) {
          return '<span class="dpf-pricing-intTag' + (it.live ? '' : ' is-not-live') + '"><span>' + it.name + '</span><span class="dpf-pricing-intTagCost">' + (!it.live ? '<span class="dpf-pricing-intNotLiveDot" aria-hidden="true"></span>' : '') + formatIntegrationPrice(it) + '</span><button type="button" aria-label="Remove ' + it.name + '" data-remove="' + it.key + '">✕</button></span>';
        }).join('');
        tags.querySelectorAll('button[data-remove]').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            stop(e);
            state.integrations[btn.getAttribute('data-remove')] = false;
            renderIntGroup();
            render();
          });
        });
      }

      trigger.addEventListener('click', function (e) {
        stop(e);
        ensureMenu();
        state.openCategory = state.openCategory === cat.key ? null : cat.key;
        root.querySelectorAll('.dpf-pricing-intDropdown').forEach(function (d) { d.classList.remove('is-open'); });
        renderIntGroup();
      });
      renderIntGroup();
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.dpf-pricing-intDropdown')) {
        state.openCategory = null;
        root.querySelectorAll('.dpf-pricing-intDropdown.is-open').forEach(function (d) { d.classList.remove('is-open'); });
      }
    });

    // CTA → Spyne
    var cta = root.querySelector('.dpf-pricing-cta');
    if (cta) {
      cta.addEventListener('click', function (e) {
        stop(e);
        window.open('https://www.spyne.ai/', '_blank', 'noopener,noreferrer');
      });
    }

    // Payback info
    var info = root.querySelector('.dpf-pricing-paybackInfo');
    if (info) {
      info.addEventListener('click', function (e) {
        stop(e);
        var p = computePricingPayback(computeViniPricing(state));
        var msg = 'Break-even uses discounted agent cost per rooftop (integrations excluded).\n\n'
          + 'Sales GP / appt ≈ ' + Math.round(p.showPct) + '% show × ' + Math.round(p.closePct) + '% close × $' + Math.round(p.gpPerSale).toLocaleString('en-US')
          + ' = ' + fmtUsd(p.gpPerSalesAppt) + '\n'
          + 'Service GP / appt = ' + fmtUsd(p.gpPerServiceAppt) + '\n\n'
          + (p.hasSales ? ('Sales: ' + p.salesAppts + ' extra appointments / rooftop / month\n') : '')
          + (p.hasService ? ('Service: ' + p.serviceAppts + ' extra appointments / rooftop / month\n') : '');
        alert(msg);
      });
    }

    // Offers: apply VINI10 via prompt when clicking offers link if none
    var offersLink = root.querySelector('.dpf-pricing-offersLink');
    if (offersLink) {
      offersLink.addEventListener('click', function (e) {
        stop(e);
        var code = window.prompt('Enter offer code (e.g. VINI10). Leave blank to clear.', state.offer ? state.offer.code : 'VINI10');
        if (code === null) return;
        if (!String(code).trim()) { state.offer = null; render(); return; }
        var applied = applyOfferCode(code);
        if (!applied) { alert('Unknown offer code'); return; }
        state.offer = applied;
        render();
      });
    }

    render();
  }

  // boot after other deck scripts
  function boot() {
    try { wirePricing(); } catch (err) { console.error('[deck modules] pricing', err); }
    try { wireCarsSeamRecalc(); } catch (err) { console.error('[deck modules] cars', err); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);

})();
