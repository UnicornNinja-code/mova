import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/primitives/Button";
import { StatusBadge } from "@/components/primitives/Badge";
import { Panel, PanelHeader, PanelBody } from "@/components/primitives/Panel";
import { FormField, FormLabel, FormErrorText } from "@/components/composites/FormField";
import { DataTable } from "@/components/composites/DataTable";

describe("🏢 MOVA UI Primitives Foundation Suite", () => {
  describe("Button Primitive", () => {
    it("renders label and handles click event", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Simpan Zona</Button>);

      const btn = screen.getByRole("button", { name: /simpan zona/i });
      expect(btn).toBeInTheDocument();

      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("prevents interaction when disabled or loading", () => {
      const handleClick = vi.fn();
      render(
        <Button disabled onClick={handleClick}>
          Aksi Nonaktif
        </Button>
      );

      const btn = screen.getByRole("button", { name: /aksi nonaktif/i });
      expect(btn).toBeDisabled();

      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("displays loading spinner when loading is true", () => {
      render(<Button loading>Proses</Button>);
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
      expect(btn.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("StatusBadge Business Mapping Primitive", () => {
    it("maps COMPLIANT to success variant", () => {
      render(<StatusBadge status="COMPLIANT" />);
      const badge = screen.getByText(/compliant/i);
      expect(badge).toBeInTheDocument();
      expect(badge.closest("span")).toHaveClass("bg-[var(--status-success-bg)]");
    });

    it("maps DEVIATED to warning variant", () => {
      render(<StatusBadge status="DEVIATED" />);
      const badge = screen.getByText(/deviated/i);
      expect(badge).toBeInTheDocument();
      expect(badge.closest("span")).toHaveClass("bg-[var(--status-warning-bg)]");
    });

    it("maps OUTSIDE_ZONE to danger variant", () => {
      render(<StatusBadge status="OUTSIDE_ZONE" />);
      const badge = screen.getByText(/outside zone/i);
      expect(badge).toBeInTheDocument();
      expect(badge.closest("span")).toHaveClass("bg-[var(--status-danger-bg)]");
    });

    it("maps DEFINITIVE_MATCH to brand variant", () => {
      render(<StatusBadge status="DEFINITIVE_MATCH" />);
      const badge = screen.getByText(/definitive match/i);
      expect(badge).toBeInTheDocument();
    });
  });

  describe("Panel and Composite FormField", () => {
    it("renders Panel structure with header and body", () => {
      render(
        <Panel>
          <PanelHeader title="Informasi Armada" subtitle="Data Gerobak" />
          <PanelBody>Konten Detail Armada</PanelBody>
        </Panel>
      );

      expect(screen.getByText("Informasi Armada")).toBeInTheDocument();
      expect(screen.getByText("Data Gerobak")).toBeInTheDocument();
      expect(screen.getByText("Konten Detail Armada")).toBeInTheDocument();
    });

    it("renders FormField with accessible label and error state", () => {
      render(
        <FormField>
          <FormLabel htmlFor="zone-name" required>
            Nama Zona
          </FormLabel>
          <input id="zone-name" />
          <FormErrorText>Nama zona wajib diisi</FormErrorText>
        </FormField>
      );

      expect(screen.getByText("Nama Zona")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("Nama zona wajib diisi");
    });
  });

  describe("DataTable Composite", () => {
    it("renders table data correctly with headers", () => {
      const columns = [
        { header: "Nama Zona", accessor: "name" },
        { header: "Kapasitas", accessor: "capacity" },
      ];
      const data = [
        { id: "1", name: "Zona GOR", capacity: "5" },
        { id: "2", name: "Zona Alun-Alun", capacity: "4" },
      ];

      render(<DataTable columns={columns} data={data} />);

      expect(screen.getByText("Nama Zona")).toBeInTheDocument();
      expect(screen.getByText("Zona GOR")).toBeInTheDocument();
      expect(screen.getByText("Zona Alun-Alun")).toBeInTheDocument();
    });

    it("renders EmptyState when data array is empty", () => {
      const columns = [{ header: "Nama Zona", accessor: "name" }];
      render(<DataTable columns={columns} data={[]} emptyTitle="Belum Ada Zona" />);

      expect(screen.getByText("Belum Ada Zona")).toBeInTheDocument();
    });
  });
});
