/**
 * LabelManager — Centralized label collision avoidance for PDA canvas UIs.
 *
 * Collects all label specs via add(), then resolve() places them using a
 * priority-based greedy algorithm with 8-direction candidate search,
 * progressive font shrink (100% -> 80% -> 65%), and leader-line fallback.
 * Member lines act as obstacles.
 *
 * Standalone: no references to nodes, members, cssVar, getSymbolScale etc.
 * Receives everything it needs via the add() spec and constructor config.
 */
class LabelManager {
  constructor(config) {
    this._labels = [];
    this._placed = [];
    this._ctx = config.ctx;
    this._memberLines = config.members || [];
  }

  /**
   * Add a label spec to the collection.
   * @param {Object} spec
   *   text, anchorX, anchorY, preferredX, preferredY, priority,
   *   color, font, fontSize, haloColor, haloWidth, bgColor, bgPadding,
   *   rotation, textAlign, textBaseline, radius, type
   */
  add(spec) {
    this._labels.push(spec);
  }

  /**
   * Sort by priority and place each label using greedy candidate search.
   */
  resolve() {
    this._labels.sort((a, b) => (a.priority || 50) - (b.priority || 50));
    this._placed = [];

    for (const label of this._labels) {
      const placed = this._placeLabel(label);
      this._placed.push(placed);
    }
  }

  /**
   * Render all resolved labels to the canvas context.
   */
  render(ctx) {
    // Render labels in screen space for crisp text at any zoom level.
    // World→screen transform captured once, then identity set for drawing.
    const t = ctx.getTransform();

    for (const p of this._placed) {
      ctx.save();

      // Leader line drawn in world space (before transform reset)
      if (p.leaderLine) {
        ctx.beginPath();
        ctx.moveTo(p.anchorX, p.anchorY);
        ctx.lineTo(p.renderX, p.renderY);
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Switch to screen space for crisp text rendering
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const sx = p.renderX * t.a + t.e;
      const sy = p.renderY * t.d + t.f;

      if (p.rotation != null) {
        ctx.translate(sx, sy);
        ctx.rotate(p.rotation);
        this._drawLabelContent(ctx, p, 0, 0);
      } else {
        this._drawLabelContent(ctx, p, sx, sy);
      }
      ctx.restore();
    }
  }

  _placeLabel(label) {
    this._ctx.font = label.font;
    const tw = this._ctx.measureText(label.text).width;
    const th = label.fontSize * 1.3;
    const pad = label.bgPadding || 2;

    const width = tw + 2 * pad;
    const height = th + pad;

    // Labels that must stay at their preferred position (member forces, reactions on shaft)
    if (label.skipCollision || label.type === 'memberForce') {
      const px = label.preferredX != null ? label.preferredX : label.anchorX;
      const py = label.preferredY != null ? label.preferredY : label.anchorY;
      const box = this._makeBox(px, py, width, height, label);
      return this._finalize(label, box, width, height, 1.0, false);
    }

    const R = label.radius || 16;
    const candidates = this._getCandidates(label.anchorX, label.anchorY, R);

    // 1. Try preferred position at full size
    if (label.preferredX != null && label.preferredY != null) {
      const box = this._makeBox(label.preferredX, label.preferredY, width, height, label);
      if (!this._collides(box, label.type)) {
        return this._finalize(label, box, width, height, 1.0, false);
      }
    }

    // 2. Try 8 candidates at full size
    for (const c of candidates) {
      const box = this._makeBox(c.x, c.y, width, height, label);
      if (!this._collides(box, label.type)) {
        return this._finalize(label, box, width, height, 1.0, false);
      }
    }

    // 3. Shrink to 80%, retry 8 candidates
    const w80 = width * 0.8, h80 = height * 0.8;
    for (const c of candidates) {
      const box = this._makeBox(c.x, c.y, w80, h80, label);
      if (!this._collides(box, label.type)) {
        return this._finalize(label, box, w80, h80, 0.8, false);
      }
    }

    // 4. Shrink to 65%, retry 8 candidates
    const w65 = width * 0.65, h65 = height * 0.65;
    for (const c of candidates) {
      const box = this._makeBox(c.x, c.y, w65, h65, label);
      if (!this._collides(box, label.type)) {
        return this._finalize(label, box, w65, h65, 0.65, false);
      }
    }

    // 5. Extended radius (2.5x) with leader line
    const extCandidates = this._getCandidates(label.anchorX, label.anchorY, R * 2.5);
    for (const c of extCandidates) {
      const box = this._makeBox(c.x, c.y, width, height, label);
      if (!this._collides(box, label.type)) {
        return this._finalize(label, box, width, height, 1.0, true);
      }
    }

    // 6. Last resort: place at preferred or first candidate, accepting overlap
    const fallbackX = label.preferredX != null ? label.preferredX : candidates[0].x;
    const fallbackY = label.preferredY != null ? label.preferredY : candidates[0].y;
    const box = this._makeBox(fallbackX, fallbackY, width, height, label);
    return this._finalize(label, box, width, height, 1.0, false);
  }

  _getCandidates(cx, cy, R) {
    const cos45 = 0.707;
    return [
      { x: cx,            y: cy - R },           // top
      { x: cx + R*cos45,  y: cy - R*cos45 },     // top-right
      { x: cx + R,        y: cy },                // right
      { x: cx + R*cos45,  y: cy + R*cos45 },     // bottom-right
      { x: cx,            y: cy + R },            // bottom
      { x: cx - R*cos45,  y: cy + R*cos45 },     // bottom-left
      { x: cx - R,        y: cy },                // left
      { x: cx - R*cos45,  y: cy - R*cos45 },     // top-left
    ];
  }

  _makeBox(x, y, w, h, label) {
    let left, top;
    const align = label.textAlign || 'center';
    const baseline = label.textBaseline || 'middle';

    if (align === 'center') left = x - w / 2;
    else if (align === 'right') left = x - w;
    else left = x;

    if (baseline === 'middle') top = y - h / 2;
    else if (baseline === 'bottom') top = y - h;
    else top = y;

    return { left, top, right: left + w, bottom: top + h, renderX: x, renderY: y };
  }

  _collides(box, type) {
    // Check against all previously placed labels
    for (const p of this._placed) {
      if (!(box.right < p.left || box.left > p.right ||
            box.bottom < p.top || box.top > p.bottom)) {
        return true;
      }
    }
    // Skip member-line obstacle check for labels that sit ON members
    if (type === 'memberForce' || type === 'memberId') return false;
    // Check against member line segments
    const cx = (box.left + box.right) / 2;
    const cy = (box.top + box.bottom) / 2;
    const halfDiag = Math.max(box.right - box.left, box.bottom - box.top) / 2;
    for (const seg of this._memberLines) {
      if (this._pointToSegDist(cx, cy, seg.x1, seg.y1, seg.x2, seg.y2) < halfDiag) {
        return true;
      }
    }
    return false;
  }

  _pointToSegDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  _finalize(label, box, width, height, fontScale, leaderLine) {
    return {
      text: label.text,
      x: box.left, y: box.top,
      renderX: box.renderX, renderY: box.renderY,
      width, height,
      left: box.left, top: box.top, right: box.right, bottom: box.bottom,
      color: label.color,
      font: label.font,
      fontSize: label.fontSize,
      fontScale,
      haloColor: label.haloColor || null,
      haloWidth: label.haloWidth || 3,
      bgColor: label.bgColor || null,
      bgPadding: label.bgPadding || 2,
      rotation: label.rotation || null,
      textAlign: label.textAlign || 'center',
      textBaseline: label.textBaseline || 'middle',
      anchorX: label.anchorX,
      anchorY: label.anchorY,
      leaderLine: leaderLine || !!label.forceLeaderLine,
      type: label.type,
    };
  }

  _drawLabelContent(ctx, p, x, y) {
    const scaledFontSize = Math.round(p.fontSize * p.fontScale);
    const scaledFont = p.font.replace(/\d+(\.\d+)?px/, scaledFontSize + 'px');
    ctx.font = scaledFont;
    ctx.textAlign = p.textAlign;
    ctx.textBaseline = p.textBaseline;

    // Background rect
    if (p.bgColor) {
      const pad = p.bgPadding;
      const tw = ctx.measureText(p.text).width;
      const th = scaledFontSize * 1.3;
      let bx = x, by = y;
      if (p.textAlign === 'center') bx = x - tw / 2;
      else if (p.textAlign === 'right') bx = x - tw;
      if (p.textBaseline === 'middle') by = y - th / 2;
      else if (p.textBaseline === 'bottom') by = y - th;
      ctx.fillStyle = p.bgColor;
      ctx.fillRect(bx - pad, by, tw + 2 * pad, th + pad);
    }

    // Halo stroke
    if (p.haloColor) {
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.lineWidth = p.haloWidth;
      ctx.strokeStyle = p.haloColor;
      ctx.strokeText(p.text, x, y);
    }

    // Fill text
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, x, y);
  }
}
