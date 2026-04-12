"use client";

const COLORS = [
  "bg-teal-700", "bg-blue-700", "bg-purple-700", "bg-amber-700",
  "bg-rose-700", "bg-emerald-700", "bg-indigo-700", "bg-orange-700",
  "bg-cyan-700", "bg-fuchsia-700", "bg-lime-700", "bg-sky-700",
];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < (str || "").length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function Avatar({ name, size = 32 }) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const color = COLORS[hashCode(name) % COLORS.length];
  const fontSize = size <= 28 ? "text-[10px]" : size <= 36 ? "text-xs" : "text-sm";

  return (
    <div
      className={`${color} rounded-full flex items-center justify-center font-bold text-white shrink-0 ${fontSize}`}
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

// Re-export from canonical location for backward compatibility
export { titleCase } from "@/lib/format";
