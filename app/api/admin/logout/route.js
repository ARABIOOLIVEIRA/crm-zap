import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function executarLogout() {
  const response = NextResponse.json({
    status: "success",
    message: "Logout efetuado com sucesso.",
  });

  response.cookies.set("__session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}

export async function GET() {
  return executarLogout();
}

export async function POST() {
  return executarLogout();
}