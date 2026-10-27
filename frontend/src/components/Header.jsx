import { useEffect, useState } from 'react'
import { LogoMark } from './Logo'

const NAV = [
  ['#como-funciona', 'Como funciona'],
  ['#resultado-exemplo', 'Resultado'],
  ['#recursos', 'Recursos'],
  ['#sobre', 'Sobre'],
]

export default function Header() {
  const [aberto, setAberto] = useState(false)
  const [rolou, setRolou] = useState(false)

  useEffect(() => {
    const on = () => setRolou(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && setAberto(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  return (
    <header className={`topo ${rolou ? 'topo--rolou' : ''} ${aberto ? 'topo--aberto' : ''}`}>
      <a href="#inicio" className="marca" aria-label="Resume AI, voltar ao início">
        <LogoMark size={40} className="marca__icone" />
        <span className="marca__nome">
          Resume<i>ai</i>
        </span>
      </a>

      <nav id="menu" className="nav" aria-label="Principal">
        {NAV.map(([href, rotulo]) => (
          <a key={href} href={href} onClick={() => setAberto(false)}>
            {rotulo}
          </a>
        ))}
        <a href="#inicio" className="botao botao--escuro nav__cta" onClick={() => setAberto(false)}>
          Gerar resumo
        </a>
      </nav>

      <button
        type="button"
        className="menu-btn"
        aria-expanded={aberto}
        aria-controls="menu"
        aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
        onClick={() => setAberto((v) => !v)}
      >
        <span />
        <span />
      </button>
    </header>
  )
}
