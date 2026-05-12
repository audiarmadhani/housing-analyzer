import { LOCATION_MAP } from "./location-map";

function norm(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Map scraped location strings to form city/district keys in LOCATION_MAP. */
export function matchCityDistrict(
  rawCity: string | undefined,
  rawDistrict: string | undefined
): { city: string; district: string } {
  const cityInput = norm(rawCity || "");
  const districtInput = norm(rawDistrict || "");

  let cityKey = "";
  const cities = Object.keys(LOCATION_MAP);

  // Prefer longest matching city key (handles "jakarta selatan" vs "jakarta")
  const sortedByLen = [...cities].sort((a, b) => b.length - a.length);
  for (const key of sortedByLen) {
    if (
      cityInput === key ||
      cityInput.includes(key) ||
      key.includes(cityInput)
    ) {
      cityKey = key;
      break;
    }
  }

  let districtKey = "";
  if (cityKey) {
    const districts = LOCATION_MAP[cityKey];
    const sortedD = [...districts].sort((a, b) => b.length - a.length);
    for (const d of sortedD) {
      if (
        districtInput === d ||
        districtInput.includes(d) ||
        d.includes(districtInput)
      ) {
        districtKey = d;
        break;
      }
    }
  }

  return { city: cityKey, district: districtKey };
}
