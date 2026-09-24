import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const destination = new URL(process.env.APP_ORIGIN || request.url);
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  if (code) {
    const client = await serverClient();
    if (client) {
      const { error } = await client.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );
      if (!error) {
        destination.pathname = "/account";
        destination.search = "";
        return NextResponse.redirect(destination);
      }
    }
  }
  destination.pathname = "/login";
  destination.search = "?error=link";
  return NextResponse.redirect(destination);
}
