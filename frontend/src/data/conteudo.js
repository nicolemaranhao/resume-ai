// Configuração e conteúdo estático do site.

// Preencha quando tiver os links reais. Links vazios não aparecem no site.
export const LINKS = {
  github: 'https://github.com/nicolemaranhao/resume-ai',
  linkedin: '',
  email: '',
}

/**
 * Depoimentos REAIS de usuários. Enquanto a lista estiver vazia, a seção mostra
 * os públicos para quem o produto foi feito. Formato de cada item:
 * { nome: 'Nome Sobrenome', papel: 'Estudante de ADS', texto: '...', foto: '' }
 */
export const DEPOIMENTOS = []

// Exemplo ilustrativo usado na seção "Veja o resultado" (não é saída de um vídeo real).
export const RESUMO_EXEMPLO = {
  video: { titulo: 'Aula: tipos de relacionamento em banco de dados', duracao: 1968 },
  resumo: {
    titulo: 'Tipos de relacionamento (grau) em modelagem de dados',
    resumo_geral:
      'A aula explica o que é o grau de um relacionamento no modelo entidade-relacionamento: a quantidade de entidades que participam de uma mesma relação. São apresentados os relacionamentos unários, binários e ternários, com um exemplo de cada, e como eles costumam ser representados nas tabelas do banco.',
    principais_conceitos: [
      { termo: 'Grau do relacionamento', explicacao: 'Número de entidades diferentes envolvidas em um relacionamento.' },
      { termo: 'Unário (recursivo)', explicacao: 'A entidade se relaciona com ela mesma, como um funcionário que supervisiona outro funcionário.' },
      { termo: 'Binário', explicacao: 'Envolve duas entidades, como Cliente realiza Pedido. É o tipo mais comum.' },
      { termo: 'Ternário (n-ário)', explicacao: 'Três ou mais entidades ao mesmo tempo, como Médico atende Paciente em Hospital.' },
    ],
    perguntas_respostas: [
      { pergunta: 'Qual a diferença entre grau e cardinalidade?', resposta: 'O grau conta quantas entidades participam; a cardinalidade (1:1, 1:N, N:N) indica quantas ocorrências de cada lado podem se relacionar.' },
      { pergunta: 'Como um relacionamento unário vira tabela?', resposta: 'Com uma chave estrangeira que aponta para a própria tabela, como id_supervisor em Funcionario.' },
      { pergunta: 'Por que não quebrar um ternário em três binários?', resposta: 'Porque se perde a informação de qual combinação aconteceu de fato: qual médico atendeu qual paciente em qual hospital.' },
    ],
    importante_lembrar: [
      'Grau = quantidade de entidades no relacionamento.',
      'Binário é o caso mais comum.',
      'Ternários normalmente viram uma tabela própria com três chaves estrangeiras.',
      'Não confundir grau com cardinalidade.',
    ],
    conteudo_suficiente: true,
    observacao: '',
  },
}

export const PUBLICOS = [
  { titulo: 'Estudantes universitários', texto: 'Revisar aulas gravadas e videoaulas sem precisar assistir tudo de novo.', forma: 'cubo' },
  { titulo: 'Quem estuda para provas', texto: 'Transformar aulões e revisões em perguntas para treinar.', forma: 'piramide' },
  { titulo: 'Autodidatas', texto: 'Organizar o que aprendeu em tutoriais, palestras e cursos livres.', forma: 'esfera' },
  { titulo: 'Profissionais em atualização', texto: 'Extrair os pontos principais de talks e webinars técnicos.', forma: 'anel' },
]
