import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  withCredentials: true,
});

export interface UserProfile {
  email: string;
  username: string;
  avatar: string | null; // small data-URL image
  updated_at: string;
}

export const profileApi = {
  /** null = signed-in but no profile saved yet. Throws on network/auth errors. */
  async get(): Promise<UserProfile | null> {
    const r = await client.get<{ ok: boolean; profile: UserProfile | null }>('/profile');
    return r.data.profile ?? null;
  },

  async save(input: { username: string; avatar?: string | null }): Promise<UserProfile> {
    const r = await client.put<{ ok: boolean; profile: UserProfile; error?: string }>(
      '/profile',
      input,
    );
    if (!r.data.ok) throw new Error(r.data.error || 'Failed to save profile');
    return r.data.profile;
  },
};

/**
 * Resize an image file to a small square JPEG data URL (~10–25KB) so the
 * avatar stays well under the server's 300KB cap.
 */
export function resizeToAvatar(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      // Cover-crop to a centred square before scaling down.
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}
