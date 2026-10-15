(() => {
'use strict';
// Render the sheet's restricted SVG primitives directly, then add real AcroForm fields.
// Bundled pdf-lib keeps export available offline; no character data leaves this device.
const decode=s=>String(s).replace(/&(amp|lt|gt|quot|#39);/g,(_,k)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[k]));
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));
window.MCT_PDF=async(c,D)=>{
 const L=window.PDFLib,pdf=await L.PDFDocument.create(),form=pdf.getForm();
 const customFields=[];
 const normal=await pdf.embedFont(L.StandardFonts.TimesRoman),bold=await pdf.embedFont(L.StandardFonts.TimesRomanBold);
 const color=s=>{if(!s||s==='none')return undefined;if(s==='white')return L.rgb(1,1,1);let h=s.slice(1);if(h.length===3)h=h.split('').map(v=>v+v).join('');return L.rgb(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255)};
 const safe=(font,s)=>[...s].map(ch=>{try{font.encodeText(ch);return ch}catch{return '?'}}).join('');
 for(const svg of window.MCT_PRINT(c,D).matchAll(/<svg\b[^>]*>([\s\S]*?)<\/svg>/g)){
  const page=pdf.addPage([612,792]),fields=[];
  page.pushOperators(L.pushGraphicsState(),L.concatTransformationMatrix(1,0,0,-1,0,792));
  for(const m of svg[1].matchAll(/<(rect|circle|line)\b([^>]*?)\/>|<text\b([^>]*?)>([\s\S]*?)<\/text>/g)){
   const tag=m[1]||'text',a=attrs(m[2]||m[3]),n=k=>Number(a[k]||0);
   if(a['data-check']||a['data-field']||a['data-health']){if(tag==='circle'){const r=n('r');a.x=String(n('cx')-r);a.y=String(n('cy')-r);a.width=String(r*2);a.height=String(r*2);}fields.push(a);if(a['data-health'])page.drawRectangle({x:n('x'),y:n('y'),width:n('width'),height:n('height'),borderWidth:.6,borderColor:L.rgb(.07,.07,.07),color:undefined});continue;}
   const style={color:color(a.fill||'#111'),borderColor:color(a.stroke),borderWidth:a.stroke&&a.stroke!=='none'?Number(a['stroke-width']||.7):0};
   if(tag==='rect')page.drawRectangle({x:n('x'),y:n('y'),width:n('width'),height:n('height'),...style});
   else if(tag==='circle')page.drawCircle({x:n('cx'),y:n('cy'),size:n('r'),...style});
   else if(tag==='line')page.drawLine({start:{x:n('x1'),y:n('y1')},end:{x:n('x2'),y:n('y2')},color:color(a.stroke||'#111'),thickness:Number(a['stroke-width']||.6)});
   else{
    const font=a['font-weight']==='bold'?bold:normal,size=Number(a['font-size']||11),value=safe(font,decode(m[4])),width=font.widthOfTextAtSize(value,size),target=Number(a.textLength||width),scale=width?target/width:1;
    let x=n('x');if(a['text-anchor']==='middle')x-=target/2;else if(a['text-anchor']==='end')x-=target;
    const key=page.node.newFontDictionary(font.name,font.ref);
    page.pushOperators(L.beginText(),L.setFillingColor(color(a.fill||'#111')),L.setFontAndSize(key,size),L.setTextMatrix(scale,0,0,-1,x,n('y')),L.showText(font.encodeText(value)),L.endText());
   }
  }
  page.pushOperators(L.popGraphicsState());
  for(const a of fields){const x=Number(a.x),y=792-Number(a.y)-Number(a.height),width=Number(a.width),height=Number(a.height);
   if(a['data-check']){const f=form.createCheckBox(a['data-check']);f.addToPage(page,{x,y,width,height,borderWidth:.6,borderColor:L.rgb(.07,.07,.07),backgroundColor:L.rgb(1,1,1),textColor:L.rgb(0,0,0)});if(a['data-checked']==='true')f.check();if(a['data-round'])customFields.push({f,a});}
   else if(a['data-health']){const f=form.createTextField(a['data-health']);f.setMaxLength(1);f.setText((a['data-value']||'').trim());f.setAlignment(L.TextAlignment.Center);f.addToPage(page,{x,y,width,height,borderWidth:.6,borderColor:L.rgb(.07,.07,.07),backgroundColor:L.rgb(1,1,1),textColor:L.rgb(0,0,0),font:normal});f.setFontSize(12);const widget=f.acroField.getWidgets()[0];widget.getAppearanceCharacteristics()?.dict.delete(L.PDFName.of('BG'));widget.getBorderStyle()?.setWidth(0);const cycle=pdf.context.obj({S:'JavaScript',JS:L.PDFHexString.fromText("var v=String(event.target.value||'').replace(/\\s/g,'');event.target.value=v==='/'?'X':v==='X'?'':'/';")});widget.dict.set(L.PDFName.of('AA'),pdf.context.obj({U:cycle}));f.acroField.dict.set(L.PDFName.of('TU'),L.PDFHexString.fromText('Health: click to cycle blank, / regular, X aggravated. If your reader does not run PDF JavaScript, type / or X or clear the field.'));customFields.push({f,a});}
   else{const f=form.createTextField(a['data-field']);f.setText(a['data-value']||'0');f.setMaxLength(8);f.addToPage(page,{x,y,width,height,borderWidth:0,backgroundColor:L.rgb(1,1,1),textColor:L.rgb(0,0,0),font:normal});f.setFontSize(10);}
  }
 }
 // A standard PDF attachment restores every character field without interpreting dots.
 await pdf.attach(new TextEncoder().encode(JSON.stringify({format:'mage-character-tools-pdf',version:1,character:c})), 'mage-character-tools.json', {mimeType:'application/json',description:'Character data for Mage Character Tools import'});
 pdf.setTitle((c.name||'Mage')+' - fillable character sheet');pdf.setCreator('Mage Character Tools 0.1.20');
 form.updateFieldAppearances(normal);
 // Store full-size vector marks in each widget appearance, independent of tiny font glyphs.
 const ink=L.rgb(.07,.07,.07),white=L.rgb(1,1,1);
 const stroke=(x1,y1,x2,y2,thickness=.9)=>L.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness,color:ink});
 for(const {f,a} of customFields){
  if(a['data-round'])f.updateAppearances((field,widget)=>{
   const {width:w,height:h}=widget.getRectangle(),base=L.drawEllipse({x:w/2,y:h/2,xScale:w/2-.4,yScale:h/2-.4,color:white,borderColor:ink,borderWidth:.6});
   const marks=a['data-mark']==='x'?[...stroke(w*.25,h*.25,w*.75,h*.75,.7),...stroke(w*.25,h*.75,w*.75,h*.25,.7)]:[...stroke(w*.2,h*.5,w*.43,h*.25,.7),...stroke(w*.43,h*.25,w*.8,h*.77,.7)];
   return {normal:{on:[...base,...marks],off:base},down:{on:[...base,...marks],off:base}};
  });
  else f.updateAppearances(normal,(field,widget)=>{
   const {width:w,height:h}=widget.getRectangle(),mark=field.getText()?.trim(),base=[];
   if(mark==='/'||mark==='X')base.push(...stroke(1.3,1.3,w-1.3,h-1.3));
   if(mark==='X')base.push(...stroke(1.3,h-1.3,w-1.3,1.3));
   return base;
  });
 }

 // Embed the bundled, unmodified serif fonts so PDF readers share the same metrics.
 for(const [font,key] of [[normal,'normal'],[bold,'bold']]){
  await font.embed();
  const f=window.MCT_PDF_FONTS[key],raw=atob(f.data),bytes=Uint8Array.from(raw,ch=>ch.charCodeAt(0)),ctx=pdf.context;
  const file=ctx.register(ctx.flateStream(bytes,{Length1:bytes.length}));
  const descriptor=ctx.register(ctx.obj({Type:'FontDescriptor',FontName:f.name,Flags:34,FontBBox:f.bbox,ItalicAngle:0,Ascent:f.ascent,Descent:f.descent,CapHeight:f.capHeight,StemV:key==='bold'?120:80,FontFile2:file}));
  ctx.assign(font.ref,ctx.obj({Type:'Font',Subtype:'TrueType',BaseFont:f.name,FirstChar:32,LastChar:255,Widths:f.widths,Encoding:'WinAnsiEncoding',FontDescriptor:descriptor}));
 }
 return pdf.save();
};
window.MCT_READ_PDF=async bytes=>{
 const L=window.PDFLib,pdf=await L.PDFDocument.load(bytes),N=L.PDFName.of;
 const names=pdf.catalog.lookupMaybe(N('Names'),L.PDFDict),tree=names?.lookupMaybe(N('EmbeddedFiles'),L.PDFDict);
 function find(node){
  if(!node)return null;
  const entries=node.lookupMaybe(N('Names'),L.PDFArray);
  if(entries)for(let i=0;i<entries.size();i+=2){const name=entries.lookup(i);if(name.decodeText?.()==='mage-character-tools.json')return entries.lookup(i+1,L.PDFDict);}
  const kids=node.lookupMaybe(N('Kids'),L.PDFArray);if(kids)for(let i=0;i<kids.size();i++){const found=find(kids.lookup(i,L.PDFDict));if(found)return found;}
  return null;
 }
 const file=find(tree),stream=file?.lookupMaybe(N('EF'),L.PDFDict)?.lookup(N('F'));
 if(!stream)throw new Error('This PDF has no embedded charamancer character data. Export a new PDF using version 0.1.13 or later; older or flattened PDFs cannot be restored.');
 const payload=JSON.parse(new TextDecoder().decode(L.decodePDFRawStream(stream).decode()));
 const c=payload.character;
 if(payload.format!=='mage-character-tools-pdf'||payload.version!==1||!c||typeof c.name!=='string'||!c.attributes||!c.abilities||!c.core||!Array.isArray(c.xpLedger))throw new Error('The embedded character data is invalid or uses an unsupported format.');
 const form=pdf.getForm(),fields=new Map(form.getFields().map(f=>[f.getName(),f])),warnings=[];
 function checks(prefix,count,fallback){const out=[];for(let i=1;i<=count;i++){const f=fields.get(prefix+'_'+i);if(!(f instanceof L.PDFCheckBox)){warnings.push('Some '+prefix+' fields are missing; embedded values were kept.');return fallback;}out.push(f.isChecked());}return out;}
 for(const key of ['quintessence','paradox']){const count=fields.has(key+'_11')?20:10,marks=checks(key,count,null);if(marks){const total=marks.filter(Boolean).length;c.core[key]=count===10&&total===10&&c.core[key]>10?c.core[key]:total;}}
 c.sessionTrackers=c.sessionTrackers||{};
 c.sessionTrackers.willpower=checks('willpower',10,c.sessionTrackers.willpower||Array(10).fill(false));
 const health=[];for(let i=1;i<=7;i++){const f=fields.get('health_'+i);if(f instanceof L.PDFDropdown||f instanceof L.PDFTextField){const mark=(f instanceof L.PDFTextField?f.getText():f.getSelected()[0])?.trim()||'';if(!['','/','X'].includes(mark))throw new Error('Invalid Health mark in PDF. Use blank, /, or X.');health.push(mark);}else if(f instanceof L.PDFCheckBox)health.push(f.isChecked()?'/':'');else{warnings.push('Some Health fields are missing; embedded marks were kept.');health.push(c.sessionTrackers.health?.[i-1]||'');}}c.sessionTrackers.health=health;
 const xp={};for(const key of ['earned','spent','available']){const f=fields.get('xp_'+key),value=f instanceof L.PDFTextField?f.getText():undefined;xp[key]=value!==undefined&&/^\d+$/.test(value.trim())?Number(value):null;}
 return {character:c,xp,warnings:[...new Set(warnings)]};
};
})();
