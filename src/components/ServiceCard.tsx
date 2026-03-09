"use client";
import { useTranslations } from "next-intl";

interface ServiceCardProps {
  name: string;
  description?: string;
}

export default function ServiceCard({ name, description }: ServiceCardProps) {
  const t = useTranslations("common");
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold">{name}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}
