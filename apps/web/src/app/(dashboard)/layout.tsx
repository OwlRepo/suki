import { ReactNode } from "react";
import Link from "next/link";
import { AuthButton } from "@/components/auth-button";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="text-lg font-semibold text-foreground">
            Suki
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/customers" className="text-sm text-muted-foreground hover:text-foreground">
              Customers
            </Link>
            <Link href="/appointments" className="text-sm text-muted-foreground hover:text-foreground">
              Appointments
            </Link>
            <Link href="/promos" className="text-sm text-muted-foreground hover:text-foreground">
              Promos
            </Link>
            <Link href="/insights" className="text-sm text-muted-foreground hover:text-foreground">
              Insights
            </Link>
            <Link href="/loyalty" className="text-sm text-muted-foreground hover:text-foreground">
              Loyalty
            </Link>
            <Link href="/imports" className="text-sm text-muted-foreground hover:text-foreground">
              Import
            </Link>
            <Link href="/setup" className="text-sm text-muted-foreground hover:text-foreground">
              Setup
            </Link>
            <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
              Settings
            </Link>
            <AuthButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
