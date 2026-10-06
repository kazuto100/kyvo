import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap [&>svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-secondary text-secondary-foreground",
        blue: "bg-brand-soft text-brand",
        amber: "bg-warn-soft text-warn",
        green: "bg-profit-soft text-profit",
        violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
        red: "bg-loss-soft text-loss",
        gray: "bg-muted text-muted-foreground",
        outline: "border text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Badge({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
