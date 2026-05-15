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
- Custom UI action components render through button-like components or carry explicit `data-analytics-action` metadata, so the root handler captures the remaining programmatic actions that are not native links/forms.

## Session replay verification

- API check confirmed replay is enabled for website `9ee22931-b645-4df8-853c-5eba51bfa9e4` with `sampleRate: 0.15`, `maskLevel: moderate`, and `maxDuration: 300000`.
- Forced sampled browser QA on `http://localhost:3302/` loaded `script.js` and `recorder.js`, obtained an Umami session cache, and received `200 {"ok":true}` from `/api/record`.
- Replay list verification returned replay `c17aa698-dfc1-5731-8219-ac018be3944b` with session `c81d09a2-765e-54b9-912c-9212d2b5abd7`, `11` events, `1` chunk, and replay detail endpoint returned `11` playback events.

## Authenticated-flow QA notes

- Local environment contains Cognito configuration but no real test account credentials or reusable confirmed session. To exercise the protected client UI without collecting or inventing production credentials, browser QA used a fresh local-only Cognito-shaped JWT and mocked `/auth/me` plus `/keys` responses.
- Production-server browser QA on `http://localhost:3402/` loaded both `script.js` and `recorder.js` for website id `9ee22931-b645-4df8-853c-5eba51bfa9e4`.
- Protected-route QA confirmed Umami `/api/send` POST payloads for programmatic button destinations: `/test` emitted `button-click` with `action_name: go-to-api-keys` and `destination: /api-keys`; `/billing` emitted `button-click` with `action_name: open-pricing-docs` and `destination: https://apidocs.mor.org/documentation/models/pricing?utm_source=api-admin`; `/usage-analytics` emitted `button-click` with `action_name: export-usage-data` and `destination: /usage-analytics/export-data`.
- Focused billing QA on `http://localhost:3402/billing` clicked the Coinbase payment trigger and confirmation dialog. Umami `/api/send` received `button-click` payloads with `action_name: open-coinbase-payment-dialog`, `destination: /coinbase-checkout`, and `action_name: continue-to-payment`, `destination: /coinbase-checkout`.
- Focused notification CTA QA on `http://localhost:3402/test` used a local Cognito-shaped JWT plus mocked API responses to trigger the automation-disabled toast. Clicking `Go to Account` emitted an Umami `/api/send` `button-click` payload with `element_area: notification`, `action_name: notification-action`, `button_text: Go to Account`, `destination: /account`, and `link_domain: localhost`.
- Focused nav menu QA on the rebuilt `http://localhost:3402/test` production server clicked the desktop user menu `Account` and `Log out` actions. Umami `/api/send` received `button-click` payloads with `action_name: open-account`, `destination: /account`, and `action_name: logout`, `destination: /signin`.
- The protected `/usage-analytics/export-data` page redirects to `/signin` without reusable test credentials; focused production-server QA therefore verified the same annotated Back button payload shape through the running root tracker. Umami `/api/send` received `button-click` with `button_text: Back`, `action_name: history-back`, `element_area: main`, and `destination: history-back`.
- Focused semantic-destination QA on fresh local server `http://localhost:3502/signin` verified the root tracker after the destination parser fix. The page requested `script.js` and `recorder.js` from the Umami host with `200` responses, and injected DOM shapes matching the Radix `SelectItem` and billing success actions emitted `button-click` payloads with destinations preserved exactly as `chat-model-type:llm`, `test-model:qwen`, `billing-api-key-filter:all`, `transaction-type-filter:usage_charge`, and `/billing` with no `null` prefixes.
- Follow-up Oracle remediation annotated the default API key selector in `/api-keys` so default-key selection emits `button-click` payloads with `action_name: select-default-api-key` and semantic destinations such as `default-api-key:123`, while the read-only current-default item carries `view-default-api-key` metadata for consistent option attribution.
- Follow-up chat-model remediation annotated `ModelSelectorItem` options in both `/chat` and `/chat/[chatId]` so model choices emit `button-click` payloads with `action_name: select-chat-model` and semantic destinations such as `chat-model:qwen`.
- Final verification reran `pnpm run build` after the checkout/notification/history-back, Radix select annotation, billing success destination, and semantic-destination parser fixes; it completed successfully with the same pre-existing optional wallet dependency warnings from Wagmi/Reown connectors.
- Unauthenticated protected-route QA also opened `/api-keys?create=true`, verified the app redirects to `/signin`, and confirmed Umami sends `button-click`, `form-submit`, and `link-click-internal` events from the sign-in flow without collecting form values.
