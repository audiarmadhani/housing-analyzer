import { NextResponse } from "next/server";
import { scrape99CoListing, scrapedToFormState } from "@/lib/scrape99co";
import { matchCityDistrict } from "@/lib/match-location";

export const runtime = "nodejs";

/** Allow long-running Playwright scrape on supported hosts (e.g. local, Node server). */
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url =
    typeof body === "object" &&
    body !== null &&
    "url" in body &&
    typeof (body as { url: unknown }).url === "string"
      ? (body as { url: string }).url.trim()
      : "";

  if (!url) {
    return NextResponse.json({ error: "Missing listing URL" }, { status: 400 });
  }

  try {
    const scraped = await scrape99CoListing(url);
    const { city, district } = matchCityDistrict(
      scraped.scraped_city,
      scraped.scraped_district
    );
    const form = scrapedToFormState(scraped, city, district);

    return NextResponse.json({
      scraped,
      form,
      matched_city: city,
      matched_district: district,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
