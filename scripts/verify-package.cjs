const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');
const root = path.resolve(process.argv[2] || 'release/win-unpacked');
const archive = path.join(root, 'resources/app.asar');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : [p];
  });
}
for (const file of [...files('dist'), ...files('dist-electron').filter(f => f.endsWith('.js'))]) {
  if (!asar.extractFile(archive, path.normalize(file)).equals(fs.readFileSync(file))) throw Error('Packaged file mismatch: ' + file);
}
for (const [source, dest] of [
  ['node_modules/opencode-windows-x64/bin/opencode.exe', 'engine/opencode.exe'],
  ['node_modules/sql.js/dist/sql-wasm.wasm', 'sql-wasm.wasm'],
  ['resources/icon.png', 'icon.png'],
  ...files('resources/agent-skills').map(f => [f, path.relative('resources', f)]),
  ...files('resources/licenses').map(f => [f, path.relative('resources', f)]),
]) {
  if (!fs.readFileSync(source).equals(fs.readFileSync(path.join(root, 'resources', dest)))) throw Error('Packaged resource mismatch: ' + dest);
}
console.log('All packaged application assets and bundled resources match their inputs.');
