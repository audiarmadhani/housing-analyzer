"use client";

import { useState } from "react";

type ListingFormState = {
  price: string;
  city: string;
  district: string;
  land_size: string;
  building_size: string;
  bedrooms: string;
  bathrooms: string;
  electricity: string;
  sertifikat: string;
  interior: string;
  orientation: string;
};

type CompListing = {
  title: string;
  url: string;
  price: number;
  land_size: number;
};

type AnalyzeSuccess = {
  fair_price: number;
  low_price: number;
  high_price: number;
  delta_pct: string;
  label: string;
  market_position: string;
  percentile: string;
  confidence: string;
  comps_count: number;
  comps: CompListing[];
  distribution?: number[];
};

type AnalyzeResponse = { error: string } | AnalyzeSuccess;

function isAnalyzeError(r: AnalyzeResponse): r is { error: string } {
  return "error" in r && typeof (r as { error?: string }).error === "string";
}

// -----------------------------
// LOCATION MAP
// -----------------------------
const LOCATION_MAP: Record<string, string[]> = {
  "jakarta selatan": [
    "kebayoran baru",
    "pondok indah",
    "cipete",
    "fatmawati",
    "tebet",
    "kemang",
    "jagakarsa",
  ],
  "jakarta barat": [
    "kebon jeruk",
    "tanjung duren",
    "cengkareng",
    "kalideres",
    "puri indah",
  ],
  "jakarta timur": ["duren sawit", "cakung", "cipinang"],
  "jakarta utara": ["kelapa gading", "pluit", "pantai indah kapuk"],
  "jakarta pusat": ["menteng", "senen", "tanah abang"],
  "tangerang selatan": [
    "bintaro",
    "graha bintaro",
    "bsd",
    "bsd city",
    "gading serpong",
    "alam sutera",
    "serpong",
    "ciputat",
    "pamulang",
  ],
  "tangerang": ["karawaci", "cikupa", "tigaraksa"],
  bekasi: [
    "bekasi barat",
    "bekasi timur",
    "bekasi utara",
    "bekasi selatan",
    "grand galaxy",
    "harapan indah",
  ],
  depok: ["cinere", "beji", "margonda", "sawangan"],
  bogor: ["sentul", "sentul city", "cibinong", "bogor selatan"],
};

function formatNumber(value: string) {
  if (!value) return "";
  return new Intl.NumberFormat("id-ID").format(Number(value.replace(/\D/g, "")));
}

function formatCurrency(num: number) {
  return "Rp " + num.toLocaleString("id-ID");
}

function calculateDealScore(percentile: number) {
  return Math.max(0, Math.min(100, 100 - percentile));
}

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20";

function PriceBar({
  result,
  input,
}: {
  result: AnalyzeSuccess;
  input: ListingFormState;
}) {
  if (!result?.low_price || !result?.high_price) return null;

  const min = result.low_price;
  const max = result.high_price;
  const price = Number(input.price);

  let percent = 50;
  if (max > min) {
    percent = ((price - min) / (max - min)) * 100;
  }
  percent = Math.max(0, Math.min(100, percent));

  return (
    <div className="mt-8">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
        Posisi dalam rentang pasar
      </p>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-800/80">
        <div
          className="absolute inset-y-0 left-0 w-full rounded-full opacity-90"
          style={{
            background:
              "linear-gradient(90deg, rgb(34 197 94), rgb(250 204 21), rgb(239 68 68))",
          }}
        />
        <div
          className="absolute top-1/2 z-10 h-5 w-1 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]"
          style={{ left: `calc(${percent}% - 2px)` }}
        />
      </div>
      <div className="relative mt-2 flex justify-between text-xs text-slate-500">
        <span>Murah</span>
        <span>Wajar</span>
        <span>Mahal</span>
      </div>
    </div>
  );
}

function MiniChart({ result }: { result: AnalyzeSuccess }) {
  const values = result?.distribution || [];
  if (!values.length) return null;

  const max = Math.max(...values);
  const userIndex = Math.floor((Number(result.percentile) / 100) * values.length);

  return (
    <div className="mt-8">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
        Distribusi harga per m² efektif
      </p>
      <div className="flex h-24 items-end gap-0.5 rounded-xl border border-white/5 bg-slate-900/40 p-3">
        {values.slice(0, 30).map((v: number, i: number) => (
          <div
            key={i}
            className="min-w-[3px] flex-1 rounded-sm transition-colors"
            style={{
              height: `${Math.max(8, (v / max) * 100)}%`,
              background:
                i === userIndex
                  ? "linear-gradient(to top, rgb(167 139 250), rgb(34 211 238))"
                  : "rgb(71 85 105 / 0.6)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ResultSummary({
  result,
  input,
}: {
  result: AnalyzeSuccess;
  input: ListingFormState;
}) {
  const dealScore = calculateDealScore(Number(result.percentile));

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-violet-200/90">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Analisis selesai
        </span>
        <h2 className="mt-4 text-3xl font-semibold capitalize tracking-tight text-white sm:text-4xl">
          {result.market_position}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Persentil ke-{result.percentile} dibanding properti serupa
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-transparent p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Deal score
          </p>
          <p className="mt-2 font-mono text-4xl font-semibold tabular-nums text-white">
            {dealScore}
            <span className="text-lg font-normal text-slate-500">/100</span>
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Perkiraan harga wajar
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-cyan-100">
            {formatCurrency(result.fair_price)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Rentang {formatCurrency(result.low_price)} — {formatCurrency(result.high_price)}
          </p>
        </div>
      </div>

      <PriceBar result={result} input={input} />
      <MiniChart result={result} />

      <p className="text-center text-xs text-slate-500">
        Berdasarkan {result.comps_count} listing · Kepercayaan:{" "}
        <span className="text-slate-400">{result.confidence}</span>
      </p>
    </div>
  );
}

function CompsList({ comps }: { comps: CompListing[] }) {
  if (!comps?.length) return null;

  return (
    <div className="mt-10 border-t border-white/10 pt-10">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        Listing pembanding
      </h3>
      <div className="mt-4 space-y-3">
        {comps.map((c, i) => (
          <a
            key={i}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-violet-500/30 hover:bg-white/[0.05]"
          >
            <p className="font-medium text-slate-100 group-hover:text-white">{c.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span className="font-mono text-violet-200">{formatCurrency(c.price)}</span>
              <span className="text-slate-500">·</span>
              <span>{c.land_size} m² tanah</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [input, setInput] = useState<ListingFormState>({
    price: "",
    city: "",
    district: "",
    land_size: "",
    building_size: "",
    bedrooms: "",
    bathrooms: "",
    electricity: "",
    sertifikat: "",
    interior: "",
    orientation: "",
  });

  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const districts = input.city ? LOCATION_MAP[input.city] || [] : [];

  async function handleSubmit() {
    setLoading(true);

    const res = await fetch("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        price: Number(input.price),
        land_size: Number(input.land_size),
        building_size: Number(input.building_size),
        bedrooms: Number(input.bedrooms),
        bathrooms: Number(input.bathrooms),
        electricity: Number(input.electricity),
      }),
    });

    const data = (await res.json()) as AnalyzeResponse;
    setResult(data);
    setLoading(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 mesh-bg" />
      <div className="pointer-events-none absolute inset-0 grid-overlay" />

      <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
        <header className="animate-fade-up text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-sm">
            <span className="text-base leading-none">🏠</span>
            Model harga pasar · Indonesia
          </div>
          <h1 className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
            Cek Rumah Murah
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
            Masukkan detail listing Anda. Kami bandingkan dengan data properti serupa dan
            memberi skor kewajaran harga secara instan.
          </p>
        </header>

        <div className="animate-fade-up-delay-1 mt-12">
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-2xl shadow-violet-950/20 backdrop-blur-xl sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Harga</label>
                <input
                  className={fieldClass}
                  placeholder="Rp (contoh: 2.500.000.000)"
                  value={formatNumber(input.price)}
                  onChange={(e) =>
                    setInput({ ...input, price: e.target.value.replace(/\D/g, "") })
                  }
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Kota</label>
                <select
                  className={fieldClass}
                  value={input.city}
                  onChange={(e) =>
                    setInput({ ...input, city: e.target.value, district: "" })
                  }
                >
                  <option value="">Pilih kota</option>
                  {Object.keys(LOCATION_MAP).map((c) => (
                    <option key={c} value={c} className="bg-slate-900">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Kecamatan / area
                </label>
                <select
                  className={fieldClass}
                  value={input.district}
                  disabled={!input.city}
                  onChange={(e) => setInput({ ...input, district: e.target.value })}
                >
                  <option value="">Pilih area</option>
                  {districts.map((d: string) => (
                    <option key={d} value={d} className="bg-slate-900">
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Luas tanah (m²)
                </label>
                <input
                  className={fieldClass}
                  placeholder="0"
                  value={input.land_size}
                  onChange={(e) => setInput({ ...input, land_size: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Luas bangunan (m²)
                </label>
                <input
                  className={fieldClass}
                  placeholder="0"
                  value={input.building_size}
                  onChange={(e) => setInput({ ...input, building_size: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Kamar tidur</label>
                <input
                  className={fieldClass}
                  placeholder="0"
                  value={input.bedrooms}
                  onChange={(e) => setInput({ ...input, bedrooms: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Kamar mandi</label>
                <input
                  className={fieldClass}
                  placeholder="0"
                  value={input.bathrooms}
                  onChange={(e) => setInput({ ...input, bathrooms: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Listrik (Watt)
                </label>
                <input
                  className={fieldClass}
                  placeholder="4400"
                  value={input.electricity}
                  onChange={(e) => setInput({ ...input, electricity: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Sertifikat</label>
                <select
                  className={fieldClass}
                  value={input.sertifikat}
                  onChange={(e) => setInput({ ...input, sertifikat: e.target.value })}
                >
                  <option value="">Pilih</option>
                  <option value="shm" className="bg-slate-900">
                    SHM
                  </option>
                  <option value="hgb" className="bg-slate-900">
                    HGB
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Interior</label>
                <select
                  className={fieldClass}
                  value={input.interior}
                  onChange={(e) => setInput({ ...input, interior: e.target.value })}
                >
                  <option value="">Pilih</option>
                  <option value="full furnished" className="bg-slate-900">
                    Full furnished
                  </option>
                  <option value="semi furnished" className="bg-slate-900">
                    Semi furnished
                  </option>
                  <option value="unfurnished" className="bg-slate-900">
                    Unfurnished
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Posisi</label>
                <select
                  className={fieldClass}
                  value={input.orientation}
                  onChange={(e) => setInput({ ...input, orientation: e.target.value })}
                >
                  <option value="">Pilih</option>
                  <option value="hook" className="bg-slate-900">
                    Hook
                  </option>
                  <option value="normal" className="bg-slate-900">
                    Normal
                  </option>
                </select>
              </div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="group mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Menganalisis…
                </>
              ) : (
                <>
                  Jalankan analisis
                  <span className="transition group-hover:translate-x-0.5">→</span>
                </>
              )}
            </button>
          </div>
        </div>

        {result && (
          <div className="animate-fade-up-delay-2 mt-10 rounded-3xl border border-white/10 bg-slate-900/50 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
            {isAnalyzeError(result) ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
                  !
                </div>
                <p className="text-sm text-slate-300">{result.error}</p>
              </div>
            ) : (
              <>
                <ResultSummary result={result} input={input} />
                <CompsList comps={result.comps} />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
