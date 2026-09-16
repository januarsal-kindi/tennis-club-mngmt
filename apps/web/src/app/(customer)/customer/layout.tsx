import { NavLink } from "@/shared/ui";
import { ROUTES } from "@/shared/config";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-green-600 text-white">
        <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <span className="font-bold text-white mr-4">🎾 Tennis Club</span>
          <NavLink href={ROUTES.customer.dashboard}>Home</NavLink>
        </nav>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">{children}</main>
    </div>
  );
}
