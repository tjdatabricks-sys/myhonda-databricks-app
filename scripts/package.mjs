import fs from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';

const root = process.cwd();
const files = {};
const roots = ['src', 'public', 'scripts/start.mjs', 'app.yaml', 'package.json', 'package-lock.json', 'next.config.ts', 'postcss.config.mjs', 'tsconfig.json', '.env.example', 'README.md', 'deployment/grants.sql', 'data/gold-business-schema.csv'];
function collect(relative) {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep)) throw new Error('Package path must remain in the workspace.');
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) throw new Error('Symbolic links are not permitted in the deployment package.');
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(absolute)) collect(path.join(relative, child));
  } else {
    if (stat.size > 10000000) throw new Error(`Databricks file limit exceeded: ${relative}`);
    files[relative.replaceAll(path.sep, '/')] = new Uint8Array(fs.readFileSync(absolute));
  }
}
for (const relative of roots) collect(relative);
fs.mkdirSync('dist', { recursive: true });
const filename = 'dist/myhonda-databricks-app.zip';
fs.writeFileSync(filename, zipSync(files, { level: 6 }));
console.log(`${filename}: ${Object.keys(files).length} source files; excludes secrets, samples, local databases, build output, and node_modules.`);
