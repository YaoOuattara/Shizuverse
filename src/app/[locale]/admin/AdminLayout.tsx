"use client";

import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { isAdminAuthenticated, clearAdminToken } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import TokenRefresher from "@/components/TokenRefresher";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Wrench,
  MessageSquare,
  Banknote,
  Shield,
  Menu,
  LogOut,
  MapPin,
  UserSearch,
  Sparkles,
  Activity,
} from "lucide-react";
import {useState, useEffect} from "react";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const getNavItems = (locale: string, isFr: boolean) => [
  { path: `/${locale}/admin`, label: isFr ? "Aperçu" : "Overview", icon: LayoutDashboard },
  { path: `/${locale}/admin/bookings`, label: isFr ? "Réservations" : "Bookings", icon: Calendar },
  { path: `/${locale}/admin/payments`, label: isFr ? "Paiements" : "Payments", icon: Banknote },
  { path: `/${locale}/admin/providers`, label: isFr ? "Prestataires" : "Providers", icon: Users },
  { path: `/${locale}/admin/services`, label: isFr ? "Services" : "Services", icon: Wrench },
  { path: `/${locale}/admin/reviews`, label: isFr ? "Avis" : "Reviews", icon: MessageSquare },
  { path: `/${locale}/admin/waitlist`, label: isFr ? "Liste d'attente" : "Waitlist", icon: MapPin },
  { path: `/${locale}/admin/clients`,    label: isFr ? "Clients" : "Clients",          icon: UserSearch },
  { path: `/${locale}/admin/retention`,  label: isFr ? "Réengagement IA" : "AI Re-engagement", icon: Sparkles },
  { path: `/${locale}/admin/anomalies`, label: isFr ? "Anomalies" : "Anomalies",             icon: Activity },
];

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const location = usePathname();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const isFr = locale === "fr";
  const navItems = getNavItems(locale, isFr);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const pathWithoutLocale = location.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "";

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(`/${locale}/admin/login`);
    } else {
      setAuthenticated(true);
    }
  }, [locale, router]);

  if (!authenticated) return null;

  const handleLogout = () => {
    clearAdminToken();
    router.push(`/${locale}/admin/login`);
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b mb-4">
        <div className="flex items-center gap-2">
          <img
            src="https://res.cloudinary.com/ddilgv5ir/image/upload/v1779646648/shizu_logo_horizontal_dark_khesrn.png"
            alt="Shizu"
            style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
          />
        </div>
        <div className="flex items-center bg-gray-100 rounded-full p-0.5 text-xs font-medium">
          {(["en", "fr"] as const).map((code) => (
            <Link
              key={code}
              href={`/${code}${pathWithoutLocale}`}
              className={`px-2.5 py-1 rounded-full transition-all ${
                locale === code
                  ? "bg-white text-[#0F3A7A] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {code.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>

      <nav className="flex-1 space-y-1" data-testid="admin-nav">
        {navItems.map((item) => {
          const isActive = location === item.path ||
            (item.path !== `/${locale}/admin` && location.startsWith(item.path));
          const Icon = item.icon;

          return (
            <Link key={item.path} href={item.path}>
              <button
                onClick={() => setDrawerOpen(false)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium
                  transition-colors
                  ${isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "hover-elevate text-muted-foreground hover:text-foreground"
                  }
                `}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            </Link>
          );
        })}
      </nav>

      <div className="pt-4 border-t mt-auto">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          onClick={() => {
            setDrawerOpen(false);
            handleLogout();
          }}
          data-testid="button-exit-admin"
        >
          <LogOut className="h-4 w-4" />
          {isFr ? "Déconnexion" : "Exit Admin"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row min-h-[100dvh]">
      <TokenRefresher kind="admin" />
      {/* Mobile header with drawer trigger */}
      <div className="lg:hidden flex items-center justify-between p-3 border-b bg-background sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-full p-0.5 text-xs font-medium">
            {(["en", "fr"] as const).map((code) => (
              <Link
                key={code}
                href={`/${code}${pathWithoutLocale}`}
                className={`px-2.5 py-1 rounded-full transition-all ${
                  locale === code
                    ? "bg-white text-[#0F3A7A] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {code.toUpperCase()}
              </Link>
            ))}
          </div>
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-admin-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 p-4">
            <SheetHeader className="sr-only">
              <SheetTitle>{isFr ? "Navigation Admin" : "Admin Navigation"}</SheetTitle>
            </SheetHeader>
            <NavContent />
          </SheetContent>
        </Sheet>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 border-r bg-muted/30 shrink-0 p-4">
        <NavContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="hidden lg:block mb-6">
          <h1 className="text-2xl font-bold" data-testid="admin-page-title">{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}
