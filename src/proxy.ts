import { NextResponse } from "next/server";

// 개발 전용 입력 화면은 운영에서 스트리밍 시작 전에 차단한다.
export function proxy() {
  return process.env.NODE_ENV === "development"
    ? NextResponse.next()
    : new NextResponse(null, { status: 404 });
}

export const config = { matcher: ["/dev/:path*"] };
