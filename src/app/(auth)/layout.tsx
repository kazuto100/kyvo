import { APP_CONFIG } from "@/config/app";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-primary-foreground shadow-lg">
            {APP_CONFIG.name.slice(0, 1)}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{APP_CONFIG.name}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{APP_CONFIG.tagline}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
