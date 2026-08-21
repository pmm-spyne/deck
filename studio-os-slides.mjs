/**
 * Studio OS / Visual Merchandising slides for the client deck.
 * Layout/visuals match Spyne pitch references; fonts/colors/backgrounds match Vini deck.
 * Injected after Vini Pricing. Assets live in docs/client-deck/assets/.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const STUDIO_ASSETS_DIR = join(__dirname, 'assets');

const SMART_SHOOT_GIF =
  'https://spyne-static.s3.us-east-1.amazonaws.com/production-website/studio-product-releases/public/product/studio-ai/Product-feature-gifs/Smart+Shoot.gif';

const A = {
  slide27: 'assets/studio-slide-27.png',
  slide28: 'assets/studio-slide-28.png',
  shootGif: SMART_SHOOT_GIF,
  images: 'assets/studio-images.mp4',
  carTours: 'assets/studio-car-tours.mp4',
  beforeAfter: 'assets/studio-before-after.png',
  andrew: 'assets/andrew-riffee.png',
  alyssa: 'assets/alyssa-hulbert.png',
  logoDimmitt: 'assets/logo-dimmitt.png',
  logoAsbury: 'assets/logos/proven-asbury.png',
  logoPerformance: 'assets/logos/proven-performance.png',
  logoVanMossel: 'assets/logos/proven-van-mossel.png',
  logoBobJohnson: 'assets/logos/proven-bob-johnson.png',
  logoRussDarrow: 'assets/logos/proven-russ-darrow.png',
  logoBigMotoring: 'assets/logos/proven-big-motoring.png',
  logoClayCooley: 'assets/logos/proven-clay-cooley.png',
};

export const STUDIO_OS_CSS = `
/* ── Studio OS — reference layouts, Vini type/color ── */
.cd-studio {
  --cd-purple: #7537e0;
  --cd-purple-soft: #7c3aed;
  --cd-ink: #17131f;
  --cd-muted: #6f6a80;
  --cd-line: #ebe4f8;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 100%;
  padding: clamp(24px, 2.8vh, 40px) clamp(32px, 3.6vw, 64px);
  display: flex;
  flex-direction: column;
  font-family: "Plus Jakarta Sans", Inter, system-ui, sans-serif;
  color: var(--cd-ink);
  background:
    radial-gradient(900px 520px at 0% 50%, rgba(124, 58, 237, 0.07), transparent 60%),
    radial-gradient(800px 480px at 100% 50%, rgba(117, 55, 224, 0.05), transparent 55%),
    #ffffff;
}
.cd-studio *,
.cd-studio *::before,
.cd-studio *::after { box-sizing: border-box; }

.cd-studio-eye {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--cd-purple-soft);
}
.cd-studio-title {
  margin: 0;
  font-size: clamp(34px, 3.6vw, 52px);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.05;
  color: var(--cd-ink);
}
.cd-studio-title em {
  font-style: normal;
  color: var(--cd-purple);
}
.cd-studio-sub {
  margin: 14px 0 0;
  max-width: 36rem;
  font-size: clamp(16px, 1.4vw, 19px);
  font-weight: 500;
  line-height: 1.45;
  color: var(--cd-muted);
}
.cd-studio-sub strong {
  color: var(--cd-purple);
  font-weight: 700;
}

/* ── Full-bleed PDF slide art (Studio OS Suite) ── */
.cd-studio--artBleed {
  padding: 0;
  background: #fff;
  align-items: center;
  justify-content: center;
}
.cd-studio-artBleed {
  width: 100%;
  height: 100%;
  min-height: 100%;
  display: block;
  object-fit: contain;
  object-position: center;
  background: #fff;
}
.cd-studio--artBleedScaled {
  padding: clamp(20px, 3vh, 40px) clamp(24px, 3vw, 48px);
  background:
    radial-gradient(900px 520px at 0% 50%, rgba(124, 58, 237, 0.05), transparent 60%),
    #ffffff;
}
.cd-studio--artBleedScaled .cd-studio-artBleed {
  width: 72%;
  height: auto;
  max-height: 88%;
  min-height: 0;
  margin: auto;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(23, 19, 31, 0.08);
}

/* ── Hero (legacy layout kept for CSS compatibility) ── */
.cd-studio--hero {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: clamp(16px, 2vw, 40px);
  align-items: center;
  padding-left: clamp(12px, 1.5vw, 28px);
  padding-right: clamp(28px, 4vw, 72px);
}
.cd-studio-heroArt {
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cd-studio-heroArt img {
  width: 100%;
  max-height: min(78vh, 820px);
  object-fit: contain;
  object-position: center;
  display: block;
  filter: hue-rotate(-28deg) saturate(1.05);
}
.cd-studio-heroCopy {
  padding-left: clamp(8px, 1vw, 20px);
}
.cd-studio--hero .cd-studio-title {
  font-size: clamp(48px, 5.2vw, 76px);
  letter-spacing: -0.04em;
}
.cd-studio--hero .cd-studio-title em {
  background: linear-gradient(90deg, #7537e0 0%, #9b6cff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* ── Suite (ref: vertical label + product mosaic) ── */
.cd-studio--suite {
  flex-direction: row;
  align-items: stretch;
  gap: 18px;
  padding-top: clamp(18px, 2vh, 28px);
  padding-bottom: clamp(18px, 2vh, 28px);
}
.cd-studio-suiteRail {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 8px 4px;
}
.cd-studio-suiteRail span {
  font-size: clamp(15px, 1.35vw, 18px);
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--cd-ink);
  white-space: nowrap;
}
.cd-studio-suiteRail em {
  font-style: normal;
  color: var(--cd-purple);
}
.cd-studio-suiteArt {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(124, 58, 237, 0.04), rgba(124, 58, 237, 0.02));
  border: 1px solid var(--cd-line);
  overflow: hidden;
  padding: 10px;
}
.cd-studio-suiteArt img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  filter: hue-rotate(-28deg) saturate(1.05);
}

/* ── Shoot (ref: centered title + large media) ── */
.cd-studio--shoot {
  align-items: center;
  text-align: center;
  justify-content: center;
}
.cd-studio--shoot .cd-studio-title {
  font-size: clamp(28px, 3vw, 42px);
}
.cd-studio--shoot .cd-studio-sub {
  margin-left: auto;
  margin-right: auto;
}
.cd-studio-shootFrame {
  margin-top: 22px;
  width: min(980px, 100%);
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--cd-line);
  background: #f7f4fc;
  box-shadow: 0 18px 48px rgba(88, 48, 160, 0.10);
  aspect-ratio: 16 / 9;
}
.cd-studio-shootFrame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ── Formats (3 media columns) ── */
.cd-studio--formats {
  justify-content: center;
}
.cd-studio--formats .cd-studio-formatGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: 18px;
  margin-top: 24px;
  min-height: 0;
}
.cd-studio-formatCard {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 18px;
  border: 1px solid var(--cd-line);
  background: #fff;
  box-shadow: 0 10px 28px rgba(88, 48, 160, 0.06);
  overflow: hidden;
}
.cd-studio-formatHead {
  padding: 16px 18px 12px;
}
.cd-studio-formatHead h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.cd-studio-formatHead p {
  margin: 6px 0 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--cd-muted);
  line-height: 1.35;
}
.cd-studio-formatMedia {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #0f0d14;
}
.cd-studio-formatMedia video,
.cd-studio-formatMedia img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ── Canva embed (Spyne AI Vehicle Merchandising) — full-bleed, no deck chrome ── */
.cd-studio--canva {
  padding: 0;
  background: #fff;
  align-items: stretch;
  justify-content: stretch;
}
.cd-studio-canvaWrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100%;
  flex: 1;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border-radius: 0;
  border: none;
  box-shadow: none;
  background: #fff;
}
.cd-studio-canvaWrap iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0;
  margin: 0;
}

.cd-studio-benefits {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}
.cd-studio-benefit {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--cd-line);
  background: rgba(255, 255, 255, 0.92);
}
.cd-studio-benefit b {
  display: block;
  font-size: 13px;
  font-weight: 700;
}
.cd-studio-benefit span {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--cd-muted);
  font-weight: 500;
}

/* ── Proven impact ── */
.cd-studio--proven {
  justify-content: flex-start;
  gap: clamp(22px, 2.6vh, 30px);
  padding: clamp(40px, 5vh, 64px) clamp(48px, 5.5vw, 88px);
  background:
    radial-gradient(900px 520px at 0% 0%, rgba(124, 58, 237, 0.08), transparent 55%),
    #fcf8ff;
}
.cd-studio--proven .cd-studio-eye { color: #5b00a6; }
.cd-studio--proven .cd-studio-title {
  font-size: clamp(30px, 3.1vw, 44px);
}
.cd-studio--proven .cd-studio-sub {
  margin-top: 10px;
  max-width: 32rem;
  font-size: clamp(14px, 1.2vw, 17px);
}
.cd-studio-provenTop {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: clamp(16px, 2vh, 22px);
  width: 100%;
}
.cd-studio-provenCopy { min-width: 0; max-width: 40rem; }
.cd-studio-statStack,
.cd-studio-quotes {
  --cd-proven-gap: 14px;
  --cd-proven-radius: 12px;
  --cd-proven-border: 1px solid rgba(205, 148, 255, 0.45);
  display: grid;
  gap: var(--cd-proven-gap);
  width: 100%;
  margin: 0;
  flex: 0 0 auto;
}
.cd-studio-statStack {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 110px;
}
.cd-studio-quotes {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 110px;
}
.cd-studio-stat,
.cd-studio-quote {
  border-radius: var(--cd-proven-radius);
  border: var(--cd-proven-border);
  background: #fff;
  min-width: 0;
}
.cd-studio-stat {
  text-align: center;
  padding: 18px 12px 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f3e9ff 100%);
}
.cd-studio-stat b {
  display: block;
  margin: 0;
  font-size: clamp(24px, 2.4vw, 34px);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
  color: #111827;
}
.cd-studio-stat span {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #111827;
  line-height: 1.25;
}
.cd-studio-quote {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px 16px;
  min-height: 0;
}
.cd-studio-quote blockquote {
  margin: 0;
  font-size: clamp(12.5px, 1.05vw, 14.5px);
  font-weight: 500;
  line-height: 1.45;
  color: #0c111d;
}
.cd-studio-quoteMeta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px dashed rgba(17, 24, 39, 0.22);
}
.cd-studio-quoteMeta strong {
  display: block;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #111827;
}
.cd-studio-quoteMeta span {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  font-weight: 500;
  color: rgba(17, 24, 39, 0.7);
}
.cd-studio-quoteBrandWrap {
  background: #f6f6f6;
  border-radius: 6px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
}
.cd-studio-quoteBrand {
  height: 20px;
  width: auto;
  max-width: 100px;
  object-fit: contain;
  filter: brightness(0);
}
.cd-studio-trust {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  margin-top: auto;
  width: 100%;
}
.cd-studio-trusted {
  margin: 0;
  text-align: center;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: #2c2c2c;
}
.cd-studio-trusted strong {
  color: #2c2c2c;
  font-weight: 700;
}
.cd-studio-logoRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 28px 44px;
  width: 100%;
  padding: 8px 0 4px;
}
.cd-studio-logoRow img {
  height: 38px;
  width: auto;
  max-width: 170px;
  object-fit: contain;
  filter: brightness(0);
  opacity: 1;
  flex-shrink: 0;
}
.cd-studio-logoText {
  display: flex;
  align-items: center;
  height: 38px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #111;
  line-height: 1;
  white-space: nowrap;
  flex-shrink: 0;
}
`;

function frame(label, inner, { scrollable = false } = {}) {
  const slideClass = scrollable
    ? 'dpf-pitchSlide dpf-pitchSlide--scroll'
    : 'dpf-pitchSlide';
  return `<div class="dpf-pitchDeck-frame" aria-hidden="true"><div class="${slideClass}" data-pitch-slide="true" data-pitch-label="${label}" data-pitch-scroll="${scrollable ? '1' : '0'}"><div class="dpf-pitchSlide-inner">${inner}</div></div></div>`;
}

export function getStudioOsFrames() {
  const suite = frame(
    'Studio OS Suite',
    `<section class="cd-studio cd-studio--artBleed cd-studio--artBleedScaled" aria-label="Studio OS Suite">
      <img class="cd-studio-artBleed" src="${A.slide28}" alt="Studio OS Suite: From acquisition to sale" />
    </section>`,
  );

  const shoot = frame(
    'One 30-Second Shoot',
    `<section class="cd-studio cd-studio--shoot" aria-labelledby="cd-studio-shoot-title">
      <h2 id="cd-studio-shoot-title" class="cd-studio-title">One <em>30-Second</em> Shoot for High-Performing VDPs</h2>
      <div class="cd-studio-shootFrame">
        <img src="${A.shootGif}" alt="Smart Shoot — one 30-second capture" />
      </div>
    </section>`,
  );

  const formats = frame(
    'Images, Car Tours & Video',
    `<section class="cd-studio cd-studio--formats" aria-labelledby="cd-studio-formats-title">
      <h2 id="cd-studio-formats-title" class="cd-studio-title">Images, <em>Car Tours</em> &amp; Video</h2>
      <p class="cd-studio-sub">One 30-second shoot, every format your VDP needs.</p>
      <div class="cd-studio-formatGrid">
        <div class="cd-studio-formatCard">
          <div class="cd-studio-formatHead">
            <h3>Images</h3>
            <p>Studio-quality stills, every angle, ready for the listing.</p>
          </div>
          <div class="cd-studio-formatMedia">
            <video src="${A.images}" autoplay muted loop playsinline></video>
          </div>
        </div>
        <div class="cd-studio-formatCard">
          <div class="cd-studio-formatHead">
            <h3>Car Tours</h3>
            <p>360&deg; walkarounds that build trust before the visit.</p>
          </div>
          <div class="cd-studio-formatMedia">
            <video src="${A.carTours}" autoplay muted loop playsinline></video>
          </div>
        </div>
        <div class="cd-studio-formatCard">
          <div class="cd-studio-formatHead">
            <h3>Video</h3>
            <p>Cinematic before/after reveals for every listing.</p>
          </div>
          <div class="cd-studio-formatMedia">
            <img src="${A.beforeAfter}" alt="Before and after: raw capture to studio-finished listing image" />
          </div>
        </div>
      </div>
    </section>`,
  );

  const alissaQuote =
    'Spyne’s AI technology delivers premium, high-quality backgrounds with exceptional editing and visual appeal. Their team has made onboarding seamless and shown great flexibility as our dealerships navigate a major transition.';

  const proven = frame(
    'Studio OS Impact',
    `<section class="cd-studio cd-studio--proven" aria-labelledby="cd-studio-proven-title">
      <div class="cd-studio-provenTop">
        <div class="cd-studio-provenCopy">
          <p class="cd-studio-eye">Proven at scale</p>
          <h2 id="cd-studio-proven-title" class="cd-studio-title">Built for dealerships.<br />Proven in the <em>field</em>.</h2>
          <p class="cd-studio-sub">Real outcomes across images, car tours, and every listing.</p>
        </div>
        <div class="cd-studio-statStack" role="list">
          <div class="cd-studio-stat" role="listitem"><b>80%</b><span>Lower Turnaround Time</span></div>
          <div class="cd-studio-stat" role="listitem"><b>40%</b><span>Lower Merchandising Cost</span></div>
          <div class="cd-studio-stat" role="listitem"><b>2X</b><span>VDP Engagement</span></div>
          <div class="cd-studio-stat" role="listitem"><b>100%</b><span>Brand Consistency</span></div>
        </div>
        <div class="cd-studio-quotes">
        <article class="cd-studio-quote">
          <blockquote>“Our launch with Spyne was one of the most impressive launches that I've had in 20 years of automotive experience. Our results thus far have been excellent. We are grateful for the partnership!”</blockquote>
          <div class="cd-studio-quoteMeta">
            <div>
              <strong>Andrew Riffee</strong>
              <span>CMO &amp; CTO</span>
            </div>
            <span class="cd-studio-quoteBrandWrap">
              <img class="cd-studio-quoteBrand" src="${A.logoDimmitt}" alt="Dimmitt Automotive Group" />
            </span>
          </div>
        </article>
        <article class="cd-studio-quote">
          <blockquote>“${alissaQuote}”</blockquote>
          <div class="cd-studio-quoteMeta">
            <div>
              <strong>Alyssa M. Hulbert</strong>
              <span>Marketing Director</span>
            </div>
            <span class="cd-studio-quoteBrandWrap">
              <img class="cd-studio-quoteBrand" src="${A.logoRussDarrow}" alt="Russ Darrow Automotive Group" />
            </span>
          </div>
        </article>
        </div>
      </div>
      <div class="cd-studio-trust">
        <p class="cd-studio-trusted">Trusted by <strong>4,500+</strong> dealerships worldwide</p>
        <div class="cd-studio-logoRow" aria-label="Dealer group logos">
          <img src="${A.logoAsbury}" alt="Asbury Automotive Group" />
          <img src="${A.logoPerformance}" alt="Performance Automotive Network" />
          <img src="${A.logoVanMossel}" alt="Van Mossel" />
          <img src="${A.logoBigMotoring}" alt="Big Motoring World" />
          <img src="${A.logoRussDarrow}" alt="Russ Darrow Automotive Group" />
          <img src="${A.logoBobJohnson}" alt="Bob Johnson Auto Group" />
          <img src="${A.logoClayCooley}" alt="Clay Cooley Auto Group" />
          <span class="cd-studio-logoText">Greenway</span>
        </div>
      </div>
    </section>`,
  );

  return [suite, shoot, formats, proven];
}

export function injectStudioOsIntoDeckHtml(html, { css = STUDIO_OS_CSS } = {}) {
  let out = html;

  const studioLabels = [
    'Studio OS',
    'Studio OS Suite',
    'One 30-Second Shoot',
    'Images, Car Tours & Video',
    'Spyne AI Vehicle Merchandising',
    'Studio OS Impact',
  ];
  for (const label of studioLabels) {
    out = removeFrameByLabel(out, label);
  }

  out = out.replace(
    /\/\* CLIENT_DECK_STUDIO_OS_CSS_START \*\/[\s\S]*?\/\* CLIENT_DECK_STUDIO_OS_CSS_END \*\//g,
    '',
  );
  if (out.includes('</style>')) {
    out = out.replace(
      '</style>',
      `/* CLIENT_DECK_STUDIO_OS_CSS_START */\n${css}\n/* CLIENT_DECK_STUDIO_OS_CSS_END */\n</style>`,
    );
  }

  const frames = getStudioOsFrames().join('\n');
  const pricingMarker = 'data-pitch-label="Vini Pricing"';
  const pricingIdx = out.indexOf(pricingMarker);
  if (pricingIdx === -1) {
    throw new Error('Vini Pricing slide not found — cannot inject Studio OS slides');
  }

  const nextFrame = out.indexOf('<div class="dpf-pitchDeck-frame"', pricingIdx + pricingMarker.length);
  if (nextFrame === -1) {
    throw new Error('Could not locate Pricing frame boundaries');
  }
  out = `${out.slice(0, nextFrame)}${frames}\n${out.slice(nextFrame)}`;
  return out;
}

function removeFrameByLabel(html, label) {
  const needle = `data-pitch-label="${label}"`;
  let idx = html.indexOf(needle);
  while (idx !== -1) {
    const frameStart = html.lastIndexOf('<div class="dpf-pitchDeck-frame"', idx);
    if (frameStart === -1) break;
    const after = idx + needle.length;
    const nextFrame = html.indexOf('<div class="dpf-pitchDeck-frame"', after);
    const nav = html.indexOf('<div class="dpf-pitchDeck-nav"', after);
    let frameEnd = -1;
    if (nextFrame !== -1 && (nav === -1 || nextFrame < nav)) frameEnd = nextFrame;
    else if (nav !== -1) frameEnd = nav;
    if (frameEnd === -1) break;
    html = html.slice(0, frameStart) + html.slice(frameEnd);
    idx = html.indexOf(needle);
  }
  return html;
}
