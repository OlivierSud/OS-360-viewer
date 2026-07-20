import React, { useEffect, useRef, useState } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import '@photo-sphere-viewer/markers-plugin/index.css';
import { VideoPlugin } from '@photo-sphere-viewer/video-plugin';
import '@photo-sphere-viewer/video-plugin/index.css';
import { EquirectangularVideoAdapter } from '@photo-sphere-viewer/equirectangular-video-adapter';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';
import { StereoPlugin } from '@photo-sphere-viewer/stereo-plugin';
import { useProjectStore } from '../../state/projectStore';
import { listCloudProjects } from '../../services/cloudflareApi';
import { getAccentColor } from '../../utils/theme';
import type { Hotspot } from '../../models/Hotspot';

function getYoutubeEmbedUrl(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return null;
}

const SphereViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const currentIsVideoRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const navbarIntervalRef = useRef<number | null>(null);
  // The whole VR interface (reticles + per-eye marker overlay) is built as a
  // SINGLE plain DOM subtree (`vrLayerRef`) appended directly into the PSV
  // container. It is intentionally NOT managed by React (no portal) so that PSV's
  // own container teardown on panorama/scene change can remove it without
  // crashing React with "removeChild ... not a child of this node". We rebuild it
  // ourselves whenever vrActive turns on and tear it down when it turns off.
  const vrLayerRef = useRef<HTMLDivElement | null>(null);
  const vrOverlayRef = useRef<HTMLDivElement | null>(null);
  const vrReticleRefs = useRef<{ left: SVGCircleElement | null; right: SVGCircleElement | null } | null>(null);
  const vrReticleWrapRef = useRef<{ left: HTMLDivElement; right: HTMLDivElement } | null>(null);
  const vrMarkerElsRef = useRef<Map<string, { left: HTMLDivElement; right: HTMLDivElement }>>(new Map());
  // Per-eye "close" targeting points (✕) shown in VR when a hotspot popup is open,
  // so the user can gaze at the cross to dismiss the popup.
  const vrCloseElsRef = useRef<{ left: HTMLDivElement; right: HTMLDivElement } | null>(null);
  // Per-eye VR hotspot popup card, anchored to the hotspot's SPHERICAL position
  // (so it stays fixed relative to the panorama, not the camera). The close cross
  // is drawn in the top-right corner of this card.
  const vrPopupElsRef = useRef<{ left: HTMLDivElement; right: HTMLDivElement } | null>(null);
  const vrPollTimerRef = useRef<number | undefined>(undefined);
  // Bumped every time the PSV viewer instance is (re)created, so the VR DOM
  // layer — which lives inside the PSV container and gets wiped by PSV's own
  // teardown — can be rebuilt into the fresh container.
  const [viewerEpoch, setViewerEpoch] = useState(0);
  // VR active state (true while the stereoscopic/cardboard interface is shown).
  const [vrActive, setVrActive] = useState(false);
  // Mirror of vrActive so callbacks created once (e.g. the navbar interval)
  // can read the current VR state without re-subscribing.
  const vrActiveRef = useRef(false);
  vrActiveRef.current = vrActive;
  const addHotspotCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ctext x='16' y='22' text-anchor='middle' font-size='22'%3E%E2%AD%95%3C/text%3E%3C/svg%3E") 16 16, crosshair`;

  // Same pill button style as the map editor controls (Add 360 / Move)
  const mapControlButtonStyle = (
    isActive: boolean,
    activeColor = '#d32f2f',
    inactiveColor = 'rgba(0,0,0,0.55)',
  ): React.CSSProperties => ({
    width: '130px',
    padding: '7px 14px 7px 10px',
    cursor: 'pointer',
    backgroundColor: isActive ? activeColor : inactiveColor,
    color: 'white',
    border: isActive ? `1px solid ${activeColor}` : '1px solid rgba(255,255,255,0.12)',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    boxShadow: isActive
      ? `0 0 0 2px ${activeColor}55, 0 4px 12px rgba(0,0,0,0.5)`
      : '0 2px 8px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '7px',
    transition: 'all 0.18s ease',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  });

  const IconPlus = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );

  const IconMove = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 9 2 12 5 15" />
      <polyline points="9 5 12 2 15 5" />
      <polyline points="15 19 12 22 9 19" />
      <polyline points="19 9 22 12 19 15" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
  );

  const IconTrash = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );

  // Returns a uniform-size (18px) white SVG icon string for a hotspot type.
  const hotspotIconSvg = (type: string): string => {
    const open =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
    if (type === 'video') {
      return open + '<polygon points="6 4 20 12 6 20 6 4"></polygon></svg>';
    }
    if (type === 'image') {
      return (
        open +
        '<rect x="3" y="3" width="18" height="18" rx="2"></rect>' +
        '<circle cx="8.5" cy="8.5" r="1.5"></circle>' +
        '<polyline points="21 15 16 10 5 21"></polyline></svg>'
      );
    }
    return (
      open +
      '<line x1="12" y1="16" x2="12" y2="12"></line>' +
      '<line x1="12" y1="8" x2="12.01" y2="8"></line>' +
      '<circle cx="12" cy="12" r="9"></circle></svg>'
    );
  };

  const selectedSceneId = useProjectStore((state) => state.selectedSceneId);
  const selectedHotspotId = useProjectStore((state) => state.selectedHotspotId);
  const scenes = useProjectStore((state) => state.scenes);
  const project = useProjectStore((state) => state.project);
  const isAddingHotspot = useProjectStore((state) => state.isAddingHotspot);
  const setIsAddingHotspot = useProjectStore((state) => state.setIsAddingHotspot);
  const mode = useProjectStore((state) => state.mode);
  const isMovingHotspot = useProjectStore((state) => state.isMovingHotspot);
  const setIsMovingHotspot = useProjectStore((state) => state.setIsMovingHotspot);
  const isDeletingHotspot = useProjectStore((state) => state.isDeletingHotspot);
  const setIsDeletingHotspot = useProjectStore((state) => state.setIsDeletingHotspot);
  const setSceneLoading = useProjectStore((state) => state.setSceneLoading);

  // The configurable accent color only applies in the public viewer. In the
  // editor the controls (Add Hotspot, navigation links) keep the default blue.
  const accentColor = mode === 'viewer' ? getAccentColor(project) : '#007acc';

  const selectedScene = scenes.find(s => s.id === selectedSceneId);

  // VR mode (mobile) is only available in the public viewer, and only when the
  // project explicitly enables it. Gyroscope lets the user look around by moving
  // the phone; the stereo plugin provides the cardboard/stereoscopic VR view.
  const vrEnabled = mode === 'viewer' && Boolean(project?.project?.enableVR);
  const vrEnabledRef = useRef(vrEnabled);

  // VR button is only relevant on mobile devices (where a cardboard/gyroscope
  // experience makes sense). Detect once and keep it in sync with viewport.
  const isMobileQuery = '(max-width: 768px), (pointer: coarse), (hover: none), (orientation: landscape) and (max-height: 560px)';
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' && window.matchMedia(isMobileQuery).matches
  );
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(isMobileQuery);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Build / tear down the VR interface as a plain DOM subtree appended INSIDE the
  // PSV container (so it survives PSV's fullscreen). It is not a React portal: the
  // subtree is ours to remove, so PSV's container teardown on scene change can
  // wipe it without ever crashing React with a removeChild error. Rebuilt whenever
  // vrActive turns on OR the viewer instance is recreated (viewerEpoch).
  React.useEffect(() => {
    const container = containerRef.current;
    if (!vrActive || !container) return;
    if (vrLayerRef.current) return; // already built (e.g. effect re-run)

    const NS = 'http://www.w3.org/2000/svg';
    const layer = document.createElement('div');
    layer.setAttribute('data-vr-layer', '1');
    Object.assign(layer.style, {
      position: 'absolute', inset: '0', zIndex: '9990',
      pointerEvents: 'none', overflow: 'hidden',
    } as CSSStyleDeclaration);
    container.appendChild(layer);
    vrLayerRef.current = layer;

    // Per-eye reticles (charging rings at 25% / 75%).
    const makeReticle = (pct: number) => {
      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        position: 'absolute', left: `${pct}%`, top: '50%',
        transform: 'translate(-50%, -50%)', zIndex: '9991',
        pointerEvents: 'none', width: '64px', height: '64px',
      } as CSSStyleDeclaration);
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('width', '64'); svg.setAttribute('height', '64');
      svg.setAttribute('viewBox', '0 0 64 64');
      const base = document.createElementNS(NS, 'circle');
      base.setAttribute('cx', '32'); base.setAttribute('cy', '32'); base.setAttribute('r', '28');
      base.setAttribute('fill', 'none'); base.setAttribute('stroke', 'rgba(255,255,255,0.35)');
      base.setAttribute('stroke-width', '4');
      const prog = document.createElementNS(NS, 'circle');
      prog.setAttribute('cx', '32'); prog.setAttribute('cy', '32'); prog.setAttribute('r', '28');
      prog.setAttribute('fill', 'none'); prog.setAttribute('stroke', '#ffffff');
      prog.setAttribute('stroke-width', '4'); prog.setAttribute('stroke-linecap', 'round');
      prog.setAttribute('stroke-dasharray', `${2 * Math.PI * 28}`);
      prog.setAttribute('stroke-dashoffset', `${2 * Math.PI * 28}`);
      prog.setAttribute('transform', 'rotate(-90 32 32)');
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', '32'); dot.setAttribute('cy', '32'); dot.setAttribute('r', '3');
      dot.setAttribute('fill', 'rgba(255,255,255,0.85)');
      svg.appendChild(base); svg.appendChild(prog); svg.appendChild(dot);
      wrap.appendChild(svg);
      layer.appendChild(wrap);
      return { wrap, prog };
    };
    const rLeft = makeReticle(25);
    const rRight = makeReticle(75);
    vrReticleWrapRef.current = { left: rLeft.wrap, right: rRight.wrap };
    vrReticleRefs.current = { left: rLeft.prog, right: rRight.prog };

    // Overlay where per-eye marker / popup / close targeting points are appended.
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'absolute', inset: '0', zIndex: '9990',
      pointerEvents: 'none', overflow: 'hidden',
    } as CSSStyleDeclaration);
    layer.appendChild(overlay);
    vrOverlayRef.current = overlay;

    return () => {
      try { layer.remove(); } catch { /* ignore */ }
      vrLayerRef.current = null;
      vrOverlayRef.current = null;
      vrReticleRefs.current = null;
      vrReticleWrapRef.current = null;
      // Drop any dynamically created children (markers / popup / close) too.
      for (const [, pair] of vrMarkerElsRef.current) { pair.left.remove(); pair.right.remove(); }
      vrMarkerElsRef.current.clear();
      if (vrCloseElsRef.current) { vrCloseElsRef.current.left.remove(); vrCloseElsRef.current.right.remove(); vrCloseElsRef.current = null; }
      if (vrPopupElsRef.current) { vrPopupElsRef.current.left.remove(); vrPopupElsRef.current.right.remove(); vrPopupElsRef.current = null; }
    };
  }, [vrActive, viewerEpoch]);

  // Whether an audio track is available for the current viewpoint (its own or
  // the project's ambient one).
  const hasAudio = Boolean(selectedScene?.audio || project?.project?.audio);

  const [audioVolume, setAudioVolume] = useState(1);
  const [audioMuted, setAudioMuted] = useState(false);

  // Play the viewpoint's own audio track if present, otherwise the project's
  // ambient audio. The viewpoint track takes priority and cuts the project one.
  const playSceneAudio = () => {
    const el = audioRef.current;
    if (!el) return;
    const track = selectedScene?.audio || project?.project?.audio;
    if (!track) {
      el.pause();
      el.removeAttribute('src');
      el.load();
      return;
    }
    if (el.src !== track) {
      el.src = track;
    }
    el.loop = true;
    el.play().catch(() => { /* autoplay may be blocked until user interaction */ });
  };

  // Keep the audio element's volume / mute in sync with the controls.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = audioMuted ? 0 : audioVolume;
    el.muted = audioMuted;
  }, [audioVolume, audioMuted]);

  // Which hotspot popup is currently open (rendered as an in-sphere marker)
  const [openHotspotId, setOpenHotspotId] = useState<string | null>(null);
  // Mirror of openHotspotId so the VR gaze loop (which only depends on vrActive)
  // can read the current open popup without re-subscribing every render.
  const openHotspotIdRef = useRef<string | null>(null);
  openHotspotIdRef.current = openHotspotId;
  const [panoramaError, setPanoramaError] = useState<string | null>(null);
  const [targetProjectTitle, setTargetProjectTitle] = useState<string | null>(null);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const [fullscreenVideoUrl, setFullscreenVideoUrl] = useState<string | null>(null);

  // Gaze interaction (VR / stereo mode only): a reticle at the centre of the
  // left eye fills up while the user keeps looking at a marker; once full it
  // triggers the same action as a click.
  const gazeTargetRef = useRef<string | null>(null);
  const gazeProgressRef = useRef(0);

  // Same behaviour as clicking a marker (link navigation or hotspot popup).
  const triggerMarker = (data: { target?: string; hotspotId?: string }) => {
    if (data.target) {
      useProjectStore.getState().selectScene(data.target);
    } else if (data.hotspotId) {
      const state = useProjectStore.getState();
      if (state.isDeletingHotspot) {
        if (state.selectedSceneId) state.removeHotspot(state.selectedSceneId, data.hotspotId);
        return;
      }
      state.selectHotspot(data.hotspotId);
      setOpenHotspotId(data.hotspotId);
    }
  };

  // Gaze interaction loop: only active in VR/stereo mode. Each frame we look for
  // the marker closest to the centre of the LEFT eye; if one stays centred, a
  // charging reticle fills up and triggers the marker once complete. Looking
  // away resets the charge immediately.
  React.useEffect(() => {
    if (!vrActive) {
      gazeTargetRef.current = null;
      gazeProgressRef.current = 0;
      updateReticles(0, false);
      for (const [, pair] of vrMarkerElsRef.current) {
        pair.left.remove();
        pair.right.remove();
      }
      vrMarkerElsRef.current.clear();
      if (vrCloseElsRef.current) {
        vrCloseElsRef.current.left.remove();
        vrCloseElsRef.current.right.remove();
        vrCloseElsRef.current = null;
      }
      if (vrPopupElsRef.current) {
        vrPopupElsRef.current.left.remove();
        vrPopupElsRef.current.right.remove();
        vrPopupElsRef.current = null;
      }
      return;
    }
    let raf = 0;
    let lastTs = 0;
    const GAZE_DURATION = 1500; // ms to fully charge
    // Angular tolerance (radians) around the centre of the current view. In
    // stereo both eyes look in the same direction, so comparing the view
    // position to each marker's yaw/pitch works for either eye.
    const CENTER_THRESHOLD = 0.14;

    // Update the per-eye reticle charging rings (0..1) and show/hide them
    // depending on whether a gaze target is currently held.
    const RING_LEN = 2 * Math.PI * 28;
    const updateReticles = (p: number, active: boolean) => {
      const refs = vrReticleRefs.current;
      const wraps = vrReticleWrapRef.current;
      if (!refs || !wraps) return;
      const offset = RING_LEN * (1 - p);
      if (refs.left) refs.left.setAttribute('stroke-dashoffset', `${offset}`);
      if (refs.right) refs.right.setAttribute('stroke-dashoffset', `${offset}`);
      const disp = active ? 'block' : 'none';
      wraps.left.style.display = disp;
      wraps.right.style.display = disp;
    };

    const angleDiff = (a: number, b: number) => {
      let d = a - b;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return d;
    };

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      const dt = lastTs ? ts - lastTs : 16;
      lastTs = ts;
      const v = viewerRef.current;
      const markersPlugin = v?.getPlugin(MarkersPlugin) as any;
      const container = containerRef.current;
      const overlay = vrOverlayRef.current;
      if (!v || !markersPlugin || !container || !overlay) return;

      const view = v.getPosition?.() as { yaw: number; pitch: number } | undefined;
      if (!view) return;

      // Use PSV's own size (the space sphericalCoordsToViewerCoords returns) as
      // the SOURCE, but position children in the OVERLAY element's own measured
      // pixel space (which may differ in fullscreen / DPR). Normalise to a
      // fraction of the source size, then map into the overlay size.
      const st: any = (v as any).state ?? {};
      const size: any = st.size ?? {};
      const Wsrc = (typeof size.width === 'number' && size.width > 0)
        ? size.width : (window.innerWidth || container.clientWidth || 1);
      const Hsrc = (typeof size.height === 'number' && size.height > 0)
        ? size.height : (window.innerHeight || container.clientHeight || 1);
      const Wov = overlay.clientWidth || Wsrc;
      const Hov = overlay.clientHeight || Hsrc;
      const halfW = Wov / 2;

      let markers: any[] = [];
      try {
        markers = markersPlugin.getMarkers?.() ?? [];
      } catch { /* ignore */ }

      // PSV markers may expose their spherical position on `.position`, but some
      // Marker instances only populate `config.position` / `state.position`. Read
      // from all known locations so our VR overlay always finds the position.
      const getMarkerPos = (m: any) => m?.position || m?.config?.position || m?.state?.position || null;

      // Update the per-eye VR overlays (kept in sync with PSV markers).
      const seen = new Set<string>();
      for (const m of markers) {
        const pos = getMarkerPos(m);
        if (!pos || typeof pos.yaw !== 'number' || typeof pos.pitch !== 'number') continue;
        // Only draw markers that are actually in front of the current view.
        let visible = true;
        try { visible = Boolean(v.dataHelper.isPointVisible(pos)); } catch { visible = true; }
        if (!visible) {
          const existing = vrMarkerElsRef.current.get(m.id);
          if (existing) {
            existing.left.style.display = 'none';
            existing.right.style.display = 'none';
          }
          seen.add(m.id);
          continue;
        }
        // Mono screen coords from PSV's own helper (uses the main camera +
        // state.size, the same space PSV renders into).
        const screen = v.dataHelper.sphericalCoordsToViewerCoords(pos);
        if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) continue;
        // Normalise the mono screen coords to [0,1] fractions, then map into the
        // overlay's own pixel space. In stereo each eye shows half the horizontal
        // FOV, so the mono fraction fx maps to the left eye at fx - 1/4 and the
        // right eye at fx + 1/4 (each eye is half width, centred at 1/4 / 3/4).
        const fx = screen.x / Wsrc;
        const fy = screen.y / Hsrc;
        const leftX = (fx - 0.25) * Wov;
        const rightX = (fx + 0.25) * Wov;
        const y = fy * Hov;
        if (!Number.isFinite(leftX)) continue;
        seen.add(m.id);
        let pair = vrMarkerElsRef.current.get(m.id);
        if (!pair) {
          const make = () => {
            const el = document.createElement('div');
            el.style.position = 'absolute';
            el.style.transform = 'translate(-50%, -50%)';
            el.style.pointerEvents = 'none';
            el.style.display = 'none';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.width = '40px';
            el.style.height = '40px';
            el.style.borderRadius = '50%';
            el.style.border = '3px solid #fff';
            el.style.background = 'rgba(0,0,0,0.5)';
            el.style.color = '#fff';
            el.style.fontSize = '20px';
            el.style.zIndex = '1355';
            el.style.boxShadow = '0 0 10px rgba(0,0,0,0.7)';
            overlay.appendChild(el);
            return el;
          };
          pair = { left: make(), right: make() };
          vrMarkerElsRef.current.set(m.id, pair);
        }
        const isLink = Boolean(m.data?.target);
        const glyph = isLink ? '➤' : '◆';
        pair.left.textContent = glyph;
        pair.right.textContent = glyph;
        // A marker is only drawn in an eye if it falls inside that eye's half of
        // the screen (each eye sees half the horizontal FOV).
        const leftVisible = visible && leftX >= 0 && leftX <= halfW;
        const rightVisible = visible && rightX >= halfW && rightX <= Wov;
        pair.left.style.left = `${leftX}px`;
        pair.left.style.top = `${y}px`;
        pair.right.style.left = `${rightX}px`;
        pair.right.style.top = `${y}px`;
        pair.left.style.display = leftVisible ? 'flex' : 'none';
        pair.right.style.display = rightVisible ? 'flex' : 'none';
      }
      // Remove overlays whose marker disappeared.
      for (const [id, pair] of vrMarkerElsRef.current) {
        if (!seen.has(id)) {
          pair.left.remove();
          pair.right.remove();
          vrMarkerElsRef.current.delete(id);
        }
      }

      // --- VR hotspot popup card + close cross (✕) ---
      // When a hotspot popup is open in VR, render a card ANCHORED to the
      // hotspot's SPHERICAL position (so it stays fixed relative to the
      // panorama, exactly like the normal interface marker) — NOT fixed to the
      // camera. The close cross sits in the top-right corner of the card and is
      // also a gaze target so the user can dismiss the popup by looking at it.
      const openId = openHotspotIdRef.current;
      // Spherical position of the close cross (top-right of the card), recomputed
      // each frame. Declared here so the gaze-target selection below can see it.
      let closePos: any = null;
      if (openId) {
        // Find the open hotspot's spherical position (reuse its PSV marker so we
        // match the exact anchor used by the normal interface).
        const hsMarker = markers.find((m: any) => m?.data?.hotspotId === openId);
        let hsPos: any = hsMarker ? getMarkerPos(hsMarker) : null;
        if (!hsPos || typeof hsPos.yaw !== 'number') {
          // Fall back to the store's hotspot coordinates.
          const st = useProjectStore.getState();
          const sc = st.scenes.find((s: any) => s.id === st.selectedSceneId);
          const hp = sc?.hotspots?.find((h: any) => h.id === openId);
          if (hp) hsPos = { yaw: hp.yaw, pitch: hp.pitch } as any;
        }
        if (hsPos && typeof hsPos.yaw === 'number') {
          // Build the card HTML once (when the open hotspot changes).
          if (!vrPopupElsRef.current || vrPopupElsRef.current.left.dataset.hid !== openId) {
            const st = useProjectStore.getState();
            const sc = st.scenes.find((s: any) => s.id === st.selectedSceneId);
            const hs = sc?.hotspots?.find((h: any) => h.id === openId);
            const makeCard = () => {
              const el = document.createElement('div');
              el.style.position = 'absolute';
              el.style.transform = 'translate(-50%, -100%)';
              el.style.pointerEvents = 'none';
              el.style.display = 'none';
              el.style.width = 'min(240px, 72vw)';
              el.style.maxHeight = '52vh';
              el.style.overflow = 'auto';
              el.style.background = 'rgba(14,14,16,0.92)';
              el.style.backdropFilter = 'blur(12px)';
              (el.style as any).WebkitBackdropFilter = 'blur(12px)';
              el.style.border = '1px solid rgba(255,255,255,0.12)';
              el.style.borderRadius = '12px';
              el.style.padding = '12px 14px';
              el.style.color = 'white';
              el.style.zIndex = '1355';
              el.style.fontFamily = 'system-ui, sans-serif';
              el.style.display = 'flex';
              el.style.flexDirection = 'column';
              el.style.gap = '8px';
              el.style.boxShadow = '0 8px 28px rgba(0,0,0,0.65)';
              overlay.appendChild(el);
              return el;
            };
            if (!vrPopupElsRef.current) {
              vrPopupElsRef.current = { left: makeCard(), right: makeCard() };
            }
            const buildHtml = (h: any) => {
              const isImage = h.type === 'image' && h.content;
              const isVideo = h.type === 'video';
              const safe = h.content
                ? String(h.content).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                : '';
              const title = h.title
                ? h.title
                : (isVideo ? '🎥 Vidéo' : isImage ? '🖼️ Image' : 'ℹ️ Info');
              const content = isImage
                ? `<img src="${h.content}" alt="" style="width:100%;max-height:180px;object-fit:contain;border-radius:6px;background:#111;display:block;" />`
                : (h.content
                  ? `<p style="margin:0;font-size:0.85rem;line-height:1.5;white-space:pre-wrap;color:#ddd;">${safe}</p>`
                  : `<p style="margin:0;font-size:0.8rem;color:#888;font-style:italic;">Aucun contenu configuré.</p>`);
              return `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                  <span style="font-size:0.92rem;font-weight:600;">${title}</span>
                  <span class="vr-close-x" style="flex-shrink:0;width:26px;height:26px;border-radius:50%;border:2px solid #ff5252;color:#ff5252;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;line-height:1;">✕</span>
                </div>
                ${content}`;
            };
            if (hs) {
              const html = buildHtml(hs);
              vrPopupElsRef.current.left.innerHTML = html;
              vrPopupElsRef.current.right.innerHTML = html;
              vrPopupElsRef.current.left.dataset.hid = openId;
              vrPopupElsRef.current.right.dataset.hid = openId;
            }
          }
          // Project the card anchor (the hotspot point) into each eye.
          const screenH = v.dataHelper.sphericalCoordsToViewerCoords(hsPos);
          if (screenH && Number.isFinite(screenH.x) && Number.isFinite(screenH.y)) {
            const fxh = screenH.x / Wsrc;
            const fyh = screenH.y / Hsrc;
            const leftXh = (fxh - 0.25) * Wov;
            const rightXh = (fxh + 0.25) * Wov;
            const yh = fyh * Hov;
            let visH = true;
            try { visH = Boolean(v.dataHelper.isPointVisible(hsPos)); } catch { visH = true; }
            const leftVisH = visH && leftXh >= 0 && leftXh <= halfW;
            const rightVisH = visH && rightXh >= halfW && rightXh <= Wov;
            const cards = vrPopupElsRef.current;
            cards.left.style.left = `${leftXh}px`;
            cards.left.style.top = `${yh}px`;
            cards.right.style.left = `${rightXh}px`;
            cards.right.style.top = `${yh}px`;
            cards.left.style.display = leftVisH ? 'flex' : 'none';
            cards.right.style.display = rightVisH ? 'flex' : 'none';

            // Close cross position: top-right of the card. The card is anchored
            // with translate(-50%,-100%) at (anchorX, anchorY), so its top-right
            // corner is roughly at anchor + (+W/2, -H). Measure the rendered card.
            const cardW = (cards.left.offsetWidth || 220);
            const cardH = (cards.left.offsetHeight || 120);
            const closeXEye = leftXh + cardW / 2 - 16;
            const closeYEye = yh - cardH + 16;
            // Convert overlay pixel coords back to PSV source coords for the
            // spherical projection used by the gaze loop.
            const closeXSrc = (closeXEye / Wov) * Wsrc;
            const closeYSrc = (closeYEye / Hov) * Hsrc;
            try {
              closePos = v.dataHelper.viewerCoordsToSphericalCoords({ x: closeXSrc, y: closeYSrc });
            } catch { closePos = null; }

            // Draw the red gaze targeting ring on top of the close cross.
            if (!vrCloseElsRef.current) {
              const makeClose = () => {
                const el = document.createElement('div');
                el.style.position = 'absolute';
                el.style.transform = 'translate(-50%, -50%)';
                el.style.pointerEvents = 'none';
                el.style.display = 'none';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                el.style.width = '44px';
                el.style.height = '44px';
                el.style.borderRadius = '50%';
                el.style.border = '3px solid #ff5252';
                el.style.background = 'rgba(0,0,0,0.45)';
                el.style.color = '#ff5252';
                el.style.fontSize = '22px';
                el.style.fontWeight = '700';
                el.style.zIndex = '1360';
                el.style.boxShadow = '0 0 12px rgba(0,0,0,0.7)';
                overlay.appendChild(el);
                return el;
              };
              vrCloseElsRef.current = { left: makeClose(), right: makeClose() };
            }
            const closeEls = vrCloseElsRef.current;
            if (closePos && typeof closePos.yaw === 'number') {
              const screenC = v.dataHelper.sphericalCoordsToViewerCoords(closePos);
              if (screenC && Number.isFinite(screenC.x) && Number.isFinite(screenC.y)) {
                const fxc = screenC.x / Wsrc;
                const fyc = screenC.y / Hsrc;
                const leftXc = (fxc - 0.25) * Wov;
                const rightXc = (fxc + 0.25) * Wov;
                const yc = fyc * Hov;
                let visibleC = true;
                try { visibleC = Boolean(v.dataHelper.isPointVisible(closePos)); } catch { visibleC = true; }
                closeEls.left.textContent = '✕';
                closeEls.right.textContent = '✕';
                closeEls.left.style.left = `${leftXc}px`;
                closeEls.left.style.top = `${yc}px`;
                closeEls.right.style.left = `${rightXc}px`;
                closeEls.right.style.top = `${yc}px`;
                closeEls.left.style.display = (visibleC && leftXc >= 0 && leftXc <= halfW) ? 'flex' : 'none';
                closeEls.right.style.display = (visibleC && rightXc >= halfW && rightXc <= Wov) ? 'flex' : 'none';
              } else {
                closeEls.left.style.display = 'none';
                closeEls.right.style.display = 'none';
              }
            } else {
              closeEls.left.style.display = 'none';
              closeEls.right.style.display = 'none';
            }
          } else {
            vrPopupElsRef.current.left.style.display = 'none';
            vrPopupElsRef.current.right.style.display = 'none';
            if (vrCloseElsRef.current) {
              vrCloseElsRef.current.left.style.display = 'none';
              vrCloseElsRef.current.right.style.display = 'none';
            }
          }
        } else {
          if (vrPopupElsRef.current) {
            vrPopupElsRef.current.left.style.display = 'none';
            vrPopupElsRef.current.right.style.display = 'none';
          }
          if (vrCloseElsRef.current) {
            vrCloseElsRef.current.left.style.display = 'none';
            vrCloseElsRef.current.right.style.display = 'none';
          }
        }
      } else {
        if (vrPopupElsRef.current) {
          vrPopupElsRef.current.left.remove();
          vrPopupElsRef.current.right.remove();
          vrPopupElsRef.current = null;
        }
        if (vrCloseElsRef.current) {
          vrCloseElsRef.current.left.remove();
          vrCloseElsRef.current.right.remove();
          vrCloseElsRef.current = null;
        }
      }

      let best: { id: string; data: any; dist: number } | null = null;
      for (const m of markers) {
        const pos = getMarkerPos(m);
        if (!pos || typeof pos.yaw !== 'number' || typeof pos.pitch !== 'number') continue;
        const dyaw = angleDiff(view.yaw, pos.yaw);
        const dpitch = view.pitch - pos.pitch;
        const dist = Math.hypot(dyaw, dpitch);
        if (dist < CENTER_THRESHOLD && (!best || dist < best.dist)) {
          best = { id: m.id, data: m.data ?? {}, dist };
        }
      }

      // The VR "close popup" cross is also a gaze target when a popup is open.
      if (openId && closePos && typeof closePos.yaw === 'number') {
        const dyaw = angleDiff(view.yaw, closePos.yaw);
        const dpitch = view.pitch - closePos.pitch;
        const dist = Math.hypot(dyaw, dpitch);
        if (dist < CENTER_THRESHOLD && (!best || dist < best.dist)) {
          best = { id: 'vr-close', data: {}, dist };
        }
      }

      const currentTarget = gazeTargetRef.current;
      const currentProgress = gazeProgressRef.current;

      if (!best) {
        // Looked away: reset immediately.
        if (currentTarget !== null || currentProgress !== 0) {
          gazeTargetRef.current = null;
          gazeProgressRef.current = 0;
          updateReticles(0, false);
        }
        return;
      }

      if (best.id !== currentTarget) {
        gazeTargetRef.current = best.id;
        gazeProgressRef.current = 0;
        updateReticles(0, false);
        return;
      }

      // Same target kept centred: charge.
      const next = Math.min(1, currentProgress + dt / GAZE_DURATION);
      gazeProgressRef.current = next;
      updateReticles(next, true);
      if (next >= 1) {
        gazeTargetRef.current = null;
        gazeProgressRef.current = 0;
        updateReticles(0, false);
        if (best.id === 'vr-close') {
          setOpenHotspotId(null);
        } else {
          triggerMarker(best.data);
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [vrActive]);

  // In VR, the normal PSV markers (the blue hotspot dots / white link arrows of
  // the standard interface) must NOT be visible — only our per-eye targeting
  // points are. The stereo plugin already hides markers on start(), but we
  // reinforce it here so they can never bleed through during the transition.
  React.useEffect(() => {
    if (!viewerRef.current) return;
    const markersPlugin = viewerRef.current.getPlugin(MarkersPlugin) as any;
    if (!markersPlugin) return;
    if (vrActive) {
      try { markersPlugin.hideAllMarkers(); } catch { /* ignore */ }
    } else {
      try { markersPlugin.showAllMarkers(); } catch { /* ignore */ }
    }
  }, [vrActive]);


  // in the background, then reveal it directly once ready.
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionInProgress = useRef(false);

  // Resolve the name of the target project for project-link scenes
  useEffect(() => {
    if (selectedScene?.type === 'project-link' && selectedScene.targetProjectId) {
      listCloudProjects()
        .then(projects => {
          const found = projects.find(p => p.id === selectedScene.targetProjectId);
          setTargetProjectTitle(found?.title ?? selectedScene.targetProjectId ?? null);
        })
        .catch(() => setTargetProjectTitle(selectedScene.targetProjectId ?? null));
    } else {
      setTargetProjectTitle(null);
    }
  }, [selectedScene?.type, selectedScene?.targetProjectId]);

  const toggleMoveMode = () => {
    if (isMovingHotspot) {
      setIsMovingHotspot(false);
      useProjectStore.getState().selectHotspot(null);
    } else {
      setIsMovingHotspot(true);
    }
  };

  // Build the panorama config: a 360° video when available, otherwise the image.
  const getPanorama = (scene: typeof selectedScene) => {
    if (scene?.video) return { source: scene.video };
    return scene?.image;
  };

  // (Re)create the PSV viewer instance with the current scene.
  const createViewer = () => {
    if (!containerRef.current) return;

      const plugins: any[] = [[MarkersPlugin, {}]];
      // The PSV adapter is fixed for the lifetime of the viewer, so the video
      // adapter (and the VideoPlugin that requires it) can only be used when
      // the current scene is a 360° video. Switching between image and video
      // scenes re-creates the viewer (see the scene effect below).
      const isCurrentVideo = Boolean(selectedScene?.video);
      if (isCurrentVideo) {
        plugins.push([VideoPlugin, {}]);
      }
      // VR plugins (mobile): gyroscope look-around + stereoscopic cardboard view.
      if (vrEnabled) {
        plugins.push([GyroscopePlugin, {}]);
        plugins.push([StereoPlugin, {}]);
      }

      viewerRef.current = new Viewer({
        container: containerRef.current,
        panorama: getPanorama(selectedScene),
        plugins,
        navbar: true,
        ...(isCurrentVideo
          ? { adapter: [EquirectangularVideoAdapter, { muted: false, autoplay: true }] }
          : {}),
      });

      if (isCurrentVideo && selectedScene?.video) {
        const vurl = selectedScene.video;
        console.log('[SphereViewer] video url', vurl);

        // The VideoPlugin starts playback on the PanoramaLoadedEvent. When the
        // viewer is created directly with a video panorama, that event can be
        // emitted before the plugin subscribes, leaving the video paused/blank.
        // Reload the panorama on the next tick so the plugin catches the event
        // and starts playback. Fallback: force play() shortly after.
        const vViewer = viewerRef.current;
        window.setTimeout(() => {
          if (!viewerRef.current) return;
          viewerRef.current
            .setPanorama({ source: vurl }, { transition: false, adapter: EquirectangularVideoAdapter } as any)
            .catch(() => {});
        }, 0);

        const tryPlay = () => {
          const vp: any = vViewer.getPlugin(VideoPlugin);
          console.log('[SphereViewer] tryPlay', {
            hasPlugin: Boolean(vp),
            hasVideo: Boolean(vp?.video),
            paused: vp?.video?.paused,
          });
          if (vp?.video?.paused) vp.video.play().catch((e: any) => console.log('[SphereViewer] play error', e));
          else if (vp && typeof vp.play === 'function') vp.play();
        };
        vViewer.addEventListener('panorama-loaded', () => {
          console.log('[SphereViewer] panorama-loaded (video)');
          tryPlay();
        });
        window.setTimeout(tryPlay, 800);
        window.setTimeout(tryPlay, 2000);
      }

      console.log('[SphereViewer] createViewer', {
        isCurrentVideo,
        panorama: getPanorama(selectedScene),
        hasVideoPlugin: isCurrentVideo,
      });

    // Keep the PSV navbar always visible (it is hidden by default and only
    // revealed on tap, especially on touch devices). Use the public API and
    // re-apply on a short interval so PSV's own toggling cannot hide it.
    const showNavbar = () => {
      try {
        const navbar = viewerRef.current?.navbar;
        if (!navbar) return;
        // In VR the classic viewer navbar (zoom/fullscreen/VR buttons) must stay
        // hidden — only the dedicated VR interface (reticles + per-eye overlay)
        // should be visible until VR is turned off.
        if (vrActiveRef.current) navbar.hide();
        else navbar.show();
      } catch { /* ignore */ }
    };

    // Signal the map that the scene finished loading (used to end the
    // path-travel animation when the destination is reached).
    viewerRef.current.addEventListener('panorama-loaded', () => {
      showNavbar();
      setSceneLoading(false);
    });

    // Keep `vrActive` in sync with the real stereo state. The VR button forces
    // `vrActive(true)` optimistically on click so the interface appears instantly;
    // this poll only REINFORCES it when stereo actually becomes enabled. It never
    // hides the interface on its own (the button's "quit" handler does that), so
    // the UI stays visible from the moment the user taps the VR button.
    let vrPollTimer: number | undefined;
    const syncVr = () => {
      const stereo = viewerRef.current?.getPlugin('stereo') as any;
      if (stereo?.isEnabled?.()) setVrActive(true);
    };
    vrPollTimer = window.setInterval(syncVr, 150);
    vrPollTimerRef.current = vrPollTimer;

    showNavbar();
    const navbarInterval = window.setInterval(showNavbar, 500);
    navbarIntervalRef.current = navbarInterval;

    const markersPlugin = viewerRef.current.getPlugin(MarkersPlugin) as any;

    viewerRef.current.addEventListener('position-updated', (e: any) => {
      const yaw = e.position?.yaw ?? e.args?.[0]?.yaw;
      if (yaw !== undefined) {
        useProjectStore.getState().setCurrentYaw(yaw);
      }
    });

    // Click on empty sphere: used for "Add Hotspot" mode (marker clicks are
    // handled separately via the MarkersPlugin 'select-marker' event).
    viewerRef.current.addEventListener('click', (e: any) => {
      const state = useProjectStore.getState();
      const moving = state.isMovingHotspot;
      const deleting = state.isDeletingHotspot;
      if (moving || deleting) {
        const hotspotId = e.marker?.data?.hotspotId;
        if (hotspotId) {
          if (deleting) {
            if (state.selectedSceneId) state.removeHotspot(state.selectedSceneId, hotspotId);
          } else {
            state.selectHotspot(hotspotId);
          }
          e.preventDefault();
          return;
        }
      }

      // Click on empty sphere while in "Add Hotspot" mode -> create a hotspot
      if (state.isAddingHotspot && state.selectedSceneId && !e.marker) {
        const newHotspot: Hotspot = {
          id: 'hotspot-' + Date.now(),
          type: 'text',
          yaw: e.data.yaw,
          pitch: e.data.pitch,
          content: 'Nouveau Hotspot'
        };
        state.addHotspot(state.selectedSceneId, newHotspot);
        state.setIsAddingHotspot(false);
        state.selectHotspot(newHotspot.id);
        setOpenHotspotId(newHotspot.id);
        e.preventDefault();
        return;
      }
    });

    markersPlugin.addEventListener('unselect-marker', (e: any) => {
      if (useProjectStore.getState().isMovingHotspot) {
        e.preventDefault();
      }
    });

    // Marker click (links + hotspots) — robust, doesn't depend on window globals
    markersPlugin.addEventListener('select-marker', (e: any) => {
      triggerMarker(e.marker?.data ?? {});
    });

    // Start audio for the initial viewpoint once the viewer is ready.
    playSceneAudio();
    currentIsVideoRef.current = Boolean(selectedScene?.video);
  };

  // Initialize the viewer when the first panorama is loaded, or update it when the panorama changes.
  useEffect(() => {
    if (!containerRef.current) return;
    if (!selectedScene?.image && !selectedScene?.video) return; // Wait until the project has a valid scene

    const isVideo = Boolean(selectedScene?.video);
    console.log('[SphereViewer] scene effect', {
      sceneId: selectedScene?.id,
      isVideo,
      currentIsVideo: currentIsVideoRef.current,
      hasViewer: Boolean(viewerRef.current),
      video: selectedScene?.video,
      image: selectedScene?.image,
    });

    if (!viewerRef.current) {
      createViewer();
      setViewerEpoch((e) => e + 1);
      return;
    }

    // The PSV adapter and the VR plugins are fixed at viewer creation. Switching
    // between an image and a video scene, or toggling VR mode, requires
    // re-creating the viewer.
    if (currentIsVideoRef.current !== isVideo || vrEnabledRef.current !== vrEnabled) {
      console.log('[SphereViewer] recreating viewer (type or VR changed)');
      setSceneLoading(true);
      try {
        viewerRef.current.destroy();
      } catch {
        // VideoPlugin's navbar buttons can throw on destroy in some versions.
      }
      viewerRef.current = null;
      // Always clear the container so a previous canvas (image or video) never
      // remains displayed behind the newly created viewer.
      if (containerRef.current) {
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }
      }
      createViewer();
      currentIsVideoRef.current = isVideo;
      setViewerEpoch((e) => e + 1);
      vrEnabledRef.current = vrEnabled;
      setVrActive(false);
      return;
    }

    // Same type: smoothly swap the panorama in place.
    if (transitionInProgress.current) return;
    setOpenHotspotId(null);
    setPanoramaError(null);

    const viewer = viewerRef.current;
    if (!viewer) return;
    transitionInProgress.current = true;
    setIsTransitioning(true);
    setSceneLoading(true);

    // Pause any playing audio during the transition.
    audioRef.current?.pause();

    // 1. Freeze the current view and zoom-in slightly, as if we were moving
    // forward into the next viewpoint.
    const baseZoom = viewer.getZoomLevel();
    viewer.zoom(Math.min(100, baseZoom + 35));

    // 2. Load the next panorama in the background, fully preloaded and hidden
    // (no fade, no loader). The view stays frozen on the current frame.
    const reveal = () => {
      transitionInProgress.current = false;
      setIsTransitioning(false);
      setSceneLoading(false);
      // 3. The new panorama is ready: reveal it directly, keeping the
      // zoomed-in level so the next view stays advanced (no zoom-out),
      // then (re)start the appropriate audio track for this viewpoint.
      playSceneAudio();
    };

    // Give the zoom-in animation a brief moment before swapping the panorama.
    window.setTimeout(() => {
      viewer
        .setPanorama(getPanorama(selectedScene), {
          transition: false,
          showLoader: false,
          zoom: Math.min(100, viewer.getZoomLevel()),
          adapter: isVideo ? EquirectangularVideoAdapter : undefined,
        } as any)
        .then(() => {
          reveal();
        })
        .catch((err) => {
          console.error('Failed to set panorama for URL:', selectedScene?.image ?? selectedScene?.video, err);
          setPanoramaError(selectedScene?.image ?? selectedScene?.video ?? null);
          reveal();
        });
    }, 320);
  }, [selectedScene?.image, selectedScene?.video, vrEnabled]);

  // Clean up the navbar-visibility and VR-polling intervals when the scene
  // effect re-runs.
  useEffect(() => {
    return () => {
      if (navbarIntervalRef.current) {
        window.clearInterval(navbarIntervalRef.current);
        navbarIntervalRef.current = null;
      }
      if (vrPollTimerRef.current) {
        window.clearInterval(vrPollTimerRef.current);
        vrPollTimerRef.current = undefined;
      }
    };
  }, [selectedScene?.image, selectedScene?.video, vrEnabled]);

  // Clean up the viewer only on component unmount
  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch {
          // VideoPlugin's navbar buttons can throw on destroy in some versions;
          // ignore so React unmount does not crash.
        }
        viewerRef.current = null;
      }
    };
  }, []);

  // Sync all markers (links + hotspot icons + open popup card) in the sphere
  useEffect(() => {
    if (!viewerRef.current) return;
    const markersPlugin = viewerRef.current.getPlugin(MarkersPlugin) as any;
    if (!markersPlugin) return;

    markersPlugin.clearMarkers();

    // --- Global callbacks called from inside marker HTML ---
    markersPlugin.addEventListener('stop-dragging', (e: any) => {
      if (!isMovingHotspot) return;
      const hotspotId = e.marker.data?.hotspotId;
      if (hotspotId) {
        useProjectStore.getState().updateHotspot(selectedScene!.id, hotspotId, {
          yaw: e.marker.position.yaw,
          pitch: e.marker.position.pitch,
        });
      }
    });

    (window as any).selectPSVScene = (targetId: string) => {
      const state = useProjectStore.getState();
      const targetScene = state.scenes.find(s => s.id === targetId);

      // If the target is a project-link in viewer mode, navigate directly to the other project
      if (state.mode === 'viewer' && targetScene?.type === 'project-link' && targetScene.targetProjectId) {
        const url = new URL(window.location.href);
        url.searchParams.set('id', targetScene.targetProjectId);
        window.location.href = url.toString();
        return;
      }

      state.selectScene(targetId);
    };

    (window as any).openPSVHotspot = (hotspotId: string) => {
      useProjectStore.getState().selectHotspot(hotspotId);
      setOpenHotspotId(hotspotId);
    };

    (window as any).closePSVHotspot = () => {
      setOpenHotspotId(null);
    };

    (window as any).openPSVFullscreen = (url: string) => {
      setFullscreenImageUrl(url);
    };

    (window as any).openPSVFullscreenVideo = (url: string) => {
      setFullscreenVideoUrl(url);
    };

    // --- Navigation links ---
    if (selectedScene?.links) {
      selectedScene.links.forEach((link) => {
        const targetScene = scenes.find(s => s.id === link.target);
        if (!targetScene) return;
        const showTitle = targetScene.showTitleInViewer !== false;

        markersPlugin.addMarker({
          id: `link-${link.target}`,
          position: { yaw: link.yaw, pitch: link.pitch },
          html: `
            <div style="text-align:center;cursor:pointer;user-select:none;" onclick="window.selectPSVScene('${link.target}')">
              ${showTitle ? `
                <div style="background:rgba(20,20,20,0.85);color:white;padding:4px 10px;border-radius:12px;font-size:11px;font-family:sans-serif;margin-bottom:6px;white-space:nowrap;border:1px solid rgba(255,255,255,0.15);box-shadow:0 2px 6px rgba(0,0,0,0.4);display:inline-block;">
                  ${targetScene.title}
                </div>
              ` : ''}
              <div style="width:34px;height:34px;background:rgba(255,255,255,0.95);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.5);margin:0 auto;transition:transform 0.2s;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </div>
            </div>
          `,
          data: { target: link.target }
        });
      });
    }

    // --- Hotspot icons + popup card (rendered as PSV markers = follows sphere) ---
    if (selectedScene?.hotspots) {
      selectedScene.hotspots.forEach((hotspot) => {
        const isOpen = hotspot.id === openHotspotId;
        const isSelectedMove = isMovingHotspot && hotspot.id === selectedHotspotId;
        const embedUrl = hotspot.type === 'video' ? getYoutubeEmbedUrl(hotspot.content) : null;

        // Icon marker (always visible). The popup is embedded as a CSS-positioned
        // child so it always floats a FIXED pixel distance above the icon — constant
        // regardless of the hotspot's position on the sphere or the card's height.
        let contentHtml = '';
        if (hotspot.type === 'video') {
          if (embedUrl) {
            // YouTube Video
            contentHtml = `
              <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:6px;margin-top:2px;">
                <iframe
                  src="${embedUrl}?autoplay=1"
                  style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                ></iframe>
              </div>
            `;
          } else {
            // Local/Direct Video
            contentHtml = `
              <div style="position:relative; margin-top:2px; border-radius:6px; overflow:hidden; background:#000;">
                <video
                  src="${hotspot.content}"
                  controls
                  controlsList="nofullscreen"
                  disablePictureInPicture
                  autoplay
                  style="width:100%; display:block;"
                >
                  Your browser does not support the video tag.
                </video>
                <button
                  onclick="window.openPSVFullscreenVideo('${hotspot.content.replace(/'/g, "\\'")}')"
                  onpointerdown="event.stopPropagation()"
                  onpointerup="event.stopPropagation();window.openPSVFullscreenVideo('${hotspot.content.replace(/'/g, "\\'")}')"
                  style="
                    position:absolute;top:6px;right:6px;
                    background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.25);
                    color:white;border-radius:6px;cursor:pointer;
                    width:28px;height:28px;display:flex;align-items:center;justify-content:center;
                    backdrop-filter:blur(4px);transition:background 0.15s;
                  "
                  title="Plein écran"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <polyline points="9 21 3 21 3 15"></polyline>
                    <line x1="21" y1="3" x2="14" y2="10"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </svg>
                </button>
              </div>
            `;
          }
        } else if (hotspot.type === 'image') {
          if (hotspot.content) {
            contentHtml = `
              <div style="border-radius:6px;overflow:hidden;margin-top:2px;position:relative;">
                <img
                  src="${hotspot.content}"
                  alt="hotspot image"
                  style="width:100%;max-height:200px;object-fit:contain;display:block;background:#111;"
                  onerror="this.style.display='none';this.nextSibling.style.display='block';"
                />
                <p style="display:none;margin:0;font-size:0.82rem;color:#888;font-style:italic;">Image non disponible.</p>
                <button
                  onclick="window.openPSVFullscreen('${hotspot.content.replace(/'/g, "\\'")}')"
                  onpointerdown="event.stopPropagation()"
                  onpointerup="event.stopPropagation();window.openPSVFullscreen('${hotspot.content.replace(/'/g, "\\'")}')"
                  style="
                    position:absolute;top:6px;right:6px;
                    background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.25);
                    color:white;border-radius:6px;cursor:pointer;
                    width:28px;height:28px;display:flex;align-items:center;justify-content:center;
                    backdrop-filter:blur(4px);transition:background 0.15s;
                  "
                  title="Plein écran"
                  onmouseover="this.style.background='rgba(255,255,255,0.2)'"
                  onmouseout="this.style.background='rgba(0,0,0,0.6)'"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <polyline points="9 21 3 21 3 15"></polyline>
                    <line x1="21" y1="3" x2="14" y2="10"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </svg>
                </button>
              </div>
            `;
          } else {
            contentHtml = `<p style="margin:0;font-size:0.82rem;color:#888;font-style:italic;">Aucune image configurée. Éditez dans le panneau de droite.</p>`;
          }
        } else {
          // Escape HTML entities in text content
          const safe = hotspot.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          contentHtml = `<p style="margin:0;font-size:0.88rem;line-height:1.55;white-space:pre-wrap;color:#ddd;">${safe}</p>`;
        }

        const popupHtml = isOpen ? `
          <div class="psv-hotspot-popup" onclick="event.stopPropagation();" style="
            position:absolute;
            top:50%;
            left:50%;
            transform: translate(-50%, -50%);
            width:min(300px, 80vw);
            max-height:60vh;
            overflow:auto;
            background:rgba(14,14,16,0.92);
            backdrop-filter:blur(12px);
            -webkit-backdrop-filter:blur(12px);
            border:1px solid rgba(255,255,255,0.12);
            border-radius:10px;
            padding:11px 13px;
            box-shadow:0 8px 28px rgba(0,0,0,0.65);
            color:white;
            display:flex;flex-direction:column;gap:8px;
            pointer-events:auto;
            font-family: system-ui, sans-serif;
          ">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <span style="font-size:0.92rem;font-weight:600;color:#fff;">
                ${hotspot.title
                  ? hotspot.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  : (hotspot.type === 'video' ? '🎥 Vidéo' : hotspot.type === 'image' ? '🖼️ Image' : 'ℹ️ Info')}
              </span>
              <button
                 onclick="event.stopPropagation();window.closePSVHotspot()"
                 onpointerdown="event.stopPropagation()"
                 onpointerup="event.stopPropagation();window.closePSVHotspot()"
                style="background:none;border:none;color:#666;font-size:1rem;cursor:pointer;padding:2px 5px;border-radius:3px;line-height:1;flex-shrink:0;"
              >✕</button>
            </div>
            ${contentHtml}
            <!-- Triangle pointer toward the icon below -->
            <div style="
              position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);
              width:0;height:0;
              border-left:7px solid transparent;
              border-right:7px solid transparent;
              border-top:7px solid rgba(14,14,16,0.92);
            "></div>
          </div>
        ` : '';

        markersPlugin.addMarker({
          id: hotspot.id,
          position: { yaw: hotspot.yaw, pitch: hotspot.pitch },
          draggable: false, // Disabling Photo-Sphere-Viewer native dragging as we handle it ourselves
          zIndex: isOpen ? 1000 : 1,
          html: `
            <div
              id="marker-${hotspot.id}"
              class="psv-hotspot-marker"
              data-hotspot-id="${hotspot.id}"
              style="
                position:relative;
                width:34px;height:34px;
                background:${accentColor};
                color:white;border:2.5px solid white;
                border-radius:50%;display:flex;align-items:center;justify-content:center;
                font-size:16px;box-shadow:0 2px 10px rgba(0,0,0,0.55);
                cursor:${isMovingHotspot ? (isSelectedMove ? 'crosshair' : 'grab') : 'pointer'};
                user-select:none;
                transition: transform 0.15s;
                ${isOpen ? 'outline: 2px solid white; outline-offset: 2px;' : ''}
              "
            >${hotspotIconSvg(hotspot.type)}${popupHtml}</div>
          `,
          data: { hotspotId: hotspot.id }
        });
      });
    }

    // In VR the classic panorama navigation (blue hotspot dots / link arrows)
    // must NEVER be visible — only our per-eye targeting overlay is. Markers are
    // still kept in the plugin (so the gaze loop can read their positions), but
    // hidden visually. This must run after every re-sync (e.g. when a popup is
    // opened/closed), otherwise the native markers would reappear.
    if (vrActiveRef.current) {
      try { markersPlugin.hideAllMarkers(); } catch { /* ignore */ }
    }
  }, [selectedScene?.links, selectedScene?.hotspots, scenes, openHotspotId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const cursor =
      isAddingHotspot || (isMovingHotspot && selectedHotspotId)
        ? addHotspotCursor
        : '';
    containerRef.current.style.cursor = cursor;
    containerRef.current.querySelectorAll<HTMLElement>('*').forEach((element) => {
      element.style.cursor = cursor;
    });
  }, [addHotspotCursor, isAddingHotspot, isMovingHotspot, selectedHotspotId]);

  // Manage drag and drop using pointer events globally inside the viewer
  useEffect(() => {
    if (!viewerRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    let dragHotspotId: string | null = null;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const markerEl = target.closest('.psv-marker');
      // Ignore presses on the popup card so its buttons work and never start a drag
      if (markerEl && target.closest('.psv-hotspot-popup')) return;
      if (markerEl) {
        const innerEl = markerEl.querySelector('.psv-hotspot-marker');
        if (innerEl) {
          const hotspotId = innerEl.getAttribute('data-hotspot-id');
          if (hotspotId) {
            if (isMovingHotspot) {
              dragHotspotId = hotspotId;
              useProjectStore.getState().selectHotspot(hotspotId);
              container.style.cursor = 'grabbing';
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isMovingHotspot || !dragHotspotId) return;
      const state = useProjectStore.getState();
      if (!state.selectedSceneId) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const spherical = viewerRef.current?.dataHelper.viewerCoordsToSphericalCoords({ x, y });
      if (spherical) {
        state.updateHotspot(state.selectedSceneId, dragHotspotId, {
          yaw: spherical.yaw,
          pitch: spherical.pitch,
        });
      }
      e.preventDefault();
      e.stopPropagation();
    };

    const handlePointerUp = () => {
      if (dragHotspotId) {
        dragHotspotId = null;
        container.style.cursor = isMovingHotspot ? addHotspotCursor : '';
      }
    };

    container.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', handlePointerUp, true);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', handlePointerUp, true);
    };
  }, [isMovingHotspot, addHotspotCursor]);

  useEffect(() => {
    (window as any).__isMovingHotspot = isMovingHotspot;
    (window as any).__setIsMovingHotspot = setIsMovingHotspot;
  }, [isMovingHotspot, selectedHotspotId]);

  // Close fullscreen on Escape key
  useEffect(() => {
    if (!fullscreenImageUrl && !fullscreenVideoUrl) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenImageUrl(null);
        setFullscreenVideoUrl(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreenImageUrl, fullscreenVideoUrl]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Fullscreen image overlay */}
      {fullscreenImageUrl && (
        <div
          onClick={() => setFullscreenImageUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.18s ease',
          }}
        >
          <img
            src={fullscreenImageUrl}
            alt="Plein écran"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '92vh',
              objectFit: 'contain',
              borderRadius: '10px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            }}
          />
          <button
            onClick={() => setFullscreenImageUrl(null)}
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '1.1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            title="Fermer (Echap)"
          >
            ✕
          </button>
        </div>
      )}

      {/* Fullscreen video overlay (in-app, controls stay accessible) */}
      {fullscreenVideoUrl && (
        <div
          onClick={() => setFullscreenVideoUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.18s ease',
          }}
        >
          <video
            src={fullscreenVideoUrl}
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '82vh',
              width: '100%',
              objectFit: 'contain',
              borderRadius: '10px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
              background: '#000',
            }}
          />
          <button
            onClick={() => setFullscreenVideoUrl(null)}
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '1.1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            title="Fermer (Echap)"
          >
            ✕
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          cursor: isAddingHotspot || isMovingHotspot ? addHotspotCursor : undefined,
          transition: 'transform 0.32s ease-out, filter 0.32s ease-out',
          transform: isTransitioning ? 'scale(1.16)' : 'scale(1)',//scale des trasitions
          filter: isTransitioning ? 'brightness(0.7)' : 'brightness(1)',
        }}
      />

      {/* Hidden audio element: plays the viewpoint/project ambient track */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      {/* Audio controls: only shown when a track is available (viewpoint or project).
          Aligned vertically with the project title and horizontally centered on the map circle. */}
      {hasAudio && (
        <div
          style={{
            position: 'absolute',
            top: '15px',
            right: 'calc(32px + min(22vw, 264px) - 150px)',
            transform: 'translateX(-50%)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(14,14,16,0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '999px',
            padding: '6px 12px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <button
            onClick={() => setAudioMuted((m) => !m)}
            title={audioMuted ? 'Activer le son' : 'Couper le son'}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '0 2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {audioMuted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={audioMuted ? 0 : audioVolume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setAudioVolume(v);
              if (v > 0 && audioMuted) setAudioMuted(false);
            }}
            title="Niveau audio"
            style={{ width: '110px', accentColor: accentColor, cursor: 'pointer' }}
          />
        </div>
      )}

      {/* Scene transition loader (next viewpoint loading in the background) */}
      {isTransitioning && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.25)',
              borderTopColor: 'rgba(255,255,255,0.9)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}


      {selectedScene?.type === 'project-link' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1500,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            background: '#141416',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <span style={{ fontSize: '3.5rem', filter: 'drop-shadow(0 0 10px rgba(156,39,176,0.3))' }}>🔗</span>
          <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e0aaff' }}>{selectedScene.title || 'Lien Projet'}</span>
          <span style={{ fontSize: '0.95rem', color: '#aaa', maxWidth: '320px', lineHeight: 1.4 }}>
            Projet cible : <strong style={{ color: '#e0aaff' }}>{targetProjectTitle ?? '—'}</strong>
          </span>
        </div>
      )}

      {panoramaError && selectedScene?.type !== 'project-link' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            background: 'rgba(0,0,0,0.85)',
            color: '#ffcdd2',
            fontSize: '0.95rem',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <span>Le panorama n'a pas pu être chargé.</span>
          <span style={{ fontSize: '0.75rem', color: '#888', wordBreak: 'break-all', maxWidth: '90%' }}>
            {panoramaError}
          </span>
        </div>
      )}

      {/* Hotspot floating tools (editor only) — same pill style as the map controls */}
      {selectedSceneId && selectedScene?.type !== 'project-link' && mode === 'editor' && (
        <div style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => {
              setIsAddingHotspot(!isAddingHotspot);
              setIsMovingHotspot(false);
            }}
            title="Ajouter un hotspot"
            style={mapControlButtonStyle(isAddingHotspot, '#d32f2f', accentColor)}
          >
            <IconPlus /> Add Hotspot
          </button>
          <button
            onClick={toggleMoveMode}
            title="Déplacer un hotspot"
            style={mapControlButtonStyle(isMovingHotspot, '#28a745', 'rgba(0,0,0,0.55)')}
          >
            <IconMove /> Move Hotspot
          </button>
          <button
            onClick={() => {
              setIsDeletingHotspot(!isDeletingHotspot);
              setIsAddingHotspot(false);
              setIsMovingHotspot(false);
            }}
            title="Supprimer un hotspot"
            style={mapControlButtonStyle(isDeletingHotspot, '#d32f2f', 'rgba(189, 1, 1, 0.76)')}
          >
            <IconTrash /> Delete Hotspot
          </button>
        </div>
      )}

      {/* VR button (mobile only): start the stereoscopic + gyroscope experience */}
      {vrEnabled && isMobile && (
        <button
          onClick={() => {
            const v = viewerRef.current;
            if (!v) return;
            const stereo = v.getPlugin('stereo') as any;
            if (!stereo) return;
            // Show the VR interface IMMEDIATELY on click (optimistic), so the
            // per-eye overlay + reticles appear right away regardless of how the
            // gyroscope/fullscreen permission resolves. The polling of
            // `stereo.isEnabled()` then keeps `vrActive` in sync with the real
            // stereo state afterwards.
            if (!vrActive) {
              setVrActive(true);
              try { stereo.start?.(); } catch { /* ignore */ }
            } else {
              setVrActive(false);
              try { stereo.stop?.(); } catch { /* ignore */ }
            }
          }}
          title={vrActive ? 'Quitter le mode VR' : 'Mode VR (casque cardboard)'}
          className="viewer-vr-button"
          style={{
            position: 'absolute',
            bottom: isMobile ? '60px' : '15px',
            right: '15px',
            zIndex: 2200,
            width: isMobile ? '52px' : '52px',
            height: isMobile ? '52px' : '52px',
            borderRadius: '50%',
            border: vrActive ? '2px solid white' : `1px solid ${accentColor}`,
            background: accentColor,
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 0 3px ${accentColor}59, 0 4px 14px rgba(0,0,0,0.5)`,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="10" rx="3" />
            <circle cx="7.5" cy="12" r="2" />
            <circle cx="16.5" cy="12" r="2" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SphereViewer;
