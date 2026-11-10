"""Download the NAIF/JPL kernels used by lunanav.ephemeris into data/kernels/."""
from pathlib import Path
import urllib.request

KERNELS = {
    "de421.bsp": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/de421.bsp",
    "moon_080317.tf": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf",
    "pck00008.tpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/a_old_versions/pck00008.tpc",
    "moon_pa_de421_1900-2050.bpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de421_1900-2050.bpc",
}

out = Path(__file__).resolve().parent.parent / "data" / "kernels"
out.mkdir(parents=True, exist_ok=True)
for name, url in KERNELS.items():
    dest = out / name
    if dest.exists() and dest.stat().st_size > 0:
        print(f"ok   {name}")
        continue
    print(f"get  {name}  <- {url}")
    urllib.request.urlretrieve(url, dest)
print("done:", out)
