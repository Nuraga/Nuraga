import { Card, Typography } from "antd";
import { useAuth } from "../auth/AuthContext";
import { useBranch } from "../layout/BranchContext";

export default function HomePage() {
  const { user } = useAuth();
  const { selectedBranch } = useBranch();

  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Добро пожаловать, {user?.fullName}
      </Typography.Title>
      <Typography.Paragraph>
        Текущий филиал: <strong>{selectedBranch?.name ?? "—"}</strong>
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        Используйте меню слева для перехода к филиалам, группам, семьям, детям, посещаемости и
        отчётам.
      </Typography.Paragraph>
    </Card>
  );
}
