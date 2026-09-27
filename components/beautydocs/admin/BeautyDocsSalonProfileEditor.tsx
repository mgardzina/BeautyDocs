"use client";

import { useT } from "../i18n";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUp, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { salonPrice, type SalonProfileDraft, type SalonService } from "@/types/beautydocs-salon";
import { BeautyDocsImportServicesDialog } from "./BeautyDocsImportServicesDialog";

const empty: SalonProfileDraft = { introduction: "", about: "", photos: [], services: [], latitude: null, longitude: null };
const emptyService: SalonService = { name: "", description: "", price: 0, priceFrom: false, durationMinutes: null };

async function preparePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Wybierz zdjęcie JPG, PNG lub WebP do 10 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Nie udało się przygotować zdjęcia.");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.55, 0.4]) { const result = canvas.toDataURL("image/jpeg", quality); if (result.length <= 280000) return result; }
    throw new Error("Zdjęcie jest zbyt szczegółowe. Wybierz mniejszy plik.");
  } finally { bitmap.close(); }
}

export function BeautyDocsSalonProfileEditor({ slug, canEdit, visible }: { slug: string; canEdit: boolean; visible: boolean }) {
  const t = useT();
  const [draft, setDraft] = useState<SalonProfileDraft>(empty);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [serviceForm, setServiceForm] = useState<SalonService>(emptyService);
  const endpoint = `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(slug)}/profile`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Nie udało się pobrać profilu. Odśwież stronę i spróbuj ponownie.");
      const data = await response.json(); setDraft({ ...empty, ...data }); setLoaded(true);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [endpoint]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = (value: Partial<SalonProfileDraft>) => { setDraft(current => ({ ...current, ...value })); setDirty(true); setMessage(""); };
  const startAddService = () => { setServiceForm(emptyService); setEditingServiceIndex(-1); };
  const startEditService = (index: number) => { setServiceForm(draft.services[index]); setEditingServiceIndex(index); };
  const cancelServiceForm = () => { setEditingServiceIndex(null); setServiceForm(emptyService); };
  const saveServiceForm = () => {
    if (!serviceForm.name.trim()) return;
    const services = editingServiceIndex === -1
      ? [...draft.services, serviceForm].slice(0, 40)
      : draft.services.map((s, index) => index === editingServiceIndex ? serviceForm : s);
    update({ services });
    setEditingServiceIndex(null);
    setServiceForm(emptyService);
  };
  const deleteService = (index: number) => {
    update({ services: draft.services.filter((_, i) => i !== index) });
    if (editingServiceIndex === index) cancelServiceForm();
  };
  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = "";
    if (draft.photos.length + files.length > 6) { setError(t("W galerii może być maksymalnie 6 zdjęć.")); return; }
    setBusy(true); setError("");
    try { const photos = []; for (const file of files) photos.push({ dataUrl: await preparePhoto(file), caption: "" }); update({ photos: [...draft.photos, ...photos] }); }
    catch (error) { setError(error instanceof Error ? error.message : t("Nie udało się dodać zdjęć.")); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      if (!response.ok) throw new Error(response.status === 422 ? "Sprawdź zdjęcia, ceny i współrzędne. Obie współrzędne mapy są wymagane razem." : "Nie udało się zapisać profilu. Spróbuj ponownie.");
      setDirty(false); setMessage(t("Profil salonu został zapisany."));
    } catch (error) { setError(error instanceof Error ? error.message : t("Nie udało się zapisać profilu.")); }
    finally { setBusy(false); }
  }
  return <form className="bd-profile-editor" onSubmit={save}>
    <header><div><p className="bd-eyebrow">{t("Twoja wizytówka")}</p><h2>{t("Pokaż, co wyróżnia Twój salon.")}</h2><p>{t("Zdjęcia, kilka słów o Tobie i przejrzysta oferta. Wszystko w jednym miejscu.")}</p></div>{visible && <Link className="bd-button bd-button-secondary" target="_blank" href={`/salony/${slug}`}>{t("Zobacz stronę ↗")}</Link>}</header>
    {!visible && <p className="bd-profile-notice">{t("Profil jest ukryty. Aby go opublikować, włącz widoczność w wyszukiwarce w zakładce „Dane salonu”.")}</p>}
    {error && <p role="alert" className="bd-profile-notice">{error}</p>}
    {message && <p role="status" className="bd-profile-notice">{t(message)}</p>}
    {!loaded && !error && <p role="status">{t("Wczytywanie profilu…")}</p>}
    <fieldset disabled={!loaded || !canEdit || busy}>
      <section><h3>{t("O salonie i o Tobie")}</h3><label>{t("Krótki opis")}<input maxLength={200} value={draft.introduction} onChange={e => update({ introduction: e.target.value })} placeholder={t("Co sprawia, że warto Cię poznać?")} /></label><label>{t("Opowiedz więcej")}<textarea rows={6} maxLength={5000} value={draft.about} onChange={e => update({ about: e.target.value })} placeholder={t("Twoje doświadczenie, podejście do pracy, atmosfera i specjalizacje salonu…")} /></label></section>
      <section><h3>{t("Galeria")}{" "}<span>{draft.photos.length}/6</span></h3><p>{t("Pierwsze zdjęcie jest okładką. Dodaj wnętrze, swoje zdjęcie lub efekty pracy, które możesz opublikować.")}</p><div className="bd-editor-photos">{draft.photos.map((photo, i) => <div key={i}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.dataUrl} alt={photo.caption || t("Zdjęcie {value1}", { value1: i + 1 })} />
        <label>{t("Opis zdjęcia")}{" "}{i + 1}<input maxLength={160} value={photo.caption} onChange={e => update({ photos: draft.photos.map((p, index) => index === i ? { ...p, caption: e.target.value } : p) })} /></label>
        <div className="bd-editor-actions">{i > 0 && <button type="button" onClick={() => update({ photos: [photo, ...draft.photos.filter((_, index) => index !== i)] })}><ArrowUp size={16} />{" "}{t("Na okładkę")}</button>}<button type="button" aria-label={t("Usuń zdjęcie {value1}", { value1: i + 1 })} onClick={() => update({ photos: draft.photos.filter((_, index) => index !== i) })}><Trash2 size={16} />{" "}{t("Usuń")}</button></div>
      </div>)}</div>{draft.photos.length < 6 && <label className="bd-photo-upload"><ImagePlus size={20} />{" "}{t("Dodaj zdjęcia")}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} /></label>}</section>
      <section><h3>{t("Usługi i ceny")}</h3><p>{t("Cennik ma charakter informacyjny. BeautyDocs nie pobiera opłat za te usługi. Ceny podaj w złotych. Nazwy możesz zaimportować z formularzy zabiegowych, żeby były spójne z dokumentacją.")}</p>
        <div className="bd-editor-actions">
          <BeautyDocsImportServicesDialog
            disabled={!loaded || !canEdit || busy}
            existingNames={draft.services.map((s) => s.name)}
            onImport={(services: SalonService[]) => update({ services: [...draft.services, ...services].slice(0, 40) })}
            remainingSlots={Math.max(0, 40 - draft.services.length)}
            slug={slug}
          />
          {editingServiceIndex === null && draft.services.length < 40 && (
            <button className="bd-button bd-button-secondary" type="button" onClick={startAddService}><Plus size={18} />{" "}{t("Dodaj usługę")}</button>
          )}
        </div>

        {editingServiceIndex !== null && <div className="bd-editor-service">
          <label>{t("Nazwa usługi")}<input required maxLength={120} value={serviceForm.name} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} /></label>
          <div className="bd-editor-columns"><label>{t("Cena (zł)")}<input type="text" inputMode="decimal" required maxLength={10} value={String(serviceForm.price / 100)} onFocus={e => e.target.select()} onChange={e => {
            const raw = e.target.value.replace(",", ".").trim();
            if (raw === "") { setServiceForm({ ...serviceForm, price: 0 }); return; }
            if (!/^\d{0,7}(\.\d{0,2})?$/.test(raw) || raw.endsWith(".")) return;
            setServiceForm({ ...serviceForm, price: Math.min(100000000, Math.round(Number(raw) * 100)) });
          }} /></label><label>{t("Czas (min, opcjonalnie)")}<input type="number" min="5" max="1440" value={serviceForm.durationMinutes ?? ""} onChange={e => setServiceForm({ ...serviceForm, durationMinutes: e.target.value ? Number(e.target.value) : null })} /></label></div>
          <label className="bd-checkbox-label"><input type="checkbox" checked={serviceForm.priceFrom} onChange={e => setServiceForm({ ...serviceForm, priceFrom: e.target.checked })} />{" "}{t("Pokaż cenę „od”")}</label>
          <label>{t("Opis (opcjonalnie)")}<textarea rows={2} maxLength={500} value={serviceForm.description} onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })} /></label>
          <div className="bd-editor-actions">
            <button className="bd-button bd-button-secondary" type="button" onClick={cancelServiceForm}>{t("Anuluj")}</button>
            <button className="bd-button bd-button-primary" disabled={!serviceForm.name.trim()} type="button" onClick={saveServiceForm}>{t("Zapisz usługę")}</button>
          </div>
        </div>}

        {draft.services.length === 0 && editingServiceIndex === null && <p className="bd-services-empty">{t("Nie masz jeszcze żadnych usług w cenniku.")}</p>}

        <div className="bd-service-list">
          {draft.services.map((service, i) => editingServiceIndex === i ? null : <div key={i} className="bd-service-card">
            <div>
              <h4>{service.name}</h4>
              <p>{salonPrice(service)}{service.durationMinutes ? ` · ${service.durationMinutes} min` : ""}</p>
            </div>
            <div className="bd-service-card-actions">
              <button disabled={editingServiceIndex !== null} type="button" onClick={() => startEditService(i)}><Pencil size={16} />{" "}{t("Edytuj")}</button>
              <button disabled={editingServiceIndex !== null} type="button" onClick={() => deleteService(i)}><Trash2 size={16} />{" "}{t("Usuń")}</button>
            </div>
          </div>)}
        </div>
      </section>
      <section><h3>{t("Lokalizacja na mapie")}</h3><p>{t("Adres i telefon zmienisz w „Dane salonu”. Aby zaznaczyć dokładne wejście na mapie, dodaj współrzędne miejsca (np. z map Google).")}</p><div className="bd-editor-columns"><label>{t("Szerokość geograficzna")}<input type="number" min="-85" max="85" step="any" placeholder={t("np. 52.2297")} value={draft.latitude ?? ""} onChange={e => update({ latitude: e.target.value ? Number(e.target.value) : null })} /></label><label>{t("Długość geograficzna")}<input type="number" min="-180" max="180" step="any" placeholder={t("np. 21.0122")} value={draft.longitude ?? ""} onChange={e => update({ longitude: e.target.value ? Number(e.target.value) : null })} /></label></div></section>
      <footer><span>{dirty ? t("Masz niezapisane zmiany") : t("Profil publiczny salonu")}</span><button className="bd-button bd-button-primary" type="submit" disabled={!dirty || busy}>{busy ? t("Zapisywanie…") : t("Zapisz profil")}</button></footer>
    </fieldset>
  </form>;
}
