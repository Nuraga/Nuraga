import { useQuery } from "@tanstack/react-query";
import { Card, Descriptions, List, Skeleton, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { parentPortalApi } from "../api/parentPortal";
import { formatMinor } from "../api/types";

const CHILD_STATUS_LABELS: Record<string, string> = {
  WAITLIST: "В очереди",
  ENROLLED: "Зачислен",
  SUSPENDED: "Приостановлен",
  DISCHARGED: "Отчислен",
};

export default function ParentHomePage() {
  const navigate = useNavigate();
  const { data: family, isLoading: familyLoading } = useQuery({
    queryKey: ["parent", "me"],
    queryFn: parentPortalApi.me,
  });
  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ["parent", "balance"],
    queryFn: parentPortalApi.balance,
  });

  if (familyLoading) return <Skeleton active />;

  return (
    <>
      <Typography.Title level={4}>Добро пожаловать{family?.name ? `, ${family.name}` : ""}</Typography.Title>

      <Card style={{ marginBottom: 16 }} loading={balanceLoading}>
        <Descriptions column={1}>
          <Descriptions.Item label="Баланс">
            <Typography.Text
              strong
              style={{ color: (balance?.balanceMinor ?? 0) < 0 ? "#cf1322" : "#3f8600" }}
            >
              {formatMinor(balance?.balanceMinor ?? 0)}
            </Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Дети">
        <List
          dataSource={family?.children ?? []}
          locale={{ emptyText: "Нет данных" }}
          renderItem={(child) => (
            <List.Item
              onClick={() => navigate("/parent/attendance")}
              style={{ cursor: "pointer" }}
            >
              <List.Item.Meta
                title={child.fullName}
                description={<Tag>{CHILD_STATUS_LABELS[child.status] ?? child.status}</Tag>}
              />
            </List.Item>
          )}
        />
      </Card>
    </>
  );
}
