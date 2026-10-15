## v0.5.33 - Safe actor updates and XP history

See RELEASE-NOTES-0.5.33.txt for the complete changes. Web import can now update a selected current actor with an automatic safety backup; XP awards support dated short labels, optional longer biography notes, and consolidated history.

## v0.5.30 — Collapsible GM-approved Ability pickers

- Additional / GM-approved Talents, Skills, and Knowledges now start **collapsed** in Base Creation and Freebies.
- Expand a category only when needed; the existing panel state is preserved through dot changes and other rerenders during the session.
- Previously added non-core abilities and their ratings stay visible under the standard abilities.
- No changes to the available ability catalog, Freebie costs, saved character data, or import/export.

## v0.5.29 — Wider Mage creation window

- **Create New Mage** now opens at approximately 94% of the available Foundry browser width, capped at 1720 px.
- Retains ApplicationV2 window resizing and preserves any explicit width supplied by a caller.
- No changes to the launcher, creation rules, saved drafts, character data, or XP.

## 0.5.26

- Increased inline Freebie budget counter type sizes and balanced spacing; maintains single-line header.
- No creation, XP, or character-data changes.

## v0.5.24 — Compact Freebie header

- Moved Budget / Spent / Remaining into the heading row between **Spend Freebie Points** and **Spending rules**.
- Removed the separate full-width budget card.
- Preserved the automatic required-Arete breakdown in an information tooltip on Spent.
- Responsive layout wraps the totals only when there is insufficient space.
- No changes to Freebie calculations, spending, completion rules, or saved drafts.

# Mage Character Tools — Foundry 0.5.11

For Foundry VTT 14 with World of Darkness 20th (`worldofdarkness`) 7.3.1 or later. Uses the current **PC Mage**, not the deprecated Mage actor type.

## Install / upgrade

Replace the existing `Data/modules/wod20-mage-charamancer` folder with the folder in this ZIP, restart Foundry, and enable the module in the world. Keep the same module ID so the existing launcher macro continues to work. Open the **Mage Charamancer** macro, or run `game.wod20MageCharamancer.open()`.

On the left toolbar, select **Token Controls**, then click the **wizard hat** button (**Mage Character Tools**). It opens one main panel with Create New Mage, Import Web Character, Export Mage Character, Mage Details / Specialties, Add XP and Spend XP. XP actions use the selected PC Mage token, or open a character chooser when none is selected. The existing macro opens the same panel.

## Character creation and web import

Choose **Create New Mage** to open the expanded Foundry creation wizard. Use the web charamancer for adjusting an already completed character against its creation budget and for PDF import/export. In the web tool choose **Export Foundry JSON**. In Foundry choose **Import Web Character** and select that JSON.

The Foundry wizard now includes:

- Editable choices for Nature, Demeanor, Concept, Affiliation and Essence, plus faction suggestions filtered by Affiliation. Custom text remains available.
- Player, Chronicle, appearance, biography, RP direction, and examples for Paradigm, Practice and Instruments. Narrative text remains available in Mage Details through module flags.
- The full 33 core Mage Backgrounds in base creation; Freebie choices exclude Backgrounds already displayed. Custom Backgrounds need a name, explanation and DM-defined benefits.
- Optional secondary Ability pickers using the same web catalog. Non-core traits are blue and marked `**`; overlapping names are listed in core information hovers. Unrated extras do not create actor Items.
- Information hovers, current dot descriptions, and a collapsible dot guide with category and trait filters. Help stays collapsed after rating changes.
- Merits and Flaws with example/custom choices, descriptions, visible Added entries and point costs. Merits count as Freebie spending; Flaws add a bonus capped at 7 FP by default. The campaign cap is editable from 0–20, with explicit DM approval required. Removing a Flaw or reducing the cap cannot invalidate existing purchases.
- Required specialties at rating 4+, with suggestions and custom entries. Attributes may reach 4 during normal base allocation; rating 4+ outside Attributes is marked for explicit DM approval. Freebie spending and final creation remain blocked when budgets or required specialties are invalid.

The module creates a **new PC Mage**, preserving the exported traits, non-core Abilities, Backgrounds, Merits/Flaws, Focus, biography and Player/Chronicle flags. It does not overwrite an existing actor or merge two characters. The importing user must have Actor creation permission (or be GM). The new actor is private by default, with ownership assigned to the importing user; the GM can assign player permissions normally. The import is local and does not send character data to a service. PDFs and the old App JSON format are not accepted by this Foundry importer.

## In-play tools

- **Spend XP:** plan purchases in Attributes, Abilities and Spheres/Arete/Willpower, then review and apply. Existing ratings remain neutral; planned purchases are green; unavailable purchases are grey. Existing XP costs are retained. A stored Affinity Sphere cannot be changed to obtain another Sphere's discount.
- **Add XP:** add a positive whole-number award with a dated Experience record and session note.
- **Mage Details / Specialties:** inspect descriptions, alternate core Ability names, 1–5 dot guidance, Background guidance and selected Merits/Flaws. Non-core Abilities are blue and marked `**`, with a small explicit DM approval note. Costs/bonuses on Merits/Flaws are creation references; effects are not automatically applied to rolls.
- **Specialties:** Attributes and Abilities rated 4+ need a nonblank specialty before XP spending. Missing specialties open Mage Details. Choose a suggestion or type custom text, then **Save Specialties** without spending XP. Purchases reaching rating 4 show required specialty entries in the spending Review.
- **XP:** module panels show **Unspent**, **Spent**, and **Total Earned**, with **Unspent + Spent = Total Earned**. Native WoD20 Experience items remain the ledger. Explicitly unchecked spent records are not deducted; invalid amounts are rejected. Overspent ledgers display negative Unspent rather than hiding the discrepancy.

A **Mage Details / XP** button is added to supported PC Mage actor-sheet headers. The module does not replace system sheet templates or rename their own native labels; the new descriptions and clear totals are available through Mage Details and the module's XP windows. The launcher always offers Mage Details if a custom sheet does not expose the header button.

Trait summaries and dot guidance are concise original app descriptions. Background guides describe qualitative scope, not exact mechanical quantities. Core aliases are consolidation choices, not additional bonuses. Custom traits retain their existing descriptions. Requirements and prerequisites remain subject to the DM and the selected Mage rules.

## Existing functionality

**Install Starter Content** remains available to GMs. It installs the existing starter gear, natural attacks and 33 core Mage Background Items, with duplicate prevention. Existing actor data and XP records are not automatically rewritten or migrated.

**Create New Mage** and **Import Web Character** are separate launcher buttons. The creation API (`game.wod20MageCharamancer.create()`) also remains available for existing macros. There is no PDF feature or creation-budget adjustment editor in this Foundry release.

Public API: `open()`, `create()`, `importFromWeb()`, `importCharacter(actorJSON)`, `exportCharacter(actor)`, `details(actor)`, `spendXP(actor)`, `addXP(actor)`. Earlier `advance()` and `addExperience()` aliases remain available.

## Validation

Checks used an actual Foundry JSON export from web version 0.1.20 and simulated Foundry documents. Import structure, new-actor permissions, catalog/core aliases/non-core traits, Merits/Flaws, required specialties, XP costs, integer awards, stale-actor detection, rollback after an injected write failure, specialty-only edits without XP changes, application contexts, module hook/API registration, template block structure and JavaScript syntax passed. Version 0.5.0 also checks four left-toolbar actions, selected-token routing, identity/faction suggestions, secondary catalogs, Merits/Flaws and custom Background budgeting, required creation specialties, custom draft restoration, native Background/Flaw levels and created actor flags using a simulated system template installer. Earlier launcher checks include left-toolbar registration, direct creation routing, permission visibility, duplicate prevention, and separate Create New Mage and Import Web Character event handlers and launcher callback wiring.

Live Foundry rendering, sheet integration, template compilation and actual document-schema acceptance have not been tested in a running world. First live check: create a Mage with a custom Background, a secondary Ability, a Merit and a Flaw; verify native item ratings, then import one web character, open Mage Details, save a specialty, Add XP, and make a small Spend XP purchase.

## 0.5.1 Ability guidance fix

Foundry template Ability IDs and names now resolve to the app catalog before looking up dot guidance. Artist uses Art guidance, Ride uses Riding guidance, and Animal Ken uses Animal Kinship guidance. Existing template items retain their native ID, name and category. Their overlapping secondary entries are omitted from the creation picker. Dodge and Larceny have their own app guidance; any unmatched custom Ability gets an explicitly labeled general five-dot guide. This also applies in Mage Details and Spend XP.

Animal Ken / Animal Kinship is treated as one overlapping slot for this charamancer, not an assertion that all editions use identical mechanics. Existing actors are not modified. When an old creation draft contains both a template Ability and its added catalog counterpart, the higher rating and existing specialty are retained, and a warning tells you to review allocations and spending; the wizard still validates those budgets before creation.

## 0.5.2 Character creation fix

Creation now stores all module metadata using the installed `wod20-mage-charamancer` flag namespace. The previous web-only namespace caused Foundry to reject `setFlag` before secondary Ability creation. Mage Details can still read legacy web metadata, and imports also copy it into the active module namespace. Tests now enforce Foundry's flag-scope restriction.

Template selection prefers a complete modern Mage template over a complete Sorcerers Crusade / Dark Ages variant when both are available. The previous equal-score selection could pick the historical template first. A complete Mage template remains required.

## 0.5.3 Single toolbar entry

One wizard-hat button opens the main Mage Character Tools panel. The separate Details/Add XP/Spend XP toolbar buttons have been removed. Tests verify main-panel routing, repeated control rebuilding without duplicates, player visibility, and removal of obsolete module buttons while preserving other tools.

## 0.5.4 Export Mage Character

The main panel includes Export Mage Character. It downloads native Foundry Actor JSON for the selected world Mage, or opens a chooser of owned PC Mages when none is selected. Export requires ownership or GM access, preserves native items and flags, and uses Foundry's public `Actor.exportToJSON()` method. The left toolbar still has only one wizard-hat button. Player instructions are included in this ZIP and the matching browser 0.1.21 package.

## 0.5.5 Spend XP rendering fix

Moved the non-core approval notice inside the single root element of `templates/advancement.hbs`. Foundry V14 ApplicationV2 requires exactly one root HTML element per template part; the preceding paragraph caused Spend XP to fail before its window opened. No advancement math or actor update behavior was changed.

## 0.5.6 - Non-core browser import validation

After importing a web-generated PC Mage, compare all rated non-core Talents, Skills and Knowledges against the actor embedded Items. Repair missing Abilities and mismatched categories/ratings/visibility using native WoD20 Ability Items. New browser version 0.1.23 embeds a redundant actor-level non-core Ability manifest for recovery if an exported Item is omitted; old web exports with Item-level flags remain supported. Import reports category counts, and failure removes the newly created duplicate actor instead of claiming success. Existing actors are not modified. Browser exports now select all rated non-core Abilities even if the saved selected-IDs list is stale.

Static and mocked integration checks only; confirm behavior in a live Foundry V14 / WoD20 7.3.1 world.

## 0.5.7 — Optional starting Arete 2 and browser NPC compatibility

On the Foundry Concept step, check the GM option for Arete 2 at no Freebie cost. The required Arete calculation, Freebie snapshot and planning text use the selected starting value; unselected remains Arete 1. The browser 0.1.24 version adds the equivalent per-character PC checkbox and a Quick NPC fill-dots editor. NPCs export as Mage-compatible PC-type actor JSON with an app-owned `characterKind=npc` flag; **Import Web Character** accepts and labels these imports, restoring non-core Skills and Knowledges. Foundry does not create a deprecated Mage actor type. Browser NPC creation is intended for GM use; this module does not provide a native Foundry quick-NPC editor.

## 0.5.8 - Print M20 Sheet / Save as PDF

Open **Mage Character Tools > Print M20 Sheet / Save as PDF**, or open a PC Mage actor sheet and use **Print M20 Sheet** in the window header. Select a Mage if no token is selected. Printing requires GM status or ownership of the Actor. The module opens a separate print-ready browser tab showing the M20 sheet based on the **current Foundry character**, including Attributes, core/non-core Talents, Skills and Knowledges, Spheres, Backgrounds, Arete, Willpower, Quintessence, Paradox, Health, Merits/Flaws, specialty notes and authoritative experience totals. Additional notes/XP entries continue onto further pages.

Click **Print / Save as PDF** and choose your browser's Save as PDF printer, **US Letter portrait, 100% scale**. Unlike the standalone browser's fillable PDF export, this is **print-only** and not a fillable/importable character PDF; use **Export Mage Character** for portable JSON backups. Printing does not spend XP, save changes, or alter the actor. Popups must be permitted for your Foundry site. An actor owned by another user is not printable unless you're GM.

The print layout is based on the matching browser charamancer's M20 vector sheet, adapted so temporary Willpower, Quintessence/Paradox, Health marks and XP totals are **visible on the printed page** without PDF editing software. Compatible with WoD20 PC-type Mage actors, including Mage NPCs imported via the browser. No changes to the standalone web charamancer are needed.

The JS syntax and simulated actor-to-print HTML tests passed. Confirm print dialog and actual actor data with a live Foundry V14 world before campaign use.

## 0.5.9 - Fillable PDF from Foundry
In the M20 print preview, use **Download fillable PDF** for real AcroForm Willpower, Quintessence, Paradox, Health, and XP controls. **Print (static PDF)** remains available for paper printing but does not preserve interactive fields. Changes made in a PDF do not update the live Foundry actor.

## 0.5.10 — Merits and Flaws in Freebie phase only

Removed the editable Merits & Flaws panel from the Concept stage. Add, remove and configure Merits/Flaws only on the dedicated Freebies tab, inside the Freebie spending panel. Final Review shows their costs and descriptions without editing controls. Existing selections and saved drafts are preserved; revisiting base creation retains previously chosen Merits/Flaws for later Freebie editing. The existing freebie-budget, flaw-cap validation, native actor import/export and fillable PDF printing are unchanged.


## 0.5.11 — Concept step field layout

Reorganized the Foundry wizard's Concept identity fields to use a full-width Concept row, followed by Nature/Demeanor, Affiliation/Faction (Tradition/Convention), and Affinity Sphere/Essence as paired rows. The text-entry and suggestion controls are unchanged, as are draft saving, creation rules, validation and actor exports. This is a UI-only change; the browser charamancer does not need updating.


## 0.5.14 — Compact identity layout

Concept tab identity inputs now appear in a more compact two-column order: Player / Chronicle, Name / Concept, Nature / Demeanor, Affiliation / Faction (Tradition/Convention), and Affinity Sphere / Essence. The optional free Arete 2 checkbox appears beneath these identity fields, before Appearance. Field behavior, saved values, validation, creation costs, imports/exports, and printing remain unchanged.

## 0.5.14 — Compact Concept screen
- Redesigned Concept into Campaign, Character, and Tradition & Magick sections, retaining previous field order.
- Replaced paired text box/suggestion dropdowns with a single editable suggestion field.
- Reduced Concept-only progress and warning chrome; creation rules remain expandable.
- Moved biography, appearance, paradigm, practice, and instruments into a collapsed optional section.
- Moved optional free Arete 2 control into a collapsed GM options section with an active indicator.
- No changes to stored character data, allocation logic, import/export, or other screens.

## 0.5.14 — Theme-aware Concept dropdowns
- Replaced native datalist/Select popups for Concept identity and Affinity Sphere with a consistent accessible custom listbox.
- Dropdowns respect current light/dark appearance, use a wider (field-width) menu with scrolling, and flip up when necessary.
- Chevron always reopens the complete suggestion list, even after choosing or entering a value; typing filters with a Show All escape hatch.
- Free text is still accepted for narrative fields; Sphere selection remains restricted to valid Sphere IDs.
- Preserves existing faction filtering, draft saves, character state, and Freebie accounting.


## 0.5.15 — Suggested Affinity Spheres
- The Concept Affinity Sphere popup now shows faction-recommended M20 Spheres first, highlighted with a subtle label.
- The remaining Spheres stay fully selectable, including nonstandard Storyteller-approved choices (e.g., Life for a Chorister).
- Options recompute from the current Faction input, without changing any saved selection, dot assignments, Freebies, or XP costs.
- Optional Technocratic Sphere names are represented by their core Sphere equivalents when not separately available.

## v0.5.17
- Both the Base Abilities and Freebies screens now show expanded Additional / GM-approved Talents, Skills, and Knowledges pickers with scrollable selections.
- Selected extras are grouped below core Abilities; no changes to rating or FP accounting.
- Panel open/closed state is preserved when changing dots.

### 0.5.18 - Ability selection layout

- In Base Creation and Freebie spending, standard Talent/Skill/Knowledge ratings appear first.
- GM-approved Ability selections now sit beneath the standard trait list (and beneath any already selected non-core abilities).
- This is a template order change only; ratings, allocation logic, save data, and import/export are unchanged.

## Version 0.5.19 - Magic & Backgrounds layout

- Collapsed fixed Arete/Willpower cards into a compact read-only summary.
- Moved higher-Sphere explanations into an optional expandable help section; retained automatic Arete purchase warnings.
- Removed redundant Avatar/Quintessence and completed Sphere-plan notices from the allocation area.
- Positioned the custom Background editor after the standard Background list in both Base Creation and Freebies.
- Constrained custom Background name, description, and action controls within their panel for Foundry light and dark themes.
- Character state, creation rules, ratings, XP, and exports unchanged.


### v0.5.20 - Avatar UI cleanup
- Removed the special Avatar row highlight and Quintessence badge in the Backgrounds lists.
- Removed the separate Avatar/Quintessence explanatory callout in Freebies.
- Consolidated starting Quintessence into the base progress summary, with the existing Freebie-phase summary retained.
- The Avatar info tooltip now explains the link to starting Quintessence.
- No changes to Background ratings, Quintessence calculations, creation rules, or saved drafts.

## v0.5.21 — Specialty dropdown fix

- Replaced native datalist suggestions with the light/dark theme-aware scrollable menu used for Concept.
- Specialty menus remain readable over Foundry panels and can reopen after a value is entered.
- Supports keyboard selection, typing a custom specialty, and preserves existing data-path persistence.
- Applies in Freebies and Final Review; XP, ratings, and character data formats are unchanged.

## v0.5.22 - Compact Freebie tab

- Compact Freebie budget strip (Budget, Spent, Remaining); required Arete shown inline.
- Merits and Flaws can expand to edit; the collapse state persists across renders.
- Arete and Willpower remain interactive but use compact rows.
- Unspent Freebie Points never convert to XP. Final Review warns of forfeiture, and Create Mage prompts for explicit confirmation if points remain.


## v0.5.23 — Compact Required Specialties

- Converted the oversized Freebies and Final Review specialty panels into compact horizontal editors.
- Kept the 4+ trait requirements, stored specialty data, custom entries, and theme-aware popover unchanged.
- Specialty entries wrap cleanly when multiple traits require specialties.
- No character rules, XP, imports, or exports were modified.

### v0.5.25 — Freebie header alignment

- Fixed the Foundry Freebies header: Budget, Spent and Remaining sit on the same line between the title and Spending rules.
- Removed the intermediate flex container that could squeeze totals into a vertical stack; no rules, saved data or calculations changed.

### v0.5.27 — Readability refinement
- Added a compact, opaque and theme-aware background around the inline Budget, Spent and Remaining Freebie counters for improved contrast.
- Preserved the single-line header and Spending rules expander; no character creation or XP changes.


### 0.5.28 — Visible starting Arete option

- The **Start at Arete 2** GM option is now always visible on the Concept tab, instead of hidden in a collapsed section.
- The standard starting Arete 1 remains the default. Existing draft selections and Freebie costs are unchanged.

### v0.5.31 — Freebies Background dropdown

- Moved **Add a Background** beneath the selected Backgrounds and **Add custom Background** control.
- Replaced the vertical list of buttons with one compact, theme-aware dropdown.
- Lists only Backgrounds not already in the character; choosing one adds it at zero dots for normal Freebie purchase.
- Supports mouse and keyboard selection; no creation-rule or data-format changes.
