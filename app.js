/* ========================================================
   WorkoutLock — App Logic
   ======================================================== */

'use strict';

// ── Program Definition ────────────────────────────────────
// reps: target rep range string (e.g. "6-8"); sets: number of sets
const PROGRAM = [
  {
    name: 'Chest',
    weekday: 'Monday',
    exercises: [
      { name: 'Incline Barbell Press',         sets: 4, reps: '6-8'   },
      { name: 'Flat Dumbbell Press',            sets: 3, reps: '8-10'  },
      { name: 'Cable Crossovers (High to Low)', sets: 3, reps: '12-15' },
      { name: 'Dips (Chest Variation)',         sets: 3, reps: '8-12'  },
    ],
  },
  {
    name: 'Back',
    weekday: 'Tuesday',
    exercises: [
      { name: 'Weighted Pull-ups (Wide Grip)',       sets: 4, reps: '6-10'  },
      { name: 'Heavy Barbell Rows (Underhand Grip)', sets: 3, reps: '6-8'   },
      { name: 'Lat Pulldowns (Close Neutral Grip)',  sets: 3, reps: '10-12' },
      { name: 'Cable Rows (Wide Grip)',              sets: 3, reps: '12-15' },
    ],
  },
  {
    name: 'Legs',
    weekday: 'Wednesday',
    exercises: [
      { name: 'Barbell Back Squats',  sets: 4, reps: '6-10'  },
      { name: 'Romanian Deadlifts',   sets: 3, reps: '8-12'  },
      { name: 'Leg Press',            sets: 3, reps: '10-15' },
      { name: 'Leg Extensions',       sets: 3, reps: '12-20' },
      { name: 'Leg Curls',            sets: 3, reps: '12-20' },
      { name: 'Standing Calf Raises', sets: 4, reps: '12-20' },
    ],
  },
  {
    name: 'Rest',
    weekday: 'Thursday',
    exercises: [],
  },
  {
    name: 'Shoulders',
    weekday: 'Friday',
    exercises: [
      { name: 'Seated Dumbbell Shoulder Press',         sets: 3, reps: '6-10'  },
      { name: 'Cross-Body Cable Y-Raises (Side Delts)', sets: 4, reps: '10-15' },
      { name: 'Super-ROM Dumbbell Lateral Raises',      sets: 3, reps: '20'    },
      { name: 'Reverse Pec Deck (Rear Delts)',          sets: 3, reps: '10-15' },
    ],
  },
  {
    name: 'Triceps',
    weekday: 'Saturday',
    exercises: [
      { name: 'EZ Bar Overhead Tricep Extensions',             sets: 4, reps: '10-15' },
      { name: 'Barbell Skull Crushers',                        sets: 3, reps: '8-12'  },
      { name: 'Cable Pushdowns (Rope Attachment)',              sets: 3, reps: '10-15' },
      { name: 'Overhead Cable Tricep Extensions (Single Arm)', sets: 2, reps: '12-20' },
    ],
  },
  {
    name: 'Biceps',
    weekday: 'Sunday',
    exercises: [
      { name: 'Bayesian Cable Curls',         sets: 4, reps: '10-15' },
      { name: 'Machine Preacher Curls',       sets: 3, reps: '8-12'  },
      { name: 'Heavy Barbell / EZ-Bar Curls', sets: 3, reps: '6-10'  },
      { name: 'Incline Dumbbell Curls',       sets: 3, reps: '10-15' },
    ],
  },
];

// ── State ─────────────────────────────────────────────────
let state = {
  days: [],
  prs: {},
  loggingSet: null,  // { dayId, exerciseId, setIndex }
};

// ── Persistence ───────────────────────────────────────────
function save() {
  localStorage.setItem('wl_state', JSON.stringify({ days: state.days, prs: state.prs }));
}

function load() {
  try {
    const raw = localStorage.getItem('wl_state');
    if (raw) {
      const parsed = JSON.parse(raw);
      state.days = parsed.days || [];
      state.prs  = parsed.prs  || {};
    }
  } catch (e) { /* ignore corrupt data */ }

  // First-time load: seed with the hard-coded program
  if (state.days.length === 0) {
    state.days = PROGRAM.map(day => ({
      id: uid(),
      name: day.name,
      weekday: day.weekday,
      exercises: day.exercises.map(def => ({
        id: uid(),
        name: def.name,
        targetReps: def.reps,
        targetWeight: 0,
        sets: Array.from({ length: def.sets }, () => ({
          weight: 0,
          reps: parseInt(def.reps),   // lower bound of range as starting default
          completed: false,
        })),
      })),
    }));
    save();
  }
}

// ── ID Generator ──────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── PR Logic ──────────────────────────────────────────────
function checkPR(exerciseName, weight, reps, dayName) {
  const key = exerciseName.toLowerCase();
  const existing = state.prs[key];
  const isNewPR = !existing || weight > existing.weight ||
    (weight === existing.weight && reps > existing.reps);

  if (isNewPR && (weight > 0 || reps > 0)) {
    state.prs[key] = {
      exercise: exerciseName,
      weight,
      reps,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      dayName,
      isNew: true,
    };
    save();
    showPRToast(exerciseName, weight, reps);
    return true;
  }
  return false;
}

// ── Toast ─────────────────────────────────────────────────
let toastTimer;
function showPRToast(name, weight, reps) {
  const toast = document.getElementById('pr-toast');
  document.getElementById('pr-toast-msg').textContent =
    `NEW PR — ${name}: ${weight} lbs × ${reps}`;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── Render: Days Grid ─────────────────────────────────────
function renderDays() {
  const grid  = document.getElementById('days-grid');
  const empty = document.getElementById('split-empty');

  if (state.days.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = state.days.map(day => renderDayCard(day)).join('');
  attachDayListeners();
}

function renderDayCard(day) {
  const totalSets     = day.exercises.reduce((s, e) => s + e.sets.length, 0);
  const completedSets = day.exercises.reduce(
    (s, e) => s + e.sets.filter(st => st.completed).length, 0
  );
  const pct = totalSets ? Math.round((completedSets / totalSets) * 100) : 0;

  const exercisesHTML = day.exercises.map(ex => renderExerciseItem(day.id, ex)).join('');

  const isRest = day.exercises.length === 0;

  return `
  <div class="day-card" data-day-id="${day.id}">
    <div class="day-card-header">
      <div class="day-card-title-group">
        <div class="day-weekday">${escHtml(day.weekday || '')}</div>
        <div class="day-name">${escHtml(day.name)}</div>
      </div>
    </div>

    <div class="exercise-list" data-day-id="${day.id}">
      ${isRest
        ? '<p style="font-size:0.85rem;color:#7a6248;padding:1rem 0;font-style:italic;text-align:center;">Active recovery &mdash; light cardio, mobility, or full rest.</p>'
        : exercisesHTML}
    </div>

    ${!isRest ? `
    <div class="day-card-footer">
      <span class="day-progress-text">
        ${totalSets > 0 ? `${completedSets}/${totalSets} sets &mdash; ${pct}%` : 'No sets logged'}
      </span>
      <div style="display:flex;gap:0.4rem;align-items:center;">
        ${totalSets > 0 ? `<button class="btn-reset" data-action="reset-day" data-day-id="${day.id}">reset</button>` : ''}
      </div>
    </div>` : ''}
  </div>`;
}

function renderExerciseItem(dayId, ex) {
  const completedSets = ex.sets.filter(s => s.completed).length;
  const totalSets     = ex.sets.length;
  const pct           = totalSets ? (completedSets / totalSets) * 100 : 0;
  const allDone       = totalSets > 0 && completedSets === totalSets;
  const prKey         = ex.name.toLowerCase();
  const pr            = state.prs[prKey];

  const setsHTML = ex.sets.map((set, i) => `
    <div class="set-row">
      <span class="set-num">S${i + 1}</span>
      <span class="set-data">
        <span class="weight">${set.weight > 0 ? set.weight + ' lbs' : 'BW'}</span>
        <span class="reps"> &times; ${set.reps}</span>
      </span>
      <button class="btn-log-set"
        data-action="log-set"
        data-day-id="${dayId}"
        data-ex-id="${ex.id}"
        data-set-idx="${i}">Edit</button>
      <input type="checkbox" class="set-check"
        data-action="toggle-set"
        data-day-id="${dayId}"
        data-ex-id="${ex.id}"
        data-set-idx="${i}"
        ${set.completed ? 'checked' : ''} />
    </div>`).join('');

  return `
  <div class="exercise-item${allDone ? ' done' : ''}" data-ex-id="${ex.id}">
    <div class="exercise-header">
      <input type="checkbox" class="exercise-check"
        data-action="toggle-exercise"
        data-day-id="${dayId}"
        data-ex-id="${ex.id}"
        ${allDone ? 'checked' : ''} />
      <span class="exercise-name">${escHtml(ex.name)}</span>
      ${pr ? `<span class="exercise-pr-badge" title="PR: ${pr.weight}lbs × ${pr.reps}">PR</span>` : ''}
    </div>
    <div class="exercise-meta">${totalSets} set${totalSets !== 1 ? 's' : ''} &bull; ${escHtml(String(ex.targetReps))} reps &bull; ${ex.targetWeight > 0 ? ex.targetWeight + ' lbs' : 'BW'}</div>
    <div class="set-list">${setsHTML}</div>
    <div class="exercise-progress">
      <div class="exercise-progress-fill" style="width:${pct}%"></div>
    </div>
  </div>`;
}

// ── Render: PR Board ──────────────────────────────────────
function renderPRs() {
  const board = document.getElementById('pr-board');
  const empty = document.getElementById('pr-empty');
  const entries = Object.values(state.prs);

  if (entries.length === 0) {
    board.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  entries.sort((a, b) => a.exercise.localeCompare(b.exercise));

  board.innerHTML = `
    <div class="pr-board-header">
      <span>Exercise</span>
      <span>Weight</span>
      <span>Reps</span>
      <span>Date</span>
    </div>` +
    entries.map(pr => `
    <div class="pr-row">
      <div>
        <div class="pr-exercise">${escHtml(pr.exercise)}${pr.isNew ? '<span class="pr-new-badge">NEW</span>' : ''}</div>
        <div class="pr-day">${escHtml(pr.dayName || '')}</div>
      </div>
      <div class="pr-value"><span class="w">${pr.weight > 0 ? pr.weight + ' lbs' : 'BW'}</span></div>
      <div class="pr-value"><span class="r">${pr.reps} reps</span></div>
      <div class="pr-date">${pr.date}</div>
    </div>`).join('');
}

// ── Navigation ────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${view}`).classList.add('active');
      if (view === 'prs') renderPRs();
    });
  });
}

// ── Modal Helpers ─────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function setupModalClose() {
  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => closeModal(el.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
}

// ── Log Set ───────────────────────────────────────────────
document.getElementById('save-logset-btn').addEventListener('click', () => {
  if (!state.loggingSet) return;
  const { dayId, exerciseId, setIndex } = state.loggingSet;

  const weight = parseFloat(document.getElementById('logset-weight').value) || 0;
  const reps   = parseInt(document.getElementById('logset-reps').value) || 0;

  const day = state.days.find(d => d.id === dayId);
  if (!day) return;
  const ex = day.exercises.find(e => e.id === exerciseId);
  if (!ex) return;

  ex.sets[setIndex].weight = weight;
  ex.sets[setIndex].reps   = reps;
  ex.sets[setIndex].completed = true;

  checkPR(ex.name, weight, reps, day.name);

  save();
  renderDays();
  closeModal('modal-logset');
});

// ── Event Delegation for Day Cards ────────────────────────
function attachDayListeners() {
  const grid = document.getElementById('days-grid');

  grid.replaceWith(grid.cloneNode(true));
  const newGrid = document.getElementById('days-grid');

  newGrid.addEventListener('click', handleDayGridClick);
  newGrid.addEventListener('change', handleDayGridChange);
}

function handleDayGridClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, dayId, exId, setIdx } = btn.dataset;

  if (action === 'log-set') {
    const day = state.days.find(d => d.id === dayId);
    if (!day) return;
    const ex  = day.exercises.find(e => e.id === exId);
    if (!ex) return;
    const idx = parseInt(setIdx);
    const set = ex.sets[idx];

    state.loggingSet = { dayId, exerciseId: exId, setIndex: idx };
    document.getElementById('logset-title').textContent = `Log Set — ${ex.name}`;
    document.getElementById('logset-weight').value = set.weight;
    document.getElementById('logset-reps').value   = set.reps;
    openModal('modal-logset');
    setTimeout(() => document.getElementById('logset-weight').focus(), 50);

  } else if (action === 'reset-day') {
    const day = state.days.find(d => d.id === dayId);
    if (!day || !confirm(`Reset all sets for "${day.name}"?`)) return;
    day.exercises.forEach(ex => ex.sets.forEach(s => s.completed = false));
    save();
    renderDays();
  }
}

function handleDayGridChange(e) {
  const el = e.target;
  if (!el.dataset.action) return;
  const { action, dayId, exId, setIdx } = el.dataset;

  if (action === 'toggle-set') {
    const day = state.days.find(d => d.id === dayId);
    if (!day) return;
    const ex = day.exercises.find(e => e.id === exId);
    if (!ex) return;
    ex.sets[parseInt(setIdx)].completed = el.checked;
    save();
    renderDays();

  } else if (action === 'toggle-exercise') {
    const day = state.days.find(d => d.id === dayId);
    if (!day) return;
    const ex = day.exercises.find(e => e.id === exId);
    if (!ex) return;
    ex.sets.forEach(s => s.completed = el.checked);
    save();
    renderDays();
  }
}

// ── Enter key support in modals ───────────────────────────
function setupEnterKeys() {
  document.getElementById('logset-reps').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('save-logset-btn').click();
  });
}

// ── Utility ───────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────
(function init() {
  load();
  setupNav();
  setupModalClose();
  setupEnterKeys();
  renderDays();
})();
