/**
 * Os mesmos 5 elementos mudam de forma conforme a etapa (morphing via CSS):
 * preparando = bloco girando · extraindo_audio = onda sonora ·
 * transcrevendo = linhas de texto · gerando_resumo = documento com títulos ·
 * concluido = check · erro = pausa.
 */
export default function Morph({ forma = 'preparando', tamanho = 'md' }) {
  return (
    <div className={`morph morph--${tamanho}`} data-forma={forma} aria-hidden="true">
      <div className="morph__palco">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} className="morph__peca" style={{ '--i': i }} />
        ))}
      </div>
    </div>
  )
}
