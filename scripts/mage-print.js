import { MAGE_CATALOG, abilityDefinition } from './catalog.js';
import { isPcMage, getExperienceSummary, detectAffinitySphere } from './advancement-builder.js';
import { renderM20Pages } from './mage-print-renderer.js';

const MODULE_ID = 'wod20-mage-charamancer';
const normal = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const text = value => String(value ?? '').trim();
const cleanRating = (value, max = 10) => Math.max(0, Math.min(max, Math.trunc(number(value))));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function bioField(actor, ...aliases) {
    const all = actor.system?.bio?.splatfields ?? {};
    const keys = aliases.map(normal);
    for (const [key, field] of Object.entries(all)) {
        if (keys.includes(normal(key)) || keys.includes(normal(field?.label))) {
            const value = text(field?.value ?? (typeof field === 'string' ? field : ''));
            if (value) return value;
        }
    }
    return '';
}

function backgroundType(item) {
    return item.type === 'Feature' && String(item.system?.type ?? '').toLowerCase().includes('background');
}

function abilityCategory(item) {
    const type = String(item.system?.type ?? '').toLowerCase();
    if (type.includes('talent')) return 'talent';
    if (type.includes('skill')) return 'skill';
    if (type.includes('knowledge')) return 'knowledge';
    return '';
}

function advantage(actor, id, property = 'permanent') {
    const item = actor.items.find(i => i.type === 'Advantage' && normal(i.system?.id || i.name) === normal(id));
    if (!item) return 0;
    return cleanRating(item.system?.[property] ?? item.system?.permanent ?? item.system?.value ?? item.system?.roll, 20);
}

// A read-only projection. Do not mutate Actor, Item, flags, or XP records while printing.
export function magePrintSnapshot(actor) {
    if (!isPcMage(actor)) throw new Error('Choose a Mage character using the current PC actor sheet.');
    const metadata = {...actor.flags?.['mage-character-tools'], ...actor.flags?.[MODULE_ID]};
    const identity = metadata.identity ?? {};
    const narrative = metadata.narrative ?? {};
    const creation = metadata.creation?.state?.identity ?? {};
    const bio = actor.system?.bio ?? {};

    const catalog = MAGE_CATALOG;
    const D = {
        attrGroups: catalog.attrGroups,
        attrNames: catalog.attrNames,
        abilities: catalog.abilities.map(a => ({id:a.id,name:a.name,category:a.category,nonCore:!!a.nonCore})),
        spheres: catalog.spheres.map(s => ({id:s.id,name:s.name})),
        backgrounds: []
    };
    const c = {
        name: text(actor.name),
        player: text(bio.player || identity.player || creation.player),
        chronicle: text(bio.chronicle || identity.chronicle || creation.chronicle),
        nature: text(bio.nature || creation.nature),
        demeanor: text(bio.demeanor || creation.demeanor),
        concept: text(bio.concept || creation.concept),
        essence: bioField(actor,'essence') || text(creation.essence),
        affiliation: text(identity.affiliation || creation.affiliation),
        sect: bioField(actor,'affiliation','tradition','sect') || text(identity.sect || creation.sect),
        affinity: '',
        attributes: {}, abilities: {}, spheres: {}, backgrounds: {}, customBackgrounds: [],
        specialities: {attributes:{}, abilities:{}},
        core: {
            arete:advantage(actor,'arete'),
            willpower:advantage(actor,'willpower'),
            quintessence:advantage(actor,'quintessence','temporary'),
            paradox:advantage(actor,'paradox','temporary')
        },
        meritsFlaws: [],
        appearanceDescription: text(narrative.appearanceDescription || creation.appearance),
        biography: text(narrative.biography || creation.biography),
        rpTips: text(narrative.rpTips || creation.rpTips),
        paradigm: bioField(actor,'paradigm') || text(creation.paradigm),
        practice: bioField(actor,'practice') || text(creation.practice),
        instruments: bioField(actor,'instruments','instrument') || text(creation.instruments),
        sessionTrackers: {willpower:[],health:[]},
        xpLedger: []
    };
    for (const [id, entry] of Object.entries(actor.system?.attributes ?? {})) {
        c.attributes[id] = cleanRating(entry?.value);
        if (text(entry?.speciality)) c.specialities.attributes[id] = text(entry.speciality);
    }
    for (const id of Object.values(catalog.attrGroups).flat()) c.attributes[id] ??= 0;

    const used = new Set();
    for (const item of actor.items.filter(i=>i.type === 'Ability')) {
        const category = abilityCategory(item);
        if (!category) continue;
        const canonical = abilityDefinition(item.system?.id, item.name);
        // Existing core Abilities always appear, even at zero; unknown/non-core only when rated.
        const key = canonical?.id ?? String(item.system?.id || `custom:${normal(item.name)}`);
        if (used.has(key)) continue;
        used.add(key);
        const rating = cleanRating(item.system?.value);
        const nativeFlag = item.flags?.[MODULE_ID] ?? item.flags?.['mage-character-tools'] ?? {};
        const isExtra = !!nativeFlag.nonCore || !canonical || !!canonical.nonCore || canonical.category !== category;
        if (isExtra) {
            // Do not alter core category or name when an alias maps to a different slot.
            const index = D.abilities.findIndex(a=>a.id===key);
            const entry = {id:key,name:text(item.name)||canonical?.name||key,category,nonCore:true};
            if (index !== -1) D.abilities[index] = entry;
            else D.abilities.push(entry);
        }
        c.abilities[key] = rating;
        if (text(item.system?.speciality)) c.specialities.abilities[key] = text(item.system.speciality);
    }
    for (const item of actor.items.filter(i=>i.type === 'Sphere')) {
        const id = normal(item.system?.id || item.name);
        if (!id) continue;
        c.spheres[id] = cleanRating(item.system?.value);
        if (!D.spheres.some(s=>s.id===id)) D.spheres.push({id,name:item.name});
    }
    for (const s of catalog.spheres) c.spheres[s.id] ??= 0;
    const sphereItems = actor.items.filter(i=>i.type === 'Sphere').map(i=>({id:normal(i.system?.id || i.name),name:i.name}));
    c.affinity = detectAffinitySphere(actor,sphereItems) || normal(bioField(actor,'affinitysphere','affinity'));

    // Avoid merging two different named Backgrounds with the same inferred system key.
    let index = 0;
    for (const item of actor.items.filter(backgroundType)) {
        const rating = cleanRating(item.system?.level ?? item.system?.value);
        if (!rating) continue;
        const key = `sheet-background-${index++}`;
        D.backgrounds.push({id:key,name:item.name});
        c.backgrounds[key] = rating;
    }
    const seen = new Set();
    const meritsFlaws = [...(metadata.meritsFlaws || []),...actor.items.map(i=>i.flags?.[MODULE_ID]?.meritFlaw ?? i.flags?.['mage-character-tools']?.meritFlaw).filter(Boolean)];
    for (const m of meritsFlaws) {
        const identity = text(m.id) || `${text(m.kind)}:${text(m.name)}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        c.meritsFlaws.push({kind:m.kind,name:m.name,points:m.points,description:m.description||'',reference:m.reference||''});
    }
    c.sessionTrackers.willpower = Array.from({length:10},(_,i)=>i < advantage(actor,'willpower','temporary'));
    const damage = actor.system?.health?.damage ?? {};
    const lethal = cleanRating(damage.lethal,7), bashing = cleanRating(damage.bashing,7), aggravated = cleanRating(damage.aggravated,7);
    c.sessionTrackers.health = [...Array(aggravated).fill('X'), ...Array(lethal).fill('X'), ...Array(bashing).fill('/')].slice(0,7);
    if (Object.keys(damage).length) c.foundrySource = {system:{health:{damage}}};

    const xp = getExperienceSummary(actor);
    for (const item of actor.items.filter(i=>i.type === 'Experience')) {
        const type = item.system?.type;
        if (type !== 'wod.types.expgained' && type !== 'wod.types.expspent') continue;
        if (type === 'wod.types.expspent' && item.system?.isspent === false) continue;
        const amount = number(item.system?.amount);
        if (amount <= 0) continue;
        const flags = item.flags?.[MODULE_ID] ?? {};
        c.xpLedger.push({
            type:type === 'wod.types.expgained'?'gained':'spent',
            amount,
            date:text(flags.awardDate || flags.purchaseDate || ''),
            story:text(flags.storyNote || item.system?.description || item.name)
        });
    }
    // Guarantee that printed totals reflect Foundry's authoritative ledger.
    c.xpLedger.push(...(xp.earned !== c.xpLedger.filter(i=>i.type==='gained').reduce((s,i)=>s+i.amount,0)?[{type:'gained',amount:xp.earned-c.xpLedger.filter(i=>i.type==='gained').reduce((s,i)=>s+i.amount,0),story:'XP ledger reconciliation'}]:[]));
    return {character:c,catalog:D,xp};
}

export function magePrintHTML(actor) {
    const {character,catalog} = magePrintSnapshot(actor);
    const pages = renderM20Pages(character,catalog);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(actor.name)} - M20 Sheet</title><style>
@page{size:letter portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#dedbd2;color:#171717}body{font-family:Arial,Helvetica,sans-serif}#mage-print-toolbar{position:sticky;top:0;z-index:3;background:#25212b;color:white;padding:12px 22px;display:flex;align-items:center;justify-content:center;gap:18px}#mage-print-toolbar button{padding:9px 18px;background:#74618a;color:white;border:0;border-radius:5px;font-size:14px;font-weight:700;cursor:pointer}#mage-print-toolbar span{font-size:12px}.mage-print-page{width:8.5in;height:11in;margin:16px auto;background:white;box-shadow:0 4px 22px #0003;overflow:hidden}.mage-print-page svg{display:block;width:8.5in;height:11in}@media print{html,body{background:white!important}#mage-print-toolbar{display:none!important}.mage-print-page{margin:0;box-shadow:none;page-break-after:always;break-after:page}.mage-print-page:last-child{page-break-after:auto;break-after:auto}}\n</style></head><body><div id="mage-print-toolbar"><button type="button" onclick="window.print()">Print (static PDF)</button><button type="button" id="mage-download-fillable" onclick="window.downloadM20Fillable()">Download fillable PDF</button><span>US Letter · Portrait · 100% scale. Uses the actor's current Foundry ratings and XP.</span></div>${pages}</body></html>`;
}

export function printMageSheet(actor) {
    if (!isPcMage(actor)) throw new Error('Choose a current Mage character to print.');
    if (!game.user?.isGM && !actor.isOwner) throw new Error(`You do not have permission to print ${actor.name}.`);
    // Open synchronously from the click callback to avoid popup blocking.
    const win = window.open('', '_blank');
    if (!win) throw new Error('Your browser blocked the printable sheet. Allow popups for Foundry and try again.');
    try {
        const html = magePrintHTML(actor);
        // Generate the PDF from the same live Actor snapshot shown on the print preview.
        // The static print action remains available, but only this download contains AcroForm fields.
        const {character,catalog} = magePrintSnapshot(actor);
        win.downloadM20Fillable = async () => {
            const button = win.document.getElementById('mage-download-fillable');
            try {
                if (!window.PDFLib || !window.MCT_PDF) throw new Error('The bundled fillable PDF engine did not load. Reinstall the full module and refresh Foundry.');
                if(button){button.disabled=true;button.textContent='Building PDF...';}
                window.MCT_PRINT = renderM20Pages;
                const bytes=await window.MCT_PDF(character,catalog);
                const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
                const a=win.document.createElement('a');
                a.href=url;
                a.download=(actor.name||'Mage').replace(/[^a-z0-9._-]+/gi,'-')+'-M20-fillable.pdf';
                win.document.body.appendChild(a);a.click();a.remove();
                setTimeout(()=>URL.revokeObjectURL(url),60000);
            } catch(error) {console.error('M20 Fillable PDF',error);win.alert('Fillable PDF could not be created: '+error.message);}
            finally {if(button){button.disabled=false;button.textContent='Download fillable PDF';}}
        };
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
        return win;
    } catch (error) {
        win.close();
        throw error;
    }
}
