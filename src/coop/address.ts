import { pickRelay } from '../../link/hosts';
import { RELAY_PATH } from '../../link/relay-path';

/** where the relay is: next to this page, or the machine `?relay=ip:port` names (a phone that scanned the hero's QR code), but only on this computer or a private network */
export function relayHost(): string {
  return pickRelay(new URLSearchParams(location.search).get('relay'), location.host);
}

export const relayUrl = (): string => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${relayHost()}${RELAY_PATH}`;

/** the hero game on the same machine, which the QR code opens (its dev server is on 5175); saved once the host edits it */
export function defaultPeer(): string {
  try {
    const saved = localStorage.getItem('slime-peer');
    if (saved) return saved;
  } catch { /* storage can be unavailable */ }
  return `${location.protocol}//${location.hostname}:5175/`;
}

export function savePeer(url: string): void {
  try { localStorage.setItem('slime-peer', url); } catch { /* storage can be unavailable */ }
}

/** what the QR code holds: the other game's page, told which room and whose relay to use. Null if the address is not a URL. */
export function joinUrl(peer: string, code: string, relay: string): string | null {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(peer) ? peer : `http://${peer}`);
    u.searchParams.set('join', code);
    u.searchParams.set('relay', relay);
    return u.toString();
  } catch {
    return null;
  }
}
