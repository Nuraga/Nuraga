import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Card, Empty, Image, Skeleton, Space, Switch, Typography } from "antd";
import { parentPortalApi } from "../api/parentPortal";
import { ApiError } from "../api/client";

export default function ParentPhotosPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ["parent", "photos"],
    queryFn: parentPortalApi.photos,
  });

  const { data: consents = [], isLoading: consentsLoading } = useQuery({
    queryKey: ["parent", "photo-consents"],
    queryFn: parentPortalApi.photoConsents,
  });

  const setConsent = useMutation({
    mutationFn: ({ childId, consent }: { childId: string; consent: boolean }) =>
      parentPortalApi.setPhotoConsent(childId, consent),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["parent", "photo-consents"] });
      message.success("Сохранено");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Typography.Title level={4}>Фотолента</Typography.Title>

      <Card size="small" title="Согласие на фото и видео" style={{ marginBottom: 16 }} loading={consentsLoading}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Разрешите воспитателю снимать вашего ребёнка на общих фото группы. Это не ограничивает, какие фото
          вы видите здесь — только предупреждает воспитателя, кого не стоит снимать.
        </Typography.Paragraph>
        <Space direction="vertical" style={{ width: "100%" }}>
          {consents.map((c) => (
            <Space key={c.childId} style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Text>{c.fullName}</Typography.Text>
              <Switch
                checked={c.consent}
                loading={setConsent.isPending}
                onChange={(checked) => setConsent.mutate({ childId: c.childId, consent: checked })}
              />
            </Space>
          ))}
        </Space>
      </Card>

      {photosLoading ? (
        <Skeleton active />
      ) : photos.length === 0 ? (
        <Empty description="Фотографий пока нет" />
      ) : (
        <Image.PreviewGroup>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            {photos.map((photo) => (
              <Card
                key={photo.id}
                size="small"
                cover={
                  <Image
                    src={photo.downloadUrl}
                    alt={photo.caption ?? "Фото"}
                    height={140}
                    style={{ objectFit: "cover" }}
                  />
                }
              >
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {dayjs(photo.takenAt).format("DD.MM.YYYY")}
                </Typography.Text>
                {photo.caption && <div style={{ fontSize: 13 }}>{photo.caption}</div>}
              </Card>
            ))}
          </div>
        </Image.PreviewGroup>
      )}
    </>
  );
}
