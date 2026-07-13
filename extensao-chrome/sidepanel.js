let currentPayload = null;
let validationOk = false;

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = isError ? "status error" : "status";
}

async function getActiveWhatsappTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith("https://web.whatsapp.com/")) {
    throw new Error("Abra o WhatsApp Web para começar.");
  }
  return tab;
}

async function ensureContentScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      "selectors.js",
      "normalizer.js",
      "contact-reader.js",
      "conversation-reader.js",
      "content.js"
    ]
  });
}

function sendToTabOnce(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (payload) => {
      if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
      else resolve(payload);
    });
  });
}

async function sendToTab(tabId, message) {
  let result = await sendToTabOnce(tabId, message);
  if (result?.ok === false && String(result.error || "").includes("Receiving end does not exist")) {
    await ensureContentScripts(tabId);
    result = await sendToTabOnce(tabId, message);
  }
  return result;
}

function fillContact(contact) {
  $("contactName").value = contact.name || "";
  $("companyName").value = contact.companyName || contact.name || "";
  $("whatsapp").value = contact.whatsapp || "";
  $("phone").value = contact.phone || contact.whatsapp || "";
  $("city").value = contact.city || "Uberlandia";
  $("niche").value = contact.niche || "WhatsApp";
  $("notes").value = contact.notes || "";
}

function readContactFromForm() {
  return {
    ...currentPayload.contact,
    name: $("contactName").value.trim(),
    companyName: $("companyName").value.trim(),
    whatsapp: $("whatsapp").value.replace(/\D/g, ""),
    phone: $("phone").value.replace(/\D/g, ""),
    city: $("city").value.trim(),
    niche: $("niche").value.trim(),
    notes: $("notes").value.trim()
  };
}

function renderSummary(summary) {
  $("conversationSummary").innerHTML = `
    <p><strong>Nome:</strong> ${currentPayload.conversation.name || "-"}</p>
    <p><strong>Mensagens:</strong> ${summary.total}</p>
    <p><strong>Enviadas:</strong> ${summary.sent} · <strong>Recebidas:</strong> ${summary.received} · <strong>Mídias:</strong> ${summary.media}</p>
    <p><strong>Primeira:</strong> ${summary.first || "-"}</p>
    <p><strong>Última:</strong> ${summary.last || "-"}</p>
    <p><strong>Período:</strong> ${summary.periodStart || "-"} até ${summary.periodEnd || "-"}</p>
  `;
}

function renderMessages(messages) {
  const container = $("messages");
  container.innerHTML = "";
  messages.forEach((message, index) => {
    const div = document.createElement("div");
    div.className = "message";
    div.innerHTML = `
      <label><input type="checkbox" data-index="${index}" ${message.selected ? "checked" : ""} style="width:auto" /> #${message.sequence} · ${message.direction} · ${message.type}</label>
      <input data-field="timestamp" data-index="${index}" value="${message.timestamp || ""}" placeholder="Data/horário" />
      <textarea data-field="content" data-index="${index}" placeholder="Conteúdo">${message.content || message.description || ""}</textarea>
      <div class="muted">Status: ${message.validationStatus || "pendente"}</div>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      currentPayload.conversation.messages[Number(e.target.dataset.index)].selected = e.target.checked;
      validationOk = false;
      $("sendCrm").disabled = true;
    });
  });

  container.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const message = currentPayload.conversation.messages[Number(e.target.dataset.index)];
      message[e.target.dataset.field] = e.target.value;
      validationOk = false;
      $("sendCrm").disabled = true;
    });
  });
}

function collectPayload() {
  return {
    ...currentPayload,
    contact: readContactFromForm(),
    destination: $("destination").value,
    metadataOnly: $("metadataOnly").checked,
    conversation: {
      ...currentPayload.conversation,
      messages: currentPayload.conversation.messages
    }
  };
}

async function detectChat() {
  try {
    const tab = await getActiveWhatsappTab();
    const result = await sendToTab(tab.id, { type: "CRM_ZAP_DETECT_CHAT" });
    if (result?.data?.isGroup) {
      $("detected").textContent = "Conversa de grupo detectada. Importação de grupos não disponível.";
    } else if (result?.data?.hasOpenConversation) {
      $("detected").textContent = `Conversa identificada: ${result.data.name}`;
    } else {
      $("detected").textContent = "Abra uma conversa no WhatsApp Web para começar.";
    }
  } catch (err) {
    $("detected").textContent = err.message;
  }
}

$("saveConfig").addEventListener("click", async () => {
  await window.CrmZapStorage.saveConfig({
    crmUrl: $("crmUrl").value.replace(/\/$/, ""),
    token: $("token").value
  });
  setStatus("Configuração salva.");
});

$("readChat").addEventListener("click", async () => {
  try {
    setStatus("Lendo conversa aberta...");
    validationOk = false;
    $("sendCrm").disabled = true;
    const tab = await getActiveWhatsappTab();
    const result = await sendToTab(tab.id, { type: "CRM_ZAP_READ_CHAT" });
    if (!result?.ok) throw new Error(result?.error || "Erro de leitura.");

    currentPayload = result.data;
    fillContact(currentPayload.contact);
    renderSummary(currentPayload.conversation.summary);
    renderMessages(currentPayload.conversation.messages);
    $("matchInfo").textContent = "Correspondência no CRM será validada antes do envio.";
    $("review").classList.remove("hidden");
    setStatus("Dados encontrados. Revise antes de enviar.");
  } catch (err) {
    setStatus(err.message, true);
  }
});

$("diagnostics").addEventListener("click", async () => {
  try {
    const tab = await getActiveWhatsappTab();
    const result = await sendToTab(tab.id, { type: "CRM_ZAP_READ_CHAT" });
    const diag = result?.data?.diagnostics || result?.diagnostics || {};
    setStatus(`Diagnóstico:
Conversa detectada: ${diag.conversationDetected || false}
Contato detectado: ${diag.contactDetected || false}
Número detectado: ${diag.phoneDetected || false}
Mensagens: ${diag.messagesFound || 0}
Falhas: ${(diag.selectorFailures || []).join(", ") || "nenhuma"}
Versão: ${diag.extensionVersion || "0.2.0"}`);
  } catch (err) {
    setStatus(err.message, true);
  }
});

$("selectAll").addEventListener("click", () => {
  currentPayload.conversation.messages.forEach((m) => m.selected = true);
  renderMessages(currentPayload.conversation.messages);
});

$("clearAll").addEventListener("click", () => {
  currentPayload.conversation.messages.forEach((m) => m.selected = false);
  renderMessages(currentPayload.conversation.messages);
});

$("validateData").addEventListener("click", async () => {
  try {
    const payload = collectPayload();
    const local = window.CrmZapValidator.validate(payload);
    if (!local.ok) throw new Error(local.errors.join("\n"));
    const result = await window.CrmZapApiClient.validateImport(payload);
    validationOk = true;
    $("sendCrm").disabled = false;
    $("matchInfo").textContent = result.matchMessage || "Dados válidos para importação.";
    setStatus("Dados validados. Pronto para enviar.");
  } catch (err) {
    validationOk = false;
    $("sendCrm").disabled = true;
    setStatus(err.message, true);
  }
});

$("sendCrm").addEventListener("click", async () => {
  try {
    if (!validationOk) throw new Error("Valide os dados antes de enviar.");
    setStatus("Enviando para o CRM...");
    const result = await window.CrmZapApiClient.importConversation(collectPayload());
    setStatus(`Importação concluída.
Empresa: ${result.empresaNome || "-"}
Contato: ${result.contatoNome || "-"}
Mensagens importadas: ${result.imported || 0}
Mensagens duplicadas ignoradas: ${result.duplicates || 0}
Última interação atualizada.`);
  } catch (err) {
    setStatus(err.message, true);
  }
});

$("cancel").addEventListener("click", () => {
  currentPayload = null;
  validationOk = false;
  $("review").classList.add("hidden");
  $("sendCrm").disabled = true;
  setStatus("Importação cancelada.");
});

chrome.storage.sync.get(["crmUrl", "token"], (data) => {
  $("crmUrl").value = data.crmUrl || "https://crm-zap-five.vercel.app";
  $("token").value = data.token || "";
});

detectChat();
