import { useRef } from 'react'
import { usePointerParallax } from '../hooks/useMotion'
import { LogoMark } from './Logo'
import thumb from '../assets/video-exemplo.webp'

/**
 * Composição 3D do hero, feita só com CSS 3D + SVG (sem WebGL).
 * Vídeo → transcrição → IA → resumo, orbitando um prisma central.
 * O estado real do processamento muda a "energia" da cena (data-ativo).
 */
export default function HeroScene({ etapa }) {
  const ref = useRef(null)
  usePointerParallax(ref)
  const ativo = etapa && etapa !== 'ocioso'

  return (
    <div className="cena" ref={ref} data-ativo={ativo ? 'sim' : 'nao'} aria-hidden="true">
      <div className="cena__rig">
        <div className="orbita orbita--a" />

        {/* Prisma central: o "play" do vídeo girando devagar */}
        <div className="prisma">
          <div className="prisma__giro">
            <div className="prisma__f prisma__f--frente">
              <svg viewBox="0 0 40 40">
                <path d="M14 10 L31 20 L14 30 Z" fill="currentColor" />
              </svg>
            </div>
            <div className="prisma__f prisma__f--dir" />
            <div className="prisma__f prisma__f--tras" />
            <div className="prisma__f prisma__f--esq" />
            <div className="prisma__f prisma__f--topo" />
            <div className="prisma__f prisma__f--base" />
          </div>
        </div>

        {/* Fluxo de conhecimento */}
        <svg className="fluxo" viewBox="0 0 600 520" preserveAspectRatio="none">
          <path className="fluxo__trilho" d="M110 120 C 200 140, 230 230, 300 260 S 430 330, 500 400" />
          <path className="fluxo__pulso" d="M110 120 C 200 140, 230 230, 300 260 S 430 330, 500 400" />
        </svg>

        <div className="flut flut--video" style={{ '--z': '140px' }}>
          <div className="cartao cartao--video">
            <div className="cartao__thumb">
              <img src={thumb} alt="" loading="eager" />
              <span className="cartao__play">
                <svg viewBox="0 0 20 20">
                  <path d="M7 5 L15 10 L7 15 Z" fill="currentColor" />
                </svg>
              </span>
              <span className="cartao__barra" />
            </div>
            <div className="cartao__rodape">
              <span className="pilula pilula--escura">YouTube</span>
              <span className="cartao__mono">aula.mp4</span>
            </div>
          </div>
        </div>

        <div className="flut flut--trans" style={{ '--z': '70px' }}>
          <div className="cartao cartao--trans">
            <span className="cartao__rotulo">Transcrição</span>
            <div className="onda">
              {Array.from({ length: 12 }, (_, i) => (
                <i key={i} style={{ '--i': i }} />
              ))}
            </div>
            <p className="cartao__texto">
              “…o grau indica quantas entidades participam do relacionamento…”
              <span className="cursor" />
            </p>
          </div>
        </div>

        <div className="flut flut--ia" style={{ '--z': '190px' }}>
          <div className="cartao cartao--ia">
            <LogoMark size={44} className="cartao__marca" />
            <div>
              <span className="cartao__rotulo">IA</span>
              <strong>Analisando</strong>
            </div>
            <span className="radar" />
          </div>
        </div>

        <div className="flut flut--resumo" style={{ '--z': '110px' }}>
          <div className="cartao cartao--resumo">
            <span className="cartao__rotulo">Resumo para estudo</span>
            <ul>
              <li>
                <i /> Resumo geral
              </li>
              <li>
                <i /> Principais conceitos
              </li>
              <li>
                <i /> Perguntas e respostas
              </li>
              <li>
                <i /> Para lembrar
              </li>
            </ul>
          </div>
        </div>

        <span className="forma forma--esfera" style={{ '--z': '40px' }} />
      </div>
    </div>
  )
}
