"use client";
import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "../../servicos/firebase_config";
import { signInWithEmailAndPassword } from "firebase/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/painel/campanhas";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (carregando) return;
    
    setCarregando(true);
    setMensagemErro("");

    try {
      // 1. Autenticação no Firebase Client SDK
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      
      // 2. Obtém o ID Token (JWT)
      const idToken = await userCredential.user.getIdToken();

      // 3. Envia o ID Token para o Route Handler administrativo para criar a sessão segura
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        const errData = await res.json();
        // Desloga do Firebase se a sessão no servidor falhar (ex: falta claim admin)
        await auth.signOut();
        throw new Error(errData.message || "Acesso negado pelo servidor.");
      }

      // 4. Redirecionamento bem-sucedido
      router.push(redirectPath);
      router.refresh();

    } catch (err) {
      console.error("Erro na autenticação administrativa:", err);
      // Mapeamento de mensagens amigáveis e seguras
      let msg = "Credenciais incorretas ou acesso não autorizado.";
      if (err.message.includes("Acesso negado")) {
        msg = "Usuário autenticado não possui permissão de administrador.";
      } else if (err.message.includes("Too Many Requests") || err.message.includes("429")) {
        msg = "Muitas tentativas malsucedidas. Por favor, tente novamente mais tarde.";
      }
      setMensagemErro(msg);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      background: "linear-gradient(180deg, #f8fafc 0%, #dcfce7 100%)",
      padding: "20px",
      fontFamily: "var(--font-sans, sans-serif)",
    }}>
      <div 
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          animation: "fadeIn 0.4s ease",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          border: "1px solid var(--panel-border)"
        }}
      >
        {/* LOGO */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "6px" }}>
          <h1 className="text-gradient" style={{ fontSize: "28px", fontWeight: "900", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            CRM ZAP
          </h1>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>
            Prospeccao com WhatsApp manual
          </span>
        </div>

        {/* MENSAGEM DE ERRO */}
        {mensagemErro && (
          <div 
            role="alert"
            style={{
              padding: "12px 16px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "8px",
              color: "var(--danger)",
              fontSize: "13px",
              lineHeight: "1.4"
            }}
          >
            ⚠️ {mensagemErro}
          </div>
        )}

        {/* FORMULÁRIO */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          
          {/* E-MAIL */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="login-email" style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>
              E-mail do Administrador
            </label>
            <input 
              id="login-email"
              type="email"
              required
              autoComplete="username"
              placeholder="admin@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={carregando}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "#ffffff",
                border: "1px solid var(--panel-border)",
                borderRadius: "8px",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
              onBlur={(e) => e.target.style.borderColor = "var(--panel-border)"}
            />
          </div>

          {/* SENHA */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="login-password" style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>
                Senha de Acesso
              </label>
            </div>
            <input 
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={carregando}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "#ffffff",
                border: "1px solid var(--panel-border)",
                borderRadius: "8px",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
              onBlur={(e) => e.target.style.borderColor = "var(--panel-border)"}
            />
          </div>

          {/* BOTÃO */}
          <button 
            type="submit"
            disabled={carregando}
            style={{
              padding: "14px",
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "opacity 0.2s, transform 0.1s",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px"
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            {carregando ? "Autenticando..." : "Entrar no Painel ➔"}
          </button>

        </form>

      </div>
    </div>
  );
}

export default function PaginaLogin() {
  return (
    <Suspense fallback={
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #dcfce7 100%)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans, sans-serif)"
      }}>
        🔄 Carregando tela de acesso...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
