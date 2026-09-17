import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  RadioGroup,
  RadioGroupItem,
  Slider,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarButton,
  AspectRatio,
  ScrollArea,
} from "@/components/primitives";

describe("Extended Radix UI Primitives Suite", () => {
  it("renders Accordion and toggles correctly", () => {
    render(
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>Parameter Bobot BWM</AccordionTrigger>
          <AccordionContent>Detail kriteria C1 sampai C6</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    expect(screen.getByText("Parameter Bobot BWM")).toBeInTheDocument();
    expect(screen.getByText("Detail kriteria C1 sampai C6")).toBeInTheDocument();
  });

  it("renders Collapsible component", () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Toggle Log Audit</CollapsibleTrigger>
        <CollapsibleContent>Rincian data log mutasi</CollapsibleContent>
      </Collapsible>
    );

    expect(screen.getByText("Toggle Log Audit")).toBeInTheDocument();
    expect(screen.getByText("Rincian data log mutasi")).toBeInTheDocument();
  });

  it("renders RadioGroup with options", () => {
    render(
      <RadioGroup defaultValue="MORNING">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="MORNING" id="r1" />
          <label htmlFor="r1">Shift Pagi</label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="AFTERNOON" id="r2" />
          <label htmlFor="r2">Shift Sore</label>
        </div>
      </RadioGroup>
    );

    expect(screen.getByLabelText("Shift Pagi")).toBeInTheDocument();
    expect(screen.getByLabelText("Shift Sore")).toBeInTheDocument();
  });

  it("renders Slider, Toggle, and ToggleGroup", () => {
    render(
      <div>
        <Slider defaultValue={[50]} max={100} step={1} aria-label="Radius Filter" />
        <Toggle aria-label="Toggle Bold">B</Toggle>
        <ToggleGroup type="single" defaultValue="grid">
          <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
          <ToggleGroupItem value="list">List</ToggleGroupItem>
        </ToggleGroup>
      </div>
    );

    expect(screen.getByLabelText("Radius Filter")).toBeInTheDocument();
    expect(screen.getByLabelText("Toggle Bold")).toBeInTheDocument();
    expect(screen.getByText("Grid")).toBeInTheDocument();
    expect(screen.getByText("List")).toBeInTheDocument();
  });

  it("renders Toolbar, AspectRatio, and ScrollArea", () => {
    render(
      <div>
        <Toolbar aria-label="GIS Actions">
          <ToolbarButton>Reset View</ToolbarButton>
        </Toolbar>
        <AspectRatio ratio={16 / 9}>
          <div data-testid="aspect-child">Video Telemetri</div>
        </AspectRatio>
        <ScrollArea className="h-40">
          <div>Log item 1</div>
          <div>Log item 2</div>
        </ScrollArea>
      </div>
    );

    expect(screen.getByText("Reset View")).toBeInTheDocument();
    expect(screen.getByTestId("aspect-child")).toBeInTheDocument();
    expect(screen.getByText("Log item 1")).toBeInTheDocument();
  });
});
