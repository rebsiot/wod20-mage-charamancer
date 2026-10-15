export const XP_RULES = Object.freeze({
    newAbility: 3,
    abilityMultiplier: 2,
    newSphere: 10,
    affinitySphereMultiplier: 7,
    otherSphereMultiplier: 8,
    attributeMultiplier: 4,
    areteMultiplier: 8,
    willpowerMultiplier: 1
});

export function xpStepCost(kind, currentRating, { affinity = false } = {}) {
    const current = Math.max(0, Number(currentRating ?? 0));

    switch (kind) {
        case "attribute":
            return current * XP_RULES.attributeMultiplier;

        case "ability":
            return current === 0
                ? XP_RULES.newAbility
                : current * XP_RULES.abilityMultiplier;

        case "sphere":
            if (current === 0) return XP_RULES.newSphere;
            return current * (affinity
                ? XP_RULES.affinitySphereMultiplier
                : XP_RULES.otherSphereMultiplier);

        case "arete":
            return current * XP_RULES.areteMultiplier;

        case "willpower":
            return current * XP_RULES.willpowerMultiplier;

        default:
            return 0;
    }
}

export function xpRangeCost(kind, fromRating, toRating, options = {}) {
    const from = Math.max(0, Number(fromRating ?? 0));
    const to = Math.max(from, Number(toRating ?? from));
    let total = 0;

    for (let current = from; current < to; current += 1) {
        total += xpStepCost(kind, current, options);
    }

    return total;
}

export function xpFormulaLabel(kind, { affinity = false } = {}) {
    switch (kind) {
        case "attribute": return "current rating × 4";
        case "ability": return "new Ability 3 XP; otherwise current rating × 2";
        case "sphere": return affinity
            ? "new Sphere 10 XP; Affinity Sphere current rating × 7"
            : "new Sphere 10 XP; other Sphere current rating × 8";
        case "arete": return "current rating × 8";
        case "willpower": return "current rating × 1";
        default: return "";
    }
}
