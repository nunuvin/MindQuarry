const executeTakeFirst = jest.fn()

function makeChain() {
  const chain = {
    select: jest.fn(() => chain),
    where: jest.fn(() => chain),
    executeTakeFirst,
  }

  return chain
}

const selectFrom = jest.fn(() => makeChain())

jest.mock('@/lib/db', () => ({
  db: {
    selectFrom: (...args: unknown[]) => selectFrom(...args),
  },
}))

import {
  REVIEW_MODE_QUERY,
  REVIEW_MODE_QUERY_AND_ANSWER,
  getEffectivePostingPolicy,
  resolvePostingPolicyRows,
  shouldReviewAnswer,
  shouldReviewQuery,
} from '@/lib/moderation'

describe('moderation helpers', () => {
  beforeEach(() => {
    executeTakeFirst.mockReset()
    selectFrom.mockClear()
  })

  it('applies posting policy precedence from defaults to user overrides', () => {
    const policy = resolvePostingPolicyRows({
      instanceDefault: {
        id: 'instance-default',
        quarry_id: null,
        user_id: null,
        review_mode: REVIEW_MODE_QUERY,
        can_post_queries: true,
        can_post_answers: true,
      },
      quarryDefault: {
        id: 'quarry-default',
        quarry_id: 'quarry-1',
        user_id: null,
        review_mode: REVIEW_MODE_QUERY_AND_ANSWER,
        can_post_queries: true,
        can_post_answers: true,
      },
      instanceUser: {
        id: 'instance-user',
        quarry_id: null,
        user_id: 'user-1',
        review_mode: 'none',
        can_post_queries: true,
        can_post_answers: false,
      },
      quarryUser: {
        id: 'quarry-user',
        quarry_id: 'quarry-1',
        user_id: 'user-1',
        review_mode: REVIEW_MODE_QUERY,
        can_post_queries: false,
        can_post_answers: true,
      },
    })

    expect(policy).toEqual({
      reviewMode: REVIEW_MODE_QUERY,
      canPostQueries: false,
      canPostAnswers: true,
    })
    expect(shouldReviewQuery(policy)).toBe(true)
    expect(shouldReviewAnswer(policy)).toBe(false)
  })

  it('falls back to the quarry review mode when no quarry default policy exists', async () => {
    executeTakeFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'quarry-1', content_review_mode: REVIEW_MODE_QUERY_AND_ANSWER })

    await expect(getEffectivePostingPolicy({ quarryId: 'quarry-1', userId: 'user-1' })).resolves.toEqual({
      reviewMode: REVIEW_MODE_QUERY_AND_ANSWER,
      canPostQueries: true,
      canPostAnswers: true,
    })

    expect(selectFrom).toHaveBeenCalledWith('quarries')
  })
})