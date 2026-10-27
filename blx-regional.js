'use strict';
// Optional BLX-only reference. Existing models and human links are never erased on import.
(()=>{
 if(typeof isBL2Frequency!=='undefined'&&isBL2Frequency)return;
 const core=BLXRegionalCore,parser=BLXRegionalParser,refs={},loading={com:0,sem:0};
 const empty=()=>({schema:1,rules:[],notes:[],bindings:{},activeContexts:{},history:[]});
 const storageKey=env=>'blx-regional-reference-v1-'+env;
 const scopeKey=r=>JSON.stringify([r.context,r.cidade,r.sourceHeaderCell]);
 for(const env of ['com','sem']){try{const value=JSON.parse(panelStorage.getItem(storageKey(env))||'null');refs[env]=value?.schema===1&&Array.isArray(value.rules)?{...empty(),...value}:empty();}catch{refs[env]=empty();}}
 function store(env,next){try{panelStorage.setItem(storageKey(env),JSON.stringify(next));refs[env]=next;return true;}catch{message(env,'Não foi possível salvar a referência ou o aprendizado. Nenhuma mudança foi aplicada.','error');return false;}}
 function rulesFor(env){return refs[env].rules.filter(r=>r.env===env||r.env==='unknown').map(r=>r.env==='unknown'&&refs[env].activeContexts[scopeKey(r)]?{...r,env}:r);}
 function applicable(record,index){if(!['com','sem'].includes(index.env)||!refs[index.env].rules.length)return null;const env=index.env;const exact=originalResolve(record,{...index,env:null});return core.evaluate(record,{env,rules:rulesFor(env),bindings:refs[env].bindings,catalog:index.catalog,learned:humanDecisions[env][sellerKey(record.cidade,record.bairro,record.loja)],exactMatch:exact.match});}
 const originalResolve=resolveRecord;
 resolveRecord=function(record,index){
  if(![record.cidade,record.bairro,record.loja].every(exactValue))return originalResolve(record,index);
  const result=applicable(record,index);if(!result?.applicable)return originalResolve(record,index);
  if(result.status==='match')return {...assignedRecord(record,result.driver,'Referência de bairros e vínculo confirmado',!!humanDecisions[index.env][sellerKey(record.cidade,record.bairro,record.loja)]),regional:result};
  return {match:null,status:'AGUARDANDO_DECISAO_HUMANA',reason:result.reason,humanApproved:false,routeChanged:false,routeConfirmation:'',regional:result};
 };
 const originalSave=saveHumanDecision;
 saveHumanDecision=function(env,pos){
  const state=states[env],item=state?.results?.[pos];if(!item||!['com','sem'].includes(env)||!refs[env].rules.length)return originalSave(env,pos);
  const regional=applicable(item.record,state.index);if(!regional?.applicable)return originalSave(env,pos);
  const feedback=document.getElementById(env+'-decision-feedback-'+pos),choice=document.getElementById(env+'-choice-'+pos);
  const driver=choice?.value!==''?state.index.catalog[Number(choice?.value)]:null;
  if(!driver){feedback.textContent='Escolha o motorista correto antes de confirmar e memorizar.';return;}
  if(![item.record.cidade,item.record.bairro,item.record.loja].every(exactValue)){feedback.textContent='Preencha Cidade, Bairro e Loja antes de confirmar.';return;}
  const key=sellerKey(item.record.cidade,item.record.bairro,item.record.loja),old=humanDecisions[env][key];
  const history=[...(old?.regionalHistory||[])];if(old){const {regionalHistory,...snapshot}=old;history.push(snapshot);}
  const next={...humanDecisions[env],[key]:{...driver,cidade:item.record.cidade,bairro:item.record.bairro,loja:item.record.loja,approvedAt:new Date().toISOString(),regionalSignature:regional.regionalSignature,regionalOverride:true,regionalSource:refs[env].sourceName,regionalHistory:history.slice(-20)}};
  if(!persistDecisions(env,next)){feedback.textContent='Não foi possível gravar. A pendência foi mantida.';return;}
  approveExtraRecord(state,item.record);refreshDecisions(env);
 };
 const originalRenderDecisions=renderDecisions;
 renderDecisions=function(env){originalRenderDecisions(env);if(!['com','sem'].includes(env))return;for(const [pos,item] of (states[env]?.results||[]).entries()){
   if(item.match||!item.regional)continue;const select=document.getElementById(env+'-choice-'+pos);if(!select)continue;
   const suggested=item.regional.driver;const at=suggested?states[env].index.catalog.findIndex(d=>assignmentKey(d)===assignmentKey(suggested)):-1;
   if(at>=0)select.value=String(at);
   const button=select.closest('.decision-item')?.querySelector('button');if(button)button.textContent='Confirmar motorista e memorizar';
  }};
 function recalculate(env){if(states[env]?.results?.length)refreshDecisions(env);else if(typeof invalidateOrganizer==='function')invalidateOrganizer(env);render(env);}
 function groupRules(env){const groups=new Map();for(const rule of rulesFor(env)){const key=core.aliasKey(rule);if(!groups.has(key))groups.set(key,{key,rule,rows:[]});groups.get(key).rows.push(rule);}return [...groups.values()];}
 function render(env){
  const box=document.getElementById(env+'-regional-body');if(!box)return;const ref=refs[env];
  document.getElementById(env+'-regional-label').textContent=ref.sourceName?'Referência salva: '+ref.sourceName:'Opcional · distribuição atual por cidade e bairro';
  const model=states[env]?.model||savedBases[env]?.model||[],catalog=driverCatalog(model,env),groups=groupRules(env);
  const display=groups.map((group,i)=>{
   const r=group.rule,bound=ref.bindings[group.key],selected=bound?.assignmentKey||bound;
   const options=catalog.map((d,j)=>'<option value="'+j+'"'+(assignmentKey(d)===selected?' selected':'')+'>'+safe(d.motorista+' · Rota '+d.rota+' · '+d.placa)+'</option>').join('');
   const labels=group.rows.map(x=>[x.cidade,x.bairro,x.loja].filter(Boolean).join(' → ')+' ('+x.sourceCell+')').join('; ');
   return '<div class="decision-item"><strong>'+safe(r.cidade+' · '+r.motoristaFonte)+'</strong><p>'+safe(labels)+'</p>'+(r.env==='unknown'?'<label><input type="checkbox" data-regional-activate="'+i+'"> Confirmo que este bloco se aplica à BLX '+(env==='com'?'com':'sem')+' frequência.</label>':'')+'<label>Associe ao cadastro correto<select data-regional-driver="'+i+'"><option value="">Escolha o motorista completo</option>'+options+'</select></label><button class="action secondary" data-regional-save="'+i+'">Confirmar associação e memorizar</button>'+(group.rows.some(x=>x.review)?'<p>Trecho com observação: '+safe(group.rows.filter(x=>x.review).map(x=>x.reason).filter(Boolean).join('; '))+'. A alocação continuará exigindo confirmação por loja.</p>':'')+'</div>';
  }).join('');
  box.innerHTML=ref.rules.length?'<p>'+ref.rules.filter(r=>r.env===env||r.env==='unknown').length+' regras para conferir neste ambiente. A associação de um nome não aprova automaticamente lojas novas.</p><details><summary>Conferir regiões e associar motoristas ('+groups.length+')</summary>'+(!catalog.length?'<p>Carregue primeiro o Modelo de Lojas e Motoristas para escolher os cadastros.</p>':'')+display+'</details>'+(ref.notes.length?'<details><summary>Observações da referência</summary><ul>'+ref.notes.map(n=>'<li>'+safe(typeof n==='string'?n:JSON.stringify(n))+'</li>').join('')+'</ul></details>':''):'<p>A regra atual permanece ativa até você anexar a referência de bairros.</p>';
  box.querySelectorAll('[data-regional-save]').forEach(button=>button.addEventListener('click',()=>{
    const i=Number(button.dataset.regionalSave),group=groups[i],select=box.querySelector('[data-regional-driver="'+i+'"]'),driver=select.value!==''?catalog[Number(select.value)]:null;
    if(!driver){message(env,'Escolha o cadastro completo do motorista.','error');return;}
    if(group.rule.env==='unknown'&&!box.querySelector('[data-regional-activate="'+i+'"]')?.checked){message(env,'Confirme a frequência deste bloco antes de gravar.','error');return;}
    const next=JSON.parse(JSON.stringify(ref));let rule=group.rule;
    if(rule.env==='unknown'){next.activeContexts[scopeKey(rule)]=true;rule={...rule,env};}
    const key=core.aliasKey(rule),before=next.bindings[key];if(before)next.history.push({kind:'association',key,value:before,changedAt:new Date().toISOString()});
    next.bindings[key]={assignmentKey:assignmentKey(driver),approvedAt:new Date().toISOString()};next.history=next.history.slice(-200);
    if(store(env,next)){recalculate(env);message(env,'Associação salva neste ambiente. As lojas novas e os vínculos divergentes ainda precisam de confirmação.','ok');}
  }));
 }
 async function upload(env,file){
  if(!file)return;const version=++loading[env];message(env,'Lendo somente a aba de bairros da BLX…');
  try{
   await ensureXlsx();const bytes=await file.arrayBuffer(),book=XLSX.read(bytes,{type:'array',sheets:['Fracionamento Bairros BLX']}),sheet=book.Sheets['Fracionamento Bairros BLX'];
   if(!sheet)throw Error('Não encontrei a aba “Fracionamento Bairros BLX”. Nenhuma referência foi alterada.');
   const parsed=parser.parse(XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false}));if(!parsed.rules.length)throw Error('A aba não contém regras reconhecidas. A referência anterior foi mantida.');
   if(version!==loading[env])return;
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
   const old=refs[env],next={...old,schema:1,sourceName:file.name,sourceHash:hash,importedAt:new Date().toISOString(),rules:parsed.rules,notes:parsed.notes};
   if(store(env,next)){recalculate(env);message(env,'Referência salva. Abra “Conferir regiões e associar motoristas” para confirmar os nomes e as frequências.','ok');}
  }catch(error){message(env,error.message||'Não foi possível ler a referência.','error');}
 }
 function mount(){
  for(const env of ['com','sem']){
   const card=document.getElementById('card-'+env),content=card?.querySelector('.content');if(!content)continue;
   const section=document.createElement('section');section.className='decision-panel';section.style.marginBottom='18px';
   section.innerHTML='<h3>Referência de atendimento por bairros</h3><label class="upload"><input id="'+env+'-regional-file" type="file" accept=".xlsx,.xls"><div><strong>Anexar referência atual de bairros BLX</strong><span id="'+env+'-regional-label"></span></div></label><button class="action secondary" id="'+env+'-regional-remove">Excluir somente esta referência</button><div id="'+env+'-regional-body"></div><p>Aprendizado salvo neste navegador e neste ambiente. Cidade + Bairro + Loja continuam obrigatórios.</p>';
   content.prepend(section);
   section.querySelector('input').addEventListener('change',event=>upload(env,event.target.files[0]));
   section.querySelector('button').addEventListener('click',()=>{++loading[env];const next={...refs[env],rules:[],notes:[],sourceName:'',sourceHash:''};if(store(env,next)){document.getElementById(env+'-regional-file').value='';recalculate(env);message(env,'Referência removida. Os vínculos humanos e o modelo unificado foram preservados.','ok');}});
   const modelLabel=document.getElementById(env+'-model').closest('.upload').querySelector('span');
   new MutationObserver(()=>render(env)).observe(modelLabel,{childList:true,subtree:true,characterData:true});render(env);
  }
 }
 const originalOrganize=organize;organize=async function(env){const result=await originalOrganize(env);if(['com','sem'].includes(env))render(env);return result;};
 if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount);else mount();
 window.BLXRegionalUI={refs,rulesFor,render,upload};
})();
