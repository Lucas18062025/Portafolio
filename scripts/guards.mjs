#!/usr/bin/env node
/**
 * guards.mjs - barreras previas al deploy, en una sola implementacion.
 *
 * La usan los DOS consumidores:
 *   - deploy.ps1 (pre-flight local, antes de abrir el PR)
 *   - .github/workflows/ci.yml      (gate del PR)
 *   - .github/workflows/deploy.yml  (red de seguridad antes del deploy)
 *
 * Checks:
 *   T1   existe google*.html (verificacion de Search Console)
 *   T2   wrangler.jsonc declara "binding": "ASSETS"
 *   T3   .assetsignore ignora worker.js
 *   T3b  .assetsignore ignora los docs internos y specs/
 *   T9   cache-bust: si cambia css/*.css o js/*.js, el ?v=N de su referencia
 *        en el HTML tiene que cambiar tambien (el CDN ignora el query string)
 *   T4   (--dry-run) el dry-run de wrangler declara env.ASSETS
 *
 * Uso:
 *   node scripts/guards.mjs                      # working tree vs HEAD
 *   node scripts/guards.mjs --base <ref>         # <ref> vs HEAD (CI)
 *   node scripts/guards.mjs --base <ref> --dry-run
 *
 * El comando de wrangler se toma de $WRANGLER (default: npx --yes wrangler@4.136.3).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);

function arg(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
const has = (flag) => args.includes(flag);

const BASE = arg('--base');          // ref base para el diff (CI). null = working tree vs HEAD
const DRY_RUN = has('--dry-run');
const WRANGLER = (process.env.WRANGLER || 'npx --yes wrangler@4.136.3').trim().split(/\s+/);

let failures = 0;
const ok = (id, msg) => console.log(`  OK   ${id}  ${msg}`);
const bad = (id, msg) => { failures++; console.error(`  FALLO ${id}  ${msg}`); };

function readFileSafe(p) {
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

function git(argsList) {
  const r = spawnSync('git', argsList, { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.wrangler') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

console.log(`guards: T1 T2 T3 T3b${DRY_RUN ? ' T4' : ''} T9  (base: ${BASE || 'working tree vs HEAD'})`);

// --- T1: google*.html (verificacion de Search Console) ------------------------
const googleFiles = readdirSync(ROOT).filter((f) => /^google.*\.html$/.test(f));
if (googleFiles.length === 0) {
  bad('T1 ', 'falta el archivo google*.html de verificacion de Google Search Console en la raiz. NO BORRAR.');
} else {
  ok('T1 ', `verificacion de Search Console: ${googleFiles.join(', ')}`);
}

// --- T2: binding ASSETS ------------------------------------------------------
const wranglerJsonc = readFileSafe(join(ROOT, 'wrangler.jsonc')) || '';
if (!/"binding"\s*:\s*"ASSETS"/.test(wranglerJsonc)) {
  bad('T2 ', 'falta "binding": "ASSETS" en wrangler.jsonc (assets). Sin esto env.ASSETS es undefined y el Worker crashea.');
} else {
  ok('T2 ', 'wrangler.jsonc declara el binding ASSETS');
}

// --- T3 / T3b: .assetsignore --------------------------------------------------
const assetsignore = readFileSafe(join(ROOT, '.assetsignore'));
if (assetsignore === null) {
  bad('T3 ', 'no se encuentra .assetsignore');
} else {
  const lines = assetsignore.split(/\r?\n/);
  const hasExact = (v) => lines.some((l) => l.trim() === v);
  const hasRe = (re) => lines.some((l) => re.test(l.trim()));

  if (!hasRe(/^worker\.js$/)) {
    bad('T3 ', 'falta `worker.js` en .assetsignore. El codigo quedaria descargable en /worker.js.');
  } else {
    ok('T3 ', '.assetsignore ignora worker.js');
  }

  const docs = ['AGENTS.md', 'SECURITY.md', 'TEST_PLAN.md', 'TOOLS.md'];
  const missingDocs = docs.filter((d) => !hasExact(d));
  if (missingDocs.length) {
    bad('T3b', `faltan en .assetsignore: ${missingDocs.join(', ')}. Los docs internos quedarian descargables.`);
  } else {
    ok('T3b', '.assetsignore ignora los 4 docs internos');
  }

  const missingSpecs = [];
  if (!hasExact('specs')) missingSpecs.push('specs');
  if (!hasExact('specs/**')) missingSpecs.push('specs/**');
  if (missingSpecs.length) {
    bad('T3b', `faltan en .assetsignore: ${missingSpecs.join(', ')}. Los specs quedarian descargables.`);
  } else {
    ok('T3b', '.assetsignore ignora specs/ y specs/**');
  }
}

// --- T9: cache-bust de CSS/JS ------------------------------------------------
// El CDN ignora el query string en la clave de cache: cambiar el contenido de
// css/*.css sin bumpear el ?v=N de su referencia NO llega a produccion.
// El deploy sube el archivo nuevo pero edge y navegador siguen con la version
// vieja, sin ningun error visible (T5 pasa). Caso real 20/10: la cadencia del
// blink cambio de 5,2 s a 2,2 s y el navegador seguia midiendo 5,2 s.
const diffCmd = BASE ? ['diff', '--name-only', BASE, 'HEAD'] : ['diff', '--name-only', 'HEAD'];
const changedOut = git(diffCmd) || '';
const cssChanged = changedOut.split(/\r?\n/).map((s) => s.trim()).filter((s) => /\.(css|js)$/i.test(s));

if (cssChanged.length === 0) {
  ok('T9 ', 'sin cambios en css/*.css ni js/*.js: no aplica');
} else {
  const htmlFiles = walk(ROOT).filter((p) => {
    if (!p.endsWith('.html')) return false;
    const rel = relative(ROOT, p).split(sep).join('/');
    return !/^(node_modules|docs|specs|\.git)\//.test(rel);
  });

  const t9Bad = [];
  for (const f of cssChanged) {
    const baseName = f.split(/[\\/]/).pop();
    for (const h of htmlFiles) {
      const rel = relative(ROOT, h).split(sep).join('/');
      const newContent = readFileSafe(h);
      if (newContent === null) continue;
      const newLine = newContent.split(/\r?\n/).find((l) => l.includes(baseName));
      if (!newLine) continue;
      const newV = (newLine.match(/\?v=(\d+)/) || [])[1] || '';

      const oldContent = git(['show', `${BASE || 'HEAD'}:${rel}`]);
      const oldLine = oldContent === null ? null : oldContent.split(/\r?\n/).find((l) => l.includes(baseName));
      const oldV = oldLine ? ((oldLine.match(/\?v=(\d+)/) || [])[1] || '') : '';

      if (oldV !== newV) {
        ok('T9 ', `${f} bumpea el ?v=N en ${rel} (${oldV || '-'} -> ${newV || '-'}). Cache invalidada.`);
      } else {
        t9Bad.push(`${f} referenciado en ${rel} sin cambiar el ?v=N (sigue en ${newV || 'sin ?v='})`);
      }
    }
  }
  for (const b of t9Bad) bad('T9 ', b);
  if (t9Bad.length === 0) ok('T9 ', 'cache-bust verificado en todas las referencias');
}

// --- T4: dry-run con env.ASSETS ----------------------------------------------
if (DRY_RUN) {
  // En Windows los shims de npm son .cmd: con shell:false Node >=20 los
  // rechaza (EINVAL), y con shell:true + array de args aparece el warning
  // DEP0190. Se pasa el comando completo como un solo string: sin warning y
  // sin concatenar argumentos sueltos.
  const cmdLine = [...WRANGLER, 'deploy', '--dry-run'].join(' ');
  const r = spawnSync(cmdLine, { cwd: ROOT, encoding: 'utf8', shell: true });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (r.error) {
    bad('T4 ', `no se pudo ejecutar el dry-run (${r.error.message}).`);
  } else if (r.status !== 0) {
    bad('T4 ', `el dry-run fallo (exit ${r.status}). Revisa wrangler.jsonc.\n${out.split('\n').slice(-12).join('\n')}`);
  } else if (!out.includes('env.ASSETS')) {
    bad('T4 ', 'el dry-run no declara env.ASSETS. El Worker no veria el binding de assets.');
  } else {
    ok('T4 ', 'dry-run OK: binding env.ASSETS presente');
  }
}

console.log('');
if (failures > 0) {
  console.error(`guards: ${failures} FALLO(S). No deployar.`);
  process.exit(1);
}
console.log('guards: todo OK.');
