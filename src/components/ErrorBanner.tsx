"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

/**
 * Single reusable error state for list fetches (admin + client pages).
 * Shown on ANY non-OK response — 503 (DB outage) AND 500 (code bug): the user
 * must never face a silent empty screen in either case. The retry button
 * re-runs the originating fetch (hook `retry` or local reload).
 */
export default function ErrorBanner({ isFr, onRetry }: { isFr: boolean; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-800 dark:text-amber-400"
    >
      <span className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {isFr
          ? "Service indisponible — réessayez dans un instant."
          : "Service unavailable — please try again in a moment."}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 font-semibold hover:underline shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {isFr ? "Réessayer" : "Retry"}
        </button>
      )}
    </div>
  );
}
