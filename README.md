# Mike's Pumpkin Patch

A responsive, rustic redesign using only HTML, CSS, and client-side JavaScript. No framework, build process, backend, or dependencies are required.

## Preview

Open `index.html` in a browser, or serve the directory locally:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then visit `http://127.0.0.1:8000`.

## Publish

Upload `index.html`, `styles.css`, `script.js`, and the `assets` directory to any static web host. The current WordPress installation is not changed by this local redesign.

## Content and maintenance

- The site status is maintained as closed for the season, with visitors invited back in fall 2027.
- Listed prices: general admission $15 for ages 2–79, free for ages 1 and under and 80+, active military with ID $10, season pass $40, and private-party group admission $15 per person (minimum 12; includes a mini pumpkin and water each). Pumpkins are $1 per pound ($2 minimum). The source site lists several extras but does not publish their individual prices; visitors are directed to call for current details.
- Address, phone, email, activity information, driving directions, and field-trip information were taken from the existing Mike's Pumpkin Patch website. Confirm seasonal activity availability before publishing.
- The displayed photographs now come from the original website's media library and show the ranch itself, rather than stock scenes. They depict previous seasons; they do not promise a particular 2026 maze layout. Confirm photo permissions, including recognizable visitors, before publishing.
- New photo sources (all under `https://mikespumpkinpatch.com/wp-content/uploads/`): `pumpkins-scaled.jpg`, `pumpkins-and-kids-scaled.jpg`, `maze-1-scaled.jpg`, `maze-above.jpg`, `goats-scaled-e1759951443644.jpg`, `8-1.jpg`, and `pillow-bouncer.png`. Where available, the site's 1024-pixel variants are used to reduce download size.
- Gallery photos link directly to the local image for a larger view and work without JavaScript. A Google Maps link lets visitors browse additional photos there; third-party Maps photos are not downloaded or republished.
- The header and footer use the original Mike's Pumpkin Patch logo, unchanged. The favicon also comes from the existing site.
- Google Fonts provides optional Fraunces and DM Sans fonts. System serif and sans-serif fallbacks are supplied if fonts cannot load. All other assets are local.
- Field-trip and contact links open the visitor's email application. There is no simulated booking or contact submission, no payment processing, and no server-side form.
- The menu and activity filters use `script.js`. All activities, navigation links, and native FAQ disclosures remain available without JavaScript.
- A decorative falling-leaves effect is added by `script.js`. It is hidden from assistive technology, never intercepts clicks, is skipped entirely when the visitor prefers reduced motion, and disappears gracefully without JavaScript.
- Original background music is offered in an accessible first-load prompt. Playback starts only after the visitor opts in; a small toggle remains available to pause or resume it.
- The Arcade is a static, client-side section at `arcade/` with faithful browser recreations of the provided Patch Man and Pumpkin Blaster games, including their maze, enemy behaviors, scoring, stages, and rescue mechanics. Each game page uses its captured gameplay image for previews and sharing. Controls work with keyboard, touch, and gamepads; no framework, backend, or plug-in is required.
- The footer year updates automatically. The season announcement is intentionally maintained separately.

## Accessibility

Includes semantic sections, descriptive photo alternatives, a skip link, visible keyboard focus, native disclosure controls, accessible menu/filter states, and reduced-motion support.
