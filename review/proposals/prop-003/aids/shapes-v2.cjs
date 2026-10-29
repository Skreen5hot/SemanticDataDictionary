// v0.5: derive shapes/sdd-v2.shacl.ttl from the version-1 copy. Run from the repository root.
const fs = require('fs');
const P = 'shapes/sdd-v2.shacl.ttl';
let t = fs.readFileSync('shapes/sdd-v1.shacl.ttl', 'utf8');
function rep(a, b, want = 1) {
  const n = t.split(a).length - 1;
  if (n !== want) throw new Error(`${n} (want ${want}) matches for ${a.slice(0, 90)}`);
  t = t.split(a).join(b);
}
rep('# SHACL shapes for the SDD SemanticDataDictionary (SDD OS-1, ADR-006). SHACL Core only (no SPARQL constraints).',
    '# SHACL shapes for the SDD SemanticDataDictionary, version 2 (SDD v0.5, OS-1, ADR-006, R-S24). SHACL Core only (no SPARQL\n# constraints). Version 2: attribute mappings carry no valueProperty, and iceClass may be JSON null.');
rep('recordClass, referentClass, iceClass, relation, datatype, valueProperty and contextIri are IRIs;',
    'recordClass, referentClass, iceClass, relation, datatype and contextIri are IRIs;');
rep('schemas/sdd-v1.schema.json', 'schemas/sdd-v2.schema.json');
rep('nullEquivalents (an empty array yields no triple).',
    'nullEquivalents (an empty array yields no triple); presence of an iceClass member whose value is null (a JSON null yields\n# no triple, so an accepted mapping with no specific classification has no sdd:iceClass; the JSON Schema requires the member).');
rep('shapes/sdd-v1#', 'shapes/sdd-v2#');
rep('sh:path sdd:sddVersion ; sh:minCount 1 ; sh:maxCount 1 ; sh:datatype xsd:integer ; sh:hasValue 1 ]',
    'sh:path sdd:sddVersion ; sh:minCount 1 ; sh:maxCount 1 ; sh:datatype xsd:integer ; sh:hasValue 2 ]');
rep('# Attribute (R-S5 iceClass; R-S9 datatype and valueProperty by Jira type; R-S15 nullEquivalents).',
    '# Attribute (R-S5 iceClass, absent when the JSON value is null; R-S9 datatype by Jira type; R-S15 nullEquivalents). Closed, so\n# a sdd:valueProperty triple does not conform.');
rep('sh:property [ sh:path sdd:iceClass ; sh:minCount 1 ; sh:maxCount 1 ; sh:nodeKind sh:IRI ; sh:node sddsh:InformationContentEntityClass ] ;',
    'sh:property [ sh:path sdd:iceClass ; sh:maxCount 1 ; sh:nodeKind sh:IRI ; sh:node sddsh:InformationContentEntityClass ] ;');
rep('  sh:property [ sh:path sdd:valueProperty ; sh:minCount 1 ; sh:maxCount 1 ; sh:nodeKind sh:IRI ; sh:in ( cco:ont00001765 cco:ont00001768 cco:ont00001773 cco:ont00001770 cco:ont00001772 cco:ont00001771 cco:ont00001767 ) ] ;\n', '');
rep('# R-S9 value table: datatype and valueProperty are fixed by the source Jira type.',
    '# R-S9 value table: the datatype is fixed by the source Jira type.');
t = t.replace(/ ;\n      sh:property \[ sh:path sdd:valueProperty ; sh:hasValue cco:ont[0-9]{8} \] \]/g, (m) => { rep.count = (rep.count || 0) + 1; return ' ]'; });
if (rep.count !== 7) throw new Error(`value table rows: ${rep.count}`);
for (const l of t.split(/\n/)) if (/valueProperty/.test(l)) console.log('remaining:', l);
fs.writeFileSync(P, t);
console.log('shapes v2 ok');
