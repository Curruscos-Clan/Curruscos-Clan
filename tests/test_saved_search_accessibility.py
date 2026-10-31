from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def test_saved_search_accessibility_contract():
    guardados_html = (REPO_ROOT / "guardados.html").read_text(encoding="utf-8")
    assert 'id="savedSearch"' in guardados_html
    assert 'aria-label=' in guardados_html
    assert 'aria-label="Buscar en tus eventos guardados"' in guardados_html


def test_saved_search_escape_key_contract():
    guardados_js = (REPO_ROOT / "js" / "guardados.js").read_text(encoding="utf-8")
    assert 'document.getElementById("savedSearch")' in guardados_js or 'searchInput' in guardados_js
    assert '"keydown"' in guardados_js
    assert '"Escape"' in guardados_js
    assert 'searchInput.value = ""' in guardados_js or 'value = ""' in guardados_js
