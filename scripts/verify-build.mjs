// Release-build guard: fails if a store build contains anything meant only
// for automated tests, or asks for more than the minimum permissions.
// Run after `pnpm build` / `pnpm zip`:  node scripts/verify-build.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TARGETS = ['.output/edge-mv3', '.output/chrome-mv3'];
const EXPECTED_PERMISSIONS = ['activeTab', 'scripting', 'storage'];
const FORBIDDEN_STRINGS = [
  '__driftlessRunCommand', // test-only command hook in the background
  'driftless:e2e-fake-speech', // fake speech engine
];

const problems = [];
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

for (const dir of TARGETS) {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const permissions = [...(manifest.permissions ?? [])].sort();
  if (JSON.stringify(permissions) !== JSON.stringify([...EXPECTED_PERMISSIONS].sort())) {
    problems.push(`${dir}: unexpected permissions ${JSON.stringify(manifest.permissions)}`);
  }
  for (const key of [
    'host_permissions',
    'optional_host_permissions',
    'web_accessible_resources',
    'externally_connectable',
    'content_scripts',
  ]) {
    if (manifest[key]) problems.push(`${dir}: manifest must not declare "${key}"`);
  }
  const csp = manifest.content_security_policy?.extension_pages ?? '';
  if (!/script-src 'self'/.test(csp) || !/object-src 'none'/.test(csp)) {
    problems.push(`${dir}: missing strict extension_pages CSP`);
  }
  for (const file of walk(dir).filter((f) => /\.(js|html)$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    for (const marker of FORBIDDEN_STRINGS) {
      if (text.includes(marker)) problems.push(`${file}: contains test-only code (${marker})`);
    }
    if (/\beval\(|new Function\(/.test(text)) problems.push(`${file}: uses eval/new Function`);
  }
}

if (problems.length) {
  console.error('✖ Release build check failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`✔ Release build check passed (${TARGETS.join(', ')})`);
