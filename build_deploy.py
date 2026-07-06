import re
import shutil
from datetime import datetime
from pathlib import Path

import refresh_data
import refresh_floorplans
import refresh_suwon_data
import refresh_unit_areas


ROOT = Path(__file__).parent
DIST = ROOT / "dist"
DOCS = ROOT / "docs"
DEPLOY_ZIP = ROOT / "sanul-partners-hoga-deploy.zip"


def copy_file(source_name, target_name=None):
    target_name = target_name or source_name
    shutil.copy2(ROOT / source_name, DIST / target_name)


def main():
    refresh_data.main()
    refresh_suwon_data.main()
    refresh_floorplans.main()
    refresh_unit_areas.main()

    DIST.mkdir(exist_ok=True)
    for name in ["index.html", "app.js", "styles.css", "netlify.toml"]:
        target = DIST / name
        if target.exists():
            target.unlink()
    for name in ["data", "assets"]:
        target = DIST / name
        if target.exists():
            shutil.rmtree(target)

    copy_file("app.js")
    copy_file("styles.css")
    shutil.copytree(ROOT / "data", DIST / "data")
    if (ROOT / "assets").exists():
        shutil.copytree(ROOT / "assets", DIST / "assets")

    version = datetime.now().strftime("%Y%m%d%H%M")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = re.sub(r"styles\.css\?v=[^\"']+", f"styles.css?v={version}", html)
    html = re.sub(r"app\.js\?v=[^\"']+", f"app.js?v={version}", html)
    (DIST / "index.html").write_text(html, encoding="utf-8")

    (DIST / "netlify.toml").write_text(
        """[[headers]]
for = "/data/listings.json"
  [headers.values]
  Cache-Control = "no-cache, no-store, must-revalidate"

[[headers]]
for = "/*.html"
  [headers.values]
  Cache-Control = "no-cache"
""",
        encoding="utf-8",
    )

    if DEPLOY_ZIP.exists():
        DEPLOY_ZIP.unlink()
    shutil.make_archive(str(DEPLOY_ZIP.with_suffix("")), "zip", DIST)

    if DOCS.exists():
        shutil.rmtree(DOCS)
    shutil.copytree(DIST, DOCS)
    netlify_config = DOCS / "netlify.toml"
    if netlify_config.exists():
        netlify_config.unlink()
    (DOCS / ".nojekyll").write_text("", encoding="utf-8")

    print(f"배포용 폴더 생성 완료: {DIST}")
    print(f"GitHub Pages용 폴더 생성 완료: {DOCS}")
    print(f"업로드용 ZIP 생성 완료: {DEPLOY_ZIP}")
    print("GitHub Pages를 쓰는 경우 저장소 설정에서 main 브랜치의 /docs 폴더를 선택하면 됩니다.")


if __name__ == "__main__":
    main()
