export type UserRole = "user" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
  lastSignedIn?: string;
}

export interface UserFormValues {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: UserRole;
}

export interface PaginatedUsers {
  data: User[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
