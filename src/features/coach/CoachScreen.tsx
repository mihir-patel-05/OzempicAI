import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Banner } from '../../components/Banner'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { isCoachNotConfigured, useConversation, useConversations, useSendMessage } from '../../hooks/useCoach'
import { ApiError } from '../../lib/api'
import { ChatHistory } from './ChatHistory'
import { Composer, type ComposerHandle } from './Composer'
import { MessageBubble } from './MessageBubble'
import { useLiveTools } from './liveTools'

export const SUGGESTED_PROMPTS = [
  'How did this week compare to last week?',
  'Plan my meals for next week',
  'Add ingredients for a high-protein breakfast to my grocery list',
]

/** Within this many px of the bottom counts as "reading the latest". */
const STICK_TO_BOTTOM_PX = 160

export function CoachScreen() {
  const [params, setParams] = useSearchParams()
  const startNew = params.has('new')
  // ?draft= prefills the composer (e.g. "Plan with AI" on Plans); it is never sent for you.
  const [draft] = useState(() => params.get('draft') ?? '')
  const conversations = useConversations()

  // null = a new, unsaved chat. undefined = not chosen yet (use the latest).
  const [chosenId, setChosenId] = useState<string | null | undefined>(startNew ? null : undefined)
  const latestId = conversations.data?.[0]?.id ?? null
  const conversationId = chosenId === undefined ? latestId : chosenId

  const onConversation = useCallback((id: string) => setChosenId(id), [])
  const { send, turn, isSending, clearTurn } = useSendMessage(onConversation)
  // Hold the saved history steady until the live turn has been swapped out,
  // so a refetch can't show the same reply twice. An unsaved turn isn't in it.
  const conversation = useConversation(conversationId, !!turn && !turn.unsaved)
  const live = useLiveTools()
  const [showHistory, setShowHistory] = useState(false)

  // Screen readers hear the finished reply once, not every streamed token.
  const [announcement, setAnnouncement] = useState('')
  const wasStreaming = useRef(false)
  useEffect(() => {
    const streaming = turn?.streaming ?? false
    if (wasStreaming.current && !streaming && turn) {
      setAnnouncement(turn.assistant.error ?? `Coach: ${turn.assistant.text.slice(0, 400)}`)
    }
    wasStreaming.current = streaming
  }, [turn])
  const composer = useRef<ComposerHandle>(null)

  // Opened with ?new=1 or ?draft=: start fresh once, then tidy the URL.
  useEffect(() => {
    if (startNew || params.has('draft')) setParams({}, { replace: true })
  }, [startNew, params, setParams])

  useEffect(() => {
    if (draft) composer.current?.focus()
  }, [draft])

  // A chat deleted elsewhere (or never ours) falls back to a new one.
  useEffect(() => {
    if (conversation.error instanceof ApiError && conversation.error.status === 404) setChosenId(null)
  }, [conversation.error])

  const saved = useMemo(() => (conversationId ? conversation.data?.messages ?? [] : []), [conversationId, conversation.data])

  // Keep the newest message in view while it streams, unless the user has
  // scrolled up to read something earlier. Scrolling to the very bottom (not
  // to the last message) keeps it clear of the sticky composer.
  const pinned = useRef(true)
  useEffect(() => {
    const onScroll = () => {
      const fromBottom = document.documentElement.scrollHeight - window.innerHeight - window.scrollY
      pinned.current = fromBottom < STICK_TO_BOTTOM_PX
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useLayoutEffect(() => {
    if (pinned.current) window.scrollTo({ top: document.documentElement.scrollHeight })
  }, [saved, turn])

  function startNewChat() {
    if (isSending) return
    clearTurn()
    setChosenId(null)
    setShowHistory(false)
    pinned.current = true
    composer.current?.focus()
  }

  function openChat(id: string) {
    if (isSending) return
    clearTurn()
    setChosenId(id)
    setShowHistory(false)
    pinned.current = true
  }

  function submit(message: string) {
    pinned.current = true
    void send(message, conversationId)
  }

  function retry() {
    if (!turn) return
    const message = turn.user.text
    clearTurn()
    submit(message)
  }

  if (isCoachNotConfigured(conversations.error)) {
    return (
      <div className="screen-stack">
        <PageHeader title="Coach" back="/" backLabel="Today" />
        <div className="coach-empty">
          <span className="coach-empty-mark" aria-hidden="true">
            <Icon name="sparkle" size={26} />
          </span>
          <h2>AI coach isn&rsquo;t set up yet</h2>
          <p>Once it&rsquo;s switched on, you can ask about your eating, plan meals and build your grocery list here.</p>
        </div>
      </div>
    )
  }

  const loadingHistory = conversations.isLoading || (!!conversationId && conversation.isLoading && !turn)
  const empty = !loadingHistory && saved.length === 0 && !turn

  return (
    <div className="coach-screen">
      <PageHeader
        title="Coach"
        back="/"
        backLabel="Today"
        action={
          <div className="coach-header-actions">
            {(conversations.data?.length ?? 0) > 0 && (
              <button
                type="button"
                className="chip chip-toggle"
                aria-pressed={showHistory}
                aria-expanded={showHistory}
                aria-controls="coach-history"
                onClick={() => setShowHistory((open) => !open)}
                disabled={isSending}
              >
                <Icon name="chat" size={16} /> Chats
              </button>
            )}
            <button type="button" className="chip" onClick={startNewChat} disabled={isSending || (empty && conversationId === null)}>
              <Icon name="plus" size={16} strokeWidth={2.2} /> New chat
            </button>
          </div>
        }
      />

      {showHistory && (
        <div id="coach-history">
          <ChatHistory
            conversations={conversations.data ?? []}
            activeId={conversationId}
            onOpen={openChat}
            onDeleted={(id) => {
              if (id === conversationId) setChosenId(null)
            }}
          />
        </div>
      )}

      <section className="coach-messages" aria-label="Conversation" aria-busy={isSending || undefined}>
        {loadingHistory && <p className="empty-note">Loading your chat…</p>}
        {conversations.isError && !isCoachNotConfigured(conversations.error) && (
          <Banner tone="error">Couldn&rsquo;t load your chats. Check your connection and try again.</Banner>
        )}

        {empty && (
          <div className="coach-empty">
            <span className="coach-empty-mark" aria-hidden="true">
              <Icon name="sparkle" size={26} />
            </span>
            <h2>Hi! How can I help?</h2>
            <p>I can look at your calorie logs, give feedback, plan your meals for the week and add to your grocery list.</p>
            <div className="coach-suggestions">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" className="coach-suggestion" onClick={() => submit(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {saved.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            tools={live.byMessage.get(message.id)}
            error={live.errors.get(message.id)}
          />
        ))}

        {turn && (
          <>
            <MessageBubble message={turn.user} />
            <MessageBubble
              message={turn.assistant}
              error={turn.assistant.error}
              streaming={turn.streaming}
              activeTool={turn.activeTool}
            />
            {turn.unsaved && !turn.streaming && (
              <div className="coach-retry">
                <button type="button" className="chip" onClick={retry}>
                  Try again
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="coach-composer-dock">
        <Composer ref={composer} disabled={isSending} initialValue={draft} onSend={submit} />
        <p className="coach-disclaimer">Your coach can make mistakes and isn&rsquo;t medical advice.</p>
      </div>
    </div>
  )
}
