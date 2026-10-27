import { useEffect, useState } from 'react'
import { ETAPAS } from '../hooks/useResumo'
import { formatarDuracao } from '../lib/youtube'
import Morph from './Morph'

function Cronometro({ inicio, parado }) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (parado) return
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [parado])
  const s = Math.max(0, Math.floor((agora - inicio) / 1000))
  return <span className="mono">{formatarDuracao(s) || '0:00'}</span>
}

const DICA_ERRO = {
  sem_servidor: 'Abra um terminal na pasta do projeto e rode: python main.py',
  sem_chave: 'Crie o arquivo .env com GEMINI_API_KEY (veja .env.example) e reinicie o backend.',
  modelo_indisponivel: 'Defina em GEMINI_MODELS um modelo disponível na sua conta.',
  bloqueio_youtube: 'Atualize o yt-dlp com: pip install -U yt-dlp',
}

export default function ProcessPanel({ estado, job, erro, inicio, onRetry, onReset }) {
  const etapaAtual = estado === 'enviando' ? 'enviando' : job?.etapa
  const indiceAtual = ETAPAS.findIndex((e) => e.id === etapaAtual)
  // Em caso de erro, a etapa que falhou é a última registrada antes do erro.
  const historico = job?.historico?.map((h) => h.etapa) || []
  const etapaQueFalhou = estado === 'erro' ? historico.filter((e) => e !== 'erro').at(-1) : null
  const indiceFalha = ETAPAS.findIndex((e) => e.id === etapaQueFalhou)
  const usaLegenda = job?.fonte_transcricao?.startsWith('legenda')

  const forma =
    estado === 'erro' ? 'erro' : estado === 'concluido' ? 'concluido' : indiceAtual >= 0 ? etapaAtual : 'preparando'

  const titulo =
    estado === 'erro'
      ? 'Não foi possível concluir'
      : estado === 'concluido'
        ? job?.do_cache
          ? 'Resumo encontrado'
          : 'Resumo concluído'
        : estado === 'enviando'
          ? 'Enviando para o servidor'
          : etapaAtual === 'fila'
            ? 'Na fila'
            : ETAPAS[indiceAtual]?.titulo || 'Processando'

  return (
    <section className={`painel painel--${estado}`} aria-live="polite" aria-busy={estado === 'processando' || estado === 'enviando'}>
      <div className="painel__topo">
        <Morph forma={forma} />
        <div className="painel__titulos">
          <span className="painel__kicker">
            {estado === 'concluido' ? 'Pronto' : estado === 'erro' ? 'Erro' : 'Processando'}
            {inicio && (
              <>
                {' · '}
                <Cronometro inicio={inicio} parado={estado === 'concluido' || estado === 'erro'} />
              </>
            )}
          </span>
          <strong className="painel__titulo">{titulo}</strong>
          {job?.video?.titulo && (
            <span className="painel__video">
              {job.video.titulo}
              {job.video.duracao ? ` · ${formatarDuracao(job.video.duracao)}` : ''}
            </span>
          )}
        </div>
      </div>

      {estado !== 'concluido' && (
        <ol className="etapas">
          {ETAPAS.map((e, i) => {
            let st = 'pendente'
            if (estado === 'erro') st = i < indiceFalha ? 'feita' : i === indiceFalha ? 'falhou' : 'pendente'
            else if (i < indiceAtual) st = 'feita'
            else if (i === indiceAtual) st = 'ativa'
            // Com legenda do YouTube, o áudio não é baixado: a etapa é pulada, não "concluída".
            if (e.id === 'extraindo_audio' && usaLegenda && !historico.includes('extraindo_audio')) st = 'pulada'
            const descricao =
              e.id === 'transcrevendo' && usaLegenda ? 'Lendo as legendas do próprio vídeo' : e.descricao
            return (
              <li key={e.id} className={`etapa etapa--${st}`}>
                <span className="etapa__marca" aria-hidden="true" />
                <span className="etapa__texto">
                  <b>{e.titulo}</b>
                  <small>
                    {st === 'ativa'
                      ? descricao
                      : st === 'feita'
                        ? 'Concluído'
                        : st === 'falhou'
                          ? 'Falhou aqui'
                          : st === 'pulada'
                            ? 'Não foi preciso: o vídeo tem legenda'
                            : 'Aguardando'}
                  </small>
                </span>
                <span className="sr-only">{st}</span>
              </li>
            )
          })}
        </ol>
      )}

      {job?.aviso && estado === 'processando' && <p className="painel__aviso">{job.aviso}</p>}
      {etapaAtual === 'transcrevendo' && !job?.aviso && (
        <p className="painel__nota">A transcrição é a etapa mais demorada: depende da duração do vídeo e do seu computador.</p>
      )}
      {job?.posicao_fila > 0 && etapaAtual === 'fila' && (
        <p className="painel__nota">Há outro vídeo sendo processado. O seu começa em seguida.</p>
      )}

      {estado === 'erro' && erro && (
        <div className="painel__erro" role="alert">
          <p>{erro.mensagem}</p>
          {DICA_ERRO[erro.codigo] && <p className="painel__dica">{DICA_ERRO[erro.codigo]}</p>}
          <div className="painel__acoes">
            {erro.codigo !== 'url_invalida' && (
              <button type="button" className="botao botao--laranja" onClick={onRetry}>
                Tentar novamente
              </button>
            )}
            <button type="button" className="botao botao--fantasma" onClick={onReset}>
              Usar outro link
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
