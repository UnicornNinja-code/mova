import express from "express";
import {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    setUserStatus,
    deleteUser,
    getProfile,
    updateProfile,
    changePassword,
    resendActivation,
    revokeUserSessions,
    changeUserRole,
} from "../controllers/userController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// All user routes require authentication
router.use(authenticateToken);

// 1. Self Profile Operations (All Authenticated Users)
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/change-password", changePassword);

// 2. User Listing (SUPERADMIN, MANAGEMENT, and SUPERVISOR-scoped)
router.get("/", checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]), getAllUsers);

// 3. User Creation (SUPERADMIN & MANAGEMENT with Hierarchy Guard)
router.post("/", checkRole(["SUPERADMIN", "MANAGEMENT"]), createUser);

// 4. User Details (SUPERADMIN, MANAGEMENT, and SUPERVISOR-scoped)
router.get("/:id", checkRole(["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"]), getUserById);

// 5. Update User Profile (IDOR Protection & Hierarchy Guard in Service)
router.put("/:id", updateUser);

// 6. Explicit Role Transition Flow (SUPERADMIN & MANAGEMENT with Hierarchy Guard & Session Revocation)
router.post("/:id/change-role", checkRole(["SUPERADMIN", "MANAGEMENT"]), changeUserRole);
router.put("/:id/role", checkRole(["SUPERADMIN", "MANAGEMENT"]), changeUserRole);

// 6. Toggle User Active Status (SUPERADMIN & MANAGEMENT with Hierarchy Guard)
router.patch("/:id/status", checkRole(["SUPERADMIN", "MANAGEMENT"]), setUserStatus);

// 7. Resend Account Activation Token (SUPERADMIN & MANAGEMENT)
router.post("/:id/resend-activation", checkRole(["SUPERADMIN", "MANAGEMENT"]), resendActivation);

// 8. Revoke User Active Sessions (SUPERADMIN & MANAGEMENT)
router.post("/:id/revoke-sessions", checkRole(["SUPERADMIN", "MANAGEMENT"]), revokeUserSessions);

// 9. Delete User (SUPERADMIN & MANAGEMENT with Hierarchy Guard)
router.delete("/:id", checkRole(["SUPERADMIN", "MANAGEMENT"]), deleteUser);

export default router;
