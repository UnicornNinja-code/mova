import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Alert,
} from "@/components/primitives";
import { Layers, MapPin, AlertCircle } from "lucide-react";

export function PoiFormModal({
  isOpen,
  onClose,
  onSubmit,
  poiToEdit = null,
  categories = [],
  loading = false,
}) {
  const isEdit = Boolean(poiToEdit);

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    latitude: "",
    longitude: "",
    operational_status: "ELIGIBLE",
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (poiToEdit) {
      setFormData({
        name: poiToEdit.name || "",
        category: poiToEdit.category || "",
        latitude: poiToEdit.latitude !== undefined ? String(poiToEdit.latitude) : "",
        longitude: poiToEdit.longitude !== undefined ? String(poiToEdit.longitude) : "",
        operational_status: poiToEdit.operational_status || "ELIGIBLE",
      });
    } else {
      setFormData({
        name: "",
        category: "",
        latitude: "",
        longitude: "",
        operational_status: "ELIGIBLE",
      });
    }
    setError(null);
  }, [poiToEdit, isOpen]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = formData.name.trim();
    if (!name) {
      setError("Nama POI wajib diisi.");
      return;
    }

    const lat = Number(formData.latitude);
    const lon = Number(formData.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setError("Latitude harus berada di rentang -90 hingga 90.");
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setError("Longitude harus berada di rentang -180 hingga 180.");
      return;
    }

    const payload = {
      name,
      category: formData.category ? formData.category : undefined,
      latitude: lat,
      longitude: lon,
      operational_status: formData.operational_status,
    };

    try {
      await onSubmit(payload, isEdit ? poiToEdit.id : null);
    } catch (err) {
      setError(err.message || "Gagal menyimpan data POI.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <Layers className="w-5 h-5 text-[var(--accent-primary)]" />
            {isEdit ? "Edit Data POI" : "Tambah POI Manual"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <Alert variant="danger" className="text-xs">
              <AlertCircle className="w-4 h-4 mr-2 inline" />
              {error}
            </Alert>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)]">
              Nama Tempat / POI <span className="text-[var(--status-danger)]">*</span>
            </label>
            <Input
              type="text"
              placeholder="Contoh: Kopi Kenangan Alun-alun"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              disabled={loading}
              required
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              Sistem akan otomatis memetakan kategori bila kolom kategori dikosongkan.
            </p>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)]">
              Kategori Keramaian (Domain Otoritatif)
            </label>
            <Select
              value={formData.category}
              onValueChange={(val) => handleChange("category", val)}
              disabled={loading}
              placeholder="-- Auto-Clustering Otomatis --"
            >
              <SelectItem value="">-- Auto-Clustering Otomatis --</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id || cat.name} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </Select>
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[var(--accent-primary)]" />
                Latitude <span className="text-[var(--status-danger)]">*</span>
              </label>
              <Input
                type="number"
                step="any"
                placeholder="-7.4478"
                value={formData.latitude}
                onChange={(e) => handleChange("latitude", e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[var(--accent-primary)]" />
                Longitude <span className="text-[var(--status-danger)]">*</span>
              </label>
              <Input
                type="number"
                step="any"
                placeholder="112.7183"
                value={formData.longitude}
                onChange={(e) => handleChange("longitude", e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Operational Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)]">
              Status Operasional
            </label>
            <Select
              value={formData.operational_status}
              onValueChange={(val) => handleChange("operational_status", val)}
              disabled={loading}
            >
              <SelectItem value="ELIGIBLE">ELIGIBLE (Layak & Aktif Operasional)</SelectItem>
              <SelectItem value="EXCLUDED">EXCLUDED (Dikecualikan / Non-Operasional)</SelectItem>
            </Select>
          </div>

          <DialogFooter className="pt-4 border-t border-[var(--border-subtle)] flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {loading ? "Menyimpan..." : isEdit ? "Perbarui POI" : "Daftarkan POI"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
