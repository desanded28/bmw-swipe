import type { DeepPartial, Messages } from "../../types";

export default {
  recall: {
    subject: "{clinic}: este timpul pentru controlul periodic",
    body: "A sosit momentul să programați următorul control periodic la {clinic}. Alegeți online o oră care vă convine sau sunați la cabinet. Dacă nu mai doriți să primiți aceste reamintiri, vă puteți dezabona la {optout}.",
    cta: "Programați controlul",
    sms: "{clinic}: este timpul pentru controlul periodic. Programare: {url} Pentru a opri aceste mesaje: {optout}",
    smsShort: "{clinic}: control periodic. Programare: {url} Stop: {optout}",
  },
  practiceMoved: {
    subject: "{clinic} trebuie să vă mute programarea",
    body: "Ne pare rău: {clinic} nu vă poate primi {when}, așa cum era planificat. Alegeți o nouă oră cu o singură atingere sau rugați cabinetul să vă sune.",
    cta: "Alegeți o nouă oră",
    sms: "{clinic}: ne pare rău, trebuie să mutăm programarea de {when}. Alegeți o nouă oră: {url}",
    smsShort: "{clinic}: reprogramare necesara pentru vizita de {when}. Detalii: {url}",
  },
  anamnesisInvite: {
    subject: "{clinic}: completați istoricul medical înainte de vizită",
    body: "Înainte de vizita de {when}, vă rugăm să completați un scurt chestionar privind istoricul medical. Durează aproximativ trei minute și îl ajută pe medicul dentist să vă trateze în siguranță. Răspunsurile dumneavoastră sunt criptate și pot fi citite doar de echipa medicală.",
    cta: "Completați chestionarul",
    sms: "{clinic}: înainte de vizita de {when}, completați chestionarul privind istoricul medical: {url}",
    smsShort: "{clinic}: chestionar de istoric medical pentru vizita de {when}: {url}",
  },
} satisfies DeepPartial<Messages["careMessages"]>;
