// Packs mcpb/ into public/downloads/card-mafia.mcpb, the one-click Claude Desktop extension (an .mcpb file is a zip with manifest.json at its root).
// Run: node scripts/build-mcpb.mjs   Needs the `zip` command. The bundle has no dependencies, so there is nothing to install first.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'mcpb');
const out = join(root, 'public/downloads/card-mafia.mcpb');

const manifest = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== '0.2' || !manifest.name || !manifest.version) throw new Error('manifest.json is missing its basics');
if (!existsSync(join(src, manifest.server.entry_point))) throw new Error(`entry point ${manifest.server.entry_point} is missing`);

// the app's own icon, so the extension looks like the site
copyFileSync(join(root, 'src/app/apple-icon.png'), join(src, 'icon.png'));

mkdirSync(join(root, 'public/downloads'), { recursive: true });
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-X', out, 'manifest.json', 'icon.png', 'server'], { cwd: src, stdio: 'inherit' });
console.log(`built ${out} (${statSync(out).size} bytes), version ${manifest.version}`);
