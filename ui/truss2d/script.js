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

const API_URL = ''; // relative — UI is served from the same FastAPI process

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

const GRID   = 20;   // pixels per grid cell
const UNIT   = 1;    // 1 grid cell = 1 metre

let _lastBlobUrl = null;

// ── View transform ─────────────────────────────────────────────────────────
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

// ── Symbol & label scale helpers ──────────────────────────────────────────
let labelScale = 1.0;
function getSymbolScale() {
  return parseFloat(document.getElementById('inputSymbolScale').value) || 1.0;
}

// ── State ─────────────────────────────────────────────────────────────────
let mode   = 'node';
let origin = null;           // canvas pixel of real-world (0,0)
let currentMemberStart = null;

let nodes    = [];
let members  = [];
let supports = [];
let loads    = [];

let history  = [];
let results  = null;         // last API response
let exportMode = false;

// ── Mode management ───────────────────────────────────────────────────────
const MODE_LABELS = {
  view: 'View', node: 'Add Node', member: 'Add Member',
  pinned: 'Pinned Support', rollerX: 'Roller (X fixed)', rollerY: 'Roller (Y fixed)',
  load: 'Add Load', editNode: 'Edit Node', delete: 'Delete',
};

const SUPPORT_MODES = new Set(['pinned', 'rollerX', 'rollerY']);
const LOAD_MODES    = new Set(['load']);

function setMode(m) {
  mode = m;
  currentMemberStart = null;
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
        loads.push({ nodeId: n.id, direction: dir.toLowerCase(), magnitude: mag });
        results = null;
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
    setMode('view');
  }
});

// ── Reset ─────────────────────────────────────────────────────────────────
function resetAll() {
  if (!confirm('Reset everything?')) return;
  nodes = []; members = []; supports = []; loads = [];
  origin = null; currentMemberStart = null; results = null;
  history = [];
  view = { scale: 1, tx: 0, ty: 0 };
  document.getElementById('resultsPanel').style.display = 'none';
  setStatus('');
  setMode('view');
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

// ── Solve ─────────────────────────────────────────────────────────────────
async function solve() {
  if (nodes.length < 2)   return setStatus('Need at least 2 nodes.', true);
  if (members.length < 1) return setStatus('Need at least 1 member.', true);
  if (supports.length < 1) return setStatus('Need at least one support.', true);

  const E_GPa = parseFloat(document.getElementById('inputE').value);
  const A_cm2 = parseFloat(document.getElementById('inputA').value);
  if (isNaN(E_GPa) || isNaN(A_cm2) || E_GPa <= 0 || A_cm2 <= 0)
    return setStatus('Check E and A values.', true);

  const E = E_GPa * 1e9;          // GPa → Pa
  const A = A_cm2 * 1e-4;         // cm² → m²

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
  ctx.setTransform(view.scale, 0, 0, view.scale, view.tx, view.ty);

  // Build member obstacle lines and create a fresh LabelManager for this frame
  const memberLines = members.map(m => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    return (n1 && n2) ? { x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y } : null;
  }).filter(Boolean);
  const labelManager = new LabelManager({ ctx, members: memberLines });

  if (!exportMode && document.getElementById('chkGrid')?.checked) drawGrid();
  drawMembers(labelManager);
  drawNodes(labelManager);
  if (document.getElementById('chkNodeLabels')?.checked) drawNodeLabels(labelManager);
  if (document.getElementById('chkSupports')?.checked) drawSupports();
  if (document.getElementById('chkLoads')?.checked) drawLoads(labelManager);
  if (results && document.getElementById('chkReactions')?.checked) drawReactions(labelManager);
  if (currentMemberStart) highlightNode(currentMemberStart, '#ff9800');
  if (results && document.getElementById('chkDeflected').checked) drawDeflected();

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
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 0.5;

  // Compute the visible window in the CURRENT (transformed) coordinate system,
  // so the grid covers wherever the user has panned/zoomed to — including
  // negative-coordinate regions for models imported from Revit etc.
  const x0 = (-view.tx)               / view.scale;
  const y0 = (-view.ty)               / view.scale;
  const x1 = (canvas.width  - view.tx) / view.scale;
  const y1 = (canvas.height - view.ty) / view.scale;

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

    let color = '#555';
    let label = null;
    let thickness = 2;

    if (results && results.member_forces) {
      const f = results.member_forces[idx];
      if (Math.abs(f) < 1e-3)       { color = '#999'; }
      else if (f > 0)                { color = '#1565c0'; }  // tension  = blue
      else                           { color = '#b71c1c'; }  // compression = red
      label = (f / 1000).toFixed(2) + ' kN';

      if (maxAbsForce > 1e-3) {
        const af = Math.abs(f);
        const ratio = af < 1e-3 ? 0 : (af / maxAbsForce);
        thickness = 1.5 + 4.5 * ratio;
      }
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.stroke();

    if (label && document.getElementById('chkMemberForces')?.checked) {
      drawMemberLabel(n1, n2, label, color, labelManager);
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
    font: fs + 'px Arial',
    fontSize: fs,
    bgColor: 'rgba(255, 255, 255, 0.85)',
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
    color: '#666',
    font: '600 ' + fs + 'px Arial',
    fontSize: fs,
    bgColor: 'rgba(255,255,255,0.85)',
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
    ctx.fillStyle = '#e53935';
    ctx.fill();
    if (showNodeIds) {
      labelManager.add({
        text: String(n.id + 1),
        anchorX: n.x, anchorY: n.y,
        preferredX: n.x + 6, preferredY: n.y - 6,
        priority: 10,
        color: '#222',
        font: 'bold ' + fs + 'px Arial',
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
      font = 'bold 13px Arial';
      fontSize = 13;
    } else {
      var base = i * 2 + 1;
      label = 'N' + i + ' [' + base + ',' + (base + 1) + ']';
      font = '600 11px Arial';
      fontSize = 11;
    }
    labelManager.add({
      text: label,
      anchorX: n.x, anchorY: n.y,
      preferredX: n.x + 8, preferredY: n.y - 8,
      priority: 15,
      color: '#1a2744',
      font: font,
      fontSize: fontSize,
      bgColor: 'rgba(255,255,255,0.85)',
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
  ctx.strokeStyle = '#1a1a2e';
  ctx.fillStyle   = '#1a1a2e';
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
  ctx.strokeStyle = '#1a1a2e';
  ctx.fillStyle   = '#1a1a2e';
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
  ctx.strokeStyle = '#1a1a2e';
  ctx.fillStyle   = '#1a1a2e';
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
  ctx.strokeStyle = '#1a1a2e';
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
      font: fs + 'px Arial', fontSize: fs,
      haloColor: 'rgba(255, 255, 255, 0.9)', haloWidth: 3,
      textAlign: 'center', textBaseline: isHoriz ? 'bottom' : 'middle',
      type: 'load', skipCollision: true,
    });
  }
}

function drawLoads(labelManager) {
  loads.forEach(l => {
    const n = nodes.find(nd => nd.id === l.nodeId);
    if (!n) return;
    const label = (Math.abs(l.magnitude) / 1000).toFixed(1) + ' kN';
    drawForceArrow(n, l.direction, l.magnitude, '#2e7d32', label, labelManager, false);
  });
}

function drawLegend() {
  if (!results) return;
  const sc = getSymbolScale();

  // Legend lives in screen space — reset transform so pan/zoom don't shift or scale it.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const fs      = Math.round(11 * sc);
  const lh      = Math.round(16 * sc);
  const swatchW = Math.round(22 * sc);
  const padX    = Math.round(10 * sc);
  const padY    = Math.round(8 * sc);
  const gap     = Math.round(8 * sc);

  const items = [
    { color: '#1565c0', label: 'Tension (+)' },
    { color: '#b71c1c', label: 'Compression (-)' },
    { color: '#999',    label: 'Near-zero' },
  ];
  if (document.getElementById('chkReactions')?.checked) {
    items.push({ color: '#7b1fa2', label: 'Reaction' });
  }

  ctx.font = `${fs}px Arial`;
  let maxTextW = 0;
  items.forEach(it => { maxTextW = Math.max(maxTextW, ctx.measureText(it.label).width); });
  const boxW = padX * 2 + swatchW + gap + Math.ceil(maxTextW);
  const boxH = padY * 2 + items.length * lh;

  const margin = Math.round(10 * sc);
  const x0 = canvas.width  - boxW - margin;
  const y0 = margin;

  ctx.fillStyle   = 'rgba(255, 255, 255, 0.92)';
  ctx.strokeStyle = '#ccc';
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
    ctx.fillStyle = '#222';
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
      drawForceArrow(n, dir, r, '#7b1fa2', '', labelManager, true);
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
      const txt = tag + ' = ' + (Math.abs(r) / 1000).toFixed(2) + ' kN';

      if (dir === 'y') {
        // Ry: below support, centred
        labelManager.add({
          text: txt, anchorX: n.x, anchorY: n.y,
          preferredX: n.x, preferredY: n.y + 28 * sc,
          priority: 20, color: '#7b1fa2',
          font: fs + 'px Arial', fontSize: fs,
          bgColor: 'rgba(255, 255, 255, 0.85)', bgPadding: 1,
          textAlign: 'center', textBaseline: 'top',
          type: 'reaction', skipCollision: true,
        });
      } else {
        // Rx: outside the structure horizontally
        const offsetX = isLeft ? -20 * sc : 20 * sc;
        labelManager.add({
          text: txt, anchorX: n.x, anchorY: n.y,
          preferredX: n.x + offsetX, preferredY: n.y,
          priority: 20, color: '#7b1fa2',
          font: fs + 'px Arial', fontSize: fs,
          bgColor: 'rgba(255, 255, 255, 0.85)', bgPadding: 1,
          textAlign: isLeft ? 'right' : 'left', textBaseline: 'middle',
          type: 'reaction', skipCollision: true,
        });
      }
    });
  });
}

function drawDeflected() {
  try {
  const scale = parseFloat(document.getElementById('inputScale').value) || 100;
  const UG = results.UG;

  ctx.strokeStyle = 'rgba(255,152,0,0.7)';
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
  });

  ctx.setLineDash([]);
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
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
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
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  view.tx = mx - (mx - view.tx) * factor;
  view.ty = my - (my - view.ty) * factor;
  view.scale *= factor;
  draw();
}, { passive: false });

// ── Middle-mouse pan ──────────────────────────────────────────────────────
canvas.addEventListener('mousedown', e => {
  if (e.button !== 1) return;
  e.preventDefault();
  isPanning = true;
  const rect = canvas.getBoundingClientRect();
  panStartX = (e.clientX - rect.left) * (canvas.width / rect.width);
  panStartY = (e.clientY - rect.top)  * (canvas.height / rect.height);
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
  const A = A_cm2 * 1e-4;

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
    // Canvas state — D-02/D-04 shape (no udl, no memberOverrides for truss2d)
    canvas: {
      origin: origin ? { x: origin.x, y: origin.y } : null,
      nodes: JSON.parse(JSON.stringify(nodes)),
      members: JSON.parse(JSON.stringify(members)),
      supports: canvasSupports,
      loads: JSON.parse(JSON.stringify(loads)),
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

function exportAnalysis() {
  if (!results) return;
  var E_GPa = parseFloat(document.getElementById('inputE').value);
  var A_cm2 = parseFloat(document.getElementById('inputA').value);

  var tensionMembers = [];
  var compressionMembers = [];
  if (results.member_forces) {
    var rows = [];
    results.member_forces.forEach(function (f, idx) {
      var m = members[idx];
      var n1 = nodes.find(function (n) { return n.id === m.start; });
      var n2 = nodes.find(function (n) { return n.id === m.end; });
      var L = (n1 && n2) ? Math.hypot(n2.realX - n1.realX, n2.realY - n1.realY) : 0;
      var stress = results.meta && results.meta.member_stresses ? results.meta.member_stresses[idx] : null;
      rows.push({
        member: idx + 1,
        nodes: [m.start + 1, m.end + 1],
        length_m: parseFloat(L.toFixed(4)),
        force_kN: parseFloat((f / 1000).toFixed(3)),
        force_N: f,
        stress_MPa: stress !== null ? parseFloat((stress / 1e6).toFixed(2)) : null
      });
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

  // Capture canvas image: zoom-to-fit, clean export mode, white background
  var chkIds = ['chkNodeLabels', 'chkSupports', 'chkLoads', 'chkReactions', 'chkDeflected'];
  var savedChk = {};
  chkIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) savedChk[id] = el.checked;
  });
  var savedView = { scale: view.scale, tx: view.tx, ty: view.ty };

  ['chkSupports', 'chkLoads', 'chkReactions'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.checked = true;
  });
  var nlEl = document.getElementById('chkNodeLabels');
  if (nlEl) nlEl.checked = false;
  var defEl = document.getElementById('chkDeflected');
  if (defEl) defEl.checked = false;

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
    schema_version: '1.0',
    type: 'truss2d-analysis',
    timestamp: now.toISOString(),
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
      return { member: i + 1, nodes: [m.start + 1, m.end + 1], length_m: parseFloat(L.toFixed(4)) };
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

    // Recalculate pixel positions from real coordinates + origin (Pitfall 1)
    nodes.forEach(syncPixelFromReal);

    // Reset solve + history + transient UI state
    results = null;
    history = [];
    currentMemberStart = null;

    const resultsPanel = document.getElementById('resultsPanel');
    if (resultsPanel) resultsPanel.style.display = 'none';

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
  a.style.color = '#1a2744';
  a.style.textDecoration = 'underline';
  a.style.display = 'block';
  a.style.marginBottom = '8px';
  a.style.fontSize = '12px';
  a.addEventListener('mouseover', function() { a.style.color = '#3f51b5'; });
  a.addEventListener('mouseout',  function() { a.style.color = '#1a2744'; });
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

  // Split member forces into tension / compression tables sorted by |F| descending
  var tBody = document.querySelector('#tableTension tbody');
  var cBody = document.querySelector('#tableCompression tbody');
  tBody.innerHTML = '';
  cBody.innerHTML = '';
  if (res.member_forces) {
    var rows = [];
    res.member_forces.forEach(function (f, idx) {
      var m = members[idx];
      var stress = res.meta && res.meta.member_stresses ? res.meta.member_stresses[idx] : undefined;
      rows.push({ idx: idx, f: f, m: m, stress: stress });
    });
    rows.sort(function (a, b) { return Math.abs(b.f) - Math.abs(a.f); });
    rows.forEach(function (r) {
      if (Math.abs(r.f) < 1e-3) return;
      var fkN = r.f / 1000;
      var tr = document.createElement('tr');
      var stressStr = r.stress !== undefined ? (r.stress / 1e6).toFixed(2) : '—';
      tr.innerHTML = '<td>' + (r.idx + 1) + '</td>'
        + '<td>' + (r.m.start + 1) + ' – ' + (r.m.end + 1) + '</td>'
        + '<td>' + fkN.toFixed(3) + '</td>'
        + '<td>' + stressStr + '</td>';
      if (r.f > 0) tBody.appendChild(tr);
      else         cBody.appendChild(tr);
    });
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
  nodes.forEach((n, i) => {
    const ux = (UG[i * 2]     * 1000).toFixed(4);  // m → mm
    const uy = (UG[i * 2 + 1] * 1000).toFixed(4);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}</td><td>${ux}</td><td>${uy}</td>`;
    dBody.appendChild(tr);
  });

  document.getElementById('resultsPanel').style.display = 'block';
}

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
setMode('view');
updateSaveButtonState();
draw();
