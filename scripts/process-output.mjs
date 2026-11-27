const DEFAULT_CAPTURE_LIMIT = 64 * 1024;

export function appendBoundedOutput(current, chunk, maxBytes = DEFAULT_CAPTURE_LIMIT) {
  const combined = Buffer.concat([Buffer.from(current), Buffer.from(chunk)]);
  return combined.subarray(Math.max(0, combined.length - maxBytes)).toString("utf8");
}
