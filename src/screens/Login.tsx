import { useState } from 'react'
import { IconGoogle } from '../components/icons'
import { authErrorMessage, useAuth } from '../hooks/useAuth'

type Mode = 'signin' | 'signup' | 'reset'

const COPY: Record<Mode, { action: string; busy: string }> = {
  signin: { action: 'Entrar', busy: 'Entrando…' },
  signup: { action: 'Criar conta', busy: 'Criando…' },
  reset: { action: 'Enviar link de redefinição', busy: 'Enviando…' },
}

export function Login() {
  const { signInWithGoogle, signInWithEmail, registerWithEmail, resetPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (mode === 'reset') {
      void run(async () => {
        await resetPassword(email)
        setSent(true)
      })
      return
    }
    if (mode === 'signup') {
      void run(() => registerWithEmail(name, email, password))
      return
    }
    void run(() => signInWithEmail(email, password))
  }

  return (
    <div className="gate">
      <div className="gate__card">
        <h1 className="gate__mark">
          Projeto <b>Salmos</b>
        </h1>
        <p className="gate__line">
          “antes tem seu prazer na lei do Senhor, e na sua lei medita de dia e noite.”
        </p>
        <p className="gate__cite">Salmo 1.2 — o primeiro dos cento e cinquenta</p>

        <button
          className="btn btn--wide btn--google"
          onClick={() => void run(signInWithGoogle)}
          disabled={busy}
        >
          <IconGoogle />
          Entrar com Google
        </button>

        <div className="gate__sep">ou com e-mail</div>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <label className="field">
              <span>Como você quer ser chamado</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          {mode !== 'reset' && (
            <label className="field">
              <span>Senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
                required
              />
            </label>
          )}

          {error && <p className="error">{error}</p>}
          {sent && (
            <p className="note">
              Enviei um link para {email}. Abra o e-mail para escolher uma senha nova.
            </p>
          )}

          <button className="btn btn--ghost btn--wide" type="submit" disabled={busy}>
            {busy ? COPY[mode].busy : COPY[mode].action}
          </button>
        </form>

        <p className="gate__switch">
          {mode === 'signin' && (
            <>
              Primeira vez aqui? <button onClick={() => setMode('signup')}>Criar uma conta</button>.
              <br />
              Esqueceu a senha?{' '}
              <button onClick={() => setMode('reset')}>Receber um link novo</button>.
            </>
          )}
          {mode === 'signup' && (
            <>
              Já tem conta? <button onClick={() => setMode('signin')}>Entrar</button>
            </>
          )}
          {mode === 'reset' && (
            <>
              Lembrou? <button onClick={() => setMode('signin')}>Voltar para o login</button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
