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
    if (ico) ico.textContent = (t === 'dark') ? '☀' : '☾';   // ☀ / ☾
    if (lbl) lbl.textContent = (t === 'dark') ? 'Light' : 'Dark';
  }
  let saved = null;
  try { saved = localStorage.getItem('frame2d_theme'); } catch (_) {}
  const prefersDark = window.matchMedia &&
                      window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(initial);

  document.addEventListener('DOMContentLoaded', function () {
    const tog = document.getElementById('themeToggle');
    if (!tog) return;
    // Sync button label/icon now that the DOM exists.
    applyTheme(document.documentElement.dataset.theme || initial);
    tog.addEventListener('click', function () {
      const next = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('frame2d_theme', next); } catch (_) {}
    });
  });
})();

const API_URL = ''; // relative — UI is served from the same FastAPI process

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// ── CSS variable bridge ───────────────────────────────────────────────────
// Reads a CSS custom property from :root (light) or [data-theme="dark"] (dark).
// Used by every canvas-drawing function so colours follow the active theme.
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const GRID = 20;
const UNIT = 1;

// ── Label-size scaling (Task 3) ───────────────────────────────────────────
// BASE_LABEL_SIZE matches --canvas-label-size in style.css (10px). labelScale
// is wired to #inputLabelScale (range 0.5..2.0) and multiplies every ctx.font
// pixel size in this file alongside getSymbolScale() so users can rescale
// canvas labels independently of the symbol-size slider.
const BASE_LABEL_SIZE = 10;
const LABEL_FONT_FAMILY = 'Inter, system-ui, sans-serif';
let labelScale = 1.0;

let _lastBlobUrl = null;

// ── Symbol scale helper ───────────────────────────────────────────────────
function getSymbolScale() {
  return parseFloat(document.getElementById('inputSymbolScale').value) || 1.0;
}

// ── State ─────────────────────────────────────────────────────────────────
let mode   = 'node';
let origin = null;
let currentMemberStart = null;

let nodes      = [];   // { id, x, y, realX, realY }
let members    = [];   // { id, start, end, type:'beam'|'bar', pinLeft, pinRight, udl }
let supports   = [];   // classic: { nodeId, type:'fixed'|'pinned'|'rollerX'|'rollerY' }
                       // spring:  { nodeId, type:'spring', Kx, Ky, Ktheta }  (K in UI units: kN/m, kN·m/rad; null = free)
let nodeLoads  = [];   // { nodeId, direction:'x'|'y'|'moment', magnitude }
let history    = [];
let results    = null;
let _udlActiveMemberIdx = null;
let _springActiveNodeId = null;

// Phase 6 PUREBAR-04 — diagnostic overlay state.
// pureBarNodeIds: 0-based node ids flagged by the pre-solve scan (informational).
// offendingNodes / offendingMembers: 0-based ids populated from structured 422
//   payload (cause / offending_nodes / offending_members per Plan 06-02 D-09).
// All three arrays are read by drawDiagnosticOverlays() (wired into draw()) and
// cleared at the start of validateBeforeSolve() and on a fresh successful solve.
let pureBarNodeIds   = [];
let offendingNodes   = [];
let offendingMembers = [];

// ── View transform (zoom / pan) ───────────────────────────────────────────
let view = { scale: 1, tx: 0, ty: 0 };
let isPanning = false, panStartX = 0, panStartY = 0, panStartTx = 0, panStartTy = 0;

function toWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * (canvas.width  / rect.width);
  const py = (clientY - rect.top)  * (canvas.height / rect.height);
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
  var sx = canvas.width  / pw;
  var sy = canvas.height / ph;
  view.scale = Math.min(sx, sy);
  var cx = origin.x + (rMinX + rw / 2) / UNIT * GRID;
  var cy = origin.y - (rMinY + rh / 2) / UNIT * GRID;
  view.tx = canvas.width  / 2 - cx * view.scale;
  view.ty = canvas.height / 2 - cy * view.scale;
  draw();
}

// ── Mode management ───────────────────────────────────────────────────────
const MODE_LABELS = {
  view: 'View', node: 'Add Node', member: 'Add Member',
  fixed: 'Fixed Support', pinned: 'Pinned Support',
  rollerX: 'Roller (X fixed)', rollerY: 'Roller (Y fixed)',
  spring: 'Spring Support',
  loadX: 'Force X', loadY: 'Force Y', loadMoment: 'Moment',
  editNodeLoad: 'Edit Node Load',
  udl: 'UDL on Member', editUdl: 'Edit UDL',
  toggleBar: 'Toggle Beam / Bar',
  pinLeft: 'Pin — Left End', pinRight: 'Pin — Right End',
  editNode: 'Edit Node', delete: 'Delete',
};

const SUPPORT_MODES = new Set(['fixed', 'pinned', 'rollerX', 'rollerY', 'spring']);
const LOAD_MODES    = new Set(['loadX', 'loadY', 'loadMoment', 'udl', 'editNodeLoad', 'editUdl']);

function setMode(m) {
  mode = m;
  currentMemberStart = null;
  document.querySelectorAll('.tool-btn[data-mode]').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === m)
  );
  document.getElementById('modeLabel').textContent = MODE_LABELS[m] || m;

  // Auto-enable the matching visibility layer so clicks always produce
  // visible feedback. Without this, supports/loads added with chkSupports/
  // chkLoads unchecked land in the data array but render nothing —
  // the symptom that caused the long-running misdiagnosed "freeze after
  // load" debug session (.planning/debug/frame2d-load-then-add-support.md).
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
  let { x: px, y: py } = toWorld(e.clientX, e.clientY);

  // ---- Geometry ----
  if (mode === 'node') {
    saveHistory();
    px = Math.round(px / GRID) * GRID;
    py = Math.round(py / GRID) * GRID;
    if (origin === null) origin = { x: px, y: py };
    const realX = ((px - origin.x) / GRID) * UNIT;
    const realY = ((origin.y - py) / GRID) * UNIT;
    nodes.push({ id: nodes.length, x: px, y: py, realX, realY });
    results = null;

  } else if (mode === 'member') {
    const n = findNodeAt(px, py);
    if (n) {
      if (currentMemberStart === null) {
        currentMemberStart = n;
      } else if (currentMemberStart.id !== n.id) {
        saveHistory();
        members.push({
          id: members.length,
          start: currentMemberStart.id,
          end: n.id,
          type: 'beam',
          pinLeft: false,
          pinRight: false,
          udl: null,
          udl_x: null,
          E_override: null,
          I_override: null,
          A_override: null,
        });
        currentMemberStart = null;
        results = null;
      }
    }

  // ---- Supports ----
  } else if (['fixed', 'pinned', 'rollerX', 'rollerY'].includes(mode)) {
    const n = findNodeAt(px, py);
    if (n) {
      saveHistory();
      supports = supports.filter(s => s.nodeId !== n.id); // one support per node
      supports.push({ nodeId: n.id, type: mode });
      results = null;
    }

  // ---- Spring support (elastic) ----
  } else if (mode === 'spring') {
    const n = findNodeAt(px, py);
    if (n) {
      _springActiveNodeId = n.id;
      // D-06: pre-fill from existing spring at this node if present (editable)
      const existing = supports.find(s => s.nodeId === n.id && s.type === 'spring');
      document.getElementById('springPanelTitle').textContent = 'Spring Support — Node ' + (n.id + 1);
      document.getElementById('springKx').value     = existing && existing.Kx     != null ? existing.Kx     : '';
      document.getElementById('springKy').value     = existing && existing.Ky     != null ? existing.Ky     : '';
      document.getElementById('springKtheta').value = existing && existing.Ktheta != null ? existing.Ktheta : '';
      document.getElementById('springPanel').style.display = 'block';
      document.getElementById('springKx').focus();
    }

  // ---- Node loads ----
  } else if (['loadX', 'loadY', 'loadMoment'].includes(mode)) {
    const n = findNodeAt(px, py);
    if (n) {
      const dir   = mode === 'loadX' ? 'x' : mode === 'loadY' ? 'y' : 'moment';
      const label = dir === 'moment' ? 'Magnitude in N·m (+ = CCW):' : 'Magnitude in N (negative = down/left):';
      const existing = nodeLoads.find(l => l.nodeId === n.id && l.direction === dir);
      const defaultVal = existing ? String(existing.magnitude) : (dir === 'moment' ? '10000' : '-10000');
      const mag   = parseFloat(prompt(label, defaultVal));
      if (!isNaN(mag)) {
        saveHistory();
        // replace any existing load in same direction at same node
        nodeLoads = nodeLoads.filter(l => !(l.nodeId === n.id && l.direction === dir));
        nodeLoads.push({ nodeId: n.id, direction: dir, magnitude: mag });
        results = null;
      }
    }

  // ---- UDL ----
  } else if (mode === 'udl') {
    const mi = findMemberAt(px, py);
    if (mi !== null) {
      _udlActiveMemberIdx = mi;
      const m = members[mi];
      document.getElementById('udlPanelTitle').textContent = 'UDL — Member ' + (mi + 1);
      document.getElementById('udlWy').value = m.udl !== null && m.udl !== undefined ? m.udl : '';
      document.getElementById('udlWx').value = m.udl_x !== null && m.udl_x !== undefined ? m.udl_x : '';
      document.getElementById('udlPanel').style.display = 'block';
      document.getElementById('udlWy').focus();
    }

  // ---- Edit existing node load ----
  } else if (mode === 'editNodeLoad') {
    const n = findNodeAt(px, py);
    if (n) {
      const existing = nodeLoads.filter(l => l.nodeId === n.id);
      if (existing.length === 0) { setStatus('No loads on node ' + (n.id + 1), true); }
      else {
        existing.forEach(l => {
          const label = l.direction === 'moment' ? 'Moment (N·m, + = CCW):' : 'Force ' + l.direction.toUpperCase() + ' (N):';
          const mag = parseFloat(prompt('Node ' + (n.id + 1) + ' — ' + label, String(l.magnitude)));
          if (!isNaN(mag)) {
            saveHistory();
            l.magnitude = mag;
            results = null;
          }
        });
      }
    }

  // ---- Edit existing UDL ----
  } else if (mode === 'editUdl') {
    const mi = findMemberAt(px, py);
    if (mi !== null) {
      const m = members[mi];
      if ((m.udl === null || m.udl === undefined || m.udl === 0) &&
          (m.udl_x === null || m.udl_x === undefined || m.udl_x === 0)) {
        setStatus('No UDL on member ' + (mi + 1), true);
      } else {
        _udlActiveMemberIdx = mi;
        document.getElementById('udlPanelTitle').textContent = 'Edit UDL — Member ' + (mi + 1);
        document.getElementById('udlWy').value = m.udl !== null && m.udl !== undefined ? m.udl : '';
        document.getElementById('udlWx').value = m.udl_x !== null && m.udl_x !== undefined ? m.udl_x : '';
        document.getElementById('udlPanel').style.display = 'block';
        document.getElementById('udlWy').focus();
      }
    }

  // ---- Member property toggles ----
  } else if (mode === 'toggleBar') {
    const mi = findMemberAt(px, py);
    if (mi !== null) {
      saveHistory();
      members[mi].type = members[mi].type === 'beam' ? 'bar' : 'beam';
      results = null;
    }

  } else if (mode === 'pinLeft') {
    const mi = findMemberAt(px, py);
    if (mi !== null) {
      saveHistory();
      members[mi].pinLeft = !members[mi].pinLeft;
      results = null;
    }

  } else if (mode === 'pinRight') {
    const mi = findMemberAt(px, py);
    if (mi !== null) {
      saveHistory();
      members[mi].pinRight = !members[mi].pinRight;
      results = null;
    }

  // ---- Per-member E/I/A overrides ----
  } else if (mode === 'memberProps') {
    const mi = findMemberAt(px, py);
    if (mi !== null) {
      const m = members[mi];
      const globalE = parseFloat(document.getElementById('inputE').value) || 200;
      const globalI = parseFloat(document.getElementById('inputI').value) || 10000;
      const globalA = parseFloat(document.getElementById('inputA').value) || 100;
      const curE = m.E_override != null ? m.E_override : globalE;
      const curI = m.I_override != null ? m.I_override : globalI;
      const curA = m.A_override != null ? m.A_override : globalA;
      const srcE = m.E_override != null ? 'override' : 'global';
      const srcI = m.I_override != null ? 'override' : 'global';
      const srcA = m.A_override != null ? 'override' : 'global';
      var info = 'Member ' + (mi + 1) + ' current values:\n'
        + '  E = ' + curE + ' GPa (' + srcE + ')\n'
        + '  I = ' + curI + ' cm\u2074 (' + srcI + ')\n'
        + '  A = ' + curA + ' cm\u00B2 (' + srcA + ')\n\n'
        + 'Choose action:';
      var action = prompt(info + '\n\nType "edit" to change values, "reset" to clear overrides, or Cancel to keep as-is.', 'edit');
      if (action === null) { /* cancelled */ }
      else if (action.trim().toLowerCase() === 'reset') {
        saveHistory();
        m.E_override = null;
        m.I_override = null;
        m.A_override = null;
        results = null;
        setStatus('Member ' + (mi + 1) + ' reset to global values');
      } else {
        var eInput = prompt('Member ' + (mi + 1) + ' \u2014 E (GPa):', String(curE));
        if (eInput !== null && eInput.trim() !== '') {
          var val = parseFloat(eInput);
          if (!isNaN(val)) { saveHistory(); m.E_override = val; results = null; }
        }
        var iInput = prompt('Member ' + (mi + 1) + ' \u2014 I (cm\u2074):', String(curI));
        if (iInput !== null && iInput.trim() !== '') {
          var val = parseFloat(iInput);
          if (!isNaN(val)) { saveHistory(); m.I_override = val; results = null; }
        }
        var aInput = prompt('Member ' + (mi + 1) + ' \u2014 A (cm\u00B2):', String(curA));
        if (aInput !== null && aInput.trim() !== '') {
          var val = parseFloat(aInput);
          if (!isNaN(val)) { saveHistory(); m.A_override = val; results = null; }
        }
      }
      draw();
    }

  // ---- Edit node ----
  } else if (mode === 'editNode') {
    const n = findNodeAt(px, py);
    if (n) {
      const input = prompt(`Node ${n.id + 1} — coordinates (x,y) in metres:`, `${n.realX},${n.realY}`);
      if (input) {
        const [rx, ry] = input.split(',').map(Number);
        if (!isNaN(rx) && !isNaN(ry)) {
          saveHistory();
          n.realX = rx; n.realY = ry;
          syncPixelFromReal(n);
          results = null;
        }
      }
    }

  // ---- Delete ----
  } else if (mode === 'delete') {
    const n  = findNodeAt(px, py);
    const mi = findMemberAt(px, py);
    if (n || mi !== null) {
      saveHistory();
      if (n) {
        nodes     = nodes.filter(nd => nd.id !== n.id);
        members   = members.filter(m => m.start !== n.id && m.end !== n.id);
        supports  = supports.filter(s => s.nodeId !== n.id);
        nodeLoads = nodeLoads.filter(l => l.nodeId !== n.id);
        reindexNodes();
      } else {
        members.splice(mi, 1);
        reindexMembers();
      }
      if (nodes.length === 0) { origin = null; currentMemberStart = null; }
      results = null;
    }
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
    nodes:     JSON.parse(JSON.stringify(nodes)),
    members:   JSON.parse(JSON.stringify(members)),
    supports:  JSON.parse(JSON.stringify(supports)),
    nodeLoads: JSON.parse(JSON.stringify(nodeLoads)),
    origin:    origin ? { ...origin } : null,
    currentMemberStart: currentMemberStart ? { ...currentMemberStart } : null,
  });
  if (history.length > 100) history.shift();
}

function undoLastAction() {
  if (!history.length) return;
  const prev    = history.pop();
  nodes         = prev.nodes;
  members       = prev.members;
  supports      = prev.supports;
  nodeLoads     = prev.nodeLoads;
  origin        = prev.origin;
  currentMemberStart = prev.currentMemberStart;
  results = null;
  updateSaveButtonState();
  draw();
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoLastAction(); }
  if (e.key === 'Escape') {
    document.getElementById('udlPanel').style.display = 'none';
    _udlActiveMemberIdx = null;
    const sp = document.getElementById('springPanel');
    if (sp) sp.style.display = 'none';
    _springActiveNodeId = null;
    setMode('view');
  }
});

function resetAll() {
  if (!confirm('Reset everything?')) return;
  nodes = []; members = []; supports = []; nodeLoads = [];
  origin = null; currentMemberStart = null; results = null; history = [];
  _udlActiveMemberIdx = null;
  _springActiveNodeId = null;
  view = { scale: 1, tx: 0, ty: 0 };
  // D-14 (Phase 04 Plan 03 bug fix — UAT authoring surfaced a
  // reproducible state-leak after Reset All where subsequent canvas
  // clicks silently failed to add supports or UDLs). The middle-mouse
  // pan state (isPanning + pan anchor helpers) was not being cleared on
  // reset; if `isPanning` was stuck `true` (e.g. a middle-drag that
  // released outside the canvas bounds, or a browser that failed to
  // fire mouseup), every subsequent canvas click returned early at the
  // `if (isPanning) return;` guard in the click handler — matching the
  // user-reported symptom exactly ("UDL doesn't render after clicking
  // the member", "supports don't register after Reset All", recovered
  // only by a hard page reload).
  //
  // Additionally clear the results-download blob URL, any stale canvas
  // diagram checkboxes' UI state, and re-run clearDiagramState() so
  // a post-reset canvas exactly matches a fresh-load canvas.
  isPanning = false;
  panStartX = 0; panStartY = 0; panStartTx = 0; panStartTy = 0;
  if (_lastBlobUrl) { URL.revokeObjectURL(_lastBlobUrl); _lastBlobUrl = null; }
  document.getElementById('resultsPanel').style.display = 'none';
  document.getElementById('udlPanel').style.display = 'none';
  const sp = document.getElementById('springPanel');
  if (sp) sp.style.display = 'none';
  // Clear any download link left inside the results panel
  const existingDl = document.querySelector('.download-link');
  if (existingDl) existingDl.remove();
  clearDiagramState();
  setStatus('');
  setMode('view');
  updateSaveButtonState();
  draw();
}

// ── Spring support modal: apply / cancel ─────────────────────────────────
function applySpringSupport() {
  try {
    if (_springActiveNodeId === null) return;
    const kxRaw     = document.getElementById('springKx').value.trim();
    const kyRaw     = document.getElementById('springKy').value.trim();
    const kthetaRaw = document.getElementById('springKtheta').value.trim();
    const Kx     = kxRaw     === '' ? null : parseFloat(kxRaw);
    const Ky     = kyRaw     === '' ? null : parseFloat(kyRaw);
    const Ktheta = kthetaRaw === '' ? null : parseFloat(kthetaRaw);
    // D-06: at least one non-blank value required — all-blank = cancel
    if (Kx == null && Ky == null && Ktheta == null) {
      cancelSpringSupport();
      return;
    }
    // Validate any non-null value is a positive finite number
    for (const v of [Kx, Ky, Ktheta]) {
      if (v != null && (isNaN(v) || !isFinite(v) || v <= 0)) {
        alert('Spring stiffness must be a positive number. Blank = free.');
        return;
      }
    }
    saveHistory();
    // D-05: spring REPLACES any classic support at this node
    supports = supports.filter(s => s.nodeId !== _springActiveNodeId);
    supports.push({ nodeId: _springActiveNodeId, type: 'spring', Kx, Ky, Ktheta });
    document.getElementById('springPanel').style.display = 'none';
    _springActiveNodeId = null;
    results = null;
    updateSaveButtonState();
    draw();
  } catch (err) {
    showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
    throw err;
  }
}

function cancelSpringSupport() {
  document.getElementById('springPanel').style.display = 'none';
  _springActiveNodeId = null;
}

// ── Helpers ───────────────────────────────────────────────────────────────
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

function memberLengthReal(m) {
  const n1 = nodes.find(n => n.id === m.start);
  const n2 = nodes.find(n => n.id === m.end);
  return Math.hypot(n2.realX - n1.realX, n2.realY - n1.realY);
}

function memberAngle(m) {
  const n1 = nodes.find(n => n.id === m.start);
  const n2 = nodes.find(n => n.id === m.end);
  return Math.atan2(n2.realY - n1.realY, n2.realX - n1.realX);
}

function reindexNodes() {
  const idMap = {};
  nodes.forEach((n, i) => { idMap[n.id] = i; n.id = i; });
  members.forEach(m  => { m.start = idMap[m.start]; m.end = idMap[m.end]; });
  supports.forEach(s => { s.nodeId = idMap[s.nodeId]; });
  nodeLoads.forEach(l => { l.nodeId = idMap[l.nodeId]; });
}

function reindexMembers() {
  members.forEach((m, i) => { m.id = i; });
}

// ── Springs: shared payload builder for solve() and saveModel() ──────────
// D-09: flatten supports[].type==='spring' into 1-based springDoF indices
// with SI-unit K values (kN/m → N/m ×1e3; kN·m/rad → N·m/rad ×1e3).
function computeSpringPayload() {
  const springDoF = [];
  const springStiffness = [];
  supports.forEach(s => {
    if (s.type !== 'spring') return;
    const base = s.nodeId * 3 + 1;  // 1-based, matches classic-support indexing
    if (s.Kx     != null) { springDoF.push(base);     springStiffness.push(s.Kx     * 1e3); }  // kN/m → N/m
    if (s.Ky     != null) { springDoF.push(base + 1); springStiffness.push(s.Ky     * 1e3); }  // kN/m → N/m
    if (s.Ktheta != null) { springDoF.push(base + 2); springStiffness.push(s.Ktheta * 1e3); }  // kN·m/rad → N·m/rad
  });
  return { springDoF, springStiffness };
}

/**
 * Phase 6 PUREBAR-04 (D-11) — pre-solve diagnostic scan.
 *
 * Walks members + bars to identify two failure modes the server would
 * otherwise reject (UDL-on-bar) or auto-restrain (pure-bar joint) on solve:
 *   1. Pure-bar joints — every incident member has type='bar'. Server will
 *      auto-restrain the θ DOF (Plan 06-01 D-01). This scan flags them as
 *      informational so the user understands the visual.
 *   2. UDL on bar members — server will reject with structured 422 (Plan
 *      06-02 cause='udl_on_bar'). Catch this client-side to give immediate
 *      feedback and avoid the round-trip.
 *
 * Sets module-level pureBarNodeIds (0-based) so drawDiagnosticOverlays()
 * can render small offset red dots near the affected joints. Returns false
 * to BLOCK solve when any UDL-on-bar member is found; otherwise returns
 * true and informational-status text.
 */
function validateBeforeSolve() {
  // Reset diagnostic state for this solve attempt.
  pureBarNodeIds   = [];
  offendingNodes   = [];
  offendingMembers = [];

  // Build per-node incidence: nodeId (0-based, equals array index after
  // reindexNodes) → list of member array-indices (0-based) incident on that node.
  const incidence = new Map();
  members.forEach((m, idx) => {
    if (!incidence.has(m.start)) incidence.set(m.start, []);
    if (!incidence.has(m.end))   incidence.set(m.end,   []);
    incidence.get(m.start).push(idx);
    incidence.get(m.end).push(idx);
  });

  // 1. Pure-bar joint detection. Server-side predicate (Plan 06-01 D-03):
  //    every incident member is in `bars`. Same predicate, expressed via
  //    m.type === 'bar' (the same condition used at line ~538 to build the
  //    1-based `bars` payload).
  const pureBar = [];
  for (const [nodeId, memberIdxs] of incidence.entries()) {
    if (memberIdxs.length === 0) continue;
    const allBars = memberIdxs.every(i => members[i].type === 'bar');
    if (allBars) pureBar.push(nodeId);
  }
  pureBarNodeIds = pureBar;

  // 2. UDL-on-bar detection (vertical UDL `udl` and horizontal `udl_x`).
  //    Mirrors the server-side check in FrameV2Adapter (Plan 06-02): any
  //    non-zero ENForces / ENMoments on a bar-typed member is rejected.
  const udlOnBar = [];
  members.forEach((m, idx) => {
    if (m.type !== 'bar') return;
    const hasVertical   = m.udl   != null && m.udl   !== 0;
    const hasHorizontal = m.udl_x != null && m.udl_x !== 0;
    if (hasVertical || hasHorizontal) udlOnBar.push(idx);
  });

  if (udlOnBar.length > 0) {
    // Map back to 1-based for user-facing message (matches API convention).
    const oneBased = udlOnBar.map(i => i + 1);
    offendingMembers = udlOnBar;   // 0-based for drawDiagnosticOverlays
    setStatus(
      'UDL on bar member(s) ' + oneBased.join(', ') +
      ': bars are axial-only. Change member type to "beam" or remove UDL.',
      true
    );
    draw();   // re-render so the offending member is highlighted in red
    return false;   // BLOCK solve
  }

  if (pureBar.length > 0) {
    const oneBased = pureBar.map(n => n + 1);
    setStatus(
      'Note: pure-bar joints at node(s) ' + oneBased.join(', ') +
      ' — θ will be auto-restrained on solve.',
      false   // informational, NOT an error (Solve still allowed)
    );
  }

  return true;   // allow solve to proceed
}

// ── Solve ─────────────────────────────────────────────────────────────────
async function solve() {
  if (nodes.length < 2)    return setStatus('Need at least 2 nodes.', true);
  if (members.length < 1)  return setStatus('Need at least 1 member.', true);
  if (supports.length < 1) return setStatus('Need at least one support.', true);

  const E_GPa = parseFloat(document.getElementById('inputE').value);
  const I_cm4 = parseFloat(document.getElementById('inputI').value);
  const A_cm2 = parseFloat(document.getElementById('inputA').value);
  if ([E_GPa, I_cm4, A_cm2].some(v => isNaN(v) || v <= 0))
    return setStatus('Check E, I and A values.', true);

  // Phase 6 PUREBAR-04 — pre-solve scan. Returns false to BLOCK on
  // UDL-on-bar; otherwise sets pureBarNodeIds for canvas overlay.
  if (!validateBeforeSolve()) return;

  // Resolve per-member overrides: use list payload if any member has an override
  const anyOverride = members.some(m => m.E_override != null || m.I_override != null || m.A_override != null);
  const E = anyOverride
    ? members.map(m => (m.E_override != null ? m.E_override : E_GPa) * 1e9)
    : E_GPa * 1e9;
  const I = anyOverride
    ? members.map(m => (m.I_override != null ? m.I_override : I_cm4) * 1e-8)
    : I_cm4 * 1e-8;
  const A = anyOverride
    ? members.map(m => (m.A_override != null ? m.A_override : A_cm2) * 1e-4)
    : A_cm2 * 1e-4;

  // restrainedDoF — 1-based, 3 DOF per node (Ux, Uy, θ)
  const restrainedDoF = [];
  supports.forEach(s => {
    const base = s.nodeId * 3 + 1;
    if (s.type === 'fixed')   restrainedDoF.push(base, base+1, base+2);
    if (s.type === 'pinned')  restrainedDoF.push(base, base+1);
    if (s.type === 'rollerX') restrainedDoF.push(base);
    if (s.type === 'rollerY') restrainedDoF.push(base+1);
    // s.type === 'spring' → no classic restraint added; handled by springDoF/springStiffness below
  });

  // forceVector — flat, length = 3 * nNodes
  const forceVector = new Array(nodes.length * 3).fill(0);
  nodeLoads.forEach(l => {
    const base = l.nodeId * 3;
    if (l.direction === 'x')      forceVector[base]     = l.magnitude;
    if (l.direction === 'y')      forceVector[base + 1] = l.magnitude;
    if (l.direction === 'moment') forceVector[base + 2] = l.magnitude;
  });

  // ENForces & ENMoments from vertical UDLs.
  // For inclined members, vertical (gravity) UDL decomposes into:
  //   - Local TRANSVERSE component (w * cos θ): handled via ENForces/ENMoments
  //   - Local AXIAL component (-w * sin θ): added directly to forceVector at each endpoint
  // Both components are required for correct global equilibrium (Fy reactions).
  const ENForces  = members.map(m => {
    if (!m.udl || m.type === 'bar') return [0, 0];
    const L = memberLengthReal(m);
    const theta = memberAngle(m);
    const q_local_y = -m.udl * Math.cos(theta);  // local transverse component of global-Y load
    return [q_local_y * L / 2, q_local_y * L / 2];
  });
  const ENMoments = members.map(m => {
    if (!m.udl || m.type === 'bar') return [0, 0];
    const L = memberLengthReal(m);
    const theta = memberAngle(m);
    const q_local_y = -m.udl * Math.cos(theta);
    return [q_local_y * L * L / 12, -q_local_y * L * L / 12];
  });

  // Axial component of vertical UDL on inclined members → add to forceVector
  // q_axial = -w * sin(theta); global force at each node: (q_axial*L/2) * (cos θ, sin θ)
  members.forEach(m => {
    if (!m.udl || m.type === 'bar') return;
    const theta = memberAngle(m);
    const sinT = Math.sin(theta);
    if (Math.abs(sinT) < 1e-9) return;  // horizontal member: no axial component
    const L   = memberLengthReal(m);
    const q_ax = -m.udl * sinT;          // local axial load per unit length
    const Nx   = q_ax * L / 2;           // axial force at each node
    const fxi  = Nx * Math.cos(theta);
    const fyi  = Nx * sinT;
    const bi   = m.start * 3;            // 0-based forceVector index for start node
    const bj   = m.end   * 3;
    forceVector[bi]     += fxi;
    forceVector[bi + 1] += fyi;
    forceVector[bj]     += fxi;
    forceVector[bj + 1] += fyi;
  });

  const bars        = members.map((m,i) => m.type === 'bar'   ? i+1 : null).filter(Boolean);
  const beamPinLeft  = members.map((m,i) => m.pinLeft          ? i+1 : null).filter(Boolean);
  const beamPinRight = members.map((m,i) => m.pinRight         ? i+1 : null).filter(Boolean);

  // Springs — D-09: flatten supports[type==='spring'] into SI-unit springDoF + springStiffness
  const { springDoF, springStiffness } = computeSpringPayload();

  const payload = {
    solver: 'frame_v2',
    nodes:   nodes.map(n => [n.realX, n.realY]),
    members: members.map(m => [m.start + 1, m.end + 1]),
    ENForces, ENMoments, forceVector,
    E, I, A,
    bars, beamPinLeft, beamPinRight,
    restrainedDoF,
    pinDoF: [], springDoF, springStiffness,
    udl_x: members.map(m => m.udl_x !== null ? m.udl_x : 0),
  };

  setStatus('Solving…');
  try {
    const res = await fetch(`${API_URL}/solve/frame2d`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) {
      // Phase 6 D-09 / D-12 / D-13 — structured 422 parsing with
      // backward-compat fallback. Plain { detail: "..." } payloads
      // (legacy, e.g. genuine under-restraint) still render via
      // err.detail || res.statusText. When the server returns the
      // typed payload from Plan 06-02 (cause / offending_nodes /
      // offending_members), the message is enriched with the cause
      // taxonomy and the offending elements are stored for the
      // canvas overlay to highlight on the next draw().
      let err = {};
      try { err = await res.json(); } catch (_) { /* not JSON */ }
      let msg = 'API error: ' + (err.detail || res.statusText);
      if (err.cause) {
        msg += ' [' + err.cause + ']';
      }
      // T-06-03-02 mitigation: filter server-supplied indices through
      // Number.isInteger + range check before indexing into local arrays.
      // Any malformed / out-of-range entry is silently dropped — a hostile
      // server cannot drive the canvas to render outside bounds.
      if (Array.isArray(err.offending_nodes) && err.offending_nodes.length) {
        offendingNodes = err.offending_nodes
          .map(n => Number(n) - 1)
          .filter(i => Number.isInteger(i) && i >= 0 && i < nodes.length);
      }
      if (Array.isArray(err.offending_members) && err.offending_members.length) {
        offendingMembers = err.offending_members
          .map(m => Number(m) - 1)
          .filter(i => Number.isInteger(i) && i >= 0 && i < members.length);
      }
      // Re-render so drawDiagnosticOverlays() (Task 3) paints highlights.
      draw();
      return setStatus(msg, true);
    }
    // Successful solve — clear post-flight overlays. Pre-flight
    // pureBarNodeIds is left in place: those joints are still the
    // visual signature of an auto-restrained θ DOF and the user
    // benefits from seeing them after a successful solve too.
    offendingNodes   = [];
    offendingMembers = [];
    results = await res.json();
    setStatus('Solved ✓', false);
    document.getElementById('chkBMD').disabled = false;
    document.getElementById('chkSFD').disabled = false;
    document.getElementById('chkAFD').disabled = false;
    renderResults(results);
    draw();
  } catch {
    setStatus('Cannot reach API. Is the server running?', true);
  }
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('solveStatus');
  el.textContent = msg;
  el.className = isError ? 'error' : (msg ? 'ok' : '');
}

// ── Draw ──────────────────────────────────────────────────────────────────
function clearDiagramState() {
  document.getElementById('chkBMD').checked  = false;
  document.getElementById('chkBMD').disabled = true;
  document.getElementById('chkSFD').checked  = false;
  document.getElementById('chkSFD').disabled = true;
  document.getElementById('chkAFD').checked  = false;
  document.getElementById('chkAFD').disabled = true;
}

function draw() {
  try {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.tx, view.ty);

  // Build member obstacle lines and create a fresh LabelManager for this frame
  const memberLines = members.map(m => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    return (n1 && n2) ? { x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y } : null;
  }).filter(Boolean);
  const labelManager = new LabelManager({ ctx, members: memberLines });

  // Compute isDark once for theme-aware label colours
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  if (document.getElementById('chkGrid')?.checked) drawGrid();
  if (document.getElementById('chkLoads').checked) drawUDLs(labelManager);
  drawMembers(labelManager, isDark);
  if (results) {
    if (document.getElementById('chkBMD').checked) drawBMD(labelManager);
    if (document.getElementById('chkSFD').checked) drawSFD(labelManager);
    if (document.getElementById('chkAFD').checked) drawAFD(labelManager);
    if (document.getElementById('chkDeflected').checked) drawDeflected(labelManager);
  } else {
    clearDiagramState();
  }
  drawNodes(labelManager);
  drawDiagnosticOverlays();   // Phase 6 PUREBAR-04 — pre/post-solve red highlights
  if (document.getElementById('chkSupports').checked) drawSupports(labelManager);
  if (document.getElementById('chkLoads').checked) drawNodeLoads(labelManager, isDark);
  if (results) {
    const chkR = document.getElementById('chkReactions');
    if (!chkR || chkR.checked) drawReactions(labelManager, isDark);
  }
  if (currentMemberStart) highlightNode(currentMemberStart, '#ff9800');
  if (document.getElementById('chkNodeLabels') && document.getElementById('chkNodeLabels').checked) {
    drawNodeLabels(labelManager);
  }

  // Resolve and render all collected labels
  labelManager.resolve();
  labelManager.render(ctx);

  if (results) drawLegend();
  } catch (err) {
    showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
    throw err;
  }
}

function drawGrid() {
  // drawGrid runs with the world transform active (set in draw()).
  // Inverse-transform canvas corners → world rect → snap to GRID multiples
  // so the grid extends to whatever world region is currently visible
  // and follows pan/zoom indefinitely.
  ctx.strokeStyle = cssVar('--canvas-grid');
  ctx.lineWidth = 0.5 / view.scale;   // keep lines visually 0.5 px regardless of zoom

  const worldLeft   = (0             - view.tx) / view.scale;
  const worldRight  = (canvas.width  - view.tx) / view.scale;
  const worldTop    = (0             - view.ty) / view.scale;
  const worldBottom = (canvas.height - view.ty) / view.scale;

  const xStart = Math.floor(worldLeft   / GRID) * GRID;
  const xEnd   = Math.ceil (worldRight  / GRID) * GRID;
  const yStart = Math.floor(worldTop    / GRID) * GRID;
  const yEnd   = Math.ceil (worldBottom / GRID) * GRID;

  for (let x = xStart; x <= xEnd; x += GRID) {
    ctx.beginPath();
    ctx.moveTo(x, worldTop);
    ctx.lineTo(x, worldBottom);
    ctx.stroke();
  }
  for (let y = yStart; y <= yEnd; y += GRID) {
    ctx.beginPath();
    ctx.moveTo(worldLeft, y);
    ctx.lineTo(worldRight, y);
    ctx.stroke();
  }
}

function drawMembers(labelManager, isDark) {
  members.forEach((m, idx) => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;

    // colour from results
    let color = m.type === 'bar' ? cssVar('--canvas-bar') : cssVar('--canvas-stroke');
    if (results && results.member_forces) {
      const f = results.member_forces[idx];
      const isZero = Math.abs(f) < 1e-3;
      color = isZero ? cssVar('--canvas-zero')
            : (f > 0 ? cssVar('--canvas-tension') : cssVar('--canvas-compression'));
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (m.type === 'bar') ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // override indicator — blue outline when member has per-member E/I/A
    if (m.E_override != null || m.I_override != null || m.A_override != null) {
      ctx.strokeStyle = cssVar('--canvas-member-preview');
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.lineTo(n2.x, n2.y);
      ctx.stroke();
    }

    // pin release circles
    if (m.pinLeft)  drawPinCircle(n1.x, n1.y, n2.x, n2.y, 'start');
    if (m.pinRight) drawPinCircle(n1.x, n1.y, n2.x, n2.y, 'end');

    if (document.getElementById('chkMemberIds')?.checked) {
      drawMemberIdLabel(n1, n2, idx, labelManager);
    }
  });
}

function drawMemberLabel(n1, n2, text, color, labelManager, isDark) {
  const mx = (n1.x + n2.x) / 2, my = (n1.y + n2.y) / 2;
  const fs = Math.round((BASE_LABEL_SIZE - 3) * labelScale * getSymbolScale());

  labelManager.add({
    text,
    anchorX: mx, anchorY: my,
    preferredX: mx, preferredY: my,
    priority: 40,
    color,
    font: '600 ' + fs + 'px ' + LABEL_FONT_FAMILY,
    fontSize: fs,
    bgColor: cssVar('--canvas-label-bg'),
    bgPadding: 1,
    textAlign: 'center',
    textBaseline: 'middle',
    radius: 14,
    type: 'memberForce',
  });
}

function drawPinCircle(x1, y1, x2, y2, end) {
  const offset = 10;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx/len, uy = dy/len;
  const cx = end === 'start' ? x1 + ux*offset : x2 - ux*offset;
  const cy = end === 'start' ? y1 + uy*offset : y2 - uy*offset;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI*2);
  ctx.strokeStyle = cssVar('--canvas-pin-release');
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = cssVar('--canvas-pin-release-fill');
  ctx.fill();
}

function drawMemberIdLabel(n1, n2, idx, labelManager) {
  const mx = (n1.x + n2.x) / 2;
  const my = (n1.y + n2.y) / 2;
  const fs = Math.round((BASE_LABEL_SIZE - 3) * labelScale * getSymbolScale());
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
  const fs = Math.round((BASE_LABEL_SIZE - 2) * labelScale * getSymbolScale() + 1);
  const showNodeIds = document.getElementById('chkNodeIds')?.checked;
  nodes.forEach(n => {
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI*2);
    ctx.fillStyle = cssVar('--canvas-node');
    ctx.fill();
    if (showNodeIds) {
      labelManager.add({
        text: String(n.id + 1),
        anchorX: n.x, anchorY: n.y,
        preferredX: n.x + 6, preferredY: n.y - 6,
        priority: 10,
        color: cssVar('--canvas-label'),
        font: 'bold ' + fs + 'px ' + LABEL_FONT_FAMILY,
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

/**
 * Phase 6 PUREBAR-04 (D-11, D-12) — diagnostic overlay rendering.
 *
 * Reads three module-level arrays (all 0-based ids):
 *   - pureBarNodeIds: pre-solve informational marker, drawn as a small
 *     filled red dot offset NE of each affected node so it doesn't
 *     overlap the existing node marker (drawNodes uses radius 5*sc).
 *   - offendingNodes: from structured 422 payload (cause + offending_*),
 *     drawn as a red ring around the node via highlightNode().
 *   - offendingMembers: from structured 422 payload, redrawn as a thick
 *     red solid line on top of drawMembers() (overrides the bar dash so
 *     the offending member is unambiguous even if it's a bar).
 *
 * Re-uses the same #e53935 red token used by drawNodes — no new CSS
 * class needed (D-04 Claude's Discretion: match existing canvas style).
 * Empty arrays → no-op (no flicker, no errors).
 */
function drawDiagnosticOverlays() {
  const sc  = getSymbolScale();
  const RED = cssVar('--canvas-diagnostic');

  // 1. Offending members — red thick solid line on top of drawMembers().
  if (offendingMembers.length > 0) {
    offendingMembers.forEach(idx => {
      const m = members[idx];
      if (!m) return;
      const a = nodes.find(nd => nd.id === m.start);
      const b = nodes.find(nd => nd.id === m.end);
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = RED;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);   // solid even for bar members
      ctx.stroke();
    });
  }

  // 2. Offending nodes — red ring via the existing highlightNode primitive.
  if (offendingNodes.length > 0) {
    offendingNodes.forEach(idx => {
      const n = nodes.find(nd => nd.id === idx);
      if (!n) return;
      highlightNode(n, RED);
    });
  }

  // 3. Pure-bar joint informational dots — small filled red dot offset NE.
  if (pureBarNodeIds.length > 0) {
    const r   = 3 * sc;
    const off = 10 * sc;
    pureBarNodeIds.forEach(idx => {
      const n = nodes.find(nd => nd.id === idx);
      if (!n) return;
      ctx.beginPath();
      ctx.arc(n.x + off, n.y - off, r, 0, Math.PI * 2);
      ctx.fillStyle = RED;
      ctx.fill();
    });
  }
}

function highlightNode(n, color) {
  ctx.beginPath();
  ctx.arc(n.x, n.y, 8, 0, Math.PI*2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ── Support symbols ───────────────────────────────────────────────────────
function drawSupports(labelManager) {
  supports.forEach(s => {
    const n = nodes.find(nd => nd.id === s.nodeId);
    if (!n) return;
    ctx.save();
    if      (s.type === 'fixed')   drawFixed(n.x, n.y);
    else if (s.type === 'pinned')  drawPin(n.x, n.y);
    else if (s.type === 'rollerY') drawRollerH(n.x, n.y);
    else if (s.type === 'rollerX') drawRollerV(n.x, n.y);
    else if (s.type === 'spring')  drawSpring(n.x, n.y, s.Kx, s.Ky, s.Ktheta, labelManager);
    ctx.restore();
  });
}

function drawFixed(x, y) {
  const sc = getSymbolScale();
  const w = 22 * sc, h = 7 * sc;
  ctx.fillStyle = cssVar('--canvas-support');
  ctx.fillRect(x - w/2, y, w, h);
  drawHatch(x - w/2 - 2*sc, x + w/2 + 2*sc, y + h, 'H');
}

function drawPin(x, y) {
  const sc = getSymbolScale();
  const h = 14 * sc, hw = 12 * sc;
  ctx.strokeStyle = cssVar('--canvas-support'); ctx.fillStyle = cssVar('--canvas-support'); ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x - hw, y + h); ctx.lineTo(x + hw, y + h);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - hw - 3*sc, y + h); ctx.lineTo(x + hw + 3*sc, y + h); ctx.stroke();
  drawHatch(x - hw - 3*sc, x + hw + 3*sc, y + h, 'H');
}

function drawRollerH(x, y) {
  const sc = getSymbolScale();
  const h = 12 * sc, hw = 11 * sc, r = 3 * sc;
  ctx.strokeStyle = cssVar('--canvas-support'); ctx.fillStyle = cssVar('--canvas-support'); ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x - hw, y + h); ctx.lineTo(x + hw, y + h);
  ctx.closePath(); ctx.stroke();
  const wy = y + h + r + 2*sc;
  [-hw*0.45, hw*0.45].forEach(dx => {
    ctx.beginPath(); ctx.arc(x + dx, wy, r, 0, Math.PI*2); ctx.stroke();
  });
  const by = wy + r + 2*sc;
  ctx.beginPath(); ctx.moveTo(x - hw - 3*sc, by); ctx.lineTo(x + hw + 3*sc, by); ctx.stroke();
  drawHatch(x - hw - 3*sc, x + hw + 3*sc, by, 'H');
}

function drawRollerV(x, y) {
  const sc = getSymbolScale();
  const h = 12 * sc, hh = 11 * sc, r = 3 * sc;
  ctx.strokeStyle = cssVar('--canvas-support'); ctx.fillStyle = cssVar('--canvas-support'); ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x - h, y - hh); ctx.lineTo(x - h, y + hh);
  ctx.closePath(); ctx.stroke();
  const wx = x - h - r - 2*sc;
  [-hh*0.45, hh*0.45].forEach(dy => {
    ctx.beginPath(); ctx.arc(wx, y + dy, r, 0, Math.PI*2); ctx.stroke();
  });
  const wl = wx - r - 2*sc;
  ctx.beginPath(); ctx.moveTo(wl, y - hh - 3*sc); ctx.lineTo(wl, y + hh + 3*sc); ctx.stroke();
  drawHatch(y - hh - 3*sc, y + hh + 3*sc, wl, 'V');
}

// D-07: coil glyph per active spring axis (Kx / Ky / Kθ), with value tag label.
// Horizontal coil on -X side for Kx, vertical coil below node for Ky,
// rotational spiral arc around node for Kθ.
function drawSpring(x, y, Kx, Ky, Ktheta, labelManager) {
  const sc = getSymbolScale();
  ctx.save();
  ctx.strokeStyle = cssVar('--canvas-spring'); ctx.fillStyle = cssVar('--canvas-spring'); ctx.lineWidth = 1.5;

  // Horizontal coil on -X side of node for Kx
  if (Kx != null) {
    const coilLen = 22 * sc, zigs = 4, amp = 3 * sc;
    const x0 = x - 2, xEnd = x0 - coilLen;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    for (let i = 1; i <= zigs; i++) {
      const xi = x0 - (coilLen * i / zigs);
      const yi = y + (i % 2 === 0 ? 0 : amp * (i % 4 < 2 ? 1 : -1));
      ctx.lineTo(xi, yi);
    }
    ctx.lineTo(xEnd, y);
    ctx.stroke();
    // Small fixed hatch (anchored wall) at the far end
    ctx.beginPath();
    ctx.moveTo(xEnd, y - 6*sc);
    ctx.lineTo(xEnd, y + 6*sc);
    ctx.stroke();
  }

  // Vertical coil below node for Ky
  if (Ky != null) {
    const coilLen = 22 * sc, zigs = 4, amp = 3 * sc;
    const y0 = y + 2, yEnd = y0 + coilLen;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    for (let i = 1; i <= zigs; i++) {
      const yi = y0 + (coilLen * i / zigs);
      const xi = x + (i % 2 === 0 ? 0 : amp * (i % 4 < 2 ? 1 : -1));
      ctx.lineTo(xi, yi);
    }
    ctx.lineTo(x, yEnd);
    ctx.stroke();
    // Small fixed hatch (anchored ground) at the far end
    ctx.beginPath();
    ctx.moveTo(x - 6*sc, yEnd);
    ctx.lineTo(x + 6*sc, yEnd);
    ctx.stroke();
  }

  // Rotational spring: small open spiral arc around node
  if (Ktheta != null) {
    const r = 9 * sc;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 1.8);
    ctx.stroke();
  }

  // Value tag label via LabelManager
  const labelParts = [];
  if (Kx     != null) labelParts.push('Kx=' + Kx + ' kN/m');
  if (Ky     != null) labelParts.push('Ky=' + Ky + ' kN/m');
  if (Ktheta != null) labelParts.push('Kθ=' + Ktheta + ' kN·m/rad');
  if (labelParts.length && labelManager) {
    const fs = Math.round(BASE_LABEL_SIZE * 0.9 * labelScale * getSymbolScale());
    labelManager.add({
      text: labelParts.join(' · '),
      anchorX: x, anchorY: y,
      preferredX: x + 10 * sc, preferredY: y - 10 * sc,
      priority: 70,
      color: cssVar('--canvas-spring'),
      font: fs + 'px ' + LABEL_FONT_FAMILY,
      fontSize: fs,
      textAlign: 'left',
      textBaseline: 'middle',
      type: 'spring',
    });
  }

  ctx.restore();
}

function drawHatch(from, to, base, dir) {
  ctx.strokeStyle = cssVar('--canvas-support'); ctx.lineWidth = 1;
  const spacing = 5, len = 6;
  const count = Math.ceil((to - from) / spacing);
  for (let i = 0; i <= count; i++) {
    const t = from + i * spacing;
    ctx.beginPath();
    if (dir === 'H') { ctx.moveTo(t, base);        ctx.lineTo(t - len, base + len); }
    else             { ctx.moveTo(base, t);         ctx.lineTo(base - len, t + len); }
    ctx.stroke();
  }
}

// ── Node loads ────────────────────────────────────────────────────────────
// Canvas-drawn legend pinned to the top-right. Captured in any right-click-save
// canvas export. Drops the Reaction row when chkReactions is unchecked.
function drawLegend() {
  if (!results) return;

  // Each row appears only when its respective diagram / toggle is active.
  // T/C/Z (axial) → chkAFD; BMD → chkBMD; SFD → chkSFD; Reaction → chkReactions.
  const chkAFD = document.getElementById('chkAFD');
  const chkBMD = document.getElementById('chkBMD');
  const chkSFD = document.getElementById('chkSFD');
  const chkR   = document.getElementById('chkReactions');

  const items = [];
  if (chkAFD && chkAFD.checked) {
    items.push({ color: cssVar('--canvas-tension'),     label: 'Tension (+)' });
    items.push({ color: cssVar('--canvas-compression'), label: 'Compression (-)' });
    items.push({ color: cssVar('--canvas-zero'),        label: 'Near-zero' });
  }
  if (chkBMD && chkBMD.checked) items.push({ color: cssVar('--canvas-bmd'), label: 'Bending moment' });
  if (chkSFD && chkSFD.checked) items.push({ color: cssVar('--canvas-sfd'), label: 'Shear force' });
  const chkDef = document.getElementById('chkDeflected');
  if (chkDef && chkDef.checked) items.push({ color: cssVar('--canvas-deflected'), label: 'Deflected shape', dashed: true });
  if (!chkR || chkR.checked)    items.push({ color: cssVar('--canvas-reaction'), label: 'Reaction' });

  if (items.length === 0) return;  // nothing to explain — don't draw an empty card

  // Legend uses its OWN scale: floored at 1.0 so Symbol size below default
  // (down to 0.5) doesn't shrink the legend into a squint. Symbol size > 1.0
  // still grows it. Keeps the legend readable at zoom-out / minimum symbol
  // size without freezing the larger-text use case.
  const sc = Math.max(1.0, getSymbolScale());
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);  // screen-space — pan/zoom must NOT move/scale the legend

  const fs      = Math.round(12 * sc);
  const lh      = Math.round(17 * sc);
  const swatchW = Math.round(22 * sc);
  const padX    = Math.round(10 * sc);
  const padY    = Math.round(8 * sc);
  const gap     = Math.round(8 * sc);
  const margin  = Math.round(10 * sc);

  ctx.font = `600 ${fs}px ${LABEL_FONT_FAMILY}`;
  let maxTextW = 0;
  items.forEach(it => { maxTextW = Math.max(maxTextW, ctx.measureText(it.label).width); });
  const boxW = padX * 2 + swatchW + gap + Math.ceil(maxTextW);
  const boxH = padY * 2 + items.length * lh;
  const x0 = canvas.width - boxW - margin;
  const y0 = margin;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  // Subtle drop shadow so the card visually lifts off the canvas.
  ctx.shadowColor   = isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur    = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle     = isDark ? 'rgba(22, 26, 32, 0.97)' : 'rgba(255, 255, 255, 0.98)';
  ctx.beginPath();
  ctx.rect(x0, y0, boxW, boxH);
  ctx.fill();

  // Clear shadow before stroking the border so the border itself doesn't blur.
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.38)' : '#555';
  ctx.lineWidth   = 2;
  ctx.stroke();

  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  items.forEach((it, i) => {
    const rowY = y0 + padY + i * lh + Math.round(lh / 2);
    ctx.strokeStyle = it.color;
    ctx.lineWidth   = 3;
    if (it.dashed) ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x0 + padX, rowY);
    ctx.lineTo(x0 + padX + swatchW, rowY);
    ctx.stroke();
    if (it.dashed) ctx.setLineDash([]);
    ctx.fillStyle = cssVar('--canvas-label');
    ctx.fillText(it.label, x0 + padX + swatchW + gap, rowY);
  });

  ctx.restore();
}

// Halo-stroked label — used by every on-canvas value label so text stays readable
// over support hatching, adjacent arrows, and in either light or dark mode.
function drawHaloedLabel(x, y, text, color) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  ctx.lineJoin    = 'round';
  ctx.miterLimit  = 2;
  ctx.lineWidth   = 4;
  ctx.strokeStyle = isDark ? 'rgba(22, 26, 32, 1)' : 'rgba(255, 255, 255, 1)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// Apex-at-node force arrow: head triangle touches the node, shaft extends OPPOSITE
// to the force direction, label sits at the tail outside the structure. Used by
// both drawNodeLoads (loads) and drawReactions (reactions).
function drawForceArrow(node, axis, forceValue, color, labelColor, label, labelManager, isDark, isReaction) {
  const sc        = getSymbolScale();
  const arrowLen  = 24 * sc;
  const chevronD  = 6 * sc;
  const chevronHW = 4 * sc;
  const apexGap   = 2 * sc;
  const fs        = Math.round(BASE_LABEL_SIZE * labelScale * sc);
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

  // Reaction labels: centred on shaft midpoint
  // Load labels: at tail end with gap
  const midX = (tailX + apexX) / 2;
  const midY = (tailY + apexY) / 2;
  const lblX = isReaction ? midX : tailX - dirX * labelGap;
  const lblY = isReaction ? midY : tailY - dirY * labelGap;

  labelManager.add({
    text: label,
    anchorX: node.x, anchorY: node.y,
    preferredX: lblX, preferredY: lblY,
    priority: isReaction ? 20 : 30,
    color: labelColor,
    font: '600 ' + fs + 'px ' + LABEL_FONT_FAMILY,
    fontSize: fs,
    bgColor: isReaction ? cssVar('--canvas-label-bg') : null,
    bgPadding: 1,
    haloColor: isReaction ? null : (isDark ? 'rgba(22, 26, 32, 1)' : 'rgba(255, 255, 255, 1)'),
    haloWidth: 4,
    textAlign: 'center',
    textBaseline: 'middle',
    type: isReaction ? 'reaction' : 'load',
  });
}

// Moment arc with V-style arrowhead at the end of the arc. Used by both
// drawNodeLoads (moment loads, kind='load', r=14*sc — unchanged geometry from
// pre-cyp) and drawReactions (moment reactions, kind='reaction', r=18*sc — bigger
// so the two visually differ when adjacent at the same node).
function drawMomentArc(node, momentValue, color, labelColor, label, opts, labelManager, isDark) {
  const sc      = getSymbolScale();
  const kind    = (opts && opts.kind) || 'reaction';
  const r       = (kind === 'load' ? 14 : 18) * sc;
  const arrowSz = 5 * sc;
  const fs      = Math.round(BASE_LABEL_SIZE * labelScale * sc);
  const sign    = momentValue > 0 ? 1 : -1;  // + = CCW (mathematical / world convention)

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 2;

  // Arc geometry mirrors the pre-cyp moment-load arc so kind='load' stays
  // byte-identical to the previous visual.
  const startAngle = sign > 0 ? 0.3 : Math.PI + 0.3;
  const endAngle   = sign > 0 ? Math.PI * 1.7 : Math.PI * 2.7;
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, startAngle, endAngle);
  ctx.stroke();

  // V-style arrowhead at end of arc (open V, not filled triangle — matches existing moment-load style)
  const ax   = node.x + r * Math.cos(endAngle);
  const ay   = node.y + r * Math.sin(endAngle);
  const tang = endAngle + sign * Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(ax + arrowSz * Math.cos(tang - 0.5), ay + arrowSz * Math.sin(tang - 0.5));
  ctx.lineTo(ax, ay);
  ctx.lineTo(ax + arrowSz * Math.cos(tang + 0.5), ay + arrowSz * Math.sin(tang + 0.5));
  ctx.fill();

  ctx.restore();

  // Label goes through the LabelManager for collision avoidance
  const isReaction = kind === 'reaction';
  labelManager.add({
    text: label,
    anchorX: node.x, anchorY: node.y,
    preferredX: node.x, preferredY: node.y - r - 6,
    priority: isReaction ? 20 : 30,
    color: labelColor,
    font: '600 ' + fs + 'px ' + LABEL_FONT_FAMILY,
    fontSize: fs,
    haloColor: isDark ? 'rgba(22, 26, 32, 1)' : 'rgba(255, 255, 255, 1)',
    haloWidth: 4,
    textAlign: 'center',
    textBaseline: 'middle',
    type: isReaction ? 'reaction' : 'load',
  });
}

function drawNodeLoads(labelManager, isDark) {
  nodeLoads.forEach(l => {
    const n = nodes.find(nd => nd.id === l.nodeId);
    if (!n) return;
    if (l.direction === 'moment') {
      const label = (Math.abs(l.magnitude) / 1000).toFixed(1) + ' kNm';
      drawMomentArc(n, l.magnitude, cssVar('--canvas-load-moment'), cssVar('--canvas-load-moment-label'), label, { kind: 'load' }, labelManager, isDark);
    } else {
      const label = (Math.abs(l.magnitude) / 1000).toFixed(1) + ' kN';
      drawForceArrow(n, l.direction, l.magnitude, cssVar('--canvas-load'), cssVar('--canvas-load-label'), label, labelManager, isDark, false);
    }
  });
}

function drawReactions(labelManager, isDark) {
  if (!results || !results.FG) return;
  const FG    = results.FG;
  const ZERO  = 1e-3;
  const fcol  = cssVar('--canvas-reaction');
  const flbl  = cssVar('--canvas-reaction-label');
  const mcol  = cssVar('--canvas-reaction-moment');

  supports.forEach(s => {
    const n = nodes.find(nd => nd.id === s.nodeId);
    if (!n) return;
    const base = s.nodeId * 3;  // frame2d: 3 DOF/node — [Fx, Fy, Mz]

    let restrained = [];
    switch (s.type) {
      case 'fixed':   restrained = ['x', 'y', 'm']; break;
      case 'pinned':  restrained = ['x', 'y']; break;
      case 'rollerX': restrained = ['x']; break;
      case 'rollerY': restrained = ['y']; break;
      case 'spring':
        if (s.Kx     != null) restrained.push('x');
        if (s.Ky     != null) restrained.push('y');
        if (s.Ktheta != null) restrained.push('m');
        break;
    }

    restrained.forEach(dof => {
      const idx = dof === 'x' ? base + 0 : dof === 'y' ? base + 1 : base + 2;
      const r   = FG[idx];
      if (Math.abs(r) < ZERO) return;
      if (dof === 'm') {
        const label = (Math.abs(r) / 1000).toFixed(2) + ' kNm';
        drawMomentArc(n, r, mcol, flbl, label, { kind: 'reaction' }, labelManager, isDark);
      } else {
        const label = (Math.abs(r) / 1000).toFixed(2) + ' kN';
        drawForceArrow(n, dof, r, fcol, flbl, label, labelManager, isDark, true);
      }
    });
  });
}

// ── Node label overlay ────────────────────────────────────────────────────
function drawNodeLabels(labelManager) {
  var fontSize = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale() + 1);
  nodes.forEach(function(n, i) {
    var base = i * 3 + 1;
    var label = 'N' + i + ' [' + base + ',' + (base + 1) + ',' + (base + 2) + ']';
    labelManager.add({
      text: label,
      anchorX: n.x, anchorY: n.y,
      preferredX: n.x + 8, preferredY: n.y - 8,
      priority: 15,
      color: cssVar('--canvas-label'),
      font: '600 ' + fontSize + 'px ' + LABEL_FONT_FAMILY,
      fontSize: fontSize,
      bgColor: cssVar('--canvas-label-bg'),
      bgPadding: 2,
      textAlign: 'left',
      textBaseline: 'bottom',
      type: 'dof',
    });
  });
}

// ── UDL arrows ────────────────────────────────────────────────────────────
function drawUDLs(labelManager) {
  members.forEach(m => {
    if (!m.udl) return;
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;

    const arrowLen = 20;
    const sign = m.udl > 0 ? 1 : -1;   // positive = downward in canvas (y increases down)
    const steps = Math.max(2, Math.floor(Math.hypot(n2.x-n1.x, n2.y-n1.y) / 22));

    ctx.strokeStyle = cssVar('--canvas-udl'); ctx.fillStyle = cssVar('--canvas-udl'); ctx.lineWidth = 1.5;

    // top connecting line
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y - arrowLen * sign);
    ctx.lineTo(n2.x, n2.y - arrowLen * sign);
    ctx.stroke();

    // arrows
    for (let i = 0; i <= steps; i++) {
      const t  = i / steps;
      const ax = n1.x + t*(n2.x - n1.x);
      const ay = n1.y + t*(n2.y - n1.y);
      ctx.beginPath();
      ctx.moveTo(ax, ay - arrowLen * sign);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ax - 4, ay - 8*sign);
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax + 4, ay - 8*sign);
      ctx.fill();
    }

    // label via LabelManager
    const mx = (n1.x + n2.x) / 2;
    const my = (n1.y + n2.y) / 2;
    const fs = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale());
    labelManager.add({
      text: (Math.abs(m.udl)/1000).toFixed(1)+' kN/m',
      anchorX: mx, anchorY: my,
      preferredX: mx, preferredY: my - arrowLen*sign - 6,
      priority: 60,
      color: cssVar('--canvas-udl-label'),
      font: 'bold ' + fs + 'px ' + LABEL_FONT_FAMILY,
      fontSize: fs,
      textAlign: 'center',
      textBaseline: 'middle',
      type: 'udl',
    });
  });

  // Horizontal UDL (w_x) — horizontal arrows in global X direction (wind load convention)
  members.forEach(m => {
    if (!m.udl_x) return;
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;

    const arrowLen = 20;
    const sign = m.udl_x > 0 ? 1 : -1;  // positive = rightward on canvas (+X global)

    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const len = Math.hypot(dx, dy) || 1;

    const steps = Math.max(2, Math.floor(len / 22));
    ctx.strokeStyle = cssVar('--canvas-udl-x'); ctx.fillStyle = cssVar('--canvas-udl-x'); ctx.lineWidth = 1.5;

    // Horizontal baseline along the arrow tails (offset horizontally from member)
    const baseOffsetX = -arrowLen * sign;
    ctx.beginPath();
    ctx.moveTo(n1.x + baseOffsetX, n1.y);
    ctx.lineTo(n2.x + baseOffsetX, n2.y);
    ctx.stroke();

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ax = n1.x + t * dx;   // point on member (arrow tip)
      const ay = n1.y + t * dy;
      const tailX = ax - arrowLen * sign;
      const tailY = ay;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - 8 * sign, ay - 4);
      ctx.lineTo(ax - 8 * sign, ay + 4);
      ctx.closePath();
      ctx.fill();
    }

    const mx = (n1.x + n2.x) / 2;
    const my = (n1.y + n2.y) / 2;
    const fs = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale());
    labelManager.add({
      text: (Math.abs(m.udl_x) / 1000).toFixed(1) + ' kN/m',
      anchorX: mx, anchorY: my,
      preferredX: mx - arrowLen * sign * 1.8, preferredY: my,
      priority: 60,
      color: cssVar('--canvas-udl-x-label'),
      font: 'bold ' + fs + 'px ' + LABEL_FONT_FAMILY,
      fontSize: fs,
      textAlign: 'center',
      textBaseline: 'middle',
      type: 'udl',
    });
  });
}

// ── Text annotation helper ────────────────────────────────────────────────
// Draws text with a white backing rect so it's readable over diagrams.
function labelText(text, x, y, color) {
  ctx.save();
  const fs = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale());
  ctx.font = `bold ${fs}px ${LABEL_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width;
  const h = fs + 4;
  ctx.fillStyle = cssVar('--canvas-label-bg');
  ctx.fillRect(x - w/2 - 2, y - h/2, w + 4, h);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ── Deflected shape ───────────────────────────────────────────────────────
// Uses cubic Hermite interpolation (20 segments per member) so that elements
// with restrained end nodes (e.g. simply-supported) still show a curved shape.
// The solver theta convention is: positive = clockwise. Standard Hermite uses
// slope (dy/dx) = -solver_theta, so we negate before passing to shape functions.
// For UDL members, adds the quartic particular-solution correction so midspan
// deflection is exact rather than the 80%-accurate cubic approximation.
function drawDeflected(labelManager) {
  try {
  const scale = parseFloat(document.getElementById('inputScale').value) || 100;
  const E = parseFloat(document.getElementById('inputE').value) * 1e9;
  const I = parseFloat(document.getElementById('inputI').value) * 1e-8;
  const UG = results.UG;
  const NSEG = 20;
  ctx.strokeStyle = cssVar('--canvas-deflected');
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  let maxTransverse = 0, maxLX = 0, maxLY = 0;
  members.forEach(m => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;
    const ni = m.start, nj = m.end;
    const L_m = memberLengthReal(m);
    if (L_m < 1e-10) return;
    // Direction cosines in structural (Y-up) coords
    const cosA = (n2.realX - n1.realX) / L_m;
    const sinA = (n2.realY - n1.realY) / L_m;
    // Screen pixels per structural metre
    const ppm = Math.hypot(n2.x - n1.x, n2.y - n1.y) / L_m;
    // Nodal DOFs in metres / radians (structural Y-up)
    const ux1 = UG[ni*3], uy1 = UG[ni*3+1];
    // Standard Hermite slope = -solver_theta (solver uses clockwise-positive)
    const th1 = -UG[ni*3+2];
    const ux2 = UG[nj*3], uy2 = UG[nj*3+1];
    const th2 = -UG[nj*3+2];
    // Local transverse (perpendicular to member, structural coords)
    const v1 = -sinA * ux1 + cosA * uy1;
    const v2 = -sinA * ux2 + cosA * uy2;
    // Local axial
    const u1 = cosA * ux1 + sinA * uy1;
    const u2 = cosA * ux2 + sinA * uy2;
    ctx.beginPath();
    for (let k = 0; k <= NSEG; k++) {
      const xi = k / NSEG;
      const xi2 = xi*xi, xi3 = xi2*xi;
      // Cubic Hermite shape functions (standard, slope-based)
      const H1 = 1 - 3*xi2 + 2*xi3;
      const H2 = xi - 2*xi2 + xi3;
      const H3 = 3*xi2 - 2*xi3;
      const H4 = -xi2 + xi3;
      // Transverse displacement (upward-positive structural metres)
      let v = H1*v1 + H2*L_m*th1 + H3*v2 + H4*L_m*th2;
      // UDL quartic correction: exact - hermite = -w*L^4/(24EI)*xi^2*(1-xi)^2
      // (negative because downward UDL → negative structural v)
      if (m.udl && m.type !== 'bar' && E > 0 && I > 0) {
        v -= m.udl * Math.pow(L_m, 4) / (24 * E * I) * xi2 * (1-xi) * (1-xi);
      }
      // Axial displacement (linear)
      const u = (1-xi)*u1 + xi*u2;
      // Global structural displacement (metres)
      const du_x = cosA * u - sinA * v;
      const du_y = sinA * u + cosA * v;
      // Screen position: base + scaled displacement (flip Y: structural+Y → screen-Y)
      const baseX = n1.x + xi * (n2.x - n1.x);
      const baseY = n1.y + xi * (n2.y - n1.y);
      const sx = baseX + du_x * scale * ppm;
      const sy = baseY - du_y * scale * ppm;
      if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      if (Math.abs(v) > maxTransverse) { maxTransverse = Math.abs(v); maxLX = sx; maxLY = sy; }
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);
  if (maxTransverse > 1e-8) {
    const dfFs = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale());
    labelManager.add({
      text: 'δ=' + (maxTransverse * 1000).toFixed(3) + ' mm',
      anchorX: maxLX, anchorY: maxLY,
      preferredX: maxLX, preferredY: maxLY - 12,
      priority: 50,
      color: cssVar('--canvas-deflected-label'),
      font: 'bold ' + dfFs + 'px ' + LABEL_FONT_FAMILY,
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

// ── Bending moment diagram ────────────────────────────────────────────────
// M_bmd(ξ) = Mi*(1-ξ) - Mj*ξ + w*L²/2*ξ*(1-ξ)
// The Mj negation matches the SFD sign fix: solver stores element end forces
// (the element exerts -Mj on node j), so the internal moment at j = -Mj_element.
// Positive moment (sagging) draws on the tension face (below for horizontal beam).
function drawBMD(labelManager) {
  const moments = results.member_moments;
  if (!moments) return;
  const NSEG = 20;

  // First pass: find scale (must sample all points to catch UDL midspan peak)
  let minMbrLen = Infinity, maxMoment = 0;
  members.forEach((m, idx) => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;
    minMbrLen = Math.min(minMbrLen, Math.hypot(n2.x-n1.x, n2.y-n1.y));
    const Mi = moments[idx][0], Mj = moments[idx][1];
    const L_m = memberLengthReal(m);
    for (let k = 0; k <= NSEG; k++) {
      const xi = k / NSEG;
      let M = Mi*(1-xi) - Mj*xi;
      if (m.udl && m.type !== 'bar') M += m.udl * L_m * L_m / 2 * xi * (1-xi);
      maxMoment = Math.max(maxMoment, Math.abs(M));
    }
  });
  if (maxMoment < 1e-10) return;
  const diagMult = parseFloat(document.getElementById('inputBMDScale').value) || 1;
  const scaleFactor = capScaleFactor((0.2 * minMbrLen) / maxMoment * diagMult, maxMoment, minMbrLen);

  ctx.fillStyle = cssVar('--canvas-bmd-fill');
  ctx.strokeStyle = cssVar('--canvas-bmd');
  ctx.lineWidth = 1.5;

  members.forEach((m, idx) => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const angle = Math.atan2(dy, dx);
    const perpX = -Math.sin(angle), perpY = Math.cos(angle);
    const Mi = moments[idx][0], Mj = moments[idx][1];
    const L_m = memberLengthReal(m);

    // Sample moment at each subdivision
    const pts = [];
    for (let k = 0; k <= NSEG; k++) {
      const xi = k / NSEG;
      let M = Mi*(1-xi) - Mj*xi;
      if (m.udl && m.type !== 'bar') M += m.udl * L_m * L_m / 2 * xi * (1-xi);
      pts.push({ bx: n1.x + xi*dx, by: n1.y + xi*dy, off: M * scaleFactor });
    }

    // Draw filled polygon: forward along baseline then back along offset contour
    ctx.beginPath();
    ctx.moveTo(pts[0].bx, pts[0].by);
    for (let k = 1; k <= NSEG; k++) ctx.lineTo(pts[k].bx, pts[k].by);
    for (let k = NSEG; k >= 0; k--) ctx.lineTo(pts[k].bx + perpX*pts[k].off, pts[k].by + perpY*pts[k].off);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = cssVar('--canvas-zero'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
    ctx.fillStyle = cssVar('--canvas-bmd-fill'); ctx.strokeStyle = cssVar('--canvas-bmd'); ctx.lineWidth = 1.5;
  });

  {
    // ── Annotate end moments and UDL midspan peak (always — chkDiagLabels retired) ─────────────────────────
    const fmtM = v => (v / 1000).toFixed(2) + ' kNm';
    const nudgeM = 8 * getSymbolScale();
    const bmdFs = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale());
    const bmdColor = cssVar('--canvas-bmd');
    members.forEach((m, idx) => {
      const n1 = nodes.find(n => n.id === m.start);
      const n2 = nodes.find(n => n.id === m.end);
      if (!n1 || !n2) return;
      const dx = n2.x - n1.x, dy = n2.y - n1.y;
      const angle = Math.atan2(dy, dx);
      const perpX = -Math.sin(angle), perpY = Math.cos(angle);
      const Mi = moments[idx][0], Mj = moments[idx][1];
      const L_m = memberLengthReal(m);
      if (Math.abs(Mi) > maxMoment * 0.01) {
        const off = Mi * scaleFactor + nudgeM * Math.sign(Mi);
        labelManager.add({
          text: fmtM(Mi), anchorX: n1.x, anchorY: n1.y,
          preferredX: n1.x + perpX * off, preferredY: n1.y + perpY * off,
          priority: 50, color: bmdColor, font: 'bold ' + bmdFs + 'px ' + LABEL_FONT_FAMILY, fontSize: bmdFs,
          bgColor: cssVar('--canvas-label-bg'), bgPadding: 2, textAlign: 'center', textBaseline: 'middle', type: 'diagram',
        });
      }
      const Mj_bmd = -Mj;
      if (Math.abs(Mj_bmd) > maxMoment * 0.01) {
        const off = Mj_bmd * scaleFactor + nudgeM * Math.sign(Mj_bmd);
        labelManager.add({
          text: fmtM(Mj_bmd), anchorX: n2.x, anchorY: n2.y,
          preferredX: n2.x + perpX * off, preferredY: n2.y + perpY * off,
          priority: 50, color: bmdColor, font: 'bold ' + bmdFs + 'px ' + LABEL_FONT_FAMILY, fontSize: bmdFs,
          bgColor: cssVar('--canvas-label-bg'), bgPadding: 2, textAlign: 'center', textBaseline: 'middle', type: 'diagram',
        });
      }
      if (m.udl && m.type !== 'bar') {
        let peakM = 0, peakXi = 0.5;
        for (let k = 0; k <= NSEG; k++) {
          const xi = k / NSEG;
          const M = Mi*(1-xi) - Mj*xi + m.udl * L_m * L_m / 2 * xi * (1-xi);
          if (Math.abs(M) > Math.abs(peakM)) { peakM = M; peakXi = xi; }
        }
        if (peakXi > 0.1 && peakXi < 0.9 && Math.abs(peakM) > maxMoment * 0.01) {
          const bx = n1.x + peakXi * dx, by = n1.y + peakXi * dy;
          const off = peakM * scaleFactor + nudgeM * Math.sign(peakM);
          labelManager.add({
            text: fmtM(peakM), anchorX: bx, anchorY: by,
            preferredX: bx + perpX * off, preferredY: by + perpY * off,
            priority: 50, color: bmdColor, font: 'bold ' + bmdFs + 'px ' + LABEL_FONT_FAMILY, fontSize: bmdFs,
            bgColor: cssVar('--canvas-label-bg'), bgPadding: 2, textAlign: 'center', textBaseline: 'middle', type: 'diagram',
          });
        }
      }
    });
  }
}

// ── Shear force diagram ────────────────────────────────────────────────────
// V varies linearly for UDL: V(ξ) = Vi*(1-ξ) + Vj*ξ.
// NSEG points ensure correct zero-crossing is captured visually.
function drawSFD(labelManager) {
  const shears = results.member_shears;
  if (!shears) return;
  const NSEG = 20;

  let minMbrLen = Infinity, maxShear = 0;
  members.forEach((m, idx) => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;
    minMbrLen = Math.min(minMbrLen, Math.hypot(n2.x-n1.x, n2.y-n1.y));
    maxShear = Math.max(maxShear, Math.abs(shears[idx][0]), Math.abs(shears[idx][1]));
  });
  if (maxShear < 1e-10) return;
  const diagMult = parseFloat(document.getElementById('inputSFDScale').value) || 1;
  const scaleFactor = capScaleFactor((0.2 * minMbrLen) / maxShear * diagMult, maxShear, minMbrLen);

  ctx.fillStyle = cssVar('--canvas-sfd-fill');
  ctx.strokeStyle = cssVar('--canvas-sfd');
  ctx.lineWidth = 1.5;

  members.forEach((m, idx) => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const angle = Math.atan2(dy, dx);
    const perpX = -Math.sin(angle), perpY = Math.cos(angle);
    // mbrShears stores element-end forces (both positive = upward reaction).
    // SFD convention: V at j-end = -(element force at j-end). Negate Vj.
    const Vi = shears[idx][0], Vj = -shears[idx][1];

    const pts = [];
    for (let k = 0; k <= NSEG; k++) {
      const xi = k / NSEG;
      const V = Vi*(1-xi) + Vj*xi;
      pts.push({ bx: n1.x + xi*dx, by: n1.y + xi*dy, off: V * scaleFactor });
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].bx, pts[0].by);
    for (let k = 1; k <= NSEG; k++) ctx.lineTo(pts[k].bx, pts[k].by);
    for (let k = NSEG; k >= 0; k--) ctx.lineTo(pts[k].bx + perpX*pts[k].off, pts[k].by + perpY*pts[k].off);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = cssVar('--canvas-zero'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
    ctx.fillStyle = cssVar('--canvas-sfd-fill'); ctx.strokeStyle = cssVar('--canvas-sfd'); ctx.lineWidth = 1.5;
  });

  {
    // ── Annotate end shears and zero crossings (always — chkDiagLabels retired) ────────────────────────────
    const fmtV = v => (v / 1000).toFixed(2) + ' kN';
    const nudgeV = 8 * getSymbolScale();
    const sfdFs = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale());
    const sfdColor = cssVar('--canvas-sfd');
    members.forEach((m, idx) => {
      const n1 = nodes.find(n => n.id === m.start);
      const n2 = nodes.find(n => n.id === m.end);
      if (!n1 || !n2) return;
      const dx = n2.x - n1.x, dy = n2.y - n1.y;
      const angle = Math.atan2(dy, dx);
      const perpX = -Math.sin(angle), perpY = Math.cos(angle);
      const Vi = shears[idx][0], Vj = -shears[idx][1];
      if (Math.abs(Vi) > maxShear * 0.01) {
        const off = Vi * scaleFactor + nudgeV * Math.sign(Vi);
        labelManager.add({
          text: fmtV(Vi), anchorX: n1.x, anchorY: n1.y,
          preferredX: n1.x + perpX * off, preferredY: n1.y + perpY * off,
          priority: 50, color: sfdColor, font: 'bold ' + sfdFs + 'px ' + LABEL_FONT_FAMILY, fontSize: sfdFs,
          bgColor: cssVar('--canvas-label-bg'), bgPadding: 2, textAlign: 'center', textBaseline: 'middle', type: 'diagram',
        });
      }
      if (Math.abs(Vj) > maxShear * 0.01) {
        const off = Vj * scaleFactor + nudgeV * Math.sign(Vj);
        labelManager.add({
          text: fmtV(Vj), anchorX: n2.x, anchorY: n2.y,
          preferredX: n2.x + perpX * off, preferredY: n2.y + perpY * off,
          priority: 50, color: sfdColor, font: 'bold ' + sfdFs + 'px ' + LABEL_FONT_FAMILY, fontSize: sfdFs,
          bgColor: cssVar('--canvas-label-bg'), bgPadding: 2, textAlign: 'center', textBaseline: 'middle', type: 'diagram',
        });
      }
      if (Vi * Vj < 0) {
        const xi0 = Vi / (Vi - Vj);
        const zx = n1.x + xi0 * dx, zy = n1.y + xi0 * dy;
        ctx.save();
        ctx.strokeStyle = sfdColor; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(zx + perpX * 6, zy + perpY * 6);
        ctx.lineTo(zx - perpX * 6, zy - perpY * 6);
        ctx.stroke();
        ctx.restore();
        labelManager.add({
          text: 'V=0', anchorX: zx, anchorY: zy,
          preferredX: zx, preferredY: zy,
          priority: 50, color: sfdColor, font: 'bold ' + sfdFs + 'px ' + LABEL_FONT_FAMILY, fontSize: sfdFs,
          bgColor: cssVar('--canvas-label-bg'), bgPadding: 2, textAlign: 'center', textBaseline: 'middle', type: 'diagram',
        });
      }
    });
  }
}

// Soft-cap a raw scaleFactor so the largest-magnitude polygon stays within a
// sensible perpendicular range. Linear up to a "knee" at minMbrLen, then
// asymptotically approaches 1.5*minMbrLen via tanh — preserves smooth UDL
// curvature (no table-tops) AND gives the slider's 5..10 range visible (if
// diminishing) headroom instead of plateauing dead at the knee.
function capScaleFactor(rawScaleFactor, maxValue, minMbrLen) {
  if (maxValue < 1e-10) return rawScaleFactor;
  const peakOffset = rawScaleFactor * maxValue;
  const knee     = minMbrLen;          // linear growth up to here
  const headroom = 0.5 * minMbrLen;    // asymptotic range above the knee
  if (peakOffset <= knee) return rawScaleFactor;
  const excess     = peakOffset - knee;
  const compressed = knee + headroom * Math.tanh(excess / headroom);
  return compressed / maxValue;
}

// Hex (#RRGGBB) -> rgba(r,g,b,alpha) helper for diagram fills derived from token hex.
function hexToRgba(hex, alpha) {
  const c = (hex || '').trim().replace('#', '');
  if (c.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// AFD — Axial Force Diagram. Axial is constant per member (no distributed
// axial loads in the solver), so each diagram is a perpendicular RECTANGLE
// alongside the member rather than a curve. Tension = blue, compression =
// red; matches the member-line colour code. Drawn on the OPPOSITE side of
// the member from BMD/SFD (negative-perp direction) so the three diagrams
// don't overlap on a simple beam.
function drawAFD(labelManager) {
  const axial = results && results.member_forces;
  if (!axial) return;

  // First pass: find max |F| + min member length for scaling.
  let minMbrLen = Infinity, maxAbs = 0;
  members.forEach((m, idx) => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;
    minMbrLen = Math.min(minMbrLen, Math.hypot(n2.x - n1.x, n2.y - n1.y));
    maxAbs    = Math.max(maxAbs, Math.abs(axial[idx]));
  });
  if (maxAbs < 1e-10) return;

  const diagMult    = parseFloat(document.getElementById('inputAFDScale').value) || 1;
  const scaleFactor = capScaleFactor((0.2 * minMbrLen) / maxAbs * diagMult, maxAbs, minMbrLen);

  const tensionStroke     = cssVar('--canvas-tension');
  const compressionStroke = cssVar('--canvas-compression');
  const tensionFill       = hexToRgba(tensionStroke, 0.25);
  const compressionFill   = hexToRgba(compressionStroke, 0.25);

  members.forEach((m, idx) => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;
    const f = axial[idx];
    if (Math.abs(f) < 1e-3) return;

    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const angle = Math.atan2(dy, dx);
    // Negative perpendicular (opposite side to BMD/SFD).
    const perpX =  Math.sin(angle);
    const perpY = -Math.cos(angle);
    const off   = Math.abs(f) * scaleFactor;

    const isTension = f > 0;
    ctx.fillStyle   = isTension ? tensionFill   : compressionFill;
    ctx.strokeStyle = isTension ? tensionStroke : compressionStroke;
    ctx.lineWidth   = 1.5;

    // Rectangle: baseline (n1 -> n2) and offset side (n2+perp*off -> n1+perp*off).
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.lineTo(n2.x + perpX * off, n2.y + perpY * off);
    ctx.lineTo(n1.x + perpX * off, n1.y + perpY * off);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Value labels at the polygon midpoint (always — chkDiagLabels retired).
  {
    const fmtN = v => (v / 1000).toFixed(2) + ' kN';
    const nudge = 8 * getSymbolScale();
    const afdFs = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale());
    members.forEach((m, idx) => {
      const n1 = nodes.find(n => n.id === m.start);
      const n2 = nodes.find(n => n.id === m.end);
      if (!n1 || !n2) return;
      const f = axial[idx];
      if (Math.abs(f) < maxAbs * 0.01) return;
      const angle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
      const perpX =  Math.sin(angle);
      const perpY = -Math.cos(angle);
      const off   = Math.abs(f) * scaleFactor + nudge;
      const mx    = (n1.x + n2.x) / 2;
      const my    = (n1.y + n2.y) / 2;
      const afdColor = f > 0 ? cssVar('--canvas-tension') : cssVar('--canvas-compression');
      labelManager.add({
        text: fmtN(f), anchorX: mx, anchorY: my,
        preferredX: mx + perpX * off, preferredY: my + perpY * off,
        priority: 50, color: afdColor, font: 'bold ' + afdFs + 'px ' + LABEL_FONT_FAMILY, fontSize: afdFs,
        bgColor: cssVar('--canvas-label-bg'), bgPadding: 2, textAlign: 'center', textBaseline: 'middle', type: 'diagram',
      });
    });
  }
}

document.getElementById('chkSupports').addEventListener('change', draw);
document.getElementById('chkLoads').addEventListener('change', draw);
document.getElementById('chkReactions').addEventListener('change', draw);
document.getElementById('chkDeflected').addEventListener('change', draw);
document.getElementById('chkBMD').addEventListener('change', draw);
document.getElementById('chkSFD').addEventListener('change', draw);
document.getElementById('chkAFD').addEventListener('change', draw);
document.getElementById('chkNodeLabels').addEventListener('change', draw);
document.getElementById('chkNodeIds').addEventListener('change', draw);
document.getElementById('chkMemberIds').addEventListener('change', draw);
document.getElementById('chkMemberForces').addEventListener('change', draw);
document.getElementById('chkGrid').addEventListener('change', draw);

// Conditional visibility for diagram-specific scale controls.
// Deflection scale slider only appears when chkDeflected is on.
// BMD/SFD scale slider only appears when chkBMD / chkSFD / chkAFD is on (all three share it).
function updateScaleVisibility() {
  const defLabel = document.getElementById('deflectionScaleLabel');
  const bmdLabel = document.getElementById('bmdScaleLabel');
  const sfdLabel = document.getElementById('sfdScaleLabel');
  const afdLabel = document.getElementById('afdScaleLabel');
  const chkDef = document.getElementById('chkDeflected');
  const chkBMD = document.getElementById('chkBMD');
  const chkSFD = document.getElementById('chkSFD');
  const chkAFD = document.getElementById('chkAFD');
  if (defLabel) defLabel.style.display = (chkDef && chkDef.checked) ? '' : 'none';
  if (bmdLabel) bmdLabel.style.display = (chkBMD && chkBMD.checked) ? '' : 'none';
  if (sfdLabel) sfdLabel.style.display = (chkSFD && chkSFD.checked) ? '' : 'none';
  if (afdLabel) afdLabel.style.display = (chkAFD && chkAFD.checked) ? '' : 'none';
}
['chkDeflected', 'chkBMD', 'chkSFD', 'chkAFD'].forEach(id => {
  document.getElementById(id).addEventListener('change', updateScaleVisibility);
});
updateScaleVisibility();
// Two-way bind a slider + number input pair so each updates the other and triggers a callback.
function syncScaleControls(rangeId, numberId, onChange) {
  const range  = document.getElementById(rangeId);
  const number = document.getElementById(numberId);
  if (!range || !number) return;
  const sync = (src, dst) => () => {
    dst.value = src.value;
    try { onChange(); }
    catch (err) { showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err); throw err; }
  };
  range.addEventListener('input', sync(range, number));
  number.addEventListener('input', sync(number, range));
}

syncScaleControls('inputScaleRange',         'inputScale',         draw);
syncScaleControls('inputBMDScaleRange',      'inputBMDScale',      draw);
syncScaleControls('inputSFDScaleRange',      'inputSFDScale',      draw);
syncScaleControls('inputAFDScaleRange',      'inputAFDScale',      draw);
syncScaleControls('inputDisplayScaleRange',  'inputDisplayScale',  function () {
  var v = parseFloat(document.getElementById('inputDisplayScale').value) || 1.0;
  document.getElementById('inputSymbolScale').value = v;
  document.getElementById('inputLabelScale').value = v;
  labelScale = v;
  draw();
});

// ── Floating cards (i52) ──────────────────────────────────────────────────
// Each toolbar card carries a small float button injected into its <summary>.
// Clicking the button moves the <details> from the toolbar into #cardFloatLayer
// (inside .canvas-area), where it sits position: absolute and is draggable by
// its <summary>. Clicking again returns it to its original toolbar slot.

let _floatZIndex = 100;  // monotonic counter for D-7 bring-to-top

function setupCardFloat() {
  const canvasArea = document.querySelector('.canvas-area');
  if (!canvasArea) return;

  // Create the absolute-positioning layer once.
  let layer = document.getElementById('cardFloatLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'cardFloatLayer';
    canvasArea.appendChild(layer);
  }

  const cards = document.querySelectorAll('details.card');
  cards.forEach((card, i) => {
    card.dataset.originalIndex = String(i);
    card.dataset.state = 'docked';

    const summary = card.querySelector('summary');
    if (!summary) return;

    // Avoid double-injection if setupCardFloat happens to be called twice.
    if (summary.querySelector('.card-float-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-float-btn';
    btn.title = 'Float panel';
    btn.textContent = '↗';   // ↗
    btn.addEventListener('click', (e) => {
      e.stopPropagation();        // don't toggle the <details> disclosure
      if (card.dataset.state === 'docked') floatCard(card);
      else                                  dockCard(card);
    });
    summary.appendChild(btn);
  });
}

function floatCard(card) {
  const layer = document.getElementById('cardFloatLayer');
  if (!layer) return;

  // Initial position: top-right of #cardFloatLayer (which fills .canvas-area).
  // 12 px inner margin per D-2.
  const w = card.offsetWidth || 180;
  const layerRect = layer.getBoundingClientRect();
  card.style.left = Math.max(12, layerRect.width - w - 12) + 'px';
  card.style.top  = '12px';
  card.style.zIndex = String(++_floatZIndex);

  layer.appendChild(card);                       // move (NOT clone) — listeners survive
  card.classList.add('floating');
  card.dataset.state = 'floating';

  const btn = card.querySelector('.card-float-btn');
  if (btn) {
    btn.textContent = '↙';                  // ↙
    btn.title = 'Dock to toolbar';
  }

  const summary = card.querySelector('summary');
  if (summary) {
    summary._cardDragHandler = (e) => onCardDragStart(e, card);
    summary.addEventListener('mousedown', summary._cardDragHandler);
  }
}

function dockCard(card) {
  const panel = document.querySelector('aside.panel');
  if (!panel) return;

  // Find the correct insertion point so the card returns to its original slot
  // even when other cards are currently floated. Look for the first sibling
  // whose data-original-index is greater than this card's; insert before it.
  // Fall back to the first .panel-section if no docked card with a higher
  // original-index exists, else appendChild.
  const myIndex = parseInt(card.dataset.originalIndex || '0', 10);
  const siblings = Array.from(panel.children);
  let target = null;
  for (const el of siblings) {
    if (el === card) continue;
    if (el.matches && el.matches('details.card')) {
      const idx = parseInt(el.dataset.originalIndex || '-1', 10);
      if (idx > myIndex) { target = el; break; }
    }
  }
  if (!target) {
    target = siblings.find(el => el.matches && el.matches('section.panel-section')) || null;
  }
  if (target) panel.insertBefore(card, target);
  else        panel.appendChild(card);

  card.classList.remove('floating');
  card.dataset.state = 'docked';
  card.style.left = '';
  card.style.top  = '';
  card.style.zIndex = '';

  const btn = card.querySelector('.card-float-btn');
  if (btn) {
    btn.textContent = '↗';                  // ↗
    btn.title = 'Float panel';
  }

  const summary = card.querySelector('summary');
  if (summary && summary._cardDragHandler) {
    summary.removeEventListener('mousedown', summary._cardDragHandler);
    delete summary._cardDragHandler;
  }
}

// Drag handler — mousedown on a floated card's <summary> starts a potential
// drag. A 3 px move threshold separates "drag" from "click-to-toggle-disclosure"
// so the native <summary> behaviour (open/close the details) is preserved when
// the user clicks without moving the mouse. Clamp keeps ≥40 px of the card
// visible on every viewport edge so a card can't be dragged off-screen.
function onCardDragStart(e, card) {
  if (card.dataset.state !== 'floating') return;
  if (e.target && e.target.classList && e.target.classList.contains('card-float-btn')) return;

  const startX    = e.clientX;
  const startY    = e.clientY;
  const startLeft = parseFloat(card.style.left) || 0;
  const startTop  = parseFloat(card.style.top)  || 0;
  let moved = false;

  // Bring-to-top on drag-start (D-7 — same monotonic counter as floatCard).
  card.style.zIndex = String(++_floatZIndex);

  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!moved && Math.hypot(dx, dy) > 3) {
      moved = true;
      card.classList.add('dragging');
      document.body.classList.add('card-dragging');
    }
    if (!moved) return;
    ev.preventDefault();   // suppress disclosure-toggle from the trailing mouseup

    // Clamp to viewport with ≥40 px visible on every edge (D-8). Card sits
    // inside #cardFloatLayer; left/top are layer-local but the clamp is
    // expressed in viewport coords, so we translate via the layer's rect.
    const layer = document.getElementById('cardFloatLayer');
    const layerRect = layer ? layer.getBoundingClientRect() : { left: 0, top: 0 };
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const minLeft = 40 - w - layerRect.left;
    const maxLeft = window.innerWidth  - 40 - layerRect.left;
    const minTop  = 40 - h - layerRect.top;
    const maxTop  = window.innerHeight - 40 - layerRect.top;
    const left = Math.max(minLeft, Math.min(maxLeft, startLeft + dx));
    const top  = Math.max(minTop,  Math.min(maxTop,  startTop  + dy));
    card.style.left = left + 'px';
    card.style.top  = top  + 'px';
  }

  function onUp(_ev) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    if (moved) {
      card.classList.remove('dragging');
      document.body.classList.remove('card-dragging');
    }
    // If !moved, the trailing native click on <summary> toggles disclosure —
    // exactly the desired "single click = toggle, drag = move" UX.
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
}

document.addEventListener('DOMContentLoaded', setupCardFloat);

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
  a.style.color = '#1a2744';
  a.style.textDecoration = 'underline';
  a.style.display = 'block';
  a.style.marginBottom = '8px';
  a.style.fontSize = '12px';
  a.addEventListener('mouseover', function() { a.style.color = '#3f51b5'; });
  a.addEventListener('mouseout',  function() { a.style.color = '#1a2744'; });
  return a;
}

// ── Save / Load model (Phase 3 interchange format) ────────────────────────
function updateSaveButtonState() {
  const btn = document.getElementById('btnSave');
  if (btn) btn.disabled = nodes.length === 0;
}

function saveModel() {
  try {
  if (nodes.length === 0) return;

  // ── Solve payload: mirror exactly the same logic as solve() to produce
  //    a file that can be POSTed to /solve/frame2d without any transformation.
  const E_GPa = parseFloat(document.getElementById('inputE').value);
  const I_cm4 = parseFloat(document.getElementById('inputI').value);
  const A_cm2 = parseFloat(document.getElementById('inputA').value);

  const anyOverride = members.some(m => m.E_override != null || m.I_override != null || m.A_override != null);
  const E = anyOverride
    ? members.map(m => (m.E_override != null ? m.E_override : E_GPa) * 1e9)
    : E_GPa * 1e9;
  const I = anyOverride
    ? members.map(m => (m.I_override != null ? m.I_override : I_cm4) * 1e-8)
    : I_cm4 * 1e-8;
  const A = anyOverride
    ? members.map(m => (m.A_override != null ? m.A_override : A_cm2) * 1e-4)
    : A_cm2 * 1e-4;

  // restrainedDoF — 1-based, 3 DOF per node (Ux, Uy, θ)
  const restrainedDoF = [];
  supports.forEach(s => {
    const base = s.nodeId * 3 + 1;
    if (s.type === 'fixed')   restrainedDoF.push(base, base+1, base+2);
    if (s.type === 'pinned')  restrainedDoF.push(base, base+1);
    if (s.type === 'rollerX') restrainedDoF.push(base);
    if (s.type === 'rollerY') restrainedDoF.push(base+1);
    // s.type === 'spring' → no classic restraint; handled by springDoF/springStiffness below
  });

  // Springs — D-09: flatten supports[type==='spring'] into SI-unit springDoF + springStiffness
  const { springDoF, springStiffness } = computeSpringPayload();

  // forceVector — flat, length = 3 * nNodes
  const forceVector = new Array(nodes.length * 3).fill(0);
  nodeLoads.forEach(l => {
    const base = l.nodeId * 3;
    if (l.direction === 'x')      forceVector[base]     = l.magnitude;
    if (l.direction === 'y')      forceVector[base + 1] = l.magnitude;
    if (l.direction === 'moment') forceVector[base + 2] = l.magnitude;
  });

  // ENForces & ENMoments from UDLs
  const ENForces  = members.map(m => {
    if (!m.udl || m.type === 'bar') return [0, 0];
    const L = memberLengthReal(m);
    return [-(m.udl * L) / 2, -(m.udl * L) / 2];
  });
  const ENMoments = members.map(m => {
    if (!m.udl || m.type === 'bar') return [0, 0];
    const w = m.udl, L = memberLengthReal(m);
    return [w * L * L / 12, -(w * L * L) / 12];
  });

  const bars         = members.map((m,i) => m.type === 'bar' ? i+1 : null).filter(Boolean);
  const beamPinLeft  = members.map((m,i) => m.pinLeft        ? i+1 : null).filter(Boolean);
  const beamPinRight = members.map((m,i) => m.pinRight       ? i+1 : null).filter(Boolean);

  // ── Canvas state per D-04 / D-08 schema ─────────────────────────────────
  // supports as OBJECT keyed by nodeId string (not array):
  //   classic (D-04) → string ('fixed'|'pinned'|'rollerX'|'rollerY')
  //   spring  (D-08) → object { type:'spring', Kx, Ky, Ktheta } in UI units (kN/m, kN·m/rad)
  const canvasSupports = supports.reduce((obj, s) => {
    if (s.type === 'spring') {
      obj[String(s.nodeId)] = { type: 'spring', Kx: s.Kx, Ky: s.Ky, Ktheta: s.Ktheta };
    } else {
      obj[String(s.nodeId)] = s.type;
    }
    return obj;
  }, {});

  // udl as array of {memberId, wy, wx} — per D-02/D-04
  const canvasUdl = members
    .filter(m => (m.udl !== null && m.udl !== undefined) || (m.udl_x !== null && m.udl_x !== undefined))
    .map(m => ({ memberId: m.id, wy: m.udl || 0, wx: m.udl_x || 0 }));

  // memberOverrides as object keyed by memberId string — per D-02/D-04
  const canvasMemberOverrides = members.reduce((obj, m) => {
    if (m.E_override != null || m.I_override != null || m.A_override != null) {
      obj[String(m.id)] = {
        E_GPa: m.E_override,
        I_cm4: m.I_override,
        A_cm2: m.A_override,
      };
    }
    return obj;
  }, {});

  const model = {
    // Metadata — D-03
    schema_version: "1.0",
    solver: "frame2d",            // file routing key (per D-03)
    // Solve payload — mirrors Frame2DRequest (D-01)
    // NOTE: inner solver field is the engine name (frame_v2) for direct POST to /solve/frame2d
    nodes:   nodes.map(n => [n.realX, n.realY]),
    members: members.map(m => [m.start + 1, m.end + 1]),
    ENForces, ENMoments, forceVector,
    E, I, A,
    bars, beamPinLeft, beamPinRight,
    restrainedDoF,
    pinDoF: [], springDoF, springStiffness,
    udl_x: members.map(m => m.udl_x !== null ? m.udl_x : 0),
    // Canvas state — D-02/D-04 shape
    canvas: {
      origin: origin ? { x: origin.x, y: origin.y } : null,
      nodes: JSON.parse(JSON.stringify(nodes)),
      members: JSON.parse(JSON.stringify(members)),
      supports: canvasSupports,
      nodeLoads: JSON.parse(JSON.stringify(nodeLoads)),
      udl: canvasUdl,
      memberOverrides: canvasMemberOverrides,
    },
  };

  // Trigger download — D-06: filename = frame2d-model-{ISO timestamp}.json
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
  a.download = 'frame2d-model-' + ts + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  } catch (err) {
    showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
    throw err;
  }
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
    if (data.solver !== 'frame2d') {
      alert("This file is for the " + data.solver + " solver and cannot be loaded here.");
      e.target.value = '';
      return;
    }
    if (nodes.length > 0 && !confirm("This will replace the current structure. Continue?")) {
      e.target.value = '';
      return;
    }

    // Restore canvas state from canvas section
    origin    = data.canvas && data.canvas.origin ? data.canvas.origin : null;
    nodes     = data.canvas && data.canvas.nodes ? data.canvas.nodes : [];
    members   = data.canvas && data.canvas.members ? data.canvas.members : [];

    // D-04 / D-08: supports is an object keyed by nodeId; value is either
    //   string  → classic support ('fixed'|'pinned'|'rollerX'|'rollerY')
    //   object  → spring { type:'spring', Kx, Ky, Ktheta }   (K in UI units kN/m, kN·m/rad)
    const sObj = (data.canvas && data.canvas.supports) || {};
    supports = Object.entries(sObj).map(([nodeId, val]) => {
      const nId = parseInt(nodeId, 10);
      if (typeof val === 'string') {
        return { nodeId: nId, type: val };
      }
      if (val && typeof val === 'object' && val.type === 'spring') {
        return {
          nodeId: nId,
          type: 'spring',
          Kx:     val.Kx     != null ? val.Kx     : null,
          Ky:     val.Ky     != null ? val.Ky     : null,
          Ktheta: val.Ktheta != null ? val.Ktheta : null,
        };
      }
      console.warn('Unknown support form for node', nId, val);
      return null;
    }).filter(Boolean);

    nodeLoads = (data.canvas && data.canvas.nodeLoads) ? data.canvas.nodeLoads : [];

    // D-02/D-04: Restore udl from canvas.udl array back into member objects
    if (data.canvas && data.canvas.udl && data.canvas.udl.length > 0) {
      const udlMap = {};
      data.canvas.udl.forEach(u => { udlMap[u.memberId] = u; });
      members.forEach(m => {
        if (udlMap[m.id] !== undefined) {
          m.udl = udlMap[m.id].wy !== undefined && udlMap[m.id].wy !== 0 ? udlMap[m.id].wy : (m.udl != null ? m.udl : null);
          m.udl_x = udlMap[m.id].wx !== undefined && udlMap[m.id].wx !== 0 ? udlMap[m.id].wx : (m.udl_x != null ? m.udl_x : null);
        }
      });
    }

    // D-02/D-04: Restore memberOverrides from canvas.memberOverrides back into member objects
    if (data.canvas && data.canvas.memberOverrides) {
      Object.entries(data.canvas.memberOverrides).forEach(([memberId, overrides]) => {
        const mid = parseInt(memberId, 10);
        const m = members.find(mem => mem.id === mid);
        if (m) {
          m.E_override = overrides.E_GPa != null ? overrides.E_GPa : null;
          m.I_override = overrides.I_cm4 != null ? overrides.I_cm4 : null;
          m.A_override = overrides.A_cm2 != null ? overrides.A_cm2 : null;
        }
      });
    }

    // Recalculate pixel positions from real coordinates + origin (Pitfall 1)
    nodes.forEach(syncPixelFromReal);

    // Reset solve results and history
    results = null;
    history = [];
    _udlActiveMemberIdx = null;
    currentMemberStart = null;

    // Clear stale UI state (results panel, diagram toggles)
    const resultsPanel = document.getElementById('resultsPanel');
    if (resultsPanel) resultsPanel.style.display = 'none';
    clearDiagramState();

    // Update Save button state — D-08: no auto-solve
    updateSaveButtonState();
    setStatus('', false);
    draw();

    // Reset file input so same file can be re-loaded (Pitfall 6)
    e.target.value = '';
  };
  reader.readAsText(file);
  } catch (err) {
    showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
    throw err;
  }
});

function renderResults(res) {
  // Remove any existing download link
  const existingLink = document.querySelector('.download-link');
  if (existingLink) existingLink.remove();

  // Add download link at top of results panel
  const panel = document.getElementById('resultsPanel');
  const downloadLink = createDownloadLink(res);
  panel.insertBefore(downloadLink, panel.firstChild);

  const UG = res.UG;
  const FG = res.FG;

  // Member actions
  const mBody = document.querySelector('#tableMemberActions tbody');
  mBody.innerHTML = '';
  members.forEach((m, idx) => {
    const axial = res.member_forces ? res.member_forces[idx] / 1000 : 0;
    const Vi = res.member_shears  ? res.member_shears[idx][0]  / 1000 : '—';
    const Vj = res.member_shears  ? res.member_shears[idx][1]  / 1000 : '—';
    const Mi = res.member_moments ? res.member_moments[idx][0] / 1000 : '—';
    const Mj = res.member_moments ? res.member_moments[idx][1] / 1000 : '—';
    const axialClass = Math.abs(axial) < 1e-3 ? 'zero-force' : axial > 0 ? 'tension' : 'compression';
    const stress_Pa  = res.meta && res.meta.member_stresses ? res.meta.member_stresses[idx] : null;
    const stress_MPa = stress_Pa !== null ? stress_Pa / 1e6 : null;
    const stressClass = stress_MPa === null ? '' :
      Math.abs(stress_MPa) < 0.01 ? 'zero-force' : stress_MPa > 0 ? 'tension' : 'compression';
    const stressStr = stress_MPa !== null ? stress_MPa.toFixed(1) : '—';
    const fmt = v => typeof v === 'number' ? v.toFixed(3) : v;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${m.start+1}–${m.end+1}</td>
      <td>${m.type === 'bar' ? 'Bar' : 'Beam'}</td>
      <td class="${axialClass}">${axial.toFixed(3)}</td>
      <td>${fmt(Vi)}</td><td>${fmt(Vj)}</td>
      <td>${fmt(Mi)}</td><td>${fmt(Mj)}</td>
      <td class="${stressClass}">${stressStr}</td>`;
    mBody.appendChild(tr);
  });

  // Reactions
  const rBody = document.querySelector('#tableReactions tbody');
  rBody.innerHTML = '';
  supports.forEach(s => {
    const base = s.nodeId * 3;
    const dofs = s.type === 'fixed'   ? [{d:0,label:'X'},{d:1,label:'Y'},{d:2,label:'θ'}]
               : s.type === 'pinned'  ? [{d:0,label:'X'},{d:1,label:'Y'}]
               : s.type === 'rollerX' ? [{d:0,label:'X'}]
               :                        [{d:1,label:'Y'}];
    dofs.forEach(({d, label}) => {
      const raw = FG[base + d];
      const val = d < 2 ? (raw/1000).toFixed(3)+' kN' : (raw/1000).toFixed(3)+' kNm';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.nodeId+1}</td><td>${label}</td><td>${val}</td>`;
      rBody.appendChild(tr);
    });
  });

  // Displacements
  const dBody = document.querySelector('#tableDisplacements tbody');
  dBody.innerHTML = '';
  nodes.forEach((n, i) => {
    const ux = (UG[i*3]   * 1000).toFixed(4);   // m → mm
    const uy = (UG[i*3+1] * 1000).toFixed(4);
    const th = (UG[i*3+2] * 1000).toFixed(4);   // rad → mrad
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${ux}</td><td>${uy}</td><td>${th}</td>`;
    dBody.appendChild(tr);
  });

  // Summary table
  const sumBody = document.querySelector('#tableSummary tbody');
  if (sumBody) {
    sumBody.innerHTML = '';
    let maxUy = 0, maxUyNode = 0;
    nodes.forEach((n, i) => {
      const uy = Math.abs(UG[i*3+1]);
      if (uy > maxUy) { maxUy = uy; maxUyNode = i+1; }
    });
    let maxM = 0, maxMember = 0;
    if (res.member_moments) {
      members.forEach((m, idx) => {
        [0,1].forEach(end => {
          if (Math.abs(res.member_moments[idx][end]) > maxM) {
            maxM = Math.abs(res.member_moments[idx][end]); maxMember = idx+1;
          }
        });
        if (m.udl && m.type !== 'bar') {
          const L_m = memberLengthReal(m);
          for (let k = 1; k < 20; k++) {
            const xi = k / 20;
            const Mxi = Math.abs(res.member_moments[idx][0]*(1-xi) + res.member_moments[idx][1]*xi
              + m.udl * L_m * L_m / 2 * xi * (1-xi));
            if (Mxi > maxM) { maxM = Mxi; maxMember = idx+1; }
          }
        }
      });
    }
    let maxV = 0, maxVMember = 0;
    if (res.member_shears) {
      members.forEach((m, idx) => {
        [Math.abs(res.member_shears[idx][0]), Math.abs(res.member_shears[idx][1])].forEach((v, ei) => {
          if (v > maxV) { maxV = v; maxVMember = idx+1; }
        });
      });
    }
    [
      ['δ_max (vert.)', `${(maxUy*1000).toFixed(4)} mm`, `Node ${maxUyNode}`],
      ['M_max', maxM > 0 ? `${(maxM/1000).toFixed(3)} kNm` : '—', maxMember ? `Mbr ${maxMember}` : '—'],
      ['V_max', maxV > 0 ? `${(maxV/1000).toFixed(3)} kN` : '—', maxVMember ? `Mbr ${maxVMember}` : '—'],
    ].forEach(([qty, val, loc]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${qty}</b></td><td>${val}</td><td>${loc}</td>`;
      sumBody.appendChild(tr);
    });
  }

  document.getElementById('resultsPanel').style.display = 'block';
}

// ── Pan (middle-mouse drag) ───────────────────────────────────────────────
canvas.addEventListener('mousedown', e => {
  if (e.button === 1) {
    e.preventDefault();
    isPanning = true;
    const rect = canvas.getBoundingClientRect();
    panStartX = (e.clientX - rect.left) * (canvas.width  / rect.width);
    panStartY = (e.clientY - rect.top)  * (canvas.height / rect.height);
    panStartTx = view.tx; panStartTy = view.ty;
  }
});
canvas.addEventListener('mouseup',    e => { if (e.button === 1) isPanning = false; });
canvas.addEventListener('mouseleave', () => { isPanning = false; });

// ── Zoom (mouse wheel) ────────────────────────────────────────────────────
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width  / rect.width);
  const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  view.tx = mx - (mx - view.tx) * factor;
  view.ty = my - (my - view.ty) * factor;
  view.scale *= factor;
  draw();
}, { passive: false });

// ── Coordinate display ────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  if (isPanning) {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const py = (e.clientY - rect.top)  * (canvas.height / rect.height);
    view.tx = panStartTx + (px - panStartX);
    view.ty = panStartTy + (py - panStartY);
    draw(); return;
  }
  const { x: px, y: py } = toWorld(e.clientX, e.clientY);
  const el = document.getElementById('coords');
  if (origin) {
    const rx = (( px - origin.x) / GRID) * UNIT;
    const ry = ((origin.y - py)  / GRID) * UNIT;
    el.textContent = `x: ${rx.toFixed(2)} m  y: ${ry.toFixed(2)} m`;
  } else {
    el.textContent = 'x: — \u00a0 y: —';
  }
});

// ── Section calculator ────────────────────────────────────────────────────
function calcSection() {
  const type = document.getElementById('sectionType').value;
  let I_mm4 = 0, A_mm2 = 0;

  if (type === 'rectangle') {
    const b = parseFloat(document.getElementById('sec_b').value);
    const h = parseFloat(document.getElementById('sec_h').value);
    if (isNaN(b) || isNaN(h) || b <= 0 || h <= 0) { alert('Enter valid positive b and h.'); return; }
    I_mm4 = b * Math.pow(h, 3) / 12;
    A_mm2 = b * h;
  } else if (type === 'circle') {
    const d = parseFloat(document.getElementById('sec_d').value);
    if (isNaN(d) || d <= 0) { alert('Enter valid positive d.'); return; }
    I_mm4 = Math.PI * Math.pow(d, 4) / 64;
    A_mm2 = Math.PI * d * d / 4;
  } else if (type === 'i_section') {
    const b  = parseFloat(document.getElementById('sec_ib').value);
    const H  = parseFloat(document.getElementById('sec_H').value);
    const tf = parseFloat(document.getElementById('sec_tf').value);
    const tw = parseFloat(document.getElementById('sec_tw').value);
    if ([b, H, tf, tw].some(v => isNaN(v) || v <= 0)) { alert('Enter valid positive dimensions.'); return; }
    const hw = H - 2 * tf;
    if (hw <= 0) { alert('Web height (H - 2*tf) must be positive.'); return; }
    I_mm4 = b * Math.pow(H, 3) / 12 - (b - tw) * Math.pow(hw, 3) / 12;
    A_mm2 = 2 * b * tf + tw * hw;
  }

  const I_cm4 = I_mm4 / 1e4;
  const A_cm2 = A_mm2 / 100;

  document.getElementById('secResultI').textContent = 'I = ' + I_cm4.toFixed(2) + ' cm\u2074';
  document.getElementById('secResultA').textContent = 'A = ' + A_cm2.toFixed(4) + ' cm\u00B2';
  document.getElementById('secResults').style.display = 'block';
}

document.getElementById('sectionType').addEventListener('change', function() {
  document.querySelectorAll('.sec-inputs').forEach(el => el.style.display = 'none');
  document.getElementById('sec-' + this.value).style.display = '';
});

// ── UDL panel event wiring ────────────────────────────────────────────────
document.getElementById('udlApplyBtn').addEventListener('click', function() {
  if (_udlActiveMemberIdx === null) return;
  const wy = parseFloat(document.getElementById('udlWy').value);
  const wx = parseFloat(document.getElementById('udlWx').value);
  saveHistory();
  if (!isNaN(wy)) members[_udlActiveMemberIdx].udl = wy === 0 ? null : wy;
  if (!isNaN(wx)) members[_udlActiveMemberIdx].udl_x = wx === 0 ? null : wx;
  results = null;
  document.getElementById('udlPanel').style.display = 'none';
  _udlActiveMemberIdx = null;
  draw();
});

document.getElementById('udlClearBtn').addEventListener('click', function() {
  document.getElementById('udlWy').value = '';
  document.getElementById('udlWx').value = '';
});

document.getElementById('udlCancelBtn').addEventListener('click', function() {
  document.getElementById('udlPanel').style.display = 'none';
  _udlActiveMemberIdx = null;
});

// ── Init ──────────────────────────────────────────────────────────────────
setMode('view');
updateSaveButtonState();
draw();
