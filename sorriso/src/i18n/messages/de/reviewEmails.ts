/**
 * German review moderation messages. Discreet: no treatment, no review text, no health details.
 * SMS texts: straight quotes only, short (GSM-7 budget).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  moderationRequestHidden: {
    subject: "Ihre Bewertung von {practice} wurde gemeldet",
    body: "Ihre Bewertung von {practice} wurde den Moderatoren von Sorriso gemeldet und ist während der Prüfung ausgeblendet. Sie können uns bis {date} Ihre Sicht schildern: Wir lesen sie, bevor wir entscheiden. Sie können Ihre Bewertung auch löschen.",
    cta: "Den Moderatoren antworten",
    sms: "Sorriso: Ihre Bewertung von {practice} wurde gemeldet. Antworten können Sie bis {date}: {url}",
  },
  moderationRequestVisible: {
    subject: "Ihre Bewertung von {practice} wurde gemeldet",
    body: "Ihre Bewertung von {practice} wurde den Moderatoren von Sorriso gemeldet. Sie bleibt während der Prüfung veröffentlicht. Sie können uns bis {date} Ihre Sicht schildern: Wir lesen sie, bevor wir entscheiden. Sie können Ihre Bewertung auch löschen.",
    cta: "Den Moderatoren antworten",
    sms: "Sorriso: Ihre Bewertung von {practice} wurde gemeldet. Antworten können Sie bis {date}: {url}",
  },
  decisionKept: {
    subject: "Ihre Bewertung von {practice}: Entscheidung",
    body: "Die Moderatoren von Sorriso haben die Meldung zu Ihrer Bewertung von {practice} geprüft und entschieden, sie veröffentlicht zu lassen. Gründe: {reason}",
    cta: "Entscheidung ansehen",
    sms: "Sorriso: Ihre Bewertung von {practice} bleibt veröffentlicht. Details: {url}",
  },
  decisionRemoved: {
    subject: "Ihre Bewertung von {practice}: Entscheidung",
    body: "Die Moderatoren von Sorriso haben entschieden, Ihre Bewertung von {practice} zu entfernen. Gründe: {reason} Wenn Sie nicht einverstanden sind, können Sie bis {date} einmal Einspruch einlegen; Sie können sich auch an eine zertifizierte außergerichtliche Streitbeilegungsstelle oder an ein Gericht wenden.",
    cta: "Entscheidung ansehen oder Einspruch einlegen",
    sms: "Sorriso: Ihre Bewertung von {practice} wurde entfernt. Gründe und Einspruch: {url}",
  },
  finalKept: {
    subject: "Ihre Bewertung von {practice}: Entscheidung über den Einspruch",
    body: "Ein anderer Moderator hat den Einspruch zu Ihrer Bewertung von {practice} geprüft und entschieden, sie veröffentlicht zu lassen. Gründe: {reason} Diese Entscheidung ist auf Sorriso endgültig.",
    cta: "Entscheidung ansehen",
    sms: "Sorriso: Nach dem Einspruch bleibt Ihre Bewertung von {practice} veröffentlicht. Details: {url}",
  },
  finalRemoved: {
    subject: "Ihre Bewertung von {practice}: Entscheidung über den Einspruch",
    body: "Ein anderer Moderator hat den Einspruch zu Ihrer Bewertung von {practice} geprüft und entschieden, sie zu entfernen. Gründe: {reason} Diese Entscheidung ist auf Sorriso endgültig; Sie können sich weiterhin an eine zertifizierte außergerichtliche Streitbeilegungsstelle oder an ein Gericht wenden.",
    cta: "Entscheidung ansehen",
    sms: "Sorriso: Nach dem Einspruch wurde Ihre Bewertung von {practice} entfernt. Details: {url}",
  },
  heldPublished: {
    subject: "Ihre Bewertung von {practice} ist veröffentlicht",
    body: "Ein Moderator hat Ihre Bewertung von {practice} geprüft und veröffentlicht. Vielen Dank, dass Sie anderen Patienten helfen.",
    sms: "Sorriso: Ihre Bewertung von {practice} ist jetzt veröffentlicht. Vielen Dank!",
  },
  heldRemoved: {
    subject: "Ihre Bewertung von {practice} wurde nicht veröffentlicht",
    body: "Ein Moderator hat Ihre Bewertung von {practice} geprüft und nicht veröffentlicht. Gründe: {reason} Wenn Sie nicht einverstanden sind, können Sie bis {date} einmal Einspruch einlegen.",
    cta: "Entscheidung ansehen oder Einspruch einlegen",
    sms: "Sorriso: Ihre Bewertung von {practice} wurde nicht veröffentlicht. Gründe und Einspruch: {url}",
  },
  practice: {
    keptSubject: "Meldung einer Bewertung: Entscheidung (beibehalten)",
    keptBody:
      "Die Moderatoren von Sorriso haben Ihre Meldung zu einer Bewertung von {practice} geprüft und entschieden, sie veröffentlicht zu lassen. Gründe: {reason}",
    removedSubject: "Meldung einer Bewertung: Entscheidung (entfernt)",
    removedBody:
      "Die Moderatoren von Sorriso haben Ihre Meldung zu einer Bewertung von {practice} geprüft und entschieden, sie zu entfernen. Gründe: {reason}",
    appeal:
      "Sie können auf der Seite Bewertungen in Ihrem Dashboard einmal Einspruch einlegen. Danach können Sie sich an eine zertifizierte außergerichtliche Streitbeilegungsstelle oder an ein Gericht wenden.",
    final:
      "Dies war die Entscheidung über einen Einspruch und ist auf Sorriso endgültig. Sie können sich weiterhin an eine zertifizierte außergerichtliche Streitbeilegungsstelle oder an ein Gericht wenden.",
    authorMayAppeal:
      "Der Verfasser der Bewertung kann gegen diese Entscheidung einmal Einspruch einlegen; in diesem Fall entscheidet ein anderer Moderator, und wir teilen Ihnen das Ergebnis per E-Mail mit.",
    open: "Seite Bewertungen öffnen",
    footer: "Sorriso-Moderation · Sie erhalten diese E-Mail, weil Ihre Praxis eine Bewertung gemeldet hat.",
  },
  notice: {
    receivedSubject: "Wir haben Ihre Meldung zu einer Bewertung erhalten",
    receivedBody:
      "Vielen Dank: Wir haben Ihre Meldung zu einer Bewertung von {practice} erhalten. Ein Moderator entscheidet ohne unangemessene Verzögerung und teilt Ihnen das Ergebnis per E-Mail mit.",
    decisionSubject: "Ihre Meldung zu einer Bewertung: Entscheidung",
    keptBody: "Wir haben die von Ihnen gemeldete Bewertung von {practice} geprüft und entschieden, sie beizubehalten. Gründe: {reason}",
    removedBody: "Wir haben die von Ihnen gemeldete Bewertung von {practice} geprüft und entfernt. Gründe: {reason}",
    redress: "Wenn Sie nicht einverstanden sind, können Sie sich an eine zertifizierte außergerichtliche Streitbeilegungsstelle oder an ein Gericht wenden.",
    footer: "Sorriso-Moderation · Sie erhalten diese E-Mail, weil Sie eine Meldung zu einer Bewertung gesendet haben.",
  },
  detailsReview: "Bewertung",
  detailsGround: "Gemeldeter Grund",
  detailsDecision: "Entscheidung",
} satisfies DeepPartial<Messages["reviewEmails"]>;
