import { submitBooking } from '@/actions/submitBooking';
import CommuneAutocomplete from '@/components/CommuneAutocomplete';

interface Props {
  params: Promise<{ locale: string; serviceId: string }>;
  searchParams: Promise<{ service?: string }>;
}

export default async function BookingPage({ params, searchParams }: Props) {
  const { locale, serviceId } = await params;
  const { service } = await searchParams;

  const fr = locale === 'fr';

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">
        {fr ? 'Réserver un service' : 'Book a Service'}
      </h1>

      {service && (
        <p className="mb-6 text-indigo-700 font-medium">
          {fr ? `Vous réservez : ${service}` : `Booking: ${service}`}
        </p>
      )}

      <form action={submitBooking} className="space-y-4">
        <input type="hidden" name="serviceId" value={serviceId} />
        <input type="hidden" name="locale" value={locale} />

        <div>
          <label className="block text-sm font-medium">
            {fr ? 'Nom complet' : 'Name'}
          </label>
          <input name="name" type="text" className="w-full border p-2 rounded" required />
        </div>

        <div>
          <label className="block text-sm font-medium">
            {fr ? 'WhatsApp / Téléphone' : 'Phone'}
          </label>
          <input name="phone" type="tel" className="w-full border p-2 rounded" required />
        </div>

        <CommuneAutocomplete label={fr ? 'Adresse ou quartier' : 'Location'} />

        <div>
          <label className="block text-sm font-medium">
            {fr ? 'Date souhaitée' : 'Date'}
          </label>
          <input name="date" type="date" className="w-full border p-2 rounded" required />
        </div>

        <div>
          <label className="block text-sm font-medium">
            {fr ? 'Précisions (optionnel)' : 'Notes'}
          </label>
          <textarea name="notes" className="w-full border p-2 rounded" rows={3} />
        </div>

        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded">
          {fr ? 'Envoyer ma demande' : 'Submit'}
        </button>
      </form>
    </main>
  );
}
