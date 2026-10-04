# CrewBarn Easy theme kit (v1)

The work dashboard can be themed without changing API calls, permission checks,
forms or financial actions. This first version is a **build-time CSS token kit**,
not a theme marketplace, runtime code loader or arbitrary stylesheet uploader.

## Start here

1. Choose **Easy · Side bar** or **Easy · Top bar** in Appearance.
2. For everyday preferences, use the existing Appearance controls for accent,
   navigation color, font and text scale.
3. For a branded open-source build, edit src/themes/easy-theme.css.
4. Run npm run build, then preview and deploy your build normally.

The token file is imported by the work shell and is included in generated
open-source builds. Defaults reproduce the existing Easy shared components.
Classic, Pro, Rail, Connect, and customer/employee portals are not targeted.

## Example: navy, less-rounded cards

Change these values inside the existing scoped rule in easy-theme.css:

~~~css
--easy-heading-bg: #0f1a2e;
--easy-heading-text: #ffffff;
--easy-heading-muted: #cbd5e1;
--easy-card-radius: 10px;
~~~

The selected accent still controls highlights and focus rings. Avoid changing
success/error status colors to match branding: users rely on their meaning.

## Supported tokens

| Tokens | Used by |
| --- | --- |
| --easy-page-bg | Easy work-area background |
| --easy-surface, --easy-border | Shared cards and section navigation |
| --easy-text, --easy-muted | Shared action cards and section links |
| --easy-heading-bg, --easy-heading-text, --easy-heading-muted | Shared Easy page headings |
| --easy-card-radius, --easy-card-shadow | Shared cards; radius also applies to headings |
| --easy-search-bg | Search inputs in the Easy work area |
| --easy-focus | Keyboard focus in the Easy work area and section navigation |
| --easy-selected-bg, --easy-selected-border | Selected action cards and active section underline |

This is not a full dark-mode system. Individual legacy pages still have local
colors, charts, maps and specialized controls. Only the hooks above are covered;
do not assume changing these tokens restyles every screen.

## Safety and maintenance

- Keep text contrast at least 4.5:1 for normal text (3:1 for large text).
  Test actual color pairs with your chosen accent, including focused states.
- Test at phone and desktop widths, keyboard-only navigation, long names,
  empty/loading/error states, dialogs, printing, and both Easy layouts.
- Never hide actions, validation messages, status indicators or focus outlines
  to achieve a visual effect.
- A theme is presentation, not authorization. Do not edit permission checks,
  tokens, endpoints, payment handlers or confirmation flows to customize it.
- Do not include secrets, external stylesheets, remote fonts or scripts in a theme.
  Review third-party CSS before building it; CSS is not a security sandbox.
- Keep your customization as a small commit in your own fork/branch. Upstream
  generated releases can overwrite files; reapply/rebase your theme commit,
  resolve conflicts, rebuild and retest after updating. There is no automatic
  preservation or compatibility guarantee across future theme-kit versions.

## Adding a shared component

Use an explicit data-easy-* presentation hook and the scoped variables with a
fallback. Keep page state and callbacks in the existing page. Do not build a
parallel implementation of saving, messaging or billing for the themed version.
