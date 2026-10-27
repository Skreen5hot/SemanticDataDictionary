// INDEPENDENT ORACLE: lines 5-34 of check.cjs, written by isolated cycle-3 rater B from spec v0.3 alone.
// Copied byte-for-byte (not modified by the author). Requires `by`, `byIri` to be provided by the harness.
const by = {}, byIri = {};
const ICE="https://www.commoncoreontologies.org/ont00000958";
const anc=iri=>{const s=new Set([iri]),st=[iri];while(st.length){const i=st.pop();for(const p of (byIri[i]?.superclasses||[]))if(!s.has(p)){s.add(p);st.push(p)}}return s};
function slotsOf(promptFile){const pr=fs.readFileSync(W+promptFile,"utf8");const d=pr.slice(pr.indexOf("-----BEGIN DATA (untrusted)-----\n")+33, pr.indexOf("-----END DATA-----"));return d.split("\n").filter(Boolean).map(l=>JSON.parse(l));}
function check(slots, prop){
 const errs=[],warns=[];const keys=slots.map(s=>s.key);
 const cnt={};for(const m of prop.mappings)cnt[m.key]=(cnt[m.key]||0)+1;
 for(const k of keys){if(!cnt[k])errs.push(["E-CHK-MISSING",k]);else if(cnt[k]>1)errs.push(["E-CHK-DUPLICATE",k]);}
 for(const m of prop.mappings)if(!keys.includes(m.key))errs.push(["E-CHK-UNKNOWN-KEY",m.key]);
 const ref={};for(const m of prop.mappings)if(m.referentClass)ref[m.key]=m.referentClass;
 const seen=new Set();
 for(const s of slots){const m=prop.mappings.find(x=>x.key===s.key);if(!m||seen.has(s.key))continue;seen.add(s.key);
  for(const h of ["nullEquivalents","acceptance","decision","datatype","valueProperty"]) if(h in m) errs.push(["E-CHK-HUMAN-FIELD",s.key,h]);
  const want={type:["key","recordClass","referentClass","rationale"],attribute:["key","iceClass","rationale"],reference:["key","relation","rationale"],containment:["key","relation","rationale"]}[s.kind];
  const have=Object.keys(m).filter(k=>!["nullEquivalents","acceptance","decision","datatype","valueProperty"].includes(k));
  if(have.sort().join()!==want.slice().sort().join()){errs.push(["E-CHK-FIELDS",s.key]);continue;}
  for(const f of ["recordClass","referentClass","iceClass","relation"]){ if(!(f in m))continue;const v=m[f];
   if(f==="relation"&&v==="sdd:NoRelation"){ if(s.kind!=="containment")errs.push(["E-CHK-KIND",s.key,f,v]); continue;}
   const x=by[v]; if(!x){errs.push(["E-CHK-TERM",s.key,f,v]);continue;}
   const kind=f==="relation"?"object_property":"class";
   if(!x.permitted||x.kind!==kind){errs.push(["E-CHK-KIND",s.key,f,v]);continue;}
   if((f==="recordClass"||f==="iceClass")&&!anc(x.iri).has(ICE)){errs.push(["E-CHK-CATEGORY",s.key,f,v]);continue;}
   if(f==="relation"){const own=s.kind==="reference"?s.owner:s.child, tgt=s.kind==="reference"?s.target:s.container;
     const ro=ref[own], rt=ref[tgt]; if(!ro||!rt){warns.push(["W-CHK-RANGE-UNRESOLVED",s.key]);continue;}
     const ok=(x.domain||[]).every(d=>anc(by[ro].iri).has(d))&&(x.range||[]).every(r=>anc(by[rt].iri).has(r));
     if(!ok){errs.push(["E-CHK-RANGE",s.key,f,v]);continue;}}
   if(f!=="relation"){ if(v.startsWith("bfo:")||v==="cco:ont00000958")warns.push(["W-CHK-GENERIC",s.key,f,v]);
     if(f==="referentClass"&&anc(x.iri).has(ICE))warns.push(["W-CHK-ICE-REFERENT",s.key,f,v]);}
  }}
 return {errs,warns};
}
module.exports = { check, setTerms(b, bi) { Object.assign(by, b); Object.assign(byIri, bi); } };
