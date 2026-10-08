(function(root){
 'use strict';
 const BUILD='2026-10-06-optional-base-v3';
 const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
 const index=(headers,names)=>headers.findIndex(h=>names.some(n=>normalize(h)===normalize(n)));
 function checkContext(operation,env,phase){
  if(operation==='BLX'&&['com','sem'].includes(env)&&phase==='approved')return;
  if(operation==='BL2'&&env==='bl2'&&['direct','operator'].includes(phase))return;
  throw Error('Ambiente ou aprovação incompatível com a operação. Carregue a planilha no ambiente correto.');
 }
 function checkBase(table,operation){
  if(!['BLX','BL2'].includes(operation))throw Error('Operação inválida.');
  if(!Array.isArray(table)||!table.length)throw Error('A planilha está vazia.');
  const names=['Base','Depósito','Depósito Saida','Depósito de Saída','Depósito Chegada','Depósito de Chegada'];
  const columns=table[0].map((h,i)=>names.some(n=>normalize(h)===normalize(n))?i:-1).filter(i=>i>=0);

  const rows=table.slice(1).filter(r=>r.some(c=>String(c??'').trim()));
  if(!rows.length)throw Error('A planilha está vazia.');
  for(const [i,row]of rows.entries()){
   const values=columns.map(c=>normalize(row[c])).filter(Boolean);
   if(values.some(v=>v.split(' ').includes(operation==='BLX'?'BL2':'BLX')))throw Error('Linha '+(i+2)+': depósito incompatível com '+operation+'. Confira o arquivo e o ambiente escolhido.');
  }
 }
 function parse(table,name,operation){
  checkBase(table,operation);
  if(normalize(name).split(' ').includes(operation==='BLX'?'BL2':'BLX'))throw Error('O nome do arquivo identifica outra operação. Confira o arquivo e o ambiente escolhido.');
  const headers=[...table[0]],trip=index(headers,['ID da viagem','ID Viagem','IDViagem','Viagem','Trip ID']),route=index(headers,['Rota']),normalDriver=index(headers,['Motorista','Motorista real']),unigis=index(headers,['Nome UNIGIS','Nome no Unigis']),driver=unigis>=0?unigis:normalDriver;let plate=index(headers,['Placa']);
  if([trip,route,driver].some(i=>i<0))throw Error('A planilha precisa de ID da viagem, Rota e Motorista.');
  const original=table.slice(1).filter(r=>r.some(c=>String(c??'').trim()));
  const rows=original.map(r=>{const combined=String(r[driver]||''),normal=String(normalDriver>=0?r[normalDriver]||'':'');const p=combined.match(/\s*-\s*([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\s*$/i);return {trip:String(r[trip]??'').trim(),route:String(r[route]??'').trim(),driver:(p?combined.slice(0,p.index).trim():combined.trim()).replace(unigis>=0?/^$/:/^\d+\s*-\s*/,''),plate:String(plate>=0?r[plate]:(p?.[1]||normal.match(/\s*-\s*([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\s*$/i)?.[1]||vehiclePlate(headers,r))).trim()};});
  if(rows.some(r=>!r.driver||/NAO DETERMINADO|INDETERMINADO/.test(normalize(r.driver))))throw Error('Há motorista não definido na planilha. Complete o motorista e a placa antes de iniciar.');
  if(plate<0){plate=headers.length;headers.push('Placa');}
  return {rows,table:[headers,...original.map((r,i)=>{const cells=[...r];cells[plate]=rows[i].plate;return cells;})],source:name,columns:{trip,route,driver,plate}};
 }
 function vehiclePlate(headers,row){
  const cols=headers.map((h,i)=>['VEICULO','VIAGEM VEICULO'].includes(normalize(h))?i:-1).filter(i=>i>=0);
  const found=new Set(cols.map(c=>String(row[c]??'').trim().match(/(?:^|\s*-\s*)([A-Z]{3}[0-9][A-Z0-9][0-9]{2})$/i)?.[1]?.toUpperCase()).filter(Boolean));
  if(found.size>1)throw Error('Há placas diferentes nas colunas de veículo da planilha.');return [...found][0]||'';
 }
 function assertStart(selected,input){
  if(!selected||selected.id!==input.revisionId)throw Error('A planilha mudou. Carregue novamente o arquivo correto antes de iniciar.');
  checkContext(input.operation,input.env,input.phase);
  if(selected.contract!==BUILD||selected.operation!==input.operation||selected.env!==input.env||selected.phase!==input.phase||selected.fileHash!==input.fileHash)throw Error('O Start não corresponde à planilha deste ambiente. Carregue novamente o arquivo aprovado.');
 }
 const api={BUILD,normalize,index,checkBase,checkContext,parse,assertStart};
 if(typeof module!=='undefined')module.exports=api;else root.RotaContract=api;
})(typeof window!=='undefined'?window:globalThis);
