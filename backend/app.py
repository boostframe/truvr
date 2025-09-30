import os
import re
import time
import uuid
import threading
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from bs4 import BeautifulSoup

app = FastAPI(title="Truvr Backend", version="0.1.0")

# CORS for extension pages and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UploadPayload(BaseModel):
    html: str
    link: Optional[str] = None


class StartTaskPayload(BaseModel):
    data: Optional[str] = None


# Very small in-memory task store
tasks: Dict[str, Dict[str, Any]] = {}


@app.get("/")
def root():
    return {"message": "Truvr backend OK"}


def _extract_text(el) -> str:
    return re.sub(r"\s+", " ", el.get_text(strip=True)) if el else ""


def parse_product(html: str, link: Optional[str]) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")

    # Product name
    title = soup.select_one("#productTitle")
    product_name = _extract_text(title) if title else _extract_text(soup.select_one("title"))

    # Price: try common spans else any currency-like string
    price_el = soup.select_one("span.aok-offscreen, span.a-offscreen")
    price_text = _extract_text(price_el)
    if not price_text:
        # Fallback: currency regex
        m = re.search(r"\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?", soup.get_text(" "))
        price_text = m.group(0) if m else ""

    # ASIN/SKU from link
    sku = None
    if link:
        m = re.search(r"/dp/([A-Z0-9]{5,})", link)
        if m:
            sku = m.group(1)

    # Bullet points (Pros candidates)
    bullets = [
        _extract_text(li)
        for li in soup.select("#feature-bullets li, #featurebullets_feature_div li")
        if _extract_text(li)
    ]

    # Image URLs
    seen = set()
    photos: List[str] = []
    for img in soup.find_all("img"):
        src = img.get("src") or ""
        if src and src.startswith("http") and src not in seen:
            seen.add(src)
            photos.append(src)
        if len(photos) >= 8:
            break

    # Very lightweight spec extraction from tables
    specs: Dict[str, str] = {}
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            th = row.find("th")
            td = row.find("td")
            if th and td:
                key = _extract_text(th)
                val = _extract_text(td)
                if key and val and key not in specs:
                    specs[key] = val
        if len(specs) >= 20:
            break

    if not specs and bullets:
        # Use bullets as a fallback specs-ish structure
        for i, b in enumerate(bullets[:10], start=1):
            specs[f"Feature {i}"] = b

    # LLM-like data; optionally call OpenAI if configured
    excerpt1 = f"Product summary for: {product_name}" if product_name else "Product summary unavailable."
    pros = bullets[:5]
    cons: List[str] = []

    # Optional: OpenAI to suggest pros/cons/specs summary
    use_openai = os.environ.get("OPENAI_API_KEY") and os.environ.get("USE_OPENAI", "0") in ("1", "true", "True")
    if use_openai:
        try:
            from openai import OpenAI
            client = OpenAI()
            prompt = (
                "Given this product title and bullet points from an Amazon-like page, "
                "produce up to 5 Pros and 5 Cons as JSON with keys Pros and Cons.\n\n"
                f"Title: {product_name}\nBullets: {bullets}"
            )
            resp = client.chat.completions.create(
                model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
            )
            content = resp.choices[0].message.content or ""
            # naive extraction of lists from content if it looks like JSON-ish
            import json
            content_json = None
            try:
                content_json = json.loads(content)
            except Exception:
                pass
            if isinstance(content_json, dict):
                pros = content_json.get("Pros") or pros
                cons = content_json.get("Cons") or cons
        except Exception:
            # Fall back silently
            pass

    result = {
        "processed_data": {
            "product_name": product_name or "Unknown Product",
            "price": price_text or "",
            "other_info": "",
            "photo": photos,
            "SKU": sku or "",
            "rating": "",
        },
        "llm_data": {
            "specs": {
                "Excerpt1": excerpt1,
                "Excerpt2": {
                    "Pros": pros or ["Good value", "Decent quality"],
                    "Cons": cons or ["Limited info"]
                },
                "Specifications": specs or {"Info": "No structured specs found"},
            }
        },
        "tag_data": {
            "Tags": [tag for tag in ["amazon", "product", product_name] if tag]
        },
    }
    return result


def worker(task_id: str, html: str, link: Optional[str]):
    try:
        # Simulate processing time
        time.sleep(2)
        result = parse_product(html, link)
        tasks[task_id] = {"status": "completed", "result": result}
    except Exception as e:
        tasks[task_id] = {"status": "failed", "error": str(e)}


@app.post("/upload-html")
def upload_html(payload: UploadPayload):
    tid = uuid.uuid4().hex
    tasks[tid] = {"status": "processing"}
    thread = threading.Thread(target=worker, args=(tid, payload.html, payload.link), daemon=True)
    thread.start()
    return {"task_id": tid}


@app.get("/task-status/{task_id}")
def task_status(task_id: str):
    data = tasks.get(task_id)
    if not data:
        return {"status": "not_found"}
    return data


@app.post("/start-task/")
def start_task(_: StartTaskPayload):
    tid = uuid.uuid4().hex
    tasks[tid] = {"status": "processing"}

    def dummy():
        time.sleep(1.5)
        tasks[tid] = {"status": "completed", "result": "OK"}

    threading.Thread(target=dummy, daemon=True).start()
    return {"task_id": tid}

