#!/usr/bin/env bash
# Pull the extra lunar datasets used (or likely to be used) by LunaNav into data/usgs/, in priority order.
# All public NASA/USGS data from the USGS Astrogeology mosaic bucket. Resumable: rerun to continue.
set -u
S3=https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic
OUT="$(dirname "$0")/../data/usgs"
mkdir -p "$OUT"
get() {  # get <path-in-bucket>
  local dest="$OUT/$1"
  mkdir -p "$(dirname "$dest")"
  curl -4 -s -f -C - --retry 10 --retry-delay 15 -o "$dest" "$S3/$1" && echo "ok $1 $(stat -c %s "$dest")" || echo "FAIL $1"
}
A=Lunar_safed/Artemis/84_SouthProject_v2
for f in READ_ME_84Sv2.txt READ_ME_87Sv2.txt doc/84S_Project_Description_Document_V2.pdf \
  LunarTextures/Moon_Surface_d01_baseColor.png LunarTextures/Moon_Surface_d01_normal.png LunarTextures/Moon_Surface_d01_height.png \
  LunarTextures/Moon_Surface_d01_roughness.png LunarTextures/Moon_Surface_d01_AO.png; do get "$A/$f"; done
for f in Moon_IceFavorabilityIndex_90S000E_591mp.tif Moon_IceFavorabilityIndex_90S000E_browse.jpg \
  Moon_IceFavorabilityIndex_90N000E_591mp.tif Moon_IceFavorabilityIndex_90N000E_browse.jpg; do get "Lunar_Research/IceFavorabilityIndex/$f"; done
get Lunar_LRO_LOLA_Albedo_Global_10ppd.tif
get Lunar_LRO_LOLA_ClrShade_Global_32ppd_v04.tif
get Lunar_Clementine_UVVIS_FeO_ClrBinned_70S70N_1km.tif
for m in FeOWeightPercent_50N50S_colorize.png OlivinePercent_50N50S_colorize.png PlagioclasePercent_50N50S_colorize.png \
  OpticalMaturityIndex_50N50S_grayscale.png FeOWeightPercent_50N50S.tif PlagioclasePercent_50N50S.tif; do
  get "Lunar_MI_mineral_maps/4ppd/Lunar_Kaguya_MIMap_MineralDeconv_$m"; done
get Lunar_Photoclinometry/Haworth-SfS/README.txt
get Lunar_Photoclinometry/Haworth-SfS/Lunar_LROnac_Haworth_browsemax.jpg
get Lunar_Photoclinometry/Haworth-SfS/Lunar_LROnac_Haworth_sfs-dem_shade_1m_v3.tif
get Lunar_Photoclinometry/Haworth-SfS/Lunar_LROnac_Haworth_sfs-dem_1m_v3.tif
L=Lunar_safed/LMAP/SouthPolar
for f in ldem_87s_5mpp_README.txt NAC_POLE_SOUTH_README.txt NAC_POLE_SOUTH_IMAGES.txt ShadowCam_SPOLE-90_Mosaic_1m_cog.txt \
  LRO_LROC_NAC_SPOLE-90_Mosaic_1m_controlled_readme.txt NAC_POLE_SOUTH_ABSTRACT.pdf; do get "$L/$f"; done
get "$L/ldem_87s_5mpp_hillshade_cog.tif"
get "$A/87S_STL.zip"
get Lunar_Kaguya_TC_Morning_Global_64ppd_v04.tif
get "$L/ldem_87s_5mpp_cog.tif"
get "$L/NAC_POLE_SOUTH_CM_AVG_P848S0112.TIF"
get Lunar_LRO_LROC-WAC_Mosaic_global_100m_June2013.tif
get "$A/87S.zip"
get "$A/84S_STL.zip"
get "$A/84S.zip"
get "$L/ShadowCam_SPOLE-90_Mosaic_1m_cog.tif"
echo ALL DONE
