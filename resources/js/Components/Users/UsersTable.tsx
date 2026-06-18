import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { User } from "../../types/user";

interface UsersTableProps {
  users: User[];
  loading: boolean;
  currentUserId?: number | null;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export default function UsersTable({ users, loading, currentUserId, onEdit, onDelete }: UsersTableProps) {
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
        Carregando usuários...
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
        Nenhum usuário encontrado.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            <Th style={{ width: 64 }}>Foto</Th>
            <Th>Nome</Th>
            <Th>E-mail</Th>
            <Th>Último acesso</Th>
            <Th style={{ width: 100, textAlign: "right" }}>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <Td>
                <Avatar name={u.name} photoUrl={u.photoUrl} />
              </Td>
              <Td>
                <strong style={{ color: "#111827" }}>{u.name}</strong>
              </Td>
              <Td>{u.email}</Td>
              <Td>{formatDate(u.lastSignedIn)}</Td>
              <Td style={{ textAlign: "right" }}>
                <button onClick={() => onEdit(u)} title="Editar" style={iconActionBtn}>
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => onDelete(u)}
                  title={currentUserId === u.id ? "Você não pode excluir seu próprio usuário" : "Excluir"}
                  disabled={currentUserId === u.id}
                  style={{
                    ...iconActionBtn,
                    color: currentUserId === u.id ? "#d1d5db" : "#b91c1c",
                    cursor: currentUserId === u.id ? "not-allowed" : "pointer",
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Avatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const initial = (name?.trim()?.charAt(0) || "U").toUpperCase();
  const [broken, setBroken] = useState(false);

  if (photoUrl && !broken) {
    return (
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <img
          src={photoUrl}
          alt=""
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "#1e2139",
        color: "white",
        fontWeight: 700,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

const iconActionBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#4b5563",
  padding: 6,
  borderRadius: 6,
  marginLeft: 4,
};

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 14px",
        fontSize: 11,
        fontWeight: 700,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td
      style={{
        padding: "12px 14px",
        color: "#374151",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "Nunca acessou";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}
