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

  const selectedSceneId = useProjectStore((state) => state.selectedSceneId);
  const scenes = useProjectStore((state) => state.scenes);
  const isAddingHotspot = useProjectStore((state) => state.isAddingHotspot);
  const setIsAddingHotspot = useProjectStore((state) => state.setIsAddingHotspot);

  const selectedScene = scenes.find(s => s.id === selectedSceneId);

  // Which hotspot popup is currently open (rendered as an in-sphere marker)
  const [openHotspotId, setOpenHotspotId] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!viewerRef.current) {
      viewerRef.current = new Viewer({
        container: containerRef.current,
        panorama: selectedScene?.image || 'https://photo-sphere-viewer-data.netlify.app/assets/sphere.jpg',
        plugins: [[MarkersPlugin, {}]]
      });

      viewerRef.current.addEventListener('position-updated', (e: any) => {
        const yaw = e.position?.yaw ?? e.args?.[0]?.yaw;
        if (yaw !== undefined) {
          useProjectStore.getState().setCurrentYaw(yaw);
        }
      });

      // Click on sphere to add hotspot
      viewerRef.current.addEventListener('click', (e: any) => {
        const state = useProjectStore.getState();
        if (state.isAddingHotspot && state.selectedSceneId) {
          const newHotspot: Hotspot = {
            id: 'hotspot-' + Date.now(),
            type: 'text',
            yaw: e.data.yaw,
            pitch: e.data.pitch,
            content: 'Nouveau Hotspot'
          };
          state.addHotspot(state.selectedSceneId, newHotspot);
          state.selectHotspot(newHotspot.id);
          state.setIsAddingHotspot(false);
        }
      });

      // Navigation link clicks via markers plugin
      const markersPlugin = viewerRef.current.getPlugin(MarkersPlugin) as any;
      markersPlugin.addEventListener('select-marker', (e: any) => {
        const targetId = e.marker.data?.target;
        if (targetId) {
          useProjectStore.getState().selectScene(targetId);
        }
      });
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Update panorama when scene changes; close any open popup
  useEffect(() => {
    if (viewerRef.current && selectedScene?.image) {
      setOpenHotspotId(null);
      viewerRef.current.setPanorama(selectedScene.image).catch(err => {
        console.error('Failed to set panorama:', err);
      });
    }
  }, [selectedScene?.image]);

  // Sync all markers (links + hotspot icons + open popup card) in the sphere
  useEffect(() => {
    if (!viewerRef.current) return;
    const markersPlugin = viewerRef.current.getPlugin(MarkersPlugin) as any;
    if (!markersPlugin) return;

    markersPlugin.clearMarkers();

    // --- Global callbacks called from inside marker HTML ---

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
        const icon = hotspot.type === 'video' ? '🎥' : hotspot.type === 'image' ? '🖼️' : 'ℹ️';
        const accentColor = hotspot.type === 'video' ? '#e50914' : hotspot.type === 'image' ? '#6a0dad' : '#007acc';
        const embedUrl = hotspot.type === 'video' ? getYoutubeEmbedUrl(hotspot.content) : null;

        // Icon marker (always visible)
        markersPlugin.addMarker({
          id: hotspot.id,
          position: { yaw: hotspot.yaw, pitch: hotspot.pitch },
          html: `
            <div
              style="
                width:34px;height:34px;
                background:${accentColor};
                color:white;border:2.5px solid white;
                border-radius:50%;display:flex;align-items:center;justify-content:center;
                font-size:16px;box-shadow:0 2px 10px rgba(0,0,0,0.55);
                cursor:pointer;user-select:none;
                transition: transform 0.15s;
                ${isOpen ? 'outline: 2px solid white; outline-offset: 2px;' : ''}
              "
              onclick="window.openPSVHotspot('${hotspot.id}')"
            >${icon}</div>
          `,
          data: { hotspotId: hotspot.id }
        });

        // Popup card marker — placed slightly above the icon in spherical space
        if (isOpen) {
          const popupW = hotspot.type === 'video' ? 300 : hotspot.type === 'image' ? 280 : 240;
          // pitch offset: ~0.22 rad above so the card floats above the icon
          const popupPitch = hotspot.pitch + 0.22;

          let contentHtml = '';
          if (hotspot.type === 'video') {
            if (embedUrl) {
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
              contentHtml = `<p style="margin:0;font-size:0.82rem;color:#888;font-style:italic;">URL YouTube invalide. Éditez dans le panneau de droite.</p>`;
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
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:0.7rem;font-weight:600;color:#999;letter-spacing:0.06em;text-transform:uppercase;">
                    ${hotspot.type === 'video' ? '🎥 Vidéo' : hotspot.type === 'image' ? '🖼️ Image' : 'ℹ️ Info'}
                  </span>
                  <button
                    onclick="window.closePSVHotspot()"
                    style="background:none;border:none;color:#666;font-size:0.9rem;cursor:pointer;padding:2px 5px;border-radius:3px;line-height:1;"
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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: '#000' }} />

      {/* Add Hotspot floating button */}
      {selectedSceneId && (
        <button
          onClick={() => setIsAddingHotspot(!isAddingHotspot)}
          style={{
            position: 'absolute', top: '15px', right: '15px', zIndex: 1000,
            padding: '8px 14px',
            backgroundColor: isAddingHotspot ? '#d32f2f' : '#252526',
            color: 'white', border: '1px solid #3d3d3d', borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)', cursor: 'pointer',
            fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'background-color 0.2s'
          }}
        >
          {isAddingHotspot ? '❌ Cancel' : '➕ Add Hotspot'}
        </button>
      )}
    </div>
  );
};

export default SphereViewer;
