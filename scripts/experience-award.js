import { getExperienceSummary, isPcMage } from "./advancement-builder.js";
import { addMageExperience, STORY_NOTE_MAX } from "./experience-builder.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "wod20-mage-charamancer";

function localIsoDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function validMageActors() {
    return game.actors
        .filter(actor => isPcMage(actor) && (game.user.isGM || actor.isOwner))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export class MageExperienceAward extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "wod20-mage-experience-award",
        classes: ["wod20-mage-charamancer", "wod20-mage-experience-award"],
        position: {
            width: 720,
            height: 620
        },
        window: {
            title: "Add XP",
            icon: "fa-solid fa-bolt",
            resizable: true
        }
    };

    static PARTS = {
        main: {
            template: "modules/wod20-mage-charamancer/templates/experience-award.hbs"
        }
    };

    constructor(actor = null, options = {}) {
        super(options);
        this.actor = null;
        this.awardState = {
            amount: "",
            storyNote: "",
            biographyNote: ""
        };
        this.applying = false;

        if (actor && isPcMage(actor)) this._loadActor(actor);
    }

    _loadActor(actor) {
        if (!isPcMage(actor)) throw new Error(`${actor?.name ?? "Selected Actor"} is not a current PC Mage.`);
        if (!game.user.isGM && !actor.isOwner) throw new Error(`You do not have permission to edit ${actor.name}.`);
        this.actor = actor;
        this.awardState = {
            amount: "",
            storyNote: "",
            biographyNote: ""
        };
        this.applying = false;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        if (!this.actor) {
            const controlled = canvas?.tokens?.controlled?.[0]?.actor;
            const actors = validMageActors().map(actor => ({
                id: actor.id,
                name: actor.name,
                selected: controlled?.id === actor.id
            }));

            return {
                ...context,
                selectMode: true,
                mageActors: actors,
                hasMageActors: actors.length > 0,
                controlledMageName: isPcMage(controlled) ? controlled.name : ""
            };
        }

        const xp = getExperienceSummary(this.actor);
        const amount = Math.max(0, Math.trunc(Number(this.awardState.amount) || 0));
        const storyNote = String(this.awardState.storyNote ?? "").slice(0, STORY_NOTE_MAX);
        const previewStory = storyNote.trim() || "Experience gained";

        return {
            ...context,
            selectMode: false,
            actorName: this.actor.name,
            xp,
            awardDate: localIsoDate(),
            amount,
            rawAmount: this.awardState.amount,
            storyNote,
            biographyNote:this.awardState.biographyNote||"",
            storyNoteLength: storyNote.length,
            storyNoteMax: STORY_NOTE_MAX,
            previewStory,
            canApply: amount > 0 && !this.applying,
            applying: this.applying
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const root = this.element;
        if (!root) return;

        if (context.selectMode) {
            root.querySelector("[data-load-mage]")?.addEventListener("click", async () => {
                const id = root.querySelector("[data-mage-select]")?.value;
                const actor = game.actors.get(id);
                if (!actor) {
                    ui.notifications.warn("Choose a Mage to receive experience.");
                    return;
                }
                try {
                    this._loadActor(actor);
                    await this.render();
                }
                catch (error) {
                    console.error(`${MODULE_ID} | Could not load Mage for XP award`, error);
                    ui.notifications.error(`Could not load Mage: ${error.message}`);
                }
            });
            return;
        }

        const amountInput = root.querySelector("[data-award-amount]");
        const storyInput = root.querySelector("[data-award-story]");
        const longInput = root.querySelector("[data-award-biography]");
        const applyButton = root.querySelector("[data-apply-award]");
        const previewAmount = root.querySelector("[data-award-preview-amount]");
        const previewStory = root.querySelector("[data-award-preview-story]");
        const counter = root.querySelector("[data-story-count]");
        const resulting = root.querySelector("[data-resulting-xp]");

        const sync = () => {
            let note = String(storyInput?.value ?? "").slice(0, STORY_NOTE_MAX);
            if (storyInput && storyInput.value !== note) storyInput.value = note;
            this.awardState.storyNote = note;
            this.awardState.biographyNote=String(longInput?.value??"").slice(0,4000);

            const amount = Math.max(0, Math.trunc(Number(amountInput?.value) || 0));
            this.awardState.amount = amountInput?.value ?? "";

            if (counter) counter.textContent = `${note.length} / ${STORY_NOTE_MAX}`;
            if (previewStory) previewStory.textContent = note.trim() || "Experience gained";
            if (previewAmount) previewAmount.textContent = String(amount);
            if (resulting) resulting.textContent = String(context.xp.available + amount);
            if (applyButton) {
                applyButton.disabled = amount <= 0 || this.applying;
                const label = applyButton.querySelector("[data-award-button-label]");
                if (label) label.textContent = amount > 0 ? `Add ${amount} XP` : "Add XP";
            }
        };

        amountInput?.addEventListener("input", sync);
        storyInput?.addEventListener("input", sync);
        longInput?.addEventListener("input", sync);
        sync();

        root.querySelector("[data-change-mage]")?.addEventListener("click", async () => {
            this.actor = null;
            this.awardState = { amount: "", storyNote: "", biographyNote: "" };
            await this.render();
        });

        applyButton?.addEventListener("click", async () => {
            await this._applyAward();
        });
    }

    async _applyAward() {
        if (this.applying || !this.actor) return;

        const amount = Math.max(0, Math.trunc(Number(this.awardState.amount) || 0));
        const storyNote = String(this.awardState.storyNote ?? "").trim().slice(0, STORY_NOTE_MAX);
        if (amount <= 0) {
            ui.notifications.warn("Enter a positive whole number of XP to add.");
            return;
        }

        const biographyNote=String(this.awardState.biographyNote||"").trim().slice(0,4000);
        const label = storyNote || "Experience gained";
        const confirmed = window.confirm(`Add ${amount} XP to ${this.actor.name}?\n\n${localIsoDate()}\n${label}`);
        if (!confirmed) return;

        this.applying = true;
        await this.render();

        try {
            const result = await addMageExperience(this.actor, {
                amount,
                storyNote,
                biographyNote,
                awardDate: localIsoDate()
            });
            ui.notifications.info(`${amount} XP added to ${this.actor.name}. ${result.xp.available} XP are now available.`);
            this.actor.sheet?.render(true);
            await this.close();
        }
        catch (error) {
            console.error(`${MODULE_ID} | Could not add Mage experience`, error);
            ui.notifications.error(`Could not add experience: ${error.message}`);
            this.applying = false;
            await this.render();
        }
    }
}
