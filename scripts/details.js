import {MAGE_CATALOG, SPECIALTY_SUGGESTIONS, traitInfo, requiredSpecialties} from './catalog.js';
import {isPcMage,getExperienceSummary} from './advancement-builder.js';
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
export async function saveMageSpecialties(actor,entries){
 if(!isPcMage(actor)||(!game.user.isGM&&!actor.isOwner))throw new Error('You do not have permission to edit this PC Mage.');
 const attrs={},items=[],oldAttrs={},oldItems=[];
 for(const entry of entries){const value=String(entry.value||'').trim();if(!value)throw new Error('Choose a specialty for '+entry.name+'.');
  if(entry.kind==='attribute'){const a=actor.system.attributes[entry.key];if(!a||Number(a.value)<4)throw new Error('The Attribute rating changed. Reload Mage Details.');attrs['system.attributes.'+entry.key+'.speciality']=value;oldAttrs['system.attributes.'+entry.key+'.speciality']=a.speciality||'';}
  else{const item=actor.items.get(entry.itemId);if(item?.type!=='Ability'||Number(item.system.value)<4)throw new Error('The Ability rating changed. Reload Mage Details.');items.push({_id:item.id,'system.speciality':value});oldItems.push({_id:item.id,'system.speciality':item.system.speciality||''});}
 }
 try{if(Object.keys(attrs).length)await actor.update(attrs);if(items.length)await actor.updateEmbeddedDocuments('Item',items);}catch(error){try{if(Object.keys(oldAttrs).length)await actor.update(oldAttrs);if(oldItems.length)await actor.updateEmbeddedDocuments('Item',oldItems);}catch{throw new Error(error.message+' Rollback failed; review specialties manually.');}throw error;}
}
function xpHistory(actor){
 const groups=new Map(),ungrouped=[];
 for(const item of actor.items.filter(i=>i.type==='Experience')){
  const kind=item.system?.type;
  if(!['wod.types.expgained','wod.types.expspent'].includes(kind))continue;
  const meta=item.flags?.['wod20-mage-charamancer']||{};
  const batch=meta.experienceAwardBatchId||meta.advancementBatchId;
  const amount=Number(item.system?.amount||0);
  if(kind==='wod.types.expspent'&&item.system?.isspent===false)continue;
  const itemDate=meta.awardDate||meta.advancementDate||'';
  const sort=Number(item._stats?.createdTime||item._stats?.modifiedTime||0);
  if(batch){
   const g=groups.get(batch)||{date:itemDate,description:meta.storyNote||'',type:kind==='wod.types.expgained'?'earned':'spent',amount:0,details:[],sort};
   g.sort=Math.max(g.sort,sort);
   if(itemDate)g.date=itemDate;
   if(meta.storyNote)g.description=meta.storyNote;
   if(meta.entryKind==='purchase'&&meta.purchase)g.details.push(`${meta.purchase.name}: ${meta.purchase.from} → ${meta.purchase.to} (${meta.purchase.cost} XP)`);
   if(meta.entryKind==='award'||meta.entryKind==='purchase')g.amount+=amount;
   groups.set(batch,g);
  }else if(amount>0){
   ungrouped.push({date:'Legacy',description:String(item.system?.description||item.name||'XP entry'),type:kind==='wod.types.expgained'?'earned':'spent',amount,details:[],sort});
  }
 }
 return [...groups.values(),...ungrouped].filter(g=>g.amount>0).sort((a,b)=>b.sort-a.sort).map(g=>({
  ...g,sign:g.type==='earned'?'+':'−',kind:g.type==='earned'?'Award':'Purchase',details:g.details.slice(0,10)
 }));
}
export class MageDetails extends HandlebarsApplicationMixin(ApplicationV2){
 static DEFAULT_OPTIONS={id:'wod20-mage-details',classes:['wod20-mage-charamancer','mc-details'],position:{width:760,height:760},window:{title:'Mage Details',resizable:true}};
 static PARTS={main:{template:'modules/wod20-mage-charamancer/templates/details.hbs'}};
 constructor(actor=null,callbacks={},options={}){super(options);this.actor=actor;this.callbacks=callbacks;this.saving=false;}
 async _prepareContext(options){const context=await super._prepareContext(options);if(!isPcMage(this.actor))return {...context,selectMode:true,actors:game.actors.filter(isPcMage).filter(a=>game.user.isGM||a.isOwner).map(a=>({id:a.id,name:a.name}))};
 const a=this.actor,editable=game.user.isGM||a.isOwner,xp=getExperienceSummary(a),flags={...a.flags?.['mage-character-tools'],...a.flags?.['wod20-mage-charamancer']};
 const traits=[];for(const [key,value] of Object.entries(a.system.attributes||{}))if(MAGE_CATALOG.attrNames[key])traits.push({name:MAGE_CATALOG.attrNames[key],value:Number(value.value||0),...traitInfo('attribute',key),speciality:value.speciality||''});
 for(const item of a.items.filter(i=>['Ability','Sphere'].includes(i.type)))traits.push({name:item.name,value:Number(item.system.value||0),...traitInfo(item.type==='Ability'?'ability':'sphere',item.system.id,item.system.description,item.name),speciality:item.system.speciality||''});
 const backgrounds=a.items.filter(i=>i.type==='Feature'&&i.system.type==='wod.types.background').map(i=>{const def=MAGE_CATALOG.backgrounds.find(b=>b.name.toLowerCase()===i.name.toLowerCase());return {name:i.name,value:Number(i.system.level||0),...traitInfo('background',def?.id,i.system.description)};});
 const seen=new Set(),meritsFlaws=[];for(const m of [...(flags.meritsFlaws||[]),...a.items.map(i=>i.flags?.['wod20-mage-charamancer']?.meritFlaw||i.flags?.['mage-character-tools']?.meritFlaw).filter(Boolean)]){const key=m.id||m.kind+':'+m.name;if(seen.has(key))continue;seen.add(key);meritsFlaws.push({...m,kindLabel:m.kind==='merit'?'Merit cost':'Flaw bonus value',info:m.description+'\n'+(m.kind==='merit'?'Cost: ':'Bonus value: ')+m.points+' FP. DM approval required.'});}
 const specialties=[...Object.entries(a.system.attributes||{}).filter(([,v])=>Number(v.value)>=4).map(([key,v])=>({kind:'attribute',key,name:MAGE_CATALOG.attrNames[key]||key,value:v.speciality||'',suggestions:SPECIALTY_SUGGESTIONS[key]||[],listId:'mc-specialty-'+key})),...a.items.filter(i=>i.type==='Ability'&&Number(i.system.value)>=4).map(i=>({kind:'ability',key:i.system.id,itemId:i.id,name:i.name,value:i.system.speciality||'',suggestions:SPECIALTY_SUGGESTIONS[traitInfo("ability",i.system.id,"",i.name).catalogId]||[],listId:'mc-specialty-'+i.id}))];
 return {...context,selectMode:false,actorName:a.name,editable,narrative:flags.narrative||{},identity:flags.identity||{},xp:{...xp,unspent:xp.availableRaw},xpHistory:xpHistory(a),hasXpHistory:xpHistory(a).length>0,invalidLedger:xp.availableRaw<0,player:flags.identity?.player||a.system.bio?.player||'',chronicle:flags.identity?.chronicle||a.system.bio?.chronicle||'',traits,backgrounds,meritsFlaws,specialties,missing:requiredSpecialties(a).map(x=>x.name).join(', '),hasNonCore:traits.some(x=>x.nonCore),hasSpecialties:specialties.length>0};}
 _onRender(context,options){super._onRender(context,options);const root=this.element;if(!root)return;
 root.querySelector('[data-details-load]')?.addEventListener('click',()=>{this.actor=game.actors.get(root.querySelector('[data-details-actor]').value);this.render();});
 root.querySelector('[data-details-spend]')?.addEventListener('click',()=>this.callbacks.spend?.(this.actor));root.querySelector('[data-details-add]')?.addEventListener('click',()=>this.callbacks.add?.(this.actor));
 root.querySelector('[data-save-specialties]')?.addEventListener('click',async()=>{if(this.saving)return;this.saving=true;try{const entries=[...root.querySelectorAll('[data-specialty-kind]')].map(e=>({kind:e.dataset.specialtyKind,key:e.dataset.key,itemId:e.dataset.itemId,name:e.dataset.name,value:e.value}));await saveMageSpecialties(this.actor,entries);ui.notifications.info('Specialties saved; XP unchanged.');await this.render();}catch(error){ui.notifications.error(error.message);}finally{this.saving=false;}});
 }
}
