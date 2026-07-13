window.CrmZapStorage = {
  async getConfig() {
    return chrome.storage.sync.get(["crmUrl", "token"]);
  },
  async saveConfig(config) {
    return chrome.storage.sync.set(config);
  }
};
