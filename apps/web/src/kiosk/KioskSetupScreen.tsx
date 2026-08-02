import { useState } from "react";
import { Alert, Button, Card, Flex, Form, Input, Typography } from "antd";
import { useKioskAuth } from "./KioskAuthContext";
import { KioskApiError } from "../api/kioskClient";

// Entered once by whoever mounts the tablet, using the ID+secret shown when
// an OWNER/BRANCH_MANAGER provisioned this device from the regular staff app.
export default function KioskSetupScreen() {
  const { pair } = useKioskAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish(values: { deviceId: string; secret: string }) {
    setError(null);
    setLoading(true);
    try {
      await pair(values.deviceId.trim(), values.secret.trim());
    } catch (err) {
      setError(err instanceof KioskApiError ? err.message : "Не удалось подключить устройство");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Flex align="center" justify="center" style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Card style={{ width: 380 }}>
        <Typography.Title level={3} style={{ textAlign: "center", marginTop: 0 }}>
          Настройка киоска
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Введите ID устройства и секрет, выданные при создании киоска в разделе «Устройства».
        </Typography.Paragraph>

        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon />}

        <Form layout="vertical" onFinish={handleFinish} disabled={loading}>
          <Form.Item label="ID устройства" name="deviceId" rules={[{ required: true, message: "Укажите ID" }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item label="Секрет" name="secret" rules={[{ required: true, message: "Укажите секрет" }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Подключить
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Flex>
  );
}
