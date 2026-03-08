"use client";
import { useTranslation } from "react-i18next";

const HomeHero = () => {
  const { t } = useTranslation();

  return (
    <section className="text-center p-6">
      <h1 className="text-3xl font-bold">{t("welcome")}</h1>
      <p className="mt-2 text-lg text-gray-600">{t("tagline")}</p>
      <button className="mt-4 px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        {t("get_started")}
      </button>
    </section>
  );
};

export default HomeHero;
