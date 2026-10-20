# CTA label warning investigation — 2026-10-10

Current preview source confirmed by the user: `preview/archive/turbo-preview-7.8.15.html`.
This is an investigation record, not an implementation or a replacement QA rule.

## Confirmed evidence

The current `rendering.cta-paragraph-text` rule in `lib/qa-engine.ts` emits a
high-confidence warning for a text layer with `textShape[0].char._value = box`
directly inside a button group. It does not examine production output or the
ad format. Paragraph text alone therefore does not establish label omission.

| Package and exact instance | Exported structure | Production evidence |
| --- | --- | --- |
| Ipsen `design.psd.zip`, 160×600 labels `224443` and `215583` | Both are box text with a top-level text transform | User supplied production screenshots show both labels. Live DOM inspection in this pass also found both labels inside their button groups, owners `224444` and `215584`. This contradicts treating box text as sufficient evidence of omission. |
| Original `tryptryDTC.psd.zip`, Mobile Instream tab 1 `CanvasDesign > button1` (`187413`) | Direct label `188168`, `DISCOVER THE DIFFERENCE`, is box text without a top-level text transform; `frame` is `187411` | User supplied production screenshot shows an empty CTA. The descriptor difference is a correlation; its causal role is unproven. |
| Later `label-notVisible.zip`, same button `187413` | Direct children are non-text `copy_new` (`187831`) and `frame` (`187411`). There is no direct text label. The exported `copy_new-187831.png` was visually inspected and is a solid blue strip without lettering. | The current supplied showcase was opened and its Mobile Instream CTA `187413` has no label child in the DOM. The live publication has not been proven to originate from this exact ZIP revision. |

Both Tryptry ZIPs retain working point-text labels inside Mobile Instream tab 2
button `187428` (`WATCH VIDEO`, layer `187427`) and tab 3 button `187468`
(`DISCOVER THE DIFFERENCE`, layer `187467`). The live production DOM contains
text children for these two buttons. The text elsewhere in a package does not
establish that button `187413` has a label.

## Source evidence and its limits

Page 6 of the supplied PSD export guidelines explicitly states that button
folders retain a text layer, `frame`, and optional `background`; other
children are ignored. This independently supports the `copy_new` omission
mechanism in the later ZIP, beyond the plugin's validation message. The
current preview also checks incorrectly named direct button images under
LS-013 in Structure QA; the Findings engine does not integrate that check.

The supplied `vdx-container-turbo.js`, version 3.13.8-0, creates children from
the supplied `objects` list and chooses `VDXText` for objects of type `text`.
It contains no `textKey`, `textShape`, or Photoshop transform eligibility
check. It is a browser runtime consuming converted objects, rather than the
source that determines which PSD children become those objects. Its
`syncTextWithPsd` function works on existing text spans; it cannot explain a
missing label object by itself.

The supplied `vdx-components-turbo.js`, version 3.13.11-8, likewise contains
no Photoshop `textKey` or `textShape` handling. These sources do not establish
that missing transforms cause CTA labels to be omitted.

The supplied Photoshop plugin 1.0.10 has a button validator that permits
text layers and named `background`, `frame`, `background 2x`, or
`background 2xl` layers; it rejects other non-text children and more than one
text child. It does not require a text child and does not reject box text.
Thus `copy_new` is an unsupported button child under that validator, but
absence of live text alone is not a universal error: approved lettering may
be baked into a supported image.

## Live inspection

Showcase: `https://showcase.vdx.tv/cc/k/0/#odiYzA/7`.

The DOM of Mobile Instream button `187413` is an empty `div` with a cyan
background and no text child. Buttons `187428` and `187468` have generated
`button1-text` children containing their expected copy. This confirms
absence of rendered text for the affected instance, rather than merely a
font-color or visibility problem.

Comparison showcase: `https://showcase.vdx.tv/Ipsen/#zYnh6A/12`.
Its 160×600 production DOM contains `button1-text` children with
`Discover assessment criteria` and `Get Fatigue\nAssessment Tool` inside
buttons `215584` and `224444`, respectively. These correspond to the two
flagged box-text labels in the supplied Ipsen export.

The showcase now references publication branch `k`. Both the previously
provided branch `l` and the observed branch `k` designer-config URLs returned
HTTP 404 when requested directly. The creative still loaded through the
showcase. The converted input configuration was not recovered in this pass.

## Consequences for implementation

### Historical repair evidence supplied by the user

The user supplied a screenshot of an earlier investigation describing
`mobile-instream > tabComponent > tab1 > CanvasDesign > button1 > DISCOVER THE DIFFERENCE`
as box text and recommending conversion to point text, preservation of the
button ownership and typography, then re-export and republication. The user
reports that this investigation helped resolve the case.

This is useful user-reported repair evidence supporting text setup as a
factor in that Mobile Instream failure. The screenshot's explanation that
the production renderer drops box text remains a historical interpretation,
not an inspected conversion branch. The screenshot's described text child
matches the original `tryptryDTC.psd.zip` structure; the currently supplied
`label-notVisible.zip` has `copy_new` instead. A historical filename does not
establish that these exports contain the same revision.

Box text inside a Mobile Instream CTA is therefore a candidate signal for
further validation, with a reported successful point-text repair. It does
not justify applying the disappearance warning to Ipsen 160×600 or every
button in every format. A matched before/after publication and export would
establish the repair more strongly; conversion source is needed to explain
the actual omission condition.

1. Do not retain a high-confidence disappearance claim based on box text alone.
2. Do not replace it with a causal claim based on missing transforms without
   evidence from the PSD-to-production conversion stage.
3. Keep the original and later Tryptry exports as separate regression cases.
4. A button-child contract check can be justified from the plugin validator,
   but its message should describe the unsupported layer, not promise that
   the label will disappear.
5. A reliable disappearance finding should compare the expected label of the
   exact button instance with production conversion output, allowing supported
   image-based labels. Format, tab, slide, and button identity must match.

The root-cause statement and universal box-text warning recorded in TR-004
of `06-Text-Render-Issue-Catalog.md` are superseded by the evidence limits in
this investigation. No QA or preview-rendering changes were made in this pass.

## QA reproduction and proposed correction

The current engine was executed against the supplied exports: Ipsen produces
two CTA disappearance warnings (`224443`, `215583`); original Tryptry produces
one (`188168`); the later ZIP produces none. A direct-child contract scan finds
only the later ZIP's `copy_new` image (`187831`) among these packages.
All 13 existing QA engine tests pass despite these deficiencies.

The concrete correction and regression requirements are recorded in
`17-CTA-QA-Correction-Plan.md`. Production runtime code was inspected further:
the supplied `creative.js` is a loader/consumer, with no Photoshop text
descriptors. The public showcase metadata endpoint was located and retrieved;
it confirms revision `k`, variation `0`, media `14179060`, but supplies metadata
rather than the PSD conversion source or button text configuration.
