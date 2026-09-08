/*
 * Ícones em SVG, não em caracteres. Glifos como ▦, ⚡ ou ❚❚ viram emoji
 * colorido em alguns sistemas e caixinha vazia em outros — desenhados aqui,
 * herdam a cor do texto e ficam iguais em todo lugar.
 */
type Props = { size?: number }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

/** A página do dia: uma folha com linhas de texto. */
export function IconToday({ size = 20 }: Props) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" />
    </svg>
  )
}

/** Os cento e cinquenta: a grade do índice. */
export function IconPsalter({ size = 20 }: Props) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M4 4h5v5H4zM10 4h5v5h-5zM16 4h4v5h-4zM4 10h5v5H4zM10 10h5v5h-5zM16 10h4v5h-4zM4 16h5v4H4zM10 16h5v4h-5z" />
    </svg>
  )
}

export function IconStar({ size = 20, filled = false }: Props & { filled?: boolean }) {
  return (
    <svg {...base} width={size} height={size} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 3.6l2.6 5.5 5.9.8-4.3 4.2 1 6-5.2-2.9-5.2 2.9 1-6L3.5 9.9l5.9-.8z" />
    </svg>
  )
}

/** Ajustes: os controles deslizantes dos horários. */
export function IconSettings({ size = 20 }: Props) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="7.5" cy="17" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Painel: o progresso do grupo em barras. */
export function IconAdmin({ size = 20 }: Props) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  )
}

export function IconPlay({ size = 14 }: Props) {
  return (
    <svg {...base} width={size} height={size} fill="currentColor" stroke="none">
      <path d="M8 5l11 7-11 7z" />
    </svg>
  )
}

export function IconPause({ size = 14 }: Props) {
  return (
    <svg {...base} width={size} height={size} fill="currentColor" stroke="none">
      <path d="M8 5h3.2v14H8zM12.8 5H16v14h-3.2z" />
    </svg>
  )
}

export function IconCheck({ size = 16 }: Props) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={2}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  )
}

/**
 * O "G" do Google, nas quatro cores oficiais — a marca não pode ser
 * recolorida, por isso este é o único ícone que não herda a cor do texto.
 */
export function IconGoogle({ size = 18 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.6h11.9c-.2 2-1.5 5-4.4 7l6.7 5.2c4-3.7 6.9-9.1 6.9-15.8z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.8 0 10.7-1.9 14.2-5.2l-6.7-5.2c-1.8 1.3-4.3 2.2-7.5 2.2-5.8 0-10.7-3.8-12.5-9.1l-7 5.4C8 41.1 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.5 28.7c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.7-4.5l-7-5.4C3 17.1 2 20.4 2 24s1 6.9 2.5 9.7l7-5z"
      />
      <path
        fill="#EA4335"
        d="M24 10.8c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.6 30 2 24 2 15.4 2 8 6.9 4.5 14.3l7 5.4C13.3 14.4 18.2 10.8 24 10.8z"
      />
    </svg>
  )
}
