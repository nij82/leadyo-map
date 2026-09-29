import { serverClient } from "@/lib/supabase/server";
import { Explorer } from "@/components/explorer";
import type { Project, Listing, ApplyhomeDetails } from "@/lib/types";
import { localRtReferences } from "@/lib/rt-reference.local";
import { displayProjectName } from "@/lib/project-name";
import {
  classifySupplyStatus,
  nextSalesSchedule,
  todayInKorea,
} from "@/lib/project-schedule";
export default async function Home() {
  const c = await serverClient();
  const today = todayInKorea();
  let projects: Project[] = [],
    listings: Listing[] = [],
    failed = false;
  if (c) {
    for (let offset = 0; ; offset += 1000) {
      const p = await c
        .from("projects")
        .select(
          "id,name,address,latitude,longitude,units,types,price,move_in,deposit,interim,builder,published,showroom_address,product_details,applyhome_summary,applyhome_details",
        )
        .eq("published", true)
        .order("name")
        .order("id")
        .range(offset, offset + 999);
      if (p.error) {
        failed = true;
        break;
      }
      projects.push(
        ...(p.data || []).map((row) => {
          const { applyhome_details, ...project } = row as Project & {
            applyhome_details: ApplyhomeDetails | null;
          };
          return {
            ...project,
            name: displayProjectName(project.name),
            next_schedule: nextSalesSchedule(applyhome_details, today),
            supply_status: classifySupplyStatus(
              applyhome_details,
              project.applyhome_summary,
              today,
            ),
          };
        }),
      );
      if (!p.data || p.data.length < 1000) break;
    }
    for (let offset = 0; ; offset += 1000) {
      const j = await c
        .from("listings")
        .select("*")
        .eq("status", "published")
        .eq("moderation", "visible")
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 999);
      if (j.error) {
        failed = true;
        break;
      }
      listings.push(...(j.data || []));
      if (!j.data || j.data.length < 1000) break;
    }
  }
  return (
    <Explorer
      projects={projects}
      listings={listings}
      available={!!c && !failed}
      rtReferences={
        process.env.NODE_ENV === "development" ? localRtReferences : []
      }
    />
  );
}
