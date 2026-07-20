// Resolve the machine's local network IPv4 so links/QR codes work when
// scanned from a phone on the same Wi-Fi. Priority: Vite env var
// (written by start.bat) > WebRTC probe > nothing (falls back to origin).
export function getLanIp(): string | undefined {
  const fromEnv = (import.meta as any).env?.VITE_LAN_IP as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return (window as any).__os360LanIp as string | undefined;
}

export function getLanOrigin(baseOrigin: string, lanIp?: string): string {
  const ip = lanIp || getLanIp();
  try {
    const u = new URL(baseOrigin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]') {
      if (ip) return `${u.protocol}//${ip}:${u.port}`;
    }
  } catch {
    /* ignore */
  }
  return baseOrigin;
}

// Probe the local IP via WebRTC (STUN) and store it. Returns a promise so the
// caller can re-render once the IP is known (used as a fallback when no env).
export function detectLanIp(): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (getLanIp()) { resolve(getLanIp()); return; }
    const RTC = (window as any).RTCPeerConnection ||
      (window as any).webkitRTCPeerConnection;
    if (!RTC) { resolve(undefined); return; }
    const pc: any = new RTC({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    let done = false;
    const finish = (ip?: string) => {
      if (done) return;
      done = true;
      try { pc.close(); } catch {}
      (window as any).__os360LanIp = ip;
      resolve(ip);
    };
    pc.createDataChannel('');
    pc.onicecandidate = (event: any) => {
      if (!event || !event.candidate || done) return;
      const match = /([0-9]{1,3}\.){3}[0-9]{1,3}/.exec(event.candidate.candidate);
      if (match) {
        const ip = match[0];
        if (ip.startsWith('127.') || ip.startsWith('169.254.')) return;
        finish(ip);
      }
    };
    pc.createOffer()
      .then((offer: any) => pc.setLocalDescription(offer))
      .catch(() => finish(undefined));
    setTimeout(() => finish(getLanIp()), 2500);
  });
}


