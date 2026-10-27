// Mesma regra de validação do backend (main.py -> extrair_id_video).
const ID = /^[A-Za-z0-9_-]{11}$/
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'])

export function extrairIdVideo(valor) {
  if (typeof valor !== 'string') return null
  let texto = valor.trim()
  if (!texto || texto.length > 500) return null
  if (!/^https?:\/\//i.test(texto)) texto = `https://${texto}`
  let url
  try {
    url = new URL(texto)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  let id = null
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = url.pathname.slice(1).split('/')[0]
  } else if (HOSTS.has(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const partes = url.pathname.split('/').filter(Boolean)
      if (partes.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(partes[0])) id = partes[1]
    }
  }
  return id && ID.test(id) ? id : null
}

export function validarUrl(valor) {
  if (!valor || !valor.trim()) return 'Cole o link de um vídeo do YouTube para continuar.'
  if (!extrairIdVideo(valor)) {
    if (!/youtu\.?be/i.test(valor)) return 'Esse link não parece ser do YouTube.'
    return 'Não encontramos o vídeo nesse link. Use o endereço completo do vídeo (ex.: youtube.com/watch?v=…).'
  }
  return ''
}

export function formatarDuracao(segundos) {
  if (!segundos) return ''
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = Math.floor(segundos % 60)
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return h ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`
}
