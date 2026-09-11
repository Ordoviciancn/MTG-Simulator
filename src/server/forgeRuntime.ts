import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import path from 'node:path';
import type { ForgeLaunch } from './forgeProcess';
const run = promisify(execFile);
export async function prepareForgeLaunch(root: string, javaHome: string): Promise<{ launch: ForgeLaunch; cleanup: () => Promise<void> }> {
  const forge = path.join(root, '.local-tools/forge');
  const pin = JSON.parse(await readFile(path.join(root, 'config/forge-source.json'), 'utf8'));
  const revision = await run('git', ['-C', forge, 'rev-parse', 'HEAD'], { timeout: 10000, windowsHide: true });
  if (revision.stdout.trim() !== pin.commit) throw new Error('Forge source version does not match the pinned build.');
  const source = path.join(root, 'bridge/forge/ForgeHumanBridge.java');
  await access(source);
  const dependencies = (await readFile(path.join(forge, 'forge-gui/target/runtime-classpath.txt'), 'utf8')).trim();
  const classpath = [path.join(forge, 'forge-gui/target/classes'), dependencies].join(path.delimiter);
  const directory = await mkdtemp(path.join(root, '.local-tools/session-'));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    const quote = (value: string) => '"' + value.replaceAll('\\', '/').replaceAll('"', '\\"') + '"';
    const args = path.join(directory, 'java.args');
    await writeFile(args, ['-Dfile.encoding=UTF-8', '-Djava.awt.headless=true', quote('-Duser.home=' + directory), '--class-path', quote(classpath), quote(source), quote(path.join(forge, 'forge-gui/res')), quote(directory)].join('\n'));
    return {launch:{executable:path.join(javaHome,'bin/java.exe'),args:['@'+args],cwd:directory,env:{...process.env,APPDATA:directory,LOCALAPPDATA:directory},startupTimeoutMs:120000},cleanup};
  } catch (error) { await cleanup(); throw error; }
}
