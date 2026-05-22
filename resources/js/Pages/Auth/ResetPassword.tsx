import { FormEvent, useState } from "react";
import { useForm } from "@inertiajs/react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import AuthLayout from "../../Components/AuthLayout";
import type { ResetPasswordPayload } from "../../types/auth";

interface ResetPasswordProps {
  token: string;
  email: string;
}

export default function ResetPassword({ token, email }: ResetPasswordProps) {
  const [showPassword, setShowPassword] = useState(false);

  const { data, setData, post, processing, errors, reset } = useForm<ResetPasswordPayload>({
    token,
    email,
    password: "",
    password_confirmation: "",
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    post("/reset-password", {
      onFinish: () => reset("password", "password_confirmation"),
    });
  }

  return (
    <AuthLayout
      title="Definir nova senha"
      subtitle="Escolha uma senha segura com pelo menos 8 caracteres."
      pageTitle="Redefinir senha"
    >
      <form onSubmit={submit} noValidate>
        <Field label="E-mail" icon={<Mail size={16} />}>
          <input
            type="email"
            value={data.email}
            onChange={(e) => setData("email", e.target.value)}
            required
            style={inputStyle}
          />
        </Field>
        {errors.email && <Err>{errors.email}</Err>}

        <Field
          label="Nova senha"
          icon={<Lock size={16} />}
          style={{ marginTop: 16 }}
          right={
            <button type="button" style={iconBtn} onClick={() => setShowPassword((s) => !s)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        >
          <input
            type={showPassword ? "text" : "password"}
            value={data.password}
            onChange={(e) => setData("password", e.target.value)}
            required
            style={inputStyle}
          />
        </Field>
        {errors.password && <Err>{errors.password}</Err>}

        <Field label="Confirmar nova senha" icon={<Lock size={16} />} style={{ marginTop: 16 }}>
          <input
            type={showPassword ? "text" : "password"}
            value={data.password_confirmation}
            onChange={(e) => setData("password_confirmation", e.target.value)}
            required
            style={inputStyle}
          />
        </Field>

        <button
          type="submit"
          disabled={processing}
          style={{
            marginTop: 22,
            width: "100%",
            padding: "11px 16px",
            background: processing ? "#4b4f78" : "#1e2139",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: processing ? "not-allowed" : "pointer",
          }}
        >
          {processing ? "Salvando..." : "Redefinir senha"}
        </button>
      </form>
    </AuthLayout>
  );
}

/* ---------- helpers ---------- */
const inputStyle: React.CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  padding: "10px 0",
  fontSize: 14,
  background: "transparent",
};
const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#6b7280",
  display: "flex",
  padding: 4,
};

function Field({
  label,
  icon,
  right,
  children,
  style,
}: {
  label: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        {label}
      </label>
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
        {children}
        {right}
      </div>
    </div>
  );
}

function Err({ children }: { children: React.ReactNode }) {
  return <p style={{ marginTop: 6, color: "#b91c1c", fontSize: 12 }}>{children}</p>;
}
