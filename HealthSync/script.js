/* ===== HealthSync — script.js =====
   One localStorage object ("healthsync_db") holds every account and its data.
   Every page is drawn from that same data, so one change updates everything. */
const KEY = "healthsync_db";
let db = JSON.parse(localStorage.getItem(KEY) || "null") || { users: {}, session: null };
let page = "dashboard", editing = {};          // current page, record being edited
const $ = (id) => document.getElementById(id);
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
const U = () => db.users[db.session];
const dkey = (d) => d.toLocaleDateString("en-CA");  // YYYY-MM-DD in local time
const today = () => dkey(new Date());
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bar = (p, ok) => `<div class="bar ${ok ? "ok" : ""}"><i style="width:${Math.min(100, Math.round(p))}%"></i></div>`;
let tt; function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2400); }

/* ---------- DATA HELPERS ---------- */
const NAV = [["dashboard", "Dashboard", "⌂"], ["health", "Health", "♡"], ["medical", "Medical Reports", "▤"], ["workout", "Workout Routines", "⚡"], ["progress", "Progress", "◔"], ["reports", "Reports", "▦"], ["goals", "Goals", "◎"], ["challenges", "Challenges", "★"], ["profile", "Profile", "☺"]];
const prog = (id, date = today()) => U().prog[date + "|" + id] || { completed: 0, done: false };
const wpct = (w, date) => Math.min(100, Math.round((prog(w.id, date).completed / w.target) * 100));
const doneCount = (date) => U().workouts.filter((w) => prog(w.id, date).done).length;
const allDoneDates = () => [...new Set(Object.keys(U().prog).filter((k) => U().prog[k].done).map((k) => k.split("|")[0]))].sort();
const totalDone = () => Object.values(U().prog).filter((p) => p.done).length;
const latestHealth = () => U().health.slice().sort((a, b) => a.date.localeCompare(b.date)).pop();
function streaks() {                         // current and best streak of days with a completed workout
  const days = allDoneDates(); let best = 0, run = 0, prev = null;
  days.forEach((d) => { run = prev && (new Date(d) - new Date(prev)) / 864e5 === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; });
  let cur = 0, d = new Date(); if (!days.includes(dkey(d))) d.setDate(d.getDate() - 1);
  while (days.includes(dkey(d))) { cur++; d.setDate(d.getDate() - 1); }
  return { cur, best };
}
function periodPct(n) {                       // % of possible workouts completed in the last n days
  const w = U().workouts.length; if (!w) return 0; let done = 0;
  for (let i = 0; i < n; i++) { const d = new Date(); d.setDate(d.getDate() - i); done += doneCount(dkey(d)); }
  return Math.round((done / (w * n)) * 100);
}
function weekDone() { let c = 0; for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); c += doneCount(dkey(d)); } return c; }
function goalPct(g) {
  if (g.done) return 100;  // a completed goal stays at 100%
  const u = U(), h = latestHealth(), cur = h ? +h.weight : +u.profile.weight;
  if (g.type === "weight") { const span = Math.abs(g.start - g.target) || 1; return Math.max(0, Math.min(100, (Math.abs(g.start - cur) / span) * 100 * (Math.sign(g.start - cur) === Math.sign(g.start - g.target) ? 1 : 0))); }
  if (g.type === "weekly") return Math.min(100, (weekDone() / g.target) * 100);
  return Math.min(100, (doneCount(today()) / g.target) * 100);
}
const GOAL_PTS = 30;  // points for officially completing a goal (given once)
const CHAL = [
  { id: "daily", name: "Daily Workout Challenge", desc: "Complete all of today's workouts", pts: 10, val: () => [doneCount(today()), Math.max(1, U().workouts.length)], key: () => "daily:" + today() },
  { id: "five", name: "Workout Challenge", desc: "Complete 5 workouts", pts: 50, val: () => [Math.min(5, totalDone()), 5], key: () => "five" },
  { id: "week", name: "Consistency Challenge", desc: "Maintain a 7-day streak", pts: 50, val: () => [Math.min(7, streaks().cur), 7], key: () => "week" },
];
// Built-in challenges + the ones the user created (saved in u.custom). All use the same shape.
const allChal = () => CHAL.concat((U().custom || []).map((c) => ({ id: "c" + c.id, name: c.name, desc: c.desc || "Custom challenge", pts: c.pts, custom: c.id,
  val: c.type === "total" ? () => [Math.min(c.goal, Math.max(0, totalDone() - c.base)), c.goal]   // workouts finished since creating it
     : c.type === "streak" ? () => [Math.min(c.goal, streaks().cur), c.goal]                      // days in a row
     : () => [Math.min(c.goal, doneCount(today())), c.goal],                                      // workouts today (repeats daily)
  key: () => "custom" + c.id + (c.type === "daily" ? ":" + today() : "") })));
// Gives each challenge reward only ONCE (stored in u.claimed). Returns bonus points awarded.
function awardChallenges() {
  let bonus = 0;
  allChal().forEach((c) => { const [a, b] = c.val(), k = c.key(); if (a >= b && !U().claimed[k]) { U().claimed[k] = true; U().points += c.pts; bonus += c.pts; } });
  return bonus;
}
function newUser(f) {
  const t = today();
  return { profile: { name: f.name, username: f.username, email: f.email, age: f.age, gender: f.gender, height: f.height, weight: f.weight, goal: "Build a consistent fitness routine" },
    pass: btoa(f.password), health: [{ id: 1, date: t, weight: f.weight, heart: "", bp: "", notes: "Starting weight" }], medical: [],
    workouts: [{ id: 1, name: "Push-ups", cat: "Strength", target: 20, unit: "reps" }, { id: 2, name: "Walking", cat: "Cardio", target: 30, unit: "minutes" }, { id: 3, name: "Step count", cat: "Activity", target: 6000, unit: "steps" }],
    goals: [], custom: [], prog: {}, claimed: {}, points: 0 };
}

/* ---------- AUTH + LANDING ---------- */
function show(id) { ["landing", "auth", "app"].forEach((s) => ($(s).hidden = s !== id)); window.scrollTo(0, 0); }
function authView(mode) {
  const reg = mode === "register";
  const f = (id, l, t = "text", x = "") => `<label>${l}<input id="${id}" type="${t}" ${x}></label>`;
  $("auth").innerHTML = `<div class="glass authbox"><b class="brand">♥ HEALTHSYNC</b><p class="muted small">Your Personal Health &amp; Fitness Management System</p>
    <h2 class="mt">${reg ? "Create your account" : "Welcome back"}</h2>
    ${reg ? f("r_name", "Full name") + f("r_user", "Username") + f("r_email", "Email", "email") : f("r_user", "Username")}
    <label>Password<input id="r_pass" type="password"></label>
    ${reg ? '<label>Confirm password<input id="r_pass2" type="password"></label>' + f("r_age", "Age", "number") + '<label>Gender<select id="r_gender"><option>Female</option><option>Male</option><option>Other</option></select></label>' + f("r_height", "Height (cm)", "number") + f("r_weight", "Current weight (kg)", "number", 'step="0.1"') : ""}
    <label style="display:flex;gap:8px;align-items:center"><input style="width:auto;margin:0" type="checkbox" id="showpw"> Show password</label>
    <div class="err" id="err"></div>
    <button class="btn" data-a="${reg ? "register" : "login"}">${reg ? "Register" : "Login"}</button>
    <button class="link" data-a="${reg ? "go-login" : "go-register"}">${reg ? "Already have an account? Login" : "Create Account"}</button>
    <button class="link" data-a="go-landing">About HealthSync</button>
    <p class="muted small mt">Student/demo prototype. Passwords and data stay in this browser's localStorage and are not secure. Do not enter real sensitive medical information.</p></div>`;
  $("showpw").onchange = (e) => document.querySelectorAll("input[type=password],#r_pass,#r_pass2").forEach((i) => (i.type = e.target.checked ? "text" : "password"));
  show("auth");
}
const v = (id) => ($(id) ? $(id).value.trim() : "");
function register() {
  const f = { name: v("r_name"), username: v("r_user").toLowerCase(), email: v("r_email"), password: v("r_pass"), age: v("r_age"), gender: v("r_gender"), height: v("r_height"), weight: v("r_weight") };
  let e = "";
  if (Object.values(f).some((x) => !x) || !v("r_pass2")) e = "Please fill in every field.";
  else if (!/^[a-z0-9_]{3,}$/.test(f.username)) e = "Username: at least 3 letters, numbers or _.";
  else if (db.users[f.username]) e = "That username is already taken.";
  else if (!/^\S+@\S+\.\S+$/.test(f.email)) e = "Enter a valid email address.";
  else if (f.password.length < 4) e = "Password must be at least 4 characters.";
  else if (f.password !== v("r_pass2")) e = "Passwords do not match.";
  if (e) return ($("err").textContent = e);
  db.users[f.username] = newUser(f); save(); authView("login"); toast("Account created. Please login.");
}
function login() {
  const u = db.users[v("r_user").toLowerCase()];
  if (!u || u.pass !== btoa(v("r_pass"))) return ($("err").textContent = "Invalid username or password.");
  db.session = u.profile.username; save(); startApp();
}
function startApp() { page = "dashboard"; show("app"); render(); }

/* ---------- PAGES (each returns HTML built from localStorage data) ---------- */
function crud(key, title, fields) {   // generic add / view / edit / delete page for health + medical
  const list = U()[key], ed = list.find((r) => r.id === editing[key]) || {};
  const inp = ([id, l, t, o]) => t === "select" ? `<label>${l}<select name="${id}">${o.map((x) => `<option ${ed[id] === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>`
    : t === "area" ? `<label>${l}<textarea name="${id}" rows="2">${esc(ed[id])}</textarea></label>`
    : `<label>${l}<input name="${id}" type="${t}" step="any" value="${esc(ed[id] ?? (t === "date" ? today() : ""))}"></label>`;
  return `<h2>${title}</h2><div class="two"><form class="glass pad" data-form="${key}">${fields.map(inp).join("")}
    <button class="btn">${ed.id ? "Save changes" : "Add record"}</button>${ed.id ? `<button type="button" class="btn ghost mt" data-a="cancel" data-k="${key}">Cancel</button>` : ""}
    <p class="muted small mt">For personal record keeping only. HealthSync gives no diagnosis or treatment advice.</p></form>
    <div>${key === "health" ? healthLatest() : ""}<div class="glass pad mt"><h3>History</h3>${list.length ? list.slice().sort((a, b) => b.date.localeCompare(a.date)).map((r) =>
      `<div class="item"><b>${esc(key === "health" ? r.weight + " kg · " + (r.heart || "–") + " bpm · BP " + (r.bp || "–") : r.name + " (" + r.type + ")")}</b><br><span class="muted small">${esc(r.date)}${r.doctor ? " · " + esc(r.doctor) : ""}${r.notes ? " — " + esc(r.notes) : ""}</span>
      <div class="acts"><button class="btn ghost sm" data-a="edit" data-k="${key}" data-id="${r.id}">Edit</button><button class="btn ghost warn sm" data-a="del" data-k="${key}" data-id="${r.id}">Delete</button></div></div>`).join("") : '<p class="muted">Nothing here yet. Add your first record.</p>'}</div></div></div>`;
}
function healthLatest() {
  const h = latestHealth(); if (!h) return "";
  return `<div class="grid" style="grid-template-columns:repeat(3,1fr)"><div class="glass stat"><span class="muted small">Weight</span><b>${esc(h.weight)} kg</b></div><div class="glass stat"><span class="muted small">Heart rate</span><b>${esc(h.heart || "–")}</b></div><div class="glass stat"><span class="muted small">BP</span><b>${esc(h.bp || "–")}</b></div></div>`;
}
const PAGES = {
  dashboard() {
    const u = U(), h = latestHealth() || {}, t = doneCount(today()), n = u.workouts.length, p = n ? Math.round((t / n) * 100) : 0, s = streaks();
    const hr = new Date().getHours(), gr = hr < 12 ? "Good Morning" : hr < 18 ? "Good Afternoon" : "Good Evening";
    const g = u.goals.find((x) => !x.done) || u.goals[0], gp = g ? Math.round(goalPct(g)) : 0;
    return `<div class="glass hero"><div><h1 style="font-size:1.9rem">${gr}, ${esc(u.profile.name.split(" ")[0])} 👋</h1><p class="muted">Your focus: ${esc(u.profile.goal)}</p><p class="small mt">Today: <b class="${p === 100 ? "green" : "sky"}">${t} / ${n} workouts</b></p></div>
      <div class="ring"><svg viewBox="0 0 120 120"><circle class="rt" cx="60" cy="60" r="52"/><circle class="rf" cx="60" cy="60" r="52" style="stroke-dashoffset:${327 - (327 * p) / 100}"/></svg><span>${p}%</span></div></div>
    <div class="grid"><div class="glass stat"><span class="muted small">Weight</span><b>${esc(h.weight || "–")} kg</b></div><div class="glass stat"><span class="muted small">♥ Heart rate</span><b>${esc(h.heart || "–")} bpm</b></div>
      <div class="glass stat"><span class="muted small">Blood pressure</span><b>${esc(h.bp || "–")}</b></div><div class="glass stat"><span class="muted small">Points</span><b class="green">${u.points} ⭐</b></div>
      <div class="glass stat"><span class="muted small">Completed workouts</span><b>${totalDone()}</b></div><div class="glass stat"><span class="muted small">Streak</span><b>${s.cur} 🔥</b></div>
      <div class="glass stat"><span class="muted small">Goal progress</span><b>${g ? gp + "%" : "–"}</b></div><div class="glass stat"><span class="muted small">Today's progress</span><b>${p}%</b></div></div>
    <div class="glass pad"><h3>Today's Activity</h3>${n ? u.workouts.map((w) => `<div class="rline"><span>${esc(w.name)} <span class="muted small">${prog(w.id).completed}/${w.target} ${w.unit}</span></span><span class="${prog(w.id).done ? "green" : "muted"}">${prog(w.id).done ? "✓ Done" : wpct(w) + "%"}</span></div>`).join("") : '<p class="muted">No workouts yet. Add one in Workout Routines.</p>'}
      <button class="btn mt" data-a="nav" data-p="workout">Open workouts</button></div>`;
  },
  health: () => crud("health", "Health Monitoring", [["date", "Date", "date"], ["weight", "Weight (kg)", "number"], ["heart", "Heart rate (bpm)", "number"], ["bp", "Blood pressure (e.g. 120/80)", "text"], ["notes", "Notes", "area"]]),
  medical: () => crud("medical", "Medical Reports", [["name", "Report name", "text"], ["type", "Report type", "select", ["Blood test", "X-ray", "Scan", "Prescription", "Check-up", "Other"]], ["date", "Date", "date"], ["doctor", "Doctor / Hospital", "text"], ["notes", "Notes", "area"]]) + '<p class="muted small mt">Only report details are stored. No files are uploaded or secured.</p>',
  workout() {
    const u = U(), ed = u.workouts.find((w) => w.id === editing.workout) || {};
    return `<h2>Workout Routines</h2><p class="muted small">Today: ${today()}. Enter your completed value, then press Workout Done.</p>
    ${u.workouts.map((w) => { const p = prog(w.id), pc = wpct(w), reached = p.completed >= w.target;
      return `<div class="glass wcard ${p.done ? "ok" : ""}" id="w${w.id}"><div class="whead"><b>${esc(w.name)}</b><span class="tag ${p.done ? "ok" : ""}">${esc(w.cat)}</span></div>
      <div class="muted">Target: ${w.target} ${w.unit} · Completed: ${p.completed} ${w.unit}</div>${bar(pc, p.done || reached)}
      <b class="${reached ? "green" : "sky"}">${pc}%</b> <span class="small ${p.done ? "green" : "muted"}">${p.done ? "✓ Workout Completed" : reached ? "Target Reached ✓" : "In progress"}</span>
      ${p.done ? "" : `<div class="entry"><input type="number" min="0" id="in${w.id}" placeholder="Completed ${w.unit}" value="${p.completed || ""}"><button class="btn ghost sm" data-a="setp" data-id="${w.id}">Update</button></div>`}
      <div class="acts"><button class="btn" style="flex:1" data-a="done" data-id="${w.id}" ${p.done ? "disabled" : ""}>${p.done ? "✓ Completed" : "Workout Done ✓"}</button>
      <button class="btn ghost sm" data-a="edit" data-k="workout" data-id="${w.id}">Edit</button><button class="btn ghost warn sm" data-a="del" data-k="workout" data-id="${w.id}">Delete</button></div></div>`; }).join("") || '<div class="glass pad muted">No workouts yet. Add one below.</div>'}
    <form class="glass pad mt" data-form="workout"><h3>${ed.id ? "Edit" : "Add"} workout</h3>
      <label>Exercise name<input name="name" required value="${esc(ed.name)}"></label>
      <label>Category<select name="cat">${["Strength", "Cardio", "Flexibility", "Activity"].map((c) => `<option ${ed.cat === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      <label>Target value<input name="target" type="number" min="1" required value="${esc(ed.target)}"></label>
      <label>Unit<select name="unit">${["minutes", "reps", "steps"].map((c) => `<option ${ed.unit === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      <button class="btn">${ed.id ? "Save changes" : "Add workout"}</button></form>`;
  },
  progress() {
    const u = U(), s = streaks(), n = u.workouts.length, pc = n ? Math.round((doneCount(today()) / n) * 100) : 0;
    const card = (l, val, c = "") => `<div class="glass stat"><span class="muted small">${l}</span><b class="${c}">${val}</b></div>`;
    return `<h2>Progress</h2><div class="grid">${card("Overall (today)", pc + "%", "green")}${card("Completed workouts", totalDone())}${card("Total workouts", n)}${card("Total points", u.points + " ⭐", "green")}
      ${card("Current streak", s.cur + " Days 🔥")}${card("Best streak", s.best + " Days")}${card("Weekly progress", periodPct(7) + "%")}${card("Monthly progress", periodPct(30) + "%")}</div>
    <div class="two"><div class="glass pad"><h3>Exercise progress (today)</h3>${u.workouts.map((w) => { const p = prog(w.id); return `<div class="item"><div class="whead"><span>${esc(w.name)}</span><span class="${p.done ? "green" : "muted"} small">${p.done ? "✓ Completed" : wpct(w) + "%"}</span></div>${bar(wpct(w), p.done)}<span class="muted small">${p.completed} / ${w.target} ${w.unit}</span></div>`; }).join("") || '<p class="muted">No workouts yet.</p>'}</div>
    <div class="glass pad"><h3>Goal progress</h3>${u.goals.map((g) => `<div class="item"><span>${esc(g.title)}</span>${bar(goalPct(g), goalPct(g) >= 100)}<span class="${g.done ? "green" : "muted"} small">${g.done ? "✓ Completed" : Math.round(goalPct(g)) + "%"}</span></div>`).join("") || '<p class="muted">No goals yet. Create one in Goals.</p>'}</div></div>`;
  },
  reports() {
    const u = U(), h = latestHealth() || {}, s = streaks(), n = u.workouts.length, claimed = Object.keys(u.claimed).length;
    const sec = (t, rows) => `<div class="glass pad"><h3>${t}</h3>${rows.map((r) => `<div class="rline"><span class="muted">${r[0]}</span><b>${esc(r[1])}</b></div>`).join("")}</div>`;
    return `<h2>Reports</h2><p class="muted small">${esc(u.profile.name)} · generated ${new Date().toLocaleString()}</p>
    <div class="two">${sec("Health Summary", [["Latest weight", (h.weight || "–") + " kg"], ["Latest heart rate", (h.heart || "–") + " bpm"], ["Latest blood pressure", h.bp || "–"], ["Health records", u.health.length], ["Medical report entries", u.medical.length]])}
    ${sec("Fitness Summary", [["Completed workouts", totalDone()], ["Today's completion", (n ? Math.round((doneCount(today()) / n) * 100) : 0) + "%"], ["Weekly completion", periodPct(7) + "%"], ["Total activity days", allDoneDates().length], ["Goals completed", u.goals.filter((g) => g.done).length + " / " + u.goals.length]])}
    ${sec("Reward Summary", [["Total points", u.points + " ⭐"], ["Challenges completed", claimed], ["Current streak", s.cur + " days"], ["Best streak", s.best + " days"]])}</div>
    <div class="acts mt noprint"><button class="btn" style="flex:1" onclick="window.print()">Print / Save Report</button><button class="btn ghost" style="flex:1" data-a="dl-csv">Download CSV</button><button class="btn ghost" style="flex:1" data-a="dl-json">Download JSON</button></div><p class="muted small mt">Prototype summary for personal tracking. Not medical advice.</p>`;
  },
  goals() {
    const u = U(), cw = (latestHealth() || {}).weight || u.profile.weight;
    return `<h2>Goals</h2><div class="two"><form class="glass pad" data-form="goals"><label>Goal type<select name="type" id="gtype"><option value="weight">Weight goal</option><option value="weekly">Weekly workout goal</option><option value="daily">Daily activity goal (workouts per day)</option></select></label>
      <label>Title<input name="title" required placeholder="e.g. Reach a healthy weight"></label>
      <label>Current weight (kg, weight goals)<input name="current" type="number" step="any" value="${esc(cw)}"></label>
      <label>Target (kg, or number of workouts)<input name="target" type="number" step="any" required></label>
      <button class="btn">Create goal</button><p class="muted small mt">Choose realistic, gradual targets. HealthSync does not recommend extreme weight loss or restrictive eating. Talk to a professional for personal advice.</p></form>
    <div class="glass pad"><h3>Your goals</h3>${u.goals.map((g) => { const p = Math.round(goalPct(g)); return `<div class="item"><div class="whead"><b>${esc(g.title)}</b><span class="tag ${p >= 100 ? "ok" : ""}">${g.done ? "✓ Goal Completed" : p >= 100 ? "Target Reached ✓" : g.type}</span></div>
      ${g.type === "weight" ? `<div class="muted small">Current: ${esc(cw)} kg · Target: ${g.target} kg · ${Math.abs(cw - g.target).toFixed(1)} kg difference</div>` : `<div class="muted small">Target: ${g.target} workouts ${g.type === "weekly" ? "this week" : "today"}</div>`}${bar(p, p >= 100)}<span class="small ${g.done ? "green" : ""}">${p}%${g.done ? " · +" + GOAL_PTS + " points earned" : ""}</span>
      <div class="acts"><button class="btn" style="flex:1" data-a="gdone" data-id="${g.id}" ${g.done ? "disabled" : ""}>${g.done ? "✓ Completed" : "Goal Done ✓"}</button><button class="btn ghost warn sm" data-a="del" data-k="goals" data-id="${g.id}">Delete</button></div></div>`; }).join("") || '<p class="muted">No goals yet.</p>'}</div></div>`;
  },
  challenges() {
    return `<h2>Challenges &amp; Rewards</h2><div class="glass stat mt" style="margin-bottom:12px"><span class="muted small">Total points</span><b class="green">${U().points} ⭐</b></div>
    ${allChal().map((c) => { const [a, b] = c.val(), ok = !!U().claimed[c.key()], p = (a / b) * 100;
      return `<div class="glass wcard ${ok ? "ok" : ""}"><div class="whead"><b>${c.name}</b><span class="tag ${ok ? "ok" : ""}">+${c.pts} points</span></div><div class="muted">${c.desc}</div>${bar(p, ok)}
      <span class="small ${ok ? "green" : "muted"}">${ok ? "Challenge Completed ✓ (+" + c.pts + " claimed)" : a + " / " + b}</span>${c.custom ? `<div class="acts"><button class="btn ghost warn sm" data-a="del" data-k="custom" data-id="${c.custom}">Delete</button></div>` : ""}</div>`; }).join("")}
    <form class="glass pad mt" data-form="custom"><h3>Create your own challenge</h3>
      <label>Challenge name<input name="name" required placeholder="e.g. Morning Warm-up Week"></label>
      <label>Description (optional)<input name="desc" placeholder="What do you need to do?"></label>
      <label>Challenge type<select name="type"><option value="total">Complete a number of workouts</option><option value="streak">Reach a streak of days</option><option value="daily">Complete workouts every day</option></select></label>
      <label>Goal (number of workouts or days)<input name="goal" type="number" min="1" max="100" required></label>
      <label>Reward points (5 to 100)<input name="pts" type="number" min="5" max="100" value="20" required></label>
      <button class="btn">Add challenge</button><p class="muted small mt">Rewards are claimed once, when the goal is reached.</p></form>`;
  },
  profile() {
    const p = U().profile, f = (id, l, t = "text") => `<label>${l}<input name="${id}" type="${t}" value="${esc(p[id])}"></label>`;
    return `<h2>Profile</h2><div class="two"><div class="glass pad"><div class="avatar">${esc(p.name[0] || "?").toUpperCase()}</div><h3>${esc(p.name)}</h3><p class="muted">@${esc(p.username)}</p>
      <p class="muted small mt">${esc(p.email)}<br>${esc(p.age)} yrs · ${esc(p.gender)} · ${esc(p.height)} cm · ${esc(p.weight)} kg</p><p class="mt">Goal: ${esc(p.goal)}</p>
      <div class="acts mt"><button class="btn ghost" data-a="logout">Logout</button><button class="btn ghost warn" data-a="reset">Reset Demo Data</button></div></div>
    <form class="glass pad" data-form="profile"><h3>Edit profile</h3>${f("name", "Full name")}${f("email", "Email", "email")}${f("age", "Age", "number")}${f("gender", "Gender")}${f("height", "Height (cm)", "number")}${f("weight", "Current weight (kg)", "number")}${f("goal", "Fitness goal")}
    <button class="btn">Save profile</button><p class="muted small mt">HealthSync is a student project prototype. Data is stored locally in the browser and should not be used for storing real sensitive medical records.</p></form></div>`;
  },
};

/* ---------- EXPORT REPORT TO A FILE (CSV or JSON) ---------- */
// Builds the same numbers shown on the Reports page as one structured object.
// Objects become "Item / Value" sections, arrays become tables.
function reportData() {
  const u = U(), h = latestHealth() || {}, s = streaks(), n = u.workouts.length;
  return {
    "Report": { Generated: new Date().toLocaleString(), App: "HealthSync (student prototype)" },
    "User": { Name: u.profile.name, Username: u.profile.username, Email: u.profile.email, "Personal goal": u.profile.goal },
    "Health Summary": { "Latest weight (kg)": h.weight || "", "Latest heart rate (bpm)": h.heart || "", "Latest blood pressure": h.bp || "", "Health records": u.health.length, "Medical report entries": u.medical.length },
    "Fitness Summary": { "Completed workouts": totalDone(), "Workouts in routine": n, "Today's completion (%)": n ? Math.round((doneCount(today()) / n) * 100) : 0, "Weekly completion (%)": periodPct(7), "Monthly completion (%)": periodPct(30), "Active days": allDoneDates().length, "Goals completed": u.goals.filter((g) => g.done).length + " / " + u.goals.length },
    "Reward Summary": { "Total points": u.points, "Challenges completed": Object.keys(u.claimed).length, "Current streak (days)": s.cur, "Best streak (days)": s.best },
    "Today's Workouts": u.workouts.map((w) => ({ Exercise: w.name, Category: w.cat, Target: w.target, Completed: prog(w.id).completed, Unit: w.unit, "Progress (%)": wpct(w), Status: prog(w.id).done ? "Completed" : "Pending" })),
    "Goals": u.goals.map((g) => ({ Title: g.title, Type: g.type, Target: g.target, "Progress (%)": Math.round(goalPct(g)), Status: g.done ? "Completed" : "In progress" })),
    "Health History": u.health.slice().sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ Date: r.date, "Weight (kg)": r.weight, "Heart rate (bpm)": r.heart, "Blood pressure": r.bp, Notes: r.notes })),
  };
}
function toCSV(r) {
  // quote every cell; a leading = + - @ is neutralised so spreadsheets don't run it as a formula
  const q = (x) => '"' + (typeof x === "string" && /^[=+\-@]/.test(x) ? "'" + x : String(x ?? "")).replace(/"/g, '""') + '"';
  const out = [];
  Object.entries(r).forEach(([sec, val]) => {
    out.push(q(sec));
    if (Array.isArray(val)) {
      if (val.length) { out.push(Object.keys(val[0]).map(q).join(",")); val.forEach((row) => out.push(Object.values(row).map(q).join(","))); } else out.push(q("(none yet)"));
    } else Object.entries(val).forEach(([k, v]) => out.push(q(k) + "," + q(v)));
    out.push("");
  });
  return "\ufeff" + out.join("\r\n");   // BOM helps Excel read the file correctly
}
let lastExport = null;
// Short plain-text version of the report (used for WhatsApp / SMS / sharing text)
function summaryText() {
  const r = reportData(); let t = "HealthSync Report\n";
  ["User", "Health Summary", "Fitness Summary", "Reward Summary"].forEach((k) => { t += "\n" + k + "\n"; Object.entries(r[k]).forEach(([a, b]) => (t += a + ": " + b + "\n")); });
  return t;
}
// Opens a panel with several ways to save/share the report, because some mobile browsers block downloads.
function exportReport(fmt) {
  const r = reportData(), name = "HealthSync_Report_" + U().profile.username + "_" + today() + "." + fmt;
  const text = fmt === "csv" ? toCSV(r) : JSON.stringify(r, null, 2), mime = fmt === "csv" ? "text/csv" : "application/json";
  lastExport = { name, text, mime };
  const href = "data:" + mime + ";charset=utf-8," + encodeURIComponent(text);
  const box = document.createElement("div"); box.className = "modal"; box.id = "dlbox";
  box.innerHTML = `<div class="glass"><h3>Save or share your report</h3><p class="muted small">${esc(name)}</p>
    <a class="btn mt" href="${href}" download="${esc(name)}">Save file to Downloads</a>
    <p class="muted small mt">Download not working? Share it instead:</p>
    <label>Mobile number with country code<input id="dlnum" type="tel" placeholder="+91 98765 43210" value="${esc(localStorage.getItem("healthsync_share_num") || "")}"></label>
    <div class="acts"><button class="btn" style="flex:1" data-a="dl-wa">WhatsApp</button><button class="btn ghost" style="flex:1" data-a="dl-sms">SMS</button></div>
    <button class="btn ghost mt" data-a="dl-share">Instagram, Google Drive &amp; other apps</button>
    <button class="btn ghost mt" data-a="dl-copy">Copy report text</button>
    <textarea id="dltext" rows="4" readonly style="font-size:.75rem">${esc(text)}</textarea>
    <p class="muted small">WhatsApp and SMS send a text summary to that number. Instagram and Google Drive cannot take a phone number: the last button opens your phone's share sheet, where you pick the app (and the file is attached when your phone allows it).</p>
    <button class="btn ghost warn mt" data-a="dl-close">Close</button></div>`;
  document.body.appendChild(box);
}
function sendReport(kind) {
  const raw = $("dlnum").value.trim(), n = raw.replace(/\D/g, "").replace(/^00/, "");
  if (n.length < 8 || n.length > 15) return toast("Enter the number with country code, e.g. +91 98765 43210");
  localStorage.setItem("healthsync_share_num", raw);
  const msg = encodeURIComponent(summaryText());
  if (kind === "wa") { if (!window.open("https://wa.me/" + n + "?text=" + msg, "_blank")) location.href = "https://wa.me/" + n + "?text=" + msg; }
  else location.href = "sms:+" + n + "?body=" + msg;
}
async function shareExport() {
  const x = lastExport; if (!x) return;
  try {
    const f = new File([x.text], x.name, { type: x.mime });
    if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: x.name });
    else if (navigator.share) await navigator.share({ title: "HealthSync Report", text: summaryText() });
    else toast("Sharing isn't supported here. Use WhatsApp, SMS or Copy.");
  } catch (e) { toast("Sharing was cancelled or isn't available"); }
}
function copyExport() {
  const t = $("dltext"); t.select();
  (navigator.clipboard ? navigator.clipboard.writeText(lastExport.text) : Promise.reject()).catch(() => document.execCommand("copy")).then(() => toast("Report copied"));
}

/* ---------- RENDER + NAVIGATION ---------- */
function render() {
  if (!db.session || !U()) return authView("login");
  $("view").innerHTML = `<div class="pg">${PAGES[page]()}</div>`;
  $("topnav").innerHTML = NAV.map((n) => `<button class="${n[0] === page ? "on" : ""}" data-a="nav" data-p="${n[0]}">${n[1]}</button>`).join("");
  const b = (id, l, i, c = "") => `<button class="${c} ${page === id ? "on" : ""}" data-a="nav" data-p="${id}"><i>${i}</i>${l}</button>`;
  const moreOn = ["medical", "reports", "goals", "challenges", "profile"].includes(page);
  $("bnav").innerHTML = b("dashboard", "Home", "⌂") + b("health", "Health", "♡") + b("workout", "Workout", "⚡", "ctr") + b("progress", "Progress", "◔") + `<button class="${moreOn ? "on" : ""}" data-a="more"><i>☰</i>More</button>`;
  $("more").innerHTML = ["medical", "reports", "goals", "challenges", "profile"].map((id) => `<button class="${page === id ? "on" : ""}" data-a="nav" data-p="${id}">${NAV.find((n) => n[0] === id)[1]}</button>`).join("");
}

/* ---------- EVENTS ---------- */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-a]"); if (!el) return;
  const a = el.dataset.a, id = Number(el.dataset.id), k = el.dataset.k;
  if (a === "go-login") authView("login"); else if (a === "go-register") authView("register"); else if (a === "go-landing") show("landing");
  else if (a === "register") register(); else if (a === "login") login();
  else if (a === "logout") { db.session = null; save(); authView("login"); }
  else if (a === "more") $("more").hidden = !$("more").hidden;
  else if (a === "nav") { page = el.dataset.p; $("more").hidden = true; window.scrollTo(0, 0); render(); }
  else if (a === "dl-wa" || a === "dl-sms") sendReport(a === "dl-wa" ? "wa" : "sms");
  else if (a === "dl-share") shareExport();
  else if (a === "dl-copy") copyExport();
  else if (a === "dl-close") $("dlbox").remove();
  else if (a === "dl-csv" || a === "dl-json") exportReport(a === "dl-csv" ? "csv" : "json");
  else if (a === "edit") { editing[k] = id; render(); }
  else if (a === "cancel") { editing[k] = null; render(); }
  else if (a === "del" && confirm("Delete this item?")) { const u = U(); u[k === "workout" ? "workouts" : k] = u[k === "workout" ? "workouts" : k].filter((r) => r.id !== id); save(); render(); toast("Deleted"); }
  else if (a === "setp") {                      // save the completed value
    const w = U().workouts.find((x) => x.id === id), val = Number($("in" + id).value);
    if (isNaN(val) || val < 0) return toast("Enter a valid number");
    U().prog[today() + "|" + id] = { completed: val, done: false }; save(); render();
    toast(val >= w.target ? "Target Reached ✓ — now press Workout Done" : "Progress saved");
  } else if (a === "done") {                    // OFFICIALLY complete a workout (points only once)
    const w = U().workouts.find((x) => x.id === id), p = prog(id);
    if (p.done) return;
    const inp = $("in" + id), val = inp ? Number(inp.value) : p.completed;
    if (val < w.target) return toast("Reach your target (" + w.target + " " + w.unit + ") first");
    U().prog[today() + "|" + id] = { completed: val, done: true };
    U().points += 20;
    const bonus = awardChallenges();            // challenges, daily bonus and streak bonus
    save(); render();
    const card = $("w" + id); if (card) card.classList.add("pop");
    const f = document.createElement("div"); f.className = "pts"; f.textContent = "+" + (20 + bonus) + " Points 🎉"; document.body.appendChild(f); setTimeout(() => f.remove(), 1700);
    toast("✓ Workout Completed! Total points: " + U().points + (bonus ? " (incl. +" + bonus + " bonus)" : ""));
  } else if (a === "gdone") {                    // OFFICIALLY complete a goal (points only once)
    const g = U().goals.find((x) => x.id === id);
    if (!g || g.done) return;
    if (goalPct(g) < 100) return toast("Reach your goal target first");
    g.done = true; U().points += GOAL_PTS; save(); render();
    const f = document.createElement("div"); f.className = "pts"; f.textContent = "+" + GOAL_PTS + " Points 🎉"; document.body.appendChild(f); setTimeout(() => f.remove(), 1700);
    toast("✓ Goal Completed! Total points: " + U().points);
  } else if (a === "reset" && confirm("Reset all your workout, health, goal and points data?")) {
    const p = U().profile, pw = U().pass; db.users[db.session] = newUser({ ...p, password: "x" }); U().pass = pw; U().profile = p; save(); render(); toast("Demo data reset");
  }
});
document.addEventListener("submit", (e) => {
  const f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
  const k = f.dataset.form, u = U(), d = Object.fromEntries(new FormData(f));
  if (k === "custom") {   // save a user-made challenge
    d.goal = Math.max(1, Number(d.goal)); d.pts = Math.min(100, Math.max(5, Number(d.pts)));
    (u.custom = u.custom || []).push({ id: Date.now(), ...d, base: totalDone() }); save(); render(); return toast("Challenge added");
  }
  if (k === "profile") { Object.assign(u.profile, d); save(); render(); return toast("Profile saved"); }
  const list = k === "workout" ? u.workouts : u[k];
  if (k === "health" && !d.weight) return toast("Weight is required");
  if (k === "workout") d.target = Number(d.target);
  if (k === "goals") { d.target = Number(d.target); d.start = Number(d.current); delete d.current; }
  if (editing[k]) { Object.assign(list.find((r) => r.id === editing[k]), d); editing[k] = null; } else list.push({ id: Date.now(), ...d });
  save(); render(); toast("Saved");
});

/* ---------- START ---------- */
db.session && U() ? startApp() : authView("login");  // login page is the first screen
