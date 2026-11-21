#!/usr/bin/env node
/**
 * stamp-version.mjs - una sola fuente de verdad para la version visible del sitio.
 *
 * `VERSION` (raiz) es la fuente. Este script estampa en cada pagina con
 * <footer> un marcador:
 *
 *   <p class="foot-meta">[ build: <span class="foot-version" data-version="1.0.0">v1.0.0</span> ]</p>
 *
 * Es idempotente: si el marcador ya existe lo actualiza, si falta lo inserta
 * antes del `</footer>` con la indentacion del cierre. Corre en modo escritura
 * por defecto y con `--check` solo reporta drift (lo usa guards.mjs / T11).
 *
 * Bumpear version = editar `VERSION` + `node scripts/stamp-version.mjs`.
 * Editar el HTML a mano no alcanza: T11 compara `data-version` contra VERSION.
 *
 * Uso:
 *   node scripts/stamp-version.mjs           # aplica
 *   node scripts/stamp-version.mjs --check   # solo verifica (exit 1 si hay drift)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const CHECK = process.argv.includes('--check');

const SEMVER = /^\d+\.\d+\.\d+$/;
const VERSION = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();
if (!SEMVER.test(VERSION)) {
  console.error(`stamp-version: VERSION invalida ("${VERSION}"). Formato esperado: MAJOR.MINOR.PATCH`);
  process.exit(1);
}
const MARKER_TEXT = `v${VERSION}`;
const RENDERED = `<span class="foot-version" data-version="${VERSION}">${MARKER_TEXT}</span>`;
const MARKER_RE = /<span class="foot-version" data-version="[^"]*">[^<]*<\/span>/;

// Mismas exclusiones que guards.mjs: docs/ y specs/ no se publican.
const SKIP_DIR = /^(node_modules|\.git|\.wrangler|docs|specs|\.github|\.gstack|\.gbrain|\.agents|scripts)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.test(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

let drifted = 0;
let touched = 0;

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const original = readFileSync(file, 'utf8');
  if (!original.includes('<footer')) continue;

  let next;
  if (MARKER_RE.test(original)) {
    next = original.replace(MARKER_RE, RENDERED);
  } else {
    const close = original.lastIndexOf('</footer>');
    if (close === -1) continue;
    const lineStart = original.lastIndexOf('\n', close) + 1;
    const closingIndent = (original.slice(lineStart, close).match(/^[ \t]*/) || [''])[0];
    const line = `${closingIndent}    <p class="foot-meta">[ build: ${RENDERED} ]</p>\n`;
    next = original.slice(0, lineStart) + line + original.slice(lineStart);
  }

  if (next === original) continue;
  if (CHECK) {
    drifted++;
    console.error(`  DRIFT ${rel}`);
  } else {
    writeFileSync(file, next, 'utf8');
    touched++;
    console.log(`  stamp ${rel}`);
  }
}

if (CHECK) {
  if (drifted > 0) {
    console.error(`stamp-version: ${drifted} pagina(s) desalineadas de VERSION (${VERSION}). Corre: node scripts/stamp-version.mjs`);
    process.exit(1);
  }
  console.log(`stamp-version: todas las paginas en v${VERSION}.`);
} else {
  console.log(touched > 0 ? `stamp-version: ${touched} pagina(s) actualizadas a v${VERSION}.` : `stamp-version: sin cambios (todo en v${VERSION}).`);
}
