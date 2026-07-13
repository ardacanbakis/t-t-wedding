export type Lang = "tr" | "en";

export const dict = {
  tr: {
    kicker: "düğünümüze davetlisiniz",
    and: "&",
    dear: "Sevgili",
    inviteLine: "Bu davetiye size özel. Aşağıdan bize katılıp katılamayacağınızı bildirebilirsiniz.",
    date: "Tarih",
    venue: "Mekân",
    map: "Haritada aç",
    schedule: "Program",
    countdown: { days: "gün", hours: "saat", minutes: "dakika", seconds: "saniye" },
    rsvpTitle: "Katılım Bildirimi",
    accept: "Geliyoruz 🎉",
    decline: "Gelemiyoruz 💔",
    partySize: "Kaç kişi geliyorsunuz?",
    partySizeHint: (max: number) => `En fazla ${max} kişi`,
    partySizeUnlimited: "Kişi sayısı",
    noteLabel: "Notunuz (isteğe bağlı)",
    notePlaceholder: "Beslenme tercihi, mesajınız…",
    send: "Gönder",
    update: "Cevabımı Güncelle",
    savedAccepted: (n: number) =>
      n === 1 ? "Harika! Sizi bekliyoruz. 💛" : `Harika! ${n} kişi olarak sizi bekliyoruz. 💛`,
    savedDeclined: "Çok üzüldük — yine de bize haber verdiğiniz için teşekkürler. 💛",
    editUntil: (d: string) => `Cevabınızı ${d} tarihine kadar güncelleyebilirsiniz.`,
    locked: "Katılım bildirimi süresi doldu. Cevabınız:",
    lockedNone: "Katılım bildirimi süresi doldu.",
    yourAnswer: "Cevabınız",
    answerAccepted: (n: number) => (n > 1 ? `Geliyoruz — ${n} kişi` : "Geliyorum"),
    answerDeclined: "Gelemiyoruz",
    story: "Hikâyemiz",
    notFoundTitle: "Davetiye bulunamadı",
    notFoundBody: "Bu bağlantı geçerli bir davetiyeye ait değil. Lütfen size gönderilen bağlantıyı kontrol edin.",
    error: "Bir şeyler ters gitti, lütfen tekrar deneyin.",
  },
  en: {
    kicker: "you are invited to our wedding",
    and: "&",
    dear: "Dear",
    inviteLine: "This invitation is personal to you. Please let us know below whether you can join us.",
    date: "Date",
    venue: "Venue",
    map: "Open in Maps",
    schedule: "Schedule",
    countdown: { days: "days", hours: "hours", minutes: "minutes", seconds: "seconds" },
    rsvpTitle: "RSVP",
    accept: "Joyfully accept 🎉",
    decline: "Regretfully decline 💔",
    partySize: "How many of you are coming?",
    partySizeHint: (max: number) => `Up to ${max} guests`,
    partySizeUnlimited: "Number of guests",
    noteLabel: "Your note (optional)",
    notePlaceholder: "Dietary needs, a message…",
    send: "Send",
    update: "Update my answer",
    savedAccepted: (n: number) =>
      n === 1 ? "Wonderful! We can't wait to see you. 💛" : `Wonderful! We can't wait to see all ${n} of you. 💛`,
    savedDeclined: "We'll miss you — thank you for letting us know. 💛",
    editUntil: (d: string) => `You can update your answer until ${d}.`,
    locked: "The RSVP period has ended. Your answer:",
    lockedNone: "The RSVP period has ended.",
    yourAnswer: "Your answer",
    answerAccepted: (n: number) => (n > 1 ? `Attending — ${n} guests` : "Attending"),
    answerDeclined: "Not attending",
    story: "Our Story",
    notFoundTitle: "Invitation not found",
    notFoundBody: "This link doesn't match a valid invitation. Please check the link you were sent.",
    error: "Something went wrong, please try again.",
  },
} as const;

export function formatEventDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
