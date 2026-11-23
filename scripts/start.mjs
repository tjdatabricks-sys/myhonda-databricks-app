import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

const standalone = '.next/standalone/server.js';
// Databricks runs the package build script during deployment. This fallback
// also supports environments that only install packages before app.yaml.
if (!existsSync(standalone)) {
  const { status } = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], { stdio: 'inherit' });
  if (status !== 0) process.exit(status ?? 1);
}
mkdirSync('.next/standalone/.next', { recursive: true });
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
cpSync('public', '.next/standalone/public', { recursive: true });
const server = spawn(process.execPath, [standalone], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '0.0.0.0', PORT: process.env.DATABRICKS_APP_PORT || process.env.PORT || '8000' },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill(signal));
server.on('exit', code => process.exit(code ?? 0));
