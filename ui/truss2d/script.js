// ── Error banner (diagnostic) ─────────────────────────────────────────────
function showError(msg, source, lineno, colno, error) {
  var banner = document.getElementById('errorBanner');
  var text   = document.getElementById('errorBannerText');
  if (!banner || !text) return;
  var shortSource = '';
  if (source) {
    var parts = String(source).split('/');
    shortSource = ' (' + parts[parts.length - 1] + ':' + (lineno || '?') + ':' + (colno || '?') + ')';
  }
  var stack = '';
  if (error && error.stack) {
    stack = '\n' + String(error.stack).split('\n').slice(0, 3).join('\n');
  }
  text.textContent = String(msg) + shortSource + stack;
  banner.style.display = 'block';
}

window.addEventListener('error', function (e) {
  showError(e.message, e.filename, e.lineno, e.colno, e.error);
});
window.addEventListener('unhandledrejection', function (e) {
  var reasonMsg = 'Unhandled promise rejection: ';
  if (e.reason && e.reason.message) {
    reasonMsg += e.reason.message;
  } else {
    reasonMsg += String(e.reason);
  }
  showError(reasonMsg, '', 0, 0, e.reason);
});

document.addEventListener('DOMContentLoaded', function () {
  var closeBtn = document.getElementById('errorBannerClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      var banner = document.getElementById('errorBanner');
      if (banner) banner.style.display = 'none';
    });
  }
});

// ── Theme bootstrap ───────────────────────────────────────────────────────
(function initTheme() {
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    const ico = document.getElementById('themeToggleIcon');
    const lbl = document.getElementById('themeToggleLabel');
    if (ico) ico.textContent = (t === 'dark') ? '☀' : '☾';
    if (lbl) lbl.textContent = (t === 'dark') ? 'Light' : 'Dark';
  }
  let saved = null;
  try { saved = localStorage.getItem('truss2d_theme'); } catch (_) {}
  const prefersDark = window.matchMedia &&
                      window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(initial);

  document.addEventListener('DOMContentLoaded', function () {
    const tog = document.getElementById('themeToggle');
    if (!tog) return;
    applyTheme(document.documentElement.dataset.theme || initial);
    tog.addEventListener('click', function () {
      const next = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('truss2d_theme', next); } catch (_) {}
    });
  });
})();

const API_URL = ''; // relative — UI is served from the same FastAPI process

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// ── HiDPI (Retina) canvas scaling ────────────────────────────────────────
const dpr = window.devicePixelRatio || 1;
let LOGICAL_W, LOGICAL_H;
function setupHiDPI() {
  const rect = canvas.getBoundingClientRect();
  LOGICAL_W = rect.width;
  LOGICAL_H = rect.height;
  canvas.width  = Math.round(LOGICAL_W * dpr);
  canvas.height = Math.round(LOGICAL_H * dpr);
}
setupHiDPI();

// ── CSS variable bridge ───────────────────────────────────────────────────
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const GRID   = 20;   // pixels per grid cell
const UNIT   = 1;    // 1 grid cell = 1 metre

const BASE_LABEL_SIZE = 10;
const LABEL_FONT_FAMILY = 'Inter, system-ui, sans-serif';
const MONO_FONT_FAMILY = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

let _lastBlobUrl = null;

// ── View transform ─────────────────────────────────────────────────────────
let view = { scale: 1, tx: 0, ty: 0 };
let isPanning = false, panStartX = 0, panStartY = 0, panStartTx = 0, panStartTy = 0;
const CLICK_DRAG_PX = 3;            // mirrors the 260523-i52 <summary> click-vs-drag threshold
let clickDownX = null, clickDownY = null;
let offendingNodes = [];   // 0-based node ids flagged by the pre-solve rogue scan

function toWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * (LOGICAL_W / rect.width);
  const py = (clientY - rect.top)  * (LOGICAL_H / rect.height);
  return { x: (px - view.tx) / view.scale, y: (py - view.ty) / view.scale };
}

function resetView() {
  if (nodes.length === 0 || !origin) { view = { scale: 1, tx: 0, ty: 0 }; draw(); return; }
  var rMinX = Infinity, rMinY = Infinity, rMaxX = -Infinity, rMaxY = -Infinity;
  for (var i = 0; i < nodes.length; i++) {
    var rx = nodes[i].realX, ry = nodes[i].realY;
    if (rx < rMinX) rMinX = rx;
    if (ry < rMinY) rMinY = ry;
    if (rx > rMaxX) rMaxX = rx;
    if (ry > rMaxY) rMaxY = ry;
  }
  var rw = (rMaxX - rMinX) || 1;
  var rh = (rMaxY - rMinY) || 1;
  var margin = 0.20;
  rMinX -= rw * margin; rMaxX += rw * margin;
  rMinY -= rh * margin; rMaxY += rh * margin;
  rw = rMaxX - rMinX;
  rh = rMaxY - rMinY;
  var pw = rw / UNIT * GRID;
  var ph = rh / UNIT * GRID;
  var sx = LOGICAL_W / pw;
  var sy = LOGICAL_H / ph;
  view.scale = Math.min(sx, sy);
  var cx = origin.x + (rMinX + rw / 2) / UNIT * GRID;
  var cy = origin.y - (rMinY + rh / 2) / UNIT * GRID;
  view.tx = LOGICAL_W / 2 - cx * view.scale;
  view.ty = LOGICAL_H / 2 - cy * view.scale;
  draw();
}

// ── Symbol & label scale helpers ──────────────────────────────────────────
let labelScale = 1.0;
function getSymbolScale() {
  return parseFloat(document.getElementById('inputSymbolScale').value) || 1.0;
}

// ── State ─────────────────────────────────────────────────────────────────
let mode   = 'node';
let origin = null;           // canvas pixel of real-world (0,0)
let currentMemberStart = null;
let selectedMembers = new Set();  // member indices selected for batch Member-A

let nodes    = [];
let members  = [];
let supports = [];
let loads    = [];

// ── Load-case model (Phase 999.2 Wave 3) ────────────────────────────────────
// A load case is a named, nature-tagged container of loads (D-01). Loads carry a
// `caseId` tagging them to a case; factors NEVER live on loads or cases (only on
// combinations, a later wave). The model ALWAYS has a default active "Dead" case
// (D-03) so the quick-solve path is never bottlenecked — a user can drop a load
// and SOLVE without ever opening the Load-Case panel.
//
// Natures are code-agnostic PHYSICAL types (D-02): Self weight, Dead, Imposed,
// Wind (the enum grows later). `category` is only meaningful for Imposed cases
// (the engine ψ0 lookup, Plan 01): "A-D/H" (default) or "E_storage"; null otherwise.
// Portable by design (D-22) — the same shape transfers to frame2d.
let loadCases   = [];     // [{ id, name, nature, active, category }]
let activeCaseId = null;  // id of the case new loads tag to

const CASE_NATURES = ['Self weight', 'Dead', 'Imposed', 'Wind'];
// Imposed ψ0 category options (engine PSI0_IMPOSED keys, Plan 01).
const IMPOSED_CATEGORIES = [
  { value: 'A-D/H',     label: 'A–D/H (offices/floors)' },
  { value: 'E_storage', label: 'E (storage)' },
];
const DEFAULT_IMPOSED_CATEGORY = 'A-D/H';

let _caseSeq = 0;
function makeCaseId() {
  _caseSeq += 1;
  return 'case-' + Date.now().toString(36) + '-' + _caseSeq;
}

// Guarantees a usable case model at all times: if loadCases is empty, create the
// default Dead case and make it active (D-03). Also repairs activeCaseId when it
// points at a missing case (e.g. after a delete or a legacy load).
function ensureDefaultCase() {
  if (!Array.isArray(loadCases) || loadCases.length === 0) {
    loadCases = [{ id: makeCaseId(), name: 'Dead', nature: 'Dead', active: true, category: null }];
    activeCaseId = loadCases[0].id;
    return;
  }
  if (!loadCases.some(c => c.id === activeCaseId)) {
    const act = loadCases.find(c => c.active) || loadCases[0];
    activeCaseId = act.id;
  }
}

// ── Combination model (Phase 999.2 Wave 4) ──────────────────────────────────
// Manual AND generated combinations share ONE data shape (D-17):
//   { id, name, cls ('STR'|'SLS'), terms:[{caseId, factor}], on, generated, leading }
// Factors live ONLY on combination terms (D-01). The UI never computes γ/ψ
// (D-08) — generated factors come from the engine response; manual factors are
// typed by the user. `perCaseForces` caches each case's member_forces (from the
// engine, keyed by caseId) so editing a factor or toggling a row re-superposes
// in JS only — NO re-solve, NO network (D-09 / Pitfall 6).
let combinations  = [];      // shared manual + generated rows
let perCaseForces = {};      // caseId -> member_forces array (length = nMembers)
let perCaseDisp   = {};      // caseId -> displacements (UG) array (length = 2·nNodes) — SLS δ_max (D-13)
let comboEnvelope = null;    // last envelopeJS result (carried for Wave 5)
let wizardPreview = [];      // editable generated rows staged in the wizard (Task 2)

// ── Results-view + traceability state (Phase 999.2 Wave 5 — C6/C7/C8) ────────
// resultsView: 'auto' resolves to ENVELOPE when active combinations exist, else
// per-case (back-compat with today's single-solve results, D-20). The segmented
// selector sets it explicitly; resetAll restores 'auto'.
let resultsView          = 'auto';
let selectedResultCaseId  = null;   // per-case view dropdown selection
let selectedResultComboId = null;   // per-combination view dropdown selection
let selectedComboName     = null;   // reverse-index canvas highlight (D-19 / C8)
let selectedMemberDetail  = null;   // member index (0-based) shown in the detail strip (D-19 forward)

let _comboSeq = 0;
function makeComboId() {
  _comboSeq += 1;
  return 'cmb-' + Date.now().toString(36) + '-' + _comboSeq;
}

// Pure-JS superposition: Σ factor · perCaseForces[caseId]. Arithmetic only — NOT
// factor logic (D-08 untouched; factors are already resolved). A missing case
// contributes a zero vector (mirrors the engine's superpose()).
function superposeJS(combo) {
  const nM = members.length;
  const out = new Array(nM).fill(0);
  (combo.terms || []).forEach(function (t) {
    const fc = perCaseForces[t.caseId];
    if (!fc) return;
    for (let i = 0; i < nM; i++) out[i] += t.factor * (fc[i] || 0);
  });
  return out;
}

// Provenance-carrying envelope over the active combinations (mirrors the engine
// argmax/argmin). Returns per-member governing combo + a reverse index count
// (comboId -> number of members it governs) for the "governs N" badge (D-19).
function envelopeJS(activeCombos) {
  const nM = members.length;
  const governs = {};
  const perMember = [];
  if (!activeCombos.length || !nM) return { governs: governs, perMember: perMember };
  const forces = activeCombos.map(superposeJS);
  const govSets = {};
  activeCombos.forEach(function (c) { govSets[c.id] = new Set(); });
  for (let m = 0; m < nM; m++) {
    let maxV = -Infinity, maxI = 0, minV = Infinity, minI = 0;
    for (let i = 0; i < activeCombos.length; i++) {
      const v = forces[i][m];
      if (v > maxV) { maxV = v; maxI = i; }
      if (v < minV) { minV = v; minI = i; }
    }
    const govT = activeCombos[maxI], govC = activeCombos[minI];
    perMember.push({ member: m + 1, maxT: maxV, govT: govT.name, maxC: minV, govC: govC.name });
    govSets[govT.id].add(m + 1);
    govSets[govC.id].add(m + 1);
  }
  Object.keys(govSets).forEach(function (id) { governs[id] = govSets[id].size; });
  return { governs: governs, perMember: perMember };
}

// Recompute superpose+envelope for every active combination and refresh the
// "governs N" badges in place. Makes NO network call (Pitfall 6) — a factor edit
// or a row toggle calls recombine() only, never the endpoint.
function recombine() {
  const active = combinations.filter(function (c) { return c.on; });
  comboEnvelope = envelopeJS(active);
  combinations.forEach(function (c) {
    const badge = document.querySelector('.combo-table [data-governs-for="' + c.id + '"]');
    if (badge) badge.textContent = 'governs ' + (comboEnvelope.governs[c.id] || 0);
  });
  // Live re-render of the results panel + canvas so a factor edit re-envelopes the
  // ENVELOPE view and the SLS δ_max instantly — no re-solve, no network (D-09).
  if (typeof refreshResultsView === 'function') refreshResultsView();
  if (typeof draw === 'function') draw();
}

// ── Results-view helpers (Phase 999.2 Wave 5 — C6/C7/C8) ────────────────────
// True when at least one combination is on AND per-case forces are cached.
function hasActiveCombos() {
  return combinations.some(function (c) { return c.on; }) && Object.keys(perCaseForces).length > 0;
}

// Resolve 'auto' to ENVELOPE when combinations exist, else per-case (back-compat).
function effectiveResultsView() {
  if (resultsView !== 'auto') return resultsView;
  return hasActiveCombos() ? 'envelope' : 'per-case';
}

// Pure-JS displacement superposition: Σ factor · perCaseDisp[caseId]. Mirrors
// superposeJS for forces; drives the SLS-characteristic δ_max (D-13) without a
// re-solve when a factor is edited (D-09).
function superposeDispJS(combo) {
  const nDof = nodes.length * 2;
  const out = new Array(nDof).fill(0);
  (combo.terms || []).forEach(function (t) {
    const dc = perCaseDisp[t.caseId];
    if (!dc) return;
    for (let i = 0; i < nDof; i++) out[i] += t.factor * (dc[i] || 0);
  });
  return out;
}

// SLS-characteristic deflection check (D-13): max δ over the on SLS combinations
// (the SLS envelope) + the governing SLS combination name. Returns null when no
// SLS combos / no cached displacements exist → caller falls back to single-solve.
function slsEnvelopeDeltaMax() {
  if (!Object.keys(perCaseDisp).length) return null;
  const sls = combinations.filter(function (c) { return c.on && c.cls === 'SLS'; });
  if (!sls.length) return null;
  let best = null;
  sls.forEach(function (combo) {
    const ug = superposeDispJS(combo);
    let dMax = 0, dNode = 0;
    nodes.forEach(function (n, i) {
      const mag = Math.hypot(ug[i * 2] || 0, ug[i * 2 + 1] || 0);
      if (mag > dMax) { dMax = mag; dNode = i + 1; }
    });
    if (!best || dMax > best.delta) best = { delta: dMax, node: dNode, combo: combo.name };
  });
  return best;
}

// Member forces for the active per-case / per-combination view (ENVELOPE is built
// directly from comboEnvelope). Falls back to the single-solve result for the
// no-combinations back-compat path (D-20).
function forcesForView(view, res) {
  if (view === 'per-combination' && hasActiveCombos()) {
    let combo = combinations.find(function (c) { return c.id === selectedResultComboId && c.on; });
    if (!combo) combo = combinations.filter(function (c) { return c.on; })[0];
    if (combo) return superposeJS(combo);
  }
  if (view === 'per-case' && hasActiveCombos() && selectedResultCaseId && perCaseForces[selectedResultCaseId]) {
    return perCaseForces[selectedResultCaseId];
  }
  return res ? res.member_forces : null;   // single-solve back-compat
}

// Sync the segmented selector active state + populate/show the case/combination
// dropdowns appropriate to the active view.
function populateResultsSelectors(view) {
  document.querySelectorAll('#resultsViewSelector .results-view-seg').forEach(function (b) {
    b.classList.toggle('active', b.dataset.view === view);
  });
  const combosExist = hasActiveCombos();
  const caseSel = document.getElementById('resultsCaseSelect');
  const comboSel = document.getElementById('resultsComboSelect');
  if (caseSel) {
    if (view === 'per-case' && combosExist) {
      caseSel.innerHTML = '';
      loadCases.forEach(function (c) {
        if (!perCaseForces[c.id]) return;   // only cases that were solved
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.name;
        caseSel.appendChild(o);
      });
      if (!selectedResultCaseId || !perCaseForces[selectedResultCaseId]) {
        selectedResultCaseId = caseSel.options.length ? caseSel.options[0].value : null;
      }
      caseSel.value = selectedResultCaseId || '';
      caseSel.style.display = caseSel.options.length ? '' : 'none';
    } else {
      caseSel.style.display = 'none';
    }
  }
  if (comboSel) {
    if (view === 'per-combination' && combosExist) {
      comboSel.innerHTML = '';
      combinations.filter(function (c) { return c.on; }).forEach(function (c) {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.name;
        comboSel.appendChild(o);
      });
      if (!selectedResultComboId || !combinations.some(function (c) { return c.id === selectedResultComboId && c.on; })) {
        selectedResultComboId = comboSel.options.length ? comboSel.options[0].value : null;
      }
      comboSel.value = selectedResultComboId || '';
      comboSel.style.display = comboSel.options.length ? '' : 'none';
    } else {
      comboSel.style.display = 'none';
    }
  }
}

// User clicked a results-view segment.
function setResultsView(v) {
  resultsView = v;
  if (results) renderResults(results);
}

// Re-render the results panel against the last solve result (used by the dropdowns
// and by recombine() on factor edits). Safe no-op when nothing has been solved.
function refreshResultsView() {
  if (results) renderResults(results);
}

// Minimal HTML escape for combination-name / expression strings rendered into cells.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Build one tension/compression result row; withGov adds the truncated Governing
// column (ENVELOPE view only). Clicking the row opens the member-detail strip.
function buildForceRow(r, withGov) {
  const tr = document.createElement('tr');
  const fkN = r.f / 1000;
  let html = '<td>' + (r.idx + 1) + '</td>'
    + '<td>' + (r.m.start + 1) + ' – ' + (r.m.end + 1) + '</td>'
    + '<td>' + fkN.toFixed(3) + '</td>';
  if (withGov) {
    const g = r.gov || '—';
    html += '<td class="gov-cell" title="' + esc(g) + '">' + esc(g) + '</td>';
  }
  tr.innerHTML = html;
  tr.style.cursor = 'pointer';
  tr.addEventListener('click', function () { showMemberDetail(r.idx); });
  return tr;
}

// Forward map (D-19): show the clicked member's force in EVERY on combination, the
// governing one flagged. The governing expression shown is exactly what the export
// writes (D-21). No combinations → hides the strip.
function showMemberDetail(memberIndex) {
  const host = document.getElementById('memberDetail');
  if (!host) return;
  const m = members[memberIndex];
  const active = combinations.filter(function (c) { return c.on; });
  if (!m || !active.length || !Object.keys(perCaseForces).length) {
    host.style.display = 'none';
    selectedMemberDetail = null;
    return;
  }
  selectedMemberDetail = memberIndex;
  // Governing combo names for this member (from the cached envelope).
  let govT = null, govC = null;
  if (comboEnvelope && comboEnvelope.perMember) {
    const pm = comboEnvelope.perMember.find(function (p) { return p.member === memberIndex + 1; });
    if (pm) { govT = pm.govT; govC = pm.govC; }
  }
  let rowsHtml = '';
  active.forEach(function (c) {
    const f = superposeJS(c)[memberIndex] || 0;
    const isGov = (c.name === govT || c.name === govC);
    const sense = f > 1e-3 ? 'T' : (f < -1e-3 ? 'C' : '—');
    rowsHtml += '<tr' + (isGov ? ' class="md-governing"' : '') + '>'
      + '<td>' + esc(c.name) + (isGov ? ' <span class="md-flag">governs</span>' : '') + '</td>'
      + '<td>' + (c.cls || '') + '</td>'
      + '<td class="md-force">' + (f / 1000).toFixed(3) + ' kN</td>'
      + '<td>' + sense + '</td>'
      + '</tr>';
  });
  host.innerHTML =
    '<div class="member-detail-head">'
    + '<span class="member-detail-title">Member ' + (memberIndex + 1)
    + ' (nodes ' + (m.start + 1) + '–' + (m.end + 1) + ') — force per combination</span>'
    + '<button type="button" class="member-detail-close" aria-label="Close member detail" '
    + 'onclick="hideMemberDetail()">✕</button>'
    + '</div>'
    + '<table><thead><tr><th>Combination</th><th>Class</th><th>Force</th><th>Sense</th></tr></thead>'
    + '<tbody>' + rowsHtml + '</tbody></table>';
  host.style.display = '';
}

function hideMemberDetail() {
  selectedMemberDetail = null;
  const host = document.getElementById('memberDetail');
  if (host) host.style.display = 'none';
}

// Reverse index (D-19 / C8): select a combination so draw() paints the governing
// halo on the members it governs. Passing null clears the selection.
function selectComboForCanvas(comboId) {
  const c = combinations.find(function (x) { return x.id === comboId; });
  const name = c ? c.name : null;
  selectedComboName = (selectedComboName === name) ? null : name;  // toggle
  renderCombinationTable();
  draw();
}

let history  = [];
let results  = null;         // last API response
let exportMode = false;

// ── Mode management ───────────────────────────────────────────────────────
const MODE_LABELS = {
  view: 'View', node: 'Add Node', member: 'Add Member',
  pinned: 'Pinned Support', rollerX: 'Roller (X fixed)', rollerY: 'Roller (Y fixed)',
  load: 'Add Load', editNode: 'Edit Node', delete: 'Delete',
  memberA: 'Member A',
};

const SUPPORT_MODES = new Set(['pinned', 'rollerX', 'rollerY']);
const LOAD_MODES    = new Set(['load']);

function setMode(m) {
  mode = m;
  currentMemberStart = null;
  selectedMembers.clear();  // leaving any mode drops pending multi-select
  document.querySelectorAll('.tool-btn[data-mode]').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === m)
  );
  document.getElementById('modeLabel').textContent = MODE_LABELS[m] || m;

  // Auto-enable the matching visibility layer so clicks always produce
  // visible feedback. Without this, supports/loads added with chkSupports/
  // chkLoads unchecked land in the data array but render nothing.
  // Mirrors the frame2d fix from quick task 260504-ene (commit 3797fe2).
  if (SUPPORT_MODES.has(m)) {
    document.getElementById('chkSupports').checked = true;
  } else if (LOAD_MODES.has(m)) {
    document.getElementById('chkLoads').checked = true;
  }
  draw();
}

// ── Canvas click ──────────────────────────────────────────────────────────
canvas.addEventListener('click', e => {
  try {
  if (isPanning) return;
  if (clickDownX !== null) {
    const movedX = Math.abs(e.clientX - clickDownX);
    const movedY = Math.abs(e.clientY - clickDownY);
    clickDownX = null; clickDownY = null;   // consume — one mousedown per click
    if (movedX > CLICK_DRAG_PX || movedY > CLICK_DRAG_PX) return;  // drag/scrub → place nothing
  }
  let { x: px, y: py } = toWorld(e.clientX, e.clientY);

  if (mode === 'node') {
    saveHistory();
    px = Math.round(px / GRID) * GRID;
    py = Math.round(py / GRID) * GRID;
    if (origin === null) origin = { x: px, y: py };
    const realX = ((px - origin.x) / GRID) * UNIT;
    const realY = ((origin.y - py) / GRID) * UNIT;
    nodes.push({ id: nodes.length, x: px, y: py, realX, realY });
    results = null;
    const screenX = px * view.scale + view.tx;
    const screenY = py * view.scale + view.ty;
    if (screenX < 0 || screenX > LOGICAL_W || screenY < 0 || screenY > LOGICAL_H) {
      setStatus('Node ' + nodes.length + ' placed OFF-SCREEN (outside the visible area). Use Reset View to see it.', true);
    }

  } else if (mode === 'member') {
    const n = findNodeAt(px, py);
    if (n) {
      if (currentMemberStart === null) {
        currentMemberStart = n;
      } else if (currentMemberStart.id !== n.id) {
        saveHistory();
        members.push({ start: currentMemberStart.id, end: n.id });
        currentMemberStart = null;
        results = null;
      }
    }

  } else if (['pinned', 'rollerX', 'rollerY'].includes(mode)) {
    const n = findNodeAt(px, py);
    if (n) {
      saveHistory();
      supports = supports.filter(s => s.nodeId !== n.id); // replace existing
      supports.push({ nodeId: n.id, type: mode });
      results = null;
    }

  } else if (mode === 'load') {
    const n = findNodeAt(px, py);
    if (n) {
      const dir = prompt('Direction (x or y):', 'y');
      if (!dir) return;
      const existing = loads.find(l => l.nodeId === n.id && l.direction === dir.toLowerCase());
      const defaultVal = existing ? String(existing.magnitude) : '-10000';
      const mag = parseFloat(prompt('Magnitude in N (negative = down/left):', defaultVal));
      if (!isNaN(mag)) {
        saveHistory();
        loads = loads.filter(l => !(l.nodeId === n.id && l.direction === dir.toLowerCase()));
        loads.push({ nodeId: n.id, direction: dir.toLowerCase(), magnitude: mag, caseId: activeCaseId });
        results = null;
        if (typeof renderCaseTable === 'function') renderCaseTable();
      }
    }

  } else if (mode === 'editNode') {
    const n = findNodeAt(px, py);
    if (n) {
      const input = prompt(`Node ${n.id + 1} — enter real coordinates (x,y) in metres:`, `${n.realX},${n.realY}`);
      if (input) {
        const [rx, ry] = input.split(',').map(Number);
        if (!isNaN(rx) && !isNaN(ry)) {
          saveHistory();
          n.realX = rx;
          n.realY = ry;
          syncPixelFromReal(n);
          results = null;
        }
      }
    }

  } else if (mode === 'delete') {
    const n = findNodeAt(px, py);
    const mi = findMemberAt(px, py);
    if (n || mi !== null) {
      saveHistory();
      if (n) {
        nodes    = nodes.filter(nd => nd.id !== n.id);
        members  = members.filter(m => m.start !== n.id && m.end !== n.id);
        supports = supports.filter(s => s.nodeId !== n.id);
        loads    = loads.filter(l => l.nodeId !== n.id);
        reindexNodes();
      } else {
        members.splice(mi, 1);
      }
      if (nodes.length === 0) { origin = null; currentMemberStart = null; }
      results = null;
    }

  } else if (mode === 'memberA') {
    const mi = findMemberAt(px, py);
    if (e.shiftKey && mi !== null) {
      // SHIFT-CLICK: toggle member in/out of selection set; no prompt yet
      if (selectedMembers.has(mi)) selectedMembers.delete(mi);
      else selectedMembers.add(mi);
      draw();
      return;
    }
    if (mi !== null) {
      if (selectedMembers.size > 0) {
        // BATCH APPLY: include the clicked member, prompt once for all
        selectedMembers.add(mi);
        const globalA_cm2 = parseFloat(document.getElementById('inputA').value) || 100;
        const count = selectedMembers.size;
        const raw = prompt(
          count + ' member' + (count > 1 ? 's' : '') + ' selected — enter A (cm²):\n' +
          '(Leave blank or 0 to revert all to global A = ' + globalA_cm2 + ' cm²)',
          String(globalA_cm2)
        );
        if (raw === null) { draw(); return; }  // cancelled — keep selection visible
        const val = parseFloat(raw);
        saveHistory();  // single undo step for the whole batch
        selectedMembers.forEach(function (selIdx) {
          if (!isNaN(val) && val > 0) {
            members[selIdx].A_override = val;   // store in cm²
          } else {
            members[selIdx].A_override = null;  // revert to global
          }
        });
        selectedMembers.clear();
        results = null;
      } else {
        // SINGLE-MEMBER: existing behaviour unchanged
        const globalA_cm2 = parseFloat(document.getElementById('inputA').value) || 100;
        const current = members[mi].A_override != null ? members[mi].A_override : globalA_cm2;
        const raw = prompt(
          'Member ' + (mi + 1) + ' — cross-sectional area A (cm²):\n' +
          '(Leave blank or enter 0 to revert to global A = ' + globalA_cm2 + ' cm²)',
          String(current)
        );
        if (raw === null) return;   // user cancelled
        const val = parseFloat(raw);
        saveHistory();
        if (!isNaN(val) && val > 0) {
          members[mi].A_override = val;   // store in cm²
        } else {
          members[mi].A_override = null;  // revert to global
        }
        results = null;
      }
    } else if (selectedMembers.size > 0) {
      // PLAIN CLICK on empty space — clear the selection
      selectedMembers.clear();
      draw();
      return;
    }

  } else if (mode === 'view') {
    // Forward map (D-19): click a member in View mode to open its per-combination
    // force breakdown (only meaningful once combinations have been run).
    const mi = findMemberAt(px, py);
    if (mi !== null && results) showMemberDetail(mi);
  }

  updateSaveButtonState();
  draw();
  } catch (err) {
    showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
    throw err;
  }
});

// ── History ───────────────────────────────────────────────────────────────
function saveHistory() {
  history.push({
    nodes:    JSON.parse(JSON.stringify(nodes)),
    members:  JSON.parse(JSON.stringify(members)),
    supports: JSON.parse(JSON.stringify(supports)),
    loads:    JSON.parse(JSON.stringify(loads)),
    origin:   origin ? { ...origin } : null,
    currentMemberStart: currentMemberStart ? { ...currentMemberStart } : null,
  });
  if (history.length > 100) history.shift();
}

function undoLastAction() {
  if (!history.length) return;
  const prev = history.pop();
  nodes    = prev.nodes;
  members  = prev.members;
  supports = prev.supports;
  loads    = prev.loads;
  origin   = prev.origin;
  currentMemberStart = prev.currentMemberStart;
  results  = null;
  updateSaveButtonState();
  draw();
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undoLastAction();
  }
  if (e.key === 'Escape') {
    // setMode clears selectedMembers; no separate clear needed here
    setMode('view');
  }
});

// ── Reset ─────────────────────────────────────────────────────────────────
function resetAll() {
  if (!confirm('Reset everything?')) return;
  nodes = []; members = []; supports = []; loads = [];
  origin = null; currentMemberStart = null; results = null;
  history = [];
  // Reset the load-case model back to a single default Dead case (D-03).
  loadCases = []; activeCaseId = null;
  ensureDefaultCase();
  // Reset the combination model + cached per-case forces (Wave 4).
  combinations = []; perCaseForces = {}; perCaseDisp = {}; comboEnvelope = null; wizardPreview = [];
  // Reset the Wave-5 results-view + traceability state.
  resultsView = 'auto'; selectedResultCaseId = null; selectedResultComboId = null;
  selectedComboName = null; selectedMemberDetail = null;
  if (typeof hideMemberDetail === 'function') hideMemberDetail();
  view = { scale: 1, tx: 0, ty: 0 };
  document.getElementById('resultsPanel').style.display = 'none';
  setStatus('');
  setMode('view');
  if (typeof renderCaseTable === 'function') renderCaseTable();
  if (typeof renderCombinationTable === 'function') renderCombinationTable();
  updateSaveButtonState();
  draw();
}

// ── Node/member helpers ───────────────────────────────────────────────────
function findNodeAt(x, y) {
  return nodes.find(n => Math.hypot(n.x - x, n.y - y) < 10);
}

function findMemberAt(x, y, tol = 8) {
  for (let i = 0; i < members.length; i++) {
    const m  = members[i];
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) continue;
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const len2 = dx*dx + dy*dy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((x-n1.x)*dx + (y-n1.y)*dy) / len2));
    if (Math.hypot(x - (n1.x + t*dx), y - (n1.y + t*dy)) < tol) return i;
  }
  return null;
}

function syncPixelFromReal(node) {
  if (!origin) return;
  node.x = origin.x + (node.realX / UNIT) * GRID;
  node.y = origin.y - (node.realY / UNIT) * GRID;
}

function reindexNodes() {
  const idMap = {};
  nodes.forEach((n, i) => { idMap[n.id] = i; n.id = i; });
  members.forEach(m => { m.start = idMap[m.start]; m.end = idMap[m.end]; });
  supports.forEach(s => { s.nodeId = idMap[s.nodeId]; });
  loads.forEach(l => { l.nodeId = idMap[l.nodeId]; });
}

// ── Pre-solve validation ───────────────────────────────────────────────────
/**
 * Runs before every solve attempt.  Returns false to BLOCK when a loose /
 * rogue node is found (zero incident members → singular stiffness matrix →
 * opaque API "unstable / under-restrained").  Warns (but does NOT block) when
 * two nodes are within 50 mm of each other.  Resets offendingNodes each call.
 */
function validateBeforeSolve() {
  offendingNodes = [];

  // Incidence: nodeId (0-based) → list of incident members.
  const incidence = new Map();
  members.forEach(m => {
    if (!incidence.has(m.start)) incidence.set(m.start, []);
    if (!incidence.has(m.end))   incidence.set(m.end,   []);
    incidence.get(m.start).push(m);
    incidence.get(m.end).push(m);
  });

  // 1. Loose / rogue node → BLOCK (LOCKED 2026-06-22).
  const loose = [];
  nodes.forEach(n => {
    if (!incidence.has(n.id) || incidence.get(n.id).length === 0) loose.push(n.id);
  });
  if (loose.length > 0) {
    offendingNodes = loose;
    const oneBased = loose.map(id => id + 1);
    const noun = loose.length === 1 ? 'Node' : 'Nodes';
    const verb = loose.length === 1 ? 'is' : 'are';
    setStatus(
      noun + ' ' + oneBased.join(', ') + ' ' + verb +
      ' not connected to any member — delete or connect before solving.',
      true
    );
    draw();
    return false;   // BLOCK
  }

  // 2. Too-close / coincident → WARN, do NOT block (LOCKED 2026-06-22).
  const TOO_CLOSE_M = 0.05;   // 50 mm
  const closePairs = [];
  const closeIds = new Set();
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[j].realX - nodes[i].realX, nodes[j].realY - nodes[i].realY);
      if (d < TOO_CLOSE_M) {
        closePairs.push((nodes[i].id + 1) + ' and ' + (nodes[j].id + 1));
        closeIds.add(nodes[i].id); closeIds.add(nodes[j].id);
      }
    }
  }
  if (closePairs.length > 0) {
    offendingNodes = Array.from(closeIds);
    setStatus(
      'Nodes ' + closePairs.join('; ') +
      ' are within 50 mm — possible duplicate; consider merging. Solving anyway.',
      false
    );
    draw();
  }

  return true;
}

// ── Solve ─────────────────────────────────────────────────────────────────
async function solve() {
  if (nodes.length < 2)   return setStatus('Need at least 2 nodes.', true);
  if (members.length < 1) return setStatus('Need at least 1 member.', true);
  if (supports.length < 1) return setStatus('Need at least one support.', true);

  const E_GPa = parseFloat(document.getElementById('inputE').value);
  const A_cm2 = parseFloat(document.getElementById('inputA').value);
  if (isNaN(E_GPa) || isNaN(A_cm2) || E_GPa <= 0 || A_cm2 <= 0)
    return setStatus('Check E and A values.', true);

  if (!validateBeforeSolve()) return;

  const E = E_GPa * 1e9;          // GPa → Pa

  // Per-member A resolution (mirrors frame2d pattern):
  // If any member has an A_override, send a per-member array (cm² → m²);
  // otherwise send the global scalar — payload is byte-identical to before.
  const anyA = members.some(m => m.A_override != null);
  const A = anyA
    ? members.map(m => (m.A_override != null ? m.A_override : A_cm2) * 1e-4)
    : A_cm2 * 1e-4;

  // Build restrainedDoF (1-based)
  const restrainedDoF = [];
  supports.forEach(s => {
    const base = s.nodeId * 2;
    if (s.type === 'pinned')  { restrainedDoF.push(base + 1, base + 2); }
    if (s.type === 'rollerX') { restrainedDoF.push(base + 1); }
    if (s.type === 'rollerY') { restrainedDoF.push(base + 2); }
  });

  // Build forceVector (0-indexed flat array, length = 2*nNodes)
  const forceVector = new Array(nodes.length * 2).fill(0);
  loads.forEach(l => {
    const idx = l.nodeId * 2 + (l.direction === 'y' ? 1 : 0);
    forceVector[idx] = l.magnitude;
  });

  const payload = {
    solver: 'truss2d',
    nodes:  nodes.map(n => [n.realX, n.realY]),
    members: members.map(m => [m.start + 1, m.end + 1]),  // 1-based
    E, A,
    forceVector,
    restrainedDoF,
  };

  setStatus('Solving…');
  try {
    const res = await fetch(`${API_URL}/solve/truss2d`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      return setStatus('API error: ' + (err.detail || res.statusText), true);
    }
    results = await res.json();
    setStatus('Solved ✓', false);
    renderResults(results);
    draw();
    updateSaveButtonState();
  } catch (err) {
    setStatus('Cannot reach API. Is the server running?', true);
  }
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('solveStatus');
  el.textContent = msg;
  el.className = isError ? 'error' : (msg ? 'ok' : '');
}

// ── Draw ──────────────────────────────────────────────────────────────────
function draw() {
  try {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.tx, dpr * view.ty);

  // Build member obstacle lines and create a fresh LabelManager for this frame
  const memberLines = members.map(m => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    return (n1 && n2) ? { x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y } : null;
  }).filter(Boolean);
  const labelManager = new LabelManager({ ctx, members: memberLines, dpr });

  if (!exportMode && document.getElementById('chkGrid')?.checked) drawGrid();
  drawMembers(labelManager);
  drawNodes(labelManager);
  if (document.getElementById('chkNodeLabels')?.checked) drawNodeLabels(labelManager);
  if (document.getElementById('chkSupports')?.checked) drawSupports();
  if (document.getElementById('chkLoads')?.checked) drawLoads(labelManager);
  if (results && document.getElementById('chkReactions')?.checked) drawReactions(labelManager);
  if (currentMemberStart) highlightNode(currentMemberStart, '#ff9800');
  if (results && document.getElementById('chkDeflected').checked) drawDeflected(labelManager);

  // Resolve and render all collected labels
  labelManager.resolve();
  labelManager.render(ctx);

  if (results && !exportMode) drawLegend();
  } catch (err) {
    showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
    throw err;
  }
}

function drawGrid() {
  ctx.strokeStyle = cssVar('--canvas-grid');
  ctx.lineWidth = 0.5;

  // Compute the visible window in the CURRENT (transformed) coordinate system,
  // so the grid covers wherever the user has panned/zoomed to — including
  // negative-coordinate regions for models imported from Revit etc.
  const x0 = (-view.tx)               / view.scale;
  const y0 = (-view.ty)               / view.scale;
  const x1 = (LOGICAL_W  - view.tx) / view.scale;
  const y1 = (LOGICAL_H - view.ty) / view.scale;

  const startX = Math.floor(x0 / GRID) * GRID;
  const startY = Math.floor(y0 / GRID) * GRID;

  for (let x = startX; x <= x1; x += GRID) {
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
  }
  for (let y = startY; y <= y1; y += GRID) {
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  }
}

function drawMembers(labelManager) {
  // Reverse-index governing halo (D-19 / C8): the set of member indices governed by
  // the currently selected combination (selectedComboName). Empty when none selected.
  const governedSet = new Set();
  if (selectedComboName && comboEnvelope && comboEnvelope.perMember) {
    comboEnvelope.perMember.forEach(function (p) {
      if (p.govT === selectedComboName || p.govC === selectedComboName) governedSet.add(p.member - 1);
    });
  }

  // Normalisation pass: compute max |axial force| once per draw so thickness scales linearly across members.
  let maxAbsForce = 0;
  if (results && results.member_forces) {
    for (let i = 0; i < results.member_forces.length; i++) {
      const af = Math.abs(results.member_forces[i]);
      if (af > maxAbsForce) maxAbsForce = af;
    }
  }

  members.forEach((m, idx) => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;

    let color = cssVar('--canvas-stroke');
    let label = null;
    let thickness = 2;

    if (results && results.member_forces) {
      const f = results.member_forces[idx];
      if (Math.abs(f) < 1e-3)       { color = cssVar('--canvas-zero'); }
      else if (f > 0)                { color = cssVar('--canvas-tension'); }
      else                           { color = cssVar('--canvas-compression'); }
      label = (f / 1000).toFixed(2) + 'kN';

      if (maxAbsForce > 1e-3) {
        const af = Math.abs(f);
        const ratio = af < 1e-3 ? 0 : (af / maxAbsForce);
        thickness = 1.5 + 4.5 * ratio;
      }
    }

    // Governing halo painted UNDER the member (reverse index, D-19 / C8): thick
    // semi-transparent spike-yellow ring on every member the selected combo governs.
    if (governedSet.has(idx)) {
      ctx.save();
      ctx.strokeStyle = cssVar('--canvas-governing');
      ctx.lineWidth = thickness + 8;
      ctx.globalAlpha = 0.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.lineTo(n2.x, n2.y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.stroke();

    // Multi-select highlight for Member-A batch mode
    if (selectedMembers.has(idx)) {
      ctx.save();
      ctx.strokeStyle = '#ff9800';  // same accent as highlightNode — clearly distinct from T/C colours
      ctx.lineWidth = thickness + 4;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.lineTo(n2.x, n2.y);
      ctx.stroke();
      ctx.restore();
    }

    if (label && document.getElementById('chkMemberForces')?.checked) {
      drawMemberLabel(n1, n2, label, color, labelManager);
    }
    // Per-member A annotation: always show when an override is set
    if (m.A_override != null) {
      const mx = (n1.x + n2.x) / 2;
      const my = (n1.y + n2.y) / 2;
      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      let angle = Math.atan2(dy, dx);
      if (Math.abs(angle) > Math.PI / 2) angle += Math.PI;
      const fs = Math.round(7 * labelScale * getSymbolScale());
      labelManager.add({
        text: 'A=' + m.A_override + 'cm²',
        anchorX: mx, anchorY: my,
        preferredX: mx, preferredY: my + 10,
        priority: 25,
        color: cssVar('--canvas-label'),
        font: '500 ' + fs + 'px ' + MONO_FONT_FAMILY,
        fontSize: fs,
        bgColor: cssVar('--canvas-label-bg'),
        bgPadding: 1,
        rotation: angle,
        textAlign: 'center',
        textBaseline: 'top',
        radius: 14,
        type: 'memberAreaOverride',
      });
    }
    if (document.getElementById('chkMemberIds')?.checked) {
      drawMemberIdLabel(n1, n2, idx, labelManager);
    }
  });
}

function drawMemberLabel(n1, n2, text, color, labelManager) {
  const mx = (n1.x + n2.x) / 2;
  const my = (n1.y + n2.y) / 2;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const fs = Math.round(8 * labelScale * getSymbolScale());

  // Rotation: label follows member orientation
  // Horizontal → no rotation; Vertical → read upward (-π/2);
  // Diagonal → follow slope, ensure text reads in downward direction
  let angle = Math.atan2(dy, dx);
  if (Math.abs(angle) > Math.PI / 2) angle += Math.PI;

  labelManager.add({
    text,
    anchorX: mx, anchorY: my,
    preferredX: mx, preferredY: my,
    priority: 40,
    color,
    font: '500 ' + fs + 'px ' + MONO_FONT_FAMILY,
    fontSize: fs,
    bgColor: cssVar('--canvas-label-bg'),
    bgPadding: 1,
    rotation: angle,
    textAlign: 'center',
    textBaseline: 'middle',
    radius: 14,
    type: 'memberForce',
  });
}

function drawMemberIdLabel(n1, n2, idx, labelManager) {
  const mx = (n1.x + n2.x) / 2;
  const my = (n1.y + n2.y) / 2;
  const fs = Math.round(8 * labelScale * getSymbolScale());
  labelManager.add({
    text: 'M' + (idx + 1),
    anchorX: mx, anchorY: my,
    preferredX: mx, preferredY: my - 8,
    priority: 35,
    color: cssVar('--canvas-label'),
    font: '600 ' + fs + 'px ' + LABEL_FONT_FAMILY,
    fontSize: fs,
    bgColor: cssVar('--canvas-label-bg'),
    bgPadding: 1,
    textAlign: 'center',
    textBaseline: 'bottom',
    radius: 14,
    type: 'memberId',
  });
}

function drawNodes(labelManager) {
  const r = 5 * getSymbolScale();
  const fs = Math.round(8 * labelScale * getSymbolScale());
  const showNodeIds = document.getElementById('chkNodeIds')?.checked;
  nodes.forEach(n => {
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = offendingNodes.includes(n.id) ? '#e53935' : cssVar('--canvas-node');
    ctx.fill();
    if (showNodeIds) {
      labelManager.add({
        text: String(n.id + 1),
        anchorX: n.x, anchorY: n.y,
        preferredX: n.x + 6, preferredY: n.y - 6,
        priority: 10,
        color: cssVar('--canvas-label'),
        font: '600 ' + fs + 'px ' + LABEL_FONT_FAMILY,
        fontSize: fs,
        textAlign: 'left',
        textBaseline: 'bottom',
        radius: 10,
        type: 'nodeId',
        skipCollision: true,
      });
    }
  });
}

function drawNodeLabels(labelManager) {
  nodes.forEach(function(n, i) {
    var label, fontSize, font;
    if (exportMode) {
      label = String(i + 1);
      font = '600 13px ' + LABEL_FONT_FAMILY;
      fontSize = 13;
    } else {
      var base = i * 2 + 1;
      label = 'N' + i + ' [' + base + ',' + (base + 1) + ']';
      font = '600 11px ' + LABEL_FONT_FAMILY;
      fontSize = 11;
    }
    labelManager.add({
      text: label,
      anchorX: n.x, anchorY: n.y,
      preferredX: n.x + 8, preferredY: n.y - 8,
      priority: 15,
      color: cssVar('--canvas-label'),
      font: font,
      fontSize: fontSize,
      bgColor: cssVar('--canvas-label-bg'),
      bgPadding: 2,
      textAlign: 'left',
      textBaseline: 'bottom',
      type: 'dof',
    });
  });
}

function highlightNode(n, color) {
  ctx.beginPath();
  ctx.arc(n.x, n.y, 8, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawSupports() {
  supports.forEach(s => {
    const n = nodes.find(nd => nd.id === s.nodeId);
    if (!n) return;
    ctx.save();
    if      (s.type === 'pinned')  drawPin(n.x, n.y);
    else if (s.type === 'rollerY') drawRollerH(n.x, n.y);   // free X, fixed Y
    else if (s.type === 'rollerX') drawRollerV(n.x, n.y);   // free Y, fixed X
    ctx.restore();
  });
}

// ── Pin: filled triangle + baseline + hatching ────────────────────────────
function drawPin(x, y) {
  const sc = getSymbolScale();
  const h = 14 * sc, hw = 12 * sc;
  ctx.strokeStyle = cssVar('--canvas-support');
  ctx.fillStyle   = cssVar('--canvas-support');
  ctx.lineWidth   = 1.5;

  // filled triangle
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - hw, y + h);
  ctx.lineTo(x + hw, y + h);
  ctx.closePath();
  ctx.fill();

  // baseline
  ctx.beginPath();
  ctx.moveTo(x - hw - 3*sc, y + h);
  ctx.lineTo(x + hw + 3*sc, y + h);
  ctx.stroke();

  // hatching below baseline
  drawHatch(x - hw - 3*sc, x + hw + 3*sc, y + h, 'H');
}

// ── Roller on horizontal surface: open triangle + wheels + baseline + hatch
function drawRollerH(x, y) {
  const sc = getSymbolScale();
  const h = 12 * sc, hw = 11 * sc, r = 3 * sc;
  ctx.strokeStyle = cssVar('--canvas-support');
  ctx.fillStyle   = cssVar('--canvas-support');
  ctx.lineWidth   = 1.5;

  // open triangle
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - hw, y + h);
  ctx.lineTo(x + hw, y + h);
  ctx.closePath();
  ctx.stroke();

  // two wheel circles
  const wy = y + h + r + 2*sc;
  [-hw * 0.45, hw * 0.45].forEach(dx => {
    ctx.beginPath();
    ctx.arc(x + dx, wy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // baseline
  const by = wy + r + 2*sc;
  ctx.beginPath();
  ctx.moveTo(x - hw - 3*sc, by);
  ctx.lineTo(x + hw + 3*sc, by);
  ctx.stroke();

  // hatching
  drawHatch(x - hw - 3*sc, x + hw + 3*sc, by, 'H');
}

// ── Roller on vertical wall: open triangle (rotated) + wheels + wall + hatch
function drawRollerV(x, y) {
  const sc = getSymbolScale();
  const h = 12 * sc, hh = 11 * sc, r = 3 * sc;
  ctx.strokeStyle = cssVar('--canvas-support');
  ctx.fillStyle   = cssVar('--canvas-support');
  ctx.lineWidth   = 1.5;

  // open triangle pointing left
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - h, y - hh);
  ctx.lineTo(x - h, y + hh);
  ctx.closePath();
  ctx.stroke();

  // two wheel circles
  const wx = x - h - r - 2*sc;
  [-hh * 0.45, hh * 0.45].forEach(dy => {
    ctx.beginPath();
    ctx.arc(wx, y + dy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // wall line
  const wl = wx - r - 2*sc;
  ctx.beginPath();
  ctx.moveTo(wl, y - hh - 3*sc);
  ctx.lineTo(wl, y + hh + 3*sc);
  ctx.stroke();

  // hatching (left side of wall)
  drawHatch(y - hh - 3*sc, y + hh + 3*sc, wl, 'V');
}

// ── Hatching helper ───────────────────────────────────────────────────────
function drawHatch(from, to, base, dir) {
  ctx.strokeStyle = cssVar('--canvas-support');
  ctx.lineWidth   = 1;
  const spacing = 5, len = 6;
  const count = Math.ceil((to - from) / spacing);
  for (let i = 0; i <= count; i++) {
    const t = from + i * spacing;
    ctx.beginPath();
    if (dir === 'H') {
      ctx.moveTo(t,       base);
      ctx.lineTo(t - len, base + len);
    } else {
      ctx.moveTo(base,        t);
      ctx.lineTo(base - len,  t + len);
    }
    ctx.stroke();
  }
}

function drawForceArrow(node, axis, forceValue, color, label, labelManager, isReaction) {
  const sc        = getSymbolScale();
  const arrowLen  = 24 * sc;
  const chevronD  = 6 * sc;
  const chevronHW = 4 * sc;
  const apexGap   = 2 * sc;
  const fs        = Math.round(8 * labelScale * sc);
  const labelGap  = 12 * sc;

  let dirX = 0, dirY = 0;
  if (axis === 'y') dirY = forceValue > 0 ? -1 : 1;
  else              dirX = forceValue > 0 ?  1 : -1;

  const apexX = node.x - apexGap * dirX;
  const apexY = node.y - apexGap * dirY;
  const tailX = apexX - arrowLen * dirX;
  const tailY = apexY - arrowLen * dirY;
  const chevBaseX = apexX - chevronD * dirX;
  const chevBaseY = apexY - chevronD * dirY;

  const perpX = -dirY;
  const perpY =  dirX;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  // Shaft: tail → apex
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(apexX, apexY);
  ctx.stroke();

  // Open chevron head
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(chevBaseX + perpX * chevronHW, chevBaseY + perpY * chevronHW);
  ctx.lineTo(apexX, apexY);
  ctx.lineTo(chevBaseX - perpX * chevronHW, chevBaseY - perpY * chevronHW);
  ctx.stroke();

  ctx.restore();

  if (label) {
    // Vertical arrows: label at tail, centred. Horizontal arrows: offset above shaft.
    const isHoriz = Math.abs(dirX) > 0.5;
    const lblX = isHoriz ? tailX : tailX;
    const lblY = isHoriz ? tailY - 10 * sc : tailY;
    labelManager.add({
      text: label, anchorX: node.x, anchorY: node.y,
      preferredX: lblX, preferredY: lblY,
      priority: 30, color,
      font: '500 ' + fs + 'px ' + MONO_FONT_FAMILY, fontSize: fs,
      bgColor: cssVar('--canvas-label-bg'), bgPadding: 1,
      textAlign: 'center', textBaseline: isHoriz ? 'bottom' : 'middle',
      type: 'load', skipCollision: true,
    });
  }
}

function drawLoads(labelManager) {
  // Colour-by-nature + show-active-only are gated behind Display checkboxes so a
  // new glyph never "does nothing visible" (MEMORY feedback_check_render_toggle_first).
  const colourByNature = document.getElementById('chkColourByNature')?.checked;
  const activeOnly     = document.getElementById('chkActiveCaseOnly')?.checked;
  loads.forEach(l => {
    if (activeOnly && l.caseId !== activeCaseId) return;
    const n = nodes.find(nd => nd.id === l.nodeId);
    if (!n) return;
    const label = (Math.abs(l.magnitude) / 1000).toFixed(1) + 'kN';
    let color = cssVar('--canvas-load');   // legacy green fallback when colour-by-nature OFF
    if (colourByNature) {
      const c = loadCases.find(x => x.id === l.caseId);
      color = natureColor(c ? c.nature : 'Dead');
    }
    drawForceArrow(n, l.direction, l.magnitude, color, label, labelManager, false);
  });
}

function drawLegend() {
  if (!results) return;
  const sc = getSymbolScale();

  // Legend lives in screen space — DPR-scaled so dimensions stay in CSS pixels.
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const fs      = Math.round(11 * sc);
  const lh      = Math.round(16 * sc);
  const swatchW = Math.round(22 * sc);
  const padX    = Math.round(10 * sc);
  const padY    = Math.round(8 * sc);
  const gap     = Math.round(8 * sc);

  const items = [
    { color: cssVar('--canvas-tension'), label: 'Tension (+)' },
    { color: cssVar('--canvas-compression'), label: 'Compression (-)' },
    { color: cssVar('--canvas-zero'),    label: 'Near-zero' },
  ];
  if (document.getElementById('chkReactions')?.checked) {
    items.push({ color: cssVar('--canvas-reaction'), label: 'Reaction' });
  }

  ctx.font = `${fs}px ${LABEL_FONT_FAMILY}`;
  let maxTextW = 0;
  items.forEach(it => { maxTextW = Math.max(maxTextW, ctx.measureText(it.label).width); });
  const boxW = padX * 2 + swatchW + gap + Math.ceil(maxTextW);
  const boxH = padY * 2 + items.length * lh;

  const margin = Math.round(10 * sc);
  const x0 = LOGICAL_W - boxW - margin;
  const y0 = margin;

  ctx.fillStyle   = cssVar('--canvas-label-bg');
  ctx.strokeStyle = cssVar('--color-border');
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.rect(x0, y0, boxW, boxH);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  items.forEach((it, i) => {
    const rowY = y0 + padY + i * lh + Math.round(lh / 2);
    ctx.strokeStyle = it.color;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(x0 + padX, rowY);
    ctx.lineTo(x0 + padX + swatchW, rowY);
    ctx.stroke();
    ctx.fillStyle = cssVar('--canvas-label');
    ctx.fillText(it.label, x0 + padX + swatchW + gap, rowY);
  });

  ctx.restore();
}

function drawReactions(labelManager) {
  if (!results || !results.FG) return;
  const FG   = results.FG;
  const ZERO = 1e-3;
  const sc   = getSymbolScale();
  const fs   = Math.round(8 * labelScale * sc);

  supports.forEach(s => {
    const n = nodes.find(nd => nd.id === s.nodeId);
    if (!n) return;
    const base = s.nodeId * 2;
    const dirs = s.type === 'pinned'  ? ['x', 'y']
               : s.type === 'rollerX' ? ['x']
               : s.type === 'rollerY' ? ['y']
               : [];

    // Draw arrows (no labels on them)
    dirs.forEach(dir => {
      const idx = base + (dir === 'y' ? 1 : 0);
      const r   = FG[idx];
      if (Math.abs(r) < ZERO) return;
      drawForceArrow(n, dir, r, cssVar('--canvas-reaction'), '', labelManager, true);
    });

    // Determine outside direction for horizontal reactions
    let cx = 0;
    for (let i = 0; i < nodes.length; i++) cx += nodes[i].x;
    cx /= nodes.length;
    const isLeft = n.x <= cx;

    // Place each reaction label
    dirs.forEach(dir => {
      const idx = base + (dir === 'y' ? 1 : 0);
      const r   = FG[idx];
      if (Math.abs(r) < ZERO) return;
      const tag = dir === 'x' ? 'Rx' : 'Ry';
      const txt = tag + ' = ' + (Math.abs(r) / 1000).toFixed(2) + 'kN';

      if (dir === 'y') {
        // Ry: below support, centred
        labelManager.add({
          text: txt, anchorX: n.x, anchorY: n.y,
          preferredX: n.x, preferredY: n.y + 28 * sc,
          priority: 20, color: cssVar('--canvas-reaction'),
          font: '500 ' + fs + 'px ' + MONO_FONT_FAMILY, fontSize: fs,
          bgColor: cssVar('--canvas-label-bg'), bgPadding: 1,
          textAlign: 'center', textBaseline: 'top',
          type: 'reaction', skipCollision: true,
        });
      } else {
        // Rx: outside the structure horizontally
        const offsetX = isLeft ? -20 * sc : 20 * sc;
        labelManager.add({
          text: txt, anchorX: n.x, anchorY: n.y,
          preferredX: n.x + offsetX, preferredY: n.y,
          priority: 20, color: cssVar('--canvas-reaction'),
          font: '500 ' + fs + 'px ' + MONO_FONT_FAMILY, fontSize: fs,
          bgColor: cssVar('--canvas-label-bg'), bgPadding: 1,
          textAlign: isLeft ? 'right' : 'left', textBaseline: 'middle',
          type: 'reaction', skipCollision: true,
        });
      }
    });
  });
}

function drawDeflected(labelManager) {
  try {
  const scale = parseFloat(document.getElementById('inputScale').value) || 100;
  const UG = results.UG;

  // Track max displacement magnitude for canvas annotation
  let maxMag = 0, maxScreenX = 0, maxScreenY = 0;

  ctx.strokeStyle = cssVar('--canvas-deflected');
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  members.forEach(m => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;

    const ux1 = UG[m.start * 2]     * scale;
    const uy1 = UG[m.start * 2 + 1] * scale;
    const ux2 = UG[m.end   * 2]     * scale;
    const uy2 = UG[m.end   * 2 + 1] * scale;

    // convert real-world displacements to pixels (y-axis flipped)
    const dx1 =  ux1 / UNIT * GRID;
    const dy1 = -uy1 / UNIT * GRID;
    const dx2 =  ux2 / UNIT * GRID;
    const dy2 = -uy2 / UNIT * GRID;

    ctx.beginPath();
    ctx.moveTo(n1.x + dx1, n1.y + dy1);
    ctx.lineTo(n2.x + dx2, n2.y + dy2);
    ctx.stroke();

    // Raw (pre-scale) magnitudes for max tracking
    const mag1 = Math.hypot(UG[m.start * 2], UG[m.start * 2 + 1]);
    if (mag1 > maxMag) { maxMag = mag1; maxScreenX = n1.x + dx1; maxScreenY = n1.y + dy1; }
    const mag2 = Math.hypot(UG[m.end * 2], UG[m.end * 2 + 1]);
    if (mag2 > maxMag) { maxMag = mag2; maxScreenX = n2.x + dx2; maxScreenY = n2.y + dy2; }
  });

  ctx.setLineDash([]);

  // Canvas label at max-displaced node (gated on labelManager presence and non-trivial displacement)
  if (labelManager && maxMag > 1e-12) {
    const dfFs = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale());
    labelManager.add({
      text: 'δ=' + (maxMag * 1000).toFixed(3) + ' mm',
      anchorX: maxScreenX, anchorY: maxScreenY,
      preferredX: maxScreenX, preferredY: maxScreenY - 10,
      priority: 50,
      color: cssVar('--canvas-deflected'),
      font: 'bold ' + dfFs + 'px ' + MONO_FONT_FAMILY,
      fontSize: dfFs,
      bgColor: cssVar('--canvas-label-bg'),
      bgPadding: 2,
      textAlign: 'center',
      textBaseline: 'middle',
      type: 'diagram',
    });
  }
  } catch (err) {
    showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
    throw err;
  }
}

// ── Deflected shape toggle ────────────────────────────────────────────────
function updateScaleVisibility() {
  var defLabel = document.getElementById('deflectionScaleLabel');
  var chkDef   = document.getElementById('chkDeflected');
  if (defLabel) defLabel.style.display = (chkDef && chkDef.checked) ? '' : 'none';
}
document.getElementById('chkDeflected').addEventListener('change', function () {
  updateScaleVisibility();
  draw();
});
updateScaleVisibility();

// ── Coordinate display + pan ──────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  if (isPanning) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (LOGICAL_W / rect.width);
    const my = (e.clientY - rect.top)  * (LOGICAL_H / rect.height);
    view.tx = panStartTx + (mx - panStartX);
    view.ty = panStartTy + (my - panStartY);
    draw();
    return;
  }
  const { x: px, y: py } = toWorld(e.clientX, e.clientY);
  if (!origin) { document.getElementById('coords').textContent = 'x: — \u00a0 y: —'; return; }
  const rx = ((px - origin.x) / GRID * UNIT).toFixed(2);
  const ry = ((origin.y - py) / GRID * UNIT).toFixed(2);
  document.getElementById('coords').textContent = `x: ${rx} m \u00a0 y: ${ry} m`;
});

// ── Wheel zoom ────────────────────────────────────────────────────────────
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (LOGICAL_W / rect.width);
  const my = (e.clientY - rect.top)  * (LOGICAL_H / rect.height);
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  view.tx = mx - (mx - view.tx) * factor;
  view.ty = my - (my - view.ty) * factor;
  view.scale *= factor;
  draw();
}, { passive: false });

// ── Middle-mouse pan ──────────────────────────────────────────────────────
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) { clickDownX = e.clientX; clickDownY = e.clientY; }
  if (e.button !== 1) return;
  e.preventDefault();
  isPanning = true;
  const rect = canvas.getBoundingClientRect();
  panStartX = (e.clientX - rect.left) * (LOGICAL_W / rect.width);
  panStartY = (e.clientY - rect.top)  * (LOGICAL_H / rect.height);
  panStartTx = view.tx;
  panStartTy = view.ty;
});
canvas.addEventListener('mouseup',    () => { isPanning = false; });
canvas.addEventListener('mouseleave', () => { isPanning = false; });

function syncScaleControls(rangeId, numberId, onChange) {
  const range  = document.getElementById(rangeId);
  const number = document.getElementById(numberId);
  if (!range || !number) return;
  const sync = function (src, dst) {
    return function () {
      dst.value = src.value;
      try { onChange(); }
      catch (err) { showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err); throw err; }
    };
  };
  range.addEventListener('input',  sync(range, number));
  number.addEventListener('input', sync(number, range));
}

syncScaleControls('inputScaleRange', 'inputScale', draw);
document.getElementById('inputSymbolScale').addEventListener('input', draw);

// ── Save / Load model (Phase 3 interchange format) ────────────────────────
function updateSaveButtonState() {
  const btn = document.getElementById('btnSave');
  if (btn) btn.disabled = nodes.length === 0;
  var exp = document.getElementById('btnExport');
  if (exp) exp.disabled = !results;
}

function saveModel() {
  try {
  if (nodes.length === 0) return;

  // Solve payload — mirror solve() so file is directly POST-able to /solve/truss2d
  const E_GPa = parseFloat(document.getElementById('inputE').value);
  const A_cm2 = parseFloat(document.getElementById('inputA').value);
  const E = E_GPa * 1e9;
  // Per-member A: scalar when no overrides, array when any override present
  const anyA = members.some(m => m.A_override != null);
  const A = anyA
    ? members.map(m => (m.A_override != null ? m.A_override : A_cm2) * 1e-4)
    : A_cm2 * 1e-4;

  // restrainedDoF — 1-based, 2 DOF per node (Ux, Uy)
  const restrainedDoF = [];
  supports.forEach(s => {
    const base = s.nodeId * 2;
    if (s.type === 'pinned')  { restrainedDoF.push(base + 1, base + 2); }
    if (s.type === 'rollerX') { restrainedDoF.push(base + 1); }
    if (s.type === 'rollerY') { restrainedDoF.push(base + 2); }
  });

  // forceVector — flat, length = 2 * nNodes
  const forceVector = new Array(nodes.length * 2).fill(0);
  loads.forEach(l => {
    const idx = l.nodeId * 2 + (l.direction === 'y' ? 1 : 0);
    forceVector[idx] = l.magnitude;
  });

  // Canvas state per D-04 — supports as object keyed by nodeId string (NOT array)
  const canvasSupports = supports.reduce((obj, s) => {
    obj[String(s.nodeId)] = s.type;
    return obj;
  }, {});

  const model = {
    // Metadata — D-03
    schema_version: "1.0",
    solver: "truss2d",           // routing key AND engine name (coincide for truss2d)
    // Solve payload — mirrors Truss2DRequest (D-01)
    nodes:  nodes.map(n => [n.realX, n.realY]),
    members: members.map(m => [m.start + 1, m.end + 1]),
    E, A,
    forceVector,
    restrainedDoF,
    // Canvas state — D-02/D-04 shape
    canvas: {
      origin: origin ? { x: origin.x, y: origin.y } : null,
      nodes: JSON.parse(JSON.stringify(nodes)),
      members: JSON.parse(JSON.stringify(members)),
      supports: canvasSupports,
      // Each saved load carries its caseId (default to the active case if a legacy
      // in-memory load somehow lacks one — never write an untagged load).
      loads: loads.map(function (l) {
        return Object.assign({}, l, { caseId: l.caseId != null ? l.caseId : activeCaseId });
      }),
      // Load-case model (additive, optional — old readers ignore it). Mirrors the
      // memberOverrides default-on-read backward-compat pattern. Each case carries
      // its imposed `category` (null for non-imposed natures).
      loadCases: loadCases.map(function (c) {
        return { id: c.id, name: c.name, nature: c.nature, active: !!c.active, category: c.category != null ? c.category : null };
      }),
      // Combination model (additive, optional — old readers ignore it). Shared
      // shape for manual + generated rows (D-17). perCaseForces is NOT saved —
      // it is recomputed from the engine on the next generate (D-09).
      combinations: combinations.map(function (c) {
        return {
          id: c.id, name: c.name, cls: c.cls,
          terms: (c.terms || []).map(function (t) { return { caseId: t.caseId, factor: t.factor }; }),
          on: !!c.on, generated: !!c.generated, leading: c.leading || '',
        };
      }),
      // Per-member A overrides (additive, optional — old readers ignore it)
      memberOverrides: (function () {
        const ov = {};
        members.forEach(function (m, idx) {
          if (m.A_override != null) ov[String(idx)] = { A_cm2: m.A_override };
        });
        return ov;
      }()),
    },
  };

  // Trigger download — D-06: filename = truss2d-model-{ISO timestamp}.json
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const ts = now.getFullYear() + '-'
    + String(now.getMonth()+1).padStart(2,'0') + '-'
    + String(now.getDate()).padStart(2,'0') + 'T'
    + String(now.getHours()).padStart(2,'0') + '-'
    + String(now.getMinutes()).padStart(2,'0') + '-'
    + String(now.getSeconds()).padStart(2,'0');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'truss2d-model-' + ts + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  } catch (err) {
    showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
    throw err;
  }
}

function toggleExportMenu() {
  var m = document.getElementById('exportMenu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
function hideExportMenu() {
  document.getElementById('exportMenu').style.display = 'none';
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.export-dropdown')) hideExportMenu();
});

// Per-member governing-combination string (D-21). Returns the member's governing
// combination from the cached envelope (gov_tension for tension rows, gov_compression
// for compression rows). When NO combinations exist it returns the legacy top-level
// fallback string so the export keeps its pre-999.2 shape (T-9992-15, back-compat).
function governingComboFor(memberIndex, sense, fallback) {
  if (comboEnvelope && comboEnvelope.perMember && comboEnvelope.perMember.length
      && combinations.some(function (c) { return c.on; })) {
    var pm = comboEnvelope.perMember.find(function (p) { return p.member === memberIndex + 1; });
    if (pm) {
      var g = (sense === 'C') ? pm.govC : pm.govT;
      if (g) return g;
    }
  }
  return fallback;
}

function exportAnalysis(mode) {
  if (!results) return;
  mode = mode || 'presentation';
  var LOAD_COMBINATION = 'as-modelled — ULS factored by user (single case)';
  // When an envelope exists, the top-level field becomes a summary and each member
  // row carries its own governing string; otherwise the legacy single string stands.
  var hasEnvelope = comboEnvelope && comboEnvelope.perMember && comboEnvelope.perMember.length
                    && combinations.some(function (c) { return c.on; });
  var topLoadCombination = hasEnvelope ? 'ULS/SLS envelope — see per-member' : LOAD_COMBINATION;
  var E_GPa = parseFloat(document.getElementById('inputE').value);
  var A_cm2 = parseFloat(document.getElementById('inputA').value);

  var tensionMembers = [];
  var compressionMembers = [];

  // Build one export row. forceN is the design axial force carried into the row;
  // stress is recomputed from it so force/stress always correspond to the SAME
  // (factored, when enveloped) force the row reports.
  function buildExportRow(idx, forceN, comboStr) {
    var m = members[idx];
    var n1 = nodes.find(function (n) { return n.id === m.start; });
    var n2 = nodes.find(function (n) { return n.id === m.end; });
    var L = (n1 && n2) ? Math.hypot(n2.realX - n1.realX, n2.realY - n1.realY) : 0;
    var effA_cm2 = (m && m.A_override != null) ? m.A_override : A_cm2;
    var stressMPa = (effA_cm2 > 0) ? (forceN / (effA_cm2 * 1e-4)) / 1e6 : null;
    return {
      member: idx + 1,
      nodes: [m.start + 1, m.end + 1],
      length_m: parseFloat(L.toFixed(4)),
      force_kN: parseFloat((forceN / 1000).toFixed(3)),
      force_N: forceN,
      stress_MPa: stressMPa !== null ? parseFloat(stressMPa.toFixed(2)) : null,
      A_cm2: parseFloat(effA_cm2.toFixed(4)),
      A_mm2: parseFloat((effA_cm2 * 100).toFixed(2)),
      sense: forceN > 0 ? 'T' : 'C',
      load_combination: comboStr
    };
  }

  if (hasEnvelope) {
    // D-21 (WR-02): when combinations exist, each member row carries its FACTORED
    // governing-combination force (NEd) — maxT/govT for tension, maxC/govC for
    // compression — mirroring the ENVELOPE results view. This is the force the
    // SEED-005 marimo reader consumes as NEd, so it MUST be the factored design
    // force, not the unfactored single solve. A member can appear in BOTH tables
    // under different governing combinations (e.g. wind-uplift reversal).
    comboEnvelope.perMember.forEach(function (p) {
      if (!members[p.member - 1]) return;
      if (p.maxT > 1e-3)  tensionMembers.push(buildExportRow(p.member - 1, p.maxT, p.govT));
      if (p.maxC < -1e-3) compressionMembers.push(buildExportRow(p.member - 1, p.maxC, p.govC));
    });
    tensionMembers.sort(function (a, b) { return Math.abs(b.force_N) - Math.abs(a.force_N); });
    compressionMembers.sort(function (a, b) { return Math.abs(b.force_N) - Math.abs(a.force_N); });
  } else if (results.member_forces) {
    // Legacy single-solve path (no combinations) — unfactored forces + top-level
    // string. Preserves the original export shape exactly (stress from solver meta).
    var rows = [];
    results.member_forces.forEach(function (f, idx) {
      var row = buildExportRow(idx, f, LOAD_COMBINATION);
      var stress = results.meta && results.meta.member_stresses ? results.meta.member_stresses[idx] : null;
      if (stress !== null) row.stress_MPa = parseFloat((stress / 1e6).toFixed(2));
      rows.push(row);
    });
    rows.sort(function (a, b) { return Math.abs(b.force_N) - Math.abs(a.force_N); });
    rows.forEach(function (r) {
      if (Math.abs(r.force_N) < 1e-3) return;
      if (r.force_N > 0) tensionMembers.push(r);
      else compressionMembers.push(r);
    });
  }

  var reactions = [];
  if (results.FG) {
    supports.forEach(function (s) {
      var base = s.nodeId * 2;
      var dirs = s.type === 'pinned' ? ['x', 'y'] : s.type === 'rollerX' ? ['x'] : ['y'];
      dirs.forEach(function (dir) {
        var idx = base + (dir === 'y' ? 1 : 0);
        reactions.push({
          node: s.nodeId + 1,
          direction: dir.toUpperCase(),
          reaction_kN: parseFloat((results.FG[idx] / 1000).toFixed(3))
        });
      });
    });
  }

  var displacements = [];
  if (results.UG) {
    nodes.forEach(function (n, i) {
      displacements.push({
        node: i + 1,
        ux_mm: parseFloat((results.UG[i * 2] * 1000).toFixed(4)),
        uy_mm: parseFloat((results.UG[i * 2 + 1] * 1000).toFixed(4))
      });
    });
  }

  var now = new Date();
  var ts = now.getFullYear() + '-'
    + String(now.getMonth() + 1).padStart(2, '0') + '-'
    + String(now.getDate()).padStart(2, '0') + 'T'
    + String(now.getHours()).padStart(2, '0') + '-'
    + String(now.getMinutes()).padStart(2, '0') + '-'
    + String(now.getSeconds()).padStart(2, '0');

  // Save current state
  var allChkIds = ['chkGrid', 'chkNodeLabels', 'chkSupports', 'chkLoads', 'chkReactions',
                   'chkDeflected', 'chkNodeIds', 'chkMemberIds', 'chkMemberForces'];
  var savedChk = {};
  allChkIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) savedChk[id] = el.checked;
  });
  var savedView = { scale: view.scale, tx: view.tx, ty: view.ty };

  if (mode === 'presentation') {
    // Automated best-practice: node IDs, member forces, supports, loads, reactions ON
    // Grid, DOF labels, member IDs, deflected OFF
    var onIds  = ['chkNodeIds', 'chkMemberForces', 'chkSupports', 'chkLoads', 'chkReactions'];
    var offIds = ['chkGrid', 'chkNodeLabels', 'chkMemberIds', 'chkDeflected'];
    onIds.forEach(function (id) { var el = document.getElementById(id); if (el) el.checked = true; });
    offIds.forEach(function (id) { var el = document.getElementById(id); if (el) el.checked = false; });
  } else {
    // As displayed: just hide grid for clean background
    var gridEl = document.getElementById('chkGrid');
    if (gridEl) gridEl.checked = false;
  }

  exportMode = true;
  resetView();

  var offscreen = document.createElement('canvas');
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;
  var offCtx = offscreen.getContext('2d');
  offCtx.fillStyle = '#ffffff';
  offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
  offCtx.drawImage(canvas, 0, 0);
  var canvasImage = offscreen.toDataURL('image/png');

  exportMode = false;
  view.scale = savedView.scale;
  view.tx = savedView.tx;
  view.ty = savedView.ty;
  Object.keys(savedChk).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.checked = savedChk[id];
  });
  draw();

  var pkg = {
    schema_version: '1.2',
    type: 'truss2d-analysis',
    timestamp: now.toISOString(),
    load_combination: topLoadCombination,
    canvas_image: canvasImage,
    metadata: {
      solver: 'truss2d',
      n_nodes: nodes.length,
      n_members: members.length,
      E_GPa: E_GPa,
      A_cm2: A_cm2,
      E_Pa: E_GPa * 1e9,
      A_m2: A_cm2 * 1e-4
    },
    nodes: nodes.map(function (n) {
      return { id: n.id + 1, x: n.realX, y: n.realY };
    }),
    members: members.map(function (m, i) {
      var n1 = nodes.find(function (n) { return n.id === m.start; });
      var n2 = nodes.find(function (n) { return n.id === m.end; });
      var L = (n1 && n2) ? Math.hypot(n2.realX - n1.realX, n2.realY - n1.realY) : 0;
      var mEffA_cm2 = (m.A_override != null) ? m.A_override : A_cm2;
      return {
        member: i + 1,
        nodes: [m.start + 1, m.end + 1],
        length_m: parseFloat(L.toFixed(4)),
        A_cm2: parseFloat(mEffA_cm2.toFixed(4)),
        A_mm2: parseFloat((mEffA_cm2 * 100).toFixed(2))
      };
    }),
    tension_members: tensionMembers,
    compression_members: compressionMembers,
    reactions: reactions,
    displacements: displacements
  };

  var blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'truss2d-analysis-' + ts + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerLoad() {
  document.getElementById('fileInput').click();
}

document.getElementById('fileInput').addEventListener('change', function(e) {
  try {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    let data;
    try {
      data = JSON.parse(evt.target.result);
    } catch {
      alert("Could not read file. Make sure it is a valid PDA JSON file.");
      e.target.value = '';
      return;
    }
    if (!data.schema_version || !data.solver || !data.nodes || !data.members) {
      alert("File is missing required data. The file may be from an older version.");
      e.target.value = '';
      return;
    }
    if (data.solver !== 'truss2d') {
      alert("This file is for the " + data.solver + " solver and cannot be loaded here.");
      e.target.value = '';
      return;
    }
    if (nodes.length > 0 && !confirm("This will replace the current structure. Continue?")) {
      e.target.value = '';
      return;
    }

    // Restore canvas state
    origin   = data.canvas && data.canvas.origin ? data.canvas.origin : null;
    nodes    = data.canvas && data.canvas.nodes ? data.canvas.nodes : [];
    members  = data.canvas && data.canvas.members ? data.canvas.members : [];

    // D-04: supports is an object keyed by nodeId — convert back to array
    const sObj = (data.canvas && data.canvas.supports) || {};
    supports = Object.entries(sObj).map(([nodeId, type]) => ({
      nodeId: parseInt(nodeId, 10),
      type: type,
    }));

    // truss2d uses "loads" (not nodeLoads)
    loads = (data.canvas && data.canvas.loads) ? data.canvas.loads : [];

    // Restore the load-case model (additive, default-on-read — mirrors the
    // memberOverrides pattern). If the file carries loadCases, restore them and
    // set activeCaseId to the first active (or first) case. Otherwise (legacy
    // untyped file) create the default Dead case and assign every load to it.
    // ensureDefaultCase() repairs any dangling activeCaseId. Never leave a load
    // without a caseId and never leave loadCases empty. (T-9992-09 mitigation.)
    if (data.canvas && Array.isArray(data.canvas.loadCases) && data.canvas.loadCases.length > 0) {
      loadCases = data.canvas.loadCases.map(function (c) {
        return {
          id: c.id != null ? c.id : makeCaseId(),
          name: c.name != null ? c.name : 'Case',
          nature: c.nature != null ? c.nature : 'Dead',
          active: !!c.active,
          category: c.nature === 'Imposed'
            ? (c.category != null ? c.category : DEFAULT_IMPOSED_CATEGORY)
            : null,
        };
      });
      const act = loadCases.find(function (c) { return c.active; }) || loadCases[0];
      activeCaseId = act.id;
      ensureDefaultCase();
      // Any load whose caseId no longer resolves to a case → reassign to active.
      const validIds = new Set(loadCases.map(function (c) { return c.id; }));
      loads.forEach(function (l) { if (!validIds.has(l.caseId)) l.caseId = activeCaseId; });
    } else {
      loadCases = []; activeCaseId = null;
      ensureDefaultCase();
      loads.forEach(function (l) { l.caseId = activeCaseId; });
    }

    // Restore the combination model (additive, default-on-read). perCaseForces is
    // left empty — it is recomputed from the engine on the next generate; the
    // restored rows render with a 0 "governs" badge until then (D-09).
    combinations = []; perCaseForces = {}; perCaseDisp = {}; comboEnvelope = null; wizardPreview = [];
    // Wave-5 view/traceability state is transient — never persisted, reset on load.
    resultsView = 'auto'; selectedResultCaseId = null; selectedResultComboId = null;
    selectedComboName = null; selectedMemberDetail = null;
    if (typeof hideMemberDetail === 'function') hideMemberDetail();
    if (data.canvas && Array.isArray(data.canvas.combinations)) {
      combinations = data.canvas.combinations.map(function (c) {
        return {
          id: c.id != null ? c.id : makeComboId(),
          name: c.name != null ? c.name : 'Combination',
          cls: c.cls != null ? c.cls : 'STR',
          terms: Array.isArray(c.terms)
            ? c.terms.map(function (t) { return { caseId: t.caseId, factor: t.factor }; })
            : [],
          on: c.on !== false,
          generated: !!c.generated,
          leading: c.leading || '',
        };
      });
    }

    // Restore per-member A overrides (backward-compat: missing key → no overrides)
    if (data.canvas && data.canvas.memberOverrides) {
      Object.entries(data.canvas.memberOverrides).forEach(function ([idx, ov]) {
        const m = members[parseInt(idx, 10)];
        if (m) m.A_override = ov.A_cm2 != null ? ov.A_cm2 : null;
      });
    }

    // Recalculate pixel positions from real coordinates + origin (Pitfall 1)
    nodes.forEach(syncPixelFromReal);

    // Reset solve + history + transient UI state
    results = null;
    history = [];
    currentMemberStart = null;

    const resultsPanel = document.getElementById('resultsPanel');
    if (resultsPanel) resultsPanel.style.display = 'none';

    if (typeof renderCaseTable === 'function') renderCaseTable();
    if (typeof renderCombinationTable === 'function') renderCombinationTable();
    updateSaveButtonState();
    setStatus('', false);
    draw();

    // Pitfall 6 — reset input so same file can reload
    e.target.value = '';
  };
  reader.readAsText(file);
  } catch (err) {
    showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
    throw err;
  }
});

// ── Results tables ────────────────────────────────────────────────────────
function createDownloadLink(res) {
  if (_lastBlobUrl) URL.revokeObjectURL(_lastBlobUrl);
  const json = JSON.stringify(res, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  _lastBlobUrl = URL.createObjectURL(blob);

  const now = new Date();
  const ts = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '-'
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  const filename = (res.solver || 'results') + '-results-' + ts + '.json';

  const a = document.createElement('a');
  a.href = _lastBlobUrl;
  a.download = filename;
  a.textContent = 'Download results (JSON)';
  a.className = 'download-link';
  a.style.display = 'block';
  a.style.marginBottom = '8px';
  return a;
}

function renderResults(res) {
  // Remove any existing download link
  const existingLink = document.querySelector('.download-link');
  if (existingLink) existingLink.remove();

  // Add download link at top of results panel
  const panel = document.getElementById('resultsPanel');
  const downloadLink = createDownloadLink(res);
  panel.insertBefore(downloadLink, panel.firstChild);

  // Member-force tables, view-aware (D-20): per-case / per-combination / ENVELOPE.
  // (rView is the results view; do NOT confuse with the global canvas-transform `view`.)
  var rView = effectiveResultsView();
  populateResultsSelectors(rView);
  var tBody = document.querySelector('#tableTension tbody');
  var cBody = document.querySelector('#tableCompression tbody');
  tBody.innerHTML = '';
  cBody.innerHTML = '';

  // Governing column appears only in the ENVELOPE view (C7).
  var showGov = (rView === 'envelope');
  document.querySelectorAll('#tableTension .gov-col, #tableCompression .gov-col')
    .forEach(function (el) { el.style.display = showGov ? '' : 'none'; });
  var hint = document.getElementById('resultsViewHint');

  if (rView === 'envelope') {
    // One row PER MEMBER (legibility-at-scale, NOT one row per combination) with the
    // governing combination filled from the cached envelope (D-18/D-19 forward map).
    var pm = (comboEnvelope && comboEnvelope.perMember) ? comboEnvelope.perMember : [];
    if (!pm.length) {
      if (hint) { hint.textContent = 'Run combinations to see which one governs each member.'; hint.style.display = ''; }
    } else {
      if (hint) hint.style.display = 'none';
      var tRows = [], cRows = [];
      pm.forEach(function (p) {
        var m = members[p.member - 1];
        if (!m) return;
        if (p.maxT > 1e-3)  tRows.push({ idx: p.member - 1, m: m, f: p.maxT, gov: p.govT });
        if (p.maxC < -1e-3) cRows.push({ idx: p.member - 1, m: m, f: p.maxC, gov: p.govC });
      });
      tRows.sort(function (a, b) { return Math.abs(b.f) - Math.abs(a.f); });
      cRows.sort(function (a, b) { return Math.abs(b.f) - Math.abs(a.f); });
      tRows.forEach(function (r) { tBody.appendChild(buildForceRow(r, true)); });
      cRows.forEach(function (r) { cBody.appendChild(buildForceRow(r, true)); });
    }
  } else {
    if (hint) hint.style.display = 'none';
    var forces = forcesForView(rView, res);   // per-case / per-combination / single-solve
    if (forces) {
      var rows = [];
      forces.forEach(function (f, idx) {
        if (!members[idx]) return;
        rows.push({ idx: idx, f: f, m: members[idx], gov: null });
      });
      rows.sort(function (a, b) { return Math.abs(b.f) - Math.abs(a.f); });
      rows.forEach(function (r) {
        if (Math.abs(r.f) < 1e-3) return;
        var tr = buildForceRow(r, false);
        if (r.f > 0) tBody.appendChild(tr);
        else         cBody.appendChild(tr);
      });
    }
  }

  // Reactions (restrained DOFs only)
  const rBody = document.querySelector('#tableReactions tbody');
  rBody.innerHTML = '';
  const FG = res.FG;
  supports.forEach(s => {
    const base = s.nodeId * 2;
    const dirs = s.type === 'pinned' ? ['x', 'y']
               : s.type === 'rollerX' ? ['x']
               : ['y'];
    dirs.forEach(dir => {
      const idx = base + (dir === 'y' ? 1 : 0);
      const val = (FG[idx] / 1000).toFixed(3);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.nodeId + 1}</td><td>${dir.toUpperCase()}</td><td>${val}</td>`;
      rBody.appendChild(tr);
    });
  });

  // Nodal displacements
  const dBody = document.querySelector('#tableDisplacements tbody');
  dBody.innerHTML = '';
  const UG = res.UG;

  // δ_max summary row (D-13): when combinations exist, the deflection check is
  // driven by the SLS-characteristic combination/envelope (the worst δ over the on
  // SLS combinations) and labelled with the governing SLS combination. When no
  // combinations exist it falls back to the single-solve δ_max (back-compat).
  const dMaxTr = document.createElement('tr');
  const sls = slsEnvelopeDeltaMax();
  if (sls) {
    dMaxTr.innerHTML = '<td><b>δ_max</b></td><td colspan="2">' +
      (sls.delta * 1000).toFixed(4) + ' mm @ Node ' + sls.node +
      ' <span class="dmax-gov">(SLS: ' + esc(sls.combo) + ')</span></td>';
  } else {
    let dMaxMag = 0, dMaxNode = 0;
    nodes.forEach((n, i) => {
      const mag = Math.hypot(UG[i * 2], UG[i * 2 + 1]);
      if (mag > dMaxMag) { dMaxMag = mag; dMaxNode = i + 1; }  // 1-based for display
    });
    if (dMaxMag > 1e-12) {
      dMaxTr.innerHTML = '<td><b>δ_max</b></td><td colspan="2">' +
        (dMaxMag * 1000).toFixed(4) + ' mm @ Node ' + dMaxNode + '</td>';
    } else {
      dMaxTr.innerHTML = '<td><b>δ_max</b></td><td colspan="2">—</td>';
    }
  }
  dBody.appendChild(dMaxTr);

  nodes.forEach((n, i) => {
    const ux = (UG[i * 2]     * 1000).toFixed(4);  // m → mm
    const uy = (UG[i * 2 + 1] * 1000).toFixed(4);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}</td><td>${ux}</td><td>${uy}</td>`;
    dBody.appendChild(tr);
  });

  // Keep an open member-detail strip in sync after a re-render (e.g. factor edit).
  if (selectedMemberDetail !== null) showMemberDetail(selectedMemberDetail);

  document.getElementById('resultsPanel').style.display = 'block';
}

// ── Load-Case panel (Phase 999.2 Wave 3 — C1/C2) ────────────────────────────
const NATURE_TOKEN = {
  'Self weight': '--canvas-nature-self',
  'Dead':        '--canvas-nature-dead',
  'Imposed':     '--canvas-nature-imposed',
  'Wind':        '--canvas-nature-wind',
};

// Resolve a case nature to its canvas-nature token colour; unknown natures fall
// back to the legacy load green (T-9992-10 — unknown nature is a display key only).
function natureColor(nature) {
  const tok = NATURE_TOKEN[nature];
  const v = tok ? cssVar(tok) : '';
  return v || cssVar('--canvas-load');
}

function caseLoadCount(caseId) {
  return loads.reduce((n, l) => n + (l.caseId === caseId ? 1 : 0), 0);
}

// Keep each case's `active` flag in sync with activeCaseId (the flag is persisted
// in save/load; activeCaseId is the live source of truth).
function syncActiveFlags() {
  loadCases.forEach(c => { c.active = (c.id === activeCaseId); });
}

function addLoadCase() {
  const c = { id: makeCaseId(), name: 'Case ' + (loadCases.length + 1), nature: 'Dead', active: true, category: null };
  loadCases.push(c);
  activeCaseId = c.id;
  renderCaseTable();
  draw();
}

function setActiveCase(id) {
  if (!loadCases.some(c => c.id === id)) return;
  activeCaseId = id;
  renderCaseTable();
  draw();
}

function renameCase(id, name) {
  const c = loadCases.find(x => x.id === id);
  if (c) c.name = name && name.trim() ? name.trim() : c.name;
}

function setCaseNature(id, nature) {
  const c = loadCases.find(x => x.id === id);
  if (!c) return;
  c.nature = nature;
  // Imposed cases carry a ψ0 category (engine, Plan 01); others clear it.
  if (nature === 'Imposed') {
    if (c.category == null) c.category = DEFAULT_IMPOSED_CATEGORY;
  } else {
    c.category = null;
  }
  renderCaseTable();
  draw();
}

function setCaseCategory(id, category) {
  const c = loadCases.find(x => x.id === id);
  if (c && c.nature === 'Imposed') c.category = category;
}

function deleteCase(id) {
  if (loadCases.length <= 1) { setStatus('At least one load case is required.', true); return; }
  const c = loadCases.find(x => x.id === id);
  if (!c) return;
  const n = caseLoadCount(id);
  const fallback = loadCases.find(x => x.id !== id && x.nature === 'Dead')
                || loadCases.find(x => x.id !== id);
  if (n > 0) {
    // Destructive copy (UI-SPEC): never silently drop loads — offer reassign or delete.
    if (!confirm("Case '" + c.name + "' has " + n + " load" + (n > 1 ? 's' : '') +
                 ". Delete the case?\n\nOK to continue, Cancel to keep it.")) return;
    const reassign = confirm("Reassign its " + n + " load" + (n > 1 ? 's' : '') +
                 " to '" + fallback.name + "'?\n\nOK = move the loads.   Cancel = delete the loads too.");
    if (reassign) loads.forEach(l => { if (l.caseId === id) l.caseId = fallback.id; });
    else          loads = loads.filter(l => l.caseId !== id);
  }
  const wasActive = (activeCaseId === id);
  loadCases = loadCases.filter(x => x.id !== id);
  if (wasActive) activeCaseId = fallback.id;
  ensureDefaultCase();
  results = null;
  renderCaseTable();
  draw();
}

function renderCaseTable() {
  syncActiveFlags();
  const sel  = document.getElementById('activeCaseSelect');
  const body = document.getElementById('caseTableBody');
  if (!sel || !body) return;

  // Active-case selector (C2)
  sel.innerHTML = '';
  loadCases.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name + ' (' + c.nature + ')';
    if (c.id === activeCaseId) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = function () { setActiveCase(sel.value); };

  // One row per case: [swatch] [name] [nature ▾] [category ▾ if imposed] [count] [✕]
  body.innerHTML = '';
  loadCases.forEach(c => {
    const row = document.createElement('div');
    row.className = 'case-row' + (c.id === activeCaseId ? ' active' : '');

    const swatch = document.createElement('span');
    swatch.className = 'case-swatch';
    swatch.style.background = natureColor(c.nature);
    row.appendChild(swatch);

    const name = document.createElement('input');
    name.className = 'case-name';
    name.type = 'text';
    name.value = c.name;
    name.setAttribute('aria-label', 'Load case name');
    name.addEventListener('change', function () { renameCase(c.id, name.value); renderCaseTable(); });
    row.appendChild(name);

    const nat = document.createElement('select');
    nat.className = 'case-nature';
    nat.setAttribute('aria-label', 'Load case nature');
    // Render the 4 known natures plus any extra enum value already on the case
    // (D-02 forward-extensible — new natures appear without code change).
    const natureOpts = CASE_NATURES.slice();
    if (natureOpts.indexOf(c.nature) === -1) natureOpts.push(c.nature);
    natureOpts.forEach(nm => {
      const o = document.createElement('option');
      o.value = nm; o.textContent = nm;
      if (nm === c.nature) o.selected = true;
      nat.appendChild(o);
    });
    nat.addEventListener('change', function () { setCaseNature(c.id, nat.value); });
    row.appendChild(nat);

    // Imposed-only ψ0 category selector
    if (c.nature === 'Imposed') {
      const cat = document.createElement('select');
      cat.className = 'case-category';
      cat.setAttribute('aria-label', 'Imposed category');
      IMPOSED_CATEGORIES.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.label;
        if (o.value === (c.category || DEFAULT_IMPOSED_CATEGORY)) opt.selected = true;
        cat.appendChild(opt);
      });
      cat.addEventListener('change', function () { setCaseCategory(c.id, cat.value); });
      row.appendChild(cat);
    }

    const count = document.createElement('span');
    count.className = 'case-count';
    const n = caseLoadCount(c.id);
    count.textContent = n + ' load' + (n === 1 ? '' : 's');
    row.appendChild(count);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'case-delete';
    del.textContent = '✕';
    del.title = 'Delete case';
    del.setAttribute('aria-label', 'Delete load case ' + c.name);
    del.addEventListener('click', function () { deleteCase(c.id); });
    row.appendChild(del);

    body.appendChild(row);
  });
}

// ── Combination table (C3) ──────────────────────────────────────────────────
function caseLabel(caseId) {
  const c = loadCases.find(function (x) { return x.id === caseId; });
  return c ? c.name : caseId;
}

// Trim a factor to a clean string (1.05, 1.5, 0.9 …) without trailing zeros.
function formatFactor(f) {
  if (!isFinite(f)) return '';
  return String(Math.round(f * 10000) / 10000);
}

// Build the editable terms cell: one factor input per term + "·CaseName", joined
// by " + ", plus a plain leading-action tag. Editing a factor commits + recombines.
function buildTermsCell(host, combo) {
  host.innerHTML = '';
  const terms = combo.terms || [];
  if (!terms.length) {
    const s = document.createElement('span');
    s.className = 'combo-term-empty';
    s.textContent = '—';
    host.appendChild(s);
    return;
  }
  terms.forEach(function (t, i) {
    if (i > 0) {
      const op = document.createElement('span');
      op.className = 'combo-op';
      op.textContent = ' + ';
      host.appendChild(op);
    }
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'combo-factor';
    inp.value = formatFactor(t.factor);
    inp.setAttribute('aria-label', 'Factor for ' + caseLabel(t.caseId));
    inp.addEventListener('change', function () { commitFactor(combo, t, inp); });
    host.appendChild(inp);
    const sym = document.createElement('span');
    sym.className = 'combo-sym';
    sym.textContent = '·' + caseLabel(t.caseId);
    host.appendChild(sym);
  });
  if (combo.leading) {
    const tag = document.createElement('span');
    tag.className = 'combo-lead-tag';
    tag.textContent = combo.leading + ' leading';
    host.appendChild(tag);
  }
}

// Validate + commit a factor edit (T-9992-11), then re-superpose in JS only.
function commitFactor(combo, term, inp) {
  const v = parseFloat(inp.value);
  if (!isFinite(v)) {                                  // blank / NaN — not committed
    setStatus('Enter a number for every factor.', true);
    inp.value = formatFactor(term.factor);
    return;
  }
  term.factor = v;
  inp.value = formatFactor(v);
  setStatus('', false);
  recombine();                                         // NO fetch — D-09 / Pitfall 6
}

function renderCombinationTable() {
  const tbl = document.getElementById('tableCombinations');
  const empty = document.getElementById('comboEmpty');
  if (!tbl) return;
  const tbody = tbl.querySelector('tbody');
  tbody.innerHTML = '';

  if (!combinations.length) {
    tbl.style.display = 'none';
    if (empty) empty.style.display = '';
    return;
  }
  tbl.style.display = '';
  if (empty) empty.style.display = 'none';

  // Recompute the envelope so the badges are correct on (re)render.
  const active = combinations.filter(function (c) { return c.on; });
  comboEnvelope = envelopeJS(active);

  combinations.forEach(function (c) {
    const tr = document.createElement('tr');
    if (!c.on) tr.className = 'combo-off';
    if (selectedComboName && c.name === selectedComboName) tr.classList.add('combo-selected');
    tr.title = 'Click to highlight the members this combination governs on the canvas';
    // Reverse index (D-19 / C8): clicking the row (but not its inputs/buttons)
    // selects this combination so draw() paints the governing halo on the members
    // it governs. Clicking again deselects.
    tr.addEventListener('click', function (e) {
      if (e.target.closest('input, button, select')) return;
      selectComboForCanvas(c.id);
    });

    // on/off
    const tdOn = document.createElement('td');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!c.on;
    chk.setAttribute('aria-label', 'Include combination ' + c.name + ' in the envelope');
    chk.addEventListener('change', function () { c.on = chk.checked; renderCombinationTable(); });
    tdOn.appendChild(chk);
    tr.appendChild(tdOn);

    // name (inline editable)
    const tdName = document.createElement('td');
    const nm = document.createElement('input');
    nm.type = 'text';
    nm.className = 'combo-name';
    nm.value = c.name;
    nm.setAttribute('aria-label', 'Combination name');
    nm.addEventListener('change', function () { c.name = nm.value.trim() || c.name; recombine(); });
    tdName.appendChild(nm);
    tr.appendChild(tdName);

    // class chip
    const tdCls = document.createElement('td');
    const chip = document.createElement('span');
    chip.className = 'combo-chip combo-chip-' + String(c.cls || '').toLowerCase();
    chip.textContent = c.cls || '';
    tdCls.appendChild(chip);
    tr.appendChild(tdCls);

    // terms (font-mono, inline editable)
    const tdTerms = document.createElement('td');
    tdTerms.className = 'combo-terms';
    buildTermsCell(tdTerms, c);
    tr.appendChild(tdTerms);

    // governs badge (reverse index, D-19)
    const tdGov = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'combo-governs';
    badge.setAttribute('data-governs-for', c.id);
    badge.textContent = 'governs ' + (comboEnvelope.governs[c.id] || 0);
    tdGov.appendChild(badge);
    tr.appendChild(tdGov);

    // delete (danger, inline confirm)
    const tdDel = document.createElement('td');
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'combo-delete';
    del.textContent = '✕';
    del.title = 'Delete combination';
    del.setAttribute('aria-label', 'Delete combination ' + c.name);
    del.addEventListener('click', function () { deleteCombination(c.id); });
    tdDel.appendChild(del);
    tr.appendChild(tdDel);

    tbody.appendChild(tr);
  });
}

// Add a blank manual combination using the shared shape (D-17). Seeds one term
// per load case at factor 0 so the user can fill in factors. Populates the
// per-case cache once (explicit action — a network call here is allowed; factor
// edits stay offline) so the new row can immediately envelope.
async function addManualCombination() {
  const n = combinations.filter(function (c) { return !c.generated; }).length + 1;
  const terms = loadCases.map(function (c) { return { caseId: c.id, factor: 0 }; });
  combinations.push({
    id: makeComboId(), name: 'Manual-' + n, cls: 'STR',
    terms: terms, on: true, generated: false, leading: '',
  });
  renderCombinationTable();
  if (!Object.keys(perCaseForces).length) {
    const data = await fetchCombinations(null);   // generate-less — just cache per_case
    if (data) recombine();
  }
}

function deleteCombination(id) {
  const c = combinations.find(function (x) { return x.id === id; });
  if (!c) return;
  if (!confirm('Delete combination ' + c.name + '? This removes it from the envelope.')) return;
  combinations = combinations.filter(function (x) { return x.id !== id; });
  renderCombinationTable();
}

function clearGeneratedCombinations() {
  if (!combinations.some(function (c) { return c.generated; })) {
    setStatus('No generated combinations to clear.', false);
    return;
  }
  if (!confirm('Clear all generated combinations? Manual rows are kept.')) return;
  combinations = combinations.filter(function (c) { return !c.generated; });
  renderCombinationTable();
}

// ── Combinations payload + engine call ──────────────────────────────────────
// Build the request body for POST /solve/truss2d/combinations. Mirrors solve()'s
// geometry/material build verbatim, then attaches the case model + optional
// generate spec. Returns null (after setStatus) when the model is not solvable.
function buildCombinationsPayload(generateSpec) {
  if (nodes.length < 2)    { setStatus('Need at least 2 nodes.', true); return null; }
  if (members.length < 1)  { setStatus('Need at least 1 member.', true); return null; }
  if (supports.length < 1) { setStatus('Need at least one support.', true); return null; }

  const E_GPa = parseFloat(document.getElementById('inputE').value);
  const A_cm2 = parseFloat(document.getElementById('inputA').value);
  if (isNaN(E_GPa) || isNaN(A_cm2) || E_GPa <= 0 || A_cm2 <= 0) {
    setStatus('Check E and A values.', true);
    return null;
  }
  const E = E_GPa * 1e9;
  const anyA = members.some(function (m) { return m.A_override != null; });
  const A = anyA
    ? members.map(function (m) { return (m.A_override != null ? m.A_override : A_cm2) * 1e-4; })
    : A_cm2 * 1e-4;

  const restrainedDoF = [];
  supports.forEach(function (s) {
    const base = s.nodeId * 2;
    if (s.type === 'pinned')  { restrainedDoF.push(base + 1, base + 2); }
    if (s.type === 'rollerX') { restrainedDoF.push(base + 1); }
    if (s.type === 'rollerY') { restrainedDoF.push(base + 2); }
  });

  const cases = loadCases.map(function (c) {
    return {
      id: c.id,
      name: c.name,
      nature: c.nature,
      category: c.nature === 'Imposed' ? (c.category || DEFAULT_IMPOSED_CATEGORY) : null,
      loads: loads.filter(function (l) { return l.caseId === c.id; })
                  .map(function (l) { return { nodeId: l.nodeId, direction: l.direction, magnitude: l.magnitude }; }),
    };
  });

  const payload = {
    solver: 'truss2d',
    nodes:  nodes.map(function (n) { return [n.realX, n.realY]; }),
    members: members.map(function (m) { return [m.start + 1, m.end + 1]; }),  // 1-based
    E: E, A: A,
    restrainedDoF: restrainedDoF,
    cases: cases,
  };
  if (generateSpec) payload.generate = generateSpec;
  return payload;
}

// Map a structured-422 cause to the UI-SPEC error copy (falls back to detail).
function comboErrorCopy(err) {
  const cause = err && err.cause;
  if (cause === 'unknown_case')   return 'A combination references a case that no longer exists. Remove the term or restore the case.';
  if (cause === 'non_finite_factor') return 'Enter a number for every factor.';
  if (cause === 'no_loaded_cases') return 'Add a load to a case before generating combinations.';
  return (err && err.detail) || 'Combination generation failed.';
}

// Call the engine. Caches per_case forces into perCaseForces and returns the full
// response (or null on error). The wizard passes a generate spec; manual add
// passes null (just to populate the cache).
async function fetchCombinations(generateSpec) {
  const payload = buildCombinationsPayload(generateSpec);
  if (!payload) return null;
  try {
    const res = await fetch(`${API_URL}/solve/truss2d/combinations`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) {
      let err = {};
      try { err = await res.json(); } catch (e) { /* non-JSON */ }
      setStatus(comboErrorCopy(err), true);
      return null;
    }
    const data = await res.json();
    perCaseForces = {};
    perCaseDisp = {};
    Object.keys(data.per_case || {}).forEach(function (cid) {
      perCaseForces[cid] = (data.per_case[cid] && data.per_case[cid].member_forces) || [];
      // Cache per-case displacements too so the SLS-characteristic δ_max (D-13) can
      // be re-superposed in JS on factor edits with no re-solve (mirrors perCaseForces).
      perCaseDisp[cid]   = (data.per_case[cid] && data.per_case[cid].displacements) || [];
    });
    // The engine also returns each generated combination's delta_max_m (Plan 02
    // response). The UI re-derives δ_max from perCaseDisp so it stays correct when a
    // factor is edited (D-09); the engine delta_max_m is the un-edited reference.
    if (data.combinations) {
      data.combinations.forEach(function (c) { c._engine_delta_max_m = c.delta_max_m; });
    }
    return data;
  } catch (e) {
    setStatus('Cannot reach API. Is the server running?', true);
    return null;
  }
}

// Reconstruct {caseId, factor} terms from the engine's expression string (e.g.
// "1.35·Dead + 1.5·Imposed + 0.9·Wind"). Factors come straight from the engine
// output — the UI never computes γ/ψ (D-08). The nature symbol maps back to the
// case it was generated from (consumed in case order for repeated natures).
function reconstructTerms(expression) {
  const parts = String(expression || '').split('+').map(function (s) { return s.trim(); }).filter(Boolean);
  const loaded = loadCases.filter(function (c) { return caseLoadCount(c.id) > 0; });
  const used = {};
  const terms = [];
  parts.forEach(function (p) {
    const seg = p.split('·');
    if (seg.length < 2) return;
    const factor = parseFloat(seg[0]);
    const symbol = seg.slice(1).join('·').trim();
    const matches = loaded.filter(function (c) { return c.nature === symbol; });
    if (!matches.length || !isFinite(factor)) return;
    const k = used[symbol] || 0;
    const c = matches[k] || matches[matches.length - 1];
    used[symbol] = k + 1;
    terms.push({ caseId: c.id, factor: factor });
  });
  return terms;
}

// ── Generator wizard (C4) + info-popover (C5) ───────────────────────────────
function showWizardPage(n) {
  const p1 = document.getElementById('wizardPage1');
  const p2 = document.getElementById('wizardPage2');
  if (p1) p1.hidden = (n !== 1);
  if (p2) p2.hidden = (n !== 2);
}

function openWizard() {
  const ov = document.getElementById('wizardOverlay');
  if (!ov) return;
  showWizardPage(1);
  ov.hidden = false;
  document.body.classList.add('card-dragging');   // block canvas behind the scrim
}

function closeWizard() {
  const ov = document.getElementById('wizardOverlay');
  if (!ov) return;
  ov.hidden = true;
  hideInfoPopover();
  document.body.classList.remove('card-dragging');
  wizardPreview = [];
}

// Page 1 → Page 2: call the engine GENERATE-ONLY, cache per_case, build editable
// preview rows from the returned definitions (no γ/ψ in JS — D-08).
async function wizardNext() {
  const families = [];
  const fSTR = document.getElementById('chkFamSTR');
  const fSLS = document.getElementById('chkFamSLS');
  if (fSTR && fSTR.checked) families.push('STR');
  if (fSLS && fSLS.checked) families.push('SLS');
  if (!families.length) { setStatus('Select at least one family (STR or SLS).', true); return; }

  const data = await fetchCombinations({ code: 'eurocode_uk', families: families });
  if (!data) return;   // error already surfaced

  wizardPreview = (data.combinations || []).map(function (c) {
    return {
      id: makeComboId(), name: c.name, cls: c.cls, leading: c.leading || '',
      expression: c.expression || '', terms: reconstructTerms(c.expression),
      on: true, generated: true,
    };
  });
  renderWizardPreview();
  showWizardPage(2);
  setStatus('', false);
}

function wizardBack() { showWizardPage(1); }

// Page 2 preview: rows grouped by class, each editable (toggle / rename / inline
// factor). Degenerate / no-variable notes are static copy in the HTML (no factor
// literals in JS) toggled here.
function renderWizardPreview() {
  const host = document.getElementById('wizardPreview');
  if (!host) return;
  host.innerHTML = '';

  const variableCount = loadCases.filter(function (c) {
    return caseLoadCount(c.id) > 0 && (c.nature === 'Imposed' || c.nature === 'Wind');
  }).length;
  const noVar = document.getElementById('wizardNoteNoVar');
  const degen = document.getElementById('wizardNoteDegenerate');
  if (noVar) noVar.hidden = (variableCount !== 0);
  if (degen) degen.hidden = (variableCount !== 1);

  if (!wizardPreview.length) {
    const e = document.createElement('div');
    e.className = 'wizard-note';
    e.textContent = 'No combinations generated for the selected families.';
    host.appendChild(e);
    return;
  }

  const groups = {};
  const order = [];
  wizardPreview.forEach(function (c) {
    if (!groups[c.cls]) { groups[c.cls] = []; order.push(c.cls); }
    groups[c.cls].push(c);
  });
  order.forEach(function (cls) {
    const g = document.createElement('div');
    g.className = 'wizard-group';
    const h = document.createElement('div');
    h.className = 'wizard-group-title';
    h.textContent = cls === 'STR' ? 'STR — ULS' : (cls === 'SLS' ? 'SLS — characteristic' : cls);
    g.appendChild(h);
    groups[cls].forEach(function (c) { g.appendChild(buildPreviewRow(c)); });
    host.appendChild(g);
  });
}

function buildPreviewRow(c) {
  const row = document.createElement('div');
  row.className = 'wizard-row' + (c.on ? '' : ' combo-off');

  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = c.on;
  chk.setAttribute('aria-label', 'Include ' + c.name);
  chk.addEventListener('change', function () { c.on = chk.checked; row.classList.toggle('combo-off', !c.on); });
  row.appendChild(chk);

  const nm = document.createElement('input');
  nm.type = 'text';
  nm.className = 'combo-name';
  nm.value = c.name;
  nm.setAttribute('aria-label', 'Combination name');
  nm.addEventListener('change', function () { c.name = nm.value.trim() || c.name; });
  row.appendChild(nm);

  const terms = document.createElement('span');
  terms.className = 'combo-terms';
  buildTermsCell(terms, c);
  row.appendChild(terms);

  return row;
}

// "Generate → table": push the (edited) preview rows into the shared model.
function wizardGenerateToTable() {
  const count = wizardPreview.length;
  wizardPreview.forEach(function (c) {
    combinations.push({
      id: c.id, name: c.name, cls: c.cls, leading: c.leading,
      terms: c.terms, on: c.on, generated: true,
    });
  });
  closeWizard();
  renderCombinationTable();
  recombine();
  setStatus('Generated ' + count + ' combination' + (count === 1 ? '' : 's') + ' → table', false);
}

// One reusable info-popover (C5) shared by every (i) trigger — content (EN 1990
// clause citation + when-to-use) is read from the trigger's data attributes.
let _openInfoBtn = null;
function setupInfoPopovers() {
  document.querySelectorAll('.info-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) { e.stopPropagation(); toggleInfoPopover(btn); });
  });
}
function toggleInfoPopover(btn) {
  const pop = document.getElementById('infoPopover');
  if (!pop) return;
  if (_openInfoBtn === btn && !pop.hidden) { hideInfoPopover(); return; }
  hideInfoPopover();
  pop.innerHTML = '';
  const title = document.createElement('strong');
  title.className = 'info-popover-title';
  title.textContent = btn.dataset.infoTitle || '';
  pop.appendChild(title);
  const body = document.createElement('div');
  body.className = 'info-popover-body';
  body.textContent = btn.dataset.infoBody || '';
  pop.appendChild(body);
  const r = btn.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 272)) + 'px';
  pop.style.top  = (r.bottom + 6) + 'px';
  pop.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  _openInfoBtn = btn;
}
function hideInfoPopover() {
  const pop = document.getElementById('infoPopover');
  if (pop) pop.hidden = true;
  if (_openInfoBtn) { _openInfoBtn.setAttribute('aria-expanded', 'false'); _openInfoBtn = null; }
}

// Wizard / popover global dismiss wiring (Esc + outside-click).
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (_openInfoBtn) { hideInfoPopover(); return; }
  const ov = document.getElementById('wizardOverlay');
  if (ov && !ov.hidden) closeWizard();
});
document.addEventListener('click', function (e) {
  if (_openInfoBtn && !e.target.closest('.info-popover') && !e.target.closest('.info-btn')) hideInfoPopover();
});
document.addEventListener('DOMContentLoaded', function () {
  setupInfoPopovers();
  const ov = document.getElementById('wizardOverlay');
  if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeWizard(); });
  if (typeof renderCombinationTable === 'function') renderCombinationTable();
});

// -- Floating panels (port of frame2d i52) -----------------------------------------
let _floatZIndex = 100;  // monotonic counter for D-7 bring-to-top

function setupCardFloat() {
  const canvasArea = document.querySelector('.canvas-area');
  if (!canvasArea) return;

  // Create the absolute-positioning layer once (idempotent).
  let layer = document.getElementById('cardFloatLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'cardFloatLayer';
    canvasArea.appendChild(layer);
  }

  const sections = document.querySelectorAll('.panel-section');
  // Iterate all except the last one (Solve section — always docked at bottom).
  for (let i = 0; i < sections.length - 1; i++) {
    const section = sections[i];
    section.dataset.originalIndex = String(i);
    section.dataset.state = 'docked';

    const h3 = section.querySelector('h3');
    if (!h3) continue;

    // Avoid double-injection if setupCardFloat is called twice.
    if (h3.querySelector('.card-float-btn')) continue;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-float-btn';
    btn.title = 'Float panel';
    btn.setAttribute('aria-label', 'Float panel');  // glyph-only button (UI-SPEC A11y)
    btn.textContent = '↗';  // ↗
    btn.addEventListener('click', function () {
      if (section.dataset.state === 'docked') floatCard(section);
      else                                     dockCard(section);
    });
    h3.appendChild(btn);
  }
}

function floatCard(section) {
  const layer = document.getElementById('cardFloatLayer');
  if (!layer) return;

  // Initial position: top-right of #cardFloatLayer (12 px inner margin per D-2).
  const w = section.offsetWidth || 180;
  const layerRect = layer.getBoundingClientRect();
  section.style.left = Math.max(12, layerRect.width - w - 12) + 'px';
  section.style.top  = '12px';
  section.style.zIndex = String(++_floatZIndex);

  layer.appendChild(section);  // move (NOT clone) — listeners survive
  section.classList.add('floating');
  section.dataset.state = 'floating';

  const btn = section.querySelector('.card-float-btn');
  if (btn) {
    btn.textContent = '↙';  // ↙
    btn.title = 'Dock to toolbar';
    btn.setAttribute('aria-label', 'Dock panel to toolbar');
  }

  const h3 = section.querySelector('h3');
  if (h3) {
    h3._cardDragHandler = function (e) { onCardDragStart(e, section); };
    h3.addEventListener('mousedown', h3._cardDragHandler);
  }
}

function dockCard(section) {
  const panel = document.querySelector('aside.panel');
  if (!panel) return;

  const myIndex = parseInt(section.dataset.originalIndex || '0', 10);
  const siblings = Array.from(panel.children);

  // Find the first docked .panel-section whose originalIndex > myIndex.
  let target = null;
  for (const el of siblings) {
    if (el === section) continue;
    if (el.matches && el.matches('.panel-section') && el.dataset.originalIndex !== undefined) {
      const idx = parseInt(el.dataset.originalIndex, 10);
      if (idx > myIndex) { target = el; break; }
    }
  }

  // Fallback: insert before the Solve section (last .panel-section, which has
  // no data-original-index because it was skipped during setup).
  if (!target) {
    const allSections = Array.from(panel.querySelectorAll('.panel-section'));
    const solveSection = allSections.find(function (el) {
      return el.dataset.originalIndex === undefined || el.dataset.originalIndex === '';
    });
    target = solveSection || null;
  }

  if (target) panel.insertBefore(section, target);
  else        panel.appendChild(section);

  section.classList.remove('floating');
  section.dataset.state = 'docked';
  section.style.left    = '';
  section.style.top     = '';
  section.style.zIndex  = '';

  const btn = section.querySelector('.card-float-btn');
  if (btn) {
    btn.textContent = '↗';  // ↗
    btn.title = 'Float panel';
    btn.setAttribute('aria-label', 'Float panel');
  }

  const h3 = section.querySelector('h3');
  if (h3 && h3._cardDragHandler) {
    h3.removeEventListener('mousedown', h3._cardDragHandler);
    delete h3._cardDragHandler;
  }
}

// Drag handler — mousedown on a floated section's h3 starts a potential drag.
// A 3 px move threshold separates "drag" from a plain click. Clamp keeps
// ≥40 px of the section visible on every viewport edge.
function onCardDragStart(e, section) {
  if (section.dataset.state !== 'floating') return;
  if (e.target && e.target.classList && e.target.classList.contains('card-float-btn')) return;

  const startX    = e.clientX;
  const startY    = e.clientY;
  const startLeft = parseFloat(section.style.left) || 0;
  const startTop  = parseFloat(section.style.top)  || 0;
  let moved = false;

  // Bring-to-top on drag-start (D-7).
  section.style.zIndex = String(++_floatZIndex);

  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!moved && Math.hypot(dx, dy) > 3) {
      moved = true;
      section.classList.add('dragging');
      document.body.classList.add('card-dragging');
    }
    if (!moved) return;
    ev.preventDefault();

    // Clamp so ≥40 px of the section remains visible on every viewport edge (D-8).
    const layer = document.getElementById('cardFloatLayer');
    const layerRect = layer ? layer.getBoundingClientRect() : { left: 0, top: 0 };
    const w = section.offsetWidth;
    const h = section.offsetHeight;
    const minLeft = 40 - w - layerRect.left;
    const maxLeft = window.innerWidth  - 40 - layerRect.left;
    const minTop  = 40 - h - layerRect.top;
    const maxTop  = window.innerHeight - 40 - layerRect.top;
    section.style.left = Math.max(minLeft, Math.min(maxLeft, startLeft + dx)) + 'px';
    section.style.top  = Math.max(minTop,  Math.min(maxTop,  startTop  + dy)) + 'px';
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    if (moved) {
      section.classList.remove('dragging');
      document.body.classList.remove('card-dragging');
    }
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
}

document.addEventListener('DOMContentLoaded', setupCardFloat);

// ── Init ──────────────────────────────────────────────────────────────────
ensureDefaultCase();   // D-03: a default active Dead case always exists at startup
setMode('view');
if (typeof renderCaseTable === 'function') renderCaseTable();
if (typeof renderCombinationTable === 'function') renderCombinationTable();
updateSaveButtonState();
draw();
