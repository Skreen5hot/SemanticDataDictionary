"""Independent-oracle check for tools/turtle-subclass.mjs (method P10: validate a witness
against an independent oracle). Parses each Turtle file with rdflib and with the zero-dependency
JS reader, and requires the two sets of named rdfs:subClassOf edges to be identical.

    python tools/verify-hierarchy.py FILE.ttl [FILE.ttl ...]

Needs rdflib (pip install rdflib==7.1.1) and node. Not part of the offline build: rdflib is
used only to verify the reader, never to produce the term list.
"""
import json
import subprocess
import sys
from pathlib import Path

import rdflib
from rdflib.namespace import RDFS

ROOT = Path(__file__).resolve().parent.parent

JS = """
import { readFileSync } from 'node:fs';
import { namedSubclassEdges } from './tools/turtle-subclass.mjs';
const r = namedSubclassEdges(readFileSync(process.argv[1], 'utf8'));
process.stdout.write(JSON.stringify(r));
"""


def js_edges(path):
    out = subprocess.run(["node", "--input-type=module", "-e", JS, str(path)],
                         cwd=ROOT, capture_output=True, text=True, check=True)
    r = json.loads(out.stdout)
    return {tuple(e) for e in r["edges"]}, r["anonymousObjects"]


def rdflib_edges(path):
    g = rdflib.Graph()
    g.parse(path, format="turtle")
    named, anonymous = set(), 0
    for s, o in g.subject_objects(RDFS.subClassOf):
        if isinstance(s, rdflib.URIRef) and isinstance(o, rdflib.URIRef):
            named.add((str(s), str(o)))
        elif isinstance(s, rdflib.URIRef):
            anonymous += 1
    return named, anonymous


failed = False
for arg in sys.argv[1:]:
    js, js_anon = js_edges(Path(arg).resolve())
    rl, rl_anon = rdflib_edges(arg)
    same = js == rl and js_anon == rl_anon
    failed |= not same
    print(f"{'MATCH' if same else 'DIFFER'}  {Path(arg).name}: js {len(js)} named / {js_anon} anonymous; "
          f"rdflib {len(rl)} named / {rl_anon} anonymous")
    for e in sorted(js - rl)[:5]:
        print("   only js:    ", e)
    for e in sorted(rl - js)[:5]:
        print("   only rdflib:", e)
sys.exit(1 if failed else 0)
