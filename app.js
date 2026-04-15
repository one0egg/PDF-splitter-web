import * as pdfjsLib from './vendor/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';

const drawingPattern = /HLY\d{2}-\d{3}-\d{4}/i;
const revisionPattern = /[A-Z]\.\d+/i;

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
  bottomRatioVal: document.getElementById('bottomRatioVal')
};

let pdfBytes = null;
let pdfJsDoc = null;

function setStatus(message) {
  els.status.textContent = message;
}

function ensureLibraries() {
  const ok = typeof window.PDFLib !== 'undefined' && typeof window.JSZip !== 'undefined';
  if (!ok) {
    setStatus('Missing vendor library files. Wait for GitHub Pages deploy to finish, or check the workflow.');
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

function normalizeText(text) {
  return (text || '').toUpperCase().replace(/—/g, '-').replace(/_/g, '-').replace(/\s+/g, '');
}

function extractInfo(text) {
  const cleaned = normalizeText(text);
  const docMatch = cleaned.match(drawingPattern);
  const revMatch = cleaned.match(revisionPattern);
  return {
    document_number: docMatch ? docMatch[0].toUpperCase() : '',
    revision: revMatch ? revMatch[0].toUpperCase() : ''
  };
}

async function loadPdf() {
  if (!ensureLibraries()) return false;
  const file = els.pdfFile.files[0];
  if (!file) {
    setStatus('Please choose a PDF file.');
    return false;
  }
  pdfBytes = await file.arrayBuffer();
  pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  els.pageNumber.max = pdfJsDoc.numPages;
  if (Number(els.pageNumber.value) > pdfJsDoc.numPages) {
    els.pageNumber.value = '1';
  }
  setStatus(`Loaded PDF with ${pdfJsDoc.numPages} page(s).`);
  return true;
}

async function getPageTextAndViewport(pageNumber) {
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

function textInsideRect(items, rect) {
  const parts = [];
  for (const item of items) {
    const x = item.transform[4];
    const y = item.transform[5];
    const itemWidth = item.width || 0;
    const itemHeight = Math.abs(item.transform[3]) || 10;
    const left = x;
    const right = x + itemWidth;
    const top = y - itemHeight;
    const bottom = y;
    const overlaps = !(right < rect.x || left > rect.x + rect.width || bottom < rect.y || top > rect.y + rect.height);
    if (overlaps) parts.push(item.str);
  }
  return parts.join(' ');
}

async function previewPage() {
  if (!pdfJsDoc && !(await loadPdf())) return;
  const pageNumber = Math.max(1, Math.min(Number(els.pageNumber.value || 1), pdfJsDoc.numPages));
  els.pageNumber.value = String(pageNumber);

  const { page, viewport, textContent } = await getPageTextAndViewport(pageNumber);
  const canvas = els.previewCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;

  const rect = scanRectPx(viewport);
  ctx.save();
  ctx.fillStyle = 'rgba(255, 0, 0, 0.18)';
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.95)';
  ctx.lineWidth = 3;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();

  const rawText = textInsideRect(textContent.items, rect);
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
  els.splitBtn.disabled = true;
  els.previewBtn.disabled = true;
  setStatus('Splitting PDF and building ZIP...');

  try {
    const srcPdf = await window.PDFLib.PDFDocument.load(pdfBytes);
    const zip = new window.JSZip();
    const rows = [];
    const usedNames = new Map();

    for (let i = 1; i <= pdfJsDoc.numPages; i++) {
      setStatus(`Processing page ${i} of ${pdfJsDoc.numPages}...`);
      const { textContent, viewport } = await getPageTextAndViewport(i);
      const rect = scanRectPx(viewport);
      const rawText = textInsideRect(textContent.items, rect);
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

    const csv = [
      'document_number,revision,output_filename',
      ...rows.map(r => [r.document_number, r.revision, r.output_filename].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

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

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    if (pdfJsDoc) {
      try { await previewPage(); } catch (error) { console.error(error); }
    }
  });
}

els.previewBtn.addEventListener('click', async () => {
  try { await previewPage(); } catch (error) { console.error(error); setStatus(`Error: ${error.message}`); }
});

els.splitBtn.addEventListener('click', splitPdf);
updateRatioLabels();
setStatus('Ready. After the first Pages deployment, the vendor files will be fetched automatically by GitHub Actions.');
