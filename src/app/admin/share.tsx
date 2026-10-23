"use client";

import { useState, type ReactNode } from "react";
import { fillInviteMessage } from "@/lib/model";
import { BASE_PATH } from "@/lib/supabase";

// Sharing helpers used by the Invitations and After-the-wedding tabs: a guest's
// personal link, and WhatsApp messages filled in with their name + link.

export function inviteUrl(token: string): string {
  return `${window.location.origin}${BASE_PATH}/i/?t=${token}`;
}

export function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = inviteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy the link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className="mini-btn" onClick={copy} type="button">
      {copied ? "Copied ✓" : "Copy link"}
    </button>
  );
}

export function CopyMessageButton({
  name,
  token,
  template,
  label = "Copy message",
}: {
  name: string;
  token: string;
  template: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const msg = fillInviteMessage(template, name, inviteUrl(token));
    try {
      await navigator.clipboard.writeText(msg);
    } catch {
      window.prompt("Copy the message:", msg);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button className="mini-btn" onClick={copy} type="button" title={`${label} — with this guest's name + link`}>
      {copied ? "Copied ✓" : label}
    </button>
  );
}

export function MessageTemplateCard({
  value,
  onSave,
  title,
  buttonLabel,
  description,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  title: string;
  buttonLabel: string;
  description: ReactNode;
}) {
  const [text, setText] = useState(value);
  const [seed, setSeed] = useState(value);
  if (seed !== value) {
    setSeed(value);
    setText(value);
  }
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const preview = fillInviteMessage(text, "Ayşe & Mehmet", inviteUrl("…"));
  return (
    <div className="admin-card" style={{ marginBottom: 22 }}>
      <h2 className="admin-h2">{title}</h2>
      <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--brown-mid)", margin: "0 0 12px", lineHeight: 1.6 }}>
        {description}
      </p>
      <textarea
        className="textarea-input"
        style={{ minHeight: 200, fontSize: 14, lineHeight: 1.6 }}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <label className="field-label">Preview</label>
      <div
        style={{
          background: "rgba(191,155,95,.06)",
          border: "1px solid var(--gold-soft)",
          borderRadius: 10,
          padding: "12px 14px",
          fontFamily: "var(--sans)",
          fontSize: 13,
          color: "var(--brown-mid)",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {preview}
      </div>
      <button
        className="submit-btn"
        style={{ marginTop: 14 }}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave(text);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          } finally {
            setSaving(false);
          }
        }}
        disabled={saving}
        type="button"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : buttonLabel}
      </button>
    </div>
  );
}
