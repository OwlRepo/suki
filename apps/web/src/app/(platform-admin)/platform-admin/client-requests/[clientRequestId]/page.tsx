import { PlatformAdminClientRequestDetailPage } from "@/components/platform-admin/client-requests/platform-admin-client-request-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ clientRequestId: string }>;
}) {
  const { clientRequestId } = await params;
  return (
    <PlatformAdminClientRequestDetailPage
      clientRequestId={clientRequestId}
    />
  );
}
