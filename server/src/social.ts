// Verifies a Google, Facebook or Zalo token and returns that provider's user id.
// Each provider needs its own app credentials in the environment; without them the provider stays off.
const json = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, init);
  return r.ok ? (await r.json()) as Record<string, any> : null;
};

export async function verifySocialToken(provider: string, token: string): Promise<string | null> {
  if (!token) return null;
  try {
    if (provider === 'google' && process.env.GOOGLE_CLIENT_ID) {
      const info = await json(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
      return info?.aud === process.env.GOOGLE_CLIENT_ID ? String(info.sub) : null;
    }
    if (provider === 'facebook' && process.env.FACEBOOK_APP_TOKEN) {
      const url = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(process.env.FACEBOOK_APP_TOKEN)}`;
      const info = await json(url);
      return info?.data?.is_valid ? String(info.data.user_id) : null;
    }
    if (provider === 'zalo' && process.env.ZALO_ENABLED) {
      const info = await json('https://graph.zalo.me/v2.0/me?fields=id', { headers: { access_token: token } });
      return info?.id ? String(info.id) : null;
    }
  } catch (e) {
    console.error('Social login check failed', e);
  }
  return null;
}
