import "dotenv/config";
import { hash } from "bcryptjs";
import { Pool } from "pg";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME;
  const databaseUrl = process.env.DATABASE_URL;

  if (!email || !password || !name) {
    console.error("❌ Błąd: Ustaw zmienne ADMIN_EMAIL, ADMIN_PASSWORD i ADMIN_NAME w pliku .env");
    process.exit(1);
  }

  if (!databaseUrl) {
    console.error("❌ Błąd: Ustaw zmienną DATABASE_URL w pliku .env");
    process.exit(1);
  }

  // Wyciągnij hasło z URL i zdekoduj je
  let connectionString = databaseUrl;
  const port = process.env.DB_PORT || "5432";

  try {
    // Proste parsowanie dla postgresql://user:pass@host/db
    const urlPattern = /postgresql:\/\/([^:]+):([^@]+)@([^/?]+)\/([^?]+)/;
    const match = databaseUrl.match(urlPattern);
    
    if (match) {
      const user = match[1];
      const encodedPass = match[2];
      const hostPath = match[3];
      const dbName = match[4];
      
      const decodedPass = decodeURIComponent(encodedPass);
      
      // Budujemy nowe połączenie lokalne
      connectionString = `postgresql://${user}:${encodeURIComponent(decodedPass)}@localhost:${port}/${dbName}?sslmode=disable`;
    }
  } catch (e) {
    console.warn("⚠️  Ostrzeżenie: Nie udało się automatycznie przemapować DATABASE_URL, używam oryginału.");
  }

  console.log(`Connecting to database on port ${port}...`);
  
  const pool = new Pool({ 
    connectionString,
    ssl: false 
  });

  try {
    // Sprawdź czy admin już istnieje
    const existing = await pool.query(
      'SELECT id FROM "AdminUser" WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      console.log(`Admin z emailem ${email} już istnieje.`);
      return;
    }

    // Hashuj hasło
    const passwordHash = await hash(password, 12);

    // Utwórz admina
    await pool.query(
      'INSERT INTO "AdminUser" (id, email, "passwordHash", name) VALUES (gen_random_uuid(), $1, $2, $3)',
      [email, passwordHash, name]
    );

    console.log(`✅ Admin utworzony pomyślnie:`);
    console.log(`   Email: ${email}`);
    console.log(`   Nazwa: ${name}`);
    console.log(`\n⚠️  WAŻNE: Zmień hasło po pierwszym logowaniu!`);
  } catch (error) {
    console.error("❌ Błąd podczas tworzenia admina:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ Błąd krytyczny:", e.message);
  process.exit(1);
});
