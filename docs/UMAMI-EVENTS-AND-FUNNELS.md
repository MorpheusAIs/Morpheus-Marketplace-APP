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
