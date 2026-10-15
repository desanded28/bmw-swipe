/**
 * Romanian translation of the patient privacy notices. LEGAL TEXT, ITALIAN AUTHORITATIVE: draft
 * translated from the English, to be checked against the Italian by a lawyer or DPO
 * (docs/i18n/glossary-ro.md, "Needs lawyer review").
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    practiceTitle: "Notă de informare privind confidențialitatea: {practice}",
    practiceDescription: "Cum prelucrează {practice} datele cu caracter personal ale pacienților săi și care sunt drepturile dumneavoastră.",
    minorTitle: "Confidențialitatea pentru tineri: {practice}",
    minorDescription: "Ce face {practice} cu informațiile despre tine, explicat simplu.",
    platformTitle: "Nota de informare privind confidențialitatea Sorriso",
    platformDescription: "Cum prelucrează Sorriso datele cu caracter personal atunci când căutați un dentist, faceți o programare sau scrieți o recenzie și care sunt drepturile dumneavoastră.",
    staffTitle: "Notă de informare pentru personalul cabinetelor",
    staffDescription: "Cum sunt prelucrate datele dumneavoastră atunci când folosiți panoul de control Sorriso și cum funcționează jurnalul de acces.",
    practitionerTitle: "Notă de informare pentru medici",
    practitionerDescription: "Cum prelucrează Sorriso datele medicilor prezenți în catalogul său.",
    cookiesTitle: "Informare privind cookie-urile",
    cookiesDescription: "Puținele cookie-uri tehnice folosite de Sorriso și de ce nu există un banner de cookie-uri.",
  },
  page: {
    version: "Versiunea {version}",
    updated: "În vigoare din {date}",
    italianPrevails: "Aceasta este o traducere. În caz de neconcordanță, prevalează versiunea în limba italiană.",
    italianLink: "Citiți versiunea în limba italiană",
    contents: "Cuprins",
    practiceLink: "Nota de informare completă a cabinetului",
    minorsLink: "Versiunea pentru tineri",
    platformLink: "Nota de informare privind confidențialitatea Sorriso",
    cookiesLink: "Informare privind cookie-urile",
    privacyCenterLink: "Mergeți la centrul de confidențialitate",
    otherNotices: "Alte note de informare",
    staffLink: "Pentru personalul cabinetelor",
    practitionerLink: "Pentru medici",
    patientLink: "Pentru pacienți",
    backToTop: "Înapoi sus",
  },
  sections: {
    summary: "Pe scurt",
    controller: "Cine răspunde de datele dumneavoastră",
    roles: "Cele două roluri ale Sorriso",
    data: "Ce date prelucrăm",
    purposes: "De ce le prelucrăm și în ce temei juridic",
    marketplace: "Dacă v-ați programat pe Sorriso",
    withdrawal: "Dacă vă retrageți consimțământul",
    recipients: "Cine primește datele dumneavoastră",
    transfers: "Transferuri în afara Spațiului Economic European",
    retention: "Cât timp păstrăm datele dumneavoastră",
    rights: "Drepturile dumneavoastră",
    complaint: "Plângeri",
    mandatory: "Sunteți obligat să ne furnizați datele?",
    automated: "Decizii automatizate și crearea de profiluri",
    minors: "Copii și tineri",
    monitoring: "Jurnalul de acces",
    profile: "Profilul dumneavoastră public",
    cookies: "Cookie-uri",
    changes: "Modificări ale acestei note de informare",
    who: "Cine are grijă de informațiile tale",
    what: "Ce informații folosim",
    why: "De ce le folosim",
    parents: "Părinții sau tutorele tău",
    keep: "Cât timp le păstrăm",
    youCan: "Ce poți face",
    help: "Dacă ceva nu este în regulă",
    full: "Nota de informare completă",
    cookieList: "Cookie-urile pe care le folosim",
    storage: "Stocarea în browser",
    thirdParties: "Terți",
    legalBasis: "Temei juridic",
    control: "Cum puteți controla cookie-urile",
    widget: "Widgetul de programare de pe site-urile cabinetelor",
  },
  controller: {
    name: "Operator: {name}",
    vat: "Cod de TVA: {vat}",
    address: "Adresă: {address}",
    contact: "Contact pentru protecția datelor: {email}",
    phone: "Telefon: {phone}",
    dpo: "Responsabil cu protecția datelor (DPO): {name}, {email}",
    dpoEmail: "Responsabil cu protecția datelor (DPO): {email}",
    noDpo: "Cabinetul nu a desemnat un responsabil cu protecția datelor: pentru orice chestiune legată de protecția datelor, scrieți la adresa de contact de mai sus.",
    processor:
      "Sorriso furnizează software-ul de programare în calitate de persoană împuternicită de cabinet (art. 28 GDPR): acționează doar pe baza instrucțiunilor documentate ale cabinetului și în temeiul unui acord de prelucrare a datelor.",
    platformDpo: "Responsabilul cu protecția datelor (DPO) al Sorriso poate fi contactat la {email}.",
  },
  bases: {
    art6_1_a: "consimțământul dumneavoastră (art. 6 alin. (1) lit. (a) GDPR)",
    art6_1_b: "serviciul pe care îl solicitați sau demersurile pe care le cereți înaintea acestuia (art. 6 alin. (1) lit. (b) GDPR)",
    art6_1_c: "o obligație legală a operatorului (art. 6 alin. (1) lit. (c) GDPR)",
    art6_1_f: "interesele legitime ale operatorului, cărora vă puteți opune (art. 6 alin. (1) lit. (f) GDPR)",
    art9_2_a: "consimțământul dumneavoastră explicit pentru datele care vă pot privi sănătatea (art. 9 alin. (2) lit. (a) GDPR)",
    art9_2_f: "constatarea, exercitarea sau apărarea unui drept în instanță (art. 9 alin. (2) lit. (f) GDPR)",
    art9_2_h:
      "asistența medicală acordată de profesioniști supuși obligației de păstrare a secretului profesional (art. 9 alin. (2) lit. (h) și alin. (3) GDPR, art. 2-septies din Codul italian privind protecția datelor)",
  },
  purposes: {
    item: "{title}. {body} Temei juridic: {bases}.",
    booking_practice: {
      title: "Programare",
      body: "Pentru a primi și înregistra programarea dumneavoastră, a verifica disponibilitatea și a vă confirma programarea.",
    },
    booking_marketplace: {
      title: "Programări făcute pe Sorriso",
      body: "Când vă programați din paginile de căutare Sorriso: pentru a transmite programarea cabinetului ales și a gestiona reamintirile și modificările. Datele programării pot dezvălui informații despre sănătatea dumneavoastră, de aceea Sorriso vă solicită consimțământul explicit.",
    },
    appointment_management: {
      title: "Gestionarea programărilor",
      body: "Pentru a păstra programările și dosarul dumneavoastră la cabinet, a organiza programul și a vă permite să confirmați, să mutați sau să anulați online.",
    },
    reminders: {
      title: "Confirmări și reamintiri",
      body: "Pentru a trimite confirmări ale programărilor și reamintiri prin SMS, email sau, dacă îl alegeți, WhatsApp. Mesajele sunt discrete: nu menționează tratamentul sau notele, cu excepția cazului în care cabinetul a ales mesaje detaliate și datele dumneavoastră de contact au fost verificate. Puteți dezactiva oricând orice canal.",
    },
    waitlist: {
      title: "Listă de așteptare",
      body: "Dacă vă înscrieți pe lista de așteptare: pentru a vă anunța când se eliberează o oră mai devreme.",
    },
    recalls: {
      title: "Rechemări la control",
      body: "Pentru a vă reaminti când medicul dentist v-a stabilit un interval până la următorul control. Fiecare rechemare vă permite să le opriți și vă puteți opune oricând.",
    },
    feedback_requests: {
      title: "Invitații la feedback",
      body: "Doar dacă sunteți de acord: o singură invitație de a lăsa un feedback după vizită. Vă puteți retrage oricând consimțământul.",
    },
    reviews: {
      title: "Recenzii",
      body: "Dacă scrieți o recenzie și sunteți de acord cu publicarea ei: pentru a o publica, a arăta că provine dintr-o vizită reală și a o modera. O puteți șterge oricând din centrul de confidențialitate.",
    },
    marketing: {
      title: "Noutăți și oferte",
      body: "Doar dacă sunteți de acord: noutăți și oferte de la cabinet. Nu este niciodată necesar pentru programare sau tratament, iar consimțământul expiră după 24 de luni fără contact.",
    },
    no_show_tracking: {
      title: "Istoricul programărilor ratate",
      body: "Pentru a înregistra programările ratate în ultimele 24 de luni, a organiza programul și a oferi ajutor, cum ar fi o reamintire suplimentară. Nu vă împiedică niciodată să vă programați. Vă puteți opune oricând.",
    },
    adaptive_reminders: {
      title: "Reamintiri adaptive",
      body: "Pentru a trimite o reamintire suplimentară atunci când, pe baza istoricului programărilor dumneavoastră, este mai probabil ca o programare să fie ratată. Aceasta este o creare de profiluri (art. 4 pct. 4 GDPR): doar adaugă ajutor și nu vă limitează niciodată programarea. Vă puteți opune oricând și veți primi atunci reamintirile standard.",
    },
    anamnesis: {
      title: "Chestionarul de istoric medical",
      body: "Dacă cabinetul vă cere să îl completați înainte de vizită: pentru a vă pregăti tratamentul în siguranță. Răspunsurile dumneavoastră sunt criptate și văzute doar de personalul medical.",
    },
    partner_api: {
      title: "Software de cabinet conectat",
      body: "Dacă cabinetul își conectează propriul software de gestiune la agendă: pentru a le menține sincronizate. Acel software este un destinatar ales de cabinet.",
    },
    directory: {
      title: "Catalog",
      body: "Pentru a afișa cabinetele și medicii în rezultatele căutării Sorriso și pe paginile lor publice.",
    },
    ranking: {
      title: "Ordinea rezultatelor căutării",
      body: "Pentru a ordona rezultatele căutării după criterii publicate: prima oră liberă, evaluările, fiabilitatea, completitudinea profilului și distanța. Nimeni nu poate plăti pentru o poziție mai bună. Vă puteți opune oricând.",
    },
    privacy_center: {
      title: "Centrul de confidențialitate",
      body: "Pentru a găsi dosarele pe care cabinetele de pe Sorriso le dețin pentru un număr de telefon sau o adresă de email pe care le-ați verificat cu un cod unic, astfel încât să vă puteți exercita drepturile într-un singur loc.",
    },
    staff_accounts: {
      title: "Conturile personalului",
      body: "Pentru a oferi personalului cabinetelor acces personal și sigur la panoul de control: conectare, verificare în doi pași, sesiuni și acceptarea instrucțiunilor pentru personal.",
    },
    security_logs: {
      title: "Securitate și jurnal de acces",
      body: "Pentru a înregistra cine deschide și modifică dosarele pacienților, a le proteja împotriva utilizării abuzive și a le arăta pacienților cine le-a accesat datele.",
    },
    privacy_requests: {
      title: "Cereri privind confidențialitatea",
      body: "Pentru a gestiona cererile persoanelor privind datele lor, a le răspunde în termenele legale și a păstra dovada acestui lucru.",
    },
  },
  services: {
    hosting: "găzduirea aplicației",
    database: "bază de date",
    sms: "mesaje SMS",
    whatsapp: "mesaje WhatsApp, doar pentru cabinetele care le activează și pacienții care le aleg",
    email: "email",
    backups: "copii de siguranță",
  },
  transferTools: {
    eu: "niciun transfer (UE/SEE)",
    dpf: "Cadrul UE-SUA privind confidențialitatea datelor (Data Privacy Framework; decizia de adecvare a Comisiei Europene din 10 iulie 2023)",
    scc: "clauze contractuale standard aprobate de Comisia Europeană (art. 46 GDPR)",
    dpf_scc: "Cadrul UE-SUA privind confidențialitatea datelor, cu clauzele contractuale standard ale Comisiei Europene ca soluție de rezervă",
  },
  data: {
    intro: "Prelucrăm:",
    identity: "date de identificare și de contact: prenume, nume, număr de mobil, adresă de email, data nașterii, precum și limba și canalul preferate;",
    appointments:
      "detaliile programărilor: data, ora, tratamentul, medicul, sediul, starea și programările ratate. Acestea pot dezvălui informații despre sănătatea dumneavoastră;",
    yourWords: "ce alegeți să ne spuneți: notele adăugate la o programare, răspunsurile la mesajele noastre și, dacă cabinetul îl folosește, chestionarul de istoric medical;",
    guardian: "pentru copii: datele părintelui sau ale tutorelui legal care face programarea și primește mesajele;",
    records: "evidența consimțămintelor și a alegerilor dumneavoastră, precum și a cererilor privind confidențialitatea pe care le faceți;",
    technical: "date tehnice necesare pentru securitate: amprente criptografice cu cheie (HMAC) ale adresei IP, niciodată adresa în sine.",
    source:
      "Primim aceste date de la dumneavoastră sau de la persoana care v-a făcut programarea: un părinte sau tutore ori alt adult care s-a programat în numele dumneavoastră. În acest caz, trimitem această notă de informare și la adresa dumneavoastră de contact, dacă o avem (art. 14 GDPR).",
  },
  platformData: {
    intro: "Sorriso prelucrează, pentru propriile servicii:",
    booking:
      "când vă programați din paginile sale de căutare: numele, datele de contact, data nașterii, dacă este indicată, cabinetul, tratamentul, data și ora alese, precum și evidența consimțământului dumneavoastră;",
    reviews: "când scrieți o recenzie: evaluarea, textul, numele afișat și vizita la care se referă;",
    privacyCenter:
      "când folosiți centrul de confidențialitate: o amprentă criptografică cu cheie a numărului de telefon sau a adresei de email pe care le verificați, codurile unice trimise acolo (stocate doar ca amprente) și un cookie de sesiune valabil 30 de minute;",
    technical: "pentru securitate: amprente criptografice cu cheie (HMAC) ale adreselor IP și ale browserelor, niciodată adresele în sine.",
  },
  recipients: {
    intro: "Datele dumneavoastră sunt văzute doar de cei care au nevoie de ele:",
    staff: "personalul autorizat al cabinetului (recepție și personal medical), fiecare cu accesul de care are nevoie rolul său;",
    sorriso: "Sorriso, care operează software-ul de programare în calitate de persoană împuternicită de cabinet;",
    practices: "cabinetul la care vă programați, care primește programarea și devine operator pentru propria copie;",
    providers: "furnizorii tehnici enumerați mai jos (subîmputerniciți), obligați prin acorduri de prelucrare a datelor;",
    authorities: "autoritățile publice, doar atunci când legea o impune.",
    notSold: "Datele dumneavoastră nu sunt niciodată vândute sau folosite în scopuri publicitare.",
    provider: "{name} ({entity}): {service}, {region}.",
    providerNoRegion: "{name} ({entity}): {service}.",
    fullList: "Lista completă și actualizată a subîmputerniciților se află la {url}.",
  },
  transfers: {
    intro:
      "Unii furnizori fac parte din grupuri cu sediul în Statele Unite. Chiar și atunci când serverele lor se află în UE, acest lucru poate constitui un transfer în afara Spațiului Economic European. Aceste transferuri sunt acoperite de:",
    item: "{name}: {tool}.",
    assessment: "Sorriso a evaluat aceste transferuri (evaluarea impactului transferului). Puteți solicita o copie a garanțiilor scriind la {email}.",
    none: "Datele dumneavoastră nu sunt transferate în afara Spațiului Economic European.",
  },
  retention: {
    intro: "Păstrăm datele doar atât timp cât sunt necesare:",
    patientInactiveMonths:
      "dosarul dumneavoastră la cabinet: {period} după ultima vizită sau mai mult doar atunci când cabinetul trebuie să păstreze documentația clinică prin lege;",
    neverSeenPatientMonths: "dosarele persoanelor care nu au venit niciodată la o vizită: {period};",
    patientNoteDays: "notele pe care le adăugați la o programare: {period} după programare;",
    messageBodyMonths: "textul mesajelor: {period}, după care rămân doar data, canalul și starea livrării;",
    messageMetaMonths: "evidența mesajelor (data, canalul, starea livrării): {period};",
    reminderDays: "programările reamintirilor: {period} după trimitere;",
    providerMessageDays: "copiile păstrate de furnizorul de SMS și WhatsApp: șterse după {period};",
    waitlistDays: "înscrierile pe lista de așteptare: {period} după închidere;",
    auditMonths: "jurnalul de acces: {period};",
    formSubmissionMonths: "chestionarele de istoric medical: {period} și doar după ce au fost incluse în fișa clinică a cabinetului;",
    consentMonths: "evidența consimțămintelor și a alegerilor dumneavoastră: până la {period}, pentru a le putea dovedi;",
    privacyRequestMonths: "cererile privind confidențialitatea și răspunsurile la acestea: {period} după închidere;",
    marketingLapse: "consimțământul pentru noutăți și oferte expiră după 24 de luni fără contact.",
    after:
      "La sfârșitul acestor perioade, datele sunt șterse sau pseudonimizate automat. Programările pseudonimizate nu mai arată numele sau datele dumneavoastră de contact și sunt păstrate doar în scopuri statistice și pentru evidențele cabinetului.",
    platformBookings: "datele programărilor făcute pe platformă: cât timp este gestionată programarea și nu mai mult decât își păstrează cabinetul propria copie;",
    platformReviews: "recenziile publicate: până când le ștergeți sau sunt eliminate;",
    platformCodes: "codurile unice: șterse la {period} după expirare; sesiunile centrului de confidențialitate se încheie după 30 de minute;",
  },
  rights: {
    intro: "Aveți dreptul:",
    access: "de acces la datele dumneavoastră și de a primi o copie a acestora (art. 15 GDPR);",
    rectification: "la rectificarea datelor inexacte și la completarea datelor incomplete (art. 16);",
    erasure: "la ștergerea datelor atunci când nu mai sunt necesare sau vă retrageți consimțământul, cu excepția celor pe care legea ne obligă să le păstrăm (art. 17);",
    restriction: "la restricționarea prelucrării, de exemplu cât timp se verifică o rectificare (art. 18);",
    portability: "de a primi datele pe care ni le-ați furnizat într-un format structurat, care poate fi citit automat, sau de a le transmite altui operator (art. 20);",
    objection: "de a vă opune prelucrării bazate pe interese legitime, inclusiv creării de profiluri (art. 21);",
    withdraw: "de a vă retrage oricând consimțământul, fără a afecta prelucrarea efectuată înainte de retragere (art. 7 alin. (3));",
    automated: "de a nu face obiectul unor decizii bazate exclusiv pe prelucrarea automată (art. 22).",
    how: "Cum: online, în centrul de confidențialitate de la {url}, unde vă conectați cu un cod unic trimis pe telefon sau prin email; din linkul din mesajele privind programarea; sau scriind la {email}.",
    howNoContact:
      "Cum: online, în centrul de confidențialitate de la {url}, unde vă conectați cu un cod unic trimis pe telefon sau prin email, ori din linkul din mesajele privind programarea.",
    deadline:
      "Răspundem în termen de o lună. Pentru cererile complexe, termenul poate fi prelungit cu încă două luni, iar motivul vi-l comunicăm în prima lună (art. 12 alin. (3) GDPR). Exercitarea drepturilor este gratuită.",
    recipientsInformed: "Când rectificăm sau ștergem datele dumneavoastră ori le restricționăm utilizarea, informăm și destinatarii cărora le-am transmis (art. 19 GDPR).",
  },
  complaint: {
    body: "Dacă considerați că datele dumneavoastră sunt prelucrate ilegal, puteți depune o plângere la autoritatea italiană pentru protecția datelor, Garante per la protezione dei dati personali (Piazza Venezia 11, 00187 Roma, www.garanteprivacy.it), sau la autoritatea din țara UE în care locuiți sau lucrați (art. 77 GDPR). Vă puteți adresa și instanței (art. 79 GDPR).",
  },
  mandatory: {
    practice:
      "Pentru a vă programa trebuie să indicați numele și un număr de mobil sau o adresă de email: fără acestea, cabinetul nu vă poate programa și nu vă poate reaminti programarea. Data nașterii este opțională, dar obligatorie la programarea unui copil. Fiecare consimțământ este opțional: refuzul nu vă împiedică niciodată să vă programați sau să fiți tratat.",
    platform:
      "Consimțământul pentru programarea prin Sorriso este necesar doar pentru programarea din paginile de căutare Sorriso. Dacă preferați să nu îl dați, vă puteți programa direct la cabinet, pe site-ul acestuia sau telefonic.",
  },
  automated: {
    none: "Nicio decizie privind persoana dumneavoastră nu este luată exclusiv prin mijloace automatizate (art. 22 GDPR).",
    profiling:
      "Acest cabinet folosește reamintiri adaptive: istoricul programărilor dumneavoastră este folosit pentru a decide dacă vi se trimite o reamintire suplimentară. Aceasta este o creare de profiluri, dar doar adaugă ajutor și nu vă limitează niciodată programarea. Vă puteți opune oricând.",
    platform:
      "Rezultatele căutării sunt ordonate după criterii publicate, iar recenziile sunt verificate automat înainte de publicare pentru a depista detalii despre sănătate; decizia de a elimina o recenzie este luată întotdeauna de o persoană. Nicio decizie cu efecte juridice sau cu efecte similare semnificative nu este luată exclusiv prin mijloace automatizate.",
  },
  minors: {
    body: "Copiii sub 14 ani sunt programați de un părinte sau de tutorele legal, care primește mesajele și își dă eventualele consimțăminte (art. 2-quinquies din Codul italian privind protecția datelor). De la 14 ani, tinerii se pot programa și pot face aceste alegeri singuri. Accesul unui părinte sau tutore prin centrul de confidențialitate încetează când copilul împlinește 18 ani.",
    link: "O versiune a acestei note de informare scrisă pentru tineri se află la {url}.",
  },
  marketplace: {
    body: "Dacă v-ați programat din paginile de căutare Sorriso, Sorriso este și operator independent pentru acea programare: o transmite cabinetului și gestionează reamintirile și modificările, cu consimțământul dumneavoastră explicit (art. 9 alin. (2) lit. (a) GDPR). Nota de informare Sorriso explică modul în care face acest lucru: {url}.",
    withdraw:
      "Dacă vă retrageți acest consimțământ, Sorriso își încetează propria prelucrare, iar cabinetul păstrează ce îi este necesar pentru a vă trata (art. 9 alin. (2) lit. (h) GDPR).",
  },
  withdrawal: {
    platform:
      "Dacă vă retrageți consimțământul pentru programarea prin Sorriso, Sorriso își încetează propria prelucrare a acelei programări: nu o mai păstrează în istoricul dumneavoastră de pe platformă și nu mai trimite propriile mesaje și invitații privind programarea. Cabinetul păstrează ce îi este necesar pentru a vă trata, în calitate de operator, în temeiul art. 9 alin. (2) lit. (h) GDPR, cu Sorriso ca persoană împuternicită. Retragerea nu afectează prelucrarea efectuată înainte de aceasta.",
  },
  roles: {
    intro: "Sorriso are două roluri:",
    controller:
      "operator independent pentru propriile servicii: programările începute pe paginile de căutare Sorriso, catalogul cabinetelor și al medicilor, recenziile publicate, ordinea rezultatelor căutării și centrul de confidențialitate. Această notă de informare le acoperă;",
    processor:
      "persoană împuternicită de cabinete (art. 28 GDPR) pentru tot ce provine prin canalele proprii ale unui cabinet: site-ul, widgetul sau linkurile sale de programare, personalul și software-ul său. Pentru acestea, operatorul este cabinetul și se aplică propria sa notă de informare, pe care o găsiți pe pagina cabinetului.",
  },
  changes: {
    body: "Actualizăm această notă de informare atunci când prelucrările noastre se schimbă și păstrăm toate versiunile anterioare: o puteți solicita pe cea în vigoare la data programării. Aceasta este versiunea {version}.",
  },
  cookiesLink: {
    body: "Sorriso folosește doar cookie-uri tehnice și niciun cookie al terților: consultați informarea privind cookie-urile la {url}.",
  },
  summary: {
    practice:
      "{practice} folosește datele dumneavoastră pentru a vă face și gestiona programările stomatologice, a vă trimite confirmări și reamintiri și a vă păstra dosarul la cabinet. Acest lucru este necesar pentru îngrijirea pe care o solicitați (art. 6 alin. (1) lit. (b) și art. 9 alin. (2) lit. (h) GDPR). Orice element opțional, cum ar fi invitațiile la feedback sau noutățile, necesită un consimțământ separat, pe care îl puteți retrage oricând.",
    platform:
      "Sorriso vă ajută să găsiți un cabinet stomatologic și să vă programați la acesta. Când vă programați din paginile de căutare Sorriso, Sorriso transmite programarea cabinetului, cu consimțământul dumneavoastră. Când vă programați prin site-ul, widgetul de programare sau personalul unui cabinet, cabinetul răspunde de datele dumneavoastră, iar Sorriso doar operează software-ul pentru acesta.",
    rights:
      "Vă puteți vedea, rectifica, descărca sau șterge datele, puteți restricționa utilizarea lor sau vă puteți opune acesteia și vă puteți retrage oricând consimțământul: online, în centrul de confidențialitate, cu un cod unic, sau scriind la {email}. Puteți depune și o plângere la autoritatea italiană pentru protecția datelor (Garante).",
    rightsNoContact:
      "Vă puteți vedea, rectifica, descărca sau șterge datele, puteți restricționa utilizarea lor sau vă puteți opune acesteia și vă puteți retrage oricând consimțământul, online, în centrul de confidențialitate, cu un cod unic. Puteți depune și o plângere la autoritatea italiană pentru protecția datelor (Garante).",
  },
  minor: {
    summary: "Această pagină explică, pe înțelesul tău, ce face {practice} cu informațiile despre tine atunci când ai o programare la dentist.",
    who: "{controller} răspunde de informațiile tale. Dacă ai întrebări, tu sau părinții tăi puteți scrie la {email}.",
    whoNoContact: "{controller} răspunde de informațiile tale. Dacă ai întrebări, tu sau părinții tăi puteți întreba la cabinet.",
    whatIntro: "Folosim:",
    whatName: "numele tău și data nașterii;",
    whatAppointments: "programările tale: când sunt și pentru ce sunt;",
    whatContact: "numărul de telefon sau adresa de email unde trimitem reamintirile: ale tale sau ale părintelui ori tutorelui tău;",
    whatMessages: "mesajele pe care le trimitem și răspunsurile pe care le primim.",
    why: "Ca să îți facem programările, să ți le reamintim și să avem grijă de dinții tăi în siguranță. Nu le folosim niciodată pentru reclame și nu le vindem niciodată.",
    parents:
      "Dacă ai sub 14 ani, părintele sau tutorele tău face programarea pentru tine, primește reamintirile și decide pentru tot ce este opțional. De la 14 ani te poți programa și poți decide singur. Când împlinești 18 ani, părinții tăi nu îți mai pot vedea dosarul prin centrul de confidențialitate.",
    keep: "Doar cât timp este nevoie pentru îngrijirea ta și cât timp legea spune că trebuie să le păstreze cabinetul. După aceea sunt șterse.",
    youCan:
      "Poți cere să îți vezi informațiile, să le corectezi dacă ceva este greșit sau să le ștergi când nu mai sunt necesare. Poți face asta în centrul de confidențialitate de la {url} sau îi poți cere părintelui ori tutorelui tău să te ajute.",
    help: "Dacă crezi că informațiile tale nu sunt tratate corect, tu sau părinții tăi puteți depune o plângere la autoritatea italiană pentru protecția datelor (Garante per la protezione dei dati personali, www.garanteprivacy.it).",
    full: "Aceasta este o versiune simplificată. Nota de informare completă se află la {url}.",
  },
  staff: {
    summary:
      "Această notă de informare se adresează persoanelor care folosesc panoul de control Sorriso într-un cabinet stomatologic: proprietari, administratori, recepție și medici. Explică ce date despre dumneavoastră sunt prelucrate și cum funcționează jurnalul de acces.",
    controllers:
      "Sorriso este operatorul contului dumneavoastră de utilizator (conectare, verificare în doi pași, sesiuni). Cabinetul pentru care lucrați este operatorul jurnalului de acces și al tuturor celorlalte acțiuni pe care le efectuați în agenda sa; Sorriso este persoana împuternicită de acesta.",
    dataIntro: "Prelucrăm:",
    dataAccount: "numele, adresa de email, rolul și limba preferată;",
    dataSecurity:
      "parola (stocată doar ca amprentă criptografică), secretul pentru verificarea în doi pași (criptat) și codurile de recuperare (sub formă de amprente);",
    dataSessions: "sesiunile și încercările de conectare, cu amprente criptografice cu cheie ale adresei IP și ale browserului;",
    dataLog: "jurnalul de acces: ce dosare de pacienți deschideți sau modificați, când și prin ce acțiune;",
    dataLegal: "acceptarea instrucțiunilor pentru personal și a altor documente juridice.",
    monitoring:
      "Jurnalul de acces este o măsură de securitate impusă pentru datele privind sănătatea (art. 32 GDPR). Înregistrează data și ora, utilizatorul, dosarul și acțiunea, niciodată conținutul citit. Cabinetul îl poate verifica pentru a se asigura că dosarele sunt deschise doar în scop medical și administrativ și pentru a investiga utilizările abuzive. Deoarece sunteți informat despre acesta în această notă și în instrucțiunile pentru personal, informațiile din jurnal pot fi folosite în scopuri legate de raportul de muncă, în limitele art. 4 alin. (3) din Legea nr. 300/1970 și ale legislației privind protecția datelor.",
    retentionSessions: "sesiunile: până la expirare; încercările de conectare: {period};",
    retentionLog: "jurnalul de acces: conform setării cabinetului, cel puțin {period};",
    retentionLegal: "acceptările documentelor juridice: 10 ani, termenul de prescripție pentru a le putea dovedi;",
    retentionAccount: "contul dumneavoastră: până la închiderea lui sau până când părăsiți cabinetul.",
    rights:
      "Aveți dreptul de acces, la rectificare, la ștergere, la restricționare, la portabilitate și la opoziție (art. 15-21 GDPR). Pentru contul dumneavoastră, scrieți la Sorriso la {email}; pentru jurnalul de acces, cabinetului pentru care lucrați.",
    rightsNoContact:
      "Aveți dreptul de acces, la rectificare, la ștergere, la restricționare, la portabilitate și la opoziție (art. 15-21 GDPR). Pentru contul dumneavoastră, scrieți la Sorriso; pentru jurnalul de acces, cabinetului pentru care lucrați.",
  },
  practitioner: {
    summary:
      "Această notă de informare se adresează medicilor dentiști și altor specialiști prezenți în catalogul Sorriso. Explică modul în care Sorriso vă prelucrează datele profesionale, verificările privind înscrierea dumneavoastră și recenziile pe care pacienții le scriu despre dumneavoastră.",
    controllers:
      "Sorriso este operatorul catalogului, al profilului dumneavoastră public, al recenziilor și al ordinii rezultatelor căutării. Cabinetul cu care lucrați este operatorul programului dumneavoastră și al datelor pacienților săi; pentru acestea, Sorriso este persoana împuternicită de cabinet.",
    dataIntro: "Prelucrăm:",
    dataProfile: "numele, titlul, specialitatea, biografia, limbile vorbite, cabinetul și sediile în care lucrați și disponibilitatea dumneavoastră;",
    dataAlbo:
      "înscrierea în registrul profesional (Albo degli Odontoiatri sau dei Medici Chirurghi), provincia și numărul, precum și specializările recunoscute menționate în acesta;",
    dataReviews: "evaluările și recenziile scrise de pacienți despre vizitele la dumneavoastră, răspunsurile dumneavoastră și eventualele semnalări;",
    dataMetrics: "indicatorii folosiți pentru ordonarea rezultatelor căutării: anulările făcute de cabinet, completitudinea profilului și vizualizările profilului.",
    profile:
      "Profilul dumneavoastră devine public doar după ce dumneavoastră sau cabinetul îl aprobați și vă puteți retrage oricând de pe platformă. Specializările recunoscute legal sunt afișate doar după ce Sorriso le-a verificat în registrul public.",
    reviews:
      "Doar pacienții cu o vizită verificată pot scrie o recenzie despre dumneavoastră. Puteți răspunde și puteți semnala o recenzie; fiecare decizie privind o semnalare este motivată și poate fi contestată o singură dată.",
    retentionProfile: "profilul: până când dumneavoastră sau cabinetul îl eliminați din catalog;",
    retentionReviews: "recenziile: până când autorul le șterge sau sunt eliminate;",
    retentionMetrics: "indicatorii de clasament: calculați pe ultimele 180 de zile.",
    rights:
      "Aveți dreptul de acces, la rectificare, la ștergere, la restricționare, la portabilitate și la opoziție (art. 15-21 GDPR), inclusiv dreptul de a vă opune clasamentului. Scrieți la Sorriso la {email}.",
    rightsNoContact:
      "Aveți dreptul de acces, la rectificare, la ștergere, la restricționare, la portabilitate și la opoziție (art. 15-21 GDPR), inclusiv dreptul de a vă opune clasamentului. Scrieți la Sorriso.",
  },
  cookies: {
    summary:
      "Sorriso nu folosește cookie-uri de publicitate sau de urmărire, iar paginile nu încarcă nimic de pe serverele altor companii în timp ce navigați. Folosim doar puținele cookie-uri tehnice de care site-ul are nevoie pentru a funcționa. Acestea nu necesită consimțământul dumneavoastră, motiv pentru care nu există un banner de cookie-uri.",
    item: "{name}: {purpose} Durată: {duration}.",
    staffSession: {
      name: "Sesiunea personalului ({names})",
      purpose: "menține personalul cabinetelor conectat la panoul de control. Se setează doar la conectarea personalului.",
      duration: "până la deconectare, cel mult 24 de ore, și 30 de minute fără activitate",
    },
    locale: {
      name: "Limba ({names})",
      purpose: "reține limba aleasă cu selectorul de limbă. Se setează doar când alegeți o limbă.",
      duration: "1 an",
    },
    privacyCenter: {
      name: "Centrul de confidențialitate ({names})",
      purpose: "vă menține conectat la centrul de confidențialitate după ce introduceți un cod unic.",
      duration: "30 de minute",
    },
    storageIntro: "În afară de aceste cookie-uri, Sorriso păstrează în spațiul de stocare al browserului doar următoarele. Nu părăsesc niciodată dispozitivul și sunt setate doar când folosiți funcția respectivă:",
    storageItem: "{key}: {purpose}",
    storageItems: {
      dashboardPrivacyScreen:
        "reține, pe acel dispozitiv, dacă personalul cabinetului a activat ecranul de confidențialitate al panoului de control, care estompează numele pacienților în calendar, astfel încât persoanele aflate la recepție să nu le poată citi. Se păstrează până la dezactivare.",
    },
    thirdPartiesIntro:
      "Paginile nu încarcă scripturi, fonturi, imagini sau cadre de la alte companii. Există două excepții, care au loc doar la cererea dumneavoastră:",
    map: "harta de pe pagina unui cabinet apare doar după ce faceți clic pentru a o afișa. Browserul o încarcă atunci de la OpenStreetMap (OpenStreetMap Foundation), care primește adresa dumneavoastră IP conform propriei politici de confidențialitate: https://osmfoundation.org/wiki/Privacy_Policy;",
    links: "linkurile, cum ar fi cele pentru indicații de traseu, deschid alte site-uri, de exemplu Google Maps, într-o filă nouă: acele site-uri aplică propriile politici.",
    legalBasis:
      "Cookie-urile tehnice sunt permise fără consimțământ de art. 122 din Codul italian privind protecția datelor și de ghidurile Garante privind cookie-urile și alte instrumente de urmărire din 10 iunie 2021. Această informare vă aduce la cunoștință existența lor.",
    control:
      "Puteți șterge oricând cookie-urile din setările browserului. Fără cookie-urile tehnice, conectarea și memorarea limbii nu vor funcționa.",
    widget:
      "Widgetul de programare afișat pe site-ul unui cabinet nu setează cookie-uri proprii. Site-ul cabinetului poate folosi alte cookie-uri: consultați propria sa informare privind cookie-urile.",
  },
} satisfies DeepPartial<Messages["legalPatient"]>;
