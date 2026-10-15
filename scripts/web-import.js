import {isPcMage} from './advancement-builder.js';
const MODULE_ID='wod20-mage-charamancer';

function categoryOf(item){
 const category=String(item?.system?.type??'').toLowerCase();
 if(category.includes('talent'))return 'talent';
 if(category.includes('skill'))return 'skill';
 if(category.includes('knowledge'))return 'knowledge';
 return null;
}
function nonCoreMetadata(item){
 return {...item?.flags?.['mage-character-tools'],...item?.flags?.[MODULE_ID]};
}
function expectedNonCoreAbilities(source){
 const expected=new Map();
 // Old browser exports carry item-level flags; 0.1.23 and later also supply an
 // actor-level manifest so a missing item can be reconstructed during import.
 for(const item of source.items||[]){
  if(item?.type!=='Ability')continue;
  const meta=nonCoreMetadata(item),id=String(item.system?.id||'').trim();
  if(!id||!(meta.nonCore||id.startsWith('extra-')))continue;
  const category=categoryOf(item)||meta.category;
  const value=Number(item.system?.value??0);
  if(!['talent','skill','knowledge'].includes(category))throw new Error(`Non-core Ability ${item.name||id} has an invalid category.`);
  if(!Number.isInteger(value)||value<0||value>5)throw new Error(`Non-core Ability ${item.name||id} has an invalid rating.`);
  if(value===0)continue;
  expected.set(id,{id,name:item.name||item.system?.label||id,category,value,
   speciality:String(item.system?.speciality||''),description:String(item.system?.description||''),sourceItem:item});
 }
 const manifest=source.flags?.['mage-character-tools']?.nonCoreAbilityManifest||
  source.flags?.[MODULE_ID]?.nonCoreAbilityManifest||[];
 if(!Array.isArray(manifest))throw new Error('Invalid non-core Ability manifest.');
 for(const entry of manifest){
  const id=String(entry?.id||'').trim(),category=String(entry?.category||'').toLowerCase(),value=Number(entry?.value);
  if(!id||!['talent','skill','knowledge'].includes(category)||!Number.isInteger(value)||value<0||value>5)
   throw new Error('Non-core Ability manifest contains an invalid entry.');
  if(!value)continue;
  // The manifest is the authoritative selection if an older export omitted its
  // corresponding Item. Otherwise prefer the actual item's complete data.
  if(!expected.has(id))expected.set(id,{id,name:String(entry.name||id),category,value,
   speciality:String(entry.speciality||''),description:String(entry.description||''),sourceItem:null});
 }
 return [...expected.values()];
}
function nativeAbilityData(entry,source){
 const template=entry.sourceItem || source.items.find(item=>item?.type==='Ability'&&categoryOf(item)===entry.category);
 const data=template?foundry.utils.deepClone(template):{name:entry.name,type:'Ability',system:{}};
 // Embedded Items copied from a world export must receive new document IDs.
 for(const key of ['_id','folder','_stats','ownership','pack','sort'])delete data[key];
 data.type='Ability';data.name=entry.name;
 data.system??={};
 Object.assign(data.system,{
  id:entry.id,type:`wod.abilities.${entry.category}`,label:entry.name,
  value:entry.value,total:entry.value+Number(data.system.bonus||0),
  max:Math.max(5,Number(data.system.max||0)),
  speciality:entry.speciality,description:entry.description||data.system.description||''
 });
 data.system.settings={...data.system.settings,iscreated:true,isvisible:true,isremovable:true,version:game.system.version};
 data.flags={...data.flags,[MODULE_ID]:{...nonCoreMetadata(data),nonCore:true,approvalRequired:true,category:entry.category}};
 return data;
}
async function restoreNonCoreAbilities(actor,source,expected){
 const counts={talent:0,skill:0,knowledge:0};
 for(const entry of expected){
  let item=actor.items.find(i=>i.type==='Ability'&&i.system?.id===entry.id);
  if(!item){
   await actor.createEmbeddedDocuments('Item',[nativeAbilityData(entry,source)]);
   item=actor.items.find(i=>i.type==='Ability'&&i.system?.id===entry.id);
  }
  if(!item)throw new Error(`Foundry failed to create non-core ${entry.category}: ${entry.name}.`);
  const update={_id:item.id};
  const current=categoryOf(item);
  if(current!==entry.category)update['system.type']=`wod.abilities.${entry.category}`;
  if(Number(item.system?.value)!==entry.value)update['system.value']=entry.value;
  if(Number(item.system?.total)!==entry.value+Number(item.system?.bonus||0))update['system.total']=entry.value+Number(item.system?.bonus||0);
  if(String(item.system?.speciality||'')!==entry.speciality)update['system.speciality']=entry.speciality;
  if(!String(item.system?.description||'').trim()&&entry.description)update['system.description']=entry.description;
  if(item.system?.settings?.isvisible!==true)update['system.settings.isvisible']=true;
  if(item.system?.settings?.iscreated!==true)update['system.settings.iscreated']=true;
  if(item.system?.settings?.isremovable!==true)update['system.settings.isremovable']=true;
  if(!item.flags?.[MODULE_ID]?.nonCore)update[`flags.${MODULE_ID}`]={...nonCoreMetadata(item),nonCore:true,approvalRequired:true,category:entry.category};
  if(Object.keys(update).length>1)await actor.updateEmbeddedDocuments('Item',[update]);
  counts[entry.category]++;
 }
 // Never report success merely because Actor.create returned. Confirm actual
 // embedded Items, category, ratings, and visibility after the write.
 const missing=expected.filter(entry=>{
  const item=actor.items.find(i=>i.type==='Ability'&&i.system?.id===entry.id);
  return !item||categoryOf(item)!==entry.category||Number(item.system?.value)!==entry.value||item.system?.settings?.isvisible!==true;
 });
 if(missing.length)throw new Error('Could not verify imported non-core Abilities: '+missing.map(entry=>entry.name+' ('+entry.category+')').join(', '));
 return counts;
}
export function validateWebActor(data){
 if(!data||Array.isArray(data)||typeof data!=='object'||!isPcMage(data))throw new Error('Choose Export Foundry JSON from the web charamancer. This importer requires a current WoD20 PC Mage; PDFs and app JSON are not supported here.');
 if(typeof data.name!=='string'||!data.name.trim()||!data.system?.attributes||!Array.isArray(data.items))throw new Error('Character JSON is missing its name, Attributes, or Items.');
 for(const key of ['arete','willpower'])if(!data.items.some(i=>i.type==='Advantage'&&i.system?.id===key))throw new Error('Character JSON is missing '+key+'.');
 for(const item of data.items)if(!item||typeof item.type!=='string'||!item.system)throw new Error('Invalid character Item.');
 expectedNonCoreAbilities(data); // Fail fast if a non-core selection cannot be restored.
 return data;
}
export async function importWebCharacter(data){
 if(game.system.id!=='worldofdarkness')throw new Error('Use the World of Darkness 20th system.');
 if(!game.user.isGM&&!game.user.can('ACTOR_CREATE'))throw new Error('You do not have permission to create Actors. Ask the GM to import this character.');
 validateWebActor(data);
 const source=foundry.utils.deepClone(data),expected=expectedNonCoreAbilities(source);
 // A fresh Actor avoids overwriting live play state or inheriting another world's permissions.
 for(const key of ['_id','folder','ownership','_stats','sort','pack'])delete source[key];
 if(source.prototypeToken){delete source.prototypeToken._id;delete source.prototypeToken.actorId;delete source.prototypeToken.flags;}
 source.ownership={default:0,[game.user.id]:3};
 source.flags={...source.flags,[MODULE_ID]:{...source.flags?.['mage-character-tools'],...source.flags?.[MODULE_ID],webImport:true,importedAt:new Date().toISOString(),importedBy:game.user.id}};
 for(const item of source.items)if(item.flags?.['mage-character-tools'])item.flags={...item.flags,[MODULE_ID]:{...item.flags['mage-character-tools'],...item.flags[MODULE_ID]}};
 const actor=await Actor.create(source,{renderSheet:false});
 if(!actor)throw new Error('Foundry did not create the Actor.');
 try{
  const counts=await restoreNonCoreAbilities(actor,source,expected);
  console.info(MODULE_ID+' | Verified non-core import for '+actor.name,counts);
  actor.sheet?.render(true);
  // Use the same return type as before for macros/API consumers.
  return actor;
 }catch(error){
  // Do not leave an accidentally incomplete duplicate PC in the Actors sidebar.
  try{await actor.delete();}catch(cleanupError){console.error(MODULE_ID+' | Could not remove failed import actor',cleanupError);}
  throw error;
 }
}
// Update an existing Actor in place so linked tokens, ownership and integrations
// keep the same Actor ID. A complete backup Actor is created before any write.
export async function updateWebCharacter(data,target){
 if(game.system.id!=='worldofdarkness')throw new Error('Use the World of Darkness 20th system.');
 validateWebActor(data);
 if(!isPcMage(target)||!(game.user.isGM||target.isOwner))throw new Error('Select an editable PC Mage in this world.');
 if(!game.user.isGM&&!game.user.can('ACTOR_CREATE'))throw new Error('Creating a safety backup requires Actor creation permission. Ask your GM to perform the update.');
 const source=foundry.utils.deepClone(data),expected=expectedNonCoreAbilities(source);
 const original=target.toObject();
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const backupData=foundry.utils.deepClone(original);
 delete backupData._id;
 backupData.name=`${target.name} - Backup ${stamp}`;
 backupData.flags={...backupData.flags,[MODULE_ID]:{...backupData.flags?.[MODULE_ID],safetyBackup:true,backupOf:target.id,backupAt:new Date().toISOString()}};
 if(backupData.prototypeToken){delete backupData.prototypeToken._id;delete backupData.prototypeToken.actorId;}
 const backup=await Actor.create(backupData,{renderSheet:false});
 if(!backup)throw new Error('The safety backup could not be created. The original Mage was not changed.');
 const prepareItems=items=>items.map(item=>{
  const clean=foundry.utils.deepClone(item);
  for(const key of ['_id','folder','_stats','ownership','pack','sort'])delete clean[key];
  if(clean.flags?.['mage-character-tools'])clean.flags={...clean.flags,[MODULE_ID]:{...clean.flags['mage-character-tools'],...clean.flags[MODULE_ID]}};
  return clean;
 });
 const itemKey=item=>{
  const id=String(item.system?.id||'').trim();
  if(id)return `${item.type}:${id}`;
  if(item.type==='Feature')return `Feature:${item.system?.type||''}:${String(item.name).toLowerCase()}`;
  // Experience rows may share names. Matching in insertion order keeps existing
  // IDs when the same award/purchase survives a refresh.
  return `${item.type}:${item.name}:${item.system?.description||''}:${item.system?.amount??''}`;
 };
 const syncItems=async items=>{
  const pools=new Map();
  for(const existing of target.items){const key=itemKey(existing);if(!pools.has(key))pools.set(key,[]);pools.get(key).push(existing);}
  const updates=[],creations=[],used=new Set();
  for(const clean of prepareItems(items)){
   const match=pools.get(itemKey(clean))?.shift();
   if(match){used.add(match.id);updates.push({_id:match.id,name:clean.name,system:clean.system,flags:clean.flags||{},img:clean.img??match.img});}
   else creations.push(clean);
  }
  const deletions=[...target.items].filter(item=>!used.has(item.id)).map(item=>item.id);
  if(updates.length)await target.updateEmbeddedDocuments('Item',updates);
  if(creations.length)await target.createEmbeddedDocuments('Item',creations);
  if(deletions.length)await target.deleteEmbeddedDocuments('Item',deletions);
 };
 const apply=async actorData=>{
  const actorFlags={...target.flags,...actorData.flags,[MODULE_ID]:{...target.flags?.[MODULE_ID],...actorData.flags?.['mage-character-tools'],...actorData.flags?.[MODULE_ID],webImport:true,importedAt:new Date().toISOString(),importedBy:game.user.id}};
  await target.update({name:actorData.name,system:foundry.utils.deepClone(actorData.system),img:actorData.img??target.img,flags:actorFlags,'prototypeToken.name':actorData.name});
  await syncItems(actorData.items);
 };
 try{
  await apply(source);
  const counts=await restoreNonCoreAbilities(target,source,expected);
  // Verify the basic World of Darkness actor identity survived import.
  if(!isPcMage(target))throw new Error('Imported actor no longer has the Mage PC configuration.');
  const incoming=source.items.filter(i=>i.type!=='Ability'||!i.system?.id?.startsWith('extra-'));
  if(target.items.size<incoming.length)throw new Error('Some imported actor Items did not survive the update.');
  target.sheet?.render(true);
  console.info(`${MODULE_ID} | Updated existing Mage ${target.name}; backup ${backup.name}`,counts);
  return {actor:target,backup,counts};
 }catch(error){
  try{
   await target.update({name:original.name,system:original.system,img:original.img,flags:original.flags,'prototypeToken.name':original.prototypeToken?.name||original.name});
   await syncItems(original.items||[]);
  }catch(rollbackError){
   console.error(`${MODULE_ID} | Update rollback failed. Recover from safety backup ${backup.name}`,rollbackError);
   throw new Error(`${error.message}. Automatic rollback failed. Restore from backup Actor: ${backup.name}.`);
  }
  throw new Error(`${error.message}. The previous Actor data was restored; safety backup: ${backup.name}.`);
 }
}

async function chooseImportMode(data){
 const candidates=game.actors.filter(actor=>isPcMage(actor)&&!actor.flags?.[MODULE_ID]?.safetyBackup&&(game.user.isGM||actor.isOwner));
 if(!candidates.length)return {mode:'new'};
 const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const options=candidates.map(actor=>`<option value="${esc(actor.id)}" ${actor.name.toLowerCase()===String(data.name).toLowerCase()?'selected':''}>${esc(actor.name)}</option>`).join('');
 const Dialog=foundry.applications.api.DialogV2;
 return await Dialog.wait({
  window:{title:'Import Mage from Browser'},
  content:`<p><strong>${esc(data.name)}</strong></p><p>Choose whether to create a new Mage or replace an existing one. Updating creates a separate full backup Actor before changing the target. Its Actor ID, ownership, linked tokens, and active effects are preserved.</p><label>Existing Mage to update<select name="mageImportTarget" style="width:100%">${options}</select></label><p><small>Imported ratings, Items, biography, and XP records replace the existing character data. Make sure this export contains the changes you want.</small></p>`,
  buttons:[
   {action:'new',label:'Create New Actor',default:true,callback:()=>({mode:'new'})},
   {action:'update',label:'Update Selected (Backup First)',callback:(_event,button,dialog)=>({mode:'update',targetId:dialog.element.querySelector('[name="mageImportTarget"]')?.value})},
   {action:'cancel',label:'Cancel',callback:()=>null}
  ],
  close:()=>null
 });
}

export function chooseWebCharacter(){
 const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
 input.addEventListener('change',async()=>{
  const file=input.files?.[0];if(!file)return;
  try{
   if(file.size>10*1024*1024)throw new Error('Character JSON must be smaller than 10 MB.');
   const data=validateWebActor(JSON.parse(await file.text()));
   const choice=await chooseImportMode(data);
   if(!choice)return;
   if(choice.mode==='update'){
    const target=game.actors.get(choice.targetId);
    if(!target)throw new Error('Choose a valid Actor to update.');
    const confirmed=window.confirm(`Replace ${target.name} with imported data from ${data.name}?\n\nA complete safety BACKUP Actor will be created first.\n\nRatings, Items, XP history and biography will be replaced. Linked tokens and existing permissions will be retained.`);
    if(!confirmed)return;
    const {backup}=await updateWebCharacter(data,target);
    ui.notifications.info(`Updated ${target.name}. Full backup saved as ${backup.name}.`);
   }else{
    const actor=await importWebCharacter(data);
    ui.notifications.info(`Imported ${actor.name} as a new Mage Actor.`);
   }
  }catch(error){console.error(MODULE_ID,error);ui.notifications.error('Mage import failed: '+error.message);}
 });
 input.click();
}
