// E-S2 input (SDD §8): "C-S4 on a 5,000-slot G1 schema's full proposal". G1's stated bounds (≤ 40 types, ≤ 12
// attributes, ≤ 3 references, ≤ 2 nested selectors per type) cap a schema near 720 slots, so the envelope is read as
// G1's generator with the type count raised until the schema has at least the requested number of slots; every
// other G1 rule is unchanged (recorded as a reading in review/register.md). Used by bench/run.mjs.
import { g1 } from './g1.mjs';
import { Assignment, correctProposal, toPaste } from './proposal.mjs';

const slotCount = (exp) => Object.values(exp.slots).reduce((a, k) => a + k.length, 0);

export async function makeE_S2(minSlots, seed = 'e-s2') {
  for (let types = 300; types <= 2000; types += 50) {
    const g = g1(`${seed}/${types}`, { minTypes: types, maxTypes: types });
    const slots = slotCount(g.exp);
    if (slots >= minSlots) return { schemaBytes: g.bytes, seed: g.seed, slots };
  }
  throw new Error(`no G1 schema reached ${minSlots} slots`);
}
export async function proposalFor(promptText, seed = 'e-s2/asg') {
  return toPaste(correctProposal(promptText, new Assignment(seed)), 'bare');
}
