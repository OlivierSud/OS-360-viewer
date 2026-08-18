import { create } from 'zustand';
import type { Project, ProjectMetadata, MapConfig } from '../models/Project';
import type { Scene } from '../models/Scene';
import type { Hotspot } from '../models/Hotspot';

interface ProjectState {
  project: Project | null;
  scenes: Scene[];
  selectedSceneId: string | null;
  activeSceneId: string | null;
  selectedHotspotId: string | null;
  currentProjectId: string | null;
  mode: 'editor' | 'viewer';
  currentYaw: number;
  isMovingHotspot: boolean;
  isSceneLoading: boolean;

  // Actions
  setProject: (project: Project) => void;
  setScenes: (scenes: Scene[]) => void;
  addScene: (scene: Scene) => void;
  selectScene: (id: string | null) => void;
  setActiveScene: (id: string | null) => void;
  selectHotspot: (id: string | null) => void;
  setMode: (mode: 'editor' | 'viewer') => void;
  setMapConfig: (mapConfig: MapConfig) => void;
  setCurrentYaw: (yaw: number) => void;
  setCurrentProjectId: (id: string | null) => void;
  setSceneLoading: (val: boolean) => void;
  setIsMovingHotspot: (val: boolean) => void;
  isMovingLink: boolean;
  setIsMovingLink: (val: boolean) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  removeScene: (id: string) => void;
  addLink: (sourceId: string, targetId: string) => void;
  removeLink: (sourceId: string, targetId: string) => void;
  updateLinkPosition: (sourceId: string, targetId: string, yaw: number, pitch: number) => void;
  resetLinkPosition: (sourceId: string, targetId: string) => void;
  isAddingHotspot: boolean;
  setIsAddingHotspot: (val: boolean) => void;
  isDeletingHotspot: boolean;
  setIsDeletingHotspot: (val: boolean) => void;
  addHotspot: (sceneId: string, hotspot: Hotspot) => void;
  updateHotspot: (sceneId: string, hotspotId: string, updates: Partial<Hotspot>) => void;
  removeHotspot: (sceneId: string, hotspotId: string) => void;
  showProjectSettings: boolean;
  setShowProjectSettings: (val: boolean) => void;
  updateProjectTitle: (title: string) => void;
  updateProjectPassword: (hash: string | undefined) => void;
  setProjectMeta: (updates: Partial<ProjectMetadata>) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  scenes: [],
  selectedSceneId: null,
  activeSceneId: null,
  selectedHotspotId: null,
  currentProjectId: null,
  mode: 'editor',
  currentYaw: 0,
  isMovingHotspot: false,
  isMovingLink: false,
  isSceneLoading: false,

  setProject: (project) => {
    const initialId = project.project?.defaultScene || project.scenes[0]?.id || null;
    set({ project, scenes: project.scenes, selectedSceneId: initialId, activeSceneId: initialId });
  },
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
  setSceneLoading: (val) => set({ isSceneLoading: val }),
  setScenes: (scenes) => set((state) => ({ 
    scenes, 
    project: state.project ? { ...state.project, scenes } : null 
  })),
  addScene: (scene) => set((state) => {
    const newScenes = [...state.scenes, scene];
    const initialId = state.activeSceneId ?? scene.id;
    return {
      scenes: newScenes,
      selectedSceneId: state.selectedSceneId ?? scene.id,
      activeSceneId: initialId,
      project: state.project ? { ...state.project, scenes: newScenes } : {
        version: 1,
        project: { title: 'Nouveau Projet' },
        scenes: newScenes
      }
    };
  }),
  selectScene: (id) => set({ selectedSceneId: id }),
  setActiveScene: (id) => set({ activeSceneId: id, selectedSceneId: id }),
  selectHotspot: (id) => set({ selectedHotspotId: id }),
  removeScene: (id) => set((state) => {
    // Remove the scene and all links pointing to it from other scenes
    const newScenes = state.scenes
      .filter(s => s.id !== id)
      .map(s => ({
        ...s,
        links: s.links.filter(l => l.target !== id),
      }));
    const nextActive = state.activeSceneId === id ? (newScenes[0]?.id ?? null) : state.activeSceneId;
    return {
      scenes: newScenes,
      selectedSceneId: state.selectedSceneId === id ? nextActive : state.selectedSceneId,
      activeSceneId: nextActive,
      project: state.project ? { ...state.project, scenes: newScenes } : null,
    };
  }),
  setMode: (mode) => set({ mode }),
  setIsMovingHotspot: (val) => set({ isMovingHotspot: val }),
  setIsMovingLink: (val) => set({ isMovingLink: val }),
  setMapConfig: (mapConfig) => set((state) => {
    if (!state.project) {
      return { 
        project: { 
          version: 1, 
          project: { title: 'Nouveau Projet' }, 
          map: mapConfig, 
          scenes: [] 
        } 
      };
    }
    return {
      project: {
        ...state.project,
        map: mapConfig,
      }
    };
  }),
  setCurrentYaw: (yaw) => set({ currentYaw: yaw }),
  updateScene: (id, updates) => set((state) => {
    const currentScene = state.scenes.find(item => item.id === id);
    if (!currentScene) return {};

    const nextNorth = updates.north !== undefined ? updates.north : currentScene.north;
    const nextPos = updates.position !== undefined ? updates.position : currentScene.position;

    const newScenes = state.scenes.map(s => {
      // 1. If this is the scene being updated, recalculate its links' yaws (unless custom)
      if (s.id === id) {
        const updatedLinks = s.links.map(link => {
          if (link.isCustom) return link;
          const target = state.scenes.find(t => t.id === link.target);
          if (!target) return link;
          
          const dx = target.position.x - nextPos.x;
          const dy = target.position.y - nextPos.y;
          let mapAngle = Math.atan2(dx, dy) * 180 / Math.PI;
          mapAngle = (mapAngle + 360) % 360;
          
          const newYaw = ((mapAngle - nextNorth + 360) % 360) * Math.PI / 180;
          return { ...link, yaw: newYaw };
        });

        return { ...s, ...updates, links: updatedLinks };
      }

      // 2. For other scenes, if the updated scene moved, recalculate incoming links pointing to it (unless custom)
      const linksToUpdated = s.links.some(l => l.target === id);
      if (linksToUpdated && updates.position !== undefined) {
        const updatedLinks = s.links.map(link => {
          if (link.target !== id || link.isCustom) return link;

          const dx = nextPos.x - s.position.x;
          const dy = nextPos.y - s.position.y;
          let mapAngle = Math.atan2(dx, dy) * 180 / Math.PI;
          mapAngle = (mapAngle + 360) % 360;

          const newYaw = ((mapAngle - s.north + 360) % 360) * Math.PI / 180;
          return { ...link, yaw: newYaw };
        });

        return { ...s, links: updatedLinks };
      }

      return s;
    });

    return {
      scenes: newScenes,
      project: state.project ? { ...state.project, scenes: newScenes } : null
    };
  }),
  addLink: (sourceId, targetId) => set((state) => {
    const source = state.scenes.find(s => s.id === sourceId);
    const target = state.scenes.find(s => s.id === targetId);
    if (!source || !target) return {};

    const dx = target.position.x - source.position.x;
    const dy = target.position.y - source.position.y;
    let mapAngle = Math.atan2(dx, dy) * 180 / Math.PI;
    mapAngle = (mapAngle + 360) % 360;

    // Yaw for source pointing to target
    const yaw_src = ((mapAngle - source.north + 360) % 360) * Math.PI / 180;
    
    // Yaw for target pointing to source (180 degrees opposite)
    const mapAngle_back = (mapAngle + 180) % 360;
    const yaw_tgt = ((mapAngle_back - target.north + 360) % 360) * Math.PI / 180;

    const pitch = -0.3; // slightly pointing down to the ground

    const newScenes = state.scenes.map(s => {
      if (s.id === sourceId) {
        const cleanLinks = s.links.filter(l => l.target !== targetId);
        return {
          ...s,
          links: [...cleanLinks, { target: targetId, yaw: yaw_src, pitch }]
        };
      }
      if (s.id === targetId) {
        const cleanLinks = s.links.filter(l => l.target !== sourceId);
        return {
          ...s,
          links: [...cleanLinks, { target: sourceId, yaw: yaw_tgt, pitch }]
        };
      }
      return s;
    });

    return {
      scenes: newScenes,
      project: state.project ? { ...state.project, scenes: newScenes } : null
    };
  }),
  removeLink: (sourceId, targetId) => set((state) => {
    const newScenes = state.scenes.map(s => {
      if (s.id === sourceId) {
        return {
          ...s,
          links: s.links.filter(l => l.target !== targetId)
        };
      }
      if (s.id === targetId) {
        return {
          ...s,
          links: s.links.filter(l => l.target !== sourceId)
        };
      }
      return s;
    });

    return {
      scenes: newScenes,
      project: state.project ? { ...state.project, scenes: newScenes } : null
    };
  }),
  updateLinkPosition: (sourceId, targetId, yaw, pitch) => set((state) => {
    const newScenes = state.scenes.map(s => {
      if (s.id !== sourceId) return s;
      const updatedLinks = s.links.map(link => {
        if (link.target !== targetId) return link;
        return {
          ...link,
          yaw,
          pitch,
          isCustom: true,
          customYaw: yaw,
          customPitch: pitch,
        };
      });
      return { ...s, links: updatedLinks };
    });
    return {
      scenes: newScenes,
      project: state.project ? { ...state.project, scenes: newScenes } : null,
    };
  }),
  resetLinkPosition: (sourceId, targetId) => set((state) => {
    const source = state.scenes.find(s => s.id === sourceId);
    const target = state.scenes.find(s => s.id === targetId);
    if (!source || !target) return {};

    const dx = target.position.x - source.position.x;
    const dy = target.position.y - source.position.y;
    let mapAngle = Math.atan2(dx, dy) * 180 / Math.PI;
    mapAngle = (mapAngle + 360) % 360;
    const calcYaw = ((mapAngle - source.north + 360) % 360) * Math.PI / 180;
    const calcPitch = -0.3;

    const newScenes = state.scenes.map(s => {
      if (s.id !== sourceId) return s;
      const updatedLinks = s.links.map(link => {
        if (link.target !== targetId) return link;
        const { isCustom, customYaw, customPitch, ...rest } = link;
        return {
          ...rest,
          yaw: calcYaw,
          pitch: calcPitch,
        };
      });
      return { ...s, links: updatedLinks };
    });

    return {
      scenes: newScenes,
      project: state.project ? { ...state.project, scenes: newScenes } : null,
    };
  }),
  isAddingHotspot: false,
  setIsAddingHotspot: (val) => set({ isAddingHotspot: val }),
  isDeletingHotspot: false,
  setIsDeletingHotspot: (val) => set({ isDeletingHotspot: val }),
  showProjectSettings: false,
  setShowProjectSettings: (val) => set({ showProjectSettings: val }),
  updateProjectTitle: (title) => set((state) => ({
    project: state.project
      ? { ...state.project, project: { ...state.project.project, title } }
      : null
  })),
  updateProjectPassword: (hash) => set((state) => ({
    project: state.project
      ? { ...state.project, project: { ...state.project.project, passwordHash: hash } }
      : null
  })),
  setProjectMeta: (updates) => set((state) => ({
    project: state.project
      ? { ...state.project, project: { ...state.project.project, ...updates } }
      : null
  })),
  addHotspot: (sceneId, hotspot) => set((state) => {
    const newScenes = state.scenes.map(s => {
      if (s.id === sceneId) {
        return {
          ...s,
          hotspots: [...(s.hotspots || []), hotspot]
        };
      }
      return s;
    });
    return {
      scenes: newScenes,
      project: state.project ? { ...state.project, scenes: newScenes } : null
    };
  }),
  updateHotspot: (sceneId, hotspotId, updates) => set((state) => {
    const newScenes = state.scenes.map(s => {
      if (s.id === sceneId) {
        return {
          ...s,
          hotspots: (s.hotspots || []).map(h => h.id === hotspotId ? { ...h, ...updates } : h)
        };
      }
      return s;
    });
    return {
      scenes: newScenes,
      project: state.project ? { ...state.project, scenes: newScenes } : null
    };
  }),
  removeHotspot: (sceneId, hotspotId) => set((state) => {
    const newScenes = state.scenes.map(s => {
      if (s.id === sceneId) {
        return {
          ...s,
          hotspots: (s.hotspots || []).filter(h => h.id !== hotspotId)
        };
      }
      return s;
    });
    return {
      scenes: newScenes,
      selectedHotspotId: state.selectedHotspotId === hotspotId ? null : state.selectedHotspotId,
      project: state.project ? { ...state.project, scenes: newScenes } : null
    };
  }),
}));
