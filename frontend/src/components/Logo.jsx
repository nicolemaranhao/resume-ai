import { useId } from 'react'

/**
 * Marca do Resume AI: um círculo vermelho com "play" arredondado (o vídeo)
 * e um brilho (a IA). Círculo, e não retângulo, para não imitar a marca do YouTube.
 */
export function LogoMark({ size = 40, className = '' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="10" y1="6" x2="54" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff7d8b" />
          <stop offset="0.55" stopColor="#e5233d" />
          <stop offset="1" stopColor="#b3152d" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill={`url(#${id}-g)`} />
      <circle cx="32" cy="32" r="29" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M27 23 L41.5 32 L27 41 Z" fill="#fff" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
      <path
        d="M47 10 C47.5 13.3 48.4 14.2 51.7 14.7 C48.4 15.2 47.5 16.1 47 19.4 C46.5 16.1 45.6 15.2 42.3 14.7 C45.6 14.2 46.5 13.3 47 10 Z"
        fill="#fff"
      />
    </svg>
  )
}

export function Logo({ size = 40 }) {
  return (
    <span className="marca">
      <LogoMark size={size} className="marca__icone" />
      <span className="marca__nome">
        Resume<i>ai</i>
      </span>
    </span>
  )
}
