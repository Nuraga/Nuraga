import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { tasksApi } from "../api/tasks";
import { staffApi } from "../api/staff";
import { useAuth } from "../auth/AuthContext";
import { useBranch } from "../layout/BranchContext";
import { useBranchRoles, hasAnyRole } from "../auth/roles";
import StaffTasksBoard from "./StaffTasksBoard";
import CreateStaffTaskModal from "./CreateStaffTaskModal";

const TASK_MANAGEMENT_ROLES = ["OWNER", "BRANCH_MANAGER", "MANAGER"] as const;

export default function StaffTasksPage() {
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;
  const { user } = useAuth();
  const branchRoles = useBranchRoles(branchId);
  const isManager = hasAnyRole(branchRoles, [...TASK_MANAGEMENT_ROLES]);

  const [createOpen, setCreateOpen] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", branchId, isManager ? "board" : user?.id],
    queryFn: () =>
      isManager ? tasksApi.list(branchId, { scope: "staff" }) : tasksApi.list(branchId, { assignedToId: user!.id }),
    enabled: Boolean(branchId && user),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff", branchId],
    queryFn: () => staffApi.list(branchId),
    enabled: Boolean(branchId),
  });

  const staffOptions = staff
    .filter((s) => s.user)
    .map((s) => ({ value: s.user!.id, label: `${s.user!.fullName} (${s.position})` }));
  const assigneeNames = new Map(staff.filter((s) => s.user).map((s) => [s.user!.id, s.user!.fullName]));

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {isManager ? "Задачи" : "Мои задачи"}
        </Typography.Title>
        {isManager && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Новая задача
          </Button>
        )}
      </Space>

      <StaffTasksBoard branchId={branchId} tasks={tasks} isLoading={isLoading} assigneeNames={assigneeNames} />

      {isManager && (
        <CreateStaffTaskModal
          branchId={branchId}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          staffOptions={staffOptions}
        />
      )}
    </>
  );
}
