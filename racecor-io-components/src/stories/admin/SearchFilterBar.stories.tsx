import type { Meta, StoryObj } from '@storybook/react'
import { SearchFilterBar } from '@web/app/drive/admin/components'

const meta: Meta<typeof SearchFilterBar> = {
  title: 'Admin/SearchFilterBar',
  component: SearchFilterBar,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SearchFilterBar>

export const Default: Story = {
  args: {
    search: '',
    onSearch: () => {},
    game: '',
    onGame: () => {},
    sort: 'name-asc',
    onSort: () => {},
  },
}

export const WithSearch: Story = {
  args: {
    search: 'spa',
    onSearch: () => {},
    game: 'iracing',
    onGame: () => {},
    sort: 'name-asc',
    onSort: () => {},
  },
}

export const CustomSortOptions: Story = {
  args: {
    search: '',
    onSearch: () => {},
    game: '',
    onGame: () => {},
    sort: 'color',
    onSort: () => {},
    sortOptions: [
      { value: 'color', label: 'By Color' },
      { value: 'name-asc', label: 'A → Z' },
      { value: 'upload-date', label: 'Upload Date' },
    ],
  },
}
