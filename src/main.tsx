import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { AuthProvider } from './hooks/useAuth'
import { loadPsalms } from './lib/psalms'
import './index.css'

// Nova versão publicada: recarrega na hora, sem perguntar. O app é pequeno e
// interromper uma leitura com um diálogo seria pior do que o recarregamento.
registerSW({ immediate: true })

const root = createRoot(document.getElementById('root')!)

// O saltério antes da primeira tela: assim todas as telas leem o texto de forma
// síncrona. Depois da primeira visita ele vem do cache do service worker.
loadPsalms().then(
  () =>
    root.render(
      <StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </StrictMode>,
    ),
  (error: unknown) => {
    console.error(error)
    root.render(
      <p className="empty" style={{ margin: '4rem auto', maxWidth: '26rem', padding: '0 1.5rem' }}>
        Não consegui carregar o texto dos salmos. Verifique a conexão e recarregue a página.
      </p>,
    )
  },
)
