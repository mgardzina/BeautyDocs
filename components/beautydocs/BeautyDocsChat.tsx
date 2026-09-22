"use client";

import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarClock,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  SquarePen,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { BeautyDocsAdminTeam } from "@/types/beautydocs-admin";
import type {
  BeautyDocsChatConversation,
  BeautyDocsChatConversationDetail,
  BeautyDocsChatConversationList,
  BeautyDocsChatMessage,
} from "@/types/beautydocs-chat";

interface ConsumerSalonTarget {
  readonly slug: string;
  readonly displayName: string;
}

type BeautyDocsChatProps =
  ({
      readonly mode: "consumer";
      readonly initialSalon?: ConsumerSalonTarget | null;
      readonly onFindSalon?: () => void;
      readonly tenantSlug?: never;
      readonly canWrite?: true;
    }
  | {
      readonly mode: "admin";
      readonly initialSalon?: never;
      readonly onFindSalon?: never;
      readonly tenantSlug: string;
      readonly canWrite: boolean;
      readonly canAssignPractitioner?: boolean;
    }) & {
      readonly compact?: boolean;
      readonly onClose?: () => void;
    };

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export function BeautyDocsChat(props: BeautyDocsChatProps) {
  const [conversations, setConversations] = useState<readonly BeautyDocsChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingSalon, setPendingSalon] = useState<ConsumerSalonTarget | null>(
    props.mode === "consumer" ? props.initialSalon ?? null : null,
  );
  const [detail, setDetail] = useState<BeautyDocsChatConversationDetail | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<readonly File[]>([]);
  const [team, setTeam] = useState<BeautyDocsAdminTeam | null>(null);
  const [assigningPractitioner, setAssigningPractitioner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedIdRef = useRef<string | null>(null);

  const baseEndpoint =
    props.mode === "consumer"
      ? "/api/beautydocs-preview/consumer/chats"
      : `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(props.tenantSlug)}/chats`;
  const canWrite = props.mode === "consumer" || props.canWrite;
  const compact = props.compact ?? false;
  const adminTenantSlug = props.mode === "admin" ? props.tenantSlug : null;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const publishUnreadCount = useCallback((unreadCount: number) => {
    window.dispatchEvent(
      new CustomEvent("beautydocs:chat-updated", {
        detail: { unreadCount: Math.max(0, unreadCount) },
      }),
    );
  }, []);

  const loadConversations = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const response = await fetch(baseEndpoint, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as BeautyDocsChatConversationList;
        const items = Array.isArray(body.items) ? body.items : [];
        setConversations(items);
        publishUnreadCount(Number.isInteger(body.unreadCount) ? body.unreadCount : 0);

        const currentId = selectedIdRef.current;
        if (currentId && !items.some((item) => item.id === currentId)) {
          setSelectedId(null);
          setDetail(null);
        }
        if (!currentId && !pendingSalon && items[0]) {
          setSelectedId(items[0].id);
        }
      } catch {
        if (!quiet) setError("Nie udało się pobrać rozmów. Spróbuj ponownie.");
      } finally {
        if (!quiet) setLoading(false);
      }
    }, [baseEndpoint, pendingSalon, publishUnreadCount],
  );

  const markRead = useCallback(
    async (conversationId: string) => {
      try {
        await fetch(`${baseEndpoint}/${encodeURIComponent(conversationId)}/read`, {
          method: "POST",
          credentials: "same-origin",
        });
      } catch {
        // Odczyt wiadomości pozostaje możliwy także przy chwilowym błędzie znacznika.
      }
    },
    [baseEndpoint],
  );

  const loadDetail = useCallback(
    async (conversationId: string, quiet = false) => {
      if (!quiet) setDetailLoading(true);
      try {
        const response = await fetch(
          `${baseEndpoint}/${encodeURIComponent(conversationId)}`,
          { cache: "no-store", credentials: "same-origin" },
        );
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as BeautyDocsChatConversationDetail;
        if (selectedIdRef.current !== conversationId) return;
        setDetail(body);
        setError(null);
        if (body.unreadCount > 0) {
          await markRead(conversationId);
          await loadConversations(true);
        }
      } catch {
        if (!quiet) setError("Nie udało się otworzyć rozmowy.");
      } finally {
        if (!quiet) setDetailLoading(false);
      }
    },
    [baseEndpoint, loadConversations, markRead],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (adminTenantSlug === null) return;
    let cancelled = false;
    void fetch(
      `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(adminTenantSlug)}/team`,
      { cache: "no-store", credentials: "same-origin" },
    ).then(async (response) => {
      if (!response.ok || cancelled) return;
      const body = (await response.json()) as BeautyDocsAdminTeam;
      if (!cancelled) setTeam(body);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [adminTenantSlug]);

  useEffect(() => {
    if (props.mode !== "consumer" || !props.initialSalon) return;
    const existing = conversations.find(
      (conversation) => conversation.tenantSlug === props.initialSalon?.slug,
    );
    if (existing) {
      setPendingSalon(null);
      setSelectedId(existing.id);
    } else {
      setPendingSalon(props.initialSalon);
      setSelectedId(null);
      setDetail(null);
    }
  }, [conversations, props]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  useEffect(() => {
    const refresh = () => {
      void loadConversations(true);
      if (selectedIdRef.current) void loadDetail(selectedIdRef.current, true);
    };
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [loadConversations, loadDetail]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [detail?.messages.length]);

  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pl-PL");
    if (!normalized) return conversations;
    return conversations.filter((conversation) =>
      (props.mode === "consumer" ? conversation.salonName : conversation.consumerName)
        .toLocaleLowerCase("pl-PL")
        .includes(normalized),
    );
  }, [conversations, props.mode, query]);

  const openConversation = (conversation: BeautyDocsChatConversation) => {
    setPendingSalon(null);
    setSelectedId(conversation.id);
    setDraft("");
    setAttachments([]);
    setError(null);
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if ((!body && attachments.length === 0) || body.length > 4_000 || sending || !canWrite) return;
    setSending(true);
    setError(null);
    try {
      if (attachments.length > 0) {
        let activeConversationId = selectedId;
        for (const [index, file] of attachments.entries()) {
          const startNew = props.mode === "consumer" && pendingSalon && !activeConversationId;
          const endpoint = startNew
            ? `${baseEndpoint}/attachments`
            : `${baseEndpoint}/${encodeURIComponent(activeConversationId ?? "")}/attachments`;
          const headers = new Headers({
            "content-type": file.type,
            "x-beautydocs-file-name": encodeURIComponent(file.name),
            "x-beautydocs-message-body": encodeURIComponent(index === 0 ? body : ""),
          });
          if (startNew && pendingSalon) {
            headers.set("x-beautydocs-tenant-slug", pendingSalon.slug);
          }
          const response = await fetch(endpoint, {
            method: "POST",
            credentials: "same-origin",
            headers,
            body: file,
          });
          if (!response.ok) throw new Error(String(response.status));
          if (startNew) {
            const conversation = (await response.json()) as BeautyDocsChatConversationDetail;
            activeConversationId = conversation.id;
            setDetail(conversation);
            setSelectedId(conversation.id);
            setPendingSalon(null);
          } else {
            const message = (await response.json()) as BeautyDocsChatMessage;
            setDetail((current) => current
              ? { ...current, messages: [...current.messages, message] }
              : current);
          }
        }
      } else if (props.mode === "consumer" && pendingSalon && !selectedId) {
        const response = await fetch(baseEndpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tenantSlug: pendingSalon.slug, body }),
        });
        if (!response.ok) throw new Error(String(response.status));
        const conversation = (await response.json()) as BeautyDocsChatConversationDetail;
        setDetail(conversation);
        setSelectedId(conversation.id);
        setPendingSalon(null);
      } else if (selectedId) {
        const response = await fetch(
          `${baseEndpoint}/${encodeURIComponent(selectedId)}/messages`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body }),
          },
        );
        if (!response.ok) throw new Error(String(response.status));
        const message = (await response.json()) as BeautyDocsChatMessage;
        setDetail((current) =>
          current
            ? { ...current, messages: [...current.messages, message] }
            : current,
        );
      } else {
        return;
      }
      setDraft("");
      setAttachments([]);
      await loadConversations(true);
    } catch {
      setError("Nie udało się wysłać wiadomości. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  const selectAttachments = (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, MAX_ATTACHMENTS);
    const invalid = selected.find(
      (file) => !ALLOWED_ATTACHMENT_TYPES.has(file.type) || file.size > MAX_ATTACHMENT_BYTES,
    );
    if (invalid) {
      setError("Możesz dodać zdjęcie JPG, PNG, WebP lub PDF do 8 MB.");
      return;
    }
    setAttachments(selected);
    setError(null);
  };

  const assignPractitioner = async (teamMemberId: string) => {
    if (props.mode !== "admin" || !selectedId || assigningPractitioner) return;
    setAssigningPractitioner(true);
    setError(null);
    try {
      const response = await fetch(`${baseEndpoint}/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignedTeamMemberId: teamMemberId || null }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const conversation = (await response.json()) as BeautyDocsChatConversationDetail;
      setDetail(conversation);
      await loadConversations(true);
    } catch {
      setError("Nie udało się przypisać osoby wykonującej zabieg.");
    } finally {
      setAssigningPractitioner(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const conversationTitle = pendingSalon?.displayName ??
    (detail
      ? props.mode === "consumer"
        ? detail.salonName
        : detail.consumerName
      : null);

  return (
    <section className={`overflow-hidden border border-[#e2e7da] bg-white shadow-[0_18px_50px_rgba(48,78,70,0.08)] ${compact ? "h-full rounded-[22px]" : "rounded-[28px]"}`}>
      <div className={`grid ${compact ? "h-full" : "min-h-[640px] lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]"}`}>
        <aside className={`${compact && conversationTitle ? "hidden" : "block"} border-b border-[#e8ece2] bg-[#f9fbf7] lg:border-b-0 lg:border-r`}>
          <div className="border-b border-[#e8ece2] p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-[#ebf1e3] text-[#245c4d]">
                <MessageCircle className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-black text-[#173d35]">Rozmowy</h2>
                <p className="text-xs text-stone-500">
                  {props.mode === "consumer" ? "Kontakt z salonami" : "Wiadomości klientek"}
                </p>
              </div>
              {props.mode === "consumer" && props.onFindSalon ? (
                <button
                  aria-label="Rozpocznij nową rozmowę"
                  className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#245c4d] text-white transition hover:bg-[#173d35]"
                  onClick={props.onFindSalon}
                  title="Nowa rozmowa"
                  type="button"
                >
                  <SquarePen className="size-4" />
                </button>
              ) : null}
              {compact && props.onClose ? (
                <button aria-label="Zamknij czat" className="grid size-9 place-items-center rounded-xl text-stone-500 hover:bg-white" onClick={props.onClose} type="button">
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <label className="relative mt-4 block">
              <span className="sr-only">Szukaj rozmowy</span>
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <input
                className="h-11 w-full rounded-2xl border border-[#e1e6da] bg-white pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-[#8bb9ae] focus:ring-4 focus:ring-[#245c4d]/10"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={props.mode === "consumer" ? "Szukaj salonu" : "Szukaj klientki"}
                value={query}
              />
            </label>
          </div>

          <div className={`${compact ? "h-[calc(100%-105px)]" : "max-h-[260px] lg:max-h-[556px]"} overflow-y-auto p-2`}>
            {loading ? (
              <div className="grid min-h-40 place-items-center text-stone-400">
                <LoaderCircle className="size-5 animate-spin" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <MessageCircle className="mx-auto size-6 text-[#93b8af]" />
                <p className="mt-3 text-sm font-black text-[#2a382c]">Brak rozmów</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  {props.mode === "consumer"
                    ? "Rozpocznij czat z poziomu wyszukiwarki salonów."
                    : "Nowa rozmowa pojawi się, gdy klientka napisze do salonu."}
                </p>
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const title = props.mode === "consumer"
                  ? conversation.salonName
                  : conversation.consumerName;
                const active = conversation.id === selectedId;
                return (
                  <button
                    className={`mb-1 flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${
                      active ? "bg-[#e9efe1]" : "hover:bg-[#f1f5ec]"
                    }`}
                    key={conversation.id}
                    onClick={() => openConversation(conversation)}
                    type="button"
                  >
                    <span className={`grid size-10 shrink-0 place-items-center rounded-full ${active ? "bg-[#245c4d] text-white" : "bg-white text-[#245c4d]"}`}>
                      {props.mode === "consumer" ? <Building2 className="size-4" /> : <UserRound className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-black text-[#173d35]">{title}</span>
                        {conversation.lastMessageAt ? (
                          <time className="shrink-0 text-[10px] font-semibold text-stone-400">
                            {formatChatListDate(conversation.lastMessageAt)}
                          </time>
                        ) : null}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className={`min-w-0 flex-1 truncate text-xs ${conversation.unreadCount ? "font-black text-[#173d35]" : "text-stone-500"}`}>
                          {conversation.lastMessageBody ?? "Nowa rozmowa"}
                        </span>
                        {conversation.unreadCount > 0 ? (
                          <span className="grid min-w-5 place-items-center rounded-full bg-[#245c4d] px-1.5 py-0.5 text-[10px] font-black text-white">
                            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className={`min-w-0 flex-col bg-[#fefffc] ${compact && !conversationTitle ? "hidden" : "flex"} ${compact ? "h-full min-h-0" : "min-h-[580px]"}`}>
          {conversationTitle ? (
            <>
              <header className="flex min-h-[76px] items-center gap-3 border-b border-[#e8ece2] px-5 sm:px-6">
                {compact ? (
                  <button
                    aria-label="Wróć do rozmów"
                    className="grid size-9 shrink-0 place-items-center rounded-xl text-stone-500 hover:bg-[#eff4e9]"
                    onClick={() => {
                      setSelectedId(null);
                      setPendingSalon(null);
                      setDetail(null);
                    }}
                    type="button"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                ) : null}
                <span className="grid size-10 place-items-center rounded-full bg-[#ebf1e3] text-[#245c4d]">
                  {props.mode === "consumer" ? <Building2 className="size-4" /> : <UserRound className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-black text-[#173d35]">{conversationTitle}</h3>
                  <p className="truncate text-xs text-emerald-700">
                    {detail?.practitionerName
                      ? `Osoba wykonująca: ${detail.practitionerName}${detail.practitionerJobTitle ? ` · ${detail.practitionerJobTitle}` : ""}`
                      : props.mode === "consumer"
                        ? "Wiadomość trafi do zespołu salonu"
                        : "Przypisz osobę wykonującą zabieg"}
                  </p>
                </div>
                {props.mode === "admin" && props.canAssignPractitioner && team ? (
                  <select
                    aria-label="Osoba wykonująca zabieg"
                    className="max-w-48 rounded-xl border border-[#d9dfd0] bg-white px-3 py-2 text-xs font-bold text-[#475b4a] outline-none focus:border-[#86b8ac]"
                    disabled={assigningPractitioner}
                    onChange={(event) => void assignPractitioner(event.target.value)}
                    value={detail?.practitionerId ?? ""}
                  >
                    <option value="">Zespół salonu</option>
                    {team.items
                      .filter((member) => member.isActive && member.performsTreatments)
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.displayName}{member.jobTitle ? ` · ${member.jobTitle}` : ""}
                        </option>
                      ))}
                  </select>
                ) : null}
                {compact && props.onClose ? (
                  <button aria-label="Zamknij czat" className="grid size-9 shrink-0 place-items-center rounded-xl text-stone-500 hover:bg-[#eff4e9]" onClick={props.onClose} type="button">
                    <X className="size-4" />
                  </button>
                ) : null}
              </header>

              <div aria-live="polite" className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                {detailLoading ? (
                  <div className="grid h-full place-items-center text-stone-400"><LoaderCircle className="size-5 animate-spin" /></div>
                ) : detail?.messages.length ? (
                  <div className="mx-auto max-w-3xl space-y-3">
                    {detail.messages.map((message) => {
                      if (message.senderType === "SYSTEM") {
                        return (
                          <div className="flex justify-center py-1" key={message.id}>
                            <div className="max-w-xl rounded-2xl border border-[#e5eadd] bg-[#f5f8f1] px-4 py-3 text-center text-[#465d49]">
                              <span className="mx-auto mb-1.5 grid size-7 place-items-center rounded-full bg-white text-[#245c4d]">
                                <CalendarClock className="size-3.5" />
                              </span>
                              <p className="text-xs font-bold leading-5">{message.body}</p>
                              <time className="mt-1 block text-[10px] text-stone-400" dateTime={message.createdAt}>{formatChatMessageDate(message.createdAt)}</time>
                            </div>
                          </div>
                        );
                      }
                      const own = props.mode === "consumer"
                        ? message.senderType === "CONSUMER"
                        : message.senderType === "SALON";
                      return (
                        <div className={`flex ${own ? "justify-end" : "justify-start"}`} key={message.id}>
                          <div className={`max-w-[86%] rounded-[20px] px-4 py-3 sm:max-w-[72%] ${own ? "rounded-br-md bg-[#245c4d] text-white" : "rounded-bl-md border border-[#e5eadf] bg-white text-[#173d35] shadow-sm"}`}>
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                            {message.attachments.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {message.attachments.map((attachment) => {
                                  const attachmentUrl = `${baseEndpoint}/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(attachment.id)}`;
                                  return attachment.contentType.startsWith("image/") ? (
                                    <a className="block overflow-hidden rounded-xl border border-white/20 bg-white/10" href={attachmentUrl} key={attachment.id} rel="noreferrer" target="_blank">
                                      <Image
                                        alt={attachment.fileName}
                                        className="max-h-72 w-full object-cover"
                                        height={480}
                                        src={attachmentUrl}
                                        unoptimized
                                        width={640}
                                      />
                                      <span className={`flex items-center gap-2 px-3 py-2 text-xs font-bold ${own ? "text-white/80" : "text-[#465d49]"}`}>
                                        <ImageIcon className="size-3.5" /> {attachment.fileName} · {formatFileSize(attachment.sizeBytes)}
                                      </span>
                                    </a>
                                  ) : (
                                    <a className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${own ? "border-white/20 bg-white/10 text-white" : "border-[#e5eadf] bg-[#f9fbf7] text-[#465d49]"}`} href={attachmentUrl} key={attachment.id} rel="noreferrer" target="_blank">
                                      <FileText className="size-5 shrink-0" />
                                      <span className="min-w-0 text-xs font-bold"><span className="block truncate">{attachment.fileName}</span><span className="font-medium opacity-60">PDF · {formatFileSize(attachment.sizeBytes)}</span></span>
                                    </a>
                                  );
                                })}
                              </div>
                            ) : null}
                            <div className={`mt-1.5 flex items-center gap-2 text-[10px] ${own ? "justify-end text-white/60" : "text-stone-400"}`}>
                              <span>{message.senderName}</span>
                              <time dateTime={message.createdAt}>{formatChatMessageDate(message.createdAt)}</time>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={endRef} />
                  </div>
                ) : pendingSalon ? (
                  <div className="grid h-full place-items-center px-4 text-center">
                    <div>
                      <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-[#ebf1e3] text-[#245c4d]"><MessageCircle className="size-6" /></span>
                      <h3 className="mt-4 font-black text-[#173d35]">Napisz do {pendingSalon.displayName}</h3>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">Zapytaj o przygotowanie do zabiegu, dostępne terminy lub pielęgnację po wizycie.</p>
                    </div>
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 sm:mx-6">
                  <AlertCircle className="size-4 shrink-0" /> {error}
                </p>
              ) : null}

              <form className="border-t border-[#e8ece2] bg-white p-4 sm:p-5" onSubmit={sendMessage}>
                {attachments.length > 0 ? (
                  <div className="mx-auto mb-2 flex max-w-3xl gap-2 overflow-x-auto pb-1">
                    {attachments.map((file, index) => (
                      <span className="flex shrink-0 items-center gap-2 rounded-xl border border-[#e5eadd] bg-[#f5f8f1] px-3 py-2 text-xs font-bold text-[#465d49]" key={`${file.name}-${file.lastModified}`}>
                        {file.type.startsWith("image/") ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}
                        <span className="max-w-36 truncate">{file.name}</span>
                        <button aria-label={`Usuń ${file.name}`} className="text-stone-400 hover:text-red-600" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><X className="size-3.5" /></button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[22px] border border-[#d9dfd0] bg-[#f9fbf7] p-2 focus-within:border-[#86b8ac] focus-within:ring-4 focus-within:ring-[#245c4d]/10">
                  <input
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    aria-label="Dodaj zdjęcie lub PDF"
                    className="sr-only"
                    disabled={!canWrite || sending}
                    multiple
                    onChange={(event) => {
                      selectAttachments(event.target.files);
                      event.currentTarget.value = "";
                    }}
                    ref={fileInputRef}
                    type="file"
                  />
                  <button
                    aria-label="Dodaj zdjęcie lub PDF"
                    className="grid size-11 shrink-0 place-items-center rounded-2xl text-[#245c4d] transition hover:bg-[#ebf1e3] disabled:opacity-40"
                    disabled={!canWrite || sending}
                    onClick={() => fileInputRef.current?.click()}
                    title="Dodaj zdjęcie lub PDF (maks. 8 MB)"
                    type="button"
                  >
                    <Paperclip className="size-4" />
                  </button>
                  <textarea
                    aria-label="Treść wiadomości"
                    className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-5 text-[#173d35] outline-none placeholder:text-stone-400"
                    disabled={!canWrite || sending}
                    maxLength={4_000}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={canWrite ? "Napisz wiadomość…" : "Masz dostęp tylko do odczytu"}
                    rows={1}
                    value={draft}
                  />
                  <button
                    aria-label="Wyślij wiadomość"
                    className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#245c4d] text-white transition hover:bg-[#173d35] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!canWrite || sending || (!draft.trim() && attachments.length === 0)}
                    type="submit"
                  >
                    {sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </button>
                </div>
                <p className="mx-auto mt-2 max-w-3xl text-[10px] leading-4 text-stone-400">Enter wysyła, Shift+Enter dodaje nową linię. Zdjęcia i PDF: maks. 8 MB. Nie przesyłaj haseł ani danych płatniczych. W nagłym problemie medycznym skontaktuj się z lekarzem.</p>
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid size-16 place-items-center rounded-[24px] bg-[#ebf1e3] text-[#245c4d]"><MessageCircle className="size-7" /></span>
                <h3 className="mt-5 text-lg font-black text-[#173d35]">Wybierz rozmowę</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-500">
                  {props.mode === "consumer"
                    ? "Możesz też znaleźć salon i użyć przycisku „Napisz”."
                    : "Po lewej zobaczysz rozmowy rozpoczęte przez klientki."}
                </p>
                {props.mode === "consumer" && props.onFindSalon ? (
                  <button
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#245c4d] px-5 py-3 text-sm font-black text-white transition hover:bg-[#173d35]"
                    onClick={props.onFindSalon}
                    type="button"
                  >
                    <SquarePen className="size-4" /> Nowa rozmowa
                  </button>
                ) : null}
                {error ? <p className="mt-4 text-sm font-bold text-red-700">{error}</p> : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function formatChatListDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit" }).format(date);
}

function formatChatMessageDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
