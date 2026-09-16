export const ROUTES = {
  login: "/login",
  admin: {
    root: "/admin",
    dashboard: "/admin/dashboard",
    courts: "/admin/courts",
  },
  customer: {
    root: "/customer",
    dashboard: "/customer/dashboard",
  },
} as const;
