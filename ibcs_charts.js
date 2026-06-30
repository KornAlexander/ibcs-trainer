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
