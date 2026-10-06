import { AppNav } from "@/components/app/app-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:pl-60">
      <AppNav />
      <main className="mx-auto w-full max-w-5xl px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
        {children}
      </main>
    </div>
  );
}
