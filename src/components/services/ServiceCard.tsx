"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { FC } from "react";

interface ServiceCardProps {
  id: string;
  title: string;
  description: string;
  price: number;
}

export const ServiceCard: FC<ServiceCardProps> = ({ id, title, description, price }) => {
  const locale = useLocale();

  return (
    <div className="border rounded-xl p-4 shadow hover:shadow-md transition">
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
      <p className="mt-2 font-medium">${price}</p>
      <Link
        href={`/${locale}/service/${id}`}
        className="text-indigo-600 underline text-sm mt-2 inline-block"
      >
        View Details
      </Link>
    </div>
  );
};

