from html.parser import HTMLParser
from pathlib import Path
import unittest
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
CORE_PAGES = (
    "index.html",
    "login.html",
    "explorar.html",
    "crear-evento.html",
    "evento-publico.html",
    "perfil.html",
    "chat.html",
    "notificaciones.html",
    "eventos.html",
    "mis-eventos.html",
)

class LocalReferenceParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.references = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for attr in ("href", "src", "poster"):
            value = (values.get(attr) or "").strip()
            if value:
                self.references.append((tag, attr, value))

class CorePageLocalReferenceTests(unittest.TestCase):
    def test_core_pages_exist_and_local_references_resolve(self):
        missing = []
        for page in CORE_PAGES:
            page_path = ROOT / page
            if not page_path.is_file():
                missing.append(f"{page}: página principal inexistente")
                continue
            parser = LocalReferenceParser()
            parser.feed(page_path.read_text(encoding="utf-8"))
            for tag, attr, raw in parser.references:
                parsed = urlsplit(raw)
                if parsed.scheme or parsed.netloc or raw.startswith(("#", "?")):
                    continue
                target = parsed.path
                if not target:
                    continue
                # GitHub Pages serves these static files from the repository root.
                candidate = (ROOT / target.lstrip("/")) if target.startswith("/") else (page_path.parent / target)
                if not candidate.is_file():
                    missing.append(f"{page} [{tag} {attr}]: {raw}")
        self.assertFalse(missing, "Referencias locales rotas:\n" + "\n".join(missing))

if __name__ == "__main__":
    unittest.main()
