import { useState } from "react";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Image,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Typography,
  Upload,
} from "antd";
import type { UploadFile } from "antd";
import { InboxOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { photosApi } from "../api/photos";
import { groupsApi } from "../api/groups";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useBranch } from "../layout/BranchContext";
import { useBranchRoles, hasAnyRole } from "../auth/roles";

const PHOTO_UPLOAD_ROLES = ["OWNER", "BRANCH_MANAGER", "MANAGER", "TEACHER"] as const;
const PHOTO_MANAGE_ROLES = ["OWNER", "BRANCH_MANAGER", "MANAGER"] as const;

export default function PhotosPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;
  const branchRoles = useBranchRoles(branchId);
  const canUpload = hasAnyRole(branchRoles, [...PHOTO_UPLOAD_ROLES]);
  const canManageAny = hasAnyRole(branchRoles, [...PHOTO_MANAGE_ROLES]);

  const { data: groups = [] } = useQuery({
    queryKey: ["groups", branchId],
    queryFn: () => groupsApi.list(branchId),
    enabled: Boolean(branchId),
  });
  const [groupId, setGroupId] = useState<string | undefined>();

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["photos", branchId, groupId],
    queryFn: () => photosApi.list(branchId, groupId!),
    enabled: Boolean(branchId && groupId),
  });

  const { data: consentGaps = [] } = useQuery({
    queryKey: ["photos", "consent-gaps", branchId, groupId],
    queryFn: () => photosApi.consentGaps(branchId, groupId!),
    enabled: Boolean(branchId && groupId),
  });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState(dayjs());

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["photos", branchId, groupId] });

  const upload = useMutation({
    mutationFn: () => photosApi.upload(branchId, file!, groupId!, caption || undefined, takenAt.toISOString()),
    onSuccess: () => {
      invalidate();
      message.success("Фото добавлено");
      setUploadOpen(false);
      setFile(null);
      setCaption("");
      setTakenAt(dayjs());
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => photosApi.remove(branchId, id),
    onSuccess: () => {
      invalidate();
      message.success("Фото удалено");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Фотолента
        </Typography.Title>
        <Space>
          <Select
            placeholder="Выберите группу"
            style={{ width: 240 }}
            value={groupId}
            onChange={setGroupId}
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
          />
          {canUpload && (
            <Button type="primary" icon={<PlusOutlined />} disabled={!groupId} onClick={() => setUploadOpen(true)}>
              Загрузить фото
            </Button>
          )}
        </Space>
      </Space>

      {groupId && consentGaps.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Нет согласия на фото/видео"
          description={`Не публикуйте фото с этими детьми: ${consentGaps.map((c) => c.fullName).join(", ")}`}
        />
      )}

      {!groupId ? (
        <Empty description="Выберите группу, чтобы посмотреть фотоленту" />
      ) : (
        <Image.PreviewGroup>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {!isLoading && photos.length === 0 && (
              <Empty style={{ gridColumn: "1 / -1" }} description="Фотографий пока нет" />
            )}
            {photos.map((photo) => {
              const canDelete = canManageAny || photo.uploadedById === user?.id;
              return (
                <Card
                  key={photo.id}
                  size="small"
                  cover={<Image src={photo.downloadUrl} alt={photo.caption ?? "Фото"} height={180} style={{ objectFit: "cover" }} />}
                  actions={
                    canDelete
                      ? [
                          <Popconfirm
                            key="delete"
                            title="Удалить фото?"
                            onConfirm={() => remove.mutate(photo.id)}
                          >
                            <DeleteOutlined />
                          </Popconfirm>,
                        ]
                      : undefined
                  }
                >
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(photo.takenAt).format("DD.MM.YYYY HH:mm")}
                  </Typography.Text>
                  {photo.caption && <div>{photo.caption}</div>}
                </Card>
              );
            })}
          </div>
        </Image.PreviewGroup>
      )}

      <Modal
        title="Загрузить фото"
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={() => upload.mutate()}
        confirmLoading={upload.isPending}
        okButtonProps={{ disabled: !file }}
        destroyOnClose
      >
        <Upload.Dragger
          maxCount={1}
          accept="image/*"
          beforeUpload={(f: UploadFile) => {
            setFile(f as unknown as File);
            return false;
          }}
          onRemove={() => setFile(null)}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Нажмите или перетащите фото сюда</p>
        </Upload.Dragger>
        <Space direction="vertical" style={{ width: "100%", marginTop: 16 }}>
          <DatePicker
            style={{ width: "100%" }}
            value={takenAt}
            onChange={(d) => d && setTakenAt(d)}
            showTime
            allowClear={false}
          />
          <Input.TextArea
            placeholder="Подпись (необязательно)"
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={280}
          />
        </Space>
      </Modal>
    </>
  );
}
