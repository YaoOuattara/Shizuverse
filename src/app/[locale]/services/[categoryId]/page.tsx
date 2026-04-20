"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft, Loader2,
  Sparkles, Wrench, Zap, Hammer, Baby, Scissors, ChefHat, Leaf, Heart, Wind,
  type LucideIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";

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

export default function CategoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("services");

  const locale = params.locale as string;
  const categoryId = Number(params.categoryId);

  const [category, setCategory] = useState<ApiCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/categories`)
      .then((r) => r.json())
      .then((data: ApiCategory[]) => {
        if (!Array.isArray(data)) { setNotFound(true); return; }
        const cat = data.find((c) => c.id === categoryId);
        if (cat) setCategory(cat);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [categoryId]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0F3A7A]" />
        </div>
      </>
    );
  }

  if (notFound || !category) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
          <p className="text-xl font-semibold text-gray-700">{t("notFoundTitle")}</p>
          <p className="text-gray-400 text-sm">{t("notFound")}</p>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/services`)}
            className="flex items-center gap-2 text-[#0F3A7A] font-medium hover:underline mt-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </button>
        </div>
      </>
    );
  }

  const Icon = getCategoryIcon(category.name_fr || category.name);
  const catName = displayName(category, locale);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Back button */}
          <button
            type="button"
            onClick={() => router.push(`/${locale}/services`)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </button>

          {/* Category header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#0F3A7A]/10 flex items-center justify-center shrink-0">
              <Icon className="h-7 w-7 text-[#0F3A7A]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{catName}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {category.subcategories.length} {t("subcategoriesCount")}
              </p>
            </div>
          </div>

          {/* Subcategory chips */}
          {category.subcategories.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <p className="text-gray-400">{t("noSubcategories")}</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-4 uppercase tracking-wide font-medium">
                {t("selectSubcategoryHint")}
              </p>
              <div className="flex flex-col gap-3">
                {category.subcategories.map((sub) => {
                  const isBookable = sub.service_id !== null;
                  const subName = displayName(sub, locale);
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      disabled={!isBookable}
                      onClick={() => {
                        if (!isBookable) return;
                        router.push(
                          `/${locale}/booking/${sub.service_id}?service=${encodeURIComponent(subName)}`
                        );
                      }}
                      className={`w-full flex items-center justify-between rounded-2xl border-2 px-5 py-4 text-sm font-medium transition-all
                        ${isBookable
                          ? "border-gray-200 bg-white text-gray-800 hover:border-[#0F3A7A] hover:bg-[#0F3A7A]/5 hover:text-[#0F3A7A] active:scale-[0.98] cursor-pointer shadow-sm"
                          : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60"
                        }`}
                    >
                      <span>{subName}</span>
                      {isBookable && (
                        <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-100 rounded-full px-3 py-1 shrink-0">
                          {locale === "fr" ? "Réserver" : "Book"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
