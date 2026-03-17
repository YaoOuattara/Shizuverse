"use client";
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL || "https://shizu-verse.onrender.com";

interface ApiCategory {
  id: number;
  name: string;
  description: string;
}

export const ServiceList = () => {
  const t = useTranslations("services");
  const locale = useLocale();
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
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">{t("title")}</h2>
      {categories.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/${locale}/booking/${category.id}`}
              className="border rounded-xl p-4 shadow hover:shadow-md transition block"
            >
              <h3 className="font-bold text-lg">{category.name}</h3>
              {category.description && (
                <p className="text-sm text-gray-600 mt-1">{category.description}</p>
              )}
              <p className="text-indigo-600 underline text-sm mt-2">
                {t("viewDetails")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
