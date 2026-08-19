// Character set excluding ambiguous characters: 0, O, 1, I
export const ROOM_CODE_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 5;

/**
 * Generates a random 5-character room code using safe uppercase characters and numbers.
 */
export function generateRoomCode(): string {
  let result = '';
  const charactersLength = ROOM_CODE_CHARSET.length;
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * charactersLength);
    result += ROOM_CODE_CHARSET.charAt(randomIndex);
  }
  return result;
}

/**
 * Validates whether a room code is formatted correctly (5 characters, valid charset).
 */
export function isValidRoomCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const clean = code.trim().toUpperCase();
  if (clean.length !== ROOM_CODE_LENGTH) return false;
  
  // Check that all characters are within the allowed charset
  for (const char of clean) {
    if (!ROOM_CODE_CHARSET.includes(char)) {
      return false;
    }
  }
  return true;
}

/**
 * Sanitizes input into an uppercase string with allowed characters only.
 */
export function sanitizeRoomCodeInput(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^2-9A-HJ-NP-Z]/g, '')
    .slice(0, ROOM_CODE_LENGTH);
}
