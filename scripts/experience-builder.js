import { getExperienceSummary, isPcMage } from "./advancement-builder.js";

const MODULE_ID = "wod20-mage-charamancer";
const STORY_NOTE_MAX = 28;

export async function addMageExperience(actor, { amount, storyNote = "", biographyNote = "", awardDate = "" } = {}) {
    if (!isPcMage(actor)) throw new Error(`${actor?.name ?? "Selected Actor"} is not a current WoD20 PC Mage.`);
    if (!game.user.isGM && !actor.isOwner) throw new Error(`You do not have permission to edit ${actor.name}.`);

    const xpAmount = Number(amount);
    if (!Number.isSafeInteger(xpAmount) || xpAmount <= 0) throw new Error("Experience gained must be a positive whole number.");

    const note = String(storyNote ?? "").trim().slice(0, STORY_NOTE_MAX);
    const date = String(awardDate ?? "").trim();
    if (!date) throw new Error("An automatic award date is required.");

    const longNote = String(biographyNote ?? "").trim().slice(0, 4000);
    const previousBiography = String(actor.system?.bio?.background??"");
    const previousNarrative = foundry.utils.deepClone(actor.flags?.[MODULE_ID]?.narrative??{});
    let biographyWritten = false;
    const batchId = foundry.utils.randomID();
    const created = [];
    const storyDescription = `${date} — ${note || "Experience gained"}`;

    const makeExperienceData = ({ description, amount: rowAmount, entryKind }) => ({
        name: entryKind === "date"
            ? `XP Gained - ${date}`
            : `XP Gained - ${note || "Experience gained"}`,
        type: "Experience",
        system: {
            type: "wod.types.expgained",
            amount: rowAmount,
            isspent: false,
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
                experienceAward: true,
                experienceAwardBatchId: batchId,
                entryKind,
                awardDate: date,
                storyNote: note,
                awardedXp: xpAmount,
                hasBiographyNote: Boolean(longNote)
            }
        }
    });

    try {
        // A single dated award entry is easier to read in the native WoD20
        // Experience ledger than a separate zero-XP date row.
        const [storyItem] = await actor.createEmbeddedDocuments("Item", [makeExperienceData({
            description: storyDescription,
            amount: xpAmount,
            entryKind: "award"
        })]);
        if (storyItem) created.push(storyItem);

        if (longNote) {
            const entry = `${date} — XP award (+${xpAmount}): ${longNote}`;
            const biography = [previousBiography.trim(), entry].filter(Boolean).join("\n\n");
            await actor.update({"system.bio.background":biography,
                [`flags.${MODULE_ID}.narrative`]:{...previousNarrative,biography}});
            biographyWritten = true;
        }
        return {
            created,
            amount: xpAmount,
            awardDate: date,
            storyNote: note,
            xp: getExperienceSummary(actor)
        };
    }
    catch (error) {
        console.error(`${MODULE_ID} | Adding earned XP failed; attempting rollback`, error);
        if (biographyWritten) {
            try {await actor.update({"system.bio.background":previousBiography,[`flags.${MODULE_ID}.narrative`]:previousNarrative});}
            catch (restoreError) {console.error(`${MODULE_ID} | Biography rollback failed`,restoreError);}
        }
        if (created.length) {
            try {
                await actor.deleteEmbeddedDocuments("Item", created.map(item => item.id));
            }
            catch (rollbackError) {
                console.error(`${MODULE_ID} | Could not roll back earned XP rows`, rollbackError);
            }
        }
        throw error;
    }
}

export { STORY_NOTE_MAX };
