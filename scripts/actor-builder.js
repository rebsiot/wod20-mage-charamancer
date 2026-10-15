import {evaluateFreebies} from './rules.js';
const MODULE_ID = "wod20-mage-charamancer";

function itemBySystemId(actor, type, id) {
    return actor.items.find(item => item.type === type && item.system?.id === id) ?? null;
}

function valuesOf(container) {
    if (!container) return [];
    return Array.isArray(container) ? container : Object.values(container);
}

function splatFieldPath(actor, aliases) {
    const fields = actor.system?.bio?.splatfields ?? {};
    const needles = aliases.map(alias => alias.toLowerCase().replace(/[^a-z0-9]/g, ""));

    for (const [key, field] of Object.entries(fields)) {
        const keyNorm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
        const labelNorm = String(field?.label ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (needles.some(needle => keyNorm.includes(needle) || labelNorm.includes(needle))) {
            return `system.bio.splatfields.${key}.value`;
        }
    }

    return null;
}

function mageSphereTemplate(mageSplat, sphereId) {
    return valuesOf(mageSplat?.system?.powers).find(power =>
        power?.type === "Sphere" && power?.system?.id === sphereId
    ) ?? null;
}

async function findSystemItem(type, systemId) {
    const packs = Array.from(game.packs).filter(pack =>
        pack.documentName === "Item" &&
        (pack.collection?.startsWith("worldofdarkness.") || pack.metadata?.packageName === "worldofdarkness")
    );

    for (const pack of packs) {
        let index;
        try {
            index = await pack.getIndex({ fields: ["type", "system.id"] });
        }
        catch (error) {
            continue;
        }

        const hit = index.find(entry =>
            entry.type === type &&
            foundry.utils.getProperty(entry, "system.id") === systemId
        );

        if (hit) return pack.getDocument(hit._id);
    }

    return null;
}

async function ensureMageSettings(actor, mageSplat) {
    const templateSettings = mageSplat?.system?.settings ?? {};

    await actor.update({
        "system.settings.splat": "mage",
        "system.settings.game": "mage",
        "system.settings.variant": templateSettings.variant ?? "general",
        "system.settings.variantsheet": "mage",
        "system.settings.era": templateSettings.era ?? "modern",
        "system.settings.usesplatfont": true,
        "system.settings.haswillpower": true,
        "system.settings.hasquintessence": true,
        "system.settings.hasspheres": true,
        "system.settings.iscreated": true,
        "system.settings.isupdated": false,
        "system.settings.attributes.defaultmaxvalue": templateSettings.attributes?.defaultmaxvalue ?? 5,
        "system.settings.abilities.defaultmaxvalue": templateSettings.abilities?.defaultmaxvalue ?? 5,
        "system.settings.powers.defaultmaxvalue": templateSettings.powers?.defaultmaxvalue ?? 5
    });
}

async function ensureMageSpheres(actor, data, DropHelper) {
    const created = [];

    for (const sphere of data.spheres) {
        if (itemBySystemId(actor, "Sphere", sphere.id)) continue;

        let createData = null;
        const template = mageSphereTemplate(data.mageSplat, sphere.id);

        if (template) {
            try {
                const imported = await DropHelper.ImportPower(actor, template);
                if (imported && imported !== false) createData = foundry.utils.duplicate(imported);
            }
            catch (error) {
                console.warn(
                    `wod20-mage-charamancer | Could not import Sphere ${sphere.name} from Mage template`,
                    error
                );
            }
        }

        if (!createData) {
            const source = await findSystemItem("Sphere", sphere.id);
            if (source) createData = source.toObject();
        }

        if (!createData) {
            throw new Error(`Could not install Mage Sphere: ${sphere.name}`);
        }

        delete createData._id;
        delete createData.folder;
        createData.system ??= {};
        createData.system.id = sphere.id;
        createData.system.value = 0;
        createData.system.max ??= 5;
        createData.system.settings ??= {};
        createData.system.settings.iscreated = true;
        createData.system.settings.isvisible = true;
        createData.system.settings.isremovable = false;
        createData.system.settings.version = game.system.version;

        const [newItem] = await actor.createEmbeddedDocuments("Item", [createData]);
        if (newItem) created.push(newItem.name);
    }

    if (created.length) {
        console.info("wod20-mage-charamancer | Repaired missing Mage Spheres", created);
    }
}

async function createBackground(actor, option, rating) {
    if (rating <= 0) return;

    if (option.uuid) {
        const source = await fromUuid(option.uuid);
        if (!source) throw new Error(`Could not load Background: ${option.name}`);

        const data = source.toObject();
        delete data._id;
        data.system ??= {};
        data.system.level = rating;
        data.system.value = 0;
        data.system.max ??= 5;
        data.system.type = "wod.types.background";
        if (data.system.settings) data.system.settings.isremovable = true;
        await actor.createEmbeddedDocuments("Item", [data]);
        return;
    }

    await actor.createEmbeddedDocuments("Item", [{
        name: option.name,
        type: "Feature",
        system: {
            type: "wod.types.background",
            level: rating,
            value: 0,
            max: 5,
            placement: "feature",
            iscreated: true, isvisible: true, isremovable: true,
            description: option.description ?? "",
            settings: {
                iscreated: true,
                isupdated: false,
                isactive: false,
                isvisible: true,
                isremovable: true
            }
        }
    }]);
}

function validateMageActor(actor, data) {
    const problems = [];
    const settings = actor.system?.settings ?? {};

    if (actor.type !== "PC") problems.push(`actor type is ${actor.type}, expected PC`);
    if (String(settings.splat ?? "").toLowerCase() !== "mage") problems.push("Mage splat is not active");
    if (String(settings.game ?? "").toLowerCase() !== "mage") problems.push("Mage game setting is not active");
    if (String(settings.variantsheet ?? "").toLowerCase() !== "mage") problems.push("Mage sheet variant is not active");
    if (settings.hasspheres !== true) problems.push("Sphere section is not enabled");

    const missingSpheres = data.spheres
        .filter(sphere => !itemBySystemId(actor, "Sphere", sphere.id))
        .map(sphere => sphere.name);

    if (missingSpheres.length) problems.push(`missing Spheres: ${missingSpheres.join(", ")}`);

    for (const id of ["arete", "willpower", "quintessence", "paradox"]) {
        if (!itemBySystemId(actor, "Advantage", id)) problems.push(`missing ${id} Advantage`);
    }

    if (problems.length) {
        throw new Error(`Mage setup incomplete: ${problems.join("; ")}`);
    }
}

export async function createMageActor(state, data, evaluation) {
    const checked=evaluateFreebies(state,data);
    if(!checked.valid)throw new Error(checked.errors[0]?.message||'Creation budgets are invalid.');
    if(!game.user.isGM&&!game.user.can('ACTOR_CREATE'))throw new Error('Actor creation permission is required.');
    evaluation=checked;
    let actor = null;

    try {
        actor = await Actor.create({
            name: state.identity.name.trim(),
            type: "PC",
            ownership: {default:0,[game.user.id]:3}
        });

        const { default: DropHelper } = await import("/systems/worldofdarkness/module/scripts/drop-helpers.js");

        // Let WoD20 install its own Mage template first. This imports the system's
        // Ability/Advantage/Sphere definitions and Mage-specific biography fields.
        await DropHelper.DropSplatToActor(actor, data.mageSplat);

        // Do not trust a partial template install. Explicitly enforce the current
        // PC Mage sheet flags and repair any Sphere items the upstream helper did
        // not create. These settings drive the Mage icon, Sphere panel and casting UI.
        await ensureMageSettings(actor, data.mageSplat);
        await ensureMageSpheres(actor, data, DropHelper);

        // Core biography.
        const actorUpdates = {
            name: state.identity.name.trim(),
            "system.bio.name": state.identity.name.trim(),
            "system.bio.concept": state.identity.concept ?? "",
            "system.bio.nature": state.identity.nature ?? "",
            "system.bio.demeanor": state.identity.demeanor ?? "",
            "system.bio.player": state.identity.player ?? "",
            "system.bio.chronicle": state.identity.chronicle ?? ""
        };

        // Attributes are direct Actor data in the current PC schema.
        for (const [key, value] of Object.entries(state.attributes)) {
            actorUpdates[`system.attributes.${key}.value`] = Number(value);
            actorUpdates[`system.attributes.${key}.speciality`] = Number(value) >= 4
                ? String(state.specialties?.attributes?.[key] ?? "").trim()
                : "";
        }

        // Mage-specific bio fields supplied by the Splat/Template.
        const specialFields = [
            [["affiliation", "tradition", "sect"], state.identity.sect || state.identity.affiliation],
            [["essence"], state.identity.essence],
            [["affinitysphere", "affinity"], data.spheres.find(s => s.id === state.identity.affinitySphere)?.name ?? state.identity.affinitySphere],
            [["paradigm"], state.identity.paradigm],
            [["practice"], state.identity.practice],
            [["instruments", "instrument"], state.identity.instruments]
        ];

        for (const [aliases, value] of specialFields) {
            if (!value) continue;
            const path = splatFieldPath(actor, aliases);
            if (path) actorUpdates[path] = value;
        }

        await actor.update(actorUpdates);

        // Store the affinity Sphere in a module flag as well as the Mage bio field.
        // This gives XP advancement a stable identifier while remaining compatible
        // with WoD20's human-readable splat field.
        if (state.identity.affinitySphere) {
            await actor.setFlag(MODULE_ID, "affinitySphere", state.identity.affinitySphere);
        }

        await actor.setFlag(MODULE_ID,'identity',{player:state.identity.player||'',chronicle:state.identity.chronicle||'',affiliation:state.identity.affiliation||'',sect:state.identity.sect||''});
        await actor.setFlag(MODULE_ID,'narrative',{appearanceDescription:state.identity.appearance||'',biography:state.identity.biography||'',rpTips:state.identity.rpTips||''});
        await actor.setFlag(MODULE_ID,'meritsFlaws',foundry.utils.deepClone(state.meritsFlaws||[]));
        await actor.setFlag(MODULE_ID,'flawBonusCap',state.flawBonusCap??7);
        await actor.setFlag(MODULE_ID,'creation',{state:foundry.utils.deepClone(state),freebieBudget:checked.freebieBudget,freebiesSpent:checked.freebiesSpent});
        for(const m of state.meritsFlaws||[])await actor.createEmbeddedDocuments('Item',[{name:m.name,type:'Feature',system:{type:m.kind==='merit'?'wod.types.merit':'wod.types.flaw',level:m.points,value:0,max:5,placement:'feature',iscreated:true,isvisible:true,isremovable:true,description:m.description,reference:m.reference||'',settings:{iscreated:true,isvisible:true,isremovable:true}},flags:{[MODULE_ID]:{meritFlaw:foundry.utils.deepClone(m),approvalRequired:true}}}]);

        // Install selected non-core Abilities as ordinary native Ability items.
        for(const ability of data.abilities){
            const rating=Number(state.abilities[ability.id]||0);
            if(itemBySystemId(actor,'Ability',ability.id)||!rating)continue;
            if(!ability.nonCore)throw new Error('Mage template is missing core Ability: '+ability.name);
            await actor.createEmbeddedDocuments('Item',[{name:ability.name,type:'Ability',system:{id:ability.id,type:'wod.abilities.'+ability.category,label:ability.name,value:rating,total:rating,bonus:0,max:5,speciality:String(state.specialties?.abilities?.[ability.id]||''),description:ability.description||'',settings:{iscreated:true,isvisible:true,isremovable:true,version:game.system.version}},flags:{[MODULE_ID]:{nonCore:true,approvalRequired:true,category:ability.category}}}]);
        }
        // Ability ratings.
        const itemUpdates = [];
        for (const ability of data.abilities) {
            const item = itemBySystemId(actor, "Ability", ability.id);
            if (!item) continue;
            const rating = Number(state.abilities[ability.id] ?? 0);
            itemUpdates.push({
                _id: item.id,
                "system.value": rating,
                "system.speciality": rating >= 4
                    ? String(state.specialties?.abilities?.[ability.id] ?? "").trim()
                    : ""
            });
        }

        // Sphere ratings. All nine Sphere items are guaranteed to exist now.
        for (const sphere of data.spheres) {
            const item = itemBySystemId(actor, "Sphere", sphere.id);
            if (!item) throw new Error(`Sphere disappeared during creation: ${sphere.name}`);
            itemUpdates.push({
                _id: item.id,
                "system.value": Number(state.spheres[sphere.id] ?? 0)
            });
        }

        // Core advantages.
        const arete = itemBySystemId(actor, "Advantage", "arete");
        if (arete) {
            itemUpdates.push({
                _id: arete.id,
                "system.permanent": Number(state.core.arete),
                "system.roll": Number(state.core.arete)
            });
        }

        const willpower = itemBySystemId(actor, "Advantage", "willpower");
        if (willpower) {
            itemUpdates.push({
                _id: willpower.id,
                "system.permanent": Number(state.core.willpower),
                "system.temporary": Number(state.core.willpower),
                "system.roll": Number(state.core.willpower)
            });
        }

        const quintessence = itemBySystemId(actor, "Advantage", "quintessence");
        if (quintessence) {
            itemUpdates.push({
                _id: quintessence.id,
                "system.temporary": Number(evaluation.quintessence ?? 0),
                "system.roll": Number(evaluation.quintessence ?? 0)
            });
        }

        const paradox = itemBySystemId(actor, "Advantage", "paradox");
        if (paradox) {
            itemUpdates.push({
                _id: paradox.id,
                "system.permanent": 0,
                "system.temporary": 0,
                "system.roll": 0
            });
        }

        if (itemUpdates.length) {
            await actor.updateEmbeddedDocuments("Item", itemUpdates);
        }

        // Backgrounds are Feature items. Do this after the Splat is installed.
        for (const background of data.backgrounds) {
            const rating = Number(state.backgrounds[background.key] ?? 0);
            if (rating > 0) await createBackground(actor, background, rating);
        }

        // Re-assert the Mage flags after all item work and verify the finished Actor.
        // If anything fundamental is missing, fail instead of silently creating a
        // half-Mage that lacks the Sphere/casting interface.
        await ensureMageSettings(actor, data.mageSplat);
        validateMageActor(actor, data);

        console.info("wod20-mage-charamancer | Mage creation verified", {
            actor: actor.name,
            settings: {
                splat: actor.system.settings.splat,
                game: actor.system.settings.game,
                variantsheet: actor.system.settings.variantsheet,
                hasspheres: actor.system.settings.hasspheres,
                hasquintessence: actor.system.settings.hasquintessence
            },
            spheres: actor.items
                .filter(item => item.type === "Sphere")
                .map(item => ({ id: item.system?.id, value: item.system?.value }))
        });

        ui.notifications.info(`Mage created: ${actor.name}`);
        actor.sheet?.render(true);
        return actor;
    }
    catch (error) {
        console.error("wod20-mage-charamancer | Character creation failed", error);

        if (actor) {
            try {
                await actor.delete();
            }
            catch (cleanupError) {
                console.error("wod20-mage-charamancer | Could not remove incomplete actor", cleanupError);
            }
        }

        throw error;
    }
}
