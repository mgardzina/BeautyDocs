import "dotenv/config";
import { Pool } from "pg";
import { hash } from "bcryptjs";

const connectionString = process.env.DATABASE_URL?.replace(/[?&]sslmode=[^&]+/, "");

const pool = new Pool({
  connectionString,
  ssl: false,
});

async function createUser() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Użycie: npx tsx scripts/create-user.ts <email> <hasło> [imię]");
    console.log("Przykład: npx tsx scripts/create-user.ts user@example.com haslo123 'Imię Nazwisko'");
    process.exit(1);
  }

  const [email, password, name = "Administrator"] = args;

  // Sprawdź czy użytkownik już istnieje
  const existing = await pool.query(
    'SELECT id, email FROM "AdminUser" WHERE email = $1',
    [email]
  );

  if (existing.rows.length > 0) {
    console.log(`❌ Użytkownik z emailem ${email} już istnieje.`);
    await pool.end();
    process.exit(1);
  }

  // Hashuj hasło
  const passwordHash = await hash(password, 12);

  // Utwórz użytkownika
  const result = await pool.query(
    'INSERT INTO "AdminUser" (id, email, "passwordHash", name) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id, email, name',
    [email, passwordHash, name]
  );

  const user = result.rows[0];
  console.log("✅ Użytkownik utworzony:");
  console.log(`   Email: ${user.email}`);
  console.log(`   Nazwa: ${user.name}`);
  console.log(`   ID: ${user.id}`);

  await pool.end();
}

createUser().catch((e) => {
  console.error("❌ Błąd:", e.message);
  pool.end();
  process.exit(1);
});
