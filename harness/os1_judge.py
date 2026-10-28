"""Independent judge for OS-1 (artifact JSON Schemas + SDD SHACL shapes).

Written by the judge, not the schemas' author. Uses Python `jsonschema` (Draft 2020-12) and pyshacl, neither of which
the author's Node test uses. Checks: every current witness validates against the schema for its @type; corruptions
designed here from the spec (not taken from the author's test) are rejected; every SDD witness conforms to the SHACL
shapes, and SHACL-relevant corruptions do not.

    python -I harness/os1_judge.py <repo root>        (needs: jsonschema, pyshacl, rdflib)
"""
import copy, glob, json, os, sys
from jsonschema import Draft202012Validator
from rdflib import Graph
from pyshacl import validate

ROOT = sys.argv[1]
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
SCHEMA = {t: J(f'schemas/{f}-v1.schema.json') for t, f in [('Inventory', 'inventory'), ('Skeleton', 'skeleton'), ('PromptSet', 'prompt-set'), ('CheckReport', 'check-report'), ('RerunPlan', 'rerun-plan'), ('SemanticDataDictionary', 'sdd')]}
VAL = {t: Draft202012Validator(s) for t, s in SCHEMA.items()}
for s in SCHEMA.values(): Draft202012Validator.check_schema(s)
CTX = J('context/sdd-v1.jsonld')['@context']
SHAPES = Graph().parse(os.path.join(ROOT, 'shapes/sdd-v1.shacl.ttl'), format='turtle')
fails, n = [], 0
def ok(cond, what):
    global n; n += 1
    if not cond: fails.append(what)

witnesses = [f for f in sorted(glob.glob(os.path.join(ROOT, 'fixtures/witnesses/**/*.jsonld'), recursive=True)) if 'superseded' not in f]
by_type = {}
for f in witnesses:
    d = json.load(open(f, encoding='utf-8')); t = d.get('@type'); by_type.setdefault(t, []).append((f, d))
    errs = sorted(VAL[t].iter_errors(d), key=str) if t in VAL else ['no schema for @type ' + str(t)]
    ok(not errs, f'witness {os.path.relpath(f, ROOT)} rejected: {str(errs[0])[:160] if errs else ""}')
print('witnesses per type:', {t: len(v) for t, v in by_type.items()})

def rejects(t, d, what):
    ok(any(True for _ in VAL[t].iter_errors(d)), f'{t}: corruption accepted: {what}')
def mut(t, path, fn, what):
    d = copy.deepcopy(dict(by_type[t][0][1]) if path is None else J(path)); fn(d); rejects(t, d, what)

# Corruptions derived from the spec text (R-S2, R-S3, R-S9, R-S14, R-S15, R-S18, R-S19, R-S21).
SDD = 'fixtures/witnesses/minimal/sdd.jsonld'; REP = 'fixtures/witnesses/minimal/check-report.jsonld'; BAD = 'fixtures/witnesses/minimal/bad-check-report.jsonld'
INV = 'fixtures/witnesses/minimal/inventory.jsonld'; SK = 'fixtures/witnesses/minimal/skeleton.jsonld'; PLAN = 'fixtures/witnesses/minimal/rerun-plan.jsonld'; PS = 'fixtures/witnesses/minimal/prompt-set.jsonld'
attr = lambda d: next(m for m in d['mappings'] if m['kind'] == 'attribute')
for t, p, fn, what in [
    ('SemanticDataDictionary', SDD, lambda d: d.update({'@context': 'https://example.org/ctx.jsonld'}), 'foreign @context (R-S16)'),
    ('SemanticDataDictionary', SDD, lambda d: d.pop('absenceKinds'), 'absenceKinds missing (R-S15)'),
    ('SemanticDataDictionary', SDD, lambda d: attr(d).pop('nullEquivalents'), 'attribute without nullEquivalents (R-S15)'),
    ('SemanticDataDictionary', SDD, lambda d: d['mappings'][0].pop('acceptance'), 'mapping without acceptance (R-S18)'),
    ('SemanticDataDictionary', SDD, lambda d: d['mappings'][0]['acceptance'].update({'at': '2026-10-27 18:00'}), 'malformed acceptance.at'),
    ('SemanticDataDictionary', SDD, lambda d: d['mappings'][0]['provenance'].update({'promptSha256': 'XYZ'}), 'bad sha256'),
    ('SemanticDataDictionary', SDD, lambda d: d['mappings'][0].update({'confidence': 0.9}), 'extra field on a mapping'),
    ('SemanticDataDictionary', SDD, lambda d: attr(d).update({'datatype': 'xsd:integer'}), 'datatype not the R-S9 value for text'),
    ('SemanticDataDictionary', SDD, lambda d: d['mappings'][0].update({'key': 'Organization'}), 'key without ot:/at:/ct: prefix (R-S2)'),
    ('CheckReport', REP, lambda d: d.update({'status': 'rejected'}), 'rejected with no errors (R-S14)'),
    ('CheckReport', BAD, lambda d: d.update({'status': 'validated'}), 'validated with errors (R-S14)'),
    ('CheckReport', BAD, lambda d: d['errors'][0].pop('message'), 'error without message (R-S21)'),
    ('CheckReport', BAD, lambda d: d['errors'][0].update({'code': 'E-CHK-MADE-UP'}), 'unknown error code'),
    ('CheckReport', REP, lambda d: d.update({'round': 0}), 'round 0'),
    ('Inventory', INV, lambda d: d['errors'].append({'code': 'E-SRC-DUP-TYPE', 'key': 'ot:Organization'}), 'errors with non-empty objectTypes (R-S3)'),
    ('Inventory', INV, lambda d: d['source'].update({'identification': 'guess'}), 'identification outside name/externalId/mixed (R-S2)'),
    ('Inventory', INV, lambda d: d.update({'@type': 'Skeleton'}), 'wrong @type'),
    ('Skeleton', SK, lambda d: d['slots'][0].update({'kind': 'table'}), 'unknown slot kind'),
    ('Skeleton', SK, lambda d: d.pop('slots'), 'slots missing'),
    ('RerunPlan', PLAN, lambda d: d.pop('removed'), 'removed missing'),
    ('RerunPlan', PLAN, lambda d: d['flags'].append({'code': 'FL-TERMS-CHANGED', 'key': None}), 'FL-TERMS-CHANGED without previous/current (R-S19)'),
    ('PromptSet', PS, lambda d: d.update({'@type': 'PromptSets'}), 'wrong @type'),
]: mut(t, p, fn, what)

# SHACL: every SDD witness conforms; spec-derived graph-level corruptions do not.
def shacl(d):
    d = copy.deepcopy(d); d['@context'] = CTX
    g = Graph().parse(data=json.dumps(d), format='json-ld')
    return validate(g, shacl_graph=SHAPES, inference='none')[0]
for f, d in by_type.get('SemanticDataDictionary', []):
    ok(shacl(d), f'SHACL: witness {os.path.relpath(f, ROOT)} does not conform')
base = J(SDD)
for fn, what in [
    (lambda d: d['mappings'][0].update({'recordClass': 'cco:ont00001180'}), 'recordClass not an ICE class (R-S5)'),
    (lambda d: attr(d).update({'iceClass': 'cco:ont99999999'}), 'iceClass not in the term list (R-S6)'),
    (lambda d: d['mappings'][0].pop('acceptance'), 'mapping without acceptance'),
    (lambda d: d.update({'open': [d['mappings'][0]['key']]}), 'a key both mapped and open'),
    (lambda d: d['mappings'][0]['acceptance'].update({'decision': 'approved'}), 'decision outside the enumeration'),
]:
    d = copy.deepcopy(base); fn(d); ok(not shacl(d), f'SHACL: corruption conforms: {what}')

print(f'{n} checks, {len(fails)} failed')
for f in fails: print('FAIL', f)
sys.exit(1 if fails else 0)
