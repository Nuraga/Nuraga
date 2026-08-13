import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu, Select, Dropdown, Typography, Flex, Spin } from "antd";
import type { MenuProps } from "antd";
import {
  ApartmentOutlined,
  AccountBookOutlined,
  AreaChartOutlined,
  BankOutlined,
  BarChartOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  CreditCardOutlined,
  DollarOutlined,
  DownOutlined,
  FileTextOutlined,
  FunnelPlotOutlined,
  HomeOutlined,
  ImportOutlined,
  LogoutOutlined,
  PictureOutlined,
  QrcodeOutlined,
  TabletOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UsergroupAddOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { useBranch } from "./BranchContext";
import { useBranchRoles, hasAnyRole } from "../auth/roles";
import type { Role } from "../api/types";
import NotificationBell from "./NotificationBell";

const { Header, Sider, Content } = Layout;

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  roles?: Role[];
  /** Hides the item for these roles even when `roles` is unset (open to everyone else). */
  excludeRoles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { key: "/", label: "Главная", icon: <HomeOutlined /> },
  {
    key: "/network-analytics",
    label: "Аналитика сети",
    icon: <AreaChartOutlined />,
    roles: ["OWNER", "SUPERADMIN"],
  },
  { key: "/branches", label: "Филиалы", icon: <BankOutlined />, roles: ["OWNER", "SUPERADMIN"] },
  {
    key: "/groups",
    label: "Группы",
    icon: <ApartmentOutlined />,
    // NANNY assists but isn't tied to a group's roster/data — her whole
    // scope is kiosk check-in/out + tasks (see ТЗ chat: "няне не доступны
    // группы").
    excludeRoles: ["NANNY"],
  },
  { key: "/staff", label: "Сотрудники", icon: <TeamOutlined /> },
  { key: "/shifts", label: "График смен", icon: <ClockCircleOutlined /> },
  {
    key: "/leads",
    label: "Лиды",
    icon: <FunnelPlotOutlined />,
    roles: ["OWNER", "BRANCH_MANAGER", "MANAGER"],
  },
  {
    key: "/tasks",
    label: "Задачи",
    icon: <CheckSquareOutlined />,
    // NANNY sees her own assigned tasks (StaffTasksPage falls back to
    // "мои задачи" for any non-management role); METHODIST assigns tasks
    // to TEACHER/NANNY like a manager (STAFF_TASK_ROLES in tasks.service.ts).
    roles: ["OWNER", "BRANCH_MANAGER", "TEACHER", "NANNY", "METHODIST"],
  },
  { key: "/my-qr", label: "Мой QR", icon: <QrcodeOutlined /> },
  {
    key: "/staff-attendance",
    label: "Посещаемость персонала",
    icon: <CalendarOutlined />,
    // METHODIST monitors TEACHER/NANNY kiosk attendance — see
    // STAFF_ATTENDANCE_MANAGE_ROLES in staff-attendance.service.ts.
    roles: ["OWNER", "BRANCH_MANAGER", "ACCOUNTANT", "METHODIST"],
  },
  {
    key: "/devices",
    label: "Устройства",
    icon: <TabletOutlined />,
    roles: ["OWNER", "BRANCH_MANAGER"],
  },
  { key: "/menu", label: "Меню", icon: <CoffeeOutlined /> },
  { key: "/photos", label: "Фотолента", icon: <PictureOutlined /> },
  {
    key: "/families",
    label: "Семьи",
    icon: <UsergroupAddOutlined />,
    roles: ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"],
  },
  {
    key: "/children",
    label: "Дети",
    icon: <UserOutlined />,
    roles: ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT", "TEACHER"],
  },
  {
    key: "/waitlist",
    label: "Очередь",
    icon: <UnorderedListOutlined />,
    roles: ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"],
  },
  {
    key: "/attendance",
    label: "Посещаемость",
    icon: <CalendarOutlined />,
    roles: ["OWNER", "BRANCH_MANAGER", "MANAGER", "TEACHER"],
  },
  {
    key: "/timesheets",
    label: "Табели",
    icon: <FileTextOutlined />,
    roles: ["OWNER", "BRANCH_MANAGER", "ACCOUNTANT"],
  },
  {
    key: "/tariffs",
    label: "Тарифы",
    icon: <DollarOutlined />,
    roles: ["OWNER", "SUPERADMIN"],
  },
  {
    key: "/services",
    label: "Услуги",
    icon: <CreditCardOutlined />,
    roles: ["OWNER", "BRANCH_MANAGER"],
  },
  {
    key: "/invoicing",
    label: "Начисления",
    icon: <AccountBookOutlined />,
    roles: ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"],
  },
  {
    key: "/dictionaries",
    label: "Справочники",
    icon: <BookOutlined />,
    roles: ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT", "SUPERADMIN"],
  },
  {
    key: "/import",
    label: "Импорт",
    icon: <ImportOutlined />,
    roles: ["OWNER", "BRANCH_MANAGER", "MANAGER"],
  },
  {
    key: "/reports",
    label: "Отчёты",
    icon: <BarChartOutlined />,
    roles: ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"],
  },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { branches, isLoading: branchesLoading, selectedBranchId, setSelectedBranchId } = useBranch();
  const branchRoles = useBranchRoles(selectedBranchId);
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = useMemo<MenuProps["items"]>(
    () =>
      NAV_ITEMS.filter(
        (item) =>
          (!item.roles || hasAnyRole(branchRoles, item.roles)) &&
          // Literal role membership only — NOT hasAnyRole, whose
          // hasNetworkAccess bypass would otherwise also hide this item
          // from OWNER/SUPERADMIN (who are never literally NANNY).
          !(item.excludeRoles && branchRoles.roles.some((r) => item.excludeRoles!.includes(r))),
      ).map((item) => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
      })),
    [branchRoles],
  );

  const selectedKey =
    NAV_ITEMS.find((item) => item.key !== "/" && location.pathname.startsWith(item.key))?.key ?? "/";

  const userMenuItems: MenuProps["items"] = [
    { key: "/profile", icon: <UserOutlined />, label: "Профиль" },
    { type: "divider" },
    { key: "logout", icon: <LogoutOutlined />, label: "Выйти" },
  ];

  if (branchesLoading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (branches.length === 0) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }} vertical gap={8}>
        <Typography.Title level={4}>Нет доступных филиалов</Typography.Title>
        <Typography.Text type="secondary">
          Обратитесь к администратору сети, чтобы получить доступ к филиалу.
        </Typography.Text>
      </Flex>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div
          style={{
            height: 48,
            margin: 12,
            color: "#fff",
            fontWeight: 600,
            fontSize: collapsed ? 14 : 18,
            textAlign: "center",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {collapsed ? "ДС" : "Детсад CRM"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: "#fff", padding: "0 16px", display: "flex", alignItems: "center", gap: 16 }}>
          <Select
            style={{ width: 260 }}
            value={selectedBranchId ?? undefined}
            onChange={setSelectedBranchId}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <div style={{ flex: 1 }} />
          <NotificationBell />
          <Dropdown
            menu={{
              items: userMenuItems,
              onClick: ({ key }) => {
                if (key === "logout") void logout();
                else navigate(key);
              },
            }}
          >
            <Flex align="center" gap={4} style={{ cursor: "pointer" }}>
              <UserOutlined />
              <Typography.Text>{user?.fullName}</Typography.Text>
              <DownOutlined style={{ fontSize: 10 }} />
            </Flex>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
