"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { ServiceCard } from "./ServiceCard";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL || "https://shizu-verse.onrender.com";

interface ApiService {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  is_active: boolean;
  featured: boolean;
}

export const ServiceList = () => {
  const t = useTranslations("services");
  const [services, setServices] = useState<ApiService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/`)
      .then((r) => r.json())
      .then((data) => setServices(Array.isArray(data.items) ? data.items : []))
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
      {services.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              id={String(service.id)}
              title={service.name}
              description={service.description || ""}
              price={0}
            />
          ))}
        </div>
      )}
    </div>
  );
};
