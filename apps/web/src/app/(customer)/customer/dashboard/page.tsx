import { ROUTES } from "@/shared/config";

const CUSTOMER_SECTIONS = [
  { label: "Book a Court", href: ROUTES.customer.book, desc: "Check availability and reserve a court" },
  { label: "Coaching Sessions", href: "#", desc: "Browse and enroll in upcoming sessions" },
  { label: "My Bookings", href: ROUTES.customer.bookings, desc: "View and manage your reservations" },
  { label: "My Level", href: "#", desc: "Track your club NTRP-style rating (1.5–5.5) and growth chart" },
] as const;

export default function CustomerDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">Welcome</h1>
        <p className="text-gray-500 text-sm mt-1">
          Your club portal — book courts, join sessions, track your progress.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CUSTOMER_SECTIONS.map((s) => (
          <a
            key={s.label}
            href={s.href}
            className="block p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-green-300 transition-all"
          >
            <h2 className="font-semibold text-green-800">{s.label}</h2>
            <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
