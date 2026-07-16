// No I or O — avoids misreads when the code is shouted across a room.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export const CODE_LENGTH = 4;
export const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

export function generateGameCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function isValidGameCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}
