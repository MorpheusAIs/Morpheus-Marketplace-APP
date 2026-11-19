#!/usr/bin/env node
/* Validate locale JSONs against en.json: parse, compare leaf-key sets, check placeholders. */
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2] || path.join(process.cwd(), 'src/i18n/locales');
const LOCALES = ['ja','pt-BR','de-DE','fr-FR','es','ko','hi','tr','it','pl','ru','zh-Hans'];

const en = JSON.parse(fs.readFileSync(path.join(DIR, 'en.json'), 'utf8'));
const enLeaves = [];
(function walk(o, p) {
  for (const k of Object.keys(o)) {
    const p2 = p ? p + '.' + k : k;
    if (o[k] && typeof o[k] === 'object') walk(o[k], p2); else enLeaves.push(p2);
  }
})(en, '');
const enSet = new Set(enLeaves);

// en leaf values with placeholders
const enPh = {};
for (const leaf of enLeaves) {
  const v = leaf.split('.').reduce((o, k) => o[k], en);
  if (typeof v === 'string' && /\{\{/.test(v)) enPh[leaf] = (v.match(/\{\{(\w+)\}\}/g) || []).sort().join(',');
}

let allOk = true;
for (const loc of LOCALES) {
  const file = path.join(DIR, loc + '.json');
  let j;
  try {
    j = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.log(`${loc}: FAIL — JSON parse error: ${e.message}`);
    allOk = false;
    continue;
  }
  const leaves = [];
  (function walk(o, p) {
    for (const k of Object.keys(o)) {
      const p2 = p ? p + '.' + k : k;
      if (o[k] && typeof o[k] === 'object') walk(o[k], p2); else leaves.push(p2);
    }
  })(j, '');
  const locSet = new Set(leaves);
  const missing = enLeaves.filter(l => !locSet.has(l));
  const extra = leaves.filter(l => !enSet.has(l));
  // placeholder check
  const phBad = [];
  for (const leaf of Object.keys(enPh)) {
    if (!locSet.has(leaf)) continue;
    const v = leaf.split('.').reduce((o, k) => o[k], j);
    const lp = (v.match(/\{\{(\w+)\}\}/g) || []).sort().join(',');
    if (lp !== enPh[leaf]) phBad.push(leaf);
  }
  if (missing.length === 0 && extra.length === 0 && phBad.length === 0) {
    console.log(`${loc}: OK (${leaves.length} leaves, placeholders intact)`);
  } else {
    allOk = false;
    console.log(`${loc}: FAIL — missing(${missing.length}): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''} | extra(${extra.length}): ${extra.slice(0, 10).join(', ')}${extra.length > 10 ? '…' : ''} | placeholder-mismatch: ${phBad.join(', ')}`);
  }
}
console.log(allOk ? '\nALL LOCALES PASS' : '\nVALIDATION FAILED');
process.exit(allOk ? 0 : 1);
