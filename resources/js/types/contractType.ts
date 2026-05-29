export interface ContractType {
  id: number;
  name: string;
  slug: string | null;
  is_active: boolean;
  contracts_count?: number;
  active_contracts_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ContractTypeFormValues {
  name: string;
  slug: string;
  is_active: boolean;
}

export interface PaginatedContractTypes {
  data: ContractType[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export type ContractTypeStatusFilter = "all" | "active" | "inactive";
