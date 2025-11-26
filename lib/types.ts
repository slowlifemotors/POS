// lib/types.ts

/**
 * ============================================================
 *  GLOBAL TYPE DEFINITIONS — POS SYSTEM SOURCE OF TRUTH
 * ============================================================
 * Every backend route and frontend component MUST use ONLY
 * the types defined here. These ensure the entire application
 * shares one consistent data model.
 *
 * This file deliberately avoids complex nesting, because a
 * flattened architecture results in fewer errors, easier
 * refactors, and cleaner API responses.
 * ============================================================
 */

/* ------------------------------------------------------------
 * StaffRecord — canonical staff type returned everywhere
 * ------------------------------------------------------------ */
export type StaffRecord = {
  id: number;
  name: string;
  username: string;

  // role reference
  role_id: number;

  /** normalized lower-case role name
   *  e.g. "owner" | "admin" | "manager" | "staff"
   */
  role: string;

  /** numeric permission level (e.g., 999 admin, 900 owner, 800 manager) */
  permissions_level: number;

  /** commission percentage for the staff member’s role */
  commission_rate: number;
};

/* ------------------------------------------------------------
 * RoleRecord — single role definition from roles table
 * ------------------------------------------------------------ */
export type RoleRecord = {
  id: number;
  name: string;               // normalized lower-case string
  permissions_level: number;  // numeric power level
  commission_rate: number;    // default commission for role
};

/* ------------------------------------------------------------
 * CommissionRate — used by /settings and admin tools
 * ------------------------------------------------------------ */
export type CommissionRate = {
  role: string;   // lower-case role name
  rate: number;   // percentage
};

/* ------------------------------------------------------------
 * Customer — returned by /api/customers
 * ------------------------------------------------------------ */
export type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  active: boolean;

  discount_id: number | null;
  discount?: Discount | null;
};

/* ------------------------------------------------------------
 * Discount — used by customers + purchases
 * ------------------------------------------------------------ */
export type Discount = {
  id: number;
  name: string;
  percent: number;   // e.g. 10 = 10%
};

/* ------------------------------------------------------------
 * Item — used in POS and inventory
 * ------------------------------------------------------------ */
export type Item = {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;

  /** visible only to privileged roles */
  cost_price?: number | null;

  barcode: string | null;
};

/* ------------------------------------------------------------
 * Session type — what /api/auth/session returns
 * ------------------------------------------------------------ */
export type Session = {
  staff: StaffRecord | null;
};

/* ------------------------------------------------------------
 * API Response Helpers
 * ------------------------------------------------------------ */
export type ApiResponse<T> = {
  error?: string;
  message?: string;
  [key: string]: any;
} & T;
