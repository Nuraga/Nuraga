import { useQuery } from "@tanstack/react-query";
import { Card, List, Skeleton, Typography } from "antd";
import { parentPortalApi } from "../api/parentPortal";

export default function ParentProfilePage() {
  const { data: family, isLoading } = useQuery({ queryKey: ["parent", "me"], queryFn: parentPortalApi.me });

  if (isLoading) return <Skeleton active />;

  return (
    <>
      <Typography.Title level={4}>Профиль</Typography.Title>

      <Card title="Семья" style={{ marginBottom: 16 }}>
        <Typography.Text>{family?.name}</Typography.Text>
      </Card>

      <Card title="Родители" style={{ marginBottom: 16 }}>
        <List
          dataSource={family?.parents ?? []}
          renderItem={(p) => (
            <List.Item>
              <List.Item.Meta
                title={p.fullName}
                description={[p.relationship, p.phone, p.email].filter(Boolean).join(" · ")}
              />
            </List.Item>
          )}
        />
      </Card>

      <Card title="Дети">
        <List
          dataSource={family?.children ?? []}
          renderItem={(c) => (
            <List.Item>
              <List.Item.Meta
                title={c.fullName}
                description={new Date(c.birthDate).toLocaleDateString("ru-RU")}
              />
            </List.Item>
          )}
        />
      </Card>
    </>
  );
}
