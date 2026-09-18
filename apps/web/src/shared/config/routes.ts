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
    book: "/customer/book",
    bookings: "/customer/bookings",
  },
} as const;
