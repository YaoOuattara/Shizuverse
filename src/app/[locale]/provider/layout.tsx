export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen p-6 bg-gray-50 text-gray-900">
      <main>{children}</main>
    </div>
  );
}
