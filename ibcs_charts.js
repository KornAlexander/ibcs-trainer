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
    function fCir(cx, cy, r, c) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
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
      const GREY='#4a5160',DK='#23272e',LT='#b8bec8',RED='#e23b3b',BLU='#3b6fe2',GRN='#37a76a',AMB='#e2a93b',PUR='#8e5bd0',AX='#9aa3b0',GD='#c0c8d0';
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
        case 'column': {
          dLine(x, y + h, x + w, y + h, '#9aa3b0', 1.2);
          vBars(x, y, w, h, vals, (bx, by, bw, bh) => fRect(bx, by, bw, bh, '#4a5160')); return;
        }
        case 'gauge': {
          const r = Math.min(w, h * 1.7) / 2, gx = cx, gy = y + h * 0.92;
          ctx.lineWidth = Math.max(2.5, h * 0.2); ctx.lineCap = 'butt';
          const seg = [['#37a76a', Math.PI, Math.PI * 1.34], ['#e2a93b', Math.PI * 1.34, Math.PI * 1.67], ['#e23b3b', Math.PI * 1.67, Math.PI * 2]];
          for (const s of seg) { ctx.strokeStyle = s[0]; ctx.beginPath(); ctx.arc(gx, gy, r, s[1], s[2]); ctx.stroke(); }
          const na = Math.PI * 1.72; ctx.strokeStyle = '#23272e'; ctx.lineWidth = Math.max(1.6, h * 0.09); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(na) * r * 0.92, gy + Math.sin(na) * r * 0.92); ctx.stroke();
          ctx.fillStyle = '#23272e'; ctx.beginPath(); ctx.arc(gx, gy, Math.max(1.6, h * 0.09), 0, Math.PI * 2); ctx.fill(); return;
        }
        case 'radar': {
          const r = Math.min(w, h) / 2 * 0.94, n = 5;
          const pt = (rad, k) => [cx + Math.cos(-Math.PI / 2 + k * 2 * Math.PI / n) * rad, cy + Math.sin(-Math.PI / 2 + k * 2 * Math.PI / n) * rad];
          ctx.strokeStyle = '#c0c8d0'; ctx.lineWidth = 0.8;
          for (let ring = 1; ring <= 2; ring++) { ctx.beginPath(); for (let k = 0; k < n; k++) { const p = pt(r * ring / 2, k); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.closePath(); ctx.stroke(); }
          for (let k = 0; k < n; k++) { const p = pt(r, k); dLine(cx, cy, p[0], p[1], '#c0c8d0', 0.8); }
          const dv = [0.95, 0.5, 0.85, 0.4, 0.7];
          ctx.fillStyle = 'rgba(59,111,226,0.5)'; ctx.strokeStyle = '#2b6fe2'; ctx.lineWidth = 1.5;
          ctx.beginPath(); for (let k = 0; k < n; k++) { const p = pt(r * dv[k], k); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.closePath(); ctx.fill(); ctx.stroke(); return;
        }
        case 'funnel': {
          const cols = ['#3b6fe2', '#37a76a', '#e2a93b', '#e23b3b'], n = cols.length, gap = 1, segH = (h - gap * (n - 1)) / n;
          for (let i = 0; i < n; i++) { const wTop = w * (1 - i * 0.22), wBot = w * (1 - (i + 1) * 0.22), yt = y + i * (segH + gap);
            fPoly([[cx - wTop / 2, yt], [cx + wTop / 2, yt], [cx + wBot / 2, yt + segH], [cx - wBot / 2, yt + segH]], cols[i]); }
          return;
        }
        case 'ring': {
          const r = Math.min(w, h) / 2;
          pieSlices(cx, cy, r, ['#e23b3b', '#3b6fe2', '#37a76a', '#e2a93b', '#8e5bd0'], [3, 2, 2, 1.5, 1.5]);
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.fill();
          sCir(cx, cy, r, '#ffffff', 1); return;
        }
        case 'traffic': {
          const r = Math.min(w / 2, h / 6) * 0.92;
          fRect(cx - r - 2, y, (r + 2) * 2, h, '#2b2f38');
          const cols = ['#e23b3b', '#e2a93b', '#37a76a'];
          for (let i = 0; i < 3; i++) { const cyl = y + h * (i + 0.5) / 3; ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(cx, cyl, r, 0, Math.PI * 2); ctx.fill(); }
          return;
        }
        case 'spaghetti': {
          dLine(x, y + h, x + w, y + h, '#c0c8d0', 1);
          const pal = ['#e23b3b', '#3b6fe2', '#37a76a', '#e2a93b', '#8e5bd0'];
          for (let s = 0; s < pal.length; s++) { ctx.strokeStyle = pal[s]; ctx.lineWidth = 1.4; ctx.beginPath();
            for (let i = 0; i <= 4; i++) { const px = x + w * i / 4, py = y + h * (0.2 + 0.6 * Math.abs(Math.sin(i * 1.7 + s * 1.3))); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
          return;
        }
        case 'smallMultiples': {
          const gx = 2, gy = 2, cw = (w - gx) / 2, chh = (h - gy) / 2;
          const sets = [[0.5, 0.8, 0.6], [0.7, 0.4, 0.9], [0.6, 0.9, 0.5], [0.4, 0.7, 0.85]];
          for (let q = 0; q < 4; q++) { const ox2 = x + (q % 2) * (cw + gx), oy2 = y + Math.floor(q / 2) * (chh + gy);
            dLine(ox2, oy2 + chh, ox2 + cw, oy2 + chh, '#c0c8d0', 0.6);
            vBars(ox2, oy2, cw, chh, sets[q], (bx, by, bw, bh) => fRect(bx, by, bw, bh, '#4a5160')); }
          return;
        }

        // ======= EXTENDED PER-RULE ICONS (one bold, legible glyph per rule) =======
        // -- SIMPLIFY --
        case 'bgFancy': { const g=ctx.createLinearGradient(x,y,x+w,y+h); g.addColorStop(0,'#ffe7a8'); g.addColorStop(1,'#a9ccff'); ctx.fillStyle=g; ctx.fillRect(x,y,w,h); ctx.strokeStyle=PUR; ctx.lineWidth=1.5; ctx.strokeRect(x+0.8,y+0.8,w-1.6,h-1.6); vBars(x+1,y,w-2,h,vals,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,DK)); return; }
        case 'motion': { dLine(x,y+h,x+w,y+h,GD,1); vBars(x,y,w*0.5,h,[0.5,0.82,0.6],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); ctx.strokeStyle=AMB; ctx.lineWidth=1.6; for(let i=0;i<3;i++){const yy=y+h*(0.3+i*0.22); ctx.beginPath(); ctx.moveTo(x+w*0.52,yy); ctx.lineTo(x+w*0.85,yy); ctx.stroke(); fPoly([[x+w*0.85,yy-3],[x+w,yy],[x+w*0.85,yy+3]],AMB);} return; }
        case 'bars3d': { dLine(x,y+h,x+w,y+h,AX,1); const d=Math.max(2,w*0.07); vBars(x,y+d,w-d,h-d,vals,(bx,by,bw,bh)=>{ fPoly([[bx+bw,by],[bx+bw+d,by-d],[bx+bw+d,by+bh-d],[bx+bw,by+bh]],'#2b3038'); fPoly([[bx,by],[bx+d,by-d],[bx+bw+d,by-d],[bx+bw,by]],'#626c7b'); fRect(bx,by,bw,bh,GREY); }); return; }
        case 'fontFancy': { dText('Aa',Math.min(h,16),cx,cy-h*0.04,PUR,true,true); ctx.strokeStyle=RED; ctx.lineWidth=1.3; ctx.beginPath(); for(let i=0;i<=w-2;i+=2){const xx=x+1+i,yy=y+h*0.86+Math.sin(i*0.8)*1.8; i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);} ctx.stroke(); return; }
        case 'fontPlain': { dText('Aa',Math.min(h,16),cx,cy,'#3a3f4a',true,true); return; }
        case 'gridlines': { fRect(x,y,w,h,'#fff'); for(let i=1;i<5;i++){dLine(x,y+h*i/5,x+w,y+h*i/5,'#aeb7c2',0.8); dLine(x+w*i/5,y,x+w*i/5,y+h,'#aeb7c2',0.8);} vBars(x,y,w,h,vals,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); ctx.strokeStyle=AX; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h); return; }
        case 'dataLabels': { dLine(x,y+h,x+w,y+h,GD,1); vBars(x,y+4,w,h-4,vals,(bx,by,bw,bh)=>{fRect(bx,by,bw,bh,GREY); fRect(bx,by-3.4,bw,2.3,DK);}); return; }
        case 'tableGrid': { fRect(x,y,w,h,'#fff'); for(let c=1;c<3;c++)dLine(x+w*c/3,y,x+w*c/3,y+h,AX,1); for(let r=0;r<4;r++){const ry=y+h*(r+0.5)/4; for(let c=0;c<3;c++)fRect(x+w*c/3+2+(r%2)*3,ry-1.3,w/3*0.5,2.6,'#5b6573');} ctx.strokeStyle=AX; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h); return; }
        case 'tableClean': { fRect(x,y,w,h,'#fff'); for(let r=0;r<4;r++){const ry=y+h*(r+0.5)/4; for(let c=0;c<3;c++){const rr=x+w*(c+1)/3-2; fRect(rr-w/3*0.5,ry-1.3,w/3*0.5,2.6,'#5b6573');}} dLine(x,y+h-0.5,x+w,y+h-0.5,GD,1); return; }
        case 'textLong': { const ws=[0.95,0.88,0.97,0.72,0.9]; for(let i=0;i<5;i++)fRect(x,y+1+i*(h/5),w*ws[i],Math.max(1.5,h/5-2),'#5b6573'); return; }
        case 'textShort': { fRect(x,y+h*0.42,w*0.55,Math.max(2,h*0.2),'#3a3f4a'); return; }
        case 'textObvious': { fRect(x,y+h*0.16,w*0.95,Math.max(1.6,h*0.15),'#5b6573'); fRect(x,y+h*0.46,w*0.55,Math.max(1.6,h*0.15),'#b8bec8'); dLine(x,y+h*0.535,x+w*0.55,y+h*0.535,RED,1.5); fRect(x,y+h*0.74,w*0.85,Math.max(1.6,h*0.15),'#5b6573'); return; }
        case 'textDup': { for(let i=0;i<3;i++)fRect(x,y+h*(0.16+i*0.3),w*0.8,Math.max(2,h*0.15),'#5b6573'); return; }
        case 'textOnce': { fRect(x,y+h*0.42,w*0.8,Math.max(2,h*0.18),'#3a3f4a'); return; }
        case 'labelAll': { const r=Math.min(w,h)/2*0.74; pieSlices(cx,cy,r,[GREY,'#6b7280','#868d9b','#a8aeb8','#5b6573'],[3,2,2,1,0.6]); for(let k=0;k<5;k++){const a=-Math.PI/2+k*2*Math.PI/5; fRect(cx+Math.cos(a)*r*1.15-3,cy+Math.sin(a)*r*1.15-1.1,6,2.3,DK);} return; }
        case 'labelKey': { dLine(x,y+h,x+w,y+h,GD,1); vBars(x,y+4,w,h-4,vals,(bx,by,bw,bh,i)=>{fRect(bx,by,bw,bh,i===3?GRN:GREY); if(i===3)fRect(bx-1,by-3.4,bw+2,2.5,DK);}); return; }
        case 'roundNumber': { dText('1.2M',Math.min(h*0.8,13),cx,cy,GRN,true,true); return; }
        case 'overLabel': { dLine(x,y+h,x+w,y+h,GD,1); vBars(x,y+4,w,h-4,vals,(bx,by,bw,bh)=>{fRect(bx,by,bw,bh,GREY); fRect(bx,by-3.4,bw,2.3,RED);}); return; }

        // -- UNIFY --
        case 'mixTerms': { fRect(x,y+h*0.18,w*0.46,h*0.22,BLU); fRect(x+w*0.54,y+h*0.18,w*0.4,h*0.22,RED); fRect(x,y+h*0.58,w*0.34,h*0.22,GRN); fRect(x+w*0.42,y+h*0.58,w*0.52,h*0.22,AMB); return; }
        case 'oneTerm': { for(let r=0;r<2;r++)for(let c=0;c<2;c++)fRect(x+c*w*0.5,y+h*0.22+r*h*0.34,w*0.42,h*0.2,'#5b6573'); return; }
        case 'mixUnits': { dText('\u20ac $ %',Math.min(h*0.66,11),cx,cy,RED,true,true); return; }
        case 'oneUnit': { dText('\u20ac \u20ac \u20ac',Math.min(h*0.66,11),cx,cy,'#3a3f4a',true,true); return; }
        case 'msgVaried': { fRect(x,y+h*0.08,w*0.9,h*0.22,AMB); ctx.strokeStyle=RED; ctx.lineWidth=1.2; ctx.strokeRect(x,y+h*0.4,w*0.6,h*0.2); fRect(x,y+h*0.72,w*0.75,h*0.2,BLU); return; }
        case 'msgUniform': { for(let i=0;i<3;i++)fRect(x,y+h*(0.1+i*0.32),w*0.85,h*0.2,AMB); return; }
        case 'titleVaried': { fRect(x,y,w*0.6,h*0.16,'#3a3f4a'); fRect(x+w*0.3,y+h*0.26,w*0.45,h*0.1,'#868d9b'); dLine(x,y+h*0.5,x+w,y+h*0.5,GD,1); vBars(x,y+h*0.5,w,h*0.5,[0.6,0.85,0.5,0.7],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); return; }
        case 'titleUniform': { fRect(x,y,w*0.6,h*0.16,'#3a3f4a'); fRect(x,y+h*0.24,w*0.4,h*0.1,'#868d9b'); dLine(x,y+h*0.5,x+w,y+h*0.5,GD,1); vBars(x,y+h*0.5,w,h*0.5,[0.6,0.85,0.5,0.7],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); return; }
        case 'legendMoved': { dLine(x,y+h,x+w,y+h,GD,1); vBars(x,y+2,w*0.7,h-2,[0.6,0.85,0.5],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); fRect(x+w*0.72,y,w*0.28,h*0.3,'#fff'); ctx.strokeStyle=AX; ctx.lineWidth=1; ctx.strokeRect(x+w*0.72,y,w*0.28,h*0.3); fPoly([[x+w*0.72,y+h*0.5],[x+w*0.6,y+h*0.62],[x+w*0.72,y+h*0.74]],RED); return; }
        case 'legendFixed': { dLine(x,y+h*0.78,x+w,y+h*0.78,GD,1); vBars(x,y+2,w,h*0.74,[0.6,0.85,0.5,0.7],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); fCir(x+3,y+h*0.9,2,GREY); fRect(x+7,y+h*0.86,w*0.3,h*0.08,'#868d9b'); return; }
        case 'mixedViz': { const r=Math.min(w,h)/2*0.4; pieSlices(x+w*0.18,cy,r,[RED,BLU,GRN],[2,1,1]); vBars(x+w*0.4,y+h*0.2,w*0.28,h*0.7,[0.6,0.9,0.5],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); ctx.strokeStyle=AMB; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(x+w*0.72,y+h*0.7); ctx.lineTo(x+w*0.82,y+h*0.3); ctx.lineTo(x+w*0.95,y+h*0.55); ctx.stroke(); return; }
        case 'sameViz': { for(let q=0;q<3;q++){const ox2=x+q*w/3; vBars(ox2+1,y+h*0.2,w/3-3,h*0.7,[0.6,0.9,0.5],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY));} dLine(x,y+h*0.9,x+w,y+h*0.9,GD,0.8); return; }
        case 'mixedFills': { vBars(x,y,w,h,vals,(bx,by,bw,bh,i)=>{ if(i===0)fRect(bx,by,bw,bh,GREY); else if(i===1)fRect(bx,by,bw,bh,LT); else if(i===2){fRect(bx,by,bw,bh,'#eef1f5'); ctx.strokeStyle=GREY; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh); hatchRect(bx,by,bw,bh,GREY);} else {fRect(bx,by,bw,bh,'#fff'); ctx.strokeStyle=GREY; ctx.lineWidth=1.2; ctx.strokeRect(bx,by,bw,bh);} }); return; }
        case 'scenarioStd': { dLine(x,y+h,x+w,y+h,AX,1); const m=['solid','light','outline','hatch']; vBars(x,y,w,h,[0.7,0.55,0.85,0.6],(bx,by,bw,bh,i)=>{ if(m[i]==='solid')fRect(bx,by,bw,bh,GREY); else if(m[i]==='light')fRect(bx,by,bw,bh,LT); else if(m[i]==='outline'){fRect(bx,by,bw,bh,'#fff'); ctx.strokeStyle=GREY; ctx.lineWidth=1.2; ctx.strokeRect(bx,by,bw,bh);} else {fRect(bx,by,bw,bh,'#eef1f5'); ctx.strokeStyle=GREY; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh); hatchRect(bx,by,bw,bh,GREY);} }); return; }
        case 'timeVert': { dLine(x,y,x,y+h,AX,1); const hv=[0.5,0.75,0.6,0.9]; const bh=(h-2)/hv.length-2; for(let i=0;i<hv.length;i++)fRect(x,y+i*(bh+2),Math.max(2,w*hv[i]),Math.max(2,bh),GREY); ctx.strokeStyle=RED; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(x+w*0.9,y+2); ctx.lineTo(x+w*0.9,y+h-2); ctx.stroke(); fPoly([[x+w*0.9-2.5,y+h-2],[x+w*0.9+2.5,y+h-2],[x+w*0.9,y+h+1]],RED); return; }
        case 'structHoriz': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,[0.8,0.6,0.9,0.5],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); ctx.strokeStyle=PUR; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(x,y+h+2); ctx.lineTo(x,y+h+4); ctx.lineTo(x+w,y+h+4); ctx.lineTo(x+w,y+h+2); ctx.stroke(); return; }
        case 'varAdhoc': { dText('1.2M',Math.min(h*0.7,12),cx,cy-h*0.05,'#3a3f4a',true,true); ctx.strokeStyle=RED; ctx.lineWidth=1.3; for(let i=0;i<3;i++){const xx=x+w*(0.2+i*0.3); ctx.beginPath(); ctx.moveTo(xx,y+h*0.78); ctx.lineTo(xx+3,y+h*0.7); ctx.lineTo(xx+6,y+h*0.82); ctx.stroke();} return; }
        case 'tsStd': { dLine(x,y+h,x+w,y+h,AX,1); const pts=[[x,y+h*0.7],[x+w*0.3,y+h*0.45],[x+w*0.6,y+h*0.55],[x+w,y+h*0.25]]; ctx.strokeStyle=BLU; ctx.lineWidth=2; ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.stroke(); pts.forEach(p=>fCir(p[0],p[1],1.8,DK)); return; }
        case 'tsAdhoc': { dLine(x,y+h,x+w,y+h,AX,1); const pts=[[x,y+h*0.7],[x+w*0.3,y+h*0.45],[x+w*0.6,y+h*0.55],[x+w,y+h*0.25]]; ctx.strokeStyle=BLU; ctx.lineWidth=2; ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.stroke(); fRect(pts[1][0]-2,pts[1][1]-2,4,4,RED); fPoly([[pts[3][0],pts[3][1]-3],[pts[3][0]-3,pts[3][1]+2],[pts[3][0]+3,pts[3][1]+2]],AMB); return; }
        case 'highlightRandom': { dLine(x,y+h,x+w,y+h,GD,1); const c=[RED,GRN,AMB,BLU,PUR]; vBars(x,y,w,h,vals,(bx,by,bw,bh,i)=>fRect(bx,by,bw,bh,c[i])); return; }
        case 'highlightStd': { dLine(x,y+h,x+w,y+h,GD,1); vBars(x,y,w,h,vals,(bx,by,bw,bh,i)=>fRect(bx,by,bw,bh,i===3?RED:LT)); return; }
        case 'scaleHidden': { for(let q=0;q<2;q++){const ox2=x+q*(w/2); dLine(ox2,y+h,ox2+w/2-2,y+h,AX,0.8); const dd=q?[0.4,0.55,0.45]:[0.8,1.0,0.9]; vBars(ox2,y,w/2-2,h,dd,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY));} ctx.strokeStyle=RED; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x+w/2-1,y); ctx.lineTo(x+w/2-1,y+h); ctx.stroke(); return; }
        case 'scaleMark': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y+h*0.18,w,h*0.82,vals,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); ctx.strokeStyle=RED; ctx.lineWidth=1.4; ctx.beginPath(); const yy=y+h*0.18; for(let i=0;i<=w;i+=3){const xx=x+i; i?ctx.lineTo(xx,yy+((i/3)%2?2:-2)):ctx.moveTo(xx,yy);} ctx.stroke(); return; }
        case 'outlierNone': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,[0.4,0.5,0.45],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); fRect(x+w*0.72,y-3,w*0.18,h+3,GREY); return; }
        case 'outlierMark': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y+5,w,h-5,[0.45,0.55,0.5,0.95],(bx,by,bw,bh,i)=>{fRect(bx,by,bw,bh,GREY); if(i===3)fPoly([[bx+bw/2-3,by],[bx+bw/2+3,by],[bx+bw/2,by-4]],RED);}); return; }

        // -- CHECK --
        case 'logAxis': { fRect(x,y,w,h,'#fff'); [0.5,0.78,0.92,1].forEach(t=>dLine(x,y+h*(1-t),x+w,y+h*(1-t),'#aeb7c2',0.8)); vBars(x,y,w,h,vals,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); ctx.strokeStyle=AX; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h); return; }
        case 'linAxis': { fRect(x,y,w,h,'#fff'); for(let i=1;i<5;i++)dLine(x,y+h*i/5,x+w,y+h*i/5,'#dfe5ec',0.8); vBars(x,y,w,h,vals,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GRN)); return; }
        case 'binsUneq': { dLine(x,y+h,x+w,y+h,AX,1); const ws=[0.12,0.28,0.18,0.42]; const hs=[0.5,0.85,0.6,0.4]; let xx=x; for(let i=0;i<4;i++){const bw=w*ws[i]; fRect(xx,y+h*(1-hs[i]),Math.max(2,bw-1),h*hs[i],GREY); xx+=bw;} return; }
        case 'binsEq': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,[0.5,0.85,0.95,0.6,0.4],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GRN)); return; }
        case 'clipped': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,[0.6,1,0.5],(bx,by,bw,bh,i)=>{ if(i===1){fRect(bx,y,bw,h,GREY); ctx.fillStyle='#fff'; ctx.beginPath(); for(let k=0;k<=bw;k+=2){const xx=bx+k; k?ctx.lineTo(xx,y+((k/2)%2?2.5:0)):ctx.moveTo(xx,y);} ctx.lineTo(bx+bw,y-3); ctx.lineTo(bx,y-3); ctx.closePath(); ctx.fill();} else fRect(bx,by,bw,bh,GREY);}); return; }
        case 'extremeRaw': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,[0.08,0.06,1,0.05,0.07],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); return; }
        case 'volume3d': { fCir(x+w*0.3,y+h*0.5,Math.min(w,h)*0.28,GREY); fCir(x+w*0.74,y+h*0.5,Math.min(w,h)*0.16,'#868d9b'); return; }
        case 'linear1d': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,[0.9,0.45],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GRN)); return; }
        case 'mapColor': { fPoly([[x+w*0.2,y+h*0.15],[x+w*0.85,y+h*0.1],[x+w*0.95,y+h*0.6],[x+w*0.5,y+h*0.95],[x+w*0.1,y+h*0.7]],'#2b3038'); return; }
        case 'mapSize': { ctx.strokeStyle=AX; ctx.lineWidth=1.2; ctx.beginPath(); const p=[[x+w*0.2,y+h*0.15],[x+w*0.85,y+h*0.1],[x+w*0.95,y+h*0.6],[x+w*0.5,y+h*0.95],[x+w*0.1,y+h*0.7]]; p.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.closePath(); ctx.stroke(); fCir(x+w*0.5,y+h*0.5,Math.min(w,h)*0.2,'rgba(55,167,106,0.8)'); return; }
        case 'diffScale': { for(let q=0;q<2;q++){const ox2=x+q*(w/2+1); dLine(ox2,y+h,ox2+w/2-2,y+h,AX,0.8); for(let t=1;t<(q?3:6);t++)dLine(ox2,y+h*(1-t/(q?3:6)),ox2+w/2-2,y+h*(1-t/(q?3:6)),GD,0.5); vBars(ox2,y,w/2-2,h,[0.6,0.9],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY));} return; }
        case 'sameScale': { for(let q=0;q<2;q++){const ox2=x+q*(w/2+1); dLine(ox2,y+h,ox2+w/2-2,y+h,AX,0.8); for(let t=1;t<4;t++)dLine(ox2,y+h*(1-t/4),ox2+w/2-2,y+h*(1-t/4),GD,0.5); vBars(ox2,y,w/2-2,h,[0.6,0.9],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GRN));} return; }
        case 'wideMargin': { ctx.strokeStyle=AX; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h); dLine(x+w*0.35,y+h*0.7,x+w*0.65,y+h*0.7,GD,0.8); vBars(x+w*0.35,y+h*0.4,w*0.3,h*0.3,[0.6,0.9,0.5],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); return; }
        case 'narrowMargin': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,vals,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GRN)); return; }
        case 'nominalOnly': { dLine(x,y+h,x+w,y+h,AX,1); fRect(cx-w*0.18,y+h*0.1,w*0.36,h*0.9,GREY); return; }
        case 'realAdj': { dLine(x,y+h,x+w,y+h,AX,1); fRect(cx-w*0.18,y+h*0.1,w*0.36,h*0.9,LT); fRect(cx-w*0.18,y+h*0.45,w*0.36,h*0.55,GRN); return; }
        case 'currHidden': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,[0.7,0.85],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); return; }
        case 'currAdj': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,[0.7,0.85],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GRN)); dText('\u20ac',Math.min(h*0.5,9),x+w*0.5,y+h*0.3,BLU,true,true); return; }

        // -- CONDENSE --
        case 'fontBig': { dText('A',Math.min(h,h),cx,cy,'#3a3f4a',true,true); return; }
        case 'fontSmall': { dText('a',Math.min(h*0.45,8),x+w*0.16,y+h*0.3,'#3a3f4a',true,true); for(let i=0;i<3;i++)fRect(x,y+h*(0.55+i*0.16),w*0.9,1.6,'#868d9b'); return; }
        case 'bloated': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,[0.8,0.95],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); return; }
        case 'compact': { dLine(x,y+h,x+w,y+h,AX,1); const n=9,bw=w/n-1; for(let i=0;i<n;i++){const v=0.4+0.5*Math.abs(Math.sin(i)); fRect(x+i*(bw+1),y+h*(1-v),Math.max(1,bw),h*v,GREY);} return; }
        case 'oneHuge': { dLine(x,y+h,x+w,y+h,AX,1); fRect(x+w*0.2,y+h*0.05,w*0.6,h*0.95,GREY); return; }
        case 'pageMargin': { ctx.strokeStyle=AX; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h); fRect(x+w*0.22,y+h*0.22,w*0.56,h*0.56,'#dfe5ec'); return; }
        case 'pageFull': { fRect(x,y,w,h,'#dfe5ec'); ctx.strokeStyle=AX; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h); return; }
        case 'emptyGaps': { dLine(x,y+h,x+w,y+h,AX,1); [0.05,0.45,0.85].forEach((t,i)=>fRect(x+w*t,y+h*(1-vals[i]),w*0.1,h*vals[i],GREY)); return; }
        case 'tightChart': { dLine(x,y+h,x+w,y+h,AX,1); const n=7,bw=w/n-0.5; for(let i=0;i<n;i++){const v=vals[i%vals.length]; fRect(x+i*(bw+0.5),y+h*(1-v),bw,h*v,GREY);} return; }
        case 'dataSparse': { dLine(x,y+h,x+w,y+h,AX,1); fCir(x+w*0.25,y+h*0.5,2,GREY); fCir(x+w*0.7,y+h*0.35,2,GREY); return; }
        case 'dataRich': { dLine(x,y+h,x+w,y+h,AX,1); ctx.strokeStyle=BLU; ctx.lineWidth=1.6; ctx.beginPath(); for(let i=0;i<=12;i++){const xx=x+w*i/12,yy=y+h*(0.5+0.4*Math.sin(i*0.9)); i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);} ctx.stroke(); return; }
        case 'detailHidden': { dLine(x,y+h,x+w,y+h,AX,1); fRect(x+w*0.3,y+h*0.15,w*0.4,h*0.85,GREY); return; }
        case 'detailShown': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,[0.5,0.7,0.4,0.85,0.6,0.55],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); return; }
        case 'seriesSplit': { for(let q=0;q<2;q++){const oy2=y+q*(h/2); dLine(x,oy2+h/2-1,x+w,oy2+h/2-1,GD,0.8); vBars(x,oy2,w,h/2-1,[0.6,0.85,0.5],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,q?BLU:GREY));} return; }
        case 'overlay': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,vals,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,LT)); ctx.strokeStyle=BLU; ctx.lineWidth=2; ctx.beginPath(); vals.forEach((v,i)=>{const xx=x+(i+0.5)*(w/vals.length),yy=y+h*(1-v*0.8); i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}); ctx.stroke(); return; }
        case 'tierSplit': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,vals,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); return; }
        case 'multiTier': { vBars(x,y,w,h*0.6,vals,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); const cy2=y+h*0.82; dLine(x,cy2,x+w,cy2,GD,0.8); const dv=[0.4,-0.3,0.5,-0.2,0.35]; const bw=(w-2)/dv.length-2; dv.forEach((d,i)=>{const bx=x+i*(bw+2),bh=Math.abs(d)*h*0.18; fRect(bx,d>=0?cy2-bh:cy2,Math.max(2,bw),Math.max(1,bh),d>=0?GRN:RED);}); return; }
        case 'benchNone': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,vals,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); return; }
        case 'benchmark': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,vals,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); dLine(x,y+h*0.35,x+w,y+h*0.35,RED,1.4); return; }
        case 'numTable': { fRect(x,y,w,h,'#fff'); for(let r=0;r<4;r++)for(let c=0;c<3;c++)fRect(x+w*(c+1)/3-2-w/3*0.45,y+h*(r+0.5)/4-1.2,w/3*0.45,2.4,'#5b6573'); return; }
        case 'sparkTable': { fRect(x,y,w,h,'#fff'); for(let r=0;r<4;r++){const ry=y+h*(r+0.5)/4; fRect(x,ry-1.2,w*0.3,2.4,'#5b6573'); ctx.strokeStyle=BLU; ctx.lineWidth=1.2; ctx.beginPath(); for(let i=0;i<=4;i++){const xx=x+w*0.4+w*0.55*i/4,yy=ry+Math.sin(i+r)*2.2; i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);} ctx.stroke();} return; }
        case 'noInline': { dLine(x,y+h,x+w*0.55,y+h,GD,1); vBars(x,y+h*0.2,w*0.5,h*0.8,[0.6,0.9,0.5],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); for(let i=0;i<3;i++)fRect(x+w*0.62,y+h*(0.2+i*0.25),w*0.34,1.8,'#b8bec8'); return; }
        case 'inlineNotes': { dLine(x,y+h,x+w,y+h,GD,1); vBars(x,y+h*0.2,w*0.62,h*0.8,[0.6,0.9,0.5],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); fCir(x+w*0.72,y+h*0.3,2.4,AMB); fRect(x+w*0.8,y+h*0.28,w*0.18,1.8,'#5b6573'); fRect(x+w*0.8,y+h*0.5,w*0.16,1.8,'#5b6573'); return; }
        case 'scattered': { const ch=[[0.1,0.1],[0.55,0.35],[0.2,0.6],[0.65,0.7]]; ch.forEach((p,i)=>{ctx.save(); ctx.translate(x+w*p[0]+w*0.12,y+h*p[1]+h*0.1); ctx.rotate((i-1.5)*0.3); vBars(-w*0.12,-h*0.1,w*0.24,h*0.2,[0.6,0.9,0.5],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); ctx.restore();}); return; }
        case 'grouped': { for(let q=0;q<4;q++){const ox2=x+(q%2)*(w/2),oy2=y+Math.floor(q/2)*(h/2); dLine(ox2,oy2+h/2-2,ox2+w/2-2,oy2+h/2-2,GD,0.6); vBars(ox2,oy2,w/2-2,h/2-2,[0.6,0.9,0.5],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY));} return; }

        // -- EXPRESS --
        case 'tableWrong': { fRect(x,y,w,h,'#fff'); for(let c=1;c<3;c++)dLine(x+w*c/3,y,x+w*c/3,y+h,AX,1); for(let r=1;r<4;r++)dLine(x,y+h*r/4,x+w,y+h*r/4,AX,1); ctx.strokeStyle=RED; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(x+2,y+2); ctx.lineTo(x+w-2,y+h-2); ctx.moveTo(x+w-2,y+2); ctx.lineTo(x+2,y+h-2); ctx.stroke(); return; }
        case 'tableRight': { fRect(x,y,w,h,'#fff'); fRect(x,y,w,h*0.22,'#dfe5ec'); for(let r=1;r<4;r++)for(let c=0;c<3;c++)fRect(x+w*(c+1)/3-2-w/3*0.45,y+h*(r+0.45)/4-1.1,w/3*0.45,2.2,'#5b6573'); return; }
        case 'iconQty': { for(let i=0;i<5;i++){const px=x+w*(i+0.5)/5; fCir(px,y+h*0.3,Math.min(w/10,h*0.14),GREY); fRect(px-w*0.04,y+h*0.42,w*0.08,h*0.4,GREY);} return; }
        case 'numberQty': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y,w,h,[0.5,0.75,0.6,0.9],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GRN)); return; }
        case 'textSlide': { for(let i=0;i<4;i++){fCir(x+2,y+h*(0.18+i*0.22),1.6,'#5b6573'); fRect(x+6,y+h*(0.18+i*0.22)-1.3,w*0.8,2.6,'#5b6573');} return; }
        case 'dataSlide': { dLine(x,y+h,x+w,y+h,AX,1); vBars(x,y+h*0.15,w,h*0.85,vals,(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GRN)); return; }
        case 'singleScenario': { dLine(x,y+h,x+w,y+h,AX,1); fRect(cx-w*0.16,y+h*0.2,w*0.32,h*0.8,GREY); return; }
        case 'treeStruct': { fRect(cx-w*0.14,y+1,w*0.28,h*0.22,GREY); const ny=y+h*0.65; [0.18,0.5,0.82].forEach(t=>{fRect(x+w*t-w*0.1,ny,w*0.2,h*0.32,'#868d9b'); dLine(cx,y+h*0.23,x+w*t,ny,AX,1);}); return; }
        case 'clusterNone': { dLine(x,y+h,x+w,y+h,AX,1); dLine(x,y,x,y+h,AX,1); [[0.2,0.3],[0.5,0.6],[0.7,0.25],[0.35,0.75],[0.85,0.55],[0.6,0.4]].forEach(p=>fCir(x+w*p[0],y+h*p[1],1.8,GREY)); return; }
        case 'cluster': { dLine(x,y+h,x+w,y+h,AX,1); dLine(x,y,x,y+h,AX,1); [[0.3,0.35,GRN],[0.7,0.65,BLU]].forEach(g=>{ for(let i=0;i<3;i++){const a=i*2.1; fCir(x+w*g[0]+Math.cos(a)*w*0.08,y+h*g[1]+Math.sin(a)*h*0.1,1.8,g[2]);} sCir(x+w*g[0],y+h*g[1],Math.min(w,h)*0.16,g[2],1);}); return; }
        case 'corrNone': { for(let q=0;q<2;q++){const oy2=y+q*(h/2); const d=q?[0.5,0.9,0.4,0.7]:[0.7,0.4,0.9,0.5]; const bw=(w-2)/4-2; d.forEach((v,i)=>fRect(x+i*(bw+2),oy2+(h/2-2)*(1-v),Math.max(2,bw),(h/2-2)*v,q?BLU:GREY));} return; }
        case 'correlation': { for(let q=0;q<2;q++){const oy2=y+q*(h/2); const d=[0.9,0.7,0.5,0.35]; const bw=(w-2)/4-2; d.forEach((v,i)=>fRect(x+i*(bw+2),oy2+(h/2-2)*(1-v),Math.max(2,bw),(h/2-2)*v,q?BLU:GREY));} return; }

        // -- STRUCTURE --
        case 'reordered': { const ord=[3,1,2]; for(let i=0;i<3;i++){fRect(x,y+h*(0.08+i*0.32),w*0.9,h*0.24,'#868d9b'); dText(String(ord[i]),Math.min(h*0.2,9),x+w*0.12,y+h*(0.08+i*0.32)+h*0.12,'#fff',true,true);} return; }
        case 'ordered': { for(let i=0;i<3;i++){fRect(x,y+h*(0.08+i*0.32),w*0.9,h*0.24,GREY); dText(String(i+1),Math.min(h*0.2,9),x+w*0.12,y+h*(0.08+i*0.32)+h*0.12,'#fff',true,true);} return; }
        case 'parallelBad': { const sh=['c','s','d']; for(let i=0;i<3;i++){const yy=y+h*(0.2+i*0.3); if(sh[i]==='c')fCir(x+3,yy,2,'#5b6573'); else if(sh[i]==='s')fRect(x+1,yy-2,4,4,'#5b6573'); else fRect(x+1,yy-1,5,2,'#5b6573'); fRect(x+9,yy-1.3,w*0.7,2.6,'#5b6573');} return; }
        case 'parallelGood': { for(let i=0;i<3;i++){const yy=y+h*(0.2+i*0.3); fCir(x+3,yy,2,'#5b6573'); fRect(x+9,yy-1.3,w*0.7,2.6,'#5b6573');} return; }
        case 'doubleCount': { dLine(x,y+h,x+w,y+h,AX,1); fRect(x+w*0.1,y+h*0.2,w*0.45,h*0.8,'rgba(74,81,96,0.7)'); fRect(x+w*0.4,y+h*0.3,w*0.45,h*0.7,'rgba(226,59,59,0.6)'); return; }
        case 'waterfall': { dLine(x,y+h,x+w,y+h,AX,1); const steps=[[0.7,0],[0.5,0.2],[0.85,0.15],[0.4,0]]; const bw=(w-2)/4-2; steps.forEach((s,i)=>fRect(x+i*(bw+2),y+h*(1-s[0]-s[1]),Math.max(2,bw),h*s[0],i%2?GRN:GREY)); return; }
        case 'overlapDim': { fCir(x+w*0.38,cy,Math.min(w,h)*0.3,'rgba(59,111,226,0.55)'); fCir(x+w*0.62,cy,Math.min(w,h)*0.3,'rgba(226,59,59,0.5)'); return; }
        case 'disjointDim': { fCir(x+w*0.3,cy,Math.min(w,h)*0.24,'rgba(59,111,226,0.7)'); fCir(x+w*0.7,cy,Math.min(w,h)*0.24,'rgba(55,167,106,0.75)'); return; }
        case 'gapArg': { for(let i=0;i<4;i++){if(i===2)continue; fRect(x+w*i/4,y+h*0.3,w/4-2,h*0.4,GREY);} ctx.strokeStyle=RED; ctx.lineWidth=1.2; ctx.strokeRect(x+w*2/4,y+h*0.3,w/4-2,h*0.4); return; }
        case 'fullArg': { for(let i=0;i<4;i++)fRect(x+w*i/4,y+h*0.3,w/4-2,h*0.4,GRN); return; }
        case 'gapStruct': { const bx=cx-w*0.16; fRect(bx,y+h*0.55,w*0.32,h*0.2,'#868d9b'); fRect(bx,y+h*0.78,w*0.32,h*0.22,GREY); ctx.strokeStyle=RED; ctx.lineWidth=1; ctx.setLineDash([2,2]); ctx.strokeRect(bx,y+h*0.1,w*0.32,h*0.4); ctx.setLineDash([]); return; }
        case 'fullStruct': { const bx=cx-w*0.16,cols=[GRN,'#5fb98a','#9ad3b6']; let yy=y+h; [0.34,0.3,0.36].forEach((s,i)=>{const sh=h*s; yy-=sh; fRect(bx,yy,w*0.32,sh,cols[i]);}); ctx.strokeStyle=DK; ctx.lineWidth=1; ctx.strokeRect(bx,y,w*0.32,h); return; }
        case 'buried': { fPoly([[cx,y+h],[x+w*0.15,y],[x+w*0.85,y]],LT); fRect(x+w*0.32,y+h*0.78,w*0.36,h*0.2,RED); return; }
        case 'deduction': { for(let i=0;i<3;i++){fRect(x+w*0.1,y+h*(0.06+i*0.34),w*0.8,h*0.2,i===0?GRN:'#868d9b'); if(i<2)fPoly([[cx-3,y+h*(0.26+i*0.34)],[cx+3,y+h*(0.26+i*0.34)],[cx,y+h*(0.34+i*0.34)]],AX);} return; }
        case 'scatterStmt': { [[0.2,0.3],[0.6,0.2],[0.8,0.6],[0.35,0.7],[0.55,0.5]].forEach(p=>fRect(x+w*p[0]-2,y+h*p[1]-2,4,4,'#868d9b')); return; }
        case 'pyramidUp': { fPoly([[cx,y],[x+w*0.12,y+h],[x+w*0.88,y+h]],'#868d9b'); fPoly([[cx,y],[x+w*0.34,y+h*0.42],[x+w*0.66,y+h*0.42]],GRN); return; }
        case 'flatList': { for(let i=0;i<4;i++)fRect(x,y+h*(0.1+i*0.24),w*0.85,h*0.14,'#868d9b'); return; }
        case 'indentList': { const ind=[0,0.18,0.18,0.36]; for(let i=0;i<4;i++)fRect(x+w*ind[i],y+h*(0.1+i*0.24),w*0.85-w*ind[i],h*0.14,i===0?DK:'#868d9b'); return; }
        case 'flatTable': { fRect(x,y,w,h,'#fff'); for(let r=0;r<4;r++)fRect(x,y+h*(r+0.5)/4-1.2,w*0.85,2.4,'#5b6573'); return; }
        case 'boldSums': { fRect(x,y,w,h,'#fff'); for(let r=0;r<3;r++)fRect(x+w*0.1,y+h*(r+0.5)/4-1,w*0.75,2,'#868d9b'); fRect(x,y+h*3.5/4-1.6,w*0.9,3.2,DK); return; }
        case 'looseNotes': { [[0.2,0.25],[0.7,0.2],[0.4,0.6],[0.8,0.7]].forEach(p=>fCir(x+w*p[0],y+h*p[1],2.4,AMB)); return; }
        case 'numberedNotes': { for(let i=0;i<3;i++){const yy=y+h*(0.18+i*0.3); dText(String(i+1)+'.',Math.min(h*0.2,8),x+w*0.06,yy,'#3a3f4a',true,true); fRect(x+w*0.2,yy-1.3,w*0.72,2.6,'#5b6573');} return; }

        // -- SAY --
        case 'noGoal': { for(let i=0;i<4;i++){const a=i*1.7; ctx.strokeStyle='#868d9b'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(cx,cy); const ex=cx+Math.cos(a)*w*0.4,ey=cy+Math.sin(a)*h*0.4; ctx.lineTo(ex,ey); ctx.stroke(); fPoly([[ex,ey],[ex-Math.cos(a-0.4)*4,ey-Math.sin(a-0.4)*4],[ex-Math.cos(a+0.4)*4,ey-Math.sin(a+0.4)*4]],'#868d9b');} return; }
        case 'target': { sCir(cx,cy,Math.min(w,h)*0.42,RED,1.6); sCir(cx,cy,Math.min(w,h)*0.26,RED,1.4); fCir(cx,cy,Math.min(w,h)*0.1,RED); return; }
        case 'noAudience': { sCir(cx,cy-h*0.1,Math.min(w,h)*0.18,'#868d9b',1.4); fPoly([[cx-w*0.22,y+h],[cx+w*0.22,y+h],[cx+w*0.16,y+h*0.55],[cx-w*0.16,y+h*0.55]],'rgba(134,141,155,0.5)'); ctx.strokeStyle=RED; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(x+2,y+2); ctx.lineTo(x+w-2,y+h-2); ctx.stroke(); return; }
        case 'audience': { for(let i=0;i<3;i++){const px=x+w*(i+0.5)/3; fCir(px,y+h*0.32,Math.min(w/8,h*0.16),GREY); fPoly([[px-w*0.1,y+h],[px+w*0.1,y+h],[px+w*0.07,y+h*0.5],[px-w*0.07,y+h*0.5]],GREY);} return; }
        case 'noSetup': { ctx.strokeStyle='#868d9b'; ctx.lineWidth=1.4; ctx.setLineDash([3,3]); ctx.strokeRect(x+w*0.12,y+h*0.18,w*0.76,h*0.64); ctx.setLineDash([]); return; }
        case 'situation': { dLine(x,cy,x+w,cy,GREY,2); fCir(x+w*0.2,cy,2.4,GREY); fRect(x+w*0.4,cy-h*0.2,w*0.5,2,'#868d9b'); return; }
        case 'hideProblem': { ctx.strokeStyle=GRN; ctx.lineWidth=2; ctx.beginPath(); for(let i=0;i<=w;i+=2){const xx=x+i,yy=cy-Math.sin(i*0.12)*2; i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);} ctx.stroke(); return; }
        case 'problemGap': { ctx.strokeStyle=GREY; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,y+h*0.3); ctx.lineTo(x+w*0.45,y+h*0.35); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x+w*0.55,y+h*0.75); ctx.lineTo(x+w,y+h*0.8); ctx.stroke(); ctx.strokeStyle=RED; ctx.lineWidth=1.4; ctx.setLineDash([2,2]); ctx.beginPath(); ctx.moveTo(x+w*0.5,y+h*0.35); ctx.lineTo(x+w*0.5,y+h*0.75); ctx.stroke(); ctx.setLineDash([]); return; }
        case 'noQuestion': { dLine(x,cy,x+w,cy,'#868d9b',1.4); return; }
        case 'questionMark': { dText('?',Math.min(h,h),cx,cy,BLU,true,true); return; }
        case 'observeOnly': { sCir(cx,cy,Math.min(w,h)*0.28,'#868d9b',1.6); fCir(cx,cy,Math.min(w,h)*0.1,'#868d9b'); dLine(cx+Math.min(w,h)*0.22,cy+Math.min(w,h)*0.22,x+w-1,y+h-1,'#868d9b',1.6); return; }
        case 'recommend': { fCir(cx,cy-h*0.1,Math.min(w,h)*0.22,AMB); fRect(cx-w*0.08,cy+h*0.12,w*0.16,h*0.18,'#868d9b'); return; }
        case 'claimOnly': { fPoly([[x+w*0.1,y+h*0.12],[x+w*0.9,y+h*0.12],[x+w*0.9,y+h*0.62],[x+w*0.38,y+h*0.62],[x+w*0.24,y+h*0.85],[x+w*0.24,y+h*0.62],[x+w*0.1,y+h*0.62]],'#e6ebf0'); fRect(x+w*0.22,y+h*0.3,w*0.5,2.4,'#b8bec8'); return; }
        case 'evidence': { fPoly([[x+w*0.1,y+h*0.1],[x+w*0.9,y+h*0.1],[x+w*0.9,y+h*0.55],[x+w*0.38,y+h*0.55],[x+w*0.24,y+h*0.78],[x+w*0.24,y+h*0.55],[x+w*0.1,y+h*0.55]],'#e6ebf0'); vBars(x+w*0.2,y+h*0.18,w*0.55,h*0.3,[0.6,0.9,0.5],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GRN)); return; }
        case 'vague': { ctx.strokeStyle='#868d9b'; ctx.lineWidth=2; for(let r=0;r<3;r++){ctx.beginPath(); for(let i=0;i<=w;i+=2){const xx=x+i,yy=y+h*(0.3+r*0.22)+Math.sin(i*0.6)*1.6; i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);} ctx.stroke();} return; }
        case 'precise': { dText('3.5',Math.min(h*0.8,14),cx,cy,GRN,true,true); return; }
        case 'noEmphasis': { dLine(x,y+h,x+w,y+h,GD,1); vBars(x,y,w,h,[0.7,0.7,0.7,0.7,0.7],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,LT)); return; }
        case 'noSource': { dLine(x,y+h*0.8,x+w,y+h*0.8,GD,1); vBars(x,y,w,h*0.78,[0.6,0.9,0.5,0.7],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); ctx.strokeStyle=RED; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x,y+h*0.88); ctx.lineTo(x+w*0.4,y+h*0.96); ctx.stroke(); return; }
        case 'source': { dLine(x,y+h*0.78,x+w,y+h*0.78,GD,1); vBars(x,y,w,h*0.76,[0.6,0.9,0.5,0.7],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); fRect(x,y+h*0.9,w*0.6,2,'#868d9b'); return; }
        case 'linkedNotes': { dLine(x,y+h,x+w,y+h,GD,1); vBars(x,y+h*0.15,w*0.7,h*0.85,[0.6,0.9,0.5],(bx,by,bw,bh)=>fRect(bx,by,bw,bh,GREY)); [1,2].forEach((n,i)=>{const px=x+w*(0.2+i*0.35),py=y+h*0.3; fCir(px,py,3,BLU); dText(String(n),6,px,py,'#fff',true,true); dLine(px,py+3,px,y+h,BLU,0.8);}); return; }
        case 'noRecap': { ctx.strokeStyle=GREY; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,y+h*0.7); ctx.lineTo(x+w*0.7,y+h*0.3); ctx.stroke(); fCir(x+w*0.7,y+h*0.3,1.6,GREY); return; }
        case 'recap': { fRect(x+w*0.1,y+h*0.15,w*0.8,h*0.25,AMB); fRect(x+w*0.1,y+h*0.6,w*0.8,h*0.25,AMB); ctx.strokeStyle=AX; ctx.lineWidth=1; ctx.setLineDash([2,2]); dLine(x+w*0.5,y+h*0.4,x+w*0.5,y+h*0.6,AX,1); ctx.setLineDash([]); return; }
        case 'noNext': { fRect(x+w*0.3,y+h*0.3,w*0.4,h*0.4,'#868d9b'); ctx.strokeStyle=RED; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(x+w*0.3,y+h*0.3); ctx.lineTo(x+w*0.7,y+h*0.7); ctx.stroke(); return; }
        case 'nextSteps': { ctx.strokeStyle=GRN; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,cy); ctx.lineTo(x+w*0.45,cy); ctx.stroke(); fPoly([[x+w*0.45,cy-4],[x+w*0.6,cy],[x+w*0.45,cy+4]],GRN); for(let i=0;i<2;i++){const ry=y+h*(0.3+i*0.4); ctx.strokeStyle=GREY; ctx.lineWidth=1.2; ctx.strokeRect(x+w*0.65,ry-2.5,5,5); dLine(x+w*0.65,ry,x+w*0.65+2.5,ry+2.5,GRN,1.2); dLine(x+w*0.65+2.5,ry+2.5,x+w*0.65+5,ry-2.5,GRN,1.2); fRect(x+w*0.78,ry-1.3,w*0.18,2.6,GREY);} return; }
      }
      // column-based kinds: column / colorful / mono / generic
      let palette;
      if (kind === 'colorful') palette = ['#e23b3b', '#3b6fe2', '#37a76a', '#e2a93b', '#8e5bd0'];
      else if (kind === 'mono') palette = ['#2b2f38', '#5a6170', '#868d9b', '#3a3f4a', '#6b7280'];
      else palette = ['#4a5160'];
      vBars(x, y, w, h, vals, (bx, by, bw, bh, i) => fRect(bx, by, bw, bh, palette[i % palette.length]));
    }

    // ===== Matched do/don't pair renderer (Chart Swipe) =====
    // Renders the DO and DON'T charts for a rule in the SAME neutral style, so the
    // ONLY visible difference is the genuine IBCS violation — never colour or
    // overall styling. The DON'T is, by design, an identical copy of the DO base
    // chart with exactly one rule broken. (Bitmaps are intentionally NOT used here,
    // because the per-rule PNGs telegraph the verdict via clean-grey vs colourful.)
    function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
    function hashStr(s){ let h=2166136261>>>0; for(let i=0;i<String(s).length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
    function seriesFor(code,n){ const r=mulberry32(hashStr(code||'x')); const a=[]; for(let i=0;i<n;i++)a.push(0.42+r()*0.55); return a; }

    // Per-rule variety: derive a deterministic "spec" from the rule code so two
    // rules that share the same do/dont kind still look clearly different
    // (different category count, labels, value shape, units, orientation and
    // single-vs-grouped series). do & dont of one rule share the SAME spec, so
    // only the genuine violation differs between them.
    const CATSETS=[
      ['A','B','C','D','E','F'],
      ['Q1','Q2','Q3','Q4'],
      ['Jan','Feb','Mar','Apr','May','Jun'],
      ['North','South','East','West','Asia'],
      ['Prod A','Prod B','Prod C','Prod D'],
      ['FY21','FY22','FY23','FY24','FY25'],
      ['DE','FR','UK','US','JP','CN'],
      ['Sales','Ops','R&D','HR','IT']
    ];
    const PROFILES=[
      function(i,n){ return 0.42+0.52*i/(n-1); },                         // ascending
      function(i,n){ return 0.94-0.52*i/(n-1); },                         // descending
      function(i,n){ return 0.46+0.46*Math.sin(Math.PI*i/(n-1)); },       // peak
      function(i,n){ return 0.92-0.44*Math.sin(Math.PI*i/(n-1)); },       // valley
      function(i,n){ return 0.5+0.38*Math.sin(i*1.9+0.6); },              // wave
      function(i,n){ return 0.45+0.5*((i*2654435761>>>0)%97)/97; }        // scattered
    ];
    function specFor(code){
      const seed=hashStr(code);
      function pick(arr,salt){ let hh=(seed ^ Math.imul(salt,0x9e3779b1))>>>0; hh=Math.imul(hh^(hh>>>15),0x85ebca6b)>>>0; hh^=hh>>>13; return arr[(hh>>>0)%arr.length]; }
      const rnd=mulberry32(seed);
      const n=4+(pick([0,1,2],31));                                   // 4..6 categories
      const okCats=CATSETS.filter(function(c){return c.length>=n;});
      const cats=pick(okCats,7).slice(0,n);
      const prof=pick(PROFILES,17);
      const unitIdx=pick([0,1,2,3],11);
      const data=[]; for(let i=0;i<n;i++){ data.push(Math.min(1,Math.max(0.12, prof(i,n)+(rnd()-0.5)*0.16))); }
      const data2=[]; for(let i=0;i<n;i++){ data2.push(Math.min(1,Math.max(0.1, data[i]*(0.66+rnd()*0.5)))); }
      return { seed, n, cats, data, data2,
        horizontal: ((seed>>3)&1)===1,
        grouped:    ((seed>>5)&1)===1,
        unitIdx: unitIdx };
    }

    function pair(rule, compliant, x, y, w, h){
      const code=rule.code||'';
      const good=rule.good||'clean', enemy=rule.enemyKind||'clutter';
      const kind = compliant ? good : enemy;
      const AXIS='#a7afbb', GRID='#e6ebf0', BAR='#5b6573', BAR2='#828b99', BARD='#39414e', BARL='#aab2bf', LBL='#5f6878';
      const cats=['A','B','C','D','E'];
      const labelTop=14, catBot=14;
      const px=x+4, pw=w-8, py=y+labelTop, ph=h-labelTop-catBot, baseY=py+ph;
      const sp=specFor(code), N=sp.n, CATS=sp.cats, DATA=sp.data, DATA2=sp.data2;
      const HORIZ=sp.horizontal, GROUPED=sp.grouped;
      function fmtVal(v){ switch(sp.unitIdx){
        case 1: return Math.round(v*920)+'k';
        case 2: return Math.round(v*100)+'%';
        case 3: return (Math.round(v*48)/10).toFixed(1);
        default: return (Math.round(v*240)/10).toFixed(1)+'M'; } }
      function fmtLong(v){ return Math.round(v*2403517).toLocaleString('en-US'); }
      function line(x1,y1,x2,y2,c,wd){ ctx.strokeStyle=c; ctx.lineWidth=wd; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
      function barFill(i,second,opt){
        if(opt.colorful) return ['#e23b3b','#3b6fe2','#37a76a','#e2a93b','#8e5bd0','#e2693b'][i%6];
        if(opt.mixFills) return [BAR,BARL,'#737d8b',BARD,BARL,BAR2][i%6];
        return second ? BARL : BAR;
      }

      // ----- bar family: vertical or horizontal, single or grouped -----
      function bars(opt){
        opt=opt||{};
        if(opt.bg){ ctx.fillStyle='#eef1f5'; ctx.fillRect(x,y,w,h); }
        const all = GROUPED ? DATA.concat(DATA2) : DATA;
        const max = Math.max.apply(null,all)*1.18;
        const floor = opt.truncate ? Math.min.apply(null,DATA)*0.84 : 0;
        const showVals = opt.labels!==false && !GROUPED;
        if(!HORIZ){
          const slot=pw/N, groupW=slot*0.6, bw=GROUPED?(groupW/2-1):groupW;
          if(opt.grid){ for(let g=0;g<=4;g++){ const gy=py+ph*g/4; line(px,gy,px+pw,gy,GRID,1); } }
          for(let i=0;i<N;i++){
            const cx0=px+slot*i+(slot-groupW)/2;
            const ser=GROUPED?[DATA[i],DATA2[i]]:[DATA[i]];
            for(let s=0;s<ser.length;s++){
              const norm=Math.max(0.04,(ser[s]-floor)/(max-floor)), bh=norm*ph, by=baseY-bh;
              const bx=GROUPED?cx0+s*(bw+2):cx0;
              if(opt.threeD){ const d=4; fPoly([[bx,by],[bx+d,by-d],[bx+bw+d,by-d],[bx+bw,by]],'rgba(0,0,0,0.18)'); fPoly([[bx+bw,by],[bx+bw+d,by-d],[bx+bw+d,baseY-d],[bx+bw,baseY]],'rgba(0,0,0,0.26)'); }
              if(opt.hatch && s===0){ ctx.fillStyle='#eef1f5'; ctx.fillRect(bx,by,bw,bh); hatchRect(bx,by,bw,bh,'#6b7280'); ctx.strokeStyle=BARD; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh); }
              else { ctx.fillStyle=barFill(i,s===1,opt); ctx.fillRect(bx,by,bw,bh); }
              if(showVals){ ctx.fillStyle=LBL; ctx.textAlign='center'; ctx.textBaseline='alphabetic'; ctx.font=(opt.longNum?7:9)+"px 'Segoe UI',system-ui,sans-serif"; ctx.fillText(opt.longNum?fmtLong(ser[s]):fmtVal(ser[s]), bx+bw/2, by-3); ctx.textAlign='left'; }
            }
          }
          line(px,baseY,px+pw,baseY,AXIS,1.4);
          if(opt.grid) line(px,py,px,baseY,AXIS,1);
          if(opt.truncate){ const zy=baseY-3; ctx.strokeStyle='#39414f'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(px-2,zy+5); ctx.lineTo(px+3,zy); ctx.lineTo(px+7,zy+6); ctx.lineTo(px+11,zy); ctx.lineTo(px+15,zy+5); ctx.stroke(); }
          ctx.fillStyle=LBL; ctx.textAlign='center'; ctx.textBaseline='alphabetic'; ctx.font="9px 'Segoe UI',system-ui,sans-serif";
          for(let i=0;i<N;i++) ctx.fillText(CATS[i], px+slot*i+slot/2, baseY+11);
          ctx.textAlign='left';
        } else {
          const gut=Math.min(46,pw*0.2), ax=px+gut, aw=pw-gut-6;
          const slot=ph/N, groupH=slot*0.58, bh=GROUPED?(groupH/2-1):groupH;
          if(opt.grid){ for(let g=0;g<=4;g++){ const gx=ax+aw*g/4; line(gx,py,gx,baseY,GRID,1); } }
          for(let i=0;i<N;i++){
            const cy0=py+slot*i+(slot-groupH)/2;
            const ser=GROUPED?[DATA[i],DATA2[i]]:[DATA[i]];
            for(let s=0;s<ser.length;s++){
              const norm=Math.max(0.04,(ser[s]-floor)/(max-floor)), blen=norm*aw, by=cy0+s*(bh+2);
              if(opt.hatch && s===0){ ctx.fillStyle='#eef1f5'; ctx.fillRect(ax,by,blen,bh); hatchRect(ax,by,blen,bh,'#6b7280'); ctx.strokeStyle=BARD; ctx.lineWidth=1; ctx.strokeRect(ax,by,blen,bh); }
              else { ctx.fillStyle=barFill(i,s===1,opt); ctx.fillRect(ax,by,blen,bh); }
              if(showVals){ ctx.fillStyle=LBL; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.font=(opt.longNum?7:9)+"px 'Segoe UI',system-ui,sans-serif"; ctx.fillText(opt.longNum?fmtLong(ser[s]):fmtVal(ser[s]), ax+blen+3, by+bh/2); }
            }
            ctx.fillStyle=LBL; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.font="9px 'Segoe UI',system-ui,sans-serif"; ctx.fillText(CATS[i], px, cy0+groupH/2);
          }
          ctx.textBaseline='alphabetic'; ctx.textAlign='left';
          line(ax,py,ax,baseY,AXIS,1.4);
          if(opt.truncate){ const zx=ax+3; ctx.strokeStyle='#39414f'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(zx-5,baseY+2); ctx.lineTo(zx,baseY-3); ctx.lineTo(zx+6,baseY+1); ctx.lineTo(zx,baseY-3); ctx.stroke(); }
        }
        if(opt.border){ ctx.strokeStyle='#9aa3b0'; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h); }
        if(opt.legend){ const lx=x+w-50, ly=y+3, lp=['#e23b3b','#3b6fe2','#37a76a']; for(let i=0;i<3;i++){ ctx.fillStyle=lp[i]; ctx.fillRect(lx,ly+i*7,6,5); ctx.fillStyle=LBL; ctx.font="6px 'Segoe UI',system-ui,sans-serif"; ctx.textAlign='left'; ctx.fillText('Series '+(i+1), lx+9, ly+i*7+5); } }
      }

      // ----- variance / deviation chart -----
      function deviation(){
        const n=N, dv=[]; for(let i=0;i<n;i++){ dv.push((DATA[i]-0.5)*2); }
        if(!HORIZ){
          const midY=py+ph/2, slot=pw/n, bw=slot*0.5;
          line(px,midY,px+pw,midY,AXIS,1.2);
          for(let i=0;i<n;i++){ const v=dv[i], bx=px+slot*i+(slot-bw)/2, mag=Math.abs(v)*(ph/2)*0.82, pos=v>=0;
            if(pos){ ctx.fillStyle=BARD; ctx.fillRect(bx,midY-mag,bw,mag); } else { ctx.strokeStyle=BARD; ctx.lineWidth=1.2; ctx.strokeRect(bx,midY,bw,mag); }
            ctx.fillStyle=LBL; ctx.textAlign='center'; ctx.textBaseline='alphabetic'; ctx.font="8px 'Segoe UI',system-ui,sans-serif"; ctx.fillText((pos?'+':'\u2212')+Math.round(Math.abs(v)*40), bx+bw/2, pos?midY-mag-3:midY+mag+9); }
          ctx.fillStyle=LBL; ctx.textAlign='center'; ctx.font="9px 'Segoe UI',system-ui,sans-serif"; for(let i=0;i<n;i++) ctx.fillText(CATS[i],px+slot*i+slot/2,baseY+11); ctx.textAlign='left';
        } else {
          const gut=Math.min(46,pw*0.2), midX=px+gut+(pw-gut-6)/2, half=(pw-gut-6)/2, slot=ph/n, bh=slot*0.5;
          line(midX,py,midX,baseY,AXIS,1.2);
          for(let i=0;i<n;i++){ const v=dv[i], by=py+slot*i+(slot-bh)/2, mag=Math.abs(v)*half*0.9, pos=v>=0;
            if(pos){ ctx.fillStyle=BARD; ctx.fillRect(midX,by,mag,bh); } else { ctx.strokeStyle=BARD; ctx.lineWidth=1.2; ctx.strokeRect(midX-mag,by,mag,bh); }
            ctx.fillStyle=LBL; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.font="9px 'Segoe UI',system-ui,sans-serif"; ctx.fillText(CATS[i], px, by+bh/2); }
          ctx.textBaseline='alphabetic';
        }
      }

      function bigNumber(){
        const v=DATA[0];
        ctx.fillStyle='#39414f'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.font="bold "+Math.round(h*0.30)+"px 'Segoe UI',system-ui,sans-serif";
        ctx.fillText(fmtLong(v), x+w/2, y+h*0.46);
        ctx.font="11px 'Segoe UI',system-ui,sans-serif"; ctx.fillStyle=LBL;
        ctx.fillText(CATS[0]+' total', x+w/2, y+h*0.72);
        ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      }

      function pieChart(){
        const segN=Math.min(N,5), seg=DATA.slice(0,segN), cx=x+w/2, cy=y+h/2-2, r=Math.min(w,h)/2-12;
        const tot=seg.reduce(function(s,v){return s+v;},0); let a=-Math.PI/2;
        const greys=['#454d59','#646e7d','#828b99','#9aa2af','#c2c8d1'];
        for(let i=0;i<seg.length;i++){ const a2=a+seg[i]/tot*Math.PI*2; ctx.fillStyle=greys[i%greys.length]; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,a,a2); ctx.closePath(); ctx.fill(); a=a2; }
        ctx.strokeStyle='#fff'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
      }

      function stack(opt){
        opt=opt||{};
        const segN=3+(sp.seed%3), seg=DATA.slice(0,segN), tot=seg.reduce(function(s,v){return s+v;},0);
        const twin=GROUPED && !opt.broken;
        const greys=['#454d59','#5b6573','#79828f','#9aa2af','#c2c8d1'];
        const bw=Math.min(pw*(twin?0.26:0.4),twin?56:72), ph2=ph*0.92;
        const cxs = twin ? [x+w/2-bw-10, x+w/2+10] : [x+w/2-bw/2];
        for(let c=0;c<cxs.length;c++){
          const bx=cxs[c]; let yy=baseY;
          for(let i=0;i<seg.length;i++){ const val=seg[i]*(c?(0.7+(sp.seed%5)/10):1), sh=val/tot*ph2;
            if(opt.broken){ const off=(i%2)?6:-5; ctx.fillStyle=greys[i%greys.length]; ctx.fillRect(bx+off, yy-sh+(i?3:0), bw, sh); yy-=sh-2; }
            else { ctx.fillStyle=greys[i%greys.length]; ctx.fillRect(bx, yy-sh, bw, sh); yy-=sh; }
          }
          if(!opt.broken){ ctx.strokeStyle='#2b2f38'; ctx.lineWidth=1; ctx.strokeRect(bx,yy,bw,baseY-yy); }
        }
        if(!opt.broken){ ctx.fillStyle=LBL; ctx.textAlign='center'; ctx.font="9px 'Segoe UI',system-ui,sans-serif"; for(let c=0;c<cxs.length;c++) ctx.fillText(twin?(c?'PY':'AC'):'100%', cxs[c]+bw/2, baseY-ph2-4); ctx.textAlign='left'; }
        line(px,baseY,px+pw,baseY,AXIS,1.4);
      }

      function lineChart(opt){
        opt=opt||{};
        const n=Math.max(5,N+1), pts=[]; for(let i=0;i<n;i++){ pts.push(0.3+0.6*(PROFILES[sp.seed%PROFILES.length](i,n))); }
        const max=Math.max.apply(null,pts)*1.15;
        line(px,baseY,px+pw,baseY,AXIS,1.2);
        if(GROUPED){ // area fill under a second, lighter line
          ctx.fillStyle='rgba(120,130,145,0.18)'; ctx.beginPath(); ctx.moveTo(px,baseY);
          for(let i=0;i<n;i++){ const lx=px+pw*i/(n-1), ly=baseY-(pts[i]*0.7/max)*ph; ctx.lineTo(lx,ly); }
          ctx.lineTo(px+pw,baseY); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle='#4a5160'; ctx.lineWidth=2; ctx.beginPath();
        for(let i=0;i<n;i++){ const lx=px+pw*i/(n-1), ly=baseY-(pts[i]/max)*ph; if(i===0)ctx.moveTo(lx,ly); else ctx.lineTo(lx,ly); }
        ctx.stroke();
        ctx.fillStyle='#4a5160'; for(let i=0;i<n;i++){ const lx=px+pw*i/(n-1), ly=baseY-(pts[i]/max)*ph; ctx.beginPath(); ctx.arc(lx,ly,2.1,0,Math.PI*2); ctx.fill(); }
      }

      switch(kind){
        case 'clutter': bars({grid:true,threeD:!HORIZ,colorful:true,border:true,bg:true,legend:true}); break;
        case 'barDark': case 'barSolid': bars({mixFills:true}); break;
        case 'axisBreak': bars({truncate:true}); break;
        case 'bigNumber': (good==='clean') ? bars({longNum:true}) : bigNumber(); break;
        case 'pie': pieChart(); break;
        case 'meceBad': stack({broken:true}); break;
        case 'meceGood': stack({}); break;
        case 'deviation': deviation(); break;
        case 'line': lineChart(); break;
        case 'barHatched': bars({hatch:true}); break;
        default: bars({}); break;  // clean / column / axisFull / barLight
      }
    }

    return { glyph, pair, fRect, dLine, dText };
  }

  global.IBCSCharts = IBCSCharts;
})(typeof window !== 'undefined' ? window : globalThis);
