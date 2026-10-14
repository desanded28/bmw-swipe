/**
 * English source for the a11y namespace: texts that exist only for assistive technology (skip
 * link, landmark names, screen-reader-only words). Owned by WP1 (public site); loaded on every
 * public page by the [locale] layout, so any package may read it.
 */
export default {
  skipToContent: "Skip to main content",
  nav: {
    main: "Main",
    footer: "Footer",
    legal: "Legal information",
    patients: "For patients",
    practices: "For practices",
  },
  language: {
    /** The switcher's button: the current language is named in its own language next to it. */
    label: "Language",
    current: "Language: {language}",
    choose: "Change language",
  },
  home: "{app} home page",
  opensInNewTab: "(opens in a new tab)",
  close: "Close",
  loading: "Loading…",
  completed: "completed",
  rating: {
    /** Stars: the rating as a screen reader reads it. {rating} is formatted, e.g. "4,5". */
    stars: "Rated {rating} out of 5",
  },
} as const;
