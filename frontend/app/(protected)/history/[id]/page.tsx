export const metadata = { title: "Saved description" };
export const instant = false;
import { History } from "@/components/history";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();
  return <History key={id} id={id} />;
}
