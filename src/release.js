/* The latest desktop release, from GitHub.
 *
 * Cached for ten minutes: GitHub allows 60 unauthenticated API calls an hour
 * per IP, and a release changes far less often than that. GITHUB_TOKEN raises
 * the limit if the site ever shares an egress IP with something busy. When
 * the API cannot be reached, every download falls back to the releases page
 * — a link that always works, one click further away.
 */

const REPO = process.env.RELEASE_REPO || 'playstructs/structs-desktop';
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;
const TTL = 10 * 60 * 1000;

/* Which asset is which download. Order matters: the first match wins. */
const PLATFORMS = [
  { key: 'mac-arm', label: 'macOS', sub: 'Apple silicon', icon: 'mac', match: /_aarch64\.dmg$/ },
  { key: 'mac-intel', label: 'macOS', sub: 'Intel', icon: 'mac', match: /_x64\.dmg$/ },
  { key: 'windows', label: 'Windows', sub: '64-bit installer', icon: 'windows', match: /_x64-setup\.exe$/ },
  { key: 'linux-appimage', label: 'Linux', sub: 'AppImage', icon: 'linux', match: /_amd64\.AppImage$/ },
  { key: 'linux-deb', label: 'Linux', sub: '.deb', icon: 'linux', match: /_amd64\.deb$/ },
];

let memo = null;

export async function latest() {
  if (memo && memo.until > Date.now()) return memo.value;
  let value;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'structs.app',
        ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw Error(`GitHub ${r.status}`);
    const d = await r.json();
    value = {
      version: String(d.tag_name || '').replace(/^v/, ''),
      url: d.html_url || RELEASES_PAGE,
      published: d.published_at || null,
      downloads: PLATFORMS.map((p) => {
        const a = (d.assets || []).find((x) => p.match.test(x.name));
        return a ? { ...p, match: undefined, url: a.browser_download_url, size: a.size, name: a.name } : null;
      }).filter(Boolean),
    };
  } catch (e) {
    console.error('release:', e.message);
    // Keep serving the last good answer rather than downgrading to the page link.
    if (memo) { memo.until = Date.now() + 60 * 1000; return memo.value; }
    value = { version: null, url: RELEASES_PAGE, published: null, downloads: [] };
  }
  memo = { value, until: Date.now() + TTL };
  return value;
}

/** The download that suits a User-Agent best, or null to show them all. */
export function forAgent(release, ua) {
  const s = String(ua || '');
  const pick = (k) => release.downloads.find((d) => d.key === k) || null;
  if (/Windows/i.test(s)) return pick('windows');
  // Browsers on Apple silicon still say "Intel Mac OS X"; Apple silicon is the
  // only Mac sold since 2023, so it is the better default. Both are offered.
  if (/Mac OS X|Macintosh/i.test(s) && !/iPhone|iPad/i.test(s)) return pick('mac-arm');
  if (/Linux/i.test(s) && !/Android/i.test(s)) return pick('linux-appimage');
  return null;
}
