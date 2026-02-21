"use client";

import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";

export function PipelineNavLink({
  className,
  children = "Pipeline",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const workspace = useWorkspace();
  const activeBiz = workspace?.businesses.find(
    (b) => b.id === workspace.activeBusinessId
  );
  if (!activeBiz || activeBiz.crmMode !== "full") return null;
  return (
    <Link href="/pipeline" className={className}>
      {children}
    </Link>
  );
}
