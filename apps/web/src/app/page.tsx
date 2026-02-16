import { AuthCta } from "@/components/auth-cta";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background font-sans">
      <main className="flex flex-col items-center gap-6 px-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Suki
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Customer engagement for Philippine small business. Capture customers,
          send follow-ups, and grow repeat visits.
        </p>
        <AuthCta />
      </main>
    </div>
  );
}
