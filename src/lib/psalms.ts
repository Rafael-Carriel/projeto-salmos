import { TOTAL_PSALMS, type Psalm } from './cycle'

/*
  O texto dos 150 salmos são 275 KB que nunca mudam. Fora do pacote JS, eles
  ficam num arquivo próprio: o service worker guarda uma vez e uma atualização
  do aplicativo não obriga a baixar tudo de novo.
*/

let psalms: Psalm[] = []
let byNumber = new Map<number, Psalm>()

/** Carrega o saltério. Chamado uma vez, antes de renderizar. */
export async function loadPsalms(): Promise<void> {
  if (psalms.length) return
  const response = await fetch('/psalms.json')
  if (!response.ok) throw new Error(`psalms.json: HTTP ${response.status}`)
  psalms = (await response.json()) as Psalm[]
  byNumber = new Map(psalms.map((p) => [p.number, p]))

  if (import.meta.env.DEV && psalms.length !== TOTAL_PSALMS) {
    console.warn(
      `psalms.json tem ${psalms.length} salmos, esperado ${TOTAL_PSALMS}. Rode: npm run psalms`,
    )
  }
}

export function getPsalm(n: number): Psalm | undefined {
  return byNumber.get(n)
}

export function allPsalms(): Psalm[] {
  return psalms
}

/** Primeiro versículo, cortado — usado nos cartões da lista. */
export function preview(p: Psalm, maxChars = 90): string {
  const text = p.verses[0]?.text ?? ''
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).replace(/[\s,;.]+\S*$/, '')}…`
}

export function verseCount(n: number): number {
  return byNumber.get(n)?.verses.length ?? 0
}
