"use client";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("common");
  return (
    <footer className="border-t py-4 text-center text-sm text-muted-foreground">
      {t("appName")} © {new Date().getFullYear()}
    </footer>
  );
}
