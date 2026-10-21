import { NextResponse, type NextRequest } from "next/server.js";

export function proxy(request: NextRequest) {
  const url = new URL(request.url);
  if (url.hostname === "pebble-log.com") {
    url.protocol = "https:";
    url.hostname = "www.pebble-log.com";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  // 개발 전용 입력 화면은 운영에서 스트리밍 시작 전에 차단한다.
  return process.env.NODE_ENV === "development"
    ? NextResponse.next()
    : new NextResponse(null, { status: 404 });
}

export const config = { matcher: [
  {source: "/:path*", has: [{type: "host", value: "pebble-log\\.com"}]},
  "/dev/:path*",
] };
