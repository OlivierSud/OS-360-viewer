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
}

interface PanoCaptureProps {
  position: { x: number; y: number };
  onCancel: () => void;
  onComplete: (blob: Blob) => void;
}

// Grid of capture targets. 3 rows: equator (0), upper (-30), lower (30) x 8 columns.
const COLS = 8;
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
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

  // Perform single photo capture
  const captureCurrent = useCallback(async (actualYaw: number, actualPitch: number, actualRoll: number) => {
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

    setPhotos((prev) => {
      const next = [...prev];
      next[currentIndex] = { bitmap, yaw: actualYaw, pitch: actualPitch, roll: actualRoll };
      return next;
    });

    lockProgressRef.current = 0;
    if (currentIndex < grid.current.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, videoSize]);

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

  // Main UI update loops (using canvas + RAF for 60fps buttery-smooth target guides)
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
      const point = grid.current[currentIndex];

      if (!orientation.valid || !point) {
        // Fallback static guide if orientation sensor is unavailable
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, 45, 0, 2 * Math.PI);
        ctx.stroke();
        rafId = requestAnimationFrame(updateUI);
        return;
      }

      const cx = W / 2;
      const cy = H / 2;
      const f = Math.min(W, H) * 1.5; // Focal scale mapping angles to pixels

      const dyaw = getAngleDiff(point.yaw, orientation.yaw);
      const dpitch = point.pitch - orientation.pitch;

      const yawRad = dyaw * deg2rad;
      const pitchRad = dpitch * deg2rad;

      // Project target dot onto 2D screen
      const cosYaw = Math.cos(yawRad);
      const isTargetInFront = cosYaw > 0;
      const tx = cx + Math.sin(yawRad) * f;
      const ty = cy - Math.sin(pitchRad) * f;

      const distToTarget = Math.hypot(tx - cx, ty - cy);
      const targetThreshold = 25; // Snap alignment radius in px
      const isAligned = isTargetInFront && distToTarget < targetThreshold;

      // 1. Draw static center crosshair & reticle
      ctx.lineWidth = 2;
      if (isAligned) {
        ctx.strokeStyle = '#28a745';
        ctx.fillStyle = 'rgba(40, 167, 69, 0.15)';
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
      ctx.stroke();

      // 2. Draw target positioning point
      if (isTargetInFront) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = isAligned ? '#28a745' : '#ff9800';
        ctx.fillStyle = isAligned ? 'rgba(40, 167, 69, 0.4)' : 'rgba(255, 152, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(tx, ty, 16, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isAligned ? '#28a745' : '#ff9800';
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 3. Draw direction pointer arrows on edge of screen if target is off-screen
      const isTargetOffscreen = !isTargetInFront || tx < 20 || tx > W - 20 || ty < 20 || ty > H - 20;
      if (isTargetOffscreen) {
        const dx = tx - cx;
        const dy = ty - cy;
        const angle = Math.atan2(dy, dx);

        const edgeX = cx + Math.cos(angle) * (cx - 30);
        const edgeY = cy + Math.sin(angle) * (cy - 30);

        ctx.save();
        ctx.translate(edgeX, edgeY);
        ctx.rotate(angle);

        // Draw neon warning arrow pointing toward target
        ctx.fillStyle = '#ff9800';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-8, -10);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 4. Auto-capture logic when target is aligned & held steady
      if (isAligned && !stitching) {
        lockProgressRef.current = Math.min(1, lockProgressRef.current + 0.04); // Takes ~400ms to lock

        // Draw radial loading arc around the reticle
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#28a745';
        ctx.beginPath();
        ctx.arc(cx, cy, 38, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * lockProgressRef.current);
        ctx.stroke();

        if (lockProgressRef.current >= 1) {
          lockProgressRef.current = 0;
          captureCurrent(orientation.yaw, orientation.pitch, orientation.roll);
        }
      } else {
        lockProgressRef.current = Math.max(0, lockProgressRef.current - 0.08); // Decays faster
      }

      // 5. Draw modern Radar mini-map of captured grid positions in top-right
      const radarSize = 65;
      const rx = W - radarSize - 20;
      const ry = 20 + 40; // below title bar

      ctx.save();
      // Draw radar backdrop
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(rx, ry, radarSize, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Draw concentric rings representing pitch rows (-30, 0, 30)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.arc(rx, ry, radarSize * 0.4, 0, 2 * Math.PI);
      ctx.arc(rx, ry, radarSize * 0.75, 0, 2 * Math.PI);
      ctx.stroke();

      // Draw active sensor direction slice (radar sweep)
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      const sensorYawRad = orientation.yaw * deg2rad - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.arc(rx, ry, radarSize, sensorYawRad - 0.3, sensorYawRad + 0.3);
      ctx.closePath();
      ctx.fill();

      // Plot all grid points on the radar
      grid.current.forEach((pt, index) => {
        const ptYawRad = pt.yaw * deg2rad - Math.PI / 2;
        // Map pitch: -30 = outer circle, 0 = mid circle, 30 = inner circle
        let distFactor = 0.58; // default equator
        if (pt.pitch === -30) distFactor = 0.88;
        if (pt.pitch === 30) distFactor = 0.28;

        const ptx = rx + Math.cos(ptYawRad) * (radarSize * distFactor);
        const pty = ry + Math.sin(ptYawRad) * (radarSize * distFactor);

        const isCaptured = !!photos[index];
        const isCurrent = index === currentIndex;

        if (isCurrent) {
          ctx.fillStyle = '#ff9800'; // Pulsing orange target
          const pulse = 2 + Math.abs(Math.sin(Date.now() / 150)) * 2;
          ctx.beginPath();
          ctx.arc(ptx, pty, pulse, 0, 2 * Math.PI);
          ctx.fill();
        } else if (isCaptured) {
          ctx.fillStyle = '#28a745'; // Done green
          ctx.beginPath();
          ctx.arc(ptx, pty, 3.5, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; // Pending gray
          ctx.beginPath();
          ctx.arc(ptx, pty, 2.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
      ctx.restore();

      rafId = requestAnimationFrame(updateUI);
    };

    rafId = requestAnimationFrame(updateUI);
    return () => cancelAnimationFrame(rafId);
  }, [hasStarted, currentIndex, photos, stitching, captureCurrent]);

  const goBack = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const allCaptured = photos.filter(Boolean).length >= grid.current.length;

  const handleCreate = useCallback(async () => {
    const captured = photos.filter(Boolean) as CapturedPhoto[];
    if (captured.length < 2) {
      setError('Capturez au moins 2 photos pour créer un panorama.');
      return;
    }
    setStitching(true);
    try {
      const blob = await stitchPanorama(captured, OUTPUT_W, OUTPUT_H, videoSize);
      onComplete(blob);
    } catch (e) {
      setError('L’assemblage du panorama a échoué : ' + (e as Error).message);
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
            Tenez votre téléphone verticalement devant vous. Vous serez guidé visuellement pour capturer les 24 angles requis.
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

      {/* Header Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'rgba(15,15,20,0.85)', backdropFilter: 'blur(8px)', zIndex: 5010
      }}>
        <button onClick={onCancel} style={btnStyle('rgba(255,255,255,0.1)')}>✕ Annuler</button>
        <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>
          Panorama 360° — {done}/{total}
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* Camera Viewport + Targeting Canvas */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        
        {/* Real-time 60fps guidance canvas */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
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

      {/* Control Buttons (Manual Snapping / Reset) */}
      <div style={{
        display: 'flex', gap: 12, padding: '16px 20px', justifyContent: 'center',
        background: 'rgba(15,15,20,0.85)', backdropFilter: 'blur(8px)', zIndex: 5010
      }}>
        <button
          onClick={goBack}
          disabled={currentIndex === 0 || stitching}
          style={btnStyle(currentIndex === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)')}
        >
          ◀ Reculer
        </button>

        {!allCaptured ? (
          <button
            onClick={() => {
              const orient = deviceOrientationRef.current;
              captureCurrent(orient.yaw, orient.pitch, orient.roll);
            }}
            disabled={stitching}
            style={btnStyle('#007acc')}
          >
            Prendre la photo ({done + 1}/{total})
          </button>
        ) : (
          <button onClick={handleCreate} disabled={stitching} style={btnStyle('#28a745')}>
            {stitching ? 'Création du panorama…' : 'Finaliser le panorama'}
          </button>
        )}
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
function getPixels(src: ImageBitmap | HTMLCanvasElement | HTMLImageElement, size: number): Uint8Array {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src as CanvasImageSource, 0, 0, size, size);
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

  // Set wide angle lens FOV estimates (approx 70deg horizontal typical mobile camera)
  const HFOV = (68 * Math.PI) / 180;
  const aspect = videoSize.h / videoSize.w;
  const VFOV = 2 * Math.atan(Math.tan(HFOV / 2) * aspect);
  const tanHalfH = Math.tan(HFOV / 2);
  const tanHalfV = Math.tan(VFOV / 2);

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
    rollArr.push((p.roll * Math.PI) / 180);
    const px = getPixels(p.bitmap, RESIZED);
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
  mat3 rotZ(float a){ float c=cos(a),s=sin(a); return mat3(c,-s,0.0, s,c,0.0, 0.0,0.0,1.0); }

  void main() {
    float lng = v_uv.x * 2.0 * PI - PI;
    float lat = (1.0 - v_uv.y) * PI - PI / 2.0;
    vec3 world = vec3(cos(lat) * sin(lng), sin(lat), cos(lat) * cos(lng));

    vec3 best = vec3(0.0);
    float bestScore = -1.0;

    for (int i = 0; i < ${n}; i++) {
      mat3 R = rotY(u_yaw[i]) * rotX(u_pitch[i]) * rotZ(u_roll[i]);
      vec3 cam = transpose(R) * world;
      if (cam.z <= 0.0) continue;
      float xn = cam.x / cam.z;
      float yn = cam.y / cam.z;
      if (abs(xn) > u_tanH || abs(yn) > u_tanV) continue;
       float u = xn / (2.0 * u_tanH) + 0.5;
       float v = yn / (2.0 * u_tanV) + 0.5;
      vec3 col = texture(u_tex, vec3(u, v, float(i))).rgb;
      // quality: best near the photo center
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
