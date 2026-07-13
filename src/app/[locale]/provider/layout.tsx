import Navbar from '@/components/Navbar';
import TokenRefresher from '@/components/TokenRefresher';

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <TokenRefresher kind="provider" />
      <Navbar />
      <main className="p-6">{children}</main>
    </div>
  );
}
