import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import {
  browserPushEnvironment,
  currentSubscription,
  pushSupport,
  subscribeThisDevice,
  subscribedWithKey,
  unsubscribeThisDevice,
} from '../lib/push'

interface PushConfig {
  enabled: boolean
  public_key: string | null
}

export type NotificationStatus =
  | 'loading'
  /** The server has no VAPID keys. */
  | 'server-off'
  /** iPhone or iPad in a Safari tab. */
  | 'install-first'
  | 'unsupported'
  /** The user blocked notifications for this site. */
  | 'blocked'
  | 'off'
  | 'on'

/** Accounts whose subscription this page load has already re-sent to the server. */
const resynced = new Set<string>()

/** Fasting notifications on this device: where they stand, and turning them on or off. */
export function usePushNotifications() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const config = useQuery({
    enabled: !!userId,
    queryKey: ['push-config', userId],
    queryFn: () => api<PushConfig>('/push/config'),
    staleTime: Infinity,
  })
  const [support] = useState(() => pushSupport(browserPushEnvironment()))
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    'Notification' in window ? Notification.permission : 'default',
  )
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const publicKey = config.data?.enabled ? config.data.public_key : null

  // Is this browser subscribed? If so, send it to the server once per page
  // load: the server may have dropped it, or another account may have taken
  // it over on this browser. A subscription made with old keys is useless, so
  // it is removed and the user is offered "Turn on" again.
  useEffect(() => {
    if (support !== 'supported' || !publicKey || !userId) return
    let cancelled = false
    ;(async () => {
      const subscription = await currentSubscription()
      if (cancelled) return
      if (!subscription) return setSubscribed(false)
      if (!subscribedWithKey(subscription, publicKey)) {
        await subscription.unsubscribe()
        if (!cancelled) setSubscribed(false)
        return
      }
      if (!resynced.has(userId)) {
        await api('/push/subscriptions', { method: 'POST', body: subscription.toJSON() })
        resynced.add(userId)
      }
      if (!cancelled) setSubscribed(true)
    })().catch(() => {
      if (!cancelled) setSubscribed(false)
    })
    return () => {
      cancelled = true
    }
  }, [support, publicKey, userId])

  const enable = useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error('Notifications are not set up on this server.')
      try {
        const subscription = await subscribeThisDevice(publicKey)
        await api('/push/subscriptions', { method: 'POST', body: subscription.toJSON() })
      } finally {
        setPermission(Notification.permission)
      }
    },
    onSuccess: () => setSubscribed(true),
  })

  const disable = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeThisDevice()
      if (endpoint) await api('/push/subscriptions', { method: 'DELETE', body: { endpoint } })
    },
    onSuccess: () => setSubscribed(false),
  })

  const test = useMutation({
    mutationFn: () => api<{ devices: number; sent: number }>('/push/test', { method: 'POST' }),
  })

  let status: NotificationStatus
  if (config.isLoading) status = 'loading'
  else if (!publicKey) status = 'server-off'
  else if (support !== 'supported') status = support
  else if (permission === 'denied') status = 'blocked'
  else if (subscribed === null) status = 'loading'
  else status = subscribed ? 'on' : 'off'

  return { status, enable, disable, test }
}
