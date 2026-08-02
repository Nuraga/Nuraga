import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Form, Input, Modal, Select } from "antd";
import { tasksApi, type CreateTaskInput } from "../api/tasks";
import { ApiError } from "../api/client";

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  staffOptions: { value: string; label: string }[];
}

export default function CreateStaffTaskModal({ branchId, open, onClose, staffOptions }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const create = useMutation({
    mutationFn: (values: Omit<CreateTaskInput, "leadId" | "familyId">) =>
      tasksApi.create(branchId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", branchId] });
      message.success("Задача создана");
      form.resetFields();
      onClose();
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <Modal
      title="Новая задача"
      open={open}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={() => form.submit()}
      confirmLoading={create.isPending}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(values) => create.mutate(values)}>
        <Form.Item
          label="Описание"
          name="description"
          rules={[{ required: true, message: "Укажите описание" }]}
        >
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item label="Срок" name="dueAt" rules={[{ required: true, message: "Укажите срок" }]}>
          <Input type="datetime-local" />
        </Form.Item>
        <Form.Item
          label="Исполнитель"
          name="assignedToId"
          rules={[{ required: true, message: "Выберите исполнителя" }]}
        >
          <Select options={staffOptions} showSearch optionFilterProp="label" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
