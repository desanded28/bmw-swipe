/**
 * German care messages. Discreet in every mode (docs/care.md). SMS: straight quotes only, no
 * ellipsis character; ä, ö, ü and ß are GSM-7.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  recall: {
    subject: "{clinic}: Zeit für Ihre regelmäßige Kontrolle",
    body: "Es ist Zeit, die nächste regelmäßige Kontrolluntersuchung bei {clinic} zu buchen. Wählen Sie online einen passenden Termin oder rufen Sie die Praxis an. Wenn Sie diese Erinnerungen nicht mehr erhalten möchten, können Sie sie unter {optout} abbestellen.",
    cta: "Kontrolltermin buchen",
    sms: "{clinic}: Zeit für Ihre regelmäßige Kontrolle. Buchen: {url} Erinnerungen abbestellen: {optout}",
    smsShort: "{clinic}: Zeit für Ihre Kontrolle. Buchen: {url} Abbestellen: {optout}",
  },
  practiceMoved: {
    subject: "{clinic} muss Ihren Termin verschieben",
    body: "Es tut uns leid: {clinic} kann Sie am {when} nicht wie geplant empfangen. Wählen Sie mit einem Klick einen neuen Termin oder bitten Sie die Praxis um einen Rückruf.",
    cta: "Neuen Termin wählen",
    sms: "{clinic}: Leider müssen wir Ihren Termin am {when} verschieben. Neuen Termin wählen: {url}",
    smsShort: "{clinic}: Ihr Termin am {when} muss verschoben werden. Neu: {url}",
  },
  anamnesisInvite: {
    subject: "{clinic}: Bitte füllen Sie vor Ihrem Besuch den Anamnesebogen aus",
    body: "Bitte füllen Sie vor Ihrem Besuch am {when} einen kurzen Anamnesebogen aus. Das dauert etwa drei Minuten und hilft dem Zahnarzt, Sie sicher zu behandeln. Ihre Antworten werden verschlüsselt, und nur das Behandlungsteam kann sie lesen.",
    cta: "Bogen ausfüllen",
    sms: "{clinic}: Bitte füllen Sie vor Ihrem Besuch am {when} den Anamnesebogen aus: {url}",
    smsShort: "{clinic}: Bitte Anamnesebogen vor dem Termin am {when} ausfüllen: {url}",
  },
} satisfies DeepPartial<Messages["careMessages"]>;
