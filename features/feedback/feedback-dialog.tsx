"use client";

import type { ClipboardEvent } from "react";
import { CheckCircle2, ChevronDown, CircleAlert, Download, ExternalLink, Link2, LoaderCircle, Paperclip, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CASE_STATUS_OPTIONS, FEEDBACK_TYPE_OPTIONS } from "@/features/feedback/catalog";
import type { FeedbackCapture, FeedbackImageContext, FeedbackType } from "@/features/feedback/create-feedback-bundle";
import type { FeedbackInlineImage, FeedbackPackageData } from "@/features/feedback/types";
import { useFeedbackForm } from "@/features/feedback/use-feedback-form";
import { formatBytes, type PackageSummary } from "@/lib/qa-engine";

type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: PackageSummary | null;
  sourcePackage: File | null;
  packageData: FeedbackPackageData;
  activeTab: string;
  theme: string;
  build: string;
  capturePreview: () => Promise<FeedbackCapture>;
};

const BOX_UPLOAD_URL = "https://exponential.box.com/s/5plrgb9ogbk7m7cyztho4yfnu8orf37s";

function PastedImages({ context, images, onRemove }: { context: FeedbackImageContext; images: FeedbackInlineImage[]; onRemove: (id: string) => void }) {
  const contextImages = images.filter(image => image.context === context);
  if (!contextImages.length) return null;
  return <div className="feedback-pasted-images" aria-label={`Screenshots pasted into ${context === "description" ? "description" : `${context} result`}`}>
    {contextImages.map(image => <div className="feedback-pasted-image" key={image.id}>
      <span role="img" aria-label={image.file.name} style={{ backgroundImage: `url(${image.previewUrl})` }} />
      <div><b>{image.file.name}</b><small>{formatBytes(image.file.size)}</small></div>
      <button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => onRemove(image.id)}>×</button>
    </div>)}
  </div>;
}

function PastedTextarea({ id, value, onChange, context, placeholder, help, images, onPaste, onRemove }: {
  id: string; value: string; onChange: (value: string) => void; context: FeedbackImageContext;
  placeholder: string; help: string; images: FeedbackInlineImage[];
  onPaste: (context: FeedbackImageContext, event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onRemove: (id: string) => void;
}) {
  return <div className="feedback-field">
    <label htmlFor={id}>{id === "feedback-description-text" ? "Description (optional)" : `${context === "actual" ? "Actual" : "Expected"} result (optional)`}</label>
    <div className="feedback-textarea-paste">
      <textarea id={id} value={value} onChange={event => onChange(event.target.value)} onPaste={event => onPaste(context, event)} placeholder={placeholder} />
      <PastedImages context={context} images={images} onRemove={onRemove} />
    </div>
    <small>{help}</small>
  </div>;
}

export function FeedbackDialog(props: FeedbackDialogProps) {
  const form = useFeedbackForm(props);
  const changeOpen = (open: boolean) => {
    if (form.preparing) return;
    if (open) form.resetSubmissionState();
    props.onOpenChange(open);
  };
  const changeType = (value: string) => form.setType(value as FeedbackType);
  const changeCase = (value: string) => { form.setCaseId(value); form.setCaseStatus(value ? "In progress" : "Not started"); };

  return <Dialog open={props.open} onOpenChange={changeOpen}>
    <DialogContent className="feedback-dialog" aria-describedby="feedback-description">
      <DialogHeader>
        <span className="eyebrow">BUILD · {props.build}</span>
        <DialogTitle>Report feedback</DialogTitle>
        <DialogDescription id="feedback-description">Capture the information needed to reproduce and compare this issue. The feedback ZIP is prepared locally and downloaded to your computer.</DialogDescription>
      </DialogHeader>
      <div className="feedback-form">
        <div className="feedback-grid feedback-grid-two">
          <label className="feedback-field"><span>Reviewer name <b aria-hidden="true">*</b></span><input required value={form.reviewerName} onChange={event => form.setReviewerName(event.target.value)} placeholder="Enter your name" /></label>
          <label className="feedback-field"><span>Feedback type</span><span className="feedback-select"><select value={form.type} onChange={event => changeType(event.target.value)}>{FEEDBACK_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown aria-hidden="true" /></span></label>
          <label className="feedback-field"><span>CCRV or Showcase URL {form.requiresProductionReference ? <b aria-hidden="true">*</b> : "(optional)"}</span>
            <span className="feedback-input-icon"><Link2 /><input type="url" required={form.requiresProductionReference} aria-invalid={form.productionReferenceInvalid} value={form.referenceUrl} onChange={event => form.setReferenceUrl(event.target.value)} placeholder="https://showcase.vdx.tv/…/#creative-id" /></span>
            {form.referenceUrl && <small className={form.productionReference ? "valid" : "invalid"}>{form.productionReference ? `${form.productionReference.type === "ccrv" ? "CCRV" : "Showcase"} reference · ${form.productionReference.creativeId}${form.productionReference.variant ? ` / ${form.productionReference.variant}` : ""}` : "Use a showcase.vdx.tv CCRV or Showcase link with its # creative ID."}</small>}
          </label>
        </div>
        <div className="feedback-grid feedback-grid-two">
          <label className="feedback-field"><span>Test case (optional)</span><span className="feedback-select"><select value={form.caseId} onChange={event => changeCase(event.target.value)}>
            <option value="">General feedback — no case</option>
            <optgroup label="Suggested for this feedback type">{form.relatedCases.map(testCase => <option key={testCase.id} value={testCase.id}>{testCase.id} · {testCase.name} · {testCase.priority.toUpperCase()}</option>)}</optgroup>
            <optgroup label="All other test cases">{form.sortedCases.filter(testCase => !form.relatedCases.some(related => related.id === testCase.id)).map(testCase => <option key={testCase.id} value={testCase.id}>{testCase.id} · {testCase.name} · {testCase.priority.toUpperCase()}</option>)}</optgroup>
          </select><ChevronDown aria-hidden="true" /></span>{form.selectedCase && <small className={`feedback-priority feedback-priority-${form.selectedCase.priority.toLowerCase()}`}>{form.selectedCase.priority} priority · {form.selectedCase.area}</small>}</label>
          {form.selectedCase && <label className="feedback-field"><span>Case status <b aria-hidden="true">*</b></span><span className="feedback-select"><select value={form.caseStatus} onChange={event => form.setCaseStatus(event.target.value as typeof form.caseStatus)}>{CASE_STATUS_OPTIONS.filter(status => status !== "Not started").map(status => <option key={status} value={status}>{status}</option>)}</select><ChevronDown aria-hidden="true" /></span></label>}
        </div>
        <PastedTextarea id="feedback-description-text" value={form.description} onChange={form.setDescription} context="description" placeholder="Describe the issue, or paste a screenshot…" help="Paste an image from the clipboard to attach it as general evidence." images={form.inlineImages} onPaste={form.pasteImages} onRemove={form.removeImage} />
        {form.showComparisonFields && <div className="feedback-grid feedback-grid-two">
          <PastedTextarea id="feedback-actual" value={form.actual} onChange={form.setActual} context="actual" placeholder="Describe what happened, or paste a screenshot…" help="Paste an image from the clipboard to attach it as actual-result evidence." images={form.inlineImages} onPaste={form.pasteImages} onRemove={form.removeImage} />
          <PastedTextarea id="feedback-expected" value={form.expected} onChange={form.setExpected} context="expected" placeholder="Describe production, or paste a reference screenshot…" help="Paste an image from the clipboard to attach it as expected-result evidence." images={form.inlineImages} onPaste={form.pasteImages} onRemove={form.removeImage} />
        </div>}
        <label className="feedback-field"><span>Steps to reproduce (optional)</span><textarea value={form.steps} onChange={event => form.setSteps(event.target.value)} placeholder={'1. Open the package\n2. Select the size and state\n3. Observe the issue'} /></label>
        <section className="feedback-evidence" aria-labelledby="feedback-evidence-title">
          <div className="feedback-evidence-heading"><div><strong id="feedback-evidence-title">Evidence included</strong><span>Start lightweight. Add package files only when they help reproduce the issue.</span></div><ShieldCheck /></div>
          <label className="feedback-check"><input type="checkbox" checked={form.includeScreenshot} disabled={!props.summary} onChange={event => form.setIncludeScreenshot(event.target.checked)} /><span><b>Active preview screenshot</b><small>{props.summary ? "Captures the current artboard and records its tab, slide, view, scale, and theme." : "Open a package to include a rendered artboard."}</small></span></label>
          <div className="feedback-package-evidence"><div className="feedback-package-heading"><div><b>Package evidence</b><small>Selected automatically from the feedback type.</small></div><span>Automatic</span></div><div className="feedback-auto-evidence"><CheckCircle2 aria-hidden="true" /><span><b>{form.evidenceSummary}</b><small>{form.evidenceLevel === "complete-package" ? "The original ZIP is needed to investigate package loading." : form.evidenceLevel === "affected-assets" ? "Only files connected to asset findings or validation warnings are added." : "Includes export.json and the package file inventory; asset contents stay out."}</small></span></div></div>
          <label className="feedback-attachment"><Paperclip /><span><b>Add supporting files</b><small>Reference screenshots, logs, PDFs, or corrected assets</small></span><input type="file" multiple onChange={event => form.setAttachments(Array.from(event.target.files || []))} /></label>
          {form.attachments.length > 0 && <div className="feedback-attachment-list">{form.attachments.map((file, index) => <span key={`${file.name}-${file.size}-${index}`}>{file.name} · {formatBytes(file.size)}</span>)}</div>}
        </section>
        {form.error && <div className="feedback-error" role="alert"><CircleAlert /> {form.error}</div>}
        {form.success && <div className="feedback-success" role="status" aria-live="polite"><div className="feedback-success-icon"><CheckCircle2 aria-hidden="true" /></div><div className="feedback-success-content"><span className="feedback-success-kicker">{form.submitted ? "Shared with the team" : "One final step"}</span><strong>{form.submitted ? "Review saved!" : "Feedback bundle downloaded"}</strong><p>{form.submitted ? "Your local draft remains available for edits." : "Upload the ZIP to Box, then share its file link."}</p><span className="feedback-success-filename">{form.success}</span>{!form.submitted && <Button asChild className="feedback-upload-button"><a href={BOX_UPLOAD_URL} target="_blank" rel="noreferrer">Upload bundle to Box <ExternalLink aria-hidden="true" /></a></Button>}</div></div>}
        {form.success && !form.submitted && <div className="feedback-share-panel">{!form.shareOpen ? <Button onClick={() => form.setShareOpen(true)}>Share Feedback</Button> : <><label className="feedback-field"><span>Feedback bundle URL <b aria-hidden="true">*</b></span><input type="url" value={form.bundleUrl} onChange={event => form.setBundleUrl(event.target.value)} placeholder="Paste the uploaded Box file link" /></label><small>{form.parsedBundleUrl ? "Box link ready to share." : "Paste the shared file link from Box."}</small></>}</div>}
      </div>
      <DialogFooter className="feedback-footer">
        <Button variant="outline" disabled={form.preparing || form.submitting} onClick={() => changeOpen(false)}>{form.submitted ? "Close" : "Cancel"}</Button>
        {!form.success && <Button disabled={!form.canCreateBundle} onClick={() => void form.downloadBundle()}>{form.preparing ? <><LoaderCircle className="spin" /> Preparing bundle…</> : <><Download /> Download feedback bundle</>}</Button>}
        {form.success && !form.submitted && form.shareOpen && <Button disabled={!form.parsedBundleUrl || form.submitting} onClick={() => void form.submit()}>{form.submitting ? <><LoaderCircle className="spin" /> Sharing…</> : "Submit to Notion"}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
