import { Flex, Spin } from "antd";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Like ProtectedRoute, plus a check that this is actually a parent session
// (not a staff account) — staff users get bounced to their own home instead.
export default function ParentProtectedRoute() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (!user?.parentProfile) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
