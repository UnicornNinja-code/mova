/*
 * userModel.ts
 * Backward-Compatible Wrapper over UserRepository in TypeScript
 */

import { userRepository } from "../repositories/userRepository.js";
import type { UserRole } from "../types/user.types.js";

export const UserModel = {
  findAll: () => userRepository.findAll(),
  findById: (id: number | string) => userRepository.findById(id),
  findByIdWithPassword: (id: number | string) => userRepository.findByIdWithPassword(id),
  findByEmail: (email: string) => userRepository.findByEmailOrUsername(email),
  findByEmailOrUsername: (identifier: string) => userRepository.findByEmailOrUsername(identifier),
  countActiveSuperadmins: () => userRepository.countActiveSuperadmins(),
  create: (data: { email: string; username?: string; password?: string; name: string; role?: UserRole; isActive?: boolean; firstLogin?: boolean }) =>
    userRepository.createUser(data),
  update: (id: number | string, data: { name?: string; email?: string; role?: UserRole }) =>
    userRepository.updateUser(id, data),
  updateStatus: (id: number | string, isActive: boolean) => userRepository.updateUserStatus(id, isActive),
  updateRole: (id: number | string, newRole: UserRole) => userRepository.updateUserRole(id, newRole),
  updatePassword: (id: number | string, hashedPassword: string, birthDate?: string | Date | null) =>
    userRepository.updatePassword(id, hashedPassword, birthDate),
  setFirstLoginDone: (id: number | string) => userRepository.setFirstLoginDone(id),
  delete: (id: number | string) => userRepository.deleteUser(id),
};
