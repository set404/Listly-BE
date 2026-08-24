// Same alphabet/shape as the frontend mock (e.g. "AB7-K92") — avoids
// visually ambiguous characters (0/O, 1/I, etc.).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChunk(length: number): string {
  return Array.from({ length }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
}

export function generateInviteCode(): string {
  return `${randomChunk(3)}-${randomChunk(3)}`;
}
