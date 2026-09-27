/* eslint-disable jsx-a11y/alt-text -- React PDF images are document primitives, not HTML. */
/** Node-only, printable copies of the versioned form records returned by the API. */
import React from "react";
import path from "node:path";
import { Document, Font, Image, Page, Path, Svg, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { BeautyDocsAdminClientFormDetail, BeautyDocsAdminFormAnswerSection } from "@/types/beautydocs-admin";
import type { BeautyDocsConsumerDocumentDetail } from "@/types/beautydocs-consumer";
import { resolveBodyAreaSet, resolveFaceAreaSet, type FaceAreaSet } from "@/components/beautydocs/forms/face-area-zones";

Font.register({ family: "BeautyDocsPrint", fonts: [
  { src: path.join(process.cwd(), "public/fonts/pdf/NotoSans-Regular.ttf"), fontWeight: 400 },
  { src: path.join(process.cwd(), "public/fonts/pdf/NotoSans-Semibold.ttf"), fontWeight: 600 },
] });
Font.registerHyphenationCallback((word) => word.length > 45 ? (word.match(/.{1,35}/gu) ?? [word]) : [word]);

export interface FormPdfData {
  id: string; title: string; salon: string; version: number | null; status: string;
  signedAt: string | null; sections: readonly BeautyDocsAdminFormAnswerSection[];
  anatomy: BeautyDocsAdminClientFormDetail["anatomy"];
  treatmentAreaIds: readonly string[];
  signatures: Record<string, Buffer>; practitionerName: string | null;
  practitionerSignedAt: string | null; practitionerSignature: Buffer | null;
  documentHash: string | null;
}
export function adminPdfData(detail: BeautyDocsAdminClientFormDetail, salon: string): FormPdfData {
  return { id: detail.submission.id, title: detail.printMetadata?.formName ?? detail.submission.templateName, salon: detail.printMetadata?.salonName ?? salon,
    version: detail.submission.templateVersion, status: detail.submission.status,
    signedAt: detail.printMetadata?.clientSignedAt ?? detail.submission.submittedAt, sections: detail.sections,
    anatomy: detail.anatomy, treatmentAreaIds: detail.treatmentAreaIds, signatures: {},
    practitionerName: detail.practitioner?.displayName ?? null,
    practitionerSignedAt: detail.practitioner?.signedAt ?? null,
    practitionerSignature: null, documentHash: detail.documentHash };
}
export function consumerPdfData(detail: BeautyDocsConsumerDocumentDetail): FormPdfData {
  return { id: detail.submissionId, title: detail.formName, salon: detail.salonName,
    version: detail.printMetadata?.templateVersion ?? null, status: detail.status, signedAt: detail.clientSignedAt,
    sections: detail.sections, anatomy: detail.anatomy, treatmentAreaIds: detail.treatmentAreaIds,
    signatures: {}, practitionerName: typeof detail.practitioner?.displayName === "string" ? detail.practitioner.displayName : null,
    practitionerSignedAt: detail.practitionerSignedAt, practitionerSignature: null, documentHash: detail.printMetadata?.documentHash ?? null };
}
const s = StyleSheet.create({
  page: { fontFamily: "BeautyDocsPrint", fontSize: 10, lineHeight: 1.55, color: "#202923", paddingTop: 70, paddingBottom: 62, paddingHorizontal: 44 },
  eyebrow: { fontSize: 8, color: "#526259", letterSpacing: 1, marginBottom: 6 },
  title: { fontSize: 24, lineHeight: 1.2, fontWeight: 600, color: "#173d35", marginBottom: 12 },
  meta: { fontSize: 9, color: "#526259", marginBottom: 4 },
  summary: { backgroundColor: "#f4f6f1", padding: 14, marginTop: 12, marginBottom: 12, borderRadius: 4 },
  heading: { fontSize: 13, fontWeight: 600, color: "#173d35", marginTop: 20, marginBottom: 8 },
  row: { borderBottomWidth: 0.5, borderColor: "#dfe4dc", paddingVertical: 10 },
  label: { fontWeight: 600, marginBottom: 3 },
  detail: { paddingRight: 12, fontSize: 10, color: "#3f4b44", marginTop: 5, lineHeight: 1.6 },
  signature: { width: 210, height: 65, objectFit: "contain", objectPosition: "left", marginVertical: 8 },
  caption: { fontSize: 8, color: "#526259" },
});
const CONSENT_SIGNATURES: Record<string, string> = { zgodaWykonanieZabiegu: "podpisDane", zgodaPrzetwarzanieDanych: "podpisRodo", zgodaMarketing: "podpisMarketing", zgodaFotografie: "podpisFotografie" };
function date(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "Nie zarejestrowano";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Warsaw" }).format(new Date(value));
}
function answerValue(value: string | null, kind: string) {
  if (kind === "signature" && value === "signed") return "Podpis złożony";
  if (value === null || value === "") return "Nie podano";
  if (["yes", "true", "tak"].includes(value.toLowerCase())) return kind === "signature" ? "Podpis złożony" : "Tak";
  if (["no", "false", "nie"].includes(value.toLowerCase())) return kind === "signature" ? "Brak podpisu" : "Nie";
  return value;
}
function Diagram({ area, ids }: { area: FaceAreaSet; ids: readonly string[] }) {
  const zones = area.zones.filter((zone) => ids.includes(zone.id));
  if (!zones.length) return null;
  const height = 230; const width = height * area.viewBoxWidth / area.viewBoxHeight;
  return <View wrap={false} style={{ marginVertical: 12 }}>
    <View style={{ width, height, alignSelf: "center" }}>
      <Image src={path.join(process.cwd(), "public", area.chartImage)} style={{ width, height }} />
      <Svg viewBox={`0 0 ${area.viewBoxWidth} ${area.viewBoxHeight}`} style={{ position: "absolute", top: 0, left: 0, width, height }}>
        {zones.map((zone) => <Path key={zone.id} d={zone.d} fill="#245c4d" fillOpacity={0.25} stroke="#173d35" strokeWidth={2} />)}
      </Svg>
    </View>
    <Text style={s.caption}>{zones.map((zone) => zone.name).join(", ")}</Text>
  </View>;
}
export async function generateBeautyDocsPdf(data: FormPdfData): Promise<Buffer> {
  const rendered = new Set<string>();
  const face = resolveFaceAreaSet(data.anatomy?.faceZoneSet);
  const body = resolveBodyAreaSet(data.anatomy?.bodyZoneSet);
  return Buffer.from(await renderToBuffer(<Document title={data.title} author="BeautyDocs" language="pl-PL">
    <Page size="A4" style={s.page} wrap>
      <Text fixed style={{ position: "absolute", top: 800, left: 44, fontSize: 8, color: "#526259" }} render={() => `${data.id.slice(0, 8).toUpperCase()} / Dokument prywatny`} />
      <Text fixed style={{ position: "absolute", top: 800, right: 44, fontSize: 8, color: "#526259" }} render={({ pageNumber, totalPages }) => `Strona ${pageNumber} z ${totalPages}`} />
      <Text fixed style={{ position: "absolute", top: 25, left: 44, right: 44, fontSize: 8, color: "#526259", borderBottomWidth: 0.5, borderColor: "#ccd5cc", paddingBottom: 9 }} render={() => `BeautyDocs  /  ${data.salon}`} />
      <Text style={s.eyebrow}>DOKUMENTACJA ZABIEGOWA</Text>
      <Text style={s.title}>{data.title}</Text>
      <Text style={s.meta}>Nr dokumentu: {data.id}</Text>
      {data.version !== null && <Text style={s.meta}>Wersja formularza: {data.version}</Text>}
      <View style={s.summary} wrap={false}>
        <Text style={s.label}>{data.status === "SIGNED" ? "Formularz podpisany" : data.status === "SUBMITTED" ? "Oczekuje na podpis osoby wykonującej zabieg" : "Formularz roboczy"}</Text>
        <Text style={s.meta}>Podpis klienta: {date(data.signedAt)}</Text>
        <Text style={s.caption}>Kopia do pobrania i wydruku. Stan dokumentu w chwili wygenerowania.</Text>
      </View>
      {data.sections.map((section, index) => <View key={`${section.key}-${index}`}>
        {section.items.map((item, i) => {
          const key = item.kind === "signature" ? item.key : CONSENT_SIGNATURES[item.key];
          const signature = key && !rendered.has(key) ? data.signatures[key] : null;
          if (signature) rendered.add(key);
          return <View key={`${item.key}-${i}`} wrap={(item.label.length + (item.value?.length ?? 0) + (item.detail?.length ?? 0)) > 1600}>
            {i === 0 && <Text style={s.heading}>{String(index + 1).padStart(2, "0")} / {section.title}</Text>}
            <View style={s.row}>
            {item.kind === "field" && !item.detail && item.label.length < 80 && (item.value?.length ?? 0) < 160 ? (
              <View style={{ flexDirection: "row" }}>
                <Text style={{ width: "40%", paddingRight: 16, color: "#526259" }}>{item.label}</Text>
                <Text style={{ width: "60%", fontWeight: 600 }}>{answerValue(item.value, item.kind)}</Text>
              </View>
            ) : <View>
              <Text style={s.label} minPresenceAhead={22}>{item.label}</Text>
              <Text orphans={2} widows={2}>{answerValue(item.value, item.kind)}</Text>
            </View>}
            {item.detail && <Text style={s.detail} orphans={2} widows={2}>{item.detail}</Text>}
            {signature && <View wrap={false}><Image src={signature} style={s.signature} /><Text style={s.caption}>Zapisany podpis klienta</Text></View>}
            </View>
          </View>;
        })}
      </View>)}
      {(face || body) && data.treatmentAreaIds.length > 0 && <View>
        <Text style={s.heading} minPresenceAhead={260}>Obszar zabiegu</Text>
        {face && <Diagram area={face} ids={data.treatmentAreaIds} />}
        {body && <Diagram area={body} ids={data.treatmentAreaIds} />}
      </View>}
      {Object.entries(data.signatures).filter(([key]) => !rendered.has(key)).map(([key, image]) => <View key={key} wrap={false}>
        <Text style={s.heading}>{key}</Text><Image src={image} style={s.signature} />
      </View>)}
      {data.practitionerName && <View wrap={false}>
        <Text style={s.heading}>Osoba wykonująca zabieg</Text>
        <Text style={s.label}>{data.practitionerName}</Text>
        <Text style={s.meta}>{data.practitionerSignedAt ? `Podpis złożony: ${date(data.practitionerSignedAt)}` : "Podpis nie został jeszcze złożony."}</Text>
        {data.practitionerSignature && <Image src={data.practitionerSignature} style={s.signature} />}
      </View>}
      {data.documentHash && <View wrap={false} style={{ marginTop: 18 }}>
        <Text style={s.caption}>Identyfikator integralności zapisanego dokumentu (SHA-256)</Text>
        <Text style={{ fontSize: 6.5 }}>{data.documentHash}</Text>
      </View>}
      
    </Page>
  </Document>));
}
