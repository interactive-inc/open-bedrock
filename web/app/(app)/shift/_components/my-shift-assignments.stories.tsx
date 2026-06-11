import type { Meta, StoryObj } from "@storybook/nextjs"
import { MyShiftAssignments } from "@/app/(app)/shift/_components/my-shift-assignments"

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
        employee_id: 101,
        pattern_id: 1,
        date: "2026-06-12",
        note: null,
        published_at: "2026-06-10T10:00:00Z",
      },
      {
        id: 2,
        employee_id: 101,
        pattern_id: 2,
        date: "2026-06-13",
        note: "Early shift",
        published_at: "2026-06-10T10:00:00Z",
      },
      {
        id: 3,
        employee_id: 101,
        pattern_id: 1,
        date: "2026-06-14",
        note: null,
        published_at: null,
      },
    ],
  },
}

export const Empty: Story = {
  args: {
    assignments: [],
  },
}
