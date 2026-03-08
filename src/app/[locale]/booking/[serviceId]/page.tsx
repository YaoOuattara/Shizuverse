import { submitBooking } from '@/actions/submitBooking';

interface Props {
  params: Promise<{ locale: string; serviceId: string }>;
}

export default async function BookingPage({ params }: Props) {
  const { serviceId } = await params;

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Book a Service</h1>

      <form action={submitBooking} className="space-y-4">
        <input type="hidden" name="serviceId" value={serviceId} />

        <div>
          <label className="block text-sm font-medium">Name</label>
          <input name="name" type="text" className="w-full border p-2 rounded" required />
        </div>

        <div>
          <label className="block text-sm font-medium">Phone</label>
          <input name="phone" type="tel" className="w-full border p-2 rounded" required />
        </div>

        <div>
          <label className="block text-sm font-medium">Location</label>
          <input name="location" type="text" className="w-full border p-2 rounded" required />
        </div>

        <div>
          <label className="block text-sm font-medium">Date</label>
          <input name="date" type="date" className="w-full border p-2 rounded" required />
        </div>

        <div>
          <label className="block text-sm font-medium">Notes</label>
          <textarea name="notes" className="w-full border p-2 rounded" rows={3} />
        </div>

        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded">
          Submit
        </button>
      </form>
    </main>
  );
}
