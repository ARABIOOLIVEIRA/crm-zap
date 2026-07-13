window.CrmZapNormalizer = {
  phone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.startsWith("55") ? digits : `55${digits}`;
  },
  text(value, max = 4000) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  },
  messageHash(message, conversationId) {
    const raw = [
      conversationId || "",
      message.direction || "",
      message.type || "",
      message.content || "",
      message.timestamp || "",
      message.sequence || 0
    ].join("|");
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return `m_${Math.abs(hash)}`;
  }
};
