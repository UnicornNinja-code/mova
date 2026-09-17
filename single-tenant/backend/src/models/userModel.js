/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   UserModel (Backward-Compatible Wrapper over UserRepository)
 */

import { userRepository } from "../repositories/userRepository.js";

export const UserModel = {
  findAll: () => userRepository.findAll(),
  findById: (id) => userRepository.findById(id),
  findByIdWithPassword: (id) => userRepository.findByIdWithPassword(id),
  findByEmail: (email) => userRepository.findByEmailOrUsername(email),
  findByEmailOrUsername: (identifier) => userRepository.findByEmailOrUsername(identifier),
  create: (data) => userRepository.createUser(data),
  update: (id, data) => userRepository.updateUser(id, data),
  updateStatus: (id, isActive) => userRepository.updateUserStatus(id, isActive),
  updateRole: (id, newRole) => userRepository.updateUserRole(id, newRole),
  updatePassword: (id, hashedPassword) => userRepository.updatePassword(id, hashedPassword),
  updateFirstLoginPassword: (id, hashedPassword) => userRepository.updateFirstLoginPassword(id, hashedPassword),
  activateUser: (id, data) => userRepository.activateUser(id, data),
  delete: (id) => userRepository.deleteUser(id),
};