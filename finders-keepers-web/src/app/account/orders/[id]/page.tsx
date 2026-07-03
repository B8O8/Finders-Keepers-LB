import { AccountOrderDetailsPage } from "@/features/account/account-order-details-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AccountOrderDetailsPage id={id} />;
}