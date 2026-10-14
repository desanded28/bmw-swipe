/**
 * English source for the authEmails namespace. Owned by WP6 (security). Server-only namespace:
 * never sent to the browser. Emails to staff about their own account (src/lib/security/emails.ts):
 * each kind has subject, body and, when it carries a link, cta.
 */
export default {
  greeting: "Hi {name},",
  footer: {
    why: "You're receiving this email because of activity on your Sorriso account.",
    notYou: "If this wasn't you, change your password and tell the owner of your practice.",
  },
  verifyEmail: {
    subject: "Confirm your email address",
    body: "Please confirm that this is your email address to finish setting up {practice} on Sorriso. The link is valid for 24 hours.",
    cta: "Confirm my email",
  },
  verifyEmailAgain: {
    subject: "Confirm your email address",
    body: "Please confirm that this is the email address of your Sorriso account. The link is valid for 24 hours.",
    cta: "Confirm my email",
  },
  verifyPracticeEmail: {
    subject: "Confirm the email address of {practice}",
    body: "{owner} entered this address as the email of {practice} on Sorriso. Patients' replies and privacy requests will be sent here, and online booking stays paused until it is confirmed. The link is valid for 24 hours. If you don't know this practice, ignore this email: nothing changes.",
    cta: "Confirm this address",
  },
  signupExisting: {
    subject: "Someone tried to create an account with your email",
    body: "Someone, possibly you, tried to create a new practice on Sorriso with this email address, which already has an account. If it was you, log in instead, or reset your password if you've forgotten it. If it wasn't you, you can ignore this email: nothing was changed.",
    cta: "Log in",
  },
  passwordReset: {
    subject: "Reset your Sorriso password",
    body: "We received a request to reset the password of this account. The link is valid for 30 minutes and works once. If you didn't ask for it, ignore this email: your password stays the same.",
    cta: "Choose a new password",
  },
  passwordChanged: {
    subject: "Your Sorriso password was changed",
    body: "The password of your account was changed on {when}, and every device was signed out. If this wasn't you, reset your password straight away.",
    cta: "Reset my password",
  },
  invite: {
    subject: "{inviter} invited you to {practice} on Sorriso",
    body: "{inviter} invited you to join {practice} on Sorriso as {role}. The invitation is valid for 7 days.",
    cta: "Accept the invitation",
  },
  failedLogins: {
    subject: "Unsuccessful sign-in attempts on your account",
    body: "There were {count} unsuccessful attempts to sign in to your Sorriso account in the last 15 minutes, so further attempts are blocked for a while. If this wasn't you, consider changing your password and turning on two-step verification.",
    cta: "Review my security",
  },
  newDevice: {
    subject: "New sign-in to your Sorriso account",
    body: "Your account was signed in to from a new device ({device}) on {when}. If this was you, there's nothing to do. If not, sign that session out and change your password right away.",
    cta: "Review my devices",
  },
  apiKeyCreated: {
    subject: "A new API key was created for {practice}",
    body: "{creator} created the API key \"{name}\" for {practice} on {when}, with this access: {scopes}. It expires on {expires}. API keys let software read and change patient data: if you don't recognise this key, revoke it now.",
    cta: "Review API keys",
  },
  mfaReset: {
    subject: "Your two-step verification was reset",
    body: "{actor} reset the two-step verification of your account at {practice} on {when}. You were signed out everywhere, and you'll set up a new authenticator app the next time you log in.",
    cta: "Log in",
  },
} as const;
