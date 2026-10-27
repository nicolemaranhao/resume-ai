import { useCallback, useEffect, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || '/api'
const INTERVALO_MS = 1500
const MAX_FALHAS_REDE = 4

export const ETAPAS = [
  { id: 'preparando', titulo: 'Preparando vídeo', descricao: 'Lendo informações do vídeo no YouTube' },
  { id: 'extraindo_audio', titulo: 'Extraindo áudio', descricao: 'Baixando apenas a faixa de áudio' },
  { id: 'transcrevendo', titulo: 'Transcrevendo', descricao: 'O Whisper está convertendo fala em texto' },
  { id: 'gerando_resumo', titulo: 'Gerando resumo', descricao: 'O Gemini está organizando o conteúdo' },
]

const ERRO_SEM_SERVIDOR = {
  codigo: 'sem_servidor',
  mensagem: 'Não foi possível conectar ao servidor do Resume AI. Verifique se o backend está rodando (python main.py).',
}

async function lerJson(resposta) {
  const tipo = resposta.headers.get('content-type') || ''
  if (!tipo.includes('application/json')) {
    // Proxy do Vite responde 500/502 em texto quando o Flask está desligado.
    const erro = new Error('resposta não-JSON')
    erro.semServidor = resposta.status >= 500
    throw erro
  }
  return resposta.json()
}

const HISTORICO_KEY = 'resumeai:historico'

export function lerHistorico() {
  try {
    return JSON.parse(localStorage.getItem(HISTORICO_KEY) || '[]')
  } catch {
    return []
  }
}

function salvarHistorico(resultado) {
  try {
    const lista = lerHistorico().filter((h) => h.video?.id !== resultado.video?.id)
    lista.unshift({ ...resultado, salvoEm: Date.now() })
    localStorage.setItem(HISTORICO_KEY, JSON.stringify(lista.slice(0, 6)))
  } catch {
    /* armazenamento indisponível: histórico é opcional */
  }
}

/**
 * Controla um processamento real no backend:
 * cria o job, consulta o status e expõe a etapa atual (sem progresso inventado).
 */
export function useResumo() {
  const [estado, setEstado] = useState('ocioso') // ocioso | enviando | processando | concluido | erro
  const [job, setJob] = useState(null)
  const [erro, setErro] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [inicio, setInicio] = useState(null)
  const [historico, setHistorico] = useState(lerHistorico)
  const timer = useRef(null)
  const ultimaUrl = useRef('')
  const falhas = useRef(0)
  const consultarRef = useRef(null)

  const parar = () => {
    clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => parar, [])

  const finalizar = useCallback((dados) => {
    parar()
    if (dados.etapa === 'concluido') {
      setResultado(dados.resultado)
      setEstado('concluido')
      salvarHistorico(dados.resultado)
      setHistorico(lerHistorico())
    } else {
      setErro(dados.erro || { codigo: 'erro', mensagem: 'O processamento falhou.' })
      setEstado('erro')
    }
  }, [])

  const consultar = useCallback(
    async (id) => {
      try {
        const r = await fetch(`${API}/status/${id}`)
        const dados = await lerJson(r)
        falhas.current = 0
        if (!r.ok) {
          finalizar({ etapa: 'erro', erro: dados.erro })
          return
        }
        setJob(dados)
        if (dados.etapa === 'concluido' || dados.etapa === 'erro') finalizar(dados)
        else timer.current = setTimeout(() => consultarRef.current(id), INTERVALO_MS)
      } catch (e) {
        falhas.current += 1
        console.error('[Resume AI] falha ao consultar status:', e)
        if (falhas.current >= MAX_FALHAS_REDE) finalizar({ etapa: 'erro', erro: ERRO_SEM_SERVIDOR })
        else timer.current = setTimeout(() => consultarRef.current(id), INTERVALO_MS * 2)
      }
    },
    [finalizar],
  )

  useEffect(() => {
    consultarRef.current = consultar
  }, [consultar])

  const iniciar = useCallback(
    async (url, { ignorarCache = false } = {}) => {
      parar()
      ultimaUrl.current = url
      falhas.current = 0
      setErro(null)
      setResultado(null)
      setJob(null)
      setEstado('enviando')
      setInicio(Date.now())
      try {
        const r = await fetch(`${API}/resumir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, ignorar_cache: ignorarCache }),
        })
        const dados = await lerJson(r)
        if (!r.ok) {
          finalizar({ etapa: 'erro', erro: dados.erro })
          return
        }
        setJob(dados)
        if (dados.etapa === 'concluido') finalizar(dados)
        else {
          setEstado('processando')
          timer.current = setTimeout(() => consultar(dados.id), 600)
        }
      } catch (e) {
        console.error('[Resume AI] falha ao iniciar:', e)
        finalizar({ etapa: 'erro', erro: ERRO_SEM_SERVIDOR })
      }
    },
    [consultar, finalizar],
  )

  const tentarNovamente = useCallback(() => {
    if (ultimaUrl.current) iniciar(ultimaUrl.current)
  }, [iniciar])

  const regenerar = useCallback(() => {
    if (ultimaUrl.current) iniciar(ultimaUrl.current, { ignorarCache: true })
  }, [iniciar])

  const abrirDoHistorico = useCallback((item) => {
    parar()
    ultimaUrl.current = `https://www.youtube.com/watch?v=${item.video.id}`
    setErro(null)
    setJob({ etapa: 'concluido', video: item.video, do_cache: true })
    setResultado(item)
    setEstado('concluido')
  }, [])

  const reiniciar = useCallback(() => {
    parar()
    setEstado('ocioso')
    setJob(null)
    setErro(null)
    setResultado(null)
  }, [])

  return {
    estado,
    job,
    erro,
    resultado,
    inicio,
    historico,
    iniciar,
    tentarNovamente,
    regenerar,
    reiniciar,
    abrirDoHistorico,
    ocupado: estado === 'enviando' || estado === 'processando',
  }
}
