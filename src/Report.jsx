import { useEffect, useRef, useState } from 'react'
import { generateReport } from './api.js'
import './Report.css'

const SCORE_LABELS = {
  ai_mognad: 'AI-mognad',
  digital_mognad: 'Digital mognad',
  datamognad: 'Datamognad',
  processmognad: 'Processmognad',
  automatiseringspotential: 'Automatiseringspotential',
  roi_potential: 'ROI-potential',
}

export default function Report({ sessionId, onExit }) {
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    generateReport(sessionId)
      .then(setReport)
      .catch((err) => setError(String(err.message || err)))
  }, [sessionId])

  if (error) {
    return (
      <div className="rp-center">
        <p className="rp-error">{error}</p>
        <button className="rp-btn" onClick={onExit}>
          Tillbaka
        </button>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="rp-center">
        <div className="rp-spinner" />
        <p>Tar fram din rapport. Detta tar en liten stund.</p>
      </div>
    )
  }

  const es = report.executive_summary || {}
  const bp = report.bolagsprofil || {}

  return (
    <div className="rp">
      <header className="rp-head">
        <div className="rp-brand">Klarsyn</div>
        <button className="rp-back" onClick={onExit}>
          Stäng
        </button>
      </header>

      <div className="rp-body">
        <h1 className="rp-title">Din AI-mognadsanalys</h1>

        <section className="rp-section rp-summary">
          <h2>Sammanfattning</h2>
          <div className="rp-summary-grid">
            <Field label="Största problemet" value={es.storsta_problemet} />
            <Field label="Största möjligheten" value={es.storsta_mojligheten} />
            <Field label="Största risken" value={es.storsta_risken} />
            <Field label="Förväntad nytta" value={es.forvantad_nytta} />
          </div>
          {es.tre_atgarder?.length > 0 && (
            <div className="rp-actions">
              <span className="rp-actions-label">Tre rekommenderade åtgärder</span>
              <ol>
                {es.tre_atgarder.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section className="rp-section">
          <h2>Bolagsprofil</h2>
          <div className="rp-summary-grid">
            <Field label="Verksamhet" value={bp.verksamhet} />
            <Field label="Storlek" value={bp.storlek} />
            <Field label="Bransch" value={bp.bransch} />
            <Field label="Affärsmodell" value={bp.affarsmodell} />
            <Field label="Viktigaste mål" value={bp.viktigaste_mal} />
          </div>
        </section>

        <section className="rp-section">
          <h2>AI Readiness Score</h2>
          <div className="rp-scores">
            {Object.entries(SCORE_LABELS).map(([key, label]) => {
              const s = report.scores?.[key]
              if (!s) return null
              return (
                <div className="rp-score" key={key}>
                  <div className="rp-score-top">
                    <span className="rp-score-num">{s.score}</span>
                    <span className="rp-score-max">/10</span>
                  </div>
                  <div className="rp-score-bar">
                    <div className="rp-score-fill" style={{ width: `${s.score * 10}%` }} />
                  </div>
                  <div className="rp-score-label">{label}</div>
                  <div className="rp-score-mot">{s.motivering}</div>
                </div>
              )
            })}
          </div>
        </section>

        {report.flaskhalsar?.length > 0 && (
          <section className="rp-section">
            <h2>Identifierade flaskhalsar</h2>
            <div className="rp-cards">
              {report.flaskhalsar.map((f, i) => (
                <div className="rp-card" key={i}>
                  <div className="rp-card-head">
                    <strong>{f.problem}</strong>
                    <span className={`rp-tag prio-${(f.prioritet || '').toLowerCase()}`}>{f.prioritet}</span>
                  </div>
                  <Field label="Konsekvens" value={f.konsekvens} />
                  <Field label="Funktion" value={f.funktion} />
                  <Field label="Möjlig AI-lösning" value={f.ai_losning} />
                  <Field label="Uppskattad effekt" value={f.uppskattad_effekt} />
                </div>
              ))}
            </div>
          </section>
        )}

        {report.ai_mojligheter?.length > 0 && (
          <section className="rp-section">
            <h2>AI Opportunity Map</h2>
            <div className="rp-cards">
              {report.ai_mojligheter.map((o, i) => (
                <div className="rp-card" key={i}>
                  <div className="rp-card-head">
                    <strong>{o.namn}</strong>
                    <span className={`rp-tag prio-${(o.prioritet || '').toLowerCase()}`}>{o.prioritet}</span>
                  </div>
                  <div className="rp-chips">
                    <span>Affärsvärde: {o.affarsvarde}</span>
                    <span>Komplexitet: {o.komplexitet}</span>
                    <span>Kostnad: {o.kostnadsniva}</span>
                    <span>Tid: {o.tid_till_effekt}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {report.roi && (
          <section className="rp-section rp-roi">
            <h2>ROI och besparingspotential</h2>
            <div className="rp-roi-grid">
              <RoiStat label="Timmar / vecka" value={report.roi.timmar_sparade_per_vecka} />
              <RoiStat label="Besparing / månad" value={report.roi.kostnadsbesparing_per_manad} />
              <RoiStat label="Besparing / år" value={report.roi.kostnadsbesparing_per_ar} />
              <RoiStat label="Återbetalningstid" value={report.roi.aterbetalningstid} />
            </div>
            {report.roi.antaganden?.length > 0 && (
              <div className="rp-assume">
                <span className="rp-actions-label">Antaganden</span>
                <ul>
                  {report.roi.antaganden.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {report.rekommenderade_verktyg?.length > 0 && (
          <section className="rp-section">
            <h2>Rekommenderade verktyg</h2>
            <div className="rp-tools">
              {report.rekommenderade_verktyg.map((t, i) => (
                <div className="rp-tool" key={i}>
                  <strong>{t.verktyg}</strong>
                  <span>{t.syfte}</span>
                  {t.kopplat_till && <em>Kopplat till: {t.kopplat_till}</em>}
                </div>
              ))}
            </div>
          </section>
        )}

        {report.roadmap && (
          <section className="rp-section">
            <h2>90-dagars roadmap</h2>
            <div className="rp-roadmap">
              <Phase title="Fas 1: 0–30 dagar" items={report.roadmap.fas1_0_30} />
              <Phase title="Fas 2: 30–60 dagar" items={report.roadmap.fas2_30_60} />
              <Phase title="Fas 3: 60–90 dagar" items={report.roadmap.fas3_60_90} />
            </div>
          </section>
        )}

        {report.nasta_steg?.length > 0 && (
          <section className="rp-section rp-next">
            <h2>Nästa steg</h2>
            <ul>
              {report.nasta_steg.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <button className="rp-cta">Boka genomgång</button>
          </section>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }) {
  if (!value) return null
  return (
    <div className="rp-field">
      <span className="rp-field-label">{label}</span>
      <span className="rp-field-value">{value}</span>
    </div>
  )
}

function RoiStat({ label, value }) {
  return (
    <div className="rp-roi-stat">
      <span className="rp-roi-value">{value || '–'}</span>
      <span className="rp-roi-label">{label}</span>
    </div>
  )
}

function Phase({ title, items }) {
  if (!items?.length) return null
  return (
    <div className="rp-phase">
      <h3>{title}</h3>
      <ul>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  )
}
