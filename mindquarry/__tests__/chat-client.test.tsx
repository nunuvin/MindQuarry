import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ChatClient } from '@/app/messages/[id]/ChatClient'
import { DELETED_MESSAGE_TOMBSTONE } from '@/lib/messageContent'

const refresh = jest.fn()
const eventSources: Array<{
  onmessage: ((event: MessageEvent) => void) | null
  close: jest.Mock
  url: string
}> = []

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh,
  }),
}))

jest.mock('@/components/TipTapEditor', () => ({
  TipTapEditor: ({
    value = '',
    onChange,
    onKeyDown,
  }: {
    value?: string
    onChange?: (value: string) => void
    onKeyDown?: (event: KeyboardEvent) => boolean
  }) => (
    <textarea
      aria-label="Message composer"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      onKeyDown={(event) => onKeyDown?.(event as unknown as KeyboardEvent)}
    />
  ),
}))

jest.mock('@/components/TipTapRenderer', () => ({
  TipTapRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}))

describe('ChatClient', () => {
  beforeEach(() => {
    refresh.mockReset()
    eventSources.length = 0
    global.EventSource = class {
      onmessage: ((event: MessageEvent) => void) | null = null
      close = jest.fn()

      constructor(public url: string) {
        eventSources.push(this)
      }
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

  it('shows an error when the user tries to send an empty message', async () => {
    const sendMessageAction = jest.fn().mockResolvedValue({ ok: true })

    render(
      <ChatClient
        conversationId="conv-1"
        displayName="Chat"
        userId="user-1"
        isGlobalAdmin={false}
        messages={[]}
        sendMessageAction={sendMessageAction}
        deleteMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        hideMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        otherParticipants={[]}
      />,
    )

    fireEvent.keyDown(screen.getByLabelText('Message composer'), { key: 'Enter' })

    expect(await screen.findByText('Message cannot be empty.')).toBeInTheDocument()
    expect(sendMessageAction).not.toHaveBeenCalled()
  })

  it('queues failed sends and lets the user discard the pending message', async () => {
    const sendMessageAction = jest.fn().mockResolvedValue({ ok: false, error: 'Temporary failure' })

    render(
      <ChatClient
        conversationId="conv-1"
        displayName="Chat"
        userId="user-1"
        isGlobalAdmin={false}
        messages={[]}
        sendMessageAction={sendMessageAction}
        deleteMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        hideMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        otherParticipants={[]}
      />,
    )

    fireEvent.change(screen.getByLabelText('Message composer'), { target: { value: '<p>Hello</p>' } })
    fireEvent.keyDown(screen.getByLabelText('Message composer'), { key: 'Enter' })

    expect(await screen.findByText('Temporary failure')).toBeInTheDocument()
    expect(screen.getByText('Failed to send')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => {
      expect(screen.queryByText('Failed to send')).not.toBeInTheDocument()
    })
  })

  it('retries a failed pending message and clears it on success', async () => {
    const sendMessageAction = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'Temporary failure' })
      .mockResolvedValueOnce({ ok: true })

    render(
      <ChatClient
        conversationId="conv-1"
        displayName="Chat"
        userId="user-1"
        isGlobalAdmin={false}
        messages={[]}
        sendMessageAction={sendMessageAction}
        deleteMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        hideMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        otherParticipants={[]}
      />,
    )

    fireEvent.change(screen.getByLabelText('Message composer'), { target: { value: '<p>Hello</p>' } })
    fireEvent.keyDown(screen.getByLabelText('Message composer'), { key: 'Enter' })
    expect(await screen.findByText('Failed to send')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }))

    await waitFor(() => {
      expect(sendMessageAction).toHaveBeenCalledTimes(2)
      expect(screen.queryByText('Failed to send')).not.toBeInTheDocument()
    })
  })

  it('marks the latest message as read once and refreshes on matching stream events', async () => {
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
            sender_id: 'user-2',
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

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/chat/conv-1/read', { method: 'POST' })
    })

    window.dispatchEvent(new Event('focus'))

    expect(global.fetch).toHaveBeenCalledTimes(1)

    eventSources[0]?.onmessage?.({
      data: JSON.stringify({ type: 'new_message', conversationId: 'conv-1' }),
    } as MessageEvent)

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shows admin hide errors for other users messages', async () => {
    const hideMessageAction = jest.fn().mockResolvedValue({ ok: false, error: 'Failed to hide for now' })

    render(
      <ChatClient
        conversationId="conv-1"
        displayName="Chat"
        userId="admin-1"
        isGlobalAdmin={true}
        messages={[
          {
            id: 'msg-3',
            body: '<p>Hello</p>',
            created_at: new Date('2026-05-25T12:02:00.000Z'),
            sender_id: 'user-2',
            is_hidden: false,
            name: 'Alice',
            displayUsername: 'alice',
            username: 'alice',
          },
        ]}
        sendMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        deleteMessageAction={jest.fn().mockResolvedValue({ ok: true })}
        hideMessageAction={hideMessageAction}
        otherParticipants={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open message actions' }))
    expect(screen.getByRole('button', { name: 'Hide message' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete message' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hide message' }))

    expect(await screen.findByText('Failed to hide for now')).toBeInTheDocument()
    expect(hideMessageAction).toHaveBeenCalledTimes(1)
  })

  it('shows read receipts for the current users read messages', () => {
    render(
      <ChatClient
        conversationId="conv-1"
        displayName="Chat"
        userId="user-1"
        isGlobalAdmin={false}
        messages={[
          {
            id: 'msg-4',
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
        otherParticipants={[{ user_id: 'user-2', last_read_at: new Date('2026-05-25T12:01:00.000Z') }]}
      />,
    )

    expect(screen.getByText('Read ✓')).toBeInTheDocument()
  })
})