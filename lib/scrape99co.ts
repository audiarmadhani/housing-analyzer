import { chromium } from "playwright";
import { load } from "cheerio";
import type { ListingFormState } from "./listing-types";

export type ScrapedListingRaw = {
  url: string;
  title?: string;
  location?: string;
  /** Raw strings from address line before matching to form keys */
  scraped_city?: string;
  scraped_district?: string;
  price?: number;
  land_size?: number;
  building_size?: number;
  bedrooms?: number;
  bathrooms?: number;
  electricity?: number;
  sertifikat?: string;
  interior?: string;
  orientation?: string;
};

function cleanPrice(text: string): number | null {
  const t = text.toLowerCase().replace(/rp/gi, "").trim();
  if (t.includes("miliar")) {
    const n = parseFloat(t.replace(/miliar/g, "").replace(",", ".").trim());
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 1_000_000_000);
  }
  if (t.includes("juta")) {
    const n = parseFloat(t.replace(/juta/g, "").replace(",", ".").trim());
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 1_000_000);
  }
  const digits = t.replace(/\./g, "").replace(/\s/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function cleanArea(text: string): number | null {
  const t = text
    .toLowerCase()
    .replace(/lt|lb|m²|m2/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const m = t.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function parseLocation(loc: string): { district?: string; city?: string } {
  const parts = loc
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return {
      district: parts[parts.length - 2],
      city: parts[parts.length - 1],
    };
  }
  if (parts.length === 1) return { city: parts[0] };
  return {};
}

/** Normalize interior string to form option values. */
function normalizeInteriorForm(val?: string): string {
  if (!val) return "";
  const v = val.toLowerCase();
  if (v.includes("full")) return "full furnished";
  if (v.includes("semi")) return "semi furnished";
  if (v.includes("unfurnished") || v.includes("kosong")) return "unfurnished";
  return "";
}

function normalizeSertifikatForm(val?: string): string {
  if (!val) return "";
  const v = val.toLowerCase();
  if (v.includes("shm")) return "shm";
  if (v.includes("hgb")) return "hgb";
  return "";
}

function normalizeOrientationForm(val?: string): string {
  if (!val) return "";
  const v = val.toLowerCase();
  if (v.includes("hook")) return "hook";
  return "normal";
}

function extractPriceFromHtml(html: string): number | null {
  const $ = load(html);

  const metaPrice = $('meta[property="product:price:amount"]').attr("content");
  if (metaPrice) {
    const n = parseInt(metaPrice.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const candidates = [
    ".price__tag strong",
    "[class*='price'] strong",
    "h1[class*='price']",
    "[data-testid*='price']",
  ];
  for (const sel of candidates) {
    const el = $(sel).first();
    const text = el.text();
    if (text) {
      const p = cleanPrice(text);
      if (p && p > 0) return p;
    }
  }

  const jsonLd = $('script[type="application/ld+json"]');
  for (let i = 0; i < jsonLd.length; i++) {
    try {
      const raw = $(jsonLd[i]).html();
      if (!raw) continue;
      const j = JSON.parse(raw) as { offers?: { price?: number | string } };
      const price = j?.offers?.price;
      if (price != null) {
        const n = typeof price === "number" ? price : parseInt(String(price), 10);
        if (Number.isFinite(n) && n > 0) return n;
      }
    } catch {
      /* skip */
    }
  }

  const bodyText = $("body").text();
  const miliar = bodyText.match(/Rp\s*([\d.,]+)\s*[Mm]iliar/);
  if (miliar) {
    const n = parseFloat(miliar[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) return Math.round(n * 1_000_000_000);
  }

  return null;
}

function parseDetailRef(html: string): Partial<ScrapedListingRaw> {
  const $ = load(html);
  const data: Partial<ScrapedListingRaw> = {};
  const section = $("#detailRef");
  if (!section.length) return data;

  section.find("tr").each((_, row) => {
    const headers = $(row).find(".attribute-table-header p");
    const values = $(row).find(".attribute-table-description p");
    headers.each((i, h) => {
      const key = $(h).text().trim().toLowerCase();
      const val = $(values[i]).text().trim();
      if (!val) return;

      if (key.includes("sertifikat")) data.sertifikat = val;
      else if (key.includes("daya listrik")) {
        const m = val.match(/(\d+)/);
        if (m) data.electricity = parseInt(m[1], 10);
      } else if (key.includes("interior")) data.interior = val.toLowerCase().trim();
      else if (key.includes("orientasi")) data.orientation = val.toLowerCase().trim();
      else if (key.includes("luas tanah") || /^lt\b/.test(key)) {
        const n = cleanArea(val);
        if (n != null) data.land_size = n;
      } else if (key.includes("luas bangunan") || /^lb\b/.test(key)) {
        const n = cleanArea(val);
        if (n != null) data.building_size = n;
      } else if (key.includes("kamar tidur")) {
        const m = val.match(/(\d+)/);
        if (m) data.bedrooms = parseInt(m[1], 10);
      } else if (key.includes("kamar mandi")) {
        const m = val.match(/(\d+)/);
        if (m) data.bathrooms = parseInt(m[1], 10);
      }
    });
  });

  return data;
}

function extractTitleLocation(html: string): { title?: string; location?: string } {
  const $ = load(html);
  let title = $("h1").first().text().trim() || undefined;
  const ogTitle = $('meta[property="og:title"]').attr("content");
  if (ogTitle) title = ogTitle.trim();

  let location: string | undefined;
  const addr = $("address").first().text().trim();
  if (addr) location = addr;
  else {
    const locEl = $('[class*="location"], [class*="address"]').first().text().trim();
    if (locEl) location = locEl;
  }

  return { title, location };
}

export function scrapedToFormState(
  scraped: ScrapedListingRaw,
  matchedCity: string,
  matchedDistrict: string
): ListingFormState {
  return {
    price: scraped.price != null ? String(scraped.price) : "",
    city: matchedCity,
    district: matchedDistrict,
    land_size: scraped.land_size != null ? String(scraped.land_size) : "",
    building_size: scraped.building_size != null ? String(scraped.building_size) : "",
    bedrooms: scraped.bedrooms != null ? String(scraped.bedrooms) : "",
    bathrooms: scraped.bathrooms != null ? String(scraped.bathrooms) : "",
    electricity: scraped.electricity != null ? String(scraped.electricity) : "",
    sertifikat: normalizeSertifikatForm(scraped.sertifikat),
    interior: normalizeInteriorForm(scraped.interior),
    orientation: normalizeOrientationForm(scraped.orientation),
  };
}

export async function scrape99CoListing(url: string): Promise<ScrapedListingRaw> {
  const parsedUrl = new URL(url);
  if (!parsedUrl.hostname.replace(/^www\./, "").includes("99.co")) {
    throw new Error("Only 99.co listing URLs are supported");
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    const html = await page.content();

    if (
      html.includes("Just a moment") ||
      html.includes("cf-challenge") ||
      html.includes("Attention Required")
    ) {
      throw new Error(
        "Listing page could not be loaded (blocked or bot check). Try again later."
      );
    }

    const detail = parseDetailRef(html);
    const price = extractPriceFromHtml(html);
    const { title, location } = extractTitleLocation(html);

    const locParsed = location ? parseLocation(location) : {};

    return {
      url,
      title,
      location,
      scraped_city: locParsed.city,
      scraped_district: locParsed.district,
      price: price ?? undefined,
      ...detail,
    };
  } finally {
    await browser.close();
  }
}
