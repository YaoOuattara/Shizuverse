import Navbar from '@/components/Navbar';

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar />
      <main className="p-6">{children}</main>
    </div>
  );
}
