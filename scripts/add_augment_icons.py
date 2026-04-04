"""Add wiki Special:FilePath icon URLs to mayhem-augment-pool.json."""
import json
from pathlib import Path
from urllib.parse import quote

WIKI_BASE = "https://wiki.leagueoflegends.com/en-us/Special:FilePath/"

# Augment display name -> exact wiki filename (when not `{name}_mayhem_augment.png`)
ICON_OVERRIDES = {
    "???": "Missing_Pings_mayhem_augment.png",
}


def file_name_for_augment(name: str) -> str:
    if name in ICON_OVERRIDES:
        return ICON_OVERRIDES[name]
    return name.replace(" ", "_") + "_mayhem_augment.png"


def icon_url(name: str) -> str:
    return WIKI_BASE + quote(file_name_for_augment(name), safe="")


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    path = root / "js" / "mayhem-augment-pool.json"
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    for row in data:
        row["icon"] = icon_url(row["name"])
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Updated {len(data)} rows in {path}")


if __name__ == "__main__":
    main()
