// M20 faction Affinity recommendations (M20 core pp. 251-252).
// These are advisory only: do not change or prohibit nonstandard choices.
// Core equivalents when optional Technocratic Spheres are unavailable:
// Correspondence = Data, Prime = Primal Utility, Spirit = Dimensional Science.
const FACTION_AFFINITIES = {
  "akashic brotherhood": [
    "mind",
    "life"
  ],
  "celestial chorus": [
    "prime",
    "forces",
    "spirit"
  ],
  "cult of ecstasy": [
    "time",
    "life",
    "mind"
  ],
  "dreamspeakers": [
    "spirit",
    "forces",
    "life",
    "matter"
  ],
  "euthanatos": [
    "entropy",
    "life",
    "spirit"
  ],
  "order of hermes": [
    "forces"
  ],
  "sons of ether": [
    "matter",
    "forces",
    "prime"
  ],
  "verbena": [
    "life",
    "forces"
  ],
  "virtual adepts": [
    "correspondence",
    "forces"
  ],
  "iteration x": [
    "forces",
    "matter",
    "time"
  ],
  "new world order": [
    "mind",
    "correspondence"
  ],
  "progenitors": [
    "life",
    "prime"
  ],
  "syndicate": [
    "entropy",
    "mind",
    "prime"
  ],
  "void engineers": [
    "spirit",
    "correspondence",
    "forces"
  ],
  "ahl i batin": [
    "correspondence",
    "mind"
  ],
  "bata a": [
    "life",
    "spirit"
  ],
  "children of knowledge": [
    "forces",
    "matter",
    "prime",
    "entropy"
  ],
  "ngoma": [
    "life",
    "mind",
    "prime",
    "spirit"
  ],
  "sisters of hippolyta": [
    "life",
    "mind"
  ],
  "taftani": [
    "forces",
    "matter",
    "prime",
    "spirit"
  ],
  "templar knights": [
    "forces",
    "life",
    "mind",
    "prime"
  ],
  "wu lung": [
    "spirit",
    "forces",
    "matter",
    "life"
  ],
  "akashayana": [
    "mind",
    "life"
  ],
  "akashics": [
    "mind",
    "life"
  ],
  "sahajiya": [
    "time",
    "life",
    "mind"
  ],
  "khavadi": [
    "spirit",
    "forces",
    "life",
    "matter"
  ],
  "kha vadi": [
    "spirit",
    "forces",
    "life",
    "matter"
  ],
  "chakravanti": [
    "entropy",
    "life",
    "spirit"
  ],
  "euthanatoi": [
    "entropy",
    "life",
    "spirit"
  ],
  "society of ether": [
    "matter",
    "forces",
    "prime"
  ],
  "mercu rial elite": [
    "correspondence",
    "forces"
  ],
  "celestial choir": [
    "prime",
    "forces",
    "spirit"
  ],
  "choirister": [
    "prime",
    "forces",
    "spirit"
  ],
  "verbenae": [
    "life",
    "forces"
  ],
  "virtual adept": [
    "correspondence",
    "forces"
  ],
  "bataa": [
    "life",
    "spirit"
  ]
};
export function recommendedAffinityIds(faction) {
  const norm = String(faction || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return FACTION_AFFINITIES[norm] || [];
}
