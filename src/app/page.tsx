import Image from "next/image";

export default function HomePage() {
  return (
    <main className="welcome">
      <div className="brand">
        <Image src="/pebble-logo.svg" alt="" width={44} height={44} priority />
        <span>Pebble</span>
      </div>
      <h1>개발자의 기록을 만나다</h1>
      <p>코드와 경험, 프로젝트의 과정을 함께 나눠요.</p>
    </main>
  );
}
