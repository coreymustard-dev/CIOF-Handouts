# GA4 Traffic & Conversion Analysis Guide

Working Differently With What You Already Have

How to export session and traffic source data from GA4 and use AI to identify which channels, campaigns, and landing pages are converting — and which are not.

---

## About This Guide

This guide supports the practical exercise from the session *Revenue Forensics: Working Differently With What You Already Have*. You will export session and traffic source data from GA4, then paste it into the AI prompt in Part 2 to identify which channels, campaigns, and landing pages are driving — or failing to drive — online donations.

No funnel setup, event configuration, or technical preparation is required. The export uses standard GA4 Exploration dimensions that are available in any property with basic tracking.

> **What you need before you start**
> Access to your organisation's GA4 property with at least Viewer permissions. Your property should be receiving traffic and recording donation completions as a `purchase` event (this is GA4's term for a completed transaction — your donation platform fires this automatically in most cases). If you are unsure whether this is configured, check with whoever manages your analytics or donation platform.

---

## Part 1: Exporting Your GA4 Data

The export uses GA4's Free-Form Exploration to pull session data broken down by landing page, traffic source, and UTM parameters. This gives you a single table showing how every channel and campaign is performing against the donation event.

### Step-by-Step Export Instructions

**Step 1 — Open Google Analytics and navigate to Explore**
Go to analytics.google.com. In the left navigation, click **Explore** (the compass icon). You will see a list of saved Explorations and template options.

**Step 2 — Create a new Free-Form Exploration**
Click the blank canvas icon or select **Blank** from the template gallery. In the Technique dropdown on the left panel, confirm **Free form** is selected. Give the Exploration a name such as *Donation Conversion by Source*.

**Step 3 — Set your date range**
Use the date picker in the top-right of the canvas. Select a range of at least 90 days to capture enough volume for meaningful patterns. If your donation volume is low, extend to 6 or 12 months.

**Step 4 — Add dimensions to the Variables panel**
In the Variables panel on the left, click the **+** next to Dimensions. Search for and add each of the following:

- Landing page + query string
- Session source
- Session medium
- Session campaign
- Session default channel group

Click **Confirm** after selecting all five.

**Step 5 — Add metrics to the Variables panel**
Click the **+** next to Metrics. Search for and add **Sessions** and **Purchases** (this is GA4's label for completed donations — select this metric even though it says Purchases). Click **Confirm**.

**Step 6 — Build the table**
Drag your five dimensions from the Variables panel into the **Rows** box in the Tab Settings panel. Drag your two metrics into the **Values** box. The canvas will populate with a table showing session and donation data broken down by each dimension combination.

**Step 7 — Increase rows displayed**
Below the canvas, find the **Rows per page** setting and increase it to **500**. This ensures the export captures long-tail traffic sources and campaigns, not just the top 10 rows shown by default.

**Step 8 — Export the data**
Click the **Share** icon (arrow pointing up-right) in the top-right corner of the Exploration. Select **Export to CSV**. The file will download to your default downloads folder. Rename it something descriptive such as `donation-conversion-by-source-90d.csv`.

**Step 9 — Open the CSV and copy all content**
Open the file in any text editor or spreadsheet application. Select all content (Ctrl+A or Cmd+A) and copy it. Do not reformat or clean the data — paste it as-is into the prompt.

> **A note on dimension availability**
> Session source, medium, campaign, and default channel group are standard GA4 session-scoped dimensions and should be available in all properties. If any dimension does not appear in search, it may be labelled slightly differently — try searching "source", "medium", or "channel" to find the equivalent. UTM parameters only populate when traffic arrives with UTM tags, so organic and direct traffic will show as `(not set)` or `(none)` for campaign — this is expected and informative.

---

## Understanding Your Export

Each row in the export represents a unique combination of landing page, source, medium, campaign, and channel group. The AI prompt is designed to interpret this structure directly — you do not need to summarise or reformat it.

| Dimension / Metric | What it tells you |
| --- | --- |
| **Landing page + query string** | The first page a user saw when they arrived on your site, including any URL parameters. Reveals which pages — homepage, campaign pages, donation pages — are entry points for converting sessions. |
| **Session source** | The origin of the traffic (e.g. google, facebook, mailchimp, newsletter). Part of the UTM tracking pair with medium. |
| **Session medium** | The channel type (e.g. cpc, email, organic, sms, referral). Combined with source, this identifies the specific traffic stream. |
| **Session campaign** | The UTM campaign name applied to the link that brought the visitor. Only populated when UTM parameters are used — blank or `(not set)` for untagged traffic. |
| **Session default channel group** | GA4's automatic classification of the traffic type (e.g. Paid Search, Organic Social, Email, Direct). Useful for channel-level patterns even when UTM tagging is incomplete. |
| **Sessions** | The number of visits from this combination of landing page, source, medium, and campaign during the date range. |
| **Purchases (= Donations)** | The number of completed donation events recorded in sessions that started with this combination. Each row shows how many donations originated from that entry point and channel. Divide by Sessions to calculate the donation conversion rate for any row. |

---

## Part 2: The AI Analysis Prompt

Copy the full prompt below. Replace the placeholder at the end with your GA4 export data. Submit to any general-purpose AI assistant — Claude, ChatGPT, or Google Gemini all work well.

Paste the CSV content exactly as exported. The AI is instructed to handle raw GA4 output including headers, blank fields, and `(not set)` values.

> **Which AI tool should I use?**
> Any of the main AI assistants will work. Claude (claude.ai) handles larger table inputs reliably. ChatGPT with GPT-4 (chat.openai.com) is widely available. Google Gemini (gemini.google.com) is a natural fit given the GA4 context. All offer a free tier that is sufficient for this exercise.

### The Prompt

```
You are a digital fundraising analyst.

I am sharing session and traffic source data exported from a Google Analytics 4
Free-Form Exploration. The data shows how visitors arrived at the website —
including their landing page, traffic source, medium, campaign, and channel group
— and whether those sessions resulted in a donation. In GA4, completed donations
are recorded using the Purchases metric — treat all references to "purchases" in
this data as donations.

The data is raw GA4 export output. It may include rows where source, medium, or
campaign show as (not set) or (none) — this is expected for untagged or direct
traffic. Do not treat these as errors. Analyse the data as provided and note any
limitations that affect your confidence in specific findings.

Please analyse this data and provide:

1. AN OVERALL PICTURE
   Summarise total sessions, total donations, and overall donation conversion rate
   (donations divided by sessions) across the dataset. Identify the top 3 sources
   of donations by donation volume, and the top 3 by calculated conversion rate
   (excluding rows with fewer than 50 sessions to avoid noise).

2. CHANNEL AND SOURCE PERFORMANCE
   Break down performance by default channel group. For each channel, provide:
   total sessions, total donations, and conversion rate (calculated from the two
   columns). Highlight any channel that is driving significant session volume but
   converting at a meaningfully lower rate than the overall average — these
   represent the highest-opportunity gaps.

3. CAMPAIGN ANALYSIS
   Identify the campaigns (where campaign is not blank or 'not set') with the
   highest donation volume and the highest conversion rate. Flag any campaign with
   substantial traffic (high session volume) but below-average conversion — this
   suggests a tracking, landing page, or audience mismatch worth investigating.

4. LANDING PAGE PATTERNS
   Identify the top landing pages by session volume and their associated donation
   conversion rates. Flag any landing page that receives significant traffic but
   converts below the site average. Also flag any landing page with a high
   conversion rate but low traffic — these may represent opportunities to drive
   more volume to a proven entry point.

5. QUICK WINS AND PRIORITY ACTIONS
   Based on the above, identify two or three specific, actionable opportunities
   that could be tested within two weeks without system changes or technical
   resource. For each, state: what the opportunity is, what the data suggests is
   causing it, and what a practical first test would look like.

6. THE UNANSWERED QUESTION
   Identify one question this data cannot answer — something that, if known, would
   materially change how you would prioritise the actions above.

Format your response as:
   - A 3-4 sentence executive summary
   - Short sections for each numbered area above
   - A final section for the unanswered question

Keep the language direct and specific. Ground every finding in the actual numbers.
Avoid generic advice. Where data is insufficient to draw a conclusion, say so.

Here is the GA4 export data:

[PASTE YOUR GA4 EXPORT DATA HERE]
```

---

## Adapting and Extending the Prompt

The prompt works as written on a single export. The follow-up examples below show how to push the analysis further once you have an initial response.

### Comparing two time periods

If you have exports from two separate date ranges, paste both and add:

> *Compare these two exports side by side. Focus on whether any channel or campaign has materially improved or deteriorated between the two periods, and what that might indicate about recent activity.*

### Going deeper on a single channel

Once you know which channel is underperforming, follow up with:

> *Focus on [channel name] traffic. Based on the landing pages and campaigns associated with this channel, what are the most likely explanations for the lower donation conversion rate? What would you want to test first?*

### Adding context about a campaign or audience

If you know something about the context that the data does not show — such as a recent appeal or a specific audience segment — add it before the data:

> *For context: we ran a paid social campaign targeting lapsed donors during [date range]. Please factor this into your interpretation of the social channel performance and flag whether the pattern is consistent with a retargeting campaign or suggests something different.*

### Requesting copy or messaging suggestions

Once friction points are identified, extend into messaging with:

> *The [landing page path] is our highest-traffic entry point but converts below average. Based on what the traffic source data suggests about who is arriving here, recommend two or three changes to the page headline or call-to-action that might better match visitor intent.*

### Requesting a donor segment cut

If your property tracks new vs returning users as a segment, you can add a second export filtered to each and ask:

> *I have two versions of this export: one for new users and one for returning users. Compare their channel and landing page conversion patterns. Are there any channels that work well for one group but not the other? What does this suggest about acquisition vs retention priorities?*

> **Remember: AI outputs are starting points, not conclusions**
> The analysis surfaces patterns and hypotheses based on the data you provide. Donation conversion rate differences can have many causes — traffic quality, landing page experience, audience intent, seasonality, or tracking gaps. Use the output to decide what to investigate and test, not as a final diagnosis.

---

## Appendix A: GA4 Exploration Setup Reference

### Dimensions to add (drag to Rows)

- Landing page + query string
- Session source
- Session medium
- Session campaign
- Session default channel group

### Metrics to add (drag to Values)

- Sessions
- Purchases *(GA4's label for completed donations)*

### Recommended settings

| Setting | Recommended value |
| --- | --- |
| Date range | Last 90 days minimum; 6–12 months for lower-volume properties |
| Rows per page | 500 (to capture long-tail sources and campaigns) |
| Technique | Free form |
| Visualisation type | Table (default) |
| Sort | Sessions, descending (to see highest-volume rows first) |

---

## Appendix B: Quick Reference

**Where to find Explorations in GA4**
Left navigation > Explore (compass icon)

**How to export**
Share icon (top-right of canvas) > Export to CSV

**Minimum viable date range**
90 days. Use 6–12 months if you process fewer than 200 donations per month.

**Why does the metric say "Purchases" when I want donations?**
GA4 uses "Purchases" as the standard label for any completed transaction event. Most donation platforms (including Fundraise Up, Classy, Donorbox, and others) fire this event automatically when a donation is completed. You are measuring donations — GA4 just calls them purchases.

**What `(not set)` means in source / medium / campaign**
Traffic that arrived without UTM parameters — typically direct visits, organic search, and untagged email links. This is expected and the AI prompt accounts for it.

**What `(none)` means in session medium**
Direct traffic with no referrer and no UTM tags. Often represents bookmarked visitors or typed URLs.

**AI tools recommended for this exercise**

- Claude — claude.ai
- ChatGPT (GPT-4) — chat.openai.com
- Google Gemini — gemini.google.com
