#!/usr/bin/env python3
"""
Fetch a single 99.co listing and print JSON (for CLI / subprocess).

  python scrape_listing_url.py "https://www.99.co/id/properti/..."

Requires: pip install playwright beautifulsoup4 && playwright install chromium
"""
from __future__ import annotations

import json
import sys
import time
import random

from playwright.sync_api import sync_playwright

from parse_listing_import import parse_listing_html


def fetch_html(url: str) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, timeout=60000, wait_until="domcontentloaded")
        time.sleep(random.uniform(0.3, 0.8))
        html = page.content()
        browser.close()
        return html


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: scrape_listing_url.py <url>"}))
        sys.exit(1)

    url = sys.argv[1].strip()
    if "99.co" not in url:
        print(json.dumps({"error": "Only 99.co URLs are supported"}))
        sys.exit(1)

    html = fetch_html(url)

    if "Just a moment" in html or "cf-challenge" in html:
        print(json.dumps({"error": "Blocked or bot check (Cloudflare)"}))
        sys.exit(1)

    data = parse_listing_html(html, url)
    print(json.dumps(data, ensure_ascii=False))


if __name__ == "__main__":
    main()
