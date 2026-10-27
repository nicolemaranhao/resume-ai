import { useEffect, useRef } from 'react'
import './App.css'
import Header from './components/Header'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import ProcessPanel from './components/ProcessPanel'
import ResultView from './components/ResultView'
import { About, Audience, Demo, Features, Footer } from './components/Sections'
import { useResumo } from './hooks/useResumo'
import { useReveal, useScrollVar } from './hooks/useMotion'
import { formatarDuracao } from './lib/youtube'

function Ambiente() {
  return (
    <div className="ambiente" aria-hidden="true">
      <span className="ambiente__blob ambiente__blob--rosa" />
      <span className="ambiente__blob ambiente__blob--laranja" />
      <span className="ambiente__blob ambiente__blob--claro" />
      <span className="ambiente__grao" />
    </div>
  )
}

function Historico({ itens, onAbrir, atualId }) {
  const outros = itens.filter((h) => h.video?.id !== atualId)
  if (!outros.length) return null
  return (
    <aside className="historico" aria-label="Resumos recentes">
      <h3>Recentes neste navegador</h3>
      <ul>
        {outros.map((h) => (
          <li key={h.video.id}>
            <button type="button" onClick={() => onAbrir(h)}>
              <b>{h.resumo?.titulo || h.video.titulo}</b>
              <span>{h.video.duracao ? formatarDuracao(h.video.duracao) : 'YouTube'}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

export default function App() {
  const resumo = useResumo()
  const { estado, resultado, job, erro, inicio } = resumo
  const resultadoRef = useRef(null)

  useScrollVar()
  useReveal(estado)

  useEffect(() => {
    if (estado === 'concluido' && resultadoRef.current) {
      resultadoRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      resultadoRef.current.focus({ preventScroll: true })
    }
  }, [estado, resultado])

  const novo = () => {
    resumo.reiniciar()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => document.getElementById('url-video')?.focus({ preventScroll: true }), 500)
  }

  return (
    <>
      <a href="#url-video" className="pular">
        Pular para o campo de link
      </a>
      <Ambiente />
      <Header />
      <main>
        <Hero resumo={resumo} />

        {estado === 'concluido' && resultado && (
          <section id="resultado" className="meu-resultado" ref={resultadoRef} tabIndex={-1} aria-label="Seu resumo">
            <div className="container">
              <ProcessPanel estado={estado} job={job} erro={erro} inicio={job?.do_cache ? null : inicio} />
              <ResultView
                key={resultado.video?.id}
                resultado={resultado}
                doCache={job?.do_cache}
                onRegenerar={resumo.regenerar}
                onNovo={novo}
              />
            </div>
          </section>
        )}

        {resumo.historico.length > 0 && estado !== 'processando' && estado !== 'enviando' && (
          <div className="container">
            <Historico itens={resumo.historico} onAbrir={resumo.abrirDoHistorico} atualId={resultado?.video?.id} />
          </div>
        )}

        <HowItWorks />
        <Demo />
        <Features />
        <About />
        <Audience />
      </main>
      <Footer />
    </>
  )
}
