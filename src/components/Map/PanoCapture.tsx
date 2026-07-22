import React, { useEffect, useRef, useState, useCallback } from 'react';

interface CapturePoint {
  row: number;
  col: number;
  yaw: number;   // degrees
  pitch: number; // degrees
}

interface CapturedPhoto {
  bitmap: ImageBitmap;
  yaw: number;
  pitch: number;
  roll: number;
}

interface PanoCaptureProps {
  position: { x: number; y: number };
  onCancel: () => void;
  onComplete: (blob: Blob) => void;
}

// Capture grid: 3 rows (upper / equator / lower) × 8 columns.
const ROWS = 3;
const COLS = 8;
const ROW_PITCH = [-30, 0, 30]; // degrees
const OUTPUT_W = 4096;
const OUTPUT_H = 2048;
const RESIZED = 512; // each captured photo is resized to this square for the texture array

function buildGrid(): CapturePoint[] {
  const points: CapturePoint[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      points.push({
        row: r,
        col: c,
        yaw: (c * 360) / COLS,
        pitch: ROW_PITCH[r],
      });
    }
  }
  return points;
}

const PanoCapture: React.FC<PanoCaptureProps> = ({ onCancel, onComplete }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const grid = useRef<CapturePoint[]>(buildGrid());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stitching, setStitching] = useState(false);
  const [videoSize, setVideoSize] = useState({ w: 1280, h: 720 });

  // Start the camera
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
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
          await videoRef.current.play().catch(() => { /* ignore autoplay errors */ });
        }
      } catch (e) {
        setError('Impossible d’accéder à la caméra. Vérifiez les permissions et utilisez HTTPS.');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const captureCurrent = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const point = grid.current[currentIndex];
    // Draw the current video frame to an offscreen canvas at RESIZED square.
    const canvas = document.createElement('canvas');
    canvas.width = RESIZED;
    canvas.height = RESIZED;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Cover-fit the video frame into the square.
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
      next[currentIndex] = { bitmap, yaw: point.yaw, pitch: point.pitch, roll: 0 };
      return next;
    });
    setCurrentIndex((i) => Math.min(i + 1, grid.current.length - 1));
  }, [currentIndex, videoSize]);

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
      setError('Le assemblage du panorama a échoué : ' + (e as Error).message);
      setStitching(false);
    }
  }, [photos, videoSize, onComplete]);

  const total = grid.current.length;
  const done = photos.filter(Boolean).length;
  const point = grid.current[currentIndex];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 5000, background: '#000',
      display: 'flex', flexDirection: 'column', color: 'white', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <button onClick={onCancel} style={btnStyle('#444')}>✕ Annuler</button>
        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
          Créer un panorama 360° — {done}/{total}
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* Camera preview + capture guide */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Reticle for the current point */}
        {point && (
          <div style={{
            position: 'absolute', left: '50%', top: '50%', width: 90, height: 90,
            marginLeft: -45, marginTop: -45, borderRadius: '50%',
            border: '3px solid #28a745', boxShadow: '0 0 0 2px rgba(0,0,0,0.5)',
          }} />
        )}
        {error && (
          <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, background: 'rgba(200,0,0,0.85)', padding: '10px 12px', borderRadius: 8, fontSize: '0.82rem' }}>
            {error}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, padding: 16, justifyContent: 'center' }}>
        <button onClick={goBack} disabled={currentIndex === 0 || stitching} style={btnStyle('#444')}>◀ Précédent</button>
        {!allCaptured ? (
          <button onClick={captureCurrent} disabled={stitching} style={btnStyle('#007acc')}>
            Capturer ({done + 1}/{total})
          </button>
        ) : (
          <button onClick={handleCreate} disabled={stitching} style={btnStyle('#28a745')}>
            {stitching ? 'Assemblage…' : 'Créer le panorama'}
          </button>
        )}
      </div>
    </div>
  );
};

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '12px 18px',
  borderRadius: 10,
  border: 'none',
  background: bg,
  color: 'white',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
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

  // Horizontal FOV derived from a typical phone camera; vertical from aspect.
  const HFOV = (60 * Math.PI) / 180;
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
