import { ReactNode } from "react";
import { Head } from "@inertiajs/react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  pageTitle?: string;
}

export default function AuthLayout({ children, title, subtitle, pageTitle }: AuthLayoutProps) {
  return (
    <>
      <Head title={pageTitle ?? title} />
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          background: "#f3f4f6",
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}
      >
        {/* Branding lateral */}
        <aside
          style={{
            background:
              "linear-gradient(160deg, #1e2139 0%, #2a2f5a 60%, #3b3f7a 100%)",
            color: "white",
            padding: "48px 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
          className="hidden lg:flex"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/images/unypay-logo.png"
              alt="UnyPay"
              width={44}
              height={44}
              style={{ display: "block", width: 44, height: 44, objectFit: "contain", flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.1 }}>UnyPay®</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Sistema de Gestão de Crédito</div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.25, margin: 0 }}>
              Gestão completa de crédito,
              <br />
              do contrato à cobrança.
            </h2>
            <p style={{ marginTop: 16, fontSize: 14, opacity: 0.8, maxWidth: 380, lineHeight: 1.6 }}>
              Plataforma corporativa para acompanhamento de contratos, parcelas,
              IPCA, Serasa e simulações financeiras em um único lugar.
            </p>
          </div>

          <div style={{ fontSize: 11, opacity: 0.5 }}>
            © {new Date().getFullYear()} UnyPay® Crédito. Todos os direitos reservados.
          </div>
        </aside>

        {/* Card de formulário */}
        <main
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 24px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "white",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: "36px 36px 32px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>
                {title}
              </h1>
              {subtitle && (
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                  {subtitle}
                </p>
              )}
            </div>
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
