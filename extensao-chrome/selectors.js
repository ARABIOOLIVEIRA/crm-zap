window.CrmZapSelectors = {
  header: "header",
  contactTitle: ["header span[title]", "header [dir='auto']"],
  messageNodes: [
    "div.message-in",
    "div.message-out",
    "div[data-pre-plain-text]",
    "div[role='row'] div.copyable-text",
    "div.copyable-text"
  ],
  messageText: [
    "span.selectable-text",
    "span.copyable-text",
    "div.selectable-text",
    "span[dir='ltr']",
    "span[dir='auto']"
  ],
  messageMeta: "[data-pre-plain-text]",
  mediaHints: [
    "span[data-icon='audio-play']",
    "span[data-icon='document']",
    "span[data-icon='image']",
    "span[data-icon='video']",
    "span[data-icon='sticker']"
  ],
  groupHints: [
    "header span[title*=',']",
    "header [aria-label*='grupo']",
    "header [aria-label*='group']"
  ]
};

window.CrmZapSelectorUtils = {
  first(selectors, root = document) {
    for (const selector of selectors) {
      const el = root.querySelector(selector);
      if (el) return el;
    }
    return null;
  },
  all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }
};
