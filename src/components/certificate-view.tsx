import type { CSSProperties } from "react";
import type { CertificateDesign, CertificateElement } from "@/db/schema";
import { fillText } from "@/lib/certificates";

const FONT_FAMILIES: Record<CertificateElement["font"], string> = {
  serif: "Georgia, 'Times New Roman', 'Noto Serif Ethiopic', serif",
  sans: "var(--font-sans)",
  script: "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive",
};

/**
 * One certificate, drawn at any size: elements are placed by percentage of the page, and font
 * sizes scale with the page width (container query units), so the preview and the print match.
 */
export function CertificateView({ design, elements, data, selectedId, onSelect }: {
  design: CertificateDesign;
  elements: CertificateElement[];
  data: Record<string, string>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <div
      className={`certificate certificate-${design.orientation} certificate-border-${design.border}`}
      style={{ "--cert-bg": design.background, "--cert-border": design.borderColor, "--cert-accent": design.accent } as CSSProperties}
    >
      {design.watermark && <span aria-hidden="true" className="certificate-watermark">{fillText(design.watermark, data)}</span>}
      {elements.map((element) => {
        const style: CSSProperties = {
          left: `${element.x}%`,
          top: `${element.y}%`,
          width: `${element.width}%`,
          fontSize: `calc(${element.fontSize / 10} * 1cqw)`,
          fontWeight: element.bold ? 700 : 400,
          fontStyle: element.italic ? "italic" : "normal",
          color: element.color,
          textAlign: element.align,
          fontFamily: FONT_FAMILIES[element.font],
        };
        const text = fillText(element.text, data);
        const content = element.kind === "signature"
          ? <><span className="certificate-signature-line" style={{ borderColor: element.color }} />{text}</>
          : element.kind === "seal"
            ? <span className="certificate-seal" style={{ borderColor: element.color, color: element.color }}><span>{text}</span></span>
            : element.kind === "line"
              ? <span className="certificate-rule" style={{ background: element.color }} />
              : text;
        return (
          <div
            aria-selected={onSelect ? selectedId === element.id : undefined}
            className={`certificate-element certificate-${element.kind}`}
            key={element.id}
            onClick={onSelect ? () => onSelect(element.id) : undefined}
            role={onSelect ? "option" : undefined}
            style={style}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
