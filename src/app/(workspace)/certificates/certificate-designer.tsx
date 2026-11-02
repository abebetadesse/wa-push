"use client";

import { useActionState, useState } from "react";
import { CertificateView } from "@/components/certificate-view";
import type { CertificateDesign, CertificateElement, CertificateVariable } from "@/db/schema";
import { BORDERS, CERTIFICATE_AUDIENCES, ELEMENT_KINDS, FONTS, newElementId, PLACEHOLDERS, sampleData, TEMPLATE_PRESETS } from "@/lib/certificates";

type FormState = { error?: string; success?: string };

export type TemplateDraft = {
  id?: string;
  name: string;
  audience: string;
  design: CertificateDesign;
  elements: CertificateElement[];
  variables: CertificateVariable[];
};

/** Designs a certificate template: page style, positioned elements with placeholders, and values asked at issue time. */
export function CertificateDesigner({ action, initial, scopes, customKeys }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: TemplateDraft;
  scopes: { value: string; label: string }[];
  customKeys: string[];
}) {
  const start = initial ?? { ...TEMPLATE_PRESETS[0], elements: TEMPLATE_PRESETS[0].elements.map((element) => ({ ...element })) };
  const [state, formAction, pending] = useActionState(action, {});
  const [name, setName] = useState(initial?.name ?? start.name);
  const [audience, setAudience] = useState(start.audience);
  const [design, setDesign] = useState<CertificateDesign>(start.design);
  const [elements, setElements] = useState<CertificateElement[]>(start.elements);
  const [variables, setVariables] = useState<CertificateVariable[]>(start.variables);
  const [selected, setSelected] = useState<string | null>(start.elements[0]?.id ?? null);
  const current = elements.find((element) => element.id === selected) ?? null;
  const patch = (changes: Partial<CertificateElement>) => setElements((list) => list.map((element) => element.id === selected ? { ...element, ...changes } : element));
  const data = {
    ...sampleData(variables),
    ...Object.fromEntries(customKeys.map((key) => [`custom.${key}`, `[${key}]`])),
  };

  return (
    <div className="certificate-designer">
      <div className="designer-controls">
        <label>Start from a design
          <select onChange={(event) => {
            const preset = TEMPLATE_PRESETS.find((entry) => entry.id === event.target.value);
            if (!preset) return;
            const copy = preset.elements.map((element) => ({ ...element, id: newElementId() }));
            setName(preset.name); setAudience(preset.audience); setDesign(preset.design); setElements(copy); setVariables(preset.variables); setSelected(copy[0]?.id ?? null);
            event.target.value = "";
          }} value="">
            <option value="">Choose…</option>
            {TEMPLATE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Page</legend>
          <div className="builder-line">
            <label>Orientation<select onChange={(event) => setDesign({ ...design, orientation: event.target.value as CertificateDesign["orientation"] })} value={design.orientation}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>
            <label>Border<select onChange={(event) => setDesign({ ...design, border: event.target.value as CertificateDesign["border"] })} value={design.border}>{BORDERS.map((border) => <option key={border} value={border}>{border}</option>)}</select></label>
          </div>
          <div className="builder-line">
            <label>Paper<input onChange={(event) => setDesign({ ...design, background: event.target.value })} type="color" value={design.background} /></label>
            <label>Border colour<input onChange={(event) => setDesign({ ...design, borderColor: event.target.value })} type="color" value={design.borderColor} /></label>
            <label>Accent<input onChange={(event) => setDesign({ ...design, accent: event.target.value })} type="color" value={design.accent} /></label>
          </div>
          <label>Watermark<input maxLength={40} onChange={(event) => setDesign({ ...design, watermark: event.target.value })} placeholder="e.g. school initials" value={design.watermark} /></label>
        </fieldset>

        <fieldset>
          <legend>Elements</legend>
          <div className="element-list" role="listbox" aria-label="Elements">
            {elements.map((element) => (
              <button aria-selected={element.id === selected} key={element.id} onClick={() => setSelected(element.id)} role="option" type="button">
                {ELEMENT_KINDS.find((kind) => kind.kind === element.kind)?.label}: {element.text.slice(0, 40) || "—"}
              </button>
            ))}
          </div>
          <div className="inline-actions">
            {ELEMENT_KINDS.map((kind) => (
              <button className="secondary-button" key={kind.kind} onClick={() => {
                const element: CertificateElement = { id: newElementId(), kind: kind.kind, text: kind.kind === "line" ? "" : kind.kind === "signature" ? "Signature" : kind.kind === "seal" ? "{{school.name}}" : kind.kind === "code" ? "{{certificate.serial}} · {{certificate.verifyUrl}}" : "New text", x: 50, y: 50, width: kind.kind === "seal" ? 14 : 60, fontSize: kind.kind === "code" ? 9 : 16, bold: false, italic: false, color: design.accent, align: "center", font: kind.kind === "text" ? "serif" : "sans" };
                setElements((list) => [...list, element]);
                setSelected(element.id);
              }} type="button">+ {kind.label}</button>
            ))}
          </div>
        </fieldset>

        {current && (
          <fieldset>
            <legend>Selected element</legend>
            {current.kind !== "line" && <label>Text (placeholders allowed)<textarea maxLength={600} onChange={(event) => patch({ text: event.target.value })} rows={3} value={current.text} /></label>}
            <label>Insert a placeholder
              <select onChange={(event) => { if (event.target.value) patch({ text: `${current.text}{{${event.target.value}}}` }); event.target.value = ""; }} value="">
                <option value="">Choose…</option>
                <optgroup label="Recipient, school and certificate">{PLACEHOLDERS.map((placeholder) => <option key={placeholder.key} value={placeholder.key}>{placeholder.label}</option>)}</optgroup>
                {variables.length > 0 && <optgroup label="Values asked when issuing">{variables.map((variable) => <option key={variable.key} value={`var.${variable.key}`}>{variable.label}</option>)}</optgroup>}
                {customKeys.length > 0 && <optgroup label="Data fields">{customKeys.map((key) => <option key={key} value={`custom.${key}`}>{key}</option>)}</optgroup>}
              </select>
            </label>
            <div className="builder-line">
              <label>Across (%)<input max={100} min={0} onChange={(event) => patch({ x: Number(event.target.value) })} type="range" value={current.x} /></label>
              <label>Down (%)<input max={100} min={0} onChange={(event) => patch({ y: Number(event.target.value) })} type="range" value={current.y} /></label>
            </div>
            <div className="builder-line">
              <label>Width (%)<input max={100} min={2} onChange={(event) => patch({ width: Number(event.target.value) })} type="range" value={current.width} /></label>
              <label>Size<input className="number-input" max={120} min={4} onChange={(event) => patch({ fontSize: Number(event.target.value) })} type="number" value={current.fontSize} /></label>
            </div>
            <div className="builder-line">
              <label>Font<select onChange={(event) => patch({ font: event.target.value as CertificateElement["font"] })} value={current.font}>{FONTS.map((font) => <option key={font}>{font}</option>)}</select></label>
              <label>Align<select onChange={(event) => patch({ align: event.target.value as CertificateElement["align"] })} value={current.align}><option>left</option><option>center</option><option>right</option></select></label>
              <label>Colour<input onChange={(event) => patch({ color: event.target.value })} type="color" value={current.color} /></label>
            </div>
            <div className="builder-line">
              <label className="checkbox-label"><input checked={current.bold} onChange={(event) => patch({ bold: event.target.checked })} type="checkbox" /> Bold</label>
              <label className="checkbox-label"><input checked={current.italic} onChange={(event) => patch({ italic: event.target.checked })} type="checkbox" /> Italic</label>
              <button className="danger-button" onClick={() => { setElements((list) => list.filter((element) => element.id !== selected)); setSelected(null); }} type="button">Remove</button>
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend>Values asked when issuing</legend>
          <p className="field-help">For example the award, rank, course or hours — used in the text as {"{{var.key}}"}.</p>
          {variables.map((variable, index) => (
            <div className="builder-line" key={index}>
              <input aria-label="Key" maxLength={40} onChange={(event) => setVariables((list) => list.map((item, position) => position === index ? { ...item, key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") } : item))} placeholder="award" value={variable.key} />
              <input aria-label="Label" maxLength={80} onChange={(event) => setVariables((list) => list.map((item, position) => position === index ? { ...item, label: event.target.value } : item))} placeholder="Achievement" value={variable.label} />
              <input aria-label="Default" maxLength={300} onChange={(event) => setVariables((list) => list.map((item, position) => position === index ? { ...item, defaultValue: event.target.value } : item))} placeholder="Default" value={variable.defaultValue} />
              <button aria-label="Remove value" className="text-btn" onClick={() => setVariables((list) => list.filter((_, position) => position !== index))} type="button">×</button>
            </div>
          ))}
          {variables.length < 20 && <button className="secondary-button" onClick={() => setVariables((list) => [...list, { key: `value${list.length + 1}`, label: "", defaultValue: "" }])} type="button">Add a value</button>}
        </fieldset>
      </div>

      <div className="designer-preview">
        <CertificateView data={data} design={design} elements={elements} onSelect={setSelected} selectedId={selected} />
        <p className="field-help">Click text on the certificate to select it. The preview uses sample names.</p>
        <form action={formAction} className="auth-form">
          <input name="template" type="hidden" value={JSON.stringify({ design, elements, variables })} />
          {initial?.id && <input name="templateId" type="hidden" value={initial.id} />}
          <div className="form-two-columns">
            <label>Template name<input maxLength={160} name="name" onChange={(event) => setName(event.target.value)} required value={name} /></label>
            <label>Given to<select name="audience" onChange={(event) => setAudience(event.target.value)} value={audience}>{CERTIFICATE_AUDIENCES.map((value) => <option key={value} value={value}>{value === "student" ? "Students" : value === "teacher" ? "Teachers" : "Staff"}</option>)}</select></label>
            {!initial?.id && <label className="form-wide">Available to<select name="scope">{scopes.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}</select></label>}
          </div>
          {state.error && <p className="auth-error" role="alert">{state.error}</p>}
          {state.success && <p className="auth-success" role="status">{state.success}</p>}
          <button className="primary-button auth-submit" disabled={pending} type="submit">{pending ? "Saving…" : initial?.id ? "Save template" : "Create template"}</button>
        </form>
      </div>
    </div>
  );
}
