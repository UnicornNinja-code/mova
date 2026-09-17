/**
 * RBAC Role Authorization Middleware
 * Enforces role access boundaries (SUPERADMIN, MANAGEMENT, SUPERVISOR, RIDER).
 * @param {string[]|string} roles - Array of allowed roles or single role string
 */
export const checkRole = (roles) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                msg: "Autentikasi diperlukan sebelum memeriksa hak akses.",
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                msg: `Akses ditolak: Peran '${req.user.role}' tidak memiliki izin untuk fitur ini.`,
            });
        }

        next();
    };
};
