import React, { useEffect, useRef, useState } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import '@photo-sphere-viewer/markers-plugin/index.css';
import { useProjectStore } from '../../state/projectStore';
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
  const addHotspotCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ctext x='16' y='22' text-anchor='middle' font-size='22'%3E%E2%AD%95%3C/text%3E%3C/svg%3E") 16 16, crosshair`;

  const selectedSceneId = useProjectStore((state) => state.selectedSceneId);
  const selectedHotspotId = useProjectStore((state) => state.selectedHotspotId);
  const scenes = useProjectStore((state) => state.scenes);
  const isAddingHotspot = useProjectStore((state) => state.isAddingHotspot);
  const setIsAddingHotspot = useProjectStore((state) => state.setIsAddingHotspot);
  const mode = useProjectStore((state) => state.mode);
  const isMovingHotspot = useProjectStore((state) => state.isMovingHotspot);
  const setIsMovingHotspot = useProjectStore((state) => state.setIsMovingHotspot);

  const selectedScene = scenes.find(s => s.id === selectedSceneId);

  // Which hotspot popup is currently open (rendered as an in-sphere marker)
  const [openHotspotId, setOpenHotspotId] = useState<string | null>(null);
  const [panoramaError, setPanoramaError] = useState<string | null>(null);

  const toggleMoveMode = () => {
    if (isMovingHotspot) {
      setIsMovingHotspot(false);
      useProjectStore.getState().selectHotspot(null);
    } else {
      setIsMovingHotspot(true);
    }
  };

  // Initialize the viewer when the first panorama is loaded, or update it when the panorama changes.
  useEffect(() => {
    if (!containerRef.current) return;
    if (!selectedScene?.image) return; // Wait until the project has a valid scene image

    if (!viewerRef.current) {
      viewerRef.current = new Viewer({
        container: containerRef.current,
        panorama: selectedScene.image,
        plugins: [[MarkersPlugin, {}]]
      });

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
        if (moving) {
          const hotspotId = e.marker?.data?.hotspotId;
          if (hotspotId) state.selectHotspot(hotspotId);
          e.preventDefault();
          return;
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
        const data = e.marker?.data ?? {};
        if (data.target) {
          useProjectStore.getState().selectScene(data.target);
        } else if (data.hotspotId) {
          useProjectStore.getState().selectHotspot(data.hotspotId);
          setOpenHotspotId(data.hotspotId);
        }
      });
    } else {
      // If the viewer is already initialized, update the panorama
      setOpenHotspotId(null);
      setPanoramaError(null);
      viewerRef.current.setPanorama(selectedScene.image).catch(err => {
        console.error('Failed to set panorama for URL:', selectedScene.image, err);
        setPanoramaError(selectedScene.image);
      });
    }
  }, [selectedScene?.image]);

  // Clean up the viewer only on component unmount
  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
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
      useProjectStore.getState().selectScene(targetId);
    };

    (window as any).openPSVHotspot = (hotspotId: string) => {
      useProjectStore.getState().selectHotspot(hotspotId);
      setOpenHotspotId(hotspotId);
    };

    (window as any).closePSVHotspot = () => {
      setOpenHotspotId(null);
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
              <div style="width:36px;height:36px;background:rgba(255,255,255,0.95);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.5);margin:0 auto;transition:transform 0.2s;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007acc" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
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
        const icon = hotspot.type === 'video' ? '🎥' : hotspot.type === 'image' ? '🖼️' : 'ℹ️';
        const accentColor = hotspot.type === 'video' ? '#e50914' : hotspot.type === 'image' ? '#6a0dad' : '#007acc';
        const embedUrl = hotspot.type === 'video' ? getYoutubeEmbedUrl(hotspot.content) : null;

        // Icon marker (always visible)
        markersPlugin.addMarker({
          id: hotspot.id,
          position: { yaw: hotspot.yaw, pitch: hotspot.pitch },
          draggable: false, // Disabling Photo-Sphere-Viewer native dragging as we handle it ourselves
          html: `
            <div
              id="marker-${hotspot.id}"
              class="psv-hotspot-marker"
              data-hotspot-id="${hotspot.id}"
              style="
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
            >${icon}</div>
          `,
          data: { hotspotId: hotspot.id }
        });

        // Hotspot popup â€” placed slightly above the icon in spherical space
        if (isOpen) {
          const popupW = 300;
          // pitch offset: ~0.22 rad above so the card floats above the icon
          const popupPitch = hotspot.pitch + 0.22;

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
                <div style="margin-top:2px; border-radius:6px; overflow:hidden; background:#000;">
                  <video
                    src="${hotspot.content}"
                    controls
                    autoplay
                    style="width:100%; display:block;"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              `;
            }
          } else if (hotspot.type === 'image') {
            if (hotspot.content) {
              contentHtml = `
                <div style="border-radius:6px;overflow:hidden;margin-top:2px;">
                  <img
                    src="${hotspot.content}"
                    alt="hotspot image"
                    style="width:100%;max-height:200px;object-fit:contain;display:block;background:#111;"
                    onerror="this.style.display='none';this.nextSibling.style.display='block';"
                  />
                  <p style="display:none;margin:0;font-size:0.82rem;color:#888;font-style:italic;">Image non disponible.</p>
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

          markersPlugin.addMarker({
            id: `popup-${hotspot.id}`,
            position: { yaw: hotspot.yaw, pitch: popupPitch },
            zIndex: 1000,
            html: `
              <div style="
                width:${popupW}px;
                background:rgba(14,14,16,0.92);
                backdrop-filter:blur(12px);
                -webkit-backdrop-filter:blur(12px);
                border:1px solid rgba(255,255,255,0.12);
                border-radius:10px;
                padding:11px 13px;
                box-shadow:0 8px 28px rgba(0,0,0,0.65);
                color:white;
                display:flex;flex-direction:column;gap:8px;
                position:relative;
                font-family: system-ui, sans-serif;
              ">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <span style="font-size:0.92rem;font-weight:600;color:#fff;">
                    ${hotspot.title
                      ? hotspot.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                      : (hotspot.type === 'video' ? '🎥 Vidéo' : hotspot.type === 'image' ? '🖼️ Image' : 'ℹ️ Info')}
                  </span>
                  <button
                    onclick="window.closePSVHotspot()"
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
            `,
            data: {}
          });
        }
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
      // When pointer-events: none is active, we check the element or look for a marker container
      const markerEl = target.closest('.psv-marker');
      if (markerEl) {
        // Find the hotspot-marker container inside
        const innerEl = markerEl.querySelector('.psv-hotspot-marker');
        if (innerEl) {
          const hotspotId = innerEl.getAttribute('data-hotspot-id');
          if (hotspotId) {
            // Only allow dragging if we are in moving mode
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

      // Convert viewport/pixel coordinates inside container to spherical positions
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
    // We bind local state to window context or other stores if needed
    (window as any).__isMovingHotspot = isMovingHotspot;
    (window as any).__setIsMovingHotspot = setIsMovingHotspot;
    
    // Auto-select the currently active hotspot in store if we enter move mode
    if (isMovingHotspot && selectedHotspotId) {
      // already selected
    }
  }, [isMovingHotspot, selectedHotspotId]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          cursor: isAddingHotspot || isMovingHotspot ? addHotspotCursor : undefined,
        }}
      />

      {panoramaError && (
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

      {/* Hotspot floating tools (editor only) */}
      {selectedSceneId && mode === 'editor' && (
        <div style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => {
              setIsAddingHotspot(!isAddingHotspot);
              setIsMovingHotspot(false);
            }}
            style={{
              padding: '8px 14px',
              backgroundColor: isAddingHotspot ? '#d32f2f' : '#252526',
              color: 'white',
              border: '1px solid #3d3d3d',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.2s'
            }}
          >
            {isAddingHotspot ? '❌ Cancel' : '➕ Add Hotspot'}
          </button>
          <button
            onClick={toggleMoveMode}
            style={{
              padding: '8px 14px',
              backgroundColor: isMovingHotspot ? '#2e7d32' : '#252526',
              color: 'white',
              border: '1px solid #3d3d3d',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.2s'
            }}
          >
            {isMovingHotspot ? '✅ Validate Positions' : '⭕ Move Hotspot'}
          </button>
        </div>
      )}    </div>
  );
};

export default SphereViewer;

