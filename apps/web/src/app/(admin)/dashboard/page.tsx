const ADMIN_SECTIONS = [
  { label: "Courts & Schedule", href: "#", desc: "Manage courts, weekly hours, blackout dates" },
  { label: "Coaching Sessions", href: "#", desc: "Create sessions, assign coaches, manage capacity" },
  { label: "Payments Queue", href: "#", desc: "Verify pending payments, waive fees" },
  { label: "Members & Coaches", href: "#", desc: "View directory, NTRP-style ratings, growth history" },
  { label: "Book on Behalf", href: "#", desc: "Book a court for a member or coach" },
] as const;

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your club operations.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADMIN_SECTIONS.map((s) => (
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
