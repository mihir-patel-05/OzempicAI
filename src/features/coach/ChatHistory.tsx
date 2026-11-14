import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { IconButton } from '../../components/IconButton'
import { SectionHeader } from '../../components/PageHeader'
import { useDeleteConversation } from '../../hooks/useCoach'
import type { CoachConversation } from './types'

interface ChatHistoryProps {
  conversations: CoachConversation[]
  activeId: string | null
  onOpen: (id: string) => void
  onDeleted: (id: string) => void
}

/** Earlier chats, newest first, to reopen or delete. */
export function ChatHistory({ conversations, activeId, onOpen, onDeleted }: ChatHistoryProps) {
  const remove = useDeleteConversation()

  return (
    <Card padding="md">
      <SectionHeader title="Your chats" as="h2" meta={`${conversations.length}`} />
      {remove.isError && <Banner tone="error">Couldn&rsquo;t delete that chat. Please try again.</Banner>}
      {conversations.length === 0 ? (
        <p className="empty-note">No chats yet.</p>
      ) : (
        <ul className="row-list">
          {conversations.map((chat) => (
            <li key={chat.id}>
              <button
                type="button"
                className="coach-history-open"
                aria-current={chat.id === activeId || undefined}
                onClick={() => onOpen(chat.id)}
              >
                <span className="row-title">{chat.title || 'New chat'}</span>
                <span className="row-meta">{formatWhen(chat.updated_at)}</span>
              </button>
              <IconButton
                icon="trash"
                tone="danger"
                label={`Delete chat: ${chat.title || 'New chat'}`}
                disabled={remove.isPending}
                onClick={() => {
                  if (!window.confirm('Delete this chat? This can’t be undone.')) return
                  remove.mutate(chat.id, { onSuccess: () => onDeleted(chat.id) })
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
