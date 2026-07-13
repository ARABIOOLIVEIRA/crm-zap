window.CrmZapContactReader = {
  read() {
    const S = window.CrmZapSelectors;
    const U = window.CrmZapSelectorUtils;
    const header = document.querySelector(S.header);
    if (!header) {
      return { hasOpenConversation: false, failures: ["header"] };
    }

    const titleEl = U.first(S.contactTitle);
    const name = (titleEl?.getAttribute("title") || titleEl?.textContent || "").trim();
    const isGroup = S.groupHints.some((selector) => !!document.querySelector(selector));

    return {
      hasOpenConversation: Boolean(name),
      name: name || "",
      companyName: name || "",
      whatsapp: "",
      phone: "",
      city: "Uberlandia",
      niche: "WhatsApp",
      notes: "",
      type: isGroup ? "group" : "individual",
      isGroup,
      temporaryConversationId: name ? `wa_${name.toLowerCase().replace(/\W+/g, "_").slice(0, 40)}` : "",
      failures: name ? [] : ["contactTitle"]
    };
  }
};
