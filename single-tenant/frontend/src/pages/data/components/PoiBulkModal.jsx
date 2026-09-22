import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Alert,
} from "@/components/primitives";
import { UploadCloud, AlertCircle } from "lucide-react";

export function PoiBulkModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
}) {
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState(null);

  const sampleJson = `[
  {
    "name": "Point Coffee Indomaret Diponegoro",
    "latitude": -7.4520,
    "longitude": 112.7150
  },
  {
    "name": "Janji Jiwa Jenggolo",
    "latitude": -7.4410,
    "longitude": 112.7190
  }
]`;

  const handleFillSample = () => {
    setJsonText(sampleJson);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!jsonText.trim()) {
      setError("Masukkan data JSON POI terlebih dahulu.");
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      setError(`Format JSON tidak valid: ${err.message}`);
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      setError("Data harus berupa Array JSON yang berisi minimal 1 objek POI.");
      return;
    }

    try {
      await onSubmit(parsed);
      setJsonText("");
    } catch (err) {
      setError(err.message || "Gagal melakukan bulk import.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <UploadCloud className="w-5 h-5 text-[var(--accent-primary)]" />
            Bulk Import Data POI
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <Alert variant="danger" className="text-xs">
              <AlertCircle className="w-4 h-4 mr-2 inline" />
              {error}
            </Alert>
          )}

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Payload JSON Array <span className="text-[var(--status-danger)]">*</span>
              </label>
              <button
                type="button"
                onClick={handleFillSample}
                className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
              >
                Gunakan Contoh Format
              </button>
            </div>
            <textarea
              rows={8}
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                if (error) setError(null);
              }}
              placeholder={`[\n  {\n    "name": "Nama POI",\n    "latitude": -7.4478,\n    "longitude": 112.7183\n  }\n]`}
              className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-[var(--radius-sm)] p-3 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] resize-y"
              disabled={loading}
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              Sistem backend akan otomatis memetakan kategori keramaian dan melakukan deduplikasi spasial (15 meter).
            </p>
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
              {loading ? "Memproses Import..." : "Import Batch Data"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
