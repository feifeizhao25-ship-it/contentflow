  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
  }
  return key + '_' + Math.abs(hash).toString(36).substring(0, 4);
}
for (const entries of allStrings.values()) {
