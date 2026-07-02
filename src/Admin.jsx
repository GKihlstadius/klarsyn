import { useEffect, useState } from 'react'
import { listSessions, fetchReport, generateReport, saveReport, approveReport } from './api.js'
import './Admin.css'

const SCORE_LABELS = {
  ai_mognad: 'AI-mognad',
  digital_mognad: 'Digital mognad',
  datamognad: 'Datamognad',
  processmognad: 'Processmognad',
  automatiseringspotential: 'Automatiseringspotential',
  roi_potential: 'ROI-potential',
}

export default function Admin({ onExit, onOpenReport }) {
  const [sessions, setSessions] = useState([])
  const [selected, setSelected] = useState(null)
  const [report, setReport] = useState(null)
  const [approved, setApproved] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () => listSessions().then(setSessions).catch(() => {})

  useEffect(() => {
    refresh()
  }, [])

  async function open(s) {
    setSelected(s.id)
    setReport(null)
    setStatus('')
    setApproved(s.approved)
    try {
      const data = await fetchReport(s.id)
      setReport(data.report)
      setApproved(data.approved)
    } catch {
      setReport(false) // finns ingen rapport än
    }
  }

  async function generate() {
    setBusy(true)
    setStatus('Genererar rapport...')
    try {
      const r = await generateReport(selected)
      setReport(r)
      setStatus('')
      refresh()
    } catch (e) {
      setStatus(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    setBusy(true)
    setStatus('Sparar...')
    try {
      await saveReport(selected, report)
      setStatus('Sparat')
      setTimeout(() => setStatus(''), 1500)
    } catch (e) {
      setStatus(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function toggleApprove() {
    const next = !approved
    await approveReport(selected, next)
    setApproved(next)
    refresh()
  }

  const patch = (updater) => setReport((r) => updater(structuredClone(r)))

  if (selected && report !== null) {
    return (
      <div className="ad">
        <header className="ad-top">
          <button className="ad-btn" onClick={() => setSelected(null)}>
            Tillbaka
          </button>
          <span className="ad-title">Redigera rapport</span>
          <span className="ad-status">{status}</span>
        </header>

        {report === false ? (
          <div className="ad-empty">
            <p>Ingen rapport genererad för den här sessionen än.</p>
            <button className="ad-btn primary" onClick={generate} disabled={busy}>
              Generera rapport
            </button>
          </div>
        ) : (
          <div className="ad-editor">
            <section>
              <h3>Tre rekommenderade åtgärder</h3>
              {(report.executive_summary?.tre_atgarder || []).map((a, i) => (
                <input
                  key={i}
                  value={a}
                  onChange={(e) =>
                    patch((r) => {
                      r.executive_summary.tre_atgarder[i] = e.target.value
                      return r
                    })
                  }
                />
              ))}
            </section>

            <section>
              <h3>Scoring (1-10)</h3>
              {Object.entries(SCORE_LABELS).map(([key, label]) => (
                <div className="ad-score" key={key}>
                  <label>{label}</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={report.scores?.[key]?.score ?? ''}
                    onChange={(e) =>
                      patch((r) => {
                        r.scores[key].score = Number(e.target.value)
                        return r
                      })
                    }
                  />
                  <input
                    className="ad-mot"
                    value={report.scores?.[key]?.motivering ?? ''}
                    onChange={(e) =>
                      patch((r) => {
                        r.scores[key].motivering = e.target.value
                        return r
                      })
                    }
                  />
                </div>
              ))}
            </section>

            <section>
              <h3>ROI</h3>
              {[
                ['timmar_sparade_per_vecka', 'Timmar / vecka'],
                ['kostnadsbesparing_per_manad', 'Besparing / månad'],
                ['kostnadsbesparing_per_ar', 'Besparing / år'],
                ['aterbetalningstid', 'Återbetalningstid'],
              ].map(([key, label]) => (
                <div className="ad-row" key={key}>
                  <label>{label}</label>
                  <input
                    value={report.roi?.[key] ?? ''}
                    onChange={(e) =>
                      patch((r) => {
                        r.roi = r.roi || {}
                        r.roi[key] = e.target.value
                        return r
                      })
                    }
                  />
                </div>
              ))}
            </section>

            <section>
              <h3>Rekommenderade verktyg</h3>
              {(report.rekommenderade_verktyg || []).map((t, i) => (
                <div className="ad-tool" key={i}>
                  <input
                    placeholder="Verktyg"
                    value={t.verktyg || ''}
                    onChange={(e) =>
                      patch((r) => {
                        r.rekommenderade_verktyg[i].verktyg = e.target.value
                        return r
                      })
                    }
                  />
                  <input
                    placeholder="Syfte"
                    value={t.syfte || ''}
                    onChange={(e) =>
                      patch((r) => {
                        r.rekommenderade_verktyg[i].syfte = e.target.value
                        return r
                      })
                    }
                  />
                  <button
                    className="ad-remove"
                    onClick={() =>
                      patch((r) => {
                        r.rekommenderade_verktyg.splice(i, 1)
                        return r
                      })
                    }
                  >
                    Ta bort
                  </button>
                </div>
              ))}
              <button
                className="ad-btn"
                onClick={() =>
                  patch((r) => {
                    r.rekommenderade_verktyg = r.rekommenderade_verktyg || []
                    r.rekommenderade_verktyg.push({ verktyg: '', syfte: '', kopplat_till: '' })
                    return r
                  })
                }
              >
                Lägg till verktyg
              </button>
            </section>

            <div className="ad-actions">
              <button className="ad-btn primary" onClick={save} disabled={busy}>
                Spara ändringar
              </button>
              <button className={`ad-btn ${approved ? 'approved' : ''}`} onClick={toggleApprove}>
                {approved ? 'Godkänd, klicka för att ångra' : 'Godkänn för leverans'}
              </button>
              <button className="ad-btn" onClick={() => onOpenReport(selected)}>
                Öppna kundvy
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="ad">
      <header className="ad-top">
        <span className="ad-title">Klarsyn admin</span>
        <button className="ad-btn" onClick={onExit}>
          Till startsidan
        </button>
      </header>
      <div className="ad-list">
        {sessions.length === 0 && <p className="ad-muted">Inga sessioner än.</p>}
        {sessions.map((s) => (
          <div className="ad-item" key={s.id} onClick={() => open(s)}>
            <div className="ad-item-main">
              <span className="ad-id">{s.id.slice(0, 8)}</span>
              <span className="ad-date">{new Date(s.updatedAt).toLocaleString('sv-SE')}</span>
            </div>
            <div className="ad-badges">
              <span className={`ad-badge ${s.status}`}>{s.status}</span>
              {s.hasReport && <span className="ad-badge report">rapport</span>}
              {s.approved && <span className="ad-badge ok">godkänd</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
