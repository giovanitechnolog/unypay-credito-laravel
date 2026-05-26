import { useState } from "react";
import { Link, router, usePage } from "@inertiajs/react"; // Mudamos para os hooks do Inertia
import {
  LayoutDashboard, List, Users, FileText, Calculator,
  TrendingUp, ClipboardList, LogOut, Menu, Bell,
  ChevronDown, Shield, CreditCard, ChevronRight, History,
  UserCog
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "CRÉDITO",
    items: [
      { href: "/",            label: "Dashboard",      icon: LayoutDashboard }, // Ajustado para a raiz do Laravel
      { href: "/lancamentos", label: "Lançamentos",     icon: List },
      { href: "/clients",     label: "Clientes",        icon: Users },
      { href: "/contracts",   label: "Contratos",       icon: FileText },
      { href: "/pagamentos",  label: "Pagamentos",      icon: CreditCard },
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
      { href: "/serasa", label: "Monitor Serasa", icon: Shield },
      //{ href: "/audit",  label: "Auditoria",      icon: ClipboardList },
    ],
  },
  {
    label: "GESTÃO INTERNA",
    items: [
      { href: "/usuarios", label: "Usuários", icon: UserCog },
    ],
  },
];

function getPageTitle(url: string) {
  if (url === "/" || url === "/dashboard") return "Dashboard";
  if (url === "/lancamentos") return "Lançamentos";
  if (url === "/clients") return "Clientes";
  if (url.startsWith("/clients/")) return "Detalhe do Cliente";
  if (url.startsWith("/contracts/") && url.endsWith("/price")) return "Tabela Price";
  if (url.startsWith("/contracts/")) return "Detalhe do Contrato";
  if (url === "/contracts") return "Contratos";
  if (url === "/pagamentos") return "Controle de Pagamentos";
  if (url === "/ipca") return "Tabela IPCA";
  if (url === "/simulator") return "Simulador";
  if (url === "/serasa") return "Monitor Serasa";
  if (url === "/audit") return "Auditoria";
  if (url === "/usuarios") return "Usuários";
  return "UnyPay® Crédito";
}

function getBreadcrumb(url: string) {
  const base = { label: "UnyPay® Crédito", href: "/" };
  if (url === "/" || url === "/dashboard") return [base, { label: "Dashboard" }];
  if (url === "/lancamentos") return [base, { label: "Lançamentos" }];
  if (url === "/clients") return [base, { label: "Clientes" }];
  if (url.startsWith("/clients/")) return [base, { label: "Clientes", href: "/clients" }, { label: "Detalhe" }];
  if (url.startsWith("/contracts/") && url.endsWith("/price")) return [base, { label: "Contratos", href: "/contracts" }, { label: "Tabela Price" }];
  if (url.startsWith("/contracts/")) return [base, { label: "Contratos", href: "/contracts" }, { label: "Detalhe" }];
  if (url === "/contracts") return [base, { label: "Contratos" }];
  if (url === "/pagamentos") return [base, { label: "Controle de Pagamentos" }];
  if (url === "/ipca") return [base, { label: "Tabela IPCA" }];
  if (url === "/simulator") return [base, { label: "Simulador" }];
  if (url === "/serasa") return [base, { label: "Monitor Serasa" }];
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

  const isActive = (href: string) => {
    if (href === "/") return url === "/";
    return url === href || url.startsWith(href);
  };

  const logout = () => {
    router.post('/logout');
  };

  const breadcrumb = getBreadcrumb(url);
  const pageTitle = getPageTitle(url);
  // Páginas que gerenciam o próprio padding/altura interna (tabela cheia / dashboard).
  const pathname = url.split("?")[0];
  const isFullWidth = [
    "/",
    "/lancamentos",
    "/pagamentos",
    "/contracts",
    "/clients",
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
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "oklch(55% .18 240)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 700, fontSize: 12, flexShrink: 0,
            overflow: "hidden",
            backgroundImage: user?.photoUrl ? `url(${user.photoUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}>
            {!user?.photoUrl && (user?.name?.charAt(0)?.toUpperCase() ?? "U")}
          </div>
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
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, color: "#4b5563", display: "flex" }}>
              <Bell size={16} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", cursor: "pointer", background: "white" }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "#1e2139",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 700, fontSize: 10,
                overflow: "hidden",
                backgroundImage: user?.photoUrl ? `url(${user.photoUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}>
                {!user?.photoUrl && (user?.name?.charAt(0)?.toUpperCase() ?? "U")}
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#111827" }} className="hidden sm:inline">
                {user?.name?.split(" ")[0] ?? "Usuário"}
              </span>
              <ChevronDown size={12} style={{ color: "#4b5563" }} />
            </div>
          </div>
        </header>

        {/* Page title bar */}
        <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>{pageTitle}</h1>
        </div>

        {/* Content */}
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          <div style={isFullWidth ? { height: "100%", display: "flex", flexDirection: "column" } : { padding: "16px 20px" }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}