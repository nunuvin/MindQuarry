import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { SubmitQueryForm } from '@/app/q/[name]/submit/SubmitQueryForm'

jest.mock('@/components/TipTapEditor', () => ({
  TipTapEditor: ({ name, value, onChange, onKeyDown, placeholder }: { name: string; value: string; onChange: (value: string) => void; onKeyDown?: (event: KeyboardEvent) => boolean; placeholder: string }) => (
    <textarea
      aria-label="Body"
      name={name}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => onKeyDown?.(event as unknown as KeyboardEvent)}
    />
  ),
}))

describe('SubmitQueryForm', () => {
  it('forwards selected tags and custom tags to the submit action', async () => {
    const submitAction = jest.fn().mockResolvedValue({ ok: true })

    render(
      <SubmitQueryForm
        submitAction={submitAction}
        allowCustomTags
        availableTags={[
          { id: 'tag-1', name: 'testing', description: 'Tests', quarry_id: null },
          { id: 'tag-2', name: 'full-text-search', description: 'Search', quarry_id: 'quarry-1' },
        ]}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('What is your question?'), { target: { value: 'How do tag filters rank results?' } })
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: '<p>Question body</p>' } })
    fireEvent.click(screen.getByLabelText('testing'))
    fireEvent.change(screen.getByPlaceholderText('comma-separated, e.g. ranking, indexing, moderation'), { target: { value: 'ranking, indexing' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post Query' }))

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1))

    const submittedData = submitAction.mock.calls[0][0] as FormData
    expect(submittedData.get('title')).toBe('How do tag filters rank results?')
    expect(submittedData.get('body')).toBe('<p>Question body</p>')
    expect(submittedData.getAll('tag_ids')).toEqual(['tag-1'])
    expect(submittedData.get('custom_tags')).toBe('ranking, indexing')
  })

  it('shows an error instead of submitting when title or body is missing', async () => {
    const submitAction = jest.fn().mockResolvedValue({ ok: true })

    render(<SubmitQueryForm submitAction={submitAction} />)

    fireEvent.change(screen.getByPlaceholderText('What is your question?'), { target: { value: 'Missing body' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post Query' }))

    expect(await screen.findByText('Both the title and body are required.')).toBeInTheDocument()
    expect(submitAction).not.toHaveBeenCalled()
  })

  it('submits from the editor when Ctrl+Enter is pressed', async () => {
    const submitAction = jest.fn().mockResolvedValue({ ok: true })

    render(<SubmitQueryForm submitAction={submitAction} />)

    fireEvent.change(screen.getByPlaceholderText('What is your question?'), { target: { value: 'How do I submit quickly?' } })
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: '<p>Use the keyboard shortcut.</p>' } })
    fireEvent.keyDown(screen.getByLabelText('Body'), { key: 'Enter', ctrlKey: true })

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1))
  })
})