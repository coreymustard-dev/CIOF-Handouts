'use strict';

const fs   = require('fs');
const path = require('path');

function computeMaturityScore(desktop, mobile) {
  let score = 0;
  const signals = [];
  const ts = desktop.techStack || {};
  const checkoutLevel = desktop.checkoutObservation?.level ?? 2;

  const modernPlatforms = ['Fundraise Up', 'Classy', 'Donorbox', 'Raisely', 'Enthuse', 'Qgiv'];
  if (ts.donationPlatforms?.some(p => modernPlatforms.includes(p.name))) {
    score += 15; signals.push('+15 Modern donation platform');
  } else {
    score += 5; signals.push('+5 Donation platform detected (legacy or unknown)');
  }

  const arch = desktop.formArchitecture;
  const isCrossDomain = desktop.isDonationCrossDomain;
  if (arch) {
    if (!isCrossDomain && !arch.pageIsExternal && arch.formCount > 0) {
      score += 10; signals.push('+10 Same-domain donation form');
    } else if (isCrossDomain || arch.pageIsExternal) {
      // Donation redirects to a different domain — trust gap and analytics break
      score += 7; signals.push('+7 Redirect to external payment partner');
    } else if (arch.externalIframeCount === 0) {
      score += 5; signals.push('+5 Embedded donation form (same-domain page)');
    } else {
      score += 3; signals.push('+3 External iframe embed');
    }
  }

  const steps = desktop.steps?.length || 0;
  if (steps <= 2)      { score += 10; signals.push(`+10 Short flow (${steps} steps)`); }
  else if (steps <= 4) { score += 6;  signals.push(`+6 Medium flow (${steps} steps)`); }
  else                 { score += 2;  signals.push(`+2 Long flow (${steps} steps)`); }

  const pay = desktop.paymentOptions;
  if (pay && checkoutLevel >= 2) {
    if (pay.applePay)  { score += 8; signals.push('+8 Apple Pay'); }
    if (pay.googlePay) { score += 8; signals.push('+8 Google Pay'); }
    if (pay.paypal)    { score += 5; signals.push('+5 PayPal'); }
    if (pay.ach)       { score += 5; signals.push('+5 ACH / bank transfer'); }
    if (pay.daf)       { score += 5; signals.push('+5 DAF option'); }
  } else if (checkoutLevel < 2) {
    signals.push('+0 Payment methods unverified (payment step not reached)');
  }

  const ux = desktop.amountUX;
  if (ux) {
    if (ux.hasRecurringToggle) { score += 8; signals.push('+8 Monthly/recurring toggle'); }
    if (ux.monthlyIsDefault)   { score += 5; signals.push('+5 Monthly is default'); }
    if (ux.hasImpactText)      { score += 4; signals.push('+4 Impact messaging'); }
    if (ux.presetAmounts?.length > 0) { score += 3; signals.push(`+3 Preset amounts (${ux.presetAmounts.slice(0,4).join(', ')})`); }
  }

  if (ts.analytics?.length > 0)     { score += 3; signals.push('+3 Analytics detected'); }
  if (ts.gtmContainers?.length > 0)  { score += 2; signals.push(`+2 GTM (${ts.gtmContainers.join(', ')})`); }
  if (ts.consent?.length > 0)        { score += 3; signals.push('+3 Consent management platform'); }
  if (ts.cro?.length > 0)            { score += 3; signals.push('+3 CRO / testing tool'); }

  if (mobile?.checkoutUX?.fieldCount <= 6) { score += 4; signals.push('+4 Mobile: short checkout'); }
  else if (mobile?.checkoutUX?.fieldCount)  { score += 2; signals.push(`+2 Mobile: ${mobile.checkoutUX.fieldCount} fields`); }

  return { score: Math.min(score, 100), signals };
}

function deriveSalesSignals(desktop) {
  const signals = [];
  const ts = desktop.techStack || {};

  const legacy = ['Blackbaud Luminate', 'Blackbaud BBIS', 'Engaging Networks', 'Network for Good', 'DonorPerfect'];
  const hasLegacy = ts.donationPlatforms?.filter(p => legacy.includes(p.name)) || [];
  if (hasLegacy.length > 0) {
    signals.push({ type: 'opportunity', label: `Legacy donation platform: ${hasLegacy.map(p=>p.name).join(', ')}`,
      detail: 'High migration propensity — these platforms typically carry UX debt and vendor dissatisfaction.' });
  }

  const modern = ['Fundraise Up', 'Classy', 'Donorbox', 'Raisely', 'Enthuse'];
  if (!ts.donationPlatforms?.some(p => modern.includes(p.name))) {
    signals.push({ type: 'opportunity', label: 'No modern donation platform detected',
      detail: 'May be on a bespoke or legacy solution — open to platform conversation.' });
  }

  if (desktop.isDonationCrossDomain || desktop.formArchitecture?.pageIsExternal) {
    const domain = desktop.donationDomain ? ` (${desktop.donationDomain})` : '';
    signals.push({ type: 'friction', label: `Donation flow redirects to external domain${domain}`,
      detail: 'Domain switch is visible to donors (trust drop-off risk) and breaks analytics — GTM and pixels on the main site do not fire on the external donation page.' });
  }

  const checkoutLevel = desktop.checkoutObservation?.level ?? 2;
  if (checkoutLevel >= 2 && !desktop.paymentOptions?.applePay && !desktop.paymentOptions?.googlePay) {
    signals.push({ type: 'gap', label: 'No Apple Pay / Google Pay detected',
      detail: 'Missing wallet payments — friction for mobile donors.' });
  } else if (checkoutLevel < 2) {
    signals.push({ type: 'note', label: 'Payment methods unverified',
      detail: 'Scanner did not confirm reaching payment step. Wallet/card gaps may be false negatives.' });
  }

  if (!desktop.amountUX?.hasRecurringToggle) {
    signals.push({ type: 'gap', label: 'No monthly / recurring toggle visible',
      detail: 'Recurring giving is the highest-LTV channel.' });
  }

  if ((desktop.steps?.length || 0) > 3) {
    signals.push({ type: 'friction', label: `Long donation flow: ${desktop.steps.length} steps`,
      detail: 'Each additional click reduces conversion. Best-in-class is 1–2 steps.' });
  }

  if (desktop.checkoutUX?.hasEmailConfirmationFriction) {
    signals.push({ type: 'friction', label: 'Email confirmation field detected',
      detail: 'Re-enter email requirements can increase completion friction, especially on mobile.' });
  }

  if (!ts.consent?.length) {
    signals.push({ type: 'risk', label: 'No consent management platform detected',
      detail: 'Potential GDPR / privacy compliance gap.' });
  }

  return signals;
}

function computeExperienceScore(desktop, mobile, hasViewportMeta, interactiveAnswers = {}) {
  const dimensions = [];
  const chosenLink  = desktop.chosenLink;
  const donateLinks = desktop.donateLinks || [];
  const ux          = desktop.amountUX || {};
  const checkoutUX  = desktop.checkoutUX || {};
  const pay         = desktop.paymentOptions || {};
  const checkoutLevel = desktop.checkoutObservation?.level ?? 2;
  const mobileWallets = !!(mobile?.paymentOptions?.applePay || mobile?.paymentOptions?.googlePay);
  const mobileFieldCount = mobile?.checkoutUX?.fieldCount;

  // 1. Entry + Continuity
  {
    let grade, finding, action = null;
    if (!desktop.isDonationCrossDomain && !desktop.formArchitecture?.pageIsExternal) {
      grade = 'A';
      finding = 'Same-domain checkout — no redirect detected';
    } else if (desktop.formArchitecture?.externalIframeCount > 0 && !desktop.isDonationCrossDomain) {
      grade = 'B';
      finding = 'Checkout loads via external iframe (subdomain). Verify UTM attribution carries through.';
    } else {
      grade = 'D';
      finding = 'Donation redirects to a different domain mid-checkout. Analytics break here; donors see a domain switch.';
      action = 'Evaluate migrating to a same-domain or overlay checkout (e.g. Fundraise Up, Raisely, Enthuse) to preserve trust and fix analytics attribution.';
    }
    dimensions.push({ dim: 'Entry + Continuity', grade, finding, action });
  }

  // 2. Findability
  {
    let grade, finding, action = null;
    if (chosenLink?.inNav && chosenLink?.explicitDonate) {
      // In nav with explicit donate text — A regardless of whether visually rendered or found via source parsing
      grade = 'A';
      finding = 'Donate CTA confirmed in navigation';
    } else if (donateLinks.length > 0) {
      // Found somewhere on page (footer, body) but not in primary nav
      grade = 'B';
      finding = 'Donate link found but not in primary navigation (e.g. footer or body only)';
      action = 'Move primary Donate CTA into the main header navigation and ensure it is visible above the fold on all devices.';
    } else {
      grade = 'D';
      finding = 'No donate links detected';
      action = 'Add a prominently labelled Donate button to the main navigation header.';
    }
    dimensions.push({ dim: 'Findability', grade, finding, action });
  }

  // 3. Ask Design
  {
    let grade, finding, action = null;
    const presets = ux.presetAmounts?.length > 0;
    const custom  = ux.hasCustomAmountInput;
    // Dynamic ask amounts confirmed via interactive prompt → upgrade to A
    if (ux.isDynamic === true) {
      grade   = 'A';
      finding = 'Dynamic ask amounts confirmed — adapts per campaign or donor.';
    } else if (presets && custom) {
      grade = 'B';
      finding = `Preset amounts detected (${ux.presetAmounts.slice(0, 4).join(', ')}) with custom amount field. Note: ask amounts appear static — consider dynamic amounts per campaign.`;
      action = 'A/B test a higher anchor amount. Consider dynamic ask strings that adapt per landing page or campaign.';
    } else if (presets && !custom) {
      grade = 'C';
      finding = 'Preset amounts without a custom entry field';
      action = "Add a custom 'Other' amount field. Donors who want to give outside the presets are currently blocked.";
    } else if (!presets && custom) {
      grade = 'C';
      finding = 'Custom amount field present but no suggested amounts';
      action = 'Add 3–4 preset amounts to anchor donor expectations. Most donors give close to a suggested amount.';
    } else {
      grade = 'D';
      finding = 'No preset amounts and no custom amount field detected';
      action = 'Add preset donation amounts and a custom entry field. No suggested amounts is the highest-friction ask design pattern.';
    }
    dimensions.push({ dim: 'Ask Design', grade, finding, action });
  }

  // 4. Friction
  {
    let grade, finding, action = null;
    const fieldCount     = checkoutUX.fieldCount;
    const hasEmailConfirm = checkoutUX.hasEmailConfirmationFriction;
    if (!fieldCount) {
      grade   = '?';
      finding = 'Field count not detected — checkout stage may not have been reached.';
    } else if (fieldCount >= 10 || (hasEmailConfirm && fieldCount >= 8)) {
      grade   = 'D';
      finding = `${fieldCount} fields detected${hasEmailConfirm ? ' with email confirmation' : ''}`;
      action  = 'Significant checkout friction. Remove email confirmation, audit every field for necessity, target under 6 total.';
    } else if (fieldCount >= 8 || hasEmailConfirm) {
      grade = 'C';
      if (hasEmailConfirm) {
        finding = `${fieldCount} fields with email confirmation friction`;
        action  = 'Remove the email confirmation/re-entry field — it adds friction with minimal fraud benefit.';
      } else {
        finding = `${fieldCount} fields detected`;
        action  = 'Reduce to the minimum fields needed. Move address collection post-donation where possible.';
      }
    } else if (fieldCount >= 6) {
      grade   = 'B';
      finding = `${fieldCount} fields detected`;
      action  = 'Audit each field: can it be made optional or removed? Target 5 or fewer visible fields.';
    } else {
      grade   = 'A';
      finding = 'Minimal fields detected — low friction checkout';
    }
    dimensions.push({ dim: 'Friction', grade, finding, action });
  }

  // 5. Payment Methods
  {
    let grade, finding, action = null;
    if (checkoutLevel < 2) {
      grade   = '?';
      finding = 'Payment step not reached — methods unverified';
      action  = 'Manually complete the donation flow and record which payment options appear at the payment step.';
    } else if ((pay.applePay || pay.googlePay) && pay.card) {
      grade   = 'A';
      finding = 'Card + digital wallet(s) detected';
    } else if (pay.card && !(pay.applePay || pay.googlePay)) {
      grade   = 'B';
      finding = 'Card detected but no digital wallets (Apple Pay / Google Pay)';
      action  = 'Add Apple Pay and Google Pay. On mobile, wallet payments are the single highest-impact conversion improvement available.';
    } else if (!pay.card && (pay.paypal || pay.ach)) {
      grade   = 'C';
      finding = 'Card not confirmed — only PayPal/bank options visible';
      action  = 'Verify card is available in the live form. If absent, this is a critical gap.';
    } else {
      grade   = 'D';
      finding = 'No payment methods detected';
      action  = 'Verify the donation form is accessible to the scanner. If it loads inside a cross-origin iframe, manual inspection is required.';
    }
    dimensions.push({ dim: 'Payment Methods', grade, finding, action });
  }

  // 6. Recurring Fit
  {
    let grade, finding, action = null;
    if (ux.hasRecurringToggle && !ux.monthlyIsDefault) {
      grade   = 'A';
      finding = 'Monthly giving option present and not preselected';
    } else if (ux.hasRecurringToggle && ux.monthlyIsDefault) {
      grade   = 'C';
      finding = 'Monthly preselected by default — review whether this reflects genuine intent';
      action  = 'Confirm the monthly preselection is intentional and clearly communicated. Unintended recurring charges cause chargebacks and donor distrust.';
    } else {
      grade   = 'D';
      finding = 'No monthly/recurring option detected';
      action  = 'Add a monthly giving option. Recurring donors have 6–8x the lifetime value of one-time donors. This is the highest-LTV change available.';
    }
    dimensions.push({ dim: 'Recurring Fit', grade, finding, action });
  }

  // 7. Mobile
  {
    let grade, finding, action = null;
    if (!mobile) {
      grade   = '?';
      finding = 'Mobile not audited or data unavailable';
    } else if (mobileWallets && hasViewportMeta) {
      grade   = 'A';
      finding = 'Digital wallets available on mobile and site is responsive (viewport meta present)';
    } else if (!mobileWallets && hasViewportMeta) {
      grade   = 'B';
      finding = 'Responsive site (viewport meta present) but no digital wallets detected on mobile';
      action  = 'Add Apple Pay and Google Pay. On mobile, wallet payments are the single highest-impact conversion improvement available.';
    } else {
      grade   = 'C';
      finding = 'Site may not be mobile-optimised (no viewport meta tag). Verify the donation form is usable on a phone.';
      action  = 'Add a viewport meta tag if missing and prioritise Apple Pay / Google Pay for mobile donors.';
    }
    dimensions.push({ dim: 'Mobile', grade, finding, action });
  }

  // 8. Gift Aid (UK organisations only)
  if (desktop.isUKOrg === true) {
    let grade, finding, action = null;
    const autoDetected  = desktop.hasGiftAidPrompt === true;
    const answerConfirm = interactiveAnswers.hasGiftAid;
    if (autoDetected || answerConfirm === true) {
      grade   = 'A';
      finding = 'Gift Aid prompt present — 25% uplift on eligible donations.';
    } else if (answerConfirm === false) {
      grade   = 'C';
      finding = 'No Gift Aid prompt detected.';
      action  = 'Add a Gift Aid declaration to your form. For UK donors, this adds 25p to every £1 donated at no cost to the donor — one of the highest-ROI changes available.';
    } else {
      grade   = '?';
      finding = 'Gift Aid status not confirmed — re-run the audit to answer the Gift Aid question interactively.';
      action  = 'Manually confirm whether a Gift Aid declaration appears on the donation form.';
    }
    dimensions.push({ dim: 'Gift Aid', grade, finding, action });
  }

  // 9. Post-Donation (only when at least one answer was provided)
  {
    const pd = {
      thankYouPersonalised:   interactiveAnswers.thankYouPersonalised   ?? null,
      receiptWithin5Min:      interactiveAnswers.receiptWithin5Min      ?? null,
      monthlyUpsellOnThankYou:interactiveAnswers.monthlyUpsellOnThankYou?? null,
      donorSelfServicePortal: interactiveAnswers.donorSelfServicePortal ?? null,
    };
    const hasAnyAnswer = Object.values(pd).some(v => v !== null);
    if (hasAnyAnswer) {
      const trueCount  = Object.values(pd).filter(v => v === true).length;
      const allAnswered = Object.values(pd).every(v => v !== null);

      let grade;
      if      (trueCount >= 3)            grade = 'A';
      else if (trueCount === 2)           grade = 'B';
      else if (trueCount === 1)           grade = 'C';
      else if (allAnswered && trueCount === 0) grade = 'D';
      else                                grade = 'C';

      const labels = {
        thankYouPersonalised:    'personalised thank-you page',
        receiptWithin5Min:       'receipt within 5 minutes',
        monthlyUpsellOnThankYou: 'monthly upsell on thank-you',
        donorSelfServicePortal:  'donor self-service portal',
      };
      const confirmed = Object.entries(pd).filter(([,v]) => v === true ).map(([k]) => labels[k]);
      const missing   = Object.entries(pd).filter(([,v]) => v === false).map(([k]) => labels[k]);
      const parts = [];
      if (confirmed.length > 0) parts.push(`Confirmed: ${confirmed.join(', ')}.`);
      if (missing.length > 0)   parts.push(`Missing: ${missing.join(', ')}.`);
      const finding = parts.join(' ') || 'Post-donation experience partially verified.';
      const action  = grade !== 'A'
        ? 'Post-donation experience is a key driver of second-gift conversion. Personalised thank-you pages and rapid receipts are the highest-impact quick wins.'
        : null;

      dimensions.push({ dim: 'Post-Donation', grade, finding, action });
    }
  }

  return dimensions;
}

function buildFrictionBacklog(dimensions) {
  const gradePriority = { 'D': 0, 'C': 1, 'B': 2, '?': 3, 'A': 4 };
  const dimPriority   = ['Recurring Fit', 'Gift Aid', 'Payment Methods', 'Ask Design', 'Post-Donation', 'Friction', 'Entry + Continuity', 'Findability', 'Mobile'];
  return dimensions
    .filter(d => d.grade !== 'A' && d.action)
    .sort((a, b) => {
      const gradeDiff = (gradePriority[a.grade] ?? 99) - (gradePriority[b.grade] ?? 99);
      if (gradeDiff !== 0) return gradeDiff;
      const dimA = dimPriority.indexOf(a.dim);
      const dimB = dimPriority.indexOf(b.dim);
      return (dimA === -1 ? 99 : dimA) - (dimB === -1 ? 99 : dimB);
    });
}

function generateGapQuestionnaire(desktop, mobile, auditDir) {
  const ux  = desktop.amountUX || {};
  const pay = desktop.paymentOptions || {};
  const checkoutLevel  = desktop.checkoutObservation?.level ?? 2;
  const presetsPopulated = (ux.presetAmounts?.length ?? 0) > 0;
  const amountsFromFrame = !!ux.fromFrame;

  const gaps = [];
  if (!presetsPopulated || amountsFromFrame) gaps.push('amounts');
  if (!ux.hasRecurringToggle)                gaps.push('recurring');
  if (checkoutLevel < 2)                     gaps.push('payment');
  if (checkoutLevel >= 2 && !(pay.applePay || pay.googlePay)) gaps.push('wallets');

  if (gaps.length === 0) return;

  const lines = [
    '# Manual Verification Needed',
    '',
    'The automated scan could not confirm the following items — usually because the donation form loads inside a cross-origin iframe or requires interactive navigation to reach.',
    '',
    '**Instructions:** Answer each question below by changing `[ ]` to `[x]` for Yes or leave `[ ]` for No. Then re-run the audit — it will pick up your answers automatically.',
    '',
    '---',
    '',
  ];

  if (gaps.includes('amounts')) {
    lines.push(
      '## Donation Amounts',
      '- [ ] Are there preset donation amounts visible on the form? (e.g. $10, $25, $50)',
      '  - If yes, list them here: `<!-- e.g. $10, $25, $50, $100 -->`',
      '- [ ] Is there a custom / "Other amount" entry field?',
      '',
    );
  }

  if (gaps.includes('recurring')) {
    lines.push(
      '## Recurring Giving',
      '- [ ] Is there a monthly / recurring giving option on the form?',
      '- [ ] Is monthly giving preselected by default?',
      '',
    );
  }

  if (gaps.includes('payment')) {
    lines.push(
      '## Payment Methods',
      '- [ ] Is credit / debit card accepted?',
      '- [ ] Is PayPal accepted?',
      '- [ ] Is bank transfer / ACH / direct debit accepted?',
      '- [ ] Is Apple Pay available?',
      '- [ ] Is Google Pay available?',
      '',
    );
  } else if (gaps.includes('wallets')) {
    lines.push(
      '## Payment Methods',
      '- [ ] Is Apple Pay available?',
      '- [ ] Is Google Pay available?',
      '',
    );
  }

  lines.push(
    '---',
    '*Re-run `node audit.js` after answering — answers are applied automatically.*',
  );

  const qPath = path.join(auditDir, 'VERIFY-THESE.md');
  fs.writeFileSync(qPath, lines.join('\n'));
  console.log(`  ✓ Gap questionnaire written → ${qPath}`);
}

function readGapQuestionnaire(auditDir) {
  const qPath = path.join(auditDir, 'VERIFY-THESE.md');
  if (!fs.existsSync(qPath)) return null;

  const lines   = fs.readFileSync(qPath, 'utf8').split('\n');
  const result  = {};
  let hasChecked = false;

  const isChecked = (line) => /^\s*-\s*\[x\]/i.test(line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isChecked(line)) continue;
    hasChecked = true;

    if (/preset donation amounts/i.test(line)) {
      const commentLine = lines[i + 1] || '';
      const match = commentLine.match(/`<!--\s*(.*?)\s*-->`/);
      if (match && match[1] && !/e\.g\./i.test(match[1])) {
        const amounts = match[1].split(',').map(a => a.trim()).filter(Boolean);
        if (amounts.length > 0) {
          result.amountUX = result.amountUX || {};
          result.amountUX.presetAmounts = amounts;
        }
      }
    } else if (/custom.*Other amount/i.test(line)) {
      result.amountUX = result.amountUX || {};
      result.amountUX.hasCustomAmountInput = true;
    } else if (/monthly.*recurring giving option/i.test(line)) {
      result.amountUX = result.amountUX || {};
      result.amountUX.hasRecurringToggle = true;
    } else if (/monthly giving preselected/i.test(line)) {
      result.amountUX = result.amountUX || {};
      result.amountUX.monthlyIsDefault = true;
    } else if (/credit.*debit card/i.test(line)) {
      result.paymentOptions = result.paymentOptions || {};
      result.paymentOptions.card = true;
      result.checkoutObservationLevel = result.checkoutObservationLevel ?? 2;
    } else if (/PayPal/i.test(line)) {
      result.paymentOptions = result.paymentOptions || {};
      result.paymentOptions.paypal = true;
      result.checkoutObservationLevel = result.checkoutObservationLevel ?? 2;
    } else if (/bank transfer.*ACH/i.test(line)) {
      result.paymentOptions = result.paymentOptions || {};
      result.paymentOptions.ach = true;
      result.checkoutObservationLevel = result.checkoutObservationLevel ?? 2;
    } else if (/Apple Pay/i.test(line)) {
      result.paymentOptions = result.paymentOptions || {};
      result.paymentOptions.applePay = true;
      result.checkoutObservationLevel = result.checkoutObservationLevel ?? 2;
    } else if (/Google Pay/i.test(line)) {
      result.paymentOptions = result.paymentOptions || {};
      result.paymentOptions.googlePay = true;
      result.checkoutObservationLevel = result.checkoutObservationLevel ?? 2;
    }
  }

  return hasChecked ? result : null;
}

function buildMarkdown(orgName, url, desktop, mobile, maturity, salesSignals, experienceScore, frictionBacklog, hasVerifyGaps, interactiveAnswers = {}) {
  const ts   = desktop.techStack || {};
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const listOrNone = (arr) => arr?.length ? arr.map(x => `- ${x.name}`).join('\n') : '- None detected';

  const gradeToScore  = { 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
  const experienceRows = (experienceScore || []).map(d => ({
    ...d, numScore: gradeToScore[d.grade] ?? null,
  }));
  const experienceTable = experienceRows.map(d =>
    `| ${d.dim} | ${d.grade} | ${d.numScore !== null ? d.numScore : '\u2014'} | ${d.finding} |`
  ).join('\n');
  const totalNumScore   = experienceRows.reduce((s, d) => s + (d.numScore ?? 0), 0);
  const maxPossibleScore = experienceRows.length * 4;
  const experienceTotalRow = `| **Total** | | **${totalNumScore} / ${maxPossibleScore}** | |`;
  const priorityLabel = { 'D': '\uD83D\uDD34 Critical', 'C': '\uD83D\uDFE0 High', 'B': '\uD83D\uDFE1 Medium', '?': '\uD83D\uDD0D Verify' };
  const frictionRows  = (frictionBacklog || []).map(d =>
    `| ${priorityLabel[d.grade] || d.grade} | ${d.dim} | ${d.action} |`
  ).join('\n');
  const frictionSection = frictionRows
    ? `| Priority | Dimension | What to change |\n|----------|-----------|----------------|\n${frictionRows}`
    : 'No critical issues detected \u2014 see individual dimension notes above.';
  const payList = desktop.paymentOptions
    ? Object.entries(desktop.paymentOptions).filter(([,v])=>v).map(([k])=>`- ${k}`).join('\n') || '- None detected'
    : '- Not analysed';
  const observedPayments = desktop.paymentOptions
    ? Object.values(desktop.paymentOptions).some(Boolean)
    : false;
  const checkoutLevel = desktop.checkoutObservation?.level ?? 2;
  const checkoutStage = desktop.checkoutObservation?.stage || 'unknown';
  const archSummary = (() => {
    const a = desktop.formArchitecture;
    if (!a) return 'Not analysed';
    if (a.pageIsExternal) return 'Redirects to external domain';
    if (a.externalIframeCount > 0) return `External iframe (${a.externalIframeSrcs[0]})`;
    if (a.hasInlineForm) return 'Same-domain inline form';
    return 'Unknown';
  })();
  const stepsTable = desktop.steps?.map((s,i) =>
    `| ${i+1} | ${s.description} | ${s.fieldCount ?? '\u2014'} |`
  ).join('\n') || '| \u2014 | No steps recorded | \u2014 |';
  const donationEntrySummary = desktop.directDonationUrlProvided
    ? `${desktop.donateLinks?.length ?? 0} found on homepage (direct donation URL mode).`
    : `${desktop.donateLinks?.length ?? 0} found on homepage.`;

  // Executive Summary — thresholds scale with denominator (89% / 71% / 50%)
  let verdict;
  const pct = maxPossibleScore > 0 ? totalNumScore / maxPossibleScore : 0;
  if (pct >= 0.89)      verdict = 'Strong donation experience \u2014 targeted optimisations available.';
  else if (pct >= 0.71) verdict = 'Good foundation with several meaningful improvements available.';
  else if (pct >= 0.50) verdict = 'Moderate friction \u2014 multiple issues are likely suppressing conversion.';
  else                  verdict = 'Significant conversion barriers detected \u2014 urgent attention recommended.';

  const wins       = experienceRows.filter(d => d.grade === 'A');
  const priorities = experienceRows
    .filter(d => {
      if (d.grade === 'A') return false;
      // Findability at B (found but not in nav) or A is not an exec-summary priority;
      // it still appears in the Priority Fixes table. Only surface if genuinely absent (C or D).
      if (d.dim === 'Findability' && (d.grade === 'A' || d.grade === 'B')) return false;
      return d.grade === 'B' || d.grade === 'C' || d.grade === 'D';
    })
    .sort((a, b) => (a.numScore ?? 99) - (b.numScore ?? 99));

  const getImpactLine = (dim, grade, finding) => {
    if (dim === 'Entry + Continuity') {
      if (grade === 'D') return 'Cross-domain redirects typically reduce conversion 10–20% and break all GTM/pixel attribution on the donation page.';
      if (grade === 'B') return 'External iframe embeds can fragment analytics attribution — verify UTM params carry through.';
    }
    if (dim === 'Findability') {
      if (grade === 'C' || grade === 'D') return 'A prominent, above-fold Donate CTA can lift click-through by 15–30%.';
    }
    if (dim === 'Ask Design') {
      if (grade === 'D') return 'Forms with no suggested amounts see significantly lower average gifts — donors anchor to suggested amounts.';
      if (grade === 'B') return 'Optimised ask ladders typically lift average gift 15–25% vs static presets.';
      if (grade === 'C') {
        if (/no suggested amounts|no preset|Custom amount field present but no suggested/i.test(finding)) return 'Adding suggested amounts typically lifts average gift by 15–25%.';
        return 'Optimised ask ladders typically lift average gift 15–25% vs static presets.';
      }
    }
    if (dim === 'Friction') {
      if (grade === 'C') return 'Each additional required field reduces completion ~5–10%; address fields are the biggest drop-off culprits.';
      if (grade === 'D') return 'High field count and email confirmation fields together can suppress completion by 20–30% vs a streamlined form.';
    }
    if (dim === 'Payment Methods') {
      if (grade === 'B') return 'Adding Apple/Google Pay typically lifts mobile conversion 10–20%; mobile is now 50%+ of donation traffic for most orgs.';
      if (grade === 'C' || grade === 'D') return 'Limited payment options are a critical mobile barrier — card-entry on mobile has the highest abandonment rate.';
    }
    if (dim === 'Recurring Fit') {
      if (grade === 'D') return 'Monthly donors have 6–8x the lifetime value of one-time donors; adding a recurring option is the single highest-LTV change available.';
      if (grade === 'C') return 'Unintended recurring charges cause chargebacks and donor distrust — review whether the default reflects genuine intent.';
    }
    if (dim === 'Mobile') {
      if (grade === 'B') return 'Apple/Google Pay on mobile eliminates card-entry friction — typically the highest single-action mobile conversion lift.';
      if (grade === 'C') return 'Long forms on mobile see the highest abandonment rates; each field removed improves completion measurably.';
    }
    return null;
  };

  const winsText = wins.length
    ? wins.map(d => `- **${d.dim}:** ${d.finding}`).join('\n')
    : '- No A-grade dimensions detected.';
  const prioritiesText = priorities.length
    ? priorities.map(d => {
        const impact = getImpactLine(d.dim, d.grade, d.finding);
        return `- **${d.dim} (${d.grade}):** ${impact || d.action || d.finding}`;
      }).join('\n')
    : '- No priority issues detected.';
  const pdAnswered = ['thankYouPersonalised','receiptWithin5Min','monthlyUpsellOnThankYou','donorSelfServicePortal']
    .some(k => interactiveAnswers[k] !== null && interactiveAnswers[k] !== undefined);
  const postDonationSection = pdAnswered
    ? '' // scored in Experience Score table — no need for manual checklist
    : `## 7. Post-Donation *(manual checklist)*
- [ ] Thank-you page personalised?
- [ ] Receipt email within 5 minutes?
- [ ] Upsell to monthly on thank-you page?
- [ ] Donor self-service portal available?

---`;

  return `# ${orgName} \u2014 Donation Audit Rubric
**URL:** ${url}  **Date:** ${date}  **Tool:** Donation Audit Rubric (Playwright)

---
## How to use this report

1. **Read the Executive Summary** — it shows your overall score and top priorities in plain language.
2. **Review the Experience Score table** — each dimension is scored 1\u20134. A 4 means best practice is met. Anything lower has a suggested fix.
3. **Work through the Priority Fixes** — items are ranked by impact. Start at the top.
4. **Check the Scoring Guide** at the bottom of this report to understand what each dimension measures and what the grades mean.
5. **Re-run any time** — the tool remembers your manual answers (\`interactive-answers.json\`) so re-runs stay fast.

---
## Executive Summary

${verdict}

**What's working well:**
${winsText}

**Top priorities:**
${prioritiesText}

---
## Experience Score

| Dimension | Grade | Score (1\u20134) | Finding |
|-----------|-------|-------------|---------|
${experienceTable}
${experienceTotalRow}

---
## Priority Fixes (Friction Backlog)

${frictionSection}

---
## 1. Donation Entry Points
${donationEntrySummary}
${desktop.donateLinks?.slice(0,10).map(l=>`- **${l.text}** \u2014 ${l.href||'(button)'} ${l.inNav?'[nav]':''} ${l.inFooter?'[footer]':''}`).join('\n')||'None.'}
${desktop.chosenLink ? `Primary link selected: **${desktop.chosenLink.text || '(untitled)'}** \u2014 ${desktop.chosenLink.href || '(button)'}` : ''}

---
## 2. Form Architecture
${archSummary}
- Iframes: ${desktop.formArchitecture?.iframeCount ?? '\u2014'} | External: ${desktop.formArchitecture?.externalIframeCount ?? '\u2014'} | Inline forms: ${desktop.formArchitecture?.hasInlineForm?'Yes':'No'}

---
## 3. Donation Flow (Desktop)
| Step | Description | Fields |
|------|-------------|--------|
${stepsTable}
Total steps to payment: **${desktop.steps?.length ?? '\u2014'}**

---
## 4. Amount Selection UX
- Preset amounts: ${desktop.amountUX?.presetAmounts?.join(', ')||'None'}
- Custom input: ${desktop.amountUX?.hasCustomAmountInput?'Yes':'No'}
- Recurring toggle: ${desktop.amountUX?.hasRecurringToggle?'Yes':'No'}
- Monthly default: ${desktop.amountUX?.monthlyIsDefault?'Yes':'No'}
- Impact messaging: ${desktop.amountUX?.hasImpactText?'Yes':'No'}

---
## 5. Payment Options
${payList}
${checkoutLevel < 2 ? `_Payment methods unverified \u2014 payment step not reached (observed stage: ${checkoutStage})._` : (!observedPayments ? '_No payment methods detected on the observed payment step._' : '')}

---
## 6. Checkout UX
- Fields (desktop): ${desktop.checkoutUX?.fieldCount??'\u2014'} | Fields (mobile): ${mobile?.checkoutUX?.fieldCount??'\u2014'}
- Text/select fields (desktop): ${desktop.checkoutUX?.textFieldCount??'\u2014'} | Text/select fields (mobile): ${mobile?.checkoutUX?.textFieldCount??'\u2014'}
- Required fields (desktop): ${desktop.checkoutUX?.requiredFieldCount??'\u2014'} | Required fields (mobile): ${mobile?.checkoutUX?.requiredFieldCount??'\u2014'}
- Autocomplete: ${desktop.checkoutUX?.hasAutocomplete?'Yes':'No'}
- Address lookup: ${desktop.checkoutUX?.hasAddressLookup?'Yes':'No'}
- Progress bar: ${desktop.checkoutUX?.hasProgressBar?'Yes':'No'}
- Email confirmation friction: ${desktop.checkoutUX?.hasEmailConfirmationFriction?'Yes':'No'}
- Checkout evidence stage reached: ${checkoutStage}

---
${postDonationSection}

## 8. Tech Stack \u2014 Donation Platform
${listOrNone(ts.donationPlatforms)}

---
## 9. CMS
${listOrNone(ts.cms)}

---
## 10. CRM / Marketing Automation
${listOrNone(ts.crm)}

---
## 11. Analytics
${listOrNone(ts.analytics)}
GTM: ${ts.gtmContainers?.join(', ')||'None'} | GA4: ${ts.ga4Properties?.join(', ')||'None'}

---
## 12. CRO Tools
${listOrNone(ts.cro)}

---
## 13. Consent
${listOrNone(ts.consent)}

---
## 14. Pixels & Social Tracking
${listOrNone(ts.pixels)}

---
## 15. P2P / DIY Fundraising Platforms
${listOrNone(ts.p2p)}

---
## Screenshots
${desktop.screenshots?.map(s=>`- ![${s.label}](screenshots/${path.basename(s.path)})`).join('\n')||'(none)'}

---
## Scoring Guide

This report uses a scored rubric (A–D, 4–1). The 7 core dimensions are scored out of 28. Gift Aid (UK organisations only) and Post-Donation (when interactively verified) are additional scored dimensions — each adds 4 to the maximum.

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 4 | Best practice met — no action needed |
| B | 3 | Good, with one meaningful improvement available |
| C | 2 | Below best practice — conversion impact likely |
| D | 1 | Critical gap — address as a priority |
| ? | — | Could not be verified automatically — answer the interactive prompts on re-run |

### What each dimension checks

| Dimension | What we look for |
|-----------|-----------------|
| Entry + Continuity | Does the donation form stay on your domain, or does it redirect to a different website? Cross-domain redirects break analytics and reduce donor trust. |
| Findability | Is there a clearly labelled Donate button in your main navigation, visible without scrolling or clicking menus? |
| Ask Design | Are there suggested donation amounts? Is there a custom "Other" amount field? Do amounts appear to adapt per campaign? |
| Friction | How many fields must a donor complete? Is there an email confirmation/re-entry field? Are autofill and address lookup available? |
| Payment Methods | Are credit/debit card, digital wallets (Apple Pay, Google Pay), and alternative methods (PayPal, bank transfer) available? |
| Recurring Fit | Is there a monthly/recurring giving option? Is it presented fairly (not preselected without clear notice)? |
| Mobile | Is the site mobile-responsive (viewport meta)? Are digital wallets available on mobile? Is the form compact enough for a phone? |
| Gift Aid | *(UK organisations only)* — Gift Aid declaration on form, HMRC eligibility. Adds 25p to every £1 donated at no cost to the donor. |
| Post-Donation | *(requires manual verification)* — personalised thank-you page, receipt speed, monthly upsell on thank-you, donor self-service portal. |

### Limitations
- Forms inside cross-origin iframes (different subdomain) cannot be fully inspected — the interactive prompts after the scan let you fill in the gaps manually.
- Findability detection uses DOM inspection and HTML source parsing; some dynamic navigation menus may not be fully expanded.
- Payment method detection is based on page source signals and may miss methods that load only at the final payment step.
- Gift Aid and Post-Donation scores are derived from interactive user input at scan time, not automated detection.

---
*Generated by Donation Audit Rubric \u00B7 ${date}*
`;
}

function writeReports(orgName, url, desktop, mobile, auditDir, interactiveAnswers = {}) {
  // Apply questionnaire answers first (lowest priority — questionnaire is the fallback)
  const qOverrides = readGapQuestionnaire(auditDir);
  if (qOverrides) {
    _applyOverrideData(desktop, mobile, qOverrides);
    console.log('  ✓ Applied saved gap questionnaire answers');
  }

  // Apply manual-overrides.json second — wins over questionnaire answers
  const overrides       = applyManualOverrides(desktop, mobile, auditDir);
  const maturity        = computeMaturityScore(desktop, mobile);
  const salesSignals    = deriveSalesSignals(desktop);
  const experienceScore = computeExperienceScore(desktop, mobile, desktop.hasViewportMeta, interactiveAnswers);
  const frictionBacklog = buildFrictionBacklog(experienceScore);
  // Compute whether VERIFY-THESE.md will be generated (same logic as generateGapQuestionnaire)
  const _ux  = desktop.amountUX || {};
  const _pay = desktop.paymentOptions || {};
  const _cl  = desktop.checkoutObservation?.level ?? 2;
  const _presetsOk = (_ux.presetAmounts?.length ?? 0) > 0 && !_ux.fromFrame;
  const hasVerifyGaps = !_presetsOk || !_ux.hasRecurringToggle || _cl < 2
    || (_cl >= 2 && !(_pay.applePay || _pay.googlePay));
  const markdown        = buildMarkdown(orgName, url, desktop, mobile, maturity, salesSignals, experienceScore, frictionBacklog, hasVerifyGaps, interactiveAnswers);
  const jsonData     = {
    meta: { orgName, url, auditDate: new Date().toISOString(), tool: 'nonprofit-audit' },
    maturityScore: maturity.score, maturitySignals: maturity.signals, salesSignals,
    desktop: { donateLinks: desktop.donateLinks, chosenLink: desktop.chosenLink,
      formArchitecture: desktop.formArchitecture, steps: desktop.steps,
      amountUX: desktop.amountUX, paymentOptions: desktop.paymentOptions,
      checkoutUX: desktop.checkoutUX, checkoutObservation: desktop.checkoutObservation, techStack: desktop.techStack,
      screenshots: desktop.screenshots, videoPath: desktop.videoPath, errors: desktop.errors },
    mobile: mobile ? { donateLinks: mobile.donateLinks, formArchitecture: mobile.formArchitecture,
      steps: mobile.steps, paymentOptions: mobile.paymentOptions,
      checkoutUX: mobile.checkoutUX, screenshots: mobile.screenshots,
      videoPath: mobile.videoPath, errors: mobile.errors } : null,
    manualOverridesApplied: overrides.applied,
    manualOverridesNotes: overrides.notes,
  };

  // Put machine-readable files in a _data/ subfolder so the output folder stays clean
  const dataDir = path.join(auditDir, '_data');
  fs.mkdirSync(dataDir, { recursive: true });

  const safeOrg  = orgName.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase();
  const mdPath   = path.join(auditDir, `${safeOrg}-Donation-Audit-Rubric.md`);
  const jsonPath = path.join(dataDir, 'audit.json');
  fs.writeFileSync(mdPath,   markdown);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));

  // Generate the gap questionnaire into _data/ to keep it out of the way
  generateGapQuestionnaire(desktop, mobile, dataDir);

  return { jsonPath, mdPath, maturity, salesSignals };
}

function _applyOverrideData(desktop, mobile, o) {
  if (typeof o.checkoutObservationLevel === 'number') {
    desktop.checkoutObservation = {
      ...(desktop.checkoutObservation || { evidence: [] }),
      level: Math.max(0, Math.min(2, o.checkoutObservationLevel)),
      stage: o.checkoutObservationLevel >= 2 ? 'payment' : o.checkoutObservationLevel === 1 ? 'details' : 'landing',
    };
  }
  if (o.paymentOptions && typeof o.paymentOptions === 'object') {
    desktop.paymentOptions = { ...(desktop.paymentOptions || {}), ...o.paymentOptions };
  }
  if (o.amountUX && typeof o.amountUX === 'object') {
    desktop.amountUX = { ...(desktop.amountUX || {}), ...o.amountUX };
  }
  if (typeof o.requiredFieldCount === 'number') {
    desktop.checkoutUX = { ...(desktop.checkoutUX || {}), requiredFieldCount: o.requiredFieldCount };
  }
  if (typeof o.hasEmailConfirmationFriction === 'boolean') {
    desktop.checkoutUX = { ...(desktop.checkoutUX || {}), hasEmailConfirmationFriction: o.hasEmailConfirmationFriction };
  }
}

function applyManualOverrides(desktop, mobile, auditDir) {
  const overridePath = path.join(auditDir, 'manual-overrides.json');
  if (!fs.existsSync(overridePath)) return { applied: false, notes: null };
  try {
    const o = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
    _applyOverrideData(desktop, mobile, o);
    const notes = o.notes || null;
    return { applied: true, notes };
  } catch (e) {
    return { applied: true, notes: `manual-overrides.json parse error: ${e.message}` };
  }
}

module.exports = { writeReports };
