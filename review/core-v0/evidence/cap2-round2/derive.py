import re, sys, json
from collections import defaultdict

BASE = r"C:\Users\aaron\OneDrive\Documents\SemanticDataDictionary\spec"
DOCS = {"SDD": BASE + r"\sdd-service.md", "OP": BASE + r"\sdd-operator.md"}
SECNAME = {"SDD": "SDD", "OP": "SDD-operator"}

B = r"(?<![A-Za-z0-9\-])"
E = r"(?![A-Za-z0-9])"
ID = {
 "SDD": re.compile(B + r"(W-CS\d+-(?:N|Δ\d+)|W-JS\d+|(?:J-S|C-S|R-S|S-S|V-S|E-S|H-S|NG-S)\d+|OS-\d+|G1|K1)" + E),
 "OP": re.compile(B + r"(W-PRO\d+-(?:N|Δ\d+)|W-JO\d+|(?:PR-O|J-O|CV-O|RV-O|V-O|E-O|NP-O|H-O)\d+|OO-\d+|G2|K2|WV-1)" + E),
}
SO = re.compile(B + r"S-O\d+" + E)

def split_id(i):
    m = re.match(r"^(.*?)(\d+)$", i)
    return m.group(1), int(m.group(2))

def find_ids(doc, text, log=None):
    """Return list of ids (with range expansion) named in text."""
    out = []
    rx = ID[doc]
    for m in rx.finditer(text):
        i = m.group(1)
        out.append(i)
        rest = text[m.end():]
        # range forms
        r = re.match(r"–(" + rx.pattern[len(B):] + r")", rest) if False else None
        m2 = re.match(r"–", rest)
        if m2:
            tail = rest[1:]
            m3 = rx.match(tail)
            if m3 and m3.start() == 0:
                j = m3.group(1)
                pa, na = split_id(i); pb, nb = split_id(j)
                if pa == pb:
                    for k in range(na + 1, nb):
                        out.append(f"{pa}{k}")
                    if log is not None: log.append(("range", i, j))
                else:
                    if log is not None: log.append(("RANGE-MISMATCH", i, j))
                continue
            m4 = re.match(r"Δ(\d+)", tail)
            if m4 and "-Δ" in i:
                pa, na = split_id(i)
                nb = int(m4.group(1))
                for k in range(na + 1, nb + 1):
                    out.append(f"{pa}{k}")
                if log is not None: log.append(("drange", i, "Δ" + m4.group(1)))
                continue
            m5 = re.match(r"(\d+)", tail)
            if m5:
                if log is not None: log.append(("BARE-DIGIT-RANGE?", i, tail[:10]))
    return out

def blocks(doc):
    lines = open(DOCS[doc], encoding="utf-8").read().split("\n")
    sec = f"{SECNAME[doc]} header"
    res = []
    cur = None
    region = None  # 'recip'
    table_kind = None
    def flush():
        nonlocal cur
        if cur: res.append(cur)
        cur = None
    for ln, line in enumerate(lines, 1):
        s = line.strip()
        if s.startswith("<!-- reciprocity:begin"):
            flush(); region = "recip"; continue
        if s.startswith("<!-- reciprocity:end"):
            flush(); region = None; continue
        if s.startswith("#"):
            flush()
            m = re.match(r"^##\s+(SDD(?:-operator)?) (§\d+)", s)
            if m: sec = f"{m.group(1)} {m.group(2)}"
            table_kind = None
            continue
        if s == "":
            flush(); table_kind = None; continue
        if s.startswith("|"):
            flush()
            if re.match(r"^\|[\s\-|:]+\|$", s):
                continue
            cells = [c.strip() for c in s.strip("|").split("|")]
            if table_kind is None:
                table_kind = "registry" if (cells[0] == "File") else "table"
            excl = None
            if region == "recip": excl = "reciprocal table"
            elif table_kind == "registry" and doc == "SDD" and sec == "SDD §11": excl = "registry"
            elif SO.search(cells[0]) and ((doc == "SDD" and sec == "SDD §6") or (doc == "OP" and sec == "SDD-operator §8")):
                excl = "S-O row"
            res.append(dict(doc=doc, line=ln, sec=sec, kind="row", text=s, cells=cells, excl=excl))
            continue
        if re.match(r"^(- |\d+\. )", line):
            flush()
            cur = dict(doc=doc, line=ln, sec=sec, kind="item", text=s, excl=None)
            continue
        if cur is None:
            cur = dict(doc=doc, line=ln, sec=sec, kind="para", text=s, excl=None)
        else:
            cur["text"] += " " + s
    flush()
    return res

def attribute(b):
    doc, t = b["doc"], b["text"]
    m = re.search(r"Chain (?:example|scene) \*\*([^*]+)\*\*", t)
    if m and ID[doc].fullmatch(m.group(1)):
        return m.group(1), "chain"
    if b["kind"] == "row":
        c0 = b["cells"][0]
        if ID["SDD"].fullmatch(c0) or ID["OP"].fullmatch(c0):
            return c0, "firstcell"
        c0s = c0.replace("**", "").replace("`", "").strip()
        if c0s != c0 and (ID["SDD"].fullmatch(c0s) or ID["OP"].fullmatch(c0s)):
            b.setdefault("notes", []).append("firstcell-after-stripping-markup: " + c0)
    for bm in re.finditer(r"\*\*(.+?)\*\*", t):
        span = bm.group(1)
        mm = ID[doc].match(span)
        if mm and mm.start() == 0:
            return mm.group(1), "bold"
    return b["sec"], "section"

other = {"SDD": "OP", "OP": "SDD"}
pairs = defaultdict(set)
evidence = defaultdict(list)
allblocks = []
for doc in DOCS:
    for b in blocks(doc):
        allblocks.append(b)
        a, how = attribute(b)
        b["attr"], b["how"] = a, how
        log = []
        cited = find_ids(other[doc], b["text"], log)
        b["cited"] = sorted(set(cited)); b["rlog"] = log
        b["so"] = sorted(set(SO.findall(b["text"])))
        if b["excl"]: continue
        for c in set(cited):
            key = (a, c) if doc == "SDD" else (c, a)
            pairs[key[0]].add(key[1])
            evidence[key].append(f"{doc}:{b['line']}[{how}]")

def parse_table(doc):
    txt = open(DOCS[doc], encoding="utf-8").read()
    seg = txt.split("<!-- reciprocity:begin -->")[1].split("<!-- reciprocity:end -->")[0]
    t = {}
    for line in seg.strip().split("\n")[2:]:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        t[cells[0]] = set(x.strip() for x in cells[1].split(","))
    return t

def flat(d): return {(k, v) for k, vs in d.items() for v in vs}
tS, tO = parse_table("SDD"), parse_table("OP")
D = flat(pairs); TS = flat(tS); TO = flat(tO)
print("derived", len(D), "SDD table", len(TS), "OP table", len(TO))
print("tables identical:", TS == TO, "row order/rows identical:", list(tS) == list(tO))
print("missing from SDD table:", sorted(D - TS))
print("extra in SDD table:", sorted(TS - D))
print("missing from OP table:", sorted(D - TO))
print("extra in OP table:", sorted(TO - D))
if "-v" in sys.argv:
    for k in sorted(evidence): print(k, evidence[k])
if "-b" in sys.argv:
    for b in allblocks:
        if b["cited"] or b["so"] or b.get("notes") or any(x[0] != "range" for x in b["rlog"]):
            print(b["doc"], b["line"], b["kind"], b["excl"], b["attr"], b["how"], b["cited"], b["so"], b.get("notes"), [x for x in b["rlog"]])
json.dump({"derived": sorted(map(list, D))}, open(__file__.replace("derive.py", "derived.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
