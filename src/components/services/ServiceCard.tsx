"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FC } from "react";
import { formatMoney } from "@/lib/currency";

interface ServiceCardProps {
  id: string;
  title: string;
  description: string;
  price?: number | null;
}

export const ServiceCard: FC<ServiceCardProps> = ({ id, title, description, price }) => {
  const locale = useLocale();
  const t = useTranslations("services");

  return (
    <div className="border rounded-xl p-4 shadow hover:shadow-md transition">
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
      <p className="mt-2 font-medium text-sm text-muted-foreground">
        {price ? formatMoney(price, "XOF") : t("viewPricing")}
      </p>
      <Link
        href={`/${locale}/service/${id}`}
        className="text-indigo-600 underline text-sm mt-2 inline-block"
      >
        {t("viewDetails")}
      </Link>
    </div>
  );
};

