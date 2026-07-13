chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CRM_ZAP_DETECT_CHAT") {
    const contact = window.CrmZapContactReader.read();
    sendResponse({ ok: true, data: contact });
    return true;
  }

  if (message?.type === "CRM_ZAP_READ_CHAT") {
    try {
      const contact = window.CrmZapContactReader.read();
      if (!contact.hasOpenConversation) {
        sendResponse({ ok: false, error: "Abra uma conversa no WhatsApp Web para começar.", diagnostics: contact });
        return true;
      }
      if (contact.isGroup) {
        sendResponse({ ok: false, error: "Esta conversa é um grupo. A importação de grupos não está disponível nesta versão.", diagnostics: contact });
        return true;
      }

      const conversation = window.CrmZapConversationReader.read(contact.temporaryConversationId);
      const summary = window.CrmZapConversationReader.summarize(conversation.messages);
      sendResponse({
        ok: true,
        data: {
          contact,
          conversation: {
            name: contact.name,
            temporaryConversationId: contact.temporaryConversationId,
            summary,
            messages: conversation.messages
          },
          diagnostics: {
            conversationDetected: contact.hasOpenConversation,
            contactDetected: Boolean(contact.name),
            phoneDetected: Boolean(contact.whatsapp),
            messagesFound: conversation.messages.length,
            selectorFailures: [...contact.failures, ...conversation.failures],
            extensionVersion: "0.2.0"
          }
        }
      });
    } catch (err) {
      sendResponse({ ok: false, error: "Não foi possível ler esta conversa. A estrutura do WhatsApp Web pode ter sido atualizada.", details: err.message });
    }
    return true;
  }
});
