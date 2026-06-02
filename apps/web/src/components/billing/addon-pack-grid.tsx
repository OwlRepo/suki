"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AddonPackGrid({
  title,
  items,
  loadingKey,
  onCheckout,
}: {
  title: string;
  items: Array<{ sku: string; label: string; pricePhp: number }>;
  loadingKey: string | null;
  onCheckout: (sku: string) => void;
}) {
  return (
    <section>
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item.sku} className="border border-border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">PHP {item.pricePhp.toLocaleString("en-PH")}</p>
              </div>
              <Button
                type="button"
                disabled={loadingKey === item.sku}
                aria-label={`Buy ${item.label}`}
                onClick={() => onCheckout(item.sku)}
              >
                {loadingKey === item.sku ? "Preparing checkout..." : "Buy"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
