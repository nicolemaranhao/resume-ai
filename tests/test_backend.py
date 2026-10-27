"""Testes do backend sem rede: yt-dlp, Whisper e Gemini são simulados.

Rodar na raiz do projeto:  python -m unittest discover tests -v
"""

import json
import os
import shutil
import sys
import time
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("GEMINI_API_KEY", "chave-de-teste")

import main  # noqa: E402
from google.genai import errors  # noqa: E402

RESUMO_OK = {
    "titulo": "Tipos de relacionamento",
    "resumo_geral": "O vídeo explica graus de relacionamento em modelagem de dados.",
    "principais_conceitos": [{"termo": "Unário", "explicacao": "Entidade relacionada com ela mesma."}],
    "perguntas_respostas": [{"pergunta": "O que é binário?", "resposta": "Envolve duas entidades."}],
    "importante_lembrar": ["Grau = número de entidades."],
    "conteudo_suficiente": True,
    "observacao": "",
}


class RespostaFalsa:
    def __init__(self, texto):
        self.text = texto


def erro_cliente(codigo):
    return errors.ClientError(codigo, {"error": {"code": codigo, "message": "x", "status": "X"}})


def erro_servidor():
    return errors.ServerError(503, {"error": {"code": 503, "message": "overloaded", "status": "UNAVAILABLE"}})


class TestUrl(unittest.TestCase):
    def test_validas(self):
        casos = {
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ": "dQw4w9WgXcQ",
            "youtube.com/watch?v=dQw4w9WgXcQ&t=10s": "dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ?si=abc": "dQw4w9WgXcQ",
            "https://m.youtube.com/watch?v=dQw4w9WgXcQ": "dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ": "dQw4w9WgXcQ",
            "https://www.youtube.com/embed/dQw4w9WgXcQ": "dQw4w9WgXcQ",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123": "dQw4w9WgXcQ",
        }
        for url, esperado in casos.items():
            self.assertEqual(main.extrair_id_video(url), esperado, url)

    def test_invalidas(self):
        for url in [
            "",
            None,
            "https://vimeo.com/123",
            "https://www.youtube.com/",
            "https://www.youtube.com/watch?v=curto",
            "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
            "javascript:alert(1)",
            "https://www.youtube.com/watch?v=" + "a" * 600,
        ]:
            self.assertIsNone(main.extrair_id_video(url), url)


class TestGemini(unittest.TestCase):
    def setUp(self):
        self.cliente = mock.MagicMock()
        main._gemini_client = self.cliente
        main.GEMINI_MODELS = ["modelo-a", "modelo-b"]
        self.sleep = mock.patch("main.time.sleep").start()

    def tearDown(self):
        mock.patch.stopall()
        main._gemini_client = None

    def test_sucesso(self):
        self.cliente.models.generate_content.return_value = RespostaFalsa(json.dumps(RESUMO_OK))
        resumo, modelo = main.gerar_resumo("texto", "titulo")
        self.assertEqual(modelo, "modelo-a")
        self.assertEqual(resumo["principais_conceitos"][0]["termo"], "Unário")

    def test_404_passa_para_proximo_modelo(self):
        self.cliente.models.generate_content.side_effect = [erro_cliente(404), RespostaFalsa(json.dumps(RESUMO_OK))]
        _, modelo = main.gerar_resumo("texto", "titulo")
        self.assertEqual(modelo, "modelo-b")

    def test_429_vira_cota_excedida(self):
        self.cliente.models.generate_content.side_effect = erro_cliente(429)
        with self.assertRaises(main.ErroProcessamento) as ctx:
            main.gerar_resumo("texto", "titulo")
        self.assertEqual(ctx.exception.codigo, "cota_excedida")

    def test_chave_invalida(self):
        self.cliente.models.generate_content.side_effect = erro_cliente(403)
        with self.assertRaises(main.ErroProcessamento) as ctx:
            main.gerar_resumo("texto", "titulo")
        self.assertEqual(ctx.exception.codigo, "chave_invalida")

    def test_503_tenta_de_novo(self):
        self.cliente.models.generate_content.side_effect = [erro_servidor(), RespostaFalsa(json.dumps(RESUMO_OK))]
        _, modelo = main.gerar_resumo("texto", "titulo")
        self.assertEqual(modelo, "modelo-a")

    def test_resposta_vazia_ou_invalida(self):
        self.cliente.models.generate_content.side_effect = [RespostaFalsa(""), RespostaFalsa("{nao json")] * 2
        with self.assertRaises(main.ErroProcessamento) as ctx:
            main.gerar_resumo("texto", "titulo")
        self.assertEqual(ctx.exception.codigo, "resposta_invalida")

    def test_sem_chave(self):
        main._gemini_client = None
        with mock.patch.object(main, "GEMINI_API_KEY", ""):
            with self.assertRaises(main.ErroProcessamento) as ctx:
                main.obter_gemini()
        self.assertEqual(ctx.exception.codigo, "sem_chave")


class TestFluxoApi(unittest.TestCase):
    def setUp(self):
        self.app = main.app.test_client()
        self.cache = Path(main.CACHE_DIR)
        for f in self.cache.glob("dQw4w9WgXcQ.json"):
            f.unlink()
        self.pastas = []
        original_mkdtemp = main.tempfile.mkdtemp

        def mkdtemp(**kw):
            p = original_mkdtemp(**kw)
            self.pastas.append(p)
            return p

        mock.patch("main.tempfile.mkdtemp", side_effect=mkdtemp).start()
        mock.patch(
            "main.obter_info", return_value={"title": "Aula teste", "duration": 1500, "uploader": "Canal"}
        ).start()

        def baixar(url, pasta):
            caminho = os.path.join(pasta, "audio.m4a")
            Path(caminho).write_bytes(b"0" * 1000)
            time.sleep(0.2)
            return caminho

        mock.patch("main.baixar_audio", side_effect=baixar).start()
        mock.patch(
            "main.transcrever", side_effect=lambda a: (time.sleep(0.2), {"texto": "conteudo " * 50, "idioma": "pt"})[1]
        ).start()
        r = dict(RESUMO_OK)
        mock.patch("main.gerar_resumo", return_value=(main.validar_resumo(r), "modelo-a")).start()

    def tearDown(self):
        mock.patch.stopall()
        for f in self.cache.glob("dQw4w9WgXcQ.json"):
            f.unlink()

    def esperar(self, job_id, limite=10):
        vistos = []
        fim = time.time() + limite
        while time.time() < fim:
            d = self.app.get(f"/api/status/{job_id}").get_json()
            if not vistos or vistos[-1] != d["etapa"]:
                vistos.append(d["etapa"])
            if d["etapa"] in {"concluido", "erro"}:
                return d, vistos
            time.sleep(0.05)
        self.fail("timeout")

    def test_url_invalida_retorna_json_400(self):
        r = self.app.post("/api/resumir", json={"url": "https://vimeo.com/1"})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.get_json()["erro"]["codigo"], "url_invalida")
        r = self.app.post("/api/resumir", data="nada", content_type="text/plain")
        self.assertEqual(r.status_code, 400)

    def test_fluxo_completo_estados_reais_e_cache(self):
        r = self.app.post("/api/resumir", json={"url": "https://youtu.be/dQw4w9WgXcQ"})
        self.assertEqual(r.status_code, 202)
        d, vistos = self.esperar(r.get_json()["id"])
        self.assertEqual(d["etapa"], "concluido", d.get("erro"))
        historico = [h["etapa"] for h in d["historico"]]
        self.assertEqual(
            historico, ["fila", "preparando", "extraindo_audio", "transcrevendo", "gerando_resumo", "concluido"]
        )
        self.assertIn("RESUMO GERAL", d["resultado"]["resumo"]["texto"])
        self.assertIn("Vídeo longo", d["aviso"])
        # arquivos temporários removidos
        self.assertTrue(self.pastas and all(not os.path.exists(p) for p in self.pastas))
        # segundo pedido vem do cache, sem reprocessar
        r2 = self.app.post("/api/resumir", json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
        self.assertEqual(r2.status_code, 200)
        self.assertTrue(r2.get_json()["do_cache"])
        # ignorar_cache força novo processamento
        r3 = self.app.post("/api/resumir", json={"url": "https://youtu.be/dQw4w9WgXcQ", "ignorar_cache": True})
        self.assertEqual(r3.status_code, 202)
        self.esperar(r3.get_json()["id"])

    def test_erro_vira_estado_com_mensagem(self):
        main.transcrever.side_effect = lambda a: {"texto": "oi", "idioma": "pt"}
        r = self.app.post("/api/resumir", json={"url": "https://youtu.be/dQw4w9WgXcQ"})
        d, _ = self.esperar(r.get_json()["id"])
        self.assertEqual(d["etapa"], "erro")
        self.assertEqual(d["erro"]["codigo"], "conteudo_insuficiente")
        self.assertTrue(all(not os.path.exists(p) for p in self.pastas))

    def test_video_longo_demais(self):
        main.obter_info.return_value = {"title": "x", "duration": 10 * 3600}
        r = self.app.post("/api/resumir", json={"url": "https://youtu.be/dQw4w9WgXcQ"})
        d, _ = self.esperar(r.get_json()["id"])
        self.assertEqual(d["erro"]["codigo"], "video_longo")

    def test_status_inexistente_e_health(self):
        self.assertEqual(self.app.get("/api/status/naoexiste").status_code, 404)
        h = self.app.get("/api/health").get_json()
        self.assertTrue(h["ok"])
        self.assertNotIn("chave", json.dumps(h).lower().replace("gemini_configurado", ""))


JSON3 = json.dumps({"events": [{"segs": [{"utf8": "Hoje vamos"}, {"utf8": " falar de"}]}, {"segs": [{"utf8": "\n"}]},
                               {"segs": [{"utf8": "banco de dados."}]}]})
VTT_AUTO = """WEBVTT
Kind: captions
Language: pt

00:00:00.000 --> 00:00:02.000
<c>Hoje</c><00:00:00.500><c> vamos</c>

00:00:02.000 --> 00:00:04.000
Hoje vamos
falar de banco

00:00:04.000 --> 00:00:06.000
falar de banco
"""


class TestLegendas(unittest.TestCase):
    def setUp(self):
        self.modo = main.USAR_LEGENDAS

    def tearDown(self):
        main.USAR_LEGENDAS = self.modo

    def test_parsers(self):
        self.assertEqual(main.texto_de_json3(JSON3), "Hoje vamos falar de banco de dados.")
        self.assertEqual(main.texto_de_vtt(VTT_AUTO), "Hoje vamos falar de banco")

    def test_manual_vence_automatica(self):
        info = {"language": "pt", "subtitles": {"en": [{"ext": "vtt", "url": "x"}]},
                "automatic_captions": {"pt-orig": [{"ext": "json3", "url": "y"}]}}
        self.assertEqual(main.escolher_legenda(info)["tipo"], "legenda_manual")

    def test_automatica_so_no_idioma_original(self):
        info = {"language": "pt", "automatic_captions": {"en": [{"ext": "json3", "url": "a"}],
                                                          "pt-orig": [{"ext": "json3", "url": "b"}]}}
        e = main.escolher_legenda(info)
        self.assertEqual((e["tipo"], e["idioma"]), ("legenda_automatica", "pt"))
        self.assertIsNone(main.escolher_legenda({"automatic_captions": {"en": [{"ext": "vtt", "url": "a"}]}}))

    def test_modos(self):
        info = {"language": "pt", "automatic_captions": {"pt": [{"ext": "vtt", "url": "a"}]}}
        main.USAR_LEGENDAS = "manual"
        self.assertIsNone(main.escolher_legenda(info))
        main.USAR_LEGENDAS = "nao"
        self.assertIsNone(main.escolher_legenda({"subtitles": {"pt": [{"ext": "vtt", "url": "a"}]}}))

    def test_job_com_legenda_pula_whisper(self):
        app = main.app.test_client()
        for f in Path(main.CACHE_DIR).glob("aaaaaaaaaaa.json"):
            f.unlink()
        info = {"title": "Aula", "duration": 600, "language": "pt",
                "subtitles": {"pt": [{"ext": "json3", "url": "u"}]}}
        with mock.patch("main.obter_info", return_value=info), \
                mock.patch("main.baixar_legenda", return_value="texto da legenda " * 30), \
                mock.patch("main.baixar_audio") as baixar, mock.patch("main.transcrever") as whisper, \
                mock.patch("main.gerar_resumo", return_value=(main.validar_resumo(RESUMO_OK), "m")):
            r = app.post("/api/resumir", json={"url": "https://youtu.be/aaaaaaaaaaa"})
            jid = r.get_json()["id"]
            for _ in range(100):
                d = app.get(f"/api/status/{jid}").get_json()
                if d["etapa"] in ("concluido", "erro"):
                    break
                time.sleep(0.05)
        self.assertEqual(d["etapa"], "concluido", d.get("erro"))
        self.assertEqual(d["resultado"]["fonte_transcricao"], "legenda_manual")
        baixar.assert_not_called()
        whisper.assert_not_called()
        self.assertNotIn("extraindo_audio", [h["etapa"] for h in d["historico"]])
        for f in Path(main.CACHE_DIR).glob("aaaaaaaaaaa.json"):
            f.unlink()


class TestDescobertaModelo(unittest.TestCase):
    def tearDown(self):
        main._gemini_client = None
        main._descoberta_feita = False

    def test_descobre_quando_modelos_do_env_nao_existem(self):
        cliente = mock.MagicMock()
        main._gemini_client = cliente
        main.GEMINI_MODELS = ["nao-existe"]
        main._descoberta_feita = False
        def M(n, a=("generateContent",)):
            m = mock.Mock()
            m.name, m.supported_actions = f"models/{n}", list(a)
            return m

        cliente.models.list.return_value = [
            M("gemini-2.5-flash"), M("gemini-3.0-flash-preview"), M("gemini-3.0-flash"),
            M("gemini-3.0-flash-lite"), M("gemini-3.0-flash-image"), M("text-embedding", ("embedContent",)),
        ]
        cliente.models.generate_content.side_effect = [erro_cliente(404), RespostaFalsa(json.dumps(RESUMO_OK))]
        mock.patch("main.time.sleep").start()
        try:
            _, modelo = main.gerar_resumo("t", "x")
        finally:
            mock.patch.stopall()
        self.assertEqual(modelo, "gemini-3.0-flash")


@unittest.skipUnless(shutil.which("ffmpeg"), "FFmpeg não instalado")
class TestAudioSemConversao(unittest.TestCase):
    def test_whisper_decodifica_m4a_direto(self):
        """Confirma que o Whisper lê m4a sem a etapa de conversão para MP3."""
        import subprocess
        import tempfile

        import whisper

        with tempfile.TemporaryDirectory() as d:
            arq = os.path.join(d, "t.m4a")
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", arq],
                check=True,
            )
            audio = whisper.load_audio(arq)
            self.assertAlmostEqual(len(audio) / 16000, 2.0, delta=0.1)


if __name__ == "__main__":
    unittest.main()
