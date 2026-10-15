import {xpRangeCost} from './xp-rules.js';
import {traitInfo} from './catalog.js';
const MODULE_ID = "wod20-mage-charamancer";

function itemBySystemId(actor, type, id) {
    return actor.items.find(item => item.type === type && item.system?.id === id) ?? null;
}

function experienceItems(actor, type) {
    return actor.items.filter(item =>
        item.type === "Experience" && item.system?.type === type
    );
}

function sumExperience(items) {
    return items.reduce((total,item)=>{const amount=Number(item.system?.amount??0);if(!Number.isSafeInteger(amount)||amount<0)throw new Error('Invalid XP amount on '+item.name+'. Use nonnegative whole numbers.');return total+amount;},0);
}

export function getExperienceSummary(actor) {
    const gainedItems = experienceItems(actor, "wod.types.expgained");
    const spentItems = experienceItems(actor, "wod.types.expspent");

    // WoD20 exposes an "is spent" checkbox on spent-XP records. Respect it:
    // a spent record explicitly unchecked is not deducted until it is marked spent.
    const countedSpentItems = spentItems.filter(item => item.system?.isspent !== false);

    const earned = sumExperience(gainedItems);
    const spent = sumExperience(countedSpentItems);
    const availableRaw = earned - spent;

    return {
        earned,
        spent,
        available: availableRaw,
        availableRaw,
        gainedItems: gainedItems.length,
        spentItems: spentItems.length,
        uncommittedSpentItems: spentItems.length - countedSpentItems.length
    };
}

export function isPcMage(actor) {
    if (!actor || actor.type !== "PC") return false;
    const settings = actor.system?.settings ?? {};
    return [settings.splat, settings.game, settings.variantsheet]
        .some(value => String(value ?? "").toLowerCase() === "mage");
}

function normalize(value) {
    return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function detectAffinitySphere(actor, sphereItems) {
    const flagged = String(actor.getFlag?.(MODULE_ID, "affinitySphere") ?? "").trim();
    if (flagged && sphereItems.some(sphere => sphere.id === flagged)) return flagged;

    const fields = actor.system?.bio?.splatfields ?? {};
    let stored = "";

    for (const [key, field] of Object.entries(fields)) {
        const keyNorm = normalize(key);
        const labelNorm = normalize(field?.label);
        if (keyNorm.includes("affinitysphere") || keyNorm === "affinity" ||
            labelNorm.includes("affinitysphere") || labelNorm === "affinity") {
            stored = String(field?.value ?? "").trim();
            if (stored) break;
        }
    }

    if (!stored) return "";
    const needle = normalize(stored);
    const match = sphereItems.find(sphere =>
        normalize(sphere.id) === needle || normalize(sphere.name) === needle
    );

    return match?.id ?? "";
}

export function makeAdvancementSnapshot(actor) {
    if (!isPcMage(actor)) throw new Error(`${actor?.name ?? "Actor"} is not a current WoD20 PC Mage.`);

    const attributes = {};
    for (const [id, data] of Object.entries(actor.system?.attributes ?? {})) {
        if (data?.isvisible === false) continue;
        const type = String(data?.type ?? "").toLowerCase();
        if (!["physical", "social", "mental"].includes(type)) continue;
        attributes[id] = {
            id,
            name: game.i18n.localize(data?.label ?? id) || id,
            category: type,
            value: Number(data?.value ?? 0),
            max: Number(data?.max ?? actor.system?.settings?.attributes?.defaultmaxvalue ?? 5),
            speciality: String(data?.speciality ?? "")
        };
    }

    const abilities = {};
    for (const item of actor.items.filter(item => item.type === "Ability")) {
        const id = item.system?.id;
        if (!id) continue;
        const type = String(item.system?.type ?? "").toLowerCase();
        const category = type.includes("talent") ? "talent" :
            type.includes("skill") ? "skill" :
                type.includes("knowledge") ? "knowledge" : "other";
        abilities[id] = {
            id,
            itemId: item.id,
            name: item.name,
            category,
            value: Number(item.system?.value ?? 0),
            max: Number(item.system?.max ?? 5),
            ...traitInfo("ability",id,item.system?.description,item.name),
            speciality: String(item.system?.speciality ?? "")
        };
    }

    const spheres = {};
    const sphereList = [];
    for (const item of actor.items.filter(item => item.type === "Sphere")) {
        const id = item.system?.id;
        if (!id) continue;
        const entry = {
            id,
            itemId: item.id,
            name: item.name,
            value: Number(item.system?.value ?? 0),
            max: Number(item.system?.max ?? 5)
        };
        spheres[id] = entry;
        sphereList.push(entry);
    }

    const arete = itemBySystemId(actor, "Advantage", "arete");
    const willpower = itemBySystemId(actor, "Advantage", "willpower");
    if (!arete) throw new Error("This Mage does not have an Arete Advantage item.");
    if (!willpower) throw new Error("This Mage does not have a Willpower Advantage item.");

    const xp = getExperienceSummary(actor);

    return {
        actorId: actor.id,
        actorName: actor.name,
        actorModifiedTime: Number(actor._stats?.modifiedTime ?? 0),
        attributes,
        abilities,
        spheres,
        core: {
            arete: {
                itemId: arete.id,
                value: Number(arete.system?.permanent ?? arete.system?.roll ?? 0),
                max: Number(arete.system?.max ?? 10)
            },
            willpower: {
                itemId: willpower.id,
                value: Number(willpower.system?.permanent ?? willpower.system?.roll ?? 0),
                temporary: Number(willpower.system?.temporary ?? 0),
                max: Number(willpower.system?.max ?? 10)
            }
        },
        affinitySphereId: detectAffinitySphere(actor, sphereList),
        xp
    };
}

function compareSnapshotToActor(snapshot, actor) {
    const problems = [];

    for (const trait of Object.values(snapshot.attributes)) {
        const live = Number(actor.system?.attributes?.[trait.id]?.value ?? -999);
        if(String(actor.system?.attributes?.[trait.id]?.speciality||"")!==trait.speciality)problems.push(trait.name+" specialty changed");
        if (live !== trait.value) problems.push(`${trait.name} changed from ${trait.value} to ${live}`);
    }

    for (const trait of Object.values(snapshot.abilities)) {
        const item = actor.items.get(trait.itemId);
        const live = Number(item?.system?.value ?? -999);
        if(String(item?.system?.speciality||"")!==trait.speciality)problems.push(trait.name+" specialty changed");
        if (live !== trait.value) problems.push(`${trait.name} changed from ${trait.value} to ${live}`);
    }

    for (const trait of Object.values(snapshot.spheres)) {
        const item = actor.items.get(trait.itemId);
        const live = Number(item?.system?.value ?? -999);
        if (live !== trait.value) problems.push(`${trait.name} changed from ${trait.value} to ${live}`);
    }

    const liveArete = Number(actor.items.get(snapshot.core.arete.itemId)?.system?.permanent ?? -999);
    const liveWillpower = Number(actor.items.get(snapshot.core.willpower.itemId)?.system?.permanent ?? -999);
    if (liveArete !== snapshot.core.arete.value) problems.push(`Arete changed from ${snapshot.core.arete.value} to ${liveArete}`);
    if (liveWillpower !== snapshot.core.willpower.value) problems.push(`Willpower changed from ${snapshot.core.willpower.value} to ${liveWillpower}`);

    const liveXp = getExperienceSummary(actor);
    if (liveXp.earned !== snapshot.xp.earned || liveXp.spent !== snapshot.xp.spent) {
        problems.push(`XP ledger changed (was ${snapshot.xp.available} available, now ${liveXp.available})`);
    }

    return problems;
}

export function validateAdvancementPlan(actor,snapshot,plan){
 if(!isPcMage(actor)||(!game.user.isGM&&!actor.isOwner))throw new Error('You do not have permission to spend XP on this PC Mage.');
 if(!Array.isArray(plan.purchases)||!plan.purchases.length)throw new Error('No XP purchases selected.');
 if(snapshot.affinitySphereId&&plan.affinitySphereId!==snapshot.affinitySphereId)throw new Error('Affinity Sphere must match the actor. Correct it in the web character before importing.');
 const seen=new Set(),ratings={attributes:Object.fromEntries(Object.values(snapshot.attributes).map(t=>[t.id,t.value])),abilities:Object.fromEntries(Object.values(snapshot.abilities).map(t=>[t.id,t.value])),spheres:Object.fromEntries(Object.values(snapshot.spheres).map(t=>[t.id,t.value]))};let arete=snapshot.core.arete.value,total=0;
 for(const p of plan.purchases){const group=p.kind==='attribute'?snapshot.attributes:p.kind==='ability'?snapshot.abilities:p.kind==='sphere'?snapshot.spheres:['arete','willpower'].includes(p.kind)?snapshot.core:null;const source=group?.[p.key];const id=p.kind+':'+p.key;if(!source||seen.has(id))throw new Error('Invalid or duplicate XP purchase: '+id);seen.add(id);
  if(p.from!==source.value||!Number.isInteger(p.to)||p.to<=source.value||p.to>source.max)throw new Error('Invalid target rating for '+p.name+'.');
  const cost=xpRangeCost(p.kind,p.from,p.to,{affinity:p.kind==='sphere'&&plan.affinitySphereId===p.key});if(p.cost!==cost)throw new Error('XP cost does not match the rating change for '+p.name+'.');total+=cost;
  if(p.kind==='arete')arete=p.to;else{const groupKey={attribute:'attributes',ability:'abilities',sphere:'spheres'}[p.kind];if(groupKey)ratings[groupKey][p.key]=p.to;}
 }
 if(total!==plan.totalCost)throw new Error('XP total does not match the selected purchases.');if(Math.max(0,...Object.values(ratings.spheres))>arete)throw new Error('Spheres cannot exceed Arete.');
 for(const [group,traits] of [['attributes',snapshot.attributes],['abilities',snapshot.abilities]])for(const t of Object.values(traits))if(ratings[group][t.id]>=4&&!String(plan.specialties?.[group]?.[t.id]??t.speciality??'').trim())throw new Error('Choose a specialty before spending XP: '+t.name+'.');
 return total;
}

export async function applyMageAdvancement(actor, snapshot, plan) {
    if (!actor || actor.id !== snapshot.actorId) throw new Error("The selected Mage is no longer available.");

    validateAdvancementPlan(actor,snapshot,plan);
    const changed = compareSnapshotToActor(snapshot, actor);
    if (changed.length) {
        throw new Error(`The Mage changed while advancement was open: ${changed.slice(0, 3).join("; ")}. Close and reload advancement before spending XP.`);
    }

    const currentXp = getExperienceSummary(actor);
    if (plan.totalCost > currentXp.available) {
        throw new Error(`This advancement costs ${plan.totalCost} XP, but ${currentXp.available} XP are currently available.`);
    }
    if (plan.totalCost <= 0) throw new Error("No XP purchases are selected.");

    const actorUpdates = {};
    const itemUpdates = [];
    const createdExperienceItems = [];

    // Build rollback values before changing anything.
    const rollbackActor = {};
    const rollbackItems = [];

    for (const purchase of plan.purchases) {
        if (purchase.kind === "attribute") {
            const source = snapshot.attributes[purchase.key];
            if (!source) continue;
            actorUpdates[`system.attributes.${purchase.key}.value`] = purchase.to;
            rollbackActor[`system.attributes.${purchase.key}.value`] = source.value;
        }
        else if (purchase.kind === "ability") {
            const source = snapshot.abilities[purchase.key];
            if (!source) continue;
            itemUpdates.push({ _id: source.itemId, "system.value": purchase.to });
            rollbackItems.push({ _id: source.itemId, "system.value": source.value, "system.speciality": source.speciality });
        }
        else if (purchase.kind === "sphere") {
            const source = snapshot.spheres[purchase.key];
            if (!source) continue;
            itemUpdates.push({ _id: source.itemId, "system.value": purchase.to });
            rollbackItems.push({ _id: source.itemId, "system.value": source.value });
        }
        else if (purchase.kind === "arete") {
            itemUpdates.push({
                _id: snapshot.core.arete.itemId,
                "system.permanent": purchase.to,
                "system.roll": purchase.to
            });
            rollbackItems.push({
                _id: snapshot.core.arete.itemId,
                "system.permanent": snapshot.core.arete.value,
                "system.roll": snapshot.core.arete.value
            });
        }
        else if (purchase.kind === "willpower") {
            const oldPermanent = snapshot.core.willpower.value;
            const oldTemporary = snapshot.core.willpower.temporary;
            const wasFull = oldTemporary >= oldPermanent;
            itemUpdates.push({
                _id: snapshot.core.willpower.itemId,
                "system.permanent": purchase.to,
                "system.roll": purchase.to,
                "system.temporary": wasFull ? purchase.to : oldTemporary
            });
            rollbackItems.push({
                _id: snapshot.core.willpower.itemId,
                "system.permanent": oldPermanent,
                "system.roll": oldPermanent,
                "system.temporary": oldTemporary
            });
        }
    }

    // Optional/new specialties selected during advancement.
    for (const [key, speciality] of Object.entries(plan.specialties?.attributes ?? {})) {
        if (!snapshot.attributes[key]) continue;
        const value = String(speciality ?? "").trim();
        if (!value || value === snapshot.attributes[key].speciality) continue;
        actorUpdates[`system.attributes.${key}.speciality`] = value;
        rollbackActor[`system.attributes.${key}.speciality`] = snapshot.attributes[key].speciality;
    }

    for (const [key, speciality] of Object.entries(plan.specialties?.abilities ?? {})) {
        const source = snapshot.abilities[key];
        if (!source) continue;
        const value = String(speciality ?? "").trim();
        if (!value || value === source.speciality) continue;
        const existing = itemUpdates.find(update => update._id === source.itemId);
        if (existing) existing["system.speciality"] = value;
        else itemUpdates.push({ _id: source.itemId, "system.speciality": value });
        if (!rollbackItems.some(update => update._id === source.itemId)) {
            rollbackItems.push({ _id: source.itemId, "system.value": source.value, "system.speciality": source.speciality });
        }
    }

    try {
        if (Object.keys(actorUpdates).length) await actor.update(actorUpdates);
        if (itemUpdates.length) await actor.updateEmbeddedDocuments("Item", itemUpdates);

        const advancementDate = String(plan.advancementDate ?? "").trim();
        const storyNote = String(plan.storyNote ?? "").trim().slice(0, 30);
        const batchId = foundry.utils.randomID();
        const purchaseData = plan.purchases.map(({ kind, key, name, from, to, cost }) => ({ kind, key, name, from, to, cost }));

        const makeExperienceData = ({ description, amount, entryKind, purchase = null }) => ({
            name: entryKind === "date"
                ? `XP Advancement — ${description}`
                : entryKind === "story"
                    ? `XP Advancement — Story`
                    : `XP Spent — ${purchase?.name ?? "Advancement"}`,
            type: "Experience",
            system: {
                type: "wod.types.expspent",
                amount,
                isspent: true,
                description,
                settings: {
                    iscreated: true,
                    isupdated: false,
                    isactive: false,
                    isvisible: true,
                    isremovable: true,
                    version: game.system.version
                }
            },
            flags: {
                [MODULE_ID]: {
                    advancement: true,
                    advancementBatchId: batchId,
                    entryKind,
                    advancementDate,
                    storyNote,
                    purchase,
                    purchases: purchaseData
                }
            }
        });

        // WoD20 shows the most recently created Experience row at the top.
        // Create purchase rows in reverse display order, then the optional story,
        // and finally the date so the ledger renders as:
        // date -> story -> purchase 1 -> purchase 2 ...
        for (const purchase of [...plan.purchases].reverse()) {
            const [created] = await actor.createEmbeddedDocuments("Item", [makeExperienceData({
                description: `\u2014\u2014 ${purchase.name} ${purchase.from} → ${purchase.to}`,
                amount: purchase.cost,
                entryKind: "purchase",
                purchase: {
                    kind: purchase.kind,
                    key: purchase.key,
                    name: purchase.name,
                    from: purchase.from,
                    to: purchase.to,
                    cost: purchase.cost
                }
            })]);
            if (created) createdExperienceItems.push(created);
        }

        if (storyNote) {
            const [created] = await actor.createEmbeddedDocuments("Item", [makeExperienceData({
                description: storyNote,
                amount: 0,
                entryKind: "story"
            })]);
            if (created) createdExperienceItems.push(created);
        }

        if (advancementDate) {
            const [created] = await actor.createEmbeddedDocuments("Item", [makeExperienceData({
                description: advancementDate,
                amount: 0,
                entryKind: "date"
            })]);
            if (created) createdExperienceItems.push(created);
        }

        if (plan.affinitySphereId) {
            await actor.setFlag(MODULE_ID, "affinitySphere", plan.affinitySphereId);
        }

        return {
            experienceItems: createdExperienceItems,
            advancementDate,
            storyNote,
            remainingXp: currentXp.available - plan.totalCost
        };
    }
    catch (error) {
        console.error(`${MODULE_ID} | Advancement failed; attempting rollback`, error);

        try {
            if (createdExperienceItems.length) {
                await actor.deleteEmbeddedDocuments("Item", createdExperienceItems.map(item => item.id));
            }
            if (Object.keys(rollbackActor).length) await actor.update(rollbackActor);
            if (rollbackItems.length) await actor.updateEmbeddedDocuments("Item", rollbackItems);
        }
        catch (rollbackError) {
            console.error(`${MODULE_ID} | Advancement rollback also failed`, rollbackError);
            throw new Error(`${error.message} Rollback also failed; review ${actor.name} manually and check the console.`);
        }

        throw error;
    }
}
