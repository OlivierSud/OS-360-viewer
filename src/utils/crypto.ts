/**
 * Calcule le hash SHA-256 d'un texte en clair.
 * Utilise l'API Web Crypto standard, sans dépendance externe.
 * @returns Hash hexadécimal en minuscules (64 caractères)
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
