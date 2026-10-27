import { useId, useRef, useState } from 'react'
import { formatarDuracao } from '../lib/youtube'

const ABAS = [
  { id: 'geral', rotulo: 'Resumo geral', num: '01' },
  { id: 'conceitos', rotulo: 'Conceitos', num: '02' },
  { id: 'perguntas', rotulo: 'Perguntas', num: '03' },
  { id: 'lembrar', rotulo: 'Para lembrar', num: '04' },
]

const FONTES = {
  legenda_manual: 'legenda do autor',
  legenda_automatica: 'legenda automática do YouTube',
  whisper: 'transcrito pelo Whisper',
}

const IDIOMAS = { pt: 'português', en: 'inglês', es: 'espanhol', fr: 'francês', de: 'alemão', it: 'italiano' }

function baixarTxt(texto, nome) {
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${nome}.txt`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function nomeArquivo(titulo) {
  return (
    'resumo-' +
    (titulo || 'video')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
  )
}

/** Exibe o resumo estruturado. Usado no resultado real e na demonstração. */
export default function ResultView({ resultado, exemplo = false, doCache = false, onRegenerar, onNovo }) {
  const [aba, setAba] = useState('geral')
  const [aviso, setAviso] = useState('')
  const base = useId()
  const listaRef = useRef(null)
  const r = resultado.resumo
  const video = resultado.video || {}

  const avisar = (msg) => {
    setAviso(msg)
    setTimeout(() => setAviso(''), 2200)
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(r.texto)
      avisar('Resumo copiado')
    } catch {
      avisar('Não foi possível copiar')
    }
  }

  const teclado = (e) => {
    const i = ABAS.findIndex((a) => a.id === aba)
    let n = null
    if (e.key === 'ArrowRight') n = (i + 1) % ABAS.length
    if (e.key === 'ArrowLeft') n = (i - 1 + ABAS.length) % ABAS.length
    if (e.key === 'Home') n = 0
    if (e.key === 'End') n = ABAS.length - 1
    if (n !== null) {
      e.preventDefault()
      setAba(ABAS[n].id)
      listaRef.current?.querySelectorAll('[role="tab"]')[n]?.focus()
    }
  }

  const contagem = {
    conceitos: r.principais_conceitos.length,
    perguntas: r.perguntas_respostas.length,
    lembrar: r.importante_lembrar.length,
  }

  return (
    <article className={`resultado ${exemplo ? 'resultado--exemplo' : 'resultado--real'}`}>
      <header className="resultado__cabeca">
        <div>
          <span className="resultado__kicker">
            {exemplo ? 'Exemplo ilustrativo' : doCache ? 'Resumo salvo' : 'Seu resumo'}
            {video.duracao ? ` · vídeo de ${formatarDuracao(video.duracao)}` : ''}
          </span>
          <h3 className="resultado__titulo">{r.titulo || video.titulo}</h3>
          {video.titulo && r.titulo && video.titulo !== r.titulo && (
            <span className="resultado__origem">Vídeo: {video.titulo}</span>
          )}
        </div>
        {!exemplo && (
          <div className="resultado__acoes">
            <button type="button" className="chip" onClick={copiar}>
              Copiar
            </button>
            <button type="button" className="chip" onClick={() => baixarTxt(r.texto, nomeArquivo(r.titulo || video.titulo))}>
              Baixar .txt
            </button>
            <button type="button" className="chip" onClick={() => window.print()}>
              PDF / Imprimir
            </button>
          </div>
        )}
      </header>

      {!r.conteudo_suficiente && r.observacao && (
        <p className="resultado__alerta">
          <b>Atenção:</b> {r.observacao}
        </p>
      )}
      {resultado.transcricao_truncada && (
        <p className="resultado__alerta">A transcrição era muito longa e apenas a parte inicial foi resumida.</p>
      )}

      <div className="abas" role="tablist" aria-label="Partes do resumo" ref={listaRef} onKeyDown={teclado}>
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`${base}-t-${a.id}`}
            aria-selected={aba === a.id}
            aria-controls={`${base}-p-${a.id}`}
            tabIndex={aba === a.id ? 0 : -1}
            className="aba"
            onClick={() => setAba(a.id)}
          >
            <span className="aba__num">{a.num}</span>
            {a.rotulo}
            {contagem[a.id] ? <span className="aba__qtd">{contagem[a.id]}</span> : null}
          </button>
        ))}
      </div>

      <div className="resultado__corpo">
        <section
          role="tabpanel"
          id={`${base}-p-geral`}
          aria-labelledby={`${base}-t-geral`}
          hidden={aba !== 'geral'}
          className="painel-aba painel-aba--geral"
        >
          {r.resumo_geral.split(/\n+/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <section role="tabpanel" id={`${base}-p-conceitos`} aria-labelledby={`${base}-t-conceitos`} hidden={aba !== 'conceitos'} className="painel-aba">
          <dl className="conceitos">
            {r.principais_conceitos.map((c, i) => (
              <div key={i} className="conceito" style={{ '--i': i }}>
                <dt>{c.termo}</dt>
                <dd>{c.explicacao}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section role="tabpanel" id={`${base}-p-perguntas`} aria-labelledby={`${base}-t-perguntas`} hidden={aba !== 'perguntas'} className="painel-aba">
          <div className="perguntas">
            {r.perguntas_respostas.map((q, i) => (
              <details key={i} className="pergunta" style={{ '--i': i }} open={i === 0}>
                <summary>
                  <span className="pergunta__n">{String(i + 1).padStart(2, '0')}</span>
                  {q.pergunta}
                  <span className="pergunta__mais" aria-hidden="true" />
                </summary>
                <p>{q.resposta}</p>
              </details>
            ))}
          </div>
        </section>

        <section role="tabpanel" id={`${base}-p-lembrar`} aria-labelledby={`${base}-t-lembrar`} hidden={aba !== 'lembrar'} className="painel-aba">
          <ul className="lembrar">
            {r.importante_lembrar.map((p, i) => (
              <li key={i} style={{ '--i': i }}>
                {p}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Versão completa só para impressão / PDF */}
      {!exemplo && (
        <div className="so-impressao">
          <pre>{r.texto}</pre>
        </div>
      )}

      {!exemplo && (
        <footer className="resultado__rodape">
          <span className="resultado__meta">
            {resultado.idioma && `Conteúdo em ${IDIOMAS[resultado.idioma] || resultado.idioma}`}
            {FONTES[resultado.fonte_transcricao] && ` · ${FONTES[resultado.fonte_transcricao]}`}
            {resultado.modelo_whisper && ` · Whisper ${resultado.modelo_whisper}`}
            {resultado.modelo_ia && ` · ${resultado.modelo_ia}`}
            {' · resumo gerado por IA, confira com o vídeo.'}
          </span>
          <div className="resultado__acoes">
            {onRegenerar && (
              <button type="button" className="botao botao--fantasma" onClick={onRegenerar}>
                Gerar novamente
              </button>
            )}
            {onNovo && (
              <button type="button" className="botao botao--escuro" onClick={onNovo}>
                Resumir outro vídeo
              </button>
            )}
          </div>
        </footer>
      )}

      <span className={`toast ${aviso ? 'toast--on' : ''}`} role="status">
        {aviso}
      </span>
    </article>
  )
}
