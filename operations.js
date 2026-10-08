'use strict';
let apiToken='',savedBLX=null,savedBL2=null,bl2Sheet=null,bl2Editing=false,bl2Page=0,lastRequest=null,polling=false,lastStatus=null,busy=false,submitting=false,serviceReady=false;
const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const operationBusy={BLX:false,BL2:false},monitorRequest={BLX:null,BL2:null};
const isOperationBusy=op=>operationBusy[op];
const monitor=(op,key)=>$('monitor-'+op+'-'+key);
const section=document.createElement('section');section.className='robot-panel';
section.innerHTML='<h2>Acompanhamento BLX e BL2</h2><label><input type="checkbox" id="parallel-mode"> Permitir BLX e BL2 ao mesmo tempo</label><p id="robot-feedback" class="robot-error"></p><div id="parallel-monitors" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px"></div>';
document.querySelector('.hero').after(section);
for(const op of ['BLX','BL2']){
 const panel=document.createElement('div');panel.className='operation-monitor';panel.id='monitor-'+op;panel.style.minWidth='0';
 panel.innerHTML='<h3>'+op+' — acompanhamento</h3><label>Usuário do portal<input id="monitor-'+op+'-user" value="BLIXX10" autocomplete="username"></label><label>Senha do portal<input id="monitor-'+op+'-password" type="password" autocomplete="off"></label><p id="monitor-'+op+'-error" class="robot-error"></p><strong id="monitor-'+op+'-stage">Aguardando</strong><p id="monitor-'+op+'-source"></p><p id="monitor-'+op+'-counter">0 / 0 viagens</p><progress id="monitor-'+op+'-progress" max="100" value="0"></progress><p id="monitor-'+op+'-current"></p><button class="action secondary" id="monitor-'+op+'-stop" disabled>Parar '+op+'</button><div class="robot-help" id="monitor-'+op+'-help" hidden><h3>'+op+' precisa de orientação</h3><p id="monitor-'+op+'-context"></p><p id="monitor-'+op+'-message"></p><div class="robot-buttons" id="monitor-'+op+'-buttons"></div><button class="action secondary" id="monitor-'+op+'-zoom">Ampliar imagem</button><div id="monitor-'+op+'-viewport" style="overflow:auto;max-height:65vh"><img id="monitor-'+op+'-image" alt="Tela da operação '+op+'" style="display:block;width:100%;height:auto;max-height:none;max-width:none;border:0;padding:0"></div></div><details><summary>Histórico '+op+'</summary><div class="robot-log" id="monitor-'+op+'-log"></div></details>';
 $('parallel-monitors').append(panel);
 monitor(op,'stop').onclick=()=>api('stop',{operation:op}).catch(e=>{monitor(op,'error').textContent=e.message;});
 monitor(op,'zoom').onclick=()=>{const img=monitor(op,'image');const big=img.style.width!=='100%';img.style.width=big?'100%':Math.max(img.naturalWidth,monitor(op,'viewport').clientWidth)+'px';monitor(op,'zoom').textContent=big?'Ampliar imagem':'Ajustar ao painel';};
}
const blx=document.createElement('section');blx.className='operation-group';blx.id='operation-blx';
blx.innerHTML='<div class="operation-heading"><span class="mode">OPERAÇÃO BLX</span><h2>BLX — organizar e conferir as planilhas</h2><p>Os ambientes Com frequência e Sem frequência mantêm as regras atuais.</p></div>';
section.after(blx);for(const env of ['com','sem'])blx.append(document.getElementById('card-'+env));
const blxControls=document.createElement('div');blxControls.className='robot-panel';blxControls.id='blx-controls';
blxControls.innerHTML=`<h3>Iniciar o robô — BLX</h3><p class="approval-steps">Organizar → Baixar planilha organizada → Aprovação do cliente → Utilizar planilha aprovada → Iniciar robô</p><p id="blx-note">Aguardando o arquivo aprovado pelo cliente.</p><div class="robot-buttons"><button class="action" id="blx-start" disabled>▶ Iniciar robô BLX</button><button class="action secondary" id="blx-download" disabled>Baixar planilha aprovada carregada</button></div><p id="blx-feedback" class="robot-error" role="alert"></p><div id="blx-summary" class="robot-review"></div>`;blx.append(blxControls);blxControls.hidden=true;
const bl2=document.createElement('section');bl2.className='robot-panel';bl2.id='operation-bl2';
bl2.innerHTML=`<span class="mode">OPERAÇÃO BL2</span><h2>BL2 — demanda e motoristas</h2><p>Anexe a demanda já roteirizada e a referência dos motoristas. Aloque por rota, visualize e aprove antes do Start. Se a demanda já tiver todos os motoristas e placas, ela pode ser usada diretamente.</p><label class="bl2-upload">Planilha do cliente BL2 — demanda do dia<input id="bl2-file" type="file" accept=".xlsx,.xls"></label><button id="bl2-remove" class="action secondary" disabled>Excluir planilha do cliente</button><button class="action secondary" id="bl2-direct-mode" hidden>Iniciar novo fluxo com planilha pronta</button><p id="bl2-note">Nenhuma planilha BL2 carregada.</p><div class="robot-buttons"><button id="bl2-edit" class="action secondary" disabled>Editar planilha</button><button id="bl2-save-edit" class="action secondary" hidden>Salvar alterações</button><button id="bl2-start" class="action" disabled>▶ Iniciar robô BL2</button><button id="bl2-download" class="action secondary" disabled>Baixar planilha BL2</button></div><p id="bl2-feedback" class="robot-error" role="alert"></p><div id="bl2-table" class="robot-review"></div><div id="bl2-pagination" class="robot-buttons" hidden><button id="bl2-prev" class="action secondary">Anterior</button><span id="bl2-page-note"></span><button id="bl2-next" class="action secondary">Próxima</button></div>`;
blx.after(bl2);
const optionalBL2=document.createElement('details');optionalBL2.className='bl2-optional';optionalBL2.id='bl2-optional';optionalBL2.innerHTML='<summary>Organizar BL2 quando a planilha vier desorganizada</summary>';bl2.append(optionalBL2);optionalBL2.append(document.getElementById('card-bl2'));




for(const env of ['com','sem']){
 const card=$('card-'+env);card.querySelector('h2').textContent='BLX — '+(env==='com'?'Com frequência':'Sem frequência');
 $(env+'-use-approved').textContent='Carregar planilha aprovada';
 const start=document.createElement('button');start.id=env+'-start';start.className='action';start.textContent='▶ Start Robô';start.disabled=true;
 start.onclick=()=>{if(savedBLX?.env!==env)return;feedback(null,'BLX');startRobot('BLX').catch(e=>feedback(e,'BLX'));};card.querySelector('.controls').append(start);
 const note=document.createElement('p');note.id=env+'-feedback';note.className='robot-error';note.setAttribute('role','alert');$(env+'-approval-note').after(note);
}
$('bl2-use-approved').textContent='Conferi e aprovo a planilha';$('bl2-use-approved').onclick=approveBL2Organizer;
$('bl2-approval-note').textContent='Confira a planilha e aprove para liberar o robô.';
const startBL2=document.createElement('button');startBL2.id='bl2-organized-start';startBL2.className='action';startBL2.textContent='▶ Start Robô';startBL2.onclick=()=>startRobot('BL2').catch(e=>feedback(e,'BL2'));$('card-bl2').querySelector('.controls').append(startBL2);
$('bl2-start').textContent='▶ Start Robô';
async function approveBL2Organizer(){if(isOperationBusy('BL2')||submitting)return;try{feedback(null,'BL2');const source=fromOrganizer('bl2');submitting=true;updateButtons();const saved={...await saveSnapshot(source,'BL2','bl2','operator'),phase:'operator',env:'bl2'};savedBL2=saved;bl2Sheet=fromImported(source.table,source.source,'BL2');bl2Sheet.phase='operator';setBL2ApprovalRequired(true);rememberGate(saved);$('bl2-approval-note').textContent='Conferida e aprovada pelo operador. Robô liberado.';$('bl2-note').textContent='Planilha organizada aprovada pelo operador.';renderBL2();}catch(e){feedback(e,'BL2');}finally{submitting=false;updateButtons();}}

async function discardBL2Revision(){if(!bl2Sheet&&!savedBL2)return;await api('delete-revision',{operation:'BL2'});invalidateApproval('BL2');savedBL2=null;bl2Sheet=null;bl2Editing=false;bl2Page=0;$('bl2-file').value='';$('bl2-note').textContent='Planilha BL2 removida do painel.';feedback(null,'BL2');renderBL2();updateButtons();}
function invalidateOrganizer(env){if(env==='bl2'){invalidateApproval('BL2');updateButtons();}else invalidateBLX(env);}

async function api(route,data){
  if(!apiToken)apiToken=(await(await fetch('/api/token')).json()).token;
  const response=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Rota-Token':apiToken},body:JSON.stringify(data)});
  const result=await response.json();if(!response.ok)throw Error(result.error || 'Não foi possível concluir.');return result;
}
function feedback(error,operation){$(operation==='BL2'?'bl2-feedback':operation==='BLX'?'blx-feedback':'robot-feedback').textContent=error?.message || '';if(operation==='BLX')for(const env of ['com','sem'])$(env+'-feedback').textContent=error?.message||'';}
const flowVersions={BLX:0,BL2:0};
let bl2ApprovalRequired=false;
try{bl2ApprovalRequired=panelStorage.getItem('bl2-approval-required-v1')==='true';}catch{}
function gateKey(operation){return 'rota-import-gate-v1-'+operation;}
function rememberGate(saved){try{panelStorage.setItem(gateKey(saved.operation),JSON.stringify({id:saved.id,phase:saved.phase,env:saved.env||null,fileHash:saved.fileHash}));}catch{}}
function setBL2ApprovalRequired(required){bl2ApprovalRequired=required;try{panelStorage.setItem('bl2-approval-required-v1',String(required));}catch{}}
function resetApprovalLabels(operation){for(const env of operation==='BLX'?['com','sem']:['bl2']){$(env+'-approved').value='';$(env+'-approval-note').textContent=env==='bl2'?'Confira a planilha e aprove para liberar o robô.':'Aguardando o arquivo aprovado pelo cliente.';$(env+'-approved-remove').hidden=true;}}
function invalidateApproval(operation){++flowVersions[operation];try{panelStorage.removeItem(gateKey(operation));}catch{}if(operation==='BLX')savedBLX=null;else savedBL2=null;resetApprovalLabels(operation);}
function invalidateBLX(env){if(env && savedBLX && savedBLX.env!==env)return;invalidateApproval('BLX');$('blx-note').textContent='Aguardando o arquivo aprovado pelo cliente.';$('blx-summary').replaceChildren();updateButtons();}
function readyForRobot(operation){return operation==='BLX'?savedBLX?.phase==='approved':!!savedBL2&&!bl2Editing&&(bl2ApprovalRequired?savedBL2.phase==='operator':['direct','operator'].includes(savedBL2.phase));}
function showApproved(env,saved,source){$(env+'-approval-note').textContent='Planilha aprovada carregada: '+source+' · '+saved.total+' viagens.';$(env+'-approved-remove').hidden=false;}
async function loadApprovedFile(env){
 if(isOperationBusy(operationFor(env))||submitting)return;const file=$(env+'-approved').files[0];if(!file)return;const operation=operationFor(env);
 submitting=true;invalidateApproval(operation);const version=flowVersions[operation];updateButtons();
 try{feedback(null,operation);await ensureXlsx();const book=await readWorkbook(file);
 if(headerIndex(book.data[0],['Nome UNIGIS','Nome no Unigis'])<0)throw Error('A planilha aprovada precisa da coluna Nome UNIGIS. Use o arquivo organizado, com ID da viagem, Rota, Placa e Nome UNIGIS.');
 const source=fromImported(book.data,file.name,operation);const saved={...await saveSnapshot(source,operation,env,'approved'),phase:'approved',env};
 if(version!==flowVersions[operation])return;rememberGate(saved);showApproved(env,saved,file.name);
 if(operation==='BLX'){savedBLX=saved;$('blx-note').textContent='Planilha aprovada — '+(env==='com'?'Com frequência':'Sem frequência')+' — '+file.name+'. O robô usará este arquivo.';$('blx-summary').innerHTML=summaryTable(saved.trips);}
 else{setBL2ApprovalRequired(true);savedBL2=saved;bl2Sheet=source;bl2Sheet.phase='approved';bl2Editing=false;bl2Page=0;$('bl2-note').textContent='Planilha aprovada BL2: '+file.name+'. Pronta para iniciar.';renderBL2();}
 }catch(error){feedback(error,operation);$(env+'-approved').value='';$(env+'-approved-remove').hidden=true;$(env+'-approval-note').textContent='Nenhuma planilha aprovada carregada. Arquivo recusado: '+error.message;}
 finally{submitting=false;updateButtons();}
}
async function removeApprovedFile(env){if(isOperationBusy(operationFor(env))||submitting)return;const operation=operationFor(env);if(operation==='BLX'&&!savedBLX){$(env+'-approved').value='';$(env+'-approved-remove').hidden=true;$(env+'-approval-note').textContent='Aguardando o arquivo aprovado pelo cliente.';feedback(null,'BLX');updateButtons();return;}if(operation==='BLX'&&savedBLX?.env!==env)return;submitting=true;updateButtons();try{await api('delete-revision',{operation});if(operation==='BLX')invalidateBLX();else{invalidateApproval('BL2');bl2Sheet=null;bl2Editing=false;renderBL2();$('bl2-note').textContent='Aguardando a planilha aprovada.';}}catch(e){feedback(e,operation);}finally{submitting=false;updateButtons();}}
function flushEdits(env){document.querySelectorAll('#'+env+'-preview tr[data-editing="true"]').forEach(row=>saveRowEdit(env,Number(row.dataset.row)));}
function fromOrganizer(env){
  const state=states[env];if(!state?.results?.length)throw Error('Organize a planilha no ambiente escolhido antes de salvar a revisão.');
  flushEdits(env);
  if(state.results.some(item=>!item.match || !String(item.match.unigis||'').trim()))throw Error('Resolva as pendências e confira Nome UNIGIS antes de salvar para o robô.');
  const tripCol=headerIndex(state.client.headers,['ID da viagem','ID Viagem','IDViagem','Viagem','Trip ID']);
  if(tripCol<0)throw Error('A planilha precisa da coluna ID da viagem para localizar cada viagem no portal.');
  const rows=state.results.map(item=>({trip:String(item.record.values[tripCol]??'').trim(),route:item.match?.rota ?? '',driver:item.match?.unigis ?? '',plate:item.match?.placa ?? ''}));
  const headers=[...state.client.headers];let driverCol=headerIndex(headers,['Motorista']),plateCol=headerIndex(headers,['Placa']);
  if(driverCol<0){driverCol=headers.length;headers.push('Motorista');}if(plateCol<0){plateCol=headers.length;headers.push('Placa');}
  let unigisCol=headerIndex(headers,['Nome UNIGIS','Nome no Unigis']);if(unigisCol<0){unigisCol=headers.length;headers.push('Nome UNIGIS');}
  const table=[headers,...state.results.map((item,i)=>{const row=[...item.record.values];while(row.length<headers.length)row.push('');row[state.client.routeCol]=rows[i].route;row[driverCol]=item.match.motorista;row[unigisCol]=rows[i].driver;row[plateCol]=rows[i].plate;return row;})];
  return {rows,table,source:state.sourceFile};
}
function fromImported(table,name,operation){return RotaContract.parse(table,name,operation);}
function syncBL2Table(){
  if(!bl2Sheet)return;
  for(const [i,row] of bl2Sheet.rows.entries()){const cells=bl2Sheet.table[i+1];while(cells.length<bl2Sheet.table[0].length)cells.push('');for(const key of ['trip','route','driver','plate'])cells[bl2Sheet.columns[key]]=row[key];}
}
async function saveSnapshot(source,operation,env,phase){
  RotaContract.checkContext(operation,env,phase);RotaContract.checkBase(source.table,operation);const trips=RotaValidation.validate(source.rows,operation);await ensureXlsx();
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(source.table),'Revisada');
  const result=await api('revision',{rows:source.rows,source:source.source,operation,env,phase,contract:RotaContract.BUILD,xlsx:XLSX.write(wb,{type:'base64',bookType:'xlsx'})});
  return {...result,operation,env,phase,trips};
}
function summaryTable(rows){return '<table><thead><tr><th>ID da viagem</th><th>Rota</th><th>Motorista no UNIGIS</th><th>Placa</th></tr></thead><tbody>'+rows.map(r=>'<tr>'+['trip','route','driver','plate'].map(k=>'<td>'+escapeHtml(r[k])+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}
function flushBL2Edits(){for(const cell of $('bl2-table').querySelectorAll('[contenteditable="true"]'))bl2Sheet.rows[Number(cell.dataset.row)][cell.dataset.field]=cell.textContent.trim();}
function renderBL2(){
  if(!bl2Sheet){$('bl2-table').replaceChildren();$('bl2-pagination').hidden=true;return;}
  const rows=bl2Sheet.rows.slice(bl2Page*100,(bl2Page+1)*100);
  $('bl2-table').innerHTML='<table><thead><tr><th>ID da viagem</th><th>Rota</th><th>Motorista no UNIGIS</th><th>Placa</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr>'+['trip','route','driver','plate'].map(k=>'<td data-row="'+(bl2Page*100+i)+'" data-field="'+k+'"'+(bl2Editing?' contenteditable="true" class="editing"':'')+'>'+escapeHtml(r[k])+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  $('bl2-pagination').hidden=bl2Sheet.rows.length<=100;$('bl2-page-note').textContent='Página '+(bl2Page+1)+' de '+Math.ceil(bl2Sheet.rows.length/100);$('bl2-prev').disabled=busy || bl2Page===0;$('bl2-next').disabled=busy || (bl2Page+1)*100>=bl2Sheet.rows.length;
}
function updateButtons(){
 const shared=submitting||!serviceReady,activeX=shared||operationBusy.BLX,active2=shared||operationBusy.BL2;
 const startX=activeX||(operationBusy.BL2&&!$('parallel-mode').checked),start2=active2||(operationBusy.BLX&&!$('parallel-mode').checked);
 for(const env of ['com','sem'])$(env+'-start').disabled=startX||!readyForRobot('BLX')||savedBLX.env!==env;
 $('blx-start').disabled=startX||!readyForRobot('BLX');$('blx-download').disabled=activeX||!savedBLX;
 $('bl2-start').hidden=bl2ApprovalRequired;$('bl2-start').disabled=start2||!readyForRobot('BL2');
 $('bl2-organized-start').disabled=start2||!readyForRobot('BL2')||!bl2ApprovalRequired;
 $('bl2-use-approved').disabled=active2||!states.bl2?.results?.length;
 $('bl2-edit').disabled=active2||!bl2Sheet||bl2Editing||bl2ApprovalRequired;
 $('bl2-remove').disabled=active2||(!bl2Sheet&&!savedBL2&&!$('bl2-file').files.length);$('bl2-download').disabled=active2||!savedBL2||bl2Editing;
 $('bl2-save-edit').hidden=!bl2Editing;$('bl2-save-edit').disabled=active2||bl2ApprovalRequired;
 $('bl2-file').disabled=active2||bl2ApprovalRequired;$('bl2-direct-mode').hidden=!bl2ApprovalRequired;$('bl2-direct-mode').disabled=active2;
 for(const env of ['com','sem','bl2']){const active=env==='bl2'?active2:activeX;if(env!=='bl2')$(env+'-use-approved').disabled=active;$(env+'-approved').disabled=active;$(env+'-approved-remove').disabled=active;const card=$('card-'+env);card.style.pointerEvents=active?'none':'';card.style.opacity=active?'.65':'';for(const input of card.querySelectorAll('input'))input.disabled=active;}
 for(const op of ['BLX','BL2'])monitor(op,'stop').disabled=!serviceReady||!operationBusy[op];
 if(bl2Editing)for(const cell of $('bl2-table').querySelectorAll('[data-field]'))cell.contentEditable=active2?'false':'true';
}
$('parallel-mode').onchange=updateButtons;
async function startRobot(operation,mode='real'){
  if(!serviceReady)throw Error('Reabra pelo atalho INICIAR PAINEL para atualizar o serviço antes de iniciar.');
  if(isOperationBusy(operation)||submitting)throw Error('Esta operação já está em andamento.');
  if(isOperationBusy(operation==='BLX'?'BL2':'BLX')&&!$('parallel-mode').checked)throw Error('Marque Permitir BLX e BL2 ao mesmo tempo para iniciar a segunda operação.');
  if(!readyForRobot(operation))throw Error(operation==='BLX'?'Carregue a planilha aprovada pelo cliente antes de iniciar.':'Carregue uma planilha BL2 pronta ou confira e aprove a organização.');
  const selected=operation==='BLX'?savedBLX:savedBL2;
  submitting=true;updateButtons();
  try{await api('start',{revisionId:selected.id,operation:selected.operation,env:selected.env,phase:selected.phase,fileHash:selected.fileHash,mode,parallel:$('parallel-mode').checked,username:monitor(operation,'user').value,password:monitor(operation,'password').value});monitor(operation,'password').value='';operationBusy[operation]=true;busy=true;section.scrollIntoView({behavior:'smooth'});await refresh();}finally{submitting=false;updateButtons();}
}
$('blx-start').onclick=()=>{feedback(null,'BLX');startRobot('BLX').catch(e=>feedback(e,'BLX'));};
$('blx-download').onclick=()=>downloadSavedRevision('BLX');
$('bl2-file').onchange=async()=>{
  if(isOperationBusy('BL2')||submitting)return;if(bl2ApprovalRequired){feedback(Error('Confira e aprove a organização BL2, ou inicie um novo fluxo com planilha pronta.'),'BL2');return;}
  const file=$('bl2-file').files[0];if(!file)return;invalidateApproval('BL2');submitting=true;savedBL2=null;bl2Sheet=null;bl2Editing=false;bl2Page=0;updateButtons();renderBL2();
  try{feedback(null,'BL2');await api('delete-revision',{operation:'BL2'});await ensureXlsx();bl2Sheet=fromImported((await readWorkbook(file)).data,file.name,'BL2');syncBL2Table();savedBL2={...await saveSnapshot(bl2Sheet,'BL2','bl2','direct'),phase:'direct'};bl2Sheet.phase='direct';rememberGate(savedBL2);$('bl2-note').textContent=file.name+' — '+savedBL2.total+' viagens. Pronta para iniciar.';renderBL2();}
  catch(e){savedBL2=null;bl2Sheet=null;bl2Editing=false;bl2Page=0;$('bl2-file').value='';$('bl2-note').textContent='Nenhuma planilha BL2 carregada. O arquivo foi recusado.';feedback(e,'BL2');renderBL2();}
  finally{submitting=false;updateButtons();}
};
$('bl2-edit').onclick=()=>{if(isOperationBusy('BL2')||submitting||bl2ApprovalRequired)return;bl2Editing=true;invalidateApproval('BL2');$('bl2-note').textContent='Editando a planilha BL2. Clique em Salvar alterações quando terminar.';renderBL2();updateButtons();};
$('bl2-save-edit').onclick=async()=>{
  if(bl2ApprovalRequired)return;
  try{feedback(null,'BL2');flushBL2Edits();syncBL2Table();submitting=true;updateButtons();savedBL2={...await saveSnapshot(bl2Sheet,'BL2','bl2','direct'),phase:'direct'};bl2Sheet.phase='direct';rememberGate(savedBL2);bl2Editing=false;$('bl2-note').textContent=bl2Sheet.source+' — '+savedBL2.total+' viagens. Alterações salvas; pronta para iniciar.';renderBL2();}
  catch(e){savedBL2=null;feedback(e,'BL2');}finally{submitting=false;updateButtons();}
};
$('bl2-remove').onclick=async()=>{if(isOperationBusy('BL2')||submitting)return;try{submitting=true;updateButtons();await api('delete-revision',{operation:'BL2'});invalidateApproval('BL2');savedBL2=null;bl2Sheet=null;bl2Editing=false;bl2Page=0;$('bl2-file').value='';$('bl2-note').textContent='Planilha BL2 removida do painel. Selecione outra quando desejar.';feedback(null,'BL2');renderBL2();}catch(e){feedback(e,'BL2');}finally{submitting=false;updateButtons();}};
$('bl2-start').onclick=()=>{feedback(null,'BL2');startRobot('BL2').catch(e=>feedback(e,'BL2'));};
$('bl2-download').onclick=()=>downloadSavedRevision('BL2');
for(const [id,delta] of [['bl2-prev',-1],['bl2-next',1]])$(id).onclick=()=>{if(isOperationBusy('BL2')||submitting)return;if(bl2Editing)flushBL2Edits();bl2Page+=delta;renderBL2();};


const originalOrganize=organize;organize=async function(env){if(env==='bl2'){setBL2ApprovalRequired(true);$('bl2-note').textContent='Organização BL2: confira e aprove aqui mesmo para liberar o robô.';}invalidateOrganizer(env);return originalOrganize(env);};
const originalEnableEdit=enableRowEdit;enableRowEdit=function(env,pos){invalidateOrganizer(env);return originalEnableEdit(env,pos);};
const originalSaveEdit=saveRowEdit;saveRowEdit=function(env,pos){const result=originalSaveEdit(env,pos);invalidateOrganizer(env);return result;};
function renderMonitor(op,s){
 $('monitor-'+op).style.gridColumn=s.request?'1 / -1':'';
 monitor(op,'stage').textContent=s.stage;monitor(op,'counter').textContent=s.done+' / '+s.total+' viagens';monitor(op,'progress').value=s.total?100*s.done/s.total:0;
 monitor(op,'source').textContent=s.source?'Arquivo em execução: '+s.source+(s.env==='com'?' · Com frequência':s.env==='sem'?' · Sem frequência':''):'';
 monitor(op,'current').textContent=s.current?'Viagem '+s.current.trip+' · Rota '+s.current.route+' · '+s.current.driver+' · '+s.current.plate:'Nenhuma viagem em execução.';
 monitor(op,'log').innerHTML=(s.events||[]).map(e=>'<div>'+escapeHtml(new Date(e.time).toLocaleTimeString('pt-BR'))+' · '+escapeHtml(e.message)+'</div>').join('');
 monitor(op,'help').hidden=!s.request;
 if(!s.request){monitorRequest[op]=null;monitor(op,'image').onclick=null;return;}
 if(monitorRequest[op]===s.request.id)return;monitorRequest[op]=s.request.id;const req=s.request,img=monitor(op,'image');img.onclick=null;img.style.cursor='';img.style.width='100%';monitor(op,'zoom').textContent='Ampliar imagem';img.hidden=!req.screenshot;monitor(op,'zoom').hidden=!req.screenshot;
 monitor(op,'context').textContent=op+' · '+(req.trip?'Viagem '+req.trip+' · Rota '+req.route+' · ':'')+req.stage;monitor(op,'message').textContent=req.message;
 if(req.screenshot)img.src='/api/screenshot?operation='+op+'&requestId='+encodeURIComponent(req.id)+'&t='+Date.now();
 const answer=async value=>{try{await api('answer',{operation:op,id:req.id,...value});monitorRequest[op]=null;await refresh();}catch(e){monitor(op,'error').textContent=e.message;}};
 monitor(op,'buttons').replaceChildren();for(const option of req.options){const button=document.createElement('button');button.className='action secondary';button.textContent=option.label;button.onclick=()=>{
  monitor(op,'error').textContent='';if(option.value==='point'){if(!req.screenshot||!img.complete||!img.naturalWidth){monitor(op,'error').textContent='Aguarde a imagem carregar.';return;}img.style.cursor='crosshair';monitor(op,'message').textContent='Indique o elemento na imagem de '+op+'. Depois confirme. Ignorar cancela a indicação, sem pular a viagem.';img.onclick=event=>{const rect=img.getBoundingClientRect();img.onclick=null;img.style.cursor='';answer({action:'point',x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height});};return;}
  img.onclick=null;img.style.cursor='';answer({action:option.value});};monitor(op,'buttons').append(button);}
}
async function refresh(){
 if(polling)return;polling=true;try{const s=await(await fetch('/api/state')).json();serviceReady=s.version===2&&s.build===RotaContract.BUILD&&!!s.states;
 if(!serviceReady){$('robot-feedback').textContent='Abra INICIAR PAINEL para carregar a versão atual.';updateButtons();return;}
 $('robot-feedback').textContent='';for(const op of ['BLX','BL2']){operationBusy[op]=['running','waiting','stopping'].includes(s.states[op].status);renderMonitor(op,s.states[op]);}busy=operationBusy.BLX||operationBusy.BL2;updateButtons();
 }catch(e){serviceReady=false;updateButtons();$('robot-feedback').textContent='Painel desconectado. Abra pelo atalho INICIAR PAINEL.';}finally{polling=false;}
}
async function restoreImported(operation){
 if(isBL2Frequency&&operation!=='BL2')return;
 const version=flowVersions[operation];try{
 const gate=JSON.parse(panelStorage.getItem(gateKey(operation))||'null');if(!gate)return;
 if(operation==='BLX'&&gate.phase!=='approved')return;if(operation==='BL2'&&bl2ApprovalRequired&&gate.phase!=='operator')return;
 const data=await(await fetch('/api/operation-sheet?operation='+operation)).json();if(!data.sheet?.xlsx||data.sheet.id!==gate.id||data.sheet.fileHash!==gate.fileHash||data.sheet.env!==gate.env||data.sheet.phase!==gate.phase)return;
 await ensureXlsx();if(version!==flowVersions[operation])return;
 const wb=XLSX.read(data.sheet.xlsx,{type:'base64'}),table=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:'',raw:false});const source=fromImported(table,data.sheet.source,operation),trips=RotaValidation.validate(source.rows,operation);
 const saved={id:gate.id,total:trips.length,operation,trips,phase:gate.phase,env:gate.env,fileHash:gate.fileHash};
 if(operation==='BLX'){savedBLX=saved;showApproved(gate.env,saved,data.sheet.source);$('blx-note').textContent='Planilha aprovada carregada: '+data.sheet.source;$('blx-summary').innerHTML=summaryTable(trips);}
 else{savedBL2=saved;bl2Sheet=source;bl2Sheet.phase=gate.phase;renderBL2();$('bl2-note').textContent=(gate.phase==='approved'?'Planilha aprovada: ':'Planilha pronta: ')+data.sheet.source;if(gate.phase==='operator')$('bl2-approval-note').textContent='Conferida e aprovada pelo operador. Robô liberado.';}
 updateButtons();}catch(e){feedback(e,operation);}
}
$('bl2-direct-mode').onclick=async()=>{if(isOperationBusy('BL2')||submitting)return;submitting=true;updateButtons();try{await api('delete-revision',{operation:'BL2'});invalidateApproval('BL2');setBL2ApprovalRequired(false);bl2Sheet=null;bl2Editing=false;bl2Page=0;$('bl2-file').value='';clearOrganizer('bl2');renderBL2();$('bl2-note').textContent='Novo fluxo: selecione a planilha BL2 já pronta.';}catch(e){feedback(e,'BL2');}finally{submitting=false;updateButtons();}};
updateButtons();refresh();restoreImported('BLX');restoreImported('BL2');setInterval(refresh,1000);

// BL2 route reference: preserves the client's rows, route numbers and trip IDs.
const BL2Allocation = (()=>{
 const norm=RotaContract.normalize,idx=RotaContract.index;
 const route=v=>{const s=String(v??'').trim();return /^\d+$/.test(s)?String(Number(s)):s.toUpperCase();};
 function check(table,name){RotaContract.checkBase(table,'BL2');if(norm(name).split(' ').includes('BLX'))throw Error('Este arquivo identifica BLX. Use somente arquivos BL2.');}
 function demand(table,name){
  check(table,name);const h=table[0],t=idx(h,['ID da viagem','ID Viagem','IDViagem','Viagem','Trip ID']),r=idx(h,['Rota']);
  if(t<0||r<0)throw Error('A demanda BL2 precisa de ID da viagem e Rota.');
  const rows=table.slice(1).filter(a=>a.some(v=>String(v??'').trim()));
  if(rows.some(a=>!/^\d{1,18}$/.test(String(a[t]??'').trim())||!route(a[r])))throw Error('Há viagem ou rota vazia/inválida na demanda BL2.');
  return {table:[h.slice(),...rows.map(a=>a.slice())],source:name,routeCol:r};
 }
 function model(tabs,name){
  if(norm(name).split(' ').includes('BLX'))throw Error('O modelo deve ser exclusivo da BL2.');
  const routes={};
  for(const tab of tabs){
   const h=tab.table[0]||[],r=idx(h,['Rota']),d=idx(h,['Motorista real','Motorista']),p=idx(h,['Placa']),u=idx(h,['Nome no Unigis','Nome UNIGIS']);
   if([r,d,p,u].some(i=>i<0))continue;check(tab.table,tab.name);
   for(const a of tab.table.slice(1)){
    if(!/^\d+$/.test(String(a[r]??'').trim()))continue;
    const key=route(a[r]),item={driver:String(a[d]??'').trim(),plate:String(a[p]??'').trim().toUpperCase(),unigis:String(a[u]??'').trim(),tabs:[tab.name]};
    if(!item.driver||!item.unigis||!item.plate||/NAO DETERMINADO|SEM MOTORISTA|INDETERMINADO/.test(norm(item.driver+' '+item.unigis)))throw Error('Rota '+key+': complete motorista, placa e Nome UNIGIS no modelo.');
    RotaValidation.validate([{trip:'1',route:key,driver:item.unigis,plate:item.plate}],'BL2');
    const list=routes[key]||(routes[key]=[]),same=list.find(x=>norm(x.driver)===norm(item.driver)&&x.plate===item.plate&&norm(x.unigis)===norm(item.unigis));
    if(same)same.tabs.push(tab.name);else list.push(item);
   }
  }
  if(!Object.keys(routes).length)throw Error('O modelo precisa de Rota, Motorista real, Placa e Nome no Unigis.');
  return {name,routes};
 }
 function allocate(client,reference,choices={}){
  const h=client.table[0].slice(),col=names=>{let c=idx(h,names);if(c<0){c=h.length;h.push(names[0]);}return c;};
  const d=col(['Motorista','Motorista real']),p=col(['Placa']),u=col(['Nome UNIGIS','Nome no Unigis']);const pending=new Set();
  const rows=client.table.slice(1).map(a=>{const out=a.slice(),key=route(a[client.routeCol]),list=reference.routes[key]||[],selected=list.length===1?list[0]:list[choices[key]];
   if(!selected){pending.add(key);out[d]='';out[p]='';out[u]='';}else{out[d]=selected.driver;out[p]=selected.plate;out[u]=selected.unigis;}return out;});
  return {table:[h,...rows],source:client.source,pending:[...pending]};
 }
 return {model,demand,allocate,route};
})();
(function installBL2Allocation(){
 let reference=null,client=null,choices={},result=null,viewed=false;
 const upload=document.createElement('div');upload.className='bl2-allocation';
 upload.innerHTML='<label class="bl2-upload">Referência de alocação dos motoristas BL2<input id="bl2-reference" type="file" accept=".xlsx,.xls"></label><button id="bl2-reference-remove" class="action secondary" disabled>Excluir referência dos motoristas</button><p id="bl2-reference-note">Anexe o modelo com Rota, Motorista, Placa e Nome UNIGIS.</p><div class="robot-buttons"><button id="bl2-allocate" class="action" disabled>Alocar motoristas</button><button id="bl2-allocation-view" class="action secondary" disabled>Visualizar alocação</button><button id="bl2-allocation-approve" class="action export" disabled>Conferi e aprovo a alocação</button></div><div id="bl2-allocation-pending"></div><div id="bl2-allocation-preview" class="robot-review" hidden></div>';
 $('bl2-remove').after(upload);
 const storageKey='bl2-route-reference-v1';
 try{const saved=JSON.parse(panelStorage.getItem(storageKey)||'null');if(saved){reference=BL2Allocation.model(saved.tabs,saved.name);upload._saved=saved;choices=saved.choices||{};}}catch{}
 const originalUpdate=updateButtons;
 updateButtons=function(){originalUpdate();const locked=submitting||isOperationBusy('BL2')||!serviceReady;
  $('bl2-reference').disabled=locked||bl2ApprovalRequired;
  $('bl2-reference-remove').disabled=locked||!reference||bl2ApprovalRequired;
  $('bl2-allocate').disabled=locked||!reference||!client||bl2ApprovalRequired;
  $('bl2-allocation-view').disabled=locked||(!result&&!bl2Sheet);
  $('bl2-allocation-approve').disabled=locked||!result||result.pending.length>0||!viewed||!!savedBL2||bl2ApprovalRequired;
  if(client)$('bl2-remove').disabled=locked;
  if(result){$('bl2-edit').disabled=true;$('bl2-download').disabled=locked||result.pending.length>0;}
 };
 function clearResult(){result=null;viewed=false;invalidateApproval('BL2');bl2Sheet=null;bl2Editing=false;$('bl2-allocation-preview').hidden=true;$('bl2-allocation-preview').replaceChildren();$('bl2-allocation-pending').replaceChildren();renderBL2();}
 function label(){$('bl2-reference-note').textContent=reference?'Referência fixa: '+reference.name+' · '+Object.keys(reference.routes).length+' rotas · '+Object.keys(choices).length+' escolhas memorizadas. Mantida até excluir ou substituir.':'Anexe o modelo com Rota, Motorista, Placa e Nome UNIGIS.';}
 function persist(){try{if(reference&&upload._saved)panelStorage.setItem(storageKey,JSON.stringify({...upload._saved,choices}));else panelStorage.removeItem(storageKey);return true;}catch{feedback(Error('Não foi possível gravar a referência e as escolhas neste navegador. Não feche a página antes de resolver o armazenamento.'),'BL2');return false;}}
 function show(){
  if(!result)return;const h=result.table[0],indices=[RotaContract.index(h,['ID da viagem','ID Viagem','IDViagem','Viagem','Trip ID']),RotaContract.index(h,['Rota']),RotaContract.index(h,['Motorista','Motorista real']),RotaContract.index(h,['Nome UNIGIS','Nome no Unigis']),RotaContract.index(h,['Placa'])];
  $('bl2-allocation-preview').innerHTML='<table><thead><tr>'+['ID da viagem','Rota','Motorista','Nome UNIGIS','Placa'].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+result.table.slice(1).map(row=>'<tr>'+indices.map((i,k)=>'<td>'+(k===2?'<button class="action secondary" data-bl2-edit-route="'+escapeHtml(BL2Allocation.route(row[indices[1]]))+'">'+escapeHtml(row[i]||'Definir motorista')+' · Editar</button>':escapeHtml(row[i]||'PENDENTE'))+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  $('bl2-allocation-preview').hidden=false;viewed=true;updateButtons();
 }
 function allocate(){
  clearResult();result=BL2Allocation.allocate(client,reference,choices);
  $('bl2-note').textContent=client.source+' — '+(result.table.length-1)+' linhas; '+result.pending.length+' rotas aguardando decisão. Ordem e viagens do cliente preservadas.';
  const box=$('bl2-allocation-pending');
  for(const key of result.pending){const item=document.createElement('div');item.className='decision-item';const list=reference.routes[key]||[];
   const title=document.createElement('p');title.textContent='Rota '+key+(list.length?' — as abas divergem. Escolha o cadastro correto:':' — sem motorista no modelo. Atualize a referência.');item.append(title);
   if(list.length){const select=document.createElement('select');select.innerHTML='<option value="">Escolha o motorista correto</option>'+list.map((x,i)=>'<option value="'+i+'">'+escapeHtml(x.driver+' · '+x.plate+' · UNIGIS '+x.unigis+' · '+x.tabs.join(', '))+'</option>').join('');select.onchange=()=>{if(submitting||isOperationBusy('BL2')||select.value==='')return;choices[key]=Number(select.value);const stored=persist();allocate();show();if(stored){label();feedback(null,'BL2');}};item.append(select);}box.append(item);
  }updateButtons();
 }
 $('bl2-download').textContent='Baixar planilha organizada';
 const oldAllocationDownload=$('bl2-download').onclick;
 $('bl2-download').onclick=async()=>{if(!result)return oldAllocationDownload();if(submitting||isOperationBusy('BL2')||result.pending.length)return;try{await ensureXlsx();const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(result.table),'Report');downloadWorkbook(wb,'ORDENS_ORGANIZADAS_BL2.xlsx');feedback(null,'BL2');}catch(e){feedback(e,'BL2');}};
 const oldUpload=$('bl2-file').onchange;
 $('bl2-file').onchange=async()=>{
  if(submitting||isOperationBusy('BL2')||bl2ApprovalRequired)return;const file=$('bl2-file').files[0];if(!file)return;
  clearResult();client=null;submitting=true;updateButtons();let direct=false;
  try{feedback(null,'BL2');await api('delete-revision',{operation:'BL2'});await ensureXlsx();client=BL2Allocation.demand((await readWorkbook(file)).data,file.name);
   if(!reference){try{const parsed=fromImported(client.table,file.name,'BL2');RotaValidation.validate(parsed.rows,'BL2');direct=true;}catch{}}
   $('bl2-note').textContent=file.name+' — demanda carregada. '+(reference?'Clique em Alocar motoristas.':'Anexe a referência de motoristas para completar a alocação.');
  }catch(e){client=null;$('bl2-file').value='';$('bl2-note').textContent='Nenhuma demanda BL2 carregada. Arquivo recusado.';feedback(e,'BL2');}
  finally{submitting=false;updateButtons();}if(direct)await oldUpload();
 };
 $('bl2-reference').onchange=async()=>{
  if(submitting||isOperationBusy('BL2')||bl2ApprovalRequired)return;const file=$('bl2-reference').files[0];if(!file)return;clearResult();reference=null;choices={};upload._saved=null;persist();submitting=true;updateButtons();
  try{feedback(null,'BL2');await ensureXlsx();const wb=(await readWorkbook(file)).book;const tabs=wb.SheetNames.map(name=>({name,table:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:'',raw:false})}));reference=BL2Allocation.model(tabs,file.name);upload._saved={tabs,name:file.name};persist();}
  catch(e){$('bl2-reference').value='';feedback(e,'BL2');}finally{submitting=false;label();updateButtons();}
 };
 $('bl2-reference-remove').onclick=()=>{if(submitting||isOperationBusy('BL2')||bl2ApprovalRequired)return;clearResult();reference=null;choices={};upload._saved=null;$('bl2-reference').value='';persist();label();$('bl2-note').textContent=client?client.source+' — referência removida. Anexe outra para alocar.':'Nenhuma demanda BL2 carregada.';updateButtons();};
 $('bl2-allocate').onclick=()=>{if(submitting||isOperationBusy('BL2')||bl2ApprovalRequired||!client||!reference)return;feedback(null,'BL2');allocate();};
 $('bl2-allocation-view').onclick=()=>{if(result)show();else if(bl2Sheet){renderBL2();$('bl2-table').scrollIntoView({behavior:'smooth'});}};
 $('bl2-allocation-approve').onclick=async()=>{
  if(submitting||isOperationBusy('BL2')||bl2ApprovalRequired||!result||!viewed||result.pending.length)return;submitting=true;updateButtons();
  try{const source=fromImported(result.table,result.source,'BL2');savedBL2=await saveSnapshot(source,'BL2','bl2','operator');bl2Sheet=source;bl2Sheet.phase='operator';rememberGate(savedBL2);persist();$('bl2-note').textContent=result.source+' — alocação conferida e aprovada. Start liberado para esta demanda.';feedback(null,'BL2');}
  catch(e){invalidateApproval('BL2');feedback(e,'BL2');}finally{submitting=false;updateButtons();}
 };
 const oldRemove=$('bl2-remove').onclick;$('bl2-remove').onclick=async()=>{if(submitting||isOperationBusy('BL2'))return;client=null;clearResult();await oldRemove();updateButtons();};
 const oldDirect=$('bl2-direct-mode').onclick;$('bl2-direct-mode').onclick=async()=>{if(submitting||isOperationBusy('BL2'))return;client=null;clearResult();await oldDirect();};
 const oldOrganizeAllocation=organize;organize=async function(env){if(env==='bl2'){client=null;clearResult();}return oldOrganizeAllocation(env);};
 const manager=document.createElement('div');manager.innerHTML='<div class="robot-buttons"><button id="bl2-reference-edit" class="action secondary">Editar motoristas do modelo</button><button id="bl2-reference-download" class="action secondary">Baixar modelo atualizado</button></div><div id="bl2-reference-editor"></div>';$('bl2-reference-note').after(manager);
 function referenceTable(ref){return [['Rota','Motorista real','Placa','Nome no Unigis'],...Object.entries(ref.routes).flatMap(([route,list])=>list.map(d=>[route,d.driver,d.plate,d.unigis]))];}
 function saveReferenceRoutes(routes){
  const tabs=[{name:'Mapa_Fixo',table:referenceTable({routes})}],next={name:reference.name,tabs,choices:{...choices}};
  for(const key of Object.keys(next.choices))if(!routes[key]||routes[key].length===1)delete next.choices[key];
  try{panelStorage.setItem(storageKey,JSON.stringify(next));}catch{feedback(Error('Não foi possível salvar o modelo. Nenhuma alteração foi aplicada.'),'BL2');return false;}
  reference={name:reference.name,routes};choices=next.choices;upload._saved=next;clearResult();label();if(client)allocate();updateButtons();return true;
 }
 function openReferenceEditor(selectedRoute){
  if(!reference||submitting||isOperationBusy('BL2'))return;
  const entries=Object.entries(reference.routes).flatMap(([route,list])=>list.map(d=>({route,...d})));
  $('bl2-reference-editor').innerHTML='<section class="decision-panel"><h3>Cadastro dos motoristas BL2</h3><p>Salvar substitui o motorista desta rota no modelo fixo e atualiza a demanda carregada.</p><label>Cadastro<select id="bl2-ref-choice" style="display:block;width:100%;padding:10px"><option value="">Adicionar motorista em nova rota</option>'+entries.map((d,i)=>'<option value="'+i+'">'+escapeHtml('Rota '+d.route+' · '+d.driver+' · '+d.plate)+'</option>').join('')+'</select></label>'+[['route','Rota'],['driver','Motorista'],['plate','Placa'],['unigis','Nome exatamente como está no UNIGIS']].map(([key,label])=>'<label style="display:block;margin:8px 0">'+label+'<input style="display:block;width:100%;padding:10px" id="bl2-ref-'+key+'"></label>').join('')+'<div class="robot-buttons"><button id="bl2-ref-save" class="action">Salvar motorista desta rota no modelo</button><button id="bl2-ref-delete" class="action secondary" disabled>Excluir motorista desta rota do modelo</button><button id="bl2-ref-close" class="action secondary">Fechar</button></div></section>';
  $('bl2-ref-choice').onchange=()=>{const value=$('bl2-ref-choice').value,d=value===''?null:entries[Number(value)];for(const key of ['route','driver','plate','unigis'])$('bl2-ref-'+key).value=d?.[key]||'';$('bl2-ref-route').disabled=!!d;$('bl2-ref-delete').disabled=!d;};
  $('bl2-ref-save').onclick=()=>{
   if(submitting||isOperationBusy('BL2'))return;const key=BL2Allocation.route($('bl2-ref-route').value),driver=$('bl2-ref-driver').value.trim(),plate=$('bl2-ref-plate').value.trim().toUpperCase(),unigis=$('bl2-ref-unigis').value.trim();
   try{if(!/^\d+$/.test(key)||!driver)throw Error('Preencha a rota numérica e o motorista.');RotaValidation.validate([{trip:'1',route:key,driver:unigis,plate}],'BL2');
    if(saveReferenceRoutes({...reference.routes,[key]:[{driver,plate,unigis,tabs:['Mapa_Fixo']}]})){openReferenceEditor();feedback(null,'BL2');$('bl2-note').textContent='Modelo BL2 atualizado. Confira a alocação antes de aprovar novamente.';}
   }catch(e){feedback(e,'BL2');}
  };
  $('bl2-ref-delete').onclick=()=>{if(submitting||isOperationBusy('BL2')||$('bl2-ref-choice').value==='')return;const d=entries[Number($('bl2-ref-choice').value)];if(!confirm('Excluir o cadastro da rota '+d.route+'? As ordens dessa rota ficarão pendentes até cadastrar outro motorista.'))return;const routes={...reference.routes};delete routes[d.route];if(!Object.keys(routes).length){feedback(Error('Para remover o último cadastro, use Excluir referência dos motoristas.'),'BL2');return;}if(saveReferenceRoutes(routes)){openReferenceEditor();feedback(null,'BL2');}};
  $('bl2-ref-close').onclick=()=>{$('bl2-reference-editor').innerHTML='';};
  if(typeof selectedRoute==='string'){const index=entries.findIndex(d=>d.route===selectedRoute);if(index>=0){$('bl2-ref-choice').value=String(index);$('bl2-ref-choice').onchange();}}
  $('bl2-reference-editor').scrollIntoView({block:'nearest'});
 }
 $('bl2-reference-edit').onclick=openReferenceEditor;
 $('bl2-allocation-preview').onclick=event=>{const button=event.target.closest('[data-bl2-edit-route]');if(button)openReferenceEditor(button.dataset.bl2EditRoute);};
 $('bl2-reference-download').onclick=async()=>{if(!reference)return;try{await ensureXlsx();const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(referenceTable(reference)),'Mapa_Fixo');downloadWorkbook(wb,'MODELO_MOTORISTAS_BL2_ATUALIZADO.xlsx');}catch(e){feedback(e,'BL2');}};
 const updateReferenceControls=updateButtons;updateButtons=function(){updateReferenceControls();const locked=submitting||isOperationBusy('BL2');$('bl2-reference-edit').disabled=locked||!reference||bl2ApprovalRequired;$('bl2-reference-download').disabled=!reference;manager.style.pointerEvents=locked?'none':'';};

 label();updateButtons();
})();
