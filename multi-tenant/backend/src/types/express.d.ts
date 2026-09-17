/*
 * express.d.ts
 * Express Request Type Augmentation for Koling App
 */

import { User } from "./user.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: User | any;
    }
  }
}

export {};
