#!/usr/bin/env node
/**
 * Upload das URLs de áudio do Google Drive para o Firestore.
 * Roda uma vez para popular content/audio com todas as URLs.
 *
 * Variáveis de ambiente:
 *   FIREBASE_SERVICE_ACCOUNT  JSON da conta de serviço
 */
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const raw = process.env.FIREBASE_SERVICE_ACCOUNT
if (!raw) {
  console.error('Defina FIREBASE_SERVICE_ACCOUNT com o JSON da conta de serviço.')
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(raw)) })
const db = getFirestore()

// Ler o mapa de URLs gerado pelo Playwright
const urls = JSON.parse(readFileSync(join(__dirname, 'drive-audio-urls.json'), 'utf8'))

console.log(`Enviando ${Object.keys(urls).length} URLs de áudio para Firestore...`)

await db.doc('content/audio').set({ urls }, { merge: true })

console.log('✅ Pronto! content/audio atualizado no Firestore.')
console.log(`   ${Object.keys(urls).length} salmos com áudio (1-96)`)
console.log('   Salmos 97-150 ainda não têm áudio no Drive.')
