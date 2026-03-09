"use client";
import { useTranslations } from "next-intl";

export default function HomeHero() {
  const t = useTranslations("common");
  return (
    <section className="text-center p-6">
      <h1 className="text-3xl font-bold">{t("welcome", { appName: t("appName") })}</h1>
    </section>
  );
}
