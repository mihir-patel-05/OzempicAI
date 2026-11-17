import { Card } from '../../components/Card'
import { Icon } from '../../components/Icon'
import { PrimaryButton } from '../../components/PrimaryButton'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import type { NotificationStatus } from '../../hooks/usePushNotifications'

const MESSAGES: Record<Exclude<NotificationStatus, 'off' | 'on'>, string> = {
  loading: 'Checking this device…',
  'server-off': 'Notifications aren’t switched on for this server yet.',
  'install-first':
    'On iPhone and iPad, notifications only work from the Home Screen app. In Safari, tap Share, then Add to Home Screen, and open OzempicAI from there.',
  unsupported: 'This browser can’t show notifications from web apps.',
  blocked: 'Notifications are blocked for OzempicAI. Allow them in your browser or system settings, then come back.',
}

/** Turn fasting notifications on or off for this device, and send a test. */
export function NotificationsCard() {
  const { status, enable, disable, test } = usePushNotifications()
  const error = enable.error ?? disable.error ?? test.error

  return (
    <Card padding="lg">
      <div className="screen-stack" style={{ gap: 'var(--space-ms)' }}>
        <div className="fasting-card-head" style={{ minHeight: 0 }}>
          <span className="tile-icon" style={{ ['--tone' as string]: 'var(--fasting-ring)', width: 32, height: 32, borderRadius: 10 }}>
            <Icon name="timer" size={17} />
          </span>
          <span className="fasting-card-title">
            <strong>Notifications</strong>
            <span>
              {status === 'on'
                ? 'On for this device: an hour before your goal, and when you reach it.'
                : status === 'off'
                  ? 'A heads-up an hour before your goal and when you reach it, even with the app closed.'
                  : MESSAGES[status]}
            </span>
          </span>
        </div>

        {status === 'off' && (
          <PrimaryButton type="button" loading={enable.isPending} onClick={() => enable.mutate()} style={{ width: '100%' }}>
            Turn on notifications
          </PrimaryButton>
        )}

        {status === 'on' && (
          <div className="fasting-two-up">
            <PrimaryButton type="button" variant="outline" loading={disable.isPending} onClick={() => disable.mutate()}>
              Turn off
            </PrimaryButton>
            <PrimaryButton type="button" variant="outline" loading={test.isPending} onClick={() => test.mutate()}>
              Send a test
            </PrimaryButton>
          </div>
        )}

        {test.data && !test.isPending && (
          <p role="status" className="fasting-hint" style={{ margin: 0 }}>
            {test.data.sent === 0
              ? 'Nothing was delivered. Try turning notifications off and on again.'
              : `Sent to ${test.data.sent} ${test.data.sent === 1 ? 'device' : 'devices'}.`}
          </p>
        )}
        {error && (
          <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>
            {error.message}
          </p>
        )}
      </div>
    </Card>
  )
}
