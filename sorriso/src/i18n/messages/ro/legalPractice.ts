/**
 * Romanian translation of the practice-facing legal texts (DPA, terms of service, sub-processors,
 * staff instructions, register vocabulary). LEGAL TEXT, ITALIAN AUTHORITATIVE: draft translated
 * from the English, to be checked against the Italian by a lawyer or DPO
 * (docs/i18n/glossary-ro.md, "Needs lawyer review").
 */
import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  staffInstructions: {
    title: "Instrucțiuni pentru personalul care prelucrează datele pacienților",
    intro:
      "Sunteți autorizat să prelucrați datele cu caracter personal ale pacienților, inclusiv datele privind sănătatea, în numele cabinetului. Respectați aceste instrucțiuni în toate aspectele activității dumneavoastră.",
    confidentiality:
      "Păstrați confidențialitatea tuturor informațiilor pe care le aflați despre pacienți, pe durata colaborării cu cabinetul și după încheierea acesteia. Nu discutați niciodată despre pacienți acolo unde alte persoane pot auzi sau vedea.",
    needToKnow:
      "Deschideți doar pacienții și programările de care aveți nevoie pentru sarcina dumneavoastră. Rolul dumneavoastră stabilește ce puteți vedea; nu le cereți colegilor accesul pe care nu îl aveți.",
    freeText:
      "Nu scrieți informații despre sănătate în câmpurile care sunt partajate în afara cabinetului, cum ar fi mesajele către pacienți, intrările din calendar sau notele trimise altor furnizori. Detaliile clinice își au locul în fișa clinică.",
    breaches:
      "Raportați imediat proprietarului cabinetului pierderea unui dispozitiv, un mesaj trimis persoanei greșite sau orice altă posibilă încălcare a securității datelor: cabinetul are la dispoziție 72 de ore pentru a notifica Garante.",
    personalDevices:
      "Nu copiați, nu exportați și nu transmiteți datele pacienților pe dispozitive personale, în conturi personale de email sau de mesagerie ori către orice serviciu pe care cabinetul nu l-a aprobat.",
    calendarSync:
      "Dacă vă sincronizați programul cu un calendar personal, păstrați setarea cu detalii minime: doar orele, fără numele pacienților sau tratamente.",
    accessLog:
      "Fiecare acces la datele pacienților este înregistrat într-un jurnal de audit pe care cabinetul îl poate verifica pentru a-i proteja pe pacienți. Jurnalul nu este folosit pentru a vă monitoriza performanța.",
    adTools:
      "Nu conectați niciodată widgetul de programare sau site-ul cabinetului la instrumente de publicitate sau de analiză într-un mod care le dezvăluie cine s-a programat: faptul că cineva s-a programat la dentist este o informație privind sănătatea.",
    restricted:
      "Unele dosare sunt restricționate la cererea pacientului. Deschideți un astfel de dosar doar atunci când este cu adevărat necesar și indicați motivul solicitat de sistem: fiecare acces este înregistrat.",
    accept: "Am citit aceste instrucțiuni și le voi respecta",
    version: "Versiunea {version}",
  },

  common: {
    version: "Versiunea {version}",
    effective: "În vigoare de la {date}",
    italianPrevails: "Traducere: în caz de neconcordanță, prevalează versiunea în limba italiană.",
    print: "Tipăriți sau salvați ca PDF",
    contents: "Cuprins",
    notConfigured: "Neconfigurat",
    onRequest: "La cerere",
    platformParty: "{name}, {address} (contact pentru protecția datelor: {email})",
    platformPartyShort: "{name} (contact pentru protecția datelor: {email})",
    backToTop: "Înapoi sus",
  },

  purposes: {
    booking_practice: {
      activity: "Programarea vizitelor (canalele cabinetului)",
      purpose:
        "Crearea, modificarea și anularea programărilor solicitate prin site-ul cabinetului, widgetul de programare, linkurile proprii, telefon, recepție și integrările pe care le alege cabinetul.",
    },
    booking_marketplace: {
      activity: "Programări începute pe paginile de căutare Sorriso",
      purpose: "Transmiterea programării către cabinetul ales și gestionarea acesteia, cu consimțământul explicit al pacientului (Sorriso ca operator independent).",
    },
    appointment_management: {
      activity: "Agenda și dosarele pacienților",
      purpose: "Gestionarea calendarului cabinetului, a fotoliilor și a medicilor, a istoricului programărilor pacienților și a notelor administrative ale cabinetului.",
    },
    reminders: {
      activity: "Confirmări și reamintiri",
      purpose:
        "Trimiterea confirmărilor programărilor, a reamintirilor, a modificărilor și a anulărilor prin SMS, email sau, când cabinetul îl activează și pacientul îl alege, WhatsApp; prelucrarea răspunsurilor.",
    },
    waitlist: {
      activity: "Listă de așteptare",
      purpose: "Oferirea intervalelor care se eliberează pacienților care au cerut să fie anunțați despre programări mai devreme.",
    },
    recalls: {
      activity: "Rechemări la control",
      purpose: "Reamintirea unui control pacienților pentru care medicul dentist a stabilit un interval.",
    },
    feedback_requests: {
      activity: "Invitații la feedback",
      purpose: "Invitarea pacienților care și-au dat consimțământul să lase un feedback după o vizită.",
    },
    reviews: {
      activity: "Recenzii publicate",
      purpose: "Publicarea pe Sorriso a recenziilor pacienților verificați, cu consimțământul acestora (Sorriso ca operator independent).",
    },
    marketing: {
      activity: "Noutăți și oferte",
      purpose: "Trimiterea de noutăți și oferte ale cabinetului către pacienții care s-au abonat.",
    },
    no_show_tracking: {
      activity: "Istoricul programărilor ratate",
      purpose: "Numărarea programărilor ratate în ultimele 24 de luni pentru organizarea programului și oferirea de ajutor suplimentar; niciodată pentru refuzarea îngrijirilor.",
    },
    adaptive_reminders: {
      activity: "Reamintiri adaptive",
      purpose:
        "Estimarea, pe baza istoricului programărilor, a momentelor în care o reamintire suplimentară este utilă (creare de profiluri fără niciun efect asupra accesului la îngrijiri; pacientul se poate opune).",
    },
    anamnesis: {
      activity: "Istoricul medical înainte de vizită",
      purpose: "Colectarea chestionarului de istoric medical înainte de vizită, semnat cu un cod unic, pentru medic.",
    },
    partner_api: {
      activity: "Integrări (API pentru parteneri)",
      purpose: "Schimbul de date privind programările cu software-ul pe care îl conectează cabinetul, cum ar fi sistemul de gestiune sau centrul de apeluri.",
    },
    directory: {
      activity: "Catalogul cabinetelor și al medicilor",
      purpose: "Publicarea profilurilor cabinetelor și ale medicilor care le-au aprobat.",
    },
    ranking: {
      activity: "Clasamentul căutării",
      purpose: "Ordonarea rezultatelor căutării după criterii neutre, explicate utilizatorilor.",
    },
    privacy_center: {
      activity: "Centrul de confidențialitate pentru pacienți",
      purpose: "Posibilitatea ca pacienții să își găsească dosarele de la toate cabinetele, să le descarce și să își exercite drepturile.",
    },
    staff_accounts: {
      activity: "Conturile personalului",
      purpose: "Gestionarea conturilor personalului cabinetelor și a drepturilor de acces ale acestuia.",
    },
    security_logs: {
      activity: "Jurnal de acces și securitate",
      purpose:
        "Înregistrarea persoanelor care au accesat sau au modificat datele pacienților, pentru a-i proteja pe pacienți și a depista utilizările abuzive. Personalul este informat (art. 4 din Legea nr. 300/1970); jurnalul nu este folosit pentru monitorizarea performanței.",
    },
    privacy_requests: {
      activity: "Cereri privind protecția datelor",
      purpose: "Primirea și soluționarea, în termenele legale, a cererilor de exercitare a drepturilor privind protecția datelor.",
    },
  },

  legalBases: {
    art6_1_a: "Consimțământ (art. 6 alin. (1) lit. (a) GDPR)",
    art6_1_b: "Contract sau demersuri premergătoare încheierii acestuia (art. 6 alin. (1) lit. (b))",
    art6_1_c: "Obligație legală (art. 6 alin. (1) lit. (c))",
    art6_1_f: "Interes legitim (art. 6 alin. (1) lit. (f))",
    art9_2_a: "Consimțământ explicit pentru datele privind sănătatea (art. 9 alin. (2) lit. (a))",
    art9_2_f: "Constatarea, exercitarea sau apărarea unui drept în instanță (art. 9 alin. (2) lit. (f))",
    art9_2_h: "Asistență medicală sub obligația secretului profesional (art. 9 alin. (2) lit. (h) și alin. (3))",
  },

  dataCategories: {
    identity: "date de identificare (nume, data nașterii)",
    contact: "date de contact (telefon, email)",
    appointment: "datele programării (data, ora, cabinetul, medicul)",
    health_inferred: "date care pot dezvălui starea de sănătate (primirea de îngrijiri stomatologice, tipul tratamentului)",
    health: "date privind sănătatea (note, istoric medical)",
    minor: "date ale minorilor",
    guardian: "date ale părinților și tutorilor",
    message_content: "conținutul mesajelor",
    consent_record: "evidența consimțămintelor",
    review: "recenzii",
    professional: "date profesionale ale medicilor",
    account: "datele contului",
    technical: "date tehnice (adresă IP pseudonimizată, browser)",
    aggregated_metrics: "statistici agregate",
  },

  subjects: {
    patients: "pacienți",
    guardians: "părinți și tutori",
    bookers: "persoane care fac programări pentru altcineva",
    practitioners: "medici",
    staff: "personalul cabinetului",
    reviewers: "autori de recenzii",
  },

  transferTools: {
    eu: "Niciun transfer: furnizor din UE/SEE",
    dpf: "Cadrul UE-SUA privind confidențialitatea datelor (art. 45 GDPR)",
    scc: "Clauze contractuale standard (art. 46 alin. (2) lit. (c) GDPR)",
    dpf_scc: "Cadrul UE-SUA privind confidențialitatea datelor, cu clauze contractuale standard ca soluție de rezervă",
  },

  units: {
    months: p({ one: "{count} lună", few: "{count} luni", other: "{count} de luni" }),
    days: p({ one: "{count} zi", few: "{count} zile", other: "{count} de zile" }),
    hours: p({ one: "{count} oră", few: "{count} ore", other: "{count} de ore" }),
  },

  retention: {
    patientInactiveMonths:
      "Dosarul pacientului: {period} după ultima vizită, apoi restricționat sau pseudonimizat, la alegerea cabinetului (mai mult atunci când fișa clinică trebuie păstrată).",
    neverSeenPatientMonths: "Dosarele persoanelor care nu au avut niciodată o programare: {period}.",
    messageBodyMonths: "Textul mesajelor: {period}.",
    messageMetaMonths: "Jurnalul mesajelor (destinatar, dată, stare): {period}.",
    reminderDays: "Reamintirile programate: {period} după programare.",
    waitlistDays: "Cererile de pe lista de așteptare: {period} după ultima dată utilă; cele închise, după 30 de zile.",
    patientNoteDays: "Nota pacientului la programare și motivul anulării: {period} după vizită.",
    auditMonths: "Jurnalul de acces: {period}.",
    providerMessageDays: "Copiile păstrate de furnizorul de mesagerie: {period}.",
    formSubmissionMonths: "Chestionarele de istoric medical, după copierea în fișa clinică: {period}.",
    consentMonths: "Evidența consimțămintelor pacienților care nu mai figurează în evidență: {period}.",
    privacyRequestMonths: "Cererile închise: {period}.",
    marketingLapse: "Consimțământul pentru noutăți și oferte expiră după 24 de luni fără contact.",
    contract: "Pe durata furnizării serviciului, apoi pe durata termenului de prescripție.",
  },

  register: {
    title: "Registrul activităților de prelucrare",
    intro:
      "Art. 30 alin. (1) GDPR. Generat pe baza a ceea ce face Sorriso pentru cabinet și a setărilor sale actuale; adăugați activitățile pe care le desfășurați în afara Sorriso. Țineți-l la zi și prezentați-l Garante la cerere.",
    controller: "Operator",
    vat: "Cod de TVA",
    address: "Sediul social",
    contact: "Contact pentru protecția datelor",
    dpo: "Responsabil cu protecția datelor",
    none: "—",
    generated: "Generat la {date}",
    columns: {
      activity: "Activitatea de prelucrare",
      purpose: "Scop",
      legalBasis: "Temei juridic",
      subjects: "Persoane vizate",
      dataCategories: "Categorii de date cu caracter personal",
      recipients: "Destinatari",
      transfers: "Transferuri în afara UE",
      retention: "Termene de ștergere",
      security: "Măsuri de securitate",
    },
    recipient: "{name} ({service})",
    processor: "Sorriso, ca persoană împuternicită în temeiul acordului de prelucrare a datelor",
    transfer: "{name}: {tool}",
    noTransfers: "Niciunul",
    security: {
      platform:
        "Criptarea la nivel de câmp a notelor și a mesajelor; acces bazat pe roluri; jurnal de acces protejat împotriva modificărilor; păstrare automatizată; copii de siguranță criptate în UE; personal instruit și obligat la confidențialitate.",
      mfaRequired: "Conectare în doi pași obligatorie pentru tot personalul.",
      mfaOptional: "Conectare în doi pași disponibilă, dar neobligatorie.",
      sessions: p({
        one: "Sesiunile expiră după {count} oră.",
        few: "Sesiunile expiră după {count} ore.",
        other: "Sesiunile expiră după {count} de ore.",
      }),
      discreet: "Mesajele nu numesc niciodată tratamentul.",
      detailed: "Mesajele pot numi tratamentul (la alegerea cabinetului).",
    },
  },

  controls: {
    encryption: {
      title: "Criptarea câmpurilor sensibile",
      body: "Notele, textele mesajelor, răspunsurile la istoricul medical și alte texte libere sunt criptate în baza de date cu AES-256-GCM, cu chei păstrate în afara bazei de date.",
    },
    transport: {
      title: "Criptarea în tranzit",
      body: "Toate conexiunile folosesc TLS; browserelor li se cere să folosească doar HTTPS, iar paginile au o politică strictă de securitate a conținutului.",
    },
    access_control: {
      title: "Acces bazat pe roluri",
      body: "Fiecare rol al personalului vede doar ce îi este necesar: recepția nu are acces la notele clinice; exporturile, ștergerea și setările sunt rezervate proprietarilor și administratorilor.",
    },
    mfa: {
      title: "Conectare în doi pași",
      body: "Personalul se conectează cu o parolă și un cod de autentificare; operațiunile sensibile cer din nou codul.",
    },
    sessions: {
      title: "Limitele sesiunilor",
      body: "Sesiunile expiră după o perioadă stabilită de cabinet și după inactivitate; personalul le poate revoca.",
    },
    audit_log: {
      title: "Jurnal de acces protejat împotriva modificărilor",
      body: "Fiecare acces la datele pacienților și fiecare modificare a acestora sunt înregistrate într-un jurnal înlănțuit prin amprente criptografice, pe care cabinetul îl poate verifica și exporta; capetele lanțului sunt păstrate în afara bazei de date.",
    },
    pseudonymous_logs: {
      title: "Jurnale fără date cu caracter personal",
      body: "Jurnalele aplicației maschează numerele de telefon și adresele de email; adresele IP sunt stocate doar ca amprente criptografice cu cheie.",
    },
    rate_limiting: {
      title: "Protecție împotriva abuzurilor",
      body: "Conectarea, codurile unice și punctele de acces publice pentru programare au limite de frecvență.",
    },
    links: {
      title: "Linkuri pentru pacienți cu expirare",
      body: "Linkurile din mesaje conțin jetoane aleatorii, stocate doar ca amprente criptografice, care expiră după vizită.",
    },
    otp: {
      title: "Coduri unice",
      body: "Codurile sunt stocate doar ca amprente criptografice, expiră după 5 minute și se blochează după încercări greșite repetate.",
    },
    discreet_messages: {
      title: "Mesaje discrete",
      body: "Implicit, SMS-urile, mesajele WhatsApp, subiectele emailurilor și intrările din calendar nu numesc niciodată tratamentul, specialitatea sau notele.",
    },
    retention: {
      title: "Păstrare automatizată",
      body: "O sarcină zilnică șterge, anonimizează parțial sau pseudonimizează datele când se încheie perioada lor de păstrare.",
    },
    erasure: {
      title: "Ștergere și restricționare",
      body: "Cabinetele pot exporta, pseudonimiza sau restricționa un pacient într-un singur pas; dosarele restricționate necesită un motiv pentru fiecare acces.",
    },
    backups: {
      title: "Copii de siguranță",
      body: "Copiile de siguranță criptate, cu restaurare la un moment dat, sunt păstrate în UE pentru o perioadă limitată și apoi suprascrise.",
    },
    key_rotation: {
      title: "Gestionarea cheilor",
      body: "Cheile de criptare pot fi schimbate fără întreruperea serviciului; cheile vechi servesc doar la decriptare.",
    },
    no_trackers: {
      title: "Fără instrumente de urmărire ale terților",
      body: "Paginile Sorriso nu încarcă scripturi, fonturi, pixeli sau cookie-uri de publicitate ale terților; acest lucru este verificat automat.",
    },
    staff_instructions: {
      title: "Personal instruit",
      body: "Fiecare membru al personalului acceptă instrucțiuni scrise privind protecția datelor înainte de a lucra cu datele pacienților; acceptările sunt înregistrate.",
    },
    breach_procedure: {
      title: "Procedura în caz de încălcare a securității",
      body: "O procedură documentată pentru evaluarea, limitarea și notificarea încălcărilor securității datelor cu caracter personal, cu notificarea cabinetului în 24 de ore.",
    },
  },

  subprocessors: {
    title: "Subîmputerniciți",
    description: "Furnizorii pe care Sorriso îi folosește pentru a prelucra datele cabinetelor, locul în care le prelucrează și modul în care sunt protejate transferurile.",
    intro:
      "Când un cabinet folosește Sorriso, Sorriso prelucrează datele pacienților în numele cabinetului, în calitate de persoană împuternicită (art. 28 GDPR). Sorriso folosește furnizorii de mai jos. Fiecare este obligat printr-un acord de prelucrare a datelor cu obligații cel puțin la fel de stricte ca cele din acordul de prelucrare a datelor al Sorriso.",
    noticeRule:
      "Sorriso informează cabinetele despre orice subîmputernicit nou sau înlocuit cu cel puțin 30 de zile înainte de schimbare, prin email și în panoul de control. Un cabinet se poate opune în această perioadă; dacă nu se găsește o soluție, poate rezilia contractul fără penalități înainte ca schimbarea să se aplice.",
    transfersNote:
      "Un furnizor a cărui societate-mamă se află în Statele Unite poate fi obligat să acorde acces la date chiar dacă serverele sale se află în UE. Aceste transferuri se bazează pe Cadrul UE-SUA privind confidențialitatea datelor, cu clauze contractuale standard ca soluție de rezervă, și sunt analizate într-o evaluare a impactului transferului.",
    columns: {
      name: "Furnizor",
      entity: "Entitate juridică",
      service: "Serviciu",
      data: "Date",
      region: "Unde",
      transfer: "Garanția pentru transfer",
      dpa: "Acord",
    },
    onlyWhatsapp: "Doar pentru cabinetele care activează WhatsApp și doar pentru pacienții care îl aleg.",
    parent: "Societatea-mamă: {parent}",
    viewDpa: "Acordul de prelucrare a datelor al furnizorului",
    service: {
      hosting: "Găzduirea aplicației",
      database: "Bază de date",
      sms: "Mesaje SMS",
      whatsapp: "Mesaje WhatsApp",
      email: "Livrarea emailurilor",
      backups: "Copii de siguranță",
    },
    data: {
      all_platform_data: "toate datele stocate în Sorriso",
      contact: "date de contact",
      message_content: "conținutul mesajelor",
      message_metadata: "metadatele mesajelor",
      technical: "date tehnice",
    },
    changelog: "Istoricul modificărilor",
    change: {
      initial: "Prima listă publicată.",
      added: "A fost adăugat {name}.",
      removed: "A fost eliminat {name}.",
      changed: "Au fost modificate detaliile pentru {name}.",
    },
    announced: "Anunțat la {date}",
  },

  dpa: {
    title: "Acord de prelucrare a datelor",
    description: "Acordul încheiat în temeiul art. 28 GDPR între fiecare cabinet (operator) și Sorriso (persoană împuternicită).",
    intro:
      "Acest acord face parte din termenii și condițiile serviciului. Se aplică ori de câte ori Sorriso prelucrează date cu caracter personal în numele unui cabinet. Cabinetul îl acceptă în panoul de control; acceptarea este înregistrată cu versiunea, data și limba.",
    parties: {
      title: "1. Părțile și rolurile",
      body: "Operator: cabinetul care folosește Sorriso. Persoană împuternicită: {platform}.\n\nOperatorul stabilește de ce și cum sunt prelucrate datele pacienților pentru programările pe care le primește prin propriile canale: site-ul și widgetul său de programare, linkurile proprii, telefonul și recepția, precum și integrările pe care le conectează. Sorriso prelucrează aceste date doar în calitate de persoană împuternicită de Operator.",
    },
    subject: {
      title: "2. Obiectul, durata, natura și scopul",
      body: "Obiect: serviciul de programare online, reamintiri, listă de așteptare, rechemări și gestionare a pacienților descris în termenii și condițiile serviciului.\n\nDurată: cât timp există contul cabinetului, apoi până la ștergerea sau returnarea datelor conform secțiunii 11.\n\nNatura și scopul, tipurile de date și categoriile de persoane vizate: conform descrierii din Anexa I, generată pe baza prelucrărilor pe care Sorriso le efectuează efectiv.",
    },
    instructions: {
      title: "3. Instrucțiuni documentate (art. 28 alin. (3) lit. (a))",
      body: "Sorriso prelucrează datele cu caracter personal doar pe baza instrucțiunilor documentate ale Operatorului: acest acord, termenii și condițiile serviciului, setările Operatorului din panoul de control și operațiunile efectuate de personalul său. Aceasta include transferurile către țări terțe, care au loc doar conform descrierii din Anexa III.\n\nOperatorul îi dă instrucțiuni Sorriso să trimită invitații la feedback pacienților care și-au dat consimțământul pentru acestea și să aplice perioadele de păstrare stabilite în panoul de control.\n\nDacă Sorriso este obligat prin dreptul Uniunii sau prin dreptul italian să prelucreze datele în alt mod, informează Operatorul înainte de prelucrare, cu excepția cazului în care legea interzice acest lucru. Sorriso informează imediat Operatorul dacă, în opinia sa, o instrucțiune încalcă legislația privind protecția datelor.",
    },
    confidentiality: {
      title: "4. Confidențialitate (art. 28 alin. (3) lit. (b))",
      body: "Sorriso se asigură că persoanele pe care le autorizează să prelucreze datele s-au angajat să respecte confidențialitatea, primesc instrucțiuni privind protecția datelor și accesează datele doar în măsura în care sarcina lor o impune. Personalul Sorriso nu accesează niciodată dosarele pacienților decât pentru a acorda asistența solicitată de Operator, pentru a menține securitatea serviciului sau atunci când legea o impune; un astfel de acces este înregistrat.",
    },
    security: {
      title: "5. Securitate (art. 28 alin. (3) lit. (c) și art. 32)",
      body: "Sorriso pune în aplicare măsurile tehnice și organizatorice din Anexa II, ținând seama de stadiul actual al tehnologiei, de costuri și de riscurile pentru pacienți, în special pentru că datele pot dezvălui informații privind sănătatea. Sorriso revizuiește periodic aceste măsuri și nu reduce nivelul general de protecție.",
    },
    subprocessors: {
      title: "6. Subîmputerniciți (art. 28 alin. (2) și (4))",
      body: "Operatorul îi acordă Sorriso o autorizație generală de a folosi subîmputerniciții enumerați în Anexa III și pe pagina publică a subîmputerniciților. Sorriso informează Operatorul despre orice adăugare sau înlocuire preconizată cu cel puțin 30 de zile înainte, prin email și în panoul de control. Operatorul se poate opune în această perioadă din motive rezonabile legate de protecția datelor; dacă nu se găsește o soluție, Operatorul poate rezilia serviciul afectat fără penalități înainte ca schimbarea să se aplice.\n\nSorriso impune fiecărui subîmputernicit, prin contract, aceleași obligații privind protecția datelor ca cele din acest acord și rămâne pe deplin răspunzător față de Operator pentru îndeplinirea acestora.",
    },
    rights: {
      title: "7. Drepturile persoanelor vizate (art. 28 alin. (3) lit. (e))",
      body: "Sorriso ajută Operatorul să răspundă cererilor de exercitare a drepturilor prevăzute în capitolul III din GDPR prin instrumente din panoul de control: căsuța de cereri cu termenele acestora, exportul în JSON, CSV și FHIR, rectificarea, restricționarea și ștergerea prin pseudonimizare.\n\nDacă o cerere privind prelucrarea efectuată de Operator ajunge la Sorriso, Sorriso o transmite Operatorului în termen de 2 zile lucrătoare și nu răspunde în numele Operatorului, cu excepția informării solicitantului că cererea a fost transmisă.",
    },
    assistance: {
      title: "8. Asistență pentru îndeplinirea obligațiilor Operatorului (art. 28 alin. (3) lit. (f))",
      body: "Ținând seama de natura prelucrării și de informațiile de care dispune, Sorriso asistă Operatorul în ceea ce privește securitatea (art. 32), notificarea și comunicarea încălcărilor securității datelor (art. 33-34), evaluările impactului asupra protecției datelor și consultarea prealabilă (art. 35-36). Sorriso pune la dispoziție propria evaluare a impactului platformei și evaluarea impactului transferurilor.",
    },
    breach: {
      title: "9. Încălcări ale securității datelor cu caracter personal",
      body: "Sorriso notifică Operatorul fără întârzieri nejustificate și, în orice caz, în termen de 24 de ore de la data la care a luat cunoștință de o încălcare a securității datelor cu caracter personal care afectează datele Operatorului. Notificarea descrie, în măsura în care sunt cunoscute, natura încălcării, categoriile și numărul aproximativ de pacienți și de înregistrări vizate, consecințele probabile și măsurile luate sau propuse. Sorriso completează informațiile pe măsură ce devin disponibile, astfel încât Operatorul să poată notifica Garante în termen de 72 de ore și, dacă este necesar, să îi informeze pe pacienți.",
    },
    audits: {
      title: "10. Informații și audituri (art. 28 alin. (3) lit. (h))",
      body: "Sorriso pune la dispoziția Operatorului toate informațiile necesare pentru a demonstra respectarea art. 28: acest acord, registrul activităților de prelucrare, măsurile de securitate, certificările sau rapoartele de audit, dacă există, și jurnalul de acces din panoul de control. Sorriso permite audituri și inspecții efectuate de Operator sau de un auditor desemnat de acesta, obligat la confidențialitate, cu o notificare prealabilă de cel puțin 30 de zile, în timpul programului de lucru și fără a perturba serviciul; auditurile sunt pe cheltuiala Operatorului, cu excepția cazului în care dezvăluie o încălcare semnificativă.",
    },
    deletion: {
      title: "11. Returnarea și ștergerea la final (art. 28 alin. (3) lit. (g))",
      body: "Operatorul își poate descărca oricând toate datele, în formate documentate (JSON, CSV și FHIR R4), fără costuri. Când Operatorul își închide contul, programarea online se oprește imediat, datele rămân disponibile pentru descărcare timp de 60 de zile (o tranziție de 30 de zile și cel puțin 30 de zile pentru recuperarea lor), iar apoi sunt șterse din sistemele Sorriso. Sorriso emite un certificat de ștergere care indică ce a fost șters și când. Copiile de siguranță criptate sunt suprascrise în perioada lor de păstrare și nu sunt restaurate decât pentru recuperarea în urma unui incident. Sorriso păstrează datele mai mult timp doar atunci când dreptul Uniunii sau dreptul italian o impune și doar în acest scop.",
    },
    transfers: {
      title: "12. Transferuri în afara UE",
      body: "Datele sunt găzduite în UE. Unii subîmputerniciți fac parte din grupuri cu sediul în Statele Unite; garanțiile pentru transfer aferente fiecăruia sunt enumerate în Anexa III, iar impactul lor a fost evaluat. Sorriso nu transferă datele Operatorului către nicio altă țară terță fără a-l informa în prealabil pe Operator conform secțiunii 6.",
    },
    ownPurposes: {
      title: "13. Prelucrări pentru care Sorriso este operator",
      body: "Pentru unele activități, Sorriso este operator independent, nu persoană împuternicită de Operator, și le aduce acest lucru la cunoștință pacienților în propria notă de informare: programările începute pe paginile de căutare Sorriso (cu consimțământul explicit al pacientului), recenziile publicate, catalogul și clasamentul căutării, centrul de confidențialitate pentru pacienți și conturile personalului. Sorriso nu folosește datele pe care le prelucrează pentru Operator în niciun alt scop propriu și nu le vinde și nu le folosește niciodată în scopuri publicitare.",
    },
    controller: {
      title: "14. Obligațiile Operatorului",
      body: "Operatorul se asigură că are un temei juridic pentru prelucrare, le pune la dispoziție pacienților nota sa de informare (Sorriso generează una pe baza setărilor cabinetului), își instruiește personalul și își menține la zi setările, perioadele de păstrare și registrul activităților de prelucrare. Operatorul nu conectează widgetul sau paginile de programare Sorriso la instrumente de publicitate sau de analiză într-un mod care le dezvăluie cine s-a programat.",
    },
    liability: {
      title: "15. Răspundere și durată",
      body: "Fiecare parte răspunde conform art. 82 GDPR și termenilor și condițiilor serviciului. Acest acord este valabil cât timp Sorriso prelucrează date cu caracter personal pentru Operator. În cazul unui conflict cu termenii și condițiile serviciului în materie de protecție a datelor, prevalează acest acord.",
    },
    law: {
      title: "16. Legea aplicabilă",
      body: "Acest acord este guvernat de legea italiană. Litigiile sunt de competența instanțelor stabilite în termenii și condițiile serviciului.",
    },
    annex1: {
      title: "Anexa I — Descrierea prelucrării",
      intro: "Prelucrările pe care Sorriso le efectuează în calitate de persoană împuternicită, generate din registrul scopurilor al platformei.",
    },
    annex2: {
      title: "Anexa II — Măsuri tehnice și organizatorice",
      intro: "Măsurile în vigoare în prezent. Această listă este generată pe baza controalelor implementate în platformă.",
    },
    annex3: {
      title: "Anexa III — Subîmputerniciți",
      intro: "Lista actuală (versiunea {version}). Pagina publică păstrează istoricul modificărilor.",
    },
  },

  terms: {
    title: "Termeni și condiții pentru cabinete",
    description: "Contractul dintre Sorriso și cabinetele stomatologice care îl folosesc.",
    intro:
      "Acești termeni reglementează utilizarea Sorriso de către cabinetele stomatologice („cabinetul”) și sunt încheiați cu {platform}. Cabinetul îi acceptă în panoul de control; acceptarea este înregistrată cu versiunea, data și limba.",
    service: {
      title: "1. Serviciul",
      body: "Sorriso oferă programare online pentru site-ul cabinetului și pentru paginile de căutare Sorriso, un calendar pentru medici, fotolii și sedii, confirmări și reamintiri, o listă de așteptare, rechemări, dosare ale pacienților pentru administrare și instrumente pentru îndeplinirea obligațiilor privind protecția datelor. Sorriso nu este furnizor de servicii medicale și nu oferă sfaturi medicale.",
    },
    account: {
      title: "2. Conturi și personal",
      body: "Cabinetul desemnează un proprietar care îi gestionează contul și invită personalul, atribuind fiecăruia un rol. Cabinetul răspunde de modul în care personalul său folosește serviciul, păstrează confidențialitatea datelor de conectare și activează conectarea în doi pași. Fiecare membru al personalului trebuie să accepte instrucțiunile privind protecția datelor înainte de a lucra cu datele pacienților.",
    },
    data: {
      title: "3. Protecția datelor",
      body: "Pentru datele pacienților care se programează prin canalele proprii ale cabinetului, cabinetul este operator, iar Sorriso persoana împuternicită de acesta: se aplică acordul de prelucrare a datelor, care face parte din acești termeni. Pentru programările începute pe paginile de căutare Sorriso, recenzii, catalog și centrul de confidențialitate, Sorriso este operator independent, așa cum se explică în nota sa de informare.",
    },
    obligations: {
      title: "4. Obligațiile cabinetului",
      body: "Cabinetul furnizează informații corecte despre serviciile, prețurile, medicii și disponibilitatea sa; onorează programările pe care le acceptă; folosește datele pacienților doar în scopuri de îngrijire și administrare; și nu folosește Sorriso pentru a trimite comunicări nesolicitate.",
    },
    marketplace: {
      title: "5. Căutare, clasament și recenzii",
      body: "Cabinetele apar în căutarea Sorriso doar dacă sunt listate și cu medicii care și-au aprobat profilul. Clasamentul folosește criterii neutre publicate pe pagina dedicată clasamentului; nicio plată nu influențează poziția. Doar pacienții cu o vizită efectuată pot scrie o recenzie, iar cabinetele nu pot elimina recenziile: pot răspunde și pot semnala o recenzie, asupra căreia Sorriso decide motivat, cu posibilitatea unei singure contestații.",
    },
    availability: {
      title: "6. Disponibilitate și asistență",
      body: "Sorriso depune diligența rezonabilă pentru a menține serviciul disponibil și sigur și anunță din timp lucrările de întreținere planificate. Asistența este disponibilă prin email în zilele lucrătoare.",
    },
    fees: {
      title: "7. Tarife",
      body: "Tarifele, dacă există, sunt cele ale planului ales de cabinet, afișate în panoul de control. Sorriso anunță modificările de preț cu cel puțin 30 de zile înainte. Exporturile și trecerea la alt furnizor sunt gratuite.",
    },
    ip: {
      title: "8. Proprietate intelectuală",
      body: "Cabinetul păstrează toate drepturile asupra conținutului și datelor sale. Sorriso păstrează toate drepturile asupra software-ului. Cabinetul îi acordă Sorriso dreptul de a afișa profilul și conținutul său public în scopurile serviciului.",
    },
    suspension: {
      title: "9. Suspendare",
      body: "Sorriso poate suspenda un cont doar în cazul unei încălcări grave a acestor termeni, al unui risc de securitate sau al unei obligații legale, comunicând cabinetului motivele în scris în prealabil, atunci când este posibil, și cel târziu la intrarea în vigoare a suspendării. Cabinetul poate contesta decizia prin procedura de soluționare a reclamațiilor.",
    },
    exit: {
      title: "10. Încetare, schimbarea furnizorului și recuperarea datelor",
      body: "Cabinetul își poate închide contul oricând din panoul de control, fără perioadă de preaviz. Programarea online se oprește imediat; cabinetul își păstrează accesul pentru o tranziție de 30 de zile și cel puțin încă 30 de zile pentru a-și recupera gratuit datele în JSON, CSV și FHIR, iar Sorriso îl ajută să treacă la alt furnizor. Datele sunt apoi șterse și se emite un certificat de ștergere. Sorriso poate rezilia contractul cu un preaviz de două luni sau imediat în cazul unei încălcări grave.",
    },
    liability: {
      title: "11. Răspundere",
      body: "Niciuna dintre părți nu își exclude răspunderea pentru dol sau culpă gravă ori atunci când legea nu permite acest lucru. În rest, răspunderea fiecărei părți este limitată la prejudiciul direct previzibil. Sorriso nu răspunde pentru serviciile clinice ale cabinetului.",
    },
    complaints: {
      title: "12. Reclamații și mediere",
      body: "Cabinetul poate trimite reclamații către Sorriso prin panoul de control sau prin email; Sorriso răspunde în termen de 15 zile lucrătoare. Sorriso este dispus să recurgă la mediere pentru soluționarea extrajudiciară a litigiilor, conform Regulamentului (UE) 2019/1150.",
    },
    changes: {
      title: "13. Modificarea acestor termeni",
      body: "Sorriso anunță modificările cu cel puțin 30 de zile înainte, prin email și în panoul de control, cu excepția cazului în care legea impune o modificare mai rapidă. Dacă nu este de acord, cabinetul poate rezilia contractul înainte ca modificarea să se aplice, fără costuri.",
    },
    law: {
      title: "14. Legea aplicabilă și instanțele competente",
      body: "Acești termeni sunt guvernați de legea italiană. Competența revine instanțelor de la sediul social al Sorriso, fără a aduce atingere normelor imperative.",
    },
  },

  docs: {
    dpa: "Acord de prelucrare a datelor",
    terms: "Termeni și condiții",
    subprocessors: "Subîmputerniciți",
    staff_instructions: "Instrucțiuni pentru personal",
  },
} satisfies DeepPartial<Messages["legalPractice"]>;
