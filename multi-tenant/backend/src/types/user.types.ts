/*
 * user.types.ts & auth.types.ts
 */

export type UserRole = "SUPERADMIN" | "MANAGEMENT" | "SUPERVISOR" | "RIDER";

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";

export interface User {
  id: number | string;
  tenant_id?: string;
  username?: string | null;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string | null;
  birth_date?: string | Date | null;
  status?: UserStatus;
  is_active?: boolean;
  avatar_url?: string | null;
  assigned_zone_id?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  last_login_at?: Date | string | null;
  [key: string]: any;
}

export interface UserSanitized {
  id: number | string;
  tenant_id?: string;
  username?: string | null;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  birth_date?: string | Date | null;
  status?: UserStatus;
  is_active?: boolean;
  avatar_url?: string | null;
  assigned_zone_id?: number | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  last_login_at?: Date | string | null;
  [key: string]: any;
}

export interface CreateUserDto {
  tenant_id?: string;
  username?: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string;
  birth_date?: string | Date | null;
  status?: UserStatus;
  is_active?: boolean;
  assigned_zone_id?: number | null;
  [key: string]: any;
}

export interface UpdateUserDto {
  tenant_id?: string;
  username?: string;
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  phone?: string;
  birth_date?: string | Date | null;
  status?: UserStatus;
  is_active?: boolean;
  assigned_zone_id?: number | null;
  [key: string]: any;
}

export interface JwtPayload {
  id: number | string;
  tenant_id?: string;
  name: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface LoginResponseData {
  user: UserSanitized;
  accessToken: string;
  refreshToken?: string;
}
