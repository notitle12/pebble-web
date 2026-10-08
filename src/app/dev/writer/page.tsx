import { notFound } from "next/navigation";
import { WriterPreview } from "@/features/post/components/writer-preview";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main className="page-shell writer-shell"><WriterPreview/></main>;
}
