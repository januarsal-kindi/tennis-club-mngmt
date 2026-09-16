export const ROUTES = {
  login: "/login",
  admin: {
    root: "/admin",
    dashboard: "/admin/dashboard",
  },
  customer: {
    root: "/customer",
    dashboard: "/customer/dashboard",
  },
} as const;
