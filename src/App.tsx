import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  IconAdmin,
  IconPsalter,
  IconSettings,
  IconStar,
  IconToday,
} from './components/icons'
import { useAuth } from './hooks/useAuth'
import { useIsAdmin } from './hooks/useIsAdmin'
import { useOnline } from './hooks/useOnline'
import { useProfile } from './hooks/useProfile'
import { TOTAL_PSALMS } from './lib/cycle'
import { onForegroundPush, pushEnabledOnDevice } from './lib/push'
import { displayNotification } from './lib/notificationDisplay'
import { claimReminder, reminderAt } from './lib/reminderClock'
import { Favorites } from './screens/Favorites'
import { Login } from './screens/Login'
import { PsalmView } from './screens/PsalmView'
import { Psalter } from './screens/Psalter'
import { Settings } from './screens/Settings'
import { Today } from './screens/Today'

// O painel só interessa a quem administra — fica fora do pacote principal.
const Admin = lazy(() => import('./screens/Admin').then((m) => ({ default: m.Admin })))

export function App() {
  const { user, loading: authLoading } = useAuth()
  const state = useProfile()
  const isAdmin = useIsAdmin()
  const online = useOnline()
  const location = useLocation()
  const [toast, setToast] = useState('')
  const uid = user?.uid
  const profileForReminder = state.profile

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    let dispose: (() => void) | undefined
    void onForegroundPush((_title, body, date, slot) => {
      if (cancelled || (date && slot && !claimReminder(uid, date, slot))) return false
      setToast(body)
    }).then((fn) => {
      if (cancelled) fn()
      else dispose = fn
    }).catch((error) => console.error('Falha ao ouvir notificações:', error))
    return () => { cancelled = true; dispose?.() }
  }, [uid])

  useEffect(() => {
    if (!uid || profileForReminder?.uid !== uid || !profileForReminder.notificationsEnabled) return
    const check = () => {
      if (document.visibilityState !== 'visible' || !pushEnabledOnDevice(profileForReminder.fcmTokens)) return
      try {
        const reminder = reminderAt(profileForReminder)
        if (!reminder || !claimReminder(uid, reminder.date, reminder.slot)) return
        setToast(reminder.body)
        void displayNotification(reminder.title, reminder.body).catch(console.error)
      } catch (error) {
        console.error('Falha ao verificar horário do lembrete:', error)
      }
    }
    check()
    const timer = window.setInterval(check, 1000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [uid, profileForReminder])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 6000)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  if (authLoading) return <p className="spinner">Projeto Salmos</p>
  if (!user) return <Login />
  if (state.loading) return <p className="spinner">Abrindo o saltério…</p>

  const { profile, cycle } = state
  const dayLabel =
    cycle.status === 'not-started'
      ? 'ciclo não iniciado'
      : `dia ${cycle.day} de ${TOTAL_PSALMS}`

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar__inner">
          <span className="topbar__mark">
            Projeto <b>Salmos</b>
          </span>
          <span className="topbar__day">{dayLabel}</span>
          {profile?.photoURL && <img className="topbar__avatar" src={profile.photoURL} alt="" />}
        </div>
      </header>

      <main className={`main${location.pathname === '/admin' ? ' main--wide' : ''}`}>
        {!online && (
          <p className="banner banner--offline">
            Sem conexão. Você pode ler e marcar como lido — eu sincronizo quando a rede voltar.
          </p>
        )}
        {online && state.pendingSync && (
          <p className="banner">Enviando o que você marcou offline.</p>
        )}

        <Routes>
          <Route path="/" element={<Today state={state} />} />
          <Route path="/salterio" element={<Psalter state={state} />} />
          <Route path="/salmo/:number" element={<PsalmView state={state} />} />
          <Route path="/favoritos" element={<Favorites state={state} />} />
          <Route path="/ajustes" element={<Settings state={state} />} />
          <Route
            path="/admin"
            element={
              isAdmin ? (
                <Suspense fallback={<p className="spinner">Carregando o painel…</p>}>
                  <Admin />
                </Suspense>
              ) : (
                <p className="empty">Esta área é só para administradores.</p>
              )
            }
          />
          <Route path="*" element={<Today state={state} />} />
        </Routes>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <nav className="nav">
        <div className="nav__inner">
          <NavLink className="nav__link" to="/" end>
            <span className="nav__glyph">
              <IconToday />
            </span>
            Hoje
          </NavLink>
          <NavLink className="nav__link" to="/salterio">
            <span className="nav__glyph">
              <IconPsalter />
            </span>
            Os 150
          </NavLink>
          <NavLink className="nav__link" to="/favoritos">
            <span className="nav__glyph">
              <IconStar />
            </span>
            Guardados
          </NavLink>
          <NavLink className="nav__link" to="/ajustes">
            <span className="nav__glyph">
              <IconSettings />
            </span>
            Ajustes
          </NavLink>
          {isAdmin && (
            <NavLink className="nav__link" to="/admin">
              <span className="nav__glyph">
                <IconAdmin />
              </span>
              Painel
            </NavLink>
          )}
        </div>
      </nav>
    </div>
  )
}
