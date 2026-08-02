import { Flex, Layout, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarOutlined,
  DollarOutlined,
  HomeOutlined,
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";

const { Header, Content, Footer } = Layout;

const NAV_ITEMS = [
  { key: "/parent", label: "Главная", icon: <HomeOutlined /> },
  { key: "/parent/billing", label: "Счета", icon: <DollarOutlined /> },
  { key: "/parent/attendance", label: "Посещаемость", icon: <CalendarOutlined /> },
  { key: "/parent/profile", label: "Профиль", icon: <UserOutlined /> },
];

// Deliberately does NOT use AppLayout/BranchContext — a parent session has
// no branch grants at all (see ParentProtectedRoute). Mobile-first per ТЗ
// §7.1: top bar + bottom tab bar instead of a desktop sidebar.
export default function ParentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div>
          <Typography.Text strong>Детсад CRM</Typography.Text>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {user?.fullName}
          </Typography.Text>
        </div>
        <LogoutOutlined style={{ fontSize: 18, cursor: "pointer" }} onClick={() => void logout()} />
      </Header>

      <Content style={{ padding: 16, paddingBottom: 80, maxWidth: 640, margin: "0 auto", width: "100%" }}>
        <Outlet />
      </Content>

      <Footer
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 0,
          background: "#fff",
          borderTop: "1px solid #f0f0f0",
        }}
      >
        <Flex justify="space-around">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.key;
            return (
              <Flex
                key={item.key}
                vertical
                align="center"
                gap={2}
                onClick={() => navigate(item.key)}
                style={{
                  padding: "8px 0",
                  flex: 1,
                  cursor: "pointer",
                  color: active ? "#2563eb" : "rgba(0,0,0,0.65)",
                }}
              >
                {item.icon}
                <Typography.Text style={{ fontSize: 11, color: "inherit" }}>{item.label}</Typography.Text>
              </Flex>
            );
          })}
        </Flex>
      </Footer>
    </Layout>
  );
}
