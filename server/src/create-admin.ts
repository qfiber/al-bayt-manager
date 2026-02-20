import crypto from 'crypto';
import { db, pool } from './config/database.js';
import { users, profiles, userRoles } from './db/schema/index.js';
import { hashPassword } from './utils/bcrypt.js';
import { eq } from 'drizzle-orm';

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*_+-=?';
const ALL_CHARS = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;

/**
 * Generate a cryptographically random 16-character password
 * guaranteed to contain at least 2 of each character class
 * (uppercase, lowercase, digit, symbol) for high strength.
 */
function generateStrongPassword(): string {
  const pick = (charset: string) =>
    charset[crypto.randomInt(charset.length)];

  // Guarantee 2 from each class = 8 mandatory chars
  const mandatory = [
    pick(UPPERCASE), pick(UPPERCASE),
    pick(LOWERCASE), pick(LOWERCASE),
    pick(DIGITS), pick(DIGITS),
    pick(SYMBOLS), pick(SYMBOLS),
  ];

  // Fill remaining 8 from the full pool
  const remaining = Array.from({ length: 8 }, () => pick(ALL_CHARS));

  // Shuffle using Fisher-Yates
  const chars = [...mandatory, ...remaining];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

async function main() {
  const email = process.argv[2];

  if (!email || !email.includes('@')) {
    console.error('Usage: node dist/create-admin.js <email>');
    console.error('Example: node dist/create-admin.js admin@example.com');
    process.exit(1);
  }

  // Check if email already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    console.error(`Error: A user with email "${email}" already exists.`);
    process.exit(1);
  }

  const password = generateStrongPassword();
  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      email,
      passwordHash,
      emailConfirmed: true,
    }).returning();

    await tx.insert(profiles).values({
      id: user.id,
      name: 'Admin',
    });

    await tx.insert(userRoles).values({
      userId: user.id,
      role: 'admin',
    });
  });

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║            ADMIN ACCOUNT CREATED                 ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Email:    ${email.padEnd(37)}║`);
  console.log(`║  Password: ${password.padEnd(37)}║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Change this password after first login!         ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  await pool.end();
}

main().catch((err) => {
  console.error('Failed to create admin:', err.message);
  process.exit(1);
});
