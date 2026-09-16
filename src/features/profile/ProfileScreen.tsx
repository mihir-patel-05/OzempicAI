import { useEffect, useState } from 'react'
import { Card } from '../../components/Card'
import { Banner } from '../../components/Banner'
import { useAuth } from '../../auth/AuthProvider'
import { Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { useUpdateUserProfile, useUserProfile } from '../../hooks/useUserProfile'

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
  const [password, setPassword] = useState('')
  const email = session?.user.email ?? '—'

  useEffect(() => {
    if (!profile.data) return
    setName(profile.data.name ?? '')
    setHeight(profile.data.height_cm?.toString() ?? '')
    setWeight(profile.data.weight_kg?.toString() ?? '')
    setAge(profile.data.age?.toString() ?? '')
    setCalorieGoal(profile.data.daily_calorie_goal.toString())
    setWaterGoal(profile.data.daily_water_goal_ml.toString())
  }, [profile.data])

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
      await updateProfile.mutateAsync({
        name: name.trim(),
        height_cm: optionalNumber(height),
        weight_kg: optionalNumber(weight),
        age: optionalInteger(age),
        daily_calorie_goal: calories,
        daily_water_goal_ml: water,
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
              <div style={twoColumns}>
                <Field label="Height" value={height} onChange={setHeight} type="number" inputMode="decimal" placeholder="cm" min="1" />
                <Field label="Current weight" value={weight} onChange={setWeight} type="number" inputMode="decimal" placeholder="kg" min="1" />
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
