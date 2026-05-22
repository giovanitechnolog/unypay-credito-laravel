import { useCallback, useEffect, useState } from "react";
import { Head, usePage } from "@inertiajs/react";
import { Plus, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import UsersTable from "../Components/Users/UsersTable";
import UserFormModal from "../Components/Users/UserFormModal";
import DeleteUserModal from "../Components/Users/DeleteUserModal";
import { api, extractFirstError } from "../lib/api";
import type { PaginatedUsers, User } from "../types/user";
import type { PageSharedProps } from "../types/auth";

export default function UsersPage() {
  const { auth } = usePage<PageSharedProps>().props;
  const currentUserId = auth?.user?.id ?? null;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const fetchUsers = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedUsers>("/api/users", {
        params: { search: q, per_page: 100 },
      });
      setUsers(data.data);
    } catch (err) {
      toast.error(extractFirstError(err, "Erro ao carregar usuários."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounce simples do filtro de busca.
  useEffect(() => {
    const t = setTimeout(() => fetchUsers(search), 350);
    return () => clearTimeout(t);
  }, [search, fetchUsers]);

  function openCreate() {
    setSelectedUser(null);
    setFormOpen(true);
  }

  function openEdit(user: User) {
    setSelectedUser(user);
    setFormOpen(true);
  }

  function openDelete(user: User) {
    setUserToDelete(user);
    setDeleteOpen(true);
  }

  return (
    <UnyPayLayout>
      <Head title="Usuários" />

      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            borderBottom: "1px solid #e5e7eb",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "6px 10px",
                flex: 1,
                maxWidth: 360,
              }}
            >
              <Search size={14} color="#9ca3af" />
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  background: "transparent",
                }}
              />
            </div>

            <button
              onClick={() => fetchUsers(search)}
              title="Atualizar"
              style={{
                background: "white",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "8px 10px",
                cursor: "pointer",
                color: "#4b5563",
                display: "flex",
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <button
            onClick={openCreate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#1e2139",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={14} /> Novo usuário
          </button>
        </div>

        <UsersTable
          users={users}
          loading={loading}
          currentUserId={currentUserId}
          onEdit={openEdit}
          onDelete={openDelete}
        />
      </div>

      <UserFormModal
        open={formOpen}
        user={selectedUser}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchUsers(search)}
        onSuccess={(msg) => toast.success(msg)}
        onError={(msg) => toast.error(msg)}
      />

      <DeleteUserModal
        open={deleteOpen}
        user={userToDelete}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => fetchUsers(search)}
        onSuccess={(msg) => toast.success(msg)}
        onError={(msg) => toast.error(msg)}
      />
    </UnyPayLayout>
  );
}
