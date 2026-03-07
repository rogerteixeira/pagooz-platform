function bytesToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";

  for (const value of bytes) {
    out += value.toString(16).padStart(2, "0");
  }

  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const payload = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return bytesToHex(digest);
}
