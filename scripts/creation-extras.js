import {MAGE_CATALOG, traitInfo, SPECIALTY_SUGGESTIONS, abilityDefinition} from './catalog.js';
export const identityOptions={"nature": ["Architect", "Artist", "Autocrat", "Bon Vivant", "Caregiver", "Celebrant", "Child", "Competitor", "Conformist", "Conniver", "Curmudgeon", "Director", "Entertainer", "Fanatic", "Gallant", "Guardian", "Judge", "Loner", "Martyr", "Mentor", "Monster", "Perfectionist", "Rebel", "Romantic", "Survivor", "Thrill-Seeker", "Traditionalist", "Trickster", "Tycoon", "Vigilante", "Visionary", "Zealot"], "concept": ["Faith Healer", "Occult Investigator", "Street Artist", "Scientist", "Hacker", "Scholar", "Doctor", "Musician", "Community Organizer", "Private Investigator", "Soldier", "Spiritual Counselor", "Entrepreneur", "Wanderer"], "affiliation": ["The Traditions", "Technocratic Union", "Disparate Alliance", "Orphan", "Independent", "Marauders", "Nephandi"], "sect": ["Akashic Brotherhood", "Celestial Chorus", "Cult of Ecstasy", "Dreamspeakers", "Euthanatos", "Order of Hermes", "Sons of Ether", "Verbena", "Virtual Adepts", "Iteration X", "New World Order", "Progenitors", "Syndicate", "Void Engineers", "Ahl-i-Batin", "Bata’a", "Children of Knowledge", "Hollow Ones", "Kopa Loei", "Ngoma", "Sisters of Hippolyta", "Taftâni", "Templar Knights", "Wu Lung"], "essence": ["Dynamic", "Pattern", "Primordial", "Questing"], "demeanor": ["Architect", "Artist", "Autocrat", "Bon Vivant", "Caregiver", "Celebrant", "Child", "Competitor", "Conformist", "Conniver", "Curmudgeon", "Director", "Entertainer", "Fanatic", "Gallant", "Guardian", "Judge", "Loner", "Martyr", "Mentor", "Monster", "Perfectionist", "Rebel", "Romantic", "Survivor", "Thrill-Seeker", "Traditionalist", "Trickster", "Tycoon", "Vigilante", "Visionary", "Zealot"]};
export const factionGroups={
 'the traditions':['Akashic Brotherhood','Celestial Chorus','Cult of Ecstasy','Dreamspeakers','Euthanatos','Order of Hermes','Sons of Ether','Verbena','Virtual Adepts'],
 'technocratic union':['Iteration X','New World Order','Progenitors','Syndicate','Void Engineers'],
 'disparate alliance':['Ahl-i-Batin','Bata’a','Children of Knowledge','Hollow Ones','Kopa Loei','Ngoma','Sisters of Hippolyta','Taftâni','Templar Knights','Wu Lung'],
 'orphan':[], 'independent':[], 'marauders':[], 'nephandi':[]
};
export const meritFlawCatalog=[{"id": "acute-senses", "name": "Acute Senses", "kind": "merit", "values": [1, 2, 3], "description": "One or more senses are unusually sharp. Specify which senses apply.", "reference": "M20 p. 642"}, {"id": "ambidextrous", "name": "Ambidextrous", "kind": "merit", "values": [2], "description": "Use either hand without the usual off-hand penalty; multiple-action rules still apply.", "reference": "Book of Secrets p. 36"}, {"id": "catlike-balance", "name": "Catlike Balance", "kind": "merit", "values": [1], "description": "Unusually steady balance helps with keeping your footing.", "reference": "Book of Secrets p. 37"}, {"id": "common-sense", "name": "Common Sense", "kind": "merit", "values": [1], "description": "The Storyteller may warn you when a proposed action is obviously unwise.", "reference": "Book of Secrets p. 43"}, {"id": "concentration", "name": "Concentration", "kind": "merit", "values": [1], "description": "Tune out ordinary distractions; extreme disruptions still need adjudication.", "reference": "Book of Secrets p. 43"}, {"id": "dark-secret", "name": "Dark Secret", "kind": "flaw", "values": [1], "description": "You conceal something whose exposure would cause serious trouble. Record the secret and its stakes.", "reference": "Book of Secrets p. 61"}, {"id": "enemy", "name": "Enemy", "kind": "flaw", "values": [1, 2, 3, 4, 5], "description": "A hostile person or group works against you. More points represent a more dangerous enemy.", "reference": "M20 p. 647"}, {"id": "nightmares", "name": "Nightmares", "kind": "flaw", "values": [1, 3], "description": "Disturbing dreams interfere with rest; choose the severity and describe their recurring themes.", "reference": "Book of Secrets p. 47"}, {"id": "phobia", "name": "Phobia", "kind": "flaw", "values": [1, 3], "description": "A specific fear causes difficulty or avoidance. Agree on its severity and triggers with the DM.", "reference": "Book of Secrets p. 50"}];

export function factionsFor(identity){
 const value=String(identity.affiliation||'').trim().toLowerCase();
 const aliases={traditions:'the traditions',technocracy:'technocratic union','the technocracy':'technocratic union','the disparate alliance':'disparate alliance'};
 return factionGroups[aliases[value]||value]||[];
}
export function enrichCreationData(data){
 const abilities=data.abilities.map(a=>{const def=abilityDefinition(a.id,a.name);return {...def,...a,id:a.id,name:a.name,category:a.category,nonCore:!!(a.nonCore||def?.nonCore),catalogId:def?.id||a.id,description:def?.description||a.description};});
 const represented=new Set(abilities.map(a=>a.catalogId));
 for(const a of MAGE_CATALOG.abilities)if(!represented.has(a.id))abilities.push({...a,catalogId:a.id});
 // Retain system/world source UUIDs, but always offer the entire curated Mage list.
 const backgrounds=MAGE_CATALOG.backgrounds.map(b=>{const existing=data.backgrounds.find(x=>x.name.toLowerCase()===b.name.toLowerCase());return {...b,...existing,key:existing?.key||'catalog:'+b.id};});
 for(const b of data.backgrounds)if(!backgrounds.some(x=>x.name.toLowerCase()===b.name.toLowerCase()))backgrounds.push({...b});
 return {...data,abilities,backgrounds,avatarBackgroundKey:backgrounds.find(b=>b.name.toLowerCase()==='avatar')?.key};
}
export function meritTotals(state){
 const rows=state.meritsFlaws||[];
 const merits=rows.filter(m=>m.kind==='merit').reduce((t,m)=>t+Number(m.points),0);
 const flaws=rows.filter(m=>m.kind==='flaw').reduce((t,m)=>t+Number(m.points),0);
 const cap=Number(state.flawBonusCap??7);
 return {merits,flaws,cap,bonus:Math.min(cap,flaws),budget:15+Math.min(cap,flaws)};
}
export function validateMerits(state){
 const errors=[],seen=new Set();
 if(!Number.isSafeInteger(Number(state.flawBonusCap??7))||state.flawBonusCap<0||state.flawBonusCap>20)errors.push('Flaw bonus cap must be a whole number from 0 to 20.');
 for(const m of state.meritsFlaws||[]){
  const key=String(m.name||'').trim().toLowerCase();
  if(!key||!String(m.description||'').trim()||!['merit','flaw'].includes(m.kind)||!Number.isSafeInteger(Number(m.points))||m.points<1||m.points>20)errors.push('Each Merit or Flaw needs a name, explanation, type and whole point value from 1 to 20.');
  if(seen.has(key))errors.push('Duplicate Merit or Flaw: '+m.name);seen.add(key);
  const def=meritFlawCatalog.find(x=>x.id===m.sourceId);
  if(def&&(!def.values.includes(Number(m.points))||def.kind!==m.kind))errors.push(m.name+' needs one of its listed point values.');
 }
 return errors;
}
export function creationTrait(kind,key,name,value,fallback=''){
 const info=traitInfo(kind,key,fallback,name);
 return {...info,ratingLabel: value>0?(value+' · '+(info.ranks[value-1]||'')):'0 · Unrated',dmApproval:value>=4&&kind!=='attribute',suggestions:SPECIALTY_SUGGESTIONS[info.catalogId]||[]};
}

export function migrateAbilityAliases(state,data){
 const merged=[];
 for(const a of data.abilities){
  if(!a.catalogId||a.catalogId===a.id)continue;
  for(const map of [state.abilities,state.baseSnapshot?.abilities]){
   if(!map||!(a.catalogId in map))continue;
   if(Number(map[a.catalogId])>0)merged.push(a.name);
   map[a.id]=Math.max(Number(map[a.id]||0),Number(map[a.catalogId]||0));delete map[a.catalogId];
  }
  const specialties=state.specialties?.abilities;
  if(specialties?.[a.catalogId]&&!specialties[a.id])specialties[a.id]=specialties[a.catalogId];
  if(specialties)delete specialties[a.catalogId];
  state.selectedAbilities=(state.selectedAbilities||[]).filter(id=>id!==a.catalogId);
 }
 return [...new Set(merged)];
}
