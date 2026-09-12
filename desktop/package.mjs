import { build } from 'esbuild';
import { packager } from '@electron/packager';
import { cp, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(root, '.desktop-stage');
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await mkdir(path.join(stage, 'src/server'), { recursive: true });
const serverBuild = await build({ entryPoints: [path.join(root, 'src/server/index.ts')], outfile: path.join(stage, 'src/server/index.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', metafile: true,
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' }, external: ['bufferutil', 'utf-8-validate'] });
await cp(path.join(root, 'dist'), path.join(stage, 'dist'), { recursive: true });
await cp(path.join(root, 'desktop/main.cjs'), path.join(stage, 'main.cjs'));
await cp(path.join(root, 'desktop/server-entry.mjs'), path.join(stage, 'server-entry.mjs'));
await writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: 'mtg-simulator', productName: 'MTG Simulator', version: manifest.version, main: 'main.cjs' }));
const packageDirectories = new Set([path.join(root, 'node_modules/react'), path.join(root, 'node_modules/react-dom')]);
const reactRequire = createRequire(await realpath(path.join(root, 'node_modules/react-dom/package.json')));
packageDirectories.add(path.dirname(reactRequire.resolve('scheduler/package.json')));
for (const input of Object.keys(serverBuild.metafile.inputs)) {
  const match = input.replaceAll('\\', '/').match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  if (match) packageDirectories.add(path.resolve(root, match[1]));
}
const notices = [];
for (const directory of packageDirectories) {
  for (const entry of await readdir(directory)) {
    if (/^(licen[sc]e|notice)(\.|$)/i.test(entry)) notices.push(`${directory.slice(directory.lastIndexOf('node_modules') + 13)} / ${entry}\n${await readFile(path.join(directory, entry), 'utf8')}`);
  }
}
await writeFile(path.join(stage, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n\n-----\n\n'));
if (!process.argv.includes('--stage-only')) {
  const electronVersion = JSON.parse(await readFile(path.join(root, 'node_modules/electron/package.json'), 'utf8')).version;
  const cache = path.join(process.env.LOCALAPPDATA || '', 'electron/Cache');
  let electronZipDir;
  try {
    for (const entry of await readdir(cache, { withFileTypes: true })) {
      if (entry.isDirectory() && (await readdir(path.join(cache, entry.name))).includes(`electron-v${electronVersion}-win32-x64.zip`)) { electronZipDir = path.join(cache, entry.name); break; }
    }
  } catch {}
  const outputs = await packager({ dir: stage, out: path.join(root, 'release'), name: 'MTG Simulator', executableName: 'MTG Simulator', platform: 'win32', arch: 'x64', overwrite: true, asar: false, prune: false,
    electronVersion, electronZipDir });
  console.log(outputs.join('\n'));
}
