import { PlatformAdminBusinessDetailPage } from "@/components/platform-admin/businesses/platform-admin-business-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <PlatformAdminBusinessDetailPage organizationId={organizationId} />;
}
