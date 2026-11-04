import { describe, expect, it } from 'vitest';
import { joinUrl } from '../../../src/coop/address';
import { qrSvg } from '../../../src/coop/qr';

describe('QR join link', () => {
  it('carries the room code and the host relay on the address of the other game', () => {
    expect(joinUrl('http://192.168.1.5:5175/', 'ABCD', '192.168.1.5:5173')).toBe('http://192.168.1.5:5175/?join=ABCD&relay=192.168.1.5%3A5173');
    expect(joinUrl('192.168.1.5:5175', 'WXYZ', 'h:1')).toBe('http://192.168.1.5:5175/?join=WXYZ&relay=h%3A1');
    expect(joinUrl('http://::bad', 'ABCD', 'h:1')).toBeNull();
  });

  it('draws a QR code for it', () => {
    const svg = qrSvg('http://192.168.1.5:5175/?join=ABCD&relay=192.168.1.5%3A5173');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<path');
  });
});
