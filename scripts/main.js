import {MageCharacterExport,exportMageCharacter} from './character-export.js';
import {printMageSheet} from './mage-print.js';
import {MageDetails} from './details.js';
import {chooseWebCharacter,importWebCharacter,updateWebCharacter} from './web-import.js';
import {requiredSpecialties} from './catalog.js';
import {isPcMage} from './advancement-builder.js';
import { MageCharamancer } from "./charamancer.js";
import { MageAdvancement } from "./advancement.js";
import { MageToolLauncher } from "./launcher.js";
import { MageExperienceAward } from "./experience-award.js";
import { loadMageCreationData } from "./mage-data.js";
import { installStarterGear } from "./starter-gear.js";
import { installMageBackgrounds } from "./starter-backgrounds.js";

const MODULE_ID = "wod20-mage-charamancer";
let cachedData = null;
let activeLauncher = null;
let activeCreation = null;
let activeAdvancement = null;
let activeExperienceAward = null;

function systemIsReady() {
    if (game.system.id === "worldofdarkness") return true;
    ui.notifications.error("WoD20 Mage Charamancer requires the World of Darkness 20th system.");
    return false;
}

async function openCreation() {
    if (!systemIsReady()) return null;

    try {
        if (activeCreation?.rendered) {
            activeCreation.bringToFront?.();
            return activeCreation;
        }

        cachedData ??= await loadMageCreationData();
        activeCreation = new MageCharamancer(cachedData);
        await activeCreation.render(true);
        return activeCreation;
    }
    catch (error) {
        console.error(`${MODULE_ID} | Could not open character creation`, error);
        ui.notifications.error(`Mage character creation could not start: ${error.message}`);
        activeCreation = null;
        return null;
    }
}

async function openCharacterExport(actor=null){
    if(!systemIsReady())return null;
    try{
        if(isPcMage(actor))return await exportMageCharacter(actor);
        const app=new MageCharacterExport();await app.render(true);return app;
    }catch(error){ui.notifications.error('Mage export failed: '+error.message);return null;}
}

function openPrintMage(actor = null) {
    if (!systemIsReady()) return null;
    try {
        if (isPcMage(actor)) return printMageSheet(actor);
        const selected = canvas?.tokens?.controlled?.[0]?.actor;
        if (isPcMage(selected) && (game.user.isGM || selected.isOwner)) return printMageSheet(selected);
        const app = new MageCharacterExport();
        app.render(true);
        return app;
    } catch (error) {
        console.error(`${MODULE_ID} | Print M20 sheet failed`, error);
        ui.notifications.error('Mage sheet printing failed: ' + error.message);
        return null;
    }
}

async function openDetails(actor=null){if(!systemIsReady())return null;try{const app=new MageDetails(actor,{spend:openAdvancement,add:openExperienceAward});await app.render(true);return app;}catch(error){console.error(MODULE_ID,error);ui.notifications.error('Mage Details could not open: '+error.message);return null;}}
async function openAdvancement(actor = null) {
    if (!systemIsReady()) return null;
    if(actor&&requiredSpecialties(actor).length){ui.notifications.warn('Choose required specialties in Mage Details before spending XP.');return openDetails(actor);}

    try {
        if (activeAdvancement?.rendered) {
            activeAdvancement.bringToFront?.();
            return activeAdvancement;
        }

        activeAdvancement = new MageAdvancement(actor);
        await activeAdvancement.render(true);
        return activeAdvancement;
    }
    catch (error) {
        console.error(`${MODULE_ID} | Could not open Mage advancement`, error);
        ui.notifications.error(`Mage advancement could not start: ${error.message}`);
        activeAdvancement = null;
        return null;
    }
}

async function openExperienceAward(actor = null) {
    if (!systemIsReady()) return null;

    try {
        if (activeExperienceAward?.rendered) {
            activeExperienceAward.bringToFront?.();
            return activeExperienceAward;
        }

        activeExperienceAward = new MageExperienceAward(actor);
        await activeExperienceAward.render(true);
        return activeExperienceAward;
    }
    catch (error) {
        console.error(`${MODULE_ID} | Could not open Mage XP award`, error);
        ui.notifications.error(`Add Experience could not start: ${error.message}`);
        activeExperienceAward = null;
        return null;
    }
}

async function installStarterContent() {
    if (!systemIsReady()) return null;
    if (!game.user.isGM) {
        ui.notifications.error("Only a GM can install Mage starter content.");
        return null;
    }

    try {
        const gear = await installStarterGear({ notify: false });
        const backgrounds = await installMageBackgrounds({ notify: false });
        cachedData = null;

        const created = Number(gear?.created ?? 0) + Number(backgrounds?.created ?? 0);
        const parts = [
            `${gear?.total ?? 0} gear/natural attack Items`,
            `${backgrounds?.total ?? 0} Mage Background Items`
        ];
        ui.notifications.info(`Mage starter content ready: ${parts.join(" and ")}${created ? `; ${created} new Item${created === 1 ? "" : "s"} created` : "; no new Items needed"}.`);
        return { gear, backgrounds };
    }
    catch (error) {
        console.error(`${MODULE_ID} | Could not install Mage starter content`, error);
        ui.notifications.error(`Mage starter content installation failed: ${error.message}`);
        return null;
    }
}

async function openMageTools() {
    if (!systemIsReady()) return null;

    // Keep one main tools panel; other editors retain their unsaved work.
    if (activeLauncher?.rendered) {
        activeLauncher.bringToFront?.();
        return activeLauncher;
    }

    activeLauncher = new MageToolLauncher({
        onCreate: openCreation,
        onImport: chooseWebCharacter,
        onExport: openCharacterExport,
        onPrint: openPrintMage,
        onDetails:openDetails,
        onAdvance: openAdvancement,
        onAddExperience: openExperienceAward,
        onInstallGear: installStarterContent
    });
    await activeLauncher.render(true);
    return activeLauncher;
}

async function ensureLauncherMacro() {
    if (!game.user.isGM) return;

    const existing = game.macros.find(macro =>
        macro.flags?.[MODULE_ID]?.launcher === true || macro.name === "Mage Charamancer"
    );

    if (existing) {
        // Keep an older auto-created launcher working with the new menu.
        if (existing.command !== "game.wod20MageCharamancer.open();") {
            try {
                await existing.update({ command: "game.wod20MageCharamancer.open();" });
            }
            catch (error) {
                console.warn(`${MODULE_ID} | Could not refresh launcher macro command`, error);
            }
        }
        return;
    }

    try {
        await Macro.create({
            name: "Mage Charamancer",
            type: "script",
            img: "icons/svg/mystery-man.svg",
            command: "game.wod20MageCharamancer.open();",
            ownership: { default: 2 },
            flags: {
                [MODULE_ID]: {
                    launcher: true
                }
            }
        });

        ui.notifications.info("Mage Charamancer launcher macro created in the Macro Directory.");
    }
    catch (error) {
        console.warn(`${MODULE_ID} | Could not create launcher macro`, error);
    }
}

// Foundry 14 scene-control tools use a keyed record and an onChange callback.
Hooks.on("getSceneControlButtons", controls => {
    if (game.system.id !== "worldofdarkness" || !controls.tokens?.tools) return;
    const tools = controls.tokens.tools;
    const name = 'wod20MageCharamancer';
    // Remove obsolete module buttons if controls are rebuilt from an existing record.
    for(const key of ['wod20MageDetails','wod20MageAddXP','wod20MageSpendXP'])delete tools[key];
    const orders=Object.entries(tools).filter(([key])=>key!==name).map(([,tool])=>tool.order).filter(Number.isFinite);
    tools[name]={name,title:'Mage Character Tools',icon:'fa-solid fa-hat-wizard',order:Math.max(-1,...orders)+1,button:true,visible:true,
        onChange:()=>game.wod20MageCharamancer?.open()
    };
});

Hooks.once("ready", async () => {
    game.wod20MageCharamancer = {
        open: openMageTools,
        create: openCreation,
        importCharacter: importWebCharacter,
        updateExistingCharacter: updateWebCharacter,
        importFromWeb:chooseWebCharacter,
        exportCharacter:openCharacterExport,
        printSheet:openPrintMage,
        details:openDetails,
        spendXP:openAdvancement,
        addXP:openExperienceAward,
        advance: openAdvancement,
        addExperience: openExperienceAward,
        installStarterGear,
        installMageBackgrounds,
        installStarterContent,
        clearCache() {
            cachedData = null;
        }
    };

    await ensureLauncherMacro();

    console.log(`${MODULE_ID} | Ready. Run game.wod20MageCharamancer.open() to launch Mage Character Tools.`);
});

// Add one module-owned control to PC Mage sheets without replacing their templates.
function attachMageDetails(app,html){
 if(app instanceof MageDetails||app instanceof MageAdvancement||app instanceof MageExperienceAward)return;
 const actor=app.actor??app.document;if(!isPcMage(actor))return;
 const root=html instanceof HTMLElement?html:html?.[0]??app.element;
 const header=root?.querySelector?.('.window-header')??app.element?.querySelector?.('.window-header');if(!header)return;
 let actionAnchor=header.querySelector('.window-controls, .window-header-actions')||null;
 if(!actionAnchor){
  const nested=header.querySelector('[data-action="controls"], [data-action="close"], .window-control, .window-close, .header-button.close');
  if(nested){let direct=nested;while(direct.parentElement&&direct.parentElement!==header)direct=direct.parentElement;if(direct.parentElement===header)actionAnchor=direct;}
 }
 if(!header.querySelector('[data-mc-details]')){
    const button=document.createElement('button');button.type='button';button.dataset.mcDetails='true';button.className='mc-sheet-details-button';button.textContent='Mage Details / XP';button.addEventListener('click',()=>openDetails(actor));if(actionAnchor)header.insertBefore(button,actionAnchor);else header.append(button);
 }
 if(!header.querySelector('[data-mc-print]')){
    const button=document.createElement('button');button.type='button';button.dataset.mcPrint='true';button.className='mc-sheet-details-button';button.textContent='Print M20 Sheet';button.addEventListener('click',()=>openPrintMage(actor));if(actionAnchor)header.insertBefore(button,actionAnchor);else header.append(button);
 }
}
Hooks.on('renderActorSheet',attachMageDetails);
Hooks.on('renderApplicationV2',attachMageDetails);
