import { redirect } from "next/navigation";

/**
 * Página raiz do projeto.
 * Redireciona para /login — o proxy encaminha automaticamente usuários
 * já autenticados (com cookie __session válido) para /painel/dashboard.
 */
export default function Home() {
  redirect("/painel/campanhas");
}
