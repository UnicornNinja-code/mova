import {
  LayoutDashboard,
  Map,
  CloudRain,
  MapPin,
  Bike,
  Clock,
  Package,
  BrainCircuit,
  FileBarChart,
  Layers,
  ShieldAlert,
  Store,
  Users,
  Shield,
  Sliders,
  History,
  HelpCircle,
} from "lucide-react";

export const NAVIGATION_PILLARS = [
  {
    id: "overview",
    title: "OVERVIEW",
    roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"],
    items: [
      { label: "Dashboard", path: "/overview", icon: LayoutDashboard, roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"] },
    ],
  },
  {
    id: "operations",
    title: "OPERATIONS",
    roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"],
    items: [
      { label: "Live MapOps", path: "/operations/mapops", icon: Map, roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"] },
      { label: "Prediksi Cuaca", path: "/operations/weather", icon: CloudRain, roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"] },
      { label: "Zona Operasional", path: "/operations/zones", icon: MapPin, roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"] },
      { label: "Unit & Barista Keliling", path: "/operations/riders", icon: Bike, roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"] },
      { label: "Sesi Lapangan", path: "/operations/sessions", icon: Clock, roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"] },
      { label: "Distribusi Produk", path: "/operations/distribution", icon: Package, roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"] },
    ],
  },
  {
    id: "intelligence",
    title: "INTELLIGENCE",
    roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"],
    items: [
      { label: "DSS Rekomendasi", path: "/intelligence/dss", icon: BrainCircuit, roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"] },
      { label: "Laporan & Ekspor", path: "/intelligence/reports", icon: FileBarChart, roles: ["SUPERADMIN", "MANAGEMENT"] },
    ],
  },
  {
    id: "data",
    title: "DATA",
    roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"],
    items: [
      { label: "Master POI", path: "/data/pois", icon: Layers, roles: ["SUPERADMIN", "SUPERVISOR"] },
      { label: "Jalan Protokol & Tol", path: "/data/roads", icon: ShieldAlert, roles: ["SUPERADMIN", "SUPERVISOR"] },
      { label: "Survei Kompetitor", path: "/data/competitors", icon: Store, roles: ["SUPERADMIN", "SUPERVISOR"] },
    ],
  },
  {
    id: "administration",
    title: "ADMINISTRATION",
    roles: ["SUPERADMIN"],
    items: [
      { label: "Users", path: "/admin/users", icon: Users, roles: ["SUPERADMIN"] },
      { label: "Audit Log", path: "/admin/audit-logs", icon: History, roles: ["SUPERADMIN"] },
      { label: "Pengaturan Sistem", path: "/admin/settings", icon: Sliders, roles: ["SUPERADMIN"] },
    ],
  },
  {
    id: "help",
    title: "BANTUAN & FAQ",
    roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"],
    items: [
      { label: "FAQ & Panduan", path: "/faq", icon: HelpCircle, roles: ["SUPERADMIN", "MANAGEMENT", "SUPERVISOR"] },
    ],
  },
];
