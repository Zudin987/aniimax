import importlib.util
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile
import unittest
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("version_web_assets", ROOT / "scripts/version_web_assets.py")
versioning = importlib.util.module_from_spec(spec)
spec.loader.exec_module(versioning)


class VersionAssetsTest(unittest.TestCase):
    def test_deployed_module_graph_uses_one_revision(self):
        with tempfile.TemporaryDirectory() as directory:
            web = Path(directory)
            for source in [ROOT / "web/index.html", *sorted((ROOT / "web").glob("*.js"))]:
                shutil.copy(source, web / source.name)
            revision = "a" * 40
            versioning.version_assets(web, revision)
            html = (web / "index.html").read_text()
            self.assertIn(f'src="app.js?v={revision}"', html)
            self.assertIn(f'href="style.css?v={revision}"', html)
            self.assertIn('id="build-version">Build: aaaaaaa</p>', html)
            self.assertIn("https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js", html)
            checked = 0
            for module in web.glob("*.js"):
                for asset in re.findall(r"\bfrom\s*['\"](\./[^'\"]+)['\"]", module.read_text()):
                    self.assertEqual(parse_qs(urlsplit(asset).query), {"v": [revision]}, (module.name, asset))
                    checked += 1
            self.assertGreaterEqual(checked, 4)
            self.assertEqual(json.loads((web / "build.json").read_text())["revision"], revision)

            # A second deployment must replace old cache keys rather than append another one.
            revision = "b" * 40
            versioning.version_assets(web, revision)
            self.assertIn(f'src="app.js?v={revision}"', (web / "index.html").read_text())
            self.assertNotIn("?v=" + "a" * 40, (web / "app.js").read_text())
            before = (web / "index.html").read_text()
            versioning.version_assets(web, revision)
            self.assertEqual((web / "index.html").read_text(), before)

    def test_invalid_revision_cannot_be_written(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                versioning.version_assets(Path(directory), "not-a-commit")


if __name__ == "__main__":
    unittest.main()
