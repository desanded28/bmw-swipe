/**
 * English source for the privacyAdminEmails namespace. Owned by WP5 (practice GDPR). Server-only
 * namespace: never sent to the browser.
 *
 * Two audiences:
 *  - patients (request*, restrictionLifted): answers the practice owes the data subject under
 *    Art. 12 and 18(3). Sent in the language the request was made in. SMS texts use straight
 *    quotes and no ellipsis (GSM-7).
 *  - practice owners and Sorriso staff (owner*, subprocessorsChanged, closure*).
 * Placeholders are already formatted for the reader: dates via fmtDay, {reason} is the staff's
 * own text.
 */
export default {
  types: {
    access: "access to your data",
    rectification: "correction of your data",
    erasure: "erasure of your data",
    restriction: "restriction of the processing of your data",
    portability: "a copy of your data to take elsewhere",
    objection: "objection to the processing of your data",
    consent_withdrawal: "withdrawal of your consent",
  },

  requestExtended: {
    subject: "Your privacy request: we need more time",
    body: "We received your request for {type} on {received}. We need more time to answer it fully, for this reason: {reason}. You will receive our answer by {until}. The GDPR (Art. 12(3)) allows this extension of up to two further months.",
    sms: "{practice}: we need more time for your privacy request of {received}. Reason: {reason}. Answer by {until}.",
  },
  requestGranted: {
    subject: "Your privacy request has been completed",
    body: "We have completed your request for {type}, received on {received}. Our answer: {reason}",
    sms: "{practice}: your privacy request of {received} has been completed. {reason}",
  },
  requestPartiallyGranted: {
    subject: "Our answer to your privacy request",
    body: "We have answered your request for {type}, received on {received}, in part. Our answer and the reasons: {reason}. If you disagree, you can lodge a complaint with the Italian data protection authority (Garante per la protezione dei dati personali, www.garanteprivacy.it) or go to court.",
    sms: "{practice}: your privacy request of {received} was granted in part. Reasons: {reason}. You can complain to the Garante (garanteprivacy.it) or go to court.",
  },
  requestRefused: {
    subject: "Our answer to your privacy request",
    body: "We cannot grant your request for {type}, received on {received}, for these reasons: {reason}. If you disagree, you can lodge a complaint with the Italian data protection authority (Garante per la protezione dei dati personali, www.garanteprivacy.it) or go to court.",
    sms: "{practice}: we cannot grant your privacy request of {received}. Reasons: {reason}. You can complain to the Garante (garanteprivacy.it) or go to court.",
  },
  restrictionLifted: {
    subject: "The restriction on your data is being lifted",
    body: "On {since} the processing of your data at {practice} was restricted. This restriction is now being lifted, so the practice may use your data again, for example to send you appointment reminders. If you have questions or think it should continue, please contact the practice.",
    sms: "{practice}: the restriction on your data, in place since {since}, is being lifted. Contact us with any questions.",
  },

  ownerDeadline7: {
    subject: "Privacy request due in 7 days",
    body: "A request for {type} received by {practice} on {received} must be answered by {due}. Open it in the dashboard to complete it, or to extend the deadline with a reason if you really need more time.",
    cta: "Open the request",
  },
  ownerDeadline2: {
    subject: "Privacy request due in 2 days",
    body: "A request for {type} received by {practice} on {received} must be answered by {due}. Answering late breaches Art. 12(3) GDPR: please complete it now.",
    cta: "Open the request",
  },

  subprocessorsChanged: {
    subject: "Sorriso's list of sub-processors has changed",
    body: "Sorriso has updated the list of sub-processors that handle {practice}'s data (version {version}, in effect from {effective}). Please review it and accept it in the dashboard. If you object to a change, write to {email} within 30 days: we will look for a solution with you and, if there is none, you may end the contract without penalty.",
    cta: "Review the list",
  },

  closureRequested: {
    subject: "Your Sorriso account is being closed",
    body: "We received the request to close {practice}'s account on {date}. Online booking has stopped and the practice no longer appears in search. You can download all your data until {purge}; on that date it will be permanently deleted. You can cancel the closure before then from the dashboard.",
    cta: "Download your data",
  },
  closureCancelled: {
    subject: "Account closure cancelled",
    body: "The closure of {practice}'s account has been cancelled and no data will be deleted. Online booking through your own booking page, widget and links works again. The practice stays hidden from Sorriso's search until you list it again in Settings.",
  },
  closureCertificate: {
    subject: "Certificate of deletion: {practice}",
    body: "On {date} we permanently deleted {practice}'s data from Sorriso's systems, as agreed in the data processing agreement. Encrypted backup copies that still contain it expire on {backups} and are then overwritten. The certificate lists what was deleted.",
    cta: "View the certificate",
  },

  footer: {
    rights: "You are receiving this message because you exercised your data protection rights.",
    staff: "You are receiving this message as an owner of a practice that uses Sorriso.",
  },
} as const;
