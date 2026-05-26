import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { SubmitAnswerForm } from '@/app/q/[name]/query/[id]/SubmitAnswerForm'

jest.mock('@/components/TipTapEditor', () => ({
  TipTapEditor: ({ name, value, onChange, onKeyDown, placeholder }: { name: string; value: string; onChange: (value: string) => void; onKeyDown?: (event: KeyboardEvent) => boolean; placeholder: string }) => (
    <textarea
      aria-label="Answer body"
      name={name}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => onKeyDown?.(event as unknown as KeyboardEvent)}
    />
  ),
}))

describe('SubmitAnswerForm', () => {
  it('submits from the editor when Ctrl+Enter is pressed', async () => {
    const submitAction = jest.fn().mockResolvedValue({ ok: true })

    render(<SubmitAnswerForm submitAction={submitAction} />)

    fireEvent.change(screen.getByLabelText('Answer body'), { target: { value: '<p>Answer body</p>' } })
    fireEvent.keyDown(screen.getByLabelText('Answer body'), { key: 'Enter', ctrlKey: true })

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1))
  })
})