MINT MONEY - AI FINANCIAL BUDGET ADVISOR
=========================================

FILES
  index.html   the website (layout, login, dashboard, coach)
  logic.js     all calculations, the savings search and the coach's answer rules
  config.js    your Supabase URL + public key (blank = guest/demo mode)
  schema.sql   database table + row-level security (unchanged)
  netlify.toml hosting settings
  start.bat    starts a local server on Windows
  AI_Based_Financial_Budget_Advisor_Report.docx  your report (not modified)

RUN IT LOCALLY
1. Install Python 3 if needed (python.org). 2. Double-click start.bat. The site opens at
http://localhost:8000/index.html. Keep the black server window open while you use it.
Mac/Linux: in this folder run  python3 -m http.server 8000  and open that address.
Do not open index.html by double-clicking the file; use the local server (localhost is a secure
context, which the demo-account feature needs).

THREE MODES
1. Guest (works with blank config.js): click "Try as guest". Budget saved in this browser only.
2. Local demo account (blank config.js): sign up/log in on this browser only. It is clearly
   labelled "Local demo account". It has NO email verification, NO password reset, and is NOT
   secure or production-ready. Use it only to demonstrate the screens.
3. Real accounts (Supabase configured): email + password sign up, email confirmation, log in,
   log out, session restore after refresh, password reset, budget stored per user in the cloud.

SET UP REAL ACCOUNTS (SUPABASE)
1. Create a free project at supabase.com.
2. SQL Editor -> paste all of schema.sql -> Run. This creates the budgets table with
   row-level security: each signed-in user can only read/write their own row.
3. Project Settings -> API: copy the Project URL and the public key (anon / "publishable").
   Paste them into config.js. NEVER use the service_role / "secret" key. The page detects and
   refuses one, but do not rely on that.
4. Authentication -> Providers: make sure Email is enabled. Keep "Confirm email" ON so that
   people verify their address.
5. Authentication -> URL Configuration: set Site URL to where the site runs
   (e.g. http://localhost:8000/index.html while testing, later your https Netlify address) and add
   the same address under Redirect URLs. Confirmation and reset links return there.
6. Supabase's built-in email sender is rate limited and meant for testing; for real use, set up
   custom SMTP under Authentication -> Emails.
7. Reload the site. The auth screen should show "Secure account (Supabase)".

DEPLOY TO NETLIFY
Drag this whole folder to app.netlify.com/drop (or connect a repo). Then add the Netlify URL to the
Supabase URL settings in step 5. config.js is public by design, so it must only ever hold the
public key.

THE AI COACH
- Every number comes from plain JavaScript (logic.js). The coach first builds a correct answer
  from your entered numbers, asks a short question when your message is ambiguous, and never
  treats blank fields as zero or leftover money as safe to spend.
- Optional: "Enable AI wording" downloads Qwen2.5 0.5B Instruct (about 500 MB) once, runs it on
  your device through WebLLM/WebGPU (recent Chrome or Edge), and lets it rephrase the checked
  answer in friendlier words. If the model's reply contains any number not in the checked
  answer, it is discarded and the checked answer is shown. First load may take minutes; later
  loads use the browser cache. Without it, the coach works the same way, just more plainly.

FEATURES
Guest budgeting, summaries, auto-estimate, savings goal planner, what-if preview, savings option
search (food/travel/other in 500 steps; home, bills, debt protected), CSV download, coach,
and the AI / privacy / fairness information.

KNOWN LIMITATIONS
- Educational prototype, not financial advice.
- The 0.5B model is small and can phrase things awkwardly; this is why arithmetic is not left to it.
- The coach recognises a fixed set of question types; unrecognised ones get a clarifying question.
- Amounts are in rupees (INR) only.
- Demo accounts and guest data live in browser storage: clearing site data deletes them.
- No Content-Security-Policy header is set (the app loads scripts from jsDelivr and models from
  external hosts); add one if you deploy for real users.
