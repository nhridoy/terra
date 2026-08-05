import { Navigate, Outlet, useLocation } from "react-router";
import Spinner from "@/components/ui/Spinner";
import { useAuthStore } from "@/stores/auth/authStore";

interface AuthGuardProps {
  requireAuth: boolean;
}

export default function AuthGuard({ requireAuth }: AuthGuardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const location = useLocation();

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!requireAuth && isAuthenticated) {
    const from = (location.state as { from?: Location })?.from?.pathname;
    return <Navigate to={from || "/hosts"} replace />;
  }

  return <Outlet />;
}
