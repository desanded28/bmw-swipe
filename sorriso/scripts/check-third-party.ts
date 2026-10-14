/**
 * Privacy check for the public pages: no third-party requests and no unexpected cookies (F9 rule 7).
 *
 *   npm run check:third-party
 *
 * To be implemented by WP6: fetch /, /it/search, /it/c/<demo>, /it/book/<demo>, /it/embed/<demo>
 * and a manage link from a running server, and fail if the HTML references any origin other than
 * its own (the OpenStreetMap URL inside the click-to-load map template is allowed) or a response
 * sets a cookie outside the allowed list. Until then this stub checks nothing and exits successfully.
 */

export {};

console.log("check:third-party: not implemented yet (WP6). Nothing was checked.");
process.exit(0);
