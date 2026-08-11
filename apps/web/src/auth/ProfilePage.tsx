import { useState } from "react";
import { Alert, Button, Card, Form, Input, Typography, message } from "antd";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "./AuthContext";

// Self-service password change (see auth.controller.ts) — there's no
// "forgot password" email flow yet, so this is the only way a user who
// knows their current password can rotate it (e.g. superadmin off the
// seeded default). Succeeding revokes every other session server-side, so
// we log the user out here too and send them back to /login.
export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  async function handleSubmit(values: { oldPassword: string; newPassword: string }) {
    setError(null);
    setLoading(true);
    try {
      await authApi.changePassword(values.oldPassword, values.newPassword);
      message.success("Пароль изменён. Войдите заново.");
      form.resetFields();
      await logout();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сменить пароль");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Typography.Title level={4}>Профиль</Typography.Title>

      <Card title="Учётная запись" style={{ marginBottom: 16, maxWidth: 480 }}>
        <Typography.Paragraph>
          <Typography.Text type="secondary">Имя: </Typography.Text>
          {user?.fullName}
        </Typography.Paragraph>
        {user?.email && (
          <Typography.Paragraph>
            <Typography.Text type="secondary">Email: </Typography.Text>
            {user.email}
          </Typography.Paragraph>
        )}
        {user?.phone && (
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <Typography.Text type="secondary">Телефон: </Typography.Text>
            {user.phone}
          </Typography.Paragraph>
        )}
      </Card>

      <Card title="Смена пароля" style={{ maxWidth: 480 }}>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon />}

        <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={loading}>
          <Form.Item
            label="Текущий пароль"
            name="oldPassword"
            rules={[{ required: true, message: "Введите текущий пароль" }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            label="Новый пароль"
            name="newPassword"
            rules={[
              { required: true, message: "Введите новый пароль" },
              { min: 6, message: "Минимум 6 символов" },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="Повторите новый пароль"
            name="newPasswordConfirm"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Повторите новый пароль" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                  return Promise.reject(new Error("Пароли не совпадают"));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading}>
              Сменить пароль
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </>
  );
}
