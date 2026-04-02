/**
 * Permission bits/constants for the application.
 * These can be used with the requirePermission middleware.
 */
export const PERMISSIONS = {
  // User Management
  USERS_VIEW: "users:view",
  USERS_MANAGE: "users:manage",
  
  // Dashboard / Settings
  SETTINGS_VIEW: "settings:view",
  SETTINGS_MANAGE: "settings:manage",
  
  // Services
  SERVICES_VIEW: "services:view",
  SERVICES_MANAGE: "services:manage",
  
  // Orders
  ORDERS_VIEW: "orders:view",
  ORDERS_MANAGE: "orders:manage",
  
  // Leads
  LEADS_VIEW: "leads:view",
  LEADS_MANAGE: "leads:manage",
  
  // Employees
  EMPLOYEES_VIEW: "employees:view",
  EMPLOYEES_MANAGE: "employees:manage",
};

/**
 * Role definitions and their associated permissions.
 */
export const ROLES = {
  admin: {
    name: "Admin",
    permissions: Object.values(PERMISSIONS), // Admin has all permissions
  },
  user: {
    name: "User",
    permissions: [
      PERMISSIONS.SERVICES_VIEW,
    ],
  },
  employee: {
    name: "Employee",
    permissions: [
      PERMISSIONS.SERVICES_VIEW,
      PERMISSIONS.ORDERS_VIEW,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.LEADS_VIEW,
      PERMISSIONS.LEADS_MANAGE,
    ],
  },
};

/**
 * Helper to check if a role has a specific permission.
 */
export const hasPermission = (role, permission) => {
  const roleData = ROLES[role];
  if (!roleData) return false;
  return roleData.permissions.includes(permission);
};
