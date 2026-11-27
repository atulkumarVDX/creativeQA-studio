import type { Finding } from "@/lib/qa-engine";

type FindingDraft = Omit<Finding, "id" | "category" | "suggestedFix" | "reason">;

function findingGuidance(ruleId: string, title: string, message: string) {
  if (ruleId.startsWith("assets.")) return { category: "Assets", suggestedFix: "Add the missing file to the package, then reopen the ZIP and check the preview." };
  if (ruleId.startsWith("consistency.")) return { category: "Consistency", suggestedFix: "Compare this size with the others in the same tab. Add or update the element if the difference is not intentional." };
  if (ruleId.includes("optical-kerning")) return { category: "Typography", suggestedFix: "In Photoshop, change the text to Metrics kerning. Check the preview and adjust the spacing if needed." };
  if (ruleId.includes("trademark")) return { category: "Typography", suggestedFix: "In Photoshop, use Superscript or adjust the mark to match the approved design, then check it at the final display size." };
  if (ruleId === "structure.cta-ignored-image") return { category: "Assets", suggestedFix: "In Photoshop, name button artwork background. If this is the label, restore the lettering as a text layer inside the button group. Re-export and check the published button." };
  if (ruleId === "rendering.cta-mobile-label-review") return { category: "Browser compatibility", suggestedFix: "If the label is missing in production, convert it to point text in Photoshop. Keep the approved copy and styling, then re-export and check the published Mobile Instream unit." };
  if (ruleId.includes("soft-return")) return { category: "Typography", suggestedFix: "Check Space After in Photoshop. If the gap is unintended, adjust it, re-export, and compare with production." };
  if (ruleId.includes("control-character")) return { category: "Hidden characters", suggestedFix: "Replace the hidden character with the intended character in Photoshop, then check the copy in Preview." };
  if (ruleId === "copy.replacement-character") return { category: "Text encoding", suggestedFix: "In Photoshop, replace the black diamond/question-mark symbol with the intended character (for example, •), then export the ZIP again and reopen it in Turbo QA." };
  if (ruleId === "copy.spacing") return { category: "Copy", suggestedFix: "Check the spacing in Photoshop and remove extra spaces or tabs if they are not intentional." };
  if (ruleId === "copy.line-end-spacing") return { category: "Copy", suggestedFix: "In Photoshop, keep the spaces if they help align the line. Otherwise remove the trailing spaces and re-export." };
  if (ruleId.includes("placeholder")) return { category: "Copy", suggestedFix: "Replace this with approved copy, or confirm that the placeholder is intentional." };
  if (ruleId === "turbo.master-required") return { category: "Package setup", suggestedFix: "Restore the Master artboard from the approved template, then re-export the package." };
  if (ruleId === "turbo.artboards-required") return { category: "Package setup", suggestedFix: "Add at least one supported ad size artboard, then re-export the package." };
  return { category: title.toLowerCase().includes("copy") ? "Copy" : "Package setup", suggestedFix: message };
}

function findingReason(ruleId: string, message: string) {
  if (ruleId === "turbo.master-required") return "No artboard named Master was found in the package.";
  if (ruleId === "turbo.artboards-required") return "No artboard name matched a supported creative size, such as 300x250, or mobile-instream.";
  if (ruleId.startsWith("assets.")) return "The creative refers to this file, but the file was not found in the package.";
  if (ruleId === "structure.cta-ignored-image") return "The PSD export guide (CTA Button, page 6) keeps text, frame, and background layers inside a button. This direct image or Smart Object has another role name and is ignored. Assets Generator and retina suffixes are accounted for.";
  if (ruleId === "rendering.cta-mobile-label-review") return "This is paragraph text directly inside a Mobile Instream button. That setup matched a published label omission with a reported point-text repair. It is a review signal, not proof of disappearance; paragraph-text buttons can work in production.";
  if (ruleId === "rendering.shift-enter-soft-return") return "A paragraph with Space After follows a Shift+Enter break, so production may add an unintended gap between these lines.";
  if (ruleId === "copy.unsupported-control-character") return "The copy contains a non-printing character that could affect how it appears.";
  if (ruleId === "copy.replacement-character") return "The export contains U+FFFD, the Unicode replacement character. This means the original glyph was lost in the text data and may render as a black diamond with a question mark.";
  if (ruleId === "copy.spacing") return "The text contains repeated spaces, a tab, or repeated non-breaking spaces.";
  if (ruleId === "copy.line-end-spacing") return "Photoshop exported whitespace before a line ending. This may be intentional layout padding, so it is a low-priority review note.";
  if (ruleId === "copy.default-placeholder") return "The text matches a common placeholder phrase, such as “Headline goes here” or “Button text.”";
  if (ruleId === "typography.trademark-superscript") return "The ® or ™ mark is not set to Superscript or raised in its Photoshop text style.";
  if (ruleId === "typography.optical-kerning") return "Photoshop Optical kerning is applied here; browsers may space these letters differently.";
  if (ruleId === "consistency.element-presence") return "This size has fewer matching elements than the most common pattern across sizes in this tab.";
  if (ruleId === "consistency.copy-presence") return "This copy appears on most sizes in this tab, but was not found on this one.";
  return message;
}

export function makeFinding(partial: FindingDraft): Finding {
  const key = [partial.ruleId, partial.artboard, partial.tab, partial.slide, partial.layerId, partial.title, partial.message]
    .filter(Boolean)
    .join("|");
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return { ...partial, ...findingGuidance(partial.ruleId, partial.title, partial.message), reason: findingReason(partial.ruleId, partial.message), id: `f-${(hash >>> 0).toString(36)}` };
}
