import Navbar from "@/components/Navbar";
import BookingForm from "@/components/BookingForm";

interface Props {
  params: Promise<{ locale: string; serviceId: string }>;
  searchParams: Promise<{ service?: string }>;
}

export default async function BookingPage({ params, searchParams }: Props) {
  const { locale, serviceId } = await params;
  const { service } = await searchParams;

  return (
    <>
      <Navbar />
      <BookingForm
        serviceId={serviceId}
        locale={locale}
        serviceName={service}
      />
    </>
  );
}
