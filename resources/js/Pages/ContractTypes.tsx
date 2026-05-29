import { useCallback, useEffect, useState } from "react";
import { Head } from "@inertiajs/react";
import { Plus, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import ContractTypesTable from "../Components/ContractTypes/ContractTypesTable";
import ContractTypeFormModal from "../Components/ContractTypes/ContractTypeFormModal";
import DeleteContractTypeModal from "../Components/ContractTypes/DeleteContractTypeModal";
import { api, extractFirstError } from "../lib/api";
import type { ContractType, PaginatedContractTypes } from "../types/contractType";

export default function ContractTypesPage() {
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<ContractType | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ContractType | null>(null);

  const fetchContractTypes = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedContractTypes>("/api/contract-types", {
        params: { search: q, per_page: 100 },
      });
      setContractTypes(data.data);
    } catch (err) {
      toast.error(extractFirstError(err, "Erro ao carregar tipos de contrato."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContractTypes();
  }, [fetchContractTypes]);

  // Debounce simples do filtro de busca.
  useEffect(() => {
    const t = setTimeout(() => fetchContractTypes(search), 350);
    return () => clearTimeout(t);
  }, [search, fetchContractTypes]);

  function openCreate() {
    setSelected(null);
    setFormOpen(true);
  }

  function openEdit(contractType: ContractType) {
    setSelected(contractType);
    setFormOpen(true);
  }

  function openDelete(contractType: ContractType) {
    setToDelete(contractType);
    setDeleteOpen(true);
  }

  return (
    <UnyPayLayout>
      <Head title="Tipos de Contrato" />

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
                placeholder="Buscar por nome ou identificador..."
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
              onClick={() => fetchContractTypes(search)}
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
            <Plus size={14} /> Novo tipo
          </button>
        </div>

        <ContractTypesTable
          contractTypes={contractTypes}
          loading={loading}
          onEdit={openEdit}
          onDelete={openDelete}
        />
      </div>

      <ContractTypeFormModal
        open={formOpen}
        contractType={selected}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchContractTypes(search)}
        onSuccess={(msg) => toast.success(msg)}
        onError={(msg) => toast.error(msg)}
      />

      <DeleteContractTypeModal
        open={deleteOpen}
        contractType={toDelete}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => fetchContractTypes(search)}
        onSuccess={(msg) => toast.success(msg)}
        onError={(msg) => toast.error(msg)}
      />
    </UnyPayLayout>
  );
}
