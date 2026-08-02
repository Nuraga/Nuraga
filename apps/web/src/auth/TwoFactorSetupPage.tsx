import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Flex, Form, Image, Input, Spin, Typography } from "antd";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";

// Mandatory for Owner/Accountant/Superadmin (NFR 10.3) — routed here right
// after a login that returns totpSetupRequired: true.
export default function TwoFactorSetupPage() {
  const navigate = useNavigate();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authApi
      .setup2fa()
      .then((res) => setQrCodeDataUrl(res.qrCodeDataUrl))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Не удалось начать настройку"));
  }, []);

  async function handleConfirm(values: { code: string }) {
    setError(null);
    setLoading(true);
    try {
      await authApi.enable2fa(values.code);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Неверный код");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Flex align="center" justify="center" style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Card style={{ width: 400 }}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Настройка двухфакторной аутентификации
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Для вашей роли обязательна двухфакторная аутентификация. Отсканируйте QR-код в приложении
          аутентификатора (Google Authenticator, Яндекс Ключ и т. п.) и введите код для подтверждения.
        </Typography.Paragraph>

        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon />}

        {qrCodeDataUrl ? (
          <Flex justify="center" style={{ marginBottom: 16 }}>
            <Image src={qrCodeDataUrl} alt="QR-код" width={200} preview={false} />
          </Flex>
        ) : (
          !error && (
            <Flex justify="center" style={{ marginBottom: 16 }}>
              <Spin />
            </Flex>
          )
        )}

        <Form layout="vertical" onFinish={handleConfirm} disabled={loading || !qrCodeDataUrl}>
          <Form.Item
            label="Код из приложения"
            name="code"
            rules={[{ required: true, len: 6, message: "Код состоит из 6 цифр" }]}
          >
            <Input autoFocus maxLength={6} inputMode="numeric" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Подтвердить и продолжить
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Flex>
  );
}
