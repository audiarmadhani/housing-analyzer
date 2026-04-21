import { supabase } from "./supabase";

// -----------------------------
// HELPERS
// -----------------------------
function shuffleArray(array: any[]) {
  return array.sort(() => Math.random() - 0.5);
}

function calculatePercentile(values: number[], target: number) {
  const sorted = [...values].sort((a, b) => a - b);

  const index = sorted.findIndex((v) => v >= target);
  if (index === -1) return 100;

  return (index / sorted.length) * 100;
}

// -----------------------------
// NORMALIZATION
// -----------------------------
function normalizeInterior(val?: string) {
  if (!val) return null;
  val = val.toLowerCase();

  if (val.includes("full")) return "full";
  if (val.includes("semi")) return "semi";
  if (val.includes("unfurnished")) return "unfurnished";

  return null;
}

function normalizeSertifikat(val?: string) {
  if (!val) return null;
  val = val.toLowerCase();

  if (val.includes("shm")) return "shm";
  if (val.includes("hgb")) return "hgb";

  return "other";
}

// -----------------------------
// FILTER COMPARABLES
// -----------------------------
function filterComparables(comps: any[], input: any) {
  return comps.filter((c) => {
    if (!c.land_size || !c.price) return false;

    const landDiff =
      Math.abs(c.land_size - input.land_size) / input.land_size;

    const buildingDiff =
      Math.abs((c.building_size || 0) - (input.building_size || 0)) /
      (input.building_size || 1);

    const bedDiff =
      Math.abs((c.bedrooms || 0) - input.bedrooms);

    return (
      landDiff <= 0.4 &&
      buildingDiff <= 0.5 &&
      bedDiff <= 2
    );
  });
}

// -----------------------------
// LOCATION SCORE
// -----------------------------
function locationScore(c: any, input: any) {
  let score = 0;

  if (c.city === input.city) score += 1;
  if (c.district === input.district) score += 2;

  return score;
}

// -----------------------------
// FEATURE ADJUSTMENT (SAFE)
// -----------------------------
function featureAdjustment(c: any, input: any) {
  let adj = 0;

  const s1 = normalizeSertifikat(c.sertifikat);
  const s2 = normalizeSertifikat(input.sertifikat);

  if (s1 && s2 && s1 !== s2) {
    if (s2 === "shm") adj += 0.04;
    if (s2 === "hgb") adj -= 0.02;
  }

  const i1 = normalizeInterior(c.interior);
  const i2 = normalizeInterior(input.interior);

  if (i1 && i2 && i1 !== i2) {
    if (i2 === "full") adj += 0.04;
    if (i2 === "semi") adj += 0.015;
    if (i2 === "unfurnished") adj -= 0.02;
  }

  if (input.orientation === "hook" && c.orientation !== "hook") {
    adj += 0.025;
  }

  if (c.electricity && input.electricity) {
    let diff =
      (input.electricity - c.electricity) / c.electricity;

    diff = Math.max(-0.2, Math.min(0.2, diff)); // cap
    adj += diff * 0.05;
  }

  return adj;
}

// -----------------------------
// SIZE MODEL
// -----------------------------
function getEffectiveSize(c: any) {
  return (c.land_size || 0) * 0.7 +
         (c.building_size || 0) * 0.3;
}

// -----------------------------
// SCORING
// -----------------------------
function scoreComparable(c: any, input: any) {
  const landDiff =
    Math.abs(c.land_size - input.land_size) / input.land_size;

  const buildingDiff =
    Math.abs((c.building_size || 0) - (input.building_size || 0)) /
    (input.building_size || 1);

  const bedDiff =
    Math.abs((c.bedrooms || 0) - input.bedrooms);

  const bathDiff =
    Math.abs((c.bathrooms || 0) - (input.bathrooms || 0));

  const location = locationScore(c, input);

  return (
    landDiff * 0.35 +
    buildingDiff * 0.25 +
    bedDiff * 0.15 +
    bathDiff * 0.1 -
    location * 0.5
  );
}

// -----------------------------
// FETCH STRATEGY (IMPORTANT)
// -----------------------------
async function fetchComparables(input: any) {
  const city = input.city?.toLowerCase();
  const district = input.district?.toLowerCase();

  // 1️⃣ district first
  if (district) {
    const { data } = await supabase
      .from("housing_listings")
      .select("*")
      .ilike("district", `%${district}%`)
      .limit(200);

    if (data && data.length >= 10) return data;
  }

  // 2️⃣ city fallback
  const { data: cityData } = await supabase
    .from("housing_listings")
    .select("*")
    .ilike("city", `%${city}%`)
    .limit(300);

  if (cityData && cityData.length >= 10) return cityData;

  // 3️⃣ global fallback
  const { data: all } = await supabase
    .from("housing_listings")
    .select("*")
    .limit(300);

  return all || [];
}

// -----------------------------
// MAIN FUNCTION
// -----------------------------
export async function analyzeListing(input: any) {
  if (!input.city || !input.land_size || !input.price) {
    return { error: "Invalid input" };
  }

  let comps = await fetchComparables(input);

  if (!comps.length) {
    return { error: "No data available" };
  }

  // -----------------------------
  // FILTER
  // -----------------------------
  let filtered = filterComparables(comps, input);
  if (filtered.length < 10) filtered = comps;

  // -----------------------------
  // SORT + TAKE TOP N
  // -----------------------------
  filtered.sort(
    (a, b) => scoreComparable(a, input) - scoreComparable(b, input)
  );

  const top = filtered.slice(0, 40);

  // -----------------------------
  // WEIGHTED MODEL
  // -----------------------------
  const enriched = top.map((c) => {
    const score = scoreComparable(c, input);
    const base = c.price / getEffectiveSize(c);
    const adj = featureAdjustment(c, input);

    return {
      ...c,
      weight: 1 / (1 + score),
      ppm2: base * (1 + adj),
    };
  });

  // -----------------------------
  // REMOVE OUTLIERS (IQR)
  // -----------------------------
  const values = enriched.map((c) => c.ppm2).sort((a, b) => a - b);

  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const iqr = q3 - q1;

  const clean = enriched.filter(
    (c) => c.ppm2 >= q1 - 1.5 * iqr && c.ppm2 <= q3 + 1.5 * iqr
  );

  if (clean.length < 5) {
    return { error: "Not enough reliable data" };
  }

  // -----------------------------
  // FINAL CALCULATION
  // -----------------------------
  let totalWeight = 0;
  let weightedSum = 0;

  for (const c of clean) {
    totalWeight += c.weight;
    weightedSum += c.ppm2 * c.weight;
  }

  const avgPpm2 = weightedSum / totalWeight;

  const fair_price = avgPpm2 * getEffectiveSize(input);

  // RANGE
  const cleanValues = clean.map((c) => c.ppm2).sort((a, b) => a - b);

  const p25 = cleanValues[Math.floor(cleanValues.length * 0.25)];
  const p75 = cleanValues[Math.floor(cleanValues.length * 0.75)];

  const low_price = p25 * getEffectiveSize(input);
  const high_price = p75 * getEffectiveSize(input);

  // -----------------------------
  // PERCENTILE
  // -----------------------------
  const userPpm2 = input.price / getEffectiveSize(input);
  const percentile = calculatePercentile(cleanValues, userPpm2);

  // -----------------------------
  // LABEL
  // -----------------------------
  let label = "fair";
  if (percentile > 70) label = "overpriced";
  if (percentile < 30) label = "underpriced";

  let market_position = "market price";

  if (percentile < 20) market_position = "cheap";
  else if (percentile < 40) market_position = "below market";
  else if (percentile < 60) market_position = "market price";
  else if (percentile < 80) market_position = "above market";
  else market_position = "premium";

  const delta = ((input.price - fair_price) / fair_price) * 100;

  // -----------------------------
  // CONFIDENCE
  // -----------------------------
  let confidence = "low";
  if (clean.length >= 25) confidence = "high";
  else if (clean.length >= 12) confidence = "medium";

  // -----------------------------
  // FINAL OUTPUT
  // -----------------------------
  const shuffled = shuffleArray(clean);

  return {
    fair_price: Math.round(fair_price),
    low_price: Math.round(low_price),
    high_price: Math.round(high_price),

    delta_pct: delta.toFixed(1),
    label,
    market_position,

    percentile: percentile.toFixed(0),

    confidence,
    comps_count: clean.length,
    comps: shuffled.slice(0, 3),
  };
}