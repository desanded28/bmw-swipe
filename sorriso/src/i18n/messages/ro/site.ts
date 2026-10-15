import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "{app}: programare online la dentist",
    description:
      "Găsiți un dentist lângă dumneavoastră, vedeți disponibilitatea reală și programați-vă în câteva secunde. Reamintiri prin SMS sau email: confirmați sau reprogramați cu o singură atingere.",
  },
  header: {
    findDentist: "Găsiți un dentist",
    forPractices: "Pentru cabinete",
    api: "API",
    login: "Conectare cabinet",
    bookNow: "Programați-vă acum",
  },
  footer: {
    tagline: "Programări online la dentist, cu disponibilitate în timp real. Reamintiri la care pacienții răspund cu un singur cuvânt.",
    patients: "Pacienți",
    findDentist: "Găsiți un dentist",
    emergency: "Urgență stomatologică",
    cleaning: "Detartraj și igienizare",
    privacyCenter: "Datele dumneavoastră (centrul de confidențialitate)",
    practices: "Cabinete",
    features: "Funcționalități",
    createPractice: "Creați un cabinet",
    apiWidget: "API și widget de programare",
    legal: "Informații juridice",
    privacy: "Informare privind confidențialitatea",
    cookies: "Cookie-uri",
    terms: "Termeni și condiții",
    dpa: "Acord de prelucrare a datelor",
    subprocessors: "Subîmputerniciți",
    accessibility: "Accesibilitate",
    reviewPolicy: "Politica privind recenziile",
    ranking: "Cum sunt ordonate rezultatele",
    copyright: "© {year} {app}",
    demo: "Proiect demonstrativ: cabinetele și persoanele prezentate sunt fictive.",
  },
  notFound: {
    code: "Eroare 404",
  },
  home: {
    badge: "Doar recenzii verificate, de la vizite reale",
    heroTitle: "Dentistul de care aveți nevoie, <em>programat în 30 de secunde.</em>",
    heroBody:
      "Disponibilitate în timp real la cabinetele din apropiere. Fără cont, fără așteptare la telefon. Primiți o reamintire prin SMS sau email: răspundeți <b>DA</b> pentru a confirma sau mutați programarea cu o singură atingere.",
    quickLabel: "Tratamente căutate",
    quick: {
      checkup: "Control",
      hygiene: "Detartraj",
      orthodontics: "Alignere și aparate dentare",
      pediatric: "Copii",
      emergency: "Urgență",
    },
    soonestTitle: "Cele mai apropiate disponibilități",
    soonestBody: "Alegeți o oră și ați terminat: aceste ore sunt actualizate în timp real.",
    seeAll: "Vedeți toți dentiștii",
    how: {
      title: "Cum funcționează",
      step: "Pasul {n}",
      findTitle: "Găsiți disponibilitatea reală",
      findBody: "Comparați dentiștii după tratament, preț, recenzii verificate și prima oră liberă, la fiecare cabinet în care lucrează.",
      bookTitle: "Programați-vă fără cont",
      bookBody: "Alegeți o oră, adăugați numele și numărul de telefon. Primiți imediat o confirmare cu invitație în calendar.",
      confirmTitle: "Confirmați printr-un răspuns",
      confirmBody: "Vă reamintim prin SMS sau email. Răspundeți DA pentru a confirma sau NU pentru a anula ori reprogramați cu o singură atingere.",
    },
    citiesTitle: "Dentiști pe orașe",
    cityLink: "Dentiști în {city}",
    cityCount: p({ one: "{count} cabinet", few: "{count} cabinete", other: "{count} de cabinete" }),
    practices: {
      kicker: "Pentru cabinetele stomatologice",
      title: "Mai puține neprezentări. Toate sediile într-un singur calendar.",
      body: "Programare pe mai multe sedii cu fotolii dentare, confirmări prin SMS în ambele sensuri, o listă de așteptare automată care umple locurile anulate și un API de programare deschis.",
      features: "Vedeți funcționalitățile",
      demo: "Încercați panoul de control demo",
      offices: "Mai multe sedii, medici și fotolii, fără suprapuneri de programări între locații",
      rules: "Reguli de reamintire pentru fiecare cabinet: email cu 48 de ore înainte, SMS cu 24 de ore înainte, WhatsApp dacă îl activați",
      replies: "Pacienții răspund DA sau NU, iar calendarul se actualizează singur",
      waitlist: "Orele anulate sunt oferite listei de așteptare în câteva secunde",
    },
  },
  forClinics: {
    metaTitle: "Pentru cabinetele stomatologice",
    metaDescription:
      "Programare online, un calendar pentru mai multe sedii și reamintiri la care pacienții răspund, cu protecția datelor integrată. Exportați totul oricând.",
    kicker: "Pentru cabinetele stomatologice",
    title: "Umpleți-vă programul. Nu mai alergați după confirmări.",
    body: "Programare online, un calendar pentru mai multe sedii și reamintiri la care pacienții chiar răspund, într-un singur loc.",
    signup: "Creați-vă cabinetul",
    demo: "Deschideți panoul de control demo",
    featuresTitle: "Funcționalități",
    features: {
      offices: {
        title: "Toate sediile, un singur calendar",
        body: "Medicii lucrează în sedii diferite, în zile diferite. Disponibilitatea este calculată pentru fiecare sediu și nimeni nu poate fi programat de două ori în locații diferite.",
      },
      chairs: {
        title: "Fotolii, pauze și închideri",
        body: "Programările rezervă automat un fotoliu. Timpul de pregătire pentru fiecare tratament, sărbătorile, întreținerea și concediile personale blochează disponibilitatea.",
      },
      twoWay: {
        title: "Reamintiri prin SMS în ambele sensuri",
        body: "Reamintirile le cer pacienților să răspundă DA sau NU, în limba lor. Răspunsurile confirmă sau anulează imediat; orice alt mesaj este semnalat recepției.",
      },
      rules: {
        title: "Reguli de reamintire stabilite de dumneavoastră",
        body: "De exemplu: email cu 48 de ore înainte, SMS cu 24 de ore înainte, un SMS scurt cu 2 ore înainte. WhatsApp doar dacă îl activați și pacientul este de acord.",
      },
      waitlist: {
        title: "Anulările se umplu singure",
        body: "Când se eliberează o oră, aceasta este oferită în câteva secunde pacienților potriviți de pe lista de așteptare. Primul care se programează o obține, fără telefoane.",
      },
      board: {
        title: "Panoul de confirmări",
        body: "Vedeți ziua de mâine dintr-o privire: confirmați, în așteptare și cine trebuie sunat, cu motivul afișat. Doar ajută: nimănui nu i se refuză o programare.",
      },
      reviews: {
        title: "Doar recenzii verificate",
        body: "Doar pacienții cu o vizită efectuată pot lăsa o recenzie, și doar cu consimțământul lor. Cabinetele pot răspunde, dar nu pot ascunde recenziile.",
      },
      api: {
        title: "API de programare deschis și widget",
        body: "Integrați programarea pe site-ul dumneavoastră cu o singură etichetă script, sincronizați cu software-ul cabinetului prin API-ul REST, abonați-vă la fluxuri de calendar.",
      },
      roles: {
        title: "Roluri pentru echipa dumneavoastră",
        body: "Proprietarii, administratorii, recepția și medicii văd fiecare ce le trebuie. Fiecare acces la dosarul unui pacient este înregistrat.",
      },
      privacy: {
        title: "Confidențialitate implicită",
        body: "Mesajele și intrările din calendar nu numesc tratamentul. Pacienții își gestionează datele și consimțămintele într-un centru de confidențialitate, fără cont.",
      },
      languages: {
        title: "Opt limbi",
        body: "Pacienții se programează și primesc reamintiri în italiană, engleză, germană, franceză, spaniolă, portugheză, română sau poloneză.",
      },
    },
    flow: {
      title: "Cum funcționează o confirmare",
      book: "Pacientul se programează online (sau îl programați la recepție) și primește o confirmare cu invitație în calendar.",
      email: "Cu 48 de ore înainte: un email care îi cere să confirme cu un clic.",
      text: "Cu 24 de ore înainte: un SMS care îi cere să răspundă DA pentru a confirma sau NU pentru a anula.",
      reply: "DA face programarea verde în calendar. NU o anulează și oferă ora listei de așteptare.",
      other: "Orice alt răspuns („pot veni cu 30 de minute mai târziu?”) ajunge în inboxul dumneavoastră și este semnalat în calendar.",
    },
    sms: {
      sender: "Studio Dentar Bianchi",
      reminder:
        "Studio Dentar Bianchi: reamintire programare, mie. 15 oct. la 10:30, Via Torino 42, Milano. Raspundeti DA pentru confirmare, NU pentru anulare. Detalii: sorriso.example/a/... STOP pentru dezabonare",
      reply: "DA",
      thanks: "Vă mulțumim! Programarea de mie. 15 oct. la 10:30 este confirmată. Pe curând!",
      caption: "O reamintire așa cum o primește pacientul: tratamentul nu este numit niciodată.",
    },
    noLockIn: "Datele rămân ale dumneavoastră: exportați totul oricând, fără nicio obligație.",
    apiDocs: "Citiți documentația API",
  },
  developers: {
    metaTitle: "API și widget de programare",
    metaDescription:
      "Integrați programarea online pe site-ul cabinetului, faceți programări prin API-ul REST și sincronizați cu software-ul cabinetului.",
    title: "API și widget de programare",
    intro:
      "Tot ce face site-ul {host} trece prin acest API, astfel încât integrarea dumneavoastră poate face tot ce poate face un pacient. JSON prin HTTPS, CORS activat, ore în format ISO 8601 (UTC).",
    codeSample: "Exemplu de cod",
    attribute: "Atribut",
    field: "Câmp",
    description: "Descriere",
    widget: {
      title: "1. Integrați programarea pe site-ul dumneavoastră",
      button: "Un buton flotant „Programați-vă” care deschide formularul de programare într-o fereastră de dialog:",
      inline: "Sau integrat, într-un element al paginii, aici în germană și pentru un singur medic:",
      attributesCaption: "Atributele widgetului",
      attributes: {
        "data-clinic": "Obligatoriu. Adresa cabinetului dumneavoastră pe Sorriso (slug-ul). Fără el, scriptul nu afișează nimic.",
        "data-lang":
          "Limba formularului și a mesajelor către pacient. Dacă lipsește: limba paginii dumneavoastră (atributul lang), apoi cea a browserului vizitatorului, apoi italiana.",
        "data-target":
          "Un selector CSS: afișează formularul în acel element, în locul unui buton flotant. Dacă niciun element nu corespunde când rulează scriptul, nu se afișează nimic.",
        "data-practitioner": "Deschide formularul pentru un singur medic (id-ul acestuia).",
        "data-service": "Preselectează un tratament (id-ul acestuia).",
        "data-location": "Preselectează un sediu (id-ul acestuia).",
        "data-label": "Textul butonului flotant. Dacă lipsește, „Programați-vă” în limba aleasă.",
        "data-color": "Culoarea butonului flotant, ca o culoare CSS.",
        "data-events": "Activează evenimentul sorriso:booked pe pagina dumneavoastră când se finalizează o programare.",
        "data-include-id": "Împreună cu data-events: include id-ul programării în eveniment.",
      },
      languages: "Valori pentru limbă (<code>data-lang</code>, <code>patient.locale</code>):",
      eventsTitle: "Evenimente de programare",
      events:
        "Cu <code>data-events</code>, pagina dumneavoastră primește un eveniment <code>sorriso:booked</code> când se finalizează o programare. Nu conține date personale, iar id-ul programării doar cu <code>data-include-id</code>. Mesajele sunt trimise doar către originea paginii dumneavoastră.",
      eventsWarning:
        "Nu transmiteți acest eveniment instrumentelor de publicitate sau de analiză (cum ar fi etichetele Meta sau Google): dezvăluie că un vizitator și-a făcut o programare la dentist, ceea ce reprezintă date privind sănătatea. Conform acordului de prelucrare a datelor, îl puteți folosi doar pentru a afișa propria confirmare.",
      origins:
        "Pentru a împiedica alte site-uri să integreze formularul dumneavoastră de programare, adăugați adresele site-ului în Panou de control, Setări de confidențialitate, Site-uri permise. În altă parte, widgetul afișează atunci doar un link care deschide pagina de programare într-o filă nouă. Verificarea se bazează pe adresa pe care browserele vizitatorilor o trimit împreună cu cadrul: widgetul o solicită, iar dacă scrieți propriul iframe, nu îi setați <code>referrerpolicy=\"no-referrer\"</code>.",
    },
    booking: {
      title: "2. Programări prin API",
      fieldsCaption: "Câmpurile programării",
      context:
        "Cine răspunde de datele programării decide serverul, niciodată un câmp trimis de dumneavoastră: programările făcute cu cheia API, widgetul sau linkurile semnate pentru cabinetul dumneavoastră vă aparțin (Sorriso le prelucrează pentru dumneavoastră); programările începute pe paginile proprii Sorriso necesită consimțământul pacientului față de Sorriso.",
      errors:
        "Erorile au o singură formă: un obiect <code>error</code> cu un <code>code</code> și un <code>message</code>. O oră ocupată returnează 409 cu <code>practitioner_busy</code>, <code>no_room</code>, <code>time_off</code>, <code>outside_hours</code> sau <code>too_soon</code>; câmpurile nevalide returnează 422 cu o listă <code>issues</code>, iar o regulă de confidențialitate sau de vârstă încălcată 422 cu propriul cod și <code>field</code>.",
    },
    fields: {
      locale:
        "Limba mesajelor către pacient: <code>it</code>, <code>en</code>, <code>de</code>, <code>fr</code>, <code>es</code>, <code>pt</code>, <code>ro</code> sau <code>pl</code>.",
      phoneCountry:
        "Prefixul de țară al unui număr introdus fără prefix, de exemplu <code>39</code> sau <code>49</code>. Numerele care încep cu + sau 00 își păstrează prefixul.",
      preferredChannel:
        "<code>sms</code>, <code>email</code> sau <code>whatsapp</code>. WhatsApp doar dacă cabinetul l-a activat și cu <code>privacy.whatsapp</code> setat la true.",
      privacy:
        "Obligatoriu fără cheie API. <code>noticeVersion</code> (versiunea notei de informare afișate), <code>locale</code> și opțiunile pacientului: <code>platformConsent</code>, <code>whatsapp</code>, <code>feedback</code>, <code>marketing</code>. Casetele nebifate de pacient sunt false.",
      relation:
        "Pentru cine este programarea: <code>bookedFor</code> este <code>self</code>, <code>minor</code> (cu <code>guardian</code>: nume, relație, telefon sau email) sau <code>other_adult</code>.",
      practiceRef: "Marcajul cabinetului dintr-un link publicat de cabinetul dumneavoastră (?ref=). Fără el, programarea este considerată făcută pe Sorriso.",
      fundId: "Opțional: fondul de sănătate sau asigurătorul pe care îl va folosi pacientul. Se păstrează doar dacă cabinetul are acel fond în listă.",
    },
    sync: {
      title: "3. Sincronizare cu software-ul cabinetului",
      keys: "Creați o cheie API în Panou de control, Setări, API, alegeți-i permisiunile și trimiteți-o ca bearer token. Cheile pot expira și pot fi revocate oricând.",
      scopesTitle: "Permisiuni",
    },
    scopes: {
      "appointments:read": "Citirea programărilor și a resurselor pe care le folosesc.",
      "appointments:write": "Crearea, mutarea și anularea programărilor, înregistrarea confirmărilor, a neprezentărilor și a vizitelor efectuate.",
      "patients:read": "Citirea numelor și a datelor de contact ale pacienților.",
      "patients:write": "Crearea și actualizarea pacienților.",
      "notes:read": "Citirea notelor scrise de pacienți și de personal la programări. Acordați-o doar software-ului clinic.",
      "patients:erase": "Solicitarea ștergerii datelor unui pacient (tratată ca cerere privind confidențialitatea).",
    },
    export: {
      title: "4. Exportul datelor",
      body: "Un cabinet își poate exporta oricând toate datele în JSON, CSV și FHIR R4. Formatele sunt descrise în <link>schema de export</link>.",
    },
    reference: "Referință",
    groups: {
      public: "Programare publică (folosită de site și de widget)",
      patient: "Autoservire pentru pacienți (token din linkul pacientului)",
      partner: "API pentru parteneri (software-ul cabinetului)",
      infra: "Infrastructură",
    },
    auth: {
      public: "acces public",
      token: "jeton",
      apiKey: "cheie API",
      secret: "cheie secretă",
    },
    endpoints: {
      clinic: "Profilul cabinetului, sediile, medicii (cu tratamente și sedii) și tratamentele care pot fi programate.",
      availability:
        "Orele libere pe zi. Fără practitionerId: „primul disponibil”, distribuit între medici. Returnează nextAvailable când intervalul este gol.",
      book: "Rezervarea unei ore. Verificată din nou într-o tranzacție de scriere: doi pacienți nu pot obține niciodată aceeași oră.",
      waitlist: "Înscrierea pe lista de așteptare pentru un tratament, opțional un medic sau un sediu, un interval de date și o parte a zilei.",
      appointment: "Programarea și ce mai poate face pacientul (canCancel, canReschedule).",
      confirm: "Confirmarea prezenței.",
      cancel: "Anularea (ora este oferită listei de așteptare). Câmp opțional în corp: reason.",
      reschedule: "Mutarea la o altă oră liberă. Câmpuri în corp: start și, opțional, practitionerId și locationId.",
      resources: "Sedii, fotolii, medici (cu programul lor) și tratamente, pentru corespondența id-urilor.",
      list: "Lista programărilor. Folosiți updatedSince pentru sincronizare incrementală.",
      create: "Crearea unei programări cu drepturi de recepție (durată personalizată, în afara programului, id de pacient existent).",
      update: "Reprogramarea, anularea, marcarea ca efectuată sau neprezentare ori înregistrarea unei confirmări telefonice.",
      twilio: "Răspunsuri SMS și WhatsApp primite (semnate de Twilio). Răspunde direct cu TwiML.",
      twilioStatus: "Confirmări de livrare (livrat, eșuat).",
      cron: "Trimite reamintirile scadente. Apelați la fiecare 1-5 minute cu Authorization: Bearer $CRON_SECRET.",
      ics: "Fluxul de calendar al unui medic, la care vă puteți abona (Google, Apple, Outlook).",
    },
  },
} satisfies DeepPartial<Messages["site"]>;
