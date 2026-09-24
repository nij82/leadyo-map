/// <reference types="navermaps" />
"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";
export function NaverMap({
  projects,
  onSelect,
}: {
  projects: Project[];
  onSelect: (p: Project) => void;
}) {
  const key = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const host = useRef<HTMLDivElement>(null),
    map = useRef<naver.maps.Map | null>(null),
    select = useRef(onSelect);
  select.current = onSelect;
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ready || !host.current || typeof naver === "undefined") return;
    const m = new naver.maps.Map(host.current, {
      center: new naver.maps.LatLng(36.4, 127.5),
      zoom: 7,
      zoomControl: true,
    });
    map.current = m;
    return () => {
      m.destroy();
      map.current = null;
    };
  }, [ready]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    let pins: naver.maps.Marker[] = [];
    let events: naver.maps.MapEventListener[] = [];
    function draw() {
      pins.forEach((p) => p.setMap(null));
      events.forEach((e) => naver.maps.Event.removeListener(e));
      pins = [];
      events = [];
      const groups: { point: naver.maps.Point; items: Project[] }[] = [];
      for (const p of projects) {
        const point = m!
          .getProjection()
          .fromCoordToOffset(new naver.maps.LatLng(p.latitude, p.longitude));
        const group = groups.find(
          (g) => Math.hypot(g.point.x - point.x, g.point.y - point.y) < 65,
        );
        if (group) group.items.push(p);
        else groups.push({ point, items: [p] });
      }
      for (const group of groups) {
        const p = group.items[0],
          multiple = group.items.length > 1;
        const marker = new naver.maps.Marker({
          map: m!,
          position: new naver.maps.LatLng(p.latitude, p.longitude),
          title: multiple ? `${group.items.length}개 현장 확대` : p.name,
          icon: {
            content: `<div class="map-marker">${multiple ? "현장 " + group.items.length : "구인정보"}</div>`,
            anchor: new naver.maps.Point(35, 30),
          },
        });
        pins.push(marker);
        events.push(
          naver.maps.Event.addListener(marker, "click", () => {
            if (!multiple) {
              select.current(p);
              return;
            }
            const bounds = new naver.maps.LatLngBounds(
              new naver.maps.LatLng(p.latitude, p.longitude),
              new naver.maps.LatLng(p.latitude, p.longitude),
            );
            group.items.forEach((x) =>
              bounds.extend(new naver.maps.LatLng(x.latitude, x.longitude)),
            );
            m!.fitBounds(bounds);
            if (m!.getZoom() >= 20) select.current(p);
          }),
        );
      }
    }
    draw();
    const listener = naver.maps.Event.addListener(m, "idle", draw);
    return () => {
      naver.maps.Event.removeListener(listener);
      pins.forEach((p) => p.setMap(null));
      events.forEach((e) => naver.maps.Event.removeListener(e));
    };
  }, [projects, ready]);
  return (
    <>
      <div ref={host} className="naver-map" aria-label="현장 지도" />
      {key && (
        <Script
          src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}`}
          onReady={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      )}{" "}
      {(!key || failed || !ready) && (
        <div className="map-fallback">
          <strong>
            {failed
              ? "지도를 불러오지 못했습니다"
              : key
                ? "지도를 불러오는 중입니다"
                : "지도 서비스를 준비하고 있습니다"}
          </strong>
          <p>현장 정보는 연결이 완료된 후 지도에 표시됩니다.</p>
          {failed && (
            <button onClick={() => location.reload()}>다시 시도</button>
          )}
        </div>
      )}
    </>
  );
}
