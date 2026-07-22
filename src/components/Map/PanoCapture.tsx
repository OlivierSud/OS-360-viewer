import React, { useEffect, useRef, useState, useCallback } from 'react';

interface CapturePoint {
  row: number;
  col: number;
  yaw: number;   // degrees, relative to start
  pitch: number; // degrees
}

interface CapturedPhoto {
  bitmap: ImageBitmap;
  yaw: number;   // actual relative yaw when snapped
  pitch: number; // actual pitch when snapped
  roll: number;  // actual roll when snapped
  screenAngle: number;
}

interface PanoCaptureProps {
  position: { x: number; y: number };
  onCancel: () => void;
  onComplete: (blob: Blob) => void;
}

// Grid of capture targets. 3 rows: equator (0), upper (-30), lower (30) x 12 columns.
const COLS = 12;
const OUTPUT_W = 4096;
const OUTPUT_H = 2048;
const RESIZED = 512; // Resize to square for stitching

// Guide order: Equator first (easier to align), then upper row, then lower row.
function buildGrid(): CapturePoint[] {
  const points: CapturePoint[] = [];
  // 1. Equator (pitch 0)
  for (let c = 0; c < COLS; c++) {
    points.push({ row: 1, col: c, yaw: (c * 360) / COLS, pitch: 0 });
  }
  // 2. Upper row (pitch -30)
  for (let c = 0; c < COLS; c++) {
    points.push({ row: 0, col: c, yaw: (c * 360) / COLS, pitch: -30 });
  }
  // 3. Lower row (pitch 30)
  for (let c = 0; c < COLS; c++) {
    points.push({ row: 2, col: c, yaw: (c * 360) / COLS, pitch: 30 });
  }
  return points;
}

const PanoCapture: React.FC<PanoCaptureProps> = ({ onCancel, onComplete }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const grid = useRef<CapturePoint[]>(buildGrid());

  const [hasStarted, setHasStarted] = useState(false);
  // Index of the next recommended capture point (-1 = let user choose freely)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photos, setPhotos] = useState<(CapturedPhoto | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stitching, setStitching] = useState(false);
  const [videoSize, setVideoSize] = useState({ w: 1280, h: 720 });
  const [flashActive, setFlashActive] = useState(false);

  // Device orientation refs
  const deviceOrientationRef = useRef<{ yaw: number; pitch: number; roll: number; valid: boolean }>({
    yaw: 0,
    pitch: 0,
    roll: 0,
    valid: false,
  });
  const yawOffsetRef = useRef<number | null>(null);
  const lockProgressRef = useRef<number>(0); // 0 to 1
  // Screen-space positions of all projected points (for tap hit-testing)
  const projectedRef = useRef<{ idx: number; sx: number; sy: number }[]>([]);

  // Start the camera
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        if (settings.width && settings.height) {
          setVideoSize({ w: settings.width, h: settings.height });
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setError('Impossible d’accéder à la caméra. Veuillez autoriser l’accès et utiliser HTTPS.');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Play a synthesized camera click sound
  const playShutterSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1200;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.07);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (e) {
      console.warn('Could not play shutter sound:', e);
    }
  };

  // Perform single photo capture for a given grid index
  const captureAt = useCallback(async (gridIndex: number, actualYaw: number, actualPitch: number, actualRoll: number) => {
    const video = videoRef.current;
    if (!video) return;

    // Trigger visual flash
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);
    playShutterSound();

    const canvas = document.createElement('canvas');
    canvas.width = RESIZED;
    canvas.height = RESIZED;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vw = video.videoWidth || videoSize.w;
    const vh = video.videoHeight || videoSize.h;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, RESIZED, RESIZED);

    let bitmap: ImageBitmap;
    if ('createImageBitmap' in window) {
      bitmap = await createImageBitmap(canvas);
    } else {
      bitmap = (canvas as unknown) as ImageBitmap;
    }

    let screenAngle = 0;
    if (window.screen && window.screen.orientation) {
      screenAngle = window.screen.orientation.angle;
    } else if (typeof (window as any).orientation === 'number') {
      screenAngle = (window as any).orientation;
    }

    setPhotos((prev) => {
      const next = [...prev];
      next[gridIndex] = { bitmap, yaw: actualYaw, pitch: actualPitch, roll: actualRoll, screenAngle };
      return next;
    });

    lockProgressRef.current = 0;
    // Advance currentIndex to the next uncaptured point
    setCurrentIndex((prev) => {
      for (let i = 0; i < grid.current.length; i++) {
        const ni = (gridIndex + 1 + i) % grid.current.length;
        if (ni !== gridIndex) return ni;
      }
      return prev;
    });
  }, [videoSize]);

  // Legacy wrapper kept for the auto-snap (RAF loop)
  const captureCurrent = useCallback(async (actualYaw: number, actualPitch: number, actualRoll: number) => {
    await captureAt(currentIndex, actualYaw, actualPitch, actualRoll);
  }, [captureAt, currentIndex]);

  // Request gyroscope permissions and start
  const handleStartCapture = async () => {
    const DeviceOrientation = (window as any).DeviceOrientationEvent;
    if (DeviceOrientation && typeof DeviceOrientation.requestPermission === 'function') {
      try {
        const response = await DeviceOrientation.requestPermission();
        if (response === 'granted') {
          setHasStarted(true);
        } else {
          setError('Permission de gyroscope refusée. L’aide à l’alignement ne fonctionnera pas.');
          setHasStarted(true);
        }
      } catch (e) {
        setError('Erreur lors de la demande d’accès aux capteurs.');
        setHasStarted(true);
      }
    } else {
      setHasStarted(true);
    }
  };

  // Device orientation event listener
  useEffect(() => {
    if (!hasStarted) return;

    const deg2rad = Math.PI / 180;
    const rad2deg = 180 / Math.PI;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      let alpha = e.alpha ?? 0;
      let beta = e.beta ?? 0;
      let gamma = e.gamma ?? 0;

      let screenAngle = 0;
      if (window.screen && window.screen.orientation) {
        screenAngle = window.screen.orientation.angle;
      } else if (typeof window.orientation === 'number') {
        screenAngle = window.orientation;
      }

      const a = alpha * deg2rad;
      const b = beta * deg2rad;
      const g = gamma * deg2rad;

      // 3D vector pointing out the back of the camera
      let x = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
      let y = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
      let z = -Math.cos(b) * Math.cos(g);

      // Rotate for landscape screen orientation
      if (screenAngle !== 0) {
        const sa = screenAngle * deg2rad;
        const cosS = Math.cos(sa);
        const sinS = Math.sin(sa);
        const rx = x * cosS - y * sinS;
        const ry = x * sinS + y * cosS;
        x = rx;
        y = ry;
      }

      // Convert back to yaw/pitch/roll
      let currentYaw = Math.atan2(x, y) * rad2deg;
      let currentPitch = Math.asin(z) * rad2deg;
      let currentRoll = gamma;

      if (currentYaw < 0) currentYaw += 360;

      // Calibrate starting direction as 0 degrees yaw
      if (yawOffsetRef.current === null) {
        yawOffsetRef.current = currentYaw;
      }

      let relativeYaw = currentYaw - yawOffsetRef.current;
      if (relativeYaw < 0) relativeYaw += 360;
      if (relativeYaw >= 360) relativeYaw -= 360;

      deviceOrientationRef.current = {
        yaw: relativeYaw,
        pitch: currentPitch,
        roll: currentRoll,
        valid: true,
      };
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [hasStarted]);

  // Main UI update loop: projects ALL capture points onto the camera view
  useEffect(() => {
    if (!hasStarted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId = 0;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const deg2rad = Math.PI / 180;
    const getAngleDiff = (target: number, current: number) => {
      let diff = target - current;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      return diff;
    };

    const updateUI = () => {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      ctx.clearRect(0, 0, W, H);

      const orientation = deviceOrientationRef.current;
      const cx = W / 2;
      const cy = H / 2;
      // Focal length: maps sin(angle) → pixels. ~1.2 gives ~70° HFOV on screen.
      const f = Math.min(W, H) * 1.2;

      // ── Center reticle ────────────────────────────────────────
      const currentPt = grid.current[currentIndex];
      let isAligned = false;
      if (orientation.valid && currentPt && !photos[currentIndex]) {
        const dy = getAngleDiff(currentPt.yaw, orientation.yaw) * deg2rad;
        const dp = (currentPt.pitch - orientation.pitch) * deg2rad;
        const tx = cx + Math.sin(dy) * f;
        const ty = cy - Math.sin(dp) * f;
        const dist = Math.hypot(tx - cx, ty - cy);
        isAligned = Math.cos(dy) > 0 && dist < 28;
      }

      ctx.lineWidth = 2;
      ctx.strokeStyle = isAligned ? '#28a745' : 'rgba(255,255,255,0.7)';
      ctx.fillStyle = isAligned ? 'rgba(40,167,69,0.12)' : 'rgba(255,255,255,0.04)';
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
      ctx.stroke();

      // ── Auto-snap progress ring ───────────────────────────────
      if (isAligned && !stitching) {
        lockProgressRef.current = Math.min(1, lockProgressRef.current + 0.04);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#28a745';
        ctx.beginPath();
        ctx.arc(cx, cy, 36, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * lockProgressRef.current);
        ctx.stroke();
        if (lockProgressRef.current >= 1) {
          lockProgressRef.current = 0;
          captureCurrent(orientation.yaw, orientation.pitch, orientation.roll);
        }
      } else {
        lockProgressRef.current = Math.max(0, lockProgressRef.current - 0.08);
      }

      // ── Project & draw ALL grid points ────────────────────────
      const newProjected: { idx: number; sx: number; sy: number }[] = [];
      const margin = 28;

      grid.current.forEach((pt, idx) => {
        const isCaptured = !!photos[idx];
        const isCurrent = idx === currentIndex;

        const dyaw = getAngleDiff(pt.yaw, orientation.yaw);
        const dp = pt.pitch - orientation.pitch;
        const yRad = dyaw * deg2rad;
        const pRad = dp * deg2rad;
        const inFront = Math.cos(yRad) > 0;

        const sx = cx + Math.sin(yRad) * f;
        const sy = cy - Math.sin(pRad) * f;
        const onScreen = sx > margin && sx < W - margin && sy > margin && sy < H - margin;

        if (inFront && onScreen) {
          newProjected.push({ idx, sx, sy });

          if (isCaptured) {
            // Green filled bubble
            ctx.save();
            ctx.fillStyle = 'rgba(40,167,69,0.45)';
            ctx.strokeStyle = '#28a745';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(sx, sy, 14, 0, 2 * Math.PI);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✓', sx, sy);
            ctx.restore();
          } else if (isCurrent) {
            // Orange active target
            ctx.save();
            const pulse = 16 + Math.abs(Math.sin(Date.now() / 300)) * 4;
            ctx.fillStyle = 'rgba(255,152,0,0.25)';
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(sx, sy, pulse, 0, 2 * Math.PI);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ff9800';
            ctx.beginPath(); ctx.arc(sx, sy, 5, 0, 2 * Math.PI); ctx.fill();
            // Angle label
            ctx.fillStyle = '#ff9800';
            ctx.font = 'bold 10px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${Math.round(pt.yaw)}°`, sx, sy + pulse + 3);
            ctx.restore();
          } else {
            // White tappable dot
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(sx, sy, 13, 0, 2 * Math.PI);
            ctx.fill(); ctx.stroke();
            // Direction symbol
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = '11px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pt.pitch < 0 ? '↑' : pt.pitch > 0 ? '↓' : '·', sx, sy);
            // Angle label
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '9px system-ui';
            ctx.textBaseline = 'top';
            ctx.fillText(`${Math.round(pt.yaw)}°`, sx, sy + 15);
            ctx.restore();
          }
        } else if (!inFront || !onScreen) {
          // Off-screen: draw a small edge arrow toward this point (only if not captured)
          if (isCaptured) return;
          const dx2 = sx - cx, dy2 = sy - cy;
          const angle = Math.atan2(dy2, dx2);
          const edgeR = Math.min(cx, cy) - margin;
          const ex = cx + Math.cos(angle) * edgeR;
          const ey = cy + Math.sin(angle) * edgeR;
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(angle);
          ctx.fillStyle = isCurrent ? '#ff9800' : 'rgba(255,255,255,0.22)';
          ctx.beginPath();
          ctx.moveTo(9, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      });

      projectedRef.current = newProjected;
      rafId = requestAnimationFrame(updateUI);
    };

    rafId = requestAnimationFrame(updateUI);
    return () => cancelAnimationFrame(rafId);
  }, [hasStarted, currentIndex, photos, stitching, captureCurrent]);

  // Handle tap on camera canvas to select a capture point
  const handleCanvasTap = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0];
      cx = t.clientX - rect.left;
      cy = t.clientY - rect.top;
    } else {
      cx = e.clientX - rect.left;
      cy = e.clientY - rect.top;
    }
    // Find closest uncaptured projected point within 40px tap radius
    let best = -1, bestDist = 40;
    projectedRef.current.forEach(({ idx, sx, sy }) => {
      if (photos[idx]) return; // already captured
      const d = Math.hypot(sx - cx, sy - cy);
      if (d < bestDist) { bestDist = d; best = idx; }
    });
    if (best >= 0) {
      lockProgressRef.current = 0;
      setCurrentIndex(best);
    }
  }, [photos]);

  const allCaptured = photos.filter(Boolean).length >= grid.current.length;

  const handleCreate = useCallback(async () => {
    // Build full-length array, filling missing slots with a black bitmap
    setStitching(true);
    try {
      const filledPhotos: CapturedPhoto[] = await Promise.all(
        grid.current.map(async (pt, i) => {
          if (photos[i]) return photos[i] as CapturedPhoto;
          // Create a 2x2 black bitmap as placeholder
          const c = document.createElement('canvas');
          c.width = 2; c.height = 2;
          const bmp = 'createImageBitmap' in window
            ? await createImageBitmap(c)
            : (c as unknown as ImageBitmap);
          return {
            bitmap: bmp,
            yaw: pt.yaw,
            pitch: pt.pitch,
            roll: 0,
            screenAngle: photos.find(Boolean)?.screenAngle ?? 0,
          };
        })
      );
      const blob = await stitchPanorama(filledPhotos, OUTPUT_W, OUTPUT_H, videoSize);
      onComplete(blob);
    } catch (e) {
      setError('L’assemblage du panorama a échoué : ' + (e as Error).message);
      setStitching(false);
    }
  }, [photos, videoSize, onComplete]);

  const total = grid.current.length;
  const done = photos.filter(Boolean).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 5000, background: '#000',
      display: 'flex', flexDirection: 'column', color: 'white', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* 1. Calibration and Intro Landing screen */}
      {!hasStarted && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5100, background: 'rgba(10,10,12,0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24, textAlign: 'center', backdropFilter: 'blur(8px)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📸</div>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.4rem', fontWeight: 700 }}>Prendre un panorama 360°</h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '0.92rem', color: '#aaa', maxWidth: 300, lineHeight: 1.45 }}>
            Tenez votre téléphone verticalement devant vous. Vous serez guidé visuellement pour capturer les {total} angles requis.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 260 }}>
            <button onClick={handleStartCapture} style={btnStyle('#007acc')}>
              Démarrer le guidage
            </button>
            <button onClick={onCancel} style={btnStyle('rgba(255,255,255,0.1)')}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* 2. Visual Camera Flash Overlay */}
      {flashActive && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5090,
          backgroundColor: '#fff', animation: 'shutterFlash 0.2s ease-out forwards'
        }} />
      )}

      {/* 3. Full-screen Validate overlay when all photos done */}
      {allCaptured && !stitching && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5080,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: '3.5rem' }}>✅</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, textAlign: 'center' }}>Toutes les photos capturées !</div>
          <div style={{ fontSize: '0.9rem', color: '#aaa', textAlign: 'center', maxWidth: 260 }}>
            Vous pouvez générer le panorama ou reprendre des photos.
          </div>
          <button
            onClick={handleCreate}
            style={{ ...btnStyle('#28a745'), fontSize: '1rem', padding: '14px 36px', marginTop: 8 }}
          >
            🌐 Valider et créer le panorama
          </button>
          <button
            onClick={() => setCurrentIndex(photos.findIndex((p) => !p) >= 0 ? photos.findIndex((p) => !p) : 0)}
            style={btnStyle('rgba(255,255,255,0.12)')}
          >
            Continuer à capturer
          </button>
        </div>
      )}

      {/* 4. Stitching progress overlay */}
      {stitching && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5085,
          background: 'rgba(0,0,0,0.85)', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16
        }}>
          <div style={{ fontSize: '2rem' }}>⚙️</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Assemblage du panorama…</div>
          <div style={{ fontSize: '0.85rem', color: '#aaa' }}>Cela peut prendre quelques secondes.</div>
        </div>
      )}

      {/* Header Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'rgba(15,15,20,0.85)', backdropFilter: 'blur(8px)', zIndex: 5010
      }}>
        <button onClick={onCancel} style={btnStyle('rgba(255,255,255,0.1)')}>✕ Annuler</button>
        <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>
          Panorama 360° — {done}/{total}
        </div>
        {/* Always-visible Generate button */}
        <button
          onClick={handleCreate}
          disabled={stitching || done < 2}
          style={btnStyle(done >= 2 ? '#e67e00' : 'rgba(255,255,255,0.05)')}
        >
          {stitching ? '…' : '🌐 Générer'}
        </button>
      </div>

      {/* Camera Viewport + Targeting Canvas */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        
        {/* Real-time 60fps guidance canvas — INTERACTIVE */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair' }}
          onClick={handleCanvasTap}
          onTouchEnd={handleCanvasTap}
        />

        {error && (
          <div style={{
            position: 'absolute', bottom: 20, left: 20, right: 20,
            background: 'rgba(211,47,47,0.92)', color: 'white', padding: '10px 14px',
            borderRadius: 10, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 5020
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Bottom bar: Generate + Photo only */}
      <div style={{
        background: 'rgba(15,15,20,0.92)', backdropFilter: 'blur(8px)', zIndex: 5010,
        display: 'flex', gap: 12, padding: '12px 20px 16px',
        justifyContent: 'center', alignItems: 'center',
      }}>
        <button
          onClick={handleCreate}
          disabled={stitching}
          style={{
            ...btnStyle('#e67e00'),
            flex: 1, maxWidth: 200,
            opacity: stitching ? 0.5 : 1,
            boxShadow: '0 0 14px rgba(230,126,0,0.35)',
          }}
        >
          🌐 {stitching ? 'Génération…' : `Générer (${done}/${total})`}
        </button>
        <button
          onClick={() => {
            const orient = deviceOrientationRef.current;
            captureCurrent(orient.yaw, orient.pitch, orient.roll);
          }}
          disabled={stitching}
          style={{ ...btnStyle('#007acc'), flex: 1, maxWidth: 160 }}
        >
          📷 Photo
        </button>
      </div>

      {/* CSS Animation for flash effect */}
      <style>{`
        @keyframes shutterFlash {
          0% { opacity: 0.85; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.08)',
  background: bg,
  color: 'white',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
});

/**
 * GPU best-pixel stitching (inspired by VFTCam). Each captured photo is
 * reprojected into an equirectangular panorama by selecting, for every output
 * direction, the sharpest source pixel (closest to its photo's center).
 */
/**
 * Extract pixels from a bitmap, pre-rotating by `rotateDeg` degrees CCW
 * (use 90 for portrait phone captures where the sensor delivered landscape pixels).
 */
function getPixels(
  src: ImageBitmap | HTMLCanvasElement | HTMLImageElement,
  size: number,
  rotateDeg: number = 0,
): Uint8Array {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  if (rotateDeg !== 0) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((rotateDeg * Math.PI) / 180);
    ctx.drawImage(src as CanvasImageSource, -size / 2, -size / 2, size, size);
    ctx.restore();
  } else {
    ctx.drawImage(src as CanvasImageSource, 0, 0, size, size);
  }
  return new Uint8Array(ctx.getImageData(0, 0, size, size).data.buffer);
}

export async function stitchPanorama(
  photos: CapturedPhoto[],
  outW: number,
  outH: number,
  videoSize: { w: number; h: number },
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 non supporté sur cet appareil.');

  // Horizontal FOV of the physical camera sensor (wide dimension of the sensor).
  // On most smartphones the native sensor HFOV is ~68–70° for the standard lens.
  const SENSOR_HFOV = (68 * Math.PI) / 180;
  const vw = videoSize.w;
  const vh = videoSize.h;

  // The square crop side = min(vw, vh).
  // In PORTRAIT mode (vh > vw): stream w = short side, h = long side.
  //   • The SENSOR_HFOV spans the LONG dimension (vh, i.e. what was the
  //     camera's native landscape width).
  //   • The square crop width = vw pixels  →  subtended angle:
  //       FOV_crop = 2 * atan( tan(HFOV/2) * vw / vh )
  // In LANDSCAPE mode (vw >= vh): standard computation.
  let halfFov: number;
  if (vh > vw) {
    // Portrait stream: SENSOR_HFOV spans vh (the long axis).
    halfFov = Math.atan(Math.tan(SENSOR_HFOV / 2) * (vw / vh));
  } else {
    // Landscape stream: SENSOR_HFOV spans vw (the long axis).
    // The square crop height = vh  →  FOV_crop = VFOV of stream.
    halfFov = Math.atan(Math.tan(SENSOR_HFOV / 2) * (vh / vw));
  }
  const tanHalfH = Math.tan(halfFov);
  const tanHalfV = Math.tan(halfFov);

  const n = photos.length;
  // Build a texture array (all layers RESIZED square).
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
  gl.texImage3D(
    gl.TEXTURE_2D_ARRAY, 0, gl.RGBA, RESIZED, RESIZED, n, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, null,
  );
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const yawArr: number[] = [];
  const pitchArr: number[] = [];
  const rollArr: number[] = [];

  photos.forEach((p, i) => {
    yawArr.push((p.yaw * Math.PI) / 180);
    pitchArr.push((p.pitch * Math.PI) / 180);
    rollArr.push(0); // Ignore unstable roll sensor to prevent 180° flips

    // Pre-rotate image pixels to compensate for screen/sensor orientation.
    // The browser video stream is already oriented correctly for the current
    // screen angle, so we only need to correct when NOT in landscape (90°).
    // screenAngle = 0  → portrait (phone upright): rotate +90° CCW so that
    //   the landscape sensor data fills the square upright.
    // screenAngle = 90 → standard landscape: no rotation needed.
    // screenAngle = 180 → upside-down portrait: rotate -90° (270°).
    // screenAngle = 270 → reverse landscape: rotate 180°.
    let rotateDeg = 0;
    const sa = ((p.screenAngle % 360) + 360) % 360;
    if (sa === 0)   rotateDeg = 90;   // portrait
    else if (sa === 90)  rotateDeg = 0;   // landscape (normal)
    else if (sa === 180) rotateDeg = -90; // upside-down portrait
    else if (sa === 270) rotateDeg = 180; // reverse landscape

    const px = getPixels(p.bitmap, RESIZED, rotateDeg);
    gl.texSubImage3D(
      gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, RESIZED, RESIZED, 1,
      gl.RGBA, gl.UNSIGNED_BYTE, px,
    );
    p.bitmap.close?.();
  });

  const vsSrc = `#version 300 es
  in vec2 a_pos;
  out vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }`;

  const fsSrc = `#version 300 es
  precision highp float;
  precision highp sampler2DArray;
  in vec2 v_uv;
  out vec4 fragColor;
  uniform highp sampler2DArray u_tex;
  uniform int u_n;
  uniform float u_yaw[${n}];
  uniform float u_pitch[${n}];
  uniform float u_roll[${n}];
  uniform float u_tanH;
  uniform float u_tanV;
  const float PI = 3.141592653589793;

  mat3 rotY(float a){ float c=cos(a),s=sin(a); return mat3(c,0.0,-s, 0.0,1.0,0.0, s,0.0,c); }
  mat3 rotX(float a){ float c=cos(a),s=sin(a); return mat3(1.0,0.0,0.0, 0.0,c,s, 0.0,-s,c); }
  mat3 rotZ(float a){ float c=cos(a),s=sin(a); return mat3(c,s,0.0, -s,c,0.0, 0.0,0.0,1.0); }

  void main() {
    float lng = v_uv.x * 2.0 * PI - PI;
    float lat = v_uv.y * PI - PI / 2.0;
    vec3 world = vec3(cos(lat) * sin(lng), sin(lat), cos(lat) * cos(lng));

    vec3 best = vec3(0.0);
    float bestScore = -1.0;

    for (int i = 0; i < ${n}; i++) {
      mat3 R = rotY(u_yaw[i]) * rotX(-u_pitch[i]) * rotZ(-u_roll[i]);
      vec3 cam = transpose(R) * world;
      if (cam.z <= 0.0) continue;
      float xn = cam.x / cam.z;
      float yn = cam.y / cam.z;
      if (abs(xn) > u_tanH || abs(yn) > u_tanV) continue;
      float u = xn / (2.0 * u_tanH) + 0.5;
      float v = yn / (2.0 * u_tanV) + 0.5;
      vec3 col = texture(u_tex, vec3(u, v, float(i))).rgb;
      // quality: prefer pixels nearest to photo center
      float dx = abs(xn) / u_tanH;
      float dy = abs(yn) / u_tanV;
      float dist = sqrt(dx * dx + dy * dy);
      float score = 1.0 - dist;
      if (score > bestScore) { bestScore = score; best = col; }
    }
    fragColor = vec4(best, 1.0);
  }`;

  const prog = createProgram(gl, vsSrc, fsSrc);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  gl.uniform1i(gl.getUniformLocation(prog, 'u_n'), n);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_tanH'), tanHalfH);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_tanV'), tanHalfV);
  gl.uniform1fv(gl.getUniformLocation(prog, 'u_yaw'), yawArr);
  gl.uniform1fv(gl.getUniformLocation(prog, 'u_pitch'), pitchArr);
  gl.uniform1fv(gl.getUniformLocation(prog, 'u_roll'), rollArr);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);

  gl.viewport(0, 0, outW, outH);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();

  const pixels = new Uint8Array(outW * outH * 4);
  gl.readPixels(0, 0, outW, outH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const octx = out.getContext('2d')!;
  const imgData = octx.createImageData(outW, outH);
  for (let y = 0; y < outH; y++) {
    const src = (outH - 1 - y) * outW * 4;
    const dst = y * outW * 4;
    imgData.data.set(pixels.subarray(src, src + outW * 4), dst);
  }
  octx.putImageData(imgData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob a échoué'))), 'image/jpeg', 0.9);
  });
  return blob;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const compile = (type: number, src: string): WebGLShader => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('Shader: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Link: ' + gl.getProgramInfoLog(prog));
  }
  return prog;
}

export default PanoCapture;
