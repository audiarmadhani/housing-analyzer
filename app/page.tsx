"use client";

import { useState } from "react";
import { LOCATION_MAP } from "@/lib/location-map";
import type { ListingFormState } from "@/lib/listing-types";

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
  "w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-500/15";

const glassCard =
  "rounded-3xl border border-white/15 bg-slate-950/40 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8";

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
        Position in the market range
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
        <span>Cheap</span>
        <span>Fair</span>
        <span>Expensive</span>
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
        Effective price per m² distribution
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
          Analysis complete
        </span>
        <h2 className="mt-4 text-3xl font-semibold capitalize tracking-tight text-white sm:text-4xl">
          {result.market_position}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {result.percentile} percentile vs. similar listings
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
            Estimated fair price
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-cyan-100">
            {formatCurrency(result.fair_price)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Range {formatCurrency(result.low_price)} — {formatCurrency(result.high_price)}
          </p>
        </div>
      </div>

      <PriceBar result={result} input={input} />
      <MiniChart result={result} />

      <p className="text-center text-xs text-slate-500">
        Based on {result.comps_count} listings · Confidence:{" "}
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
        Comparable listings
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
              <span>{c.land_size} m² land</span>
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

  /** After “Run analysis”, narrow form on the left and show results (or loading) on the right. */
  const splitLayout = loading || result !== null;

  async function runAnalyze(form?: ListingFormState) {
    const src = form ?? input;
    setLoading(true);

    const res = await fetch("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        ...src,
        price: Number(src.price),
        land_size: Number(src.land_size),
        building_size: Number(src.building_size),
        bedrooms: Number(src.bedrooms),
        bathrooms: Number(src.bathrooms),
        electricity: Number(src.electricity),
      }),
    });

    const data = (await res.json()) as AnalyzeResponse;
    setResult(data);
    setLoading(false);
  }

  function handleCloseAnalysisView() {
    setResult(null);
    setLoading(false);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 mesh-bg" />
      <div className="pointer-events-none absolute inset-0 grid-overlay" />

      <main
        className={`relative mx-auto px-4 pb-24 pt-14 transition-[max-width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-6 lg:pt-20 ${splitLayout ? "max-w-7xl" : "max-w-6xl"}`}
      >
        {splitLayout && (
          <p className="mb-6 text-center text-sm text-slate-400 lg:hidden">
            Fair Home Price Check · Results
          </p>
        )}

        <div
          className={`flex flex-col gap-10 lg:flex-row lg:items-stretch lg:gap-10 ${!splitLayout ? "lg:justify-between lg:gap-x-12 xl:gap-x-20" : ""}`}
        >
          {!splitLayout && (
            <header className="animate-fade-up flex max-w-xl flex-shrink-0 flex-col justify-center lg:py-4">
              <div className="mb-8 flex -space-x-2">
                <span className="relative z-[4] h-10 w-10 rounded-full border-2 border-slate-950 bg-sky-400" />
                <span className="relative z-[3] h-10 w-10 rounded-full border-2 border-slate-950 bg-rose-500" />
                <span className="relative z-[2] h-10 w-10 rounded-full border-2 border-slate-950 bg-teal-400" />
                <span className="relative z-[1] h-10 w-10 rounded-full border-2 border-slate-950 bg-indigo-500" />
              </div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
                Housing AI
              </p>
              <h1 className="text-4xl font-bold uppercase leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[2.75rem] xl:text-5xl">
                Fair home price check
              </h1>
              <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-slate-400">
                Tell us about the listing in a few steps — we compare it with similar properties
                and show how fair the price looks.
              </p>
            </header>
          )}

          <div
            className={`w-full transition-[max-width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${splitLayout ? "lg:max-w-[22rem] lg:flex-shrink-0" : "lg:max-w-xl lg:flex-shrink-0"}`}
          >
            {splitLayout && (
              <div className="mb-4 hidden lg:block">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
                  Housing AI
                </p>
                <p className="mt-1 text-sm text-slate-500">Edit listing and run again</p>
              </div>
            )}

            <div
              className={`${glassCard} animate-fade-up-delay-1 border-emerald-500/10 shadow-emerald-950/20 transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${splitLayout ? "lg:shadow-xl" : ""}`}
            >
              <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-white">Listing details</h2>
                  <p className="mt-1 text-xs text-slate-500">Required fields for comparison</p>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium tabular-nums text-slate-400">
                  1/1
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Price</label>
                  <input
                    className={fieldClass}
                    placeholder="IDR (e.g. 2,500,000,000)"
                    value={formatNumber(input.price)}
                    onChange={(e) =>
                      setInput({ ...input, price: e.target.value.replace(/\D/g, "") })
                    }
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">City</label>
                  <select
                    className={fieldClass}
                    value={input.city}
                    onChange={(e) =>
                      setInput({ ...input, city: e.target.value, district: "" })
                    }
                  >
                    <option value="">Select city</option>
                    {Object.keys(LOCATION_MAP).map((c) => (
                      <option key={c} value={c} className="bg-slate-900">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">
                    District / area
                  </label>
                  <select
                    className={fieldClass}
                    value={input.district}
                    disabled={!input.city}
                    onChange={(e) => setInput({ ...input, district: e.target.value })}
                  >
                    <option value="">Select area</option>
                    {districts.map((d: string) => (
                      <option key={d} value={d} className="bg-slate-900">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">
                    Land size (m²)
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
                    Building size (m²)
                  </label>
                  <input
                    className={fieldClass}
                    placeholder="0"
                    value={input.building_size}
                    onChange={(e) => setInput({ ...input, building_size: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Bedrooms</label>
                  <input
                    className={fieldClass}
                    placeholder="0"
                    value={input.bedrooms}
                    onChange={(e) => setInput({ ...input, bedrooms: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Bathrooms</label>
                  <input
                    className={fieldClass}
                    placeholder="0"
                    value={input.bathrooms}
                    onChange={(e) => setInput({ ...input, bathrooms: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">
                    Electrical power (W)
                  </label>
                  <input
                    className={fieldClass}
                    placeholder="4400"
                    value={input.electricity}
                    onChange={(e) => setInput({ ...input, electricity: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">
                    Title (certificate)
                  </label>
                  <select
                    className={fieldClass}
                    value={input.sertifikat}
                    onChange={(e) => setInput({ ...input, sertifikat: e.target.value })}
                  >
                    <option value="">Select</option>
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
                    <option value="">Select</option>
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
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Lot type</label>
                  <select
                    className={fieldClass}
                    value={input.orientation}
                    onChange={(e) => setInput({ ...input, orientation: e.target.value })}
                  >
                    <option value="">Select</option>
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
              onClick={() => runAnalyze()}
              className="group mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
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
                    Analyzing…
                  </>
                ) : (
                  <>
                    Run analysis
                    <span className="transition group-hover:translate-x-0.5">→</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {splitLayout && (
            <div className="animate-split-pane flex min-h-[280px] flex-1 flex-col lg:min-h-[480px]">
              {loading && (
                <div
                  className={`${glassCard} flex flex-1 flex-col justify-center border-white/10`}
                >
                  <div className="mx-auto flex max-w-xs flex-col items-center gap-4 text-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
                    <p className="text-sm font-medium text-white">Analyzing your listing</p>
                    <p className="text-xs text-slate-500">Pulling comparables and building the price model…</p>
                  </div>
                </div>
              )}

              {result && !loading && (
                <div className={`${glassCard} flex-1 border-white/10`}>
                  {isAnalyzeError(result) ? (
                    <div className="flex flex-col items-center gap-4 py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200">
                        !
                      </div>
                      <p className="text-sm text-slate-300">{result.error}</p>
                      <button
                        type="button"
                        onClick={handleCloseAnalysisView}
                        className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-white/25 hover:bg-white/10"
                      >
                        Back to form
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                        <div>
                          <h2 className="text-lg font-semibold tracking-tight text-white">
                            Market analysis
                          </h2>
                          <p className="mt-1 text-xs text-slate-500">Compared with similar listings</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleCloseAnalysisView}
                          aria-label="Close results and return to the home layout"
                          className="shrink-0 cursor-pointer rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:border-emerald-400/40 hover:bg-emerald-500/20"
                        >
                          Done
                        </button>
                      </div>
                      <ResultSummary result={result} input={input} />
                      <CompsList comps={result.comps} />
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
