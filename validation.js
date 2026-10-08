(function(root){
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const driverName = value => String(value ?? '').split(/\bCPF\b/i)[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().split(/\s+/).sort().join(' ');
  function validate(rows, operation) {
    if (!['BL2','BLX'].includes(operation)) throw Error('Escolha BL2 ou BLX.');
    if (!Array.isArray(rows) || !rows.length || rows.length > 20000) throw Error('A planilha revisada está vazia ou excede 20.000 ordens.');
    const trips = new Map();
    for (const [i,row] of rows.entries()) {
      const item = Object.fromEntries(['trip','route','driver','plate'].map(k => [k,String(row[k] ?? '').trim()]));
      if (!/^\d{1,18}$/.test(item.trip)) throw Error(`Linha ${i+1}: falta um ID da viagem válido. O robô não associa pela posição da linha.`);
      if (!item.route || !item.driver || !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(norm(item.plate))) throw Error(`Viagem ${item.trip}: confira rota, motorista e placa.`);
      item.plate = norm(item.plate);
      const before = trips.get(item.trip);
      if (before && (norm(before.driver)!==norm(item.driver) || before.plate!==item.plate || norm(before.route)!==norm(item.route))) throw Error(`Viagem ${item.trip}: há ordens com rota, motorista ou placa diferentes. Corrija antes de iniciar.`);
      trips.set(item.trip,item);
    }
    return [...trips.values()];
  }
  const api = {norm,driverName,validate};
  if (typeof module !== 'undefined') module.exports=api;
  else root.RotaValidation=api;
})(typeof window !== 'undefined' ? window : globalThis);
