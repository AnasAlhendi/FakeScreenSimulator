window.addEventListener('resize', applySize);
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
  fontPx: document.getElementById('fontPx'),
  fontBtn: document.getElementById('fontBtn'),
  frameOuter: document.getElementById('frameOuter'),
  frame: document.getElementById('previewFrame'),
  metrics: document.getElementById('metrics'),
    openWinBtn: document.getElementById('openWinBtn'),
    patternSelect: document.getElementById('patternSelect'),
    cellPx: document.getElementById('cellPx'),
    pixelBtn: document.getElementById('pixelBtn'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    boxesBtn: document.getElementById('boxesBtn'),
    pxReport: document.getElementById('pxReport'),
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

  // Optional: fit to viewport via scale transform
  let scale = 1;
  if (els.fit && els.fit.checked) {
    const wrapPadding = 16 + 16; // padding left/right of preview-wrap
    const maxW = window.innerWidth - wrapPadding - 32; // a little extra margin
    const maxH = window.innerHeight - 300; // leave space for controls
    const sx = maxW / cssW;
    const sy = maxH / cssH;
    scale = Math.min(1, sx, sy);
  }
  els.frameOuter.style.transform = `scale(${scale})`;








  // Update metrics readout
  const effPpi = ppi;
  const widthIn = widthPx / effPpi;
  const heightIn = heightPx / effPpi;
  const mmPerPx = 25.4 / effPpi;
  els.metrics.textContent = `Computed PPI: ${r2(effPpi)} | Size: ${r2(widthIn)}in x ${r2(heightIn)}in | CSS box: ${r2(cssW)} x ${r2(cssH)} px | 1px approx ${r2(mmPerPx)} mm`;
  // Update calibration ruler box (1 inch at cssDpi)
  const ruler = document.querySelector('.ruler');
  ruler.style.width = `${cssDpi}px`;
  ruler.style.height = `${cssDpi}px`;

  // Keep overlays in sync
  try { updateOverlays(); } catch {}
}

let currentBlobUrl = null;
function buildDocument() {
  const raw = (els.codeInput.value || '').trim();
  let doc = raw;
  if (!/<\s*html[\s>]/i.test(raw)) {
    // Treat as fragment; wrap into a full HTML document
    doc = `<!doctype html><html lang="en">\n<head>\n<meta charset=\"utf-8\" />\n<meta name=viewport content=\"width=device-width, initial-scale=1\" />\n</head>\n<body>\n${raw}\n</body></html>`;
  }
  // Force physical scaling inside the preview so 1 CSS px maps to the
  // selected monitor's physical px size (based on PPI and CSS DPI).
  // scale = cssDpi / ppi
  try {
    const widthPx = Math.max(1, Number(els.wpx.value || 0));
    const heightPx = Math.max(1, Number(els.hpx.value || 0));
    const diagonalIn = Number(els.diag.value || 0);
    const manualPpi = Number(els.ppi.value || 0);
    const cssDpi = Math.max(1, Number(els.cssDpi.value || 96));
    const ppi = computePpi(widthPx, heightPx, diagonalIn, manualPpi);
    const scale = cssDpi / ppi;
    const wrap = `\n<script>(function(){\n  try {\n    var s = ${Number.isFinite ? (Number.isFinite(1) && 0) : 0};\n  } catch(e){}\n})();<\/script>`; // placeholder to keep escaping sane
    const injector = `\n<script>(function(){\n  try {\n    var s = ${ (1).toFixed ? ( (cssDpi / computePpi(Math.max(1, Number(els.wpx.value||0)), Math.max(1, Number(els.hpx.value||0)), Number(els.diag.value||0), Number(els.ppi.value||0))) ).toFixed(6) : scale.toFixed(6) };\n    var w = document.createElement('div');\n    w.id = '__simwrap';\n    w.style.transform = 'scale(' + s + ')';\n    w.style.transformOrigin = '0 0';\n    w.style.width = 'calc(100%/' + s + ')';\n    while (document.body.firstChild) { w.appendChild(document.body.firstChild); }\n    document.body.appendChild(w);\n    try { document.documentElement.style.background = getComputedStyle(document.body).background || 'white'; } catch(_) {}\n  } catch (e) { try { console.warn('sim wrap failed', e); } catch(_) {} }\n})();<\/script>`;
    if (/<\/body>/i.test(doc)) {
      doc = doc.replace(/<\/body>/i, injector + "\n</body>");
    } else {
      doc += injector;
    }
  } catch {}
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

// Analyze px values in the code input and show chips with physical mm
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
  const widthPx = Math.max(1, Number(els.wpx.value || 0));
  const heightPx = Math.max(1, Number(els.hpx.value || 0));
  const diagonalIn = Number(els.diag.value || 0);
  const manualPpi = Number(els.ppi.value || 0);
  const ppi = computePpi(widthPx, heightPx, diagonalIn, manualPpi);
  const mmPerPx = 25.4 / ppi;
  if (!els.pxReport) return values;
  if (!values.length) {
    els.pxReport.innerHTML = '<div class="row">No px values found.</div>';
    return values;
  }
  const chips = values.map(v => `<span class="chip">${v}px ≈ ${(v*mmPerPx).toFixed(2)} mm</span>`);
  els.pxReport.innerHTML = `<div class="row">${chips.join(' ')}</div>`;
  return values;
}

function renderPxBoxes(values) {
  const widthPx = Math.max(1, Number(els.wpx.value || 0));
  const heightPx = Math.max(1, Number(els.hpx.value || 0));
  const diagonalIn = Number(els.diag.value || 0);
  const manualPpi = Number(els.ppi.value || 0);
  const ppi = computePpi(widthPx, heightPx, diagonalIn, manualPpi);
  const mmPerPx = 25.4 / ppi;
  const items = values.slice(0, 50);
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

  // For grid/checker background-size
  let extraCss = '';
  if (pattern === 'grid') {
    extraCss = `background-size: ${cell}px ${cell}px, ${cell}px ${cell}px; background-position: 0 0, 0 0;`;
  } else if (pattern === 'checker') {
    extraCss = `background-size: ${cell * 2}px ${cell * 2}px, ${cell * 2}px ${cell * 2}px; background-position: 0 0, ${cell}px ${cell}px;`;
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
      <div class="line"><div class="tag">font-size</div><div class="sample" style="font-size:${sizePx}px">The quick brown fox â€” ${sizePx}px</div></div>
      <div class="line"><div class="tag">x-height</div><div class="sample" style="font-size:${sizePx}px">x x x x x x x</div></div>
      <div class="line"><div class="tag">Ag glyphs</div><div class="sample" style="font-size:${sizePx}px">Aa Bb Cc Dd Ee Ff Gg</div></div>
      <div class="line"><div class="tag">physical</div><div>~${(inch*1000|0)/1000}" â€¢ ${mm.toFixed(2)} mm tall for ${sizePx}px</div></div>
      <div class="grid">
        ${common.map(s => `<div class="cell ${s===sizePx?'on':''}" style="font-size:${s}px">${s}px â€” The quick brown fox</div>`).join('')}
      </div>
      <div class="ruler">1"</div>
    </div>
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  currentBlobUrl = URL.createObjectURL(blob);
  els.frame.src = currentBlobUrl;
  els.note.textContent = `Showing font sample at ${sizePx}px (â‰ˆ ${mm.toFixed(2)} mm tall).`;
  currentMode = 'font';
}


function getCurrentMmPerPx() {
  const widthPx = Math.max(1, Number(els.wpx.value || 0));
  const heightPx = Math.max(1, Number(els.hpx.value || 0));
  const diagonalIn = Number(els.diag.value || 0);
  const manualPpi = Number(els.ppi.value || 0);
  const ppi = computePpi(widthPx, heightPx, diagonalIn, manualPpi);
  return 25.4 / ppi;
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
        const m = (cols[1] || '').match(/(\d+)\s*[xأ—]\s*(\d+)/i);
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
        const mDim = p.match(/(\d+)\s*[xأ—]\s*(\d+)/i);
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
        const mDim = dimToken.match(/^(\d+)\s*[xأ—]\s*(\d+)$/i);
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
    // Apply the new size immediately
    applySize();

    // If there is content in the editor, auto-render it so the
    // preview reflects the selected screen's physical simulation.
    const hasDoc = /\S/.test(els.codeInput.value || '');
    if (hasDoc) {
      renderToIframe();
      els.note.textContent = 'Rendered with selected screen preset.';
    }
    
    updateOverlays();
  } catch {}
}

// Improved analyzer for live use (px -> mm chips)

// Injects hover overlay into the preview to show computed px & mm
function injectAnnotatorIfEnabled() {
  // Always inject annotator regardless of toggle, to keep behavior dynamic
  const doc = els.frame && els.frame.contentDocument;
  if (!doc) return;
  if (doc.getElementById('pxmm-tip')) return; // already injected
  const mmPerPx = getCurrentMmPerPx();

  const tip = doc.createElement('div');
  tip.id = 'pxmm-tip';
  tip.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;left:0;top:0;transform:translate(8px,8px);background:rgba(0,0,0,0.8);color:#fff;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;border-radius:6px;padding:6px 8px;box-shadow:0 2px 8px rgba(0,0,0,0.4)';
  tip.hidden = true;
  doc.body.appendChild(tip);

  const toNum = (v)=>{ const n = parseFloat(v); return isFinite(n)?n:0; };
  const px = (n)=> n.toFixed(2) + 'px';
  const mm = (n)=> (n*mmPerPx).toFixed(2) + ' mm';
  const row = (k,v)=> `<div><span style="color:#89b4ff">${k}</span>: ${v}</div>`;

  const onMove = (e) => {
    const el = doc.elementFromPoint(e.clientX, e.clientY);
    if (!el) { tip.hidden = true; return; }
    const cs = doc.defaultView.getComputedStyle(el);
    const fs = toNum(cs.fontSize);
    const pad = [toNum(cs.paddingTop),toNum(cs.paddingRight),toNum(cs.paddingBottom),toNum(cs.paddingLeft)];
    const mar = [toNum(cs.marginTop),toNum(cs.marginRight),toNum(cs.marginBottom),toNum(cs.marginLeft)];
    const bor = [toNum(cs.borderTopWidth),toNum(cs.borderRightWidth),toNum(cs.borderBottomWidth),toNum(cs.borderLeftWidth)];
    const w = el.clientWidth; const h = el.clientHeight;
    const ident = el.tagName.toLowerCase() + (el.id?('#'+el.id):'') + (el.className?('.'+String(el.className).trim().split(/\s+/).join('.')):'');
    const lines = [
      `<div style="margin-bottom:4px;color:#a6e3a1">${ident}</div>`,
      row('font-size', `${px(fs)} | ${mm(fs)}`),
      row('padding (t r b l)', `${pad.map(v=>px(v)).join(' ')} | ${pad.map(v=>mm(v)).join(' ')}`),
      row('margin (t r b l)', `${mar.map(v=>px(v)).join(' ')} | ${mar.map(v=>mm(v)).join(' ')}`),
      row('border (t r b l)', `${bor.map(v=>px(v)).join(' ')} | ${bor.map(v=>mm(v)).join(' ')}`),
      row('box size', `${px(w)} أ— ${px(h)} | ${mm(w)} أ— ${mm(h)}`),
    ];
    tip.innerHTML = lines.join('');
    tip.style.left = e.clientX + 'px';
    tip.style.top = e.clientY + 'px';
    tip.hidden = false;
  };
  const onLeave = ()=>{ tip.hidden = true; };
  doc.addEventListener('mousemove', onMove, { passive: true });
  doc.addEventListener('mouseleave', onLeave, { passive: true });
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

// Recompute and update metrics line and px badge using current inputs
function updateOverlays() {
  const widthPx = Math.max(1, Number(els.wpx.value || 0));
  const heightPx = Math.max(1, Number(els.hpx.value || 0));
  const diagonalIn = Number(els.diag.value || 0);
  const manualPpi = Number(els.ppi.value || 0);
  const cssDpi = Math.max(1, Number(els.cssDpi.value || 96));
  const ppi = computePpi(widthPx, heightPx, diagonalIn, manualPpi);
  const mmPerPx = 25.4 / ppi;
  const cssW = (widthPx / ppi) * cssDpi;
  const cssH = (heightPx / ppi) * cssDpi;
  const widthIn = widthPx / ppi;
  const heightIn = heightPx / ppi;
  const scale = els.frameOuter && els.frameOuter.style && (els.frameOuter.style.transform.match(/scale\(([^)]+)\)/) || [,'1'])[1];
  if (els.metrics) {
    els.metrics.textContent = `Computed PPI: ${r2(ppi)} | Size: ${r2(widthIn)}in x ${r2(heightIn)}in | CSS box: ${r2(cssW)} x ${r2(cssH)} px | Scale: ${scale} | 1px approx ${r2(mmPerPx)} mm`;
  }
}
['input', 'change'].forEach((ev) => {
  const u = () => updateOverlays();
  els.wpx.addEventListener(ev, u);
  els.hpx.addEventListener(ev, u);
  els.diag.addEventListener(ev, u);
  els.ppi.addEventListener(ev, u);
  els.cssDpi.addEventListener(ev, u);
  
});
els.rotateBtn.addEventListener('click', rotate);
els.renderBtn.addEventListener('click', () => { applySize(); renderToIframe(); });

els.openWinBtn.addEventListener('click', () => {
  applySize();
  const blob = buildDocument();
  const objUrl = URL.createObjectURL(blob);
  const w = Math.max(100, Math.round(lastCssDims.w));
  const h = Math.max(100, Math.round(lastCssDims.h));
  const feat = 'popup=yes,width=' + w + ',height=' + h + ',noopener=yes,noreferrer=yes,resizable=yes,scrollbars=yes';
  const win = window.open(objUrl, '_blank', feat);
  if (!win) {
    els.note.textContent = 'Popup blocked. Allow popups for this page and try again.';
  } else {
    els.note.textContent = 'Opened new window approx ' + w + 'x' + h + ' CSS px.';
  }
});

els.presetSelect.addEventListener('change', handlePresetSelect);

// Seed a richer single-file example into the editor if empty
if (!String(els.codeInput.value || '').trim()) {
  els.codeInput.value = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UI Sample (Single File)</title>
  <style>
    :root{ --bg:#ffffff; --fg:#111; --muted:#555; --primary:#4f8cff; --border:#ccc; }
    html,body{height:100%}
    body{ margin:0; font:14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:var(--fg); background:var(--bg); }
    .wrap{max-width:960px; margin:0 auto; padding:24px}
    .grid{display:grid; grid-template-columns: 1fr 1fr; gap:16px; align-items:start}
    .header{margin-bottom:16px}
    .muted{color:var(--muted)}
    .card{ border:1px solid var(--border); border-radius:8px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.06); background:#fff; }
    .btn{ display:inline-block; padding:8px 12px; border:1px solid #2a66e3; background:var(--primary); color:#fff; border-radius:6px; cursor:pointer; text-decoration:none; font-size:14px; }
    .btn.ghost{ background:transparent; color:var(--primary); border-color:var(--border); }
    .field{display:flex; flex-direction:column; gap:6px; margin:8px 0}
    .field input, .field select, .field textarea{ padding:8px 10px; border:1px solid var(--border); border-radius:6px; font:14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .toolbar{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:10px; border:1px solid var(--border); border-radius:8px; margin:12px 0; }
    .typo h1{font-size:24px; margin:0 0 10px 0}
    .typo h2{font-size:18px; margin:18px 0 8px}
    .typo p{margin:6px 0}
    .badge{display:inline-block; padding:4px 8px; border:1px solid var(--border); border-radius:999px; font-size:12px; color:#333}
    .ruler100{width:100px; height:10px; background:#000; margin:10px 0 4px; border-radius:2px}
    .px-rows{display:grid; grid-template-columns: 120px 1fr; gap:8px; align-items:center}
    .box{height:18px; background:#4f8cff; border:1px solid #2a66e3; border-radius:4px}
    table{border-collapse:collapse; width:100%; border:1px solid var(--border); border-radius:8px; overflow:hidden}
    th, td{padding:10px; border-bottom:1px solid var(--border); text-align:left; font-size:14px}
    th{background:#f7f9ff}
    .demo-area{border:2px dashed #ddd; padding:12px; border-radius:8px}
  </style>
  </head>
  <body>
  <div class="wrap">
    <div class="header">
      <h1>UI Sample</h1>
      <div class="muted">All in one file (HTML + CSS + JS). Uses px to test physical size.</div>
    </div>

    <div class="toolbar">
      <div class="field" style="margin:0">
        <label for="fontPx">Font size (px)</label>
        <input id="fontPx" type="number" min="8" step="1" value="14">
      </div>
      <div class="field" style="margin:0">
        <label for="padPx">Card padding (px)</label>
        <input id="padPx" type="number" min="0" step="2" value="16">
      </div>
      <div class="field" style="margin:0">
        <label for="borderPx">Card border (px)</label>
        <input id="borderPx" type="number" min="0" step="1" value="1">
      </div>
      <button id="applyBtn" class="btn">Apply</button>
      <button id="alertBtn" class="btn ghost">JS Alert</button>
      <span id="liveInfo" class="badge">font 14px, pad 16px, border 1px</span>
    </div>

    <div class="grid">
      <div class="card typo" id="cardA">
        <h1>Left Panel</h1>
        <p>This card has padding, border, shadow, and a few inputs.</p>
        <div class="field">
          <label>Name</label>
          <input placeholder="Jane Doe">
        </div>
        <div class="field">
          <label>Role</label>
          <select>
            <option>Designer</option>
            <option>Engineer</option>
            <option>Manager</option>
          </select>
        </div>
        <div class="field">
          <label>Notes</label>
          <textarea rows="3" placeholder="Some notes..."></textarea>
        </div>
        <div style="display:flex; gap:8px; margin-top:8px">
          <a class="btn" href="javascript:void(0)">Primary</a>
          <a class="btn ghost" href="javascript:void(0)">Ghost</a>
        </div>

        <h2>Table</h2>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
          <tbody>
            <tr><td>Pencils</td><td>12</td><td>$3.00</td></tr>
            <tr><td>Notebooks</td><td>4</td><td>$8.00</td></tr>
            <tr><td>Markers</td><td>6</td><td>$5.50</td></tr>
          </tbody>
        </table>
      </div>

      <div class="card typo" id="cardB">
        <h1>Right Panel</h1>
        <p>Use the controls to change font size, padding, and border thickness to see how they measure on your selected screen.</p>

        <div class="demo-area" id="demoArea">
          <div class="muted" style="margin-bottom:6px">100 px ruler (below)</div>
          <div class="ruler100"></div>

          <div class="muted" style="margin:8px 0 4px">Width boxes</div>
          <div class="px-rows">
            <div class="muted">24 px</div><div class="box" style="width:24px"></div>
            <div class="muted">48 px</div><div class="box" style="width:48px"></div>
            <div class="muted">72 px</div><div class="box" style="width:72px"></div>
            <div class="muted">120 px</div><div class="box" style="width:120px"></div>
          </div>
        </div>

        <h2>Typography</h2>
        <p>H1 24px, H2 18px, body 14px by default. Change the top controls to see it update in place.</p>
        <p><span class="badge">Badge</span> <span class="badge">Token</span> <span class="badge">Chip</span></p>
      </div>
    </div>
  </div>

  <script>
    (function(){
      const els = {
        fontPx: document.getElementById('fontPx'),
        padPx: document.getElementById('padPx'),
        borderPx: document.getElementById('borderPx'),
        applyBtn: document.getElementById('applyBtn'),
        alertBtn: document.getElementById('alertBtn'),
        liveInfo: document.getElementById('liveInfo'),
        cardA: document.getElementById('cardA'),
        cardB: document.getElementById('cardB'),
        demoArea: document.getElementById('demoArea'),
      };

      function applyStyles() {
        const f = Math.max(8, Number(els.fontPx.value || 14));
        const p = Math.max(0, Number(els.padPx.value || 16));
        const b = Math.max(0, Number(els.borderPx.value || 1));

        els.liveInfo.textContent = 'font ' + f + 'px, pad ' + p + 'px, border ' + b + 'px';

        [els.cardA, els.cardB].forEach(card => {
          card.style.fontSize = f + 'px';
          card.style.padding = p + 'px';
          card.style.borderWidth = b + 'px';
        });

        els.demoArea.style.borderWidth = b + 'px';
      }

      els.applyBtn.addEventListener('click', applyStyles);
      els.alertBtn.addEventListener('click', () => { alert('JS works. Try changing the controls above.'); });
      applyStyles();
    })();
  </script>
</body>
</html>`;
}
applySize();
renderToIframe();
// Auto-load presets from test.md on startup
// 1) Start with built-in defaults
const builtinPresets = [
  // Phones (popular sizes)
  { name: 'iPhone 12/13/14', width: 1170, height: 2532, ppi: 460, diagonal: 6.1 },
  { name: 'iPhone 14 Pro Max', width: 1290, height: 2796, ppi: 460, diagonal: 6.7 },
  { name: 'Pixel 7', width: 1080, height: 2400, ppi: 416, diagonal: 6.3 },
  { name: 'Pixel 7 Pro', width: 1440, height: 3120, ppi: 512, diagonal: 6.7 },
  { name: 'Galaxy S21', width: 1080, height: 2400, ppi: 421, diagonal: 6.2 },
  { name: 'Galaxy S21 Ultra', width: 1440, height: 3200, ppi: 515, diagonal: 6.8 },

  // Tablets
  { name: 'iPad 11"', width: 1668, height: 2388, ppi: 264, diagonal: 11.0 },
  { name: 'iPad 12.9"', width: 2048, height: 2732, ppi: 264, diagonal: 12.9 },
  { name: 'Surface Pro 7', width: 2736, height: 1824, ppi: 267, diagonal: 12.3 },

  // Laptops
  { name: '13.3" FHD', width: 1920, height: 1080, diagonal: 13.3 }, // ppi computed
  { name: '14" 1920x1200', width: 1920, height: 1200, diagonal: 14.0 },
  { name: '14" 2560x1600', width: 2560, height: 1600, diagonal: 14.0 },
  { name: '15.6" FHD', width: 1920, height: 1080, diagonal: 15.6 },
  { name: '15.6" 4K', width: 3840, height: 2160, diagonal: 15.6 },

  // Desktop monitors
  { name: '24" FHD', width: 1920, height: 1080, diagonal: 24.0 },
  { name: '24" QHD', width: 2560, height: 1440, diagonal: 24.0 },
  { name: '27" QHD', width: 2560, height: 1440, diagonal: 27.0 },
  { name: '27" 4K', width: 3840, height: 2160, diagonal: 27.0 },
  { name: '32" 4K', width: 3840, height: 2160, diagonal: 32.0 },
  { name: '34" Ultrawide', width: 3440, height: 1440, diagonal: 34.0 },
  { name: '38" Ultrawide', width: 3840, height: 1600, diagonal: 38.0 },
  { name: '49" Super Ultrawide', width: 5120, height: 1440, diagonal: 49.0 },

  // Legacy
  { name: '19" 1280x1024', width: 1280, height: 1024, diagonal: 19.0 },
];
setPresets(builtinPresets);
// 2) Optionally extend/override from test.md if available
tryFetchPresets();
















