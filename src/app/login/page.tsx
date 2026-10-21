import { redirect } from "next/navigation";

export const metadata = { robots: { index: false, follow: false } };

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const returnTo = params?.returnTo ? `&returnTo=${encodeURIComponent(params.returnTo)}` : "";
  redirect(`/?login=1${returnTo}`);
}
