"use client";
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL || "https://shizu-verse.onrender.com";

interface ApiSubcategory {
  id: number;
  name: string;
  name_fr: string;
  name_en: string;
  service_id: number | null;
}

interface ApiCategory {
  id: number;
  name: string;
  name_fr: string;
  name_en: string;
  description: string;
  subcategories: ApiSubcategory[];
}

function displayName(
  item: { name: string; name_fr?: string; name_en?: string },
  locale: string
) {
  return locale === "fr"
    ? item.name_fr || item.name
    : item.name_en || item.name;
}

export const ServiceList = () => {
  const t = useTranslations("services");
  const locale = useLocale();
  const router = useRouter();

  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApiCategory | null>(null);

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>{t("loading")}</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">{t("title")}</h2>

      {categories.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          {/* ── Category grid ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map((cat) => {
              const isSelected = selected?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : cat)}
                  className={`rounded-xl border-2 p-4 text-left transition-all hover:shadow-md
                    ${isSelected
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:bg-zinc-900 dark:border-zinc-700"
                    }`}
                >
                  <h3 className={`font-semibold text-sm leading-snug ${isSelected ? "text-indigo-700 dark:text-indigo-400" : ""}`}>
                    {displayName(cat, locale)}
                  </h3>
                  {cat.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{cat.description}</p>
                  )}
                  <p className={`text-xs mt-2 font-medium ${isSelected ? "text-indigo-600" : "text-gray-400"}`}>
                    {cat.subcategories.length} {t("subcategoriesCount")}
                  </p>
                </button>
              );
            })}
          </div>

          {/* ── Subcategory panel ─────────────────────────────────── */}
          {selected && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-900 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-indigo-900 dark:text-indigo-300">
                  {displayName(selected, locale)}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("back")}
                </button>
              </div>

              {/* Subcategory chips */}
              {selected.subcategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noSubcategories")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selected.subcategories.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        const targetId = sub.service_id ?? sub.id;
                        router.push(`/${locale}/booking/${targetId}`);
                      }}
                      className="px-4 py-2 rounded-full border-2 border-indigo-200 bg-white dark:bg-zinc-900 dark:border-indigo-800
                                 text-sm font-medium text-indigo-800 dark:text-indigo-300
                                 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40
                                 transition-all active:scale-95"
                    >
                      {displayName(sub, locale)}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-400">{t("selectSubcategoryHint")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
