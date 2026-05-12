from supabase import create_client
import statistics

# -----------------------------
# CONFIG (PUT YOUR KEYS HERE)
# -----------------------------
SUPABASE_URL = "https://cvxrcxjdirmajmkbiulc.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2eHJjeGpkaXJtYWpta2JpdWxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzYxMTE5OSwiZXhwIjoyMDUzMTg3MTk5fQ.qsFvUsbrBx3Fupd_tG0KqjNXVuUeMFnMGLXruj-muQU"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# -----------------------------
# FIND COMPARABLES
# -----------------------------
def find_comparables(listing):
    land = listing["land_size"]
    bed = listing["bedrooms"]

    min_land = land * 0.7
    max_land = land * 1.3

    min_bed = bed - 1
    max_bed = bed + 1

    res = supabase.table("housing_listings") \
        .select("*") \
        .eq("city", listing["city"]) \
        .gte("land_size", min_land) \
        .lte("land_size", max_land) \
        .gte("bedrooms", min_bed) \
        .lte("bedrooms", max_bed) \
        .limit(50) \
        .execute()

    return res.data


# -----------------------------
# FAIR PRICE (MEDIAN)
# -----------------------------
def compute_fair_price(comps):
    prices = [c["price"] for c in comps if c["price"]]

    if len(prices) < 3:
        return None

    return int(statistics.median(prices))


# -----------------------------
# PRICE EVALUATION
# -----------------------------
def evaluate_price(listing_price, fair_price):
    delta_pct = (listing_price - fair_price) / fair_price * 100

    if delta_pct > 15:
        label = "overpriced"
    elif delta_pct < -15:
        label = "underpriced"
    else:
        label = "fair"

    return {
        "fair_price": fair_price,
        "delta_pct": round(delta_pct, 1),
        "label": label
    }


# -----------------------------
# MAIN ANALYSIS FUNCTION
# -----------------------------
def analyze_listing(listing):
    comps = find_comparables(listing)

    print(f"Found {len(comps)} comparables")

    if len(comps) < 3:
        return {"error": "Not enough comparables"}

    fair_price = compute_fair_price(comps)

    result = evaluate_price(listing["price"], fair_price)

    return {
        "input_price": listing["price"],
        "fair_price": fair_price,
        "delta_pct": result["delta_pct"],
        "label": result["label"],
        "comps_count": len(comps)
    }


# -----------------------------
# OPTIONAL: SHOW COMPARABLES
# -----------------------------
def print_comps(comps):
    for c in comps[:5]:
        print({
            "price": c["price"],
            "land_size": c["land_size"],
            "bedrooms": c["bedrooms"],
            "location": c["location"]
        })


# -----------------------------
# TEST RUN
# -----------------------------
if __name__ == "__main__":
    # Example listing (replace with real data later)
    test_listing = {
        "price": 1800000000,
        "city": "Tangerang Selatan",
        "land_size": 120,
        "bedrooms": 3
    }

    comps = find_comparables(test_listing)

    print("\n--- SAMPLE COMPS ---")
    print_comps(comps)

    result = analyze_listing(test_listing)

    print("\n--- RESULT ---")
    print(result)