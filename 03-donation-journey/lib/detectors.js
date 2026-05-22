'use strict';

const {
  DONATION_PLATFORMS, CMS_PLATFORMS, CRM_PLATFORMS,
  ANALYTICS_TOOLS, PIXEL_TOOLS, CRO_TOOLS,
  CONSENT_TOOLS, CHAT_TOOLS, P2P_PLATFORMS, INFRA_SIGNALS,
} = require('./patterns');

function matchPatterns(text, patternList) {
  const hits = [];
  for (const entry of patternList) {
    const matched = entry.patterns.some(p => p.test(text));
    if (matched) hits.push({ name: entry.name, confidence: 'confirmed' });
  }
  return hits;
}

async function collectPageSignals(page) {
  return page.evaluate(() => {
    const scripts     = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
    const inline      = Array.from(document.querySelectorAll('script:not([src])')).map(s => s.textContent).join('\n');
    const iframes     = Array.from(document.querySelectorAll('iframe[src]')).map(i => i.src);
    const links       = Array.from(document.querySelectorAll('link[href]')).map(l => l.href);
    const generators  = Array.from(document.querySelectorAll('meta[name="generator"]')).map(m => m.content);
    const html        = document.documentElement.outerHTML.slice(0, 200000);
    const dataLayer   = typeof window.dataLayer !== 'undefined'
      ? JSON.stringify(window.dataLayer).slice(0, 5000) : null;

    const gtmMatches  = (html + inline).match(/GTM-[A-Z0-9]+/g) || [];
    const ga4Matches  = (html + inline).match(/G-[A-Z0-9]{6,}/g) || [];
    const uaMatches   = (html + inline).match(/UA-\d+-\d+/g) || [];

    return {
      scriptSrcs: scripts, inlineScripts: inline,
      iframes, links, generators, html, dataLayer,
      gtmContainers:  [...new Set(gtmMatches)],
      ga4Properties:  [...new Set(ga4Matches)],
      uaProperties:   [...new Set(uaMatches)],
    };
  });
}

function detectAll(signals) {
  const corpus = [
    signals.html,
    ...signals.scriptSrcs,
    signals.inlineScripts,
    ...signals.iframes,
    ...signals.links,
  ].join('\n');

  return {
    donationPlatforms: matchPatterns(corpus, DONATION_PLATFORMS),
    cms:               matchPatterns(corpus, CMS_PLATFORMS),
    crm:               matchPatterns(corpus, CRM_PLATFORMS),
    analytics:         matchPatterns(corpus, ANALYTICS_TOOLS),
    pixels:            matchPatterns(corpus, PIXEL_TOOLS),
    cro:               matchPatterns(corpus, CRO_TOOLS),
    consent:           matchPatterns(corpus, CONSENT_TOOLS),
    chat:              matchPatterns(corpus, CHAT_TOOLS),
    p2p:               matchPatterns(corpus, P2P_PLATFORMS),
    infra:             matchPatterns(corpus, INFRA_SIGNALS),
    gtmContainers:     signals.gtmContainers,
    ga4Properties:     signals.ga4Properties,
    uaProperties:      signals.uaProperties,
    dataLayer:         signals.dataLayer,
    generators:        signals.generators,
    scriptSrcs:        signals.scriptSrcs,
  };
}

async function findDonateLinks(page) {
  return page.evaluate(() => {
    const DONATE = /\b(donat|give|contribut|support us|fund|appeal)\b/i;
    const results = [];
    document.querySelectorAll('a[href], [role="link"][href], button, [role="button"]').forEach(el => {
      const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      const href = el.href || el.getAttribute('href') || el.getAttribute('data-href') || null;
      if (DONATE.test(text) || DONATE.test(href)) {
        const rect = el.getBoundingClientRect();
        const inNav = !!el.closest('nav, header, [role="navigation"]');
        const inFooter = !!el.closest('footer');
        const isButton = el.classList.contains('btn') || el.classList.contains('button') || el.tagName.toLowerCase() === 'button';
        const visible = rect.width > 0 && rect.height > 0;
        const y = Math.max(0, Math.round(rect.top));
        const aboveFold = y <= Math.round(window.innerHeight * 0.8);
        const textLower = text.toLowerCase();
        const hrefLower = (href || '').toLowerCase();
        const explicitDonate = /\bdonate\b/.test(textLower) || hrefLower.includes('/donate');
        const score =
          (visible ? 6 : 0) +
          (aboveFold ? 3 : 0) +
          (inNav ? 4 : 0) +
          (explicitDonate ? 4 : 0) +
          (!inFooter ? 1 : 0) +
          (isButton ? 1 : 0);
        results.push({
          text: text.slice(0, 80), href, tag: 'a',
          visible,
          y,
          aboveFold,
          inNav,
          inFooter,
          isButton,
          explicitDonate,
          score,
        });
      }
    });
    document.querySelectorAll('input[type="submit"], input[type="button"]').forEach(el => {
      const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
      if (DONATE.test(text)) {
        const inNav = !!el.closest('nav, header');
        const inFooter = !!el.closest('footer');
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        const y = Math.max(0, Math.round(rect.top));
        const aboveFold = y <= Math.round(window.innerHeight * 0.8);
        const explicitDonate = /\bdonate\b/.test(text.toLowerCase());
        const score = (visible ? 6 : 0) + (aboveFold ? 3 : 0) + (inNav ? 4 : 0) + (explicitDonate ? 4 : 0) + (!inFooter ? 1 : 0) + 1;
        results.push({ text: text.slice(0, 80), href: null, tag: el.tagName.toLowerCase(),
          visible, y, aboveFold, inNav, inFooter, isButton: true, explicitDonate, score });
      }
    });
    const dedup = new Map();
    for (const item of results) {
      const key = `${item.href || '(button)'}|${item.text}`.toLowerCase();
      if (!dedup.has(key)) dedup.set(key, item);
    }
    return Array.from(dedup.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.visible !== b.visible) return a.visible ? -1 : 1;
      return 0;
    });
  });
}

async function detectFormArchitecture(page, currentUrl) {
  return page.evaluate((url) => {
    const iframes      = Array.from(document.querySelectorAll('iframe'));
    const forms        = Array.from(document.querySelectorAll('form'));
    const iframeSrcs   = iframes.map(i => i.src).filter(Boolean);
    const currentDomain = new URL(url).hostname.replace(/^www\./, '');
    const externalIframes = iframeSrcs.filter(src => {
      try { return !new URL(src).hostname.includes(currentDomain); } catch { return false; }
    });
    let pageDomain = '';
    try { pageDomain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    return {
      iframeCount: iframes.length, iframeSrcs,
      externalIframeCount: externalIframes.length, externalIframeSrcs: externalIframes,
      formCount: forms.length, hasInlineForm: forms.length > 0,
      pageIsExternal: !pageDomain.includes(currentDomain) && pageDomain !== '',
    };
  }, currentUrl);
}

async function detectAmountUX(page) {
  return page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const donateRoot =
      document.querySelector('[data-component="donate-widget"]') ||
      document.querySelector('[data-testid*="donate" i]') ||
      document.querySelector('form[action*="donat" i], form[action*="give" i]') ||
      document.body;
    const textCorpus = (donateRoot?.innerText || document.body?.innerText || '').replace(/\s+/g, ' ');
    const amountPattern = /(?:£|\$|€)\s?\d{1,4}(?:[.,]\d{1,2})?/g;
    const presetAmounts = [...new Set((textCorpus.match(amountPattern) || []).slice(0, 20))];
    const RECURRING = ['monthly', 'recurring', 'regular', 'give monthly', 'sustaining'];
    const hasRecurringToggle = RECURRING.some(p => textCorpus.toLowerCase().includes(p));
    const IMPACT = [/your\s+[\$£€]?\d+/i, /will\s+(help|feed|fund|provide|save)/i];
    const hasImpactText = IMPACT.some(p => p.test(textCorpus));
    const inputs = Array.from(document.querySelectorAll(
      [
        'input[type="number"]',
        'input[inputmode="decimal"]',
        'input[inputmode="numeric"]',
        'input[name*="amount" i]',
        'input[id*="amount" i]',
        'input[aria-label*="amount" i]',
        'input[aria-label*="other" i]',
        'input[placeholder*="amount" i]',
        'input[placeholder*="other" i]',
        '[data-component="donate-widget"] input[type="text"]',
      ].join(', ')
    )).filter(el => {
      const type = (el.type || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'radio', 'checkbox'].includes(type)) return false;
      return true;
    });
    const customAmountText = /enter another amount|other amount|custom amount|enter an amount/i.test(textCorpus);
    const hasCustomAmountInput = inputs.length > 0 || customAmountText;
    const monthlyChecked = Array.from(document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked'))
      .some(el => /monthly|recurring/i.test(el.value + el.id + el.name));
    return { presetAmounts, hasRecurringToggle, monthlyIsDefault: monthlyChecked, hasImpactText, hasCustomAmountInput };
  });
}

async function detectPaymentOptions(page) {
  return page.evaluate(() => {
    const full = (document.documentElement.innerHTML +
      Array.from(document.querySelectorAll('script')).map(s => s.src + s.textContent).join(' ')).toLowerCase();
    return {
      card:      /credit.?card|debit.?card|visa|mastercard|amex/.test(full),
      paypal:    /paypal/.test(full),
      applePay:  /apple.?pay/.test(full),
      googlePay: /google.?pay/.test(full),
      amazonPay: /amazon.?pay/.test(full),
      venmo:     /venmo/.test(full),
      ach:       /\bach\b|bank.?transfer|direct.?debit|e.?check/.test(full),
      daf:       /donor.?advised|daf\b|chariot|daffy/.test(full),
      crypto:    /crypto|bitcoin/.test(full),
    };
  });
}

async function detectCheckoutUX(page) {
  return page.evaluate(() => {
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) return false;
      return true;
    };

    const getText = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const donationKeywords = /(donat|gift aid|your details|payment|regular donation|one[- ]?off|monthly|support us|email|postcode|address)/i;
    const candidates = [
      ...Array.from(document.querySelectorAll('form')),
      ...Array.from(document.querySelectorAll('[data-component*="donat" i], [data-testid*="donat" i], [id*="donat" i], [class*="donat" i]')),
      document.querySelector('main'),
      document.body,
    ].filter(Boolean);
    const uniqueCandidates = Array.from(new Set(candidates));

    const scoreContainer = (root) => {
      const text = getText(root);
      const keywordHits = (text.match(new RegExp(donationKeywords, 'gi')) || []).length;
      const controls = Array.from(root.querySelectorAll('input, select, textarea')).filter(isVisible);
      return keywordHits * 5 + controls.length;
    };

    let root = uniqueCandidates[0] || document.body;
    let bestScore = -1;
    for (const c of uniqueCandidates) {
      const s = scoreContainer(c);
      if (s > bestScore) {
        bestScore = s;
        root = c;
      }
    }

    const controls = Array.from(root.querySelectorAll('input, select, textarea')).filter(isVisible);
    const normalizedControls = controls.filter(el => {
      const type = (el.type || '').toLowerCase();
      // Exclude obvious non-donation controls.
      return !['hidden', 'submit', 'button', 'reset', 'image', 'file', 'search'].includes(type);
    });
    const textLikeControls = normalizedControls.filter(el => !['checkbox', 'radio'].includes((el.type || '').toLowerCase()));

    const labelTextFor = (el) => {
      const id = el.id;
      let label = '';
      if (id) {
        label = document.querySelector(`label[for="${id}"]`)?.innerText || '';
      }
      if (!label) {
        label = el.closest('label')?.innerText || '';
      }
      return label.replace(/\s+/g, ' ').trim().toLowerCase();
    };

    const requiredFieldCount = normalizedControls.filter(el => {
      const label = labelTextFor(el);
      const htmlSnippet = (el.outerHTML || '').slice(0, 500).toLowerCase();
      return (
        el.hasAttribute('required') ||
        el.getAttribute('aria-required') === 'true' ||
        /\brequired\b/.test(htmlSnippet) ||
        /\*/.test(label) ||
        /\brequired\b/.test(label)
      );
    }).length;

    const hasAutocomplete  = normalizedControls.some(el => el.autocomplete && el.autocomplete !== 'off');
    const rootHtml = (root.innerHTML || '').toLowerCase();
    const rootText = (root.innerText || '').toLowerCase();
    const hasAddressLookup = /postcode|address.*lookup|find your address|places\.googleapis|post\s?code lookup/.test(rootHtml + ' ' + rootText);
    const hasGuestCheckout = /guest|continue.*(without|as guest)|skip.*sign/.test(rootText);
    const hasProgressBar   = document.querySelector('[class*="progress"], [class*="step"], [aria-label*="step" i]') !== null;

    const emailControls = textLikeControls.filter(el => {
      const meta = `${el.type || ''} ${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''} ${labelTextFor(el)}`.toLowerCase();
      return meta.includes('email');
    });
    const hasEmailConfirmationFriction =
      emailControls.length >= 2 ||
      /confirm\s+email|re-?enter\s+email|repeat\s+email|email\s+again/.test(rootText);

    return {
      fieldCount: normalizedControls.length,
      textFieldCount: textLikeControls.length,
      requiredFieldCount,
      hasAutocomplete,
      hasAddressLookup,
      hasGuestCheckout,
      hasProgressBar,
      hasEmailConfirmationFriction,
      detectedContainerTag: root.tagName?.toLowerCase() || 'unknown',
    };
  });
}

function mergeTechStack(base, additional) {
  const keys = ['donationPlatforms','cms','crm','analytics','pixels','cro','consent','chat','p2p','infra'];
  for (const key of keys) {
    const existing = new Set(base[key].map(x => x.name));
    for (const item of additional[key]) {
      if (!existing.has(item.name)) { base[key].push(item); existing.add(item.name); }
    }
  }
  for (const prop of ['gtmContainers','ga4Properties','uaProperties']) {
    base[prop] = [...new Set([...base[prop], ...additional[prop]])];
  }
}

module.exports = {
  collectPageSignals, detectAll, findDonateLinks,
  detectFormArchitecture, detectAmountUX, detectPaymentOptions,
  detectCheckoutUX, mergeTechStack,
};
