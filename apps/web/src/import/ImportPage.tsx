import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { App, Alert, Button, Card, Space, Table, Tag, Typography, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd";
import { importApi } from "../api/importApi";
import type { ImportReport } from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

export default function ImportPage() {
  const { message } = App.useApp();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);

  const importMutation = useMutation({
    mutationFn: (dryRun: boolean) => {
      const file = (fileList[0]?.originFileObj ?? fileList[0]) as File;
      return importApi.importChildren(branchId, file, dryRun);
    },
    onSuccess: setReport,
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка импорта"),
  });

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Typography.Title level={3}>Импорт детей из CSV</Typography.Title>

      <Card>
        <Typography.Paragraph>
          Файл CSV (через запятую, UTF-8) с заголовком и колонками:{" "}
          <Typography.Text code>
            family_name, child_full_name, child_birth_date, child_sex, parent_full_name,
            parent_relationship, parent_phone, parent_email
          </Typography.Text>
          . Каждая строка создаёт новую семью, родителя и ребёнка (в очереди).
        </Typography.Paragraph>

        <Upload beforeUpload={() => false} maxCount={1} fileList={fileList} onChange={({ fileList: fl }) => setFileList(fl)}>
          <Button icon={<UploadOutlined />}>Выбрать файл</Button>
        </Upload>

        <Space style={{ marginTop: 16 }}>
          <Button disabled={fileList.length === 0} loading={importMutation.isPending} onClick={() => importMutation.mutate(true)}>
            Проверить (без сохранения)
          </Button>
          <Button
            type="primary"
            disabled={fileList.length === 0}
            loading={importMutation.isPending}
            onClick={() => importMutation.mutate(false)}
          >
            Импортировать
          </Button>
        </Space>
      </Card>

      {report && (
        <Card title={report.dryRun ? "Результат проверки" : "Результат импорта"}>
          <Alert
            style={{ marginBottom: 16 }}
            type={report.failed === 0 ? "success" : "warning"}
            showIcon
            message={`Всего строк: ${report.totalRows}. Успешно: ${report.created}. Ошибок: ${report.failed}.`}
          />
          <Table
            rowKey="row"
            size="small"
            pagination={false}
            dataSource={report.results}
            columns={[
              { title: "Строка", dataIndex: "row" },
              {
                title: "Статус",
                dataIndex: "status",
                render: (s: string) =>
                  s === "created" ? <Tag color="green">OK</Tag> : <Tag color="red">Ошибка</Tag>,
              },
              {
                title: "Детали",
                key: "details",
                render: (_, row) => row.errors?.join("; ") ?? "",
              },
            ]}
          />
        </Card>
      )}
    </Space>
  );
}
