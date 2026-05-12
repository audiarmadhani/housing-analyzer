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

type StepOption = {
  value: string;
  label: string;
};

type StepConfig = {
  id: keyof ListingFormState;
  question: string;
  description: string;
  placeholder?: string;
  inputType: "text" | "select";
  required?: boolean;
  options?: StepOption[];
};

const FORM_STEPS: StepConfig[] = [
  {
    id: "price",
    question: "What is the asking price?",
    description: "Enter the listing price in Indonesian Rupiah.",
    placeholder: "IDR (e.g. 2,500,000,000)",
    inputType: "text",
    required: true,
  },
  {
    id: "city",
    question: "Which city is the property in?",
    description: "Choose the city to narrow the market area.",
    inputType: "select",
    required: true,
  },
  {
    id: "district",
    question: "Which district or area is it in?",
    description: "Pick the closest area so we can compare against nearby listings.",
    inputType: "select",
    required: true,
  },
  {
    id: "land_size",
    question: "How large is the land?",
    description: "Enter the land size in square meters.",
    placeholder: "0",
    inputType: "text",
    required: true,
  },
  {
    id: "building_size",
    question: "How large is the building?",
    description: "Optional, but it improves comparable matching.",
    placeholder: "0",
    inputType: "text",
  },
  {
    id: "bedrooms",
    question: "How many bedrooms are there?",
    description: "Optional, but helps compare similar homes.",
    placeholder: "0",
    inputType: "text",
  },
  {
    id: "bathrooms",
    question: "How many bathrooms are there?",
    description: "Optional, but useful for refining results.",
    placeholder: "0",
    inputType: "text",
  },
  {
    id: "electricity",
    question: "What is the electrical power?",
    description: "Optional. Enter the installed wattage if you know it.",
    placeholder: "4400",
    inputType: "text",
  },
  {
    id: "sertifikat",
    question: "What certificate type does it have?",
    description: "Choose the ownership certificate when available.",
    inputType: "select",
    options: [
      { value: "shm", label: "SHM" },
      { value: "hgb", label: "HGB" },
    ],
  },
  {
    id: "interior",
    question: "What is the furnishing condition?",
    description: "This helps us compare homes with a similar finish level.",
    inputType: "select",
    options: [
      { value: "full furnished", label: "Full furnished" },
      { value: "semi furnished", label: "Semi furnished" },
      { value: "unfurnished", label: "Unfurnished" },
    ],
  },
  {
    id: "orientation",
    question: "What is the lot type?",
    description: "Choose whether the home is on a hook lot or a standard lot.",
    inputType: "select",
    options: [
      { value: "hook", label: "Hook" },
      { value: "normal", label: "Normal" },
    ],
  },
];

function isStepComplete(
  step: StepConfig,
  input: ListingFormState,
  districts: string[]
): boolean {
  const value = input[step.id].trim();
  if (!step.required) return true;
  if (step.id === "district") return districts.length > 0 && value.length > 0;
  return value.length > 0;
}

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
  const [stepIndex, setStepIndex] = useState(0);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);

  const districts = input.city ? LOCATION_MAP[input.city] || [] : [];
  const currentStep = FORM_STEPS[stepIndex];
  const totalSteps = FORM_STEPS.length;
  const isLastStep = stepIndex === totalSteps - 1;
  const canContinue = isStepComplete(currentStep, input, districts);
  const stepProgress = ((stepIndex + 1) / totalSteps) * 100;

  /** After “Run analysis”, narrow form on the left and show results (or loading) on the right. */
  const splitLayout = loading || result !== null;

  function updateField(field: keyof ListingFormState, value: string) {
    setInput((prev) => {
      if (field === "city") {
        return { ...prev, city: value, district: "" };
      }
      return { ...prev, [field]: value };
    });
  }

  function goToNextStep() {
    if (!canContinue) return;
    if (isLastStep) {
      void runAnalyze();
      return;
    }
    setStepDirection(1);
    setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
  }

  function goToPreviousStep() {
    if (stepIndex === 0) return;
    setStepDirection(-1);
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }

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
        className={`relative mx-auto px-4 transition-[max-width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-6 ${
          splitLayout
            ? "max-w-7xl pb-24 pt-14 lg:pt-20"
            : "flex min-h-screen items-center max-w-6xl"
        }`}
      >
        {splitLayout && (
          <p className="mb-6 text-center text-sm text-slate-400 lg:hidden">
            Fair Home Price Check · Results
          </p>
        )}

        <div
          className={`w-full flex flex-col gap-10 lg:flex-row lg:gap-10 ${
            splitLayout
              ? "lg:items-stretch"
              : "lg:items-center lg:justify-between lg:gap-x-12 xl:gap-x-20"
          }`}
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
                  <p className="mt-1 text-xs text-slate-500">One question at a time</p>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium tabular-nums text-slate-400">
                  {stepIndex + 1}/{totalSteps}
                </span>
              </div>

              <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-[width] duration-500 ease-out"
                  style={{ width: `${stepProgress}%` }}
                />
              </div>

              <div className="overflow-hidden">
                <div
                  key={`${currentStep.id}-${stepDirection}`}
                  className={`space-y-6 ${
                    stepDirection > 0 ? "animate-step-forward" : "animate-step-back"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-semibold tracking-tight text-white">
                        {currentStep.question}
                      </p>
                      {!currentStep.required && (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="max-w-sm text-sm leading-relaxed text-slate-400">
                      {currentStep.description}
                    </p>
                  </div>

                  <div className="min-h-[172px]">
                    {currentStep.inputType === "select" ? (
                      <div className="space-y-3">
                        <select
                          className={`${fieldClass} text-base`}
                          value={input[currentStep.id]}
                          disabled={currentStep.id === "district" && !input.city}
                          onChange={(e) => updateField(currentStep.id, e.target.value)}
                        >
                          <option value="">
                            {currentStep.id === "city"
                              ? "Select city"
                              : currentStep.id === "district"
                                ? input.city
                                  ? "Select area"
                                  : "Choose city first"
                                : "Select"}
                          </option>
                          {(currentStep.id === "city"
                            ? Object.keys(LOCATION_MAP).map((city) => ({
                                value: city,
                                label: city,
                              }))
                            : currentStep.id === "district"
                              ? districts.map((district) => ({
                                  value: district,
                                  label: district,
                                }))
                              : currentStep.options ?? []
                          ).map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              className="bg-slate-900"
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {currentStep.id === "district" && input.city && districts.length === 0 && (
                          <p className="text-xs text-amber-300/90">
                            No districts are available for this city yet.
                          </p>
                        )}
                      </div>
                    ) : (
                      <input
                        className={`${fieldClass} text-base`}
                        placeholder={currentStep.placeholder}
                        value={
                          currentStep.id === "price"
                            ? formatNumber(input.price)
                            : input[currentStep.id]
                        }
                        inputMode={
                          currentStep.id === "price" ||
                          currentStep.id === "land_size" ||
                          currentStep.id === "building_size" ||
                          currentStep.id === "bedrooms" ||
                          currentStep.id === "bathrooms" ||
                          currentStep.id === "electricity"
                            ? "numeric"
                            : "text"
                        }
                        onChange={(e) =>
                          updateField(
                            currentStep.id,
                            currentStep.id === "price"
                              ? e.target.value.replace(/\D/g, "")
                              : e.target.value
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && canContinue && !loading) {
                            e.preventDefault();
                            goToNextStep();
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-3">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  disabled={stepIndex === 0 || loading}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canContinue || loading}
                  onClick={goToNextStep}
                  className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
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
                      {isLastStep ? "Run analysis" : "Next"}
                      <span className="transition group-hover:translate-x-0.5">→</span>
                    </>
                  )}
                </button>
              </div>
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
