"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="bd-public-page bd-salon-empty"><h1>Nie udało się wczytać salonu.</h1><p>Spróbuj ponownie za chwilę.</p><button className="bd-button bd-button-primary" onClick={reset}>Spróbuj ponownie</button></main>; }
