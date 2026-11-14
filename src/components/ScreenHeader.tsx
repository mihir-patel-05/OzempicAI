import { PageHeader } from './PageHeader'

/** Sub-screen header: back link to the log hub, title, status line. */
export function ScreenHeader({
  title,
  subtitle,
  back = '/log',
}: {
  title: string
  subtitle?: string
  back?: string
}) {
  return <PageHeader title={title} subtitle={subtitle} back={back} backLabel={back === '/log' ? 'Log' : 'Back'} />
}
