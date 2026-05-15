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

- Funnel `Inference API: signup and activation funnel`: `45adde0d-25f7-4367-9a64-81bd38922c97`.
- Journey `Inference API: product usage journey`: `3698ba48-a209-4d44-aeed-13d452b0f361`.
- Breakdown `Inference API: interaction breakdown`: `6ef7c162-37c8-4333-81d4-512d6ae42c7d`.
- Goal `Inference API: form submit goal`: `e4fa42b2-f7fa-4776-aebe-a2c0d594758c`.
- UTM `Inference API: UTM acquisition report`: `a1c071a8-3e7f-4bd3-9ccb-9f1f562529f3`.

## Coverage notes

- Source inventory found 261 link/button/action/form patterns across 43 TSX files.
- Root tracking covers all `a[href]`, `button`, `[role='button']`, `[data-umami-action]`, `[data-analytics-action]`, and form submits.
- No non-native clickable `div`, `span`, `li`, or card wrappers were found in the source inventory; custom UI action components render through button-like components and are captured by the root handler.
