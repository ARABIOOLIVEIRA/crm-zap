/** @type {import('next').NextConfig} */
const nextConfig = {
  // Impede o Turbopack/Next.js de empacotar firebase-admin e suas
  // dependências ESM-only (jose, jwks-rsa), forçando carregamento
  // nativo pelo Node.js e evitando ERR_REQUIRE_ESM em produção.
  serverExternalPackages: [
    "firebase-admin",
    "firebase-admin/app",
    "firebase-admin/auth",
    "firebase-admin/firestore",
    "jwks-rsa",
    "jose",
  ],
};

export default nextConfig;
