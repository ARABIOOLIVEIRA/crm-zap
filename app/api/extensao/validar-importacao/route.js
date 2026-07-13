import { NextResponse } from "next/server";
import {
  autorizado,
  encontrarContato,
  encontrarEmpresa,
  normalizarPayload,
  validarPayload,
} from "../_helpers";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    if (!autorizado(request)) {
      return NextResponse.json({ status: "error", message: "Nao autorizado." }, { status: 401 });
    }

    const payload = normalizarPayload(await request.json());
    const errors = validarPayload(payload);
    if (errors.length) {
      return NextResponse.json({ status: "error", message: errors.join("\n"), errors }, { status: 400 });
    }

    const empresa = await encontrarEmpresa(payload);
    const contato = await encontrarContato(payload);
    const matchMessage = empresa && contato
      ? "Empresa e contato existentes encontrados."
      : empresa
        ? "Empresa existente encontrada. Contato sera criado ou atualizado."
        : contato
          ? "Contato existente encontrado. Empresa pode ser criada/vinculada."
          : "Nenhum cadastro correspondente encontrado. Pronto para criar novo registro.";

    return NextResponse.json({
      status: "success",
      valid: true,
      empresaExistente: empresa ? { id: empresa.id, nome: empresa.data().nome } : null,
      contatoExistente: contato ? { id: contato.id, nome: contato.data().nome } : null,
      matchMessage,
      totalMensagens: payload.conversation.messages.length,
    });
  } catch (erro) {
    console.error("[Extensao validar]", erro);
    return NextResponse.json({ status: "error", message: "Erro ao validar importacao." }, { status: 500 });
  }
}
