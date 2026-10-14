/**
 * English source for the analytics namespace. Owned by WP2 (dashboard): /dashboard/analytics,
 * its charts and the CSV export (src/lib/analytics.ts).
 */
import { p } from "../../plural";

export default {
  title: "Analytics",
  description: "Computed on our servers from your practice's own data when you open this page. No cookies, no tracking.",
  range: {
    label: "Period",
    months: p({ one: "Last {count} month", other: "Last {count} months" }),
    window: "{from} – {to}",
  },
  export: "Download CSV",
  exportHint: "The same figures as on this page, for a spreadsheet.",
  dimension: {
    label: "Break down by",
    service: "Treatment",
    practitioner: "Practitioner",
    weekday: "Weekday",
    partOfDay: "Time of day",
  },
  showTable: "Show as a table",
  noData: "Not enough data in this period yet.",
  none: "–",

  kpi: {
    noShow: "No-show rate",
    noShowHint: "{noShows} no-shows in {visits} visits",
    lateCancel: "Late cancellations",
    lateCancelHint: "Cancelled by the patient less than {hours} hours before",
    confirmation: "Confirmed after a reminder",
    confirmationHint: "{confirmed} of {sent} reminders asking to confirm",
    waitlist: "Waitlist fill rate",
    waitlistHint: "{booked} booked of {closed} closed entries",
    recalls: "Recall conversion",
    recallsHint: "{booked} booked of {contacted} patients recalled",
    leadTime: "Median booking lead time",
    leadTimeValue: p({ one: "{count} day", other: "{count} days" }),
    leadTimeHint: p({ one: "Over {count} booking", other: "Over {count} bookings" }),
  },

  sections: {
    outcomesTotal: "Attendance",
    attendance: "Attendance",
    attendanceHint:
      "No-show rate: no-shows out of visits that took place or were missed. Late cancellations: cancelled by the patient within the practice's cancellation deadline, out of the same visits plus those cancellations.",
    byService: "By treatment",
    byPractitioner: "By practitioner",
    byWeekday: "By weekday",
    byPartOfDay: "By time of day",
    noShowChart: "No-show rate",
    lateCancelChart: "Late cancellation rate",
    confirmation: "Confirmations",
    confirmationHint:
      "Each confirmation counts for the last reminder sent before it. Confirmations taken by the front desk or at booking are not counted.",
    confirmationByChannel: "Confirmation rate by channel",
    confirmationByOffset: "Confirmation rate by reminder timing",
    waitlist: "Waitlist",
    waitlistDetail: "{entries} entries · {booked} booked · {removed} removed · {expired} expired · {waiting} still waiting",
    recalls: "Recalls",
    recallsDetail: "{due} recalls came due · {contacted} patients contacted · {booked} booked",
    bookings: "Bookings",
    leadTime: "How far ahead patients book",
    newBySource: "New patients by booking channel",
    newByContext: "New patients: practice channels or Sorriso",
    reviews: "Published reviews",
    reviewsHint: "Only reviews that are published on your profile are counted.",
    reviewsSummary: p({ one: "{count} review, average {average}", other: "{count} reviews, average {average}" }),
    funnel: "Marketplace funnel",
    funnelHint: "Appearances in Sorriso search results and views of your practitioners' profiles, against bookings started on Sorriso.",
    ranking: "Your ranking inputs",
    rankingHint:
      "What Sorriso's marketplace ranking knows about each practitioner today, and the score it gives with no search-specific factors (distance, city, language, health fund). Nobody can pay for a higher position.",
    rankingLink: "How ranking works",
  },

  measures: {
    noShowRate: "No-show rate (%)",
    lateCancelRate: "Late cancellation rate (%)",
    confirmationRate: "Confirmation rate (%)",
    fillRate: "Fill rate (%)",
    entries: "Entries",
    recallConversion: "Recall conversion (%)",
    recallsDue: "Recalls due",
    medianDays: "Median lead time (days)",
    bookings: "Bookings",
    newPatients: "New patients",
    reviews: "Reviews",
    averageRating: "Average rating",
    impressions: "Search appearances",
    profileViews: "Profile views",
    marketplaceBookings: "Bookings on Sorriso",
    bookingRate: "Bookings per profile view (%)",
    score: "Ranking score (0-100)",
    staffCancelRate: "Cancelled by the practice, 180 days (%)",
    completeness: "Profile completeness (%)",
  },

  table: {
    item: "Item",
    visits: "Visits",
    noShows: "No-shows",
    lateCancels: "Late cancellations",
    noShowRate: "No-show rate",
    lateCancelRate: "Late cancellation rate",
    sent: "Reminders sent",
    confirmed: "Confirmed",
    rate: "Rate",
    count: "Count",
    month: "Month",
    average: "Average rating",
  },

  partsOfDay: {
    morning: "Morning (before 13:00)",
    afternoon: "Afternoon (13:00–18:00)",
    evening: "Evening (from 18:00)",
  },

  offsets: {
    h3: "Up to 3 hours before",
    h12: "3 to 12 hours before",
    d1: "About a day before",
    d2: "About two days before",
    d3: "Three days or more before",
  },

  leadBuckets: {
    sameDay: "Within 24 hours",
    d2: "1–2 days",
    d7: "3–7 days",
    d14: "8–14 days",
    d30: "15–30 days",
    more: "More than 30 days",
  },

  sources: {
    online: "Online booking page",
    widget: "Website widget",
    api: "Partner software",
    staff: "Front desk",
    waitlist: "Waitlist",
  },

  contexts: {
    practice: "Practice channels",
    marketplace: "Sorriso marketplace",
  },

  funnel: {
    impressions: "Search appearances",
    views: "Profile views",
    bookings: "Bookings on Sorriso",
    viewRate: "{value} of appearances led to a profile view",
    bookingRate: "{value} of profile views led to a booking",
  },

  ranking: {
    practitioner: "Practitioner",
    score: "Score",
    soonest: "Soonest free slot",
    noSlot: "None in the next 14 days",
    rating: "Reviews",
    ratingValue: p({ one: "{average} ({count} review)", other: "{average} ({count} reviews)" }),
    noReviews: "No reviews yet",
    cancellations: "Cancelled by the practice",
    cancellationsValue: "{value} (180 days)",
    completeness: "Profile",
    reasons: "Lifted by",
    noReasons: "Nothing stands out yet",
    reasonLabels: {
      soonest: "Free slots soon",
      rating: "Verified reviews",
      reliability: "Rarely cancels",
      completeness: "Complete profile",
      distance: "Close to the search",
      language: "Spoken language",
      fund: "Health fund",
    },
    globalMean: "Platform average rating used for the weighting: {value}",
    empty: "No active practitioners yet.",
  },

  chart: {
    bar: "{label}: {value}",
    column: "{label}: {value}",
  },

  csv: {
    filename: "analytics",
    section: "Section",
    item: "Item",
    measure: "Measure",
    value: "Value",
    numerator: "Numerator",
    denominator: "Denominator",
    all: "All",
  },

  forbidden: "You don't have permission to see the practice's analytics.",
} as const;
