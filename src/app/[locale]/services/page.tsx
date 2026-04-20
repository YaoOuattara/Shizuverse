import Navbar from "@/components/Navbar";
import { ServiceList } from "@/components/services/ServiceList";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      <Navbar />
      <ServiceList locale={locale} />
    </>
  );
}
