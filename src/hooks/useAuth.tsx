import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth } from '../lib/firebase'

type AuthContextValue = {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next)
      setLoading(false)
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async signInWithGoogle() {
        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })
        await signInWithPopup(auth, provider)
      },
      async signInWithEmail(email, password) {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      },
      async registerWithEmail(name, email, password) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
        const displayName = name.trim()
        if (displayName) await updateProfile(cred.user, { displayName })
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email.trim())
      },
      async logout() {
        await signOut(auth)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

/** Mensagens do Firebase Auth em português. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-email':
      return 'E-mail inválido.'
    case 'auth/missing-password':
      return 'Digite sua senha.'
    case 'auth/weak-password':
      return 'A senha precisa de pelo menos 6 caracteres.'
    case 'auth/email-already-in-use':
      return 'Esse e-mail já tem uma conta. Tente entrar.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde um instante.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return ''
    case 'auth/network-request-failed':
      return 'Sem conexão. Para entrar pela primeira vez você precisa de internet.'
    case 'auth/operation-not-allowed':
      return 'Esse método de login não está habilitado no Firebase Console.'
    case 'auth/unauthorized-domain':
      return 'Domínio não autorizado no Firebase Console (Authentication > Settings).'
    default:
      return 'Não foi possível concluir. Tente de novo.'
  }
}
