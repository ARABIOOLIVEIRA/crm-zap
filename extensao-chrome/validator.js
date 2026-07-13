window.CrmZapValidator = {
  validate(payload) {
    const errors = [];
    const contact = payload.contact || {};
    const messages = (payload.conversation?.messages || []).filter((m) => m.selected);

    if (!contact.name?.trim()) errors.push("Informe o nome do contato.");
    if (!contact.whatsapp?.trim() && payload.destination !== "conversation_only") {
      errors.push("Não foi possível identificar o número deste contato. Preencha manualmente antes de continuar ou vincule a um contato existente.");
    }
    if (!payload.destination) errors.push("Escolha o destino no CRM.");
    if (!messages.length) errors.push("Selecione ao menos uma mensagem.");
    if (messages.length > 300) errors.push("Selecione no máximo 300 mensagens por importação.");

    const totalSize = JSON.stringify(messages).length;
    if (totalSize > 900000) errors.push("O conteúdo selecionado está muito grande. Reduza a seleção de mensagens.");

    return { ok: errors.length === 0, errors };
  }
};
