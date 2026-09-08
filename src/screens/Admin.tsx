import { collection, onSnapshot } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudioUrls, saveAudioUrl } from '../hooks/useAudioUrls'
import { TOTAL_PSALMS, deriveCycle, todayKey, type UserProfile } from '../lib/cycle'
import { db } from '../lib/firebase'

type Row = UserProfile & {
  /** Dia em que a pessoa está agora, já aplicando a regra do reset. */
  currentDay: number
  standing: 'lido-hoje' | 'pendente' | 'perdeu' | 'nao-comecou' | 'completou'
}

const STANDING_TEXT: Record<Row['standing'], string> = {
  'lido-hoje': 'Leu hoje',
  pendente: 'Falta hoje',
  perdeu: 'Perdeu o ciclo',
  'nao-comecou': 'Não começou',
  completou: 'Completou os 150',
}

type SortKey = 'name' | 'currentDay' | 'bestDay' | 'resets' | 'lastReadDate'

export function Admin() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('currentDay')
  const [asc, setAsc] = useState(false)
  const [testPsalm, setTestPsalm] = useState(1)
  const [testMessage, setTestMessage] = useState('')
  const navigate = useNavigate()
  const today = todayKey()

  useEffect(() => {
    return onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const profile = { ...(d.data() as UserProfile), uid: d.id }
            const cycle = deriveCycle(profile, today)
            const standing: Row['standing'] =
              cycle.status === 'cycle-complete'
                ? 'completou'
                : cycle.status === 'done-today'
                  ? 'lido-hoje'
                  : cycle.status === 'pending'
                    ? 'pendente'
                    : profile.cycleStartDate
                      ? 'perdeu'
                      : 'nao-comecou'
            return {
              ...profile,
              currentDay: cycle.status === 'not-started' ? 0 : cycle.day,
              standing,
            }
          }),
        )
      },
      (err) => setError(err.message),
    )
  }, [today])

  const sorted = useMemo(() => {
    if (!rows) return []
    const dir = asc ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sortKey === 'name') {
        return dir * (a.displayName ?? a.email ?? '').localeCompare(b.displayName ?? b.email ?? '')
      }
      if (sortKey === 'lastReadDate') {
        return dir * (a.lastReadDate ?? '').localeCompare(b.lastReadDate ?? '')
      }
      return dir * ((a[sortKey] ?? 0) - (b[sortKey] ?? 0))
    })
  }, [rows, sortKey, asc])

  function sortBy(key: SortKey) {
    if (key === sortKey) setAsc(!asc)
    else {
      setSortKey(key)
      setAsc(key === 'name')
    }
  }

  const head = (key: SortKey, label: string) => (
    <th onClick={() => sortBy(key)} aria-sort={sortKey === key ? (asc ? 'ascending' : 'descending') : undefined}>
      {label}
      {sortKey === key && (asc ? ' ↑' : ' ↓')}
    </th>
  )

  if (error) {
    return (
      <p className="empty">
        Sem permissão para ler os usuários: {error}. Confira se seu documento em{' '}
        <code>roles/{'{seu-uid}'}</code> tem <code>admin: true</code>.
      </p>
    )
  }
  if (!rows) return <p className="spinner">Carregando as pessoas…</p>

  const started = rows.filter((r) => r.standing !== 'nao-comecou')
  const readToday = rows.filter((r) => r.standing === 'lido-hoje').length
  const avgDay = started.length
    ? Math.round(started.reduce((acc, r) => acc + r.currentDay, 0) / started.length)
    : 0

  return (
    <>
      <div className="section-head">
        <h1>Quem está lendo</h1>
        <p>Atualiza sozinho conforme as pessoas marcam suas leituras.</p>
      </div>

      <div className="stats">
        <div className="stat">
          <b>{rows.length}</b>
          <span>pessoas cadastradas</span>
        </div>
        <div className="stat">
          <b>{started.length}</b>
          <span>com ciclo em andamento</span>
        </div>
        <div className="stat">
          <b>{readToday}</b>
          <span>leram hoje</span>
        </div>
        <div className="stat">
          <b>{avgDay}</b>
          <span>dia médio do grupo</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="empty">Ninguém entrou ainda.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {head('name', 'Pessoa')}
                {head('currentDay', 'Dia atual')}
                <th>Progresso</th>
                {head('bestDay', 'Recorde')}
                {head('resets', 'Recomeços')}
                {head('lastReadDate', 'Última leitura')}
                <th>Situação</th>
                <th>Lembretes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.uid}>
                  <td>
                    <span className="who">
                      {r.photoURL ? (
                        <img src={r.photoURL} alt="" />
                      ) : (
                        <i aria-hidden="true">
                          {(r.displayName ?? r.email ?? '?').charAt(0).toUpperCase()}
                        </i>
                      )}
                      <span>
                        <b>{r.displayName ?? 'Sem nome'}</b>
                        <span>{r.email ?? '—'}</span>
                      </span>
                    </span>
                  </td>
                  <td>{r.currentDay || '—'}</td>
                  <td>
                    <span className="bar">
                      <span className="bar__track">
                        <span
                          className="bar__fill"
                          style={{ width: `${(r.lastReadDay / TOTAL_PSALMS) * 100}%` }}
                        />
                      </span>
                      <span className="bar__num">{r.lastReadDay}/150</span>
                    </span>
                  </td>
                  <td>{r.bestDay || '—'}</td>
                  <td>{r.resets ?? 0}</td>
                  <td>{r.lastReadDate ? r.lastReadDate.split('-').reverse().join('/') : '—'}</td>
                  <td>
                    <span
                      className={`tag${r.standing === 'lido-hoje' || r.standing === 'completou' ? ' tag--live' : ''}`}
                    >
                      {STANDING_TEXT[r.standing]}
                    </span>
                  </td>
                  <td>
                    {r.notificationsEnabled ? (r.notificationTimes ?? []).join('  ') : 'desligados'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="block">
        <h2>Testar salmo</h2>
        <p className="note">
          Navegue até qualquer salmo para verificar se está funcionando.
        </p>
        <div className="form-row">
          <label className="field field--inline">
            <span>Salmo</span>
            <input
              type="number"
              min={1}
              max={TOTAL_PSALMS}
              value={testPsalm}
              onChange={(e) => setTestPsalm(Number(e.target.value))}
            />
          </label>
          <button
            className="btn"
            disabled={testPsalm < 1 || testPsalm > TOTAL_PSALMS}
            onClick={() => navigate(`/salmo/${testPsalm}`)}
          >
            Abrir salmo
          </button>
        </div>
      </section>

      <section className="block">
        <h2>Testar notificação</h2>
        <p className="note">
          Verifique se o sistema de notificações está funcionando.
        </p>
        <div className="form-row">
          <button
            className="btn"
            onClick={() => setTestMessage('Notificação de teste recebida!')}
          >
            Enviar notificação de teste
          </button>
        </div>
        {testMessage && <p className="note">{testMessage}</p>}
      </section>

      <AudioAdmin />
    </>
  )
}

/** Cadastro das URLs de narração — uma por salmo, guardadas em content/audio. */
function AudioAdmin() {
  const urls = useAudioUrls()
  const [psalm, setPsalm] = useState('1')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const filled = Object.values(urls).filter(Boolean).length

  return (
    <section className="block">
      <h2>Narrações</h2>
      <p className="note">
        {filled} de {TOTAL_PSALMS} salmos com áudio.         Cole o link do áudio do Google Drive. No próximo deploy, o sistema baixa e hospeda automaticamente.
      </p>

      <div className="form-row">
        <label className="field field--inline">
          <span>Salmo</span>
          <select value={psalm} onChange={(e) => setPsalm(e.target.value)}>
            {Array.from({ length: TOTAL_PSALMS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {/* Sem símbolos: dentro de um <select> nativo eles ficam à
                    mercê da fonte do sistema. */}
                {urls[String(n)] ? `${n} — com áudio` : n}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--inline field--grow">
          <span>Endereço do áudio</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={urls[psalm] ?? 'https://drive.google.com/file/d/...'}
          />
        </label>
        <button
          className="btn"
          disabled={busy || !url.trim()}
          onClick={() => {
            setBusy(true)
            void saveAudioUrl(Number(psalm), url)
              .then(() => {
                setMessage(`Áudio do Salmo ${psalm} salvo.`)
                setUrl('')
              })
              .catch((err: Error) => setMessage(`Não salvou: ${err.message}`))
              .finally(() => setBusy(false))
          }}
        >
          Salvar áudio
        </button>
      </div>
      {message && <p className="note">{message}</p>}
    </section>
  )
}
