"""Independent cross-document citation extractor for SDD / SDD-operator.

Units: a 'block' is a paragraph (blank-line separated), a list item, or a table row.
Citing artifact of a block: the identifier(s) it defines (bold-led definition), else the enclosing section.
Options toggle the readings.
"""
import re, sys, itertools, json
sys.stdout.reconfigure(encoding="utf-8")

D = sys.argv[1]
OPTS = set(sys.argv[2].split(',')) if len(sys.argv) > 2 and sys.argv[2] else set()

SRC = {'SDD': open(D + '/spec/sdd-service.md', encoding='utf-8').read(),
       'OP': open(D + '/spec/sdd-operator.md', encoding='utf-8').read()}
SECNAME = {'SDD': 'SDD', 'OP': 'SDD-operator'}

DELTA = 'Δ'
# identifier patterns per defining document
SDD_PATS = [r'C-S\d+', r'J-S\d+', r'W-CS\d+-(?:N|' + DELTA + r'\d+)', r'W-JS\d+', r'R-S\d+', r'S-S\d+',
            r'V-S\d+', r'E-S\d+', r'H-S\d+', r'NG-S\d+', r'OS-\d+', r'G1', r'K1']
CODE_PAT = r'(?:E|W|FL)-(?!PRO\d|JO\d|CS\d|JS\d|S\d|O\d)[A-Z]+(?:-[A-Z]+)*'
OP_PATS = [r'PR-O\d+', r'J-O\d+', r'CV-O\d+', r'RV-O\d+', r'W-PRO\d+-(?:N|' + DELTA + r'\d+)', r'W-JO\d+',
           r'V-O\d+', r'E-O\d+', r'NP-O\d+', r'H-O\d+', r'OO-\d+', r'G2', r'K2']
WV_PAT = r'WV-\d+'
SHARED = [r'S-O\d+']

def owner(i):
    for p in SDD_PATS:
        if re.fullmatch(p, i): return 'SDD'
    for p in OP_PATS:
        if re.fullmatch(p, i): return 'OP'
    if re.fullmatch(WV_PAT, i): return 'OP'
    if re.fullmatch(r'S-O\d+', i): return 'SHARED'
    if re.fullmatch(CODE_PAT, i): return 'SDD'
    return None

ALL = '|'.join(SDD_PATS + OP_PATS + SHARED + [WV_PAT, CODE_PAT])
TOK = re.compile(r'(?<![\w-])(' + ALL + r')(?:\s*[–]\s*(' + ALL + r'|' + DELTA + r'\d+))?(?![\w-])')
SECREF = re.compile(r'(?<![\w-])(SDD-operator|SDD) §(\d+)')

def expand(a, b):
    if b is None: return [a]
    if b.startswith(DELTA):  # W-PRO1-D1-D5 form
        m = re.match(r'(.*-' + DELTA + r')(\d+)$', a)
        n = re.match(DELTA + r'(\d+)$', b)
        return [m.group(1) + str(k) for k in range(int(m.group(2)), int(n.group(1)) + 1)]
    m = re.match(r'(.*?)(\d+)$', a); n = re.match(r'(.*?)(\d+)$', b)
    if m and n and m.group(1) == n.group(1):
        return [m.group(1) + str(k) for k in range(int(m.group(2)), int(n.group(2)) + 1)]
    m = re.match(r'(.*-' + DELTA + r')(\d+)$', a); n = re.match(r'(.*-' + DELTA + r')(\d+)$', b)
    if m and n and m.group(1) == n.group(1):
        return [m.group(1) + str(k) for k in range(int(m.group(2)), int(n.group(2)) + 1)]
    return [a, b]

def blocks(doc):
    """Yield (section, kind, text, lineno)."""
    text = SRC[doc]
    sec = 'preamble'
    cur = []; start = 0; in_recip = False
    def flush():
        if cur:
            yield_list.append((sec, 'para', '\n'.join(cur), start))
    yield_list = []
    for ln, line in enumerate(text.split('\n'), 1):
        if '<!-- reciprocity:begin -->' in line:
            flush(); cur = []; in_recip = True; continue
        if '<!-- reciprocity:end -->' in line:
            in_recip = False; continue
        if in_recip: continue
        h = re.match(r'^## (SDD-operator|SDD) §(\d+)', line)
        if h:
            flush(); cur = []
            sec = SECNAME[doc] + ' §' + h.group(2); continue
        if line.startswith('#'):
            flush(); cur = []; continue
        if line.strip() == '' or line.strip() == '---':
            flush(); cur = []; continue
        if line.startswith('|'):
            flush(); cur = []
            yield_list.append((sec, 'row', line, ln)); continue
        if re.match(r'^\s*- ', line) and not line.startswith('  '):
            flush(); cur = [line]; start = ln; continue
        if not cur: start = ln
        cur.append(line)
    flush()
    return yield_list

def defined_ids(kind, text, sec):
    """Identifiers a block defines."""
    if kind == 'row':
        cells = [c.strip() for c in text.strip().strip('|').split('|')]
        c0 = re.sub(r'\*\*|\*\([^)]*\)\*', '', cells[0]).strip()
        if re.fullmatch(ALL, c0): return [c0]
        return []
    t = re.sub(r'^\s*- ', '', text)
    ids = []
    # leading bold definition
    m = re.match(r'\*\*(' + ALL + r')\b', t)
    if m: ids.append(m.group(1))
    # other bold-introduced definitions in the block: **ID:** or **ID** (Chain scene **W-JO1**, Generator **G2**)
    for m in re.finditer(r'\*\*(' + ALL + r')(?::|\*\*|,| )', t):
        if m.group(1) not in ids: ids.append(m.group(1))
    return ids

def extract(doc):
    other = 'OP' if doc == 'SDD' else 'SDD'
    edges = set(); notes = []
    for sec, kind, text, ln in blocks(doc):
        # reading filters
        if sec == 'preamble' and 'preamble' not in OPTS: continue
        is_registry = kind == 'row' and doc == 'SDD' and sec == 'SDD §11' and re.search(r'`(fixtures|schemas|spec|ontology)/', text)
        if is_registry and 'registry' not in OPTS: continue
        defs = defined_ids(kind, text, sec)
        defs_local = [d for d in defs if owner(d) in (doc, 'SHARED')]
        is_seam = any(owner(d) == 'SHARED' for d in defs_local) and kind == 'row'
        if is_seam and 'seams' not in OPTS: continue
        if is_registry:
            citers = [sec]  # registry row attributed to section
        elif defs_local:
            if 'alldefs' in OPTS: citers = defs_local
            elif 'lastdef' in OPTS: citers = defs_local[-1:]
            elif 'preferW' in OPTS:
                w = [d for d in defs_local if d.startswith('W-')]
                citers = w[:1] or defs_local[:1]
            else: citers = defs_local[:1]
        else:
            citers = [sec]
        targets = set()
        for m in TOK.finditer(text):
            for i in expand(m.group(1), m.group(2)):
                o = owner(i)
                if o != other: continue
                if re.fullmatch(CODE_PAT, i) and 'codes' not in OPTS: continue
                if re.fullmatch(WV_PAT, i) and 'wv' not in OPTS: continue
                targets.add(i)
        if 'secrefs' in OPTS:
            for m in SECREF.finditer(text):
                if (m.group(1) == 'SDD-operator') == (other == 'OP'):
                    targets.add(m.group(1) + ' §' + m.group(2))
        for c in citers:
            for t in targets:
                edges.add((c, t, ln))
    return edges

def norm(e, doc):
    # return (SDD-side artifact, OP-side artifact)
    c, t, ln = e
    def strip(x):
        return x.replace('SDD-operator §', 'SDD-operator §') if True else x
    return (c, t) if doc == 'SDD' else (t, c)

pairs = {}
for doc in ('SDD', 'OP'):
    for e in extract(doc):
        p = norm(e, doc)
        pairs.setdefault(p, []).append((doc, e[2]))

def table(doc):
    t = SRC[doc]
    body = t.split('<!-- reciprocity:begin -->')[1].split('<!-- reciprocity:end -->')[0]
    res = set(); rows = []
    for line in body.strip().split('\n')[2:]:
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        rows.append(line)
        for x in cells[1].split(', '):
            res.add((cells[0], x.strip()))
    return res, body

tS, bS = table('SDD'); tO, bO = table('OP')
print('tables byte-identical:', bS == bO, ' pairs SDD', len(tS), 'OP', len(tO), 'set-equal', tS == tO)
ext = set(pairs)
print('OPTS', sorted(OPTS), ' extracted pairs', len(ext))
miss = sorted(ext - tS); extra = sorted(tS - ext)
print('MISSING from table (%d):' % len(miss))
for p in miss: print('   ', p, pairs[p])
print('EXTRA in table (%d):' % len(extra))
for p in extra: print('   ', p)
