'use strict';

const DONATION_PLATFORMS = [
  { name: 'Fundraise Up',       patterns: [/fundraiseup\.com/i, /\bfundraiseup\b/i, /#fundraiseup-/i] },
  { name: 'Classy',             patterns: [/classy\.org/i, /secure\.classy\.org/i, /\bclassy\b/i] },
  { name: 'Donorbox',           patterns: [/donorbox\.org/i, /\bdonorbox\b/i] },
  { name: 'iDonate',            patterns: [/idonate\.com/i, /embed\.idonate\.com/i, /apps\.idonate\.com/i] },
  { name: 'GiveWP',             patterns: [/\/give\//i, /give_form/i, /give-form-wrap/i, /\bgivewp\b/i] },
  { name: 'Blackbaud Luminate', patterns: [/luminate/i, /convio/i, /NetCommunity/i] },
  { name: 'Blackbaud BBIS',     patterns: [/BBIS/i, /blackbaudhq\.com/i] },
  { name: 'Engaging Networks',  patterns: [/engagingnetworks\.net/i, /e-activist\.com/i] },
  { name: 'Stripe',             patterns: [/js\.stripe\.com/i, /stripe\.com\/v[0-9]/i] },
  { name: 'PayPal',             patterns: [/paypal\.com/i, /paypalobjects\.com/i] },
  { name: 'Braintree',          patterns: [/braintree-api\.com/i, /braintreepayments\.com/i] },
  { name: 'Worldpay',           patterns: [/worldpay\.com/i] },
  { name: 'Adyen',              patterns: [/adyen\.com/i, /checkoutshopper/i] },
  { name: 'Authorize.Net',      patterns: [/authorize\.net/i] },
  { name: 'Network for Good',   patterns: [/networkforgood\.com/i, /nfgdms\.com/i] },
  { name: 'Virtuous',           patterns: [/virtuoussoftware\.com/i, /\bvirtuous\b/i] },
  { name: 'Bloomerang',         patterns: [/bloomerang\.co/i] },
  { name: 'DonorPerfect',       patterns: [/donorperfect\.com/i, /dpcom\.com/i] },
  { name: 'Qgiv',               patterns: [/qgiv\.com/i] },
  { name: 'Funraisin',          patterns: [/funraisin\.com/i] },
  { name: 'Raisely',            patterns: [/raisely\.com/i] },
  { name: 'Enthuse',            patterns: [/enthuse\.com/i] },
  { name: 'JustGiving',         patterns: [/justgiving\.com/i] },
  { name: 'Flo2Cash',           patterns: [/flo2cash\.com/i, /flo2cash/i] },
  { name: 'Chariot (DAF)',      patterns: [/givechariot\.com/i] },
  { name: 'Windcave',           patterns: [/windcave\.com/i, /paymentexpress\.com/i] },
  { name: 'Mightycause',        patterns: [/mightycause\.com/i] },
  { name: 'OneCause',           patterns: [/onecause\.com/i] },
  { name: 'Qgiv',               patterns: [/qgiv\.com/i] },
];

const CMS_PLATFORMS = [
  { name: 'WordPress',   patterns: [/wp-content/i, /wp-includes/i, /\/wp-json\//i, /wordpress/i] },
  { name: 'Drupal',      patterns: [/drupal\.js/i, /\/sites\/default\//i, /drupalSettings/i] },
  { name: 'Sitecore',    patterns: [/sitecore/i, /\/-\/media\//i, /scEnabledChrome/i, /SCID/i] },
  { name: 'Umbraco',     patterns: [/umbraco/i, /\/umbraco\//i] },
  { name: 'Contentful',  patterns: [/contentful\.com/i, /ctfassets\.net/i] },
  { name: 'Craft CMS',   patterns: [/craft-csrf-token/i, /craftcms/i] },
  { name: 'HubSpot CMS', patterns: [/hs-scripts\.com/i, /hsstatic/i] },
  { name: 'Webflow',     patterns: [/webflow\.com/i, /webflow\.js/i] },
  { name: 'Squarespace', patterns: [/squarespace\.com/i, /sqsp\.net/i] },
  { name: 'Wix',         patterns: [/wix\.com/i, /wixstatic\.com/i] },
  { name: 'Joomla',      patterns: [/\/media\/jui\//i, /joomla/i] },
  { name: 'Adobe AEM',   patterns: [/\/etc\.clientlibs\//i, /adobeaemcloud\.com/i] },
  { name: 'Kentico',     patterns: [/kentico/i, /CMSPages/i] },
];

const CRM_PLATFORMS = [
  { name: 'Salesforce',               patterns: [/salesforce\.com/i, /force\.com/i, /pardot\.com/i] },
  { name: 'Blackbaud Raiser\'s Edge', patterns: [/raisersedge/i, /re7/i] },
  { name: 'Microsoft Dynamics',       patterns: [/dynamics\.com/i, /crm\.dynamics/i] },
  { name: 'HubSpot CRM',              patterns: [/hubspot\.com/i, /hs-analytics/i, /hsforms\.net/i] },
  { name: 'Mailchimp',                patterns: [/mailchimp\.com/i, /chimpstatic\.com/i] },
  { name: 'Klaviyo',                  patterns: [/klaviyo\.com/i] },
  { name: 'Marketo',                  patterns: [/marketo\.net/i, /mktoresp\.com/i] },
  { name: 'Eloqua',                   patterns: [/eloqua\.com/i] },
];

const ANALYTICS_TOOLS = [
  { name: 'Google Tag Manager',  patterns: [/googletagmanager\.com/i, /GTM-[A-Z0-9]+/] },
  { name: 'Google Analytics 4',  patterns: [/gtag\/js/i, /googletagmanager\.com\/gtag/i, /G-[A-Z0-9]+/] },
  { name: 'Universal Analytics', patterns: [/google-analytics\.com\/analytics\.js/i, /UA-[0-9]+-[0-9]+/] },
  { name: 'Adobe Analytics',     patterns: [/omtrdc\.net/i, /demdex\.net/i, /s_code/i] },
  { name: 'Fathom Analytics',    patterns: [/cdn\.usefathom\.com/i] },
  { name: 'Plausible',           patterns: [/plausible\.io/i] },
  { name: 'Segment',             patterns: [/segment\.com/i, /segment\.io/i] },
  { name: 'Mixpanel',            patterns: [/mixpanel\.com/i] },
  { name: 'Heap',                patterns: [/heapanalytics\.com/i, /heap\.io/i] },
  { name: 'Pendo',               patterns: [/pendo\.io/i] },
  { name: 'Amplitude',           patterns: [/amplitude\.com/i] },
];

const PIXEL_TOOLS = [
  { name: 'Meta / Facebook Pixel', patterns: [/connect\.facebook\.net/i, /fbq\s*\(/i, /fbevents\.js/i] },
  { name: 'LinkedIn Insight Tag',  patterns: [/snap\.licdn\.com/i, /lintrk/i] },
  { name: 'TikTok Pixel',          patterns: [/analytics\.tiktok\.com/i, /\bttq\b/i] },
  { name: 'Twitter / X Pixel',     patterns: [/static\.ads-twitter\.com/i, /twq\s*\(/i] },
  { name: 'Google Ads',            patterns: [/googleadservices\.com/i, /gtag.*AW-/i] },
  { name: 'Pinterest Tag',         patterns: [/ct\.pinterest\.com/i, /\bpintrk\b/i] },
];

const CRO_TOOLS = [
  { name: 'Optimizely',        patterns: [/optimizely\.com/i] },
  { name: 'VWO',               patterns: [/vwo\.com/i, /wingify\.com/i] },
  { name: 'AB Tasty',          patterns: [/abtasty\.com/i] },
  { name: 'Hotjar',            patterns: [/hotjar\.com/i] },
  { name: 'Mouseflow',         patterns: [/mouseflow\.com/i] },
  { name: 'FullStory',         patterns: [/fullstory\.com/i] },
  { name: 'Microsoft Clarity', patterns: [/clarity\.ms/i] },
  { name: 'Lucky Orange',      patterns: [/luckyorange\.com/i] },
  { name: 'Qualtrics',         patterns: [/qualtrics\.com/i] },
];

const CONSENT_TOOLS = [
  { name: 'OneTrust',     patterns: [/onetrust\.com/i, /cdn\.cookielaw\.org/i] },
  { name: 'Cookiebot',    patterns: [/cookiebot\.com/i] },
  { name: 'TrustArc',     patterns: [/trustarc\.com/i, /consent\.truste\.com/i] },
  { name: 'CookieYes',    patterns: [/cookieyes\.com/i] },
  { name: 'Usercentrics', patterns: [/usercentrics\.eu/i] },
  { name: 'Civic UK',     patterns: [/civicuk\.com/i] },
];

const CHAT_TOOLS = [
  { name: 'Intercom',     patterns: [/intercom\.io/i, /intercomcdn\.com/i] },
  { name: 'Drift',        patterns: [/drift\.com/i, /js\.driftt\.com/i] },
  { name: 'Zendesk',      patterns: [/zendesk\.com/i, /zopim\.com/i] },
  { name: 'Freshchat',    patterns: [/freshchat\.com/i, /freshworks\.com/i] },
  { name: 'HubSpot Chat', patterns: [/hsConversationsSettings/i] },
  { name: 'LiveChat',     patterns: [/livechatinc\.com/i] },
];

const P2P_PLATFORMS = [
  { name: 'JustGiving',           patterns: [/justgiving\.com/i] },
  { name: 'Funraisin',            patterns: [/funraisin\.com/i] },
  { name: 'Raisely',              patterns: [/raisely\.com/i] },
  { name: 'Enthuse',              patterns: [/enthuse\.com/i] },
  { name: 'Blackbaud TeamRaiser', patterns: [/teamraiser/i] },
  { name: 'DonorDrive',           patterns: [/donordrive\.com/i] },
  { name: 'Mightycause',          patterns: [/mightycause\.com/i] },
  { name: 'GiveSignup',           patterns: [/givesignup\.org/i, /runsignup\.com/i] },
];

const INFRA_SIGNALS = [
  { name: 'Cloudflare',     patterns: [/__cf_bm/i, /cloudflare/i] },
  { name: 'AWS CloudFront', patterns: [/cloudfront\.net/i] },
  { name: 'Fastly',         patterns: [/fastly\.net/i] },
  { name: 'Azure CDN',      patterns: [/azureedge\.net/i, /msecnd\.net/i] },
  { name: 'Akamai',         patterns: [/akamai\b/i] },
];

module.exports = {
  DONATION_PLATFORMS, CMS_PLATFORMS, CRM_PLATFORMS,
  ANALYTICS_TOOLS, PIXEL_TOOLS, CRO_TOOLS,
  CONSENT_TOOLS, CHAT_TOOLS, P2P_PLATFORMS, INFRA_SIGNALS,
};
