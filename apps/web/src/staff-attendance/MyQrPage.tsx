import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Flex, Image, Spin, Typography } from "antd";
import { staffAttendanceApi } from "../api/staffAttendance";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

// Polled every 30s, well inside the backend's 45s token TTL, so the code on
// screen is always valid by the time it reaches the kiosk's camera.
export default function MyQrPage() {
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-checkin-token", branchId],
    queryFn: () => staffAttendanceApi.myCheckinToken(branchId),
    enabled: Boolean(branchId),
    refetchInterval: 30_000,
    staleTime: 0,
  });

  return (
    <Flex vertical align="center" justify="center" style={{ minHeight: "70vh" }}>
      <Typography.Title level={3}>Мой QR</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ textAlign: "center", maxWidth: 320 }}>
        Поднесите этот код к камере киоска на входе, чтобы отметить приход или уход.
      </Typography.Paragraph>

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={error instanceof ApiError ? error.message : "Не удалось получить код"}
        />
      )}

      <Card style={{ width: 280, textAlign: "center" }}>
        {data ? (
          <Image src={data.qrCodeDataUrl} alt="QR-код" width={220} preview={false} />
        ) : (
          isLoading && (
            <Flex justify="center" style={{ padding: 40 }}>
              <Spin size="large" />
            </Flex>
          )
        )}
      </Card>
    </Flex>
  );
}
