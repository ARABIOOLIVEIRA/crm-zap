"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { atualizarCamposEmpresa, listarEmpresas, listarListasProspecao, normalizarTelefone } from "../../../banco_de_dados/empresas_db";
import Botao from "../../../componentes/Botao";
import Modal from "../../../componentes/Modal";
import { obterCampanhaAtiva, salvarCampanhaAtiva } from "../../../utilitarios/campanhaAtiva";
import { adicionarHistoricoEmpresa } from "../../../utilitarios/historicoEmpresa";

const MODELO_PADRAO = {
  nome: "Abordagem padrÃ£o",
  descricao: "Mensagem inicial de prospecÃ§Ã£o",
  nicho: "",
  cidade: "Uberlandia",
  mensagem: "OlÃ¡! Encontrei o trabalho da {{empresa}} em {{cidade}} e queria apresentar uma ideia simples da Lumio para empresas do segmento de {{nicho}}. Posso te mandar?",
  imagemNome: "",
  imagemDataUrl: "",
};

const TAMANHO_PADRAO_RODADA = 20;

function aplicarVariaveis(texto, empresa) {
  return String(texto || "")
    .replaceAll("{{empresa}}", empresa.nome || "")
    .replaceAll("{{contato}}", empresa.contato_nome || empresa.nome || "")
    .replaceAll("{{nicho}}", empresa.nicho || empresa.categoria || "")
    .replaceAll("{{cidade}}", empresa.cidade || "Uberlandia")
    .replaceAll("{{bairro}}", empresa.bairro || "")
    .replaceAll("{{responsavel}}", empresa.responsavel || "Lumio");
}

function somarDiasUteis(data, dias) {
  const d = new Date(`${data}T12:00:00`);
  let add = 0;
  while (add < dias) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) add++;
  }
  return d.toISOString().slice(0, 10);
}

function formatarData(data) {
  const [ano, mes, dia] = String(data || "").slice(0, 10).split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : data;
}

function dadosFunilAposEnvio(empresa) {
  const etapaAtual = empresa?.etapa_funil || empresa?.status || "Novo lead";
  if (etapaAtual === "Novo lead") {
    return {
      status: "Contatado",
      etapa_funil: "Contatado",
      detalhe: "Funil avancou de Novo lead para Contatado.",
    };
  }
  return {
    detalhe: `Funil mantido em ${etapaAtual}.`,
  };
}

function idsPendentesDaFila(ids, listaEmpresas) {
  const empresasPorId = new Map(listaEmpresas.map((empresa) => [empresa.id, empresa]));
  return ids.filter((id) => empresasPorId.has(id));
}

function chaveFilaCampanha(campanhaId) {
  return campanhaId ? `crm_zap_fila_abordagem_ids_${campanhaId}` : "crm_zap_fila_abordagem_ids";
}

function salvarFila(campanhaId, ids) {
  window.localStorage.setItem(chaveFilaCampanha(campanhaId), JSON.stringify(ids));
  window.localStorage.setItem("crm_zap_fila_abordagem_ids", JSON.stringify(ids));
}

async function copiarImagem(dataUrl) {
  if (!dataUrl || !navigator.clipboard || !window.ClipboardItem) return false;
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  return true;
}

export default function PaginaAbordagens() {
  const [empresas, setEmpresas] = useState([]);
  const [modelo, setModelo] = useState(MODELO_PADRAO);
  const [filaIds, setFilaIds] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [campanhaId, setCampanhaId] = useState("");
  const [indice, setIndice] = useState(0);
  const [status, setStatus] = useState("");
  const [followupSugerido, setFollowupSugerido] = useState(somarDiasUteis(new Date().toISOString().slice(0, 10), 2));
  const [totalFilaCriada, setTotalFilaCriada] = useState(0);
  const [conclusao, setConclusao] = useState(null);
  const [tamanhoRodada, setTamanhoRodada] = useState(TAMANHO_PADRAO_RODADA);

  function notificar(texto, titulo = "Abordagens") {
    window.crmZapNotificar?.(texto, titulo);
  }

  useEffect(() => {
    async function carregar() {
      const ativa = obterCampanhaAtiva();
      setCampanhaId(ativa);
      const dados = await listarEmpresas(ativa ? { lista_id: ativa } : {});
      setEmpresas(dados);
      setCampanhas(await listarListasProspecao().catch(() => []));
      const chaveFila = chaveFilaCampanha(ativa);
      const idsSalvos = JSON.parse(window.localStorage.getItem(chaveFila) || window.localStorage.getItem("crm_zap_fila_abordagem_ids") || "[]");
      const idsPendentes = idsPendentesDaFila(idsSalvos, dados);
      setFilaIds(idsPendentes);
      salvarFila(ativa, idsPendentes);
      setTotalFilaCriada(idsSalvos.length);
      const modeloSalvo = JSON.parse(window.localStorage.getItem("crm_zap_modelo_abordagem") || "null");
      if (modeloSalvo) setModelo(modeloSalvo);
    }
    carregar();
  }, []);

  useEffect(() => {
    window.localStorage.setItem("crm_zap_modelo_abordagem", JSON.stringify(modelo));
  }, [modelo]);

  async function trocarCampanha(id) {
    setCampanhaId(id);
    salvarCampanhaAtiva(id);
    const dados = await listarEmpresas(id ? { lista_id: id } : {});
    setEmpresas(dados);
    setFilaIds([]);
    salvarFila(id, []);
    setIndice(0);
    setTotalFilaCriada(0);
    setConclusao(null);
  }

  const fila = useMemo(() => {
    const ids = new Set(filaIds);
    return empresas.filter((empresa) => ids.has(empresa.id));
  }, [empresas, filaIds]);

  const atual = fila[indice] || null;
  const mensagemPreparada = atual ? aplicarVariaveis(modelo.mensagem, atual) : "";
  const candidatosComWhatsApp = useMemo(() => empresas.filter((e) => e.whatsapp || e.telefone), [empresas]);

  function criarRodada(usarTodos = false) {
    const numero = Number(tamanhoRodada);
    const quantidade = Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : TAMANHO_PADRAO_RODADA;
    const limite = usarTodos ? candidatosComWhatsApp.length : Math.min(quantidade, candidatosComWhatsApp.length);
    const ids = candidatosComWhatsApp.slice(0, limite).map((e) => e.id);
    setFilaIds(ids);
    salvarFila(campanhaId, ids);
    setIndice(0);
    setTotalFilaCriada(ids.length);
    setStatus(`${ids.length} lead(s) adicionados a esta rodada. A campanha continua sem limite de leads.`);
    notificar(`${ids.length} lead(s) adicionados a esta rodada.`, "Rodada criada");
  }

  function removerAtual() {
    if (!atual) return;
    const novaFila = idsPendentesDaFila(filaIds.filter((id) => id !== atual.id), empresas);
    setFilaIds(novaFila);
    salvarFila(campanhaId, novaFila);
    setIndice(Math.max(0, Math.min(indice, novaFila.length - 1)));
    if (!novaFila.length) setTotalFilaCriada(0);
  }

  function proximoLead() {
    if (!fila.length) return;
    const ultimo = indice >= fila.length - 1;
    if (!ultimo) {
      setIndice((i) => Math.min(fila.length - 1, i + 1));
      return;
    }

    const totalFinalizado = totalFilaCriada || fila.length;
    setFilaIds([]);
    salvarFila(campanhaId, []);
    setIndice(0);
    setTotalFilaCriada(0);
    setStatus(`Fila revisada. ${totalFinalizado} lead(s) conferidos.`);
    notificar(`Fila revisada. ${totalFinalizado} lead(s) conferidos.`, "Fila finalizada");
    setConclusao({
      titulo: "Fila finalizada",
      total: totalFinalizado,
      acao: "fila revisada sem reenviar mensagens",
      data: "",
    });
  }

  function onImagem(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Use JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      alert("Imagem muito grande. Use atÃ© 4MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setModelo((m) => ({ ...m, imagemNome: file.name, imagemDataUrl: reader.result }));
    reader.readAsDataURL(file);
  }

  async function prepararWhatsApp() {
    if (!atual) return;
    const telefone = normalizarTelefone(atual.whatsapp || atual.telefone);
    if (!telefone) {
      setStatus("Este lead estÃ¡ sem WhatsApp. Edite o cadastro antes de abordar.");
      await atualizarCamposEmpresa(atual.id, {
        abordagem_status: "sem_whatsapp",
        historico_atividades: adicionarHistoricoEmpresa(atual, "Abordagem bloqueada", "Lead sem WhatsApp valido."),
      });
      return;
    }

    let imagemCopiada = false;
    try {
      imagemCopiada = await copiarImagem(modelo.imagemDataUrl);
    } catch {
      imagemCopiada = false;
    }

    const campos = {
      abordagem_status: "whatsapp_aberto",
      ultima_abordagem_mensagem: mensagemPreparada,
      ultima_abordagem_em: new Date().toISOString(),
      historico_atividades: adicionarHistoricoEmpresa(atual, "WhatsApp preparado", "Mensagem de abordagem aberta no WhatsApp."),
    };
    await atualizarCamposEmpresa(atual.id, campos);
    setEmpresas((lista) => lista.map((e) => e.id === atual.id ? { ...e, ...campos } : e));

    const url = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagemPreparada)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setStatus(imagemCopiada
      ? "WhatsApp aberto com texto. A imagem foi copiada: use Ctrl+V no WhatsApp e revise antes de enviar."
      : "WhatsApp aberto com texto. Se precisar da imagem, use Baixar imagem ou selecione uma imagem compatÃ­vel.");
  }

  async function copiarMensagem() {
    await navigator.clipboard.writeText(mensagemPreparada);
    setStatus("Mensagem copiada.");
  }

  async function confirmarEnvio(criarFollowup) {
    if (!atual) return;
    const dadosFunil = dadosFunilAposEnvio(atual);
    const campos = {
      abordagem_status: "envio_confirmado",
      ultimo_contato: new Date().toISOString(),
      ...(dadosFunil.status ? { status: dadosFunil.status, etapa_funil: dadosFunil.etapa_funil } : {}),
    };
    if (criarFollowup) {
      campos.proximo_followup = followupSugerido;
      campos.followup_status = "pendente";
    }
    campos.historico_atividades = adicionarHistoricoEmpresa(
      atual,
      "Abordagem enviada",
      criarFollowup
        ? `Envio confirmado com follow-up em ${followupSugerido}. ${dadosFunil.detalhe}`
        : `Envio confirmado sem follow-up. ${dadosFunil.detalhe}`
    );
    await atualizarCamposEmpresa(atual.id, campos);
    setEmpresas((lista) => lista.map((e) => e.id === atual.id ? { ...e, ...campos } : e));
    setStatus("Envio confirmado no CRM. AvanÃ§ando para o prÃ³ximo lead.");
    const novaFila = idsPendentesDaFila(filaIds.filter((id) => id !== atual.id), empresas.map((e) => e.id === atual.id ? { ...e, ...campos } : e));
    setFilaIds(novaFila);
    salvarFila(campanhaId, novaFila);

    if (!novaFila.length) {
      const ativa = campanhaId || obterCampanhaAtiva();
      const dadosAtualizados = await listarEmpresas(ativa ? { lista_id: ativa } : {});
      const totalFinalizado = totalFilaCriada || fila.length || 1;
      const acao = criarFollowup
        ? `mensagens marcadas como enviadas e follow-up criado para ${formatarData(followupSugerido)}`
        : "mensagens marcadas como enviadas sem follow-up";
      setEmpresas(dadosAtualizados);
      setIndice(0);
      setTotalFilaCriada(0);
      const mensagemFinal = `Parabens! ${totalFinalizado} lead(s) finalizados. Acao tomada: ${acao}.`;
      setStatus(mensagemFinal);
      notificar(mensagemFinal, "Acao finalizada");
      setConclusao({
        titulo: "Acao finalizada",
        total: totalFinalizado,
        acao,
        data: criarFollowup ? formatarData(followupSugerido) : "",
      });
      return;
    }

    setStatus(`Envio confirmado no CRM. Restam ${novaFila.length} lead(s) na fila.`);
    setIndice((i) => Math.min(i, Math.max(novaFila.length - 1, 0)));
  }

  async function marcar(statusLead) {
    if (!atual) return;
    const campos = {
      abordagem_status: statusLead,
      historico_atividades: adicionarHistoricoEmpresa(atual, "Abordagem marcada", `Status da abordagem: ${statusLead}.`),
    };
    await atualizarCamposEmpresa(atual.id, campos);
    const empresasAtualizadas = empresas.map((e) => e.id === atual.id ? { ...e, ...campos } : e);
    const novaFila = idsPendentesDaFila(filaIds.filter((id) => id !== atual.id), empresasAtualizadas);
    setEmpresas(empresasAtualizadas);
    setFilaIds(novaFila);
    salvarFila(campanhaId, novaFila);

    if (!novaFila.length) {
      setIndice(0);
      setTotalFilaCriada(0);
      const acao = `status marcado como ${statusLead}`;
      setStatus("Fila finalizada. Todas as acoes foram registradas no CRM.");
      notificar(`Fila finalizada. Ultima acao: ${acao}.`, "Fila finalizada");
      setConclusao({
        titulo: "Fila finalizada",
        total: totalFilaCriada || fila.length || 1,
        acao,
        data: "",
      });
      return;
    }

    setStatus(`Acao registrada. Restam ${novaFila.length} lead(s) na fila.`);
    setIndice((i) => Math.min(i, Math.max(novaFila.length - 1, 0)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 800 }}>Abordagens</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>Prepare texto e imagem uma vez. Trabalhe um lead por vez, sem disparo automÃ¡tico.</p>
      </div>

      <div className="glass-panel" style={{ padding: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)" }}>Campanha da abordagem</label>
        <select value={campanhaId} onChange={(e) => trocarCampanha(e.target.value)} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid var(--panel-border)", background: "#fff" }}>
          <option value="">Todas as campanhas</option>
          {campanhas.map((campanha) => <option key={campanha.id} value={campanha.id}>{campanha.nome}</option>)}
        </select>
      </div>

      {status && <div className="glass-panel" style={{ padding: 12, color: "var(--primary)", fontWeight: 700 }}>{status}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 16, alignItems: "start" }}>
        <section className="glass-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <h3>Modelo de abordagem</h3>
          <input value={modelo.nome} onChange={(e) => setModelo({ ...modelo, nome: e.target.value })} placeholder="Nome do modelo" style={{ padding: 10, border: "1px solid var(--panel-border)", borderRadius: 8 }} />
          <textarea value={modelo.mensagem} onChange={(e) => setModelo({ ...modelo, mensagem: e.target.value })} style={{ minHeight: 160, padding: 10, border: "1px solid var(--panel-border)", borderRadius: 8 }} />
          <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>VariÃ¡veis: {"{{empresa}}"}, {"{{contato}}"}, {"{{nicho}}"}, {"{{cidade}}"}, {"{{bairro}}"}, {"{{responsavel}}"}</p>
          <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={onImagem} />
          {modelo.imagemDataUrl && (
            <div>
              <Image src={modelo.imagemDataUrl} alt="Imagem da abordagem" width={640} height={360} unoptimized style={{ width: "100%", maxHeight: 220, objectFit: "contain", border: "1px solid var(--panel-border)", borderRadius: 8 }} />
              <Botao tipo="outline" onClick={() => setModelo({ ...modelo, imagemNome: "", imagemDataUrl: "" })}>Remover imagem</Botao>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "var(--text-secondary)", fontSize: 12, fontWeight: 800 }}>
              Leads nesta rodada
              <input
                type="number"
                min="1"
                max={Math.max(candidatosComWhatsApp.length, 1)}
                value={tamanhoRodada}
                onChange={(e) => setTamanhoRodada(e.target.value)}
                style={{ padding: 10, border: "1px solid var(--panel-border)", borderRadius: 8, color: "var(--text-primary)" }}
              />
            </label>
            <Botao tipo="outline" onClick={() => criarRodada(false)} disabled={!candidatosComWhatsApp.length}>Criar rodada</Botao>
          </div>
          <Botao tipo="outline" onClick={() => criarRodada(true)} disabled={!candidatosComWhatsApp.length}>
            Criar rodada com todos os leads da campanha
          </Botao>
          <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>
            A campanha nao tem limite. Este numero controla apenas quantos leads entram na fila de trabalho agora.
          </p>
        </section>

        <section className="glass-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h3>Fila de prospecÃ§Ã£o</h3>
            <strong>{fila.length ? `${indice + 1} de ${fila.length}` : "0 de 0"}</strong>
          </div>

          {!atual ? (
            <p style={{ color: "var(--text-secondary)" }}>Selecione empresas na aba Empresas e clique em Criar abordagem, ou crie uma rodada automatica com os leads da campanha atual.</p>
          ) : (
            <>
              <div style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 12 }}>
                <h3 style={{ marginBottom: 4 }}>{atual.nome}</h3>
                <p style={{ color: "var(--text-secondary)" }}>{atual.whatsapp || "sem WhatsApp"} Â· {atual.nicho || "Geral"} Â· {atual.cidade || "Uberlandia"}</p>
                <p style={{ color: "var(--text-secondary)" }}>Etapa: {atual.etapa_funil || atual.status || "Novo lead"} Â· Status abordagem: {atual.abordagem_status || "pendente"}</p>
              </div>

              <textarea readOnly value={mensagemPreparada} style={{ minHeight: 140, padding: 10, border: "1px solid var(--panel-border)", borderRadius: 8, background: "#fff" }} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                <Botao onClick={prepararWhatsApp}>Preparar WhatsApp</Botao>
                <Botao tipo="outline" onClick={copiarMensagem}>Copiar mensagem</Botao>
                {modelo.imagemDataUrl && <a download={modelo.imagemNome || "abordagem.png"} href={modelo.imagemDataUrl} style={{ textDecoration: "none" }}><Botao tipo="outline">Baixar imagem</Botao></a>}
                <Botao tipo="outline" onClick={() => setIndice((i) => Math.max(0, i - 1))}>Lead anterior</Botao>
                <Botao tipo="outline" onClick={proximoLead}>{indice >= fila.length - 1 ? "Finalizar fila" : "Proximo lead"}</Botao>
                <Botao tipo="danger" onClick={removerAtual}>Remover da fila</Botao>
              </div>

              <div className="glass-panel" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <strong>VocÃª enviou esta abordagem?</strong>
                <label style={{ color: "var(--text-secondary)" }}>Follow-up sugerido</label>
                <input type="date" value={followupSugerido} onChange={(e) => setFollowupSugerido(e.target.value)} style={{ padding: 10, border: "1px solid var(--panel-border)", borderRadius: 8 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                  <Botao onClick={() => confirmarEnvio(true)}>Sim, enviei e criar follow-up</Botao>
                  <Botao tipo="outline" onClick={() => confirmarEnvio(false)}>Sim, enviei sem follow-up</Botao>
                  <Botao tipo="outline" onClick={() => marcar("voltar_depois")}>Voltar depois</Botao>
                  <Botao tipo="outline" onClick={() => marcar("numero_invalido")}>NÃºmero invÃ¡lido</Botao>
                  <Botao tipo="danger" onClick={() => marcar("ignorado")}>NÃ£o abordar</Botao>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <Modal aberto={Boolean(conclusao)} titulo={conclusao?.titulo || "Acao finalizada"} aoFechar={() => setConclusao(null)}>
        {conclusao && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ border: "1px solid #bbf7d0", background: "var(--success-soft)", borderRadius: 8, padding: 18 }}>
              <h3 style={{ color: "var(--primary)", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
                Parabens, acao finalizada.
              </h3>
              <p style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>
                {conclusao.total} lead(s) processado(s).
              </p>
            </div>

            <div style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 14 }}>
              <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Acao tomada</div>
              <div style={{ color: "var(--text-primary)", fontWeight: 700, marginTop: 6 }}>{conclusao.acao}</div>
              {conclusao.data && (
                <div style={{ color: "var(--text-secondary)", marginTop: 8 }}>Data do follow-up: {conclusao.data}</div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Botao onClick={() => { setConclusao(null); window.location.href = "/painel/followups"; }}>
                Ver follow-ups
              </Botao>
              <Botao tipo="outline" onClick={() => setConclusao(null)}>
                Fechar
              </Botao>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
