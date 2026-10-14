"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  History,
  CreditCard,
  Receipt,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  LogOut,
  Coins,
  ChevronDown,
} from "lucide-react";
import type { User } from "@/lib/types";
import { api } from "@/lib/client";
import { ErrorMessage } from "./ui";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./animate-ui/components/radix/sheet";
const Session = createContext<{
  user: User;
  refresh: () => Promise<void>;
} | null>(null);
export function useSession() {
  const session = useContext(Session);
  if (!session) throw new Error("Session unavailable");
  return session;
}
const navigation = [
  { label: "Generate", icon: Sparkles },
  { label: "History", icon: History },
  { label: "Pricing", icon: CreditCard },
  { label: "Payments", icon: Receipt },
  { label: "Account", icon: UserRound },
];
export function SessionShell({
  initialUser,
  children,
}: {
  initialUser: User;
  children: ReactNode;
}) {
  const [user, setUser] = useState(initialUser),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false),
    [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  async function refresh() {
    setUser(await api<User>("/api/auth/me"));
  }
  async function logout() {
    setBusy(true);
    try {
      await api("/api/auth/logout", {});
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  function links() {
    return navigation.map(({ label, icon: Icon }) => (
      <Link
        key={label}
        href={`/${label.toLowerCase()}`}
        className={`nav-link ${label === "Generate" ? "font-semibold text-primary" : ""}`}
        aria-label={label}
        title={collapsed ? label : undefined}
        onClick={() => setOpen(false)}
        aria-current={
          pathname === `/${label.toLowerCase()}` ||
          pathname.startsWith(`/${label.toLowerCase()}/`)
            ? "page"
            : undefined
        }
      >
        <Icon size={19} aria-hidden="true" />
        <span className="nav-label">{label}</span>
      </Link>
    ));
  }
  const current =
    navigation.find((item) =>
      pathname.startsWith(`/${item.label.toLowerCase()}`),
    )?.label ?? "Workspace";
  return (
    <Session.Provider value={{ user, refresh }}>
      <div className="app-shell">
        <aside
          className={`sidebar ${collapsed ? "collapsed" : ""}`}
          aria-label="Sidebar"
        >
          <Brand href="/generate" />
          <nav aria-label="Main navigation">{links()}</nav>
          <div className="sidebar-note">
            <Sparkles size={18} aria-hidden="true" />
            <p className="font-semibold">
              Your next great description starts here.
            </p>
            <p className="muted">
              Write in English or Khmer, in your own tone.
            </p>
            <Link href="/generate" className="text-primary font-semibold">
              Start writing →
            </Link>
          </div>
        </aside>
        <div className="workspace">
          <header className="workspace-header">
            <div className="flex items-center gap-3">
              <Button
                className="hidden lg:inline-flex"
                variant="ghost"
                size="icon"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!collapsed}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    className="lg:hidden"
                    variant="ghost"
                    size="icon"
                    aria-label="Open navigation"
                  >
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[min(320px,90vw)] p-5">
                  <SheetHeader>
                    <SheetTitle>Generate Description AI</SheetTitle>
                    <SheetDescription>Your workspace</SheetDescription>
                  </SheetHeader>
                  <nav className="drawer-nav" aria-label="Mobile navigation">
                    {links()}
                  </nav>
                  <Button
                    variant="outline"
                    className="mt-auto"
                    onClick={logout}
                    disabled={busy}
                  >
                    <LogOut />
                    {busy ? "Logging out…" : "Logout"}
                  </Button>
                </SheetContent>
              </Sheet>
              <span className="header-title text-sm text-muted-foreground">
                Workspace{" "}
                <span aria-hidden="true" className="px-2">
                  /
                </span>
                <span className="text-foreground">{current}</span>
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <Link
                href="/pricing"
                aria-label={`${user.credits} credits available. Buy credits.`}
              >
                <Badge variant="secondary" className="min-h-10 gap-2 px-3">
                  <Coins size={15} aria-hidden="true" />
                  {user.credits} credits
                </Badge>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" aria-label="Account menu">
                    <span className="grid size-8 place-items-center rounded-full bg-accent font-semibold">
                      {user.email.slice(0, 1).toUpperCase()}
                    </span>
                    <ChevronDown aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 max-w-[calc(100vw-2rem)]"
                >
                  <DropdownMenuLabel className="break-all">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account">
                      <UserRound />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/pricing">
                      <Coins />
                      Buy credits
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={busy} onSelect={logout}>
                    <LogOut />
                    {busy ? "Logging out…" : "Logout"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main id="main-content" tabIndex={-1} className="workspace-main">
            <ErrorMessage message={error} />
            {children}
          </main>
        </div>
      </div>
    </Session.Provider>
  );
}
