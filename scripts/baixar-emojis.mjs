// Execute: node scripts/baixar-emojis.mjs. Os PNGs devem acompanhar o projeto.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const destination = new URL('../front_end/assets/emoji/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', destination), 'utf8'));
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function validate(data) {
  return data.subarray(0, 8).equals(signature) && data.length > 24 &&
    Math.max(data.readUInt32BE(16), data.readUInt32BE(20)) <= 512 &&
    Math.min(data.readUInt32BE(16), data.readUInt32BE(20)) >= 128;
}
await mkdir(destination, { recursive: true });
const queue = Object.entries(manifest);
const failures = [];
let completed = 0;
async function worker() {
  for (;;) {
    const item = queue.shift();
    if (!item) return;
    const [emoji, entry] = item;
    const target = new URL(entry.file, destination);
    try {
      const existing = await readFile(target).catch(() => null);
      if (!existing || !validate(existing)) {
        const url = entry.sourcePath
          ? `https://raw.githubusercontent.com/microsoft/fluentui-emoji/${entry.sourceRevision}/${entry.sourcePath.split('/').map(encodeURIComponent).join('/')}`
          : `https://www.emoji.family/api/emojis/${encodeURIComponent(emoji)}/fluent/png/256`;
        let data;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            data = Buffer.from(await response.arrayBuffer());
            if (!validate(data)) throw new Error('A resposta não é um PNG de alta resolução válido');
            break;
          } catch (error) { if (attempt === 2) throw error; }
        }
        await writeFile(target, data);
      }
      completed++;
    } catch (error) { failures.push(`${entry.name}: ${error.message}`); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
await writeFile(new URL('../front_end/emoji-catalog.js', import.meta.url),
  '// Gerado por scripts/baixar-emojis.mjs; identidade pelo Unicode.\n' +
  `window.EMOJI_3D_CATALOG = ${JSON.stringify(manifest, null, 2)};\n`);
console.log(`${completed}/${Object.keys(manifest).length} PNGs locais validados.`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
