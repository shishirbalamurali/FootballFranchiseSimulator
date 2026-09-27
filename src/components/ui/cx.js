/** Tiny class-name joiner. Falsy values are dropped. */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default cx;
