import {meritTotals,validateMerits} from './creation-extras.js';
export const RULES = Object.freeze({
    attributePools: Object.freeze({
        primary: 7,
        secondary: 5,
        tertiary: 3
    }),
    abilityPools: Object.freeze({
        primary: 13,
        secondary: 9,
        tertiary: 5
    }),
    baseSphereDots: 6,
    baseBackgroundDots: 7,
    baseArete: 1,
    baseWillpower: 5,
    freebies: 15,
    freebieCosts: Object.freeze({
        attribute: 5,
        ability: 2,
        background: 1,
        sphere: 7,
        arete: 4,
        willpower: 1
    }),
    creationCaps: Object.freeze({
        attributeBeforeFreebies: 4,
        abilityBeforeFreebies: 3,
        arete: 3,
        rating: 5,
        willpower: 10
    })
});

export const ATTRIBUTE_GROUPS = Object.freeze({
    physical: ["strength", "dexterity", "stamina"],
    social: ["charisma", "manipulation", "appearance"],
    mental: ["perception", "intelligence", "wits"]
});

export const PRIORITY_LABELS = Object.freeze({
    primary: "Primary",
    secondary: "Secondary",
    tertiary: "Tertiary"
});

export function startingArete(state) { return state?.freeArete2 === true ? 2 : RULES.baseArete; }

function sum(values) {
    return values.reduce((total, value) => total + Number(value || 0), 0);
}

export function capitalize(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export function priorityIsValid(priorities) {
    const values = Object.values(priorities ?? {});
    return values.length === 3 && new Set(values).size === 3 &&
        values.every(value => ["primary", "secondary", "tertiary"].includes(value));
}

function getPool(priorities, group, pools) {
    return pools[priorities?.[group]] ?? 0;
}

function makeIssue(stepIndex, tab, message, fix, { advisory = false } = {}) {
    return {
        stepIndex,
        tab,
        message,
        fix,
        advisory,
        canJump: stepIndex >= 0 && stepIndex <= 5
    };
}

function makeAdvisory(stepIndex, tab, message, fix) {
    return makeIssue(stepIndex, tab, message, fix, { advisory: true });
}

function makeWarning(stepIndex, tab, message, fix = "") {
    return { stepIndex, tab, message, fix, advisory: true, canJump: stepIndex >= 0 && stepIndex <= 5 };
}

function poolStatus(used, pool, { blocked = false } = {}) {
    const numericUsed = Math.max(0, Number(used ?? 0));
    const numericPool = Math.max(0, Number(pool ?? 0));
    return {
        pool: numericPool,
        used: numericUsed,
        remaining: blocked ? 0 : Math.max(0, numericPool - numericUsed),
        over: blocked ? 0 : Math.max(0, numericUsed - numericPool),
        complete: !blocked && numericUsed === numericPool,
        blocked
    };
}

function cloneBaseStateFromSnapshot(state) {
    const snapshot = state?.baseSnapshot;
    if (!snapshot) return null;

    return {
        ...state,
        attributePriorities: foundry.utils.deepClone(snapshot.attributePriorities),
        abilityPriorities: foundry.utils.deepClone(snapshot.abilityPriorities),
        attributes: foundry.utils.deepClone(snapshot.attributes),
        abilities: foundry.utils.deepClone(snapshot.abilities),
        spheres: foundry.utils.deepClone(snapshot.spheres),
        backgrounds: foundry.utils.deepClone(snapshot.backgrounds),
        core: foundry.utils.deepClone(snapshot.core)
    };
}

/**
 * Validate only the normal/base creation phase.
 * No freebie spending is recognized here.
 */
export function evaluateBaseCharacter(state, data) {
    const errors = [];
    const warnings = [];

    if (!state.identity.name?.trim()) {
        errors.push(makeAdvisory(
            0,
            "Concept",
            "Character name is still blank.",
            "Enter a name on the Concept tab before finishing base creation."
        ));
    }

    const attributePrioritiesValid = priorityIsValid(state.attributePriorities);
    if (!attributePrioritiesValid) {
        errors.push(makeAdvisory(
            1,
            "Attributes",
            "Attribute priorities still need to be chosen.",
            "Set Physical, Social, and Mental so one is Primary, one Secondary, and one Tertiary. Attribute dots unlock after that."
        ));
    }

    const attributeStatus = {};
    for (const [group, keys] of Object.entries(ATTRIBUTE_GROUPS)) {
        const purchasedDots = sum(keys.map(key => Math.max(0, Number(state.attributes[key] ?? 1) - 1)));
        const pool = attributePrioritiesValid
            ? getPool(state.attributePriorities, group, RULES.attributePools)
            : 0;
        const status = poolStatus(purchasedDots, pool, { blocked: !attributePrioritiesValid });
        attributeStatus[group] = status;

        for (const key of keys) {
            const value = Number(state.attributes[key] ?? 1);
            if (!Number.isSafeInteger(value) || value < 1 || value > RULES.creationCaps.attributeBeforeFreebies) {
                errors.push(makeIssue(
                    1,
                    "Attributes",
                    `${capitalize(key)} is ${value}. During base creation, Attributes must stay between 1 and ${RULES.creationCaps.attributeBeforeFreebies}.`,
                    `Set ${capitalize(key)} to 1-${RULES.creationCaps.attributeBeforeFreebies}. The fifth dot can be purchased later on the Freebies tab.`
                ));
            }
        }

        if (attributePrioritiesValid && status.remaining > 0) {
            errors.push(makeAdvisory(
                1,
                "Attributes",
                `${capitalize(group)} still has ${status.remaining} base creation dot${status.remaining === 1 ? "" : "s"} left to place.`,
                `Add ${status.remaining} more dot${status.remaining === 1 ? "" : "s"} in ${capitalize(group)}. These are normal creation dots, not freebie points.`
            ));
        }

        if (attributePrioritiesValid && status.over > 0) {
            errors.push(makeIssue(
                1,
                "Attributes",
                `${capitalize(group)} is ${status.over} dot${status.over === 1 ? "" : "s"} over its base allocation.`,
                `Remove ${status.over} dot${status.over === 1 ? "" : "s"} from ${capitalize(group)}. Extra Attribute dots are purchased later with Freebie Points.`
            ));
        }
    }

    const abilityPrioritiesValid = priorityIsValid(state.abilityPriorities);
    if (!abilityPrioritiesValid) {
        errors.push(makeAdvisory(
            2,
            "Abilities",
            "Ability priorities still need to be chosen.",
            "Set Talents, Skills, and Knowledges so one is Primary, one Secondary, and one Tertiary. Ability dots unlock after that."
        ));
    }

    const abilitiesByCategory = { talent: [], skill: [], knowledge: [] };
    for (const ability of data.abilities) {
        abilitiesByCategory[ability.category]?.push(ability);
        const value = Number(state.abilities[ability.id] ?? 0);
        if (!Number.isSafeInteger(value) || value < 0 || value > RULES.creationCaps.abilityBeforeFreebies) {
            errors.push(makeIssue(
                2,
                "Abilities",
                `${ability.name} is ${value}. During base creation, Abilities may not exceed ${RULES.creationCaps.abilityBeforeFreebies}.`,
                `Set ${ability.name} to 0-${RULES.creationCaps.abilityBeforeFreebies}. Ratings 4-5 can be purchased later on the Freebies tab.`
            ));
        }
    }

    const abilityStatus = {};
    for (const [group, abilities] of Object.entries(abilitiesByCategory)) {
        const used = sum(abilities.map(ability => Number(state.abilities[ability.id] ?? 0)));
        const pool = abilityPrioritiesValid
            ? getPool(state.abilityPriorities, group, RULES.abilityPools)
            : 0;
        const status = poolStatus(used, pool, { blocked: !abilityPrioritiesValid });
        abilityStatus[group] = status;

        if (abilityPrioritiesValid && status.remaining > 0) {
            errors.push(makeAdvisory(
                2,
                "Abilities",
                `${capitalize(group)}s still have ${status.remaining} base creation dot${status.remaining === 1 ? "" : "s"} left to place.`,
                `Add ${status.remaining} more dot${status.remaining === 1 ? "" : "s"} among the ${capitalize(group)}s. These are normal creation dots.`
            ));
        }

        if (abilityPrioritiesValid && status.over > 0) {
            errors.push(makeIssue(
                2,
                "Abilities",
                `${capitalize(group)}s are ${status.over} dot${status.over === 1 ? "" : "s"} over their base allocation.`,
                `Remove ${status.over} dot${status.over === 1 ? "" : "s"} from the ${capitalize(group)}s. Extra Ability dots are purchased later with Freebie Points.`
            ));
        }
    }

    const baseArete = startingArete(state);
    const arete = Number(state.core.arete ?? baseArete);
    const willpower = Number(state.core.willpower ?? RULES.baseWillpower);

    if (arete !== baseArete) {
        errors.push(makeIssue(
            3,
            "Magic & Backgrounds",
            `Base creation starts with Arete ${baseArete}.`,
            `Return Arete to ${baseArete}. Additional Arete is purchased later with Freebie Points.`
        ));
    }

    if (willpower !== RULES.baseWillpower) {
        errors.push(makeIssue(
            3,
            "Magic & Backgrounds",
            `Base creation starts with Willpower ${RULES.baseWillpower}.`,
            `Return Willpower to ${RULES.baseWillpower}. Additional Willpower is purchased later with Freebie Points.`
        ));
    }

    const sphereValues = data.spheres.map(sphere => Number(state.spheres[sphere.id] ?? 0));
    const sphereDots = sum(sphereValues);
    const sphereStatus = poolStatus(sphereDots, RULES.baseSphereDots);

    for (const sphere of data.spheres) {
        const value = Number(state.spheres[sphere.id] ?? 0);
        if (!Number.isSafeInteger(value) || value < 0 || value > RULES.creationCaps.arete) {
            errors.push(makeIssue(
                3,
                "Magic & Backgrounds",
                `${sphere.name} has a base rating of ${value}.`,
                `During character creation, plan base Sphere ratings from 0-${RULES.creationCaps.arete}. Final Sphere ratings still cannot exceed final Arete.`
            ));
        }
    }

    const highestBaseSphere = Math.max(0, ...sphereValues);
    const requiredArete = Math.max(baseArete, highestBaseSphere);
    const requiredAreteDots = Math.max(0, requiredArete - baseArete);
    const requiredAreteFreebieCost = requiredAreteDots * RULES.freebieCosts.arete;

    if (requiredArete > arete) {
        warnings.push(makeWarning(
            3,
            "Magic & Backgrounds",
            `Your planned Sphere ratings require Arete ${requiredArete}.`,
            `That is expected at this stage. Starting Arete is ${baseArete}; on the Freebies tab, raise Arete by ${requiredAreteDots} dot${requiredAreteDots === 1 ? "" : "s"} for ${requiredAreteFreebieCost} Freebie Point${requiredAreteFreebieCost === 1 ? "" : "s"}.`
        ));
    }

    if (sphereStatus.remaining > 0) {
        errors.push(makeAdvisory(
            3,
            "Magic & Backgrounds",
            `Spheres still have ${sphereStatus.remaining} base creation dot${sphereStatus.remaining === 1 ? "" : "s"} left to place.`,
            `Place ${sphereStatus.remaining} more Sphere dot${sphereStatus.remaining === 1 ? "" : "s"}. You receive ${RULES.baseSphereDots} base Sphere dots before freebies.`
        ));
    }
    if (sphereStatus.over > 0) {
        errors.push(makeIssue(
            3,
            "Magic & Backgrounds",
            `Spheres are ${sphereStatus.over} dot${sphereStatus.over === 1 ? "" : "s"} over the base allocation.`,
            `Remove ${sphereStatus.over} Sphere dot${sphereStatus.over === 1 ? "" : "s"}. Extra Sphere dots are purchased later with Freebie Points.`
        ));
    }

    const affinitySphere = state.identity.affinitySphere;
    if (!affinitySphere) {
        errors.push(makeAdvisory(
            0,
            "Concept",
            "Affinity Sphere is still unselected.",
            "Choose an Affinity Sphere on the Concept tab before finishing base creation."
        ));
    }
    else if (Number(state.spheres[affinitySphere] ?? 0) < 1) {
        const affinityName = data.spheres.find(sphere => sphere.id === affinitySphere)?.name ?? "the chosen Affinity Sphere";
        errors.push(makeIssue(
            3,
            "Magic & Backgrounds",
            `${affinityName} is your Affinity Sphere but currently has 0 dots.`,
            `Give ${affinityName} at least 1 Sphere dot, or choose a different Affinity Sphere on the Concept tab.`
        ));
    }

    const backgroundValues = data.backgrounds.map(background => Number(state.backgrounds[background.key] ?? 0));
    const backgroundDots = sum(backgroundValues);
    const backgroundStatus = poolStatus(backgroundDots, RULES.baseBackgroundDots);

    for (const background of data.backgrounds) {
        const value = Number(state.backgrounds[background.key] ?? 0);
        if (!Number.isSafeInteger(value) || value < 0 || value > RULES.creationCaps.rating) {
            errors.push(makeIssue(
                3,
                "Magic & Backgrounds",
                `${background.name} has an invalid rating of ${value}.`,
                `Set ${background.name} between 0 and ${RULES.creationCaps.rating}.`
            ));
        }
    }

    if (backgroundStatus.remaining > 0) {
        errors.push(makeAdvisory(
            3,
            "Magic & Backgrounds",
            `Backgrounds still have ${backgroundStatus.remaining} base creation dot${backgroundStatus.remaining === 1 ? "" : "s"} left to place.`,
            `Place ${backgroundStatus.remaining} more Background dot${backgroundStatus.remaining === 1 ? "" : "s"}. You receive ${RULES.baseBackgroundDots} base Background dots before freebies.`
        ));
    }
    if (backgroundStatus.over > 0) {
        errors.push(makeIssue(
            3,
            "Magic & Backgrounds",
            `Backgrounds are ${backgroundStatus.over} dot${backgroundStatus.over === 1 ? "" : "s"} over the base allocation.`,
            `Remove ${backgroundStatus.over} Background dot${backgroundStatus.over === 1 ? "" : "s"}. Extra Background dots are purchased later with Freebie Points.`
        ));
    }

    const hardErrors = errors.filter(issue => !issue.advisory);
    const advisoryErrors = errors.filter(issue => issue.advisory);

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        hardErrors,
        advisoryErrors,
        hasHardErrors: hardErrors.length > 0,
        hasAdvisoryErrors: advisoryErrors.length > 0,
        attributePrioritiesValid,
        abilityPrioritiesValid,
        attributeStatus,
        abilityStatus,
        sphereStatus,
        backgroundStatus,
        sphereDots,
        backgroundDots,
        highestBaseSphere,
        requiredArete,
        requiredAreteDots,
        requiredAreteFreebieCost,
        quintessence: Number(state.backgrounds[data.avatarBackgroundKey] ?? 0)
    };
}

/**
 * Validate and price the dedicated Freebie phase.
 * Base creation is represented by state.baseSnapshot. Current ratings may only
 * move upward from that snapshot.
 */
export function evaluateFreebies(state, data) {
    const errors = validateMerits(state).map(message=>makeIssue(5,"Freebies",message,"Correct the Merit / Flaw entry."));
    const warnings = [];
    const totals = meritTotals(state);
    const base = state.baseSnapshot;
    for(const values of [state.attributes,state.abilities,state.spheres,state.backgrounds,state.core])if(Object.values(values||{}).some(v=>!Number.isSafeInteger(Number(v))))errors.push(makeIssue(5,'Freebies','Trait ratings must be whole numbers.','Remove any fractional or invalid ratings.'));

    if (!base) {
        errors.push(makeIssue(
            5,
            "Freebies",
            "The base character has not been locked in yet.",
            "Return to Base Review and finish the normal creation allocations before spending Freebie Points."
        ));

        return {
            valid: false,
            errors,
            warnings,
            hardErrors: errors,
            advisoryErrors: [],
            hasHardErrors: true,
            hasAdvisoryErrors: false,
            freebieDots: { attributes: 0, abilities: 0, spheres: 0, backgrounds: 0, arete: 0, willpower: 0 },
            freebieBreakdown: { attributes: 0, abilities: 0, spheres: 0, backgrounds: 0, arete: 0, willpower: 0 },
            itemFreebieDots: { attributes: {}, abilities: {}, spheres: {}, backgrounds: {}, core: { arete: 0, willpower: 0 } },
            freebiesSpent: 0,
            freebiesRemaining: RULES.freebies,
            quintessence: Number(state.backgrounds[data.avatarBackgroundKey] ?? 0),
            baseEvaluation: null
        };
    }

    const baseState = cloneBaseStateFromSnapshot(state);
    const baseEvaluation = evaluateBaseCharacter(baseState, data);
    if (!baseEvaluation.valid) {
        errors.push(makeIssue(
            5,
            "Freebies",
            "The saved base character is no longer valid.",
            "Use Edit Base Character, correct the base allocations, and then start the Freebie phase again."
        ));
    }

    const itemFreebieDots = {
        attributes: {},
        abilities: {},
        spheres: {},
        backgrounds: {},
        core: { arete: 0, willpower: 0 }
    };

    const freebieDots = {
        attributes: 0,
        abilities: 0,
        spheres: 0,
        backgrounds: 0,
        arete: 0,
        willpower: 0
    };

    for (const key of Object.keys(base.attributes)) {
        const baseValue = Number(base.attributes[key] ?? 1);
        const current = Number(state.attributes[key] ?? baseValue);
        if (current < baseValue) {
            errors.push(makeIssue(5, "Freebies", `${capitalize(key)} fell below its locked base rating of ${baseValue}.`, "Remove Freebie changes only down to the original base rating, or use Edit Base Character to change the base character."));
        }
        if (current > RULES.creationCaps.rating) {
            errors.push(makeIssue(5, "Freebies", `${capitalize(key)} exceeds the maximum rating of ${RULES.creationCaps.rating}.`, `Lower ${capitalize(key)} to ${RULES.creationCaps.rating} or less.`));
        }
        const dots = Math.max(0, current - baseValue);
        itemFreebieDots.attributes[key] = dots;
        freebieDots.attributes += dots;
    }

    for (const ability of data.abilities) {
        const baseValue = Number(base.abilities[ability.id] ?? 0);
        const current = Number(state.abilities[ability.id] ?? baseValue);
        if (current < baseValue) {
            errors.push(makeIssue(5, "Freebies", `${ability.name} fell below its locked base rating of ${baseValue}.`, "Freebie changes can only be removed back to the base rating. Use Edit Base Character if you want to rebuild the normal allocation."));
        }
        if (current > RULES.creationCaps.rating) {
            errors.push(makeIssue(5, "Freebies", `${ability.name} exceeds the maximum rating of ${RULES.creationCaps.rating}.`, `Lower ${ability.name} to ${RULES.creationCaps.rating} or less.`));
        }
        const dots = Math.max(0, current - baseValue);
        itemFreebieDots.abilities[ability.id] = dots;
        freebieDots.abilities += dots;
    }

    const arete = Number(state.core.arete ?? base.core.arete ?? RULES.baseArete);
    const baseArete = Number(base.core.arete ?? RULES.baseArete);
    if (arete < baseArete || arete > RULES.creationCaps.arete) {
        errors.push(makeIssue(5, "Freebies", `Arete must stay between the base rating ${baseArete} and ${RULES.creationCaps.arete}.`, `Set Arete from ${baseArete} to ${RULES.creationCaps.arete}.`));
    }
    freebieDots.arete = Math.max(0, arete - baseArete);
    itemFreebieDots.core.arete = freebieDots.arete;

    const willpower = Number(state.core.willpower ?? base.core.willpower ?? RULES.baseWillpower);
    const baseWillpower = Number(base.core.willpower ?? RULES.baseWillpower);
    if (willpower < baseWillpower || willpower > RULES.creationCaps.willpower) {
        errors.push(makeIssue(5, "Freebies", `Willpower must stay between the base rating ${baseWillpower} and ${RULES.creationCaps.willpower}.`, `Set Willpower from ${baseWillpower} to ${RULES.creationCaps.willpower}.`));
    }
    freebieDots.willpower = Math.max(0, willpower - baseWillpower);
    itemFreebieDots.core.willpower = freebieDots.willpower;

    for (const sphere of data.spheres) {
        const baseValue = Number(base.spheres[sphere.id] ?? 0);
        const current = Number(state.spheres[sphere.id] ?? baseValue);
        if (current < baseValue) {
            errors.push(makeIssue(5, "Freebies", `${sphere.name} fell below its locked base rating of ${baseValue}.`, "Freebie changes can only be removed back to the base rating. Use Edit Base Character to change the base allocation."));
        }
        if (current > RULES.creationCaps.rating) {
            errors.push(makeIssue(5, "Freebies", `${sphere.name} exceeds the maximum rating of ${RULES.creationCaps.rating}.`, `Lower ${sphere.name} to ${RULES.creationCaps.rating} or less.`));
        }
        const dots = Math.max(0, current - baseValue);
        itemFreebieDots.spheres[sphere.id] = dots;
        freebieDots.spheres += dots;
    }

    const highestSphere = Math.max(0, ...data.spheres.map(sphere => Number(state.spheres[sphere.id] ?? 0)));
    if (highestSphere > arete) {
        const dotsNeeded = highestSphere - arete;
        const costNeeded = dotsNeeded * RULES.freebieCosts.arete;
        errors.push(makeAdvisory(
            5,
            "Freebies",
            `Your Sphere plan needs Arete ${highestSphere}; current Arete is ${arete}.`,
            `Raise Arete by ${dotsNeeded} dot${dotsNeeded === 1 ? "" : "s"}. At ${RULES.freebieCosts.arete} FP per dot, that costs ${costNeeded} FP. This is a normal character-creation step, not a mistake.`
        ));
    }

    for (const background of data.backgrounds) {
        const baseValue = Number(base.backgrounds[background.key] ?? 0);
        const current = Number(state.backgrounds[background.key] ?? baseValue);
        if (current < baseValue) {
            errors.push(makeIssue(5, "Freebies", `${background.name} fell below its locked base rating of ${baseValue}.`, "Freebie changes can only be removed back to the base rating. Use Edit Base Character to change the base allocation."));
        }
        if (current > RULES.creationCaps.rating) {
            errors.push(makeIssue(5, "Freebies", `${background.name} exceeds the maximum rating of ${RULES.creationCaps.rating}.`, `Lower ${background.name} to ${RULES.creationCaps.rating} or less.`));
        }
        const dots = Math.max(0, current - baseValue);
        itemFreebieDots.backgrounds[background.key] = dots;
        freebieDots.backgrounds += dots;
    }

    const freebieBreakdown = {
        attributes: freebieDots.attributes * RULES.freebieCosts.attribute,
        abilities: freebieDots.abilities * RULES.freebieCosts.ability,
        spheres: freebieDots.spheres * RULES.freebieCosts.sphere,
        backgrounds: freebieDots.backgrounds * RULES.freebieCosts.background,
        arete: freebieDots.arete * RULES.freebieCosts.arete,
        willpower: freebieDots.willpower * RULES.freebieCosts.willpower
    };

    freebieBreakdown.merits = totals.merits;
    const freebiesSpent = sum(Object.values(freebieBreakdown));
    const freebiesRemaining = totals.budget - freebiesSpent;
    for(const [key,value] of Object.entries(state.attributes))if(Number(value)>=4&&!String(state.specialties?.attributes?.[key]||'').trim())errors.push(makeIssue(5,'Freebies',capitalize(key)+' requires a specialty.','Choose a suggestion or enter a custom specialty.'));
    for(const a of data.abilities)if(Number(state.abilities[a.id])>=4&&!String(state.specialties?.abilities?.[a.id]||'').trim())errors.push(makeIssue(5,'Freebies',a.name+' requires a specialty.','Choose a suggestion or enter a custom specialty.'));

    if (freebiesRemaining < 0) {
        const over = Math.abs(freebiesRemaining);
        errors.push(makeIssue(
            5,
            "Freebies",
            `The character is ${over} Freebie Point${over === 1 ? "" : "s"} over the ${totals.budget}-point budget.`,
            "Remove one or more green freebie dots until the budget fits the current total, including Merits and credited Flaws."
        ));
    }
    else if (freebiesRemaining > 0) {
        warnings.push(makeWarning(
            6,
            "Final Review",
            `${freebiesRemaining} Freebie Point${freebiesRemaining === 1 ? "" : "s"} remain unspent.`,
            "Freebie Points are only usable during character creation. Unspent points will be lost, not converted to XP. Return to Freebies to spend them, or explicitly confirm when creating this Mage."
        ));
    }

    const hardErrors = errors.filter(issue => !issue.advisory);
    const advisoryErrors = errors.filter(issue => issue.advisory);

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        hardErrors,
        advisoryErrors,
        hasHardErrors: hardErrors.length > 0,
        hasAdvisoryErrors: advisoryErrors.length > 0,
        freebieDots,
        freebieBreakdown,
        itemFreebieDots,
        freebiesSpent,
        freebiesRemaining,
        freebieBudget: totals.budget,
        meritTotals: totals,
        quintessence: Number(state.backgrounds[data.avatarBackgroundKey] ?? 0),
        baseEvaluation
    };
}

/**
 * Backward-compatible helper for the actor builder / any external callers.
 * During base creation it returns base validation. During the Freebie phase it
 * returns final/freebie validation.
 */
export function evaluateCharacter(state, data) {
    return state?.phase === "freebies"
        ? evaluateFreebies(state, data)
        : evaluateBaseCharacter(state, data);
}
