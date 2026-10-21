import { getCloudflareContext } from "@opennextjs/cloudflare";
export const dynamic = "force-dynamic";
export async function GET() {
  let clientId = process.env.NAVER_MAP_CLIENT_ID || "";
  if (!clientId && process.env.NODE_ENV === "production") {
    try {
      const { env } = await getCloudflareContext({ async: true });
      clientId = (env as unknown as { NAVER_MAP_CLIENT_ID?: string }).NAVER_MAP_CLIENT_ID || "";
    } catch { /* Cloudflare 외의 로컬 운영 빌드에서는 환경변수를 사용한다. */ }
  }
  // 지도용 공개 ID만 반환하며 Client Secret은 읽거나 전달하지 않는다.
  return Response.json({ clientId }, { headers: { "Cache-Control": "no-store" } });
}
