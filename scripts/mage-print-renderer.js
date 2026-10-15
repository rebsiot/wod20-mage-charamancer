// M20 vector sheet renderer reused from browser charamancer 0.1.24.
// Filled squares, health marks and XP figures are visible in print/PDF without AcroForm.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gold='#a49b46';
const text=(x,y,value,size=11,bold=false,anchor='start',width=null)=>`<text x="${x}" y="${y}" font-family="Times New Roman,Times,serif" font-size="${size}" font-weight="${bold?'bold':'normal'}" text-anchor="${anchor}" ${width?`textLength="${width}" lengthAdjust="spacingAndGlyphs"`:""} fill="#111">${esc(value)}</text>`;
const line=(x1,y1,x2,y2,color='#111',width=.6)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
const box=(x,y,w,h,fill='none',stroke='#111',width=.7)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
function fit(value,chars){const s=String(value||'');return s.length>chars?s.slice(0,chars-3)+'...':s;}
function circles(x,y,rating,max=5,r=3.1,gap=9.5){let h='';for(let i=0;i<max;i++)h+=`<circle cx="${x+i*gap}" cy="${y}" r="${r}" fill="${i<rating?'#111':'white'}" stroke="#111" stroke-width=".7"/>`;return h;}
function squares(x,y,value,max=10,size=6,gap=10,marks=[]){let h='';for(let i=0;i<max;i++)h+=box(x+i*gap,y,size,size,(marks[i]??(i<value))?'#111':'white').replace('<rect ',`<rect data-check="willpower_${i+1}" data-checked="${!!(marks[i]??(i<value))}" `);return h;}
function heading(label,y){return line(42,y-5,570,y-5,gold,2)+box(230,y-17,152,22,'white','none')+text(306,y,label,20,true,'middle');}
function row(name,rating,x,y,specialty=''){
 const h=specialty?text(x,y,name,10,true,'start',Math.min(60,name.length*5))+text(x+64,y,'('+specialty+')',7,false,'start',43):text(x,y,name,name.length>23?8.5:10.5,true,'start',name.length>19?105:null);
 return h+line(x+110,y-2,x+122,y-2)+circles(x+128,y-3,rating);
}
function border(){return box(18,18,576,754,'none',gold,2)+box(25,25,562,740,'none',gold,.8)+line(18,48,48,18,gold,2)+line(18,63,63,18,gold,.8)+line(549,772,594,727,gold,2)+line(534,772,594,712,gold,.8);}
function svg(content,page,total){return `<svg xmlns="http://www.w3.org/2000/svg" width="612" height="792" viewBox="0 0 612 792" role="img" aria-label="Mage character sheet page ${page}">${box(0,0,612,792,'white','none')}${border()}${content}${text(306,784,`Unofficial fan character sheet · ${page} / ${total}`,8,false,'middle')}</svg>`;}
function wheel(q,p){
 let h='';const cx=306,cy=719,r=39,size=7;
 for(const [name,start,value] of [['quintessence',-171,q],['paradox',9,p]])for(let i=0;i<10;i++){
 const angle=(start+i*18)*Math.PI/180,x=cx+Math.cos(angle)*r-size/2,y=cy+Math.sin(angle)*r-size/2;
 h+=`<circle data-round="true" data-mark="${name==='paradox'?'x':'check'}" data-check="${name}_${i+1}" data-checked="${i<value}" cx="${x+size/2}" cy="${y+size/2}" r="${size/2}" fill="${i<value?'#111':'white'}" stroke="#111" stroke-width=".7"/>`;
 }
 return h+text(cx,708,'Quintessence',7,true,'middle')+text(cx,720,q,9,true,'middle')+line(cx-25,cy+4,cx+25,cy+4,'#777',.4)+text(cx,736,'Paradox '+p,8,true,'middle');
}
function wrap(value,chars=85){
 const lines=[];for(const para of String(value??'').split(/\r?\n/)){let current='';for(let word of para.split(/\s+/).filter(Boolean)){while(word.length>chars){if(current){lines.push(current);current='';}lines.push(word.slice(0,chars));word=word.slice(chars);}if(current.length+word.length+1>chars){lines.push(current);current=word;}else current+=(current?' ':'')+word;}lines.push(current);}return lines;
}
export function renderM20Pages(c,D){
 const allBG=[...D.backgrounds,...(c.customBackgrounds||[])],bgs=allBG.filter(b=>Number(c.backgrounds[b.id]||0)>0);
 const extra=D.abilities.filter(a=>a.nonCore&&Number(c.abilities[a.id]||0)>0),specialties=[];
 for(const [k,v] of Object.entries(c.specialities?.attributes||{}))if(v&&c.attributes[k]>=4)specialties.push(`${D.attrNames[k]||k}: ${v}`);
 for(const [k,v] of Object.entries(c.specialities?.abilities||{}))if(v&&c.abilities[k]>=4)specialties.push(`${D.abilities.find(a=>a.id===k)?.name||k}: ${v}`);
 const xp=(c.xpLedger||[]).reduce((a,e)=>{a[e.type==='gained'?'earned':'spent']+=Number(e.amount||0);return a;},{earned:0,spent:0});
 let first=text(306,67,'MAGE',40,true,'middle')+text(306,84,'THE ASCENSION · CHARACTER SHEET',10,false,'middle');
 const identities=[['Name',c.name],['Player',c.player],['Chronicle',c.chronicle],['Nature',c.nature],['Demeanor',c.demeanor],['Essence',c.essence],['Affiliation',c.affiliation],['Faction',c.sect],['Concept',c.concept]];
 identities.forEach(([k,v],i)=>{const x=42+Math.floor(i/3)*176,y=110+(i%3)*17;first+=text(x,y,k+':',9.5,true)+text(x+67,y,fit(v,24),9.5,false,'start',String(v||'').length>18?96:null);if(!v)first+=line(x+67,y+1,x+163,y+1,'#777',.4);});
 first+=heading('Attributes',169);
 Object.entries(D.attrGroups).forEach(([g,keys],col)=>{const x=42+col*176;first+=text(x+81,190,g[0].toUpperCase()+g.slice(1),15,false,'middle');keys.forEach((k,i)=>{first+=row(D.attrNames[k],c.attributes[k],x,210+i*16,c.attributes[k]>=4?c.specialities?.attributes?.[k]:'');});});
 first+=heading('Abilities',266);
 const overflowAbilities=[];
 ['talent','skill','knowledge'].forEach((cat,col)=>{const x=42+col*176;first+=text(x+81,286,{talent:'Talents',skill:'Skills',knowledge:'Knowledges'}[cat],15,false,'middle');const list=[...D.abilities.filter(a=>!a.nonCore&&a.category===cat).sort((a,b)=>a.name.localeCompare(b.name)),...extra.filter(a=>a.category===cat)];list.slice(0,12).forEach((a,i)=>{first+=row((a.nonCore?'** ':'')+a.name,c.abilities[a.id]||0,x,304+i*13,c.abilities[a.id]>=4?c.specialities?.abilities?.[a.id]:'');});if(list.length<12)first+=row('',0,x,447);overflowAbilities.push(...list.slice(12));});
 first+=heading('Spheres',492);
 const sphereCols=[['correspondence','entropy','forces'],['life','matter','mind'],['prime','spirit','time']];
 sphereCols.forEach((keys,col)=>keys.forEach((id,i)=>{const d=D.spheres.find(a=>a.id===id);first+=row(d.name+(c.affinity===id?' *':''),c.spheres[id]||0,42+col*176,515+i*16);}));
 first+=heading('Advantages',569)+text(124,590,'Backgrounds',15,false,'middle');
 for(let i=0;i<Math.min(7,bgs.length)+1;i++){const b=i<Math.min(7,bgs.length)?bgs[i]:null;first+=row(b?.name||'',b?c.backgrounds[b.id]:0,42,609+i*15);}
 if(extra.length)first+=text(42,747,'** Non-core: explicit DM approval required.',8);
 first+=text(306,591,'Arete',15,false,'middle')+circles(263,607,c.core.arete,10,3,9.5)+text(306,627,'Willpower',15,false,'middle')+circles(263,642,c.core.willpower,10,3,9.5)+squares(260,651,0,10,6,9.5,c.sessionTrackers?.willpower)+text(306,675,'Quintessence / Paradox',12,true,'middle')+wheel(Number(c.core.quintessence||0),Number(c.core.paradox||0));
 first+=text(475,590,'Health',15,false,'middle');
 const health=[['Bruised',''],['Hurt','-1'],['Injured','-1'],['Wounded','-2'],['Mauled','-2'],['Crippled','-5'],['Incapacitated','']];
 health.forEach(([n,pen],i)=>{const y=611+i*14;first+=text(409,y,n,10.5,true)+text(526,y,pen,10)+box(552,y-10,12,12,'white').replace('<rect ',`<rect data-health="health_${i+1}" data-value="${['/','X'].includes(c.sessionTrackers?.health?.[i])?c.sessionTrackers.health[i]:''}" `)+text(558,y-1,['/','X'].includes(c.sessionTrackers?.health?.[i])?c.sessionTrackers.health[i]:'',10,true,'middle');});
 first+=text(481,726,'Experience',15,false,'middle')+box(409,736,153,27,'white');
 [['available',xp.earned-xp.spent],['spent',xp.spent],['earned',xp.earned]].forEach(([key,value],i)=>{const x=414+i*49;first+=text(x,746,{available:'Unspent',spent:'Spent',earned:'Total Earned'}[key],7)+`<rect x="${x}" y="749" width="43" height="12" fill="white" stroke="none" data-field="xp_${key}" data-value="${value}"/>`+text(x+21,759,value,10,true,'middle');});
 first+=text(481,773,'Unspent + Spent = Total Earned',7,false,'middle');
 // Compact the middle of the sheet while preserving the lower section geometry.
 first=first.replace(/\b(y|cy|y1|y2)="([\d.]+)"/g,(match,key,value)=>Number(value)>=470?key+'="'+(Number(value)-20)+'"':match);
 const blocks=[];
 function block(title,value){if(value!==undefined&&String(value).trim())blocks.push({title:fit(title,72),lines:(title.length>72?wrap(title).concat(wrap(value)):wrap(value))});}
 block('Identity (full values)',identities.filter(([,v])=>String(v||'').length>24).map(([k,v])=>`${k}: ${v}`).join('\n'));
 if(overflowAbilities.length)block('Additional Abilities',overflowAbilities.map(a=>`${a.nonCore?'** ':''}${a.name}: ${c.abilities[a.id]}/5${c.specialities?.abilities?.[a.id]?' ('+c.specialities.abilities[a.id]+')':''}`).join('\n'));
 if(bgs.length>7)block('Additional Backgrounds',bgs.slice(7).map(b=>`${b.name}: ${c.backgrounds[b.id]}/5`).join('\n'));
 const coreSphereIds=new Set(['correspondence','entropy','forces','life','matter','mind','prime','spirit','time']);
 const extraSpheres=D.spheres.filter(s=>!coreSphereIds.has(s.id)&&Number(c.spheres[s.id]||0)>0);
 if(extraSpheres.length)block('Additional Spheres',extraSpheres.map(s=>`${s.name}: ${c.spheres[s.id]}`).join('\n'));
 const elder=[];
 for(const [id,v] of Object.entries(c.attributes))if(v>5)elder.push(`${D.attrNames[id]||id}: ${v}`);
 for(const ability of D.abilities)if(Number(c.abilities[ability.id]||0)>5)elder.push(`${ability.name}: ${c.abilities[ability.id]}`);
 for(const sphere of D.spheres)if(Number(c.spheres[sphere.id]||0)>5)elder.push(`${sphere.name}: ${c.spheres[sphere.id]}`);
 if(elder.length)block('Ratings over five dots (full values)',elder.join('\n'));
 
 for(const m of c.meritsFlaws||[])block(`${m.kind==='merit'?'Merit':'Flaw'}: ${m.name} (${m.kind==='merit'?'cost':'bonus value'} ${m.points} FP)`,m.description+(m.reference?'\nReference: '+m.reference:''));
 block('Appearance description',c.appearanceDescription);block('Biography',c.biography);block('RP tips / direction',c.rpTips);
 block('Paradigm',c.paradigm);block('Practice',c.practice);block('Instruments',c.instruments);
 if(c.foundrySource?.system?.health?.damage)block('Imported health snapshot',`Bashing: ${c.foundrySource.system.health.damage.bashing||0}; lethal: ${c.foundrySource.system.health.damage.lethal||0}; aggravated: ${c.foundrySource.system.health.damage.aggravated||0}`);
 if((c.xpLedger||[]).length)block('Experience Ledger',c.xpLedger.map(e=>`${e.date||''}: ${e.type==='gained'?'+':'-'}${e.amount} XP${e.story?' — '+e.story:''}${(e.lines||[]).map(l=>'\n  '+l.description+' ('+l.cost+' XP)').join('')}`).join('\n'));
 const pages=[first];let content='',y=122;
 function finish(){pages.push(text(306,62,'MAGE',32,true,'middle')+text(306,86,`${fit(c.name||'Character',60)} · CONTINUATION`,12,false,'middle')+content);content='';y=122;}
 for(const b of blocks){if(y+44>748)finish();content+=text(42,y,b.title,13,true)+line(42,y+5,570,y+5,gold,1);y+=25;for(const l of b.lines){if(y>748){finish();content+=text(42,y,b.title+' (continued)',13,true);y+=24;}content+=text(42,y,l,11);y+=14;}y+=15;}
 if(content)finish();
 return pages.map((p,i)=>`<div class="mage-print-page">${svg(p,i+1,pages.length)}</div>`).join('');
};
