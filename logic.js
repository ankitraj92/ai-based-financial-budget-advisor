/* Mint Money – deterministic logic. All arithmetic, search and feasibility checks live here, never in the language model. */
(function (root) {
  const KEYS = ['income', 'home', 'food', 'travel', 'bills', 'debt', 'savings', 'other'];
  const CATS = KEYS.slice(1);
  const LABEL = { income: 'Take-home income', home: 'Home', food: 'Food', travel: 'Travel', bills: 'Bills', debt: 'Debt payments', savings: 'Savings', other: 'Other spending' };
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

  // Blank or invalid -> null ("not entered"). Never silently 0.
  function num(v) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; }

  function summarize(raw) {
    const v = {}, missing = [];
    KEYS.forEach(k => { v[k] = num(raw[k]); if (k !== 'income' && v[k] === null) missing.push(k); });
    const entered = CATS.filter(k => v[k] !== null);
    const total = entered.reduce((s, k) => s + v[k], 0);
    const hasIncome = v.income !== null && v.income > 0;
    return { v, missing, entered, total, hasIncome, left: hasIncome ? v.income - total : null,
      rate: hasIncome && v.savings !== null ? v.savings / v.income : null, complete: missing.length === 0 };
  }

  const BASE = { home: 18000, food: 9000, travel: 4000, bills: 5000, other: 7000 };
  const CAP = { home: 100000, food: 25000, travel: 25000, bills: 20000, other: 40000 };
  // fixed = amounts the user typed themselves (kept as-is). Debt is never guessed.
  function estimate(income, fixed) {
    if (!(income > 0)) return {};
    const scale = Math.pow(income / 65000, .42), want = {};
    const used = Object.values(fixed).reduce((a, b) => a + b, 0), avail = Math.max(0, income - used);
    ['home', 'food', 'travel', 'bills', 'other', 'savings'].forEach(k => {
      if (fixed[k] === undefined) want[k] = k === 'savings' ? income * .2 : Math.min(CAP[k], BASE[k] * scale);
    });
    const tot = Object.values(want).reduce((a, b) => a + b, 0), f = tot > avail && tot ? avail / tot : 1, out = {};
    for (const k in want) out[k] = Math.floor(want[k] * f / 100) * 100;
    return out;
  }

  // Bounded search: cut food/travel/other in ₹500 steps; home, bills and debt are protected.
  function searchOptions(s, target) {
    if (!s.hasIncome) return { status: 'need_income' };
    if (s.v.savings === null) return { status: 'need_savings' };
    const need = target - s.v.savings;
    if (need <= 0) return { status: 'met' };
    const cats = ['food', 'travel', 'other'], unknown = cats.filter(k => s.v[k] === null);
    const st = cats.map(k => s.v[k] === null ? 0 : Math.floor(s.v[k] / 500));
    const maxCut = st.reduce((a, b) => a + b, 0) * 500, found = [];
    for (let a = 0; a <= st[0]; a++) for (let b = 0; b <= st[1]; b++) for (let c = 0; c <= st[2]; c++) {
      const sum = (a + b + c) * 500; if (sum < need) continue;
      found.push({ cuts: [a * 500, b * 500, c * 500], sum, count: [a, b, c].filter(Boolean).length, big: Math.max(a, b, c) });
    }
    found.sort((x, y) => x.sum - y.sum || x.count - y.count || x.big - y.big);
    return { status: found.length ? 'ok' : 'infeasible', need, cats, unknown, maxCut, options: found.slice(0, 3), left: s.left };
  }

  function goalPlan(s, target, months, already) {
    const a = already || 0, per = Math.max(0, target - a) / months;
    return { per, already: a, current: s.v.savings, gap: s.v.savings === null ? null : per - s.v.savings, left: s.left };
  }
  function whatIf(s, extra) {
    if (!s.hasIncome) return null;
    const cur = s.v.savings || 0;
    return { newLeft: s.left - extra, newRate: (cur + extra) / s.v.income, savingsMissing: s.v.savings === null };
  }

  /* ---------- Coach ---------- */
  const NOTES = [
    ['privacy', /privacy|private|data|bank|secure|safe/, 'There is no bank connection. Guest budgets stay in this browser. The optional AI model runs on your device. With a cloud account, your budget is stored in your own protected database row.'],
    ['fair', /fair|bias|discriminat/, 'The tool never asks for identity details and gives the same guidance to everyone. A single savings benchmark can still be unrealistic with high living costs, dependants or irregular income, so benchmarks are examples only.'],
    ['limits', /limit|accurate|wrong|trust|advis|professional/, 'This is educational support, not financial, tax, credit or investment advice. It only knows what you type in, and the AI can be wrong, which is why all arithmetic is done by plain code.'],
    ['debt', /debt|loan|emi|repay/, 'The app does not rank debt repayment because it does not collect interest rates, fees or terms. Debt payments stay unchanged in the savings search.'],
    ['how', /how.*(work|calculat)|what.*(rules|logic)/, 'Code adds up what you entered, compares it with income, and tests small cuts in food, travel and other spending. The AI only explains those results in plain words.']
  ];

  function parseAmount(raw) {
    const s = raw.toLowerCase().replace(/\d+\s*(months?|mos?|years?|yrs?)\b/g, ' ').replace(/\d+(\.\d+)?\s*%/g, ' ');
    const m = s.match(/(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|crores?)?(?![a-z0-9])/i);
    if (!m) return null;
    const mult = { k: 1e3, thousand: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, crore: 1e7, crores: 1e7 }[(m[2] || '').toLowerCase()] || 1;
    const n = Number(m[1].replace(/,/g, '')) * mult; return Number.isFinite(n) ? n : null;
  }
  function parseMonths(raw) {
    const m = raw.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(months?|mos?|years?|yrs?)\b/);
    return m ? Math.round(Number(m[1]) * (/^y/.test(m[2]) ? 12 : 1)) : null;
  }
  const missNote = s => s.missing.length ? ` Not entered yet: ${list(s.missing.map(k => LABEL[k].toLowerCase()))}, so totals only include what you typed.` : '';

  // Returns { text, ask, pending, action }. `text` is a complete, correct answer; the model may only rephrase it.
  function coach(q, s, pending) {
    const t = q.toLowerCase().replace(/[?!]/g, ' ').replace(/\s+/g, ' ').trim();
    const amt = parseAmount(q), months = parseMonths(q);

    if (pending && pending.type === 'budgetAmount') {
      if (/income|take.?home|salary|after tax|earn|pay\b/.test(t)) return { text: `Thanks. I've entered ${inr(pending.amount)} as your monthly take-home income. Nothing else was changed. Want me to explain what that means for your other entries?`, action: { setIncome: pending.amount } };
      if (/total|split|divide|spend|plan|expens|allocate/.test(t)) {
        const diff = pending.amount - s.total;
        return { text: s.entered.length ? `Okay, treating ${inr(pending.amount)} as the total to divide. Your entries add up to ${inr(s.total)}, which is ${diff >= 0 ? inr(diff) + ' under' : inr(-diff) + ' over'} that amount.` + missNote(s) : `Okay, ${inr(pending.amount)} is the total to divide. You haven't entered any categories yet. Which cost would you like to start with?`, ask: !s.entered.length };
      }
    }

    if (amt !== null && /\b(budget|income|salary|earn|earning|take.?home|pay)\b/.test(t) && !/expens|spend|sav|goal|target|cut|reduc|month(s)? to|how long/.test(t.replace(/monthly/, '')))
      return { text: `Thanks, ${inr(amt)} a month. Is that your take-home income after tax, or the total amount you want to divide between spending and savings?`, ask: true, pending: { type: 'budgetAmount', amount: amt } };

    if (/what should.*(budget|spend)|budget.*(for )?(expens|spend)|how much.*(spend|expens)|expens.*budget/.test(t)) {
      if (!s.hasIncome) return { text: 'To suggest a sensible range I need your monthly take-home income (after tax). What is it?', ask: true };
      const exp = s.total - (s.v.savings || 0), ex80 = s.v.income * .8;
      return { text: `As one example, if you aimed to save 20% of ${inr(s.v.income)}, all spending would fit within about ${inr(ex80)} a month. That's a discussion benchmark, not a rule. Your entered spending (excluding savings) is ${inr(exp)}.${missNote(s)} Fixed costs like housing and bills usually come first, so tell me if your situation differs.` };
    }

    if (/(option|way|how).*(save|reach|hit)|reduce|cut (back|down)|trim/.test(t) || (/save/.test(t) && amt && /month/.test(t) && !months)) {
      if (amt === null) return { text: 'What monthly savings amount are you aiming for? I\'ll check which small cuts in food, travel and other spending could get there.', ask: true };
      const r = searchOptions(s, amt);
      if (r.status === 'need_income') return { text: 'I need your monthly take-home income first. What is it?', ask: true };
      if (r.status === 'need_savings') return { text: 'You haven\'t entered your current monthly savings yet, so I can\'t tell how far you are from the target. What are you saving now?', ask: true };
      if (r.status === 'met') return { text: `Your entered savings already meet ${inr(amt)} a month, so no cuts are needed.` };
      if (r.status === 'infeasible') return { text: `Reaching ${inr(amt)} needs ${inr(r.need)} more per month, but food, travel and other spending can free at most ${inr(r.maxCut)} (in ₹500 steps). Home, bills and debt aren't touched. You could lower the target or check your entries.` + (r.unknown.length ? ` ${list(r.unknown)} not entered, so I couldn't count them.` : '') };
      const o = r.options[0], parts = r.cats.map((k, i) => o.cuts[i] ? `${LABEL[k].toLowerCase()} by ${inr(o.cuts[i])}` : null).filter(Boolean);
      return { text: `To reach ${inr(amt)}, the smallest change I found is cutting ${list(parts)} (${inr(o.sum)} in total). You can see more options under "Compare savings options". Only you know whether those cuts are realistic.` + (r.left < 0 ? ' Note your entries are already above income, so moving money to savings doesn\'t fix that.' : '') };
    }

    if (/goal|save up|saving for|target of/.test(t) || (amt && months)) {
      if (amt === null || !months) return { text: 'Happy to work that out. What is the goal amount, and in how many months?', ask: true };
      const g = goalPlan(s, amt, months, 0);
      return { text: `Saving ${inr(amt)} in ${months} months means setting aside about ${inr(g.per)} a month (no interest assumed, nothing counted as already saved).` + (g.gap === null ? ' You haven\'t entered your current savings, so I can\'t compare.' : g.gap > 0 ? ` That is ${inr(g.gap)} more than the ${inr(g.current)} you currently enter.` : ` Your entered savings of ${inr(g.current)} already cover that.`) };
    }

    if (/what if|extra|more to sav/.test(t) && amt !== null) {
      const w = whatIf(s, amt);
      if (!w) return { text: 'I need your take-home income to preview that. What is it?', ask: true };
      return { text: `Adding ${inr(amt)} to savings would leave ${w.newLeft >= 0 ? inr(w.newLeft) + ' unplanned' : inr(-w.newLeft) + ' above your income'} and put savings at ${Math.round(w.newRate * 100)}% of income.` + (w.savingsMissing ? ' Your current savings aren\'t entered, so that rate counts only the extra amount.' : '') };
    }

    if (/why|tight|short|over budget|shortfall|overspen/.test(t)) {
      if (!s.hasIncome) return { text: 'I need your take-home income to say. What is it?', ask: true };
      if (!s.entered.length) return { text: 'You haven\'t entered any spending yet, so there is nothing to compare. Which cost would you like to add first?', ask: true };
      const top = s.entered.filter(k => k !== 'savings').sort((a, b) => s.v[b] - s.v[a])[0];
      return { text: s.left < 0 ? `Your entries are ${inr(-s.left)} above your ${inr(s.v.income)} income. The largest entered cost is ${LABEL[top].toLowerCase()} at ${inr(s.v[top])}. Check each amount is monthly. I can't assume essentials can be cut.` : `Your entered spending is within income by ${inr(s.left)}.${missNote(s) || ' Costs you haven\'t entered, like annual bills, would change this.'}` };
    }

    if (/saving.? rate|how much.*sav|save more|am i saving/.test(t)) {
      if (!s.hasIncome || s.v.savings === null) return { text: `I need both ${s.hasIncome ? '' : 'income and '}your monthly savings to work out a savings rate. Could you enter ${s.hasIncome ? 'savings' : 'them'}?`, ask: true };
      const gap = Math.max(0, s.v.income * .2 - s.v.savings);
      return { text: `You enter ${inr(s.v.savings)} for savings, about ${Math.round(s.rate * 100)}% of ${inr(s.v.income)}. The 20% figure is only an example. ` + (gap ? `Reaching it would mean ${inr(gap)} more, if that fits your situation. ` : 'You already meet it. ') + 'Unplanned money isn\'t automatically safe to save or spend; irregular bills may need it.' + missNote(s) };
    }

    if (/summar|explain|overview|my budget|snapshot|where do i stand|how am i/.test(t)) {
      if (!s.hasIncome) return { text: 'Start by entering your monthly take-home income. Then I can summarise your budget.', ask: true };
      return { text: `You enter ${inr(s.v.income)} income and ${inr(s.total)} of spending, so ${s.left >= 0 ? inr(s.left) + ' is unplanned' : inr(-s.left) + ' is above income'}.` + missNote(s) + ' Unplanned money isn\'t automatically spare; upcoming irregular costs may need it.' };
    }

    for (const [, re, text] of NOTES) if (re.test(t)) return { text };

    return { text: 'I\'m not sure what you\'d like to know. I can summarise your budget, check your savings rate, plan a goal, or look for savings options. Which would help?', ask: true, unknown: true };
  }

  const api = { KEYS, CATS, LABEL, inr, num, summarize, estimate, searchOptions, goalPlan, whatIf, parseAmount, parseMonths, coach, NOTES };
  if (typeof module !== 'undefined') module.exports = api; else root.MintLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
