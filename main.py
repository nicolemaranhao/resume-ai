"""
Resume AI — backend Flask.

Fluxo: URL do YouTube -> yt-dlp (áudio) -> Whisper (transcrição) -> Gemini (resumo estruturado)

O processamento roda em segundo plano (um "job" por vídeo). O frontend cria o job com
POST /api/resumir e acompanha as etapas REAIS com GET /api/status/<job_id>.
Assim a requisição HTTP nunca fica minutos aberta (causa do "Failed to fetch" antigo).
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent


# ---------------------------------------------------------------------------
# Configuração (.env opcional, sem dependência extra)
# ---------------------------------------------------------------------------
def carregar_env(caminho: Path) -> None:
    """Lê KEY=VALUE de um .env simples. Variáveis já definidas no sistema têm prioridade."""
    if not caminho.exists():
        return
    for linha in caminho.read_text(encoding="utf-8-sig").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        os.environ.setdefault(chave.strip(), valor.strip().strip('"').strip("'"))


carregar_env(BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
# Ordem de tentativa. O primeiro que responder é usado. Configure no .env se algum nome mudar.
GEMINI_MODELS = [
    m.strip()
    for m in os.getenv("GEMINI_MODELS", "gemini-3.5-flash-lite,gemini-3.5-flash").split(",")
    if m.strip()
]
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
# Legendas do YouTube: "todas" (manuais e automáticas no idioma original), "manual" (só legendas
# enviadas pelo autor) ou "nao" (sempre Whisper). Usar legenda pula o download e a transcrição.
USAR_LEGENDAS = os.getenv("USAR_LEGENDAS", "todas").strip().lower()
MAX_DURACAO_MIN = int(os.getenv("MAX_DURACAO_MIN", "120"))
AVISO_LONGO_MIN = int(os.getenv("AVISO_LONGO_MIN", "20"))
MAX_CARACTERES_TRANSCRICAO = int(os.getenv("MAX_CARACTERES_TRANSCRICAO", "600000"))
MIN_CARACTERES_TRANSCRICAO = 150
CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("resume-ai")


# ---------------------------------------------------------------------------
# Erros de domínio: mensagem segura para o usuário + código para o frontend
# ---------------------------------------------------------------------------
class ErroProcessamento(Exception):
    def __init__(self, codigo: str, mensagem: str, http: int = 400):
        super().__init__(mensagem)
        self.codigo = codigo
        self.mensagem = mensagem
        self.http = http


# ---------------------------------------------------------------------------
# Validação de URL (também feita no frontend, mas o backend não confia nele)
# ---------------------------------------------------------------------------
ID_REGEX = re.compile(r"^[A-Za-z0-9_-]{11}$")
HOSTS_YOUTUBE = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"}


def extrair_id_video(url: str) -> str | None:
    if not isinstance(url, str) or len(url) > 500:
        return None
    url = url.strip()
    if not re.match(r"^https?://", url):
        url = "https://" + url
    try:
        p = urlparse(url)
    except ValueError:
        return None
    host = (p.hostname or "").lower()
    candidato = None
    if host in {"youtu.be", "www.youtu.be"}:
        candidato = p.path.lstrip("/").split("/")[0]
    elif host in HOSTS_YOUTUBE:
        if p.path == "/watch":
            candidato = parse_qs(p.query).get("v", [None])[0]
        else:
            partes = [x for x in p.path.split("/") if x]
            if len(partes) >= 2 and partes[0] in {"shorts", "embed", "live", "v"}:
                candidato = partes[1]
    if candidato and ID_REGEX.match(candidato):
        return candidato
    return None


# ---------------------------------------------------------------------------
# Whisper: carregado UMA vez e reutilizado (antes era recarregado a cada pedido)
# ---------------------------------------------------------------------------
_whisper_model = None
_whisper_lock = threading.Lock()


def obter_whisper():
    global _whisper_model
    with _whisper_lock:
        if _whisper_model is None:
            import torch
            import whisper

            dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
            inicio = time.time()
            log.info("Carregando Whisper '%s' em %s...", WHISPER_MODEL, dispositivo)
            _whisper_model = whisper.load_model(WHISPER_MODEL, device=dispositivo)
            log.info("Whisper carregado em %.1fs", time.time() - inicio)
        return _whisper_model


def transcrever(caminho_audio: str) -> dict:
    import torch

    modelo = obter_whisper()
    resultado = modelo.transcribe(
        caminho_audio,
        fp16=torch.cuda.is_available(),  # fp16 não existe em CPU (gerava aviso)
        verbose=None,
    )
    texto = (resultado.get("text") or "").strip()
    return {"texto": texto, "idioma": resultado.get("language")}


# ---------------------------------------------------------------------------
# YouTube
# ---------------------------------------------------------------------------
def _ydl_opts_base() -> dict:
    return {"quiet": True, "no_warnings": True, "noplaylist": True, "logger": log}


def obter_info(url: str) -> dict:
    import yt_dlp

    try:
        with yt_dlp.YoutubeDL(_ydl_opts_base()) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        msg = str(e).lower()
        log.warning("yt-dlp (info) falhou: %s", e)
        if any(s in msg for s in ("unable to connect", "proxy", "timed out", "getaddrinfo", "connection")):
            raise ErroProcessamento(
                "sem_conexao", "O servidor não conseguiu se conectar ao YouTube. Verifique a internet.", 502
            )
        if "private video" in msg:
            raise ErroProcessamento("video_privado", "Este vídeo é privado.")
        if "not a bot" in msg:
            raise ErroProcessamento(
                "bloqueio_youtube",
                "O YouTube bloqueou temporariamente o download. Atualize o yt-dlp (pip install -U yt-dlp) e tente de novo.",
                502,
            )
        if "confirm your age" in msg or "age-restricted" in msg or "members-only" in msg:
            raise ErroProcessamento(
                "video_restrito", "O YouTube exige login para este vídeo (restrição de idade ou de membros)."
            )
        if "unavailable" in msg or "not available" in msg:
            raise ErroProcessamento("video_indisponivel", "Este vídeo não está disponível.")
        raise ErroProcessamento(
            "falha_youtube", "Não foi possível acessar o vídeo no YouTube. Verifique o link e sua conexão."
        )
    if info.get("is_live") or info.get("live_status") in {"is_live", "is_upcoming"}:
        raise ErroProcessamento("video_ao_vivo", "Transmissões ao vivo ainda não são suportadas.")
    return info


def baixar_audio(url: str, pasta: str) -> str:
    """Baixa só o áudio, SEM converter para MP3.
    O Whisper já decodifica m4a/webm via FFmpeg; a conversão para MP3 só gastava tempo."""
    import yt_dlp

    opts = {
        **_ydl_opts_base(),
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "outtmpl": os.path.join(pasta, "%(id)s.%(ext)s"),
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            caminho = ydl.prepare_filename(info)
    except yt_dlp.utils.DownloadError as e:
        log.warning("yt-dlp (download) falhou: %s", e)
        raise ErroProcessamento("falha_download", "Falha ao baixar o áudio do vídeo. Tente novamente.")
    if not os.path.exists(caminho):
        arquivos = list(Path(pasta).iterdir())
        if not arquivos:
            raise ErroProcessamento("falha_download", "O áudio não foi baixado.")
        caminho = str(arquivos[0])
    return caminho


# ---------------------------------------------------------------------------
# Legendas do YouTube (atalho: quando existem, não é preciso baixar áudio nem rodar o Whisper)
# ---------------------------------------------------------------------------
IDIOMAS_PREFERIDOS = ["pt-BR", "pt", "pt-PT", "en", "en-US", "en-GB", "es"]


def _escolher_faixa(faixas: dict, preferidos: list[str]) -> tuple[str, list] | None:
    faixas = {k: v for k, v in (faixas or {}).items() if v and k != "live_chat"}
    for idioma in preferidos:
        if idioma and idioma in faixas:
            return idioma, faixas[idioma]
    return None


def escolher_legenda(info: dict) -> dict | None:
    """Escolhe a melhor faixa de legenda. Manual sempre vence automática.
    Automáticas só no idioma ORIGINAL do vídeo (as traduzidas pelo YouTube ficam de fora)."""
    if USAR_LEGENDAS in {"nao", "não", "no", "false", "0"}:
        return None
    original = (info.get("language") or "").strip()
    base = original.split("-")[0] if original else ""
    manuais = info.get("subtitles") or {}
    achado = _escolher_faixa(manuais, [original, base] + IDIOMAS_PREFERIDOS)
    if not achado and manuais:
        # idioma inesperado, mas é legenda do autor: serve
        achado = _escolher_faixa(manuais, list(manuais))
    if achado:
        return {"idioma": achado[0], "formatos": achado[1], "tipo": "legenda_manual"}
    if USAR_LEGENDAS == "manual" or not original:
        return None
    automaticas = info.get("automatic_captions") or {}
    achado = _escolher_faixa(automaticas, [f"{original}-orig", original, f"{base}-orig", base])
    if achado:
        return {"idioma": achado[0].replace("-orig", ""), "formatos": achado[1], "tipo": "legenda_automatica"}
    return None


_TAG = re.compile(r"<[^>]+>")
_TEMPO = re.compile(r"^\d{1,2}:\d{2}(:\d{2})?[.,]\d{3}\s+-->")


def texto_de_json3(bruto: str) -> str:
    dados = json.loads(bruto)
    partes = []
    for ev in dados.get("events", []):
        trecho = "".join(seg.get("utf8", "") for seg in ev.get("segs") or [])
        trecho = trecho.replace("\n", " ").strip()
        if trecho:
            partes.append(trecho)
    return re.sub(r"\s+", " ", " ".join(partes)).strip()


def texto_de_vtt(bruto: str) -> str:
    linhas, anterior = [], None
    for linha in bruto.splitlines():
        linha = linha.strip()
        if (
            not linha
            or linha.startswith(("WEBVTT", "Kind:", "Language:", "NOTE", "STYLE"))
            or _TEMPO.match(linha)
            or linha.isdigit()
        ):
            continue
        linha = _TAG.sub("", linha).strip()
        # legendas automáticas em VTT repetem a linha anterior ("rolagem")
        if linha and linha != anterior:
            linhas.append(linha)
            anterior = linha
    return re.sub(r"\s+", " ", " ".join(linhas)).strip()


def baixar_legenda(escolha: dict) -> str | None:
    import yt_dlp

    formatos = {f.get("ext"): f.get("url") for f in escolha["formatos"] if f.get("url")}
    for ext, conversor in (("json3", texto_de_json3), ("vtt", texto_de_vtt)):
        if ext not in formatos:
            continue
        try:
            with yt_dlp.YoutubeDL(_ydl_opts_base()) as ydl:
                bruto = ydl.urlopen(formatos[ext]).read().decode("utf-8", "replace")
            texto = conversor(bruto)
            if texto:
                return texto
        except Exception as e:  # legenda é só um atalho: se falhar, usa o Whisper
            log.warning("Falha ao ler legenda (%s): %s", ext, e)
    return None


# ---------------------------------------------------------------------------
# Gemini: saída JSON estruturada (o frontend não depende mais de "adivinhar" títulos)
# ---------------------------------------------------------------------------
_gemini_client = None


def obter_gemini():
    global _gemini_client
    if not GEMINI_API_KEY:
        raise ErroProcessamento(
            "sem_chave",
            "A chave GEMINI_API_KEY não está configurada no servidor. Veja o README.",
            http=500,
        )
    if _gemini_client is None:
        from google import genai
        from google.genai import types

        _gemini_client = genai.Client(
            api_key=GEMINI_API_KEY,
            http_options=types.HttpOptions(timeout=180_000),  # ms
        )
    return _gemini_client


SCHEMA_RESUMO = {
    "type": "object",
    "properties": {
        "titulo": {"type": "string"},
        "resumo_geral": {"type": "string"},
        "principais_conceitos": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"termo": {"type": "string"}, "explicacao": {"type": "string"}},
                "required": ["termo", "explicacao"],
            },
        },
        "perguntas_respostas": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"pergunta": {"type": "string"}, "resposta": {"type": "string"}},
                "required": ["pergunta", "resposta"],
            },
        },
        "importante_lembrar": {"type": "array", "items": {"type": "string"}},
        "conteudo_suficiente": {"type": "boolean"},
        "observacao": {"type": "string"},
    },
    "required": [
        "titulo",
        "resumo_geral",
        "principais_conceitos",
        "perguntas_respostas",
        "importante_lembrar",
        "conteudo_suficiente",
        "observacao",
    ],
}

INSTRUCAO_SISTEMA = """Você é um assistente de estudos. Recebe a transcrição automática de um vídeo
e produz um material de revisão fiel ao conteúdo.

Regras:
- Use SOMENTE informações presentes na transcrição. Não invente fatos, números, nomes ou exemplos.
- Escreva em português do Brasil, com linguagem clara e objetiva, mesmo que o vídeo esteja em outro idioma.
- A transcrição é automática e pode ter erros de reconhecimento; corrija apenas erros óbvios de palavras.
- Texto simples: sem Markdown, sem asteriscos, sem hashtags.
- principais_conceitos: de 3 a 8 itens, cada explicação com 1 a 3 frases.
- perguntas_respostas: de 3 a 6 perguntas que ajudem a revisar, com respostas baseadas no vídeo.
- importante_lembrar: de 3 a 7 pontos curtos.
- Se a transcrição for curta demais, sem sentido, apenas música ou claramente incompleta,
  marque conteudo_suficiente=false e explique em "observacao"; resuma apenas o que houver.
- Caso contrário, conteudo_suficiente=true e "observacao" vazia."""


def _texto_resumo(d: dict) -> str:
    """Versão em texto puro (para copiar e baixar .txt)."""
    linhas = [d.get("titulo", "").upper(), "", "RESUMO GERAL", d.get("resumo_geral", ""), ""]
    linhas.append("PRINCIPAIS CONCEITOS")
    for c in d.get("principais_conceitos", []):
        linhas.append(f"- {c.get('termo', '')}: {c.get('explicacao', '')}")
    linhas += ["", "PERGUNTAS E RESPOSTAS"]
    for i, q in enumerate(d.get("perguntas_respostas", []), 1):
        linhas.append(f"{i}. {q.get('pergunta', '')}")
        linhas.append(f"   {q.get('resposta', '')}")
    linhas += ["", "O QUE É IMPORTANTE LEMBRAR"]
    for p in d.get("importante_lembrar", []):
        linhas.append(f"- {p}")
    return "\n".join(linhas).strip()


def validar_resumo(dados) -> dict:
    if not isinstance(dados, dict):
        raise ValueError("resposta não é um objeto")
    if not str(dados.get("resumo_geral", "")).strip():
        raise ValueError("resumo_geral vazio")
    limpo = {
        "titulo": str(dados.get("titulo", "")).strip(),
        "resumo_geral": str(dados.get("resumo_geral", "")).strip(),
        "principais_conceitos": [
            {"termo": str(c.get("termo", "")).strip(), "explicacao": str(c.get("explicacao", "")).strip()}
            for c in dados.get("principais_conceitos", []) or []
            if isinstance(c, dict)
        ],
        "perguntas_respostas": [
            {"pergunta": str(q.get("pergunta", "")).strip(), "resposta": str(q.get("resposta", "")).strip()}
            for q in dados.get("perguntas_respostas", []) or []
            if isinstance(q, dict)
        ],
        "importante_lembrar": [str(p).strip() for p in dados.get("importante_lembrar", []) or [] if str(p).strip()],
        "conteudo_suficiente": bool(dados.get("conteudo_suficiente", True)),
        "observacao": str(dados.get("observacao", "") or "").strip(),
    }
    return limpo


def gerar_resumo(transcricao: str, titulo_video: str) -> tuple[dict, str]:
    from google.genai import errors, types

    cliente = obter_gemini()
    prompt = (
        f"Título do vídeo no YouTube: {titulo_video}\n\n"
        f"Transcrição:\n\"\"\"\n{transcricao}\n\"\"\""
    )
    config = types.GenerateContentConfig(
        system_instruction=INSTRUCAO_SISTEMA,
        response_mime_type="application/json",
        response_schema=SCHEMA_RESUMO,
        temperature=0.3,
    )

    ultimo_erro: ErroProcessamento | None = None
    for modelo in GEMINI_MODELS:
        for tentativa in range(2):  # 1 nova tentativa para erros temporários
            try:
                log.info("Gemini: modelo %s (tentativa %d)", modelo, tentativa + 1)
                resposta = cliente.models.generate_content(model=modelo, contents=prompt, config=config)
                texto = (resposta.text or "").strip()
                if not texto:
                    raise ValueError("resposta vazia")
                return validar_resumo(json.loads(texto)), modelo
            except errors.ClientError as e:
                codigo = getattr(e, "code", None)
                log.warning("Gemini ClientError %s no modelo %s: %s", codigo, modelo, getattr(e, "message", e))
                if codigo == 404:
                    ultimo_erro = ErroProcessamento(
                        "modelo_indisponivel",
                        "O modelo de IA configurado não está disponível. Ajuste GEMINI_MODELS no .env.",
                        502,
                    )
                    break  # tenta o próximo modelo
                if codigo == 429:
                    ultimo_erro = ErroProcessamento(
                        "cota_excedida",
                        "O limite de uso da API do Gemini foi atingido. Aguarde alguns minutos e tente novamente.",
                        429,
                    )
                    break
                if codigo in (401, 403) or "API key" in str(e):
                    raise ErroProcessamento(
                        "chave_invalida", "A chave da API do Gemini é inválida ou não tem permissão.", 500
                    )
                raise ErroProcessamento("falha_ia", "A IA recusou a solicitação. Tente outro vídeo.", 502)
            except errors.ServerError as e:
                log.warning("Gemini ServerError no modelo %s: %s", modelo, e)
                ultimo_erro = ErroProcessamento(
                    "ia_sobrecarregada", "O serviço do Gemini está instável no momento. Tente novamente.", 503
                )
                time.sleep(2 * (tentativa + 1))
            except (ValueError, json.JSONDecodeError) as e:
                log.warning("Gemini devolveu resposta inválida (%s) no modelo %s", e, modelo)
                ultimo_erro = ErroProcessamento(
                    "resposta_invalida", "A IA devolveu uma resposta incompleta. Tente novamente.", 502
                )
            except Exception as e:  # rede / timeout
                log.exception("Erro inesperado chamando o Gemini (%s)", modelo)
                ultimo_erro = ErroProcessamento(
                    "falha_conexao_ia", f"Não foi possível conectar ao Gemini ({type(e).__name__}).", 502
                )
    if ultimo_erro and ultimo_erro.codigo == "modelo_indisponivel" and not _descoberta_feita:
        descoberto = descobrir_modelo_gemini(cliente)
        if descoberto:
            return gerar_resumo(transcricao, titulo_video)
    raise ultimo_erro or ErroProcessamento("falha_ia", "Não foi possível gerar o resumo.", 502)


_descoberta_feita = False


def _versao(nome: str) -> tuple:
    m = re.search(r"gemini-(\d+(?:\.\d+)?)", nome)
    return (float(m.group(1)) if m else 0.0,)


def descobrir_modelo_gemini(cliente) -> str | None:
    """Se nenhum modelo do .env existe, pergunta à API quais estão disponíveis
    e usa o Flash mais recente (estável antes de preview). Roda uma vez por execução."""
    global _descoberta_feita
    _descoberta_feita = True
    try:
        candidatos = []
        for m in cliente.models.list():
            nome = (getattr(m, "name", "") or "").removeprefix("models/")
            acoes = getattr(m, "supported_actions", None) or []
            if "generateContent" not in acoes or "flash" not in nome:
                continue
            if any(x in nome for x in ("image", "tts", "audio", "live", "embedding", "thinking")):
                continue
            candidatos.append(nome)
    except Exception as e:
        log.warning("Não foi possível listar os modelos do Gemini: %s", e)
        return None
    if not candidatos:
        return None
    candidatos.sort(key=lambda n: (_versao(n), "preview" not in n and "exp" not in n, "lite" not in n), reverse=True)
    escolhido = candidatos[0]
    log.warning(
        "Nenhum modelo de GEMINI_MODELS está disponível. Usando '%s'. Para fixar, coloque no .env: GEMINI_MODELS=%s",
        escolhido,
        escolhido,
    )
    GEMINI_MODELS[:] = [escolhido]
    return escolhido


# ---------------------------------------------------------------------------
# Cache simples por vídeo (evita reprocessar o mesmo link)
# ---------------------------------------------------------------------------
def ler_cache(video_id: str) -> dict | None:
    arq = CACHE_DIR / f"{video_id}.json"
    if arq.exists():
        try:
            return json.loads(arq.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
    return None


def salvar_cache(video_id: str, dados: dict) -> None:
    try:
        (CACHE_DIR / f"{video_id}.json").write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
    except OSError:
        log.warning("Não foi possível salvar o cache de %s", video_id)


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------
ETAPAS = ["fila", "preparando", "extraindo_audio", "transcrevendo", "gerando_resumo", "concluido"]

jobs: dict[str, dict] = {}
jobs_lock = threading.Lock()
# 1 worker: Whisper usa muita CPU/RAM; vídeos são processados em fila, um por vez.
executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="job")


def atualizar(job_id: str, **campos) -> None:
    with jobs_lock:
        job = jobs[job_id]
        if "etapa" in campos and campos["etapa"] != job["etapa"]:
            job["historico"].append({"etapa": campos["etapa"], "em": time.time()})
        job.update(campos)
        job["atualizado_em"] = time.time()


def processar_job(job_id: str, url: str, video_id: str) -> None:
    pasta_tmp = tempfile.mkdtemp(prefix="resumeai_")
    inicio = time.time()
    try:
        atualizar(job_id, etapa="preparando")
        info = obter_info(url)
        duracao = int(info.get("duration") or 0)
        titulo = info.get("title") or "Vídeo do YouTube"
        aviso = None
        if duracao and duracao > MAX_DURACAO_MIN * 60:
            raise ErroProcessamento(
                "video_longo",
                f"O vídeo tem {duracao // 60} min. O limite atual é {MAX_DURACAO_MIN} min.",
            )
        if duracao and duracao > AVISO_LONGO_MIN * 60:
            aviso = f"Vídeo longo ({duracao // 60} min): se não houver legenda, a transcrição pode levar vários minutos."
        atualizar(
            job_id,
            video={"id": video_id, "titulo": titulo, "duracao": duracao, "canal": info.get("uploader")},
            aviso=aviso,
        )

        trans = None
        escolha = escolher_legenda(info)
        if escolha:
            atualizar(job_id, etapa="transcrevendo", fonte_transcricao=escolha["tipo"])
            texto_legenda = baixar_legenda(escolha)
            if texto_legenda and len(texto_legenda) >= MIN_CARACTERES_TRANSCRICAO:
                log.info("Usando %s (%s): %d caracteres", escolha["tipo"], escolha["idioma"], len(texto_legenda))
                trans = {"texto": texto_legenda, "idioma": escolha["idioma"].split("-")[0], "fonte": escolha["tipo"]}
            else:
                log.info("Legenda indisponível ou curta demais; usando o Whisper.")

        if trans is None:
            atualizar(job_id, etapa="extraindo_audio", fonte_transcricao="whisper")
            audio = baixar_audio(url, pasta_tmp)

            atualizar(job_id, etapa="transcrevendo")
            t0 = time.time()
            try:
                trans = transcrever(audio)
            except Exception:
                log.exception("Falha no Whisper")
                raise ErroProcessamento(
                    "falha_transcricao", "Falha ao transcrever o áudio. Verifique se o FFmpeg está instalado.", 500
                )
            trans["fonte"] = "whisper"
            log.info("Transcrição: %d caracteres em %.1fs", len(trans["texto"]), time.time() - t0)
        texto = trans["texto"]
        if len(texto) < MIN_CARACTERES_TRANSCRICAO:
            raise ErroProcessamento(
                "conteudo_insuficiente",
                "Quase não há fala neste vídeo (ou o áudio está ruim). Não há conteúdo suficiente para resumir.",
            )
        truncado = len(texto) > MAX_CARACTERES_TRANSCRICAO
        if truncado:
            texto = texto[:MAX_CARACTERES_TRANSCRICAO]

        atualizar(job_id, etapa="gerando_resumo")
        resumo, modelo = gerar_resumo(texto, titulo)
        resumo["texto"] = _texto_resumo(resumo)

        resultado = {
            "resumo": resumo,
            "video": jobs[job_id]["video"],
            "idioma": trans["idioma"],
            "modelo_ia": modelo,
            "fonte_transcricao": trans["fonte"],
            "modelo_whisper": WHISPER_MODEL if trans["fonte"] == "whisper" else None,
            "transcricao_truncada": truncado,
            "caracteres_transcricao": len(trans["texto"]),
        }
        salvar_cache(video_id, resultado)
        atualizar(job_id, etapa="concluido", resultado=resultado, duracao_processamento=time.time() - inicio)
        log.info("Job %s concluído em %.1fs", job_id, time.time() - inicio)
    except ErroProcessamento as e:
        log.warning("Job %s falhou: [%s] %s", job_id, e.codigo, e.mensagem)
        atualizar(job_id, etapa="erro", erro={"codigo": e.codigo, "mensagem": e.mensagem})
    except Exception as e:
        log.exception("Job %s: erro inesperado", job_id)
        atualizar(
            job_id,
            etapa="erro",
            erro={"codigo": "erro_interno", "mensagem": f"Erro inesperado no servidor ({type(e).__name__})."},
        )
    finally:
        shutil.rmtree(pasta_tmp, ignore_errors=True)  # nunca acumula áudio


def limpar_jobs_antigos(max_idade=3600) -> None:
    agora = time.time()
    with jobs_lock:
        for jid in [j for j, d in jobs.items() if agora - d["atualizado_em"] > max_idade]:
            del jobs[jid]


# ---------------------------------------------------------------------------
# Flask
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.json.ensure_ascii = False
CORS(app, origins=[r"http://localhost:\d+", r"http://127\.0\.0\.1:\d+"])


def job_publico(job: dict) -> dict:
    return {k: v for k, v in job.items() if k not in {"url"}}


@app.post("/api/resumir")
@app.post("/resumir")  # rota antiga mantida por compatibilidade
def criar_job():
    dados = request.get_json(silent=True) or {}
    url = dados.get("url", "")
    video_id = extrair_id_video(url)
    if not video_id:
        return jsonify(erro={"codigo": "url_invalida", "mensagem": "Envie um link válido de vídeo do YouTube."}), 400

    limpar_jobs_antigos()
    job_id = uuid.uuid4().hex[:12]
    agora = time.time()
    job = {
        "id": job_id,
        "etapa": "fila",
        "historico": [{"etapa": "fila", "em": agora}],
        "criado_em": agora,
        "atualizado_em": agora,
        "video": {"id": video_id},
        "aviso": None,
        "erro": None,
        "resultado": None,
        "do_cache": False,
        "fonte_transcricao": None,
    }

    em_cache = None if dados.get("ignorar_cache") else ler_cache(video_id)
    if em_cache:
        job.update(etapa="concluido", resultado=em_cache, video=em_cache.get("video", job["video"]), do_cache=True)
        job["historico"].append({"etapa": "concluido", "em": agora})
        with jobs_lock:
            jobs[job_id] = job
        return jsonify(job_publico(job)), 200

    with jobs_lock:
        na_fila = sum(1 for j in jobs.values() if j["etapa"] not in {"concluido", "erro"})
        jobs[job_id] = job
    job["posicao_fila"] = na_fila
    executor.submit(processar_job, job_id, f"https://www.youtube.com/watch?v={video_id}", video_id)
    log.info("Job %s criado para o vídeo %s", job_id, video_id)
    return jsonify(job_publico(job)), 202


@app.get("/api/status/<job_id>")
def status(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            return jsonify(erro={"codigo": "job_nao_encontrado", "mensagem": "Processamento não encontrado. Tente novamente."}), 404
        return jsonify(job_publico(dict(job)))


@app.get("/api/health")
def health():
    return jsonify(
        ok=True,
        gemini_configurado=bool(GEMINI_API_KEY),
        modelos_gemini=GEMINI_MODELS,
        whisper=WHISPER_MODEL,
        usar_legendas=USAR_LEGENDAS,
        whisper_carregado=_whisper_model is not None,
        ffmpeg=shutil.which("ffmpeg") is not None,
    )


@app.errorhandler(404)
def nao_encontrado(_):
    return jsonify(erro={"codigo": "rota_inexistente", "mensagem": "Rota não encontrada."}), 404


@app.errorhandler(Exception)
def erro_geral(e):
    log.exception("Erro não tratado na rota %s", request.path)
    return jsonify(erro={"codigo": "erro_interno", "mensagem": "Erro interno no servidor."}), 500


def aquecer_whisper():
    try:
        obter_whisper()
    except Exception:
        log.exception("Não foi possível pré-carregar o Whisper")


def verificar_ambiente(testar_gemini: bool = True) -> bool:
    """python main.py --verificar  → confere tudo antes de subir o servidor."""
    import importlib
    import sys

    ok_geral = True

    def item(ok: bool, texto: str, dica: str = "") -> None:
        nonlocal ok_geral
        ok_geral = ok_geral and ok
        print(f"  [{'OK' if ok else 'X '}] {texto}" + ("" if ok or not dica else f"\n       -> {dica}"))

    print("\nResume AI - verificação do ambiente\n", flush=True)
    item(sys.version_info >= (3, 10), f"Python {sys.version.split()[0]}", "Instale o Python 3.10 ou mais novo.")
    for modulo, pacote in [("flask", "flask"), ("flask_cors", "flask-cors"), ("yt_dlp", "yt-dlp"),
                           ("google.genai", "google-genai")]:
        try:
            importlib.import_module(modulo)
            item(True, f"pacote {pacote}")
        except Exception:
            item(False, f"pacote {pacote}", "Rode: pip install -r requirements.txt")
    # Whisper + PyTorch são pesados: no Windows o 1º carregamento pode levar 1 a 2 minutos
    # (o antivírus examina as DLLs do torch). Não é travamento.
    print("  ... carregando Whisper/PyTorch (na 1ª vez pode levar 1-2 min, aguarde)", flush=True)
    t0 = time.time()
    try:
        importlib.import_module("whisper")
        item(True, f"pacote openai-whisper (carregou em {time.time() - t0:.0f}s)")
    except KeyboardInterrupt:
        print("\n  Verificação interrompida. Rode de novo e aguarde o Whisper carregar.\n")
        return False
    except Exception as e:
        item(False, "pacote openai-whisper", f"{type(e).__name__}: {str(e)[:160]} | Rode: pip install -r requirements.txt")
    item(bool(shutil.which("ffmpeg")), "FFmpeg no PATH",
         "Instale o FFmpeg (winget install ffmpeg) e abra um terminal novo.")
    item((BASE_DIR / ".env").exists(), "arquivo .env", "Copie .env.example para .env.")
    item(bool(GEMINI_API_KEY) and GEMINI_API_KEY != "cole_sua_chave_aqui", "GEMINI_API_KEY preenchida",
         "Cole sua chave no .env (https://aistudio.google.com/apikey).")
    if testar_gemini and GEMINI_API_KEY and GEMINI_API_KEY != "cole_sua_chave_aqui":
        try:
            cliente = obter_gemini()
            disponiveis = {
                (getattr(m, "name", "") or "").removeprefix("models/") for m in cliente.models.list()
            }
            presentes = [m for m in GEMINI_MODELS if m in disponiveis]
            item(True, "chave aceita pela API do Gemini")
            if presentes:
                item(True, f"modelo(s) disponível(is): {', '.join(presentes)}")
            else:
                sugestao = descobrir_modelo_gemini(cliente)
                item(False, f"nenhum de {GEMINI_MODELS} existe na sua conta",
                     f"Coloque no .env: GEMINI_MODELS={sugestao}" if sugestao else "Veja os modelos no AI Studio.")
        except Exception as e:
            item(False, "conexão com o Gemini", f"{type(e).__name__}: {str(e)[:160]}")
    print(f"\n  Whisper: {WHISPER_MODEL}  |  Legendas do YouTube: {USAR_LEGENDAS}")
    print("\nTudo pronto! Rode: python main.py\n" if ok_geral else "\nCorrija os itens marcados com X.\n")
    return ok_geral


if __name__ == "__main__":
    import sys

    if "--verificar" in sys.argv:
        sys.exit(0 if verificar_ambiente() else 1)
    if not GEMINI_API_KEY:
        log.warning("GEMINI_API_KEY não encontrada. Crie um arquivo .env (veja .env.example).")
    if not shutil.which("ffmpeg"):
        log.warning("FFmpeg não encontrado no PATH. O download e a transcrição vão falhar.")
    # Carrega o Whisper em segundo plano para o primeiro pedido não esperar.
    threading.Thread(target=aquecer_whisper, daemon=True).start()
    # use_reloader=False: o reloader reiniciava o servidor no meio de um processamento longo.
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False, use_reloader=False, threaded=True)
