"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ClientPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const router = useRouter();
  useEffect(() => { router.replace(`/${locale}/client/dashboard`); }, [locale, router]);
  return null;
}
