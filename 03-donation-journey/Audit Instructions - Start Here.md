# Donation Journey Audit — Start Here

Welcome! This tool automatically scans your organisation's donation journey and scores it across multiple dimensions — no technical background needed to use it.

---

## Section 1: What this tool does

- **Scans your donation journey automatically** using a real browser (the same Chrome browser you use every day, just controlled by code)
- **Scores 7–9 dimensions** of your donation experience on a 1–4 scale — things like form friction, trust signals, mobile experience, and payment clarity
- **After the scan, asks you ~8 quick yes/no questions** to fill in things the scanner can't detect automatically (e.g. "Do you show a match gift prompt?")
- **Produces a single Markdown report** with an executive summary, scored rubric, priority fixes, and scoring guide
- **Takes about 2–3 minutes total** per site

You'll end up with a prioritised list of fixes, each with an estimated conversion impact, that you can share with your team or agency immediately.

---

## Section 2: One-time setup (do this first)

You only need to do this once. It takes about 3–5 minutes.

### Step 1: Install Node.js

Node.js is the engine that runs this tool. Download it from **[nodejs.org](https://nodejs.org)** and choose the **LTS** version.

> **Already have it?** To check, open Terminal and type:
> ```
> node --version
> ```
> If you see a version number (e.g. `v20.11.0`), you're all set — skip to Step 2.

### Step 2: Open Terminal and navigate to this folder

On Mac, open **Terminal** (search for it in Spotlight with `Cmd + Space`).

Then type:

```
cd ~/Desktop/workshop-github-assets/03-donation-journey
```

Press Enter.

### Step 3: Run setup

This downloads the browser the tool uses — about 170MB, one-time only:

```
npm install && npx playwright install chromium
```

You'll see a progress bar. It takes 1–3 minutes depending on your connection. When it's done, you'll see your prompt again.

That's it — you're ready to run your first audit.

---

## Section 3: Running your first audit

In Terminal (make sure you're still in the `03-donation-journey` folder), run:

```
node audit.js --url https://yoursite.org
```

Replace `yoursite.org` with your organisation's homepage URL.

**If you know your donation form URL directly**, you can add it as a second argument to skip the crawl step:

```
node audit.js --url https://yoursite.org --donation-url https://yoursite.org/donate
```

**What happens next:**

1. The tool opens a browser and crawls your site — this takes about 90 seconds
2. After the scan, it asks you ~8 yes/no questions — answer each with `y` or `n` and press Enter
3. When done, the terminal shows the exact path to your report — copy and paste that path to open it

---

## Section 4: Your report

Your report is a Markdown file that you can open in:

- Any **text editor** (TextEdit on Mac, Notepad on Windows)
- **VS Code** (if you have it)
- **Notion** or **Google Docs** — just paste the contents in
- Any Markdown previewer

**What's inside:**

- **Executive Summary** — your overall score out of 28 (or 32 for UK organisations) and a plain-English summary
- **Scored Rubric** — each dimension listed with your score (1–4) and what was found
- **Priority Fixes** — ordered by estimated conversion impact; work top to bottom
- **Scoring Guide** — explains what each dimension checks and what each score level means

---

## Section 5: Re-running / updating answers

Your answers to the yes/no questions are saved in a file called `interactive-answers.json` inside your audit output folder.

- **To change your answers:** delete `interactive-answers.json` and re-run the audit
- **To re-scan the site:** just re-run the same command — the tool always overwrites the previous report
- You can re-run as many times as you like

---

## Section 6: When the scanner gets blocked

Some websites use Cloudflare or other security tools that block automated browsers. If your scan produces blank results, times out, or shows an error:

**Don't worry — you can still score your journey manually.**

1. Take screenshots of:
   - Your **homepage** (with the main Donate CTA visible)
   - Your **donation form** (the amount-selection step)
   - Your **payment step** (card details / checkout)
2. Use the **rubric dimensions** in your report as a checklist
3. Score each dimension on the 1–4 scale based on what you see in the screenshots

The same scoring guide applies whether you scored automatically or manually — the report is equally useful either way.

---

*Questions during the workshop? Raise your hand or find the facilitator.*
