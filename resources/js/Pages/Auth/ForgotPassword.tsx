import { FormEvent } from "react";
import { Link, useForm } from "@inertiajs/react";
import { Mail, ArrowLeft } from "lucide-react";
import AuthLayout from "../../Components/AuthLayout";
import type { ForgotPasswordPayload } from "../../types/auth";

interface ForgotPasswordProps {
  status?: string;
}

export default function ForgotPassword({ status }: ForgotPasswordProps) {
  const { data, setData, post, processing, errors } = useForm<ForgotPasswordPayload>({
    email: "",
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    post("/forgot-password");
  }

  return (
    <AuthLayout
      title="Recuperar acesso"
      subtitle="Informe seu e-mail e enviaremos um link para redefinir sua senha."
      pageTitle="Recuperar senha"
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

      <form onSubmit={submit} noValidate>
        <label
          htmlFor="email"
          style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}
        >
          E-mail
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
          <Mail size={16} color="#9ca3af" />
          <input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => setData("email", e.target.value)}
            required
            placeholder="seu@email.com"
            style={{ flex: 1, border: "none", outline: "none", padding: "10px 0", fontSize: 14 }}
          />
        </div>
        {errors.email && (
          <p style={{ marginTop: 6, color: "#b91c1c", fontSize: 12 }}>{errors.email}</p>
        )}

        <button
          type="submit"
          disabled={processing}
          style={{
            marginTop: 20,
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
          {processing ? "Enviando..." : "Enviar link de recuperação"}
        </button>

        <Link
          href="/login"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 18,
            fontSize: 13,
            color: "#6b7280",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} /> Voltar ao login
        </Link>
      </form>
    </AuthLayout>
  );
}
