/*
 * IBCS chart glyph renderer — shared by the swipe & escape-room mini-games.
 *
 * Usage:
 *   const charts = IBCSCharts(ctx);
 *   charts.glyph('clutter', x, y, w, h);              // procedural chart picture
 *   charts.glyph('clean', x, y, w, h, 'SI 1.1', 'do'); // per-rule bitmap if present
 *
 * The `kind` strings match the `enemyKind` ("Don't" chart) and `good` ("Do"
 * chart) fields on every rule in window.IBCS.RULES, so the same registry drives
 * every game. Unknown kinds fall back to plain mono columns.
 *
 * When a rule `code` and `side` ('do' | 'dont') are also supplied, the renderer
 * lazily loads and caches the per-rule bitmap (see docs/IBCS-Rule-Image-Mapping.md)
 * and draws it scaled into the target rectangle. Until that image exists (or has
 * finished loading) it falls back to the procedural `glyph(kind, …)` art, so call
 * sites keep working and the image bank can be filled in incrementally.
 */
(function (global) {
  'use strict';

  // Per-rule image bank, shared across every IBCSCharts() instance. Keyed by the
  // resolved path so each picture is requested from the network only once.
  const imgBank = Object.create(null);
  function ruleImage(code, side) {
    if (!code || !side || typeof Image === 'undefined') return null;
    const IBCS = global.IBCS;
    if (!IBCS || typeof IBCS.imagePath !== 'function') return null;
    const path = IBCS.imagePath(code, side);
    let rec = imgBank[path];
    if (!rec) {
      rec = { img: new Image(), ready: false, failed: false };
      rec.img.onload = function () { rec.ready = rec.img.naturalWidth > 0; };
      rec.img.onerror = function () { rec.failed = true; };
      rec.img.src = path;
      imgBank[path] = rec;
    }
    return rec.ready ? rec.img : null;
  }

  function IBCSCharts(ctx) {
    // Draw a loaded bitmap centred and aspect-fit inside (x, y, w, h).
    function drawImageFit(img, x, y, w, h) {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      if (!iw || !ih) return false;
      const s = Math.min(w / iw, h / ih);
      const dw = iw * s, dh = ih * s;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      return true;
    }
    // ----- low-level primitives (ctx-bound) -----
    function fRect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
    function dLine(x1, y1, x2, y2, c, lw) {
      ctx.strokeStyle = c; ctx.lineWidth = lw || 1;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    function fPoly(pts, c) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.fill();
    }
    function sCir(cx, cy, r, c, lw) {
      ctx.strokeStyle = c; ctx.lineWidth = lw || 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    function dText(t, size, x, y, c, center, bold) {
      ctx.fillStyle = c;
      ctx.font = (bold ? 'bold ' : '') + size + "px 'Segoe UI',system-ui,sans-serif";
      ctx.textAlign = center ? 'center' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(t, x, y);
      ctx.textAlign = 'left';
    }
    function pieSlices(cx, cy, r, cols, vals) {
      let a = -Math.PI / 2; const tot = vals.reduce((s, v) => s + v, 0);
      for (let i = 0; i < vals.length; i++) {
        const a2 = a + vals[i] / tot * Math.PI * 2;
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a, a2); ctx.closePath(); ctx.fill();
        a = a2;
      }
    }
    function vBars(x, y, w, h, vals, draw) {
      const bw = (w - 2) / vals.length - 2;
      for (let i = 0; i < vals.length; i++) {
        const bx = x + i * (bw + 2), bh = Math.max(2, h * vals[i]), by = y + h - bh;
        draw(bx, by, Math.max(2, bw), bh, i);
      }
    }
    function hatchRect(bx, by, bw, bh, col) {
      ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      for (let d = -bh; d < bw; d += 3) { ctx.beginPath(); ctx.moveTo(bx + d, by + bh); ctx.lineTo(bx + d + bh, by); ctx.stroke(); }
      ctx.restore();
    }

    // ----- the glyph dispatcher (ported from the platformer) -----
    // `code` + `side` ('do' | 'dont') are optional: when given and the matching
    // per-rule bitmap has loaded, it is drawn instead of the procedural art.
    function glyph(kind, x, y, w, h, code, side) {
      const img = ruleImage(code, side);
      if (img && drawImageFit(img, x, y, w, h)) return;
      const cx = x + w / 2, cy = y + h / 2;
      const vals = [0.5, 0.82, 0.42, 1.0, 0.66];
      switch (kind) {
        case 'pie': {
          const r = Math.min(w, h) / 2;
          pieSlices(cx, cy, r, ['#e23b3b', '#3b6fe2', '#37a76a', '#e2a93b', '#8e5bd0'], [3, 2, 2, 1.5, 1.5]);
          sCir(cx, cy, r, '#ffffff', 1); return;
        }
        case 'line': {
          dLine(x, y + h, x + w, y + h, '#9aa3b0', 1.2); dLine(x, y, x, y + h, '#9aa3b0', 1.2);
          const pts = [[x, y + h * 0.7], [x + w * 0.25, y + h * 0.4], [x + w * 0.5, y + h * 0.55], [x + w * 0.75, y + h * 0.18], [x + w, y + h * 0.32]];
          ctx.strokeStyle = '#2b6fe2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); return;
        }
        case 'bar': {
          const hv = [0.9, 0.6, 0.78, 0.45]; const bh = (h - 2) / hv.length - 2;
          for (let i = 0; i < hv.length; i++) { const by = y + i * (bh + 2); fRect(x, by, Math.max(2, w * hv[i]), Math.max(2, bh), '#4a5160'); }
          return;
        }
        case 'barSolid':
          vBars(x, y, w, h, vals, (bx, by, bw, bh) => fRect(bx, by, bw, bh, '#4a5160')); return;
        case 'barOutline':
          vBars(x, y, w, h, vals, (bx, by, bw, bh) => { fRect(bx, by, bw, bh, '#fdfdfd'); ctx.strokeStyle = '#4a5160'; ctx.lineWidth = 1.3; ctx.strokeRect(bx, by, bw, bh); }); return;
        case 'barHatched':
          vBars(x, y, w, h, vals, (bx, by, bw, bh) => { fRect(bx, by, bw, bh, '#eef1f5'); ctx.strokeStyle = '#4a5160'; ctx.lineWidth = 1.1; ctx.strokeRect(bx, by, bw, bh); hatchRect(bx, by, bw, bh, '#4a5160'); }); return;
        case 'barLight':
          vBars(x, y, w, h, vals, (bx, by, bw, bh) => fRect(bx, by, bw, bh, '#b8bec8')); return;
        case 'barDark':
          vBars(x, y, w, h, vals, (bx, by, bw, bh) => fRect(bx, by, bw, bh, '#23272e')); return;
        case 'bigNumber': {
          dText('1.2M', Math.max(8, Math.min(h * 0.9, 22)), cx, cy, '#3a3f4a', true, true); return;
        }
        case 'deviation': {
          const dv = [0.6, -0.35, 0.45, -0.7, 0.3];
          dLine(x, cy, x + w, cy, '#9aa3b0', 1);
          const bw = (w - 2) / dv.length - 2;
          for (let i = 0; i < dv.length; i++) {
            const bx = x + i * (bw + 2), bh = Math.abs(dv[i]) * (h / 2);
            const by = dv[i] >= 0 ? cy - bh : cy; fRect(bx, by, Math.max(2, bw), Math.max(1, bh), dv[i] >= 0 ? '#37a76a' : '#e23b3b');
          }
          return;
        }
        case 'meceGood': {
          const segs = [0.3, 0.25, 0.25, 0.2]; const cols = ['#4a5160', '#6b7280', '#868d9b', '#a8aeb8'];
          const bwc = w * 0.5, bx = cx - bwc / 2; let yy = y + h;
          for (let i = 0; i < segs.length; i++) { const sh = h * segs[i]; yy -= sh; fRect(bx, yy, bwc, sh, cols[i]); }
          ctx.strokeStyle = '#2b2f38'; ctx.lineWidth = 1; ctx.strokeRect(bx, y, bwc, h); return;
        }
        case 'meceBad': {
          const bwc = w * 0.5, bx = cx - bwc / 2;
          ctx.save(); ctx.globalAlpha = 0.6;
          fRect(bx, y + h * 0.08, bwc, h * 0.42, '#e23b3b');
          fRect(bx, y + h * 0.34, bwc, h * 0.42, '#3b6fe2');
          fRect(bx, y + h * 0.82, bwc, h * 0.22, '#e2a93b');
          ctx.restore(); return;
        }
        case 'clutter': {
          fRect(x, y, w, h, '#e8edf2');
          for (let gy = y; gy <= y + h; gy += Math.max(3, h / 4)) dLine(x, gy, x + w, gy, '#c0c8d0', 0.5);
          const pal = ['#e23b3b', '#3b6fe2', '#37a76a', '#e2a93b', '#8e5bd0'];
          const bw = (w - 2) / vals.length - 2;
          for (let i = 0; i < vals.length; i++) {
            const bx = x + i * (bw + 2), bh = h * vals[i], by = y + h - bh;
            fRect(bx, by, Math.max(2, bw), bh, pal[i]);
            fPoly([[bx + bw, by], [bx + bw + 2, by - 2], [bx + bw + 2, y + h - 2], [bx + bw, y + h]], 'rgba(0,0,0,0.22)');
          }
          ctx.strokeStyle = '#9aa3b0'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); return;
        }
        case 'clean': {
          dLine(x, y + h, x + w, y + h, '#c0c8d0', 1);
          vBars(x, y, w, h, vals, (bx, by, bw, bh) => fRect(bx, by, bw, bh, '#4a5160')); return;
        }
        case 'axisBreak': {
          const brk = y + h - 4; const bw = (w - 2) / vals.length - 2;
          for (let i = 0; i < vals.length; i++) { const bh = h * vals[i] * 0.7; fRect(x + i * (bw + 2), brk - bh, Math.max(2, bw), Math.max(2, bh), '#4a5160'); }
          ctx.strokeStyle = '#e23b3b'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x, brk); ctx.lineTo(x + 3, brk - 2); ctx.lineTo(x + 6, brk + 2); ctx.lineTo(x + 9, brk - 2); ctx.lineTo(x + w, brk); ctx.stroke(); return;
        }
        case 'axisFull': {
          dLine(x, y + h, x + w, y + h, '#9aa3b0', 1); dLine(x, y, x, y + h, '#9aa3b0', 1);
          vBars(x, y, w, h, vals, (bx, by, bw, bh) => fRect(bx, by, bw, bh, '#37a76a')); return;
        }
      }
      // column-based kinds: column / colorful / mono / generic
      let palette;
      if (kind === 'colorful') palette = ['#e23b3b', '#3b6fe2', '#37a76a', '#e2a93b', '#8e5bd0'];
      else if (kind === 'mono') palette = ['#2b2f38', '#5a6170', '#868d9b', '#3a3f4a', '#6b7280'];
      else palette = ['#4a5160'];
      vBars(x, y, w, h, vals, (bx, by, bw, bh, i) => fRect(bx, by, bw, bh, palette[i % palette.length]));
    }

    return { glyph, fRect, dLine, dText };
  }

  global.IBCSCharts = IBCSCharts;
})(typeof window !== 'undefined' ? window : globalThis);
