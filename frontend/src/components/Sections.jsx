import { inclinar, soltar } from '../hooks/useMotion'
import { DEPOIMENTOS, LINKS, PUBLICOS, RESUMO_EXEMPLO } from '../data/conteudo'
import { Logo } from './Logo'
import ResultView from './ResultView'

/* ───────────── Veja o resultado ───────────── */
export function Demo() {
  return (
    <section id="resultado-exemplo" className="demo">
      <div className="container">
        <header className="secao-cabeca secao-cabeca--centro" data-reveal>
          <span className="kicker">Veja o resultado</span>
          <h2>
            Um resumo que você consegue <em>estudar</em>, não só ler.
          </h2>
          <p>
            Cada vídeo vira quatro partes navegáveis. Explore as abas abaixo: este é um exemplo ilustrativo baseado em
            uma aula de banco de dados.
          </p>
        </header>
        <div className="demo__palco" data-reveal>
          <div className="demo__camada demo__camada--1" aria-hidden="true" />
          <div className="demo__camada demo__camada--2" aria-hidden="true" />
          <ResultView resultado={RESUMO_EXEMPLO} exemplo />
        </div>
      </div>
    </section>
  )
}

/* ───────────── Recursos ───────────── */
const RECURSOS = [
  {
    titulo: 'Resumos organizados',
    texto: 'Sempre na mesma estrutura, para você saber onde encontrar cada coisa.',
    objeto: 'folhas',
    grande: true,
  },
  { titulo: 'Conceitos explicados', texto: 'Os termos centrais do vídeo, cada um com uma explicação curta.', objeto: 'chips' },
  { titulo: 'Perguntas para revisar', texto: 'Perguntas com respostas tiradas do próprio conteúdo para testar o que ficou.', objeto: 'interrogacao' },
  { titulo: 'Estudo mais eficiente', texto: 'Revise os pontos principais antes de decidir quais trechos assistir de novo.', objeto: 'aneis' },
  {
    titulo: 'Direto do YouTube',
    texto: 'Cole o link e pronto: não precisa baixar o vídeo nem copiar legendas.',
    objeto: 'play',
    grande: true,
  },
]

function Objeto3D({ tipo }) {
  if (tipo === 'folhas')
    return (
      <div className="obj obj--folhas">
        {[0, 1, 2].map((i) => (
          <div key={i} className="obj__folha" style={{ '--i': i }}>
            <i />
            <i />
          </div>
        ))}
      </div>
    )
  if (tipo === 'chips')
    return (
      <div className="obj obj--chips">
        {['entidade', 'grau', 'relação'].map((t, i) => (
          <span key={t} style={{ '--i': i }}>
            {t}
          </span>
        ))}
      </div>
    )
  if (tipo === 'interrogacao')
    return (
      <div className="obj obj--interrogacao">
        <span className="obj__balao">?</span>
        <span className="obj__balao obj__balao--resp" />
      </div>
    )
  if (tipo === 'aneis')
    return (
      <div className="obj obj--aneis">
        <i />
        <b />
      </div>
    )
  return (
    <div className="obj obj--play">
      <div className="obj__botao">
        <svg viewBox="0 0 20 20">
          <path d="M7.5 5.5 L14.5 10 L7.5 14.5 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

/* Ícones de traço fino para os públicos (minimalistas, 24x24) */
const ICONES = {
  cubo: (
    <path d="M3 9.5 12 5l9 4.5-9 4.5L3 9.5Zm3.5 2v4.2c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.2M21 9.5v5" />
  ),
  piramide: <path d="M5 4h14v16H5zM8.5 9.5l1.5 1.5 3-3M8.5 15h7" />,
  esfera: <path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5v-13ZM12 6v13" />,
  anel: <path d="M4 8h16v11H4zM9 8V5.5h6V8M4 13h16" />,
}

export function Features() {
  return (
    <section id="recursos" className="recursos">
      <div className="container">
        <header className="secao-cabeca" data-reveal>
          <span className="kicker">Recursos</span>
          <h2>
            Feito para o jeito que você <em>realmente</em> estuda.
          </h2>
        </header>
        <div className="bento">
          {RECURSOS.map((r, i) => (
            <article
              key={r.titulo}
              className={`bento__card ${r.grande ? 'bento__card--grande' : ''}`}
              data-reveal
              style={{ '--d': `${i * 70}ms` }}
              onPointerMove={inclinar}
              onPointerLeave={soltar}
            >
              <div className="bento__objeto">
                <Objeto3D tipo={r.objeto} />
              </div>
              <div className="bento__texto">
                <h3>{r.titulo}</h3>
                <p>{r.texto}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────── Sobre ───────────── */
const PIPELINE = [
  ['yt-dlp', 'baixa o áudio'],
  ['Whisper', 'transcreve a fala'],
  ['Gemini', 'organiza o conteúdo'],
  ['React + Flask', 'interface e servidor'],
]

export function About() {
  return (
    <section id="sobre" className="sobre">
      <span className="sobre__forma sobre__forma--1" aria-hidden="true" />
      <span className="sobre__forma sobre__forma--2" aria-hidden="true" />
      <div className="container sobre__grade">
        <div>
          <span className="kicker" data-reveal>
            Sobre o Resume AI
          </span>
          <p className="sobre__manifesto" data-reveal>
            Muita coisa boa se aprende em vídeo. O difícil é <em>voltar</em> a ela depois.
          </p>
        </div>
        <div className="sobre__texto" data-reveal>
          <p>
            Uma aula de uma hora costuma ter poucos minutos de ideias que você realmente precisa revisar. O Resume AI
            existe para encontrar essas ideias e deixá-las organizadas: o assunto principal, os conceitos, perguntas
            para testar o entendimento e o que vale guardar.
          </p>
          <p>
            O resumo é gerado a partir do que foi dito no vídeo. Ele não substitui a aula, mas ajuda a revisar, a
            decidir o que assistir de novo e a estudar com mais foco.
          </p>
          <ul className="pipeline">
            {PIPELINE.map(([nome, papel], i) => (
              <li key={nome} style={{ '--i': i }}>
                <b>{nome}</b>
                <span>{papel}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ───────────── Feedback / públicos ───────────── */
export function Audience() {
  const temDepoimentos = DEPOIMENTOS.length > 0
  return (
    <section id="feedback" className="publico">
      <div className="container">
        <header className="secao-cabeca secao-cabeca--centro" data-reveal>
          <span className="kicker">{temDepoimentos ? 'Quem usa' : 'Para quem é'}</span>
          <h2>
            {temDepoimentos ? (
              <>
                O que dizem sobre o <em>Resume AI</em>
              </>
            ) : (
              <>
                Feito para quem <em>aprende com vídeos</em>.
              </>
            )}
          </h2>
        </header>

        {temDepoimentos ? (
          <div className="depoimentos">
            {DEPOIMENTOS.map((d, i) => (
              <figure key={i} className="depoimento" data-reveal style={{ '--d': `${i * 80}ms` }}>
                <blockquote>{d.texto}</blockquote>
                <figcaption>
                  {d.foto && <img src={d.foto} alt="" width="40" height="40" loading="lazy" />}
                  <b>{d.nome}</b>
                  <span>{d.papel}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <>
            <div className="publicos">
              {PUBLICOS.map((p, i) => (
                <article
                  key={p.titulo}
                  className="publico__card"
                  data-reveal
                  style={{ '--d': `${i * 80}ms` }}
                  onPointerMove={inclinar}
                  onPointerLeave={soltar}
                >
                  <span className="icone" aria-hidden="true">
                    <svg viewBox="0 0 24 24">{ICONES[p.forma]}</svg>
                  </span>
                  <h3>{p.titulo}</h3>
                  <p>{p.texto}</p>
                </article>
              ))}
            </div>
            <div className="publico__convite" data-reveal>
              <p>
                O Resume AI ainda está no começo. Os depoimentos de quem usar o produto vão aparecer aqui. Por enquanto,
                o melhor jeito de conhecer é testar com uma aula sua.
              </p>
              <a href="#inicio" className="botao botao--laranja">
                Testar com um vídeo
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

/* ───────────── Footer ───────────── */
export function Footer() {
  const contatos = [
    LINKS.github && ['GitHub', LINKS.github],
    LINKS.linkedin && ['LinkedIn', LINKS.linkedin],
    LINKS.email && ['E-mail', `mailto:${LINKS.email}`],
  ].filter(Boolean)

  return (
    <footer className="rodape">
      <div className="container">
        <div className="rodape__cta">
          <p>Tem uma aula para revisar?</p>
          <a href="#inicio" className="botao botao--laranja botao--grande">
            Gerar meu resumo
          </a>
        </div>

        <div className="rodape__grade">
          <div className="rodape__marca">
            <Logo size={40} />
            <p>Transforma vídeos do YouTube em resumos organizados para estudo.</p>
          </div>

          <nav aria-label="Rodapé">
            <h4>Produto</h4>
            <a href="#inicio">Gerar resumo</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#resultado-exemplo">Exemplo de resultado</a>
            <a href="#recursos">Recursos</a>
          </nav>

          <nav aria-label="Informações">
            <h4>Sobre</h4>
            <a href="#sobre">O projeto</a>
            <a href="#feedback">Para quem é</a>
            {contatos.map(([nome, href]) => (
              <a key={nome} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                {nome}
              </a>
            ))}
          </nav>

          <div className="rodape__stack">
            <h4>Tecnologia</h4>
            <p>React · Vite · Flask · yt-dlp · FFmpeg · Whisper · Google Gemini</p>
            <p className="rodape__nota">Resumos gerados por IA podem conter erros. Confira as informações com o vídeo original.</p>
          </div>
        </div>

        <div className="rodape__base">
          <span>© {new Date().getFullYear()} Resume AI</span>
          <a href="#inicio">Voltar ao topo ↑</a>
        </div>
      </div>
      <div className="rodape__gigante" aria-hidden="true">
        Resume AI
      </div>
    </footer>
  )
}
