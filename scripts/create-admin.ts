import "dotenv/config";
import { Pool } from "pg";
import { hash } from "bcryptjs";

const pool = new Pool({
  user: "postgres",
  password: process.env.DATABASE_URL?.split(":")[2].split("@")[0].replace(/%3E/g, ">").replace(/%29/g, ")").replace(/%24/g, "$"),
  host: "localhost",
  port: 5433,
  database: "powderbrowsacademypl",
  ssl: false,
});

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME;

  if (!email || !password || !name) {
    console.error("❌ Błąd: Ustaw zmienne ADMIN_EMAIL, ADMIN_PASSWORD i ADMIN_NAME w pliku .env");
    process.exit(1);
  }

  // Sprawdź czy admin już istnieje
  const existing = await pool.query(
    'SELECT id, email FROM "AdminUser" WHERE email = $1',
    [email]
  );

  if (existing.rows.length > 0) {
    console.log(`Admin z emailem ${email} już istnieje.`);
    await pool.end();
    return;
  }

  // Hashuj hasło
  const passwordHash = await hash(password, 12);

  // Utwórz admina
  const result = await pool.query(
    'INSERT INTO "AdminUser" (id, email, "passwordHash", name) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id, email, name',
    [email, passwordHash, name]
  );

  const admin = result.rows[0];
  console.log(`✅ Admin utworzony pomyślnie:`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Nazwa: ${admin.name}`);
  console.log(`\n⚠️  WAŻNE: Zmień hasło po pierwszym logowaniu!`);

  await pool.end();
}

main().catch((e) => {
  console.error("❌ Błąd:", e.message);
  pool.end();
  process.exit(1);
});
