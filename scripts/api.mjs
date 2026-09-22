import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const apiRoot = fileURLToPath(new URL('../apps/api/', import.meta.url));
const python = path.join(apiRoot, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

if (!existsSync(python)) {
  console.error('Create the API environment first: cd apps/api && uv sync --extra dev');
  process.exit(1);
}

const result = spawnSync(python, ['-m', ...process.argv.slice(2)], {
  cwd: apiRoot,
  env: process.env,
  stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
