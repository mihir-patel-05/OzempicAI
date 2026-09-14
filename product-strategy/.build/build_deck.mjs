import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
import { resolvePresentationFont, finalizePresentation } from '/Users/mihirpatel/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations/container_tools/artifact_tool_utils.mjs';
const base=path.resolve('product-strategy');
const build=path.join(base,'.build');
const skill='/Users/mihirpatel/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const font=resolvePresentationFont();
const p=Presentation.create({slideSize:{width:1280,height:720}});
const C={cream:'#F5EFE6',ink:'#2A1E16',muted:'#6B5A4E',accent:'#A8522F',white:'#FBF7F0',green:'#5E7854'};
const doc=JSON.parse(await fs.readFile(path.join(build,'content.json'),'utf8'));
function text(s,txt,x,y,w,h,size=28,color=C.ink,bold=false){
  const z=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  z.text=txt;z.text.style={typeface:font,fontSize:size,color,bold,autoFit:'none'};return z;
}
function slide(title,section='PRODUCT STRATEGY',dark=false){
  const s=p.slides.add();s.background.fill=dark?C.ink:C.cream;
  text(s,section,64,28,1000,26,15,dark?'#E8A66B':C.accent,true);
  text(s,title,64,88,1150,100,43,dark?C.white:C.ink,true);
  text(s,'OZEMPICAI   /   SEPTEMBER 2026',64,674,800,24,13,dark?'#CBBDAE':C.muted);
  text(s,String(p.slides.items.length).padStart(2,'0'),1160,674,50,24,13,dark?'#CBBDAE':C.muted);
  return s;
}
function notes(s,pages,extra=''){
  s.speakerNotes.textFrame.setText(pages.map(i=>doc.pages[i].title+'\n'+doc.pages[i].sections.map(a=>a.join('\n')).join('\n\n')).join('\n\n')+'\n\n'+extra);
}
function rows(s,items,y=218,gap=128){
  for(let i=0;i<items.length;i++){text(s,items[i][0],64,y+i*gap,340,78,29,C.accent,true);text(s,items[i][1],440,y+i*gap,744,100,27);}
}
function table(s,values,widths,y=210,h=365){
  const t=s.tables.add({rows:values.length,columns:values[0].length,left:64,top:y,width:1152,height:h,columnWidths:widths,values});
  t.borders.assign({fill:'#D9CFC2',width:1,style:'solid'});
  for(let r=0;r<values.length;r++)for(let c=0;c<values[0].length;c++){
    const cell=t.getCell(r,c);cell.fill=r===0?C.ink:(r%2?C.white:C.cream);
    cell.text.style={typeface:font,fontSize:r===0?23:22,color:r===0?C.white:C.ink,bold:r===0};
  }
  return t;
}
let s=slide('OzempicAI\nProduct strategy','LEADERSHIP PROPOSAL',true);
text(s,'Useful meal decisions for changing appetite',64,365,1000,110,38,C.white);
text(s,'Feature portfolio and 12 week rollout proposal',64,543,1050,45,25,'#CBBDAE');
notes(s,[0]);
s=slide('The proposed investment');
text(s,'12 weeks',64,215,430,100,70,C.accent,true);
text(s,'Two engineers, with product, design,\nclinical content and QA support',64,325,450,115,26);
text(s,'First release',650,218,550,45,28,C.accent,true);
text(s,'Editable goals and fast repeat meals\nFlexible plans users can change\nAn Appetite Compass beta',650,287,555,185,29);
text(s,'Fund the first two weeks now. Review scope at weeks 2 and 6.',64,570,1150,55,27,C.muted);
notes(s,[0,6,10]);
s=slide('The app records data but offers little guidance');
rows(s,[['Working foundation','Authentication, manual health logs and daily totals in an installable React PWA.'],['Visible gaps','Plans is a placeholder. Profile defers goal editing. Food logs lack protein and serving detail.'],['Evidence limit','Leadership reports customer loss. The checkout contains no analytics to establish why.']],210,131);
notes(s,[0,1],'Repository sources: README.md, src/features/plans/PlansScreen.tsx, src/features/profile/ProfileScreen.tsx, src/types/db.ts. Commit 4c029f7.');
s=slide('Convenience and GLP-1 support are established');
table(s,[['Product','Verified public offer','Implication'],['Lifesum','Multiple logging modes,\nplans and recipes','Reduce entry effort\nand make plans useful'],['MyFitnessPal','Medication logs, reminders\nand side effect monitoring','A medication diary\nis insufficient'],['Noom','GLP-1 companion with\nprotein and muscle support','Win on daily relevance\nand ease of use']],[255,475,422],210,355);
text(s,'Our opportunity is a hypothesis: meal suggestions that fit today and improve with feedback.',64,589,1135,66,25,C.accent);
notes(s,[1,11],'Official sources accessed September 13, 2026. https://lifesum.com/ https://lifesum.com/features/ https://news.myfitnesspal.com/myfitnesspal-launches-glp-1-support-to-help-users-stay-consistent-and-build-habits-alongside-medication/ https://www.noom.com/health/glp1companion/');
s=slide('The customer job to validate');
text(s,'“My usual meal does not appeal today.\nHelp me choose something manageable.”',64,210,1140,180,44,C.ink,true);
text(s,'Initial audience',64,445,330,40,27,C.accent,true);
text(s,'Adults managing changing appetite, including prescribed GLP-1 users. Keep the core useful without medication.',440,439,730,100,27);
text(s,'Discovery: 18 interviews and 8 observed task sessions before committing to the proposition.',64,582,1150,65,25,C.muted);
notes(s,[2]);
s=slide('Appetite Compass','SIGNATURE EXPERIENCE',true);
text(s,'A meal suggestion that fits the day',64,215,1130,70,42,C.white,true);
const xs=[64,466,870];
[['01','Check in','Appetite, available time\nand meal preference'],['02','Choose','A few reviewed options\nwith editable portions'],['03','Remember','Save what worked\nfor an easier next meal']].forEach((a,i)=>{
text(s,a[0],xs[i],350,300,60,39,'#E8A66B',true);text(s,a[1],xs[i],425,320,50,30,C.white,true);text(s,a[2],xs[i],495,325,105,25,C.white);
});
notes(s,[3],'Illustrative proposed flow, not an existing feature or medical recommendation. Curated rules first. No inference about medication effects.');
s=slide('The first release makes the whole loop useful');
rows(s,[['My Day + quick repeat','Edit goals, correct an entry and reuse a familiar meal in a few taps.'],['Flexible Week','Plan three days, reuse leftovers and keep an editable grocery checklist.'],['Rescue Meal','Replace one meal when plans change. Review the grocery delta and undo the swap.']],210,130);
notes(s,[3,4]);
s=slide('A broader portfolio follows evidence');
table(s,[['Concept','Customer value','Release condition'],['Meal Memory','Review assisted capture once,\nreuse the corrected meal','Capture saves time\nincluding corrections'],['Strength and wins','See progress beyond weight','Core loop retains users'],['Weekly Story','Reflect and prepare a visit brief','Sufficient data quality'],['Gentle return','Resume without streak pressure','Consent and useful reminders']],[295,495,362],210,387);
text(s,'Photo input and later concepts remain conditional scope.',64,612,1100,40,24,C.accent);
notes(s,[4,5]);
s=slide('Implementation builds on the current stack');
rows(s,[['React PWA','Keep existing screens and hooks. Add check-ins, recipe selection and an offline mutation queue.'],['Supabase','Extend logs additively. Reuse plans and groceries. Apply user ownership rules and atomic saves.'],['Server functions','Rank reviewed meals and call food providers. Require confirmation before saving AI estimates.']],210,130);
notes(s,[7,8],'Technical references: https://supabase.com/docs/guides/functions and https://supabase.com/docs/guides/database/postgres/row-level-security. Designs require implementation validation.');
s=slide('The 12 week scope fits a two-engineer team');
table(s,[['Allocation','Engineer-weeks','Commitment'],['Foundation and instrumentation','2','Required'],['My Day and quick repeat','2–3','Core release'],['Appetite Compass','3–4','Curated beta'],['Flexible Week','3–4','Core release'],['Remaining planned capacity','5–8','Text capture or hardening'],['Integration and contingency','6','Reserved']],[600,260,292],207,401);
text(s,'24 nominal engineer-weeks. Full portfolio is 19–27 before contingency and content work.',64,629,1150,35,21,C.muted);
notes(s,[6],'Ranges are planning estimates. Remaining capacity varies inversely with core effort and is not additive at all upper bounds. Planned capacity is 18 engineer-weeks plus 6 reserved.');
s=slide('Rollout follows evidence gates');
rows(s,[['Weeks 1–2','Research switching reasons, establish the baseline and repair the foundations. Gate: validate the job.'],['Weeks 3–6','Release core flows to a small beta. Gate: useful suggestions and reliable logging.'],['Weeks 7–12','Run a stable experiment and ramp exposure. Gate: mature retention evidence and acceptable cost.']],210,132);
notes(s,[9],'Proposed ramp: internal, consented beta, then 5%, 25%, 50%, and wider release with a 10% holdout. Dates do not override quality gates.');
s=slide('Retention is the primary test');
text(s,'+5 points',64,220,525,100,71,C.accent,true);
text(s,'Provisional absolute W4 lift\nversus randomized holdout',64,340,480,95,29);
text(s,'Useful retention',650,220,550,45,30,C.accent,true);
text(s,'A confirmed meal log or used plan\non at least two days in days 22–28.\nInclude every assigned account.',650,290,545,150,28);
text(s,'Baseline unknown. At an illustrative 25% baseline, a 5-point lift needs about 1,250 accounts per arm.',64,540,1140,82,26,C.muted);
notes(s,[9],'Approximate two-proportion normal power calculation: two-sided alpha .05, power .80, 25% vs 30%. Recalculate using actual baseline. Paid retention and renewal require billing data.');
s=slide('Trust determines whether we expand');
rows(s,[['User control','Editable estimates, unknown-data labels, reversible plans and calorie visibility controls.'],['Health boundaries','Reviewed nutrition content. No diagnosis, medication dosing or automatic treatment changes.'],['Release protection','Ownership tests, private media, reliable saves and feature kill switches. Manual logging stays available.']],210,130);
notes(s,[8],'Sources: https://www.niddk.nih.gov/health-information/weight-management/prescription-medications-treat-overweight-obesity and https://supabase.com/docs/guides/database/postgres/row-level-security');
s=slide('Commercial assumptions require validation');
text(s,'$150k',64,218,430,90,68,C.accent,true);
text(s,'Illustrative 12 week envelope',64,327,510,50,27);
text(s,'$96k engineering\n$36k product and design\n$18k clinical content, QA and vendors',64,410,540,140,26);
text(s,'Value before pricing',690,220,500,45,30,C.accent,true);
text(s,'Keep core tracking and export accessible.\n\nTest paid convenience after users experience a useful result.\n\nMeasure cost per confirmed assisted meal.',690,285,490,285,27);
notes(s,[10],'All costs are hypothetical planning rates. No observed revenue, current pricing, vendor quotes or paid retention data supplied.');
s=slide('The leadership decision','NEXT INVESTMENT GATE',true);
text(s,'Approve two weeks of discovery\nand product foundations',64,215,1150,150,49,C.white,true);
text(s,'Confirm the audience and staffing envelope.\nName the clinical reviewer and release owner.\nReview customer evidence before expanding scope.',64,427,1110,155,30,C.white);
notes(s,[0,10,11]);
await fs.mkdir(path.join(build,'slides'),{recursive:true});
await (await PresentationFile.exportPptx(p)).save(path.join(build,'candidate.pptx'));
for(let i=0;i<p.slides.items.length;i++){
const preview=await p.export({slide:p.slides.items[i],format:'png',scale:1});
await fs.writeFile(path.join(build,'slides',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await preview.arrayBuffer()));
}
console.log('Rendered',p.slides.items.length,'slides. Font:',font);
const result=await finalizePresentation({workspaceDir:base,candidatePath:path.join(build,'candidate.pptx'),finalPath:path.join(base,'deliverables/OzempicAI_Executive_Strategy.pptx'),pythonExecutable:'/Users/mihirpatel/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit','--require-native-table-slide','4','--require-native-table-slide','8','--require-native-table-slide','10'],requiredNativeTableOwnerSlides:[4,8,10],fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
console.log(JSON.stringify(result));
