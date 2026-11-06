/**
 * Balancing a City Budget: Google Apps Script backend
 *
 * Paste this into Extensions > Apps Script of an empty Google Sheet.
 * 1. Run setup() once and approve the permissions.
 * 2. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 * 3. Copy the /exec URL into CONFIG.API_URL in index.html.
 * After any edit here: Deploy > Manage deployments > edit > Version: New version.
 *
 * There is one simulation for everyone. The teacher resets it between classes.
 *
 * Sheets it keeps:
 *   Control   whether budgets are locked
 *   Budgets   one row per group: city name and profile, base and final budget, what it granted,
 *             and one column per department
 *   Archive   rows moved out of Budgets when the teacher resets the simulation
 */

// The comptroller's starting budgets, from the Google Doc. Each new group gets one at random,
// without repeats until the list runs out (then the whole list is used again).
const BUDGETS = [4000000, 3000000, 2750000, 2500000, 2500000, 2250000, 2000000];

// How each city-profile choice changes the starting budget: [percent, reason shown to students].
// The choice names must match PROFILE in index.html. Once a group sees its budget, its choices are final.
const EFFECTS = {
  setting: {
    'Urban': [5, 'More people and businesses on each block means more property and sales tax.'],
    'Suburban': [0, 'An average tax base: homes and shopping centers, but few big employers.'],
    'Rural': [-5, 'Fewer people and businesses, spread over more land, bring in less tax.']
  },
  economy: {
    'Industry-focused': [6, 'Factories, warehouses, ports and rail yards pay business and property taxes.'],
    'Bedroom community': [-4, 'Residents work and shop in other cities, so most of their sales and business taxes go there.'],
    'Service center': [2, 'Shops and offices bring in sales tax, but hospitals and colleges are often tax-exempt nonprofits.']
  },
  residents: {
    'Mostly working-class': [-6, 'Lower home values mean less property tax.'],
    'Mixed-income': [0, 'Property tax from a mix of home values.'],
    'Mostly wealthy': [8, 'High home values bring in more property tax.']
  },
  location: {
    'On the coast': [-4, 'Seawall upkeep and flood repairs come out of the budget first.'],
    'In the hills': [-3, 'Clearing brush and cutting fire breaks come out of the budget first.'],
    'In a valley': [-3, 'Cooling centers and air-quality alerts come out of the budget first.']
  }
};
const PROFILE = ['setting', 'economy', 'residents', 'location'];
const MAX_GROUP = 30;

const FIXED = ['Group', 'City', 'Setting', 'Economy', 'Residents', 'Location', 'Base budget', 'Budget',
               'Granted', 'Remaining', 'Decided', 'Submitted', 'Updated', 'Allocations'];
const HEADERS = {
  Control: ['Setting', 'Value', 'Updated'],
  Budgets: FIXED,
  Archive: ['Archived', 'Group', 'City', 'Setting', 'Economy', 'Residents', 'Location', 'Base budget', 'Budget',
            'Granted', 'Submitted', 'Allocations', 'Department totals']
};
const RESTARTED = 'Your teacher reset the simulation. Choose your group again to open your new budget.';

function setup() {
  Object.keys(HEADERS).forEach(sheet_);
}

function doGet(e) {
  return out_(handle_((e && e.parameter) || {}));
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return out_({ ok: false, error: 'The request was not valid JSON.' }); }
  return out_(handle_(body));
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(p) {
  try {
    switch (p.action) {
      case 'state': return state_(p);
      case 'join': return locked_(() => join_(p));
      case 'setProfile': return locked_(() => setProfile_(p));
      case 'rename': return locked_(() => rename_(p));
      case 'save': return locked_(() => save_(p));
      case 'teacher': return teacher_();
      case 'setBudget': return locked_(() => setBudget_(p));
      case 'setLock': return locked_(() => setLock_(p));
      case 'reset': return locked_(() => reset_());
      default: return { ok: false, error: 'Unknown action.' };
    }
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

/* ---------- helpers ---------- */

function cleanGroup_(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > MAX_GROUP) throw new Error('Pick your group number first.');
  return n;
}

function money_(v) {
  const n = Math.round(Number(v));
  if (!isFinite(n) || n < 0) return 0;
  return Math.min(n, 100000000);
}

let HOLDING_LOCK_ = false;
function locked_(fn) {
  if (HOLDING_LOCK_) return fn();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  HOLDING_LOCK_ = true;
  try { return fn(); }
  finally { HOLDING_LOCK_ = false; lock.releaseLock(); }
}

function clip_(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }

// Stops Sheets from reading "=..." as a formula.
function cell_(s) { s = String(s == null ? '' : s); return s ? "'" + s : ''; }

function parse_(s) { try { return JSON.parse(s); } catch (e) { return null; } }

function iso_(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ---------- city profile and its effect on the budget ---------- */

function profileSet_(profile) {
  return PROFILE.every(k => profile && EFFECTS[k][profile[k]]);
}

// Each effect is rounded to the nearest $1,000, so the lines add up exactly to the final budget.
function effects_(base, profile) {
  if (!profileSet_(profile)) return [];
  return PROFILE.map(k => {
    const e = EFFECTS[k][profile[k]];
    return { question: k, choice: profile[k], pct: e[0], amount: Math.round(base * e[0] / 100 / 1000) * 1000, why: e[1] };
  });
}

function finalBudget_(base, profile) {
  return effects_(base, profile).reduce((s, e) => s + e.amount, base);
}

/* ---------- lock ---------- */

function controlRow_() {
  const v = sheet_('Control').getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]) === 'Locked') return { row: i + 1, value: v[i][1] };
  return null;
}

function isLocked_() {
  const c = controlRow_();
  return !!c && (c.value === true || String(c.value).toUpperCase() === 'TRUE');
}

/* ---------- budgets sheet ---------- */

function readBudgets_() {
  const sh = sheet_('Budgets');
  const v = sh.getDataRange().getValues();
  const header = v[0].map(String);
  const deptCols = header.slice(FIXED.length);
  const rows = [];
  for (let i = 1; i < v.length; i++) {
    const r = v[i];
    if (r[0] === '' || r[0] == null) continue;
    const depts = {};
    deptCols.forEach((name, j) => {
      const x = r[FIXED.length + j];
      if (name && x !== '' && x != null) depts[name] = Number(x) || 0;
    });
    rows.push({
      row: i + 1,
      group: Number(r[0]),
      city: String(r[1] || ''),
      profile: { setting: String(r[2] || ''), economy: String(r[3] || ''), residents: String(r[4] || ''), location: String(r[5] || '') },
      base: Number(r[6]) || 0,
      budget: Number(r[7]) || 0,
      granted: Number(r[8]) || 0,
      decided: Number(r[10]) || 0,
      submitted: r[11] === true || String(r[11]).toUpperCase() === 'TRUE',
      updated: iso_(r[12]),
      alloc: parse_(r[13]) || {},
      depts: depts
    });
  }
  return { sh: sh, header: header, rows: rows };
}

function public_(r) {
  if (!r) return null;
  const set = profileSet_(r.profile);
  return {
    group: r.group, city: r.city, profile: r.profile, profileSet: set,
    base: r.base, budget: r.budget, effects: effects_(r.base, r.profile),
    granted: r.granted, decided: r.decided, submitted: r.submitted, updated: r.updated, alloc: r.alloc, depts: r.depts
  };
}

function find_(b, group) {
  return b.rows.filter(r => r.group === group)[0] || null;
}

function pickBudget_(b) {
  const pool = BUDGETS.slice();
  b.rows.forEach(r => {
    const i = pool.indexOf(r.base);
    if (i > -1) pool.splice(i, 1);
  });
  const from = pool.length ? pool : BUDGETS;
  return from[Math.floor(Math.random() * from.length)];
}

function create_(b, group) {
  const base = pickBudget_(b);
  const row = [group, '', '', '', '', '', base, base, 0, base, 0, false, new Date(), '{}'];
  while (row.length < b.header.length) row.push('');
  b.sh.appendRow(row);
  return readBudgets_();
}

// Adds a column for any department the Sheet hasn't seen yet, then returns the column number for each.
function deptColumns_(b, names) {
  const cols = {};
  const header = b.header.slice();
  names.forEach(name => {
    let i = header.indexOf(name);
    if (i < FIXED.length) {
      header.push(name);
      i = header.length - 1;
      b.sh.getRange(1, i + 1).setValue(name);
    }
    cols[name] = i + 1;
  });
  b.header = header;
  return cols;
}

function col_(name) { return FIXED.indexOf(name) + 1; }

/* ---------- actions ---------- */

function state_(p) {
  const group = cleanGroup_(p.group);
  return { ok: true, locked: isLocked_(), me: public_(find_(readBudgets_(), group)) };
}

function join_(p) {
  const group = cleanGroup_(p.group);
  let b = readBudgets_();
  if (!find_(b, group)) b = create_(b, group);
  return { ok: true, locked: isLocked_(), me: public_(find_(b, group)) };
}

// Saves the city's name and profile, and sets its final budget. A profile can be set only once:
// if another device in the group got there first, this returns that profile instead.
function setProfile_(p) {
  const group = cleanGroup_(p.group);
  const b = readBudgets_();
  const me = find_(b, group);
  if (!me) throw new Error(RESTARTED);
  if (profileSet_(me.profile)) return { ok: true, already: true, locked: isLocked_(), me: public_(me) };

  const raw = (p.profile && typeof p.profile === 'object') ? p.profile : {};
  const profile = {};
  PROFILE.forEach(k => { profile[k] = clip_(raw[k], 40); });
  if (!profileSet_(profile)) throw new Error('Answer all four questions about your city first.');
  const city = clip_(p.city, 60);
  if (!city) throw new Error('Name your city first.');

  const budget = finalBudget_(me.base, profile);
  b.sh.getRange(me.row, col_('City'), 1, 5).setValues([[cell_(city), cell_(profile.setting), cell_(profile.economy), cell_(profile.residents), cell_(profile.location)]]);
  b.sh.getRange(me.row, col_('Budget')).setValue(budget);
  b.sh.getRange(me.row, col_('Remaining')).setValue(budget - me.granted);
  b.sh.getRange(me.row, col_('Updated')).setValue(new Date());
  Object.assign(me, { city: city, profile: profile, budget: budget });
  return { ok: true, locked: isLocked_(), me: public_(me) };
}

function rename_(p) {
  const group = cleanGroup_(p.group);
  const b = readBudgets_();
  const me = find_(b, group);
  if (!me) throw new Error(RESTARTED);
  const city = clip_(p.city, 60);
  if (!city) throw new Error('Type a name for your city.');
  b.sh.getRange(me.row, col_('City')).setValue(cell_(city));
  me.city = city;
  return { ok: true, locked: isLocked_(), me: public_(me) };
}

function save_(p) {
  const group = cleanGroup_(p.group);
  if (isLocked_()) throw new Error('Your teacher has locked budgets, so changes can’t be saved.');

  const b = readBudgets_();
  const me = find_(b, group);
  if (!me) throw new Error(RESTARTED);

  const alloc = {};
  let granted = 0, decided = 0;
  const raw = (p.alloc && typeof p.alloc === 'object') ? p.alloc : {};
  Object.keys(raw).slice(0, 200).forEach(k => {
    if (!/^[a-z]{2,8}\d{1,2}$/.test(k)) return;
    if (raw[k] === null || raw[k] === '') return;
    const n = money_(raw[k]);
    alloc[k] = n; granted += n; decided++;
  });

  const depts = {};
  const rawD = (p.depts && typeof p.depts === 'object') ? p.depts : {};
  Object.keys(rawD).slice(0, 30).forEach(k => { depts[clip_(k, 80)] = money_(rawD[k]); });

  const submitted = !!p.submitted;
  if (submitted && granted > me.budget) {
    throw new Error('This budget is over by $' + (granted - me.budget).toLocaleString('en-US') + '. Cut some grants before submitting.');
  }

  const now = new Date();
  b.sh.getRange(me.row, col_('Granted'), 1, 6).setValues([[granted, me.budget - granted, decided, submitted, now, JSON.stringify(alloc)]]);
  const cols = deptColumns_(b, Object.keys(depts));
  Object.keys(depts).forEach(name => b.sh.getRange(me.row, cols[name]).setValue(depts[name]));

  Object.assign(me, { granted: granted, decided: decided, submitted: submitted, updated: now.toISOString(), alloc: alloc, depts: depts });
  return { ok: true, locked: false, me: public_(me) };
}

function teacher_() {
  const choices = BUDGETS.filter((x, i, a) => a.indexOf(x) === i).sort((a, b) => b - a);
  return { ok: true, budgets: choices, locked: isLocked_(), groups: readBudgets_().rows.map(public_), at: new Date().toISOString() };
}

// The teacher changes a group's starting budget; its profile effects are applied on top.
function setBudget_(p) {
  const group = cleanGroup_(p.group);
  const base = money_(p.budget);
  if (!base) throw new Error('Choose a budget amount.');
  let b = readBudgets_();
  if (!find_(b, group)) b = create_(b, group);
  const me = find_(b, group);
  const budget = profileSet_(me.profile) ? finalBudget_(base, me.profile) : base;
  const stillSubmitted = me.submitted && me.granted <= budget;
  b.sh.getRange(me.row, col_('Base budget'), 1, 2).setValues([[base, budget]]);
  b.sh.getRange(me.row, col_('Remaining')).setValue(budget - me.granted);
  b.sh.getRange(me.row, col_('Submitted')).setValue(stillSubmitted);
  return teacher_();
}

function setLock_(p) {
  const c = controlRow_();
  const sh = sheet_('Control');
  if (c) sh.getRange(c.row, 2, 1, 2).setValues([[!!p.locked, new Date()]]);
  else sh.appendRow(['Locked', !!p.locked, new Date()]);
  return teacher_();
}

// Moves every group's budget to the Archive tab and unlocks, so the next class starts fresh.
function reset_() {
  const b = readBudgets_();
  const archive = sheet_('Archive');
  const now = new Date();
  b.rows.forEach(r => archive.appendRow([
    now, r.group, cell_(r.city), cell_(r.profile.setting), cell_(r.profile.economy), cell_(r.profile.residents), cell_(r.profile.location),
    r.base, r.budget, r.granted, r.submitted, JSON.stringify(r.alloc), JSON.stringify(r.depts)
  ]));
  b.rows.map(r => r.row).sort((a, c) => c - a).forEach(row => b.sh.deleteRow(row));
  setLock_({ locked: false });
  return teacher_();
}
