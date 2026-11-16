import { Workspace } from "@/components/workspace";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ compose?: string }>;
}) {
  const { id } = await params;
  const { compose } = await searchParams;
  return <Workspace id={id} openAssistant={compose === "1"} />;
}
