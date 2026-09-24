import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server Components cannot set cookies; proxy refreshes them. */
        }
      },
    },
  });
}
export async function identity() {
  const client = await serverClient();
  if (!client) return { client: null, user: null, profile: null, admin: false };
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { client, user: null, profile: null, admin: false };
  const [{ data: profile }, { data: admin }] = await Promise.all([
    client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    client.rpc("am_i_admin"),
  ]);
  return { client, user, profile, admin: admin === true };
}
