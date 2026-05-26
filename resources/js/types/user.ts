export type UserRole = "user" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
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
  password: string;
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
