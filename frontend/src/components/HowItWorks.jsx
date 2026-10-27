import { useRef } from 'react'
import { useScrollSteps } from '../hooks/useMotion'
import { LogoMark } from './Logo'
import thumb from '../assets/video-exemplo.webp'

const PASSOS = [
  {
    num: '01',
    titulo: 'Cole o link do YouTube',
    texto: 'Copie o endereço da aula ou do vídeo e cole no campo do topo da página. Links youtube.com, youtu.be e Shorts funcionam.',
    detalhe: 'Só o áudio é baixado, e o arquivo é apagado ao final.',
  },
  {
    num: '02',
    titulo: 'A IA transcreve e analisa',
    texto: 'O Whisper converte a fala em texto, no seu próprio computador. Em seguida, o Gemini lê a transcrição completa para entender o assunto.',
    detalhe: 'Você acompanha cada etapa real enquanto acontece.',
  },
  {
    num: '03',
    titulo: 'O Resume AI organiza para estudo',
    texto: 'O conteúdo vira um material de revisão: resumo geral, principais conceitos, perguntas com respostas e o que é importante lembrar.',
    detalhe: 'Copie, baixe em .txt ou salve como PDF.',
  },
]

/** Scrollytelling: o palco fica fixo enquanto o texto rola; a cena se transforma a cada passo. */
export default function HowItWorks() {
  const ref = useRef(null)
  const passo = useScrollSteps(ref, PASSOS.length)

  return (
    <section id="como-funciona" className="como" ref={ref}>
      <div className="como__grade">
        <div className="como__palco-wrap">
          <div className="como__palco" data-passo={passo} aria-hidden="true">
            <div className="palco__progresso">
              {PASSOS.map((p, i) => (
                <span key={p.num} className={i <= passo ? 'on' : ''} />
              ))}
            </div>

            <div className="palco__cena">
              {/* Moldura que se transforma: tela de vídeo → folha de transcrição → cartão de resumo */}
              <div className="palco__moldura">
                <img className="palco__thumb" src={thumb} alt="" loading="lazy" />
                <span className="palco__play">
                  <svg viewBox="0 0 20 20">
                    <path d="M7 5 L15 10 L7 15 Z" fill="currentColor" />
                  </svg>
                </span>
                <div className="palco__barra-url">
                  <span className="palco__digitado">youtube.com/watch?v=aula</span>
                </div>

                {/* 8 peças que viram onda sonora → linhas de texto → blocos do resumo */}
                <div className="palco__pecas">
                  {Array.from({ length: 8 }, (_, i) => (
                    <i key={i} style={{ '--i': i }} />
                  ))}
                </div>

                <div className="palco__titulos">
                  <span>Resumo geral</span>
                  <span>Conceitos</span>
                  <span>Perguntas</span>
                  <span>Lembrar</span>
                </div>
              </div>

              <div className="palco__robo">
                <LogoMark size={64} />
                <span className="palco__scan" />
              </div>

              <span className="palco__cursor">
                <svg viewBox="0 0 24 24">
                  <path d="M5 3l14 8-6 2-2 6z" />
                </svg>
              </span>
            </div>

            <p className="palco__legenda">
              <span className="mono">{PASSOS[passo].num}</span> {PASSOS[passo].titulo}
            </p>
          </div>
        </div>

        <div className="como__texto">
          <header className="secao-cabeca" data-reveal>
            <span className="kicker">Como funciona</span>
            <h2>
              Do vídeo ao <em>material de estudo</em>, em três passos.
            </h2>
          </header>

          {PASSOS.map((p, i) => (
            <article key={p.num} className={`passo ${i === passo ? 'passo--ativo' : ''}`}>
              <span className="passo__num">{p.num}</span>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
              <p className="passo__detalhe">{p.detalhe}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
