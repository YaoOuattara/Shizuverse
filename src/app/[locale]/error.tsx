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
    console.error("[error-boundary]", error);
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
