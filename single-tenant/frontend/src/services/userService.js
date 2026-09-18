import { api } from "./api";

export const userService = {
  /**
   * Fetch paginated list of users with optional filtering
   * @param {Object} params - { page, limit, search, role, status }
   */
  async getUsers(params = {}) {
    const response = await api.get("/api/users", { params });
    return response.data;
  },

  /**
   * Fetch single user details by UUID
   * @param {string} id
   */
  async getUserById(id) {
    const response = await api.get(`/api/users/${id}`);
    return response.data?.data || response.data;
  },

  /**
   * Create a new user (with invitation link / email flow)
   * @param {Object} userData - { name, email, username, phone, role, birth_date }
   */
  async createUser(userData) {
    const response = await api.post("/api/users", userData);
    return response.data?.data || response.data;
  },

  /**
   * Update existing user basic profile / role
   * @param {string} id
   * @param {Object} updateData - { name, email, phone, role, birth_date }
   */
  async updateUser(id, updateData) {
    const response = await api.put(`/api/users/${id}`, updateData);
    return response.data?.data || response.data;
  },

  /**
   * Toggle user account active status (suspend / reactivate)
   * @param {string} id
   * @param {boolean} isActive
   */
  async setUserStatus(id, isActive) {
    const response = await api.patch(`/api/users/${id}/status`, { is_active: isActive });
    return response.data?.data || response.data;
  },

  /**
   * Resend / regenerate account activation link
   * @param {string} id
   */
  async resendActivation(id) {
    const response = await api.post(`/api/users/${id}/resend-activation`);
    return response.data?.data || response.data;
  },

  /**
   * Revoke all active refresh sessions for a user
   * @param {string} id
   */
  async revokeSessions(id) {
    const response = await api.post(`/api/users/${id}/revoke-sessions`);
    return response.data?.data || response.data;
  },

  /**
   * Transition / change user role with mandatory reason & active session revocation
   * @param {string} id
   * @param {Object} transitionData - { newRole, reason }
   */
  async changeUserRole(id, { newRole, reason }) {
    const response = await api.post(`/api/users/${id}/change-role`, { newRole, reason });
    return response.data?.data || response.data;
  },

  /**
   * Delete a user permanently
   * @param {string} id
   */
  async deleteUser(id) {
    const response = await api.delete(`/api/users/${id}`);
    return response.data?.data || response.data;
  },

  /**
   * Fetch current authenticated user profile
   */
  async getProfile() {
    const response = await api.get("/api/users/profile");
    return response.data?.data || response.data?.user || response.data;
  },

  /**
   * Update current authenticated user profile (name, phone, birth_date)
   * @param {Object} profileData
   */
  async updateProfile(profileData) {
    const response = await api.put("/api/users/profile", profileData);
    return response.data?.data || response.data?.user || response.data;
  },

  /**
   * Change current authenticated user password
   * @param {Object} passwordData - { currentPassword, newPassword }
   */
  async changePassword(passwordData) {
    const response = await api.put("/api/users/change-password", passwordData);
    return response.data;
  },
};
