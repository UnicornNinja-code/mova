/*
 * crypto.ts
 * Native High-Performance Password & Hash Utilities powered by Bun 1.4 Native API
 * Provides native Rust/C-level Bcrypt hashing & verification with backward compatibility.
 */

import bcrypt from "bcryptjs";

/**
 * Hash password securely with Bcrypt cost factor 10 using native Bun.password
 */
export const hashPassword = async (password: string): Promise<string> => {
  if (typeof Bun !== "undefined" && Bun.password) {
    return await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
  }
  return await bcrypt.hash(password, 10);
};

/**
 * Verify password against Bcrypt hash using native Bun.password
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  if (typeof Bun !== "undefined" && Bun.password) {
    return await Bun.password.verify(password, hash);
  }
  return await bcrypt.compare(password, hash);
};
