/**
 * DevForge - JWT Inspector Module
 * Color-coded JWT decoding, claims analysis, live expiration timers, and offline security guarantee.
 */

function base64UrlDecode(str) {
  let output = str.replace(/-/g, '+').replace(/_/g, '/');
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw new Error('Illegal base64url string!');
  }

  if (typeof atob === 'function') {
    const binary = atob(output);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(output, 'base64').toString('utf8');
}

export const STANDARD_CLAIMS_INFO = {
  iss: 'Issuer - Identifies principal that issued the JWT',
  sub: 'Subject - Identifies the subject of the JWT (e.g. User ID)',
  aud: 'Audience - Identifies the recipients that the JWT is intended for',
  exp: 'Expiration Time - Unix timestamp when token expires',
  nbf: 'Not Before - Unix timestamp before which token must not be accepted',
  iat: 'Issued At - Unix timestamp when token was issued',
  jti: 'JWT ID - Unique identifier for the token',
  name: 'User Full Name',
  email: 'User Email Address',
  roles: 'Assigned User Roles',
  scope: 'OAuth 2.0 Granted Scopes',
};

export function inspectJwt(tokenString) {
  if (!tokenString || typeof tokenString !== 'string') {
    throw new Error('Please provide a JWT token string.');
  }

  const cleanToken = tokenString.trim();
  const parts = cleanToken.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid JWT format. A valid token must have exactly 3 parts separated by dots.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header, payload;
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch (err) {
    throw new Error('Failed to decode JWT Header: ' + err.message);
  }

  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch (err) {
    throw new Error('Failed to decode JWT Payload: ' + err.message);
  }

  // Analyze time claims
  const nowSec = Math.floor(Date.now() / 1000);
  let expiryStatus = null;

  if (payload.exp !== undefined) {
    const expSec = Number(payload.exp);
    const diff = expSec - nowSec;
    const expDate = new Date(expSec * 1000);

    if (diff > 0) {
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;
      let human = '';
      if (days > 0) human += `${days}d `;
      if (hours > 0 || days > 0) human += `${hours}h `;
      human += `${mins}m ${secs}s`;

      expiryStatus = {
        isExpired: false,
        isActive: true,
        text: `Active (Expires in ${human})`,
        date: expDate.toLocaleString(),
        iso: expDate.toISOString(),
        remainingSeconds: diff,
      };
    } else {
      const past = Math.abs(diff);
      const days = Math.floor(past / 86400);
      const hours = Math.floor((past % 86400) / 3600);
      const mins = Math.floor((past % 3600) / 60);
      let human = '';
      if (days > 0) human += `${days}d `;
      if (hours > 0 || days > 0) human += `${hours}h `;
      human += `${mins}m ago`;

      expiryStatus = {
        isExpired: true,
        isActive: false,
        text: `Expired (${human})`,
        date: expDate.toLocaleString(),
        iso: expDate.toISOString(),
        remainingSeconds: diff,
      };
    }
  }

  let issuedAtInfo = null;
  if (payload.iat !== undefined) {
    const iatSec = Number(payload.iat);
    const iatDate = new Date(iatSec * 1000);
    issuedAtInfo = {
      date: iatDate.toLocaleString(),
      iso: iatDate.toISOString(),
    };
  }

  return {
    raw: { headerB64, payloadB64, signatureB64 },
    header,
    payload,
    signature: signatureB64,
    expiryStatus,
    issuedAtInfo,
    algorithm: header.alg || 'none',
    type: header.typ || 'JWT',
  };
}
