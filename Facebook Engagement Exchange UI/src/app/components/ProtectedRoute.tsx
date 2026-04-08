import { Navigate, Outlet } from "react-router";
import { getToken } from "../services/api";

/**
 * Wrapper for all authenticated app routes. Sends guests to /login.
 */
export function ProtectedRoute() {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
