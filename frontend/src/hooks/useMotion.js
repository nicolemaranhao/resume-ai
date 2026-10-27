import { useEffect, useState } from 'react'

export function prefereMenosMovimento() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Revela elementos com [data-reveal] quando entram na tela (um único observer). */
export function useReveal(chave) {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]:not(.is-in)')
    if (prefereMenosMovimento() || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [chave])
}

/**
 * Progresso de rolagem (0 → 1) de uma seção alta, para scrollytelling.
 * Escreve --p no elemento (sem re-render) e devolve o passo atual.
 */
export function useScrollSteps(ref, passos) {
  const [passo, setPasso] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const medir = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0
      el.style.setProperty('--p', p.toFixed(3))
      setPasso(Math.min(passos - 1, Math.floor(p * passos * 0.999)))
    }
    const agendar = () => {
      if (!raf) raf = requestAnimationFrame(medir)
    }
    medir()
    window.addEventListener('scroll', agendar, { passive: true })
    window.addEventListener('resize', agendar)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', agendar)
      window.removeEventListener('resize', agendar)
    }
  }, [ref, passos])
  return passo
}

/** Parallax pelo ponteiro: escreve --mx/--my (-1 → 1). Desligado em toque e reduced-motion. */
export function usePointerParallax(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el || prefereMenosMovimento() || !window.matchMedia('(pointer: fine)').matches) return
    let raf = 0
    let alvo = { x: 0, y: 0 }
    const atual = { x: 0, y: 0 }
    const animar = () => {
      atual.x += (alvo.x - atual.x) * 0.08
      atual.y += (alvo.y - atual.y) * 0.08
      el.style.setProperty('--mx', atual.x.toFixed(3))
      el.style.setProperty('--my', atual.y.toFixed(3))
      raf = Math.abs(alvo.x - atual.x) + Math.abs(alvo.y - atual.y) > 0.002 ? requestAnimationFrame(animar) : 0
    }
    const mover = (e) => {
      const r = el.getBoundingClientRect()
      alvo = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 }
      if (!raf) raf = requestAnimationFrame(animar)
    }
    const sair = () => {
      alvo = { x: 0, y: 0 }
      if (!raf) raf = requestAnimationFrame(animar)
    }
    el.addEventListener('pointermove', mover)
    el.addEventListener('pointerleave', sair)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', mover)
      el.removeEventListener('pointerleave', sair)
    }
  }, [ref])
}

/** Parallax de rolagem global: escreve --sy (px rolados) no <html>, limitado a 1 frame. */
export function useScrollVar() {
  useEffect(() => {
    if (prefereMenosMovimento()) return
    let raf = 0
    const set = () => {
      raf = 0
      document.documentElement.style.setProperty('--sy', String(Math.round(window.scrollY)))
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(set)
    }
    set()
    window.addEventListener('scroll', on, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', on)
    }
  }, [])
}

/** Inclinação 3D de um card seguindo o ponteiro (escreve --rx/--ry). */
export function inclinar(e) {
  if (e.pointerType !== 'mouse' || prefereMenosMovimento()) return
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width - 0.5
  const y = (e.clientY - r.top) / r.height - 0.5
  el.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`)
  el.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`)
  el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`)
  el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`)
}

export function soltar(e) {
  const el = e.currentTarget
  el.style.setProperty('--rx', '0deg')
  el.style.setProperty('--ry', '0deg')
}
