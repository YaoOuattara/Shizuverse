import Link from 'next/link';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r p-4">
        <h2 className="text-xl font-bold mb-6">🚀 Client Area</h2>
        <nav className="space-y-3">
          <Link href="/client/bookings" className="block hover:text-blue-500">📅 Bookings</Link>
          <Link href="/client/rewards" className="block hover:text-blue-500">🎁 Rewards</Link>
          <Link href="/client/recommendations" className="block hover:text-blue-500">🤖 Recommendations</Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
