# Resume AI

Transforma aulas e vídeos do YouTube em resumos organizados para estudo.

```
URL do YouTube → yt-dlp (só o áudio) → Whisper (transcrição local) → Gemini (resumo estruturado) → React
```

O resultado sempre tem quatro partes: **resumo geral**, **principais conceitos**, **perguntas e respostas** e **o que é importante lembrar**. Dá para copiar, baixar em `.txt` ou salvar como PDF.

## Tecnologias

| Camada | Stack |
| --- | --- |
| Frontend | React 19, Vite, CSS puro (3D com CSS/SVG, sem WebGL) |
| Backend | Python, Flask, flask-cors |
| Vídeo e áudio | yt-dlp, FFmpeg |
| Transcrição | openai-whisper (roda no seu computador) |
| IA generativa | Google Gemini (`google-genai`), com saída JSON estruturada |

## Como rodar

Pré-requisitos: **Python 3.10+**, **Node.js 20+ (LTS)** e **FFmpeg** (`winget install ffmpeg` no Windows).

### Jeito rápido (Windows)

1. Dê dois cliques em **`instalar.bat`**. Ele cria a `.venv`, instala tudo, cria o `.env` e no final roda a verificação.
2. Abra o arquivo **`.env`** e cole sua chave em `GEMINI_API_KEY=` (crie a chave em https://aistudio.google.com/apikey).
3. Dê dois cliques em **`iniciar.bat`**. Ele abre duas janelas (backend e frontend) e o site em http://localhost:5173.

### Jeito manual

```bash
# Terminal 1 — backend (na raiz do projeto)
python -m venv .venv
.venv\Scripts\activate            # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # Linux/macOS: cp .env.example .env  → depois cole a chave
python main.py --verificar        # confere Python, pacotes, FFmpeg, chave e modelos do Gemini
python main.py                    # sobe em http://127.0.0.1:5000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev                       # abre em http://localhost:5173
```

Na primeira vez que o backend sobe, o Whisper baixa o modelo (~140 MB para o `base`). Isso acontece uma vez só.

## Configuração (`.env`)

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Chave da API do Gemini (obrigatória). |
| `GEMINI_MODELS` | `gemini-3.5-flash-lite,gemini-3.5-flash` | Modelos tentados em ordem. Se nenhum existir na sua conta, o backend consulta a API e usa o Flash mais recente disponível (e mostra no terminal qual usou). |
| `USAR_LEGENDAS` | `todas` | `todas`: usa a legenda do autor ou, se não houver, a automática no idioma original. `manual`: só legenda do autor. `nao`: sempre Whisper. |
| `WHISPER_MODEL` | `base` | `tiny`, `base`, `small`, `medium`, `turbo`. Quanto maior, mais preciso e mais lento. |
| `MAX_DURACAO_MIN` | `120` | Vídeos mais longos são recusados com uma mensagem clara. |
| `AVISO_LONGO_MIN` | `20` | Acima disso, a interface avisa que vai demorar. |

## API

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/api/resumir` | `{ "url": "...", "ignorar_cache": false }` → cria um job (`202`) ou devolve o resumo do cache (`200`). |
| `GET` | `/api/status/<id>` | Etapa real: `fila`, `preparando`, `extraindo_audio`, `transcrevendo`, `gerando_resumo`, `concluido` ou `erro`. |
| `GET` | `/api/health` | Mostra se a chave está configurada, se o FFmpeg foi encontrado e qual modelo do Whisper está em uso. |

Os erros sempre voltam em JSON: `{ "erro": { "codigo": "cota_excedida", "mensagem": "..." } }`.

## Testes

```bash
python -m unittest discover tests -v     # backend (yt-dlp, Whisper e Gemini simulados, sem rede)
cd frontend && npm run lint && npm run build
```

## Problemas comuns

| Mensagem | Solução |
| --- | --- |
| "Não foi possível conectar ao servidor" | O backend não está rodando: abra o `iniciar.bat` ou rode `python main.py`. |
| "A chave GEMINI_API_KEY não está configurada" | Preencha o `.env` e reinicie o backend. |
| "O YouTube bloqueou temporariamente o download" | `.venv\Scripts\python -m pip install -U yt-dlp` |
| "Falha ao transcrever o áudio" | FFmpeg ausente: `winget install ffmpeg` e abra um terminal novo. |
| "O limite de uso da API do Gemini foi atingido" | Cota gratuita esgotada; espere alguns minutos. |

## Decisões técnicas

- **Processamento em segundo plano + polling.** Antes, um único POST ficava minutos aberto. Isso causava `Failed to fetch` e, com o reloader do Flask, `ERR_CONNECTION_REFUSED`. Agora o backend devolve um job na hora e a interface mostra a etapa real, sem barras de progresso inventadas.
- **Legendas antes do Whisper.** Se o vídeo tem legenda (do autor ou automática no idioma original), ela é usada direto: sem baixar áudio e sem transcrever. Em vídeos longos isso reduz o tempo de minutos para segundos. A interface mostra a fonte usada.
- **O Whisper é carregado uma única vez**, no início do servidor, e reaproveitado entre os pedidos.
- **O áudio não é mais convertido para MP3.** O Whisper decodifica m4a/webm direto pelo FFmpeg, então a conversão só gastava tempo. A pasta temporária é apagada no fim de cada job, inclusive quando dá erro.
- **Saída estruturada do Gemini (JSON + schema).** O frontend não depende mais de "adivinhar" títulos no texto, que era a causa das seções vazias.
- **Cache por vídeo** em `cache/<id>.json`: o mesmo link não é reprocessado. Use "Gerar novamente" para ignorar o cache.
- **Um vídeo por vez.** O Whisper consome muita CPU e RAM; os pedidos seguintes entram na fila.
