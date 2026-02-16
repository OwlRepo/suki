import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome. Set up your business to get started, or explore the modules.
      </p>
      <div className="mt-6 flex gap-4">
        <Button asChild>
          <Link href="/setup">Business setup</Link>
        </Button>
      </div>
    </div>
  );
}
