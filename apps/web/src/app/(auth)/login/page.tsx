/**
 * Login page — stub. Replace form action with real auth (Auth.js / Better Auth).
 */
export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-green-700">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-green-800">Tennis Club</h1>
          <p className="text-sm text-gray-500">Sign in to your portal</p>
        </div>
        <form className="space-y-4" action="#" method="post">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
          >
            Sign in
          </button>
        </form>
        <p className="text-center text-xs text-gray-400">
          Admins and members/coaches are redirected to their portal automatically.
        </p>
      </div>
    </main>
  );
}
