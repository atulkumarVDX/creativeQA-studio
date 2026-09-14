import { readFileSync, writeFileSync } from 'node:fs';

// This test-only build reopens the produced ZIP, verifies its CRCs and PNG
// dimensions, and displays machine-readable diagnostics in the DOM.
// No instrumentation is added to the production preview.
let html = readFileSync(new URL('../../preview/turbo-preview-7.8.0.html', import.meta.url), 'utf8');
const marker = '      const label = capturePathSegment((pkgNameEl.textContent';
if (!html.includes(marker)) throw new Error('Capture download marker changed; update the harness');
html = html.replace('    const zip = new JSZip();', '    const zip = new JSZip(); let testStageProbes = [];');
html = html.replace('          const blob = await boundedCapture(htmlToImage.toBlob', `
          testStageProbes.push({ path: job.path, canvases: Array.from(scanEntry.stageEl.querySelectorAll('canvas')).map(canvas => ({ width:canvas.width, height:canvas.height, pixel:Array.from(canvas.getContext('2d').getImageData(40,30,1,1).data) })) });
          const blob = await boundedCapture(htmlToImage.toBlob`);
html = html.replace(marker, `
      const checkedZip = await JSZip.loadAsync(await zipBlob.arrayBuffer(), { checkCRC32: true });
      const checkedReport = JSON.parse(await checkedZip.file('_capture-manifest.json').async('string'));
      const checkedPngs = [];
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
      testOutput.textContent = JSON.stringify({ crcVerified: true, report: checkedReport, pngs: checkedPngs, stageProbes: testStageProbes });
` + marker);
writeFileSync(new URL('./browser-harness.html', import.meta.url), html);
console.log('Created tests/screenshot/browser-harness.html');
