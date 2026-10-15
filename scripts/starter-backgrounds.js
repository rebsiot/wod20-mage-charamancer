const MODULE_ID = "wod20-mage-charamancer";
const BACKGROUND_SET_VERSION = 1;
const BACKGROUND_FOLDER_NAME = "Mage Backgrounds";
const BACKGROUND_ICON = "icons/svg/aura.svg";

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function background(name, description, reference = "M20 core, Backgrounds pp. 301-328") {
    const key = slugify(name);
    return {
        key,
        name,
        reference,
        data: {
            name,
            type: "Feature",
            img: BACKGROUND_ICON,
            system: {
                settings: {
                    iscreated: true,
                    isactive: false,
                    isvisible: true,
                    isremovable: true,
                    order: 0,
                    version: "",
                    parentid: "",
                    itemuuid: ""
                },
                reference: "",
                description: `${description} Rules source: Mage: The Ascension 20th Anniversary Edition core, ${reference.replace("M20 core, ", "")}.`,
                details: "Mage Background",
                property: [],
                bonuslist: [],
                type: "wod.types.background",
                placement: "feature",
                level: "0",
                value: 0,
                max: 5,
                isrollable: false
            }
        }
    };
}

export const MAGE_BACKGROUNDS = Object.freeze([
    background("Allies", "Reliable people who will actively help the character when they reasonably can.", "M20 core, pp. 303-304"),
    background("Alternate Identity", "A convincing second identity supported by records, documentation, and a believable history.", "M20 core, pp. 304-305"),
    background("Arcane", "Supernatural or procedural obscurity that makes the character difficult to notice, trace, research, or remember.", "M20 core, p. 305"),
    background("Avatar", "The strength and presence of the mage's Awakened inner self; for technomancers this may be framed as Genius.", "M20 core, pp. 305-306"),
    background("Backup", "Access to trained support personnel or emergency assistance that can be called on when circumstances justify it.", "M20 core, pp. 306-307"),
    background("Blessing", "A lasting supernatural favor or beneficial condition granted by an outside power or unusual circumstance.", "M20 core, pp. 307-308"),
    background("Certification", "Formal credentials, licenses, clearances, or professional authority recognized by mundane institutions.", "M20 core, p. 308"),
    background("Chantry", "A shared Awakened institution, base, or community; Technocratic characters may treat the equivalent as a Construct.", "M20 core, pp. 308-309"),
    background("Contacts", "Sources of information who can provide rumors, leads, introductions, and specialized knowledge.", "M20 core, pp. 309-310"),
    background("Cult", "A devoted group of followers whose belief, service, or ritual support benefits the character.", "M20 core, p. 310"),
    background("Demesne", "A supernatural domain or controlled otherworldly territory tied to the character.", "M20 core, pp. 310-311"),
    background("Destiny", "A significant foretold or archetypal fate that can protect, compel, or shape the character's story.", "M20 core, pp. 311-312"),
    background("Dream", "Access to useful insight through dreams, deep intuition, or hyper-accelerated cognition; Technocratic variants may call this Hypercram.", "M20 core, p. 312"),
    background("Enhancement", "Permanent or semi-permanent technological, cybernetic, biological, or other engineered improvements.", "M20 core, pp. 312-313"),
    background("Fame", "Public recognition and the social benefits and complications that come with being widely known.", "M20 core, pp. 313-314"),
    background("Familiar", "A bonded non-human companion, often a spirit or other extraordinary being, with its own abilities and personality.", "M20 core, pp. 314-316"),
    background("Influence", "Pull, leverage, and authority within mortal institutions, communities, industries, or social systems.", "M20 core, pp. 316-317"),
    background("Legend", "A powerful mythic or archetypal identity linked to the character and capable of shaping how others perceive or respond to them.", "M20 core, p. 317"),
    background("Library", "Access to a specialized collection of occult, scientific, historical, or otherwise difficult-to-obtain information.", "M20 core, p. 318"),
    background("Mentor", "An experienced Awakened or Enlightened elder who offers instruction, advice, and occasional assistance.", "M20 core, pp. 318-319"),
    background("Node", "A place of power where Quintessence naturally gathers and can potentially be harvested as Tass.", "M20 core, pp. 319-320"),
    background("Past Lives", "Useful memories, instincts, or fragments of expertise carried forward from prior incarnations.", "M20 core, p. 320"),
    background("Patron", "An influential benefactor who provides resources, protection, opportunities, or assignments.", "M20 core, pp. 320-321"),
    background("Rank", "A recognized title or level of authority within a mundane hierarchy or formal institution.", "M20 core, p. 312"),
    background("Requisitions", "Access to organizational equipment and resources through formal requests, especially within Technocratic structures.", "M20 core, pp. 321-322"),
    background("Resources", "Personal wealth, cash flow, property, and routine access to material goods and services.", "M20 core, pp. 322-323"),
    background("Retainers", "Loyal, skilled followers or assistants who regularly work for the character.", "M20 core, p. 323"),
    background("Sanctum", "A specially prepared place to practice magick, conduct experiments, and work with reduced interference; technomancers may call it a Laboratory.", "M20 core, pp. 323-324"),
    background("Secret Weapons", "Access to unusual experimental advantages, prototypes, or modifications supplied by an organization, often with strings attached.", "M20 core, p. 325"),
    background("Spies", "A network of covert observers and informants positioned to gather intelligence for the character.", "M20 core, p. 325"),
    background("Status", "Standing, respect, and recognized position among the character's Awakened peers or affiliated organization.", "M20 core, pp. 325-326"),
    background("Totem", "A powerful spirit ally or patron associated with a shamanic character, cabal, or community.", "M20 core, pp. 326-328"),
    background("Wonder", "A reality-bending artifact such as a Talisman, Fetish, or technological Device that has powers of its own.", "M20 core, p. 328")
]);

async function ensureBackgroundFolder() {
    const byFlag = game.folders.find(folder =>
        folder.type === "Item" &&
        folder.flags?.[MODULE_ID]?.mageBackgroundFolder === true
    );
    if (byFlag) return byFlag;

    const byName = game.folders.find(folder =>
        folder.type === "Item" &&
        folder.name === BACKGROUND_FOLDER_NAME &&
        !(folder.folder?.id ?? folder.folder)
    );
    if (byName) return byName;

    return Folder.create({
        name: BACKGROUND_FOLDER_NAME,
        type: "Item",
        folder: null,
        flags: {
            [MODULE_ID]: {
                mageBackgroundFolder: true,
                mageBackgroundSetVersion: BACKGROUND_SET_VERSION
            }
        }
    });
}

function existingSeededBackgrounds() {
    return new Map(
        game.items
            .filter(item => item.flags?.[MODULE_ID]?.starterBackground === true)
            .map(item => [item.flags?.[MODULE_ID]?.starterBackgroundKey, item])
            .filter(([key]) => Boolean(key))
    );
}

export async function installMageBackgrounds({ notify = true } = {}) {
    if (!game.user.isGM) {
        if (notify) ui.notifications.error("Only a GM can install Mage Background world Items.");
        return { created: 0, existing: 0, total: MAGE_BACKGROUNDS.length };
    }

    const folder = await ensureBackgroundFolder();
    const existing = existingSeededBackgrounds();
    let created = 0;

    for (const entry of MAGE_BACKGROUNDS) {
        if (existing.has(entry.key)) continue;

        const data = foundry.utils.deepClone(entry.data);
        data.folder = folder.id;
        data.flags = {
            [MODULE_ID]: {
                starterBackground: true,
                starterBackgroundKey: entry.key,
                starterBackgroundVersion: BACKGROUND_SET_VERSION,
                starterBackgroundSource: "m20-core",
                starterBackgroundSourceReference: entry.reference
            }
        };
        if (data.system?.settings) data.system.settings.version = game.system.version ?? "";
        await Item.create(data, { renderSheet: false });
        created += 1;
    }

    const existingCount = MAGE_BACKGROUNDS.length - created;
    if (notify) {
        ui.notifications.info(`Mage Backgrounds: ${created ? `${created} created` : "no changes needed"}${existingCount ? `, ${existingCount} already present` : ""}.`);
    }

    ui.items?.render?.();
    return {
        created,
        existing: existingCount,
        total: MAGE_BACKGROUNDS.length,
        folderId: folder.id
    };
}
