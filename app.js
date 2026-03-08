/* ========================================================
   WorkoutLock — App Logic
   ======================================================== */

'use strict';

// ── State ─────────────────────────────────────────────────
let state = {
  days: [],          // { id, name, weekday, exercises: [] }
  prs: {},           // { exerciseName: { weight, reps, date, dayName } }
  editingDayId: null,
  addingExerciseDayId: null,
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

  return `
  <div class="day-card" data-day-id="${day.id}">
    <div class="day-card-header">
      <div class="day-card-title-group">
        <div class="day-weekday">${escHtml(day.weekday || '')}</div>
        <div class="day-name">${escHtml(day.name)}</div>
      </div>
      <div class="day-card-actions">
        <button class="icon-btn" data-action="edit-day" data-day-id="${day.id}" title="Edit Day">&#9998;</button>
        <button class="icon-btn danger" data-action="delete-day" data-day-id="${day.id}" title="Delete Day">&#10005;</button>
      </div>
    </div>

    <div class="exercise-list" data-day-id="${day.id}">
      ${exercisesHTML || '<p style="font-size:0.75rem;color:#7a6248;padding:0.5rem 0;font-style:italic;">No exercises yet.</p>'}
    </div>

    <div class="day-card-footer">
      <span class="day-progress-text">
        ${totalSets > 0 ? `${completedSets}/${totalSets} sets &mdash; ${pct}%` : 'No sets logged'}
      </span>
      <div style="display:flex;gap:0.4rem;align-items:center;">
        ${totalSets > 0 ? `<button class="btn-reset" data-action="reset-day" data-day-id="${day.id}">reset</button>` : ''}
        <button class="btn-add-exercise" data-action="add-exercise" data-day-id="${day.id}">+ Add Exercise</button>
      </div>
    </div>
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
      <button class="icon-btn danger" data-action="delete-exercise"
        data-day-id="${dayId}" data-ex-id="${ex.id}" title="Remove">&#10005;</button>
    </div>
    <div class="exercise-meta">${totalSets} set${totalSets !== 1 ? 's' : ''} &bull; target ${ex.targetReps} reps &bull; ${ex.targetWeight > 0 ? ex.targetWeight + ' lbs' : 'BW'}</div>
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

// ── Day CRUD ──────────────────────────────────────────────
document.getElementById('add-day-btn').addEventListener('click', () => {
  state.editingDayId = null;
  document.getElementById('modal-day-title').textContent = 'New Training Day';
  document.getElementById('day-label-input').value = '';
  document.getElementById('day-week-input').value  = '';
  openModal('modal-day');
  setTimeout(() => document.getElementById('day-label-input').focus(), 50);
});

document.getElementById('save-day-btn').addEventListener('click', () => {
  const name    = document.getElementById('day-label-input').value.trim();
  const weekday = document.getElementById('day-week-input').value;
  if (!name) { document.getElementById('day-label-input').focus(); return; }

  if (state.editingDayId) {
    const day = state.days.find(d => d.id === state.editingDayId);
    if (day) { day.name = name; day.weekday = weekday; }
  } else {
    state.days.push({ id: uid(), name, weekday, exercises: [] });
  }

  save();
  renderDays();
  closeModal('modal-day');
});

// ── Exercise CRUD ─────────────────────────────────────────
document.getElementById('save-exercise-btn').addEventListener('click', () => {
  const name   = document.getElementById('exercise-name-input').value.trim();
  const sets   = parseInt(document.getElementById('exercise-sets-input').value) || 3;
  const reps   = parseInt(document.getElementById('exercise-reps-input').value) || 10;
  const weight = parseFloat(document.getElementById('exercise-weight-input').value) || 0;

  if (!name) { document.getElementById('exercise-name-input').focus(); return; }

  const day = state.days.find(d => d.id === state.addingExerciseDayId);
  if (!day) return;

  const setArr = Array.from({ length: sets }, () => ({
    weight,
    reps,
    completed: false,
  }));

  day.exercises.push({
    id: uid(),
    name,
    targetReps: reps,
    targetWeight: weight,
    sets: setArr,
  });

  save();
  renderDays();
  closeModal('modal-exercise');
});

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

  // Auto-mark as completed when a set is logged
  ex.sets[setIndex].completed = true;

  checkPR(ex.name, weight, reps, day.name);

  save();
  renderDays();
  closeModal('modal-logset');
});

// ── Event Delegation for Day Cards ────────────────────────
function attachDayListeners() {
  const grid = document.getElementById('days-grid');

  // Remove old listener to avoid duplicates
  grid.replaceWith(grid.cloneNode(true));
  const newGrid = document.getElementById('days-grid');

  newGrid.addEventListener('click', handleDayGridClick);
  newGrid.addEventListener('change', handleDayGridChange);
}

function handleDayGridClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, dayId, exId, setIdx } = btn.dataset;

  if (action === 'edit-day') {
    const day = state.days.find(d => d.id === dayId);
    if (!day) return;
    state.editingDayId = dayId;
    document.getElementById('modal-day-title').textContent = 'Edit Training Day';
    document.getElementById('day-label-input').value = day.name;
    document.getElementById('day-week-input').value  = day.weekday || '';
    openModal('modal-day');

  } else if (action === 'delete-day') {
    if (!confirm(`Delete "${state.days.find(d => d.id === dayId)?.name}"? This can't be undone.`)) return;
    state.days = state.days.filter(d => d.id !== dayId);
    save();
    renderDays();

  } else if (action === 'add-exercise') {
    state.addingExerciseDayId = dayId;
    document.getElementById('exercise-name-input').value   = '';
    document.getElementById('exercise-sets-input').value   = '3';
    document.getElementById('exercise-reps-input').value   = '10';
    document.getElementById('exercise-weight-input').value = '0';
    openModal('modal-exercise');
    setTimeout(() => document.getElementById('exercise-name-input').focus(), 50);

  } else if (action === 'delete-exercise') {
    const day = state.days.find(d => d.id === dayId);
    if (!day) return;
    const ex = day.exercises.find(e => e.id === exId);
    if (!ex || !confirm(`Remove "${ex.name}" from this day?`)) return;
    day.exercises = day.exercises.filter(e => e.id !== exId);
    save();
    renderDays();

  } else if (action === 'log-set') {
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

  } else if (action === 'toggle-exercise') {
    // Handled in change event
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
  document.getElementById('day-label-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('save-day-btn').click();
  });
  document.getElementById('exercise-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('save-exercise-btn').click();
  });
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
