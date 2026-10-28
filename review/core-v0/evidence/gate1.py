import re, sys, hashlib
D = sys.argv[1]
docs = {'SDD': D + '/spec/sdd-service.md', 'OP': D + '/spec/sdd-operator.md'}
rows = {}
for k, p in docs.items():
    for ln, line in enumerate(open(p, encoding='utf-8').read().split('\n'), 1):
        m = re.match(r'^\|\s*(\*\*)?(S-O\d)(\*\*)?(\s*\*\([^)]*\)\*)?\s*\|(.*)$', line)
        if m:
            cells = [c.strip() for c in m.group(5).rstrip().rstrip('|').split('|')]
            rows.setdefault(m.group(2), {})[k] = (ln, cells, m.group(1), m.group(4))
for sid in sorted(rows):
    v = rows[sid]
    print(sid, {k: x[0] for k, x in v.items()})
    a, b = v['SDD'][1], v['OP'][1]
    print('  ncells', len(a), len(b), 'identical' if a == b else 'DIFFER')
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            print('  cell', i, repr(x), '|', repr(y))
    print('  status', a[-1], b[-1], ' contract', a[1], '| example sha', hashlib.sha256(a[2].encode()).hexdigest()[:8], hashlib.sha256(b[2].encode()).hexdigest()[:8])
    print('  SDD bold/annot:', v['SDD'][2], v['SDD'][3])
