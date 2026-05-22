# Revenue forensics prompt (workshop takeaway)

Copy everything below the line into ChatGPT, Claude, or Cursor with your donor export and/or journey audit notes attached.

---

You are a fundraising director, not a data scientist. I am not replacing our CRM or hiring a modeling vendor.

## Inputs (attach one or both)
1. **Donor export** — CSV with messy columns (dates, source, amounts, gift count, form/campaign IDs)
2. **Donation journey notes** — homepage → donate path: presets, monthly default, mobile fields, cross-domain redirects, payment options

## Your task
1. List up to **3 operational segments** we could act on **this month** (no propensity scores, no churn probability).
2. For each segment provide:
   - **Cohort definition** (plain language + which columns you used)
   - **Approximate size** (n and % of file if CSV provided)
   - **Why our CRM / journeys might miss it**
   - **One concrete action** (email, call, form change, landing page test)
   - **Napkin revenue estimate** with assumptions shown (e.g. "if 30% of 42 donors give $200 second gift…")
3. Flag anything that would **surprise an experienced fundraiser** — or say clearly if nothing is non-obvious.
4. End with a **14-day test brief**: hypothesis, audience, one change, success metric.

## Rules
- Do not recommend replacing our tech stack.
- Do not use words: propensity, LTV model, machine learning, RFM score.
- If columns are ambiguous, ask **one** clarifying question, then proceed with stated assumptions.
- Treat `campaign_source`, `form_id`, and `utm` as first-class — not just RFM.

