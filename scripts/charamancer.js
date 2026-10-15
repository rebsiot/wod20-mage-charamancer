import {enrichCreationData,identityOptions,factionGroups,factionsFor,meritFlawCatalog,meritTotals,validateMerits,creationTrait,migrateAbilityAliases} from './creation-extras.js';
import {SPECIALTY_SUGGESTIONS} from './catalog.js';
import {setupConceptDropdowns} from './concept-dropdown.js';
import {setupSpecialtyDropdowns} from './specialty-dropdown.js';
import {setupBackgroundDropdown} from './background-dropdown.js';
import {
    ATTRIBUTE_GROUPS,
    PRIORITY_LABELS,
    RULES,
    capitalize,
    evaluateBaseCharacter,
    evaluateFreebies,
    priorityIsValid,
    startingArete
} from "./rules.js";
import { createMageActor } from "./actor-builder.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const MODULE_ID = "wod20-mage-charamancer";
const DRAFT_VERSION = 4;

const STEPS = [
    { id: "concept", label: "Concept" },
    { id: "attributes", label: "Attributes" },
    { id: "abilities", label: "Abilities" },
    { id: "magic", label: "Magic & Backgrounds" },
    { id: "base-review", label: "Base Review" },
    { id: "freebies", label: "Freebies" },
    { id: "final-review", label: "Final Review" }
];

export function makeInitialState(data) {
    return {
        phase: "base",
        freeArete2: false,
        baseSnapshot: null,
        customBackgrounds: [],
        selectedBackgrounds: [],
        selectedAbilities: [],
        meritsFlaws: [],
        flawBonusCap: 7,
        identity: {
            player: "", chronicle: "", sect: "", appearance: "", biography: "", rpTips: "",
            name: "",
            concept: "",
            nature: "",
            demeanor: "",
            affiliation: "",
            essence: "",
            affinitySphere: "",
            paradigm: "",
            practice: "",
            instruments: ""
        },
        attributePriorities: {
            physical: "",
            social: "",
            mental: ""
        },
        abilityPriorities: {
            talent: "",
            skill: "",
            knowledge: ""
        },
        attributes: {
            strength: 1,
            dexterity: 1,
            stamina: 1,
            charisma: 1,
            manipulation: 1,
            appearance: 1,
            perception: 1,
            intelligence: 1,
            wits: 1
        },
        abilities: Object.fromEntries(data.abilities.map(ability => [ability.id, 0])),
        spheres: Object.fromEntries(data.spheres.map(sphere => [sphere.id, 0])),
        backgrounds: Object.fromEntries(data.backgrounds.map(background => [background.key, 0])),
        specialties: {
            attributes: {},
            abilities: {}
        },
        core: {
            arete: RULES.baseArete,
            willpower: RULES.baseWillpower
        }
    };
}

function mergeDraft(base, saved) {
    if (!saved || typeof saved !== "object") return base;

    for (const [key, value] of Object.entries(saved)) {
        if (!(key in base)) continue;

        if (
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            base[key] &&
            typeof base[key] === "object" &&
            !Array.isArray(base[key])
        ) {
            mergeDraft(base[key], value);
        }
        else {
            base[key] = value;
        }
    }

    return base;
}

function priorityOptions(current, includeBlank = true) {
    const options = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
        value,
        label,
        selected: current === value
    }));

    if (includeBlank) {
        options.unshift({
            value: "",
            label: "Choose priority…",
            selected: !current
        });
    }

    return options;
}

function ratingDots(value, max = 5, {
    mode = "base",
    baseValue = 0,
    baseCap = max,
    controlsLocked = false,
    remainingFreebies = 0,
    costPerDot = 0
} = {}) {
    const current = Number(value ?? 0);
    const floor = Number(baseValue ?? 0);

    return Array.from({ length: max }, (_, index) => {
        const dotValue = index + 1;
        const filled = dotValue <= current;
        const base = mode === "freebies" && filled && dotValue <= floor;
        const freebie = mode === "freebies" && filled && dotValue > floor;
        const future = mode === "base" && dotValue > Number(baseCap ?? max);

        let unavailable = false;
        let disabled = Boolean(controlsLocked || future);
        let tooltip = `Set rating to ${dotValue}`;

        if (mode === "freebies") {
            // Ratings can never be lowered below the locked base snapshot.
            if (dotValue <= floor) disabled = true;

            if (base) {
                tooltip = "Base-creation dot — no Freebie Point cost.";
            }
            else if (freebie) {
                const isHighestFilled = dotValue === current;
                tooltip = isHighestFilled
                    ? `Freebie dot — ${costPerDot} FP. Click again to refund this dot.`
                    : `Freebie dot — ${costPerDot} FP.`;
            }

            // An unfilled target that would cost more than the remaining budget
            // is displayed as unavailable and cannot be selected.
            if (!filled && dotValue > current && costPerDot > 0) {
                const dotsToBuy = dotValue - current;
                const needed = dotsToBuy * costPerDot;
                unavailable = needed > remainingFreebies;
                if (unavailable) disabled = true;

                if (dotsToBuy === 1) {
                    tooltip = unavailable
                        ? `This dot costs ${costPerDot} FP; only ${remainingFreebies} FP remain.`
                        : `Buy this dot for ${costPerDot} FP.`;
                }
                else {
                    tooltip = unavailable
                        ? `Buy through rating ${dotValue}: ${needed} FP total (${costPerDot} FP per dot); only ${remainingFreebies} FP remain.`
                        : `Buy through rating ${dotValue}: ${needed} FP total (${costPerDot} FP per dot).`;
                }
            }
        }
        else if (future) {
            tooltip = "Available later during the Freebie phase.";
        }

        return {
            value: dotValue,
            filled,
            base,
            freebie,
            future,
            unavailable,
            disabled,
            tooltip
        };
    });
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

function snapshotBase(state) {
    return {
        attributePriorities: foundry.utils.deepClone(state.attributePriorities),
        abilityPriorities: foundry.utils.deepClone(state.abilityPriorities),
        attributes: foundry.utils.deepClone(state.attributes),
        abilities: foundry.utils.deepClone(state.abilities),
        spheres: foundry.utils.deepClone(state.spheres),
        backgrounds: foundry.utils.deepClone(state.backgrounds),
        core: foundry.utils.deepClone(state.core)
    };
}

function stateForBaseEvaluation(state) {
    if (!state.baseSnapshot) return state;

    return {
        ...state,
        attributePriorities: foundry.utils.deepClone(state.baseSnapshot.attributePriorities),
        abilityPriorities: foundry.utils.deepClone(state.baseSnapshot.abilityPriorities),
        attributes: foundry.utils.deepClone(state.baseSnapshot.attributes),
        abilities: foundry.utils.deepClone(state.baseSnapshot.abilities),
        spheres: foundry.utils.deepClone(state.baseSnapshot.spheres),
        backgrounds: foundry.utils.deepClone(state.baseSnapshot.backgrounds),
        core: foundry.utils.deepClone(state.baseSnapshot.core)
    };
}

function applyRequiredArete(state, data) {
    if (!state?.baseSnapshot) return 0;

    const baseState = stateForBaseEvaluation(state);
    const evaluation = evaluateBaseCharacter(baseState, data);
    const requiredArete = Math.max(startingArete(state), Number(evaluation.requiredArete ?? startingArete(state)));
    const currentArete = Number(state.core?.arete ?? RULES.baseArete);

    if (currentArete < requiredArete) {
        state.core.arete = requiredArete;
    }

    return Math.max(0, requiredArete - startingArete(state)) * RULES.freebieCosts.arete;
}

export class MageCharamancer extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "wod20-mage-charamancer",
        classes: ["wod20-mage-charamancer"],
        position: {
            width: 1560,
            height: 948
        },
        window: {
            title: "Mage Character Creation",
            icon: "fa-solid fa-hat-wizard",
            resizable: true
        }
    };

    static PARTS = {
        main: {
            template: "modules/wod20-mage-charamancer/templates/charamancer.hbs"
        }
    };

    constructor(data, options = {}) {
        // Default to nearly the full Foundry viewport on desktop. Preserve an
        // explicitly supplied width (e.g. when launched by another module).
        // ApplicationV2 remains resizable after the initial placement.
        const viewportWidth = window.innerWidth || 1440;
        const preferredWidth = Math.min(1720, Math.floor(viewportWidth * 0.94));
        super({
            ...options,
            position: {
                ...(options.position ?? {}),
                width: options.position?.width ?? preferredWidth
            }
        });
        data = enrichCreationData(data);
        this.creationData = data;
        this.creating = false;
        this._draftRestored = false;
        this._oldDraftReset = false;
        this._pendingScroll = null;
        this._dismissedIssueSteps = new Set();

        const freshState = makeInitialState(data);
        const draft = this._loadDraft();

        if (draft?.version === DRAFT_VERSION && draft?.state) {
            const saved=foundry.utils.deepClone(draft.state);
            const merged=migrateAbilityAliases(saved,data);
            this.characterState = mergeDraft(freshState, saved);
            if(merged.length)ui.notifications.warn('Overlapping Ability names merged: '+merged.join(', ')+'. The higher rating and existing specialty were retained. Review base allocations and Freebie spending.');
            this.stepIndex = Math.max(0, Math.min(STEPS.length - 1, Number(draft.stepIndex ?? 0)));
            this._draftRestored = true;
        }
        else {
            if (draft) {
                this._oldDraftReset = true;
                this._clearDraft();
            }
            this.characterState = freshState;
            this.stepIndex = 0;
        }

        for(const b of this.characterState.customBackgrounds||[])if(!this.creationData.backgrounds.some(x=>x.key===b.key))this.creationData.backgrounds.push(b);
        // Restore custom rating keys without accepting unrelated draft fields.
        for(const b of this.characterState.customBackgrounds||[]){this.characterState.backgrounds[b.key]=Number(draft?.state?.backgrounds?.[b.key]||0);if(this.characterState.baseSnapshot)this.characterState.baseSnapshot.backgrounds[b.key]=Number(draft?.state?.baseSnapshot?.backgrounds?.[b.key]||0);}
        // Sanity-check draft phase/step combinations.
        if (this.characterState.phase === "freebies" && !this.characterState.baseSnapshot) {
            this.characterState.phase = "base";
            this.stepIndex = Math.min(this.stepIndex, 4);
        }
        if (this.characterState.phase === "base" && this.stepIndex > 4) {
            this.stepIndex = 4;
        }
        if (this.characterState.phase === "freebies" && this.stepIndex < 5) {
            this.stepIndex = 5;
        }

        // Freebie phase always begins with any Arete required by the locked
        // starting Sphere plan already purchased. This also normalizes drafts
        // created by v0.1.9 before the automatic purchase was introduced.
        if (this.characterState.phase === "freebies" && this.characterState.baseSnapshot) {
            applyRequiredArete(this.characterState, this.creationData);
            this._saveDraft();
        }

        this._keyGuard = event => {
            if (!this.rendered) return;

            if (event.key === "Tab") {
                const root = this.element;
                if (!root) return;

                const focusable = [...root.querySelectorAll(
                    "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), " +
                    "button:not([disabled]):not(.mc-dot):not(.mc-zero-button), " +
                    "[tabindex]:not([tabindex='-1'])"
                )].filter(isVisible);

                if (!focusable.length) return;

                const currentIndex = focusable.indexOf(event.target);
                const nextIndex = event.shiftKey
                    ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
                    : (currentIndex < 0 || currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                focusable[nextIndex]?.focus();
                return;
            }

            if (!/^[0-9]$/.test(event.key)) return;
            if (isEditableTarget(event.target)) return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        };

        document.addEventListener("keydown", this._keyGuard, true);
    }

    get currentStep() {
        return STEPS[this.stepIndex];
    }

    get _draftKey() {
        return `${MODULE_ID}:draft:${game.world?.id ?? "world"}:${game.user?.id ?? "user"}`;
    }

    _loadDraft() {
        try {
            const raw = localStorage.getItem(this._draftKey);
            return raw ? JSON.parse(raw) : null;
        }
        catch (error) {
            console.warn(`${MODULE_ID} | Could not load saved draft`, error);
            return null;
        }
    }

    _saveDraft() {
        try {
            localStorage.setItem(this._draftKey, JSON.stringify({
                version: DRAFT_VERSION,
                state: this.characterState,
                stepIndex: this.stepIndex
            }));
        }
        catch (error) {
            console.warn(`${MODULE_ID} | Could not save draft`, error);
        }
    }

    _clearDraft() {
        try {
            localStorage.removeItem(this._draftKey);
        }
        catch (error) {
            console.warn(`${MODULE_ID} | Could not clear saved draft`, error);
        }
    }

    _captureScroll() {
        const root = this.element;
        return {
            main: root?.querySelector(".mc-main")?.scrollTop ?? 0,
            sidebar: root?.querySelector(".mc-sidebar")?.scrollTop ?? 0
        };
    }

    _renderPreservingScroll() {
        this._pendingScroll = this._captureScroll();
        return this.render();
    }

    _getRating(kind, key) {
        switch (kind) {
            case "attribute": return Number(this.characterState.attributes[key] ?? 1);
            case "ability": return Number(this.characterState.abilities[key] ?? 0);
            case "sphere": return Number(this.characterState.spheres[key] ?? 0);
            case "background": return Number(this.characterState.backgrounds[key] ?? 0);
            case "core": return Number(this.characterState.core[key] ?? 0);
            default: return 0;
        }
    }

    _freebieCostFor(kind, key) {
        if (kind === "core") return Number(RULES.freebieCosts[key] ?? 0);
        return Number(RULES.freebieCosts[kind] ?? 0);
    }

    _baseFloor(kind, key) {
        const base = this.characterState.baseSnapshot;
        if (!base) return 0;

        switch (kind) {
            case "attribute": return Number(base.attributes[key] ?? 1);
            case "ability": return Number(base.abilities[key] ?? 0);
            case "sphere": return Number(base.spheres[key] ?? 0);
            case "background": return Number(base.backgrounds[key] ?? 0);
            case "core": return Number(base.core[key] ?? 0);
            default: return 0;
        }
    }

    _ratingLimits(kind, key) {
        if (this.characterState.phase === "base") {
            if (kind === "attribute") return { min: 1, max: RULES.creationCaps.attributeBeforeFreebies };
            if (kind === "ability") return { min: 0, max: RULES.creationCaps.abilityBeforeFreebies };
            if (kind === "sphere") return { min: 0, max: RULES.creationCaps.arete };
            if (kind === "core") {
                const fixed = key === "arete" ? startingArete(this.characterState) : RULES.baseWillpower;
                return { min: fixed, max: fixed };
            }
            return { min: 0, max: RULES.creationCaps.rating };
        }

        const min = this._baseFloor(kind, key);
        if (kind === "core" && key === "arete") return { min, max: RULES.creationCaps.arete };
        if (kind === "core" && key === "willpower") return { min, max: RULES.creationCaps.willpower };
        return { min, max: RULES.creationCaps.rating };
    }

    _basePoolWouldOverflow(kind, key, nextValue) {
        if (kind === "attribute") {
            if (!priorityIsValid(this.characterState.attributePriorities)) return true;
            const group = Object.entries(ATTRIBUTE_GROUPS).find(([, keys]) => keys.includes(key))?.[0];
            if (!group) return false;
            const pool = RULES.attributePools[this.characterState.attributePriorities[group]] ?? 0;
            const used = ATTRIBUTE_GROUPS[group].reduce((total, id) => {
                const value = id === key ? nextValue : Number(this.characterState.attributes[id] ?? 1);
                return total + Math.max(0, value - 1);
            }, 0);
            return used > pool;
        }

        if (kind === "ability") {
            if (!priorityIsValid(this.characterState.abilityPriorities)) return true;
            const ability = this.creationData.abilities.find(item => item.id === key);
            if (!ability) return false;
            const group = ability.category;
            const pool = RULES.abilityPools[this.characterState.abilityPriorities[group]] ?? 0;
            const used = this.creationData.abilities
                .filter(item => item.category === group)
                .reduce((total, item) => total + (item.id === key ? nextValue : Number(this.characterState.abilities[item.id] ?? 0)), 0);
            return used > pool;
        }

        if (kind === "sphere") {
            const used = this.creationData.spheres.reduce((total, sphere) =>
                total + (sphere.id === key ? nextValue : Number(this.characterState.spheres[sphere.id] ?? 0)), 0);
            return used > RULES.baseSphereDots;
        }

        if (kind === "background") {
            const used = this.creationData.backgrounds.reduce((total, background) =>
                total + (background.key === key ? nextValue : Number(this.characterState.backgrounds[background.key] ?? 0)), 0);
            return used > RULES.baseBackgroundDots;
        }

        return false;
    }

    _setRating(kind, key, value) {
        const requested = Number(value);
        if (!Number.isSafeInteger(requested)) return;

        const phase = this.characterState.phase;
        const current = this._getRating(kind, key);

        if (phase === "base") {
            if (kind === "attribute" && !priorityIsValid(this.characterState.attributePriorities)) {
                ui.notifications.warn("Choose one Primary, one Secondary, and one Tertiary for Physical, Social, and Mental before assigning Attribute dots.");
                return;
            }
            if (kind === "ability" && !priorityIsValid(this.characterState.abilityPriorities)) {
                ui.notifications.warn("Choose one Primary, one Secondary, and one Tertiary for Talents, Skills, and Knowledges before assigning Ability dots.");
                return;
            }
            if (kind === "core") {
                ui.notifications.warn("Arete and Willpower are fixed during base creation. Raise them later on the Freebies tab.");
                return;
            }
        }

        const limits = this._ratingLimits(kind, key);
        const number = Math.max(limits.min, Math.min(limits.max, requested));

        if (phase === "base") {
            if (number > current && this._basePoolWouldOverflow(kind, key, number)) {
                const labels = {
                    attribute: "That Attribute category already has all of its base dots. Extra Attribute dots are purchased later on the Freebies tab.",
                    ability: "That Ability category already has all of its base dots. Extra Ability dots are purchased later on the Freebies tab.",
                    sphere: `You already placed all ${RULES.baseSphereDots} base Sphere dots. Extra Sphere dots are purchased later on the Freebies tab.`,
                    background: `You already placed all ${RULES.baseBackgroundDots} base Background dots. Extra Background dots are purchased later on the Freebies tab.`
                };
                ui.notifications.warn(labels[kind] ?? "That base allocation is already full.");
                return;
            }
        }
        else {
            if (!this.characterState.baseSnapshot) {
                ui.notifications.error("Finish Base Review before spending Freebie Points.");
                return;
            }

            if (kind === "sphere" && number > Number(this.characterState.core.arete ?? RULES.baseArete)) {
                ui.notifications.warn(`Raise Arete first. ${this.creationData.spheres.find(s => s.id === key)?.name ?? "This Sphere"} cannot exceed Arete ${this.characterState.core.arete}.`);
                return;
            }

            if (kind === "core" && key === "arete" && number < current) {
                const highestSphere = Math.max(0, ...Object.values(this.characterState.spheres).map(Number));
                if (number < highestSphere) {
                    ui.notifications.warn(`Arete cannot be lowered to ${number} while a Sphere is rated ${highestSphere}. Lower the Sphere first.`);
                    return;
                }
            }

            if (number > current) {
                const evaluation = evaluateFreebies(this.characterState, this.creationData);
                const cost = this._freebieCostFor(kind, key);
                const needed = (number - current) * cost;
                if (needed > evaluation.freebiesRemaining) {
                    ui.notifications.warn(`That purchase costs ${needed} Freebie Point${needed === 1 ? "" : "s"}, but only ${evaluation.freebiesRemaining} remain.`);
                    return;
                }
            }
        }

        switch (kind) {
            case "attribute": this.characterState.attributes[key] = number; break;
            case "ability": this.characterState.abilities[key] = number; break;
            case "sphere": this.characterState.spheres[key] = number; break;
            case "background": this.characterState.backgrounds[key] = number; break;
            case "core": this.characterState.core[key] = number; break;
            default: return;
        }

        this._saveDraft();
        this._renderPreservingScroll();
    }

    _makeTraitDots(kind, key, value, baseCap, controlsLocked, freebieEvaluation) {
        if (this.characterState.phase === "base") {
            return ratingDots(value, kind === "core" && key === "willpower" ? RULES.creationCaps.willpower : RULES.creationCaps.rating, {
                mode: "base",
                baseCap,
                controlsLocked
            });
        }

        const baseValue = this._baseFloor(kind, key);
        const cost = this._freebieCostFor(kind, key);
        const max = kind === "core" && key === "willpower"
            ? RULES.creationCaps.willpower
            : (kind === "core" && key === "arete" ? RULES.creationCaps.arete : RULES.creationCaps.rating);

        return ratingDots(value, max, {
            mode: "freebies",
            baseValue,
            remainingFreebies: freebieEvaluation.freebiesRemaining,
            costPerDot: cost
        });
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const phaseBase = this.characterState.phase !== "freebies";
        const baseState = stateForBaseEvaluation(this.characterState);
        const baseEvaluation = evaluateBaseCharacter(baseState, this.creationData);
        const freebieEvaluation = phaseBase
            ? null
            : evaluateFreebies(this.characterState, this.creationData);
        const activeEvaluation = phaseBase ? baseEvaluation : freebieEvaluation;

        const attributePrioritiesReady = priorityIsValid(this.characterState.attributePriorities);
        const abilityPrioritiesReady = priorityIsValid(this.characterState.abilityPriorities);

        const attrGroups = ["physical", "social", "mental"].map(group => {
            const status = baseEvaluation.attributeStatus[group];
            const attributes = ATTRIBUTE_GROUPS[group].map(id => {
                const value = Number(this.characterState.attributes[id] ?? 1);
                const baseValue = phaseBase ? null : Number(this.characterState.baseSnapshot?.attributes?.[id] ?? 1);
                const freebieDots = phaseBase ? 0 : Number(freebieEvaluation.itemFreebieDots.attributes[id] ?? 0);
                return {
                    id,
                    name: capitalize(id),
                    ...creationTrait("attribute",id,capitalize(id),value),
                    value,
                    baseValue,
                    freebieDots,
                    freebieCost: freebieDots * RULES.freebieCosts.attribute,
                    dots: this._makeTraitDots(
                        "attribute",
                        id,
                        value,
                        RULES.creationCaps.attributeBeforeFreebies,
                        phaseBase && !attributePrioritiesReady,
                        freebieEvaluation
                    )
                };
            });

            return {
                id: group,
                name: capitalize(group),
                priority: this.characterState.attributePriorities[group],
                priorityLabel: PRIORITY_LABELS[this.characterState.attributePriorities[group]] ?? "Not chosen",
                priorityOptions: priorityOptions(this.characterState.attributePriorities[group], true),
                ratingsLocked: phaseBase && !attributePrioritiesReady,
                status,
                attributes
            };
        });

        const abilityGroups = ["talent", "skill", "knowledge"].map(group => {
            const status = baseEvaluation.abilityStatus[group];
            const abilities = this.creationData.abilities
                .filter(ability => ability.category === group && (!ability.nonCore || this.characterState.selectedAbilities.includes(ability.id) || Number(this.characterState.abilities[ability.id])>0))
                // Core abilities first; selected GM-approved traits appear together below them.
                .sort((a, b) => Number(Boolean(a.nonCore)) - Number(Boolean(b.nonCore)))
                .map((ability, index, listed) => {
                    const value = Number(this.characterState.abilities[ability.id] ?? 0);
                    const baseValue = phaseBase ? null : Number(this.characterState.baseSnapshot?.abilities?.[ability.id] ?? 0);
                    const freebieDots = phaseBase ? 0 : Number(freebieEvaluation.itemFreebieDots.abilities[ability.id] ?? 0);
                    return {
                        ...ability,
                        ...creationTrait("ability",ability.id,ability.name,value,ability.description),
                        nonCore: Boolean(ability.nonCore),
                        firstNonCore: Boolean(ability.nonCore && (index === 0 || !listed[index - 1].nonCore)),
                        value,
                        baseValue,
                        freebieDots,
                        freebieCost: freebieDots * RULES.freebieCosts.ability,
                        dots: this._makeTraitDots(
                            "ability",
                            ability.id,
                            value,
                            RULES.creationCaps.abilityBeforeFreebies,
                            phaseBase && !abilityPrioritiesReady,
                            freebieEvaluation
                        )
                    };
                });

            return {
                id: group,
                name: capitalize(group) + "s",
                priority: this.characterState.abilityPriorities[group],
                priorityLabel: PRIORITY_LABELS[this.characterState.abilityPriorities[group]] ?? "Not chosen",
                priorityOptions: priorityOptions(this.characterState.abilityPriorities[group], true),
                ratingsLocked: phaseBase && !abilityPrioritiesReady,
                status,
                abilities,
                extraAbilities: this.creationData.abilities.filter(a=>a.category===group&&a.nonCore&&!this.characterState.selectedAbilities.includes(a.id)&&!Number(this.characterState.abilities[a.id])).map(a=>({...a,...creationTrait("ability",a.id,a.name,0,a.description),nonCore:Boolean(a.nonCore)}))
            };
        });

        const spheres = this.creationData.spheres.map(sphere => {
            const value = Number(this.characterState.spheres[sphere.id] ?? 0);
            const baseValue = phaseBase ? null : Number(this.characterState.baseSnapshot?.spheres?.[sphere.id] ?? 0);
            const freebieDots = phaseBase ? 0 : Number(freebieEvaluation.itemFreebieDots.spheres[sphere.id] ?? 0);
            return {
                ...sphere,
                ...creationTrait("sphere",sphere.id,sphere.name,value),
                value,
                baseValue,
                freebieDots,
                freebieCost: freebieDots * RULES.freebieCosts.sphere,
                affinitySelected: this.characterState.identity.affinitySphere === sphere.id,
                dots: this._makeTraitDots(
                    "sphere",
                    sphere.id,
                    value,
                    phaseBase ? RULES.creationCaps.arete : RULES.creationCaps.rating,
                    false,
                    freebieEvaluation
                )
            };
        });

        const backgrounds = this.creationData.backgrounds.map(background => {
            const value = Number(this.characterState.backgrounds[background.key] ?? 0);
            const baseValue = phaseBase ? null : Number(this.characterState.baseSnapshot?.backgrounds?.[background.key] ?? 0);
            const freebieDots = phaseBase ? 0 : Number(freebieEvaluation.itemFreebieDots.backgrounds[background.key] ?? 0);
            return {
                ...background,
                ...creationTrait("background",background.id||background.key,background.name,value,background.description),
                value,
                baseValue,
                freebieDots,
                freebieCost: freebieDots * RULES.freebieCosts.background,
                isAvatar: background.key === this.creationData.avatarBackgroundKey,
                dots: this._makeTraitDots(
                    "background",
                    background.key,
                    value,
                    RULES.creationCaps.rating,
                    false,
                    freebieEvaluation
                )
            };
        });

        const areteValue = Number(this.characterState.core.arete ?? RULES.baseArete);
        const willpowerValue = Number(this.characterState.core.willpower ?? RULES.baseWillpower);
        const areteFreebieDots = phaseBase ? 0 : Number(freebieEvaluation.itemFreebieDots.core.arete ?? 0);
        const willpowerFreebieDots = phaseBase ? 0 : Number(freebieEvaluation.itemFreebieDots.core.willpower ?? 0);

        const specialtyChoices = [
            ...Object.entries(this.characterState.attributes)
                .filter(([, value]) => Number(value) >= 4)
                .map(([key, value]) => ({
                    kind: "Attribute",
                    name: capitalize(key),
                    rating: Number(value),
                    path: `specialties.attributes.${key}`,
                    listId: "mc-create-specialty-"+key, suggestions: SPECIALTY_SUGGESTIONS[key]||[],
                    value: this.characterState.specialties?.attributes?.[key] ?? ""
                })),
            ...this.creationData.abilities
                .filter(ability => Number(this.characterState.abilities[ability.id] ?? 0) >= 4)
                .map(ability => ({
                    kind: "Ability",
                    name: ability.name,
                    rating: Number(this.characterState.abilities[ability.id] ?? 0),
                    path: `specialties.abilities.${ability.id}`,
                    listId: "mc-create-specialty-"+ability.id, suggestions: SPECIALTY_SUGGESTIONS[ability.catalogId||ability.id]||[],
                    value: this.characterState.specialties?.abilities?.[ability.id] ?? ""
                }))
        ];

        const steps = STEPS.map((step, index) => {
            const disabled = phaseBase ? index > 4 : index < 5;
            let blockingIssues = [];
            let displayIssues = [];

            if (phaseBase && index <= 4) {
                blockingIssues = baseEvaluation.errors.filter(issue => issue.stepIndex === index);
                displayIssues = [
                    ...blockingIssues,
                    ...baseEvaluation.warnings.filter(issue => issue.stepIndex === index)
                ];
            }
            else if (!phaseBase && index === 5) {
                blockingIssues = freebieEvaluation.errors.filter(issue => issue.stepIndex === 5);
                displayIssues = [
                    ...blockingIssues,
                    ...freebieEvaluation.warnings.filter(issue => issue.stepIndex === 5)
                ];
            }
            else if (!phaseBase && index === 6) {
                blockingIssues = freebieEvaluation.errors;
                displayIssues = [
                    ...blockingIssues,
                    ...freebieEvaluation.warnings.filter(issue => issue.stepIndex === 6)
                ];
            }

            const advisoryOnly = displayIssues.length > 0 && displayIssues.every(issue => issue.advisory);
            const complete = disabled
                ? (!phaseBase && index <= 4)
                : (index === 4 ? (!phaseBase || baseEvaluation.valid) : (blockingIssues.length === 0 && index < this.stepIndex));

            return {
                ...step,
                number: index + 1,
                active: index === this.stepIndex,
                disabled,
                complete,
                errors: displayIssues.length,
                advisoryOnly
            };
        });

        const currentIssues = [
            ...activeEvaluation.errors,
            ...(activeEvaluation.warnings ?? [])
        ].filter(issue => issue.stepIndex === this.stepIndex);
        const issuesDismissed = this._dismissedIssueSteps.has(this.stepIndex);
        const currentHasHard = currentIssues.some(issue => !issue.advisory);
        const currentIssueSummary = currentIssues.length === 0
            ? ""
            : currentIssues.slice(0, 2).map(issue => issue.message).join("  •  ") +
                (currentIssues.length > 2 ? `  •  +${currentIssues.length - 2} more` : "");
        const currentIssueCountLabel = `${currentIssues.length} ${currentIssues.length === 1 ? "thing" : "things"} to finish on ${this.currentStep.label}.`;

        const avatarRating = Number(this.characterState.backgrounds[this.creationData.avatarBackgroundKey] ?? 0);
        const quintessence = phaseBase ? baseEvaluation.quintessence : freebieEvaluation.quintessence;

        const canBack = phaseBase ? this.stepIndex > 0 : this.stepIndex >= 5;
        const canNext = phaseBase ? this.stepIndex < 4 || this.stepIndex === 4 : this.stepIndex < 6;
        const nextDisabled = phaseBase && this.stepIndex === 4 && !baseEvaluation.valid;
        const requiredAreteAutoCost = phaseBase ? 0 : Number(baseEvaluation.requiredAreteFreebieCost ?? 0);
        const baseFreebiesAfterRequiredArete = Math.max(0, meritTotals(this.characterState).budget - meritTotals(this.characterState).merits - Number(baseEvaluation.requiredAreteFreebieCost ?? 0));
        const discretionaryFreebiesSpent = phaseBase
            ? 0
            : Math.max(0, Number(freebieEvaluation.freebiesSpent ?? 0) - requiredAreteAutoCost);

        const guideCategory=this._guideCategory||'attribute';
        const guideTraits=guideCategory==='attribute'?Object.keys(this.characterState.attributes).map(key=>({key,name:capitalize(key),kind:'attribute'})):guideCategory==='sphere'?spheres.map(x=>({key:x.id,name:x.name,kind:'sphere'})):guideCategory==='background'?backgrounds.map(x=>({key:x.key,name:x.name,kind:'background',info:x.info})):this.creationData.abilities.filter(x=>x.category===guideCategory).map(x=>({key:x.id,name:x.name,kind:'ability'}));
        const guideTrait=guideTraits.find(x=>x.key===this._guideTrait)||guideTraits[0];
        return {
            ...context,
            guideCategories:['attribute','talent','skill','knowledge','sphere','background'].map(value=>({value,label:capitalize(value),selected:value===guideCategory})),
            guideTraits:guideTraits.map(x=>({...x,selected:x.key===guideTrait?.key})),
            guideInfo:guideTrait?.info|| (guideTrait?creationTrait(guideTrait.kind,guideTrait.key,guideTrait.name,0).info:''),
            state: this.characterState,
            currentStep: this.currentStep,
            steps,
            rules: {...RULES,baseArete:startingArete(this.characterState),freebies:meritTotals(this.characterState).budget},
            identityChoices: ["concept","nature","demeanor","affiliation","sect"].map(key=>({key,path:"identity."+key,value:this.characterState.identity[key],label:key==="sect"?"Faction / Tradition / Convention":capitalize(key),choices:key==="sect"?factionsFor(this.characterState.identity):identityOptions[key],sectionStart:key==="affiliation",sectionTitle:"Tradition & Magick"})),
            essenceChoice: {key:"essence",path:"identity.essence",value:this.characterState.identity.essence,label:"Essence",choices:identityOptions.essence},
            affinityDisplay: this.creationData.spheres.find(s=>s.id === this.characterState.identity.affinitySphere)?.name || "",
            meritTotals: meritTotals(this.characterState),
            meritsFlaws: this.characterState.meritsFlaws.map(m=>({...m,isMerit:m.kind==="merit"})),
            meritCatalog: meritFlawCatalog,
            phaseBase,
            phaseFreebies: !phaseBase,
            stepConcept: this.currentStep.id === "concept",
            stepAttributes: this.currentStep.id === "attributes",
            stepAbilities: this.currentStep.id === "abilities",
            stepMagic: this.currentStep.id === "magic",
            stepBaseReview: this.currentStep.id === "base-review",
            stepFreebies: this.currentStep.id === "freebies",
            stepFinalReview: this.currentStep.id === "final-review",
            baseEvaluation,
            freebieEvaluation,
            evaluation: activeEvaluation,
            attributePrioritiesReady,
            abilityPrioritiesReady,
            attrGroups,
            abilityGroups,
            spheres,
            backgrounds: phaseBase?backgrounds:backgrounds.filter(b=>b.value>0||this.characterState.selectedBackgrounds.includes(b.key)),
            backgroundChoices: backgrounds.filter(b=>!b.value&&!this.characterState.selectedBackgrounds.includes(b.key)),
            areteValue,
            willpowerValue,
            areteDots: this._makeTraitDots(
                "core",
                "arete",
                areteValue,
                startingArete(this.characterState),
                phaseBase,
                freebieEvaluation
            ),
            willpowerDots: this._makeTraitDots(
                "core",
                "willpower",
                willpowerValue,
                RULES.baseWillpower,
                phaseBase,
                freebieEvaluation
            ),
            areteFreebieDots,
            willpowerFreebieDots,
            areteFreebieCost: areteFreebieDots * RULES.freebieCosts.arete,
            willpowerFreebieCost: willpowerFreebieDots * RULES.freebieCosts.willpower,
            avatarRating,
            quintessence,
            showCurrentIssues: !["base-review", "final-review"].includes(this.currentStep.id) && currentIssues.length > 0 && !issuesDismissed,
            hasCurrentIssues: !["base-review", "final-review"].includes(this.currentStep.id) && currentIssues.length > 0,
            currentIssues,
            currentHasHard,
            currentIssueSummary,
            currentIssueCountLabel,
            issuesDismissed,
            requiredArete: baseEvaluation.requiredArete,
            requiredAreteDots: baseEvaluation.requiredAreteDots,
            requiredAreteFreebieCost: baseEvaluation.requiredAreteFreebieCost,
            requiredAreteAutoCost,
            baseFreebiesAfterRequiredArete,
            discretionaryFreebiesSpent,
            spherePlanNeedsArete: baseEvaluation.requiredArete > startingArete(this.characterState),
            spherePlanResolved: !phaseBase && areteValue >= baseEvaluation.requiredArete,
            specialtyChoices,
            hasSpecialtyChoices: specialtyChoices.length > 0,
            draftRestored: this._draftRestored,
            oldDraftReset: this._oldDraftReset,
            canBack,
            canNext,
            nextDisabled,
            backLabel: !phaseBase && this.stepIndex === 5 ? "Edit Base Character" : "Back",
            nextLabel: phaseBase && this.stepIndex === 4 ? "Finish Base & Spend Freebies" : "Next",
            canCreate: !phaseBase && this.currentStep.id === "final-review" && freebieEvaluation.valid && !this.creating,
            creating: this.creating
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        // Close/remove the prior listbox before replacing the template part.
        this._cleanupConceptDropdowns?.();
        this._cleanupConceptDropdowns = null;
        this._cleanupSpecialtyDropdowns?.();
        this._cleanupSpecialtyDropdowns = null;
        this._cleanupBackgroundDropdown?.();
        this._cleanupBackgroundDropdown = null;
        const root = this.element;
        if (!root) return;

        this._wireExtras(root);
        this._cleanupConceptDropdowns = setupConceptDropdowns(root, {
            selectSphere: value => {
                this.characterState.identity.affinitySphere = value;
                this._saveDraft();
                this._renderPreservingScroll();
            },
            getSphere: () => this.characterState.identity.affinitySphere
        });
        this._cleanupSpecialtyDropdowns = setupSpecialtyDropdowns(root);
        this._cleanupBackgroundDropdown = setupBackgroundDropdown(root, key => {
            if (!this.characterState.selectedBackgrounds.includes(key)) {
                this.characterState.selectedBackgrounds.push(key);
                this._saveDraft();
                this._renderPreservingScroll();
            }
        });
        root.querySelector('[data-free-arete2]')?.addEventListener('change', event => {
            if (this.characterState.phase !== 'base') return;
            this.characterState.freeArete2 = event.currentTarget.checked;
            this.characterState.core.arete = startingArete(this.characterState);
            this._saveDraft();
            this._renderPreservingScroll();
        });
        root.querySelectorAll("[data-path]").forEach(input => {
            const update = event => {
                const target = event.currentTarget;
                let value = target.value;
                if (target.dataset.number === "true") value = Number(value);
                foundry.utils.setProperty(this.characterState, target.dataset.path, value);
                this._saveDraft();
            };

            input.addEventListener("input", update);
            input.addEventListener("change", event => {
                update(event);
                if(event.currentTarget.dataset.path === "identity.affiliation"){
                    const known=Object.values(factionGroups).flat(),allowed=factionsFor(this.characterState.identity);
                    if(known.includes(this.characterState.identity.sect)&&!allowed.includes(this.characterState.identity.sect))this.characterState.identity.sect="";
                    this._saveDraft();this._renderPreservingScroll();
                }else if (event.currentTarget instanceof HTMLSelectElement) this._renderPreservingScroll();
                else if(event.currentTarget.dataset.path?.startsWith("specialties."))this._renderPreservingScroll();
            });
        });

        root.querySelectorAll("[data-rating-kind]").forEach(button => {
            button.addEventListener("click", event => {
                const target = event.currentTarget;
                const kind = target.dataset.ratingKind;
                const key = target.dataset.ratingKey;
                const requested = Number(target.dataset.ratingValue);
                const current = this._getRating(kind, key);
                const floor = this.characterState.phase === "freebies" ? this._baseFloor(kind, key) : (kind === "attribute" ? 1 : 0);

                const nextValue = target.classList.contains("mc-dot") && requested === current
                    ? Math.max(floor, current - 1)
                    : requested;

                this._setRating(kind, key, nextValue);
            });
        });

        root.querySelectorAll("[data-priority-kind]").forEach(select => {
            select.addEventListener("change", event => {
                if (this.characterState.phase !== "base") return;
                const target = event.currentTarget;
                const object = target.dataset.priorityKind === "attributes"
                    ? this.characterState.attributePriorities
                    : this.characterState.abilityPriorities;
                object[target.dataset.priorityGroup] = target.value;
                this._saveDraft();
                this._renderPreservingScroll();
            });
        });

        root.querySelector("[data-dismiss-current-issues]")?.addEventListener("click", () => {
            this._dismissedIssueSteps.add(this.stepIndex);
            this._renderPreservingScroll();
        });

        root.querySelector("[data-show-current-issues]")?.addEventListener("click", () => {
            this._dismissedIssueSteps.delete(this.stepIndex);
            this._renderPreservingScroll();
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

        root.querySelector("[data-nav='back']")?.addEventListener("click", async () => {
            if (this.characterState.phase === "freebies" && this.stepIndex === 5) {
                await this._returnToBase(4);
                return;
            }

            const min = this.characterState.phase === "freebies" ? 5 : 0;
            this.stepIndex = Math.max(min, this.stepIndex - 1);
            this._dismissedIssueSteps.delete(this.stepIndex);
            this._saveDraft();
            this.render();
        });

        root.querySelector("[data-nav='next']")?.addEventListener("click", async () => {
            if (this.characterState.phase === "base" && this.stepIndex === 4) {
                await this._beginFreebies();
                return;
            }

            const max = this.characterState.phase === "freebies" ? 6 : 4;
            this.stepIndex = Math.min(max, this.stepIndex + 1);
            this._dismissedIssueSteps.delete(this.stepIndex);
            this._saveDraft();
            this.render();
        });

        root.querySelectorAll("[data-step-index]").forEach(button => {
            button.addEventListener("click", event => {
                const target = event.currentTarget;
                if (target.disabled) return;
                this.stepIndex = Number(target.dataset.stepIndex);
                this._dismissedIssueSteps.delete(this.stepIndex);
                this._saveDraft();
                this.render();
            });
        });

        root.querySelectorAll("[data-error-step]").forEach(button => {
            button.addEventListener("click", event => {
                const requested = Number(event.currentTarget.dataset.errorStep);
                if (this.characterState.phase === "freebies" && requested < 5) return;
                this.stepIndex = requested;
                this._dismissedIssueSteps.delete(this.stepIndex);
                this._saveDraft();
                this.render();
            });
        });

        root.querySelector("[data-begin-freebies]")?.addEventListener("click", async () => {
            await this._beginFreebies();
        });

        root.querySelector("[data-edit-base]")?.addEventListener("click", async event => {
            const targetStep = Number(event.currentTarget.dataset.editBase ?? 4);
            await this._returnToBase(Number.isFinite(targetStep) ? targetStep : 4);
        });

        root.querySelector("[data-reset-draft]")?.addEventListener("click", () => {
            const confirmed = window.confirm("Start this Mage over from scratch? This clears the saved charamancer draft.");
            if (!confirmed) return;

            this._clearDraft();
            this.creationData.backgrounds=this.creationData.backgrounds.filter(b=>!b.custom);
            this.characterState = makeInitialState(this.creationData);
            this.stepIndex = 0;
            this._draftRestored = false;
            this._oldDraftReset = false;
            this.render();
        });

        root.querySelector("[data-create-mage]")?.addEventListener("click", async () => {
            await this._createMage();
        });
    }

    _wireExtras(root) {
        root.querySelector('[data-guide-category]')?.addEventListener('change',event=>{this._guideCategory=event.currentTarget.value;this._guideTrait=null;this._renderPreservingScroll();});
        root.querySelector('[data-guide-trait]')?.addEventListener('change',event=>{this._guideTrait=event.currentTarget.value;this._renderPreservingScroll();});
        root.querySelectorAll('[data-identity-choice]').forEach(select=>select.addEventListener('change',()=>{
            const key=select.dataset.identityChoice;if(!select.value)return;
            this.characterState.identity[key]=select.value;
            if(key==='affiliation'){const known=Object.values(factionGroups).flat();if(known.includes(this.characterState.identity.sect)&&!factionsFor(this.characterState.identity).includes(this.characterState.identity.sect))this.characterState.identity.sect='';}
            this._saveDraft();this._renderPreservingScroll();
        }));
        root.querySelectorAll('[data-add-ability]').forEach(button=>button.addEventListener('click',()=>{
            const id=button.dataset.addAbility;if(!this.characterState.selectedAbilities.includes(id))this.characterState.selectedAbilities.push(id);
            this._saveDraft();this._renderPreservingScroll();
        }));
        root.querySelector('[data-custom-background-add]')?.addEventListener('click',()=>{
            const name=root.querySelector('[data-custom-background-name]').value.trim(),description=root.querySelector('[data-custom-background-description]').value.trim();
            if(!name||!description){ui.notifications.warn('Custom Backgrounds need a name and explanation.');return;}
            if(this.creationData.backgrounds.some(b=>b.name.toLowerCase()===name.toLowerCase())){ui.notifications.warn('That Background is already listed.');return;}
            const b={key:'custom:'+foundry.utils.randomID(),name,description,custom:true,uuid:null};
            this.characterState.customBackgrounds.push(b);this.creationData.backgrounds.push(b);this.characterState.backgrounds[b.key]=0;
            this.characterState.selectedBackgrounds.push(b.key);
            if(this.characterState.baseSnapshot)this.characterState.baseSnapshot.backgrounds[b.key]=0;
            this._saveDraft();this._renderPreservingScroll();
        });
        // Merits and Flaws may be edited only in the dedicated Freebie phase.
        const canEditMerits = () => this.characterState.phase === 'freebies' && this.currentStep.id === 'freebies';
        root.querySelectorAll('[data-merit-template]').forEach(button=>button.addEventListener('click',()=>{
            const def=meritFlawCatalog.find(m=>m.id===button.dataset.meritTemplate);
            for(const key of ['name','kind','description','reference'])root.querySelector('[data-mf-'+key+']').value=def?.[key]|| (key==='kind'?'merit':'');
            root.querySelector('[data-mf-points]').value=def?.values[0]||1;
            root.querySelector('[data-mf-name]').dataset.sourceId=def?.id||'';
        }));
        root.querySelector('[data-mf-add]')?.addEventListener('click',()=>{
            if(!canEditMerits())return;
            const row={id:foundry.utils.randomID(),sourceId:root.querySelector('[data-mf-name]').dataset.sourceId||''};
            for(const key of ['name','kind','description','reference'])row[key]=root.querySelector('[data-mf-'+key+']').value.trim();
            row.points=Number(root.querySelector('[data-mf-points]').value);
            const previous=this.characterState.meritsFlaws;this.characterState.meritsFlaws=[...previous,row];
            const errors=validateMerits(this.characterState);
            if(errors.length|| (this.characterState.phase==='freebies'&&evaluateFreebies(this.characterState,this.creationData).freebiesRemaining<0)){
                this.characterState.meritsFlaws=previous;ui.notifications.warn(errors[0]||'That Merit exceeds the remaining Freebie budget.');return;
            }
            this._saveDraft();this._renderPreservingScroll();
        });
        root.querySelectorAll('[data-mf-remove]').forEach(button=>button.addEventListener('click',()=>{
            if(!canEditMerits())return;
            const before=this.characterState.meritsFlaws;this.characterState.meritsFlaws=before.filter(m=>m.id!==button.dataset.mfRemove);
            if(this.characterState.phase==='freebies'&&evaluateFreebies(this.characterState,this.creationData).freebiesRemaining<0){this.characterState.meritsFlaws=before;ui.notifications.warn('Remove some Freebie purchases before removing that Flaw bonus.');return;}
            this._saveDraft();this._renderPreservingScroll();
        }));
        root.querySelector('[data-flaw-cap]')?.addEventListener('change',event=>{
            if(!canEditMerits())return;
            const before=this.characterState.flawBonusCap;this.characterState.flawBonusCap=Number(event.currentTarget.value);
            const errors=validateMerits(this.characterState);
            if(errors.length||(this.characterState.phase==='freebies'&&evaluateFreebies(this.characterState,this.creationData).freebiesRemaining<0)){this.characterState.flawBonusCap=before;ui.notifications.warn(errors[0]||'That cap would leave the character over its Freebie budget.');}
            this._saveDraft();this._renderPreservingScroll();
        });
        // Preserve the user's collapsed help panels through dot changes.
        for(const panel of root.querySelectorAll('details[data-panel-key]')){
            this._panelOpen ??= {};
            const key = panel.dataset.panelKey;
            if (!Object.prototype.hasOwnProperty.call(this._panelOpen, key)) {
                // Initialize from the template (GM-approved pickers start collapsed); remember user toggles across renders.
                this._panelOpen[key] = panel.hasAttribute('open');
            }
            panel.open = this._panelOpen[key];
            panel.addEventListener('toggle', () => { this._panelOpen[key] = panel.open; });
        }
    }

    async _beginFreebies() {
        const evaluation = evaluateBaseCharacter(this.characterState, this.creationData);
        if (!evaluation.valid) {
            const firstIssue = evaluation.errors[0];
            ui.notifications.warn(`Finish base creation first.${firstIssue?.tab ? ` Check ${firstIssue.tab}.` : ""}`);
            return;
        }

        this.characterState.baseSnapshot = snapshotBase(this.characterState);
        this.characterState.phase = "freebies";

        // The base Sphere plan can require Arete above the starting value of 1.
        // That purchase is mandatory, so apply it automatically when Freebies
        // begin instead of making the user manually reproduce a prerequisite.
        const automaticAreteCost = applyRequiredArete(this.characterState, this.creationData);
        if (automaticAreteCost > 0) {
            ui.notifications.info(
                `Required Arete applied automatically: Arete ${this.characterState.core.arete} costs ${automaticAreteCost} Freebie Point${automaticAreteCost === 1 ? "" : "s"}.`
            );
        }

        this.stepIndex = 5;
        this._dismissedIssueSteps.clear();
        this._saveDraft();
        await this.render();
    }

    async _returnToBase(stepIndex = 4) {
        const base = this.characterState.baseSnapshot;
        if (!base) {
            this.characterState.phase = "base";
            this.stepIndex = Math.min(4, stepIndex);
            this._saveDraft();
            await this.render();
            return;
        }

        const evaluation = evaluateFreebies(this.characterState, this.creationData);
        const spent = evaluation.freebiesSpent - meritTotals(this.characterState).merits;
        if (spent > 0) {
            const confirmed = window.confirm(
                `Edit the base character? This will remove the ${spent} Freebie Point${spent === 1 ? "" : "s"} currently spent (including any automatically required Arete) and return all ratings to their base values. Merit and Flaw selections will be retained.`
            );
            if (!confirmed) return;
        }

        this.characterState.attributePriorities = foundry.utils.deepClone(base.attributePriorities);
        this.characterState.abilityPriorities = foundry.utils.deepClone(base.abilityPriorities);
        this.characterState.attributes = foundry.utils.deepClone(base.attributes);
        this.characterState.abilities = foundry.utils.deepClone(base.abilities);
        this.characterState.spheres = foundry.utils.deepClone(base.spheres);
        this.characterState.backgrounds = foundry.utils.deepClone(base.backgrounds);
        this.characterState.core = foundry.utils.deepClone(base.core);
        this.characterState.baseSnapshot = null;
        this.characterState.phase = "base";
        this.stepIndex = Math.max(0, Math.min(4, stepIndex));
        this._dismissedIssueSteps.clear();
        this._saveDraft();
        await this.render();
    }

    async _createMage() {
        if (this.creating) return;
        if (this.characterState.phase !== "freebies" || !this.characterState.baseSnapshot) {
            ui.notifications.error("Finish Base Review and the Freebie phase before creating the Mage.");
            return;
        }

        const evaluation = evaluateFreebies(this.characterState, this.creationData);
        if (!evaluation.valid) {
            const firstIssue = evaluation.errors[0];
            ui.notifications.error(`The Mage is not ready to create.${firstIssue?.tab ? ` First problem: ${firstIssue.tab}.` : ""}`);
            return;
        }

        // Freebie Points are a one-time character creation allocation, not XP.
        // Explicitly acknowledge forfeiture instead of silently discarding them.
        if (evaluation.freebiesRemaining > 0) {
            const unspent = evaluation.freebiesRemaining;
            const confirmed = window.confirm(
                `You still have ${unspent} unspent Freebie Point${unspent === 1 ? "" : "s"}. ` +
                `Freebie Points do NOT become XP and will be lost when this Mage is created.\n\n` +
                `Select OK to create this Mage anyway, or Cancel to return and spend the remaining points.`
            );
            if (!confirmed) return;
        }

        this.characterState.selectedAbilities=this.characterState.selectedAbilities.filter(id=>Number(this.characterState.abilities[id])>0);
        this.creating = true;
        await this.render();

        try {
            await createMageActor(this.characterState, this.creationData, evaluation);
            this._clearDraft();
            await this.close();
        }
        catch (error) {
            ui.notifications.error(`Mage creation failed: ${error.message}`);
            this.creating = false;
            this._saveDraft();
            await this.render();
        }
    }

    async close(options = {}) {
        this._cleanupConceptDropdowns?.();
        this._cleanupConceptDropdowns = null;
        this._cleanupSpecialtyDropdowns?.();
        this._cleanupSpecialtyDropdowns = null;
        this._cleanupBackgroundDropdown?.();
        this._cleanupBackgroundDropdown = null;
        document.removeEventListener("keydown", this._keyGuard, true);
        return super.close(options);
    }
}
