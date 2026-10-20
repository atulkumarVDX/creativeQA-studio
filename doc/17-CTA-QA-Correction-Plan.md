# CTA QA correction plan

Source confirmed by the user: `preview/archive/turbo-preview-7.8.16.html`.
The user selected patch 7.8.19. The QA changes and authentic descriptor
regressions are implemented; release validation is recorded below.

## Problem reproduced against actual packages

The current Findings engine reports two high-confidence disappearance warnings
for working Ipsen 160×600 labels (`224443`, `215583`), one for the original
Tryptry Mobile Instream label (`188168`), and no CTA warning for the later
`label-notVisible.zip` button image (`187831`, `copy_new`).

All 13 existing `tests/qa-engine.test.mjs` tests pass. Its paragraph-text test
encodes the broad assumption; it is not a regression against the supplied
working Ipsen example or later Tryptry export.

## Planned findings

| Condition | Classification and card copy | Suggested Photoshop action |
| --- | --- | --- |
| An active CTA has a direct non-text image/Smart Object with an unsupported role name, such as `copy_new` | Warning: **“copy_new” will not be included in this button.** Supporting text: **The button export keeps text, frame, and background layers. This image is ignored.** | If it is background artwork, name the layer `background`. If it is the intended label, restore the lettering as a text layer inside the same button group. Renaming the supplied blank strip cannot restore lettering that is absent from its pixels. |
| A direct paragraph-text label in a supported Mobile Instream CTA, matching the observed failure class | Informational production review: **Verify this button label in Mobile Instream.** Supporting text: **A label with this text setup was missing in a published Mobile Instream creative. This check cannot confirm whether your label is affected.** | Check the published button. If its label is missing, convert the label to point text in Photoshop, retain the copy and styling, then re-export and verify production. The user reports this repair resolved the historical case. |
| Working Ipsen 160×600 paragraph-text labels | No disappearance finding based on paragraph text alone | No repair requested |

The production-review finding must not have a high-confidence defect status
or count as a critical issue. Its tooltip must explain both the matching
source signal and the limit of the evidence. Missing text transforms must
not be described as the proven cause.

## Basis and scope

Page 6 of the supplied PSD export guidelines specifies a text layer, `frame`,
and optional `background` within a CTA; other children are ignored. The
supplied plugin 1.0.10 independently rejects non-text children other than
supported frame/background names. The current preview Structure QA has an
LS-013 check for incorrectly named direct button images, but the Findings
engine does not surface it. This is a source-contract check and must use
matching CTA groups, rather than arbitrary layers whose names contain
“button”. Map buttons, JumpTo buttons, and logo actions have distinct roles.

Preserve documented generator suffixes and retina conventions when matching
role names. Respect excluded subtrees. Do not mistake saved hidden states
for excluded content. Do not report every button without live text as broken;
valid background artwork can contain lettering.

The Mobile Instream paragraph-text condition remains a review signal based
on observed failure and reported repair, not a universally proven omission
rule. The parsing document supplies descriptor examples, not a CTA omission
condition. The container, component bundle, and production loader consume
converted data and contain no Photoshop `textShape`/`textKey` eligibility
branch that establishes the original omission cause.

## Regression checks required for implementation

- Working Ipsen 160×600 labels must produce no disappearance warnings.
- Original Tryptry label `188168` must produce only the scoped production
  review, with evidence limits visible and no guaranteed disappearance claim.
- Later Tryptry `copy_new` (`187831`) must produce the ignored-layer warning
  at Mobile Instream / tab 1 / button `187413`.
- Working point-text labels `187427` and `187467` must stay clear.
- Text outside a CTA, valid backgrounds and their documented asset suffixes,
  map image buttons, JumpTo buttons, excluded subtrees, and logo actions must
  not trigger the new CTA checks.
- Duplicate copy in another tab or button must not satisfy the affected
  button's own label requirements.
- Run the QA engine suite, type checks, and application build after changes.

This plan changes findings and their evidence; it proposes no preview text
conversion or rendering modifications.

## Implementation

`structure.cta-ignored-image` now reports unsupported direct image/Smart Object
children in the main Findings engine. `rendering.cta-mobile-label-review`
replaces the broad paragraph-text warning with an informational review.
`copy.spacing` now checks only whitespace between visible characters, while
`copy.line-end-spacing` records trailing Photoshop padding as a low-priority
note. Findings with a layer ID can open the matching preview location and
temporarily highlight the rendered layer. The app imports
`preview/archive/turbo-preview-7.8.19.html`, with matching bridge and UI version
identifiers. 7.8.17 is preserved as the previous patch.

`tests/fixtures/cta-production-cases.json` contains minimal authentic
descriptors from the supplied packages. The targeted QA suite has 19 passing
tests, including the three production cases and profile exclusions. Type
checking and the production build pass.

## Release validation

- All 107 tests pass across QA engine, structure, screenshot logic, and teaser
  suites using Node 24.19.0. Type checking and the production build also pass.
- Running the new engine against each complete supplied export confirms:
  Ipsen has no CTA findings; original Tryptry has one informational review for
  layer `188168`; later Tryptry has one ignored-image warning for `187831`.
- The Ipsen export now produces line-end spacing notes instead of internal
  spacing findings. The cards mark the detected spaces and the preview bridge
  supports opening a finding at its matching rendered layer. No text rendering
  logic changed.
- The 7.8.16-to-7.8.15 byte comparison remains recorded above as the prior
  release validation; 7.8.19 keeps the findings-to-preview bridge and places a
  smaller compact play icon inline with each finding's location chips.
- The refreshed local app opens successfully. A final package-loaded visual
  check could not be completed: browser file staging was excessively slow,
  and native Codex file-picker access was blocked by the computer-use policy.
  Automated screenshot tests validate screenshot logic, not a fresh visual
  comparison of the published creative.

The original paragraph-text omission cause remains unconfirmed. This release
corrects the finding's scope and certainty; it does not claim a universal
prediction of production label visibility.
