/**
 * Polish review moderation messages. Discreet: no treatment, review text or health details.
 * SMS: straight quotes only, short. Dates follow a colon.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  moderationRequestHidden: {
    subject: "Opinia o gabinecie {practice} została zgłoszona",
    body:
      "Opinia o gabinecie {practice} została zgłoszona moderatorom Sorriso i jest ukryta na czas sprawdzania. Termin na przedstawienie swojego stanowiska: {date}; zapoznamy się z nim przed podjęciem decyzji. Opinię można też usunąć.",
    cta: "Odpowiedz moderatorom",
    sms: "Sorriso: opinia o gabinecie {practice} została zgłoszona. Odpowiedź do: {date}: {url}",
  },
  moderationRequestVisible: {
    subject: "Opinia o gabinecie {practice} została zgłoszona",
    body:
      "Opinia o gabinecie {practice} została zgłoszona moderatorom Sorriso. Pozostaje opublikowana na czas sprawdzania. Termin na przedstawienie swojego stanowiska: {date}; zapoznamy się z nim przed podjęciem decyzji. Opinię można też usunąć.",
    cta: "Odpowiedz moderatorom",
    sms: "Sorriso: opinia o gabinecie {practice} została zgłoszona. Odpowiedź do: {date}: {url}",
  },
  decisionKept: {
    subject: "Opinia o gabinecie {practice}: decyzja",
    body:
      "Moderatorzy Sorriso rozpatrzyli zgłoszenie dotyczące opinii o gabinecie {practice} i zdecydowali o jej pozostawieniu. Uzasadnienie: {reason}",
    cta: "Zobacz decyzję",
    sms: "Sorriso: opinia o gabinecie {practice} pozostaje opublikowana. Szczegóły: {url}",
  },
  decisionRemoved: {
    subject: "Opinia o gabinecie {practice}: decyzja",
    body:
      "Moderatorzy Sorriso zdecydowali o usunięciu opinii o gabinecie {practice}. Uzasadnienie: {reason} W razie braku zgody można złożyć jedno odwołanie, termin: {date}; można też zwrócić się do certyfikowanego organu pozasądowego rozstrzygania sporów lub do sądu.",
    cta: "Zobacz decyzję lub odwołaj się",
    sms: "Sorriso: opinia o gabinecie {practice} została usunięta. Uzasadnienie i odwołanie: {url}",
  },
  finalKept: {
    subject: "Opinia o gabinecie {practice}: decyzja w sprawie odwołania",
    body:
      "Inny moderator rozpatrzył odwołanie dotyczące opinii o gabinecie {practice} i zdecydował o jej pozostawieniu. Uzasadnienie: {reason} Ta decyzja jest w Sorriso ostateczna.",
    cta: "Zobacz decyzję",
    sms: "Sorriso: po odwołaniu opinia o gabinecie {practice} pozostaje opublikowana. Szczegóły: {url}",
  },
  finalRemoved: {
    subject: "Opinia o gabinecie {practice}: decyzja w sprawie odwołania",
    body:
      "Inny moderator rozpatrzył odwołanie dotyczące opinii o gabinecie {practice} i zdecydował o jej usunięciu. Uzasadnienie: {reason} Ta decyzja jest w Sorriso ostateczna; nadal można zwrócić się do certyfikowanego organu pozasądowego rozstrzygania sporów lub do sądu.",
    cta: "Zobacz decyzję",
    sms: "Sorriso: po odwołaniu opinia o gabinecie {practice} została usunięta. Szczegóły: {url}",
  },
  heldPublished: {
    subject: "Opinia o gabinecie {practice} została opublikowana",
    body: "Moderator sprawdził opinię o gabinecie {practice} i ją opublikował. Dziękujemy za pomoc innym pacjentom.",
    sms: "Sorriso: opinia o gabinecie {practice} została opublikowana. Dziękujemy!",
  },
  heldRemoved: {
    subject: "Opinia o gabinecie {practice} nie została opublikowana",
    body:
      "Moderator sprawdził opinię o gabinecie {practice} i jej nie opublikował. Uzasadnienie: {reason} W razie braku zgody można złożyć jedno odwołanie, termin: {date}.",
    cta: "Zobacz decyzję lub odwołaj się",
    sms: "Sorriso: opinia o gabinecie {practice} nie została opublikowana. Uzasadnienie i odwołanie: {url}",
  },
  practice: {
    keptSubject: "Zgłoszenie opinii: decyzja (pozostawiona)",
    keptBody:
      "Moderatorzy Sorriso rozpatrzyli zgłoszenie dotyczące opinii o gabinecie {practice} i zdecydowali o jej pozostawieniu. Uzasadnienie: {reason}",
    removedSubject: "Zgłoszenie opinii: decyzja (usunięta)",
    removedBody:
      "Moderatorzy Sorriso rozpatrzyli zgłoszenie dotyczące opinii o gabinecie {practice} i zdecydowali o jej usunięciu. Uzasadnienie: {reason}",
    appeal: "Jedno odwołanie można złożyć na stronie Opinie w panelu. Następnie można zwrócić się do certyfikowanego organu pozasądowego rozstrzygania sporów lub do sądu.",
    final: "Była to decyzja w sprawie odwołania i jest w Sorriso ostateczna. Nadal można zwrócić się do certyfikowanego organu pozasądowego rozstrzygania sporów lub do sądu.",
    authorMayAppeal: "Autor opinii może jeden raz odwołać się od tej decyzji; w takim przypadku decyzję podejmie inny moderator, a wynik prześlemy e-mailem.",
    open: "Otwórz stronę Opinie",
    footer: "Moderacja Sorriso · ta wiadomość została wysłana, ponieważ gabinet zgłosił opinię.",
  },
  notice: {
    receivedSubject: "Otrzymaliśmy zgłoszenie dotyczące opinii",
    receivedBody: "Dziękujemy: otrzymaliśmy zgłoszenie dotyczące opinii o gabinecie {practice}. Moderator podejmie decyzję bez zbędnej zwłoki i prześle wynik e-mailem.",
    decisionSubject: "Zgłoszenie dotyczące opinii: decyzja",
    keptBody: "Sprawdziliśmy zgłoszoną opinię o gabinecie {practice} i zdecydowaliśmy o jej pozostawieniu. Uzasadnienie: {reason}",
    removedBody: "Sprawdziliśmy zgłoszoną opinię o gabinecie {practice} i usunęliśmy ją. Uzasadnienie: {reason}",
    redress: "W razie braku zgody można zwrócić się do certyfikowanego organu pozasądowego rozstrzygania sporów lub do sądu.",
    footer: "Moderacja Sorriso · ta wiadomość została wysłana, ponieważ zgłoszono opinię.",
  },
  detailsReview: "Opinia",
  detailsGround: "Zgłoszony powód",
  detailsDecision: "Decyzja",
} satisfies DeepPartial<Messages["reviewEmails"]>;
