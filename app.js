// Utility: round to N decimals
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

const els = {
  codeInput: document.getElementById('codeInput'),
  presetSelect: document.getElementById('presetSelect'),
  wpx: document.getElementById('widthPx'),
  hpx: document.getElementById('heightPx'),
  diag: document.getElementById('diagIn'),
  ppi: document.getElementById('ppi'),
  cssDpi: document.getElementById('cssDpi'),
  fit: document.getElementById('fitPreview'),
  rotateBtn: document.getElementById('rotateBtn'),
  renderBtn: document.getElementById('renderBtn'),
  openWinBtn: document.getElementById('openWinBtn'),
  fontPx: document.getElementById('fontPx'),
  fontBtn: document.getElementById('fontBtn'),
  patternSelect: document.getElementById('patternSelect'),
  cellPx: document.getElementById('cellPx'),
  pixelBtn: document.getElementById('pixelBtn'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  boxesBtn: document.getElementById('boxesBtn'),
  pxReport: document.getElementById('pxReport'),
  frameOuter: document.getElementById('frameOuter'),
  frame: document.getElementById('previewFrame'),
  metrics: document.getElementById('metrics'),
  note: document.getElementById('note'),
};

function computePpi(widthPx, heightPx, diagonalIn, manualPpi) {
  if (manualPpi && manualPpi > 0) return manualPpi;
  if (diagonalIn && diagonalIn > 0) {
    const dp = Math.sqrt(widthPx ** 2 + heightPx ** 2);
    return dp / diagonalIn;
  }
  return 96; // fallback assumption
}

let lastCssDims = { w: 0, h: 0 };
let currentMode = 'doc';

function applySize() {
  const widthPx = Math.max(1, Number(els.wpx.value || 0));
  const heightPx = Math.max(1, Number(els.hpx.value || 0));
  const diagonalIn = Number(els.diag.value || 0);
  const manualPpi = Number(els.ppi.value || 0);
  const cssDpi = Math.max(1, Number(els.cssDpi.value || 96));
  const ppi = computePpi(widthPx, heightPx, diagonalIn, manualPpi);

  // Compute CSS pixel size to simulate physical inches based on PPI and cssDpi calibration
  // physical width in inches = widthPx / ppi
  // css width in px = physical inches * cssDpi
  const cssW = (widthPx / ppi) * cssDpi;
  const cssH = (heightPx / ppi) * cssDpi;
  lastCssDims = { w: cssW, h: cssH };

  // Apply size
  els.frameOuter.style.width = `${cssW}px`;
  els.frameOuter.style.height = `${cssH}px`;

  // Fit to viewport via scale transform, if enabled
  let scale = 1;
  if (els.fit.checked) {
    const wrapPadding = 16 + 16; // padding left/right of preview-wrap
    const maxW = window.innerWidth - wrapPadding - 32; // a little extra margin
    const maxH = window.innerHeight - 300; // leave space for controls
    const sx = maxW / cssW;
    const sy = maxH / cssH;
    scale = Math.min(1, sx, sy);
  }
  els.frameOuter.style.transform = `scale(${scale})`;

  // Update metrics readout
  const diagPx = Math.sqrt(widthPx ** 2 + heightPx ** 2);
  const effPpi = ppi;
  const widthIn = widthPx / effPpi;
  const heightIn = heightPx / effPpi;
  els.metrics.textContent = `Computed PPI: ${r2(effPpi)} | Size: ${r2(widthIn)}in x ${r2(heightIn)}in | CSS box: ${r2(cssW)} x ${r2(cssH)} px | Scale: ${r2(scale)}`;
  const mmPerPx = 25.4 / effPpi;
  els.metrics.textContent += ` | 1px ≈ ${r2(mmPerPx)} mm`;

  // Update calibration ruler box (1 inch at cssDpi)
  const ruler = document.querySelector('.ruler');
  ruler.style.width = `${cssDpi}px`;
  ruler.style.height = `${cssDpi}px`;
}

let currentBlobUrl = null;
function buildDocument() {
  const raw = (els.codeInput.value || '').trim();
  let doc = raw;
  if (!/<\s*html[\s>]/i.test(raw)) {
    // Treat as fragment; wrap into a full HTML document
    doc = `<!doctype html><html lang="en">\n<head>\n<meta charset=\"utf-8\" />\n<meta name=viewport content=\"width=device-width, initial-scale=1\" />\n</head>\n<body>\n${raw}\n</body></html>`;
  }
  return new Blob([doc], { type: 'text/html' });
}

function renderToIframe() {
  const blob = buildDocument();
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  currentBlobUrl = URL.createObjectURL(blob);
  els.frame.src = currentBlobUrl;
  els.note.textContent = '';
  currentMode = 'doc';
}

function renderFontSample() {
  const sizePx = Math.max(1, Number(els.fontPx.value || 8));
  const widthPx = Math.max(1, Number(els.wpx.value || 0));
  const heightPx = Math.max(1, Number(els.hpx.value || 0));
  const diagonalIn = Number(els.diag.value || 0);
  const manualPpi = Number(els.ppi.value || 0);
  const ppi = computePpi(widthPx, heightPx, diagonalIn, manualPpi);
  const inch = sizePx / ppi;
  const mm = inch * 25.4;
  const common = [6,8,10,12,14,16,18,20,24];
  const html = `<!doctype html><html lang="en"><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Font Sample</title>
  <style>
    html, body { height: 100%; }
    body { margin: 0; font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif; color: #111; background:#fff; }
    .wrap { padding: 16px; }
    .line { display:flex; align-items:baseline; gap:12px; margin: 10px 0; }
    .tag { color:#555; min-width: 110px; font: 12px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .sample { border:1px dashed #999; padding:8px; border-radius:6px; background:#fafafa; }
    .ruler { width: 96px; height: 96px; border:1px solid #e33; display:inline-grid; place-items:center; color:#e33; margin-top:12px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; margin-top: 14px; }
    .cell { border:1px dashed #ccc; border-radius:6px; padding:10px; background:#fcfcfc; }
    .on { outline: 2px solid #4f8cff; outline-offset: 2px; }
  </style>
  </head><body>
    <div class="wrap">
      <div class="line"><div class="tag">font-size</div><div class="sample" style="font-size:${sizePx}px">The quick brown fox — ${sizePx}px</div></div>
      <div class="line"><div class="tag">x-height</div><div class="sample" style="font-size:${sizePx}px">x x x x x x x</div></div>
      <div class="line"><div class="tag">Ag glyphs</div><div class="sample" style="font-size:${sizePx}px">Aa Bb Cc Dd Ee Ff Gg</div></div>
      <div class="line"><div class="tag">physical</div><div>~${(inch*1000|0)/1000}" • ${mm.toFixed(2)} mm tall for ${sizePx}px</div></div>
      <div class="grid">
        ${common.map(s => `<div class="cell ${s===sizePx?'on':''}" style="font-size:${s}px">${s}px — The quick brown fox</div>`).join('')}
      </div>
      <div class="ruler">1"</div>
    </div>
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  currentBlobUrl = URL.createObjectURL(blob);
  els.frame.src = currentBlobUrl;
  els.note.textContent = `Showing font sample at ${sizePx}px (≈ ${mm.toFixed(2)} mm tall).`;
  currentMode = 'font';
}

function renderPixelPattern() {
  const pattern = (els.patternSelect.value || 'grid');
  const cell = Math.max(1, Number(els.cellPx.value || 10));
  // Build CSS backgrounds for patterns
  let bg = '#fff';
  if (pattern === 'grid') {
    bg = `
      linear-gradient(to right, rgba(0,0,0,0.25) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(0,0,0,0.25) 1px, transparent 1px)
    `;
  } else if (pattern === 'checker') {
    // Two tiled gradients offset to create checkerboard
    bg = `
      linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee),
      linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee)
    `;
  } else if (pattern === 'bars-h') {
    bg = `repeating-linear-gradient(to bottom, #000 0, #000 1px, #fff 1px, #fff ${cell}px)`;
  } else if (pattern === 'bars-v') {
    bg = `repeating-linear-gradient(to right, #000 0, #000 1px, #fff 1px, #fff ${cell}px)`;
  } else if (pattern === 'solid') {
    bg = '#ddd';
  }

  const widthPx = Math.max(1, Number(els.wpx.value || 0));
  const heightPx = Math.max(1, Number(els.hpx.value || 0));
  const diagonalIn = Number(els.diag.value || 0);
  const manualPpi = Number(els.ppi.value || 0);
  const ppi = computePpi(widthPx, heightPx, diagonalIn, manualPpi);
  const mmPerPx = 25.4 / ppi;
  const mm100 = (100 * mmPerPx).toFixed(2);

  // For grid/checker we need to set background-size
  let extraCss = '';
  if (pattern === 'grid') {
    extraCss = `background-size: ${cell}px ${cell}px, ${cell}px ${cell}px; background-position: 0 0, 0 0;`;
  } else if (pattern === 'checker') {
    extraCss = `background-size: ${cell * 2}px ${cell * 2}px, ${cell * 2}px ${cell * 2}px; background-position: 0 0, ${cell}px ${cell}px;`;
  } else {
    extraCss = '';
  }

  const html = `<!doctype html><html lang="en"><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pixel Pattern</title>
  <style>
    html, body { height: 100%; }
    body { margin: 0; font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif; }
    .wrap { padding: 12px; }
    .panel { margin-bottom: 10px; color: #333; }
    .area { width: 100%; height: calc(100% - 90px); border: 1px solid #ccc; border-radius: 8px; ${extraCss} background: ${bg}; }
    .ruler { margin-top: 10px; height: 14px; position: relative; }
    .bar { width: 100px; height: 100%; background: #4f8cff; }
    .label { position: absolute; left: 0; top: 18px; font: 12px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #333; }
  </style>
  </head><body>
    <div class="wrap">
      <div class="panel">Pattern: ${pattern} | cell: ${cell}px | 1px ≈ ${mmPerPx.toFixed(3)} mm</div>
      <div class="area"></div>
      <div class="ruler"><div class="bar"></div><div class="label">100 px ≈ ${mm100} mm</div></div>
    </div>
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  currentBlobUrl = URL.createObjectURL(blob);
  els.frame.src = currentBlobUrl;
  els.note.textContent = 'Showing pixel pattern.';
  currentMode = 'pixel';
}

function getCurrentMmPerPx() {
  const widthPx = Math.max(1, Number(els.wpx.value || 0));
  const heightPx = Math.max(1, Number(els.hpx.value || 0));
  const diagonalIn = Number(els.diag.value || 0);
  const manualPpi = Number(els.ppi.value || 0);
  const ppi = computePpi(widthPx, heightPx, diagonalIn, manualPpi);
  return 25.4 / ppi;
}

function analyzePxFromCode() {
  const code = String(els.codeInput.value || '');
  const re = /(\d+(?:\.\d+)?)\s*px\b/gi;
  const found = new Set();
  let m;
  while ((m = re.exec(code))) {
    const n = Number(m[1]);
    if (n > 0) found.add(n);
  }
  const values = Array.from(found).sort((a,b)=>a-b);
  const mmPerPx = getCurrentMmPerPx();
  if (!values.length) {
    els.pxReport.innerHTML = '<div class="row">No px values found.</div>';
    return values;
  }
  const chips = values.map(v => `<span class="chip">${v}px ≈ ${(v*mmPerPx).toFixed(2)} mm (${(v/25.4*mmPerPx*25.4? (v*mmPerPx/25.4).toFixed(3):'')}${''})</span>`);
  els.pxReport.innerHTML = `<div class="row">${chips.join(' ')}</div>`;
  return values;
}

function renderPxBoxes(values) {
  const mmPerPx = getCurrentMmPerPx();
  const items = values.slice(0, 50); // cap to avoid huge docs
  const rows = items.map(v => `
    <div class="row">
      <div class="label">${v}px</div>
      <div class="box" style="width:${v}px"></div>
      <div class="phys">≈ ${(v*mmPerPx).toFixed(2)} mm</div>
    </div>`).join('');
  const html = `<!doctype html><html><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PX Boxes</title>
  <style>
    html, body { height: 100%; }
    body { margin: 0; font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif; color:#111; background:#fff; }
    .wrap { padding: 12px; }
    .row { display:flex; align-items:center; gap:12px; margin:8px 0; }
    .label { width: 72px; color:#333; font: 12px/1.2 ui-monospace, Menlo, Consolas, monospace; }
    .box { height: 18px; background:#4f8cff; border:1px solid #2a66e3; border-radius:4px; }
    .phys { color:#333; font: 12px/1.2 ui-monospace, Menlo, Consolas, monospace; }
    .inch { width: 96px; height: 12px; background:#000; margin-top: 10px; }
  </style>
  </head><body>
  <div class="wrap">
    <div style="color:#555; font:12px/1.2 ui-monospace, Menlo, Consolas, monospace;">1px ≈ ${mmPerPx.toFixed(3)} mm</div>
    ${rows}
    <div class="inch"></div>
    <div style="color:#555; font:12px/1.2 ui-monospace, Menlo, Consolas, monospace;">1 inch (96 CSS px)</div>
  </div>
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  currentBlobUrl = URL.createObjectURL(blob);
  els.frame.src = currentBlobUrl;
  els.note.textContent = 'Showing px boxes preview.';
  currentMode = 'pxboxes';
}

// Preset loading and parsing
function parseNumber(val) {
  if (val == null) return NaN;
  const m = String(val).match(/[0-9]+(\.[0-9]+)?/);
  return m ? Number(m[0]) : NaN;
}

function parsePresets(md) {
  const presets = [];
  const lines = md.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Try Markdown table
  const headerIdx = lines.findIndex(l => l.includes('|') && /name|device/i.test(l));
  if (headerIdx >= 0 && headerIdx + 2 < lines.length && /^\|?\s*[-:|\s]+$/.test(lines[headerIdx + 1])) {
    const headers = lines[headerIdx].split('|').map(h => h.trim().toLowerCase());
    for (let i = headerIdx + 2; i < lines.length; i++) {
      if (!lines[i].includes('|')) break;
      const cols = lines[i].split('|').map(c => c.trim());
      if (cols.length < 2) continue;
      const obj = {};
      headers.forEach((h, idx) => obj[h] = cols[idx] || '');
      const name = obj['name'] || obj['device'] || cols[0];
      let w = obj['width'] || obj['w'] || '';
      let h = obj['height'] || obj['h'] || '';
      if (!w && /x/i.test(cols[1] || '')) {
        const m = (cols[1] || '').match(/(\d+)\s*[x×]\s*(\d+)/i);
        if (m) { w = m[1]; h = m[2]; }
      }
      const ppi = obj['ppi'] || '';
      const diag = obj['diagonal'] || obj['diag'] || '';
      const wNum = parseNumber(w);
      const hNum = parseNumber(h);
      const ppiNum = parseNumber(ppi);
      const dNum = parseNumber(diag);
      if (name && wNum && hNum) {
        presets.push({ name, width: wNum, height: hNum, ppi: ppiNum || undefined, diagonal: dNum || undefined });
      }
    }
    if (presets.length) return presets;
  }

  // Fallback: bullet or CSV/pipe lines
  for (const line of lines) {
    const l = line.replace(/^[-*]\s+/, '');
    // Pattern: Name | 1080x1920 | ppi=401 | diag=6.5
    if (l.includes('|')) {
      const parts = l.split('|').map(s => s.trim());
      const name = parts[0];
      let w = NaN, h = NaN, ppi = NaN, d = NaN;
      for (const p of parts.slice(1)) {
        const mDim = p.match(/(\d+)\s*[x×]\s*(\d+)/i);
        if (mDim) { w = Number(mDim[1]); h = Number(mDim[2]); continue; }
        if (/^w(idth)?/i.test(p)) w = parseNumber(p);
        if (/^h(eight)?/i.test(p)) h = parseNumber(p);
        if (/ppi/i.test(p)) ppi = parseNumber(p);
        if (/diag|diagonal/i.test(p)) d = parseNumber(p);
      }
      if (name && w && h) presets.push({ name, width: w, height: h, ppi: ppi || undefined, diagonal: d || undefined });
      continue;
    }
    // CSV: Name,1080,1920,401,6.5
    if (l.includes(',')) {
      const parts = l.split(',').map(s => s.trim());
      const [name, w, h, ppi, d] = parts;
      const wNum = parseNumber(w), hNum = parseNumber(h);
      if (name && wNum && hNum) presets.push({ name, width: wNum, height: hNum, ppi: parseNumber(ppi) || undefined, diagonal: parseNumber(d) || undefined });
      continue;
    }
    // Space separated: Name 1080x1920 401 6.1  OR  Name 1080 1920 401 6.1
    {
      const parts = l.split(/\s+/);
      if (parts.length >= 2) {
        const name = parts[0];
        let w = NaN, h = NaN, p = NaN, d = NaN;
        const dimToken = parts[1];
        const mDim = dimToken.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
        if (mDim) { w = Number(mDim[1]); h = Number(mDim[2]); }
        else if (parts.length >= 3) { w = parseNumber(parts[1]); h = parseNumber(parts[2]); }
        if (parts.length >= 4) p = parseNumber(parts[3]);
        if (parts.length >= 5) d = parseNumber(parts[4]);
        if (name && w && h) {
          presets.push({ name, width: w, height: h, ppi: p || undefined, diagonal: d || undefined });
          continue;
        }
      }
    }
  }
  return presets;
}

function setPresets(list) {
  const sel = els.presetSelect;
  // Remove old options except first
  while (sel.options.length > 1) sel.remove(1);
  list.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${p.name} (${p.width}x${p.height}${p.ppi ? ` @ ${p.ppi}ppi` : ''}${p.diagonal ? `, ${p.diagonal}\"` : ''})`;
    sel.appendChild(opt);
  });
  sel.dataset.presets = JSON.stringify(list);
}

async function tryFetchPresets() {
  try {
    const res = await fetch('test.md', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const list = parsePresets(text);
    if (list.length === 0) {
      els.note.textContent = 'test.md found but no presets recognized.';
    } else {
      setPresets(list);
      els.note.textContent = `Loaded ${list.length} preset(s) from test.md.`;
      // Auto-select a sensible default and apply values
      const preferredNames = ['zelos', 'mirta', 'ven', 'pyramid'];
      let idx = 0;
      const lower = list.map(p => (p.name || '').toLowerCase());
      for (const name of preferredNames) {
        const i = lower.indexOf(name);
        if (i >= 0) { idx = i; break; }
      }
      els.presetSelect.value = String(idx);
      handlePresetSelect();
    }
  } catch (e) {
    // Possibly running from file://; fetch may be blocked.
    els.note.textContent = 'Could not read test.md. Ensure it is next to index.html.';
  }
}

function handlePresetSelect() {
  const sel = els.presetSelect;
  const idx = Number(sel.value);
  if (Number.isNaN(idx)) return;
  try {
    const list = JSON.parse(sel.dataset.presets || '[]');
    const p = list[idx];
    if (!p) return;
    els.wpx.value = String(p.width);
    els.hpx.value = String(p.height);
    els.ppi.value = p.ppi ? String(p.ppi) : '';
    els.diag.value = p.diagonal ? String(p.diagonal) : '';
    // Only set fields. Do not auto-render; user controls when to render.
    applySize();
  } catch {}
}

function handlePresetFile(evt) {
  const f = evt.target.files && evt.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    const list = parsePresets(text);
    if (list.length) {
      setPresets(list);
      els.note.textContent = `Loaded ${list.length} preset(s) from file.`;
    } else {
      els.note.textContent = 'No presets recognized in file.';
    }
  };
  reader.readAsText(f);
}

function rotate() {
  const w = els.wpx.value;
  els.wpx.value = els.hpx.value;
  els.hpx.value = w;
  applySize();
}

// Wire up events
['input', 'change'].forEach((ev) => {
  els.wpx.addEventListener(ev, applySize);
  els.hpx.addEventListener(ev, applySize);
  els.diag.addEventListener(ev, applySize);
  els.ppi.addEventListener(ev, applySize);
  els.cssDpi.addEventListener(ev, applySize);
  els.fit.addEventListener(ev, applySize);
});
els.rotateBtn.addEventListener('click', rotate);
els.renderBtn.addEventListener('click', () => { applySize(); renderToIframe(); });
els.openWinBtn.addEventListener('click', () => {
  applySize();
  const blob = buildDocument();
  const objUrl = URL.createObjectURL(blob);
  const w = Math.max(100, Math.round(lastCssDims.w));
  const h = Math.max(100, Math.round(lastCssDims.h));
  const feat = `popup=yes,width=${w},height=${h},noopener=yes,noreferrer=yes,resizable=yes,scrollbars=yes`;
  const win = window.open(objUrl, '_blank', feat);
  if (!win) {
    els.note.textContent = 'Popup blocked. Allow popups for this page and try again.';
  } else {
    els.note.textContent = `Opened new window approx ${w}×${h} CSS px.`;
  }
});
els.fontBtn.addEventListener('click', () => { applySize(); renderFontSample(); });
els.pixelBtn.addEventListener('click', () => { applySize(); renderPixelPattern(); });
els.cellPx.addEventListener('input', () => { if (currentMode === 'pixel') { applySize(); renderPixelPattern(); } });
els.patternSelect.addEventListener('change', () => { if (currentMode === 'pixel') { applySize(); renderPixelPattern(); } });
els.analyzeBtn.addEventListener('click', () => { analyzePxFromCode(); });
els.boxesBtn.addEventListener('click', () => { const vals = analyzePxFromCode(); if (vals.length) { applySize(); renderPxBoxes(vals); } });
els.fontPx.addEventListener('input', () => { if (currentMode === 'font') { applySize(); renderFontSample(); } });

els.presetSelect.addEventListener('change', handlePresetSelect);

// Resize handler for fit-to-viewport
window.addEventListener('resize', applySize);

// Initial render
// Seed a simple starter single-file snippet
els.codeInput.value = '<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>My Page</title>\n  <style>\n    html, body { height: 100%; }\n    body { margin: 0; font-family: system-ui; padding: 16px; }\n    #app { max-width: 640px; margin: 0 auto; }\n    .btn { padding: 6px 10px; }\n  </style>\n  <script>\n    console.log(\'Hello from the simulator\');\n  </' + 'script>\n</head>\n<body>\n  <div id=\"app\">\n    <h2>My Page</h2>\n    <p>Edit this single file (HTML/CSS/JS) and click Render.</p>\n    <button class=\"btn\" onclick=\"alert(\\\'JS works!\\\')\">Click me</button>\n  </div>\n</body>\n</html>';

applySize();
renderToIframe();
// Auto-load presets from test.md on startup
// 1) Start with built-in defaults
const builtinPresets = [
  // Phones
  { name: 'zelos',   width: 1080, height: 1920, ppi: 401, diagonal: 5.5 },
  { name: 'mirta',   width: 1170, height: 2532, ppi: 460, diagonal: 6.1 },
  { name: 'ven',     width: 1080, height: 2400, ppi: 421, diagonal: 6.2 },
  { name: 'pyramid', width: 1440, height: 2960, ppi: 529, diagonal: 6.0 },
  // Tablets
  { name: 'iPad 11"', width: 1668, height: 2388, ppi: 264, diagonal: 11.0 },
  // Laptops/Desktops
  { name: '13.3" FHD', width: 1920, height: 1080, diagonal: 13.3 }, // ppi computed
  { name: '15.6" FHD', width: 1920, height: 1080, diagonal: 15.6 },
  { name: '27" QHD',   width: 2560, height: 1440, diagonal: 27.0 },
  { name: '27" 4K',    width: 3840, height: 2160, diagonal: 27.0 },
  { name: '19" 1280x1024', width: 1280, height: 1024, diagonal: 19.0 },
];
setPresets(builtinPresets);
// 2) Optionally extend/override from test.md if available
tryFetchPresets();
