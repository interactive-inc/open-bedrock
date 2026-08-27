import type { Meta, StoryObj } from "@storybook/react-vite"
import { MyShiftAssignments } from "@/app/(app)/my/shifts/_components/my-shift-assignments"

const meta = {
  title: "shift/MyShiftAssignments",
  component: MyShiftAssignments,
} satisfies Meta<typeof MyShiftAssignments>

export default meta

type Story = StoryObj<typeof meta>

export const WithAssignments: Story = {
  args: {
    assignments: [
      {
        id: 1,
        employee_id: "101",
        pattern_id: 1,
        pattern_name: "早番",
        pattern_start_time: "07:00",
        pattern_end_time: "16:00",
        date: "2026-06-12",
        note: null,
        published_at: "2026-06-10T10:00:00Z",
      },
      {
        id: 2,
        employee_id: "101",
        pattern_id: 2,
        pattern_name: "遅番",
        pattern_start_time: "13:00",
        pattern_end_time: "22:00",
        date: "2026-06-13",
        note: "Early shift",
        published_at: "2026-06-10T10:00:00Z",
      },
      {
        id: 3,
        employee_id: "101",
        pattern_id: null,
        pattern_name: null,
        pattern_start_time: null,
        pattern_end_time: null,
        date: "2026-06-14",
        note: null,
        published_at: "2026-06-10T10:00:00Z",
      },
    ],
  },
}

export const Empty: Story = {
  args: {
    assignments: [],
  },
}
