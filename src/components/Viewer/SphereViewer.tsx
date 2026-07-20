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
  const [panoramaError, setPanoramaError] = useState<string | null>(null);
  const [targetProjectTitle, setTargetProjectTitle] = useState<string | null>(null);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const [fullscreenVideoUrl, setFullscreenVideoUrl] = useState<string | null>(null);
  const [vrActive, setVrActive] = useState(false);

  // Gaze interaction (VR / stereo mode only): a reticle at the centre of the
  // left eye fills up while the user keeps looking at a marker; once full it
  // triggers the same action as a click.
  const [gazeProgress, setGazeProgress] = useState(0);
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
      setGazeProgress(0);
      return;
    }
    let raf = 0;
    let lastTs = 0;
    const GAZE_DURATION = 1500; // ms to fully charge
    const CENTER_THRESHOLD = 70; // px tolerance around the left-eye centre

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      const dt = lastTs ? ts - lastTs : 16;
      lastTs = ts;
      const v = viewerRef.current;
      const markersPlugin = v?.getPlugin(MarkersPlugin) as any;
      const container = containerRef.current;
      if (!v || !markersPlugin || !container) return;

      const cw = container.clientWidth;
      const ch = container.clientHeight;
      // In stereo mode the screen is split in two; the left eye centre is at
      // a quarter of the width (not half).
      const cx = cw / 4;
      const cy = ch / 2;

      let best: { id: string; data: any; dist: number } | null = null;
      try {
        const markers = markersPlugin.getMarkers?.() ?? [];
        for (const m of markers) {
          const pos = m.position;
          if (!pos || typeof pos.yaw !== 'number' || typeof pos.pitch !== 'number') continue;
          const screen = v.dataHelper.sphericalCoordsToViewerCoords(pos);
          const dist = Math.hypot(screen.x - cx, screen.y - cy);
          if (dist < CENTER_THRESHOLD && (!best || dist < best.dist)) {
            best = { id: m.id, data: m.data ?? {}, dist };
          }
        }
      } catch { /* ignore */ }

      const currentTarget = gazeTargetRef.current;
      const currentProgress = gazeProgressRef.current;

      if (!best) {
        // Looked away: reset immediately.
        if (currentTarget !== null || currentProgress !== 0) {
          gazeTargetRef.current = null;
          gazeProgressRef.current = 0;
          setGazeProgress(0);
        }
        return;
      }

      if (best.id !== currentTarget) {
        gazeTargetRef.current = best.id;
        gazeProgressRef.current = 0;
        setGazeProgress(0);
        return;
      }

      // Same target kept centred: charge.
      const next = Math.min(1, currentProgress + dt / GAZE_DURATION);
      gazeProgressRef.current = next;
      setGazeProgress(next);
      if (next >= 1) {
        const data = best.data;
        gazeTargetRef.current = null;
        gazeProgressRef.current = 0;
        setGazeProgress(0);
        triggerMarker(data);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
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
        viewerRef.current?.navbar?.show?.();
      } catch { /* ignore */ }
    };

    // Signal the map that the scene finished loading (used to end the
    // path-travel animation when the destination is reached).
    viewerRef.current.addEventListener('panorama-loaded', () => {
      showNavbar();
      setSceneLoading(false);
    });
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

  // Clean up the navbar-visibility interval when the scene effect re-runs.
  useEffect(() => {
    return () => {
      if (navbarIntervalRef.current) {
        window.clearInterval(navbarIntervalRef.current);
        navbarIntervalRef.current = null;
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

      {/* VR gaze reticle: a charging ring at the centre of the LEFT eye. Only
          shown in stereo/VR mode; it fills while the user looks at a marker and
          triggers it when complete. */}
      {vrActive && (
        <div
          style={{
            position: 'absolute',
            left: '25%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1400,
            pointerEvents: 'none',
            width: '64px',
            height: '64px',
          }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="4"
            />
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 28}
              strokeDashoffset={2 * Math.PI * 28 * (1 - gazeProgress)}
              transform="rotate(-90 32 32)"
            />
            <circle cx="32" cy="32" r="3" fill="rgba(255,255,255,0.85)" />
          </svg>
        </div>
      )}

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
            const gyro = v.getPlugin('gyroscope') as any;
            const stereo = v.getPlugin('stereo') as any;
            if (!vrActive) {
              try { gyro?.start?.(); } catch { /* permission may be required */ }
              try { stereo?.start?.(); } catch { /* ignore */ }
              if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
              }
              setVrActive(true);
            } else {
              try { stereo?.stop?.(); } catch { /* ignore */ }
              try { gyro?.stop?.(); } catch { /* ignore */ }
              setVrActive(false);
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
