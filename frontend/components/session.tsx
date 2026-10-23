"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  History,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  LogOut,
  ChevronDown,
} from "lucide-react";
import type { User } from "@/lib/types";
import { api } from "@/lib/client";
import { ErrorMessage } from "./ui";
import { UserAvatar } from "./user-avatar";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { LanguageControl, ThemeControl, useTranslation } from "./preferences";
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
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  loggingOut: boolean;
} | null>(null);
export function useSession() {
  const session = useContext(Session);
  if (!session) throw new Error("Session unavailable");
  return session;
}
const navigation = [
  { label: "Generate", icon: Sparkles },
  { label: "History", icon: History },
  { label: "Profile", icon: UserRound },
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
  // Keep portaled navigation menus inside the header landmark for screen readers.
  const [menuContainer, setMenuContainer] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false),
    [open, setOpen] = useState(false);
  const { t, setLocale } = useTranslation();
  useEffect(() => {
    setLocale(initialUser.ui_language || "en");
  }, [initialUser.ui_language, setLocale]);
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
        aria-label={t(label)}
        title={collapsed ? t(label) : undefined}
        onClick={() => setOpen(false)}
        aria-current={
          pathname === `/${label.toLowerCase()}` ||
          pathname.startsWith(`/${label.toLowerCase()}/`)
            ? "page"
            : undefined
        }
      >
        <Icon size={19} aria-hidden="true" />
        <span className="nav-label">{t(label)}</span>
      </Link>
    ));
  }
  const current =
    navigation.find((item) =>
      pathname.startsWith(`/${item.label.toLowerCase()}`),
    )?.label ?? "Workspace";
  return (
    <Session.Provider
      value={{ user, refresh, setUser, logout, loggingOut: busy }}
    >
      <div className="app-shell">
        <aside
          className={`sidebar ${collapsed ? "collapsed" : ""}`}
          aria-label={t("Sidebar")}
        >
          <Brand href="/generate" />
          <nav aria-label={t("Main navigation")}>{links()}</nav>
        </aside>
        <div className="workspace">
          <header ref={setMenuContainer} className="workspace-header">
            <div className="flex items-center gap-3">
              <Button
                className="hidden lg:inline-flex"
                variant="ghost"
                size="icon"
                aria-label={t(
                  collapsed ? "Expand sidebar" : "Collapse sidebar",
                )}
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
                    aria-label={t("Open navigation")}
                  >
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  closeLabel={t("Close navigation")}
                  side="left"
                  className="w-[min(320px,90vw)] p-5"
                >
                  <SheetHeader>
                    <SheetTitle>Generate Description AI</SheetTitle>
                    <SheetDescription>{t("Your workspace")}</SheetDescription>
                  </SheetHeader>
                  <nav
                    className="drawer-nav"
                    aria-label={t("Mobile navigation")}
                  >
                    {links()}
                  </nav>
                  <Button
                    variant="outline"
                    className="mt-auto"
                    onClick={logout}
                    disabled={busy}
                  >
                    <LogOut />
                    {busy ? t("Working…") : t("Logout")}
                  </Button>
                </SheetContent>
              </Sheet>
              <span className="header-title text-sm text-muted-foreground">
                {t("Workspace")}{" "}
                <span aria-hidden="true" className="px-2">
                  /
                </span>
                <span className="text-foreground">{t(current)}</span>
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap justify-end items-center gap-2 sm:gap-4">
              <LanguageControl
                menuContainer={menuContainer}
                onLanguage={async (ui_language) => {
                  await api("/api/auth/preferences", { ui_language });
                  await refresh();
                }}
              />
              <ThemeControl />
              {/* Keep navigation menus non-modal while page segments hydrate. */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" aria-label={t("Profile menu")}>
                    <UserAvatar email={user.email} avatarId={user.avatar_id} />
                    <ChevronDown aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  container={menuContainer}
                  align="end"
                  className="w-64 max-w-[calc(100vw-2rem)]"
                >
                  <DropdownMenuLabel className="break-all">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">
                      <UserRound />
                      {t("Profile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={busy} onSelect={logout}>
                    <LogOut />
                    {busy ? t("Working…") : t("Logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main id="main-content" tabIndex={-1} className="workspace-main">
            <ErrorMessage message={t(error)} />
            {children}
          </main>
        </div>
      </div>
    </Session.Provider>
  );
}
