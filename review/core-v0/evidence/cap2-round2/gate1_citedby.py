import re, sys
sys.path.insert(0, __file__.rsplit("\\", 1)[0])
import importlib.util
spec = importlib.util.spec_from_file_location("d", __file__.replace("gate1_citedby.py", "derive.py"))
d = importlib.util.module_from_spec(spec); spec.loader.exec_module(d)

# ---- Gate 1
rows = {"SDD": {}, "OP": {}}
for b in d.allblocks:
    if b.get("excl") == "S-O row":
        so = d.SO.search(b["cells"][0]).group(0)
        rows[b["doc"]][so] = b
print("\nGATE 1")
for i in range(1, 7):
    k = f"S-O{i}"
    a, o = rows["SDD"].get(k), rows["OP"].get(k)
    if not a or not o:
        print(k, "MISSING", bool(a), bool(o)); continue
    same = a["cells"][1:] == o["cells"][1:]
    print(k, "identical-after-first-cell:", same, "| status:", a["cells"][-1], o["cells"][-1], "| ncells", len(a["cells"]), len(o["cells"]), "| first cells:", a["cells"][0], "//", o["cells"][0])
    if not same:
        for x, y in zip(a["cells"], o["cells"]):
            if x != y: print("   DIFF", repr(x), repr(y))

# ---- Cited-by (rule 7)
txt = open(d.DOCS["SDD"], encoding="utf-8").read()
reg = []
for b in d.allblocks:
    if b.get("excl") == "registry" and b["cells"][0].startswith("`") and len(b["cells"]) == 4:
        path = b["cells"][0].strip("`")
        cited = set(x.strip() for x in b["cells"][3].split(",")) if b["cells"][3] else set()
        reg.append((path, cited, b["line"]))
print("\nCITED-BY: registry rows", len(reg))
PATHCH = r"A-Za-z0-9_.\-/~"
def names(text, path):
    cands = [path]
    for pre in ("fixtures/witnesses/", "fixtures/jira-assets/"):
        if path.startswith(pre): cands.append(path[len(pre):])
    for c in cands:
        for m in re.finditer(re.escape(c), text):
            before = text[:m.start()]
            after = text[m.end():m.end() + 1]
            if after and re.match(r"[A-Za-z0-9_\-]", after): continue
            if after == "." and re.match(r"\.[A-Za-z0-9]", text[m.end():m.end() + 2]): continue
            if before and re.match(r"[" + PATHCH + r"]", before[-1]):
                # allow only if it is the full repo path preceded by a non-path char
                continue
            return True
    return False
bad = 0
for path, cited, ln in reg:
    if path == "ontology/term-list.json":
        print("  skip term-list row (indexed by terms_sha256)"); continue
    derived = set()
    for b in d.allblocks:
        if b.get("excl") == "registry": continue
        if names(b["text"], path):
            a = b["attr"]
            if b.get("excl") == "S-O row":
                a = d.SO.search(b["cells"][0]).group(0)
            derived.add(a)
    if derived != cited:
        bad += 1
        print("  MISMATCH", ln, path, "missing:", sorted(derived - cited), "extra:", sorted(cited - derived))
print("mismatched rows:", bad)
