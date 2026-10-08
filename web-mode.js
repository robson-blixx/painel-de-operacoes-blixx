'use strict';
// Browser-only edition. No network request can reach the robot or client portal.
(()=>{
 const nativeFetch=window.fetch.bind(window),revisions=new Map();
 window.fetch=async function(input,init){
  const url=new URL(typeof input==='string'?input:input.url,location.href);
  if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);
  const route=url.pathname.slice(5),body=init?.body?JSON.parse(init.body):{};
  const json=(value,status=200)=>Promise.resolve(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}));
  if(route==='token')return json({token:'browser-only'});
  if(route==='state')return json({version:2,build:'2026-10-06-optional-base-v3',states:{BLX:{running:false},BL2:{running:false}}});
  if(route==='delete-revision'){revisions.delete(body.operation);return json({ok:true});}
  if(route==='revision'){
   const bytes=Uint8Array.from(atob(body.xlsx),c=>c.charCodeAt(0));
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
   const sheet={...body,id:crypto.randomUUID(),fileHash:hash,total:new Set(body.rows.map(r=>r.trip)).size};
   revisions.set(body.operation,sheet);return json(sheet);
  }
  if(route==='operation-sheet')return json({sheet:revisions.get(url.searchParams.get('operation'))||null});
  if(route==='revision-file'){
   const saved=revisions.get(url.searchParams.get('operation'));if(!saved)return json({error:'Nenhuma planilha carregada.'},404);
   return new Response(Uint8Array.from(atob(saved.xlsx),c=>c.charCodeAt(0)),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
  }
  return json({error:'Esta versão organiza e baixa planilhas. O robô será disponibilizado na etapa do servidor.'},403);
 };
 const style=document.createElement('style');style.textContent='#parallel-monitors,#parallel-mode,#parallel-mode+label,[id$="-start"],#blx-controls,[id$="-use-approved"],[id$="-approved"],[id$="-approved-remove"],[id$="-approval-note"]{display:none!important}';document.head.append(style);
 window.addEventListener('DOMContentLoaded',()=>{
  // Route child-workspace downloads through the main document, keeping the
  // generated workbook and filename from the selected BL2 workspace.
  if(window.parent!==window&&typeof window.parent.downloadBlob==='function')downloadBlob=(blob,name)=>window.parent.downloadBlob(blob,name);
  const box=document.getElementById('parallel-monitors')?.parentElement;
  if(box){box.querySelector('h2').textContent='Organizar, conferir e baixar planilhas';box.querySelector('label').hidden=true;box.querySelector('#robot-feedback').textContent='Os modelos e as escolhas ficam salvos neste navegador. A execução do robô será disponibilizada na etapa do servidor.';}
  const paragraph=document.querySelector('#operation-bl2>p');if(paragraph)paragraph.textContent='Anexe a demanda e a referência dos motoristas. Aloque por rota, visualize, confira e baixe a planilha organizada.';
  document.querySelectorAll('[id$="-approval-note"]').forEach(el=>el.hidden=true);
  const frequencies=document.querySelector('#bl2-frequency-workspaces .operation-heading p');if(frequencies)frequencies.textContent='Cada ambiente mantém seu próprio modelo e suas alterações. BLX e BL2 permanecem separados.';
 });
})();
