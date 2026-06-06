import { PlatformAdminBillingRequestDetailPage } from "@/components/platform-admin/billing/platform-admin-billing-request-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ billingRequestId: string }>;
}) {
  const { billingRequestId } = await params;
  return (
    <PlatformAdminBillingRequestDetailPage billingRequestId={billingRequestId} />
  );
}
