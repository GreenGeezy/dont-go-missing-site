# Don't Go Missing Website

Static marketing, privacy, and support website for the Don't Go Missing iOS and Android apps.

This repository is only for the public website. It does not contain iOS app source code, Swift files, prototypes, backend code, build tooling, analytics, cookies, or tracking scripts.

## Site Structure

- `/` - Landing page (conversion page for the iPhone app)
- `/tools/` - Free tools index
- `/tools/trip-plan/` - Hiking Trip Plan Generator (`assets/trip-plan.js`)
- `/tools/hiking-time-calculator/` - Hiking Time and Turnaround Calculator (`assets/hike-time.js`)
- `/guides/` - Guides index
- `/guides/hiking-trip-plan/` - First guide
- `/privacy/` - Privacy Policy for App Store Connect and Google Play Console
- `/contact/` - Contact and support page for App Store Connect
- `/terms/` - Terms of Use for iOS and Android. The iOS app license is still Apple's Standard EULA, linked from this page and every footer
- `/404.html` - Branded not found page
- `sitemap.xml`, `robots.txt`, `llms.txt` - Crawl and AI-answer-engine files
- `_redirects`, `_headers` - Netlify redirects and response headers

All page URLs end with a trailing slash. Netlify redirects the no-slash form, so canonicals, the sitemap and internal links must always use the trailing slash.

## Adding a guide

1. Copy `guides/hiking-trip-plan/index.html` to `guides/<slug>/index.html`.
2. Update the title, meta description, canonical, Open Graph tags, dates and all JSON-LD.
3. Open with a two-to-three sentence direct answer in an `.answer-box`, use question-style H2s, and keep FAQ JSON-LD identical to the visible FAQ text.
4. Add a card to `guides/index.html`, a line to `llms.txt`, and a `<url>` to `sitemap.xml`.
5. Link to at least one tool and the App Store.

## Before 1.1 ships

The landing page describes app version 1.1. The `.release-note` paragraph in the hero of `index.html` says so. Remove that paragraph once 1.1 is live on the App Store. If the price changes, update the pricing section, the FAQ answer, the JSON-LD offers, `terms/index.html` and `llms.txt`.

## When the Google Play listing goes live

The site says the Android app is "launching" on Google Play. Once the listing is public, update the `.release-note` in `index.html`, the "iPhone and Android" FAQ answer (visible text and JSON-LD), and the Android line in `llms.txt`.

## Tech

- Static HTML and CSS. JavaScript is used only by the two tools.
- No npm, no build command, no backend, no serverless functions
- No analytics, no cookies, no tracking scripts, no external requests
- The trip plan tool stores its draft in the visitor's own browser (localStorage) and sends nothing
- Mailto links only for support and data deletion requests

## Deployment Status

The site is deployed on Netlify from the `main` branch at https://dontgomissing.com. Pushing to `main` publishes.

The public support email is `dontgomissingapp@gmail.com`.

## Manual Netlify Steps

1. Create a new Netlify site from `GreenGeezy/dont-go-missing-site`.
2. Leave the build command blank.
3. Use the repository root as the publish directory.
4. Add `dontgomissing.com` as the custom domain in Netlify.
5. Add the DNS records in Hostinger exactly as Netlify provides.
6. Wait for Netlify HTTPS to finish provisioning.
7. Verify `https://dontgomissing.com`, `https://dontgomissing.com/privacy/`, and `https://dontgomissing.com/contact/`.
8. Then update App Store Connect and the iOS app configuration.

## Manual Hostinger DNS Steps

1. Open Hostinger DNS settings for `dontgomissing.com`.
2. In Netlify, open Domain management for the new site.
3. Copy the exact DNS records Netlify provides.
4. Add those records in Hostinger.
5. Remove conflicting default parking records if Netlify instructs you to.
6. Wait for DNS propagation.
7. Confirm Netlify shows HTTPS as active.

## Manual Email Forwarding Steps

1. Confirm `dontgomissingapp@gmail.com` is monitored for app support, data deletion requests, and feedback.
2. Send a test message to `dontgomissingapp@gmail.com`.
3. If a branded domain email is added later, update the website copy and mailto links before using it publicly.

## App Store Connect URLs

- Marketing URL: `https://dontgomissing.com/`
- Privacy Policy URL: `https://dontgomissing.com/privacy/`
- Support URL: `https://dontgomissing.com/contact/`
- EULA: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`

## Google Play Console URLs

- Website: `https://dontgomissing.com/`
- Privacy Policy URL: `https://dontgomissing.com/privacy/`
- Data deletion URL: `https://dontgomissing.com/privacy/#data-deletion`
- Terms of Use: `https://dontgomissing.com/terms/`
