/**
 * Functional component for rendering a 404 Not Found page.
 * @returns JSX element representing the 404 Not Found page.
 */
import { Link } from "react-router-dom"
import { Home } from "lucide-react"

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="text-center">
        <h1 className="text-9xl font-bold" style={{ color: "var(--primary)" }}>
          404
        </h1>
        <h2 className="text-3xl font-semibold mt-4" style={{ color: "var(--text-primary)" }}>
          Page Not Found
        </h2>
        <p className="mt-2 mb-8" style={{ color: "var(--text-secondary)" }}>
          The page you are looking for doesn't exist or has been moved.
        </p>

        <Link
          to="/"
          className="inline-flex items-center px-6 py-3 font-medium rounded-md transition duration-150 ease-in-out"
          style={{ backgroundColor: "var(--primary)", color: "white" }}
        >
          <Home className="h-5 w-5 mr-2" />
          Go Home
        </Link>
      </div>
    </div>
  )
}

