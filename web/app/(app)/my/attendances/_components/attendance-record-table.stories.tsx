import type { Meta, StoryObj } from "@storybook/react-vite"
import { AttendanceRecordTable } from "@/app/(app)/my/attendances/_components/attendance-record-table"

const meta = {
  title: "attendance/AttendanceRecordTable",
  component: AttendanceRecordTable,
} satisfies Meta<typeof AttendanceRecordTable>

export default meta

type Story = StoryObj<typeof meta>

export const PersonalView: Story = {
  args: {
    withEmployeeId: false,
    records: [
      {
        id: "01900015-0000-7000-8000-000000000001",
        employee_id: "101",
        work_date: "2026-06-09",
        clock_in_at: "09:00",
        clock_out_at: "18:00",
        work_minutes: 480,
        status: "closed",
      },
      {
        id: "01900015-0000-7000-8000-000000000002",
        employee_id: "101",
        work_date: "2026-06-10",
        clock_in_at: "08:45",
        clock_out_at: "17:30",
        work_minutes: 465,
        status: "closed",
      },
      {
        id: "01900015-0000-7000-8000-000000000003",
        employee_id: "101",
        work_date: "2026-06-11",
        clock_in_at: "09:15",
        clock_out_at: null,
        work_minutes: null,
        status: "open",
      },
    ],
  },
}

export const AdminView: Story = {
  args: {
    withEmployeeId: true,
    records: [
      {
        id: "01900015-0000-7000-8000-000000000010",
        employee_id: "101",
        work_date: "2026-06-09",
        clock_in_at: "09:00",
        clock_out_at: "18:00",
        work_minutes: 480,
        status: "closed",
      },
      {
        id: "01900015-0000-7000-8000-000000000011",
        employee_id: "102",
        work_date: "2026-06-09",
        clock_in_at: "10:00",
        clock_out_at: "19:00",
        work_minutes: 480,
        status: "closed",
      },
      {
        id: "01900015-0000-7000-8000-000000000012",
        employee_id: "103",
        work_date: "2026-06-09",
        clock_in_at: null,
        clock_out_at: null,
        work_minutes: null,
        status: "open",
      },
    ],
  },
}
