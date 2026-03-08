import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { User, Briefcase, Shield } from "lucide-react";

interface RoleNavigationProps {
  className?: string;
}

export default function RoleNavigation({ className }: RoleNavigationProps) {
  const [location] = useLocation();
  
  const isProviderView = location.startsWith("/provider");
  const isAdminView = location.startsWith("/admin");
  const isClientView = !isProviderView && !isAdminView;

  return (
    <div 
      className={`bg-muted/50 rounded-full p-1 flex items-center gap-0.5 ${className || ""}`}
      data-testid="role-navigation"
    >
      <Link href="/">
        <Button
          variant={isClientView ? "default" : "ghost"}
          size="sm"
          className="rounded-full text-xs sm:text-sm px-2 sm:px-3"
          data-testid="nav-client-dashboard"
        >
          <User className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">Client</span>
          <span className="xs:hidden">Client</span>
        </Button>
      </Link>
      <Link href="/provider">
        <Button
          variant={isProviderView ? "default" : "ghost"}
          size="sm"
          className="rounded-full text-xs sm:text-sm px-2 sm:px-3"
          data-testid="nav-provider-dashboard"
        >
          <Briefcase className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">Provider</span>
          <span className="xs:hidden">Provider</span>
        </Button>
      </Link>
      <Link href="/admin">
        <Button
          variant={isAdminView ? "default" : "ghost"}
          size="sm"
          className="rounded-full text-xs sm:text-sm px-2 sm:px-3"
          data-testid="nav-admin-dashboard"
        >
          <Shield className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">Admin</span>
          <span className="xs:hidden">Admin</span>
        </Button>
      </Link>
    </div>
  );
}
