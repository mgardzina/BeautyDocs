import Link from "next/link";
export default function NotFound() { return <main className="bd-public-page bd-salon-empty"><h1>Ten salon nie jest dostępny.</h1><p>Profil może być ukryty lub adres jest nieprawidłowy.</p><Link className="bd-button bd-button-primary" href="/salony">Wróć do salonów</Link></main>; }
