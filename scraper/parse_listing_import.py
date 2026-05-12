"""
Parse a 99.co property detail HTML page into fields aligned with the Next.js importer.
Shares table-row logic with scrape_details.parse_detail and adds LT/LB/beds/baths/price heuristics.
"""
from __future__ import annotations

import json
import re
from typing import Any

from bs4 import BeautifulSoup


def clean_price(text: str) -> int | None:
    text = text.lower().replace("rp", "").strip()
    if "miliar" in text:
        n = float(text.replace("miliar", "").replace(",", ".").strip())
        return int(n * 1_000_000_000)
    if "juta" in text:
        n = float(text.replace("juta", "").replace(",", ".").strip())
        return int(n * 1_000_000)
    digits = re.sub(r"\D", "", text)
    return int(digits) if digits else None


def clean_area(text: str) -> int | None:
    text = re.sub(r"lt|lb|m²|m2", "", text.lower(), flags=re.I).strip()
    m = re.search(r"\d+", text)
    return int(m.group(0)) if m else None


def parse_location(loc: str) -> dict[str, str | None]:
    parts = [p.strip() for p in loc.split(",") if p.strip()]
    if len(parts) >= 2:
        return {"district": parts[-2], "city": parts[-1]}
    if len(parts) == 1:
        return {"district": None, "city": parts[0]}
    return {"district": None, "city": None}


def parse_listing_html(html: str, url: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    data: dict[str, Any] = {"url": url}

    section = soup.select_one("#detailRef")
    if section:
        for row in section.select("tr"):
            headers = row.select(".attribute-table-header p")
            values = row.select(".attribute-table-description p")
            for h, v in zip(headers, values):
                key = h.get_text(strip=True).lower()
                val = v.get_text(strip=True)

                if "sertifikat" in key:
                    data["sertifikat"] = val
                elif "carport" in key:
                    m = re.search(r"\d+", val)
                    if m:
                        data["carpots"] = int(m.group(0))
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
                elif "luas tanah" in key or key.startswith("lt"):
                    n = clean_area(val)
                    if n is not None:
                        data["land_size"] = n
                elif "luas bangunan" in key or key.startswith("lb"):
                    n = clean_area(val)
                    if n is not None:
                        data["building_size"] = n
                elif "kamar tidur" in key:
                    m = re.search(r"(\d+)", val)
                    if m:
                        data["bedrooms"] = int(m.group(1))
                elif "kamar mandi" in key:
                    m = re.search(r"(\d+)", val)
                    if m:
                        data["bathrooms"] = int(m.group(1))

    # Price (hero / meta)
    meta = soup.select_one('meta[property="product:price:amount"]')
    if meta and meta.get("content"):
        try:
            data["price"] = int(meta["content"].replace(".", ""))
        except (ValueError, TypeError):
            pass

    if "price" not in data:
        tag = soup.select_one(".price__tag strong")
        if tag:
            p = clean_price(tag.get_text(strip=True))
            if p:
                data["price"] = p

    title = None
    og = soup.select_one('meta[property="og:title"]')
    if og and og.get("content"):
        title = og["content"].strip()
    if not title:
        h1 = soup.select_one("h1")
        if h1:
            title = h1.get_text(strip=True)
    if title:
        data["title"] = title

    location = None
    addr = soup.select_one("address")
    if addr:
        location = addr.get_text(" ", strip=True)
    if location:
        data["location"] = location
        loc = parse_location(location)
        data["scraped_city"] = loc.get("city")
        data["scraped_district"] = loc.get("district")

    return data
