/**
 * English source for the reviewEmails namespace (server-only): moderation messages about reviews.
 * Owned by WP7 (marketplace).
 *
 * The kinds with subject/body/sms go to patients through sendPatientMessage (guardian routing,
 * channel choice, privacy footer). They are discreet: no treatment, no review text, no health
 * details; the link opens a page with the details. `practice*` and `notice*` are emails to the
 * practice and to members of the public who sent a notice (DSA Art. 16 and 17).
 *
 * SMS texts: straight quotes only, short (GSM-7 budget).
 */
export default {
  /** The review is hidden while the moderators check it (the practice reported it). */
  moderationRequestHidden: {
    subject: "Your review of {practice} was reported",
    body:
      "Your review of {practice} was reported to Sorriso's moderators and is hidden while they check it. You can tell us your side until {date}: we read it before deciding. You can also delete your review.",
    cta: "Reply to the moderators",
    sms: "Sorriso: your review of {practice} was reported. You can reply until {date}: {url}",
  },
  /** The review stays published while the moderators check it (a notice from the public, an appeal). */
  moderationRequestVisible: {
    subject: "Your review of {practice} was reported",
    body:
      "Your review of {practice} was reported to Sorriso's moderators. It stays published while they check it. You can tell us your side until {date}: we read it before deciding. You can also delete your review.",
    cta: "Reply to the moderators",
    sms: "Sorriso: your review of {practice} was reported. You can reply until {date}: {url}",
  },
  decisionKept: {
    subject: "Your review of {practice}: decision",
    body:
      "Sorriso's moderators reviewed the report about your review of {practice} and decided to keep it published. Reasons: {reason}",
    cta: "See the decision",
    sms: "Sorriso: your review of {practice} stays published. Details: {url}",
  },
  decisionRemoved: {
    subject: "Your review of {practice}: decision",
    body:
      "Sorriso's moderators decided to remove your review of {practice}. Reasons: {reason} If you disagree you can appeal once, until {date}; you can also turn to a certified out-of-court dispute settlement body or a court.",
    cta: "See the decision or appeal",
    sms: "Sorriso: your review of {practice} was removed. Reasons and appeal: {url}",
  },
  finalKept: {
    subject: "Your review of {practice}: decision on the appeal",
    body:
      "A different moderator reviewed the appeal about your review of {practice} and decided to keep it published. Reasons: {reason} This decision is final on Sorriso.",
    cta: "See the decision",
    sms: "Sorriso: after the appeal, your review of {practice} stays published. Details: {url}",
  },
  finalRemoved: {
    subject: "Your review of {practice}: decision on the appeal",
    body:
      "A different moderator reviewed the appeal about your review of {practice} and decided to remove it. Reasons: {reason} This decision is final on Sorriso; you can still turn to a certified out-of-court dispute settlement body or a court.",
    cta: "See the decision",
    sms: "Sorriso: after the appeal, your review of {practice} was removed. Details: {url}",
  },
  heldPublished: {
    subject: "Your review of {practice} is published",
    body: "A moderator checked your review of {practice} and published it. Thank you for helping other patients.",
    sms: "Sorriso: your review of {practice} is now published. Thank you!",
  },
  heldRemoved: {
    subject: "Your review of {practice} was not published",
    body:
      "A moderator checked your review of {practice} and did not publish it. Reasons: {reason} If you disagree you can appeal once, until {date}.",
    cta: "See the decision or appeal",
    sms: "Sorriso: your review of {practice} was not published. Reasons and appeal: {url}",
  },
  practice: {
    keptSubject: "Review report: decision (kept)",
    keptBody:
      "Sorriso's moderators reviewed your report about a review of {practice} and decided to keep it published. Reasons: {reason}",
    removedSubject: "Review report: decision (removed)",
    removedBody:
      "Sorriso's moderators reviewed your report about a review of {practice} and decided to remove it. Reasons: {reason}",
    appeal: "You can appeal once from the Reviews page of your dashboard. After that, you can turn to a certified out-of-court dispute settlement body or a court.",
    final: "This was the decision on an appeal and is final on Sorriso. You can still turn to a certified out-of-court dispute settlement body or a court.",
    authorMayAppeal: "The author of the review can appeal this decision once; if they do, a different moderator decides and we will email you the outcome.",
    open: "Open the Reviews page",
    footer: "Sorriso moderation · you receive this email because your practice reported a review.",
  },
  notice: {
    receivedSubject: "We received your notice about a review",
    receivedBody: "Thank you: we received your notice about a review of {practice}. A moderator will decide without undue delay and email you the outcome.",
    decisionSubject: "Your notice about a review: decision",
    keptBody: "We checked the review of {practice} you reported and decided to keep it. Reasons: {reason}",
    removedBody: "We checked the review of {practice} you reported and removed it. Reasons: {reason}",
    redress: "If you disagree, you can turn to a certified out-of-court dispute settlement body or a court.",
    footer: "Sorriso moderation · you receive this email because you sent a notice about a review.",
  },
  detailsReview: "Review",
  detailsGround: "Reason reported",
  detailsDecision: "Decision",
} as const;
