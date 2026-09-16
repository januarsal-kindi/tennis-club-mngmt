import { redirect } from "next/navigation";

/** Middleware handles role-based routing; this is a fallback. */
export default function RootPage() {
  redirect("/login");
}
