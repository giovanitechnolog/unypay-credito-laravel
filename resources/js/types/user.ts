export type UserRole = "user" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
  document?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  photo?: string | null;
  photoUrl?: string | null;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
  lastSignedIn?: string;
}

export interface UserFormValues {
  name: string;
  email: string;
  document: string;
  birthDate: string;
  phone: string;
  password: string;
  passwordConfirmation: string;
  role: UserRole;
  photo?: File | null;
}

export interface PaginatedUsers {
  data: User[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
