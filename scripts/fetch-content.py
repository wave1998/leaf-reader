"""Download original English public-domain editions and the ECDICT mini word list.

Only needed to refresh the bundled assets. Runtime works without these services.
"""
import csv
import hashlib
import io
import json
import re
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
BOOKS = [
    (11, "Alice’s Adventures in Wonderland", "爱丽丝梦游仙境", "Lewis Carroll", "#244b43", "#d9c69b", "alice"),
    (1342, "Pride and Prejudice", "傲慢与偏见", "Jane Austen", "#a66b60", "#f5dfbd", "flower"),
    (1661, "The Adventures of Sherlock Holmes", "福尔摩斯探案集", "Arthur Conan Doyle", "#37485a", "#c9b889", "sherlock"),
    (84, "Frankenstein", "弗兰肯斯坦", "Mary Shelley", "#555944", "#d9d4b1", "moon"),
    (35, "The Time Machine", "时间机器", "H. G. Wells", "#856c46", "#f5e8c8", "clock"),
    (113, "The Secret Garden", "秘密花园", "Frances Hodgson Burnett", "#61745a", "#e5dbb9", "flower"),
    (120, "Treasure Island", "金银岛", "Robert Louis Stevenson", "#946044", "#e8cf9f", "compass"),
    (1900, "The Wonderful Wizard of Oz", "绿野仙踪", "L. Frank Baum", "#557e79", "#e3d9a5", "star"),
    (74, "The Adventures of Tom Sawyer", "汤姆·索亚历险记", "Mark Twain", "#68778d", "#f1dcba", "boat"),
    (2701, "Moby Dick; or, The Whale", "白鲸", "Herman Melville", "#395968", "#d8e3db", "wave"),
]

def download(url):
    request = urllib.request.Request(url, headers={"User-Agent": "LeafReader-asset-builder/0.1"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()

def main():
    (PUBLIC / "books").mkdir(parents=True, exist_ok=True)
    (PUBLIC / "data").mkdir(parents=True, exist_ok=True)
    (PUBLIC / "licenses").mkdir(parents=True, exist_ok=True)
    catalog, provenance = [], []
    for gid, title, subtitle, author, color, accent, motif in BOOKS:
        path = PUBLIC / "books" / f"{gid}.txt"
        url = f"https://www.gutenberg.org/ebooks/{gid}.txt.utf-8"
        raw = path.read_bytes() if path.exists() else download(url)
        if b"START OF" not in raw or len(raw) < 40000:
            raise ValueError(f"Unexpected Gutenberg response for {gid}")
        path.write_bytes(raw)
        catalog.append(dict(id=f"pg-{gid}", gutenbergId=gid, title=title, subtitle=subtitle,
                            author=author, color=color, accent=accent, motif=motif, source="builtin"))
        provenance.append(dict(id=gid, landingPage=f"https://www.gutenberg.org/ebooks/{gid}",
                               download=url, sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw)))
        print(f"Book {gid}: {len(raw):,} bytes", flush=True)
    (PUBLIC / "books" / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2))
    (PUBLIC / "books" / "sources.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2))
    dict_url = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
    cache = ROOT / ".cache" / "ecdict.csv"
    cache.parent.mkdir(exist_ok=True)
    raw = cache.read_bytes() if cache.exists() else download(dict_url)
    cache.write_bytes(raw)
    dictionary = {}
    corpus = set(re.findall(r"[a-z]+", ' '.join(path.read_text() for path in (PUBLIC / 'books').glob('*.txt')).lower()))
    for row in csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))):
        word = row["word"].lower().strip()
        rank = int(row.get('bnc') or 0)
        selected = word in corpus or bool(row.get('tag')) or (0 < rank <= 30000)
        if word and row.get("translation") and selected and len(word) <= 50:
            dictionary[word] = dict(translation=row["translation"].replace("\\n", "\n"),
                                    phonetic=row.get("phonetic", ""))
    if len(dictionary) < 1000:
        raise ValueError("Dictionary download incomplete")
    (PUBLIC / "data" / "dictionary.json").write_text(json.dumps(dictionary, ensure_ascii=False, separators=(",", ":")))
    license_text = download("https://raw.githubusercontent.com/skywind3000/ECDICT/master/LICENSE")
    (PUBLIC / "licenses" / "ECDICT-MIT.txt").write_bytes(license_text)
    (PUBLIC / "data" / "dictionary-source.json").write_text(json.dumps({"project": "https://github.com/skywind3000/ECDICT", "download": dict_url, "sha256": hashlib.sha256(raw).hexdigest(), "entries": len(dictionary), "license": "MIT"}, indent=2))
    print(f"Dictionary: {len(dictionary):,} entries", flush=True)

if __name__ == "__main__":
    main()
