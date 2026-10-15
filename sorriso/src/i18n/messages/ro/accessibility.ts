import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    title: "Declarație de accesibilitate",
    description: "Cât de accesibile sunt site-ul și serviciul de programare {app}, limitările cunoscute și cum puteți semnala o barieră.",
  },
  title: "Declarație de accesibilitate",
  translationNotice: "Aceasta este o traducere. În caz de neconcordanță, prevalează <link>versiunea în limba italiană</link>.",
  intro:
    "{provider} dorește ca site-ul și serviciul său de programare să poată fi folosite de toată lumea, inclusiv de persoanele care utilizează un cititor de ecran, tastatura, mărirea ecranului sau comanda vocală.",
  legalBasis:
    "Această declarație este publicată în temeiul Actului european privind accesibilitatea (Directiva (UE) 2019/882), transpus în Italia prin Decretul legislativ nr. 82/2022, și al Legii nr. 4/2004.",
  scope: {
    title: "Ce acoperă această declarație",
    body: "Site-ul public {host}: căutarea, paginile cabinetelor și ale medicilor, formularele de programare și de înscriere pe lista de așteptare, pagina programării accesată din confirmări și reamintiri, centrul de confidențialitate, paginile juridice și widgetul de programare pe care cabinetele îl integrează pe propriile site-uri.",
  },
  status: {
    title: "Stadiul conformității",
    body: "Proiectăm și testăm pe baza Ghidului de accesibilitate a conținutului web (WCAG) 2.2, nivelul AA. Standardul european armonizat la care face trimitere legea, EN 301 549 v3.2.1, include WCAG 2.1 nivelul AA. Serviciul este parțial conform cu WCAG 2.1 nivelul AA: părțile enumerate la limitările cunoscute nu sunt încă pe deplin conforme.",
  },
  features: {
    title: "Ce facem",
    keyboard:
      "Site-ul este construit pentru a putea fi folosit doar cu tastatura, cu un indicator de focalizare vizibil și un link de salt la conținutul principal.",
    screenReader:
      "Paginile sunt structurate cu titluri și repere. Câmpurile formularelor au etichete, iar erorile și mesajele de stare sunt anunțate de cititoarele de ecran.",
    steps: "Formularul de programare mută focalizarea la fiecare pas nou, păstrează ce ați introdus când reveniți și explică fiecare eroare lângă câmpul respectiv.",
    contrast: "Textul și elementele de formular respectă rapoartele de contrast WCAG AA, iar nicio informație nu este transmisă doar prin culoare.",
    motion: "Animațiile sunt dezactivate atunci când dispozitivul dumneavoastră solicită mișcare redusă.",
    zoom: "Paginile sunt construite pentru a funcționa la un zoom de 200% și pe ecrane mici, fără derulare orizontală.",
    languages:
      "Site-ul este disponibil în opt limbi, iar fiecare pagină își declară limba, astfel încât cititoarele de ecran să o pronunțe corect.",
    help: "Datele de contact ale cabinetului sunt afișate în același loc în formularul de programare și pe pagina programării dumneavoastră.",
  },
  limitations: {
    title: "Limitări cunoscute",
    practiceContent:
      "Textele scrise de cabinete (descrierile tratamentelor, biografiile medicilor) sunt afișate în limba în care le-a scris cabinetul, care poate fi diferită de limba paginii.",
    dates:
      "Câmpurile de dată folosesc selectorul de dată al browserului, a cărui accesibilitate variază între browsere și cititoare de ecran. Puteți oricând să tastați data.",
    maps: "Hărțile de pe paginile cabinetelor sunt doar un ajutor vizual: adresa este întotdeauna indicată ca text.",
    widget:
      "Când widgetul de programare este integrat pe site-ul propriu al unui cabinet, accesibilitatea paginii respective este responsabilitatea cabinetului.",
    messages: "Reamintirile prin SMS sunt text simplu și nu pot conține formatare; linkurile lor deschid pagini acoperite de această declarație.",
    exports: "Datele descărcate din centrul de confidențialitate (JSON, CSV) sunt fișiere care pot fi citite automat, nu documente destinate lecturii.",
    workaround: "Dacă oricare dintre acestea vă împiedică să vă programați, sunați la cabinet: numărul de telefon se află pe pagina sa și în formularul de programare.",
  },
  preparation: {
    title: "Cum a fost întocmită această declarație",
    body: "Această declarație a fost întocmită la {date} prin autoevaluare, pe baza verificărilor automate ale codului site-ului care rulează la fiecare modificare (etichete, mesaje de eroare, gestionarea focalizării, rapoarte de contrast). O verificare manuală doar cu tastatura și cu cititoare de ecran (NVDA cu Firefox pe Windows, VoiceOver cu Safari pe iOS) nu a fost încă finalizată; vom actualiza această declarație după finalizarea ei. Ultima revizuire: {reviewed}.",
  },
  feedback: {
    title: "Feedback și contact",
    body: "Dacă întâmpinați o barieră sau aveți nevoie de informații de pe acest site într-un alt format, scrieți la <mail>{email}</mail>. Indicați adresa paginii și ce s-a întâmplat. Vă vom răspunde în termen de 30 de zile.",
    noEmail:
      "Dacă întâmpinați o barieră sau aveți nevoie de informații de pe acest site într-un alt format, contactați-ne folosind datele din <link>nota de informare privind confidențialitatea</link>. Indicați adresa paginii și ce s-a întâmplat. Vă vom răspunde în termen de 30 de zile.",
  },
  enforcement: {
    title: "Procedura de asigurare a respectării",
    body: "Dacă nu sunteți mulțumit de răspunsul nostru sau nu primiți niciun răspuns în 30 de zile, puteți semnala situația către AgID (Agenzia per l'Italia Digitale), autoritatea care monitorizează accesibilitatea digitală în Italia, prin formularul de pe <link>form.agid.gov.it</link>.",
  },
} satisfies DeepPartial<Messages["accessibility"]>;
