import * as pdfjsLib from './vendor/pdf.min.mjs?v=8';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs?v=8', window.location.href).toString();

const defaultDrawingPattern = 'HLY\\d{2}-\\d{3}-\\d{4}';
const defaultRevisionPattern = '[A-Z]\\.\\d+';

const els = {
  pdfFile: document.getElementById('pdfFile'),
  pageNumber: document.getElementById('pageNumber'),
  previewBtn: document.getElementById('previewBtn'),
  splitBtn: document.getElementById('splitBtn'),
  status: document.getElementById('status'),
  previewCanvas: document.getElementById('previewCanvas'),
  docNumber: document.getElementById('docNumber'),
  revision: document.getElementById('revision'),
  rawText: document.getElementById('rawText'),
  resultTableBody: document.getElementById('resultTableBody'),
  leftRatio: document.getElementById('leftRatio'),
  rightRatio: document.getElementById('rightRatio'),
  topRatio: document.getElementById('topRatio'),
  bottomRatio: document.getElementById('bottomRatio'),
  leftRatioVal: document.getElementById('leftRatioVal'),
  rightRatioVal: document.getElementById('rightRatioVal'),
  topRatioVal: document.getElementById('topRatioVal'),
  bottomRatioVal: document.getElementById('bottomRatioVal'),
  drawingPatternInput: document.getElementById('drawingPatternInput'),
  revisionPatternInput: document.getElementById('revisionPatternInput'),
  drawingPatternDisplay: document.getElementById('drawingPatternDisplay'),
  revisionPatternDisplay: document.getElementById('revisionPatternDisplay'),
  drawingPatternRegex: document.getElementById('drawingPatternRegex'),
  revisionPatternRegex: document.getElementById('revisionPatternRegex'),
  patternError: document.getElementById('patternError'),
  resetPatternsBtn: document.getElementById('resetPatternsBtn'),
  ocrToleranceToggle: document.getElementById('ocrToleranceToggle')
};

let pdfBytes = null;
let pdfJsDoc = null;

function setStatus(message) {
  els.status.textContent = message;
}

function ensureLibraries() {
  const ok = typeof window.PDFLib !== 'undefined' && typeof window.JSZip !== 'undefined';
  if (!ok) {
    setStatus('Missing browser libraries. Wait for GitHub Actions deployment to finish, then refresh with Ctrl + F5.');
  }
  return ok;
}

function ratioValues() {
  const left = Number(els.leftRatio.value);
  const right = Number(els.rightRatio.value);
  const top = Number(els.topRatio.value);
  const bottom = Number(els.bottomRatio.value);
  return {
    left: Math.min(left, right),
    right: Math.max(left, right),
    top: Math.min(top, bottom),
    bottom: Math.max(top, bottom)
  };
}

function updateRatioLabels() {
  els.leftRatioVal.textContent = Number(els.leftRatio.value).toFixed(2);
  els.rightRatioVal.textContent = Number(els.rightRatio.value).toFixed(2);
  els.topRatioVal.textContent = Number(els.topRatio.value).toFixed(2);
  els.bottomRatioVal.textContent = Number(els.bottomRatio.value).toFixed(2);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readablePatternHtml(source) {
  let html = '';
  let i = 0;
  let letterRunIndex = 0;
  while (i < source.length) {
    if (source.startsWith('[A-Z]{', i)) {
      const match = source.slice(i).match(/^\[A-Z\]\{(\d+)\}/);
      if (match) {
        const count = Number(match[1]);
        for (let n = 0; n < count; n++) {
          const cls = (letterRunIndex % 2 === 0) ? 'letter-blue' : 'letter-green';
          html += `<span class="letter-badge ${cls}">Letter</span>`;
          letterRunIndex += 1;
        }
        i += match[0].length;
        continue;
      }
    }
    if (source.startsWith('[A-Z]', i)) {
      const cls = (letterRunIndex % 2 === 0) ? 'letter-blue' : 'letter-green';
      html += `<span class="letter-badge ${cls}">Letter</span>`;
      letterRunIndex += 1;
      i += '[A-Z]'.length;
      continue;
    }
    if (source.startsWith('\\d{', i)) {
      const match = source.slice(i).match(/^\\d\{(\d+)\}/);
      if (match) {
        html += `<span class="readable-token">${'#'.repeat(Number(match[1]))}</span>`;
        letterRunIndex = 0;
        i += match[0].length;
        continue;
      }
    }
    if (source.startsWith('\\d+', i)) {
      html += `<span class="readable-token">#</span>`;
      letterRunIndex = 0;
      i += '\\d+'.length;
      continue;
    }
    if (source.startsWith('\\d', i)) {
      html += `<span class="readable-token">#</span>`;
      letterRunIndex = 0;
      i += '\\d'.length;
      continue;
    }
    if (source.startsWith('\\.', i)) {
      html += `<span class="readable-token">.</span>`;
      letterRunIndex = 0;
      i += 2;
      continue;
    }
    html += `<span class="readable-token">${escapeHtml(source[i])}</span>`;
    letterRunIndex = 0;
    i += 1;
  }
  return html || '<span class="readable-token">(empty)</span>';
}

function getActivePatterns() {
  const drawingSource = els.drawingPatternInput.value.trim();
  const revisionSource = els.revisionPatternInput.value.trim();
  els.drawingPatternRegex.textContent = drawingSource || '(empty)';
  els.revisionPatternRegex.textContent = revisionSource || '(empty)';
  els.drawingPatternDisplay.innerHTML = readablePatternHtml(drawingSource);
  els.revisionPatternDisplay.innerHTML = readablePatternHtml(revisionSource);
  try {
    const drawingPattern = new RegExp(drawingSource, 'i');
    const revisionPattern = new RegExp(revisionSource, 'i');
    els.patternError.textContent = '';
    return { drawingPattern, revisionPattern, valid: true };
  } catch (error) {
    els.patternError.textContent = `Pattern error: ${error.message}`;
    return { drawingPattern: null, revisionPattern: null, valid: false };
  }
}

function normalizeText(text) {
  return (text || '')
    .toUpperCase()
    .replace(/—/g, '-')
    .replace(/_/g, '-')
    .replace(/\s+/g, '');
}

function ocrTolerantVariants(text) {
  let variants = new Set([normalizeText(text)]);
  if (!els.ocrToleranceToggle.checked) return [...variants];

  const digitMap = { 'O': '0', 'I': '1', 'L': '1' };
  const letterMap = { '0': 'O', '1': 'I' };

  for (let step = 0; step < 2; step++) {
    const next = new Set(variants);
    for (const value of variants) {
      for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        if (digitMap[ch]) next.add(value.slice(0, i) + digitMap[ch] + value.slice(i + 1));
        if (letterMap[ch]) next.add(value.slice(0, i) + letterMap[ch] + value.slice(i + 1));
      }
    }
    variants = next;
  }

  return [...variants];
}

function chooseBestMatch(variants, pattern) {
  for (const value of variants) {
    const match = value.match(pattern);
    if (match) return match[0].toUpperCase();
  }
  return '';
}

function extractInfo(text) {
  const { drawingPattern, revisionPattern, valid } = getActivePatterns();
  if (!valid) return { document_number: '', revision: '' };

  const variants = ocrTolerantVariants(text);
  return {
    document_number: chooseBestMatch(variants, drawingPattern),
    revision: chooseBestMatch(variants, revisionPattern)
  };
}

async function loadPdf() {
  if (!ensureLibraries()) return false;
  const file = els.pdfFile.files[0];
  if (!file) {
    setStatus('Please choose a PDF file.');
    return false;
  }
  const fileBuffer = await file.arrayBuffer();
  pdfBytes = fileBuffer.slice(0);
  const pdfJsBuffer = fileBuffer.slice(0);
  pdfJsDoc = await pdfjsLib.getDocument({ data: pdfJsBuffer }).promise;
  els.pageNumber.max = pdfJsDoc.numPages;
  if (Number(els.pageNumber.value) > pdfJsDoc.numPages) els.pageNumber.value = '1';
  setStatus(`Loaded PDF with ${pdfJsDoc.numPages} page(s).`);
  return true;
}

async function getPageData(pageNumber) {
  const page = await pdfJsDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.6 });
  const textContent = await page.getTextContent();
  return { page, viewport, textContent };
}

function scanRectPx(viewport) {
  const ratios = ratioValues();
  return {
    x: viewport.width * ratios.left,
    y: viewport.height * ratios.top,
    width: viewport.width * (ratios.right - ratios.left),
    height: viewport.height * (ratios.bottom - ratios.top)
  };
}

function getItemViewportRect(item, viewport) {
  const x = item.transform[4];
  const y = item.transform[5];
  const width = item.width || 0;
  const height = item.height || Math.abs(item.transform[3]) || 10;
  const p1 = viewport.convertToViewportPoint(x, y);
  const p2 = viewport.convertToViewportPoint(x + width, y + height);
  return {
    left: Math.min(p1[0], p2[0]),
    right: Math.max(p1[0], p2[0]),
    top: Math.min(p1[1], p2[1]),
    bottom: Math.max(p1[1], p2[1])
  };
}

function rectsOverlap(a, b) {
  return !(a.right < b.x || a.left > b.x + b.width || a.bottom < b.y || a.top > b.y + b.height);
}

function textInsideRect(items, rectPx, viewport) {
  const parts = [];
  for (const item of items) {
    const itemRect = getItemViewportRect(item, viewport);
    if (rectsOverlap(itemRect, rectPx)) parts.push(item.str);
  }
  return parts.join(' ');
}

async function previewPage() {
  if (!pdfJsDoc && !(await loadPdf())) return;
  const pageNumber = Math.max(1, Math.min(Number(els.pageNumber.value || 1), pdfJsDoc.numPages));
  els.pageNumber.value = String(pageNumber);
  const { page, viewport, textContent } = await getPageData(pageNumber);
  const canvas = els.previewCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;
  const rectPx = scanRectPx(viewport);
  ctx.save();
  ctx.fillStyle = 'rgba(255, 0, 0, 0.18)';
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.95)';
  ctx.lineWidth = 3;
  ctx.fillRect(rectPx.x, rectPx.y, rectPx.width, rectPx.height);
  ctx.strokeRect(rectPx.x, rectPx.y, rectPx.width, rectPx.height);
  ctx.restore();
  const rawText = textInsideRect(textContent.items, rectPx, viewport);
  const info = extractInfo(rawText);
  els.docNumber.textContent = info.document_number || '<not found>';
  els.revision.textContent = info.revision || '<not found>';
  els.rawText.textContent = rawText || '<no text found in selected area>';
  setStatus(`Previewed page ${pageNumber} of ${pdfJsDoc.numPages}.`);
}

function safeFilename(name) {
  return (name || 'DRAWING')
    .toUpperCase()
    .replace(/[\\/]/g, '-')
    .replace(/[^A-Z0-9._-]+/g, '_')
    .replace(/^[_\-.]+|[_\-.]+$/g, '') || 'DRAWING';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function splitPdf() {
  if (!pdfJsDoc && !(await loadPdf())) return;
  if (!getActivePatterns().valid) {
    setStatus('Please fix the pattern error before splitting.');
    return;
  }
  els.splitBtn.disabled = true;
  els.previewBtn.disabled = true;
  setStatus('Splitting PDF and building ZIP...');
  try {
    const srcPdf = await window.PDFLib.PDFDocument.load(pdfBytes.slice(0));
    const zip = new window.JSZip();
    const rows = [];
    const usedNames = new Map();
    for (let i = 1; i <= pdfJsDoc.numPages; i++) {
      setStatus(`Processing page ${i} of ${pdfJsDoc.numPages}...`);
      const { viewport, textContent } = await getPageData(i);
      const rectPx = scanRectPx(viewport);
      const rawText = textInsideRect(textContent.items, rectPx, viewport);
      const info = extractInfo(rawText);
      let docNumber = info.document_number || `UNKNOWN_DRAWING_PAGE_${String(i).padStart(3, '0')}`;
      const revision = info.revision || '';
      let fileBase = safeFilename(docNumber);
      if (usedNames.has(fileBase)) {
        const next = usedNames.get(fileBase) + 1;
        usedNames.set(fileBase, next);
        fileBase = `${fileBase}_DUP_${String(next).padStart(2, '0')}`;
      } else {
        usedNames.set(fileBase, 1);
      }
      const outPdf = await window.PDFLib.PDFDocument.create();
      const [copied] = await outPdf.copyPages(srcPdf, [i - 1]);
      outPdf.addPage(copied);
      const bytes = await outPdf.save();
      const filename = `${fileBase}.pdf`;
      zip.file(filename, bytes);
      rows.push({ document_number: docNumber, revision, output_filename: filename });
    }
    const csv = ['document_number,revision,output_filename', ...rows.map(r => [r.document_number, r.revision, r.output_filename].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\r\n');
    zip.file('split_register.csv', csv);
    renderResultTable(rows);
    const blob = await zip.generateAsync({ type: 'blob' });
    const sourceName = (els.pdfFile.files[0]?.name || 'drawing_split').replace(/\.pdf$/i, '');
    downloadBlob(blob, `${sourceName}_split_output.zip`);
    setStatus(`Done. Downloaded ZIP with ${rows.length} split PDF(s) and split_register.csv.`);
  } catch (error) {
    console.error(error);
    setStatus(`Error: ${error.message}`);
  } finally {
    els.splitBtn.disabled = false;
    els.previewBtn.disabled = false;
  }
}

function renderResultTable(rows) {
  if (!rows.length) {
    els.resultTableBody.innerHTML = '<tr><td colspan="3">No output yet.</td></tr>';
    return;
  }
  els.resultTableBody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.document_number)}</td>
      <td>${escapeHtml(r.revision)}</td>
      <td>${escapeHtml(r.output_filename)}</td>
    </tr>
  `).join('');
}

function resetPatterns() {
  els.drawingPatternInput.value = defaultDrawingPattern;
  els.revisionPatternInput.value = defaultRevisionPattern;
  getActivePatterns();
}

async function refreshPreviewIfLoaded() {
  if (!pdfJsDoc) return;
  try { await previewPage(); } catch (error) { console.error(error); }
}

els.pdfFile.addEventListener('change', async () => {
  try {
    await loadPdf();
    await previewPage();
  } catch (error) {
    console.error(error);
    setStatus(`Error: ${error.message}`);
  }
});

for (const el of [els.leftRatio, els.rightRatio, els.topRatio, els.bottomRatio]) {
  el.addEventListener('input', async () => {
    updateRatioLabels();
    await refreshPreviewIfLoaded();
  });
}

for (const el of [els.drawingPatternInput, els.revisionPatternInput]) {
  el.addEventListener('input', async () => {
    getActivePatterns();
    await refreshPreviewIfLoaded();
  });
}

els.ocrToleranceToggle.addEventListener('change', async () => {
  await refreshPreviewIfLoaded();
});

els.resetPatternsBtn.addEventListener('click', async () => {
  resetPatterns();
  await refreshPreviewIfLoaded();
});

els.previewBtn.addEventListener('click', async () => {
  try {
    await previewPage();
  } catch (error) {
    console.error(error);
    setStatus(`Error: ${error.message}`);
  }
});

els.splitBtn.addEventListener('click', splitPdf);
updateRatioLabels();
resetPatterns();
setStatus('Ready. After deployment finishes, hard refresh the page with Ctrl + F5.');
