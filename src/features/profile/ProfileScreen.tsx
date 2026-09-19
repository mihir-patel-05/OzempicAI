import { useEffect, useState } from 'react'
import { Card } from '../../components/Card'
import { Banner } from '../../components/Banner'
import { useAuth } from '../../auth/AuthProvider'
import { CapsLabel, Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { SegmentedPicker } from '../../components/SegmentedPicker'
import { useUpdateUserProfile, useUserProfile } from '../../hooks/useUserProfile'
import type { UnitSystem } from '../../types/db'
import {
  heightFromCm,
  heightToCm,
  heightUnit,
  roundForDisplay,
  weightFromKg,
  weightToKg,
  weightUnit,
} from '../../lib/units'

const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Metric (kg · cm)' },
  { value: 'imperial', label: 'Imperial (lb · in)' },
]

export function ProfileScreen() {
  const { session, signOut, updatePassword } = useAuth()
  const profile = useUserProfile()
  const updateProfile = useUpdateUserProfile()
  const [signingOut, setSigningOut] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [age, setAge] = useState('')
  const [calorieGoal, setCalorieGoal] = useState('2000')
  const [waterGoal, setWaterGoal] = useState('2500')
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric')
  const [password, setPassword] = useState('')
  const email = session?.user.email ?? '—'

  useEffect(() => {
    if (!profile.data) return
    const system = profile.data.unit_system ?? 'metric'
    setName(profile.data.name ?? '')
    setHeight(displayValue(profile.data.height_cm, (cm) => heightFromCm(cm, system)))
    setWeight(displayValue(profile.data.weight_kg, (kg) => weightFromKg(kg, system)))
    setAge(profile.data.age?.toString() ?? '')
    setCalorieGoal(profile.data.daily_calorie_goal.toString())
    setWaterGoal(profile.data.daily_water_goal_ml.toString())
    setUnitSystem(system)
  }, [profile.data])

  // Switching systems converts what is already typed in, so the fields keep
  // describing the same body rather than reading as a sudden weight change.
  function onUnitSystemChange(next: UnitSystem) {
    if (next === unitSystem) return
    setHeight(convertField(height, (v) => heightFromCm(heightToCm(v, unitSystem), next)))
    setWeight(convertField(weight, (v) => weightFromKg(weightToKg(v, unitSystem), next)))
    setUnitSystem(next)
  }

  async function onSignOut() {
    setSigningOut(true)
    setError(null)
    try {
      await signOut()
    } catch (err) {
      console.error('Failed to sign out', err)
      setError(err instanceof Error ? err.message : 'Failed to sign out.')
    } finally {
      setSigningOut(false)
    }
  }

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const calories = Math.round(Number(calorieGoal))
    const water = Math.round(Number(waterGoal))
    if (calories <= 0 || water <= 0) {
      setError('Daily goals must be greater than zero.')
      return
    }
    try {
      const heightEntered = optionalNumber(height)
      const weightEntered = optionalNumber(weight)
      await updateProfile.mutateAsync({
        name: name.trim(),
        height_cm:
          heightEntered === null ? null : heightToCm(heightEntered, unitSystem),
        weight_kg:
          weightEntered === null ? null : weightToKg(weightEntered, unitSystem),
        age: optionalInteger(age),
        daily_calorie_goal: calories,
        daily_water_goal_ml: water,
        unit_system: unitSystem,
      })
      setSuccess('Profile and daily goals saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
    }
  }

  async function onUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return
    setError(null)
    setSuccess(null)
    setUpdatingPassword(true)
    try {
      await updatePassword(password)
      setPassword('')
      setSuccess('Password updated successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password.')
    } finally {
      setUpdatingPassword(false)
    }
  }

  return (
    <div className="screen-stack">
      <header>
        <p style={{ margin: '0 0 3px', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}>Your settings</p>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 42px)', fontWeight: 500, letterSpacing: -1 }}>Make it yours.</h1>
        <p style={{ margin: '9px 0 8px', color: 'var(--text-secondary)', fontSize: 14 }}>{email}</p>
      </header>

      {error && <Banner tone="error">{error}</Banner>}
      {success && <Banner tone="info">{success}</Banner>}

      <div className="tracker-grid">
        <Card padding="lg" radius="hero" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h2 style={sectionTitle}>Profile & body</h2>
          {profile.isLoading ? (
            <p style={muted}>Loading your profile…</p>
          ) : (
            <form onSubmit={onSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <Field label="Name" value={name} onChange={setName} placeholder="Your name" autoComplete="name" autoCapitalize="words" />
              <div>
                <div style={{ marginBottom: 6 }}>
                  <CapsLabel>Units</CapsLabel>
                </div>
                <SegmentedPicker options={UNIT_OPTIONS} value={unitSystem} onChange={onUnitSystemChange} ariaLabel="Unit system" />
              </div>
              <div style={twoColumns}>
                <Field label={`Height (${heightUnit(unitSystem)})`} value={height} onChange={setHeight} type="number" inputMode="decimal" placeholder={heightUnit(unitSystem)} min="1" step="0.1" />
                <Field label={`Current weight (${weightUnit(unitSystem)})`} value={weight} onChange={setWeight} type="number" inputMode="decimal" placeholder={weightUnit(unitSystem)} min="1" step="0.1" />
              </div>
              <Field label="Age" value={age} onChange={setAge} type="number" inputMode="numeric" placeholder="Optional" min="1" max="130" />
              <h3 style={{ ...sectionTitle, marginTop: 8, marginBottom: 0, fontSize: 17 }}>Daily goals</h3>
              <div style={twoColumns}>
                <Field label="Calories" value={calorieGoal} onChange={setCalorieGoal} type="number" inputMode="numeric" placeholder="kcal" min="1" />
                <Field label="Water" value={waterGoal} onChange={setWaterGoal} type="number" inputMode="numeric" placeholder="ml" min="1" />
              </div>
              <PrimaryButton type="submit" loading={updateProfile.isPending}>Save changes</PrimaryButton>
            </form>
          )}
        </Card>

        <div className="screen-stack">
          <Card padding="lg" radius="hero" style={{ boxShadow: 'var(--shadow-card)' }}>
            <h2 style={sectionTitle}>Security</h2>
            <form onSubmit={onUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <Field label="New password" value={password} onChange={setPassword} type="password" autoComplete="new-password" placeholder="At least 8 characters" hint="Use this after following a password reset link, or anytime you want a new password." />
              <PrimaryButton type="submit" variant="outline" loading={updatingPassword} disabled={password.length < 8}>Update password</PrimaryButton>
            </form>
          </Card>

          <Card padding="lg" radius="hero" style={{ boxShadow: 'var(--shadow-card)' }}>
            <h2 style={sectionTitle}>Account</h2>
            <p style={{ ...muted, margin: '0 0 15px' }}>Your health entries stay associated with this private account.</p>
            <PrimaryButton type="button" onClick={onSignOut} loading={signingOut} variant="outline" tone="danger" style={{ width: '100%' }}>Sign out</PrimaryButton>
          </Card>
        </div>
      </div>
    </div>
  )
}

function displayValue(
  stored: number | null,
  convert: (value: number) => number,
): string {
  return stored === null || stored === undefined
    ? ''
    : roundForDisplay(convert(stored)).toString()
}

function convertField(value: string, convert: (n: number) => number): string {
  const parsed = optionalNumber(value)
  return parsed === null ? value : roundForDisplay(convert(parsed)).toString()
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function optionalInteger(value: string): number | null {
  const parsed = optionalNumber(value)
  return parsed === null ? null : Math.round(parsed)
}

const sectionTitle: React.CSSProperties = { margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }
const muted: React.CSSProperties = { color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1.6 }
const twoColumns: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }
