import {
  extractMentionedUsernames,
  getNotificationPageItems,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  notifyMentions,
  notifyQuerySubscribers,
  refreshProfileMetrics,
  subscribeUserToQuery,
  unsubscribeUserFromQuery,
} from '@/lib/notifications'

const sqlExecute = jest.fn().mockResolvedValue(undefined)

const selectFromQueues: Record<string, Array<() => unknown>> = {}
const insertIntoHandlers = new Map<string, () => unknown>()
const deleteFromHandlers = new Map<string, () => unknown>()
const updateTableHandlers = new Map<string, () => unknown>()

function queueSelectFrom(table: string, builder: () => unknown) {
  selectFromQueues[table] ??= []
  selectFromQueues[table].push(builder)
}

function resetQueues() {
  Object.keys(selectFromQueues).forEach((key) => {
    delete selectFromQueues[key]
  })
  insertIntoHandlers.clear()
  deleteFromHandlers.clear()
  updateTableHandlers.clear()
}

jest.mock('@/lib/db', () => ({
  db: {
    deleteFrom: (table: string) => {
      const handler = deleteFromHandlers.get(table)
      if (!handler) {
        throw new Error(`Unexpected deleteFrom ${table}`)
      }

      return handler()
    },
    insertInto: (table: string) => {
      const handler = insertIntoHandlers.get(table)
      if (!handler) {
        throw new Error(`Unexpected insertInto ${table}`)
      }

      return handler()
    },
    selectFrom: (table: string) => {
      const handler = selectFromQueues[table]?.shift()
      if (!handler) {
        throw new Error(`Unexpected selectFrom ${table}`)
      }

      return handler()
    },
    updateTable: (table: string) => {
      const handler = updateTableHandlers.get(table)
      if (!handler) {
        throw new Error(`Unexpected updateTable ${table}`)
      }

      return handler()
    },
  },
}))

jest.mock('@/lib/utils', () => ({
  generateUUID: jest.fn(() => 'generated-id'),
  getRichTextPreview: jest.fn((content: string, limit = 120) => content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit)),
  richTextToPlainText: jest.fn((content: string) => content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
}))

jest.mock('kysely', () => ({
  sql: () => ({
    execute: (...args: unknown[]) => sqlExecute(...args),
  }),
}))

describe('notifications helpers', () => {
  beforeEach(() => {
    resetQueues()
    sqlExecute.mockClear()
  })

  it('extracts unique, lowercase mentioned usernames', () => {
    expect(extractMentionedUsernames('<p>Hello @Alice and @bob and @Alice again</p>')).toEqual(['alice', 'bob'])
  })

  it('subscribes a user to a query with the provided reason', async () => {
    const execute = jest.fn().mockResolvedValue(undefined)
    const doNothing = jest.fn(() => ({ execute }))
    const columns = jest.fn(() => ({ doNothing }))
    const onConflict = jest.fn((callback?: (oc: { columns: typeof columns }) => unknown) => {
      callback?.({ columns })
      return { execute }
    })
    const values = jest.fn(() => ({ onConflict }))

    insertIntoHandlers.set('query_subscriptions', () => ({ values }))

    await subscribeUserToQuery('query-1', 'user-1', 'author')

    expect(values).toHaveBeenCalledWith({ query_id: 'query-1', user_id: 'user-1', reason: 'author' })
    expect(columns).toHaveBeenCalledWith(['query_id', 'user_id'])
    expect(execute).toHaveBeenCalled()
  })

  it('unsubscribes a user from a query', async () => {
    const execute = jest.fn().mockResolvedValue(undefined)
    const whereUser = jest.fn(() => ({ execute }))
    const whereQuery = jest.fn(() => ({ where: whereUser }))

    deleteFromHandlers.set('query_subscriptions', () => ({ where: whereQuery }))

    await unsubscribeUserFromQuery('query-1', 'user-1')

    expect(whereQuery).toHaveBeenCalledWith('query_id', '=', 'query-1')
    expect(whereUser).toHaveBeenCalledWith('user_id', '=', 'user-1')
  })

  it('returns the unread notification count as a number', async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue({ count: '5' })
    const whereUnread = jest.fn(() => ({ executeTakeFirst }))
    const whereUser = jest.fn(() => ({ where: whereUnread }))
    const select = jest.fn(() => ({ where: whereUser }))

    queueSelectFrom('notifications', () => ({ select }))

    await expect(getUnreadNotificationCount('user-1')).resolves.toBe(5)
  })

  it('falls back to zero unread notifications when no row is returned', async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue(undefined)
    const whereUnread = jest.fn(() => ({ executeTakeFirst }))
    const whereUser = jest.fn(() => ({ where: whereUnread }))
    const select = jest.fn(() => ({ where: whereUser }))

    queueSelectFrom('notifications', () => ({ select }))

    await expect(getUnreadNotificationCount('user-1')).resolves.toBe(0)
  })

  it('marks all unread notifications as read for a user', async () => {
    const execute = jest.fn().mockResolvedValue(undefined)
    const whereUnread = jest.fn(() => ({ execute }))
    const whereUser = jest.fn(() => ({ where: whereUnread }))
    const set = jest.fn(() => ({ where: whereUser }))

    updateTableHandlers.set('notifications', () => ({ set }))

    await markAllNotificationsRead('user-1')

    expect(set).toHaveBeenCalledWith({ is_read: true })
    expect(whereUser).toHaveBeenCalledWith('user_id', '=', 'user-1')
    expect(whereUnread).toHaveBeenCalledWith('is_read', '=', false)
  })

  it('notifies distinct query subscribers and excludes the actor', async () => {
    const executeSubscriptions = jest.fn().mockResolvedValue([
      { user_id: 'user-1' },
      { user_id: 'user-2' },
      { user_id: 'user-2' },
      { user_id: 'user-3' },
    ])
    const whereQuery = jest.fn(() => ({ execute: executeSubscriptions }))
    const select = jest.fn(() => ({ where: whereQuery }))
    const executeInsert = jest.fn().mockResolvedValue(undefined)
    const values = jest.fn(() => ({ execute: executeInsert }))

    queueSelectFrom('query_subscriptions', () => ({ select }))
    insertIntoHandlers.set('notifications', () => ({ values }))

    await notifyQuerySubscribers({
      queryId: 'query-1',
      actorUserId: 'user-1',
      href: '/q/javascript/query/query-1',
      title: 'Someone replied',
      body: '<p>Reply body</p>',
      explicitRecipientIds: ['user-3', 'user-4'],
    })

    expect(values).toHaveBeenCalledTimes(1)
    expect(values.mock.calls[0][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ user_id: 'user-2', type: 'query_activity', actor_user_id: 'user-1' }),
      expect.objectContaining({ user_id: 'user-3', type: 'query_activity', actor_user_id: 'user-1' }),
      expect.objectContaining({ user_id: 'user-4', type: 'query_activity', actor_user_id: 'user-1' }),
    ]))
  })

  it('skips inserts when query subscriber notifications resolve to no recipients', async () => {
    const executeSubscriptions = jest.fn().mockResolvedValue([{ user_id: 'user-1' }])
    const whereQuery = jest.fn(() => ({ execute: executeSubscriptions }))
    const select = jest.fn(() => ({ where: whereQuery }))

    queueSelectFrom('query_subscriptions', () => ({ select }))

    await expect(notifyQuerySubscribers({
      queryId: 'query-1',
      actorUserId: 'user-1',
      href: '/q/javascript/query/query-1',
      title: 'Someone replied',
      body: '<p>Reply body</p>',
    })).resolves.toBeUndefined()
  })

  it('returns early when mention content has no usernames', async () => {
    await expect(notifyMentions({
      actorUserId: 'user-1',
      content: '<p>No mentions here</p>',
      href: '/q/javascript/query/query-1',
      title: 'Mentioned you',
    })).resolves.toBeUndefined()
  })

  it('only notifies interacted-only mentions when the user participated in the thread', async () => {
    const executeResolvedMentionedUsers = jest.fn().mockResolvedValue([
      { id: 'user-2', username: 'bob' },
      { id: 'user-3', username: 'carol' },
    ])
    const whereResolvedNotActor = jest.fn(() => ({ execute: executeResolvedMentionedUsers }))
    const whereResolvedUsernames = jest.fn(() => ({ where: whereResolvedNotActor }))
    const selectResolvedMentionedUsers = jest.fn(() => ({ where: whereResolvedUsernames }))

    const executeMentionPreferences = jest.fn().mockResolvedValue([
      { id: 'user-2', username: 'bob', mention_notifications: 'interacted_only' },
      { id: 'user-3', username: 'carol', mention_notifications: 'all' },
    ])
    const whereMentionIds = jest.fn(() => ({ execute: executeMentionPreferences }))
    const selectMentionPreferences = jest.fn(() => ({ where: whereMentionIds }))
    const leftJoinProfiles = jest.fn(() => ({ select: selectMentionPreferences }))

    const executeQueryAuthor = jest.fn().mockResolvedValue({ user_id: 'user-2' })
    const whereQueryId = jest.fn(() => ({ executeTakeFirst: executeQueryAuthor }))
    const selectQueryAuthor = jest.fn(() => ({ where: whereQueryId }))

    const executeAnswerAuthors = jest.fn().mockResolvedValue([])
    const whereAnswerQueryId = jest.fn(() => ({ execute: executeAnswerAuthors }))
    const selectAnswerAuthors = jest.fn(() => ({ where: whereAnswerQueryId }))

    const executeSubscribers = jest.fn().mockResolvedValue([])
    const whereSubscriptionQueryId = jest.fn(() => ({ execute: executeSubscribers }))
    const selectSubscribers = jest.fn(() => ({ where: whereSubscriptionQueryId }))

    const executeInsert = jest.fn().mockResolvedValue(undefined)
    const values = jest.fn(() => ({ execute: executeInsert }))

    queueSelectFrom('user', () => ({ select: selectResolvedMentionedUsers }))
    queueSelectFrom('user', () => ({ leftJoin: leftJoinProfiles }))
    queueSelectFrom('queries', () => ({ select: selectQueryAuthor }))
    queueSelectFrom('answers', () => ({ select: selectAnswerAuthors }))
    queueSelectFrom('query_subscriptions', () => ({ select: selectSubscribers }))
    insertIntoHandlers.set('notifications', () => ({ values }))

    await notifyMentions({
      actorUserId: 'user-1',
      content: '<p>Hello @bob and @carol</p>',
      href: '/q/javascript/query/query-1',
      title: 'Mentioned you',
      queryId: 'query-1',
    })

    expect(values).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ user_id: 'user-2', type: 'mention', source_id: 'bob' }),
      expect.objectContaining({ user_id: 'user-3', type: 'mention', source_id: 'carol' }),
    ]))
  })

  it('skips interacted-only mention recipients when there is no qualifying interaction context', async () => {
    const executeResolvedMentionedUsers = jest.fn().mockResolvedValue([
      { id: 'user-2', username: 'bob' },
      { id: 'user-3', username: 'carol' },
    ])
    const whereResolvedNotActor = jest.fn(() => ({ execute: executeResolvedMentionedUsers }))
    const whereResolvedUsernames = jest.fn(() => ({ where: whereResolvedNotActor }))
    const selectResolvedMentionedUsers = jest.fn(() => ({ where: whereResolvedUsernames }))

    const executeMentionPreferences = jest.fn().mockResolvedValue([
      { id: 'user-2', username: 'bob', mention_notifications: 'interacted_only' },
      { id: 'user-3', username: 'carol', mention_notifications: 'all' },
    ])
    const whereMentionIds = jest.fn(() => ({ execute: executeMentionPreferences }))
    const selectMentionPreferences = jest.fn(() => ({ where: whereMentionIds }))
    const leftJoinProfiles = jest.fn(() => ({ select: selectMentionPreferences }))

    const executeInsert = jest.fn().mockResolvedValue(undefined)
    const values = jest.fn(() => ({ execute: executeInsert }))

    queueSelectFrom('user', () => ({ select: selectResolvedMentionedUsers }))
    queueSelectFrom('user', () => ({ leftJoin: leftJoinProfiles }))
    insertIntoHandlers.set('notifications', () => ({ values }))

    await notifyMentions({
      actorUserId: 'user-1',
      content: '<p>Hello @bob and @carol</p>',
      href: '/q/javascript/query/query-1',
      title: 'Mentioned you',
    })

    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({ user_id: 'user-3', type: 'mention', source_id: 'carol' }),
    ])
  })

  it('fans out @all mentions to thread subscribers who were not directly mentioned', async () => {
    const executeResolvedMentionedUsers = jest.fn().mockResolvedValue([
      { id: 'user-2', username: 'bob' },
    ])
    const whereResolvedNotActor = jest.fn(() => ({ execute: executeResolvedMentionedUsers }))
    const whereResolvedUsernames = jest.fn(() => ({ where: whereResolvedNotActor }))
    const selectResolvedMentionedUsers = jest.fn(() => ({ where: whereResolvedUsernames }))

    const executeMentionPreferences = jest.fn().mockResolvedValue([
      { id: 'user-2', username: 'bob', mention_notifications: 'all' },
    ])
    const whereMentionIds = jest.fn(() => ({ execute: executeMentionPreferences }))
    const selectMentionPreferences = jest.fn(() => ({ where: whereMentionIds }))
    const leftJoinProfiles = jest.fn(() => ({ select: selectMentionPreferences }))

    const executeQueryAuthor = jest.fn().mockResolvedValue({ user_id: 'user-2' })
    const whereQueryId = jest.fn(() => ({ executeTakeFirst: executeQueryAuthor }))
    const selectQueryAuthor = jest.fn(() => ({ where: whereQueryId }))

    const executeAnswerAuthors = jest.fn().mockResolvedValue([{ user_id: 'user-4' }])
    const whereAnswerQueryId = jest.fn(() => ({ execute: executeAnswerAuthors }))
    const selectAnswerAuthors = jest.fn(() => ({ where: whereAnswerQueryId }))

    const executeSubscribersForInteractions = jest.fn().mockResolvedValue([{ user_id: 'user-5' }])
    const whereInteractedSubscriptions = jest.fn(() => ({ execute: executeSubscribersForInteractions }))
    const selectInteractedSubscriptions = jest.fn(() => ({ where: whereInteractedSubscriptions }))

    const executeMentionAllSubscribers = jest.fn().mockResolvedValue([
      { user_id: 'user-2' },
      { user_id: 'user-4' },
      { user_id: 'user-5' },
      { user_id: 'user-1' },
    ])
    const whereMentionAllQueryId = jest.fn(() => ({ execute: executeMentionAllSubscribers }))
    const selectMentionAllSubscribers = jest.fn(() => ({ where: whereMentionAllQueryId }))

    const executeInsert = jest.fn().mockResolvedValue(undefined)
    const values = jest.fn(() => ({ execute: executeInsert }))

    queueSelectFrom('user', () => ({ select: selectResolvedMentionedUsers }))
    queueSelectFrom('user', () => ({ leftJoin: leftJoinProfiles }))
    queueSelectFrom('queries', () => ({ select: selectQueryAuthor }))
    queueSelectFrom('answers', () => ({ select: selectAnswerAuthors }))
    queueSelectFrom('query_subscriptions', () => ({ select: selectInteractedSubscriptions }))
    queueSelectFrom('query_subscriptions', () => ({ select: selectMentionAllSubscribers }))
    insertIntoHandlers.set('notifications', () => ({ values }))

    await notifyMentions({
      actorUserId: 'user-1',
      content: '<p>Hello @bob and @all</p>',
      href: '/q/javascript/query/query-1',
      title: 'Alice mentioned you',
      queryId: 'query-1',
    })

    expect(values).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ user_id: 'user-2', type: 'mention', source_id: 'bob', title: 'Alice mentioned you' }),
      expect.objectContaining({ user_id: 'user-4', type: 'mention_all', source_id: 'all', title: 'Alice used @all' }),
      expect.objectContaining({ user_id: 'user-5', type: 'mention_all', source_id: 'all', title: 'Alice used @all' }),
    ]))
  })

  it('returns notification page items ordered by most recent activity', async () => {
    const execute = jest.fn().mockResolvedValue([{ id: 'note-1', title: 'Alert' }])
    const limit = jest.fn(() => ({ execute }))
    const orderBy = jest.fn(() => ({ limit }))
    const where = jest.fn(() => ({ orderBy }))
    const select = jest.fn(() => ({ where }))
    const leftJoin = jest.fn(() => ({ select }))

    queueSelectFrom('notifications', () => ({ leftJoin }))

    await expect(getNotificationPageItems('user-1')).resolves.toEqual([{ id: 'note-1', title: 'Alert' }])
    expect(where).toHaveBeenCalledWith('notifications.user_id', '=', 'user-1')
    expect(orderBy).toHaveBeenCalledWith('notifications.created_at', 'desc')
    expect(limit).toHaveBeenCalledWith(50)
  })

  it('refreshes profile metrics from the aggregated query and answer totals', async () => {
    const executeQueryAggregate = jest.fn().mockResolvedValue({ count: 4, score: 11 })
    const whereQueryUser = jest.fn(() => ({ executeTakeFirst: executeQueryAggregate }))
    const selectQueryAggregate = jest.fn(() => ({ where: whereQueryUser }))

    const executeAnswerAggregate = jest.fn().mockResolvedValue({ count: 6, score: 9 })
    const whereAnswerUser = jest.fn(() => ({ executeTakeFirst: executeAnswerAggregate }))
    const selectAnswerAggregate = jest.fn(() => ({ where: whereAnswerUser }))

    const executeAcceptedAggregate = jest.fn().mockResolvedValue({ count: 2 })
    const whereAcceptedUser = jest.fn(() => ({ executeTakeFirst: executeAcceptedAggregate }))
    const selectAcceptedAggregate = jest.fn(() => ({ where: whereAcceptedUser }))
    const innerJoinAccepted = jest.fn(() => ({ select: selectAcceptedAggregate }))

    const executeBansAggregate = jest.fn().mockResolvedValue({ count: 1 })
    const whereBanStatus = jest.fn(() => ({ executeTakeFirst: executeBansAggregate }))
    const whereBanUser = jest.fn(() => ({ where: whereBanStatus }))
    const selectBansAggregate = jest.fn(() => ({ where: whereBanUser }))

    const executeUpdate = jest.fn().mockResolvedValue(undefined)
    const whereUpdateUser = jest.fn(() => ({ execute: executeUpdate }))
    const set = jest.fn(() => ({ where: whereUpdateUser }))

    queueSelectFrom('queries', () => ({ select: selectQueryAggregate }))
    queueSelectFrom('answers', () => ({ select: selectAnswerAggregate }))
    queueSelectFrom('queries', () => ({ innerJoin: innerJoinAccepted }))
    queueSelectFrom('bans_and_timeouts', () => ({ select: selectBansAggregate }))
    updateTableHandlers.set('profiles', () => ({ set }))

    await refreshProfileMetrics('user-1')

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      reputation: 20,
      questions_asked: 4,
      replies_provided: 6,
      replies_accepted: 2,
      active_bans_count: 1,
      updated_at: expect.any(Date),
    }))
    expect(whereUpdateUser).toHaveBeenCalledWith('user_id', '=', 'user-1')
  })
})
