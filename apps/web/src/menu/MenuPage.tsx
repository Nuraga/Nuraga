import { useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Alert, Button, Card, Flex, Modal, Select, Space, Tag, Tooltip, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { menuApi } from "../api/menu";
import { dishesApi } from "../api/dictionaries";
import { MEAL_TYPES, MEAL_TYPE_LABELS, type MealType, type MenuItem } from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";
import { useBranchRoles, hasAnyRole } from "../auth/roles";

const MENU_WRITE_ROLES = ["OWNER", "BRANCH_MANAGER", "MANAGER"] as const;

function weekDates(weekStart: Dayjs): Dayjs[] {
  return Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day"));
}

function DishTag({ item }: { item: MenuItem }) {
  const hasConflict = item.conflicts.length > 0;
  const tag = (
    <Tag color={hasConflict ? "red" : "default"} style={{ marginBottom: 4 }}>
      {item.dishName}
    </Tag>
  );
  if (!hasConflict) return tag;
  return (
    <Tooltip
      title={item.conflicts.map((c) => `${c.fullName}: ${c.allergenNames.join(", ")}`).join("; ")}
    >
      {tag}
    </Tooltip>
  );
}

function DayCard({
  date,
  items,
  canEdit,
  onEdit,
}: {
  date: Dayjs;
  items: MenuItem[];
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <Card
      size="small"
      title={date.toDate().toLocaleDateString("ru-RU", { weekday: "short", day: "2-digit", month: "2-digit" })}
      style={{ minWidth: 220, flex: "1 0 220px" }}
      extra={canEdit && <Button size="small" onClick={onEdit}>Изменить</Button>}
    >
      {MEAL_TYPES.map((mealType) => {
        const mealItems = items.filter((i) => i.mealType === mealType);
        return (
          <div key={mealType} style={{ marginBottom: 8 }}>
            <Typography.Text type="secondary">{MEAL_TYPE_LABELS[mealType]}</Typography.Text>
            <div>
              {mealItems.length === 0 ? (
                <Typography.Text type="secondary">—</Typography.Text>
              ) : (
                mealItems.map((item) => <DishTag key={item.id} item={item} />)
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

export default function MenuPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;
  const branchRoles = useBranchRoles(branchId);
  const canEdit = hasAnyRole(branchRoles, [...MENU_WRITE_ROLES]);

  const [weekStart, setWeekStart] = useState<Dayjs>(dayjs().startOf("week"));
  const days = useMemo(() => weekDates(weekStart), [weekStart]);
  const from = days[0].format("YYYY-MM-DD");
  const to = days[6].format("YYYY-MM-DD");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["menu", branchId, from, to],
    queryFn: () => menuApi.getRange(branchId, from, to),
    enabled: Boolean(branchId),
  });
  const { data: dishes = [] } = useQuery({ queryKey: ["dishes"], queryFn: dishesApi.list });
  const dishOptions = dishes.filter((d) => d.isActive).map((d) => ({ value: d.id, label: d.name }));

  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<MealType, string[]>>({
    BREAKFAST: [],
    LUNCH: [],
    AFTERNOON_SNACK: [],
  });

  function openEdit(date: string, dayItems: MenuItem[]) {
    setEditingDate(date);
    setDraft({
      BREAKFAST: dayItems.filter((i) => i.mealType === "BREAKFAST").map((i) => i.dishId),
      LUNCH: dayItems.filter((i) => i.mealType === "LUNCH").map((i) => i.dishId),
      AFTERNOON_SNACK: dayItems.filter((i) => i.mealType === "AFTERNOON_SNACK").map((i) => i.dishId),
    });
  }

  const publish = useMutation({
    mutationFn: () => {
      const dayItems = MEAL_TYPES.flatMap((mealType) =>
        draft[mealType].map((dishId) => ({ mealType, dishId })),
      );
      return menuApi.publishDay(branchId, editingDate!, dayItems);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["menu", branchId] });
      message.success("Меню на день сохранено");
      setEditingDate(null);
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const itemsByDate = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of items) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [items]);

  const hasAnyConflict = items.some((i) => i.conflicts.length > 0);

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Меню
        </Typography.Title>
        <Space>
          <Button icon={<LeftOutlined />} onClick={() => setWeekStart((w) => w.subtract(1, "week"))} />
          <Typography.Text>
            {days[0].format("DD.MM")} – {days[6].format("DD.MM.YYYY")}
          </Typography.Text>
          <Button icon={<RightOutlined />} onClick={() => setWeekStart((w) => w.add(1, "week"))} />
        </Space>
      </Space>

      {hasAnyConflict && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Есть блюда, несовместимые с аллергией у зачисленных детей — отмечены красным, наведите для деталей"
        />
      )}

      <Flex gap={12} style={{ overflowX: "auto", paddingBottom: 8 }}>
        {!isLoading &&
          days.map((date) => {
            const dateStr = date.format("YYYY-MM-DD");
            const dayItems = itemsByDate.get(dateStr) ?? [];
            return (
              <DayCard
                key={dateStr}
                date={date}
                items={dayItems}
                canEdit={canEdit}
                onEdit={() => openEdit(dateStr, dayItems)}
              />
            );
          })}
      </Flex>

      <Modal
        title={editingDate ? `Меню на ${dayjs(editingDate).format("DD.MM.YYYY")}` : ""}
        open={Boolean(editingDate)}
        onCancel={() => setEditingDate(null)}
        onOk={() => publish.mutate()}
        confirmLoading={publish.isPending}
        destroyOnClose
      >
        {MEAL_TYPES.map((mealType) => (
          <div key={mealType} style={{ marginBottom: 16 }}>
            <Typography.Text strong>{MEAL_TYPE_LABELS[mealType]}</Typography.Text>
            <Select
              mode="multiple"
              style={{ width: "100%", marginTop: 4 }}
              options={dishOptions}
              value={draft[mealType]}
              onChange={(value) => setDraft((d) => ({ ...d, [mealType]: value }))}
              placeholder="Не выбрано"
            />
          </div>
        ))}
      </Modal>
    </>
  );
}
