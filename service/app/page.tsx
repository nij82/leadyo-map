import { serverClient } from "@/lib/supabase/server";
import { Explorer } from "@/components/explorer";
import type { Project, Listing } from "@/lib/types";
export default async function Home() {
  const c = await serverClient();
  let projects: Project[] = [],
    listings: Listing[] = [],
    failed = false;
  if (c) {
    const [p, j] = await Promise.all([
      c
        .from("projects")
        .select("*")
        .eq("published", true)
        .order("name")
        .limit(1000),
      c
        .from("listings")
        .select("*")
        .eq("status", "published")
        .eq("moderation", "visible")
        .limit(1000),
    ]);
    failed = !!(p.error || j.error);
    projects = p.data || [];
    listings = j.data || [];
  }
  return (
    <Explorer
      projects={projects}
      listings={listings}
      available={!!c && !failed}
    />
  );
}
