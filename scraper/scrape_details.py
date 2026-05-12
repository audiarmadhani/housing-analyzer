from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
from supabase import create_client
import time
import random
import re

from dotenv import load_dotenv
import os

load_dotenv()

# -----------------------------
# CONFIG
# -----------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

BATCH_SIZE = 3000          # keep small to avoid blocks
HEADLESS = False        # use False while debugging
MIN_DELAY = 0
MAX_DELAY = 1


# -----------------------------
# DB: FETCH PENDING
# -----------------------------
def get_pending_listings(limit=BATCH_SIZE):
    res = (
        supabase.table("housing_listings")
        .select("id, url")
        .eq("scraped_detail", False)
        .limit(limit)
        .execute()
    )
    return res.data or []


# -----------------------------
# PARSER: DETAIL TABLE
# -----------------------------
def parse_detail(html: str):
    soup = BeautifulSoup(html, "html.parser")

    data = {
        "description": None,
        "sertifikat": None,
        "electricity": None,
        "carpots": None,
        "interior": None,
        "type": None,
        "orientation": None,
    }

    # --- description (best-effort) ---
    # pick the longest paragraph in the page body (often the description)
    paragraphs = [p.get_text(" ", strip=True) for p in soup.select("p")]
    if paragraphs:
        data["description"] = max(paragraphs, key=len)

    # --- detail table ---
    section = soup.select_one("#detailRef")
    if not section:
        return data

    rows = section.select("tr")

    for row in rows:
        headers = row.select(".attribute-table-header p")
        values = row.select(".attribute-table-description p")

        for h, v in zip(headers, values):
            key = h.get_text(strip=True).lower()
            val = v.get_text(strip=True)

            # mapping
            if "sertifikat" in key:
                data["sertifikat"] = val

            elif "carport" in key:
                try:
                    data["carpots"] = int(re.search(r"\d+", val).group())
                except:
                    pass

            elif "daya listrik" in key:
                m = re.search(r"(\d+)", val)
                if m:
                    data["electricity"] = int(m.group(1))

            elif "interior" in key:
                data["interior"] = val.lower().strip()

            elif "tipe properti" in key:
                data["type"] = val.lower().strip()

            elif "orientasi" in key:
                data["orientation"] = val.lower().strip()

    return data


# -----------------------------
# DB: UPDATE ROW
# -----------------------------
def update_listing(row_id: str, data: dict):
    payload = {**data, "scraped_detail": True}

    try:
        supabase.table("housing_listings") \
            .update(payload) \
            .eq("id", row_id) \
            .execute()

        print("Updated:", row_id)

    except Exception as e:
        print("DB error:", e)


# -----------------------------
# SAFE NAVIGATION + SCRAPE
# -----------------------------
def visit_and_parse(page, url: str):
    print("Visiting:", url)

    page.goto(url, timeout=60000)
    page.wait_for_load_state("domcontentloaded")

    # small human-like pause
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    html = page.content()

    # basic block detection
    if "Just a moment" in html or "cf-challenge" in html:
        print("⚠️ Blocked by Cloudflare")
        return None

    return parse_detail(html)


# -----------------------------
# MAIN WORKER
# -----------------------------
def scrape_details():
    listings = get_pending_listings()

    if not listings:
        print("No pending listings.")
        return

    print(f"Processing {len(listings)} listings...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)

        for item in listings:
            page = browser.new_page()

            try:
                data = visit_and_parse(page, item["url"])

                if data is None:
                    print("Stopping early due to block.")
                    page.close()
                    break

                update_listing(item["id"], data)

                page.close()

                # cooldown between listings
                time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

            except Exception as e:
                print("Error:", e)
                page.close()

        browser.close()


# -----------------------------
# RUN
# -----------------------------
if __name__ == "__main__":
    scrape_details()