import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import './LandingPage.css'

const EASE = [0.16, 1, 0.3, 1]

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_215831_c6a8989c-d716-4d8d-8745-e972a2eec711.mp4'

const STEPS = [
  {
    title: 'Svara på frågor inom 30 minuter',
    text: 'Vår AI-konsult intervjuar dig om affären, processerna, systemen och målen. Ett samtal, inte ett formulär.',
  },
  {
    title: 'AI:n analyserar ditt företag',
    text: 'Flaskhalsar, tidstjuvar, AI-mognad och ROI-potential identifieras utifrån dina svar.',
  },
  {
    title: 'Få din rapport direkt',
    text: 'AI Readiness Score, prioriterade åtgärder, konkreta verktyg och en 90-dagars handlingsplan. Delbar länk och PDF.',
  },
]

function LogoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="8" width="16" height="7" rx="3.5" fill="#000000" transform="rotate(-35 12 12)" />
      <rect
        x="4"
        y="8"
        width="16"
        height="7"
        rx="3.5"
        fill="#000000"
        transform="rotate(-35 12 12) translate(0 6)"
      />
    </svg>
  )
}

function DotGridIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      {[2, 10].map((y) =>
        [2, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#ffffff" />),
      )}
    </svg>
  )
}

export default function LandingPage({ onStart, onAdmin }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const howRef = useRef(null)

  const scrollToHow = () => {
    setMenuOpen(false)
    howRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="page">
      <motion.nav
        className="navbar"
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <div className="nav-left">
          <div className="brand">
            <LogoIcon />
            <span className="brand-text">Klarsyn</span>
          </div>

          <div className="menu-wrap">
            <button className="menu-btn" onClick={() => setMenuOpen((v) => !v)}>
              <span className="menu-circle">
                <Plus
                  size={12}
                  strokeWidth={3}
                  color="#000000"
                  style={{ transform: menuOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}
                />
              </span>
              <span className="menu-label">Meny</span>
            </button>
            {menuOpen && (
              <div className="menu-dropdown">
                <button onClick={scrollToHow}>Så funkar det</button>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onStart()
                  }}
                >
                  Boka analys
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onAdmin()
                  }}
                >
                  Admin
                </button>
              </div>
            )}
          </div>

          <div className="tags-pill">
            <span>AI-analys</span>
            <span>Affärsvärde</span>
          </div>
        </div>

        <div className="nav-right">
          <button className="right-pill" onClick={scrollToHow}>
            <span className="right-circle">
              <DotGridIcon />
            </span>
            <span className="right-label">Inom 30 minuter</span>
          </button>
        </div>
      </motion.nav>

      <section className="hero">
        <motion.video
          className="bg-video"
          src={VIDEO_URL}
          autoPlay
          muted
          playsInline
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.8, ease: EASE }}
        />

        <motion.div
          className="footer"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, delay: 0.5, ease: EASE }}
        >
          <div className="footer-left">
            <motion.div
              className="subtitle"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
            >
              <span className="dot" />
              <span>AI-analys för svenska företag 2026</span>
            </motion.div>

            <motion.h1
              className="heading"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8, ease: EASE }}
            >
              Se var AI skapar
              <br />
              störst affärsvärde.
            </motion.h1>

            <motion.div
              className="buttons"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.0, ease: EASE }}
            >
              <button className="btn btn-primary" onClick={onStart}>
                Boka analys 995 kr
              </button>
              <button className="btn btn-ghost" onClick={scrollToHow}>
                Så funkar det
              </button>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <section className="how" ref={howRef}>
        <div className="how-inner">
          <div className="subtitle">
            <span className="dot" />
            <span>Så funkar det</span>
          </div>
          <h2 className="how-heading">
            Från samtal till handlingsplan.
            <br />
            På under en timme.
          </h2>

          <div className="how-steps">
            {STEPS.map((s) => (
              <div className="how-step" key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>

          <div className="how-cta">
            <button className="btn btn-primary" onClick={onStart}>
              Boka analys 995 kr
            </button>
          </div>
        </div>

        <footer className="site-footer">
          <span>Klarsyn © 2026</span>
          <button onClick={onAdmin}>Admin</button>
        </footer>
      </section>
    </div>
  )
}
