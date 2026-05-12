from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth
from bs4 import BeautifulSoup
import time
import random
import re
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

# -----------------------------
# CONFIG
# -----------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

HEADLESS = False
MIN_DELAY = 0
MAX_DELAY = 1
MAX_RETRIES = 3

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------
# AREAS
# -----------------------------
SEARCH_AREAS = [
    # -----------------------------
    # JAKARTA SELATAN
    # -----------------------------
    {"name": "Kebayoran Baru", "query": "kebayoran baru"},
    {"name": "Pondok Indah", "query": "pondok indah"},
    {"name": "Cipete", "query": "cipete"},
    {"name": "Fatmawati", "query": "fatmawati"},
    {"name": "Tebet", "query": "tebet"},
    {"name": "Kemang", "query": "kemang"},
    {"name": "Jagakarsa", "query": "jagakarsa"},

    # -----------------------------
    # JAKARTA BARAT
    # -----------------------------
    {"name": "Kebon Jeruk", "query": "kebon jeruk"},
    {"name": "Tanjung Duren", "query": "tanjung duren"},
    {"name": "Cengkareng", "query": "cengkareng"},
    {"name": "Kalideres", "query": "kalideres"},
    {"name": "Puri Indah", "query": "puri indah"},

    # -----------------------------
    # JAKARTA UTARA
    # -----------------------------
    {"name": "Kelapa Gading", "query": "kelapa gading"},
    {"name": "Pluit", "query": "pluit"},
    {"name": "PIK", "query": "pantai indah kapuk"},

    # -----------------------------
    # JAKARTA TIMUR
    # -----------------------------
    {"name": "Duren Sawit", "query": "duren sawit"},
    {"name": "Cakung", "query": "cakung"},
    {"name": "Cipinang", "query": "cipinang"},

    # -----------------------------
    # TANGERANG SELATAN
    # -----------------------------
    {"name": "Bintaro", "query": "bintaro"},
    {"name": "Graha Bintaro", "query": "graha bintaro"},
    {"name": "BSD", "query": "bsd"},
    {"name": "BSD City", "query": "bsd city"},
    {"name": "Gading Serpong", "query": "gading serpong"},
    {"name": "Alam Sutera", "query": "alam sutera"},
    {"name": "Serpong", "query": "serpong"},
    {"name": "Ciputat", "query": "ciputat"},
    {"name": "Pamulang", "query": "pamulang"},

    # -----------------------------
    # TANGERANG
    # -----------------------------
    {"name": "Karawaci", "query": "karawaci"},
    {"name": "Cikupa", "query": "cikupa"},
    {"name": "Tigaraksa", "query": "tigaraksa"},

    # -----------------------------
    # BEKASI
    # -----------------------------
    {"name": "Bekasi Barat", "query": "bekasi barat"},
    {"name": "Bekasi Timur", "query": "bekasi timur"},
    {"name": "Bekasi Utara", "query": "bekasi utara"},
    {"name": "Bekasi Selatan", "query": "bekasi selatan"},
    {"name": "Grand Galaxy", "query": "grand galaxy"},
    {"name": "Harapan Indah", "query": "harapan indah"},

    # -----------------------------
    # DEPOK
    # -----------------------------
    {"name": "Cinere", "query": "cinere"},
    {"name": "Beji", "query": "beji depok"},
    {"name": "Margonda", "query": "margonda"},
    {"name": "Sawangan", "query": "sawangan depok"},

    # -----------------------------
    # BOGOR
    # -----------------------------
    {"name": "Sentul", "query": "sentul"},
    {"name": "Sentul City", "query": "sentul city"},
    {"name": "Cibinong", "query": "cibinong"},
    {"name": "Bogor Selatan", "query": "bogor selatan"},
]

def normalize_query(query):
    return "+".join(query.lower().split())

def build_url(query, page):
    return f"https://www.99.co/id/jual/rumah?q={normalize_query(query)}&hlmn={page}"

# -----------------------------
# CLEANING
# -----------------------------
def clean_price(text):
    text = text.lower().replace("rp", "").strip()

    if "miliar" in text:
        return int(float(text.replace("miliar", "").replace(",", ".")) * 1_000_000_000)
    if "juta" in text:
        return int(float(text.replace("juta", "").replace(",", ".")) * 1_000_000)

    return int(text.replace(".", ""))


def clean_area(text):
    text = text.lower().replace("lt", "").replace("lb", "").replace("m²", "").strip()
    return int(text)


def extract_listing_id(url):
    match = re.search(r'(\d+)$', url.split("?")[0])
    return match.group(1) if match else None


def parse_location(loc):
    parts = [p.strip() for p in loc.split(",")]
    return {
        "district": parts[-2] if len(parts) >= 2 else None,
        "city": parts[-1] if len(parts) >= 1 else None
    }

# -----------------------------
# SAVE
# -----------------------------
def save_listing(listing):
    listing_id = extract_listing_id(listing["url"])
    if not listing_id:
        return

    loc = parse_location(listing["location"])

    row = {
        "listing_id": listing_id,
        "source": "99co",
        "url": listing["url"],
        "title": listing["title"],
        "location": listing["location"],
        "city": loc["city"],
        "district": loc["district"],
        "price": listing["price"],
        "bedrooms": listing["bedrooms"],
        "bathrooms": listing["bathrooms"],
        "land_size": listing["land_size"],
        "building_size": listing["building_size"],
        "search_area": listing.get("search_area")
    }

    try:
        supabase.table("housing_listings") \
            .upsert(row, on_conflict="listing_id") \
            .execute()

        print("Saved:", listing_id)

    except Exception as e:
        print("DB error:", e)

# -----------------------------
# PARSER
# -----------------------------
def parse_page(html):
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select(".cardSecondary__info")

    results = []

    for card in cards:
        try:
            price = clean_price(card.select_one(".price__tag strong").text.strip())
            title = card.select_one("h2").text.strip()
            location = card.select_one("address").text.strip()

            bedrooms = int(card.select_one('[title*="Kamar Tidur"]').text.strip())
            bathrooms = int(card.select_one('[title*="Kamar Mandi"]').text.strip())
            land = clean_area(card.select_one('[title*="Luas Tanah"]').text.strip())
            building = clean_area(card.select_one('[title*="Luas Bangunan"]').text.strip())

            url = card.select_one('a[href*="/properti/"]')["href"]

            results.append({
                "price": price,
                "title": title,
                "location": location,
                "bedrooms": bedrooms,
                "bathrooms": bathrooms,
                "land_size": land,
                "building_size": building,
                "url": url
            })

        except:
            continue

    return results

# -----------------------------
# SAFE NAVIGATION
# -----------------------------
def safe_goto(page, url):
    for _ in range(MAX_RETRIES):
        try:
            page.goto(url, timeout=60000)
            page.wait_for_load_state("domcontentloaded")
            return True
        except:
            time.sleep(random.uniform(2, 5))
    return False

# -----------------------------
# MAIN SCRAPER
# -----------------------------
def scrape(start_page=1, end_page=9):

    with sync_playwright() as p:

        for area in SEARCH_AREAS:
            print(f"\n========== {area['name']} ==========")

            # ✅ persistent session per area (IMPORTANT)
            context = p.chromium.launch_persistent_context(
                user_data_dir=f"./user_data_{area['name']}",
                headless=HEADLESS,
                viewport={
                    "width": random.randint(1200, 1600),
                    "height": random.randint(800, 1000)
                }
            )

            page = context.new_page()

            # stealth
            stealth = Stealth()
            stealth.apply_stealth_sync(page)

            for i in range(start_page, end_page + 1):

                print(f"Page {i}")

                url = build_url(area["query"], i)

                if not safe_goto(page, url):
                    print("Failed page")
                    continue

                # human delay
                time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

                # scroll behavior
                page.mouse.wheel(0, random.randint(1500, 4000))
                time.sleep(random.uniform(1, 2))

                html = page.content()

                # BLOCK DETECTION
                if "Just a moment" in html or "cf-challenge" in html:
                    print("⚠️ BLOCKED → stopping area")
                    break

                results = parse_page(html)
                print(f"Found {len(results)}")

                for d in results:
                    d["search_area"] = area["name"]
                    save_listing(d)

                # cooldown
                sleep_time = random.uniform(MIN_DELAY, MAX_DELAY)
                print(f"Sleeping {round(sleep_time,1)}s")
                time.sleep(sleep_time)

            context.close()

# -----------------------------
# RUN
# -----------------------------
if __name__ == "__main__":
    scrape(start_page=1, end_page=9)