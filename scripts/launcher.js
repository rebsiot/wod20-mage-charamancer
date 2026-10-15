const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MageToolLauncher extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "wod20-mage-tools-launcher",
        classes: ["wod20-mage-charamancer", "wod20-mage-tools-launcher"],
        position: {
            width: 560,
            height: 750
        },
        window: {
            title: "Mage Character Tools",
            icon: "fa-solid fa-hat-wizard",
            resizable: true
        }
    };

    static PARTS = {
        main: {
            template: "modules/wod20-mage-charamancer/templates/launcher.hbs"
        }
    };

    constructor({ onCreate, onImport, onExport, onPrint, onDetails, onAdvance, onAddExperience, onInstallGear } = {}, options = {}) {
        super(options);
        this.onCreate = onCreate;
        this.onImport = onImport;
        this.onExport = onExport;
        this.onPrint = onPrint;
        this.onDetails=onDetails;
        this.onAdvance = onAdvance;
        this.onAddExperience = onAddExperience;
        this.onInstallGear = onInstallGear;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const selected = canvas?.tokens?.controlled?.[0]?.actor;
        const selectedIsMage = selected?.type === "PC" &&
            [selected.system?.settings?.splat, selected.system?.settings?.game, selected.system?.settings?.variantsheet]
                .some(value => String(value ?? "").toLowerCase() === "mage");

        return {
            ...context,
            selectedMageName: selectedIsMage ? selected.name : "",
            selectedMageId: selectedIsMage ? selected.id : "",
            canInstallGear: game.user.isGM
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const root = this.element;
        if (!root) return;

        root.querySelector('[data-mage-details]')?.addEventListener('click',async()=>{const actor=context.selectedMageId?game.actors.get(context.selectedMageId):null;await this.close();await this.onDetails?.(actor);});
        root.querySelector("[data-create-new]")?.addEventListener("click", async () => {
            await this.close();
            await this.onCreate?.();
        });

        root.querySelector("[data-import-web]")?.addEventListener("click", async () => {
            await this.close();
            await this.onImport?.();
        });

        root.querySelector('[data-export-character]')?.addEventListener('click',async()=>{
            const actor=context.selectedMageId?game.actors.get(context.selectedMageId):null;
            await this.close();await this.onExport?.(actor);
        });

        root.querySelector('[data-print-m20]')?.addEventListener('click',()=>{
            const selected = canvas?.tokens?.controlled?.[0]?.actor;
            const actor = selected?.id === context.selectedMageId ? selected :
                (context.selectedMageId ? game.actors.get(context.selectedMageId) : null);
            // Must open the printable tab in this click handler, before any awaits.
            this.onPrint?.(actor);
            this.close();
        });

        root.querySelector("[data-advance-existing]")?.addEventListener("click", async () => {
            const controlled = canvas?.tokens?.controlled?.[0]?.actor;
            const actor = controlled?.id === context.selectedMageId
                ? controlled
                : (context.selectedMageId ? game.actors.get(context.selectedMageId) : null);
            await this.close();
            await this.onAdvance?.(actor);
        });

        root.querySelector("[data-add-experience]")?.addEventListener("click", async () => {
            const controlled = canvas?.tokens?.controlled?.[0]?.actor;
            const actor = controlled?.id === context.selectedMageId
                ? controlled
                : (context.selectedMageId ? game.actors.get(context.selectedMageId) : null);
            await this.close();
            await this.onAddExperience?.(actor);
        });

        root.querySelector("[data-install-gear]")?.addEventListener("click", async () => {
            await this.close();
            await this.onInstallGear?.();
        });
    }
}
