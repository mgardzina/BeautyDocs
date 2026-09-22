import { BeautyDocsHeader } from "../BeautyDocsHeader";

export function PublicFormLoading() {
  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#173d35]">
      <BeautyDocsHeader />
      <main
        aria-busy="true"
        aria-label="Ładowanie formularza"
        className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6"
      >
        <div className="animate-pulse overflow-hidden rounded-3xl border border-stone-200 bg-white motion-reduce:animate-none">
          <div className="border-b border-stone-200 bg-[#f7f8f4] p-7">
            <div className="h-6 w-32 rounded-full bg-[#e9efe1]" />
            <div className="mt-6 h-10 w-4/5 rounded-lg bg-[#e9efe1]" />
            <div className="mt-4 h-5 w-2/3 rounded bg-[#e9efe1]" />
          </div>
          <div className="space-y-4 p-7">
            <div className="h-5 w-40 rounded bg-[#e9efe1]" />
            <div className="h-12 rounded-xl bg-[#f7f8f4]" />
            <div className="h-12 rounded-xl bg-[#f7f8f4]" />
            <div className="h-12 rounded-xl bg-[#f7f8f4]" />
          </div>
        </div>
        <span className="sr-only">Ładowanie formularza…</span>
      </main>
    </div>
  );
}
