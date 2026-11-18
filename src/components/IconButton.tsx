import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName
  label: string
  tone?: 'default' | 'danger'
}

/** 44×44 tap target around an 18px glyph. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, tone = 'default', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`icon-button${tone === 'danger' ? ' danger' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      <Icon name={icon} size={18} />
    </button>
  )
})
