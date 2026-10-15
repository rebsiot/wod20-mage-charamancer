const MODULE_ID = "wod20-mage-charamancer";
const STARTER_GEAR_VERSION = 3;
const ROOT_FOLDER_NAME = "Mage Starter Gear";

const ICONS = Object.freeze({
    melee: "icons/svg/sword.svg",
    firearms: "icons/svg/target.svg",
    armor: "icons/svg/shield.svg",
    general: "icons/svg/item-bag.svg",
    mage: "icons/svg/book.svg",
    natural: "icons/svg/claw.svg"
});

function baseFlags(key, category, source = "custom", sourceReference = "") {
    return {
        [MODULE_ID]: {
            starterGear: true,
            starterGearKey: key,
            starterGearCategory: category,
            starterGearVersion: STARTER_GEAR_VERSION,
            starterGearSource: source,
            starterGearSourceReference: sourceReference
        }
    };
}

function sourcedDescription(description, { official = false, reference = "", sourceNote = "" } = {}) {
    const sourceText = official
        ? `Rules source: Mage: The Ascension 20th Anniversary Edition Quickstart${reference ? `, ${reference}` : ""}.`
        : "Rules source: custom starter profile; this is not a direct M20 equipment-table entry.";
    return [description, sourceText, sourceNote].filter(Boolean).join(" ");
}

function commonObjectSystem(description, details = "") {
    return {
        settings: {
            iscreated: true,
            isactive: false,
            isvisible: true,
            isremovable: true,
            version: ""
        },
        description,
        details,
        isequipped: false,
        ismagical: false,
        isweapon: false,
        iscontainer: false,
        era: "wod.era.modern"
    };
}

function melee(key, name, {
    damageBonus,
    damageType,
    difficulty = 6,
    minstrength = 0,
    conceal = "",
    twoHanded = false,
    description = "",
    ability = "melee",
    natural = false,
    category = "Melee",
    official = false,
    reference = "Melee Weapons table",
    sourceNote = ""
}) {
    return {
        key,
        category,
        source: official ? "m20-quickstart" : "custom",
        sourceReference: official ? reference : "",
        data: {
            name,
            type: "Melee Weapon",
            img: natural ? ICONS.natural : ICONS.melee,
            system: {
                ...commonObjectSystem(sourcedDescription(
                    description || `Generic modern ${name.toLowerCase()}. Rename or customize it for a specific weapon if desired.`,
                    { official, reference, sourceNote }
                ), "Mage Starter Gear"),
                isweapon: true,
                attack: {
                    attribute: "dexterity",
                    ability,
                    secondaryabilityid: "",
                    accuracy: 0,
                    isrollable: true
                },
                damage: {
                    attribute: "strength",
                    bonus: damageBonus,
                    type: damageType,
                    isrollable: true
                },
                difficulty,
                minstrength,
                piercing: 0,
                conceal,
                istwohanded: twoHanded,
                isnatural: natural
            }
        }
    };
}

function naturalWeapon(key, name, {
    damageBonus,
    damageType,
    difficulty,
    description,
    sourceNote = ""
}) {
    return melee(key, name, {
        damageBonus,
        damageType,
        difficulty,
        conceal: "N",
        ability: "brawl",
        natural: true,
        category: "Natural Weapons",
        description,
        official: true,
        reference: "General Hand-to-Hand Maneuvers table",
        sourceNote
    });
}

function ranged(key, name, {
    damage,
    range,
    rate,
    clip,
    conceal,
    twoHanded = false,
    burst = false,
    fullAuto = false,
    spray = false,
    damageType = "lethal",
    description = "",
    official = false,
    reference = "Ranged Weapons table",
    sourceNote = "",
    listedClip = ""
}) {
    return {
        key,
        category: "Firearms",
        source: official ? "m20-quickstart" : "custom",
        sourceReference: official ? reference : "",
        data: {
            name,
            type: "Ranged Weapon",
            img: ICONS.firearms,
            system: {
                ...commonObjectSystem(sourcedDescription(
                    description || `Generic modern ${name.toLowerCase()}. Rename or customize it for a specific make and model if desired.`,
                    {
                        official,
                        reference,
                        sourceNote: [
                            sourceNote,
                            listedClip && String(listedClip).includes("+")
                                ? `M20 lists capacity as ${listedClip}; WoD20 stores a single loaded-ammo maximum, so this item uses ${clip} total loaded rounds.`
                                : ""
                        ].filter(Boolean).join(" ")
                    }
                ), "Mage Starter Gear"),
                isweapon: true,
                attack: {
                    attribute: "dexterity",
                    ability: "firearms",
                    secondaryabilityid: "",
                    accuracy: 0,
                    isrollable: true
                },
                damage: {
                    attribute: "",
                    bonus: damage,
                    type: damageType,
                    isrollable: true
                },
                difficulty: 6,
                minstrength: 0,
                piercing: 0,
                conceal,
                istwohanded: twoHanded,
                range,
                rate,
                mode: {
                    hasreload: true,
                    hasburst: burst,
                    hasfullauto: fullAuto,
                    hasspray: spray
                },
                clip: {
                    value: clip,
                    max: clip
                }
            }
        }
    };
}

function armor(key, name, {
    soak,
    dexPenalty = 0,
    description = "",
    official = false,
    reference = "Armor and Shields table",
    sourceNote = ""
}) {
    return {
        key,
        category: "Armor",
        source: official ? "m20-quickstart" : "custom",
        sourceReference: official ? reference : "",
        data: {
            name,
            type: "Armor",
            img: ICONS.armor,
            system: {
                ...commonObjectSystem(sourcedDescription(
                    description || `Generic ${name.toLowerCase()} suitable for a modern chronicle.`,
                    { official, reference, sourceNote }
                ), "Mage Starter Gear"),
                soak: {
                    bashing: soak,
                    lethal: soak,
                    aggravated: 0,
                    chimerical: {
                        bashing: 0,
                        lethal: 0,
                        aggravated: 0
                    }
                },
                dexpenalty: dexPenalty,
                forms: {
                    hashomid: true,
                    hasglabro: false,
                    hascrinos: false,
                    hashispo: false,
                    haslupus: false
                }
            }
        }
    };
}

function gear(key, name, category, description, {
    rollable = false,
    dice1 = "",
    dice2 = "",
    difficulty = 6,
    bonus = 0
} = {}) {
    const isMage = category === "Mage Gear";
    return {
        key,
        category,
        source: "custom",
        sourceReference: "",
        data: {
            name,
            type: "Item",
            img: isMage ? ICONS.mage : ICONS.general,
            system: {
                ...commonObjectSystem(description, "Mage Starter Gear"),
                dice1,
                dice2,
                bonus,
                difficulty,
                isrollable: rollable,
                type: "",
                placement: "feature",
                level: "0",
                value: 0,
                max: 5
            }
        }
    };
}

export const STARTER_GEAR = Object.freeze([
    // Natural and unarmed attacks from the M20 Quickstart hand-to-hand table.
    naturalWeapon("punch", "Punch", {
        damageBonus: 0, damageType: "bashing", difficulty: 6,
        description: "Basic unarmed punch using Dexterity + Brawl; damage is Strength/B."
    }),
    naturalWeapon("kick", "Kick", {
        damageBonus: 1, damageType: "bashing", difficulty: 7,
        description: "Basic unarmed kick using Dexterity + Brawl; damage is Strength +1/B."
    }),
    naturalWeapon("bite", "Bite", {
        damageBonus: 1, damageType: "lethal", difficulty: 5,
        description: "Natural bite attack using Dexterity + Brawl.",
        sourceNote: "M20 lists Bite damage as Strength +1 to +3 and either bashing or lethal depending on the creature or form. This starter item uses the low-end Strength +1/L profile; edit the bonus/type for the specific form."
    }),
    naturalWeapon("claw", "Claw", {
        damageBonus: 1, damageType: "lethal", difficulty: 6,
        description: "Natural claw attack using Dexterity + Brawl.",
        sourceNote: "M20 lists Claw damage as Strength +1 to +3/L depending on the creature or form. This starter item uses the low-end Strength +1/L profile; edit the bonus for the specific form."
    }),

    // Melee - direct M20 Quickstart entries unless marked custom.
    melee("brass-knuckles", "Brass Knuckles", { damageBonus: 0, damageType: "lethal", difficulty: 6, conceal: "P", official: true }),
    melee("knife", "Knife", { damageBonus: 1, damageType: "lethal", difficulty: 4, conceal: "P", official: true }),
    melee("machete", "Machete", {
        damageBonus: 2, damageType: "lethal", difficulty: 5, conceal: "J",
        sourceNote: "Benchmarked against the M20 Short Sword profile (Difficulty 5, Strength +2/L, Jacket concealment)."
    }),
    melee("baseball-bat", "Baseball Bat", { damageBonus: 2, damageType: "bashing", difficulty: 5, conceal: "T", official: true }),
    melee("crowbar", "Crowbar", { damageBonus: 1, damageType: "lethal", difficulty: 6, conceal: "J", official: true }),
    melee("staff", "Staff", { damageBonus: 1, damageType: "bashing", difficulty: 6, conceal: "N", official: true }),
    melee("sword", "Sword", { damageBonus: 2, damageType: "lethal", difficulty: 6, conceal: "T", official: true }),

    // Firearms - direct M20 Quickstart entries. For +1 chamber listings, clip stores total loaded rounds.
    ranged("light-pistol", "Light Semi-Auto Pistol", { damage: 4, range: 20, rate: 4, clip: 18, listedClip: "17+1", conceal: "P", official: true }),
    ranged("heavy-pistol", "Heavy Semi-Auto Pistol", { damage: 5, range: 30, rate: 3, clip: 8, listedClip: "7+1", conceal: "J", official: true }),
    ranged("38-revolver", ".38 Revolver", { damage: 4, range: 12, rate: 3, clip: 6, listedClip: "6", conceal: "P", official: true }),
    ranged("44-revolver", ".44 Magnum Revolver", { damage: 6, range: 35, rate: 2, clip: 6, listedClip: "6", conceal: "J", official: true }),
    ranged("pump-shotgun", "Pump Shotgun", { damage: 8, range: 20, rate: 1, clip: 6, listedClip: "5+1", conceal: "T", twoHanded: true, official: true }),
    ranged("hunting-rifle", "Hunting Rifle", { damage: 8, range: 200, rate: 1, clip: 6, listedClip: "5+1", conceal: "N", twoHanded: true, official: true }),
    ranged("submachine-gun", "Submachine Gun", { damage: 4, range: 50, rate: 3, clip: 31, listedClip: "30+1", conceal: "T", twoHanded: true, burst: true, fullAuto: true, spray: true, official: true }),
    ranged("assault-rifle", "Assault Rifle", { damage: 7, range: 150, rate: 3, clip: 43, listedClip: "42+1", conceal: "N", twoHanded: true, burst: true, fullAuto: true, spray: true, official: true }),
    ranged("taser", "Taser", {
        damage: 5, range: 5, rate: 1, clip: 1, listedClip: "1", conceal: "P", damageType: "bashing", official: true,
        description: "Handheld conducted-energy weapon.",
        sourceNote: "M20 notes that the Taser deals bashing damage and does not add extra damage from attack successes; apply that special rule manually if WoD20 does not suppress those extra dice."
    }),

    // Armor. Exact Quickstart profiles use their table names; the concealable vest is intentionally custom.
    armor("reinforced-clothing", "Reinforced Clothing", {
        soak: 1, dexPenalty: 0, official: true,
        sourceNote: "M20 lists Reinforced Clothing as Armor Rating 1-2 with no Dexterity penalty; this starter profile uses Rating 1."
    }),
    armor("concealable-vest", "Concealable Ballistic Vest", {
        soak: 2, dexPenalty: 0,
        sourceNote: "Custom intermediate profile for a low-bulk concealable vest."
    }),
    armor("ballistic-vest", "Kevlar Vest", { soak: 3, dexPenalty: 1, official: true }),
    armor("heavy-tactical-armor", "Flak Vest", { soak: 4, dexPenalty: 2, official: true }),

    // General gear - campaign convenience items, not direct M20 table entries.
    gear("smartphone", "Smartphone", "General Gear", "Modern smartphone with camera, GPS, messaging, network access, and common utility apps."),
    gear("burner-phone", "Burner Phone", "General Gear", "Low-cost prepaid phone intended for temporary or compartmentalized communications."),
    gear("laptop", "Laptop Computer", "General Gear", "Portable general-purpose computer suitable for research, communications, and technical work."),
    gear("flashlight", "Flashlight", "General Gear", "Durable handheld flashlight with spare batteries."),
    gear("first-aid-kit", "First Aid Kit", "General Gear", "Compact supplies for stabilizing injuries and treating routine wounds in the field."),
    gear("entry-kit", "Lockpick / Entry Kit", "General Gear", "Compact mechanical entry tools. Possession may be restricted depending on jurisdiction.", { rollable: true, dice1: "dexterity", dice2: "security" }),
    gear("general-toolkit", "General Toolkit", "General Gear", "Common hand tools for routine repair, assembly, and improvised mechanical work."),
    gear("electronics-toolkit", "Electronics Toolkit", "General Gear", "Portable tools, meter, leads, and consumables for electronics troubleshooting and repair."),
    gear("camera-recorder", "Camera / Recorder", "General Gear", "Portable digital camera and audio recorder for documentation and evidence collection."),
    gear("binoculars", "Binoculars", "General Gear", "Compact optical binoculars for observation at distance."),
    gear("backpack", "Field Backpack", "General Gear", "Sturdy backpack sized for a day or two of field equipment."),
    gear("restraints", "Handcuffs / Restraints", "General Gear", "Reusable restraints suitable for securing a cooperative or subdued human-sized subject."),

    // Mage-oriented gear - campaign convenience items, not direct M20 table entries.
    gear("ritual-kit", "Ritual Kit", "Mage Gear", "A portable collection of personally appropriate ritual implements, consumables, symbols, and mundane tools."),
    gear("portable-lab", "Portable Laboratory Kit", "Mage Gear", "Field-sized scientific equipment and consumables for basic sampling, measurement, and experimentation."),
    gear("occult-reference", "Occult Reference Collection", "Mage Gear", "A compact curated set of notes, texts, correspondences, and reference material useful for occult research."),
    gear("investigation-kit", "Field Investigation Kit", "Mage Gear", "Evidence bags, markers, gloves, measurement tools, notebooks, and other supplies for systematic scene investigation."),
    gear("surveillance-kit", "Surveillance Kit", "Mage Gear", "Compact cameras, microphones, storage media, mounts, and cabling for temporary observation setups.")
]);

const LEGACY_V1_PATCHES = Object.freeze({
    "brass-knuckles": { checks: { "system.damage.bonus": 1, "system.damage.type": "bashing" }, updates: { "system.damage.bonus": 0, "system.damage.type": "lethal" } },
    "machete": { checks: { "system.difficulty": 6 }, updates: { "system.difficulty": 5 } },
    "baseball-bat": { checks: { "system.difficulty": 6, "system.conceal": "N", "system.istwohanded": true }, updates: { "system.difficulty": 5, "system.conceal": "T", "system.istwohanded": false } },
    "crowbar": { checks: { "system.damage.bonus": 2, "system.damage.type": "bashing", "system.minstrength": 1 }, updates: { "system.damage.bonus": 1, "system.damage.type": "lethal", "system.minstrength": 0 } },
    "staff": { checks: { "system.damage.bonus": 2, "system.istwohanded": true }, updates: { "system.damage.bonus": 1, "system.istwohanded": false } },
    "sword": { checks: { "system.conceal": "N" }, updates: { "system.conceal": "T" } },
    "light-pistol": { checks: { "system.clip.value": 17, "system.clip.max": 17 }, updates: { "system.clip.value": 18, "system.clip.max": 18 } },
    "heavy-pistol": { checks: { "system.range": 25 }, updates: { "system.range": 30 } },
    "pump-shotgun": { checks: { "system.clip.value": 5, "system.clip.max": 5 }, updates: { "system.clip.value": 6, "system.clip.max": 6 } },
    "hunting-rifle": { checks: { "system.clip.value": 5, "system.clip.max": 5 }, updates: { "system.clip.value": 6, "system.clip.max": 6 } },
    "submachine-gun": { checks: { "system.clip.value": 30, "system.clip.max": 30, "system.mode.hasspray": false }, updates: { "system.clip.value": 31, "system.clip.max": 31, "system.mode.hasspray": true } },
    "assault-rifle": { checks: { "system.clip.value": 30, "system.clip.max": 30, "system.mode.hasspray": false }, updates: { "system.clip.value": 43, "system.clip.max": 43, "system.mode.hasspray": true } },
    "taser": { checks: { "system.range": 7 }, updates: { "system.range": 5 } },
    "ballistic-vest": { oldName: "Ballistic Vest", checks: {}, updates: {} },
    "heavy-tactical-armor": { oldName: "Heavy Tactical Armor", checks: {}, updates: {} }
});

function legacyV1DefaultDescription(entry, oldName = entry.data.name) {
    if (entry.key === "taser") {
        return "Handheld conducted-energy weapon. Treat its special incapacitation effects according to the Storyteller's ruling.";
    }
    if (entry.category === "Melee") {
        return `Generic modern ${oldName.toLowerCase()}. Rename or customize it for a specific weapon if desired.`;
    }
    if (entry.category === "Firearms") {
        return `Generic modern ${oldName.toLowerCase()}. Rename or customize it for a specific make and model if desired.`;
    }
    if (entry.category === "Armor") {
        return `Generic ${oldName.toLowerCase()} suitable for a modern chronicle.`;
    }
    return entry.data.system?.description ?? "";
}

function matchesChecks(item, checks = {}) {
    return Object.entries(checks).every(([path, expected]) => {
        const actual = foundry.utils.getProperty(item, path);
        return actual === expected;
    });
}

async function migrateLegacyStarterItem(item, entry) {
    const version = Number(item.flags?.[MODULE_ID]?.starterGearVersion ?? 1);
    if (version >= STARTER_GEAR_VERSION) return { updated: false, skipped: false };

    // v0.3.1 already contains the corrected M20 profiles. v0.3.2 only adds
    // new starter content, so existing v2 gear merely needs its seed version bumped.
    if (version >= 2) {
        await item.update({
            [`flags.${MODULE_ID}.starterGearVersion`]: STARTER_GEAR_VERSION
        }, { render: false });
        return { updated: false, skipped: false };
    }

    const patch = LEGACY_V1_PATCHES[entry.key] ?? { checks: {}, updates: {} };
    const oldName = patch.oldName ?? entry.data.name;
    if (!matchesChecks(item, patch.checks)) {
        return { updated: false, skipped: true };
    }

    const update = { ...patch.updates };
    if (item.name === oldName && oldName !== entry.data.name) update.name = entry.data.name;

    const oldDescription = legacyV1DefaultDescription(entry, oldName);
    if ((item.system?.description ?? "") === oldDescription) {
        update["system.description"] = entry.data.system?.description ?? oldDescription;
    }

    update[`flags.${MODULE_ID}.starterGearVersion`] = STARTER_GEAR_VERSION;
    update[`flags.${MODULE_ID}.starterGearSource`] = entry.source ?? "custom";
    update[`flags.${MODULE_ID}.starterGearSourceReference`] = entry.sourceReference ?? "";

    await item.update(update, { render: false });
    return { updated: true, skipped: false };
}

async function ensureFolder(name, parent = null) {
    const existingByFlag = game.folders.find(folder =>
        folder.type === "Item" &&
        folder.flags?.[MODULE_ID]?.starterGearFolder === true &&
        folder.flags?.[MODULE_ID]?.starterGearFolderName === name &&
        (folder.folder?.id ?? folder.folder ?? null) === (parent?.id ?? null)
    );
    if (existingByFlag) return existingByFlag;

    const existingByName = game.folders.find(folder =>
        folder.type === "Item" &&
        folder.name === name &&
        (folder.folder?.id ?? folder.folder ?? null) === (parent?.id ?? null)
    );
    if (existingByName) return existingByName;

    return Folder.create({
        name,
        type: "Item",
        folder: parent?.id ?? null,
        flags: {
            [MODULE_ID]: {
                starterGearFolder: true,
                starterGearFolderName: name,
                starterGearVersion: STARTER_GEAR_VERSION
            }
        }
    });
}

function existingStarterItems() {
    return new Map(
        game.items
            .filter(item => item.flags?.[MODULE_ID]?.starterGear === true)
            .map(item => [item.flags?.[MODULE_ID]?.starterGearKey, item])
            .filter(([key]) => Boolean(key))
    );
}

export async function installStarterGear({ notify = true } = {}) {
    if (!game.user.isGM) {
        if (notify) ui.notifications.error("Only a GM can install world starter gear.");
        return { created: 0, existing: 0, total: STARTER_GEAR.length };
    }

    const root = await ensureFolder(ROOT_FOLDER_NAME);
    const categories = [...new Set(STARTER_GEAR.map(entry => entry.category))];
    const folders = new Map();

    for (const category of categories) {
        folders.set(category, await ensureFolder(category, root));
    }

    const existing = existingStarterItems();
    let created = 0;
    let updated = 0;
    let skippedCustomized = 0;

    for (const entry of STARTER_GEAR) {
        const existingItem = existing.get(entry.key);
        if (existingItem) {
            const result = await migrateLegacyStarterItem(existingItem, entry);
            if (result.updated) updated += 1;
            if (result.skipped) skippedCustomized += 1;
            continue;
        }

        const data = foundry.utils.deepClone(entry.data);
        data.folder = folders.get(entry.category)?.id ?? root.id;
        data.flags = baseFlags(entry.key, entry.category, entry.source, entry.sourceReference);
        if (data.system?.settings) data.system.settings.version = game.system.version ?? "";

        await Item.create(data, { renderSheet: false });
        created += 1;
    }

    const alreadyThere = STARTER_GEAR.length - created;
    const parts = [];
    if (created) parts.push(`${created} created`);
    if (updated) parts.push(`${updated} updated to the corrected M20 profiles`);
    if (skippedCustomized) parts.push(`${skippedCustomized} customized item${skippedCustomized === 1 ? "" : "s"} left unchanged`);
    if (!parts.length) parts.push("no changes needed");
    if (notify) ui.notifications.info(`Mage Starter Gear: ${parts.join(", ")}.`);

    ui.items?.render?.();
    return {
        created,
        updated,
        skippedCustomized,
        existing: alreadyThere,
        total: STARTER_GEAR.length,
        rootFolderId: root.id
    };
}
