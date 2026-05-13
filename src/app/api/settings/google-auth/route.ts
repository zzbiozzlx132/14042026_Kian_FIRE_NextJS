import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type GoogleConfigPayload = {
  client_id?: string;
  client_secret?: string;
  project_id?: string;
  redirect_uris?: string[];
};

function requireAdmin(session: any) {
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Admin được cấu hình" }, { status: 403 });
  }
  return null;
}

function mask(value: string) {
  if (!value) return "";
  if (value.length <= 10) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function extractGooglePayload(raw: any): GoogleConfigPayload | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.web && typeof raw.web === "object") return raw.web as GoogleConfigPayload;
  if (raw.installed && typeof raw.installed === "object") return raw.installed as GoogleConfigPayload;
  if (raw.client_id || raw.client_secret) return raw as GoogleConfigPayload;
  return null;
}

function inferCallbackUrl(req: Request) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "").trim();
  if (appUrl) return `${appUrl.replace(/\/$/, "")}/api/auth/callback/google`;
  try {
    const u = new URL(req.url);
    return `${u.origin}/api/auth/callback/google`;
  } catch {
    return "/api/auth/callback/google";
  }
}

export async function GET(req: Request) {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const settings = await prisma.lifePlanSettings.findUnique({
    where: { id: "default" },
    select: {
      googleClientId: true,
      googleProjectId: true,
      googleConfigUpdatedAt: true,
    },
  });

  const envEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const dbEnabled = Boolean(settings?.googleClientId);
  const callbackUrl = inferCallbackUrl(req);

  return NextResponse.json({
    enabled: envEnabled || dbEnabled,
    source: envEnabled ? "ENV" : dbEnabled ? "SETTINGS_JSON" : "NONE",
    clientIdMasked: settings?.googleClientId ? mask(settings.googleClientId) : "",
    projectId: settings?.googleProjectId || "",
    updatedAt: settings?.googleConfigUpdatedAt?.toISOString() || null,
    callbackUrl,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file JSON" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".json")) {
    return NextResponse.json({ error: "Vui lòng upload file .json" }, { status: 400 });
  }

  const text = await file.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "File JSON không hợp lệ" }, { status: 400 });
  }

  const payload = extractGooglePayload(parsed);
  const clientId = String(payload?.client_id || "").trim();
  const clientSecret = String(payload?.client_secret || "").trim();
  const projectId = String(payload?.project_id || "").trim();
  const redirectUris = Array.isArray(payload?.redirect_uris) ? payload?.redirect_uris.filter(Boolean) : [];

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Không tìm thấy client_id hoặc client_secret trong file. Hãy upload JSON OAuth Client từ Google Cloud." },
      { status: 400 },
    );
  }

  await prisma.lifePlanSettings.upsert({
    where: { id: "default" },
    update: {
      googleClientId: clientId,
      googleClientSecret: clientSecret,
      googleProjectId: projectId || null,
      googleConfigUpdatedAt: new Date(),
    },
    create: {
      id: "default",
      googleClientId: clientId,
      googleClientSecret: clientSecret,
      googleProjectId: projectId || null,
      googleConfigUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    source: "SETTINGS_JSON",
    clientIdMasked: mask(clientId),
    projectId: projectId || "",
    callbackUrl: inferCallbackUrl(req),
    redirectUris,
  });
}

export async function DELETE() {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  await prisma.lifePlanSettings.upsert({
    where: { id: "default" },
    update: {
      googleClientId: null,
      googleClientSecret: null,
      googleProjectId: null,
      googleConfigUpdatedAt: null,
    },
    create: {
      id: "default",
    },
  });

  return NextResponse.json({ ok: true });
}
