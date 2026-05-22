'use strict';

const fs   = require('fs');
const path = require('path');
const {
  collectPageSignals, detectAll, findDonateLinks,
  detectFormArchitecture, detectAmountUX, detectPaymentOptions,
  detectCheckoutUX, mergeTechStack,
} = require('./detectors');

const NAV_TIMEOUT  = 30000;
const STEP_TIMEOUT = 20000;

async function extractBrandAssets(page, startUrl) {
  const assets = await page.evaluate(() => {
    const get = (sel, attr) => document.querySelector(sel)?.getAttribute(attr) || null;

    // Brand colour: theme-color meta → nav/header background → null
    let brandColor = get('meta[name="theme-color"]', 'content');
    if (!brandColor) {
      const navEl = document.querySelector('nav, header, .site-header, [role="navigation"]');
      if (navEl) {
        const bg = window.getComputedStyle(navEl).backgroundColor;
        const m  = bg?.match(/\d+/g);
        if (m && m.length >= 3) {
          const hex = '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
          if (!['#000000', '#ffffff', '#000', '#fff'].includes(hex.toLowerCase())) brandColor = hex;
        }
      }
    }

    // Logo: og:image → apple-touch-icon → largest favicon
    const logoUrl =
      get('meta[property="og:image"]', 'content') ||
      get('link[rel="apple-touch-icon"]', 'href') ||
      get('link[rel="icon"][sizes]', 'href') ||
      get('link[rel="shortcut icon"]', 'href') ||
      get('link[rel="icon"]', 'href') ||
      null;

    // Org name from og:site_name or og:title
    const orgDisplayName =
      get('meta[property="og:site_name"]', 'content') ||
      get('meta[property="og:title"]', 'content') ||
      document.title ||
      null;

    return { brandColor, logoUrl, orgDisplayName };
  });

  // Resolve relative logo URL to absolute
  if (assets.logoUrl && !assets.logoUrl.startsWith('http')) {
    try { assets.logoUrl = new URL(assets.logoUrl, startUrl).href; } catch {}
  }

  return assets;
}

async function walkFlow(browser, startUrl, screenshotsDir, viewport, viewportLabel, donationUrl = null) {
  const contextOptions = {
    viewport,
    recordVideo: { dir: screenshotsDir, size: viewport },
  };
  if (viewport.width <= 500) {
    contextOptions.userAgent =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  }
  const context = await browser.newContext(contextOptions);

  const page = await context.newPage();
  const result = {
    viewport: viewportLabel,
    homepageUrl: startUrl,
    directDonationUrlProvided: !!donationUrl,
    donateLinks: [], chosenLink: null,
    steps: [], formArchitecture: null,
    amountUX: null, paymentOptions: null,
    checkoutUX: null, techStack: null,
    checkoutObservation: { level: 0, stage: 'landing', evidence: [] },
    screenshots: [], videoPath: null, errors: [],
  };

  const screenshot = async (label) => {
    const safeName = label.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const filePath = path.join(screenshotsDir, `${viewportLabel}_${safeName}.png`);
    try {
      await page.screenshot({ path: filePath, fullPage: true, timeout: 10000 });
      result.screenshots.push({ label, path: filePath });
    } catch (e) {
      result.errors.push(`Screenshot failed (${label}): ${e.message}`);
    }
    return filePath;
  };

  try {
    console.log(`  [${viewportLabel}] Loading homepage…`);
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(2500);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await screenshot('01_homepage');

    const homepageSignals = await collectPageSignals(page);
    result.techStack = detectAll(homepageSignals);
    result.isUKOrg = await detectUKOrg(page, startUrl);
    console.log(`  [${viewportLabel}] UK org: ${result.isUKOrg === null ? 'uncertain' : result.isUKOrg}`);
    result.brandAssets = await extractBrandAssets(page, startUrl);
    result.hasViewportMeta = await page.evaluate(() => !!document.querySelector('meta[name="viewport"]'));
    const initialLinks = await findDonateLinks(page);
    await expandNavigationMenus(page);
    const expandedLinks = await findDonateLinks(page);
    result.donateLinks = mergeDonateLinks(initialLinks, expandedLinks);
    if (!result.donateLinks.some(l => l.explicitDonate)) {
      const fallback = await findDonateInHeaderSource(page, startUrl);
      if (fallback) {
        result.donateLinks = mergeDonateLinks(result.donateLinks, [fallback]);
      }
    }
    if (result.donateLinks.length > 0) {
      result.chosenLink =
        result.donateLinks.find(l => l.href && l.inNav && l.explicitDonate && !l.inFooter) ||
        result.donateLinks.find(l => l.href && l.visible && l.inNav && l.explicitDonate && !l.inFooter) ||
        result.donateLinks.find(l => l.href && l.visible && l.explicitDonate && !l.inFooter) ||
        result.donateLinks.find(l => l.href && l.visible && l.inNav && !l.inFooter) ||
        result.donateLinks.find(l => l.href && l.isButton && !l.inFooter) ||
        result.donateLinks.find(l => l.href && !l.inFooter) ||
        result.donateLinks.find(l => l.href) ||
        result.donateLinks[0];
    }
    console.log(`  [${viewportLabel}] Found ${result.donateLinks.length} donate entry point(s) on homepage`);

    if (donationUrl) {
      // Direct donation URL provided — skip crawling, go straight to the form
      console.log(`  [${viewportLabel}] Navigating directly to donation form: ${donationUrl}`);
      try {
        await page.goto(donationUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        await page.waitForTimeout(3000);
      } catch (e) {
        result.errors.push(`Navigation to donation URL: ${e.message}`);
      }
      await screenshot('02_donation_page');
      const donationPageUrl = page.url();

      // Save full rendered HTML source of the donation page (desktop run only — avoids duplicate)
      if (viewportLabel === 'desktop') {
        try {
          const htmlSource = await page.content();
          const dataDir    = path.join(screenshotsDir, '..', '_data');
          fs.mkdirSync(dataDir, { recursive: true });
          const htmlPath   = path.join(dataDir, 'donation_page_source.html');
          fs.writeFileSync(htmlPath, htmlSource, 'utf8');
          result.donationPageSourcePath = htmlPath;
        } catch (e) {
          result.errors.push(`HTML source save failed: ${e.message}`);
        }
      }

      result.steps.push({ step: 1, url: donationPageUrl, description: 'Donation form (direct)' });
      result.formArchitecture = await detectFormArchitecture(page, donationPageUrl);
      await advanceDonationFlow(page, result, screenshot);
      result.amountUX         = await detectAmountUX(page);
      result.paymentOptions   = await detectPaymentOptions(page);
      result.checkoutUX       = await detectCheckoutUX(page);
      result.hasGiftAidPrompt = await detectGiftAidPrompt(page);
      await augmentCheckoutFromFrames(page, result);
      await augmentAmountFromFrames(page, result);
      await updateCheckoutObservation(page, result, 'direct-donation-page');
      await probeStepTwo(page, donationPageUrl, result, screenshot);
      await augmentCheckoutFromFrames(page, result);
      await augmentAmountFromFrames(page, result);
      const donationSignals   = await collectPageSignals(page);
      mergeTechStack(result.techStack, detectAll(donationSignals));
      result.techStack.dataLayer = donationSignals.dataLayer;

      // Compare donation page domain to homepage domain — catch cross-domain redirects
      // that the form architecture detector can't see (it only looks at the current page).
      try {
        const startHost    = new URL(startUrl).hostname.replace(/^www\./, '');
        const donationHost = new URL(donationPageUrl).hostname.replace(/^www\./, '');
        result.isDonationCrossDomain = startHost !== donationHost;
        result.donationDomain = donationHost;
      } catch {
        result.isDonationCrossDomain = false;
      }
    } else {
      if (result.donateLinks.length === 0) {
        result.errors.push('No donate links found on homepage.');
        await context.close();
        return result;
      }
      const primaryLink = result.chosenLink || result.donateLinks[0];

      result.chosenLink = primaryLink;

      console.log(`  [${viewportLabel}] Navigating to: ${primaryLink.href || primaryLink.text}`);
      try {
        if (primaryLink.href) {
          await page.goto(primaryLink.href, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        } else {
          const el = page.getByText(new RegExp(primaryLink.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first();
          await el.click({ timeout: STEP_TIMEOUT });
          await page.waitForLoadState('domcontentloaded', { timeout: NAV_TIMEOUT });
        }
      } catch (e) {
        result.errors.push(`Navigation to donate page: ${e.message}`);
      }

      await page.waitForTimeout(3000);
      await screenshot('02_donation_page');

      const crawledDonationUrl = page.url();

      // Save full rendered HTML source of the donation page (desktop run only — avoids duplicate)
      if (viewportLabel === 'desktop') {
        try {
          const htmlSource = await page.content();
          const dataDir    = path.join(screenshotsDir, '..', '_data');
          fs.mkdirSync(dataDir, { recursive: true });
          const htmlPath   = path.join(dataDir, 'donation_page_source.html');
          fs.writeFileSync(htmlPath, htmlSource, 'utf8');
          result.donationPageSourcePath = htmlPath;
        } catch (e) {
          result.errors.push(`HTML source save failed: ${e.message}`);
        }
      }

      result.steps.push({ step: 1, url: crawledDonationUrl, description: 'Donation landing page' });

      result.formArchitecture = await detectFormArchitecture(page, crawledDonationUrl);
      await advanceDonationFlow(page, result, screenshot);
      result.amountUX         = await detectAmountUX(page);
      result.paymentOptions   = await detectPaymentOptions(page);
      result.checkoutUX       = await detectCheckoutUX(page);
      result.hasGiftAidPrompt = await detectGiftAidPrompt(page);
      await augmentCheckoutFromFrames(page, result);
      await augmentAmountFromFrames(page, result);
      await updateCheckoutObservation(page, result, 'crawled-donation-page');
      await probeStepTwo(page, crawledDonationUrl, result, screenshot);
      await augmentCheckoutFromFrames(page, result);
      await augmentAmountFromFrames(page, result);

      const donationSignals = await collectPageSignals(page);
      mergeTechStack(result.techStack, detectAll(donationSignals));
      result.techStack.dataLayer = donationSignals.dataLayer;

      // Compare donation page domain to homepage domain
      try {
        const startHost    = new URL(startUrl).hostname.replace(/^www\./, '');
        const landedHost   = new URL(crawledDonationUrl).hostname.replace(/^www\./, '');
        result.isDonationCrossDomain = startHost !== landedHost;
        result.donationDomain = landedHost;
      } catch {
        result.isDonationCrossDomain = false;
      }
    }

    await walkFlowSteps(page, result, screenshot);

  } catch (err) {
    result.errors.push(`Flow error: ${err.message}`);
  } finally {
    await context.close();
    try {
      const videos = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.webm'));
      if (videos.length > 0) {
        const newName = path.join(screenshotsDir, `${viewportLabel}_flow.webm`);
        try { fs.renameSync(path.join(screenshotsDir, videos[videos.length - 1]), newName); } catch {}
        result.videoPath = newName;
      }
    } catch {}
  }

  return result;
}

async function walkFlowSteps(page, result, screenshot) {
  let stepNum = 3;
  const MAX_STEPS = 6;
  const visited   = new Set([page.url()]);

  for (let i = 0; i < MAX_STEPS; i++) {
    const PROGRESS = /\b(next|continue|proceed|get started|select amount|choose amount|give now|donate now)\b/i;
    const STOP     = /\b(pay|submit|complete|confirm|process|authorize|authorise|charge)\b/i;

    try {
      const buttons = await page.evaluate((pRe, sRe) => {
        return Array.from(document.querySelectorAll('button, input[type="submit"], a.btn, [role="button"]'))
          .filter(el => {
            const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
            return new RegExp(pRe).test(t) && !new RegExp(sRe).test(t);
          })
          .map(el => ({ text: (el.innerText || el.value || '').trim().slice(0, 60), visible: el.offsetParent !== null }));
      }, PROGRESS.source, STOP.source);

      if (buttons.length === 0) break;

      const target = buttons.find(b => b.visible) || buttons[0];
      console.log(`  [step ${stepNum}] Clicking: "${target.text}"`);

      try {
        await page.getByRole('button', {
          name: new RegExp(target.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        }).first().click({ timeout: STEP_TIMEOUT });
      } catch {
        await page.getByText(
          new RegExp(target.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        ).first().click({ timeout: STEP_TIMEOUT });
      }

      await page.waitForTimeout(2500);
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});

      const newUrl = page.url();
      if (visited.has(newUrl)) break;
      visited.add(newUrl);

      await screenshot(`0${stepNum}_step_${i + 2}`);

      const ux = await detectCheckoutUX(page);
      result.steps.push({
        step: stepNum - 1,
        url: newUrl,
        description: `Step ${stepNum - 1}: ${target.text}`,
        fieldCount: ux.fieldCount,
      });

      const isPaymentPage = await page.evaluate(() =>
        /card.?number|cvv|cvc|expir|pay.?now|complete.?donation|billing/i.test(document.documentElement.innerHTML)
      );

      if (isPaymentPage) {
        console.log(`  [${result.viewport}] Reached payment step — stopping`);
        result.paymentOptions = await detectPaymentOptions(page);
        await screenshot(`0${stepNum}_payment_step`);
        result.steps[result.steps.length - 1].description += ' (payment step — stopped)';
        break;
      }

      stepNum++;
    } catch (e) {
      result.errors.push(`Step ${i + 1}: ${e.message}`);
      break;
    }
  }
}

module.exports = { walkFlow };

async function detectUKOrg(page, startUrl) {
  try {
    const hostname = new URL(startUrl).hostname.toLowerCase();
    const isUKDomain = hostname.endsWith('.co.uk') || hostname.endsWith('.org.uk');

    const signals = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const html = document.documentElement?.innerHTML || '';
      return {
        hasRegisteredCharity: /registered charity/i.test(text) || /registered charity/i.test(html),
        hasCharityNumber: /registered charity.{0,30}(no\.?\s*)?\d{6,8}/i.test(text) || /registered charity.{0,30}(no\.?\s*)?\d{6,8}/i.test(html),
        hasPoundOnly: /£/.test(text) && !/\$/.test(text),
        hasPostcode: /\bpostcode\b/i.test(text) && !/\bzip\s*code\b/i.test(text),
        hasDollar: /\$/.test(text),
        hasZipCode: /\bzip\s*code\b/i.test(text),
      };
    });

    // Strong US signals: .org (non-UK) + dollar currency + zip code → definitively not UK
    const isOrgDomain = hostname.endsWith('.org') && !hostname.endsWith('.org.uk');
    if (isOrgDomain && signals.hasDollar && signals.hasZipCode) return false;

    const ukSignalCount = [
      isUKDomain,
      signals.hasRegisteredCharity,
      signals.hasCharityNumber,
      signals.hasPoundOnly,
      signals.hasPostcode,
    ].filter(Boolean).length;

    if (ukSignalCount >= 2) return true;
    return null;
  } catch {
    return null;
  }
}

async function detectGiftAidPrompt(page) {
  try {
    return await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const html = document.documentElement?.innerHTML || '';
      return /gift\s*aid/i.test(text) || /gift\s*aid/i.test(html);
    });
  } catch {
    return false;
  }
}

function mergeDonateLinks(a = [], b = []) {
  const merged = [...a, ...b];
  const map = new Map();
  for (const item of merged) {
    const key = `${item.href || '(button)'}|${item.text}`.toLowerCase();
    if (!map.has(key) || (item.score || 0) > (map.get(key).score || 0)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values()).sort((x, y) => (y.score || 0) - (x.score || 0));
}

async function expandNavigationMenus(page) {
  try {
    const toggles = page.locator(
      'button[aria-label*=\"menu\" i], button[aria-label*=\"navigation\" i], button[aria-label*=\"toggle\" i], .header-toggle, [class*=\"menu-toggle\" i]'
    );
    const count = await toggles.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      const t = toggles.nth(i);
      if (await t.isVisible().catch(() => false)) {
        await t.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(350);
      }
    }
  } catch {
    // Non-fatal: if we can't expand nav, continue with current DOM.
  }
}

async function findDonateInHeaderSource(page, startUrl) {
  try {
    const html = await page.content();
    const headerChunkMatch = html.match(/<header[\s\S]{0,25000}<\/header>/i);
    const chunk = headerChunkMatch ? headerChunkMatch[0] : html.slice(0, 50000);
    const hrefMatch =
      chunk.match(/href=["']([^"']*\/donate[^"']*)["']/i) ||
      html.match(/href=["']([^"']*\/donate[^"']*)["']/i);
    if (!hrefMatch) return null;
    const href = new URL(hrefMatch[1], startUrl).href;
    return {
      text: 'Donate',
      href,
      tag: 'a',
      visible: false,
      y: 0,
      aboveFold: true,
      inNav: true,
      inFooter: false,
      isButton: true,
      explicitDonate: true,
      score: 13,
    };
  } catch {
    return null;
  }
}

async function probeStepTwo(page, currentUrl, result, screenshot) {
  try {
    const urlObj = new URL(currentUrl);
    if (!/\/donate/i.test(urlObj.pathname)) return;
    if (urlObj.searchParams.has('step')) return;
    urlObj.searchParams.set('step', '2');
    const step2Url = urlObj.toString();

    await page.goto(step2Url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(2000);
    const step2UX = await detectCheckoutUX(page);
    await updateCheckoutObservation(page, result, 'step-2-probe');
    const currentFields = result.checkoutUX?.fieldCount || 0;
    if ((step2UX?.fieldCount || 0) >= currentFields) {
      result.checkoutUX = step2UX;
      result.paymentOptions = await detectPaymentOptions(page);
      result.steps.push({
        step: result.steps.length + 1,
        url: step2Url,
        description: 'Step 2 probe',
        fieldCount: step2UX.fieldCount,
      });
      await screenshot('03_step2_probe');
    }
  } catch {
    // Some flows don't expose step query params; ignore probe failures.
  }
}

async function advanceDonationFlow(page, result, screenshot) {
  try {
    const oneOffCandidates = [
      'button:has-text("One-off")',
      'button:has-text("One off")',
      'button:has-text("Single donation")',
      'button:has-text("Single")',
      '[role="tab"]:has-text("One")',
    ];
    for (const sel of oneOffCandidates) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
        await loc.click({ timeout: 2500 }).catch(() => {});
        await page.waitForTimeout(350);
        break;
      }
    }

    const amountRadio = page.locator('[data-component="donate-widget"] input[type="radio"]:not([disabled])').first();
    if (await amountRadio.count() > 0 && await amountRadio.isVisible().catch(() => false)) {
      await amountRadio.check({ timeout: 2500 }).catch(async () => {
        await amountRadio.click({ timeout: 2500 }).catch(() => {});
      });
      await page.waitForTimeout(350);
    } else {
      const amountButton = page.locator('button:has-text("£"), [role="button"]:has-text("£")').first();
      if (await amountButton.count() > 0 && await amountButton.isVisible().catch(() => false)) {
        await amountButton.click({ timeout: 2500 }).catch(() => {});
        await page.waitForTimeout(350);
      }
    }

    const continueCandidates = [
      'button:has-text("Continue")',
      'button:has-text("Next")',
      'button:has-text("Proceed")',
      '[role="button"]:has-text("Continue")',
      'a:has-text("Continue")',
    ];
    for (const sel of continueCandidates) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
        await loc.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1200);
        await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
        result.steps.push({
          step: result.steps.length + 1,
          url: page.url(),
          description: 'Interactive advance',
        });
        await screenshot(`0${Math.min(9, result.steps.length + 1)}_interactive_advance`);
        break;
      }
    }
  } catch {
    // Best-effort only: some flows are not safely automatable.
  }
}

async function updateCheckoutObservation(page, result, sourceLabel) {
  try {
    const evidence = await page.evaluate(() => {
      const text = (document.body?.innerText || '').toLowerCase();
      const full = (document.documentElement?.innerHTML || '').toLowerCase();
      const detailsPattern = /(first name|last name|email address|postcode|address line|gift aid|your details|billing address)/;
      const paymentPattern = /(card number|cvv|cvc|expiry|exp date|paypal|apple pay|google pay|bank account|sort code|iban|payment method)/;
      const hasDetails = detailsPattern.test(text) || detailsPattern.test(full);
      const hasPayment = paymentPattern.test(text) || paymentPattern.test(full);
      return { hasDetails, hasPayment };
    });
    let level = 0;
    let stage = 'landing';
    if (evidence.hasPayment) { level = 2; stage = 'payment'; }
    else if (evidence.hasDetails) { level = 1; stage = 'details'; }
    if (level > (result.checkoutObservation?.level || 0)) {
      result.checkoutObservation = {
        level,
        stage,
        evidence: [...(result.checkoutObservation?.evidence || []), `${sourceLabel}:${stage}`],
      };
    } else {
      result.checkoutObservation = {
        ...(result.checkoutObservation || { level: 0, stage: 'landing', evidence: [] }),
        evidence: [...(result.checkoutObservation?.evidence || []), `${sourceLabel}:${stage}`],
      };
    }
  } catch {
    // Non-fatal observation failure.
  }
}

async function augmentCheckoutFromFrames(page, result) {
  try {
    const frames = page.frames();
    let best = null;
    for (const frame of frames) {
      if (frame === page.mainFrame()) continue;
      const metrics = await frame.evaluate(() => {
        const isVisible = (el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) return false;
          return true;
        };
        const controls = Array.from(document.querySelectorAll('input, select, textarea')).filter(isVisible);
        const normalized = controls.filter(el => {
          const type = (el.type || '').toLowerCase();
          return !['hidden', 'submit', 'button', 'reset', 'image', 'file', 'search'].includes(type);
        });
        const textLike = normalized.filter(el => !['checkbox', 'radio'].includes((el.type || '').toLowerCase()));
        const required = normalized.filter(el =>
          el.hasAttribute('required') ||
          el.getAttribute('aria-required') === 'true' ||
          /\brequired\b/i.test((el.outerHTML || '').slice(0, 400))
        ).length;
        const text = (document.body?.innerText || '').toLowerCase();
        const hasEmailConfirm = /confirm\s+email|re-?enter\s+email|repeat\s+email|email\s+again/.test(text);
        return {
          fieldCount: normalized.length,
          textFieldCount: textLike.length,
          requiredFieldCount: required,
          hasEmailConfirmationFriction: hasEmailConfirm,
          hasAutocomplete: normalized.some(el => el.autocomplete && el.autocomplete !== 'off'),
          hasAddressLookup: /postcode|address.*lookup|find your address|post\s?code lookup/i.test(text),
          hasProgressBar: document.querySelector('[class*="progress"], [class*="step"], [aria-label*="step" i]') !== null,
          detectedContainerTag: 'iframe',
        };
      }).catch(() => null);
      if (!metrics) continue;
      if (!best || (metrics.fieldCount || 0) > (best.fieldCount || 0)) {
        best = metrics;
      }
    }

    if (best && (best.fieldCount || 0) > (result.checkoutUX?.fieldCount || 0)) {
      result.checkoutUX = { ...(result.checkoutUX || {}), ...best };
    }
  } catch {
    // Non-fatal; main-frame checkout data will still be used.
  }
}

async function augmentAmountFromFrames(page, result) {
  try {
    const frames = page.frames();
    for (const frame of frames) {
      if (frame === page.mainFrame()) continue;
      const frameData = await frame.evaluate(() => {
        const text = document.body?.innerText || '';
        const full = (document.documentElement?.innerHTML || '').toLowerCase();
        const amountMatches = text.match(/(?:£|\$|€)\s?\d{1,4}(?:[.,]\d{1,2})?/g) || [];
        const presetAmounts = [...new Set(amountMatches)];

        const inputs = Array.from(document.querySelectorAll('input'));
        const hasCustomAmountInput = inputs.some(el => {
          const name = (el.name || '').toLowerCase();
          const id   = (el.id || '').toLowerCase();
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          const ph   = (el.placeholder || '').toLowerCase();
          return name.includes('amount') || id.includes('amount') || aria.includes('amount') || ph.includes('amount');
        }) || /enter another amount|other amount|custom amount/i.test(text);

        const hasRecurringToggle = /monthly|recurring|regular/i.test(text);

        return {
          presetAmounts,
          hasCustomAmountInput,
          hasRecurringToggle,
          paymentOptions: {
            card:      /credit.?card|debit.?card|visa|mastercard|amex/.test(full),
            paypal:    /paypal/.test(full),
            applePay:  /apple.?pay/.test(full),
            googlePay: /google.?pay/.test(full),
            ach:       /\bach\b|bank.?transfer|direct.?debit|e.?check/.test(full),
          },
        };
      }).catch(() => null);

      if (!frameData) continue;

      // Merge amountUX: prefer frame data if it has more presets or main-frame had none
      const mainPresets = result.amountUX?.presetAmounts?.length || 0;
      if (frameData.presetAmounts.length > mainPresets || mainPresets === 0) {
        result.amountUX = {
          ...(result.amountUX || {}),
          presetAmounts: frameData.presetAmounts.length > 0 ? frameData.presetAmounts : result.amountUX?.presetAmounts,
          hasCustomAmountInput: frameData.hasCustomAmountInput || result.amountUX?.hasCustomAmountInput,
          hasRecurringToggle: frameData.hasRecurringToggle || result.amountUX?.hasRecurringToggle,
        };
      } else {
        result.amountUX = {
          ...(result.amountUX || {}),
          hasCustomAmountInput: frameData.hasCustomAmountInput || result.amountUX?.hasCustomAmountInput,
          hasRecurringToggle: frameData.hasRecurringToggle || result.amountUX?.hasRecurringToggle,
        };
      }

      // Merge payment options found in frames
      if (result.paymentOptions) {
        result.paymentOptions = {
          ...result.paymentOptions,
          card:      result.paymentOptions.card      || frameData.paymentOptions.card,
          paypal:    result.paymentOptions.paypal    || frameData.paymentOptions.paypal,
          applePay:  result.paymentOptions.applePay  || frameData.paymentOptions.applePay,
          googlePay: result.paymentOptions.googlePay || frameData.paymentOptions.googlePay,
          ach:       result.paymentOptions.ach       || frameData.paymentOptions.ach,
        };
      } else {
        result.paymentOptions = { ...(result.paymentOptions || {}), ...frameData.paymentOptions };
      }
    }
  } catch {
    // Non-fatal; main-frame amount/payment data will still be used.
  }
}
