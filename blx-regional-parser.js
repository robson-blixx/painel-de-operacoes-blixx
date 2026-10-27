(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BLXRegionalParser=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SHEET='Fracionamento Bairros BLX';
  const text=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const normal=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  function colName(col){let name='';while(col>0){col--;name=String.fromCharCode(65+col%26)+name;col=Math.floor(col/26);}return name;}
  function parse(table){
    if(!Array.isArray(table))throw Error('A referência de bairros precisa ser uma tabela.');
    const get=(row,col)=>text(table[row-1]?.[col-1]);
    if(normal(get(1,1))!=='CIDADE'||normal(get(1,2))!=='BRUSQUE'||normal(get(1,11))!=='ITAJAI'||normal(get(1,17))!=='BALNEARIO CAMBORIU'||normal(get(23,2))!=='RIO DO SUL SEM FREQUENCIA'||normal(get(23,10))!=='RIO DO SUL COM FREQUENCIA'){
      throw Error('Formato da aba de bairros diferente do modelo conhecido. Não foi importado automaticamente.');
    }
    const rules=[],notes=[];
    const add=(data)=>{
      if(!data.value)return;
      const sourceCell=colName(data.col)+data.row;
      rules.push({id:'BLX-'+sourceCell,env:data.env||'unknown',cidade:data.cidade,bairro:data.bairro||'',loja:data.loja||'',scope:data.scope||'bairro',motoristaFonte:get(data.headerRow,data.col),context:data.context,sourceSheet:SHEET,sourceCell,sourceHeaderCell:colName(data.col)+data.headerRow,sourceCityCell:data.cityCell,review:!!data.review,reason:data.reason||'',...(data.days?{diasSemana:data.days}:{}),...(data.placa?{placaFonte:data.placa}:{})});
    };
    const metadata=value=>/^(?:CF[ _-]|RDS\s*\d|PUDOS$)/i.test(normal(value));
    const ambiguousDriver=value=>/Ezio.*Carla|Marcelo A Jackson|Bruno\s*-\s*Andre/i.test(normal(value));
    function boroughBlock({firstCol,lastCol,firstRow,lastRow,headerRow,city,cityCell,context}){
      for(let col=firstCol;col<=lastCol;col++)for(let row=firstRow;row<=lastRow;row++){
        const value=get(row,col);if(!value||metadata(value))continue;
        let cidade=city,bairro=value,review=ambiguousDriver(get(headerRow,col)),reason=review?'O cabeçalho contém mais de uma referência de motorista. Confirme o cadastro.':'';
        if(/\(ITAJAI\)$/i.test(normal(value))){cidade='Itajai';bairro=value.replace(/\s*\(ITAJAI\)$/i,'').trim();}
        if(normal(value)==='SHOPPING'||/\(JARDIM DAS BROMELIAS\)/.test(normal(value))){review=true;reason='Descrição de bairro ou região precisa ser confirmada.';}
        add({row,col,value,cidade,bairro,headerRow,cityCell,context,review,reason});
      }
    }
    boroughBlock({firstCol:2,lastCol:5,firstRow:4,lastRow:12,headerRow:2,city:'Brusque',cityCell:'B1',context:'Brusque — frequência não informada'});
    boroughBlock({firstCol:11,lastCol:14,firstRow:4,lastRow:19,headerRow:2,city:'Itajai',cityCell:'K1',context:'Itajai — frequência não informada'});
    boroughBlock({firstCol:17,lastCol:18,firstRow:4,lastRow:8,headerRow:2,city:'Balneario Camboriu',cityCell:'Q1',context:'Balneario Camboriu — frequência não informada'});
    function rioCell(row,col,env){
      const value=get(row,col);if(!value)return;
      const common={row,col,value,env,cidade:'Rio do Sul',headerRow:24,cityCell:env==='sem'?'B23':'J23',context:'Rio do Sul — '+(env==='sem'?'sem frequência':'com frequência')};
      const markedCity=value.match(/^(.*?)\s*\(Cidade\)\s*$/i);
      if(markedCity){add({...common,cidade:markedCity[1].trim(),scope:'cidade'});return;}
      const shopAndBairro=value.match(/^(.*?)\s+-\s+(.*?)\s+(?:Bairro|\(LOJA\))$/i);
      if(shopAndBairro){add({...common,scope:'loja',loja:shopAndBairro[1].trim(),bairro:shopAndBairro[2].trim()});return;}
      const boroughShop=value.match(/^(.*?)\s*\((.*?)\s+Loja\)\s*$/i);
      if(boroughShop){add({...common,scope:'loja',bairro:boroughShop[1].trim(),loja:boroughShop[2].trim(),review:true,reason:'A loja está abreviada dentro da descrição do bairro. Confirme os três critérios.'});return;}
      if(/\(Lojas?\)$/i.test(value)){
        add({...common,scope:'loja',loja:value.replace(/\s*\(Lojas?\)$/i,'').trim(),review:true,reason:'Loja informada sem bairro. Complete a identificação antes de aplicar.'});return;
      }
      const knownShop=(env==='sem'&&((col===3&&row>=32)||(col===4&&row>=31)));
      if(knownShop){add({...common,scope:'loja',loja:value,review:true,reason:'Loja informada sem bairro. Complete a identificação antes de aplicar.'});return;}
      add({...common,bairro:value.replace(/\s*\(Rio do sul\)$/i,'').trim()});
    }
    for(let col=2;col<=4;col++)for(let row=26;row<=33;row++)rioCell(row,col,'sem');
    for(let row=25;row<=28;row++){const value=get(row,5);add({row,col:5,value,env:'sem',cidade:value,scope:'cidade',headerRow:24,cityCell:'E23',context:'Cidades próximas — sem frequência'});}
    for(let col=10;col<=15;col++)for(let row=26;row<=38;row++){
      const value=get(row,col);if(!value)continue;
      // These columns contain named whole cities, not boroughs of Rio do Sul.
      if(col===15){add({row,col,value,env:'com',cidade:value,scope:'cidade',headerRow:24,cityCell:'J23',context:'Cidades próximas — com frequência'});continue;}
      rioCell(row,col,'com');
    }
    for(let col=2;col<=4;col++)for(let row=41;row<=64;row++){
      const value=get(row,col);if(!value)continue;
      add({row,col,value,cidade:'Rio do Sul',scope:'loja',loja:value,headerRow:39,cityCell:'C37',context:'Rio do Sul — esquema adicional por dias',review:true,days:get(38,col),reason:'Este esquema por dias se sobrepõe aos blocos de frequência e não informa bairro. Confirme o alcance e a loja.'});
    }
    const groups=[{from:39,to:39},{from:42,to:43},{from:46,to:46},{from:49,to:51},{from:54,to:54},{from:61,to:64},{from:70,to:72}];
    for(const group of groups){
      const owner=get(group.from,9),match=owner.match(/^(.*?)\s*-\s*([A-Z]{3}[0-9][A-Z0-9][0-9]{2})$/i);
      for(let row=group.from;row<=group.to;row++){
        const city=get(row,8);if(!city)continue;
        add({row,col:8,value:city,cidade:city,scope:'cidade',headerRow:group.from,cityCell:'H'+row,context:'Cadastro explícito de cidades — frequência não informada',review:!match,reason:match?'':'O cadastro de motorista/placa precisa ser confirmado.',placa:match?match[2]:''});
        const rule=rules[rules.length-1];rule.motoristaFonte=match?match[1].trim():owner;rule.sourceHeaderCell='I'+group.from;
      }
    }
    for(const row of [67,77,78,79,80]){
      const city=get(row,8);if(!city)continue;
      add({row,col:8,value:city,cidade:city,scope:'cidade',headerRow:row,cityCell:'H'+row,context:'Cidade sem responsável explícito',review:true,reason:'Não há motorista explícito neste grupo. Não herdar o motorista do grupo anterior.'});
      const rule=rules[rules.length-1];rule.motoristaFonte='';rule.sourceHeaderCell='I'+row;
    }
    notes.push('Importada somente a aba '+SHEET+'. Contatos, logins, senhas e dados de outras abas não são utilizados.');
    notes.push('Brusque, Itajai, Balneario Camboriu e o cadastro de cidades não informam frequência. Confirme o ambiente antes de aplicar.');
    notes.push('Nomes abreviados e cabeçalhos com mais de um motorista exigem associação explícita ao cadastro. Nenhuma aproximação foi realizada.');
    notes.push('Códigos CF/RDS, a categoria PUDOS e observações de agrupamento não foram interpretados como bairros ou rotas oficiais.');
    notes.push('As lojas sem bairro e o esquema adicional por dias permanecem para revisão. Regras de cidade inteira apenas sugerem o responsável.');
    return {rules,notes};
  }
  return {parse,SHEET};
});
