import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { ProfileState } from '../hooks/useProfile'
import { DEFAULT_NOTIFICATION_TIMES, TOTAL_PSALMS } from '../lib/cycle'
import { disablePush, enablePush, needsInstallForPush, pushEnabledOnDevice, pushStatus, showTestNotification, type PushStatus } from '../lib/push'

const SLOT_LABELS = ['Manhã', 'Tarde', 'Noite']

export function Settings({ state }: { state: ProfileState }) {
  const { user, logout } = useAuth()
  const { profile, saveNotificationSettings } = state
  const [times, setTimes] = useState<string[]>(DEFAULT_NOTIFICATION_TIMES)
  const [status, setStatus] = useState<PushStatus>(pushStatus)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pushMessage, setPushMessage] = useState('')

  useEffect(() => {
    if (profile?.notificationTimes?.length) setTimes(profile.notificationTimes)
  }, [profile?.notificationTimes])

  if (!profile || !user) return null

  const dirty = times.join() !== (profile.notificationTimes ?? []).join()
  const deviceEnabled = profile.notificationsEnabled && pushEnabledOnDevice(profile.fcmTokens)

  async function toggleNotifications(next: boolean) {
    setBusy(true)
    try {
      if (next) {
        const result = await enablePush(user!.uid, setPushMessage)
        setStatus(result)
        setPushMessage(result === 'granted' ? 'Lembretes ativados neste aparelho. Você já pode testar a notificação.'
          : result === 'denied' ? 'O navegador bloqueou as notificações. Libere a permissão do site para receber lembretes.'
          : result === 'unsupported' ? 'Este navegador não oferece suporte aos lembretes. Abra o site no Chrome ou Edge.'
          : 'A permissão não foi concedida. Clique em Ligar e permita as notificações no navegador.')
      } else {
        setPushMessage('Desligando os lembretes neste aparelho…')
        await disablePush(user!.uid)
        setPushMessage('Lembretes desligados neste aparelho.')
      }
    } catch (error) {
      setPushMessage(error instanceof Error ? error.message : 'Não foi possível ativar os lembretes.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="section-head">
        <h1>Ajustes</h1>
      </div>

      <div className="switch">
        <span className="switch__label">
          <b>Lembretes neste aparelho</b>
          <span>
            {status === 'denied'
              ? 'Bloqueado nas configurações do navegador. Libere as notificações do site e volte aqui.'
              : status === 'unsupported'
                ? 'Este navegador não entrega notificações.'
                : deviceEnabled ? 'Este aparelho está cadastrado para receber os lembretes.' : 'Ative neste navegador para receber seus lembretes aqui.'}
          </span>
        </span>
        <button
          className="btn btn--ghost"
          disabled={busy || status === 'denied' || status === 'unsupported'}
          onClick={() => void toggleNotifications(!deviceEnabled)}
        >
          {busy ? 'Aguarde…' : deviceEnabled ? 'Desligar' : 'Ligar neste aparelho'}
        </button>
      </div>

      <button className="btn btn--ghost" disabled={busy} onClick={() => {
        setBusy(true)
        setPushMessage('Testando a notificação neste aparelho…')
        void showTestNotification()
          .then(() => setPushMessage('Notificação de teste emitida neste aparelho. Confira as notificações do navegador.'))
          .catch((error: Error) => setPushMessage(error.message))
          .finally(() => setBusy(false))
      }}>Testar notificação neste aparelho</button>
      {pushMessage && <p className="note" role="status">{pushMessage}</p>}

      {needsInstallForPush() && (
        <p className="note">
          No iPhone, as notificações só chegam se o aplicativo estiver na tela inicial. No Safari,
          toque em Compartilhar e depois em “Adicionar à Tela de Início”.
        </p>
      )}

      <section className="block">
        <h2>A que horas devo te lembrar?</h2>
        <p className="note">No seu fuso: {profile.timezone}.</p>

        <div className="times">
          {[0, 1, 2].map((i) => (
            <label className="field field--inline" key={i}>
              <span>{SLOT_LABELS[i]}</span>
              <input
                type="time"
                value={times[i] ?? DEFAULT_NOTIFICATION_TIMES[i]}
                onChange={(e) => {
                  const next = [...times]
                  next[i] = e.target.value
                  setTimes(next)
                  setSaved(false)
                }}
              />
            </label>
          ))}
        </div>

        <div className="block__actions">
          <button
            className="btn"
            disabled={!dirty || busy}
            onClick={() => {
              setBusy(true)
              void saveNotificationSettings({ notificationTimes: times })
                .then(() => setSaved(true))
                .finally(() => setBusy(false))
            }}
          >
            Salvar horários
          </button>
          {saved && !dirty && <span className="note">Salvo.</span>}
        </div>
      </section>

      <section className="block">
        <h2>Sua caminhada</h2>
        <div className="stats">
          <div className="stat">
            <b>{profile.lastReadDay}</b>
            <span>de {TOTAL_PSALMS} neste ciclo</span>
          </div>
          <div className="stat">
            <b>{profile.bestDay}</b>
            <span>seu recorde de dias</span>
          </div>
          <div className="stat">
            <b>{profile.completedCycles}</b>
            <span>ciclos completos</span>
          </div>
          <div className="stat">
            <b>{profile.resets}</b>
            <span>recomeços</span>
          </div>
        </div>
      </section>

      <section className="block">
        <h2>Conta</h2>
        <p className="note">
          {profile.displayName ? `${profile.displayName} — ` : ''}
          {profile.email ?? 'sem e-mail'}
        </p>
        <button className="btn btn--ghost" onClick={() => void logout()}>
          Sair desta conta
        </button>
      </section>
    </>
  )
}
