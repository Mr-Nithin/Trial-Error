"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "./Icon";

export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        {children}
      </div>
    </div>
  );
}

type ItemProps = {
  icon: string;
  label: string;
  tone?: "accent" | "danger";
  trailing?: React.ReactNode;
  chevron?: boolean;
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

export function SheetItem({ icon, label, tone, trailing, chevron, href, onClick }: ItemProps) {
  const inner = (
    <>
      <span className="ico">
        <Icon name={icon} size={18} />
      </span>
      <span className="grow">{label}</span>
      {trailing}
      {chevron && (
        <span style={{ color: "var(--rule-strong)" }}>
          <Icon name="chevron" size={16} />
        </span>
      )}
    </>
  );
  const cls = `sheet-item${tone ? ` ${tone}` : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}
