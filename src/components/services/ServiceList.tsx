"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Sparkles, Wrench, Zap, Hammer, Baby, Scissors, ChefHat, Leaf, Heart, Wind,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL || "https://shizu-verse.onrender.com";

const ICON_MAP: Record<string, LucideIcon> = {
  ménage: Sparkles, nettoyage: Sparkles,
  plomberie: Wrench,
  électricité: Zap,
  bricolage: Hammer,
  nounou: Baby, baby: Baby, childcare: Baby,
  beauté: Scissors, beauty: Scissors,
  traiteur: ChefHat, cuisine: ChefHat, catering: ChefHat,
  jardinage: Leaf, garden: Leaf,
  seniors: Heart, senior: Heart,
  climatisation: Wind, electroménager: Wind, appliance: Wind,
};

function getCategoryIcon(nameFr: string): LucideIcon {
  const lower = nameFr.toLowerCase();
  for (const [key, Icon] of Object.entries(ICON_MAP)) {
    if (lower.includes(key)) return Icon;
  }
  return Sparkles;
}

interface ApiCategory {
  id: number;
  name: string;
  name_fr: string;
  name_en: string;
  description: string;
  subcategories: { id: number; name: string; name_fr: string; name_en: string; service_id: number | null }[];
}

function displayName(
  item: { name: string; name_fr?: string; name_en?: string },
  locale: string
) {
  return locale === "fr"
    ? item.name_fr || item.name
    : item.name_en || item.name;
}

export const ServiceList = ({ locale }: { locale: string }) => {
  const t = useTranslations("services");
  const router = useRouter();

  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);

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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {categories.map((cat) => {
            const Icon = getCategoryIcon(cat.name_fr || cat.name);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => router.push(`/${locale}/services/${cat.id}`)}
                className="rounded-xl border-2 border-gray-200 bg-white hover:border-[#0F3A7A]/40 hover:shadow-md p-4 text-left transition-all dark:bg-zinc-900 dark:border-zinc-700 group"
              >
                <Icon className="h-6 w-6 mb-2 text-[#0F3A7A] group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold text-sm leading-snug text-gray-800 dark:text-gray-200 group-hover:text-[#0F3A7A] transition-colors">
                  {displayName(cat, locale)}
                </h3>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs font-medium text-gray-400">
                    {cat.subcategories.length} {t("subcategoriesCount")}
                  </p>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-[#0F3A7A] transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
