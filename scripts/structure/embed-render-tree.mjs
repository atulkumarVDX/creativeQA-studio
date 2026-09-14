import { readFileSync, writeFileSync } from 'node:fs';
const path = new URL(process.argv[2] || '../../preview/turbo-preview-7.8.0.html', import.meta.url);
const html = readFileSync(path, 'utf8');
const start = html.indexOf('  // BEGIN SHARED STRUCTURE RENDERER');
const end = html.indexOf('  // END SHARED STRUCTURE RENDERER', start);
if (start < 0 || end < 0) throw new Error('Render tree markers missing');
const source = readFileSync(new URL(process.argv[3] || './render-tree.js', import.meta.url), 'utf8');
writeFileSync(path, html.slice(0, start) + '  // BEGIN SHARED STRUCTURE RENDERER\n' + source + '\n' + html.slice(end));
