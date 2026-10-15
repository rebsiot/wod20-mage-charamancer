import {printMageSheet} from './mage-print.js';
import {isPcMage} from './advancement-builder.js';
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;

export async function exportMageCharacter(actor){
    if(!isPcMage(actor))throw new Error('Choose a current PC Mage to export.');
    if(!game.user.isGM&&!actor.isOwner)throw new Error('You need ownership of this Mage to export it.');
    if(typeof actor.exportToJSON!=='function')throw new Error('This Actor does not support Foundry JSON export.');
    // Foundry supplies the native complete Actor export, including items and flags.
    await actor.exportToJSON();
    return actor;
}

export class MageCharacterExport extends HandlebarsApplicationMixin(ApplicationV2){
    static DEFAULT_OPTIONS={id:'wod20-mage-character-export',classes:['wod20-mage-charamancer'],position:{width:520,height:330},window:{title:'Export Mage Character',icon:'fa-solid fa-file-export',resizable:true}};
    static PARTS={main:{template:'modules/wod20-mage-charamancer/templates/character-export.hbs'}};
    async _prepareContext(options){
        const context=await super._prepareContext(options);
        const actors=game.actors.filter(isPcMage).filter(a=>game.user.isGM||a.isOwner).map(a=>({id:a.id,name:a.name}));
        return {...context,actors,hasActors:actors.length>0};
    }
    _onRender(context,options){
        super._onRender(context,options);const root=this.element;if(!root)return;
        root.querySelector('[data-print-mage]')?.addEventListener('click',event=>{
            const button=event.currentTarget;button.disabled=true;
            try{
                const actor=game.actors.get(root.querySelector('[data-export-mage-choice]').value);
                printMageSheet(actor);
                this.close();
            }catch(error){ui.notifications.error('Mage print failed: '+error.message);button.disabled=false;}
        });
        root.querySelector('[data-export-mage]')?.addEventListener('click',async event=>{
            const button=event.currentTarget;button.disabled=true;
            try{
                const actor=game.actors.get(root.querySelector('[data-export-mage-choice]').value);
                await exportMageCharacter(actor);await this.close();
            }catch(error){ui.notifications.error('Mage export failed: '+error.message);button.disabled=false;}
        });
    }
}
