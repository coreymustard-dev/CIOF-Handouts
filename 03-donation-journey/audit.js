#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const args        = process.argv.slice(2);
// Support --url <url> flag in addition to positional URL argument
const urlFlagIdx  = args.indexOf('--url');
const urlFlagVal  = urlFlagIdx !== -1 && args[urlFlagIdx + 1] ? args[urlFlagIdx + 1] : null;
const positional  = args.filter((a, i) => a.startsWith('http') && i !== urlFlagIdx + 1);
const urlArgs     = urlFlagVal ? [urlFlagVal, ...positional] : positional;
const urlArg      = urlArgs[0];
const donationUrl = urlArgs[1] || null;   // optional — go straight to form
const skipMobile  = args.includes('--no-mobile');
const helpFlag    = args.includes('--help') || args.includes('-h');
// --output <dir> flag for a custom output directory
const outputFlagIdx = args.indexOf('--output');
const outputFlagDir = outputFlagIdx !== -1 && args[outputFlagIdx + 1] ? args[outputFlagIdx + 1] : null;

if (helpFlag || !urlArg) {
  console.log(`
Donation Audit Rubric — Playwright-based donation flow auditor

Usage:
  node audit.js <homepage-url> [donation-url] [options]

Arguments:
  homepage-url   Required. The org's main website.
  donation-url   Optional. Direct URL of the donation form — skips crawling
                 and screenshots the form directly on both desktop & mobile.

Options:
  --no-mobile   Skip mobile viewport run
  --help        Show this help

Examples:
  node audit.js https://rnli.org
  node audit.js https://www.salvationarmy.org.nz/ https://secure.flo2cash.co.nz/donations/SalvationArmy/DonateSecure.aspx
  node audit.js https://stjude.org --no-mobile
`);
  process.exit(urlArg ? 0 : 1);
}

// Dynamically find the Chromium binary Playwright installed.
// Searches ~/Library/Caches/ms-playwright/ for any version, on both arm64 and x64.
function findChromiumExecutable(homeDir) {
  const cacheDir = path.join(homeDir, 'Library', 'Caches', 'ms-playwright');
  if (!fs.existsSync(cacheDir)) return null;

  const arch    = process.arch === 'arm64' ? 'arm64' : 'x64';
  const found   = [];

  let dirs;
  try { dirs = fs.readdirSync(cacheDir); } catch { return null; }

  for (const dir of dirs) {
    // Headless shell (preferred — smaller and faster)
    if (dir.startsWith('chromium_headless_shell')) {
      const p = path.join(cacheDir, dir, `chrome-headless-shell-mac-${arch}`, 'chrome-headless-shell');
      if (fs.existsSync(p)) found.push(p);
    }
    // Full Chromium build
    if (dir.startsWith('chromium-')) {
      const p = path.join(cacheDir, dir, `chrome-mac-${arch}`,
        'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
      if (fs.existsSync(p)) found.push(p);
    }
  }

  if (found.length === 0) return null;
  // Sort descending so the highest version number (latest) is first
  return found.sort().reverse()[0];
}

let targetUrl = urlArg;
if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
try { new URL(targetUrl); } catch { console.error('Invalid URL:', targetUrl); process.exit(1); }
if (donationUrl) {
  try { new URL(donationUrl); } catch { console.error('Invalid donation URL:', donationUrl); process.exit(1); }
}

const hostname  = new URL(targetUrl).hostname.replace(/^www\./, '');
const orgName   = hostname.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const desktopDir = path.join(process.env.HOME || '/tmp', 'Desktop');
const auditDir   = outputFlagDir || path.join(desktopDir, `${orgName}-audit`);
const screenshotsDir = path.join(auditDir, 'screenshots');
[auditDir, screenshotsDir].forEach(d => fs.mkdirSync(d, { recursive: true }));

async function runInteractivePrompts(auditDir, desktop) {
  const readline = require('readline');
  const answersPath = path.join(auditDir, 'interactive-answers.json');

  if (fs.existsSync(answersPath)) {
    const saved = JSON.parse(fs.readFileSync(answersPath, 'utf8'));
    console.log('  Using saved answers from interactive-answers.json — delete it to re-answer.');
    return saved;
  }

  const answers = {
    isUKOrg: null,
    hasGiftAid: null,
    thankYouPersonalised: null,
    receiptWithin5Min: null,
    monthlyUpsellOnThankYou: null,
    donorSelfServicePortal: null,
    dynamicAskAmounts: null,
    confirmedWalletPayments: null,
    hasImpactMessaging: null,
  };

  // When stdin is a pipe (non-TTY), read ALL lines upfront before prompting.
  // This avoids readline closing the interface after the first batch of data arrives.
  let pipeLines = null;
  let pipeIdx   = 0;
  let rl        = null;

  if (!process.stdin.isTTY) {
    pipeLines = await new Promise(resolve => {
      const chunks = [];
      process.stdin.setEncoding('utf8');
      process.stdin.on('data',  c => chunks.push(c));
      process.stdin.on('end',   () => resolve(chunks.join('').split('\n').map(l => l.trim())));
      process.stdin.on('error', () => resolve([]));
      if (process.stdin.readableEnded) resolve([]);
    });
  } else {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }

  const ask = async (question) => {
    if (pipeLines !== null) {
      const answer = pipeIdx < pipeLines.length ? pipeLines[pipeIdx++] : '';
      process.stdout.write(question + answer + '\n');
      return answer.toLowerCase();
    }
    return new Promise(resolve =>
      rl.question(question, a => resolve((a || '').trim().toLowerCase()))
    );
  };

  const parseYN = (raw) => {
    if (/^y(es)?$/.test(raw)) return true;
    if (/^n(o)?$/.test(raw)) return false;
    return null;
  };

  console.log('\n--- Manual Verification ---');
  console.log('Answer each question with y (yes) or n (no). Press Enter to skip if unsure.\n');

  // UK / Gift Aid block
  let isUK = desktop.isUKOrg;
  if (isUK === null) {
    const raw = await ask('Q: Is your organisation based in the UK and registered with HMRC for Gift Aid? (y/n): ');
    isUK = parseYN(raw);
    answers.isUKOrg = isUK;
  } else {
    answers.isUKOrg = isUK;
  }

  if (isUK === true) {
    const raw = await ask('Q: Is there a Gift Aid prompt on your donation form? (y/n): ');
    answers.hasGiftAid = parseYN(raw);
  }

  // Post-donation questions (always asked)
  answers.thankYouPersonalised = parseYN(
    await ask('Q: After donating, is the donor taken to a personalised thank-you page (shows their name and gift amount)? (y/n): '));
  answers.receiptWithin5Min = parseYN(
    await ask('Q: Does a donation receipt email arrive within 5 minutes? (y/n): '));
  answers.monthlyUpsellOnThankYou = parseYN(
    await ask("Q: Does the thank-you page offer an upgrade to monthly/recurring giving? (y/n): "));
  answers.donorSelfServicePortal = parseYN(
    await ask("Q: Can donors manage or cancel their recurring gift online without calling? (y/n/don't know): "));
  answers.dynamicAskAmounts = parseYN(
    await ask("Q: Do donation ask amounts change per campaign or for returning donors (dynamic asks)? (y/n/don't know): "));

  // Wallet payments — only ask if both Apple Pay and Google Pay are undetected
  const pay = desktop.paymentOptions || {};
  if (!pay.applePay && !pay.googlePay) {
    answers.confirmedWalletPayments = parseYN(
      await ask('Q: Is Apple Pay or Google Pay available on your donation form? (y/n): '));
  }

  // Impact messaging — only ask if not already detected
  const ux = desktop.amountUX || {};
  if (!ux.hasImpactText) {
    answers.hasImpactMessaging = parseYN(
      await ask('Q: Does the donation form show impact messaging (e.g. "£25 funds one hour of research")? (y/n): '));
  }

  if (rl) rl.close();

  fs.writeFileSync(answersPath, JSON.stringify(answers, null, 2));
  console.log(`  ✓ Saved interactive answers → ${answersPath}`);

  return answers;
}

async function main() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error(`
ERROR: Playwright is not installed.
Run setup first:
  cd ~/Desktop/cursor_tools/nonprofit-audit-v2
  npm install
  npx playwright install chromium
`);
    process.exit(1);
  }

  const { walkFlow }     = require('./lib/flow');
  const { writeReports } = require('./lib/report');

  console.log(`\n🔍 Donation Audit Rubric`);
  console.log(`   Org:  ${orgName}`);
  console.log(`   URL:  ${targetUrl}`);
  if (donationUrl) console.log(`   Form: ${donationUrl}`);
  console.log(`   Out:  ${auditDir}\n`);

  // Dynamically locate the Chromium binary installed by Playwright.
  // Works on any version of Playwright and on both Apple Silicon (arm64) and Intel (x64) Macs.
  const os = require('os');
  const executablePath = findChromiumExecutable(os.homedir());
  if (!executablePath) {
    console.error(`
ERROR: Could not find a Playwright Chromium binary.

Fix: run the following in your Terminal, then try again:
  cd ~/Desktop/cursor_tools/nonprofit-audit-v2
  npx playwright install chromium

If that still fails, check your architecture:
  node -e "console.log(process.arch)"
Then look for matching binaries in:
  ~/Library/Caches/ms-playwright/
`);
    process.exit(1);
  }
  console.log(`  Using browser: ${executablePath}\n`);

  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let desktopResult, mobileResult;

  try {
    console.log('▶ Desktop run (1280×800)…');
    desktopResult = await walkFlow(browser, targetUrl, screenshotsDir,
      { width: 1280, height: 800 }, 'desktop', donationUrl);
    console.log(`  ✓ ${desktopResult.steps.length} steps, ${desktopResult.screenshots.length} screenshots`);
    desktopResult.errors.forEach(e => console.warn('  ⚠', e));

    if (!skipMobile) {
      console.log('\n▶ Mobile run (375×812)…');
      mobileResult = await walkFlow(browser, targetUrl, screenshotsDir,
        { width: 375, height: 812 }, 'mobile', donationUrl);
      console.log(`  ✓ ${mobileResult.steps.length} steps, ${mobileResult.screenshots.length} screenshots`);
      mobileResult.errors.forEach(e => console.warn('  ⚠', e));
    }
  } finally {
    await browser.close();
  }

  // Download and base64-encode the org logo for embedding in the HTML report
  const brand = desktopResult.brandAssets || {};
  if (brand.logoUrl) {
    try {
      const https = require('https');
      const http  = require('http');
      const { URL: NodeURL } = require('url');
      const parsed   = new NodeURL(brand.logoUrl);
      const protocol = parsed.protocol === 'https:' ? https : http;
      const logoPath = path.join(auditDir, 'logo_source');

      await new Promise((resolve) => {
        const req = protocol.get(brand.logoUrl, { timeout: 8000 }, (res) => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => {
            const buf      = Buffer.concat(chunks);
            const mimeMap  = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                               '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
                               '.ico': 'image/x-icon' };
            const ext      = path.extname(parsed.pathname).toLowerCase() || '.png';
            const mime     = mimeMap[ext] || 'image/png';
            brand.logoBase64 = `data:${mime};base64,${buf.toString('base64')}`;
            console.log(`  ✓ Logo downloaded (${Math.round(buf.length / 1024)}KB)`);
            resolve();
          });
        });
        req.on('error', (e) => { console.warn('  ⚠ Logo download failed:', e.message); resolve(); });
        req.on('timeout', ()  => { req.destroy(); console.warn('  ⚠ Logo download timed out'); resolve(); });
      });
    } catch (e) {
      console.warn('  ⚠ Logo download error:', e.message);
    }
  }

  console.log('\n💬 Running interactive verification…');
  const interactiveAnswers = await runInteractivePrompts(auditDir, desktopResult);

  // Merge interactive answers back into desktopResult before scoring
  if (interactiveAnswers.isUKOrg !== null && interactiveAnswers.isUKOrg !== undefined
      && desktopResult.isUKOrg === null) {
    desktopResult.isUKOrg = interactiveAnswers.isUKOrg;
  }
  if (interactiveAnswers.confirmedWalletPayments === true) {
    desktopResult.paymentOptions = { ...(desktopResult.paymentOptions || {}), applePay: true };
  }
  if (interactiveAnswers.hasImpactMessaging === true) {
    desktopResult.amountUX = { ...(desktopResult.amountUX || {}), hasImpactText: true };
  }
  if (interactiveAnswers.dynamicAskAmounts === true) {
    desktopResult.amountUX = { ...(desktopResult.amountUX || {}), isDynamic: true };
  }

  console.log('\n📄 Writing reports…');
  const { jsonPath, mdPath, maturity, salesSignals } = writeReports(
    orgName, targetUrl, desktopResult, mobileResult, auditDir, interactiveAnswers);

  const ts = desktopResult.techStack || {};

  // Cursor-readable summary for Agent mode to consume — stored in _data/
  const dataDir = path.join(auditDir, '_data');
  fs.mkdirSync(dataDir, { recursive: true });
  const cursorSummary = {
    orgName, url: targetUrl,
    donationPlatform:  ts.donationPlatforms?.map(p=>p.name) || [],
    cms:               ts.cms?.map(p=>p.name) || [],
    crm:               ts.crm?.map(p=>p.name) || [],
    analytics:         ts.analytics?.map(p=>p.name) || [],
    gtmContainers:     ts.gtmContainers || [],
    consent:           ts.consent?.map(p=>p.name) || [],
    cro:               ts.cro?.map(p=>p.name) || [],
    paymentOptions:    Object.entries(desktopResult.paymentOptions||{}).filter(([,v])=>v).map(([k])=>k),
    hasRecurring:      desktopResult.amountUX?.hasRecurringToggle,
    monthlyDefault:    desktopResult.amountUX?.monthlyIsDefault,
    flowSteps:         desktopResult.steps?.length,
    formArchitecture:  desktopResult.isDonationCrossDomain ? 'cross-domain-redirect'
      : desktopResult.formArchitecture?.pageIsExternal ? 'external-redirect'
      : desktopResult.formArchitecture?.externalIframeCount > 0 ? 'external-iframe'
      : desktopResult.formArchitecture?.hasInlineForm ? 'same-domain-form' : 'unknown',
    isDonationCrossDomain: desktopResult.isDonationCrossDomain || false,
    donationDomain:    desktopResult.donationDomain || null,
    brandColor:        brand.brandColor  || null,
    logoUrl:           brand.logoUrl     || null,
    logoBase64:        brand.logoBase64  || null,
    orgDisplayName:    brand.orgDisplayName || orgName,
    auditDir, screenshotsDir, mdPath, jsonPath,
  };
  fs.writeFileSync(path.join(dataDir, 'cursor-summary.json'), JSON.stringify(cursorSummary, null, 2));

  console.log(`
╔══════════════════════════════════════════════════════════════╗
  ${orgName.toUpperCase()} — DONATION AUDIT RUBRIC COMPLETE
╚══════════════════════════════════════════════════════════════╝

  → Open your report:
    ${mdPath}

  Screenshots saved to: ${screenshotsDir}
  To re-answer the manual questions, delete:
    ${path.join(auditDir, 'interactive-answers.json')}
`);
}

main().catch(err => { console.error('\n✗ Fatal error:', err.message); process.exit(1); });
