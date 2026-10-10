import { notFound } from "next/navigation";
import { NaverLocationMap } from "@/features/post/components/naver-location-map";
import { buildNaverMapEmbed, parseNaverMapEmbed } from "@/features/post/naver-map";
export default async function NaverMapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (["lat", "lng", "label"].some(key => typeof params[key] !== "string")) notFound();
  const src = buildNaverMapEmbed({ latitude: Number(params.lat), longitude: Number(params.lng), label: params.label as string });
  const location = src && parseNaverMapEmbed(src);
  if (!location || !(params.lat as string).trim() || !(params.lng as string).trim()) notFound();
  return <NaverLocationMap location={location}/>;
}
