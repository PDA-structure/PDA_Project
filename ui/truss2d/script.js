const API_URL = 'http://localhost:8000';

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

const GRID   = 20;   // pixels per grid cell
const UNIT   = 1;    // 1 grid cell = 1 metre

let _lastBlobUrl = null;

// ── Symbol scale helper ───────────────────────────────────────────────────
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

// ── Mode management ───────────────────────────────────────────────────────
const MODE_LABELS = {
  node: 'Add Node', member: 'Add Member',
  pinned: 'Pinned Support', rollerX: 'Roller (X fixed)', rollerY: 'Roller (Y fixed)',
  load: 'Add Load', editNode: 'Edit Node', delete: 'Delete',
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
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  let px = (e.clientX - rect.left) * scaleX;
  let py = (e.clientY - rect.top)  * scaleY;

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
      const mag = parseFloat(prompt('Magnitude in N (negative = down/left):', '-10000'));
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

  draw();
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
  draw();
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undoLastAction();
  }
});

// ── Reset ─────────────────────────────────────────────────────────────────
function resetAll() {
  if (!confirm('Reset everything?')) return;
  nodes = []; members = []; supports = []; loads = [];
  origin = null; currentMemberStart = null; results = null;
  history = [];
  document.getElementById('resultsPanel').style.display = 'none';
  setStatus('');
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawMembers();
  drawNodes();
  drawSupports();
  drawLoads();
  if (currentMemberStart) highlightNode(currentMemberStart, '#ff9800');
  if (results && document.getElementById('chkDeflected').checked) drawDeflected();
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

    let color = '#555';
    let label = null;

    if (results && results.member_forces) {
      const f = results.member_forces[idx];
      if (Math.abs(f) < 1e-3)       { color = '#999'; }
      else if (f > 0)                { color = '#1565c0'; }  // tension  = blue
      else                           { color = '#b71c1c'; }  // compression = red
      label = (f / 1000).toFixed(2) + ' kN';
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.stroke();

    if (label) drawMemberLabel(n1, n2, label, color);
  });
}

function drawMemberLabel(n1, n2, text, color) {
  const mx = (n1.x + n2.x) / 2;
  const my = (n1.y + n2.y) / 2;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const len = Math.hypot(dx, dy) || 1;
  // perpendicular unit vector (flip so label is always above)
  let nx = -dy / len;
  let ny =  dx / len;
  if (ny > 0) { nx = -nx; ny = -ny; }
  const ox = mx + nx * 14;
  const oy = my + ny * 14;

  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(Math.abs(angle) > Math.PI / 2 ? angle + Math.PI : angle);
  ctx.fillStyle = color;
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawNodes() {
  const r = 5 * getSymbolScale();
  nodes.forEach(n => {
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e53935';
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(n.id + 1, n.x + 8, n.y - 8);
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

function drawLoads() {
  const sc = getSymbolScale();
  const arrowLen = 24 * sc;
  const arrowTip = 19 * sc;
  const arrowHW  = 5 * sc;
  loads.forEach(l => {
    const n = nodes.find(nd => nd.id === l.nodeId);
    if (!n) return;
    const mag = l.magnitude;
    ctx.strokeStyle = '#2e7d32';
    ctx.fillStyle   = '#2e7d32';
    ctx.lineWidth   = 2;

    if (l.direction === 'y') {
      const sign = mag < 0 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(n.x, n.y + sign * arrowLen); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(n.x - arrowHW, n.y + sign * arrowTip);
      ctx.lineTo(n.x, n.y + sign * arrowLen);
      ctx.lineTo(n.x + arrowHW, n.y + sign * arrowTip);
      ctx.fill();
    } else {
      const sign = mag < 0 ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(n.x + sign * arrowLen, n.y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(n.x + sign * arrowTip, n.y - arrowHW);
      ctx.lineTo(n.x + sign * arrowLen, n.y);
      ctx.lineTo(n.x + sign * arrowTip, n.y + arrowHW);
      ctx.fill();
    }

    ctx.fillStyle = '#1b5e20';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText((Math.abs(mag) / 1000).toFixed(1) + ' kN', n.x, n.y + (l.direction === 'y' ? arrowLen + 14*sc : -8));
  });
}

function drawDeflected() {
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
}

// ── Deflected shape toggle ────────────────────────────────────────────────
document.getElementById('chkDeflected').addEventListener('change', draw);

// ── Coordinate display ────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top)  * scaleY;
  if (!origin) { document.getElementById('coords').textContent = 'x: — \u00a0 y: —'; return; }
  const rx = ((px - origin.x) / GRID * UNIT).toFixed(2);
  const ry = ((origin.y - py) / GRID * UNIT).toFixed(2);
  document.getElementById('coords').textContent = `x: ${rx} m \u00a0 y: ${ry} m`;
});
document.getElementById('inputScale').addEventListener('input', draw);
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

  // Member forces
  const mBody = document.querySelector('#tableMemberForces tbody');
  mBody.innerHTML = '';
  if (res.member_forces) {
    res.member_forces.forEach((f, idx) => {
      const m = members[idx];
      const fkN = f / 1000;
      const type = Math.abs(f) < 1e-3 ? 'Zero' : (f > 0 ? 'Tension' : 'Compression');
      const cls  = Math.abs(f) < 1e-3 ? 'zero-force' : (f > 0 ? 'tension' : 'compression');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${m.start + 1} – ${m.end + 1}</td>
        <td class="${cls}">${fkN.toFixed(3)}</td>
        <td class="${cls}">${type}</td>`;
      mBody.appendChild(tr);
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

// ── Init ──────────────────────────────────────────────────────────────────
setMode('node');
draw();
