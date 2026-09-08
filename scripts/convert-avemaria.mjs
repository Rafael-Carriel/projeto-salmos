#!/usr/bin/env node
/**
 * Conversão da Bíblia Ave Maria para formato do Projeto Salmos
 * Input:  scripts/avemaria-raw.json (de fidalgobr/bibliaAveMariaJSON)
 * Output: public/psalms.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const raw = JSON.parse(readFileSync(join(ROOT, 'scripts/avemaria-raw.json'), 'utf8'));
const salmosBook = raw.antigoTestamento.find(b => b.nome === 'Salmos');

if (!salmosBook) {
  console.error('❌ Salmos not found in avemaria-raw.json');
  process.exit(1);
}

const psalms = salmosBook.capitulos.map(ch => ({
  number: ch.capitulo,
  reference: `Salmo ${ch.capiculo}`,
  verses: ch.versiculos.map(v => ({
    number: v.versiculo,
    text: v.texto.replace(/\*$/, '').trim(), // remove trailing * markers
  })),
}));

const outPath = join(ROOT, 'public', 'psalms.json');
writeFileSync(outPath, JSON.stringify(psalms, null, 2), 'utf8');

console.log(`✅ Wrote ${psalms.length} psalms to public/psalms.json`);
console.log(`   Psalm 1: ${psalms[0].verses.length} verses`);
console.log(`   Psalm 23: ${psalms[22].verses.length} verses`);
console.log(`   Psalm 119: ${psalms[118].verses.length} verses`);
console.log(`   Psalm 150: ${psalms[149].verses.length} verses`);
