"use client";

import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { isAdminAuthenticated, clearAdminToken } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import {useState, useEffect} from "react";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const navItems = [
  { path: "/admin", label: "Overview", icon: LayoutDashboard },
  { path: "/admin/bookings", label: "Bookings", icon: Calendar },
  { path: "/admin/payments", label: "Payments", icon: Banknote },
  { path: "/admin/providers", label: "Providers", icon: Users },
  { path: "/admin/services", label: "Services", icon: Wrench },
  { path: "/admin/reviews", label: "Reviews", icon: MessageSquare },
];

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const location = usePathname();
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale ?? "en";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

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
      <div className="flex items-center gap-2 pb-4 border-b mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-semibold">Admin Panel</span>
        <Badge variant="secondary" className="ml-auto text-xs">Demo</Badge>
      </div>

      <nav className="flex-1 space-y-1" data-testid="admin-nav">
        {navItems.map((item) => {
          const isActive = location === item.path || 
            (item.path !== "/admin" && location.startsWith(item.path));
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
          Exit Admin
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row min-h-[100dvh]">
      {/* Mobile header with drawer trigger */}
      <div className="lg:hidden flex items-center justify-between p-3 border-b bg-background sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">{title}</span>
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
              <SheetTitle>Admin Navigation</SheetTitle>
            </SheetHeader>
            <NavContent />
          </SheetContent>
        </Sheet>
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
