import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0C1117", color: "#E2E8F0" }}>
      <div className="text-center">
        <div className="text-6xl font-bold font-mono text-gray-700 mb-4">404</div>
        <p className="text-gray-500 mb-6">This page doesn't exist</p>
        <Link href="/dashboard" className="bg-brand-700 hover:bg-brand-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors inline-block">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
