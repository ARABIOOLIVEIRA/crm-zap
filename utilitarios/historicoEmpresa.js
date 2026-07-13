export function criarItemHistorico(titulo, detalhe) {
  return {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    titulo,
    detalhe,
    criado_em: new Date().toISOString(),
  };
}

export function adicionarHistoricoEmpresa(empresa, titulo, detalhe) {
  return [
    criarItemHistorico(titulo, detalhe),
    ...(empresa?.historico_atividades || []),
  ].slice(0, 40);
}
