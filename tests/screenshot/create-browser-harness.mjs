import { readFileSync, writeFileSync } from 'node:fs';

// This test-only build reopens the produced ZIP, verifies its CRCs and PNG
// dimensions, and displays machine-readable diagnostics in the DOM.
// No instrumentation is added to the production preview.
let html = readFileSync(new URL('../../preview/archive/turbo-preview-7.8.19.html', import.meta.url), 'utf8');
const marker = '      captureDownload = { url: URL.createObjectURL(zipBlob)';
if (!html.includes(marker)) throw new Error('Capture download marker changed; update the harness');
html = html.replace('    const zip = new JSZip();', '    const zip = new JSZip(); let testStageProbes = [];');
html = html.replace('          const blob = await boundedCapture(htmlToImage.toBlob', `
          testStageProbes.push({ path: job.path, canvases: Array.from(scanEntry.stageEl.querySelectorAll('canvas')).map(canvas => ({ width:canvas.width, height:canvas.height, pixel:Array.from(canvas.getContext('2d').getImageData(40,30,1,1).data) })) });
          const blob = await boundedCapture(htmlToImage.toBlob`);
html = html.replace(marker, `
      const checkedZip = await JSZip.loadAsync(await zipBlob.arrayBuffer(), { checkCRC32: true });
      const checkedReport = JSON.parse(await checkedZip.file('_capture-manifest.json').async('string'));
      const checkedPngs = [];
      let checkedPdf = null;
      if (checkedReport.reviewPdf && checkedReport.reviewPdf.status === 'included') {
        const pdfBytes = await checkedZip.file(checkedReport.reviewPdf.file).async('uint8array');
        const pdfText = new TextDecoder('latin1').decode(pdfBytes);
        checkedPdf = { path: checkedReport.reviewPdf.file, bytes: pdfBytes.length, signature: pdfText.slice(0, 8), pageCount: (pdfText.match(/\\/Type \\/Page\\b/g) || []).length };
        if (new URLSearchParams(location.search).get('pdfbytes') === '1') {
          let binary = '';
          for (let offset = 0; offset < pdfBytes.length; offset += 0x8000) binary += String.fromCharCode(...pdfBytes.subarray(offset, offset + 0x8000));
          const pdfNode = document.getElementById('captureTestPdfBase64') || document.body.appendChild(document.createElement('pre'));
          pdfNode.id = 'captureTestPdfBase64'; pdfNode.hidden = true; pdfNode.textContent = btoa(binary);
        }
      }
      for (const result of checkedReport.jobs.filter(job => ['captured', 'degraded'].includes(job.status))) {
        const bytes = await checkedZip.file(result.path).async('uint8array');
        const blob = new Blob([bytes], { type: 'image/png' });
        await verifyCapturePng(blob, result.width, result.height);
        const image = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const pixel = Array.from(context.getImageData(40, 30, 1, 1).data);
        checkedPngs.push({ path: result.path, width: image.width, height: image.height, pixel });
        image.close();
      }
      const testOutput = document.getElementById('captureTestDiagnostics') || document.body.appendChild(document.createElement('pre'));
      testOutput.id = 'captureTestDiagnostics';
      testOutput.textContent = JSON.stringify({ crcVerified: true, report: checkedReport, pngs: checkedPngs, pdf: checkedPdf, stageProbes: testStageProbes });
` + marker);
const closingBody = html.lastIndexOf('</body>');
if (closingBody < 0) throw new Error('Closing body marker changed; update the harness');
html = html.slice(0, closingBody) + `<script>
  addEventListener('load', async () => {
    const fixture = new URLSearchParams(location.search).get('fixture');
    if (!fixture) return;
    const response = await fetch(fixture);
    if (!response.ok) throw new Error('Fixture request failed: ' + response.status);
    const input = document.getElementById('fileInputZip');
    const transfer = new DataTransfer();
    transfer.items.add(new File([await response.arrayBuffer()], fixture.split('/').pop(), { type:'application/zip' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles:true }));
  });
</script>` + html.slice(closingBody);
writeFileSync(new URL('./browser-harness.html', import.meta.url), html);
console.log('Created tests/screenshot/browser-harness.html');
