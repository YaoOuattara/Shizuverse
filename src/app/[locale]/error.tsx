"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const isFr = locale === "fr";

  useEffect(() => {
    // Log full detail so it's readable in Vercel Functions logs and browser console
    console.error("[error-boundary] message:", error?.message);
    console.error("[error-boundary] stack:", error?.stack);
    console.error("[error-boundary] digest:", error?.digest);
    console.error("[error-boundary] full:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-semibold text-foreground">
        {isFr ? "Une erreur est survenue" : "Something went wrong"}
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {isFr
          ? "Veuillez réessayer. Si le problème persiste, contactez le support."
          : "Please try again. If the problem persists, contact support."}
      </p>

      {/* Error detail — visible on the page so we can diagnose without DevTools */}
      {error?.message && (
        <details className="max-w-lg w-full text-left">
          <summary className="text-xs text-muted-foreground cursor-pointer select-none">
            {isFr ? "Détail de l'erreur" : "Error detail"}
          </summary>
          <pre className="mt-2 rounded-md bg-muted px-4 py-3 text-xs text-destructive whitespace-pre-wrap break-all overflow-auto max-h-48">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        </details>
      )}

      <div className="flex gap-3">
        <Button onClick={reset}>
          {isFr ? "Réessayer" : "Try again"}
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = `/${locale}`)}>
          {isFr ? "Accueil" : "Home"}
        </Button>
      </div>
    </div>
  );
}
