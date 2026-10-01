"""Give each Pages deployment consistent cache keys for its browser assets."""

import argparse
import json
from pathlib import Path
import re


def version_assets(web: Path, revision: str) -> None:
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("revision must be a full Git commit SHA")

    def version(match: re.Match) -> str:
        return f"{match['prefix']}{match['path']}?v={revision}{match['quote']}"

    html = web / "index.html"
    source = html.read_text()
    source = re.sub(
        r"(?P<prefix>\b(?:src|href)=[\"'])(?P<path>(?:\./)?[^\"':?#]+\.(?:js|css))(?:\?[^\"']*)?(?P<quote>[\"'])",
        version,
        source,
    )
    source = re.sub(
        r'(<p class="footer-note" id="build-version">).*?(</p>)',
        rf"\g<1>Build: {revision[:7]}\g<2>",
        source,
    )
    html.write_text(source)

    # Version imports in our modules, preserving generated/vendor modules. Dynamic worker
    # imports already receive the entry script's version at runtime.
    for module in web.glob("*.js"):
        module.write_text(re.sub(
            r"(?P<prefix>\bfrom\s*[\"'])(?P<path>\./[^\"'?]+\.(?:js|mjs))(?:\?[^\"']*)?(?P<quote>[\"'])",
            version,
            module.read_text(),
        ))
    (web / "build.json").write_text(json.dumps({"revision": revision}) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web-dir", type=Path, default=Path("web"))
    parser.add_argument("--revision", required=True)
    args = parser.parse_args()
    version_assets(args.web_dir, args.revision)
