from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml

SITES_FILE = Path(__file__).resolve().parent.parent / "data" / "sites.yaml"


@dataclass
class Site:
    id: str
    name: str
    lat: float
    lon: float
    category: str = "custom"
    note: str = ""
    source: str = ""
    verified: bool = False


def load_sites(path: str | Path = SITES_FILE) -> list[Site]:
    data = yaml.safe_load(Path(path).read_text())
    return [Site(**s) for s in data["sites"]]
