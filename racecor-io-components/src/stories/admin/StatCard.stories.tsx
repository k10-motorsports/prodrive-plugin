import type { Meta, StoryObj } from '@storybook/react'
import { StatCard } from '@web/app/drive/admin/components'

const meta: Meta<typeof StatCard> = {
  title: 'Admin/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['green', 'red', 'muted', undefined],
    },
  },
}

export default meta
type Story = StoryObj<typeof StatCard>

export const Default: Story = {
  args: { label: 'Total Tracks', value: 15 },
}

export const Green: Story = {
  args: { label: 'Success Rate', value: '98.2%', color: 'green' },
}

export const Red: Story = {
  args: { label: 'Failed', value: 3, color: 'red' },
}

export const Muted: Story = {
  args: { label: 'Avg Duration', value: '142ms', color: 'muted' },
}

export const StatsRow: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-3">
      <StatCard label="Total" value={1247} />
      <StatCard label="Successful" value={1221} color="green" />
      <StatCard label="Failed" value={26} color="red" />
      <StatCard label="Avg Duration" value="142ms" color="muted" />
    </div>
  ),
}
