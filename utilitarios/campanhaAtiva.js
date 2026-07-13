export const CAMPANHA_ATIVA_KEY = "crm_zap_campanha_ativa_id";

export function obterCampanhaAtiva() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CAMPANHA_ATIVA_KEY) || "";
}

export function salvarCampanhaAtiva(id) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CAMPANHA_ATIVA_KEY, id || "");
  window.dispatchEvent(new CustomEvent("crm_zap_campanha_alterada", { detail: id || "" }));
}
