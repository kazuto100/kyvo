import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/constants";
import type { ProductStatus } from "@/lib/types";

export function StatusBadge({ status, className }: { status: ProductStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}
