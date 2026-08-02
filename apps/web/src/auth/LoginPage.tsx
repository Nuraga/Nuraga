import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Flex, Form, Input, Typography } from "antd";
import { useAuth } from "./AuthContext";
import { ApiError } from "../api/client";

export default function LoginPage() {
  const { login, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCredentials(values: { identifier: string; password: string }) {
    setError(null);
    setLoading(true);
    try {
      const result = await login(values.identifier, values.password);
      if (result.status === "mfa_required") {
        setMfaToken(result.mfaToken);
        setStep("code");
        return;
      }
      if (result.isParent) {
        navigate("/parent", { replace: true });
      } else {
        navigate(result.totpSetupRequired ? "/setup-2fa" : "/", { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  async function handleCode(values: { code: string }) {
    if (!mfaToken) return;
    setError(null);
    setLoading(true);
    try {
      const { isParent } = await verifyTwoFactor(mfaToken, values.code);
      navigate(isParent ? "/parent" : "/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Неверный код");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Flex align="center" justify="center" style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ textAlign: "center", marginTop: 0 }}>
          Детсад CRM
        </Typography.Title>

        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon />}

        {step === "credentials" ? (
          <Form layout="vertical" onFinish={handleCredentials} disabled={loading}>
            <Form.Item
              label="Email или телефон"
              name="identifier"
              rules={[{ required: true, message: "Укажите email или телефон" }]}
            >
              <Input autoFocus autoComplete="username" />
            </Form.Item>
            <Form.Item
              label="Пароль"
              name="password"
              rules={[{ required: true, message: "Введите пароль" }]}
            >
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block loading={loading}>
                Войти
              </Button>
            </Form.Item>
          </Form>
        ) : (
          <Form layout="vertical" onFinish={handleCode} disabled={loading}>
            <Typography.Paragraph type="secondary">
              Введите 6-значный код из приложения аутентификатора
            </Typography.Paragraph>
            <Form.Item
              label="Код"
              name="code"
              rules={[{ required: true, len: 6, message: "Код состоит из 6 цифр" }]}
            >
              <Input autoFocus maxLength={6} inputMode="numeric" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block loading={loading}>
                Подтвердить
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </Flex>
  );
}
