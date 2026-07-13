window.CrmZapConversationReader = {
  detectType(node, content) {
    const text = content.toLowerCase();
    if (text.includes("mensagem apagada") || text.includes("message was deleted")) return "deleted";
    if (node.querySelector("span[data-icon='audio-play']")) return "audio";
    if (node.querySelector("span[data-icon='document']")) return "document";
    if (node.querySelector("span[data-icon='video']")) return "video";
    if (node.querySelector("span[data-icon='sticker']")) return "sticker";
    if (node.querySelector("img")) return content ? "image_with_caption" : "image";
    return content ? "text" : "media";
  },
  read(conversationId) {
    const S = window.CrmZapSelectors;
    const found = [];
    S.messageNodes.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (!found.includes(node)) found.push(node);
      });
    });
    const nodes = found.filter((node) => {
      const hasMeta = node.matches?.("[data-pre-plain-text]") || node.querySelector?.("[data-pre-plain-text]");
      const hasText = S.messageText.some((selector) => node.querySelector?.(selector));
      const hasMessageClass = node.classList?.contains("message-in") || node.classList?.contains("message-out");
      return hasMeta || hasText || hasMessageClass;
    });
    const failures = [];
    if (!nodes.length) failures.push("messageNodes");

    const messages = nodes.slice(-180).map((node, index) => {
      const wrapper = node.closest?.(".message-in, .message-out") || node;
      const direction = wrapper.classList?.contains("message-out") ? "sent" : "received";
      const textParts = [];
      S.messageText.forEach((selector) => {
        Array.from(node.querySelectorAll(selector))
          .map((el) => el.textContent.trim())
          .filter(Boolean)
          .forEach((text) => {
            if (!textParts.includes(text)) textParts.push(text);
          });
      });
      const content = textParts.join("\n");
      const timestamp =
        node.getAttribute?.("data-pre-plain-text") ||
        node.querySelector(S.messageMeta)?.getAttribute("data-pre-plain-text") ||
        wrapper.querySelector?.(S.messageMeta)?.getAttribute("data-pre-plain-text") ||
        "";
      const type = this.detectType(node, content);
      const message = {
        selected: true,
        sequence: index + 1,
        direction,
        type,
        content,
        description: content ? "" : `Mensagem de ${type}`,
        timestamp,
        validationStatus: "pendente"
      };
      message.hash = window.CrmZapNormalizer.messageHash(message, conversationId);
      return message;
    }).filter((msg) => msg.content || msg.type !== "text");

    return { messages, failures };
  },
  summarize(messages) {
    const selected = messages || [];
    const sent = selected.filter((m) => m.direction === "sent").length;
    const received = selected.filter((m) => m.direction === "received").length;
    const media = selected.filter((m) => !["text", "deleted"].includes(m.type)).length;
    return {
      total: selected.length,
      first: selected[0]?.content || selected[0]?.description || "",
      last: selected[selected.length - 1]?.content || selected[selected.length - 1]?.description || "",
      periodStart: selected[0]?.timestamp || "",
      periodEnd: selected[selected.length - 1]?.timestamp || "",
      sent,
      received,
      media,
      lastInteraction: selected[selected.length - 1]?.timestamp || ""
    };
  }
};
