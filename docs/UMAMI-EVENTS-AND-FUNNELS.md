# Umami events and funnels

This app uses the root `UmamiInteractionTracker` to capture clicks and submits without storing form values or user-entered text.

## Events

- `link-click-internal`: internal app navigation clicks.
- `link-click-external`: outbound link clicks.
- `button-click`: buttons, role-buttons, and annotated actions.
- `form-submit`: form submissions.

Shared properties: `current_path`, `page_title`, `page_section`, and `element_area`. Link events also include `link_text`, `destination`, and `link_domain`. Button events include `button_text` and `action_name`.

## Recommended reports

- Signup funnel: path `/signin` or `/signup` → event `button-click` for auth actions → path `/api-keys` or `/chat`.
- API key activation funnel: path `/api-keys` → event `button-click` for create/verify actions → path `/test` or `/chat`.
- Billing funnel: path `/billing` → pricing/funding button clicks → payment-related external or internal destinations.
- Product usage journey: path `/chat` → prompt/action button clicks → account, billing, or API key navigation.

## Saved Umami reports

- Funnel `Inference API: signup and activation funnel`: `45adde0d-25f7-4367-9a64-81bd38922c97` (`type: funnel`, steps: path `/signin` → event `form-submit` → event `button-click`, 30-minute window).
- Journey `Inference API: product usage journey`: `3698ba48-a209-4d44-aeed-13d452b0f361`.
- Breakdown `Inference API: interaction breakdown`: `6ef7c162-37c8-4333-81d4-512d6ae42c7d`.
- Goal `Inference API: form submit goal`: `e4fa42b2-f7fa-4776-aebe-a2c0d594758c`.
- UTM `Inference API: UTM acquisition report`: `a1c071a8-3e7f-4bd3-9ccb-9f1f562529f3`.

## Coverage notes

- Source inventory found 261 link/button/action/form patterns across 43 TSX files.
- Root tracking covers all `a[href]`, `button`, `[role='button']`, `[data-umami-action]`, `[data-analytics-action]`, and form submits.
- No non-native clickable `div`, `span`, `li`, or card wrappers were found in the source inventory; custom UI action components render through button-like components and are captured by the root handler.

## Session replay verification

- API check confirmed replay is enabled for website `9ee22931-b645-4df8-853c-5eba51bfa9e4` with `sampleRate: 0.15`, `maskLevel: moderate`, and `maxDuration: 300000`.
- Forced sampled browser QA on `http://localhost:3302/` loaded `script.js` and `recorder.js`, obtained an Umami session cache, and received `200 {"ok":true}` from `/api/record`.
- Replay list verification returned replay `c17aa698-dfc1-5731-8219-ac018be3944b` with session `c81d09a2-765e-54b9-912c-9212d2b5abd7`, `11` events, `1` chunk, and replay detail endpoint returned `11` playback events.

## Authenticated-flow QA notes

- Local environment contains Cognito configuration but no test account credentials or reusable confirmed session, so fully authenticated API-key/chat/billing flows could not be exercised without creating or receiving a real account.
- Unauthenticated protected-route QA opened `/api-keys?create=true`, verified the app redirects to `/signin`, and confirmed Umami sends `button-click`, `form-submit`, and `link-click-internal` events from the sign-in flow without collecting form values.
