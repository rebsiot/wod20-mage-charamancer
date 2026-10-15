import {traitInfo,SPECIALTY_SUGGESTIONS} from './catalog.js';
import { ATTRIBUTE_GROUPS, capitalize } from "./rules.js";
import { XP_RULES, xpStepCost, xpRangeCost, xpFormulaLabel } from "./xp-rules.js";
import {
    applyMageAdvancement,
    isPcMage,
    makeAdvancementSnapshot
} from "./advancement-builder.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "wod20-mage-charamancer";
const STORY_NOTE_MAX = 30;

function localIsoDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const STEPS = [
    { id: "attributes", label: "Attributes" },
    { id: "abilities", label: "Abilities" },
    { id: "magic", label: "Spheres & Arete" },
    { id: "review", label: "Review" }
];

function normalize(value) {
    return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function validMageActors() {
    return game.actors
        .filter(actor => isPcMage(actor) && (game.user.isGM || actor.isOwner))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function initialAdvancementState(snapshot) {
    return {
        actorId: snapshot.actorId,
        affinitySphereId: snapshot.affinitySphereId ?? "",
        attributes: Object.fromEntries(
            Object.values(snapshot.attributes).map(trait => [trait.id, trait.value])
        ),
        abilities: Object.fromEntries(
            Object.values(snapshot.abilities).map(trait => [trait.id, trait.value])
        ),
        spheres: Object.fromEntries(
            Object.values(snapshot.spheres).map(trait => [trait.id, trait.value])
        ),
        core: {
            arete: snapshot.core.arete.value,
            willpower: snapshot.core.willpower.value
        },
        specialties: {
            attributes: Object.fromEntries(
                Object.values(snapshot.attributes).map(trait => [trait.id, trait.speciality ?? ""])
            ),
            abilities: Object.fromEntries(
                Object.values(snapshot.abilities).map(trait => [trait.id, trait.speciality ?? ""])
            )
        },
        storyNote: ""
    };
}

export function buildPlan(snapshot, state) {
    const purchases = [];

    for (const trait of Object.values(snapshot.attributes)) {
        const target = Number(state.attributes[trait.id] ?? trait.value);
        if (target <= trait.value) continue;
        purchases.push({
            kind: "attribute",
            key: trait.id,
            name: trait.name,
            from: trait.value,
            to: target,
            cost: xpRangeCost("attribute", trait.value, target)
        });
    }

    for (const trait of Object.values(snapshot.abilities)) {
        const target = Number(state.abilities[trait.id] ?? trait.value);
        if (target <= trait.value) continue;
        purchases.push({
            kind: "ability",
            key: trait.id,
            name: trait.name,
            from: trait.value,
            to: target,
            cost: xpRangeCost("ability", trait.value, target)
        });
    }

    for (const trait of Object.values(snapshot.spheres)) {
        const target = Number(state.spheres[trait.id] ?? trait.value);
        if (target <= trait.value) continue;
        const affinity = state.affinitySphereId === trait.id;
        purchases.push({
            kind: "sphere",
            key: trait.id,
            name: trait.name,
            from: trait.value,
            to: target,
            affinity,
            cost: xpRangeCost("sphere", trait.value, target, { affinity })
        });
    }

    const areteTarget = Number(state.core.arete ?? snapshot.core.arete.value);
    if (areteTarget > snapshot.core.arete.value) {
        purchases.push({
            kind: "arete",
            key: "arete",
            name: "Arete",
            from: snapshot.core.arete.value,
            to: areteTarget,
            cost: xpRangeCost("arete", snapshot.core.arete.value, areteTarget)
        });
    }

    const willpowerTarget = Number(state.core.willpower ?? snapshot.core.willpower.value);
    if (willpowerTarget > snapshot.core.willpower.value) {
        purchases.push({
            kind: "willpower",
            key: "willpower",
            name: "Willpower",
            from: snapshot.core.willpower.value,
            to: willpowerTarget,
            cost: xpRangeCost("willpower", snapshot.core.willpower.value, willpowerTarget)
        });
    }

    const totalCost = purchases.reduce((total, purchase) => total + purchase.cost, 0);
    const highestSphere = Math.max(0, ...Object.values(state.spheres).map(Number));
    const errors = [];
    const warnings = [];

    for(const [group,traits] of [['attributes',snapshot.attributes],['abilities',snapshot.abilities]])for(const t of Object.values(traits))if(Number(state[group][t.id]??t.value)>=4&&!String(state.specialties?.[group]?.[t.id]??t.speciality??'').trim())errors.push('Choose a specialty: '+t.name+'.');
    if(snapshot.affinitySphereId&&state.affinitySphereId!==snapshot.affinitySphereId)errors.push('Affinity Sphere must match the actor.');
    if (highestSphere > areteTarget) {
        errors.push(`Highest Sphere is ${highestSphere}, but planned Arete is only ${areteTarget}. Raise Arete first.`);
    }
    if (totalCost > snapshot.xp.available) {
        errors.push(`Selected advancement costs ${totalCost} XP, but only ${snapshot.xp.available} XP are available.`);
    }
    if (purchases.some(purchase => purchase.kind === "arete")) {
        warnings.push("Arete advancement normally requires Storyteller approval and a successful Seeking. The charamancer records the XP purchase but does not adjudicate the Seeking.");
    }

    return {
        purchases,
        totalCost,
        remaining: Math.max(0, snapshot.xp.available - totalCost),
        highestSphere,
        errors,
        warnings,
        valid: purchases.length > 0 && errors.length === 0,
        specialties: foundry.utils.deepClone(state.specialties),
        affinitySphereId: state.affinitySphereId
    };
}

function isEditableTarget(target) {
    return target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true;
}

function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && !element.hidden;
}

function dotTitle(kind, base, current, target, cost, available, { affinity = false, blockedReason = "" } = {}) {
    if (target <= base) return `Existing rating ${target} — already owned; no XP cost.`;
    if (target <= current) {
        const thisDot = xpStepCost(kind, target - 1, { affinity });
        const total = xpRangeCost(kind, base, target, { affinity });
        return target === current
            ? `Purchased advancement dot — this dot costs ${thisDot} XP (${total} XP total above the original rating). Click again to refund this dot.`
            : `Purchased advancement dot — this dot costs ${thisDot} XP and is included in the current XP plan.`;
    }
    if (blockedReason) return blockedReason;

    const dots = target - current;
    if (dots === 1) {
        return cost > available
            ? `This dot costs ${cost} XP; only ${available} XP remain.`
            : `Buy this dot for ${cost} XP.`;
    }

    return cost > available
        ? `Raise through rating ${target}: ${cost} XP total; only ${available} XP remain.`
        : `Raise through rating ${target}: ${cost} XP total.`;
}

export class MageAdvancement extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "wod20-mage-advancement",
        classes: ["wod20-mage-charamancer", "wod20-mage-advancement"],
        position: {
            width: 1248,
            height: 948
        },
        window: {
            title: "Spend XP",
            icon: "fa-solid fa-chart-line",
            resizable: true
        }
    };

    static PARTS = {
        main: {
            template: "modules/wod20-mage-charamancer/templates/advancement.hbs"
        }
    };

    constructor(actor = null, options = {}) {
        super(options);
        this.actor = null;
        this.snapshot = null;
        this.advancementState = null;
        this.stepIndex = 0;
        this.applying = false;
        this._pendingScroll = null;
        this._keyGuard = event => {
            if (!this.rendered) return;

            if (/^[0-9]$/.test(event.key) && !isEditableTarget(event.target)) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return;
            }

            if (event.key !== "Tab") return;
            const root = this.element;
            if (!root) return;
            const focusable = Array.from(root.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )).filter(isVisible);
            if (!focusable.length) return;

            const current = document.activeElement;
            let index = focusable.indexOf(current);
            if (event.shiftKey) index = index <= 0 ? focusable.length - 1 : index - 1;
            else index = index < 0 || index >= focusable.length - 1 ? 0 : index + 1;

            event.preventDefault();
            event.stopPropagation();
            focusable[index]?.focus();
        };
        document.addEventListener("keydown", this._keyGuard, true);

        if (actor && isPcMage(actor)) this._loadActor(actor);
    }

    get currentStep() {
        return STEPS[this.stepIndex] ?? STEPS[0];
    }

    _loadActor(actor) {
        if (!isPcMage(actor)) throw new Error(`${actor?.name ?? "Selected Actor"} is not a current PC Mage.`);
        if (!game.user.isGM && !actor.isOwner) throw new Error(`You do not have permission to advance ${actor.name}.`);

        this.actor = actor;
        this.snapshot = makeAdvancementSnapshot(actor);
        this.advancementState = initialAdvancementState(this.snapshot);
        this.stepIndex = 0;
        this.applying = false;
    }

    _captureScroll() {
        const main = this.element?.querySelector(".mc-main");
        const sidebar = this.element?.querySelector(".mc-sidebar");
        this._pendingScroll = {
            main: main?.scrollTop ?? 0,
            sidebar: sidebar?.scrollTop ?? 0
        };
    }

    _renderPreservingScroll() {
        this._captureScroll();
        return this.render();
    }

    _getRating(kind, key) {
        if (!this.advancementState) return 0;
        if (kind === "attribute") return Number(this.advancementState.attributes[key] ?? 0);
        if (kind === "ability") return Number(this.advancementState.abilities[key] ?? 0);
        if (kind === "sphere") return Number(this.advancementState.spheres[key] ?? 0);
        if (kind === "core") return Number(this.advancementState.core[key] ?? 0);
        return 0;
    }

    _baseRating(kind, key) {
        if (!this.snapshot) return 0;
        if (kind === "attribute") return Number(this.snapshot.attributes[key]?.value ?? 0);
        if (kind === "ability") return Number(this.snapshot.abilities[key]?.value ?? 0);
        if (kind === "sphere") return Number(this.snapshot.spheres[key]?.value ?? 0);
        if (kind === "core") return Number(this.snapshot.core[key]?.value ?? 0);
        return 0;
    }

    _maxRating(kind, key) {
        if (!this.snapshot) return 5;
        if (kind === "attribute") return Number(this.snapshot.attributes[key]?.max ?? 5);
        if (kind === "ability") return Number(this.snapshot.abilities[key]?.max ?? 5);
        if (kind === "sphere") return Number(this.snapshot.spheres[key]?.max ?? 5);
        if (kind === "core") return Number(this.snapshot.core[key]?.max ?? 10);
        return 5;
    }

    _kindForCost(kind, key) {
        if (kind === "core") return key;
        return kind;
    }

    _makeDots(kind, key, plan) {
        const base = this._baseRating(kind, key);
        const current = this._getRating(kind, key);
        const max = this._maxRating(kind, key);
        const costKind = this._kindForCost(kind, key);
        const affinity = kind === "sphere" && this.advancementState.affinitySphereId === key;
        const available = plan.remaining;

        return Array.from({ length: max }, (_, index) => {
            const value = index + 1;
            const filled = value <= current;
            const baseDot = filled && value <= base;
            const xpDot = filled && value > base;
            let disabled = value <= base;
            let unavailable = false;
            let blockedReason = "";
            let cost = 0;

            if (!filled && value > current) {
                cost = xpRangeCost(costKind, current, value, { affinity });

                if (kind === "sphere" && value > Number(this.advancementState.core.arete ?? 0)) {
                    blockedReason = `Raise Arete to at least ${value} before buying ${this.snapshot.spheres[key]?.name ?? "this Sphere"} ${value}.`;
                    disabled = true;
                    unavailable = true;
                }
                else if (cost > available) {
                    disabled = true;
                    unavailable = true;
                }
            }

            return {
                value,
                filled,
                base: baseDot,
                xp: xpDot,
                disabled,
                unavailable,
                tooltip: dotTitle(costKind, base, current, value, cost, available, { affinity, blockedReason })
            };
        });
    }

    _setRating(kind, key, requestedValue) {
        if (!this.snapshot || !this.advancementState) return;
        const base = this._baseRating(kind, key);
        const max = this._maxRating(kind, key);
        const current = this._getRating(kind, key);
        const requested = Math.max(base, Math.min(max, Number(requestedValue)));
        if (!Number.isFinite(requested)) return;

        const plan = buildPlan(this.snapshot, this.advancementState);
        const costKind = this._kindForCost(kind, key);
        const affinity = kind === "sphere" && this.advancementState.affinitySphereId === key;

        if (kind === "sphere" && requested > Number(this.advancementState.core.arete ?? 0)) {
            ui.notifications.warn(`Raise Arete to ${requested} first. A Sphere cannot exceed Arete.`);
            return;
        }

        if (kind === "core" && key === "arete" && requested < current) {
            const highestSphere = Math.max(0, ...Object.values(this.advancementState.spheres).map(Number));
            if (requested < highestSphere) {
                ui.notifications.warn(`Arete cannot be lowered to ${requested} while a planned Sphere is ${highestSphere}. Lower that Sphere first.`);
                return;
            }
        }

        if (requested > current) {
            const needed = xpRangeCost(costKind, current, requested, { affinity });
            if (needed > plan.remaining) {
                ui.notifications.warn(`That purchase costs ${needed} XP, but only ${plan.remaining} XP remain.`);
                return;
            }
        }

        if (kind === "attribute") this.advancementState.attributes[key] = requested;
        else if (kind === "ability") this.advancementState.abilities[key] = requested;
        else if (kind === "sphere") this.advancementState.spheres[key] = requested;
        else if (kind === "core") this.advancementState.core[key] = requested;
        else return;

        this._renderPreservingScroll();
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        if (!this.snapshot || !this.actor || !this.advancementState) {
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

        const plan = buildPlan(this.snapshot, this.advancementState);
        const attrGroups = ["physical", "social", "mental"].map(group => ({
            id: group,
            name: capitalize(group),
            attributes: ATTRIBUTE_GROUPS[group]
                .map(id => this.snapshot.attributes[id])
                .filter(Boolean)
                .map(trait => {
                    const value = this._getRating("attribute", trait.id);
                    const purchase = plan.purchases.find(item => item.kind === "attribute" && item.key === trait.id);
                    return {
                        ...trait,
                        ...traitInfo(group === "physical" || group === "social" || group === "mental" ? "attribute" : "ability",trait.id,trait.info,trait.name),
                        ratingLabel:traitInfo(group === "physical" || group === "social" || group === "mental" ? "attribute" : "ability",trait.id,"",trait.name).ranks[value-1]||(value?value+" dots":"Untrained"),
                        value,
                        purchaseCost: purchase?.cost ?? 0,
                        dots: this._makeDots("attribute", trait.id, plan)
                    };
                })
        }));

        const abilityGroups = ["talent", "skill", "knowledge"].map(group => ({
            id: group,
            name: capitalize(group) + "s",
            abilities: Object.values(this.snapshot.abilities)
                .filter(trait => trait.category === group)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(trait => {
                    const value = this._getRating("ability", trait.id);
                    const purchase = plan.purchases.find(item => item.kind === "ability" && item.key === trait.id);
                    return {
                        ...trait,
                        ...traitInfo(group === "physical" || group === "social" || group === "mental" ? "attribute" : "ability",trait.id,trait.info,trait.name),
                        ratingLabel:traitInfo(group === "physical" || group === "social" || group === "mental" ? "attribute" : "ability",trait.id,"",trait.name).ranks[value-1]||(value?value+" dots":"Untrained"),
                        value,
                        purchaseCost: purchase?.cost ?? 0,
                        dots: this._makeDots("ability", trait.id, plan)
                    };
                })
        }));

        const spheres = Object.values(this.snapshot.spheres)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(trait => {
                const value = this._getRating("sphere", trait.id);
                const affinity = this.advancementState.affinitySphereId === trait.id;
                const purchase = plan.purchases.find(item => item.kind === "sphere" && item.key === trait.id);
                return {
                    ...trait,
                    ...traitInfo("sphere",trait.id),
                    value,
                    affinity,
                    purchaseCost: purchase?.cost ?? 0,
                    formula: xpFormulaLabel("sphere", { affinity }),
                    dots: this._makeDots("sphere", trait.id, plan)
                };
            });

        const affinityOptions = [
            { value: "", label: "No Affinity / use normal Sphere rate", selected: !this.advancementState.affinitySphereId },
            ...spheres.map(sphere => ({
                value: sphere.id,
                label: sphere.name,
                selected: this.advancementState.affinitySphereId === sphere.id
            }))
        ];

        const specialtyChoices = [
            ...Object.values(this.snapshot.attributes)
                .filter(trait => this._getRating("attribute", trait.id) >= 4)
                .map(trait => ({
                    kind: "Attribute",
                    name: trait.name,
                    rating: this._getRating("attribute", trait.id),
                    suggestions:SPECIALTY_SUGGESTIONS[traitInfo("ability",trait.id,"",trait.name).catalogId]||SPECIALTY_SUGGESTIONS[trait.id]||[],
                    listId:"mc-plan-specialty-"+trait.id,
                    path: `specialties.attributes.${trait.id}`,
                    value: this.advancementState.specialties.attributes[trait.id] ?? ""
                })),
            ...Object.values(this.snapshot.abilities)
                .filter(trait => this._getRating("ability", trait.id) >= 4)
                .map(trait => ({
                    kind: "Ability",
                    name: trait.name,
                    rating: this._getRating("ability", trait.id),
                    suggestions:SPECIALTY_SUGGESTIONS[traitInfo("ability",trait.id,"",trait.name).catalogId]||SPECIALTY_SUGGESTIONS[trait.id]||[],
                    listId:"mc-plan-specialty-"+trait.id,
                    path: `specialties.abilities.${trait.id}`,
                    value: this.advancementState.specialties.abilities[trait.id] ?? ""
                }))
        ];

        const aretePurchase = plan.purchases.find(item => item.kind === "arete");
        const willpowerPurchase = plan.purchases.find(item => item.kind === "willpower");
        const steps = STEPS.map((step, index) => ({
            ...step,
            number: index + 1,
            active: index === this.stepIndex,
            complete: index < this.stepIndex
        }));

        return {
            ...context,
            selectMode: false,
            actor: this.actor,
            actorName: this.actor.name,
            snapshot: this.snapshot,
            state: this.advancementState,
            steps,
            currentStep: this.currentStep,
            stepAttributes: this.currentStep.id === "attributes",
            stepAbilities: this.currentStep.id === "abilities",
            stepMagic: this.currentStep.id === "magic",
            stepReview: this.currentStep.id === "review",
            attrGroups,
            abilityGroups,
            spheres,
            affinityOptions,
            plan,
            xp: this.snapshot.xp,
            xpRules: XP_RULES,
            areteValue: this._getRating("core", "arete"),
            willpowerValue: this._getRating("core", "willpower"),
            areteDots: this._makeDots("core", "arete", plan),
            willpowerDots: this._makeDots("core", "willpower", plan),
            aretePurchaseCost: aretePurchase?.cost ?? 0,
            willpowerPurchaseCost: willpowerPurchase?.cost ?? 0,
            specialtyChoices,
            hasSpecialtyChoices: specialtyChoices.length > 0,
            advancementDate: localIsoDate(),
            storyNoteMax: STORY_NOTE_MAX,
            storyNoteLength: String(this.advancementState.storyNote ?? "").length,
            canBack: this.stepIndex > 0,
            canNext: this.stepIndex < STEPS.length - 1,
            canApply: this.currentStep.id === "review" && plan.valid && !this.applying,
            applying: this.applying
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const root = this.element;
        if (!root) return;

        if (context.selectMode) {
            root.querySelector("[data-load-mage]")?.addEventListener("click", async () => {
                const select = root.querySelector("[data-mage-select]");
                const id = select?.value;
                const actor = game.actors.get(id);
                if (!actor) {
                    ui.notifications.warn("Choose a Mage to advance.");
                    return;
                }
                try {
                    this._loadActor(actor);
                    await this.render();
                }
                catch (error) {
                    console.error(`${MODULE_ID} | Could not load Mage for advancement`, error);
                    ui.notifications.error(`Could not load Mage: ${error.message}`);
                }
            });
            return;
        }

        root.querySelectorAll("[data-rating-kind]").forEach(button => {
            button.addEventListener("click", event => {
                const target = event.currentTarget;
                const kind = target.dataset.ratingKind;
                const key = target.dataset.ratingKey;
                const requested = Number(target.dataset.ratingValue);
                const current = this._getRating(kind, key);
                const base = this._baseRating(kind, key);
                const next = requested === current ? Math.max(base, current - 1) : requested;
                this._setRating(kind, key, next);
            });
        });

        root.querySelector("[data-affinity-sphere]")?.addEventListener("change", event => {
            this.advancementState.affinitySphereId = event.currentTarget.value;
            this._renderPreservingScroll();
        });

        root.querySelectorAll("[data-path]").forEach(input => {
            input.addEventListener("input", event => {
                const element = event.currentTarget;
                let value = element.value;
                if (element.dataset.path === "storyNote") {
                    value = value.slice(0, STORY_NOTE_MAX);
                    if (element.value !== value) element.value = value;
                    const counter = root.querySelector("[data-story-count]");
                    if (counter) counter.textContent = `${value.length} / ${STORY_NOTE_MAX}`;
                    const preview = root.querySelector("[data-story-preview]");
                    if (preview) preview.textContent = value;
                    const previewRow = root.querySelector("[data-story-preview-row]");
                    if (previewRow) previewRow.classList.toggle("hidden", !value.trim());
                }
                foundry.utils.setProperty(this.advancementState, element.dataset.path, value);
                const apply=root.querySelector("[data-apply-advancement]");if(apply)apply.disabled=!buildPlan(this.snapshot,this.advancementState).valid||this.applying;
            });
        });

        root.querySelectorAll("[data-step-index]").forEach(button => {
            button.addEventListener("click", event => {
                this.stepIndex = Number(event.currentTarget.dataset.stepIndex);
                this.render();
            });
        });

        root.querySelector("[data-nav='back']")?.addEventListener("click", () => {
            this.stepIndex = Math.max(0, this.stepIndex - 1);
            this.render();
        });

        root.querySelector("[data-nav='next']")?.addEventListener("click", () => {
            this.stepIndex = Math.min(STEPS.length - 1, this.stepIndex + 1);
            this.render();
        });

        root.querySelector("[data-change-mage]")?.addEventListener("click", async () => {
            const confirmed = buildPlan(this.snapshot, this.advancementState).purchases.length === 0 ||
                window.confirm("Choose a different Mage? The current un-applied XP plan will be discarded.");
            if (!confirmed) return;
            this.actor = null;
            this.snapshot = null;
            this.advancementState = null;
            this.stepIndex = 0;
            await this.render();
        });

        root.querySelector("[data-apply-advancement]")?.addEventListener("click", async () => {
            await this._applyAdvancement();
        });

        if (this._pendingScroll) {
            const restore = this._pendingScroll;
            this._pendingScroll = null;
            requestAnimationFrame(() => {
                const currentRoot = this.element;
                const main = currentRoot?.querySelector(".mc-main");
                const sidebar = currentRoot?.querySelector(".mc-sidebar");
                if (main) main.scrollTop = restore.main;
                if (sidebar) sidebar.scrollTop = restore.sidebar;
            });
        }
    }

    async _applyAdvancement() {
        if (this.applying || !this.actor || !this.snapshot || !this.advancementState) return;
        const plan = buildPlan(this.snapshot, this.advancementState);
        if (!plan.valid) {
            ui.notifications.error(plan.errors[0] ?? "Choose at least one XP purchase before applying advancement.");
            return;
        }

        const confirmed = window.confirm(
            `Apply ${plan.totalCost} XP of advancement to ${this.actor.name}? This will update the character and add dated Spent Experience ledger entries for the purchases.`
        );
        if (!confirmed) return;

        this.applying = true;
        await this.render();

        try {
            const result = await applyMageAdvancement(this.actor, this.snapshot, {
                ...plan,
                specialties: foundry.utils.deepClone(this.advancementState.specialties),
                affinitySphereId: this.advancementState.affinitySphereId,
                advancementDate: localIsoDate(),
                storyNote: String(this.advancementState.storyNote ?? "").trim().slice(0, STORY_NOTE_MAX)
            });
            ui.notifications.info(`${this.actor.name} advanced for ${plan.totalCost} XP. ${result.remainingXp} XP remain.`);
            this.actor.sheet?.render(true);
            await this.close();
        }
        catch (error) {
            console.error(`${MODULE_ID} | Could not apply advancement`, error);
            ui.notifications.error(`Mage advancement failed: ${error.message}`);
            this.applying = false;
            await this.render();
        }
    }

    async close(options = {}) {
        document.removeEventListener("keydown", this._keyGuard, true);
        return super.close(options);
    }
}
