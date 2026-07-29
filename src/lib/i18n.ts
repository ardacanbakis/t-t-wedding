export type Lang = "tr" | "en";

// Every guest-facing string on the invitation page. All of them are
// overridable from the admin dashboard (stored as JSON in the settings
// table, per language); these are the defaults.
export type GuestTexts = {
  kicker: string;
  dear: string;
  inviteLine: string;
  dateLabel: string;
  venueLabel: string;
  mapButton: string;
  scheduleLabel: string;
  cdDays: string;
  cdHours: string;
  cdMinutes: string;
  cdSeconds: string;
  rsvpTitle: string;
  accept: string;
  decline: string;
  partySizeLabel: string;
  partySizeHint: string;
  noteLabel: string;
  notePlaceholder: string;
  send: string;
  update: string;
  savedAcceptedOne: string;
  savedAcceptedMany: string;
  savedDeclined: string;
  editUntil: string;
  lockedWithAnswer: string;
  lockedNoAnswer: string;
  answerAcceptedOne: string;
  answerAcceptedMany: string;
  answerDeclined: string;
  storyButton: string;
  closing: string;
  notFoundTitle: string;
  notFoundBody: string;
  error: string;
};

export const defaultTexts: Record<Lang, GuestTexts> = {
  tr: {
    kicker: "düğünümüze davetlisiniz",
    dear: "Sevgili",
    inviteLine: "Bu davetiye size özel. Aşağıdan bize katılıp katılamayacağınızı bildirebilirsiniz.",
    dateLabel: "Tarih",
    venueLabel: "Mekân",
    mapButton: "Haritada aç",
    scheduleLabel: "Program",
    cdDays: "gün",
    cdHours: "saat",
    cdMinutes: "dakika",
    cdSeconds: "saniye",
    rsvpTitle: "Katılım Bildirimi",
    accept: "Geliyoruz 🎉",
    decline: "Gelemiyoruz 💔",
    partySizeLabel: "Kaç kişi geliyorsunuz?",
    partySizeHint: "En fazla {max} kişi",
    noteLabel: "Notunuz (isteğe bağlı)",
    notePlaceholder: "Beslenme tercihi, mesajınız…",
    send: "Gönder",
    update: "Cevabımı Güncelle",
    savedAcceptedOne: "Harika! Sizi bekliyoruz. 💛",
    savedAcceptedMany: "Harika! {n} kişi olarak sizi bekliyoruz. 💛",
    savedDeclined: "Çok üzüldük — yine de bize haber verdiğiniz için teşekkürler. 💛",
    editUntil: "Cevabınızı {date} tarihine kadar güncelleyebilirsiniz.",
    lockedWithAnswer: "Katılım bildirimi süresi doldu. Cevabınız:",
    lockedNoAnswer: "Katılım bildirimi süresi doldu.",
    answerAcceptedOne: "Geliyorum",
    answerAcceptedMany: "Geliyoruz — {n} kişi",
    answerDeclined: "Gelemiyoruz",
    storyButton: "Hikâyemiz",
    closing: "Ad astra per aspera",
    notFoundTitle: "Davetiye bulunamadı",
    notFoundBody: "Bu bağlantı geçerli bir davetiyeye ait değil. Lütfen size gönderilen bağlantıyı kontrol edin.",
    error: "Bir şeyler ters gitti, lütfen tekrar deneyin.",
  },
  en: {
    kicker: "you are invited to our wedding",
    dear: "Dear",
    inviteLine: "This invitation is personal to you. Please let us know below whether you can join us.",
    dateLabel: "Date",
    venueLabel: "Venue",
    mapButton: "Open in Maps",
    scheduleLabel: "Schedule",
    cdDays: "days",
    cdHours: "hours",
    cdMinutes: "minutes",
    cdSeconds: "seconds",
    rsvpTitle: "RSVP",
    accept: "Joyfully accept 🎉",
    decline: "Regretfully decline 💔",
    partySizeLabel: "How many of you are coming?",
    partySizeHint: "Up to {max} guests",
    noteLabel: "Your note (optional)",
    notePlaceholder: "Dietary needs, a message…",
    send: "Send",
    update: "Update my answer",
    savedAcceptedOne: "Wonderful! We can't wait to see you. 💛",
    savedAcceptedMany: "Wonderful! We can't wait to see all {n} of you. 💛",
    savedDeclined: "We'll miss you — thank you for letting us know. 💛",
    editUntil: "You can update your answer until {date}.",
    lockedWithAnswer: "The RSVP period has ended. Your answer:",
    lockedNoAnswer: "The RSVP period has ended.",
    answerAcceptedOne: "Attending",
    answerAcceptedMany: "Attending — {n} guests",
    answerDeclined: "Not attending",
    storyButton: "Our Story",
    closing: "Ad astra per aspera",
    notFoundTitle: "Invitation not found",
    notFoundBody: "This link doesn't match a valid invitation. Please check the link you were sent.",
    error: "Something went wrong, please try again.",
  },
};

/** Replace {placeholders} in an editable text template. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/** Field list driving the dashboard's "Invitation texts" editor. */
export const TEXT_FIELDS: { key: keyof GuestTexts; label: string; multiline?: boolean }[] = [
  { key: "kicker", label: "Kicker (line above the names)" },
  { key: "dear", label: "Greeting word (before the guest's name)" },
  { key: "inviteLine", label: "Intro paragraph", multiline: true },
  { key: "dateLabel", label: "“Date” label" },
  { key: "venueLabel", label: "“Venue” label" },
  { key: "mapButton", label: "Maps button" },
  { key: "scheduleLabel", label: "“Schedule” label" },
  { key: "cdDays", label: "Countdown: days" },
  { key: "cdHours", label: "Countdown: hours" },
  { key: "cdMinutes", label: "Countdown: minutes" },
  { key: "cdSeconds", label: "Countdown: seconds" },
  { key: "rsvpTitle", label: "RSVP section title" },
  { key: "accept", label: "Accept button" },
  { key: "decline", label: "Decline button" },
  { key: "partySizeLabel", label: "Party size question" },
  { key: "partySizeHint", label: "Party size hint — {max} = the limit" },
  { key: "noteLabel", label: "Note field label" },
  { key: "notePlaceholder", label: "Note field placeholder" },
  { key: "send", label: "Send button" },
  { key: "update", label: "Update button (after first answer)" },
  { key: "savedAcceptedOne", label: "Saved message — accepted, 1 person" },
  { key: "savedAcceptedMany", label: "Saved message — accepted, {n} people" },
  { key: "savedDeclined", label: "Saved message — declined" },
  { key: "editUntil", label: "Edit-until note — {date} = the deadline", multiline: true },
  { key: "lockedWithAnswer", label: "After deadline, with an answer" },
  { key: "lockedNoAnswer", label: "After deadline, no answer" },
  { key: "answerAcceptedOne", label: "Locked answer — accepted, 1 person" },
  { key: "answerAcceptedMany", label: "Locked answer — accepted, {n} people" },
  { key: "answerDeclined", label: "Locked answer — declined" },
  { key: "storyButton", label: "Story button (top & bottom centre)" },
  { key: "closing", label: "Closing motto (bottom of card)" },
  { key: "notFoundTitle", label: "Invalid-link page title" },
  { key: "notFoundBody", label: "Invalid-link page text", multiline: true },
  { key: "error", label: "Generic error message" },
];

export function formatEventDate(iso: string, lang: Lang, withTime = true): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withTime ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}),
    timeZone: "Europe/Istanbul",
  }).format(d);
}

export function formatDeadline(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(d);
}
