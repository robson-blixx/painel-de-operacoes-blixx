(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BLXRegionalCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const exact=value=>String(value??'').normalize('NFC').trim().replace(/\s+/g,' ').toUpperCase();
  const normalize=value=>exact(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const assignmentKey=driver=>['motorista','rota','placa','unigis'].map(key=>exact(driver?.[key])).join('|');
  const validDriver=driver=>driver&&['motorista','rota','placa','unigis'].every(key=>exact(driver[key]));
  function signature(rule){
    return JSON.stringify({
      cidade:normalize(rule.cidade),bairro:normalize(rule.bairro),loja:normalize(rule.loja),
      motoristaFonte:normalize(rule.motoristaFonte),escopo:normalize(rule.escopo||rule.scope).toLowerCase(),
      env:normalize(rule.env).toLowerCase(),days:Array.isArray(rule.days)?rule.days.map(normalize).sort():normalize(rule.days||rule.diasSemana),
      context:normalize(rule.context),review:!!rule.review,
      sourceSheet:String(rule.sourceSheet||''),sourceCell:String(rule.sourceCell||'')
    });
  }
  function aliasKey(rule){
    return JSON.stringify([normalize(rule.cidade),normalize(rule.env).toLowerCase(),normalize(rule.motoristaFonte),normalize(rule.context)]);
  }
  function scopeOf(rule){return normalize(rule.escopo||rule.scope).toLowerCase();}
  function matchingRule(record,rule){
    if(!normalize(rule.cidade)||normalize(record.cidade)!==normalize(rule.cidade))return false;
    const scope=scopeOf(rule);
    if(scope==='cidade')return true;
    if(scope==='bairro')return !!normalize(rule.bairro)&&normalize(record.bairro)===normalize(rule.bairro);
    if(scope==='loja'){
      if(!normalize(rule.loja)||normalize(record.loja)!==normalize(rule.loja))return false;
      if(!normalize(rule.bairro))return !!rule.review;
      return normalize(record.bairro)===normalize(rule.bairro);
    }
    // Ambiguous entries can warn on their known location, but never broaden to other cities.
    if(!rule.review)return false;
    if(normalize(rule.bairro)&&normalize(record.bairro)!==normalize(rule.bairro))return false;
    if(normalize(rule.loja)&&normalize(record.loja)!==normalize(rule.loja))return false;
    return true;
  }
  function boundDriver(rule,bindings,catalog){
    const binding=bindings[aliasKey(rule)];
    const key=typeof binding==='string'?binding:binding?.assignmentKey;
    if(!key)return null;
    const options=catalog.filter(driver=>validDriver(driver)&&assignmentKey(driver)===key&&exact(driver.base||'BLX')==='BLX');
    return options.length===1?options[0]:null;
  }
  function evaluate(record,options={}){
    const {env,rules=[],bindings={},catalog=[],learned=null,exactMatch=null}=options;
    if(!['com','sem'].includes(env))return {applicable:false};
    const relevant=rules.filter(rule=>matchingRule(record,rule)&&(!['com','sem'].includes(rule.env)||rule.env===env));
    if(!relevant.length)return {applicable:false};
    const rank=rule=>({loja:3,bairro:2,cidade:1}[scopeOf(rule)]||0);
    const highest=Math.max(...relevant.map(rank));
    const selected=relevant.filter(rule=>rank(rule)===highest);
    const ruleSignatures=[...new Set(selected.map(signature))].sort();
    const effectiveSignatures=[...new Set(selected.map(rule=>{
      const binding=bindings[aliasKey(rule)],bindingKey=typeof binding==='string'?binding:(binding?.assignmentKey||null);
      const resolved=boundDriver(rule,bindings,catalog);
      return JSON.stringify([signature(rule),bindingKey,resolved?assignmentKey(resolved):'unresolved']);
    }))].sort();
    const regionalSignature=JSON.stringify(effectiveSignatures);
    const result={applicable:true,ruleSignatures,regionalSignature,sourceRules:selected,requiresConfirmation:true};
    const pending=(reason,driver)=>({...result,status:'pending',reason,driver:driver||null});
    if(![record.cidade,record.bairro,record.loja].every(normalize))return pending('Cidade, bairro e loja são obrigatórios para gravar o vínculo.');
    const learnedChoices=learned?catalog.filter(item=>validDriver(item)&&assignmentKey(item)===assignmentKey(learned)&&exact(item.base||'BLX')==='BLX'):[];
    const learnedDriver=learnedChoices.length===1?learnedChoices[0]:null;
    // A confirmed store-level decision can resolve ambiguity without broadening its scope.
    if(learnedDriver&&learned.regionalSignature===regionalSignature&&learned.regionalOverride===true){
      return {...result,status:'match',reason:'Exceção confirmada para esta loja na referência atual.',driver:learnedDriver,requiresConfirmation:false};
    }
    if(learned?.regionalOverride===true&&learned.regionalSignature!==regionalSignature)return pending('A referência ou a associação do motorista mudou. Reconfirme o vínculo aprendido.');
    if(learned&&!learnedDriver)return pending('O cadastro do vínculo aprendido mudou. Confirme novamente.');
    if(selected.some(rule=>rule.review||!['com','sem'].includes(rule.env)))return pending('Referência regional requer confirmação do responsável ou da frequência.');
    const drivers=selected.map(rule=>boundDriver(rule,bindings,catalog));
    if(drivers.some(driver=>!driver))return pending('Associe o nome da referência ao motorista cadastrado e confirme esta região.');
    const unique=[...new Map(drivers.map(driver=>[assignmentKey(driver),driver])).values()];
    if(unique.length!==1)return pending('Mais de um motorista está indicado para esta região na referência atual.');
    const driver=unique[0];
    if(learnedDriver){
      if(assignmentKey(learnedDriver)!==assignmentKey(driver))return pending('A referência atual diverge do vínculo aprendido. Reconfirme sem apagar o histórico.',driver);
      return {...result,status:'match',reason:'Vínculo aprendido compatível com a referência regional atual.',driver:learnedDriver,requiresConfirmation:false};
    }
    if(highest===1)return {...result,status:'suggestion',reason:'Atendimento por cidade: confirme o vínculo desta cidade, bairro e loja.',driver};
    if(exactMatch&&validDriver(exactMatch)&&assignmentKey(exactMatch)===assignmentKey(driver)){
      return {...result,status:'match',reason:'Cidade, bairro e loja conferidos com a referência regional atual.',driver,requiresConfirmation:false};
    }
    return {...result,status:'suggestion',reason:exactMatch?'A referência atual diverge do modelo. Confirme o motorista desta loja.':'Loja nova: confirme o motorista sugerido para a região.',driver};
  }
  return {normalize,signature,aliasKey,assignmentKey,evaluate};
});
