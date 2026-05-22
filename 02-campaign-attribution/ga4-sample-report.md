# GA4 Traffic and Donation Conversion Report
## Sample Output — Anonymized for Workshop Use

> **Note for workshop presenters:** This is a real AI-generated analysis based on 12 months of GA4 data from a mid-size nonprofit. All org names, campaign codes, and identifying page paths have been replaced with generic labels. All numbers are unchanged — the data patterns are real.

---

## Executive Summary

The GA4 export covers 748,315 sessions and 21,106 donations over the 12 months ending May 2026, for a site-wide donation conversion rate of 2.82%. The export contains 100,000 rows representing 83% of total sessions; the remaining 17% (≈128K sessions) are in long-tail rows not captured here, so channel and campaign totals should be treated as directionally accurate rather than exhaustive. Paid Search and Email are dramatically over-performing their session share, converting at 8.7% and 7.2% respectively, while Paid Social is near-zero despite 15,000 sessions. Two donation-page variants are generating outsized volume and conversion simultaneously, and a flagship walk event campaign (`[Event-Campaign-B]`) has sent over 12,400 sessions to the site with zero recorded donations — the single largest apparent conversion gap in the dataset.

---

## 1. Overall Picture

| Metric | Value |
| --- | --- |
| Total sessions (full dataset) | 748,315 |
| Total donations | 21,106 |
| Overall donation conversion rate | **2.82%** |

**Top 3 sources by donation volume** (from the 100K-row sample):

| Source | Sessions | Donations | CVR |
| --- | --- | --- | --- |
| google | 227,879 | 7,901 | 3.47% |
| (direct) | 191,733 | 3,241 | 1.69% |
| [InternalReferral] | 3,404 | 1,150 | 33.8% |

**Top 3 sources by CVR** (minimum 50 sessions):

| Source | Sessions | Donations | CVR |
| --- | --- | --- | --- |
| [DM-Vanity-URL-A] | 86 | 74 | 86.0% |
| [DM-QR-Campaign] | 75 | 38 | 50.7% |
| [DM-Campaign-A-Vanity] | 231 | 99 | 42.9% |

The high-CVR sources are all direct mail vanity URLs and QR codes — audiences arriving from a physical appeal with clear intent. These are not sources you can scale by buying more media; they reflect campaign design quality, not channel efficiency.

---

## 2. Channel and Source Performance

| Channel | Sessions | Donations | CVR |
| --- | --- | --- | --- |
| Paid Search | 43,616 | 3,799 | **8.71%** |
| Email | 44,063 | 3,154 | **7.16%** |
| Referral | 39,365 | 2,095 | 5.32% |
| Cross-network | 67,629 | 2,874 | 4.25% |
| Unassigned | 12,588 | 604 | 4.80% |
| Direct | 191,733 | 3,241 | 1.69% |
| Organic Search | 124,541 | 1,973 | 1.58% |
| Organic Social | 54,761 | 760 | 1.39% |
| Paid Other | 18,535 | 200 | 1.08% |
| Display | 7,282 | 6 | 0.08% |
| **Paid Social** | **15,099** | **4** | **0.03%** |

**Highest-opportunity gaps** (significant volume, meaningfully below the 2.82% average):

- **Paid Social** is the starkest failure: 15,099 sessions, 4 donations, 0.03% CVR. The entire Paid Social effort generated no measurable donation conversion. The question is whether this is an audience problem or a form and landing page problem — the same donation pages convert at 20%+ from other channels.
- **Organic Search** brings 124,541 sessions (the second-largest channel) at only 1.58% CVR. This is partly structural — much of this traffic lands on blog posts and informational pages — but it represents the largest absolute donation volume being left on the table.
- **Direct** at 191,733 sessions and 1.69% CVR contains a 24,218-session block where landing page is "(not set)," almost certainly representing broken or untagged journeys.

---

## 3. Campaign Analysis

**Top campaigns by donation volume:**

| Campaign | Sessions | Donations | CVR |
| --- | --- | --- | --- |
| [Search-Brand-Core] | 8,874 | 1,691 | 19.1% |
| [InternalReferral] | 3,403 | 1,150 | 33.8% |
| [Pmax-HighIncome] | 6,487 | 758 | 11.7% |
| [Pmax-Summer] | 14,562 | 737 | 5.1% |
| [Search-DonationPage-Priority] | 5,776 | 636 | 11.0% |
| [Pmax-LowerIncome] | 10,784 | 483 | 4.5% |

**Top campaigns by CVR** (min 200 sessions):

| Campaign | Sessions | Donations | CVR |
| --- | --- | --- | --- |
| [DM-Campaign-A-3] | 260 | 172 | 66.2% |
| [DM-Campaign-A-2] | 202 | 114 | 56.4% |
| [DM-Campaign-A-5] | 202 | 109 | 54.0% |
| [InternalReferral] | 3,403 | 1,150 | 33.8% |

The `[DM-Campaign-A]` series (direct mail integrated campaigns) are delivering extraordinary CVRs. These are not anomalies — multiple campaigns in this family show 30–60%+ conversion, confirming that the fall direct mail program is exceptionally well-integrated with digital donation landing pages.

**High-traffic campaigns with near-zero donation conversion — flag for investigation:**

| Campaign | Sessions | Donations | CVR |
| --- | --- | --- | --- |
| **[Event-Campaign-B]** | **12,405** | **0** | **0.00%** |
| [Pmax-LowerIncome-Region] | 9,843 | 5 | 0.05% |
| [DSA-SearchAIMax] | 8,540 | 39 | 0.46% |
| [Pmax-HighIncome-55plus-Region] | 7,234 | 4 | 0.06% |
| [Event-Campaign-C] | 4,913 | 0 | 0.00% |
| [Walk-Event-2026] | 2,644 | 0 | 0.00% |

**`[Event-Campaign-B]` is the most urgent flag.** Over 12,400 sessions with zero donations recorded. This is almost certainly a tracking issue — the campaign drives traffic to an event registration page (`/event-registration/`), and the registration completion event is not tagged as a GA4 donation conversion. It is not a donation campaign, so zero *donation* conversions is expected — but if this is being reported alongside donation data without that distinction noted, it will make the campaign appear to have wasted every dollar spent on it. This is the forensics finding: the data is not wrong, the question being asked of it is wrong.

The **geo-targeted Pmax campaigns** (`[Pmax-LowerIncome-Region]` and `[Pmax-HighIncome-55plus-Region]`) together drove 17,000+ sessions with 9 donations between them. These appear to be display/discovery ads landing on a campaign page that converts at ~5% from paid search but is apparently serving the wrong audience in these geo segments.

The **`[DSA-SearchAIMax]`** campaign sent 8,540 sessions almost entirely to non-donation pages: /careers/, /contact-us/, /events/, and blog articles. Dynamic search is picking up terms and matching them to irrelevant pages on the site.

---

## 4. Landing Page Patterns

**Top landing pages by volume and donation CVR:**

| Landing Page | Sessions | Donations | CVR |
| --- | --- | --- | --- |
| / (homepage) | 90,938 | 2,808 | 3.09% |
| (not set) | 70,912 | 34 | 0.05% |
| /fundraising/ (P2P) | 20,035 | 1,285 | 6.41% |
| /campaign-landing/ | 18,427 | 885 | 4.80% |
| /event-registration/ | 11,460 | 0 | 0.00% |
| **/why-give/donations-change-everything/** | **11,157** | **2,297** | **20.6%** |
| /fall-donation-match/ | 10,040 | 825 | 8.22% |
| /about-us/careers/ | 9,273 | 2 | 0.02% |
| /why-give/go-beyond-belief/ | 9,135 | 535 | 5.86% |
| **/donations/donations-changes-everything/** | **7,009** | **1,595** | **22.8%** |
| /why-give/giving-tuesday/ | 4,108 | 1,359 | 33.1% |

**High-traffic pages converting below average — flag:**

- **(not set) — 70,912 sessions, 0.05% CVR.** The second-largest "landing page" in the dataset is definitionally broken. These sessions couldn't be attributed to a landing page — likely due to tag firing issues, cross-domain tracking gaps, or direct app entries. 70K sessions producing 34 donations is a significant attribution problem.
- **/about-us/careers/ — 9,273 sessions, 0.02% CVR.** Paid campaigns are sending thousands of sessions here. These visitors are looking for jobs. Google is matching donation-intent keywords to the careers page — a campaign exclusion fix, not a conversion rate problem.
- **/event-registration/ — 11,460 sessions, 0 donations.** The event registration funnel. Zero donation conversions is expected for an event sign-up page — but its presence in this report distorts channel and campaign averages.

**High-CVR pages with low traffic — opportunity:**

- **/donations/nov-dm/ — 152 sessions, 73.0% CVR.** A direct mail landing page used almost exclusively by DM recipients. No paid media points here.
- **/seasonal-match/ — 358 sessions, 28.8% CVR.** Seasonal page. Worth examining whether the offer or copy can inform ongoing donation pages.
- **/donations/in-memory/ — 557 sessions, 18.9% CVR.** High intent, low traffic. In-memory giving is a known high-value donor segment and this page is receiving no meaningful paid traffic.
- **/why-give/giving-tuesday/ — 4,108 sessions, 33.1% CVR.** Third-highest donation count (1,359) in the entire dataset combined with an exceptional conversion rate. Reflects a concentrated campaign period — worth examining what drove the combination of volume and conversion.

---

## 5. Quick Wins and Priority Actions

**1. Exclude non-donation pages from dynamic and performance-max campaigns**

*What the data shows:* The careers page received 9,273 sessions, with thousands coming directly from paid campaigns. The `[DSA-SearchAIMax]` campaign delivered hundreds of sessions to /careers/ and /contact-us/ — pages with zero donation conversion. Combined across campaigns, paid spend is funding sessions to job-seekers and people looking for a contact form.

*Practical test:* Add /careers/, /contact-us/, /events/*, and /news-and-media/* as URL exclusions in the DSA and Pmax campaigns. No creative or landing page changes required. Measure sessions and conversion rate to the remaining pages in the two weeks following.

**2. Redirect or consolidate the two high-converting donation page variants**

*What the data shows:* `/why-give/donations-change-everything/` (11,157 sessions, 20.6% CVR) and `/donations/donations-changes-everything/` (7,009 sessions, 22.8% CVR) are functionally similar pages with nearly identical conversion rates. Together they produce 3,892 donations — the highest volume of any single page cluster in the dataset — but paid campaigns are split between them inconsistently.

*Practical test:* Audit which campaigns point to which variant. Redirect all paid traffic to the higher-CVR URL as a default and measure whether conversion holds or improves. This requires only a redirect configuration and a campaign URL update — no design work.

**3. Run paid traffic to the in-memory giving page**

*What the data shows:* The in-memory giving page converts at 18.9% from 557 organic/direct sessions. It receives no meaningful paid traffic. In-memory giving donors are a distinct, high-intent segment who are underserved by the current paid media mix.

*Practical test:* Set up a small paid search campaign targeting in-memory/tribute gift keywords, pointing to /donations/in-memory/. With a 15–19% expected CVR (conservative haircut from the organic baseline), even 100 sessions would be expected to yield 15–19 donations. This establishes a baseline cost-per-acquisition for a segment not currently in the paid mix.

---

## 6. The Unanswered Question

**What is the donation value — average gift and total revenue — by channel and campaign?**

This data reports donation transactions only, with no revenue dimension. That changes the entire prioritisation. Paid Search converts at 8.7% and Email at 7.2% — but if Email donors give $500 on average and paid search donors give $50, the channel economics flip completely. Similarly, the direct mail integrated campaigns convert at 50–66%, which looks exceptional — but if those are all $25 reactivation gifts and the high-income Pmax campaign is acquiring $1,000 donors at 11.7% CVR, the Pmax campaign is the one deserving more budget. Without revenue per session or average gift by channel, it is not possible to calculate return on ad spend, determine which channels to invest in, or make a defensible case for budget reallocation.

---

*This report was generated by AI from a GA4 Free-Form Exploration export. All findings are based on the data as provided. Org name, campaign codes, and page paths have been anonymized for workshop use. Numbers are unchanged.*
