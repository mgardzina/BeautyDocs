import "dotenv/config";
import { hash } from "bcryptjs";
import { Pool } from "pg";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME;
  const phoneNumber = process.env.PHONE_NUMBER;
  const databaseUrl = process.env.DATABASE_URL;

  if (!email || !password || !name) {
    console.error("❌ Błąd: Ustaw zmienne ADMIN_EMAIL, ADMIN_PASSWORD i ADMIN_NAME w pliku .env");
    process.exit(1);
  }
  
  if (!phoneNumber) {
    console.error("❌ Błąd: Ustaw zmienną PHONE_NUMBER (np. +48xxxxxxxxx) w pliku .env lub przekaż jako PHONE_NUMBER=+48... npx ts-node scripts/create-admin.ts");
    process.exit(1);
  }

  if (!databaseUrl) {
    console.error("❌ Błąd: Ustaw zmienną DATABASE_URL w pliku .env");
    process.exit(1);
  }

  // Wyciągnij konfigurację z DATABASE_URL lub użyj domyślnej
  let connectionConfig: any = {
    ssl: false
  };

  if (databaseUrl) {
    try {
        console.log("Using DATABASE_URL for connection...");
        // Regex poprawiony, aby nie "zjadał" portu
        const urlPattern = /postgresql:\/\/([^:]+):([^@]+)@([^/:?]+)(?::(\d+))?\/([^?]+)/;
        const match = databaseUrl.match(urlPattern);

        if (match) {
            const user = match[1];
            const encodedPass = match[2];
            const host = match[3];
            // Użyj portu z URL lub zmiennej środowiskowej, lub domyślnego 5432
            const port = match[4] || process.env.DB_PORT || "5432";
            const dbName = match[5];
            
            console.log(`Using host: ${host}, port: ${port}`);

            connectionConfig = {
                user,
                password: decodeURIComponent(encodedPass),
                host,
                port: parseInt(port),
                database: dbName,
                ssl: false
            };
        } else {
             // Fallback to direct string if parsing fails
             console.log("⚠️  Could not parse DATABASE_URL with regex, using connection string directly.");
             connectionConfig = { connectionString: databaseUrl, ssl: false };
        }
    } catch (e) {
        console.warn("⚠️  Błąd parsowania DATABASE_URL, używam connectionString bezpośrednio.");
        connectionConfig = { connectionString: databaseUrl, ssl: false };
    }
  }

  console.log(`Connecting to database...`);
  
  const pool = new Pool(connectionConfig);

  try {
    // 2. Hashuj hasło
    const passwordHash = await hash(password, 12);

    // 3. Utwórz nowego admina
    console.log(`👤 Tworzenie admina: ${email} (tel: ${phoneNumber})...`);
    await pool.query(
      'INSERT INTO "AdminUser" (id, email, "passwordHash", name, "phoneNumber") VALUES (gen_random_uuid(), $1, $2, $3, $4)',
      [email, passwordHash, name, phoneNumber]
    );

    console.log(`✅ Admin utworzony pomyślnie!`);
    console.log(`   Email: ${email}`);
    console.log(`   Telefon: ${phoneNumber}`);
    console.log(`   Hasło: (zdefiniowane w env)`);
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
