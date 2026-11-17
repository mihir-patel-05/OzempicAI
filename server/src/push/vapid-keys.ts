/**
 * Print a new VAPID key pair for Web Push, ready to paste into the API's
 * environment (Railway variables, or server/.env for development).
 *
 *   npm run vapid:keys
 *
 * Generate once per deployment and keep it: browsers subscribe against the
 * public key, so changing it means every device has to turn notifications on
 * again.
 */
import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()
console.log(`VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey}`)
console.log('VAPID_SUBJECT=mailto:you@example.com  # a contact address for the push services')
