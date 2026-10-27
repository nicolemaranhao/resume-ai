import { useEffect, useId, useRef, useState } from 'react'
import { validarUrl } from '../lib/youtube'
import HeroScene from './HeroScene'
import ProcessPanel from './ProcessPanel'

export default function Hero({ resumo }) {
  const { estado, job, erro, inicio, ocupado, iniciar, tentarNovamente, reiniciar } = resumo
  const [url, setUrl] = useState('')
  const [erroCampo, setErroCampo] = useState('')
  const idErro = useId()
  const painelRef = useRef(null)

  // Ao iniciar, traz o painel de etapas para a tela (sem pular a página toda).
  useEffect(() => {
    if (estado === 'enviando' && painelRef.current) {
      setTimeout(() => painelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
    }
  }, [estado])

  const enviar = (e) => {
    e.preventDefault()
    if (ocupado) return
    const msg = validarUrl(url)
    setErroCampo(msg)
    if (!msg) iniciar(url.trim())
  }

  const colar = async () => {
    try {
      const texto = await navigator.clipboard.readText()
      if (texto) {
        setUrl(texto.trim())
        setErroCampo('')
      }
    } catch {
      /* permissão negada: o usuário cola manualmente */
    }
  }

  return (
    <section id="inicio" className="hero">
      <div className="hero__texto">
        <span className="selo" data-reveal>
          <i /> IA para estudar com vídeos
        </span>
        <h1 className="hero__titulo" data-reveal>
          Seu próximo <em>aprendizado</em> começa com <span className="sublinha">um vídeo.</span>
        </h1>
        <p className="hero__sub" data-reveal>
          Transforme aulas e vídeos do YouTube em resumos inteligentes, organizados para estudar melhor.
        </p>

        <form className={`campo ${erroCampo ? 'campo--erro' : ''}`} onSubmit={enviar} noValidate data-reveal>
          <label htmlFor="url-video" className="sr-only">
            Link do vídeo do YouTube
          </label>
          <span className="campo__icone" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
            </svg>
          </span>
          <input
            id="url-video"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="Cole o link do YouTube"
            value={url}
            disabled={ocupado}
            aria-invalid={Boolean(erroCampo)}
            aria-describedby={erroCampo ? idErro : undefined}
            onChange={(e) => {
              setUrl(e.target.value)
              if (erroCampo) setErroCampo('')
            }}
          />
          {!url && !ocupado && (
            <button type="button" className="campo__colar" onClick={colar}>
              Colar
            </button>
          )}
          <button type="submit" className="botao botao--laranja campo__enviar" disabled={ocupado}>
            {ocupado ? (
              <>
                <span className="giro" aria-hidden="true" /> Processando
              </>
            ) : (
              <>
                Gerar resumo
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M4 10h11M11 5l5 5-5 5" />
                </svg>
              </>
            )}
          </button>
        </form>
        <p id={idErro} className="campo__msg" role={erroCampo ? 'alert' : undefined}>
          {erroCampo || 'Funciona com links youtube.com, youtu.be e Shorts. Vídeos longos levam mais tempo.'}
        </p>

        <div ref={painelRef}>
        {estado !== 'ocioso' && estado !== 'concluido' && (
          <ProcessPanel
            estado={estado}
            job={job}
            erro={erro}
            inicio={inicio}
            onRetry={tentarNovamente}
            onReset={() => {
              reiniciar()
              setUrl('')
              document.getElementById('url-video')?.focus()
            }}
          />
        )}
        </div>
      </div>

      <HeroScene etapa={estado} />
    </section>
  )
}
