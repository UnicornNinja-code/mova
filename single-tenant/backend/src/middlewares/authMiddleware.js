import jwt from "jsonwebtoken";
import { env } from "../config/index.js";
import { UserModel } from "../models/userModel.js";

/**
 * Authentication Middleware:
 * 1. Verifies Bearer JWT token from Authorization header.
 * 2. Checks user existence and active status in DB.
 * 3. Injects sanitized user object to req.user.
 */
export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"] || req.headers["Authorization"];
        const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

        if (!token) {
            return res.status(401).json({
                success: false,
                msg: "Akses ditolak: Token autentikasi tidak ditemukan.",
            });
        }

        const decoded = jwt.verify(token, env.JWT_SECRET);

        const user = await UserModel.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                msg: "Sesi tidak valid: Pengguna tidak ditemukan.",
            });
        }

        if (user.is_active === false) {
            return res.status(403).json({
                success: false,
                msg: "Akun Anda dinonaktifkan. Silakan hubungi administrator sistem.",
            });
        }

        // OWASP/NIST Session Invalidation on Privilege/Role State Change
        const tokenAuthVersion = decoded.auth_version;
        const currentAuthVersion = user.auth_version || 1;
        const isRoleMismatched = decoded.role && decoded.role !== user.role;
        const isAuthVersionOutdated = tokenAuthVersion !== undefined && tokenAuthVersion < currentAuthVersion;

        if (isRoleMismatched || isAuthVersionOutdated) {
            return res.status(401).json({
                success: false,
                code: "SESSION_REVOKED",
                reason: "ROLE_CHANGED",
                previousRole: decoded.role || null,
                newRole: user.role,
                msg: "Sesi Anda telah diakhiri karena mutasi hak akses peran. Silakan login kembali.",
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            msg: "Token tidak valid atau telah kadaluarsa.",
            error: error.message,
        });
    }
};
