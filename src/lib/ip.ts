import ipaddr from 'ipaddr.js';

export const IP_ADDRESS_HEADERS = [
  ...(process.env.CLOUD_MODE ? ['x-umami-client-ip'] : []), // Umami custom header (cloud mode only)
  'true-client-ip', // CDN
  'cf-connecting-ip', // Cloudflare
  'fastly-client-ip', // Fastly
  'x-nf-client-connection-ip', // Netlify
  'do-connecting-ip', // Digital Ocean
  'x-real-ip', // Reverse proxy
  'x-appengine-user-ip', // Google App Engine
  'x-forwarded-for',
  'forwarded',
  'x-client-ip',
  'x-cluster-client-ip',
  'x-forwarded',
];

function normalizeIp(ip?: string | null) {
  if (!ip) return ip;

  try {
    const parsed = ipaddr.parse(ip);

    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      return (parsed as ipaddr.IPv6).toIPv4Address().toString();
    }

    return parsed.toString();
  } catch {
    // Fallback: return original if parsing fails
    return ip;
  }
}

function resolveIp(ip?: string | null) {
  if (!ip) return ip;

  // First, try as-is
  const normalized = normalizeIp(ip);
  try {
    ipaddr.parse(normalized);
    return normalized;
  } catch {
    // try stripping port (handles IPv4:port; leaves IPv6 intact)
    const stripped = stripPort(ip);
    if (stripped !== ip) {
      const normalizedStripped = normalizeIp(stripped);
      try {
        ipaddr.parse(normalizedStripped);
        return normalizedStripped;
      } catch {
        return normalizedStripped;
      }
    }

    return normalized;
  }
}

function isPrivateIpCandidate(ip?: string | null) {
  if (!ip) return false;
  // IPv4 private ranges and loopback
  // 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16
  if (/^(?:127|10)\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(?:1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  // IPv6 loopback and unique local addresses (fc00::/7)
  if (ip === '::1') return true;
  if (/^fc[0-9a-f]{2}:/.test(ip) || /^fd[0-9a-f]{2}:/.test(ip)) return true;
  return false;
}

export function getIpAddress(headers: Headers) {
  const customHeader = process.env.CLIENT_IP_HEADER;

  if (customHeader && headers.get(customHeader)) {
    return resolveIp(headers.get(customHeader));
  }

  const header = IP_ADDRESS_HEADERS.find(name => headers.get(name));
  if (!header) {
    return undefined;
  }

  const ip = headers.get(header);

  if (header === 'x-forwarded-for') {
    // Prefer the first public client IP in the x-forwarded-for list.
    const parts = ip?.split(',').map(p => p.trim()).filter(Boolean) || [];
    for (const part of parts) {
      const candidate = resolveIp(part);
      if (candidate && !isPrivateIpCandidate(candidate)) {
        return candidate;
      }
    }
    // Fallback to the first entry if all are private or parsing failed
    return resolveIp(parts[0]);
  }

  if (header === 'forwarded') {
    const match = ip.match(/for=(\[?[0-9a-fA-F:.]+]?)/);

    return match ? resolveIp(match[1]) : undefined;
  }

  return resolveIp(ip);
}

export function stripPort(ip?: string | null) {
  if (!ip) {
    return ip;
  }

  if (ip.startsWith('[')) {
    const endBracket = ip.indexOf(']');
    if (endBracket !== -1) {
      return ip.slice(0, endBracket + 1);
    }
  }

  const idx = ip.lastIndexOf(':');
  if (idx !== -1) {
    if (ip.includes('.') || /^[a-zA-Z0-9.-]+$/.test(ip.slice(0, idx))) {
      return ip.slice(0, idx);
    }
  }

  return ip;
}
