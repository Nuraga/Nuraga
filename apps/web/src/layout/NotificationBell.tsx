import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Empty, List, Popover, Typography } from "antd";
import { BellOutlined, CheckOutlined } from "@ant-design/icons";
import { notificationsApi } from "../api/notifications";
import type { AppNotification } from "../api/types";

// In-app only — no email/SMS/push infra in this project (see DEPLOY.md).
// Polls like the "Сейчас в саду" list (staff-attendance) does, since
// there's no push/websocket channel to react to server-side events.
export default function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    refetchInterval: 30_000,
  });
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });
  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });

  const content = (
    <div style={{ width: 340 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Typography.Text strong>Уведомления</Typography.Text>
        {unreadCount > 0 && (
          <Button size="small" type="link" onClick={() => markAllRead.mutate()}>
            Прочитать все
          </Button>
        )}
      </div>
      <List
        style={{ maxHeight: 400, overflowY: "auto" }}
        dataSource={notifications}
        locale={{ emptyText: <Empty description="Уведомлений нет" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        renderItem={(n: AppNotification) => (
          <List.Item
            style={{ background: n.readAt ? undefined : "#e6f4ff", padding: 8, borderRadius: 4 }}
            actions={
              n.readAt
                ? []
                : [
                    <Button
                      key="read"
                      size="small"
                      type="text"
                      icon={<CheckOutlined />}
                      onClick={() => markRead.mutate(n.id)}
                    />,
                  ]
            }
          >
            <List.Item.Meta
              description={
                <>
                  <Typography.Text>{n.message}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(n.createdAt).toLocaleString("ru-RU")}
                  </Typography.Text>
                </>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen} placement="bottomRight">
      <Badge count={unreadCount} size="small">
        <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
      </Badge>
    </Popover>
  );
}
