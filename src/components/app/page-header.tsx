import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MobileMenu } from "./mobile-menu";

export function PageHeader({
  title,
  description,
  back,
  actions,
  showSettings = false,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: string;
  actions?: React.ReactNode;
  showSettings?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("mb-5 flex items-start gap-2", className)}>
      {back && (
        <Button variant="ghost" size="icon" className="-ml-2 shrink-0" asChild>
          <Link href={back} aria-label="戻る">
            <ChevronLeft className="size-6" />
          </Link>
        </Button>
      )}
      <div className="min-w-0 flex-1 pt-1">
        <h1 className="truncate text-[22px] leading-tight font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        {showSettings && <MobileMenu />}
      </div>
    </header>
  );
}
