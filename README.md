# Don't Go Missing Website

Static marketing, privacy, and support website for the Don't Go Missing iOS app.

This repository is only for the public website. It does not contain iOS app source code, Swift files, prototypes, backend code, build tooling, analytics, cookies, or tracking scripts.

## Site Structure

- `/` - Marketing landing page
- `/privacy` - Privacy Policy for App Store Connect
- `/contact` - Contact and support page for App Store Connect
- `/terms` - Redirects to Apple's Standard EULA
- `/404.html` - Branded not found page

## Tech

- Static HTML, CSS, and minimal nonessential JavaScript only
- No npm
- No build command
- No backend
- No serverless functions
- No analytics
- No cookies
- No Netlify Forms
- Mailto links only for support and data deletion requests

## Deployment Status

Netlify is not configured yet.

Hostinger DNS is not configured yet.

Email forwarding for `support@dontgomissing.com` is not configured yet.

## Manual Netlify Steps

1. Create a new Netlify site from `GreenGeezy/dont-go-missing-site`.
2. Leave the build command blank.
3. Use the repository root as the publish directory.
4. Add `dontgomissing.com` as the custom domain in Netlify.
5. Add the DNS records in Hostinger exactly as Netlify provides.
6. Wait for Netlify HTTPS to finish provisioning.
7. Verify `https://dontgomissing.com`, `https://dontgomissing.com/privacy`, and `https://dontgomissing.com/contact`.
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

1. Create or activate `support@dontgomissing.com` in Hostinger email or email forwarding.
2. Forward messages to the desired inbox.
3. Send a test message to `support@dontgomissing.com`.
4. Keep `Agcomsol@gmail.com` available as the fallback email until the support address is confirmed working.

## App Store Connect URLs

- Marketing URL: `https://dontgomissing.com/`
- Privacy Policy URL: `https://dontgomissing.com/privacy`
- Support URL: `https://dontgomissing.com/contact`
- EULA: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
