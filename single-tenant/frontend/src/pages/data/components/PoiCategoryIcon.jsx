import React, { useState } from "react";
import { getPoiIconUrl } from "@/lib/iconRegistry";
import {
  Coffee,
  Utensils,
  ShoppingBag,
  Building,
  Landmark,
  GraduationCap,
  Bus,
  Fuel,
  CreditCard,
  HeartPulse,
  Dumbbell,
  Compass,
  Bed,
  Layers,
} from "lucide-react";

/**
 * Returns the fallback Lucide icon component and themed color classes for a given POI category
 */
export function getPoiCategoryMeta(categoryName = "") {
  const cat = String(categoryName).toLowerCase().trim();

  // 1. Coffee & Cafe
  if (cat.includes("kopi") || cat.includes("kafe") || cat.includes("cafe")) {
    return {
      icon: Coffee,
      colorClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
    };
  }

  // 2. Food & Restaurant
  if (
    cat.includes("cepat saji") ||
    cat.includes("restoran") ||
    cat.includes("kuliner") ||
    cat.includes("makanan") ||
    cat.includes("warung") ||
    cat.includes("bakso") ||
    cat.includes("food")
  ) {
    return {
      icon: Utensils,
      colorClass: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/25",
    };
  }

  // 3. Retail & Minimarket
  if (
    cat.includes("minimarket") ||
    cat.includes("supermarket") ||
    cat.includes("toko") ||
    cat.includes("retail") ||
    cat.includes("pasar") ||
    cat.includes("mall")
  ) {
    return {
      icon: ShoppingBag,
      colorClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    };
  }

  // 4. Hotel & Lodging
  if (
    cat.includes("hotel") ||
    cat.includes("penginapan") ||
    cat.includes("kos") ||
    cat.includes("villa") ||
    cat.includes("resort")
  ) {
    return {
      icon: Bed,
      colorClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
    };
  }

  // 5. Place of Worship / Religious
  if (
    cat.includes("masjid") ||
    cat.includes("mushola") ||
    cat.includes("gereja") ||
    cat.includes("ibadah") ||
    cat.includes("pura") ||
    cat.includes("vihara") ||
    cat.includes("klenteng")
  ) {
    return {
      icon: Landmark,
      colorClass: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25",
    };
  }

  // 6. Education
  if (
    cat.includes("sekolah") ||
    cat.includes("universitas") ||
    cat.includes("kampus") ||
    cat.includes("edukasi") ||
    cat.includes("pendidikan") ||
    cat.includes("pesantren") ||
    cat.includes("bimbel")
  ) {
    return {
      icon: GraduationCap,
      colorClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
    };
  }

  // 7. Transit & Transportation
  if (
    cat.includes("stasiun") ||
    cat.includes("terminal") ||
    cat.includes("transit") ||
    cat.includes("shelter") ||
    cat.includes("bandara") ||
    cat.includes("pelabuhan") ||
    cat.includes("halte")
  ) {
    return {
      icon: Bus,
      colorClass: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25",
    };
  }

  // 8. Fuel & Gas Station
  if (
    cat.includes("spbu") ||
    cat.includes("bensin") ||
    cat.includes("pertamina") ||
    cat.includes("shell") ||
    cat.includes("bahan bakar")
  ) {
    return {
      icon: Fuel,
      colorClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25",
    };
  }

  // 9. Banking & ATM
  if (cat.includes("atm") || cat.includes("bank") || cat.includes("keuangan")) {
    return {
      icon: CreditCard,
      colorClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25",
    };
  }

  // 10. Healthcare
  if (
    cat.includes("rumah sakit") ||
    cat.includes("klinik") ||
    cat.includes("apotek") ||
    cat.includes("kesehatan") ||
    cat.includes("puskesmas") ||
    cat.includes("dokter")
  ) {
    return {
      icon: HeartPulse,
      colorClass: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25",
    };
  }

  // 11. Sports & Recreation
  if (
    cat.includes("olahraga") ||
    cat.includes("gym") ||
    cat.includes("lapangan") ||
    cat.includes("futsal") ||
    cat.includes("stadion") ||
    cat.includes("kolam")
  ) {
    return {
      icon: Dumbbell,
      colorClass: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/25",
    };
  }

  // 12. Tourism & Culture
  if (
    cat.includes("wisata") ||
    cat.includes("budaya") ||
    cat.includes("taman") ||
    cat.includes("museum") ||
    cat.includes("monumen") ||
    cat.includes("candi")
  ) {
    return {
      icon: Compass,
      colorClass: "bg-lime-500/10 text-lime-700 dark:text-lime-300 border-lime-500/25",
    };
  }

  // 13. Office & Commercial
  if (
    cat.includes("perkantoran") ||
    cat.includes("komersial") ||
    cat.includes("kantor") ||
    cat.includes("gedung") ||
    cat.includes("office")
  ) {
    return {
      icon: Building,
      colorClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25",
    };
  }

  // Default Fallback
  return {
    icon: Layers,
    colorClass: "bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  };
}

/**
 * Renders POI Category Badge with mapped official SVG Icon asset and fallback
 */
export function PoiCategoryBadge({ category, showIcon = true, className = "" }) {
  const [imgError, setImgError] = useState(false);
  const iconUrl = getPoiIconUrl(category || "Lainnya");
  const meta = getPoiCategoryMeta(category);
  const IconComponent = meta.icon || Layers;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] text-[11px] font-medium border ${meta.colorClass} ${className} shadow-2xs`}
      title={category || "Kategori POI"}
    >
      {showIcon && (
        !imgError ? (
          <img
            src={iconUrl}
            alt=""
            className="w-3.5 h-3.5 object-contain shrink-0"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <IconComponent className="w-3.5 h-3.5 shrink-0" />
        )
      )}
      <span className="truncate max-w-[200px]">{category || "Lainnya"}</span>
    </span>
  );
}
