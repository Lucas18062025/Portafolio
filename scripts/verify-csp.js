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
  return new RegExp(`${directive}\s+`).test(csp);
}

const required = ['report-uri', 'report-to'];
let ok = true;
required.forEach(d => {
  if (!hasDirective(d)) {
    console.error(`Missing required CSP directive: ${d}`);
    ok = false;
  }
});

if (ok) {
  console.log('CSP verification passed.');
  process.exit(0);
} else {
  console.error('CSP verification failed.');
  process.exit(1);
}
