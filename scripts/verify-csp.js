#!/usr/bin/env node

/**
 * verify-csp.js
 * Simple script that reads the _headers file, extracts the Content-Security-Policy line,
 * and validates that it contains mandatory directives: report-uri and report-to pointing to internal endpoints.
 */
const fs = require('fs');
const path = require('path');

const headersPath = path.resolve(__dirname, '..', '_headers');
if (!fs.existsSync(headersPath)) {
  console.error('Error: _headers file not found');
  process.exit(1);
}

const content = fs.readFileSync(headersPath, 'utf8');
const cspLine = content.split('\n').find(l => l.trim().startsWith('Content-Security-Policy:'));
if (!cspLine) {
  console.error('Error: Content-Security-Policy header not found in _headers');
  process.exit(1);
}

const csp = cspLine.split('Content-Security-Policy:')[1].trim();

function hasDirective(directive) {
  // Accept the directive whether it is followed by whitespace, semicolon or end‑of‑string
  return new RegExp(`${directive}(\\s+|;)`).test(csp);
}

const required = ['report-uri', 'report-to'];
let ok = true;
required.forEach(d => {
  if (!hasDirective(d)) {
    console.error(`Missing required CSP directive: ${d}`);
    ok = false;
  }
});

// --- Reporting-Endpoints (Reporting API v1, Chrome 96+ / Edge) -----------------
// El header `Report-To` (v0) esta deprecado en MDN y Chrome lo ignora para CSP.
// `Reporting-Endpoints` es el header que hoy usa el navegador, y su URL debe
// ser ABSOLUTA: si es relativa, Chrome descarta el endpoint y no reporta nada.
// El nombre del endpoint tiene que coincidir con el grupo de `report-to`.
const reportingEndpointsLine = content.split('\n').find(l => l.trim().startsWith('Reporting-Endpoints:'));
if (!reportingEndpointsLine) {
  console.error('Missing required header: Reporting-Endpoints');
  ok = false;
} else {
  const value = reportingEndpointsLine.split('Reporting-Endpoints:')[1].trim();
  // Formato: nombre="url" (separado por coma si hay varios).
  const entries = value.split(',').map(e => e.trim()).filter(Boolean);
  if (entries.length === 0) {
    console.error('Reporting-Endpoints is empty');
    ok = false;
  }
  for (const entry of entries) {
    const m = entry.match(/^([a-z0-9-]+)\s*=\s*"(.*)"$/i);
    if (!m) {
      console.error(`Reporting-Endpoints entry is malformed: ${entry}`);
      ok = false;
      continue;
    }
    const [, name, url] = m;
    if (!/^https:\/\//i.test(url)) {
      console.error(`Reporting-Endpoints URL must be absolute (https://...): ${url}`);
      ok = false;
    }
    // El grupo de la directiva `report-to` debe existir en Reporting-Endpoints.
    const reportToGroup = (csp.match(/report-to\s+([^;]+)/) || [])[1];
    if (reportToGroup && reportToGroup.trim() !== name) {
      console.error(`CSP report-to group "${reportToGroup.trim()}" does not match Reporting-Endpoints name "${name}"`);
      ok = false;
    }
  }
}

// --- Report-To (v0, deprecado) -------------------------------------------------
// Se mantiene por compatibilidad, pero su URL tambien debe ser absoluta:
// una URL relativa es invalida para Report-To.
const reportToLine = content.split('\n').find(l => l.trim().startsWith('Report-To:'));
if (reportToLine) {
  const reportTo = reportToLine.split('Report-To:')[1].trim();
  const urls = (reportTo.match(/"url"\s*:\s*"([^"]*)"/g) || []);
  for (const raw of urls) {
    const url = raw.replace(/"url"\s*:\s*"/, '').replace(/"$/, '');
    if (!/^https:\/\//i.test(url)) {
      console.error(`Report-To endpoint URL must be absolute (https://...): ${url}`);
      ok = false;
    }
  }
}

if (ok) {
  console.log('CSP verification passed.');
  process.exit(0);
} else {
  console.error('CSP verification failed.');
  process.exit(1);
}
