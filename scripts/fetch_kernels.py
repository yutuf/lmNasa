"""Download the NAIF/JPL kernels used by lunanav.ephemeris into data/kernels/."""
from pathlib import Path
import urllib.request

KERNELS = {
    "de440.bsp": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440.bsp",
    "moon_de440_250416.tf": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf",
    "pck00011.tpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc",
    "moon_pa_de440_200625.bpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc",
}

import os
out = Path(os.environ.get("LUNANAV_KERNELS", Path(__file__).resolve().parent.parent / "data" / "kernels"))
out.mkdir(parents=True, exist_ok=True)
for name, url in KERNELS.items():
    dest = out / name
    if dest.exists() and dest.stat().st_size > 0:
        print(f"ok   {name}")
        continue
    print(f"get  {name}  <- {url}")
    urllib.request.urlretrieve(url, dest)
print("done:", out)
