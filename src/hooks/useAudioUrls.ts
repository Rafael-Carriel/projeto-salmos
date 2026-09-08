import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'

/**
 * URLs das narrações, num único documento (`content/audio`) com o mapa
 * número do salmo -> URL. Uma leitura só, fica no cache offline, e o
 * administrador edita pelo painel.
 */
export function useAudioUrls(): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    return onSnapshot(
      doc(db, 'content', 'audio'),
      (snap) => setUrls((snap.data()?.urls as Record<string, string>) ?? {}),
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
