import { useState, useRef, useEffect } from "react";
import { Link, router, usePage } from "@inertiajs/react"; // Mudamos para os hooks do Inertia
import {
  LayoutDashboard, List, Users, FileText, Calculator,
  TrendingUp, ClipboardList, LogOut, Menu,
  ChevronDown, Shield, CreditCard, ChevronRight, History,
  UserCog, Handshake, Landmark, Sparkles, LayoutGrid, Plug, User,
} from "lucide-react";
import UserProfileModal from "./Users/UserProfileModal";

interface LayoutAuthUser {
  id?: number;
  name?: string;
  email?: string;
  photoUrl?: string | null;
  role?: string;
}

function UserAvatarBubble({
  user,
  size = 36,
  variant = "header",
}: {
  user: LayoutAuthUser;
  size?: number;
  variant?: "header" | "sidebar";
}) {
  const [broken, setBroken] = useState(false);
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? "U";
  const isSidebar = variant === "sidebar";
  const showPhoto = !isSidebar && !!user?.photoUrl && !broken;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: isSidebar ? "rgb(79, 86, 98)" : showPhoto ? "#e2e8f0" : "#1e2139",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontWeight: 700,
        fontSize: Math.round(size * 0.39),
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {showPhoto ? (
        <img
          src={user.photoUrl!}
          alt=""
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        initial
      )}
    </div>
  );
}

const NAV_SECTIONS = [
  {
    label: "CRÉDITO",
    items: [
      { href: "/",               label: "Dashboard",           icon: LayoutDashboard },
      { href: "/contract-panel", label: "Painel de Contratos", icon: LayoutGrid },
      { href: "/lancamentos",    label: "Lançamentos",         icon: List },
      { href: "/clients",        label: "Clientes",            icon: Users },
      { href: "/credores",       label: "Credores",            icon: Landmark },
      { href: "/pessoas",        label: "Pessoas",             icon: Handshake },
      { href: "/contracts",      label: "Contratos",           icon: FileText },
      { href: "/ai-ingestion",   label: "Importação com IA",   icon: Sparkles },
      { href: "/pagamentos",     label: "Pagamentos",          icon: CreditCard },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      { href: "/ipca",        label: "Tabela IPCA",     icon: TrendingUp },
      { href: "/simulador",   label: "Simulador",       icon: Calculator },
      { href: "/simulacoes",  label: "Hist. Simulações", icon: History },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { href: "/serasa",     label: "Monitor Serasa", icon: Shield },
      { href: "/integracoes", label: "Integrações",    icon: Plug },
      //{ href: "/audit",  label: "Auditoria",      icon: ClipboardList },
    ],
  },
  {
    label: "GESTÃO INTERNA",
    items: [
      { href: "/usuarios", label: "Usuários", icon: UserCog },
      { href: "/contract-types", label: "Tipos de Contrato", icon: FileText },
    ],
  },
];

function getPageTitle(url: string) {
  if (url === "/" || url === "/dashboard") return "Dashboard";
  if (url === "/contract-panel") return "Painel de Contratos";
  if (url === "/ai-ingestion") return "Importação com IA";
  if (url === "/lancamentos") return "Lançamentos";
  if (url === "/clients") return "Clientes";
  if (url.startsWith("/clients/")) return "Detalhe do Cliente";
  if (url === "/credores") return "Credores";
  if (url === "/pessoas" || url === "/fiadores") return "Pessoas";
  if (url.startsWith("/contracts/") && url.endsWith("/price")) return "Tabela Price";
  if (url.startsWith("/contracts/")) return "Detalhe do Contrato";
  if (url === "/contracts") return "Contratos";
  if (url === "/pagamentos") return "Controle de Pagamentos";
  if (url === "/ipca") return "Tabela IPCA";
  if (url === "/simulator") return "Simulador";
  if (url === "/serasa") return "Monitor Serasa";
  if (url === "/integracoes") return "Integrações";
  if (url === "/audit") return "Auditoria";
  if (url === "/usuarios") return "Usuários";
  return "UnyPay® Crédito";
}

function getBreadcrumb(url: string) {
  const base = { label: "UnyPay® Crédito", href: "/" };
  if (url === "/" || url === "/dashboard") return [base, { label: "Dashboard" }];
  if (url === "/contract-panel") return [base, { label: "Painel de Contratos" }];
  if (url === "/ai-ingestion") return [base, { label: "Importação com IA" }];
  if (url === "/lancamentos") return [base, { label: "Lançamentos" }];
  if (url === "/clients") return [base, { label: "Clientes" }];
  if (url.startsWith("/clients/")) return [base, { label: "Clientes", href: "/clients" }, { label: "Detalhe" }];
  if (url === "/credores") return [base, { label: "Credores" }];
  if (url === "/pessoas" || url === "/fiadores") return [base, { label: "Pessoas" }];
  if (url.startsWith("/contracts/") && url.endsWith("/price")) return [base, { label: "Contratos", href: "/contracts" }, { label: "Tabela Price" }];
  if (url.startsWith("/contracts/")) return [base, { label: "Contratos", href: "/contracts" }, { label: "Detalhe" }];
  if (url === "/contracts") return [base, { label: "Contratos" }];
  if (url === "/pagamentos") return [base, { label: "Controle de Pagamentos" }];
  if (url === "/ipca") return [base, { label: "Tabela IPCA" }];
  if (url === "/simulator") return [base, { label: "Simulador" }];
  if (url === "/serasa") return [base, { label: "Monitor Serasa" }];
  if (url === "/integracoes") return [base, { label: "Sistema" }, { label: "Integrações" }];
  if (url === "/audit") return [base, { label: "Auditoria" }];
  if (url === "/usuarios") return [base, { label: "Gestão Interna" }, { label: "Usuários" }];
  return [base];
}

export default function UnyPayLayout({ children }: { children: React.ReactNode }) {
  // Capturamos a URL atual e os dados do usuário autenticado direto do Laravel/Inertia
  const { url, props } = usePage();
  const user = (props.auth as any)?.user || { name: "Usuário Local", email: "admin@unypay.com" };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const userRoleLabel = user?.role === "admin" ? "Usuário Administrador" : "Usuário Padrão";

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  const isActive = (href: string) => {
    if (href === "/") return url === "/";
    return url === href || url.startsWith(href);
  };

  const logout = () => {
    router.post('/logout');
  };

  const breadcrumb = getBreadcrumb(url);
  // Páginas que gerenciam o próprio padding/altura interna (tabela cheia / dashboard).
  const pathname = url.split("?")[0];
  const isFullWidth = [
    "/",
    "/contract-panel",
    "/lancamentos",
    "/pagamentos",
    "/contracts",
    "/clients",
    "/credores",
    "/pessoas",
    "/fiadores",
    "/simulacoes",
  ].includes(pathname);

  const SidebarContent = ({ mini }: { mini?: boolean }) => (
    <div style={{
      background: "var(--sidebar, #1e2139)",
      width: mini ? 52 : 220,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      overflow: "hidden",
      transition: "width 0.2s ease",
    }}>
      {/* Logo */}
      <div style={{
        padding: mini ? "14px 10px" : "14px 16px",
        borderBottom: "1px solid var(--sidebar-border, #2d3154)",
        display: "flex",
        alignItems: "center",
        gap: mini ? 0 : 10,
        justifyContent: mini ? "center" : "flex-start",
      }}>
        <img
          src="/images/unypay-logo.png"
          alt="UnyPay"
          width={32}
          height={32}
          style={{ display: "block", width: 32, height: 32, objectFit: "contain", flexShrink: 0 }}
        />
        {!mini && (
          <div>
            <div style={{ fontWeight: 700, color: "white", fontSize: 14, lineHeight: 1.2 }}>UnyPay®</div>
            <div style={{ fontSize: 10, color: "var(--sidebar-foreground, #9ca3af)", opacity: 0.6, lineHeight: 1.2 }}>Crédito</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 0" }}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            {!mini && (
              <div className="sigx-sidebar-section" style={{ color: '#6b7280', fontSize: '10px', fontWeight: 700, padding: '12px 16px 4px' }}>{section.label}</div>
            )}
            {mini && <div style={{ height: 8 }} />}
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link key={href} href={href} onClick={() => setSidebarOpen(false)} style={{ textDecoration: 'none' }}>
                  <div
                    className={`sigx-sidebar-item${active ? " active" : ""}`}
                    title={mini ? label : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      color: active ? "white" : "#9ca3af",
                      background: active ? "rgba(255,255,255,0.08)" : "transparent",
                      cursor: "pointer",
                      justifyContent: mini ? "center" : "flex-start",
                      padding: mini ? "9px 0" : "8px 16px",
                    }}
                  >
                    <Icon size={15} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
                    {!mini && <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px' }}>{label}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!mini ? (
        <div className="sigx-sidebar-footer" style={{ padding: "16px", borderTop: "1px solid #2d3154", display: "flex", alignItems: "center", gap: 10 }}>
          <UserAvatarBubble user={user} size={36} variant="sidebar" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "white", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.name ?? "Usuário"}
            </div>
            <div style={{ color: "#9ca3af", fontSize: 10, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.email ?? ""}
            </div>
          </div>
          <button onClick={logout} title="Sair" style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", opacity: 0.5, padding: 4, borderRadius: 4, display: "flex" }}>
            <LogOut size={14} />
          </button>
        </div>
      ) : (
        <div style={{ padding: "10px 0", display: "flex", justifyContent: "center", borderTop: "1px solid #2d3154" }}>
          <button onClick={logout} title="Sair" style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", opacity: 0.5, padding: 4, display: "flex" }}>
            <LogOut size={14} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--background, #f3f4f6)", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex" style={{ flexShrink: 0, transition: "width 0.2s ease" }}>
        <SidebarContent mini={collapsed} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.5)" }} onClick={() => setSidebarOpen(false)} />
          <div style={{ position: "relative", zIndex: 10, flexShrink: 0 }}>
            <SidebarContent mini={false} />
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Header */}
        <header className="sigx-header" style={{ height: "56px", background: "white", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
          <button
            onClick={() => {
              if (window.innerWidth >= 1024) setCollapsed(c => !c);
              else setSidebarOpen(true);
            }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 6, display: "flex", color: "#4b5563",
              borderRadius: 6, transition: "background 0.1s",
            }}
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, flex: 1, overflow: "hidden" }}>
            {breadcrumb.map((item, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <ChevronRight size={12} style={{ margin: "0 3px", color: "#9ca3af", flexShrink: 0 }} />}
                {"href" in item && item.href ? (
                  <Link href={(item as any).href}>
                    <span style={{ fontSize: 12, color: "#4b5563", cursor: "pointer", padding: "2px 4px", borderRadius: 4 }}>
                      {item.label}
                    </span>
                  </Link>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#111827", padding: "2px 4px" }}>
                    {item.label}
                  </span>
                )}
              </span>
            ))}
          </div>

          {/* Right */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div ref={userMenuRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "4px 8px 4px 4px",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: userMenuOpen ? "#f8fafc" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ textAlign: "right", lineHeight: 1.25 }} className="hidden sm:block">
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                    {user?.name?.split(" ")[0] ?? "Usuário"}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
                    {userRoleLabel}
                  </div>
                </div>
                <UserAvatarBubble user={user} size={36} />
                <ChevronDown size={14} style={{ color: "#6b7280", transform: userMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: 240,
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
                    overflow: "hidden",
                    zIndex: 120,
                  }}
                >
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
                      {user?.name ?? "Usuário"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {user?.email ?? ""}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setProfileOpen(true);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 16px",
                      border: "none",
                      background: "white",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#374151",
                      textAlign: "left",
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = "white"; }}
                  >
                    <User size={16} style={{ color: "#6b7280" }} />
                    Perfil
                  </button>

                  <div style={{ height: 1, background: "#f1f5f9" }} />

                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 16px",
                      border: "none",
                      background: "white",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#dc2626",
                      textAlign: "left",
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = "#fef2f2"; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = "white"; }}
                  >
                    <LogOut size={16} />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 🚀 Faixa de "page title bar" removida — a identificação da tela
            agora vive somente no breadcrumb do header + no h1 interno de
            cada Page (ex.: "Gerenciamento de Lançamentos"). Evita duplicação
            visual e ganha um pouco de altura útil para a grade. */}

        {/* Content */}
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          <div style={isFullWidth ? { height: "100%", display: "flex", flexDirection: "column" } : { padding: "16px 20px" }}>
            {children}
          </div>
        </main>
      </div>

      <UserProfileModal
        open={profileOpen}
        userId={user?.id ?? 0}
        onClose={() => setProfileOpen(false)}
      />
    </div>
  );
}