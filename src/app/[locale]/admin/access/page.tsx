"use client";
import { useAdminMode } from "@/hooks/useAdminMode";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export default function AdminAccessPage() {
  const { enableAdminMode } = useAdminMode();
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale || "en";

  const handleEnter = () => {
    enableAdminMode();
    router.push(`/${locale}/admin`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 p-8">
        <Shield className="h-16 w-16 mx-auto" />
        <h1 className="text-2xl font-bold">Admin Access</h1>
        <p className="text-gray-500">Enter admin mode to manage Shizu.</p>
        <Button onClick={handleEnter} size="lg">Enter Admin Panel</Button>
      </div>
    </div>
  );
}
