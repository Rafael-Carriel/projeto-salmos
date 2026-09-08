import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'

/**
 * Converte URL do Google Drive pra caminho local no Hosting.
 * Drive URLs não funcionam no browser por CORS — os arquivos são baixados
 * pelo sync-audio.mjs e hospedados em /audio/salmo-N.ogg.
 */
function toLocalPath(num: string, url: string): string {
  if (url.startsWith('/audio/')) return url
  if (url.includes('drive.google.com')) return `/audio/salmo-${num}.ogg`
  return url
}

/**
 * URLs das narrações, num único documento (`content/audio`) com o mapa
 * número do salmo -> URL. Uma leitura só, fica no cache offline, e o
 * administrador edita pelo painel.
 *
 * URLs do Google Drive são convertidas pra caminhos locais (/audio/salmo-N.ogg)
 * porque CORS bloqueia reprodução direta no browser.
 */
export function useAudioUrls(): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    return onSnapshot(
      doc(db, 'content', 'audio'),
      (snap) => {
        const raw = (snap.data()?.urls as Record<string, string>) ?? {}
        const converted: Record<string, string> = {}
        for (const [num, url] of Object.entries(raw)) {
          converted[num] = toLocalPath(num, url)
        }
        setUrls(converted)
      },
      (err) => console.error('Falha ao ler as URLs de áudio:', err),
    )
  }, [])

  return urls
}

export async function saveAudioUrl(psalm: number, url: string): Promise<void> {
  await setDoc(
    doc(db, 'content', 'audio'),
    { urls: { [String(psalm)]: url.trim() } },
    { merge: true },
  )
}
