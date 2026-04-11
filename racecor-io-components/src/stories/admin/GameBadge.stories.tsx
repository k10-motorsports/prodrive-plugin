import type { Meta, StoryObj } from '@storybook/react'
import { GameBadge } from '@web/app/drive/admin/components'

const meta: Meta<typeof GameBadge> = {
  title: 'Admin/GameBadge',
  component: GameBadge,
  tags: ['autodocs'],
  argTypes: {
    game: {
      control: 'select',
      options: ['iracing', 'acc'],
    },
  },
}

export default meta
type Story = StoryObj<typeof GameBadge>

export const IRacing: Story = { args: { game: 'iracing' } }
export const ACC: Story = { args: { game: 'acc' } }

export const AllGames: Story = {
  render: () => (
    <div className="flex gap-2">
      <GameBadge game="iracing" />
      <GameBadge game="acc" />
    </div>
  ),
}
