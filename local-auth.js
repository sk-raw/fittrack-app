// Yerel prototip hesapları içindir; sunucu tarafı kimlik doğrulama sağlamaz.
export async function hashPassword(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(salt.match(/../g), hex => parseInt(hex, 16)), iterations: 210000 }, material, 256);
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function passwordRecord(password) {
  const passwordSalt = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  return { passwordSalt, passwordHash: await hashPassword(password, passwordSalt) };
}
