import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LogOut, Phone, LayoutDashboard, History, Users, Smartphone } from "lucide-react";
import logo from "@/assets/referencerh.png";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { NotificationsFloatingButton } from "@/components/NotificationsFloatingButton";

const navItems = [
  {
    to: "/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    mobileIcon: <LayoutDashboard className="h-5 w-5" />,
    label: "Início",
  },
  {
    to: "/numeros",
    icon: <Phone className="h-4 w-4" />,
    mobileIcon: <Phone className="h-5 w-5" />,
    label: "Números",
  },
  {
    to: "/funcionarias",
    icon: <Users className="h-4 w-4" />,
    mobileIcon: <Users className="h-5 w-5" />,
    label: "Colaboradoras",
  },
  {
    to: "/dispositivos",
    icon: <Smartphone className="h-4 w-4" />,
    mobileIcon: <Smartphone className="h-5 w-5" />,
    label: "Dispositivos",
  },
  {
    to: "/historico",
    icon: <History className="h-4 w-4" />,
    mobileIcon: <History className="h-5 w-5" />,
    label: "Histórico",
  },
] as const;

export function AppHeader() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  const initials =
    (user?.user_metadata?.full_name as string | undefined)
      ?.split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "?";

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center">
            <img src={logo} alt="Reference RH" className="h-10 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} />
            ))}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                {isAdmin && (
                  <Badge variant="secondary" className="hidden sm:inline">
                    Admin
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium truncate">
                  {user?.user_metadata?.full_name || user?.email}
                </div>
                <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <TooltipProvider delayDuration={150}>
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
          <div className="grid h-16 grid-cols-5 px-1">
            {navItems.map((item) => (
              <MobileNavItem key={item.to} to={item.to} icon={item.mobileIcon} label={item.label} />
            ))}
          </div>
        </nav>
      </TooltipProvider>
      <NotificationsFloatingButton />
      <div className="h-16 md:hidden" aria-hidden="true" />
    </>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      activeProps={{ className: "bg-accent text-foreground" }}
    >
      {icon}
      {label}
    </Link>
  );
}

function MobileNavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={to}
          aria-label={label}
          title={label}
          className="mx-auto my-2 flex h-12 w-12 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          activeProps={{ className: "bg-accent text-foreground" }}
        >
          {icon}
          <span className="sr-only">{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
