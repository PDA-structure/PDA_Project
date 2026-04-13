const API_URL = 'http://localhost:8000';

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

const GRID = 20;
const UNIT = 1;

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
let supports   = [];   // { nodeId, type:'fixed'|'pinned'|'rollerX'|'rollerY' }
let nodeLoads  = [];   // { nodeId, direction:'x'|'y'|'moment', magnitude }
let history    = [];
let results    = null;

// ── View transform (zoom / pan) ───────────────────────────────────────────
let view = { scale: 1, tx: 0, ty: 0 };
let isPanning = false, panStartX = 0, panStartY = 0, panStartTx = 0, panStartTy = 0;

function toWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * (canvas.width  / rect.width);
  const py = (clientY - rect.top)  * (canvas.height / rect.height);
  return { x: (px - view.tx) / view.scale, y: (py - view.ty) / view.scale };
}

function resetView() { view = { scale: 1, tx: 0, ty: 0 }; draw(); }

// ── Mode management ───────────────────────────────────────────────────────
const MODE_LABELS = {
  node: 'Add Node', member: 'Add Member',
  fixed: 'Fixed Support', pinned: 'Pinned Support',
  rollerX: 'Roller (X fixed)', rollerY: 'Roller (Y fixed)',
  loadX: 'Force X', loadY: 'Force Y', loadMoment: 'Moment',
  udl: 'UDL on Member',
  toggleBar: 'Toggle Beam / Bar',
  pinLeft: 'Pin — Left End', pinRight: 'Pin — Right End',
  editNode: 'Edit Node', delete: 'Delete',
};

function setMode(m) {
  mode = m;
  currentMemberStart = null;
  document.querySelectorAll('.tool-btn[data-mode]').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === m)
  );
  document.getElementById('modeLabel').textContent = MODE_LABELS[m] || m;
}

// ── Canvas click ──────────────────────────────────────────────────────────
canvas.addEventListener('click', e => {
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

  // ---- Node loads ----
  } else if (['loadX', 'loadY', 'loadMoment'].includes(mode)) {
    const n = findNodeAt(px, py);
    if (n) {
      const dir   = mode === 'loadX' ? 'x' : mode === 'loadY' ? 'y' : 'moment';
      const label = dir === 'moment' ? 'Magnitude in N·m (+ = CCW):' : 'Magnitude in N (negative = down/left):';
      const mag   = parseFloat(prompt(label, dir === 'moment' ? '10000' : '-10000'));
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
      const m = members[mi];
      const magY = parseFloat(prompt(
        'Vertical UDL w_y (N/m, positive = downward):', m.udl !== null ? m.udl : '10000'));
      if (!isNaN(magY)) {
        saveHistory();
        members[mi].udl = magY;
        results = null;
      }
      const magX = parseFloat(prompt(
        'Horizontal UDL w_x (N/m, positive = left-to-right, 0 to clear):', m.udl_x !== null ? m.udl_x : '0'));
      if (!isNaN(magX)) {
        members[mi].udl_x = magX === 0 ? null : magX;
        results = null;
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
      const eInput = prompt('Member ' + (mi+1) + ' \u2014 E (GPa), blank = use global:', m.E_override != null ? m.E_override : '');
      if (eInput !== null) {
        if (eInput.trim() !== '') {
          const val = parseFloat(eInput);
          m.E_override = isNaN(val) ? (alert('Invalid \u2014 keeping previous.'), m.E_override) : val;
        } else { m.E_override = null; }
      }
      const iInput = prompt('Member ' + (mi+1) + ' \u2014 I (cm\u2074), blank = use global:', m.I_override != null ? m.I_override : '');
      if (iInput !== null) {
        if (iInput.trim() !== '') {
          const val = parseFloat(iInput);
          m.I_override = isNaN(val) ? (alert('Invalid \u2014 keeping previous.'), m.I_override) : val;
        } else { m.I_override = null; }
      }
      const aInput = prompt('Member ' + (mi+1) + ' \u2014 A (cm\u00B2), blank = use global:', m.A_override != null ? m.A_override : '');
      if (aInput !== null) {
        if (aInput.trim() !== '') {
          const val = parseFloat(aInput);
          m.A_override = isNaN(val) ? (alert('Invalid \u2014 keeping previous.'), m.A_override) : val;
        } else { m.A_override = null; }
      }
      results = null;
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

  draw();
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
  draw();
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoLastAction(); }
});

function resetAll() {
  if (!confirm('Reset everything?')) return;
  nodes = []; members = []; supports = []; nodeLoads = [];
  origin = null; currentMemberStart = null; results = null; history = [];
  document.getElementById('resultsPanel').style.display = 'none';
  setStatus('');
  draw();
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
  });

  // forceVector — flat, length = 3 * nNodes
  const forceVector = new Array(nodes.length * 3).fill(0);
  nodeLoads.forEach(l => {
    const base = l.nodeId * 3;
    if (l.direction === 'x')      forceVector[base]     = l.magnitude;
    if (l.direction === 'y')      forceVector[base + 1] = l.magnitude;
    if (l.direction === 'moment') forceVector[base + 2] = l.magnitude;
  });

  // ENForces & ENMoments from UDLs (fixed-end forces, positive UDL = downward)
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

  const bars        = members.map((m,i) => m.type === 'bar'   ? i+1 : null).filter(Boolean);
  const beamPinLeft  = members.map((m,i) => m.pinLeft          ? i+1 : null).filter(Boolean);
  const beamPinRight = members.map((m,i) => m.pinRight         ? i+1 : null).filter(Boolean);

  const payload = {
    solver: 'frame_v2',
    nodes:   nodes.map(n => [n.realX, n.realY]),
    members: members.map(m => [m.start + 1, m.end + 1]),
    ENForces, ENMoments, forceVector,
    E, I, A,
    bars, beamPinLeft, beamPinRight,
    restrainedDoF,
    pinDoF: [], springDoF: [], springStiffness: [],
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
      const err = await res.json();
      return setStatus('API error: ' + (err.detail || res.statusText), true);
    }
    results = await res.json();
    setStatus('Solved ✓', false);
    document.getElementById('chkBMD').disabled = false;
    document.getElementById('chkSFD').disabled = false;
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
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.tx, view.ty);
  drawGrid();
  if (document.getElementById('chkLoads').checked) drawUDLs();
  drawMembers();
  if (results) {
    if (document.getElementById('chkBMD').checked) drawBMD();
    if (document.getElementById('chkSFD').checked) drawSFD();
    if (document.getElementById('chkDeflected').checked) drawDeflected();
  } else {
    clearDiagramState();
  }
  drawNodes();
  if (document.getElementById('chkSupports').checked) drawSupports();
  if (document.getElementById('chkLoads').checked) drawNodeLoads();
  if (currentMemberStart) highlightNode(currentMemberStart, '#ff9800');
  if (document.getElementById('chkNodeLabels') && document.getElementById('chkNodeLabels').checked) {
    drawNodeLabels();
  }
}

function drawGrid() {
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < canvas.width; x += GRID) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += GRID) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
}

function drawMembers() {
  members.forEach((m, idx) => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;

    // colour from results
    let color = m.type === 'bar' ? '#555' : '#1a2744';
    let forceLabel = null;

    if (results && results.member_forces) {
      const f = results.member_forces[idx];
      color = Math.abs(f) < 1e-3 ? '#999' : (f > 0 ? '#1565c0' : '#b71c1c');
      forceLabel = (f / 1000).toFixed(2) + ' kN';
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (m.type === 'bar') ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (forceLabel) drawMemberLabel(n1, n2, forceLabel, color);

    // override indicator — blue outline when member has per-member E/I/A
    if (m.E_override != null || m.I_override != null || m.A_override != null) {
      ctx.strokeStyle = '#3f51b5';
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
  });
}

function drawMemberLabel(n1, n2, text, color) {
  const mx = (n1.x + n2.x) / 2, my = (n1.y + n2.y) / 2;
  const dx = n2.x - n1.x, dy = n2.y - n1.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy/len, ny = dx/len;
  if (ny > 0) { nx = -nx; ny = -ny; }
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(mx + nx*14, my + ny*14);
  ctx.rotate(Math.abs(angle) > Math.PI/2 ? angle + Math.PI : angle);
  ctx.fillStyle = color;
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
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
  ctx.strokeStyle = '#ff6f00';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.fill();
}

function drawNodes() {
  const r = 5 * getSymbolScale();
  nodes.forEach(n => {
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI*2);
    ctx.fillStyle = '#e53935';
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(n.id + 1, n.x + 8, n.y - 8);
  });
}

function highlightNode(n, color) {
  ctx.beginPath();
  ctx.arc(n.x, n.y, 8, 0, Math.PI*2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ── Support symbols ───────────────────────────────────────────────────────
function drawSupports() {
  supports.forEach(s => {
    const n = nodes.find(nd => nd.id === s.nodeId);
    if (!n) return;
    ctx.save();
    if      (s.type === 'fixed')   drawFixed(n.x, n.y);
    else if (s.type === 'pinned')  drawPin(n.x, n.y);
    else if (s.type === 'rollerY') drawRollerH(n.x, n.y);
    else if (s.type === 'rollerX') drawRollerV(n.x, n.y);
    ctx.restore();
  });
}

function drawFixed(x, y) {
  const sc = getSymbolScale();
  const w = 22 * sc, h = 7 * sc;
  ctx.fillStyle = '#1a2744';
  ctx.fillRect(x - w/2, y, w, h);
  drawHatch(x - w/2 - 2*sc, x + w/2 + 2*sc, y + h, 'H');
}

function drawPin(x, y) {
  const sc = getSymbolScale();
  const h = 14 * sc, hw = 12 * sc;
  ctx.strokeStyle = '#1a2744'; ctx.fillStyle = '#1a2744'; ctx.lineWidth = 1.5;
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
  ctx.strokeStyle = '#1a2744'; ctx.fillStyle = '#1a2744'; ctx.lineWidth = 1.5;
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
  ctx.strokeStyle = '#1a2744'; ctx.fillStyle = '#1a2744'; ctx.lineWidth = 1.5;
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

function drawHatch(from, to, base, dir) {
  ctx.strokeStyle = '#1a2744'; ctx.lineWidth = 1;
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
function drawNodeLoads() {
  const sc = getSymbolScale();
  const arrowLen = 24 * sc;
  const arrowTip = 19 * sc;
  const arrowHW = 5 * sc;
  nodeLoads.forEach(l => {
    const n = nodes.find(nd => nd.id === l.nodeId);
    if (!n) return;
    ctx.strokeStyle = '#2e7d32'; ctx.fillStyle = '#2e7d32'; ctx.lineWidth = 2;

    if (l.direction === 'y') {
      const sign = l.magnitude < 0 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(n.x, n.y + sign * arrowLen); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(n.x - arrowHW, n.y + sign*arrowTip); ctx.lineTo(n.x, n.y + sign*arrowLen); ctx.lineTo(n.x + arrowHW, n.y + sign*arrowTip);
      ctx.fill();
      ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#1b5e20';
      ctx.fillText((Math.abs(l.magnitude)/1000).toFixed(1)+' kN', n.x, n.y + sign*(arrowLen + 14*sc));

    } else if (l.direction === 'x') {
      const sign = l.magnitude < 0 ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(n.x + sign*arrowLen, n.y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(n.x + sign*arrowTip, n.y - arrowHW); ctx.lineTo(n.x + sign*arrowLen, n.y); ctx.lineTo(n.x + sign*arrowTip, n.y + arrowHW);
      ctx.fill();
      ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#1b5e20';
      ctx.fillText((Math.abs(l.magnitude)/1000).toFixed(1)+' kN', n.x + sign*(arrowLen + 12*sc), n.y - 6);

    } else if (l.direction === 'moment') {
      // curved arrow for moment
      const r = 14 * sc;
      const sign = l.magnitude > 0 ? 1 : -1;  // + = CCW
      ctx.strokeStyle = '#6a1b9a'; ctx.fillStyle = '#6a1b9a'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, sign > 0 ? 0.3 : Math.PI + 0.3, sign > 0 ? Math.PI * 1.7 : Math.PI * 2.7);
      ctx.stroke();
      // arrowhead at end of arc
      const endAngle = sign > 0 ? Math.PI * 1.7 : Math.PI * 2.7;
      const ax = n.x + r * Math.cos(endAngle);
      const ay = n.y + r * Math.sin(endAngle);
      const tang = endAngle + sign * Math.PI/2;
      const arrowSz = 5 * sc;
      ctx.beginPath();
      ctx.moveTo(ax + arrowSz*Math.cos(tang - 0.5), ay + arrowSz*Math.sin(tang - 0.5));
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax + arrowSz*Math.cos(tang + 0.5), ay + arrowSz*Math.sin(tang + 0.5));
      ctx.fill();
      ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#4a148c';
      ctx.fillText((Math.abs(l.magnitude)/1000).toFixed(1)+' kNm', n.x, n.y - r - 6);
    }
  });
}

// ── Node label overlay ────────────────────────────────────────────────────
function drawNodeLabels() {
  ctx.save();
  ctx.font = '600 11px Arial';
  ctx.fillStyle = '#1a2744';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  nodes.forEach(function(n, i) {
    var base = i * 3 + 1;
    var label = 'N' + i + ' [' + base + ',' + (base + 1) + ',' + (base + 2) + ']';
    ctx.fillText(label, n.x + 8, n.y - 8);
  });
  ctx.restore();
}

// ── UDL arrows ────────────────────────────────────────────────────────────
function drawUDLs() {
  members.forEach(m => {
    if (!m.udl) return;
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;

    const arrowLen = 20;
    const sign = m.udl > 0 ? 1 : -1;   // positive = downward in canvas (y increases down)
    const steps = Math.max(2, Math.floor(Math.hypot(n2.x-n1.x, n2.y-n1.y) / 22));

    ctx.strokeStyle = '#7b1fa2'; ctx.fillStyle = '#7b1fa2'; ctx.lineWidth = 1.5;

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

    // label
    const mx = (n1.x + n2.x) / 2;
    const my = (n1.y + n2.y) / 2;
    ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#4a148c';
    ctx.fillText((Math.abs(m.udl)/1000).toFixed(1)+' kN/m', mx, my - arrowLen*sign - 6);
  });

  // Horizontal UDL (w_x) — blue arrows perpendicular to member, pointing left or right
  members.forEach(m => {
    if (!m.udl_x) return;
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;

    const arrowLen = 20;
    const sign = m.udl_x > 0 ? 1 : -1;  // positive = rightward on canvas

    // unit vector along member
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    // perpendicular (90° CCW): (-uy, ux)
    const perpX = -uy, perpY = ux;

    const steps = Math.max(2, Math.floor(len / 22));
    ctx.strokeStyle = '#0288d1'; ctx.fillStyle = '#0288d1'; ctx.lineWidth = 1.5;

    // baseline line offset perpendicular to member
    ctx.beginPath();
    ctx.moveTo(n1.x + perpX * arrowLen * sign, n1.y + perpY * arrowLen * sign);
    ctx.lineTo(n2.x + perpX * arrowLen * sign, n2.y + perpY * arrowLen * sign);
    ctx.stroke();

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ax = n1.x + t * (n2.x - n1.x);
      const ay = n1.y + t * (n2.y - n1.y);
      ctx.beginPath();
      ctx.moveTo(ax + perpX * arrowLen * sign, ay + perpY * arrowLen * sign);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ax + perpX * 8 * sign, ay + perpY * 8 * sign);
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax - ux * 4, ay - uy * 4);
      ctx.fill();
    }

    const mx = (n1.x + n2.x) / 2;
    const my = (n1.y + n2.y) / 2;
    ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#01579b';
    ctx.fillText((Math.abs(m.udl_x) / 1000).toFixed(1) + ' kN/m', mx + perpX * arrowLen * sign * 1.5, my + perpY * arrowLen * sign * 1.5);
  });
}

// ── Text annotation helper ────────────────────────────────────────────────
// Draws text with a white backing rect so it's readable over diagrams.
function labelText(text, x, y, color) {
  ctx.save();
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(x - w/2 - 2, y - 7, w + 4, 14);
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
function drawDeflected() {
  const scale = parseFloat(document.getElementById('inputScale').value) || 100;
  const E = parseFloat(document.getElementById('inputE').value) * 1e9;
  const I = parseFloat(document.getElementById('inputI').value) * 1e-8;
  const UG = results.UG;
  const NSEG = 20;
  ctx.strokeStyle = 'rgba(255,152,0,0.75)';
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
    labelText('δ=' + (maxTransverse * 1000).toFixed(3) + ' mm', maxLX, maxLY - 12, '#e65100');
  }
}

// ── Bending moment diagram ────────────────────────────────────────────────
// M_bmd(ξ) = Mi*(1-ξ) - Mj*ξ + w*L²/2*ξ*(1-ξ)
// The Mj negation matches the SFD sign fix: solver stores element end forces
// (the element exerts -Mj on node j), so the internal moment at j = -Mj_element.
// Positive moment (sagging) draws on the tension face (below for horizontal beam).
function drawBMD() {
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
  const diagMult = parseFloat(document.getElementById('inputDiagramScale').value) || 1;
  const scaleFactor = (0.2 * minMbrLen) / maxMoment * diagMult;

  ctx.fillStyle = 'rgba(33, 150, 243, 0.25)';
  ctx.strokeStyle = '#1565c0';
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

    ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
    ctx.fillStyle = 'rgba(33, 150, 243, 0.25)'; ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 1.5;
  });

  // ── Annotate end moments and UDL midspan peak ─────────────────────────
  const fmtM = v => (v / 1000).toFixed(2) + ' kNm';
  members.forEach((m, idx) => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const angle = Math.atan2(dy, dx);
    const perpX = -Math.sin(angle), perpY = Math.cos(angle);
    const Mi = moments[idx][0], Mj = moments[idx][1];
    const L_m = memberLengthReal(m);
    if (Math.abs(Mi) > maxMoment * 0.01)
      labelText(fmtM(Mi), n1.x + perpX * Mi * scaleFactor, n1.y + perpY * Mi * scaleFactor, '#1565c0');
    const Mj_bmd = -Mj;  // internal moment at j-end = -element_end_force_at_j
    if (Math.abs(Mj_bmd) > maxMoment * 0.01)
      labelText(fmtM(Mj_bmd), n2.x + perpX * Mj_bmd * scaleFactor, n2.y + perpY * Mj_bmd * scaleFactor, '#1565c0');
    if (m.udl && m.type !== 'bar') {
      let peakM = 0, peakXi = 0.5;
      for (let k = 0; k <= NSEG; k++) {
        const xi = k / NSEG;
        const M = Mi*(1-xi) - Mj*xi + m.udl * L_m * L_m / 2 * xi * (1-xi);
        if (Math.abs(M) > Math.abs(peakM)) { peakM = M; peakXi = xi; }
      }
      if (peakXi > 0.1 && peakXi < 0.9 && Math.abs(peakM) > maxMoment * 0.01) {
        const bx = n1.x + peakXi * dx, by = n1.y + peakXi * dy;
        labelText(fmtM(peakM), bx + perpX * peakM * scaleFactor, by + perpY * peakM * scaleFactor, '#1565c0');
      }
    }
  });
}

// ── Shear force diagram ────────────────────────────────────────────────────
// V varies linearly for UDL: V(ξ) = Vi*(1-ξ) + Vj*ξ.
// NSEG points ensure correct zero-crossing is captured visually.
function drawSFD() {
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
  const diagMult = parseFloat(document.getElementById('inputDiagramScale').value) || 1;
  const scaleFactor = (0.2 * minMbrLen) / maxShear * diagMult;

  ctx.fillStyle = 'rgba(76, 175, 80, 0.25)';
  ctx.strokeStyle = '#2e7d32';
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

    ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
    ctx.fillStyle = 'rgba(76, 175, 80, 0.25)'; ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 1.5;
  });

  // ── Annotate end shears and zero crossings ────────────────────────────
  const fmtV = v => (v / 1000).toFixed(2) + ' kN';
  members.forEach((m, idx) => {
    const n1 = nodes.find(n => n.id === m.start);
    const n2 = nodes.find(n => n.id === m.end);
    if (!n1 || !n2) return;
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const angle = Math.atan2(dy, dx);
    const perpX = -Math.sin(angle), perpY = Math.cos(angle);
    const Vi = shears[idx][0], Vj = -shears[idx][1];
    if (Math.abs(Vi) > maxShear * 0.01)
      labelText(fmtV(Vi), n1.x + perpX * Vi * scaleFactor, n1.y + perpY * Vi * scaleFactor, '#2e7d32');
    if (Math.abs(Vj) > maxShear * 0.01)
      labelText(fmtV(Vj), n2.x + perpX * Vj * scaleFactor, n2.y + perpY * Vj * scaleFactor, '#2e7d32');
    if (Vi * Vj < 0) {
      const xi0 = Vi / (Vi - Vj);
      const zx = n1.x + xi0 * dx, zy = n1.y + xi0 * dy;
      ctx.save();
      ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(zx + perpX * 6, zy + perpY * 6);
      ctx.lineTo(zx - perpX * 6, zy - perpY * 6);
      ctx.stroke();
      ctx.restore();
      labelText('V=0', zx, zy, '#2e7d32');
    }
  });
}

document.getElementById('chkSupports').addEventListener('change', draw);
document.getElementById('chkLoads').addEventListener('change', draw);
document.getElementById('chkDeflected').addEventListener('change', draw);
document.getElementById('chkBMD').addEventListener('change', draw);
document.getElementById('chkSFD').addEventListener('change', draw);
document.getElementById('chkNodeLabels').addEventListener('change', draw);
document.getElementById('inputScale').addEventListener('input', draw);
document.getElementById('inputDiagramScale').addEventListener('input', draw);
document.getElementById('inputSymbolScale').addEventListener('input', draw);

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

// ── Init ──────────────────────────────────────────────────────────────────
setMode('node');
draw();
