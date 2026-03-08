import { useTranslations, useLocale } from "next-intl";
import { ServiceCard } from "./ServiceCard";
import { services } from "@/data/services";

export const ServiceList = () => {
  const t = useTranslations("services");
  const locale = useLocale();

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">{t("title")}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            id={service.id}
            title={service.title[locale]}
            description={service.description[locale]}
            price={service.price}
          />
        ))}
      </div>
    </div>
  );
};

