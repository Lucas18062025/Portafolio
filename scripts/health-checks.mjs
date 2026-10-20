#!/usr/bin/env node
/**
 * health-checks.mjs - verificacion POST-deploy (T5 + T10) contra produccion.
 *
 * La usan los DOS consumidores:
 *   - deploy.ps1 (verificacion local, cuando se usa el camino viejo)
 *   - .github/workflows/deploy.yml (gate del deploy: si falla, el job queda rojo)
 *
 *   T5   / 200 · /manifest.json 200 · /worker.js 404 · /no-existo 404
 *        /blog/visual-field-notes/ 200 + 2 assets del kit Flow (1 WebP y 1 MP4)
 *   T10  colector CSP: acepta application/csp-report, application/reports+json
 *        y application/json (204); rechaza text/plain (415), shape invalido
 *        (400) y body > 8 KB (413); GET -> 405 con Allow: POST; y / trae
 *        Reporting-Endpoints con URL absoluta.
 *
 * Uso: node scripts/health-checks.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'https://portafolio.lucaslean1806.workers.dev').replace(/\/$/, '');

let failures = 0;
const ok = (id, msg) => console.log(`  OK   ${id}  ${msg}`);
const bad = (id, msg) => { failures++; console.error(`  FALLO ${id}  ${msg}`); };

async function code(path, init) {
  try {
    const res = await fetch(BASE + path, { ...init, redirect: 'manual' });
    return { status: res.status, headers: res.headers };
  } catch (e) {
    return { status: 0, headers: new Headers(), error: e.message };
  }
}

async function expect(id, label, path, want, init) {
  const r = await code(path, init);
  if (r.status === want) ok(id, `${label} -> ${r.status}`);
  else bad(id, `${label} -> ${r.status} (esperado ${want})${r.error ? ' :: ' + r.error : ''}`);
  return r;
}

console.log(`health-checks contra ${BASE}`);

// --- T5: sitio sano ----------------------------------------------------------
console.log('T5:');
await expect('T5 ', '/', '/', 200);
await expect('T5 ', '/manifest.json', '/manifest.json?v=health', 200);
await expect('T5 ', '/worker.js', '/worker.js', 404);
await expect('T5 ', '/no-existo', '/no-existo-healthcheck', 404);
await expect('T5 ', '/blog/visual-field-notes/', '/blog/visual-field-notes/', 200);
await expect('T5 ', 'WebP del kit Flow', '/assets/blog/flow/cybersecurity-analyst-viewing-mo-640.webp', 200);
await expect('T5 ', 'MP4 del kit Flow', '/assets/blog/flow/holographic-world-map-pulses-red.mp4', 200);

// --- T10: colector CSP -------------------------------------------------------
console.log('T10:');
const l2 = JSON.stringify({
  'csp-report': {
    'document-uri': BASE + '/',
    'violated-directive': 'script-src',
    'blocked-uri': 'inline',
    'status-code': 200
  }
});
const v1 = JSON.stringify([{
  type: 'csp-violation',
  body: {
    documentURL: BASE + '/',
    effectiveDirective: 'script-src',
    blockedURL: 'inline',
    statusCode: 200
  }
}]);
const post = (ct, body) => ({
  method: 'POST',
  headers: { 'content-type': ct },
  body
});

await expect('T10', 'POST application/csp-report (L2)', '/api/csp-report', 204, post('application/csp-report', l2));
await expect('T10', 'POST application/reports+json (v1)', '/api/csp-report', 204, post('application/reports+json', v1));
await expect('T10', 'POST application/json (L2)', '/api/csp-report', 204, post('application/json', l2));
await expect('T10', 'POST text/plain (rechazado)', '/api/csp-report', 415, post('text/plain', l2));
await expect('T10', 'POST shape invalido', '/api/csp-report', 400, post('application/json', '{"foo":1}'));
await expect('T10', 'POST body > 8KB', '/api/csp-report', 413, post('application/json', JSON.stringify({ foo: 'x'.repeat(9000) })));

const getRes = await code('/api/csp-report', { method: 'GET' });
if (getRes.status === 405 && (getRes.headers.get('allow') || '').includes('POST')) {
  ok('T10', 'GET -> 405 con Allow: POST');
} else {
  bad('T10', `GET -> ${getRes.status} (esperado 405) y Allow: ${getRes.headers.get('allow')}`);
}

const home = await code('/');
const rep = home.headers.get('reporting-endpoints');
if (rep && rep.includes('https://')) {
  ok('T10', `Reporting-Endpoints con URL absoluta: ${rep}`);
} else {
  bad('T10', `Reporting-Endpoints ausente o con URL relativa: ${rep}`);
}

console.log('');
if (failures > 0) {
  console.error(`health-checks: ${failures} FALLO(S).`);
  process.exit(1);
}
console.log('health-checks: todo OK.');
