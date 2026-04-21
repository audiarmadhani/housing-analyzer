"use client";

import { useState } from "react";

// -----------------------------
// LOCATION MAP
// -----------------------------
const LOCATION_MAP: any = {
  "jakarta selatan": ["kebayoran baru","pondok indah","cipete","fatmawati","tebet","kemang","jagakarsa"],
  "jakarta barat": ["kebon jeruk","tanjung duren","cengkareng","kalideres","puri indah"],
  "jakarta timur": ["duren sawit","cakung","cipinang"],
  "jakarta utara": ["kelapa gading","pluit","pantai indah kapuk"],
  "jakarta pusat": ["menteng","senen","tanah abang"],
  "tangerang selatan": ["bintaro","graha bintaro","bsd","bsd city","gading serpong","alam sutera","serpong","ciputat","pamulang"],
  "tangerang": ["karawaci","cikupa","tigaraksa"],
  "bekasi": ["bekasi barat","bekasi timur","bekasi utara","bekasi selatan","grand galaxy","harapan indah"],
  "depok": ["cinere","beji","margonda","sawangan"],
  "bogor": ["sentul","sentul city","cibinong","bogor selatan"],
};

// -----------------------------
// HELPERS
// -----------------------------
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

// -----------------------------
// PRICE BAR (FIXED)
// -----------------------------
function PriceBar({ result, input }: any) {
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
    <div style={{ marginTop: 20 }}>
      <div style={barContainer}>
        <div style={barFill} />

        <div
          style={{
            ...barIndicator,
            left: `${percent}%`,
          }}
        />

        <span style={{ ...barText, left: 0 }}>Cheap</span>
        <span style={{ ...barText, left: "45%" }}>Fair</span>
        <span style={{ ...barText, right: 0 }}>Expensive</span>
      </div>
    </div>
  );
}

// -----------------------------
// MINI CHART (FIXED)
// -----------------------------
function MiniChart({ result, input }: any) {
  const values = result?.distribution || [];
  if (!values.length) return null;

  const max = Math.max(...values);

  const userIndex = Math.floor(
    (Number(result.percentile) / 100) * values.length
  );

  return (
    <div style={{ marginTop: 20 }}>
      <div style={chartContainer}>
        {values.slice(0, 30).map((v: number, i: number) => (
          <div
            key={i}
            style={{
              ...bar,
              height: `${(v / max) * 100}%`,
              background: i === userIndex ? "#fff" : "#666",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// -----------------------------
// RESULT SUMMARY
// -----------------------------
function ResultSummary({ result, input }: any) {
  const dealScore = calculateDealScore(Number(result.percentile));

  return (
    <div>
      <h2 style={{ fontSize: 40, fontWeight: 700 }}>
        {result.market_position.toUpperCase()}
      </h2>

      <p style={{ color: "#aaa" }}>
        {result.percentile}th percentile
      </p>

      {/* DEAL SCORE */}
      <div style={dealBox}>
        Deal Score: <b>{dealScore}/100</b>
      </div>

      <p style={{ fontSize: 20 }}>
        Fair Price: <b>{formatCurrency(result.fair_price)}</b>
      </p>

      <p style={{ color: "#aaa" }}>
        Range: {formatCurrency(result.low_price)} —{" "}
        {formatCurrency(result.high_price)}
      </p>

      {/* PRICE BAR */}
      <PriceBar result={result} input={input} />

      {/* MINI CHART */}
      <MiniChart result={result} input={input} />

      <p style={{ marginTop: 25, color: "#888" }}>
        Based on {result.comps_count} listings • Confidence: {result.confidence}
      </p>
    </div>
  );
}

// -----------------------------
// COMPS
// -----------------------------
function CompsList({ comps }: any) {
  if (!comps?.length) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: 22 }}>Comparable Listings</h3>

      {comps.map((c: any, i: number) => (
        <a key={i} href={c.url} target="_blank">
          <div style={compCard}>
            <p style={{ fontWeight: 600 }}>{c.title}</p>
            <p>{formatCurrency(c.price)}</p>
            <p style={{ color: "#777" }}>{c.land_size} m²</p>
          </div>
        </a>
      ))}
    </div>
  );
}

// -----------------------------
// MAIN
// -----------------------------
export default function Home() {
  const [input, setInput] = useState<any>({
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

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const districts = LOCATION_MAP[input.city] || [];

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

    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <div style={container}>
      <h1 style={title}>🏠 Housing Analyzer</h1>

      <div style={card}>
        {/* PRICE */}
        <input
          placeholder="Price (Rp)"
          value={formatNumber(input.price)}
          style={inputStyle}
          onChange={(e) =>
            setInput({ ...input, price: e.target.value.replace(/\D/g, "") })
          }
        />

        {/* LOCATION */}
        <select
          style={inputStyle}
          value={input.city}
          onChange={(e) =>
            setInput({ ...input, city: e.target.value, district: "" })
          }
        >
          <option value="">City</option>
          {Object.keys(LOCATION_MAP).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <select
          style={inputStyle}
          value={input.district}
          onChange={(e) =>
            setInput({ ...input, district: e.target.value })
          }
        >
          <option value="">District</option>
          {districts.map((d: string) => (
            <option key={d}>{d}</option>
          ))}
        </select>

        {/* SIZE */}
        <input
          placeholder="Land Size (m²)"
          style={inputStyle}
          onChange={(e) =>
            setInput({ ...input, land_size: e.target.value })
          }
        />

        <input
          placeholder="Building Size (m²)"
          style={inputStyle}
          onChange={(e) =>
            setInput({ ...input, building_size: e.target.value })
          }
        />

        {/* ROOMS */}
        <input
          placeholder="Bedrooms"
          style={inputStyle}
          onChange={(e) =>
            setInput({ ...input, bedrooms: e.target.value })
          }
        />

        <input
          placeholder="Bathrooms"
          style={inputStyle}
          onChange={(e) =>
            setInput({ ...input, bathrooms: e.target.value })
          }
        />

        {/* ELECTRICITY */}
        <input
          placeholder="Electricity (Watt)"
          style={inputStyle}
          onChange={(e) =>
            setInput({ ...input, electricity: e.target.value })
          }
        />

        {/* SERTIFIKAT */}
        <select
          style={inputStyle}
          value={input.sertifikat}
          onChange={(e) =>
            setInput({ ...input, sertifikat: e.target.value })
          }
        >
          <option value="">Sertifikat</option>
          <option value="shm">SHM</option>
          <option value="hgb">HGB</option>
        </select>

        {/* INTERIOR */}
        <select
          style={inputStyle}
          value={input.interior}
          onChange={(e) =>
            setInput({ ...input, interior: e.target.value })
          }
        >
          <option value="">Interior</option>
          <option value="full furnished">Full Furnished</option>
          <option value="semi furnished">Semi Furnished</option>
          <option value="unfurnished">Unfurnished</option>
        </select>

        {/* ORIENTATION */}
        <select
          style={inputStyle}
          value={input.orientation}
          onChange={(e) =>
            setInput({ ...input, orientation: e.target.value })
          }
        >
          <option value="">Orientation</option>
          <option value="hook">Hook</option>
          <option value="normal">Normal</option>
        </select>

        {/* SUBMIT */}
        <button style={buttonStyle} onClick={handleSubmit}>
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {result && (
        <div style={resultCard}>
          {result.error ? (
            <p>{result.error}</p>
          ) : (
            <>
              <ResultSummary result={result} input={input} />
              <CompsList comps={result.comps} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------
// STYLES
// -----------------------------
const container: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "100px auto",
  padding: "0 24px",
  color: "white",
  display: "flex",
  flexDirection: "column",
  gap: 24, // 👈 consistent spacing
};

const title: React.CSSProperties = {
  fontSize: 38,
  marginBottom: 20,
};

const card: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  background: "#111",
  padding: 20,
  borderRadius: 12,
};

const inputStyle: React.CSSProperties = {
  padding: 12,
  background: "#000",
  color: "white",
  borderRadius: 8,
};

const buttonStyle: React.CSSProperties = {
  padding: 14,
  background: "white",
  color: "black",
  borderRadius: 10,
  fontWeight: 600,
};

const resultCard: React.CSSProperties = {
  marginTop: 30,
  padding: 20,
  background: "#111",
  borderRadius: 12,
};

const compCard: React.CSSProperties = {
  padding: 12,
  border: "1px solid #333",
  marginTop: 10,
  borderRadius: 10,
};

const dealBox: React.CSSProperties = {
  background: "#222",
  padding: 10,
  marginTop: 10,
  marginBottom: 10,
  borderRadius: 8,
};

const barContainer: React.CSSProperties = {
  position: "relative",
  height: 10,
  background: "#222",
  borderRadius: 6,
  marginTop: 12,
};

const barFill: React.CSSProperties = {
  position: "absolute",
  width: "100%",
  height: "100%",
  background: "linear-gradient(90deg, #2e7d32, #fbc02d, #e53935)",
};

const barIndicator: React.CSSProperties = {
  position: "absolute",
  top: -6,
  width: 4,
  height: 20,
  background: "#fff",
};

const barText: React.CSSProperties = {
  position: "absolute",
  top: 16,
  fontSize: 15,
  color: "#aaa",
};

const chartContainer: React.CSSProperties = {
  display: "flex",
  height: 80,
  gap: 2,
  marginTop: 10,
};

const bar: React.CSSProperties = {
  width: 4,
};