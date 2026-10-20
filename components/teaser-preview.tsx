"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, LoaderCircle, Sparkles, Volume2, VolumeX } from "lucide-react";
import { mobileInstreamMotion } from "@/lib/teaser-layout";

export type TeaserMedia = {
  video: string | null;
  instreamVideo: string | null;
  poster: string | null;
  instreamPoster: string | null;
  generatedFrame: string | null;
  logo: string | null;
  peelLogo: string | null;
  peel: string | null;
};

export type TeaserGeometry = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type TeaserPackageLayout = {
  isi: TeaserGeometry | null;
  creative: TeaserGeometry;
  disclaimerSrcDoc: string | null;
  prequal: string | null;
  prequalWithIsi: string | null;
};

export type TeaserPackageLayouts = Record<string, TeaserPackageLayout>;

type TeaserSize = {
  id: string;
  label: string;
  product: string;
  width: number;
  height: number;
  mainUnit: string;
  kind?: "instream" | "adhesion";
};

const SIZES: TeaserSize[] = [
  { id: "desktop-expandable", label: "970×250", product: "Desktop expandable", width: 970, height: 250, mainUnit: "970x546" },
  { id: "300x250", label: "300×250", product: "Desktop", width: 300, height: 250, mainUnit: "300x250" },
  { id: "300x600", label: "300×600", product: "Desktop", width: 300, height: 600, mainUnit: "300x600" },
  { id: "160x600", label: "160×600", product: "Desktop", width: 160, height: 600, mainUnit: "160x600" },
  { id: "728x90", label: "728×90", product: "Desktop", width: 728, height: 90, mainUnit: "728x90" },
  { id: "desktop-inframe", label: "970×250", product: "Desktop in-frame", width: 970, height: 250, mainUnit: "970x250" },
  { id: "mobile-adhesion", label: "320×50", product: "Mobile adhesion", width: 320, height: 50, mainUnit: "428x622", kind: "adhesion" },
  { id: "mobile-instream", label: "970×546", product: "Mobile instream", width: 970, height: 546, mainUnit: "mobile-instream", kind: "instream" },
];

function TeaserWarning({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="teaser-warning finding-row warning" role="status">
    <div className="finding-icon"><AlertTriangle aria-hidden="true" /></div>
    <div className="finding-copy"><div className="finding-title"><strong>{title}</strong></div><p>{children}</p></div>
  </div>;
}

function TeaserCard({ size, media, layout, fit, muted, showBranding, showPrequal, onMute, onOpen }: {
  size: TeaserSize;
  media: TeaserMedia;
  layout: TeaserPackageLayout | null;
  fit: "cover" | "contain";
  muted: boolean;
  showBranding: boolean;
  showPrequal: boolean;
  onMute: () => void;
  onOpen: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backdropRef = useRef<HTMLVideoElement>(null);
  const generatedInstream = size.kind === "instream" && !media.instreamVideo && Boolean(media.video && media.generatedFrame);
  const video = size.kind === "instream" ? media.instreamVideo || media.video : media.video;
  const poster = size.kind === "instream" ? media.instreamPoster || media.generatedFrame || media.poster : media.poster;
  const effectiveFit = fit;
  const creative = layout?.creative || { top: 0, left: 0, width: size.width, height: size.height };
  const prequal = showPrequal
    ? ((layout?.isi ? layout.prequalWithIsi : layout?.prequal) || layout?.prequal || layout?.prequalWithIsi)
    : null;
  const creativeStyle = {
    top: `${creative.top / size.height * 100}%`,
    left: `${creative.left / size.width * 100}%`,
    width: `${creative.width / size.width * 100}%`,
    height: `${creative.height / size.height * 100}%`,
  };

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      for (const player of [node, backdropRef.current]) {
        if (!player) continue;
        if (entries[0]?.isIntersecting) void player.play().catch(() => {});
        else player.pause();
      }
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [video, effectiveFit, showPrequal]);

  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted; }, [muted]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !generatedInstream) return;
    let frame = 0;
    const update = () => {
      const motion = mobileInstreamMotion(node.currentTime, node.duration);
      node.style.transform = `scale(${motion.scale})`;
      node.dataset.peekPhase = motion.phase;
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => {
      window.cancelAnimationFrame(frame);
      node.style.removeProperty("transform");
      delete node.dataset.peekPhase;
    };
  }, [generatedInstream, video]);

  return <article className={`teaser-card teaser-card-${size.id}`}>
    <div className="teaser-card-heading"><strong>{size.label}</strong><span>{size.product}</span></div>
    <div className={`teaser-stage teaser-fit-${effectiveFit}${size.kind === "instream" ? " teaser-instream" : ""}`}
      style={{ width: size.width, aspectRatio: `${size.width} / ${size.height}` }}>
      {layout?.isi && layout.disclaimerSrcDoc && <iframe
        className="teaser-isi-frame"
        style={{ top: `${layout.isi.top / size.height * 100}%`, left: `${layout.isi.left / size.width * 100}%`, width: `${layout.isi.width / size.width * 100}%`, height: `${layout.isi.height / size.height * 100}%` }}
        title={`${size.label} ${size.product} Important Safety Information`}
        srcDoc={layout.disclaimerSrcDoc}
        sandbox="allow-same-origin"
      />}
      <div className="teaser-creative" style={creativeStyle}>
        {generatedInstream && media.generatedFrame && <img className="teaser-generated-frame" src={media.generatedFrame} alt="Rendered mobile instream main-unit screen" />}
        {video ? <>
          {effectiveFit === "contain" && !generatedInstream && <video ref={backdropRef} className="teaser-video-backdrop" src={video} muted autoPlay loop playsInline aria-hidden="true" tabIndex={-1} />}
          <video ref={videoRef} className={`teaser-video${generatedInstream ? " teaser-generated-video" : ""}`} src={video} poster={poster || undefined} muted={muted} autoPlay loop playsInline preload="metadata" onTimeUpdate={event => {
            const backdrop = backdropRef.current;
            if (backdrop && Math.abs(backdrop.currentTime - event.currentTarget.currentTime) > 0.12) backdrop.currentTime = event.currentTarget.currentTime;
          }} />
        </> : <div className="teaser-media-missing">{size.kind === "instream" ? "teaserVideo.mp4 is missing from this package" : "video1.mp4 is missing from this package"}</div>}
        {prequal && <img className="teaser-prequal" src={prequal} alt={`${size.label} pre-qualifier`} />}
        <button className="teaser-open" type="button" aria-label={`Open ${size.mainUnit} main unit from ${size.label} ${size.product} teaser`} onClick={onOpen} />
        <div className={`teaser-peel${size.kind === "adhesion" ? " teaser-peel-adhesion" : ""}`}>
          {media.logo ? <div className="teaser-peel-logo"><img src={media.logo} alt="" /></div> : media.peelLogo ? <img className="teaser-peel-logo-art" src={media.peelLogo} alt="" /> : <div className="teaser-peel-logo"><span>Teaser logo missing</span></div>}
          <img className="teaser-peel-frame" src={media.peel || "/teaser-peel-frame.png"} alt="" />
          <div className="teaser-peel-footer"><span className={showBranding ? "" : "teaser-peel-message"}>{showBranding ? "VDX.TV" : size.kind === "adhesion" || size.kind === "instream" ? "TAP TO EXPLORE" : "ROLL OVER TO EXPLORE"}</span><button type="button" disabled={!video} aria-label={video ? muted ? `Unmute ${size.label} teaser` : `Mute ${size.label} teaser` : `${size.label} teaser sound unavailable`} onClick={event => { event.stopPropagation(); onMute(); }}>{muted ? <VolumeX /> : <Volume2 />}</button></div>
        </div>
      </div>
    </div>
    <p className="teaser-card-destination">Opens {size.mainUnit} main unit</p>
  </article>;
}

export function TeaserPreview({ artboards, media, layouts, onOpen, generationStatus = "idle" }: {
  artboards: string[];
  media: TeaserMedia;
  layouts: TeaserPackageLayouts;
  onOpen: (size: string) => void;
  generationStatus?: "idle" | "rendering" | "ready" | "error";
}) {
  const [fit, setFit] = useState<"cover" | "contain">("contain");
  const [unmuted, setUnmuted] = useState<string | null>(null);
  const [showBranding, setShowBranding] = useState(true);
  const [showPrequal, setShowPrequal] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setShowBranding(value => !value), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const available = new Set(artboards.map(name => name.toLowerCase()));
  const sizes = SIZES.filter(size => available.has(size.mainUnit.toLowerCase()));
  const hasPrequal = Object.values(layouts).some(layout => layout.prequal || layout.prequalWithIsi);

  return <div className="teaser-page">
    <div className="teaser-page-header">
      {hasPrequal && <div className="teaser-fit-control" role="group" aria-label="Pre-qualifier preview"><span>Pre-qual</span><button type="button" className={!showPrequal ? "active" : ""} aria-pressed={!showPrequal} onClick={() => setShowPrequal(false)}>Off</button><button type="button" className={showPrequal ? "active" : ""} aria-pressed={showPrequal} onClick={() => setShowPrequal(true)}>On</button></div>}
      <div className="teaser-fit-control" role="group" aria-label="Teaser video fit"><span>Video fit</span><button type="button" className={fit === "contain" ? "active" : ""} aria-pressed={fit === "contain"} onClick={() => setFit("contain")}>Bokeh ON</button><button type="button" className={fit === "cover" ? "active" : ""} aria-pressed={fit === "cover"} onClick={() => setFit("cover")}>Cropped Teaser</button></div>
    </div>
    {!media.video && <TeaserWarning title="Teaser video missing">This package has no video1.mp4, so its teaser video cannot be previewed.</TeaserWarning>}
    {generationStatus === "rendering" && <div className="teaser-generation-status" role="status"><LoaderCircle className="spin" /><div><strong>Generating mobile instream teaser</strong><span>Rendering the exported mobile canvas and building the 3-second peek-a-boo sequence…</span></div></div>}
    {generationStatus === "ready" && !media.instreamVideo && <div className="teaser-generation-status ready" role="status"><Sparkles /><div><strong>Generated from export.json</strong><span>The preview uses video1.mp4 and the rendered mobile-instream canvas with a 1s shrink, 1s reveal, and 1s expansion.</span></div></div>}
    {sizes.some(size => size.kind === "instream") && !media.instreamVideo && generationStatus === "error" && <TeaserWarning title="Mobile instream generation unavailable">The package needs a mobile-instream artboard and video1.mp4, or authored teaserVideo.mp4 and teaserVideo.jpg assets.</TeaserWarning>}
    <div className="teaser-gallery">{sizes.map(size => <TeaserCard key={size.id} size={size} media={media} layout={layouts[size.label.replace("×", "x")] || null} fit={fit} muted={unmuted !== size.id} showBranding={showBranding} showPrequal={showPrequal} onMute={() => setUnmuted(current => current === size.id ? null : size.id)} onOpen={() => onOpen(size.mainUnit)} />)}</div>
    {!sizes.length && <TeaserWarning title="No teaser sizes found">This package has no supported teaser sizes.</TeaserWarning>}
  </div>;
}
