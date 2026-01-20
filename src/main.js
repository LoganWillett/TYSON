import './styles.css';
import Chart from 'chart.js/auto';
import { MUSCLES } from './data/muscles.js';
import { EXERCISES, PATTERNS } from './data/exercises.js';
import { BUILTIN_PLUGINS } from './data/builtin-plugins.js';

/**
 * TYSON v3 — "coach brain" vanilla + Vite
 * - Goal Wizard + Active goals
 * - Direction engine + weekly summary
 * - Workout logging with optional duration + session RPE (sRPE)
 * - Effective sets + region heatmap
 * - Strength trend (e1RM) + plateau diagnostics
 * - Training load: weekly load, monotony, strain (if you log duration + session RPE)
 * - Tools: warmup builder, plate calculator, swap engine, rest timer
 * - Import/Export + settings (units, rounding, e1RM method, bar weight, plate inventory)
 *
 * Everything stored locally (localStorage). No accounts. No trackers.
 */

const STORAGE_KEY = 'TYSON_V4_STATE';
const LEGACY_KEYS = ['TYSON_V3_STATE'];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const safeParse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };

const toast = (msg) => {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>el.classList.remove('show'), 2200);
};

const todayISO = () => new Date().toISOString().slice(0,10);
const toDate = (iso) => new Date(iso + 'T00:00:00');
const daysBetween = (aISO, bISO) => Math.round((toDate(bISO) - toDate(aISO)) / 86400000);
const addDaysISO = (iso, days) => {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
};

const timeToMin = (t)=>{
  if (!t) return null;
  const parts = String(t).split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h*60 + m;
};

const minToTime = (mins)=>{
  if (mins == null) return '';
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m/60);
  const mm = m % 60;
  return String(h).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
};

function uid(prefix='id'){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

// ---------- Data maps ----------
const musclesById = new Map(MUSCLES.map(m=>[m.id, m]));
const exercisesById = new Map(EXERCISES.map(e=>[e.id, e]));
const regions = Array.from(new Set(MUSCLES.map(m=>m.region))).filter(Boolean).sort((a,b)=>a.localeCompare(b));
const groupMuscles = MUSCLES.filter(m=>m.type==='group');
const allMuscles = MUSCLES.filter(m=>m.type!=='group');
const groupByRegion = new Map();
for (const r of regions) groupByRegion.set(r, []);
for (const m of MUSCLES.filter(m=>m.type==='group')) groupByRegion.get(m.region)?.push(m);

const EQUIP = [
  { key:'barbell', name:'Barbell' },
  { key:'dumbbell', name:'Dumbbells' },
  { key:'machine', name:'Machine' },
  { key:'cable', name:'Cable' },
  { key:'kettlebell', name:'Kettlebell' },
  { key:'bodyweight', name:'Bodyweight' },
  { key:'band', name:'Bands' },
];

// ---------- State ----------
const DEFAULT_STATE = {
  profile: {
    goal: 'strength',
    experience: 'novice',
    daysPerWeek: 3,
    minutesPerSession: 60,
    bodyweight: '',
    priority: 'balanced',
    schedule: {
      trainTime: 'evening',
      wakeTime: '07:00',
      bedTime: '23:00',
      workStart: '09:00',
      workEnd: '17:00',
      breakEveryMin: 45,
    },
    cardio: {
      modality: 'none',
      daysPerWeek: 0,
      minutesPerSession: 0,
      intensity: 'easy',
    },
    equipment: { barbell:true, dumbbell:true, machine:false, cable:false, kettlebell:false, bodyweight:true, band:false },
  },
  settings: {
    units: 'lb',           // lb | kg (display only)
    roundTo: 2.5,          // rounding step for load suggestions
    e1rmMethod: 'epley',   // epley | brzycki | lombardi
    barWeight: 45,         // for plate calc
    plates: {              // inventory (per-plate count; TYSON assumes pairs where relevant)
      45: 8,
      35: 2,
      25: 2,
      10: 4,
      5: 4,
      2.5: 4,
      1.25: 0,
    },
    defaultRestSec: 120,
    coach: {
      mode: 'adaptiveB',         // adaptiveB | off
      missedPolicy: 'rollover',  // rollover | skip
    },
    volumeTargets: {
      mode: 'auto',   // auto | custom
      custom: {},     // { [region]: { lo:number, hi:number, mrv:number } }
    },
  },
  goals: [],        // array of goal objects
  plan: null,       // { createdISO, splitName, days:[{name, items:[{exerciseId, sets, reps, rpeTarget, notes}]}], progression:{...} }
  planProgress: {
    cursor: 0,
    completedDayIds: [],
  },
  prs: {
    byExercise: {}, // { [exerciseId]: { bestE1rm:number, bestE1rmISO:string, bestWeight:number, bestWeightISO:string } }
    events: [],     // {dateISO, exerciseId, type, value, detail}
  },
  log: { sessions: [] }, // sessions array
  checkins: [],     // readiness check-ins
};

let state = loadState();

function loadState(){
  // Prefer v4 key, fallback to v3 (one-time migration)
  let raw = localStorage.getItem(STORAGE_KEY);
  let s = safeParse(raw, null);
  let usedLegacy = false;
  if (!s){
    for (const k of LEGACY_KEYS){
      const r = localStorage.getItem(k);
      const cand = safeParse(r, null);
      if (cand){ s = cand; usedLegacy = true; break; }
    }
  }
  if (!s) return structuredClone(DEFAULT_STATE);

  // Merge to tolerate schema updates
  const merged = structuredClone(DEFAULT_STATE);
  merged.profile = { ...merged.profile, ...(s.profile||{}) };
  merged.profile.equipment = { ...merged.profile.equipment, ...((s.profile||{}).equipment||{}) };
  merged.profile.schedule = { ...merged.profile.schedule, ...((s.profile||{}).schedule||{}) };
  merged.profile.cardio = { ...merged.profile.cardio, ...((s.profile||{}).cardio||{}) };

  merged.settings = { ...merged.settings, ...(s.settings||{}) };
  merged.settings.plates = { ...merged.settings.plates, ...((s.settings||{}).plates||{}) };
  merged.settings.coach = { ...merged.settings.coach, ...((s.settings||{}).coach||{}) };
  merged.settings.volumeTargets = { ...merged.settings.volumeTargets, ...((s.settings||{}).volumeTargets||{}) };
  merged.settings.volumeTargets.custom = { ...merged.settings.volumeTargets.custom, ...(((s.settings||{}).volumeTargets||{}).custom||{}) };

  merged.goals = Array.isArray(s.goals) ? s.goals : [];
  merged.plan = s.plan ?? null;
  merged.planProgress = { ...merged.planProgress, ...(s.planProgress||{}) };
  merged.planProgress.completedDayIds = Array.isArray(s.planProgress?.completedDayIds) ? s.planProgress.completedDayIds : merged.planProgress.completedDayIds;

  merged.prs = { ...merged.prs, ...(s.prs||{}) };
  merged.prs.byExercise = { ...merged.prs.byExercise, ...(s.prs?.byExercise||{}) };
  merged.prs.events = Array.isArray(s.prs?.events) ? s.prs.events : merged.prs.events;

  merged.log.sessions = Array.isArray(s.log?.sessions) ? s.log.sessions : [];
  merged.checkins = Array.isArray(s.checkins) ? s.checkins : [];
  merged._view = s._view || merged._view;

  // If we loaded legacy data, persist to v4 key so future loads are clean
  if (usedLegacy){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
  }

  return merged;
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- Evidence-inspired defaults (explicit + editable) ----------
function recommendedFrequency(exp){
  // ACSM position stand ranges (simple mapping)
  // novice: 2–3, intermediate: 3–4, advanced: 4–5
  if (exp==='novice') return { min:2, max:3 };
  if (exp==='intermediate') return { min:3, max:4 };
  return { min:4, max:5 };
}

function repIntensityDefaults(goal){
  // Practical defaults; users can override in plan
  if (goal==='strength') return { reps:'3–6', rpe:'7–9', rest:'2–4 min' };
  if (goal==='hypertrophy') return { reps:'6–12', rpe:'7–9', rest:'1–3 min' };
  return { reps:'5–10', rpe:'6–8', rest:'1–3 min' };
}

function weeklySetTargets(goal, exp){
  // Heuristic targets for effective sets per region/muscle (universal baseline)
  // (TYSON uses these as "recommended ranges" rather than prescriptions)
  let lo=8, hi=14;
  if (goal==='strength') { lo=6; hi=12; }
  if (goal==='general') { lo=6; hi=10; }
  if (exp==='intermediate') { lo+=2; hi+=4; }
  if (exp==='advanced') { lo+=4; hi+=6; }
  return { lo, hi };
}


function priorityRegionWeights(priority){
  // Multipliers applied to targets for a simple focus system (region labels come from muscles.js)
  const base = Object.fromEntries(regions.map(r=>[r, 1]));
  const boost = (r, m)=>{ if (base[r]!=null) base[r]*=m; };

  const boostMany = (rs, m)=>{ for (const r of rs) boost(r,m); };

  if (priority==='upper'){
    boostMany(['Chest','Back','Shoulders','Arms','Forearms/Grip','Shoulders/Back'], 1.25);
  }
  if (priority==='lower'){
    boostMany(['Thighs','Hips/Glutes','Lower Leg','Back/Hips','Hips/Glutes/Thigh'], 1.25);
  }
  if (priority==='push'){
    boostMany(['Chest','Chest/Core','Shoulders','Arms'], 1.25);
  }
  if (priority==='pull'){
    boostMany(['Back','Back/Core','Shoulders/Back','Arms','Forearms/Grip','Back/Neck'], 1.25);
  }
  if (priority==='legs'){
    boostMany(['Thighs','Hips/Glutes','Lower Leg','Hips/Glutes/Thigh'], 1.3);
  }
  if (priority==='arms'){
    boostMany(['Arms','Forearms/Grip'], 1.35);
  }
  if (priority==='back'){
    boostMany(['Back','Back/Core','Back/Hips','Shoulders/Back','Back/Neck'], 1.35);
  }
  if (priority==='chest'){
    boostMany(['Chest','Chest/Core'], 1.35);
  }
  if (priority==='shoulders'){
    boostMany(['Shoulders','Shoulders/Back'], 1.35);
  }
  if (priority==='core'){
    boostMany(['Core','Back/Core','Chest/Core'], 1.35);
  }
  return base;
}


// ---------- e1RM + load utilities ----------
function roundToStep(x, step){
  const s = Math.max(0.01, Number(step)||1);
  return Math.round(x / s) * s;
}

function e1rm(weight, reps, method){
  const w = Number(weight)||0;
  const r = Number(reps)||0;
  if (w<=0 || r<=0) return 0;

  const m = method || state.settings.e1rmMethod;
  if (m==='brzycki'){
    // 1RM = w * 36 / (37 - r)
    return (r>=37) ? 0 : w * 36 / (37 - r);
  }
  if (m==='lombardi'){
    // 1RM = w * r^0.10
    return w * Math.pow(r, 0.10);
  }
  // Epley: 1RM = w * (1 + r/30)
  return w * (1 + r/30);
}

function formatLoad(x){
  const n = Number(x)||0;
  const step = Number(state.settings.roundTo)||2.5;
  return roundToStep(n, step).toFixed(step>=1 ? 0 : 2);
}

// ---------- Effective set accounting ----------
function exerciseEffectiveSets(exId, setCount){
  const ex = exercisesById.get(exId);
  if (!ex) return { primary:{}, secondary:{} };

  const primary = {};
  const secondary = {};
  const add = (obj, id, v)=>{ obj[id] = (obj[id]||0) + v; };

  for (const m of (ex.primary||[])) add(primary, m, setCount * 1.0);
  for (const m of (ex.secondary||[])) add(secondary, m, setCount * 0.5);

  return { primary, secondary };
}

function expandGroups(muscleId){
  // If you pass a group (like "quads"), return its members; else itself.
  const m = musclesById.get(muscleId);
  if (!m) return [muscleId];
  if (m.type==='group' && Array.isArray(m.members) && m.members.length) return m.members;
  return [muscleId];
}

function addEffectiveSets(map, muscleId, value){
  for (const id of expandGroups(muscleId)){
    map[id] = (map[id]||0) + value;
  }
}

function computeEffectiveSetsByMuscle(sessions, windowDays=7){
  const cutoff = addDaysISO(todayISO(), -windowDays+1);
  const out = {};
  for (const s of sessions){
    if (!s.dateISO || s.dateISO < cutoff) continue;
    for (const ex of (s.exercises||[])){
      const sc = Number(ex.setCount)||0;
      const eff = exerciseEffectiveSets(ex.exerciseId, sc);
      for (const [m,v] of Object.entries(eff.primary)) addEffectiveSets(out, m, v);
      for (const [m,v] of Object.entries(eff.secondary)) addEffectiveSets(out, m, v);
    }
  }
  return out;
}

function computeEffectiveSetsByRegion(sessions, windowDays=7){
  const byMuscle = computeEffectiveSetsByMuscle(sessions, windowDays);
  const out = Object.fromEntries(regions.map(r=>[r,0]));
  for (const [mid, v] of Object.entries(byMuscle)){
    const m = musclesById.get(mid);
    if (!m?.region) continue;
    out[m.region] = (out[m.region]||0) + v;
  }
  return out;
}

// ---------- Training load (if duration + session RPE logged) ----------
function sessionLoad(session){
  const dur = Number(session.durationMin)||0;
  const rpe = Number(session.sessionRpe)||0;
  if (dur<=0 || rpe<=0) return 0;
  return dur * rpe;
}

function weeklyLoadMetrics(sessions, weeks=8){
  // Returns array of {weekStartISO, weekLoad, monotony, strain}
  // weekStartISO = Monday-based start (simple: use date, shift by weekday)
  const byDay = new Map();
  for (const s of sessions){
    const load = sessionLoad(s);
    if (load<=0 || !s.dateISO) continue;
    byDay.set(s.dateISO, (byDay.get(s.dateISO)||0) + load);
  }

  // Build last N weeks window
  const end = todayISO();
  const start = addDaysISO(end, -(weeks*7-1));

  // Fill day loads
  const dayLoads = [];
  for (let i=0;i<weeks*7;i++){
    const d = addDaysISO(start, i);
    dayLoads.push({ dateISO:d, load: byDay.get(d)||0 });
  }

  const weeksOut = [];
  for (let w=0; w<weeks; w++){
    const chunk = dayLoads.slice(w*7, w*7+7);
    const loads = chunk.map(x=>x.load);
    const weekLoad = loads.reduce((a,b)=>a+b,0);
    const mean = weekLoad / 7;
    const sd = Math.sqrt(loads.map(x=>Math.pow(x-mean,2)).reduce((a,b)=>a+b,0)/7) || 0;
    const monotony = sd>0 ? (mean/sd) : (weekLoad>0 ? 7 : 0);
    const strain = weekLoad * monotony;
    weeksOut.push({ weekStartISO: chunk[0].dateISO, weekLoad, monotony, strain });
  }
  return weeksOut;
}

// ---------- Plan generation ----------
function eligibleExercises({pattern=null, requireEquip=null, includeMuscle=null}={}){
  const equipKeysOn = Object.entries(state.profile.equipment).filter(([,v])=>v).map(([k])=>k);
  return EXERCISES.filter(ex=>{
    if (pattern && ex.pattern!==pattern) return false;
    if (requireEquip && !(ex.equip||[]).includes(requireEquip)) return false;
    // must match any enabled equipment
    if (!ex.equip?.some(e=>equipKeysOn.includes(e))) return false;
    if (includeMuscle){
      const mus = includeMuscle;
      const p = (ex.primary||[]);
      const s = (ex.secondary||[]);
      if (![...p,...s].includes(mus)) return false;
    }
    return true;
  });
}

function pickExercise({pattern, preferredMuscles=[], excludeIds=new Set()}){
  const candidates = eligibleExercises({pattern}).filter(ex=>!excludeIds.has(ex.id));
  if (!candidates.length) return null;
  // Score by preferred muscles overlap
  const scored = candidates.map(ex=>{
    const set = new Set([...(ex.primary||[]), ...(ex.secondary||[])]);
    let score = 0;
    for (const m of preferredMuscles) if (set.has(m)) score += 2;
    // small bias to compound-ish patterns via notes length (cheap heuristic)
    score += Math.min(1, (ex.primary||[]).length/3);
    return { ex, score: score + Math.random()*0.1 };
  }).sort((a,b)=>b.score-a.score);
  return scored[0].ex;
}


function splitTemplate(days){
  // Patterns supported by this build: carry, core, hinge, isolation, lunge, power, prehab, pull, push, squat
  if (days<=2) return { name:'Full Body (A/B)', days:[
    { name:'Full Body A', patterns:['squat','push','pull','hinge','core'] },
    { name:'Full Body B', patterns:['squat','pull','push','hinge','core'] },
  ]};
  if (days===3) return { name:'Full Body (3x)', days:[
    { name:'Full Body 1', patterns:['squat','push','pull','hinge','core'] },
    { name:'Full Body 2', patterns:['squat','pull','push','lunge','core'] },
    { name:'Full Body 3', patterns:['hinge','push','pull','isolation','core'] },
  ]};
  if (days===4) return { name:'Upper/Lower', days:[
    { name:'Upper 1', patterns:['push','pull','push','pull','isolation'] },
    { name:'Lower 1', patterns:['squat','hinge','lunge','core','carry'] },
    { name:'Upper 2', patterns:['push','pull','push','pull','isolation'] },
    { name:'Lower 2', patterns:['squat','hinge','lunge','core','carry'] },
  ]};
  if (days===5) return { name:'PPL + Full', days:[
    { name:'Push', patterns:['push','push','isolation','core'] },
    { name:'Pull', patterns:['pull','pull','isolation','core'] },
    { name:'Legs', patterns:['squat','hinge','lunge','core','carry'] },
    { name:'Full Body', patterns:['squat','push','pull','hinge','core'] },
    { name:'Pump/Prehab', patterns:['isolation','isolation','prehab','core'] },
  ]};
  return { name:'Hybrid (6x)', days:[
    { name:'Push', patterns:['push','push','isolation','core'] },
    { name:'Pull', patterns:['pull','pull','isolation','core'] },
    { name:'Legs', patterns:['squat','hinge','lunge','core','carry'] },
    { name:'Upper', patterns:['push','pull','push','pull','isolation'] },
    { name:'Lower', patterns:['squat','hinge','lunge','core','carry'] },
    { name:'Prehab', patterns:['prehab','isolation','core','carry'] },
  ]};
}



function defaultSetPrescription(goal, pattern){
  // Basic mapping; can be edited later in future versions
  if (goal==='strength'){
    if (['squat','hinge','power'].includes(pattern)) return { sets:3, reps:'3–6', rpe:'7–9' };
    if (['push','pull'].includes(pattern)) return { sets:3, reps:'4–8', rpe:'7–9' };
    if (pattern==='lunge') return { sets:2, reps:'6–10', rpe:'7–9' };
    if (pattern==='core') return { sets:2, reps:'6–15', rpe:'6–8' };
    return { sets:2, reps:'8–15', rpe:'7–9' }; // isolation/prehab/carry
  }
  if (goal==='hypertrophy'){
    if (['squat','hinge','lunge'].includes(pattern)) return { sets:3, reps:'6–12', rpe:'7–9' };
    if (['push','pull'].includes(pattern)) return { sets:3, reps:'8–15', rpe:'7–9' };
    if (pattern==='core') return { sets:2, reps:'10–20', rpe:'6–8' };
    return { sets:3, reps:'10–20', rpe:'7–9' };
  }
  // general
  if (['squat','hinge','lunge'].includes(pattern)) return { sets:2, reps:'5–10', rpe:'6–8' };
  if (['push','pull'].includes(pattern)) return { sets:2, reps:'6–12', rpe:'6–8' };
  if (pattern==='core') return { sets:2, reps:'10–20', rpe:'6–8' };
  return { sets:2, reps:'10–20', rpe:'6–8' };
}



function preferredMusclesForDay(dayName){
  // priority helps choose exercises (scoring only; if a muscle id is absent it just has no effect)
  const pr = state.profile.priority;
  const prefs = [];
  if (pr==='back') prefs.push('lats','upper_back','mid_traps','traps_lower','delt_post');
  if (pr==='chest') prefs.push('pec_major_sternal','pec_major_clav','pec_minor');
  if (pr==='shoulders') prefs.push('delt_ant','delt_lat','delt_post');
  if (pr==='arms') prefs.push('biceps','triceps','forearms');
  if (pr==='legs'||pr==='lower') prefs.push('quads','hamstrings','glute_max','gastroc','soleus');
  if (pr==='core') prefs.push('abs','obliques','transverse_abdominis','spinal_erectors');
  if (pr==='push') prefs.push('pecs','triceps','delt_ant','delt_lat');
  if (pr==='pull') prefs.push('lats','upper_back','biceps','delt_post');
  if (pr==='upper') prefs.push('pecs','upper_back','delt_lat','arms');
  return prefs;
}


function generatePlanFromTemplate(tpl){
  const goal = state.profile.goal;
  const planDays = tpl.days.slice(0, clamp(state.profile.daysPerWeek,1,7)).map((d, idx)=>{
    const prefs = preferredMusclesForDay(d.name);
    const used = new Set();
    const items = d.patterns.map(p=>{
      const ex = pickExercise({ pattern:p, preferredMuscles:prefs, excludeIds: used }) || pickExercise({ pattern:p, preferredMuscles:[], excludeIds: used });
      if (ex?.id) used.add(ex.id);
      const pres = defaultSetPrescription(goal, p);
      return {
        id: uid('item'),
        pattern: p,
        exerciseId: ex?.id || '',
        sets: pres.sets,
        reps: pres.reps,
        rpeTarget: pres.rpe,
        notes: ex?.notes || ''
      };
    });
    return { id: uid('day'), name: d.name, items };
  });

  const prog = {
    rule: 'Double progression',
    detail: 'Hit the top of the rep range at ≤RPE 8 → add 2–5% next time; if you miss the bottom range 2 sessions in a row → reduce 5–10% or deload.',
  };

  return { createdISO: todayISO(), splitName: tpl.name, days: planDays, progression: prog };
}

function generateAutopilotPlan(){
  const tpl = splitTemplate(clamp(state.profile.daysPerWeek,1,7));
  return generatePlanFromTemplate(tpl);
}

function swapExerciseInPlan(dayId, itemId){
  if (!state.plan) return;
  const d = state.plan.days.find(x=>x.id===dayId);
  const it = d?.items.find(x=>x.id===itemId);
  if (!it) return;
  const current = exercisesById.get(it.exerciseId);
  const prefs = preferredMusclesForDay(d.name);
  const options = eligibleExercises({pattern: it.pattern}).filter(ex=>ex.id!==it.exerciseId);
  if (!options.length){ toast('No alternatives found for your equipment.'); return; }

  const scored = options.map(ex=>{
    const set = new Set([...(ex.primary||[]), ...(ex.secondary||[])]);
    let score = 0;
    for (const m of prefs) if (set.has(m)) score += 2;
    // keep close to current muscle list if possible
    if (current){
      const cur = new Set([...(current.primary||[]), ...(current.secondary||[])]);
      for (const m of cur) if (set.has(m)) score += 0.6;
    }
    return { ex, score: score + Math.random()*0.1 };
  }).sort((a,b)=>b.score-a.score);

  it.exerciseId = scored[0].ex.id;
  it.notes = scored[0].ex.notes || '';
  saveState();
  renderAll();
  toast('Swapped exercise.');
}

// ---------- Logging ----------
function ensureDateInput(){
  if ($('#logDate')) $('#logDate').value = todayISO();
}

function addSession({dateISO, exerciseId, setCount, reps, weight, rpe, durationMin, sessionRpe}){
  const ex = exercisesById.get(exerciseId);
  if (!ex) throw new Error('Invalid exercise');

  const session = {
    id: uid('s'),
    dateISO,
    durationMin: durationMin ? Number(durationMin) : 0,
    sessionRpe: sessionRpe ? Number(sessionRpe) : 0,
    exercises: [{
      exerciseId,
      setCount: Number(setCount)||0,
      reps: Number(reps)||0,
      weight: Number(weight)||0,
      rpe: rpe ? Number(rpe) : 0,
      sets: Array.from({length: Number(setCount)||0}, ()=>({reps: Number(reps)||0, weight: Number(weight)||0, rpe: rpe ? Number(rpe) : 0})),
    }],
  };

  state.log.sessions.unshift(session);
  updatePRsWithSession(session);
  saveState();
}

function deleteSession(id){
  state.log.sessions = state.log.sessions.filter(s=>s.id!==id);
  saveState();
}

function sessionE1rm(session){
  // Use best set in this session (single exercise) to estimate 1RM
  const ex = session.exercises?.[0];
  if (!ex) return 0;
  return e1rm(ex.weight, ex.reps, state.settings.e1rmMethod);
}

function strengthSeries(exerciseId, weeks=12){
  const cutoff = addDaysISO(todayISO(), -(weeks*7-1));
  const pts = [];
  for (const s of state.log.sessions){
    if (!s.dateISO || s.dateISO < cutoff) continue;
    for (const ex of (s.exercises||[])){
      if (ex.exerciseId!==exerciseId) continue;
      pts.push({ dateISO: s.dateISO, e1rm: e1rm(ex.weight, ex.reps, state.settings.e1rmMethod) });
    }
  }
  pts.sort((a,b)=>a.dateISO.localeCompare(b.dateISO));
  return pts;
}

function bestLiftForTrend(){
  // Prefer goal lift if exists; else common compounds if logged; else first exercise
  const g = state.goals[0];
  if (g?.liftId) return g.liftId;
  const common = ['back_squat','bench_press','deadlift','overhead_press'];
  for (const id of common){
    if (strengthSeries(id, 12).length) return id;
  }
  return EXERCISES[0]?.id || 'back_squat';
}

// ---------- Readiness check-ins ----------
function getTodayCheckin(){
  const t = todayISO();
  return state.checkins.find(c=>c.dateISO===t) || null;
}

function saveTodayCheckin(c){
  const t = todayISO();
  state.checkins = state.checkins.filter(x=>x.dateISO!==t);
  state.checkins.unshift({ dateISO: t, ...c });
  saveState();
}

function readinessScore(c){
  // 0–100; simple average of scaled inputs
  // sleep: 1-10 (higher better), soreness: 1-10 (higher worse), stress: 1-10 (higher worse), motivation: 1-10 (higher better)
  const sleep = clamp(Number(c.sleep)||5,1,10);
  const sore = clamp(Number(c.soreness)||5,1,10);
  const stress = clamp(Number(c.stress)||5,1,10);
  const mot = clamp(Number(c.motivation)||5,1,10);
  const score = (
    (sleep/10)*0.35 +
    ((11-sore)/10)*0.25 +
    ((11-stress)/10)*0.2 +
    (mot/10)*0.2
  )*100;
  return Math.round(score);
}

function readinessAdvice(score){
  if (score>=75) return { label:'Green', advice:'Train as planned. Consider pushing top sets slightly if reps are moving well.' };
  if (score>=55) return { label:'Yellow', advice:'Train as planned but keep effort honest. If sets feel slow, reduce volume ~10–20%.' };
  return { label:'Red', advice:'Prioritize technique + easy work. Consider reducing volume 20–40% or taking an extra rest day.' };
}

// ---------- Diagnostics (plateau & bottleneck) ----------
function linearRegressionSlope(points){
  // points: array of {x,y} where x is index (0..n-1)
  const n = points.length;
  if (n<2) return 0;
  const xs = points.map(p=>p.x);
  const ys = points.map(p=>p.y);
  const xbar = xs.reduce((a,b)=>a+b,0)/n;
  const ybar = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, den=0;
  for (let i=0;i<n;i++){
    num += (xs[i]-xbar)*(ys[i]-ybar);
    den += (xs[i]-xbar)*(xs[i]-xbar);
  }
  return den===0 ? 0 : num/den;
}

function plateauDiagnosis(liftId){
  const pts = strengthSeries(liftId, 8);
  if (pts.length < 4) return { status:'insufficient', title:'Not enough data', detail:'Log at least 4 sessions for this lift to diagnose progress.', actions:[] };

  // compress to weekly best
  const byWeek = new Map();
  for (const p of pts){
    const w = Math.floor(daysBetween(addDaysISO(todayISO(), -56), p.dateISO) / 7); // 0..7 approx
    if (w<0) continue;
    const prev = byWeek.get(w);
    byWeek.set(w, Math.max(prev||0, p.e1rm));
  }
  const series = Array.from(byWeek.entries()).sort((a,b)=>a[0]-b[0]).map(([w,v],i)=>({x:i,y:v}));
  if (series.length < 4) return { status:'insufficient', title:'Not enough weekly points', detail:'Log more weeks or more consistent sessions.', actions:[] };

  const slope = linearRegressionSlope(series);
  const last = series[series.length-1].y;
  const relSlope = (slope / Math.max(1,last)) * 100; // % per week-ish
  const flat = Math.abs(relSlope) < 0.15; // <0.15% per week ~ flat

  // Volume context
  const volRegion = computeEffectiveSetsByRegion(state.log.sessions, 7);
  const targetsBase = weeklySetTargets(state.profile.goal, state.profile.experience);
  const w = priorityRegionWeights(state.profile.priority);
  const gaps = Object.entries(volRegion).map(([r,v])=>{
    const lo = targetsBase.lo * (w[r]||1);
    const hi = targetsBase.hi * (w[r]||1);
    return { region:r, v, lo, hi };
  });

  // Load context
  const loads = weeklyLoadMetrics(state.log.sessions, 4);
  const latest = loads[loads.length-1] || { weekLoad:0, monotony:0, strain:0 };
  const highStrain = latest.strain > 0 && latest.monotony >= 2.0;

  if (!flat){
    return { status:'progressing', title:'Progressing', detail:`Your trend is moving up (${relSlope.toFixed(2)}% per week approx). Keep the plan; tighten consistency.`, actions:[
      'Keep progression rule: top of rep range ≤RPE 8 → add 2–5%',
      'Prioritize sleep and consistent weekly frequency',
    ]};
  }

  // Classify plateau
  const under = gaps.filter(g=>g.v < g.lo*0.85);
  const over = gaps.filter(g=>g.v > g.hi*1.15);

  const actions = [];
  let title = 'Plateau detected';
  let detail = 'Your e1RM trend looks flat recently. TYSON will recommend the smallest change likely to restart progress.';

  if (under.length){
    title = 'Plateau likely from low volume / exposure';
    detail = `Your weekly effective sets are below target in: ${under.slice(0,3).map(u=>u.region).join(', ')}.`;
    actions.push('Add 2–4 hard sets/week to the region most tied to your goal lift.');
    actions.push('Add 1 additional “heavy exposure” set (3–5 reps) once per week for the goal lift.');
  } else if (highStrain || over.length){
    title = 'Plateau likely from accumulated fatigue';
    detail = highStrain
      ? 'Your training load is high with low variability (high monotony).'
      : `Your weekly sets look high in: ${over.slice(0,3).map(o=>o.region).join(', ')}.`;
    actions.push('Deload: reduce sets by ~30–50% for 5–7 days; keep technique crisp.');
    actions.push('Next week: return to normal volume but keep intensity moderate (RPE 7–8) for first 2 sessions.');
  } else {
    title = 'Plateau: try a targeted change';
    detail = 'Volume looks near target and training load isn’t extreme. Next best move: change the stimulus slightly while keeping the plan coherent.';
    actions.push('Swap one main lift to a close variation for 2–3 weeks (e.g., paused bench, tempo squat).');
    actions.push('Add a back-off set (8–10 reps) after your top set once per week.');
  }

  // Readiness overlay
  const ck = getTodayCheckin();
  if (ck){
    const sc = readinessScore(ck);
    if (sc < 55){
      actions.unshift('Your readiness is low today — apply a 10–30% volume reduction until score returns to yellow/green.');
    }
  }

  return { status:'plateau', title, detail, actions };
}

function bottleneckSummary(){
  // Simple "what's your main limiter?" classifier
  const freq = state.profile.daysPerWeek;
  const rec = recommendedFrequency(state.profile.experience);
  const sessions7 = state.log.sessions.filter(s=>s.dateISO >= addDaysISO(todayISO(), -6)).length;
  const vol = computeEffectiveSetsByRegion(state.log.sessions, 7);
  const targets = weeklySetTargets(state.profile.goal, state.profile.experience);
  const weights = priorityRegionWeights(state.profile.priority);

  const underRegions = Object.entries(vol).map(([r,v])=>{
    const lo = targets.lo * (weights[r]||1);
    return { r, v, lo, gap: lo - v };
  }).filter(x=>x.gap>2).sort((a,b)=>b.gap-a.gap);

  const ck = getTodayCheckin();
  const readiness = ck ? readinessScore(ck) : null;

  const primary = [];
  if (sessions7===0) primary.push({k:'Consistency', d:'No sessions logged in the last 7 days. Start with the smallest plan you can complete.'});
  if (sessions7>0 && sessions7 < Math.min(freq, rec.min)) primary.push({k:'Frequency', d:`You logged ${sessions7} sessions in 7 days. For your level, aim for ${rec.min}–${rec.max}.`});
  if (underRegions.length) primary.push({k:'Volume', d:`Biggest under-trained region: ${underRegions[0].r}. Add ~2–4 sets/week.`});
  if (readiness!=null && readiness<55) primary.push({k:'Recovery', d:'Readiness is low today. Reduce volume and focus on easy technique work.'});

  if (!primary.length) primary.push({k:'Focus', d:'You’re on track. Keep progressing and tighten one specific goal lift.'});
  return primary.slice(0,3);
}

// ---------- Weekly summary ----------
function weekSummary(){
  const start = addDaysISO(todayISO(), -6);
  const sessions = state.log.sessions.filter(s=>s.dateISO >= start);
  const totalSessions = sessions.length;

  const load = weeklyLoadMetrics(state.log.sessions, 2);
  const latest = load[load.length-1] || {weekLoad:0, monotony:0, strain:0};

  const byRegion = computeEffectiveSetsByRegion(state.log.sessions, 7);
  const targets = weeklySetTargets(state.profile.goal, state.profile.experience);
  const weights = priorityRegionWeights(state.profile.priority);

  const scored = Object.entries(byRegion).map(([r,v])=>{
    const lo = targets.lo * (weights[r]||1);
    const hi = targets.hi * (weights[r]||1);
    const pct = hi>0 ? (v/hi)*100 : 0;
    return { r, v, lo, hi, pct };
  }).sort((a,b)=>a.pct-b.pct);

  const lowest = scored.slice(0,3);
  const highest = scored.slice(-3).reverse();

  const liftId = bestLiftForTrend();
  const liftPts = strengthSeries(liftId, 12);
  const lastE = liftPts.length ? liftPts[liftPts.length-1].e1rm : 0;

  return { totalSessions, latestLoad: latest, lowest, highest, liftId, lastE };
}

function copyText(text){
  navigator.clipboard.writeText(text).then(()=>toast('Copied to clipboard')).catch(()=>toast('Copy failed'));
}

function weeklyReportText(){
  const sum = weekSummary();
  const ex = exercisesById.get(sum.liftId);
  const name = ex?.name || 'Main Lift';

  const lines = [];
  lines.push(`TYSON Weekly Report (${todayISO()})`);
  lines.push(`Sessions logged (last 7d): ${sum.totalSessions}`);
  if (sum.latestLoad.weekLoad>0){
    lines.push(`Training load: ${Math.round(sum.latestLoad.weekLoad)} (sRPE×min) • Monotony: ${sum.latestLoad.monotony.toFixed(2)} • Strain: ${Math.round(sum.latestLoad.strain)}`);
  } else {
    lines.push(`Training load: (not enough data — log duration + session RPE to enable)`);
  }
  if (sum.lastE>0) lines.push(`${name} e1RM (latest): ${formatLoad(sum.lastE)} ${state.settings.units}`);
  lines.push(`Lowest regions vs target: ${sum.lowest.map(x=>`${x.r} ${x.v.toFixed(1)}/${x.lo.toFixed(0)}–${x.hi.toFixed(0)}`).join(' • ')}`);
  lines.push(`Highest regions vs target: ${sum.highest.map(x=>`${x.r} ${x.v.toFixed(1)}`).join(' • ')}`);

  const b = bottleneckSummary();
  lines.push('');
  lines.push('Bottlenecks:');
  for (const it of b) lines.push(`- ${it.k}: ${it.d}`);

  return lines.join('\n');
}

// ---------- UI rendering ----------
let chartVolume = null;
let chartStrength = null;
let chartLift = null;
let chartRegion = null;
let chartLoad = null;

function setView(name){
  $$('.tab').forEach(b=>b.classList.toggle('active', b.dataset.view===name));
  $$('.view').forEach(v=>v.classList.toggle('active', v.id===`view-${name}`));
  state._view = name;
  saveState();
  // render only when visible (but cheap enough to re-render all)
  renderAll();
}

function renderTabs(){
  $$('#tabs .tab').forEach(btn=>{
    btn.onclick = ()=>setView(btn.dataset.view);
  });
}

function renderEquipmentChips(){
  const chips = EQUIP.map(e=>{
    const on = !!state.profile.equipment[e.key];
    return `<button class="chip ${on?'on':''}" data-equip="${e.key}">${esc(e.name)}</button>`;
  }).join('');
  $('#equipChips').innerHTML = chips;
  $$('#equipChips .chip').forEach(btn=>{
    btn.onclick = ()=>{
      const k = btn.dataset.equip;
      state.profile.equipment[k] = !state.profile.equipment[k];
      saveState();
      renderEquipmentChips();
      toast('Equipment updated.');
    };
  });
}

function nextSteps(){
  const steps = [];
  if (!state.goals.length){
    steps.push({ title:'Create a goal', detail:'Open the Goals tab → Goal Wizard → set a 12-week target for a main lift.' });
  }
  if (!state.plan){
    steps.push({ title:'Generate your plan', detail:'Open Program → Generate week (autopilot). Then edit swaps if needed.' });
  }
  const s7 = state.log.sessions.filter(s=>s.dateISO >= addDaysISO(todayISO(), -6)).length;
  if (s7===0){
    steps.push({ title:'Log your first session', detail:'Open Log → enter one main exercise you did today.' });
  } else {
    steps.push({ title:'Progress one lift', detail:'Pick a goal lift; aim to add 1 rep or 2–5% load when you can do the top reps at ≤RPE 8.' });
  }
  steps.push({ title:'Balance your week', detail:'Open Muscles → make sure your lowest region gets +2–4 sets next week.' });
  return steps.slice(0,6);
}

function renderStartHere(){
  const prof = state.profile;
  const freq = recommendedFrequency(prof.experience);
  const rep = repIntensityDefaults(prof.goal);
  const targets = weeklySetTargets(prof.goal, prof.experience);

  const steps = nextSteps().map(s=>`
    <div class="todo">
      <div>➜</div>
      <div>
        <b>${esc(s.title)}</b>
        <div class="small">${esc(s.detail)}</div>
      </div>
    </div>
  `).join('');

  $('#startHere').innerHTML = `
    <div class="note">
      <b>Right now:</b> Goal <b>${esc(prof.goal)}</b>, Experience <b>${esc(prof.experience)}</b>, Plan <b>${state.plan ? 'ready' : 'none'}</b>.
    </div>
    <div class="note">
      <b>Recommended frequency:</b> ${freq.min}–${freq.max} days/week. <b>Default reps:</b> ${rep.reps} at ~RPE ${rep.rpe}. <b>Rest:</b> ${rep.rest}.
    </div>
    <div class="note">
      <b>Volume target (rough):</b> ${targets.lo}–${targets.hi} effective sets / week (per region, adjusted by your priority focus).
    </div>
    <div class="divider"></div>
    ${steps || '<div class="note">You’re set. Keep logging and progressing.</div>'}
  `;
}

function renderProfileForm(){
  $('#profileGoal').value = state.profile.goal;
  $('#profileExperience').value = state.profile.experience;
  $('#profileDays').value = state.profile.daysPerWeek;
  $('#profileMinutes').value = state.profile.minutesPerSession;
  $('#profileBodyweight').value = state.profile.bodyweight;
  $('#profilePriority').value = state.profile.priority;

  // Schedule + breaks
  const sched = state.profile.schedule || DEFAULT_STATE.profile.schedule;
  if ($('#profileTrainTime')) $('#profileTrainTime').value = sched.trainTime || 'evening';
  if ($('#profileWake')) $('#profileWake').value = sched.wakeTime || '07:00';
  if ($('#profileBed')) $('#profileBed').value = sched.bedTime || '23:00';
  if ($('#profileWorkStart')) $('#profileWorkStart').value = sched.workStart || '09:00';
  if ($('#profileWorkEnd')) $('#profileWorkEnd').value = sched.workEnd || '17:00';
  if ($('#profileBreakEvery')) $('#profileBreakEvery').value = sched.breakEveryMin ?? 45;

  // Cardio
  const c = state.profile.cardio || DEFAULT_STATE.profile.cardio;
  if ($('#profileCardioMod')) $('#profileCardioMod').value = c.modality || 'none';
  if ($('#profileCardioDays')) $('#profileCardioDays').value = c.daysPerWeek ?? 0;
  if ($('#profileCardioMin')) $('#profileCardioMin').value = c.minutesPerSession ?? 0;
  if ($('#profileCardioInt')) $('#profileCardioInt').value = c.intensity || 'easy';

  $('#btnSaveProfile').onclick = ()=>{
    state.profile.goal = $('#profileGoal').value;
    state.profile.experience = $('#profileExperience').value;
    state.profile.daysPerWeek = clamp(Number($('#profileDays').value)||3, 1, 7);
    state.profile.minutesPerSession = clamp(Number($('#profileMinutes').value)||60, 20, 240);
    state.profile.bodyweight = $('#profileBodyweight').value;
    state.profile.priority = $('#profilePriority').value;

    state.profile.schedule = {
      trainTime: $('#profileTrainTime')?.value || 'evening',
      wakeTime: $('#profileWake')?.value || '07:00',
      bedTime: $('#profileBed')?.value || '23:00',
      workStart: $('#profileWorkStart')?.value || '09:00',
      workEnd: $('#profileWorkEnd')?.value || '17:00',
      breakEveryMin: clamp(Number($('#profileBreakEvery')?.value)||45, 15, 240),
    };

    state.profile.cardio = {
      modality: $('#profileCardioMod')?.value || 'none',
      daysPerWeek: clamp(Number($('#profileCardioDays')?.value)||0, 0, 7),
      minutesPerSession: clamp(Number($('#profileCardioMin')?.value)||0, 0, 240),
      intensity: $('#profileCardioInt')?.value || 'easy',
    };

    saveState();
    $('#profileStatus').textContent = 'Saved.';
    toast('Profile saved.');
    renderAll();
  };
}


function renderReadiness(){
  const c = getTodayCheckin() || { sleep:7, soreness:4, stress:4, motivation:7 };
  const score = readinessScore(c);
  const adv = readinessAdvice(score);

  $('#readinessCard').innerHTML = `
    <div class="formGrid">
      <label class="field"><span>Sleep quality (1–10)</span><input id="rSleep" type="number" min="1" max="10" value="${esc(c.sleep)}"></label>
      <label class="field"><span>Soreness (1–10)</span><input id="rSore" type="number" min="1" max="10" value="${esc(c.soreness)}"></label>
      <label class="field"><span>Stress (1–10)</span><input id="rStress" type="number" min="1" max="10" value="${esc(c.stress)}"></label>
      <label class="field"><span>Motivation (1–10)</span><input id="rMot" type="number" min="1" max="10" value="${esc(c.motivation)}"></label>
    </div>
    <div class="divider"></div>
    <div class="row">
      <div class="badge ${score>=75?'good':score>=55?'mid':'bad'}">${score} • ${esc(adv.label)}</div>
      <button class="btn primary" id="btnSaveReadiness">Save</button>
    </div>
    <div class="small">${esc(adv.advice)}</div>
  `;

  $('#btnSaveReadiness').onclick = ()=>{
    const v = {
      sleep: Number($('#rSleep').value)||7,
      soreness: Number($('#rSore').value)||4,
      stress: Number($('#rStress').value)||4,
      motivation: Number($('#rMot').value)||7,
    };
    saveTodayCheckin(v);
    toast('Readiness saved.');
    renderReadiness();
    renderAll();
  };
}

function renderWeeklySummary(){
  const sum = weekSummary();
  const liftName = exercisesById.get(sum.liftId)?.name || 'Lift';
  const bottlenecks = bottleneckSummary().map(b=>`<li><b>${esc(b.k)}:</b> ${esc(b.d)}</li>`).join('');

  const loadLine = sum.latestLoad.weekLoad>0
    ? `<div class="note"><b>Training load:</b> ${Math.round(sum.latestLoad.weekLoad)} • <b>Monotony:</b> ${sum.latestLoad.monotony.toFixed(2)} • <b>Strain:</b> ${Math.round(sum.latestLoad.strain)}</div>`
    : `<div class="note"><b>Training load:</b> log duration + session RPE to enable.</div>`;

  const low = sum.lowest.map(x=>`${x.r}: ${x.v.toFixed(1)} / ${x.lo.toFixed(0)}–${x.hi.toFixed(0)}`).join(' • ');

  $('#weeklySummary').innerHTML = `
    <div class="note"><b>Sessions (last 7d):</b> ${sum.totalSessions}</div>
    ${loadLine}
    <div class="note"><b>${esc(liftName)} e1RM:</b> ${sum.lastE>0 ? `${formatLoad(sum.lastE)} ${esc(state.settings.units)}` : '— (log this lift to see trend)'}</div>
    <div class="note"><b>Lowest regions:</b> ${esc(low || '—')}</div>
    <div class="divider"></div>
    <div class="small"><b>Bottlenecks</b></div>
    <ul class="bullets">${bottlenecks}</ul>
    <div class="divider"></div>
    <div class="row">
      <button class="btn" id="btnCopyReport">Copy weekly report</button>
    </div>
  `;

  $('#btnCopyReport').onclick = ()=>copyText(weeklyReportText());
}

function renderQuickInsights(){
  const b = bottleneckSummary();
  const liftId = bestLiftForTrend();
  const diag = plateauDiagnosis(liftId);
  const liftName = exercisesById.get(liftId)?.name || 'Goal lift';

  $('#insights').innerHTML = `
    <div class="note"><b>Main bottleneck:</b> ${esc(b[0]?.k||'—')} — ${esc(b[0]?.d||'')}</div>
    <div class="note"><b>${esc(liftName)}:</b> ${esc(diag.title)}<div class="small">${esc(diag.detail)}</div></div>
    ${diag.actions?.length ? `<div class="note"><b>Do next:</b><ul class="bullets">${diag.actions.slice(0,3).map(a=>`<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
  `;
}

function renderWeekPlan(){
  const el = $('#weekPlan');
  if (!state.plan){
    el.innerHTML = `<div class="note">No plan yet. Go to <b>Program</b> → Generate week (autopilot).</div>`;
    return;
  }
  el.innerHTML = `
    <div class="note"><b>${esc(state.plan.splitName)}</b> • Created ${esc(state.plan.createdISO)} • ${esc(state.plan.progression.rule)}</div>
    <div class="divider"></div>
    ${state.plan.days.map(d=>`
      <div class="day">
        <div class="dayHeader">
          <div><b>${esc(d.name)}</b></div>
          <div class="small">${esc(d.items.length)} items</div>
        </div>
        <div class="dayBody">
          ${d.items.map(it=>{
            const ex = exercisesById.get(it.exerciseId);
            return `
              <div class="item">
                <div class="itemMain">
                  <div class="itemTitle">${esc(ex?.name || '—')}</div>
                  <div class="small">${esc(it.sets)} sets • reps ${esc(it.reps)} • RPE ${esc(it.rpeTarget)} • pattern ${esc(it.pattern)}</div>
                  ${it.notes ? `<div class="small muted">${esc(it.notes)}</div>` : ''}
                </div>
                <div class="itemActions">
                  <button class="btn mini" data-swap="${esc(d.id)}|${esc(it.id)}">Swap</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('')}
  `;

  $$('[data-swap]').forEach(btn=>{
    btn.onclick = ()=>{
      const [dayId, itemId] = btn.dataset.swap.split('|');
      swapExerciseInPlan(dayId, itemId);
    };
  });
}

// ---------- Charts ----------
function renderChartVolume(){
  const ctx = $('#chartVolume');
  if (!ctx) return;
  const byRegion = computeEffectiveSetsByRegion(state.log.sessions, 7);

  const targets = weeklySetTargets(state.profile.goal, state.profile.experience);
  const weights = priorityRegionWeights(state.profile.priority);

  const labels = Object.keys(byRegion);
  const values = labels.map(r=>byRegion[r]||0);
  const lo = labels.map(r=>targets.lo * (weights[r]||1));
  const hi = labels.map(r=>targets.hi * (weights[r]||1));

  const data = {
    labels,
    datasets: [
      { label:'Effective sets', data: values },
      { label:'Min target', data: lo },
      { label:'Max target', data: hi },
    ]
  };

  if (chartVolume) chartVolume.destroy();
  chartVolume = new Chart(ctx, {
    type:'bar',
    data,
    options:{
      responsive:true,
      scales:{ y:{ beginAtZero:true } },
      plugins:{ legend:{ display:true } }
    }
  });
}

function renderChartStrength(){
  const ctx = $('#chartStrength');
  if (!ctx) return;

  const liftId = bestLiftForTrend();
  const pts = strengthSeries(liftId, 12);

  const labels = pts.map(p=>p.dateISO);
  const data = pts.map(p=>Math.round(p.e1rm));

  if (chartStrength) chartStrength.destroy();
  chartStrength = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{ label:`e1RM (${exercisesById.get(liftId)?.name||'Lift'})`, data }] },
    options:{
      responsive:true,
      scales:{ y:{ beginAtZero:false } },
      plugins:{ legend:{ display:true } }
    }
  });
}

// ---------- Goals ----------
function inferBaselineE1rm(liftId){
  const pts = strengthSeries(liftId, 12);
  if (!pts.length) return 0;
  return Math.max(...pts.map(p=>p.e1rm));
}

function renderGoalWizard(){
  const liftOptions = ['back_squat','bench_press','deadlift','overhead_press']
    .filter(id=>exercisesById.has(id))
    .concat(EXERCISES.slice(0,20).map(e=>e.id))
    .filter((v,i,a)=>a.indexOf(v)===i)
    .slice(0,30)
    .map(id=>`<option value="${esc(id)}">${esc(exercisesById.get(id)?.name||id)}</option>`)
    .join('');

  $('#goalWizard').innerHTML = `
    <div class="formGrid">
      <label class="field">
        <span>Primary lift</span>
        <select id="gLift">${liftOptions}</select>
      </label>
      <label class="field">
        <span>Timeframe (weeks)</span>
        <input id="gWeeks" type="number" min="4" max="52" value="12"/>
      </label>
      <label class="field">
        <span>Baseline e1RM (auto if logged)</span>
        <input id="gBase" type="number" min="0" step="1" placeholder="e.g., 225"/>
      </label>
      <label class="field">
        <span>Target e1RM</span>
        <input id="gTarget" type="number" min="0" step="1" placeholder="e.g., 250"/>
      </label>
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn primary" id="btnPreviewGoal">Preview</button>
      <button class="btn" id="btnAddGoal">Add goal</button>
    </div>
    <div class="divider"></div>
    <div id="gPreview" class="note small"></div>
  `;

  const liftSel = $('#gLift');
  const baseIn = $('#gBase');
  liftSel.onchange = ()=>{
    const base = inferBaselineE1rm(liftSel.value);
    if (base>0) baseIn.value = Math.round(base);
  };
  // initialize baseline
  const initBase = inferBaselineE1rm(liftSel.value);
  if (initBase>0) baseIn.value = Math.round(initBase);

  const preview = ()=>{
    const liftId = $('#gLift').value;
    const weeks = clamp(Number($('#gWeeks').value)||12, 4, 104);
    const base = Number($('#gBase').value)||0;
    const target = Number($('#gTarget').value)||0;
    if (!base || !target || target<=base){
      $('#gPreview').innerHTML = `<b>Preview:</b> Enter baseline and a higher target to see weekly pacing.`;
      return;
    }
    const delta = target - base;
    const perWeek = delta / weeks;
    const pct = (delta / base) * 100;
    const realistic = state.profile.experience==='novice'
      ? { lo:0.5, hi:2.0 }  // %/week heuristic
      : state.profile.experience==='intermediate' ? { lo:0.2, hi:0.8 } : { lo:0.1, hi:0.4 };
    const requiredPct = (pct / weeks);
    const flag = requiredPct > realistic.hi ? '⚠️ Aggressive' : requiredPct < realistic.lo ? 'Conservative' : 'Reasonable';
    $('#gPreview').innerHTML = `
      <b>${esc(exercisesById.get(liftId)?.name||'Lift')}:</b> ${Math.round(base)} → ${Math.round(target)} in ${weeks} weeks<br/>
      Needed: <b>${perWeek.toFixed(1)} ${esc(state.settings.units)}/week</b> (${requiredPct.toFixed(2)}%/week) — <b>${esc(flag)}</b><br/>
      Milestones: Week 4 ≈ ${Math.round(base + perWeek*4)}, Week 8 ≈ ${Math.round(base + perWeek*8)}, Week 12 ≈ ${Math.round(base + perWeek*12)}.
    `;
  };

  $('#btnPreviewGoal').onclick = preview;

  $('#btnAddGoal').onclick = ()=>{
    const liftId = $('#gLift').value;
    const weeks = clamp(Number($('#gWeeks').value)||12, 4, 104);
    const base = Number($('#gBase').value)||0;
    const target = Number($('#gTarget').value)||0;
    if (!liftId || base<=0 || target<=base){
      toast('Enter a baseline and a higher target.');
      return;
    }
    const goal = {
      id: uid('g'),
      liftId,
      createdISO: todayISO(),
      baselineE1RM: base,
      targetE1RM: target,
      targetDateISO: addDaysISO(todayISO(), weeks*7),
    };
    state.goals.unshift(goal);
    saveState();
    toast('Goal added.');
    renderGoalList();
    renderAll();
  };

  preview();
}

function goalProgress(goal){
  const pts = strengthSeries(goal.liftId, 26);
  const best = pts.length ? Math.max(...pts.map(p=>p.e1rm)) : 0;
  const pct = goal.targetE1RM>0 ? (best / goal.targetE1RM)*100 : 0;
  const until = Math.max(0, daysBetween(todayISO(), goal.targetDateISO));
  return { best, pct: clamp(pct,0,200), daysLeft: until };
}

function renderGoalList(){
  if (!$('#goalList')) return;
  if (!state.goals.length){
    $('#goalList').innerHTML = `<div class="note">No goals yet. Use the Goal Wizard to add one.</div>`;
    return;
  }
  $('#goalList').innerHTML = state.goals.map(g=>{
    const ex = exercisesById.get(g.liftId);
    const p = goalProgress(g);
    const bar = `<div class="bar"><div class="barFill" style="width:${clamp(p.pct,0,100)}%"></div></div>`;
    return `
      <div class="goal">
        <div class="row between">
          <div><b>${esc(ex?.name||g.liftId)}</b></div>
          <button class="btn mini danger" data-del-goal="${esc(g.id)}">Delete</button>
        </div>
        <div class="small">Target: ${Math.round(g.targetE1RM)} ${esc(state.settings.units)} by ${esc(g.targetDateISO)} (${p.daysLeft} days)</div>
        <div class="small">Best logged: ${p.best>0 ? `${formatLoad(p.best)} ${esc(state.settings.units)}` : '—'} • Progress: ${Math.min(100,p.pct).toFixed(0)}%</div>
        ${bar}
        <div class="divider"></div>
        <div class="note small">${esc(plateauDiagnosis(g.liftId).title)} — ${esc(plateauDiagnosis(g.liftId).detail)}</div>
      </div>
    `;
  }).join('');

  $$('[data-del-goal]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.delGoal;
      state.goals = state.goals.filter(g=>g.id!==id);
      saveState();
      toast('Goal removed.');
      renderGoalList();
      renderAll();
    };
  });
}

// ---------- Program Builder ----------
function renderProgramBuilder(){
  const on = !!state.plan;
  $('#programBuilder').innerHTML = `
    <div class="note">
      <b>Autopilot</b> generates a coherent week plan from your profile. Then swap exercises to match preferences/injuries.
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn primary" id="btnGenerateWeek2">${on?'Regenerate week':'Generate week'}</button>
      <button class="btn" id="btnClearPlan2">Clear plan</button>
    </div>
    ${state.plan ? `<div class="divider"></div><div class="note small"><b>Progression:</b> ${esc(state.plan.progression.detail)}</div>` : ''}
  `;

  $('#btnGenerateWeek2').onclick = ()=>{
    state.plan = generateAutopilotPlan();
    saveState();
    toast('Plan generated.');
    renderAll();
  };
  $('#btnClearPlan2').onclick = ()=>{
    state.plan = null;
    saveState();
    toast('Plan cleared.');
    renderAll();
  };
}

function renderPluginPicker(){
  const sel = $('#pluginPick');
  if (!sel) return;
  sel.innerHTML = BUILTIN_PLUGINS.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  $('#pluginNote').textContent = BUILTIN_PLUGINS[0]?.note || '';
  sel.onchange = ()=>{
    const pl = BUILTIN_PLUGINS.find(p=>p.id===sel.value);
    $('#pluginNote').textContent = pl?.note || '';
  };

  $('#btnGenFromPlugin').onclick = ()=>{
    const pl = BUILTIN_PLUGINS.find(p=>p.id===sel.value);
    if (!pl){ toast('Pick a plugin.'); return; }
    state.plan = generatePlanFromTemplate(pl.templateForDays(clamp(state.profile.daysPerWeek,1,7)));
    saveState();
    toast('Generated from plugin.');
    renderAll();
  };

  $('#btnGenerateWeek').onclick = ()=>{
    state.plan = generateAutopilotPlan();
    saveState();
    toast('Generated week.');
    renderAll();
  };
  $('#btnClearPlan').onclick = ()=>{
    state.plan = null;
    saveState();
    toast('Plan cleared.');
    renderAll();
  };
}

// ---------- Log UI ----------
function renderLogExerciseOptions(){
  const sel = $('#logExercise');
  if (!sel) return;
  const equipKeysOn = Object.entries(state.profile.equipment).filter(([,v])=>v).map(([k])=>k);
  const list = EXERCISES.filter(ex=>ex.equip?.some(e=>equipKeysOn.includes(e)));
  sel.innerHTML = list.slice(0,200).map(ex=>`<option value="${esc(ex.id)}">${esc(ex.name)}</option>`).join('');
}

function renderLogList(){
  const el = $('#logList');
  if (!el) return;

  if (!state.log.sessions.length){
    el.innerHTML = `<div class="note">No sessions yet. Log your first one.</div>`;
    return;
  }

  el.innerHTML = state.log.sessions.slice(0,20).map(s=>{
    const ex = exercisesById.get(s.exercises?.[0]?.exerciseId);
    const sc = s.exercises?.[0]?.setCount ?? 0;
    const reps = s.exercises?.[0]?.reps ?? 0;
    const w = s.exercises?.[0]?.weight ?? 0;
    const rpe = s.exercises?.[0]?.rpe ?? 0;
    const e = e1rm(w,reps,state.settings.e1rmMethod);
    const load = sessionLoad(s);
    return `
      <div class="logItem">
        <div class="row between">
          <div>
            <b>${esc(ex?.name||'Exercise')}</b>
            <div class="small">${esc(s.dateISO)} • ${sc} sets × ${reps} @ ${w || '—'} ${esc(state.settings.units)} ${rpe?`• RPE ${rpe}`:''}</div>
            <div class="small muted">e1RM ≈ ${e>0?`${formatLoad(e)} ${esc(state.settings.units)}`:'—'} ${load>0?`• Session load ${Math.round(load)}`:''}</div>
          </div>
          <div class="row">
            <button class="btn mini" data-copy-session="${esc(s.id)}">Copy</button>
            <button class="btn mini danger" data-del-session="${esc(s.id)}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  $$('[data-del-session]').forEach(btn=>{
    btn.onclick = ()=>{
      deleteSession(btn.dataset.delSession);
      toast('Session deleted.');
      renderAll();
    };
  });

  $$('[data-copy-session]').forEach(btn=>{
    btn.onclick = ()=>{
      const s = state.log.sessions.find(x=>x.id===btn.dataset.copySession);
      if (!s) return;
      const ex = exercisesById.get(s.exercises?.[0]?.exerciseId);
      const sc = s.exercises?.[0]?.setCount ?? 0;
      const reps = s.exercises?.[0]?.reps ?? 0;
      const w = s.exercises?.[0]?.weight ?? 0;
      const rpe = s.exercises?.[0]?.rpe ?? 0;
      $('#logExercise').value = s.exercises?.[0]?.exerciseId || $('#logExercise').value;
      $('#logSetCount').value = sc;
      $('#logReps').value = reps;
      $('#logWeight').value = w;
      $('#logRpe').value = rpe || '';
      $('#logDuration').value = s.durationMin || '';
      $('#logSessionRpe').value = s.sessionRpe || '';
      toast('Copied into form.');
    };
  });
}

function wireLogForm(){
  ensureDateInput();

  $('#btnSaveLog').onclick = ()=>{
    const dateISO = $('#logDate').value || todayISO();
    const exerciseId = $('#logExercise').value;
    const setCount = Number($('#logSetCount').value)||0;
    const reps = Number($('#logReps').value)||0;
    const weight = Number($('#logWeight').value)||0;
    const rpe = Number($('#logRpe').value)||0;
    const durationMin = Number($('#logDuration').value)||0;
    const sessionRpe = Number($('#logSessionRpe').value)||0;

    if (!exerciseId || setCount<=0 || reps<=0 || weight<=0){
      toast('Enter exercise, sets, reps, and weight.');
      return;
    }
    addSession({dateISO, exerciseId, setCount, reps, weight, rpe, durationMin, sessionRpe});
    toast('Session saved.');
    $('#logWeight').value = '';
    $('#logStatus').textContent = 'Saved.';
    renderAll();
  };

  $('#btnClearPrefill').onclick = ()=>{
    $('#logSetCount').value = 3;
    $('#logReps').value = 5;
    $('#logWeight').value = '';
    $('#logRpe').value = '';
    $('#logDuration').value = '';
    $('#logSessionRpe').value = '';
    toast('Cleared.');
  };
}

// ---------- Muscles view ----------
function renderMuscleCoverage(){
  const el = $('#coverageBody');
  if (!el) return;

  const byRegion = computeEffectiveSetsByRegion(state.log.sessions, 7);
  const targets = weeklySetTargets(state.profile.goal, state.profile.experience);
  const weights = priorityRegionWeights(state.profile.priority);

  const heat = regions.map(r=>{
    const v = byRegion[r]||0;
    const lo = targets.lo * (weights[r]||1);
    const hi = targets.hi * (weights[r]||1);
    const pct = hi>0 ? (v/hi)*100 : 0;
    return { r, v, lo, hi, pct };
  }).sort((a,b)=>a.r.localeCompare(b.r));

  const heatHtml = `
    <div class="note"><b>Region heatmap:</b> last 7 days effective sets vs your target range.</div>
    <div class="heat">
      ${heat.map(h=>`
        <div class="heatRow">
          <div class="heatName">${esc(h.r)}</div>
          <div class="heatBar"><div class="heatFill" style="width:${clamp(h.pct,0,100)}%"></div></div>
          <div class="heatVal">${h.v.toFixed(1)} / ${h.lo.toFixed(0)}–${h.hi.toFixed(0)}</div>
        </div>
      `).join('')}
    </div>
    <div class="divider"></div>
  `;

  const byMuscle = computeEffectiveSetsByMuscle(state.log.sessions, 7);

  const accord = regions.map(r=>{
    const groups = groupByRegion.get(r) || [];
    const rows = groups.map(g=>{
      const members = (g.members||[]).map(mid=>{
        const m = musclesById.get(mid);
        const v = byMuscle[mid]||0;
        return `<div class="subRow"><div>${esc(m?.name||mid)}</div><div class="muted">${v.toFixed(1)} sets</div></div>`;
      }).join('');
      const gv = (byMuscle[g.id]||0);
      return `
        <div class="groupBox">
          <div class="row between">
            <div><b>${esc(g.name)}</b></div>
            <div class="small muted">${gv.toFixed(1)} group sets</div>
          </div>
          <div class="small muted">${esc((g.syn||[]).slice(0,4).join(', '))}</div>
          <div class="divider thin"></div>
          ${members || '<div class="small muted">No members listed.</div>'}
        </div>
      `;
    }).join('');
    return `
      <details class="accordion" ${r==='Chest'?'open':''}>
        <summary>${esc(r)}</summary>
        <div class="accBody">
          ${rows || '<div class="note">No group data for this region.</div>'}
        </div>
      </details>
    `;
  }).join('');

  el.innerHTML = heatHtml + accord;
}

// ---------- Tools ----------
function renderWarmupTool(){
  const el = $('#warmupTool');
  if (!el) return;

  const liftOptions = EXERCISES.slice(0,200).map(ex=>`<option value="${esc(ex.id)}">${esc(ex.name)}</option>`).join('');
  el.innerHTML = `
    <div class="formGrid">
      <label class="field"><span>Exercise</span><select id="wuLift">${liftOptions}</select></label>
      <label class="field"><span>Working weight</span><input id="wuWeight" type="number" min="0" step="0.5" placeholder="e.g., 225"></label>
      <label class="field"><span>Working reps</span><input id="wuReps" type="number" min="1" max="20" value="5"></label>
      <label class="field"><span>Warm-up steps</span><select id="wuSteps">
        <option value="5">5 sets</option>
        <option value="4">4 sets</option>
        <option value="3">3 sets</option>
      </select></label>
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn primary" id="btnBuildWarmup">Build warm-up</button>
    </div>
    <div class="divider"></div>
    <div id="wuOut" class="note"></div>
  `;

  $('#btnBuildWarmup').onclick = ()=>{
    const w = Number($('#wuWeight').value)||0;
    const reps = Number($('#wuReps').value)||5;
    const steps = Number($('#wuSteps').value)||5;
    if (w<=0){ $('#wuOut').textContent = 'Enter a working weight.'; return; }

    // Simple ramp: 40%, 60%, 75%, 87%, 100% (trim based on steps)
    const pct = steps===3 ? [0.55,0.75,1.0] : steps===4 ? [0.45,0.65,0.82,1.0] : [0.4,0.6,0.75,0.87,1.0];
    const repScheme = steps===3 ? [8,5,reps] : steps===4 ? [8,5,3,reps] : [10,6,4,2,reps];

    const sets = pct.map((p,i)=>{
      const ww = roundToStep(w*p, state.settings.roundTo);
      return { weight: ww, reps: repScheme[i] ?? reps };
    });

    $('#wuOut').innerHTML = `
      <div class="small"><b>Warm-up sets:</b></div>
      <ol class="bullets">
        ${sets.map(s=>`<li>${esc(formatLoad(s.weight))} ${esc(state.settings.units)} × ${esc(s.reps)}</li>`).join('')}
      </ol>
      <div class="small muted">Tip: keep early sets easy; last warm-up should feel fast and crisp.</div>
    `;
  };
}

function renderPlateTool(){
  const el = $('#plateTool');
  if (!el) return;

  const plates = Object.keys(state.settings.plates).map(Number).sort((a,b)=>b-a);
  el.innerHTML = `
    <div class="formGrid">
      <label class="field"><span>Target total weight</span><input id="plTarget" type="number" min="0" step="0.5" placeholder="e.g., 225"></label>
      <label class="field"><span>Bar weight</span><input id="plBar" type="number" min="0" step="0.5" value="${esc(state.settings.barWeight)}"></label>
    </div>
    <div class="divider"></div>
    <div class="small"><b>Plate inventory (total plates):</b></div>
    <div class="inv" id="plInv">
      ${plates.map(p=>`
        <label class="invCell">
          <span>${p}</span>
          <input data-plate="${p}" type="number" min="0" step="1" value="${esc(state.settings.plates[p])}">
        </label>
      `).join('')}
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn primary" id="btnCalcPlates">Calculate plates</button>
      <button class="btn" id="btnSavePlates">Save inventory</button>
    </div>
    <div class="divider"></div>
    <div id="plOut" class="note"></div>
  `;

  $('#btnSavePlates').onclick = ()=>{
    $$('[data-plate]').forEach(inp=>{
      const p = Number(inp.dataset.plate);
      state.settings.plates[p] = clamp(Number(inp.value)||0, 0, 999);
    });
    state.settings.barWeight = Number($('#plBar').value)||state.settings.barWeight;
    saveState();
    toast('Inventory saved.');
  };

  $('#btnCalcPlates').onclick = ()=>{
    // update inventory from inputs
    $('#btnSavePlates').click();

    const target = Number($('#plTarget').value)||0;
    const bar = Number($('#plBar').value)||state.settings.barWeight;
    if (target<=bar){ $('#plOut').textContent = 'Target must be greater than bar weight.'; return; }

    const perSide = (target - bar)/2;
    const inv = Object.entries(state.settings.plates).map(([k,v])=>({w:Number(k), n:Number(v)||0})).sort((a,b)=>b.w-a.w);

    // Simple bounded search (greedy + fallback)
    let remaining = perSide;
    const used = [];
    for (const p of inv){
      const maxPairs = Math.floor(p.n/2); // assume symmetrical loading
      if (maxPairs<=0) continue;
      const use = Math.min(maxPairs, Math.floor(remaining / p.w));
      if (use>0){
        used.push({w:p.w, pairs: use});
        remaining -= use*p.w;
        remaining = Math.round(remaining*100)/100;
      }
    }

    const totalUsed = used.reduce((a,b)=>a + b.w*b.pairs, 0);
    const achieved = bar + 2*totalUsed;
    const diff = target - achieved;

    $('#plOut').innerHTML = `
      <div><b>Per side:</b> ${esc(perSide.toFixed(2))} ${esc(state.settings.units)}</div>
      <div class="divider thin"></div>
      ${used.length ? `
        <div class="small"><b>Load each side with:</b></div>
        <ul class="bullets">
          ${used.map(u=>`<li>${u.pairs} pair(s) of ${u.w}</li>`).join('')}
        </ul>
      ` : `<div class="small">No plates available to load.</div>`}
      <div class="divider thin"></div>
      <div class="small muted"><b>Achieved:</b> ${achieved.toFixed(1)} (diff ${diff>=0?'+':''}${diff.toFixed(1)})</div>
      ${Math.abs(diff)>0.01 ? `<div class="small muted">Tip: adjust target to the closest achievable weight or change rounding/inventory.</div>` : ''}
    `;
  };
}

function renderSwapTool(){
  const el = $('#swapTool');
  if (!el) return;

  const patterns = ['any', ...PATTERNS];
  const liftOptions = EXERCISES.slice(0,250).map(ex=>`<option value="${esc(ex.id)}">${esc(ex.name)}</option>`).join('');
  el.innerHTML = `
    <div class="formGrid">
      <label class="field"><span>Current exercise</span><select id="swCur">${liftOptions}</select></label>
      <label class="field"><span>Keep pattern</span>
        <select id="swPattern">${patterns.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select>
      </label>
      <label class="field"><span>Must include muscle (optional)</span>
        <select id="swMuscle"><option value="">(none)</option>${allMuscles.slice(0,200).map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</select>
      </label>
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn primary" id="btnFindSwaps">Find swaps</button>
    </div>
    <div class="divider"></div>
    <div id="swOut"></div>
  `;

  $('#btnFindSwaps').onclick = ()=>{
    const curId = $('#swCur').value;
    const cur = exercisesById.get(curId);
    const pat = $('#swPattern').value;
    const mus = $('#swMuscle').value || null;

    const wantPat = (pat==='any') ? cur?.pattern : pat;
    if (!wantPat){ toast('Pick an exercise.'); return; }

    const options = eligibleExercises({pattern: wantPat, includeMuscle: mus}).filter(ex=>ex.id!==curId);
    if (!options.length){
      $('#swOut').innerHTML = `<div class="note">No swaps found for your current equipment + filters.</div>`;
      return;
    }

    const curSet = new Set([...(cur?.primary||[]), ...(cur?.secondary||[])]);
    const ranked = options.map(ex=>{
      const set = new Set([...(ex.primary||[]), ...(ex.secondary||[])]);
      let overlap=0;
      for (const m of curSet) if (set.has(m)) overlap++;
      return { ex, overlap: overlap + Math.random()*0.1 };
    }).sort((a,b)=>b.overlap-a.overlap).slice(0,12);

    $('#swOut').innerHTML = `
      <div class="small"><b>Top swaps:</b></div>
      <div class="list">
        ${ranked.map(r=>`
          <div class="row between">
            <div>
              <b>${esc(r.ex.name)}</b>
              <div class="small muted">pattern: ${esc(r.ex.pattern)} • equip: ${(r.ex.equip||[]).join(', ')}</div>
            </div>
            <button class="btn mini" data-swap-to="${esc(r.ex.id)}">Copy</button>
          </div>
        `).join('')}
      </div>
      <div class="divider"></div>
      <div class="small muted">“Copy” puts the swap into the Log exercise picker (and you can also swap inside your plan from Dashboard).</div>
    `;

    $$('[data-swap-to]').forEach(btn=>{
      btn.onclick = ()=>{
        const id = btn.dataset.swapTo;
        if ($('#logExercise')) $('#logExercise').value = id;
        toast('Copied swap to Log selector.');
      };
    });
  };
}

function renderTimerTool(){
  const el = $('#timerTool');
  if (!el) return;

  const rest = Number(state.settings.defaultRestSec)||120;
  el.innerHTML = `
    <div class="formGrid">
      <label class="field"><span>Rest seconds</span><input id="tmSec" type="number" min="10" max="900" value="${esc(rest)}"></label>
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn primary" id="btnStartTimer">Start</button>
      <button class="btn" id="btnStopTimer">Stop</button>
    </div>
    <div class="divider"></div>
    <div class="timer" id="tmOut">—</div>
  `;

  let t=null;
  let endAt=0;

  const tick=()=>{
    const left = Math.max(0, Math.ceil((endAt - Date.now())/1000));
    $('#tmOut').textContent = left>0 ? `${left}s` : 'Done';
    if (left<=0){
      clearInterval(t); t=null;
      toast('Rest done.');
    }
  };

  $('#btnStartTimer').onclick = ()=>{
    const sec = clamp(Number($('#tmSec').value)||rest, 10, 900);
    state.settings.defaultRestSec = sec;
    saveState();
    endAt = Date.now() + sec*1000;
    clearInterval(t);
    t=setInterval(tick, 200);
    tick();
  };
  $('#btnStopTimer').onclick = ()=>{
    clearInterval(t); t=null;
    $('#tmOut').textContent = '—';
  };
}



// ---------- v4 Tools (Breaks / Concurrent / PR / Volume / Order) ----------

function roundLoad(x){
  const step = Number(state.settings.roundTo)||2.5;
  if (!Number.isFinite(x)) return 0;
  return Math.round(x/step)*step;
}

function sessionsSince(daysBack){
  const cut = addDaysISO(todayISO(), -(daysBack-1));
  return state.log.sessions.filter(s=>s.dateISO >= cut);
}

function getRegionTargets(){
  const base = weeklySetTargets(state.profile.goal, state.profile.experience);
  const w = priorityRegionWeights(state.profile.priority);
  const customMode = state.settings.volumeTargets?.mode === 'custom';
  const custom = state.settings.volumeTargets?.custom || {};
  const out = {};
  for (const r of regions){
    let lo = Math.round(base.lo * (w[r] ?? 1));
    let hi = Math.round(base.hi * (w[r] ?? 1));
    let mrv = Math.round(hi + Math.max(2, (hi-lo) * 0.75));
    if (customMode && custom[r]){
      const c = custom[r];
      lo = clamp(Number(c.lo)||lo, 0, 100);
      hi = clamp(Number(c.hi)||hi, lo, 120);
      mrv = clamp(Number(c.mrv)||mrv, hi, 140);
    }
    out[r] = { lo, hi, mrv };
  }
  return out;
}

function calcE1rmFromEntry(entry){
  let best = 0;
  for (const set of (entry.sets||[])){
    const e = estimate1RM(Number(set.weight)||0, Number(set.reps)||0, state.settings.e1rmMethod);
    if (e > best) best = e;
  }
  return best;
}

function calcBestWeightFromEntry(entry){
  let best = 0;
  for (const set of (entry.sets||[])){
    const w = Number(set.weight)||0;
    if (w > best) best = w;
  }
  return best;
}

function ensurePRs(){
  if (!state.prs) state.prs = structuredClone(DEFAULT_STATE.prs);
  if (!state.prs.byExercise) state.prs.byExercise = {};
  if (!Array.isArray(state.prs.events)) state.prs.events = [];
}

function recomputePRs(){
  ensurePRs();
  const by = {};
  const events = [];
  const sessions = [...state.log.sessions].sort((a,b)=>a.dateISO.localeCompare(b.dateISO));
  for (const s of sessions){
    for (const e of (s.exercises||[])){
      const exId = e.exerciseId;
      const bestE = calcE1rmFromEntry(e);
      const bestW = calcBestWeightFromEntry(e);
      const cur = by[exId] || { bestE1rm:0, bestE1rmISO:'', bestWeight:0, bestWeightISO:'' };
      if (bestE > (cur.bestE1rm||0) + 1e-6){
        cur.bestE1rm = bestE;
        cur.bestE1rmISO = s.dateISO;
        events.push({ dateISO:s.dateISO, exerciseId:exId, type:'e1rm', value:bestE, detail:`New best e1RM: ${formatLoad(bestE)} ${state.settings.units}` });
      }
      if (bestW > (cur.bestWeight||0) + 1e-6){
        cur.bestWeight = bestW;
        cur.bestWeightISO = s.dateISO;
        events.push({ dateISO:s.dateISO, exerciseId:exId, type:'weight', value:bestW, detail:`Heaviest set: ${formatLoad(bestW)} ${state.settings.units}` });
      }
      by[exId] = cur;
    }
  }
  state.prs.byExercise = by;
  state.prs.events = events.slice(-250);
  saveState();
}

function updatePRsWithSession(session){
  ensurePRs();
  for (const e of (session.exercises||[])){
    const exId = e.exerciseId;
    const bestE = calcE1rmFromEntry(e);
    const bestW = calcBestWeightFromEntry(e);
    const cur = state.prs.byExercise[exId] || { bestE1rm:0, bestE1rmISO:'', bestWeight:0, bestWeightISO:'' };
    let changed = false;
    if (bestE > (cur.bestE1rm||0) + 1e-6){
      cur.bestE1rm = bestE;
      cur.bestE1rmISO = session.dateISO;
      state.prs.events.push({ dateISO:session.dateISO, exerciseId:exId, type:'e1rm', value:bestE, detail:`New best e1RM: ${formatLoad(bestE)} ${state.settings.units}` });
      changed = true;
    }
    if (bestW > (cur.bestWeight||0) + 1e-6){
      cur.bestWeight = bestW;
      cur.bestWeightISO = session.dateISO;
      state.prs.events.push({ dateISO:session.dateISO, exerciseId:exId, type:'weight', value:bestW, detail:`Heaviest set: ${formatLoad(bestW)} ${state.settings.units}` });
      changed = true;
    }
    state.prs.byExercise[exId] = cur;
    if (changed){
      state.prs.events = state.prs.events.slice(-250);
    }
  }
}

function renderBreakTool(){
  const el = $('#breakTool');
  if (!el) return;
  const sched = state.profile.schedule || DEFAULT_STATE.profile.schedule;
  el.innerHTML = `
    <div class="formGrid">
      <label class="field"><span>Work start</span><input id="brWorkStart" type="time" value="${esc(sched.workStart||'09:00')}"></label>
      <label class="field"><span>Work end</span><input id="brWorkEnd" type="time" value="${esc(sched.workEnd||'17:00')}"></label>
      <label class="field"><span>Break every (min)</span><input id="brEvery" type="number" min="15" max="180" value="${esc(sched.breakEveryMin??45)}"></label>
      <label class="field"><span>Snack length</span>
        <select id="brSnackLen">
          <option value="60">60s</option>
          <option value="180">3 min</option>
          <option value="300">5 min</option>
        </select>
      </label>
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn primary" id="btnGenBreak">Generate</button>
      <button class="btn" id="btnCopyBreak">Copy</button>
    </div>
    <div class="divider"></div>
    <div id="breakOut"></div>
    <div class="note small"><b>Rule of thumb:</b> if you sit a lot, a 60–180s movement snack every 30–60 minutes keeps joints moving and helps you stay ready to train.</div>
  `;

  const snackTemplates = ()=>{
    const eq = state.profile.equipment;
    const base = [
      { title:'Posture reset', items:['10–15 band pull-aparts (or scap squeezes)', '5–8 thoracic rotations/side', '6–10 scap push-ups'] },
      { title:'Hip + ankle', items:['6–10 bodyweight squats', '8–12 calf raises', '30–45s couch stretch/side'] },
      { title:'Core + breathing', items:['4–6 slow nasal breaths (long exhale)', '20–30s dead bug or plank', '8–10 glute bridges'] },
    ];
    if (eq.dumbbell) base.push({ title:'DB snack', items:['8–12 goblet squats', '8–12 one-arm rows/side', '10–15 lateral raises'] });
    if (eq.kettlebell) base.push({ title:'KB snack', items:['10–15 swings (easy)', '6–10 goblet squats', '20–40m carry'] });
    return base;
  };

  const buildSchedule = (startT, endT, everyMin)=>{
    const a = timeToMin(startT);
    const b = timeToMin(endT);
    if (a==null || b==null || b<=a) return [];
    const out=[];
    for (let t=a+everyMin; t<b; t+=everyMin){
      out.push(minToTime(t));
    }
    return out;
  };

  const renderOut = ()=>{
    const startT = $('#brWorkStart').value;
    const endT = $('#brWorkEnd').value;
    const everyMin = clamp(Number($('#brEvery').value)||45, 15, 240);
    const snackSec = Number($('#brSnackLen').value)||60;

    // persist interval to profile
    state.profile.schedule = { ...(state.profile.schedule||{}), workStart:startT, workEnd:endT, breakEveryMin:everyMin };
    saveState();

    const times = buildSchedule(startT, endT, everyMin);
    const snacks = snackTemplates();

    const timeList = times.length
      ? `<div class="note"><b>Suggested break times:</b> ${times.map(t=>`<span class="badge">${esc(t)}</span>`).join(' ')}</div>`
      : `<div class="note">Set a valid Work start/end to generate specific times.</div>`;

    const snackHint = snackSec<=60 ? 'Pick 1 template' : snackSec<=180 ? 'Pick 1–2 templates' : 'Pick 2 templates';

    const snackList = snacks.map(s=>`<div class="note"><b>${esc(s.title)}:</b> ${s.items.map(esc).join(' • ')}</div>`).join('');

    const betweenSets = state.profile.goal==='strength'
      ? '2–5 min on heavy compounds; 1–2 min on accessories.'
      : state.profile.goal==='hypertrophy'
        ? '60–120s on most sets; 2–3 min on big compounds if performance drops.'
        : '60–180s depending on effort.';

    $('#breakOut').innerHTML = `
      ${timeList}
      <div class="note"><b>Snack length:</b> ${snackSec}s • ${esc(snackHint)}</div>
      ${snackList}
      <div class="note"><b>Between-set rest:</b> ${esc(betweenSets)}</div>
    `;
  };

  $('#btnGenBreak').onclick = ()=>{ renderOut(); toast('Break plan generated.'); };
  $('#btnCopyBreak').onclick = ()=>{
    const txt = $('#breakOut')?.innerText || '';
    navigator.clipboard?.writeText(txt);
    toast('Copied.');
  };

  renderOut();
}

function renderConcurrentTool(){
  const el = $('#concurrentTool');
  if (!el) return;

  const c = state.profile.cardio || DEFAULT_STATE.profile.cardio;
  const goal = state.profile.goal;

  const riskScore = (()=>{
    let s=0;
    if (c.modality==='run') s+=2;
    if (c.modality==='hiit') s+=3;
    if ((c.daysPerWeek||0) >= 4) s+=2;
    if ((c.minutesPerSession||0) >= 30) s+=1;
    if (c.intensity==='hard') s+=2;
    if (goal==='strength') s+=1;
    return s;
  })();

  const risk = riskScore>=6 ? {k:'Higher', cls:'bad'} : riskScore>=3 ? {k:'Moderate', cls:'mid'} : {k:'Low', cls:'good'};

  const hasCardio = c.modality && c.modality !== 'none' && (c.daysPerWeek||0) > 0 && (c.minutesPerSession||0) > 0;

  const lowerDays = (()=>{
    if (!state.plan) return [];
    return state.plan.days.map((d,idx)=>{
      const pats = new Set(d.items.map(it=>exercisesById.get(it.exerciseId)?.pattern).filter(Boolean));
      const isLower = pats.has('squat') || pats.has('hinge') || pats.has('lunge');
      return { idx, name:d.name, isLower };
    });
  })();

  const layout = (()=>{
    if (!state.plan) return '';
    const lines = lowerDays.map(d=>{
      const tag = d.isLower ? 'Lower day' : 'Upper/other';
      return `<li><b>${esc(d.name)}:</b> ${esc(tag)} • cardio best ${d.isLower ? 'easy + short, or separate day' : 'OK to place after or separate by hours'}</li>`;
    }).join('');
    return `<div class="note"><b>Using your program split:</b><ul>${lines}</ul></div>`;
  })();

  const rules = hasCardio ? `
    <ul>
      <li><b>Best:</b> separate cardio and lifting by <b>6+ hours</b> when strength is priority.</li>
      <li>If same session: lift <b>first</b>, then cardio (keep cardio easy/moderate).</li>
      <li>Avoid hard intervals and hard running within <b>24h</b> of heavy squat/hinge days.</li>
      <li>For minimal interference, prefer <b>cycling/rowing</b> over running when chasing leg strength.</li>
    </ul>
  ` : `<div class="note">Cardio not configured. Set it in Profile if you want interference warnings.</div>`;

  el.innerHTML = `
    <div class="row">
      <div class="badge ${risk.cls}">${risk.k} interference risk</div>
      <div class="small">Based on modality + volume + intensity + strength priority.</div>
    </div>
    <div class="divider"></div>
    <div class="note"><b>Your cardio:</b> ${esc(c.modality)} • ${esc(c.daysPerWeek||0)} days/wk • ${esc(c.minutesPerSession||0)} min • ${esc(c.intensity||'easy')}</div>
    <div class="note">${rules}</div>
    ${layout}
  `;
}

function renderPrTestTool(){
  const el = $('#prTestTool');
  if (!el) return;

  const exIds = EXERCISES.map(e=>e.id);
  const lastLift = state.goals[0]?.exerciseId || exIds[0];

  const getBaseline = (exId)=>{
    let best=0, bestISO='';
    for (const s of state.log.sessions){
      for (const e of (s.exercises||[])){
        if (e.exerciseId!==exId) continue;
        const e1 = calcE1rmFromEntry(e);
        if (e1>best){ best=e1; bestISO=s.dateISO; }
      }
    }
    return { best, bestISO };
  };

  const defaultDate = addDaysISO(todayISO(), 7);

  el.innerHTML = `
    <div class="formGrid">
      <label class="field"><span>Lift</span>
        <select id="prLift">${EXERCISES.slice(0,400).map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select>
      </label>
      <label class="field"><span>Test date</span><input id="prDate" type="date" value="${esc(defaultDate)}"></label>
      <label class="field"><span>Attempt style</span>
        <select id="prStyle">
          <option value="conservative">Conservative</option>
          <option value="standard" selected>Standard</option>
          <option value="aggressive">Aggressive</option>
        </select>
      </label>
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn primary" id="btnGenPr">Generate</button>
      <button class="btn" id="btnCopyPr">Copy</button>
    </div>
    <div class="divider"></div>
    <div id="prOut"></div>
    <div class="note small"><b>Note:</b> This is planning guidance. If you’re new to true 1RMs, consider a 3–5RM test instead.</div>
  `;

  $('#prLift').value = lastLift;

  const renderOut = ()=>{
    const exId = $('#prLift').value;
    const ex = exercisesById.get(exId);
    const style = $('#prStyle').value;
    const { best, bestISO } = getBaseline(exId);
    const base = best>0 ? best : 100;

    const pct = (p)=>roundLoad(base*p);

    const taper = [
      { d:-6, title:'Technique + moderate work', sets:`3×3 @ ~80% (${pct(0.80)} ${state.settings.units})` },
      { d:-4, title:'Heavy but not grinding', sets:`3×2 @ ~85% (${pct(0.85)} ${state.settings.units})` },
      { d:-2, title:'Fast singles (stay fresh)', sets:`3×1 @ ~90% (${pct(0.90)} ${state.settings.units})` },
      { d:-1, title:'Rest / light mobility', sets:'Walk + easy movement, no fatigue.' },
    ];

    const attempt3 = style==='conservative' ? 1.02 : style==='aggressive' ? 1.06 : 1.04;
    const attempts = [
      { n:1, w:pct(0.95), note:'Smooth opener' },
      { n:2, w:pct(1.00), note:'Match baseline' },
      { n:3, w:pct(attempt3), note:'PR attempt (adjust based on attempt 2)' },
    ];

    const warmup = [
      { w:'bar / empty', r:'8–10' },
      { w:pct(0.40), r:'5' },
      { w:pct(0.55), r:'3' },
      { w:pct(0.70), r:'2' },
      { w:pct(0.80), r:'1' },
      { w:pct(0.87), r:'1' },
      { w:pct(0.92), r:'1 (optional)' },
    ];

    const taperHtml = taper.map(x=>`<li><b>${esc(addDaysISO($('#prDate').value, x.d))}:</b> ${esc(x.title)} — ${esc(x.sets)}</li>`).join('');
    const warmHtml = warmup.map(x=>`<li>${typeof x.w==='number' ? `${formatLoad(x.w)} ${state.settings.units}` : esc(x.w)} × ${esc(x.r)}</li>`).join('');
    const attHtml = attempts.map(a=>`<li><b>Attempt ${a.n}:</b> ${formatLoad(a.w)} ${state.settings.units} — ${esc(a.note)}</li>`).join('');

    $('#prOut').innerHTML = `
      <div class="note"><b>Baseline:</b> ${best>0 ? `${formatLoad(best)} ${state.settings.units} (best e1RM, ${esc(bestISO)})` : 'No log history for this lift yet — using a placeholder baseline.'}</div>
      <div class="note"><b>7-day taper template:</b><ul>${taperHtml}</ul></div>
      <div class="note"><b>Test day warm-up:</b><ul>${warmHtml}</ul></div>
      <div class="note"><b>Attempt selection:</b><ul>${attHtml}</ul></div>
      <div class="note small">Rest ~2–3 min on warmups; 4–6 min on attempts.</div>
    `;
  };

  $('#btnGenPr').onclick = ()=>{ renderOut(); toast('PR plan generated.'); };
  $('#btnCopyPr').onclick = ()=>{
    const txt = $('#prOut')?.innerText || '';
    navigator.clipboard?.writeText(txt);
    toast('Copied.');
  };

  renderOut();
}

function renderVolumeTool(){
  const el = $('#volumeTool');
  if (!el) return;
  const t = getRegionTargets();
  const s7 = computeEffectiveSetsByRegion(sessionsSince(7));
  const s14 = computeEffectiveSetsByRegion(sessionsSince(14));

  const rows = regions.map(r=>{
    const v7 = s7.get(r) || 0;
    const v14 = s14.get(r) || 0;
    const {lo,hi,mrv} = t[r];
    const status = v7 < lo ? {k:'Low', cls:'bad', msg:'Add 2–6 sets next week.'}
      : v7 <= hi ? {k:'In range', cls:'good', msg:'Keep steady.'}
      : v7 <= mrv ? {k:'High', cls:'mid', msg:'Watch recovery; consider small deload if soreness accumulates.'}
      : {k:'Over', cls:'bad', msg:'Reduce volume 20–40% and prioritize sleep/recovery.'};
    return `
      <tr>
        <td>${esc(r)}</td>
        <td>${v7.toFixed(1)}</td>
        <td>${v14.toFixed(1)}</td>
        <td>${lo}–${hi} (${mrv})</td>
        <td><span class="badge ${status.cls}">${esc(status.k)}</span></td>
        <td class="small">${esc(status.msg)}</td>
      </tr>
    `;
  }).join('');

  el.innerHTML = `
    <div class="note"><b>How to use:</b> Keep most regions in-range. If a region is low, add sets; if a region is high and performance is dropping, pull back.
      <span class="small">(Heuristic guidance; customize in Settings → Volume Landmarks.)</span>
    </div>
    <div class="divider"></div>
    <div style="overflow:auto">
      <table class="tbl">
        <thead><tr><th>Region</th><th>Sets 7d</th><th>Sets 14d</th><th>Target (MRV)</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

const PATTERN_ORDER = ['power','squat','hinge','lunge','push','pull','carry','core','isolation','prehab'];
const PATTERN_RANK = Object.fromEntries(PATTERN_ORDER.map((p,i)=>[p,i]));
const COMPOUND = new Set(['power','squat','hinge','lunge','push','pull','carry']);

function renderOrderTool(){
  const el = $('#orderTool');
  if (!el) return;

  if (!state.plan){
    el.innerHTML = `<div class="note">Generate a week in Program first. Then TYSON can check ordering and overlap.</div>`;
    return;
  }

  const dayOpts = state.plan.days.map((d,i)=>`<option value="${i}">${esc(d.name)}</option>`).join('');

  el.innerHTML = `
    <div class="formGrid">
      <label class="field"><span>Day</span><select id="ordDay">${dayOpts}</select></label>
      <label class="field"><span>Strategy</span>
        <select id="ordMode">
          <option value="compoundFirst" selected>Compounds first</option>
          <option value="strengthFirst">Strength skill first</option>
        </select>
      </label>
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn primary" id="btnAnalyze">Analyze</button>
      <button class="btn" id="btnApplyOrder">Apply suggested order</button>
    </div>
    <div class="divider"></div>
    <div id="ordOut"></div>
  `;

  const analyze = ()=>{
    const dayIdx = Number($('#ordDay').value)||0;
    const day = state.plan.days[dayIdx];
    const items = day.items.map((it, idx)=>{
      const ex = exercisesById.get(it.exerciseId);
      return { ...it, idx, ex, pattern: ex?.pattern||'unknown', prim: new Set(ex?.primary||[]), sec: new Set(ex?.secondary||[]) };
    });

    const suggestions = [...items].sort((a,b)=>{
      const ra = PATTERN_RANK[a.pattern] ?? 999;
      const rb = PATTERN_RANK[b.pattern] ?? 999;
      if (ra != rb) return ra - rb;
      return a.idx - b.idx;
    });

    const warnings = [];
    for (let i=0;i<items.length;i++){
      for (let j=i+1;j<items.length;j++){
        const A = items[i], B = items[j];
        const laterCompound = COMPOUND.has(B.pattern);
        const earlierIsolationish = (A.pattern==='isolation' || A.pattern==='prehab');
        if (!laterCompound || !earlierIsolationish) continue;
        let overlap = 0;
        for (const m of A.prim){ if (B.prim.has(m) || B.sec.has(m)) overlap++; }
        for (const m of A.sec){ if (B.prim.has(m)) overlap++; }
        if (overlap>=1){
          warnings.push(`Possible pre-fatigue: <b>${esc(A.ex?.name||'Exercise')}</b> before <b>${esc(B.ex?.name||'Exercise')}</b> (shared muscles). Consider doing the compound earlier.`);
        }
      }
    }

    const curList = items.map(x=>`<li>${esc(x.ex?.name||x.exerciseId)} <span class="small">(${esc(x.pattern)})</span></li>`).join('');
    const sugList = suggestions.map(x=>`<li>${esc(x.ex?.name||x.exerciseId)} <span class="small">(${esc(x.pattern)})</span></li>`).join('');

    const warnHtml = warnings.length
      ? `<div class="note"><b>Warnings:</b><ul>${warnings.map(w=>`<li>${w}</li>`).join('')}</ul></div>`
      : `<div class="note"><b>Warnings:</b> none detected.</div>`;

    $('#ordOut').innerHTML = `
      <div class="note"><b>Current order:</b><ul>${curList}</ul></div>
      <div class="note"><b>Suggested order:</b><ul>${sugList}</ul></div>
      ${warnHtml}
      <div class="note small"><b>Rule:</b> technique/strength compounds first; then volume work; isolation/prehab last.</div>
    `;

    return { dayIdx, suggestions };
  };

  $('#btnAnalyze').onclick = ()=>{ analyze(); toast('Analysis complete.'); };
  $('#btnApplyOrder').onclick = ()=>{
    const res = analyze();
    const dayIdx = res.dayIdx;
    state.plan.days[dayIdx].items = res.suggestions.map(x=>({
      exerciseId: x.exerciseId,
      sets: x.sets,
      reps: x.reps,
      rpeTarget: x.rpeTarget,
      notes: x.notes,
    }));
    saveState();
    toast('Order applied.');
    renderWeekPlan();
  };

  analyze();
}

function renderPrTool(){
  const el = $('#prTool');
  if (!el) return;
  ensurePRs();
  if (!Object.keys(state.prs.byExercise||{}).length && state.log.sessions.length){
    recomputePRs();
  }

  const opts = EXERCISES.slice(0,400).map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
  el.innerHTML = `
    <div class="formGrid">
      <label class="field"><span>Exercise</span><select id="prPick"><option value="">(all)</option>${opts}</select></label>
      <label class="field"><span>Actions</span>
        <div class="row">
          <button class="btn" id="btnRecalcPr">Recompute</button>
        </div>
      </label>
    </div>
    <div class="divider"></div>
    <div id="prPanelOut"></div>
  `;

  const render = ()=>{
    const pick = $('#prPick').value;
    const events = (state.prs.events||[]).filter(ev=>!pick || ev.exerciseId===pick).slice(-30).reverse();

    const by = state.prs.byExercise || {};
    const bestRows = Object.keys(by)
      .filter(k=>!pick || k===pick)
      .map(k=>({
        exId:k,
        name: exercisesById.get(k)?.name || k,
        bestE: by[k].bestE1rm||0,
        bestEISO: by[k].bestE1rmISO||'',
        bestW: by[k].bestWeight||0,
        bestWISO: by[k].bestWeightISO||'',
      }))
      .sort((a,b)=>b.bestE-a.bestE)
      .slice(0,20);

    const bestHtml = bestRows.length ? `
      <div class="note"><b>Best lifts:</b></div>
      <div style="overflow:auto">
        <table class="tbl">
          <thead><tr><th>Exercise</th><th>Best e1RM</th><th>Date</th><th>Heaviest</th><th>Date</th></tr></thead>
          <tbody>
            ${bestRows.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.bestE?`${formatLoad(r.bestE)} ${state.settings.units}`:'—'}</td><td>${esc(r.bestEISO)}</td><td>${r.bestW?`${formatLoad(r.bestW)} ${state.settings.units}`:'—'}</td><td>${esc(r.bestWISO)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : `<div class="note">No PRs yet. Log a few sessions and TYSON will compute your bests.</div>`;

    const eventHtml = events.length ? `
      <div class="divider"></div>
      <div class="note"><b>Recent PR events:</b><ul>${events.map(ev=>`<li><b>${esc(ev.dateISO)}:</b> ${esc(exercisesById.get(ev.exerciseId)?.name||ev.exerciseId)} — ${esc(ev.detail||'')}</li>`).join('')}</ul></div>
    ` : '';

    $('#prPanelOut').innerHTML = bestHtml + eventHtml;
  };

  $('#prPick').onchange = render;
  $('#btnRecalcPr').onclick = ()=>{ recomputePRs(); toast('PRs recomputed.'); render(); };

  render();
}

// ---------- Library ----------
function renderLibraryFilters(){
  const patSel = $('#fPattern');
  const musSel = $('#fMuscle');
  const eqSel = $('#fEquip');

  if (!patSel) return;

  patSel.innerHTML = `<option value="">(any)</option>` + PATTERNS.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
  musSel.innerHTML = `<option value="">(any)</option>` + allMuscles.slice(0,250).map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
  eqSel.innerHTML = `<option value="">(any)</option>` + EQUIP.map(e=>`<option value="${esc(e.key)}">${esc(e.name)}</option>`).join('');

  const reRender = ()=>renderLibraryList();
  $('#fQ').oninput = reRender;
  patSel.onchange = reRender;
  musSel.onchange = reRender;
  eqSel.onchange = reRender;
}

function exerciseCues(ex){
  // Lightweight cue cards by pattern. (Expandable over time.)
  const cuesByPattern = {
    squat: ['Brace hard before descending', 'Knees track over toes', 'Maintain midfoot pressure'],
    hinge: ['Hips back, shins mostly vertical', 'Keep lats tight', 'Push the floor away'],
    push: ['Stable shoulder blades', 'Control tempo', 'Drive evenly through full range'],
    pull: ['Lead with elbows', 'Pause and squeeze', 'Avoid shrugging / swinging'],
    lunge: ['Control knee position', 'Stay tall', 'Use full range you can own'],
    core: ['Exhale and brace', 'Control tempo', 'Stop before form breaks'],
    carry: ['Ribs down, tall posture', 'Short, quick steps', 'Grip tight and breathe'],
    power: ['Explode with intent', 'Reset between reps', 'Quality over fatigue'],
    prehab: ['Move slow and strict', 'Focus on joint position', 'Stop well before pain'],
    isolation: ['Feel the target muscle', 'Control stretch and squeeze', 'Avoid cheating reps'],
  };
  return cuesByPattern[ex.pattern] || ['Use controlled reps', 'Maintain full range you can own', 'Stop sets before form breaks'];
}

function commonMistakes(ex){
  const mistakesByPattern = {
    squat: ['Caving knees', 'Losing brace', 'Rising hips faster than chest'],
    hinge: ['Rounding back', 'Bar drifting forward', 'Jerking from the start'],
    push: ['Over-flaring', 'Bouncing', 'Losing stable shoulders'],
    pull: ['Using momentum', 'Shrugging', 'Half reps'],
    lunge: ['Knee collapsing inward', 'Too short of a stride', 'Rushing reps'],
    isolation: ['Swinging', 'Shortening range', 'Letting joints take over'],
    core: ['Holding breath too long', 'Rushing reps', 'Arching/rounding excessively'],
    carry: ['Leaning', 'Letting ribcage flare', 'Taking unstable steps'],
    prehab: ['Going too heavy', 'Rushing tempo', 'Pushing into pain'],
    power: ['Grinding reps', 'No reset between reps', 'Losing technique for load'],
  };
  return mistakesByPattern[ex.pattern] || ['Rushing reps', 'Excessive swinging', 'Ignoring pain signals'];
}

function renderExerciseDetail(exId){
  const ex = exercisesById.get(exId);
  const el = $('#exerciseDetail');
  if (!el) return;
  if (!ex){ el.innerHTML = `<div class="note">Select an exercise to see details.</div>`; return; }

  const prim = (ex.primary||[]).slice(0,8).map(id=>musclesById.get(id)?.name||id).join(', ');
  const sec = (ex.secondary||[]).slice(0,10).map(id=>musclesById.get(id)?.name||id).join(', ');
  const cues = exerciseCues(ex);
  const mistakes = commonMistakes(ex);

  el.innerHTML = `
    <div class="note"><b>${esc(ex.name)}</b><div class="small muted">pattern: ${esc(ex.pattern)} • equip: ${(ex.equip||[]).join(', ')}</div></div>
    ${ex.notes ? `<div class="small">${esc(ex.notes)}</div>` : ''}
    <div class="divider"></div>
    <div class="small"><b>Primary:</b> ${esc(prim||'—')}</div>
    <div class="small"><b>Secondary:</b> ${esc(sec||'—')}</div>
    <div class="divider"></div>
    <div class="small"><b>Top cues</b></div>
    <ul class="bullets">${cues.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
    <div class="small"><b>Common mistakes</b></div>
    <ul class="bullets">${mistakes.map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
  `;
}

function renderLibraryList(){
  const q = ($('#fQ')?.value||'').trim().toLowerCase();
  const pat = $('#fPattern')?.value || '';
  const mus = $('#fMuscle')?.value || '';
  const eq = $('#fEquip')?.value || '';

  const equipOn = Object.entries(state.profile.equipment).filter(([,v])=>v).map(([k])=>k);

  const list = EXERCISES.filter(ex=>{
    if (pat && ex.pattern!==pat) return false;
    if (eq && !(ex.equip||[]).includes(eq)) return false;
    if (!ex.equip?.some(e=>equipOn.includes(e))) return false;
    if (mus){
      const set = new Set([...(ex.primary||[]), ...(ex.secondary||[])]);
      if (!set.has(mus)) return false;
    }
    if (q){
      const blob = `${ex.name} ${(ex.notes||'')} ${ex.pattern} ${(ex.equip||[]).join(' ')} ${(ex.primary||[]).join(' ')} ${(ex.secondary||[]).join(' ')}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }).slice(0,80);

  $('#libraryBody').innerHTML = list.map(ex=>`
    <button class="libRow" data-ex="${esc(ex.id)}">
      <div class="row between">
        <div>
          <b>${esc(ex.name)}</b>
          <div class="small muted">${esc(ex.pattern)} • ${(ex.equip||[]).join(', ')}</div>
        </div>
        <div class="small muted">→</div>
      </div>
    </button>
  `).join('') || `<div class="note">No matches. Try clearing filters.</div>`;

  $$('[data-ex]').forEach(btn=>{
    btn.onclick = ()=>renderExerciseDetail(btn.dataset.ex);
  });

  // default detail
  if (list[0]) renderExerciseDetail(list[0].id);
}

// ---------- Insights view (diagnostics + load panel + deep charts) ----------
function renderDiagnostics(){
  const el = $('#diagnostics');
  if (!el) return;

  const liftId = bestLiftForTrend();
  const ex = exercisesById.get(liftId);
  const diag = plateauDiagnosis(liftId);

  el.innerHTML = `
    <div class="note"><b>${esc(ex?.name||'Goal lift')}:</b> ${esc(diag.title)}<div class="small">${esc(diag.detail)}</div></div>
    ${diag.actions?.length ? `<div class="note"><b>Action plan:</b><ul class="bullets">${diag.actions.map(a=>`<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    <div class="divider"></div>
    <div class="note"><b>Bottlenecks:</b><ul class="bullets">${bottleneckSummary().map(b=>`<li><b>${esc(b.k)}:</b> ${esc(b.d)}</li>`).join('')}</ul></div>
  `;
}

function renderLoadPanel(){
  const el = $('#loadPanel');
  if (!el) return;

  const weeks = weeklyLoadMetrics(state.log.sessions, 8);
  const total = weeks[weeks.length-1]?.weekLoad || 0;
  const mono = weeks[weeks.length-1]?.monotony || 0;
  const strain = weeks[weeks.length-1]?.strain || 0;

  const enough = total>0;
  el.innerHTML = `
    ${enough ? `
      <div class="note"><b>This week:</b> Load ${Math.round(total)} • Monotony ${mono.toFixed(2)} • Strain ${Math.round(strain)}</div>
      <canvas id="chartLoad" height="120"></canvas>
      <div class="small muted">Log <b>duration</b> + <b>session RPE</b> to compute load. Higher monotony means low variability across days.</div>
    ` : `
      <div class="note">Enable this by logging <b>Duration</b> and <b>Session RPE</b> when you save sessions.</div>
    `}
  `;

  if (enough){
    const ctx = $('#chartLoad');
    const labels = weeks.map(w=>w.weekStartISO);
    const data = weeks.map(w=>Math.round(w.weekLoad));
    if (chartLoad) chartLoad.destroy();
    chartLoad = new Chart(ctx, { type:'line', data:{labels, datasets:[{label:'Weekly load', data}]}, options:{ responsive:true, scales:{y:{beginAtZero:true}} }});
  }
}

function renderInsightsDeep(){
  const el = $('#insightsDeep');
  if (!el) return;

  const liftId = bestLiftForTrend();
  const liftOptions = EXERCISES.slice(0,200).map(ex=>`<option value="${esc(ex.id)}" ${ex.id===liftId?'selected':''}>${esc(ex.name)}</option>`).join('');

  const regionOptions = regions.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');

  el.innerHTML = `
    <div class="grid2">
      <div class="card miniCard">
        <div class="small"><b>Lift trend</b></div>
        <div class="row">
          <select id="deepLift">${liftOptions}</select>
        </div>
        <div class="divider"></div>
        <canvas id="chartLift" height="140"></canvas>
      </div>

      <div class="card miniCard">
        <div class="small"><b>Region volume</b></div>
        <div class="row">
          <select id="deepRegion">${regionOptions}</select>
          <select id="deepWindow">
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="28">28 days</option>
          </select>
        </div>
        <div class="divider"></div>
        <canvas id="chartRegion" height="140"></canvas>
      </div>
    </div>
  `;

  const renderLift = ()=>{
    const id = $('#deepLift').value;
    const pts = strengthSeries(id, 12);
    const labels = pts.map(p=>p.dateISO);
    const data = pts.map(p=>Math.round(p.e1rm));
    const ctx = $('#chartLift');
    if (chartLift) chartLift.destroy();
    chartLift = new Chart(ctx, { type:'line', data:{labels, datasets:[{label:'e1RM', data}]}, options:{ responsive:true }});
  };

  const renderRegion = ()=>{
    const region = $('#deepRegion').value;
    const win = Number($('#deepWindow').value)||7;
    const byRegion = computeEffectiveSetsByRegion(state.log.sessions, win);
    const targets = weeklySetTargets(state.profile.goal, state.profile.experience);
    const weights = priorityRegionWeights(state.profile.priority);
    const lo = targets.lo * (weights[region]||1);
    const hi = targets.hi * (weights[region]||1);
    const v = byRegion[region]||0;

    const ctx = $('#chartRegion');
    if (chartRegion) chartRegion.destroy();
    chartRegion = new Chart(ctx, {
      type:'bar',
      data:{
        labels:['Effective sets','Min target','Max target'],
        datasets:[{ label: region, data:[v, lo, hi]}]
      },
      options:{ responsive:true, scales:{y:{beginAtZero:true}} }
    });
  };

  $('#deepLift').onchange = renderLift;
  $('#deepRegion').onchange = renderRegion;
  $('#deepWindow').onchange = renderRegion;

  renderLift();
  renderRegion();
}

// ---------- Sources ----------
function renderSources(){
  const el = $('#sourcesBody');
  if (!el) return;
  el.innerHTML = `
    <div class="note">
      TYSON uses simple, transparent rules. This app is not medical advice — it’s a planning + learning tool.
    </div>

    <div class="divider"></div>

    <div class="note">
      <b>Exercise order (default):</b> prioritize multi-joint, large-muscle exercises before single-joint accessories to reduce pre-fatigue.
    </div>

    <div class="note">
      <b>Progression rule:</b> when you can perform 1–2 reps over the target at a given load, increase load about 2–10% next time.
      (ACSM progression models.)
    </div>

    <div class="note">
      <b>e1RM estimation:</b> Epley default (1RM = w·(1 + reps/30)); optional Brzycki and Lombardi methods.
    </div>

    <div class="note">
      <b>sRPE training load:</b> session load = session RPE × duration (minutes). Weekly monotony and strain are computed if you log duration + session RPE.
    </div>

    <div class="note">
      <b>Concurrent training:</b> when strength and endurance are combined, spacing and endurance modality can matter for minimizing interference.
    </div>

    <div class="divider"></div>

    <div class="small"><b>Links</b></div>
    <ul class="bullets">
      <li><a href="https://pubmed.ncbi.nlm.nih.gov/19204579/" target="_blank" rel="noreferrer">ACSM: Progression Models in Resistance Training for Healthy Adults (PubMed)</a></li>
      <li><a href="https://www.nsca.com/contentassets/61d813865e264c6e852cadfe247eae52/nsca_training_load_chart.pdf" target="_blank" rel="noreferrer">NSCA: Training Load Chart (%1RM vs reps)</a></li>
      <li><a href="https://pubmed.ncbi.nlm.nih.gov/22002517/" target="_blank" rel="noreferrer">Wilson et al. (2012): Concurrent training meta-analysis (PubMed)</a></li>
      <li><a href="https://link.springer.com/article/10.1007/s40279-023-01943-9" target="_blank" rel="noreferrer">Huiberts et al. (2024): Concurrent strength + endurance training systematic review</a></li>
      <li><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC4961270/" target="_blank" rel="noreferrer">Helms et al. (2016): RIR-based RPE scale (full text)</a></li>
      <li><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5673663/" target="_blank" rel="noreferrer">Haddad et al. (2017): Session-RPE training load monitoring (full text)</a></li>
      <li><a href="https://www.calculator.net/one-rep-max-calculator.html" target="_blank" rel="noreferrer">1RM formula references (Epley/Brzycki/Lombardi)</a></li>
      <li><a href="https://www.vcalc.com/wiki/epley-formula-1-rep-max" target="_blank" rel="noreferrer">Epley formula summary</a></li>
    </ul>
  `;
}

// ---------- Settings + Data ----------
function renderSettings(){
  const el = $('#settingsBody');
  if (!el) return;

  el.innerHTML = `
    <div class="formGrid">
      <label class="field">
        <span>Units</span>
        <select id="setUnits">
          <option value="lb">lb</option>
          <option value="kg">kg</option>
        </select>
      </label>
      <label class="field">
        <span>Rounding step</span>
        <input id="setRound" type="number" min="0.5" step="0.5" value="${esc(state.settings.roundTo)}"/>
      </label>
      <label class="field">
        <span>e1RM method</span>
        <select id="setE1rm">
          <option value="epley">Epley</option>
          <option value="brzycki">Brzycki</option>
          <option value="lombardi">Lombardi</option>
        </select>
      </label>
      <label class="field">
        <span>Default rest (sec)</span>
        <input id="setRest" type="number" min="10" max="900" step="5" value="${esc(state.settings.defaultRestSec)}"/>
      </label>
      <label class="field">
        <span>Bar weight (for plate calc)</span>
        <input id="setBar" type="number" min="0" step="0.5" value="${esc(state.settings.barWeight)}"/>
      </label>
    </div>
    <div class="divider"></div>
    <div class="row">
      <button class="btn primary" id="btnSaveSettings">Save settings</button>
    </div>
  `;

  $('#setUnits').value = state.settings.units;
  $('#setE1rm').value = state.settings.e1rmMethod;

  $('#btnSaveSettings').onclick = ()=>{
    state.settings.units = $('#setUnits').value;
    state.settings.roundTo = Number($('#setRound').value)||2.5;
    state.settings.e1rmMethod = $('#setE1rm').value;
    state.settings.defaultRestSec = Number($('#setRest').value)||120;
    state.settings.barWeight = Number($('#setBar').value)||state.settings.barWeight;
    saveState();
    toast('Settings saved.');
    renderAll();
  };
}

function wireDataButtons(){
  $('#btnExport').onclick = ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tyson-export-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  $('#fileImport').onchange = async (e)=>{
    const f = e.target.files?.[0];
    if (!f) return;
    const txt = await f.text();
    const s = safeParse(txt, null);
    if (!s){ toast('Invalid JSON.'); return; }

    // Merge cautiously
    const merged = loadState();
    if (s.profile) merged.profile = { ...merged.profile, ...s.profile, equipment:{...merged.profile.equipment, ...(s.profile.equipment||{})} };
    if (s.settings) merged.settings = { ...merged.settings, ...s.settings, plates:{...merged.settings.plates, ...(s.settings.plates||{})} };
    if (Array.isArray(s.goals)) merged.goals = s.goals;
    if (s.plan) merged.plan = s.plan;
    if (Array.isArray(s.log?.sessions)) merged.log.sessions = s.log.sessions;
    if (Array.isArray(s.checkins)) merged.checkins = s.checkins;

    state = merged;
    saveState();
    toast('Imported.');
    renderAll();
  };

  $('#btnReset').onclick = ()=>{
    if (!confirm('Reset ALL TYSON data?')) return;
    state = structuredClone(DEFAULT_STATE);
    saveState();
    toast('Reset complete.');
    renderAll();
  };
}

// ---------- Render orchestration ----------
function renderAll(){
  // dashboard
  renderEquipmentChips();
  renderStartHere();
  renderProfileForm();
  renderReadiness();
  renderWeeklySummary();
  renderWeekPlan();
  renderQuickInsights();
  renderChartVolume();
  renderChartStrength();

  // goals
  renderGoalWizard();
  renderGoalList();

  // program
  renderProgramBuilder();
  renderPluginPicker();

  // log
  ensureDateInput();
  renderLogExerciseOptions();
  wireLogForm();
  renderLogList();

  // insights
  renderDiagnostics();
  renderLoadPanel();
  renderInsightsDeep();

  // muscles
  renderMuscleCoverage();

  // tools
  renderWarmupTool();
  renderPlateTool();
  renderSwapTool();
  renderTimerTool();
  renderBreakTool();
  renderConcurrentTool();
  renderPrTestTool();
  renderVolumeTool();
  renderOrderTool();
  renderPrTool();

  // library
  renderLibraryFilters();
  renderLibraryList();

  // sources + settings
  renderSources();
  renderSettings();
  wireDataButtons();
}

// ---------- Boot ----------
function boot(){
  renderTabs();
  // Restore view
  const v = state._view || 'dashboard';
  setView(v);
  renderAll();
}

boot();
