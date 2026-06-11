import type { Meta, StoryObj } from "@storybook/nextjs"
import { PayslipStatusBadge } from "@/components/payslip-status-badge"

const meta = {
  title: "components/PayslipStatusBadge",
  component: PayslipStatusBadge,
} satisfies Meta<typeof PayslipStatusBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Draft: Story = {
  args: { status: "draft" },
}

export const Issued: Story = {
  args: { status: "issued" },
}
