const FALLBACK_ABILITIES = [
    ["alertness", "Alertness", "talent"],
    ["athletics", "Athletics", "talent"],
    ["art", "Art", "talent"],
    ["empathy", "Empathy", "talent"],
    ["awareness", "Awareness", "talent"],
    ["expression", "Expression", "talent"],
    ["intimidation", "Intimidation", "talent"],
    ["brawl", "Brawl", "talent"],
    ["leadership", "Leadership", "talent"],
    ["streetwise", "Streetwise", "talent"],
    ["subterfuge", "Subterfuge", "talent"],

    ["etiquette", "Etiquette", "skill"],
    ["craft", "Craft", "skill"],
    ["firearms", "Firearms", "skill"],
    ["martialarts", "Martial Arts", "skill"],
    ["meditation", "Meditation", "skill"],
    ["melee", "Melee", "skill"],
    ["research", "Research", "skill"],
    ["stealth", "Stealth", "skill"],
    ["survival", "Survival", "skill"],
    ["technology", "Technology", "skill"],
    ["drive", "Drive", "skill"],

    ["computer", "Computer", "knowledge"],
    ["cosmology", "Cosmology", "knowledge"],
    ["enigmas", "Enigmas", "knowledge"],
    ["investigation", "Investigation", "knowledge"],
    ["law", "Law", "knowledge"],
    ["medicine", "Medicine", "knowledge"],
    ["esoterica", "Esoterica", "knowledge"],
    ["academics", "Academics", "knowledge"],
    ["occult", "Occult", "knowledge"],
    ["science", "Science", "knowledge"],
    ["politics", "Politics", "knowledge"]
].map(([id, name, category]) => ({ id, name, category }));

const FALLBACK_SPHERES = [
    ["correspondence", "Correspondence"],
    ["entropy", "Entropy"],
    ["forces", "Forces"],
    ["life", "Life"],
    ["matter", "Matter"],
    ["mind", "Mind"],
    ["prime", "Prime"],
    ["spirit", "Spirit"],
    ["time", "Time"]
].map(([id, name]) => ({ id, name }));

const FALLBACK_BACKGROUNDS = [
    "Allies",
    "Alternate Identity",
    "Arcane",
    "Avatar",
    "Backup",
    "Blessing",
    "Certification",
    "Chantry",
    "Contacts",
    "Cult",
    "Demesne",
    "Destiny",
    "Dream",
    "Enhancement",
    "Fame",
    "Familiar",
    "Influence",
    "Legend",
    "Library",
    "Mentor",
    "Node",
    "Past Lives",
    "Patron",
    "Rank",
    "Requisitions",
    "Resources",
    "Retainers",
    "Sanctum",
    "Secret Weapons",
    "Spies",
    "Status",
    "Totem",
    "Wonder"
].map(name => ({
    key: `fallback:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    uuid: null
}));

function wodPacks() {
    return Array.from(game.packs).filter(pack =>
        pack.documentName === "Item" &&
        (pack.collection?.startsWith("worldofdarkness.") || pack.metadata?.packageName === "worldofdarkness")
    );
}

function normalizeCategory(systemType) {
    const value = String(systemType ?? "").toLowerCase();
    if (value.includes("talent")) return "talent";
    if (value.includes("skill")) return "skill";
    if (value.includes("knowledge")) return "knowledge";
    return null;
}

function valuesOf(container) {
    if (!container) return [];
    return Array.isArray(container) ? container : Object.values(container);
}

export async function findMageSplat() {
    const candidates = [];

    for (const pack of wodPacks()) {
        let index;
        try {
            index = await pack.getIndex({
                fields: [
                    "type",
                    "system.settings.id",
                    "system.settings.game",
                    "system.settings.variantsheet",
                    "system.settings.variant",
                    "system.settings.era"
                ]
            });
        }
        catch (error) {
            console.warn("wod20-mage-charamancer | Could not index pack", pack.collection, error);
            continue;
        }

        for (const entry of index) {
            if (entry.type !== "Splat") continue;

            const id = String(foundry.utils.getProperty(entry, "system.settings.id") ?? "").toLowerCase();
            const gameId = String(foundry.utils.getProperty(entry, "system.settings.game") ?? "").toLowerCase();
            const sheet = String(foundry.utils.getProperty(entry, "system.settings.variantsheet") ?? "").toLowerCase();
            const name = String(entry.name ?? "").toLowerCase();

            // Only inspect plausible Mage templates. The old loose matcher could
            // accept any Splat whose name merely contained the word "mage".
            if (!(id === "mage" || gameId === "mage" || sheet === "mage" || name === "mage")) continue;

            let document;
            try {
                document = await pack.getDocument(entry._id);
            }
            catch (error) {
                continue;
            }

            const settings = document?.system?.settings ?? {};
            const powers = valuesOf(document?.system?.powers);
            const advantages = valuesOf(document?.system?.advantages);
            const sphereIds = powers
                .filter(power => power?.type === "Sphere")
                .map(power => String(power?.system?.id ?? "").toLowerCase())
                .filter(Boolean);
            const advantageIds = advantages
                .map(advantage => String(advantage?.system?.id ?? "").toLowerCase())
                .filter(Boolean);

            let score = 0;
            if (String(settings.id ?? "").toLowerCase() === "mage") score += 100;
            if (String(settings.game ?? "").toLowerCase() === "mage") score += 100;
            if (String(settings.variantsheet ?? "").toLowerCase() === "mage") score += 100;
            if (name === "mage") score += 25;
            if (sphereIds.length === 9) score += 150;
            if (["arete", "willpower", "quintessence", "paradox"].every(id => advantageIds.includes(id))) score += 150;

            // Prefer the modern M20 template over historical variants with the same Mage flags.
            const era=String(settings.era??'').toLowerCase();
            const variant=String(settings.variant??'').toLowerCase();
            if(era==='modern')score+=100;
            if(variant==='general')score+=50;
            if(/sorcerers?[^a-z]*crusade|dark ages/.test(name))score-=100;
            candidates.push({ document, pack: pack.collection, score, sphereIds, advantageIds });
        }
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    if (!best || best.score < 450) {
        console.error("wod20-mage-charamancer | Mage Splat candidates were incomplete", candidates);
        throw new Error("Could not locate a complete WoD20 Mage PC template with all nine Spheres and Mage Advantages.");
    }

    console.info("wod20-mage-charamancer | Using Mage template", {
        name: best.document.name,
        uuid: best.document.uuid,
        pack: best.pack,
        score: best.score,
        spheres: best.sphereIds,
        advantages: best.advantageIds
    });

    return best.document;
}

export function extractAbilities(mageSplat) {
    const output = [];

    for (const entry of valuesOf(mageSplat?.system?.abilities)) {
        const id = entry?.system?.id;
        const name = entry?.name;
        const category = normalizeCategory(entry?.system?.type);
        if (!id || !name || !category) continue;
        output.push({ id, name, category });
    }

    if (output.length < 20) return FALLBACK_ABILITIES;

    return output.sort((a, b) => {
        const order = { talent: 0, skill: 1, knowledge: 2 };
        return (order[a.category] - order[b.category]) || a.name.localeCompare(b.name);
    });
}

export function extractSpheres(mageSplat) {
    const output = [];

    for (const entry of valuesOf(mageSplat?.system?.powers)) {
        if (entry?.type !== "Sphere") continue;
        const id = entry?.system?.id;
        const name = entry?.name;
        if (!id || !name) continue;
        output.push({ id, name });
    }

    if (output.length !== 9) return FALLBACK_SPHERES;
    return output.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadBackgrounds() {
    // If the module's M20 Background world Items have been installed, use that
    // curated set directly. This avoids pulling unrelated Backgrounds from other
    // WoD splats while preserving descriptions when a Background is copied to a Mage.
    const installedMageBackgrounds = game.items
        .filter(item =>
            item.type === "Feature" &&
            item.system?.type === "wod.types.background" &&
            item.flags?.["wod20-mage-charamancer"]?.starterBackground === true
        )
        .map(item => ({
            key: `Item.${item.id}`,
            name: item.name,
            uuid: `Item.${item.id}`
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    if (installedMageBackgrounds.length) return installedMageBackgrounds;

    const found = new Map();

    for (const pack of wodPacks()) {
        let index;
        try {
            index = await pack.getIndex({ fields: ["type", "system.type"] });
        }
        catch (error) {
            continue;
        }

        for (const entry of index) {
            if (entry.type !== "Feature") continue;
            if (foundry.utils.getProperty(entry, "system.type") !== "wod.types.background") continue;

            const key = `Compendium.${pack.collection}.Item.${entry._id}`;
            if (!found.has(entry.name)) {
                found.set(entry.name, {
                    key,
                    name: entry.name,
                    uuid: key
                });
            }
        }
    }

    if (!found.size) return FALLBACK_BACKGROUNDS;

    return Array.from(found.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadMageCreationData() {
    const mageSplat = await findMageSplat();
    const abilities = extractAbilities(mageSplat);
    const spheres = extractSpheres(mageSplat);
    const backgrounds = await loadBackgrounds();

    const avatar = backgrounds.find(background => background.name.toLowerCase() === "avatar");

    return {
        mageSplat,
        abilities,
        spheres,
        backgrounds,
        avatarBackgroundKey: avatar?.key ?? null
    };
}
