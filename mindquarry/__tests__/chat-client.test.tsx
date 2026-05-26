import { fireEvent, render, screen } from '@testing-library/react'

import { ChatClient } from '@/app/messages/[id]/ChatClient'
import { DELETED_MESSAGE_TOMBSTONE } from '@/lib/messageContent'

const refresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh,
  }),
}))

jest.mock('@/components/TipTapEditor', () => ({
  TipTapEditor: ({ value = '', onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="Message composer" value={value} onChange={(event) => onChange?.(event.target.value)} />
  ),
}))

jest.mock('@/components/TipTapRenderer', () => ({
  TipTapRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}))

describe('ChatClient', () => {
  beforeEach(() => {
    refresh.mockReset()
    global.EventSource = class {
      onmessage: ((event: MessageEvent) => void) | null = null
      close() {}
    } as never
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never
  })

  it('keeps destructive actions hidden until the message menu is opened', () => {
    render(
      <ChatClient
        conversationId="conv-1"
        displayName="Chat"
        userId="user-1"
        isGlobalAdmin={false}
        messages={[
          {
            id: 'msg-1',
            body: '<p>Hello</p>',
            created_at: new Date('2026-05-25T12:00:00.000Z'),
            sender_id: 'user-1',
            is_hidden: false,
            name: 'Alice',
            displayUsername: 'alice',
            username: 'alice',
          },
        ]}
        sendMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        deleteMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        hideMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        otherParticipants={[]}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Delete message' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open message actions' }))

    expect(screen.getByRole('button', { name: 'Delete message' })).toBeInTheDocument()
  })

  it('renders deleted messages as an italic tombstone', () => {
    render(
      <ChatClient
        conversationId="conv-1"
        displayName="Chat"
        userId="user-2"
        isGlobalAdmin={true}
        messages={[
          {
            id: 'msg-2',
            body: DELETED_MESSAGE_TOMBSTONE,
            created_at: new Date('2026-05-25T12:01:00.000Z'),
            sender_id: 'user-1',
            is_hidden: false,
            name: 'Alice',
            displayUsername: 'alice',
            username: 'alice',
          },
        ]}
        sendMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        deleteMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        hideMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        otherParticipants={[]}
      />,
    )

    expect(screen.getByText('message deleted')).toHaveClass('italic')
    expect(screen.queryByRole('button', { name: 'Open message actions' })).not.toBeInTheDocument()
  })
})