#!/usr/bin/env node
/* Validate locale JSONs against en.json.
 * Gates:
 *  1. every locale parses and has exactly the English leaf-key set (no missing/extra)
 *  2. no English value equals its own lookup key (key-as-value bug)
 *  3. {{placeholders}} in every locale match English bidirectionally (same set, same count)
 * Usage: node scripts/i18n-validate.js [localesDir]
 */
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2] || path.join(process.cwd(), 'src/i18n/locales');
const LOCALES = ['ja','pt-BR','de-DE','fr-FR','es','ko','hi','tr','it','pl','ru','zh-Hans'];

// Plural suffixes are locale-specific CLDR categories (e.g. ru has _few/_many,
// ja has only _other). Strip them before key-set comparison so a locale is not
// penalized for having more/fewer plural forms than English.
const PLURAL_SUFFIX = /_(one|two|few|many|zero|other)$/;
const baseKey = (k) => k.replace(PLURAL_SUFFIX, '');

const en = JSON.parse(fs.readFileSync(path.join(DIR, 'en.json'), 'utf8'));
const enLeaves = [];
(function walk(o, p) {
  for (const k of Object.keys(o)) {
    const p2 = p ? p + '.' + k : k;
    if (o[k] && typeof o[k] === 'object') walk(o[k], p2); else enLeaves.push(p2);
  }
})(en, '');
const enSet = new Set(enLeaves);

// Gate 2: English value must not equal its own key path
const selfRefs = enLeaves.filter((leaf) => {
  const v = leaf.split('.').reduce((o, k) => o[k], en);
  return v === leaf;
});
const enBaseSet = new Set(enLeaves.map(baseKey));

// English placeholder map (all leaves, not just ones with placeholders)
const phOf = (s) => (s.match(/\{\{(\w+)\}\}/g) || []).sort().join(',');
const enPh = {};
for (const leaf of enLeaves) {
  const v = leaf.split('.').reduce((o, k) => o[k], en);
  if (typeof v === 'string' && /\{\{/.test(v)) enPh[leaf] = phOf(v);
}

let allOk = true;
if (selfRefs.length) {
  console.log(`en: FAIL — ${selfRefs.length} key(s) whose value is the key path:`);
  console.log('  ' + selfRefs.join(', '));
  allOk = false;
}

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
  const locBaseSet = new Set(leaves.map(baseKey));
  const missing = enLeaves.filter(l => !locSet.has(l) && !locBaseSet.has(baseKey(l)));
  const extra = leaves.filter(l => !enSet.has(l) && !enBaseSet.has(baseKey(l)));
  const problems = [];
  if (missing.length) problems.push(`missing(${missing.length}): ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}`);
  if (extra.length) problems.push(`extra(${extra.length}): ${extra.slice(0, 4).join(', ')}${extra.length > 4 ? '…' : ''}`);

  // Gate 3: bidirectional placeholder check — locale must have exactly the
  // placeholders English has (not a superset, not a subset).
  const phBad = [];
  for (const leaf of enLeaves) {
    // Match by base key so plural variants compare against their English family.
    const base = baseKey(leaf);
    const enPhCandidates = enLeaves.filter((l) => baseKey(l) === base);
    const enPhJoined = enPhCandidates.map((l) => enPh[l]).filter(Boolean).join('|');
    const v = leaf.split('.').reduce((o, k) => o && o[k], j);
    if (typeof v !== 'string') continue;
    const locPh = phOf(v);
    const enWanted = enPh[leaf] || enPhJoined.split('|')[0] || '';
    if (locPh !== enWanted) {
      phBad.push(`${leaf} [en:(${enWanted || '—'}) loc:(${locPh || '—'})]`);
    }
  }
  if (phBad.length) problems.push(`placeholder-mismatch(${phBad.length}): ${phBad.slice(0, 3).join(', ')}${phBad.length > 3 ? '…' : ''}`);

  if (problems.length) {
    console.log(`${loc}: FAIL — ${problems.join(' | ')}`);
    allOk = false;
  } else {
    console.log(`${loc}: OK (${leaves.length} leaves, placeholders intact)`);
  }
}

console.log(allOk ? '\nALL LOCALES PASS' : '\nVALIDATION FAILED');
process.exit(allOk ? 0 : 1);
