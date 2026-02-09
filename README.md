# PowderBrows Academy - System Zarządzania Klientkami

Profesjonalny system formularzy zgód i zarządzania klientkami dla studia makijażu permanentnego PowderBrows Academy.

## 🌟 Funkcje

### Formularze Zgód
- **Trzy typy formularzy**: Kwas hialuronowy, Makijaż permanentny (PMU), Laser
- **Wywiad zdrowotny** - szczegółowe pytania o przeciwwskazania
- **Podpisy cyfrowe** - zapis podpisów klientek
- **Zgody RODO** - przetwarzanie danych, marketing, fotografie

### Panel Administracyjny
- **Autentykacja** - system logowania z wieloma użytkownikami
- **Edycja zabiegów** - możliwość modyfikacji danych formularzy
- **Baza klientek** - pełna historia zabiegów każdej klientki
- **Notatki z kategoriami** - Alergie, Uwagi, Preferencje, Notatki
- **Statystyki** - przegląd zgód RODO, marketingowych i fotograficznych

### Interfejs
- **Responsywny design** - dostosowany do mobile, tablet i desktop
- **Elegancka kolorystyka** - beże, taupe i ciepłe akcenty
- **Animacje i przejścia** - płynne interakcje użytkownika

## 🛠️ Technologie

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Styling**: Tailwind CSS
- **Baza danych**: PostgreSQL (Google Cloud SQL)
- **ORM**: Prisma z adapterem pg
- **Autentykacja**: NextAuth.js v5
- **Hosting**: Google Cloud Run
- **CI/CD**: Google Cloud Build
- **Icons**: Lucide React
- **TypeScript**: Pełne typowanie

## 📦 Instalacja

```bash
# Klonowanie repozytorium
git clone git@github.com:mgardzina/Royal-Lips.git
cd Royal-Lips

# Instalacja zależności
npm install

# Konfiguracja zmiennych środowiskowych
cp .env.example .env
# Uzupełnij .env swoimi kluczami

# Generowanie klienta Prisma
npx prisma generate

# Uruchomienie serwera deweloperskiego
npm run dev
```

Aplikacja będzie dostępna pod adresem: http://localhost:3000

## 🔑 Zmienne Środowiskowe

Utwórz plik `.env` w głównym katalogu:

```env
# Baza danych PostgreSQL
DATABASE_URL="postgresql://user:password@host:5432/database"

# NextAuth
NEXTAUTH_SECRET="your_secret_key"
NEXTAUTH_URL="https://your-domain.com"

# Admin (do skryptu create-admin)
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="your_password"
ADMIN_NAME="Administrator"
```

## 👤 Tworzenie Użytkowników

```bash
# Utwórz admina z danych w .env
npx tsx scripts/create-admin.ts

# Utwórz użytkownika z argumentów
npx tsx scripts/create-user.ts email@example.com haslo123 "Imię Nazwisko"
```

## 🚀 Deploy na Google Cloud Run

```bash
# Build przez Cloud Build
gcloud builds submit --tag gcr.io/royal-lips/royal-lips1 --timeout=1200

# Deploy
gcloud run deploy royal-lips1 \
  --image gcr.io/royal-lips/royal-lips1:latest \
  --region europe-west3 \
  --platform managed
```

## 📁 Struktura Projektu

```
royal-lips/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/[...nextauth]/   # NextAuth endpoints
│   │   ├── clients/              # API klientek
│   │   │   ├── [id]/             # Szczegóły klientki
│   │   │   │   └── notes/        # Notatki klientki
│   │   └── consent-forms/        # API formularzy zgód
│   │       └── [id]/             # CRUD formularza
│   ├── admin/                    # Panel administracyjny
│   │   ├── formularz/[id]/       # Szczegóły formularza (edycja)
│   │   ├── klientki/             # Lista klientek
│   │   │   └── [id]/             # Profil klientki
│   │   ├── login/                # Strona logowania
│   │   └── statystyki/           # Statystyki zgód
│   ├── polityka-prywatnosci/     # Polityka prywatności
│   ├── regulamin/                # Regulamin
│   └── page.tsx                  # Strona główna (formularze)
├── components/                   # Komponenty React
│   ├── ConsentForms/             # Formularze zgód
│   │   ├── HyaluronicAcidForm.tsx
│   │   ├── PMUForm.tsx
│   │   └── LaserForm.tsx
│   ├── FormComponents/           # Komponenty formularzy
│   └── ui/                       # Komponenty UI
├── lib/                          # Utilities
│   ├── auth.ts                   # Konfiguracja NextAuth
│   └── prisma.ts                 # Klient Prisma
├── prisma/                       # Schemat bazy danych
│   └── schema.prisma
├── scripts/                      # Skrypty pomocnicze
│   ├── create-admin.ts           # Tworzenie admina
│   └── create-user.ts            # Tworzenie użytkownika
├── types/                        # TypeScript types
│   └── booking.ts                # Typy formularzy
├── middleware.ts                 # Middleware autentykacji
├── Dockerfile                    # Docker container
└── cloudbuild.yaml               # Google Cloud Build config
```

## 🗃️ Schemat Bazy Danych

### Modele Prisma

- **Client** - klientka (imię, telefon)
- **ClientNote** - notatki z kategoriami (NOTATKA, ALERGIA, UWAGA, PREFERENCJA)
- **ConsentForm** - formularze zgód (HYALURONIC, PMU, LASER)
- **AdminUser** - użytkownicy panelu administracyjnego

## 🎨 Kolorystyka

```css
--primary-beige: #C4B5A0;
--primary-taupe: #8b7355;
--bg-light: #f8f6f3;
--bg-main: #efe9e1;
--text-dark: #4a4540;
--text-light: #FFFFFF;
```

## 📱 Responsywność

- **Mobile**: 320px - 768px
- **Tablet**: 768px - 1024px
- **Desktop**: 1024px+

## 🔒 Bezpieczeństwo

- Autentykacja NextAuth z bcrypt hash passwords
- Walidacja wszystkich danych wejściowych
- Middleware ochrona tras /admin/*
- Environment variables dla kluczy
- HTTPS wymuszony na produkcji
- Trust host dla Cloud Run proxy

## 📄 Licencja

MIT License - zobacz plik [LICENSE](LICENSE)

## 👤 Autor

**Mateusz Gardzina**

**PowderBrows Academy** © 2026 - Profesjonalny makijaż permanentny
