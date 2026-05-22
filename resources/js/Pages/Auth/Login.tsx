import { FormEvent, useState } from "react";
import { Link, useForm } from "@inertiajs/react";
import { Eye, EyeOff, Lock, Mail, AlertCircle } from "lucide-react";
import AuthLayout from "../../Components/AuthLayout";
import type { LoginPayload } from "../../types/auth";

interface LoginProps {
  canResetPassword?: boolean;
  status?: string;
}

export default function Login({ canResetPassword = true, status }: LoginProps) {
  const [showPassword, setShowPassword] = useState(false);

  const { data, setData, post, processing, errors, reset } = useForm<LoginPayload>({
    email: "",
    password: "",
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    post("/login", {
      onFinish: () => reset("password"),
    });
  }

  const generalError = errors.email && !errors.password ? errors.email : "";

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse a plataforma com suas credenciais corporativas."
      pageTitle="Login"
    >
      {status && (
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {status}
        </div>
      )}

      {generalError && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{generalError}</span>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <FieldLabel htmlFor="email">E-mail</FieldLabel>
        <InputWithIcon icon={<Mail size={16} />}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={data.email}
            onChange={(e) => setData("email", e.target.value)}
            placeholder="seu@email.com"
            style={inputStyle}
          />
        </InputWithIcon>

        <FieldLabel htmlFor="password" style={{ marginTop: 16 }}>
          Senha
        </FieldLabel>
        <InputWithIcon
          icon={<Lock size={16} />}
          right={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={iconButtonStyle}
              aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        >
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={data.password}
            onChange={(e) => setData("password", e.target.value)}
            placeholder="••••••••"
            style={inputStyle}
          />
        </InputWithIcon>
        {errors.password && <FieldError>{errors.password}</FieldError>}

        {canResetPassword && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 16,
              marginBottom: 20,
            }}
          >
            <Link
              href="/forgot-password"
              style={{
                fontSize: 13,
                color: "#1e2139",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Esqueci minha senha
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={processing}
          style={{
            width: "100%",
            padding: "11px 16px",
            background: processing ? "#4b4f78" : "#1e2139",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: processing ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {processing ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </AuthLayout>
  );
}

/* ---------- helpers visuais locais ---------- */

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  fontSize: 14,
  background: "transparent",
  color: "#111827",
  padding: "10px 0",
};

const iconButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#6b7280",
  padding: 4,
  display: "flex",
};

function FieldLabel({ children, htmlFor, style }: { children: React.ReactNode; htmlFor?: string; style?: React.CSSProperties }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 600,
        color: "#374151",
        marginBottom: 6,
        ...style,
      }}
    >
      {children}
    </label>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ marginTop: 6, marginBottom: 0, color: "#b91c1c", fontSize: 12 }}>{children}</p>
  );
}

function InputWithIcon({
  icon,
  right,
  children,
}: {
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        border: "1px solid #d1d5db",
        borderRadius: 8,
        padding: "0 12px",
        background: "white",
      }}
    >
      {icon && <span style={{ color: "#9ca3af", display: "flex" }}>{icon}</span>}
      <div style={{ flex: 1 }}>{children}</div>
      {right}
    </div>
  );
}
