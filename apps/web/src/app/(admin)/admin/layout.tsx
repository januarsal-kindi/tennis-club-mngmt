import { LogoutButton, NavLink } from "@/shared/ui";
import { ROUTES } from "@/shared/config";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-green-800 text-white">
        <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <span className="font-bold text-white mr-4">🎾 Tennis Club — Admin</span>
          <NavLink href={ROUTES.admin.dashboard}>Dashboard</NavLink>
          <NavLink href={ROUTES.admin.courts}>Courts</NavLink>
          <LogoutButton />
        </nav>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">{children}</main>
    </div>
  );
}
