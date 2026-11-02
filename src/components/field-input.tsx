"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import ethiopia from "@/data/ethiopia-admin-units.json";
import type { FieldConfig, FieldValue } from "@/db/schema";
import {
  DURATION_UNITS,
  FILE_ACCEPT,
  fieldChoices,
  fieldValueAsInput,
  formatFieldValue,
  MULTI_FILE_TYPES,
} from "@/lib/custom-fields";

export type InputField = {
  id: string;
  fieldKey: string;
  label: string;
  labelLocal: string | null;
  fieldType: string;
  options: string[] | null;
  config: FieldConfig | null;
  required: boolean;
  helpText: string | null;
};

export type StoredFile = { id: string; fileName: string; url: string; isImage: boolean };

/** One data field as a form control, named f:<key> (files: file:<key>, kept files: keep:<key>, signature: sig:<key>). */
export function FieldInput({ field, value, files = [], disabled }: { field: InputField; value: FieldValue | undefined; files?: StoredFile[]; disabled?: boolean }) {
  const name = `f:${field.fieldKey}`;
  const config = field.config ?? {};
  const text = fieldValueAsInput(value) || (value == null ? config.defaultValue ?? "" : "");
  const label = (
    <span className="field-label">
      {field.label}{field.required && <span aria-hidden="true" className="field-required"> *</span>}
      {field.labelLocal && <span className="field-local">{field.labelLocal}</span>}
    </span>
  );
  const help = field.helpText && <small className="field-help">{field.helpText}</small>;
  const common = { disabled, name, required: field.required, placeholder: config.placeholder };

  switch (field.fieldType) {
    case "heading":
      return <h3 className="field-heading">{field.label}{field.labelLocal && <span className="field-local">{field.labelLocal}</span>}</h3>;
    case "paragraph":
      return <p className="field-paragraph">{field.helpText || field.label}</p>;
    case "divider":
      return <hr className="field-divider" />;
    case "formula":
    case "auto_number":
      return (
        <div className="field-control field-computed">
          {label}
          <output>{formatFieldValue(field, value) || "—"}</output>
          <small className="field-help">{field.fieldType === "formula" ? `Calculated: ${config.formula}` : "Numbered automatically when saved."}</small>
        </div>
      );
    case "textarea":
    case "rich_text":
    case "address":
      return <label className="field-control form-wide">{label}<textarea {...common} defaultValue={text} maxLength={config.maxLength ?? (field.fieldType === "textarea" ? 5000 : 10000)} rows={field.fieldType === "rich_text" ? 6 : 3} />{help}</label>;
    case "select":
    case "autocomplete": {
      const choices = fieldChoices(field);
      if (field.fieldType === "autocomplete") {
        return (
          <label className="field-control">{label}
            <input {...common} autoComplete="off" defaultValue={text} list={`list-${field.id}`} />
            <datalist id={`list-${field.id}`}>{choices.map((choice) => <option key={choice} value={choice} />)}</datalist>{help}
          </label>
        );
      }
      return <label className="field-control">{label}<select {...common} defaultValue={text}><option value="">—</option>{choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select>{help}</label>;
    }
    case "radio":
    case "button_group":
    case "yes_no":
    case "gender":
      return (
        <fieldset className={`field-control field-choices${field.fieldType === "button_group" ? " field-buttons" : ""}`} disabled={disabled}>
          <legend>{label}</legend>
          {fieldChoices(field).map((choice) => <label key={choice}><input defaultChecked={text === choice} name={name} required={field.required} type="radio" value={choice} /> {choice}</label>)}
          {!field.required && <label className="field-clear"><input defaultChecked={!text} name={name} type="radio" value="" /> Not answered</label>}
          {help}
        </fieldset>
      );
    case "switch":
      return <SwitchInput disabled={disabled} help={help} label={label} name={name} value={text === "Yes"} />;
    case "multi_select": {
      const chosen = Array.isArray(value) ? value : [];
      return <label className="field-control">{label}<select defaultValue={chosen} disabled={disabled} multiple name={name} size={Math.min(6, fieldChoices(field).length)}>{fieldChoices(field).map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select><small className="field-help">Hold Ctrl (or ⌘) to choose several.{field.helpText ? ` ${field.helpText}` : ""}</small></label>;
    }
    case "checkboxes": {
      const chosen = Array.isArray(value) ? value : [];
      return (
        <fieldset className="field-control field-choices" disabled={disabled}>
          <legend>{label}</legend>
          {fieldChoices(field).map((choice) => <label key={choice}><input defaultChecked={chosen.includes(choice)} name={name} type="checkbox" value={choice} /> {choice}</label>)}
          {help}
        </fieldset>
      );
    }
    case "tags":
      return <TagsInput disabled={disabled} help={help} label={label} name={name} value={Array.isArray(value) ? value : []} />;
    case "integer":
    case "decimal":
    case "currency":
    case "percentage":
    case "quantity":
    case "year": {
      const step = config.step ?? (field.fieldType === "integer" || field.fieldType === "year" ? 1 : field.fieldType === "currency" ? 0.01 : "any");
      const unit = field.fieldType === "currency" ? "ETB" : field.fieldType === "percentage" ? "%" : config.unit;
      return (
        <label className="field-control">{label}
          <span className="field-with-unit">
            <input {...common} defaultValue={text} inputMode="decimal" max={config.max ?? (field.fieldType === "percentage" ? 100 : undefined)} min={config.min ?? (["integer", "percentage", "currency", "quantity"].includes(field.fieldType) ? 0 : undefined)} step={step} type="number" />
            {unit && <span>{unit}</span>}
          </span>{help}
        </label>
      );
    }
    case "rating":
      return <RatingInput disabled={disabled} help={help} label={label} max={config.max ?? 5} name={name} value={typeof value === "number" ? value : 0} />;
    case "slider":
      return <SliderInput config={config} disabled={disabled} help={help} label={label} name={name} value={typeof value === "number" ? value : config.min ?? 0} />;
    case "number_range":
    case "price_range":
    case "percentage_range":
      return <RangeInput disabled={disabled} help={help} label={label} name={name} type={field.fieldType} value={text} />;
    case "duration":
      return <DurationInput disabled={disabled} help={help} label={label} name={name} value={text} />;
    case "date":
    case "time":
    case "month":
    case "week":
      return <label className="field-control">{label}<input {...common} defaultValue={text} type={field.fieldType} />{help}</label>;
    case "datetime":
      return <label className="field-control">{label}<input {...common} defaultValue={text} type="datetime-local" />{help}</label>;
    case "email":
    case "url":
      return <label className="field-control">{label}<input {...common} defaultValue={text} type={field.fieldType} />{help}</label>;
    case "phone":
      return <label className="field-control">{label}<input {...common} defaultValue={text} inputMode="tel" placeholder={config.placeholder ?? "+251 9…"} type="tel" />{help}</label>;
    case "color":
      return <label className="field-control">{label}<input disabled={disabled} defaultValue={text || "#5944db"} name={name} type="color" />{help}</label>;
    case "gps":
    case "my_location":
      return <GpsInput auto={field.fieldType === "my_location"} disabled={disabled} help={help} label={label} name={name} required={field.required} value={text} />;
    case "ethiopia_location":
      return <EthiopiaLocationInput disabled={disabled} help={help} label={label} name={name} value={text} />;
    case "location":
      return <LocationInput disabled={disabled} help={help} label={label} name={name} value={text} />;
    case "signature":
      return <SignatureInput disabled={disabled} field={field} files={files} help={help} label={label} />;
    case "file":
    case "image":
    case "document":
    case "pdf":
    case "video":
    case "audio":
    case "zip":
    case "multiple_files":
    case "multiple_images":
      return (
        <div className="field-control form-wide">
          {label}
          <StoredFiles disabled={disabled} field={field} files={files} />
          <input accept={FILE_ACCEPT[field.fieldType] || undefined} disabled={disabled} multiple={MULTI_FILE_TYPES.includes(field.fieldType)} name={`file:${field.fieldKey}`} type="file" />
          <small className="field-help">Up to 10 MB per file.{field.helpText ? ` ${field.helpText}` : ""}</small>
        </div>
      );
    default:
      return <label className="field-control">{label}<input {...common} defaultValue={text} maxLength={config.maxLength} pattern={config.pattern} type="text" />{help}</label>;
  }
}

function StoredFiles({ field, files, disabled }: { field: InputField; files: StoredFile[]; disabled?: boolean }) {
  if (files.length === 0) return null;
  return (
    <ul className="field-files">
      {files.map((file) => (
        <li key={file.id}>
          <label><input defaultChecked disabled={disabled} name={`keep:${field.fieldKey}`} type="checkbox" value={file.id} /> keep</label>
          {file.isImage ? <a href={file.url} rel="noreferrer" target="_blank"><img alt={file.fileName} src={file.url} /></a> : <a className="text-link" href={file.url}>{file.fileName}</a>}
        </li>
      ))}
    </ul>
  );
}

type Slot = { label: ReactNode; help: ReactNode; name: string; disabled?: boolean };

function SwitchInput({ label, help, name, disabled, value }: Slot & { value: boolean }) {
  const [on, setOn] = useState(value);
  return (
    <label className="field-control field-switch">{label}
      <input checked={on} disabled={disabled} onChange={(event) => setOn(event.target.checked)} role="switch" type="checkbox" />
      <input name={name} type="hidden" value={on ? "Yes" : "No"} />{help}
    </label>
  );
}

function RatingInput({ label, help, name, disabled, value, max }: Slot & { value: number; max: number }) {
  const [rating, setRating] = useState(value);
  return (
    <fieldset className="field-control field-rating" disabled={disabled}>
      <legend>{label}</legend>
      <div>{Array.from({ length: max }, (_, index) => index + 1).map((star) => (
        <button aria-label={`${star} of ${max}`} aria-pressed={rating >= star} key={star} onClick={() => setRating(star === rating ? 0 : star)} type="button">{rating >= star ? "★" : "☆"}</button>
      ))}</div>
      <input name={name} type="hidden" value={rating || ""} />{help}
    </fieldset>
  );
}

function SliderInput({ label, help, name, disabled, value, config }: Slot & { value: number; config: FieldConfig }) {
  const [current, setCurrent] = useState(value);
  return (
    <label className="field-control">{label}
      <span className="field-with-unit"><input disabled={disabled} max={config.max ?? 10} min={config.min ?? 0} name={name} onChange={(event) => setCurrent(Number(event.target.value))} step={config.step ?? 1} type="range" value={current} /><output>{current}{config.unit ? ` ${config.unit}` : ""}</output></span>{help}
    </label>
  );
}

function RangeInput({ label, help, name, disabled, value, type }: Slot & { value: string; type: string }) {
  const numbers = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/g) ?? [];
  const [low, setLow] = useState(numbers[0] ?? "");
  const [high, setHigh] = useState(numbers[1] ?? "");
  const unit = type === "price_range" ? "ETB" : type === "percentage_range" ? "%" : "";
  return (
    <fieldset className="field-control" disabled={disabled}>
      <legend>{label}</legend>
      <span className="field-with-unit">
        <input aria-label="From" onChange={(event) => setLow(event.target.value)} step="any" type="number" value={low} />–
        <input aria-label="To" onChange={(event) => setHigh(event.target.value)} step="any" type="number" value={high} />{unit && <span>{unit}</span>}
      </span>
      <input name={name} type="hidden" value={low !== "" && high !== "" ? `${low} - ${high}` : ""} />{help}
    </fieldset>
  );
}

function DurationInput({ label, help, name, disabled, value }: Slot & { value: string }) {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(\w+)$/);
  const [amount, setAmount] = useState(match?.[1] ?? "");
  const [unit, setUnit] = useState<string>(match?.[2] ?? "days");
  return (
    <fieldset className="field-control" disabled={disabled}>
      <legend>{label}</legend>
      <span className="field-with-unit">
        <input aria-label="Amount" min={0} onChange={(event) => setAmount(event.target.value)} step="any" type="number" value={amount} />
        <select aria-label="Unit" onChange={(event) => setUnit(event.target.value)} value={unit}>{DURATION_UNITS.map((option) => <option key={option}>{option}</option>)}</select>
      </span>
      <input name={name} type="hidden" value={amount ? `${amount} ${unit}` : ""} />{help}
    </fieldset>
  );
}

function TagsInput({ label, help, name, disabled, value }: Slot & { value: string[] }) {
  const [tags, setTags] = useState(value);
  const [draft, setDraft] = useState("");
  const add = () => {
    const next = draft.split(/[,;]/).map((tag) => tag.trim()).filter(Boolean);
    if (next.length) setTags((current) => [...new Set([...current, ...next])]);
    setDraft("");
  };
  return (
    <div className="field-control">{label}
      <div className="field-tags">
        {tags.map((tag) => <span className="meta-chip" key={tag}>{tag}<button aria-label={`Remove ${tag}`} disabled={disabled} onClick={() => setTags((current) => current.filter((item) => item !== tag))} type="button">×</button><input name={name} type="hidden" value={tag} /></span>)}
        <input disabled={disabled} onBlur={add} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); } }} placeholder="Type and press Enter" value={draft} />
      </div>{help}
    </div>
  );
}

function GpsInput({ label, help, name, disabled, value, required, auto }: Slot & { value: string; required: boolean; auto: boolean }) {
  const [coordinates, setCoordinates] = useState(value);
  const [status, setStatus] = useState("");
  const locate = () => {
    if (!navigator.geolocation) { setStatus("This browser cannot share its location."); return; }
    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
        setStatus(`Located within about ${Math.round(position.coords.accuracy)} m.`);
      },
      (error) => setStatus(error.code === error.PERMISSION_DENIED ? "Location access was refused. Type the coordinates instead." : "The location could not be found. Try again outdoors or type it."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  const started = useRef(false);
  useEffect(() => {
    // "My location" fills itself in once, when empty.
    if (auto && !value && !disabled && !started.current) { started.current = true; locate(); }
  });
  const [lat, lng] = coordinates.split(",").map((part) => part.trim());
  return (
    <div className="field-control">{label}
      <span className="field-with-unit">
        <input disabled={disabled} inputMode="decimal" name={name} onChange={(event) => setCoordinates(event.target.value)} placeholder="9.0108, 38.7613" required={required} value={coordinates} />
        <button className="secondary-button" disabled={disabled} onClick={locate} type="button">Use my location</button>
      </span>
      {status && <small aria-live="polite" className="field-help">{status}</small>}
      {lat && lng && <a className="text-link field-help" href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lng)}#map=16/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}`} rel="noreferrer" target="_blank">View on map</a>}
      {help}
    </div>
  );
}

function EthiopiaLocationInput({ label, help, name, disabled, value }: Slot & { value: string }) {
  const [initialRegion = "", initialZone = "", initialWoreda = ""] = value.split(" › ");
  const [region, setRegion] = useState(initialRegion);
  const [zone, setZone] = useState(initialZone);
  const [woreda, setWoreda] = useState(initialWoreda);
  const zones = useMemo(() => ethiopia.find((entry) => entry.region === region)?.zones ?? [], [region]);
  const woredas = zones.find((entry) => entry.zone === zone)?.woredas ?? [];
  return (
    <fieldset className="field-control field-cascade form-wide" disabled={disabled}>
      <legend>{label}</legend>
      <select aria-label="Region" onChange={(event) => { setRegion(event.target.value); setZone(""); setWoreda(""); }} value={region}>
        <option value="">Region…</option>{ethiopia.map((entry) => <option key={entry.region}>{entry.region}</option>)}
      </select>
      <select aria-label="Zone" disabled={!region} onChange={(event) => { setZone(event.target.value); setWoreda(""); }} value={zone}>
        <option value="">Zone / sub-city…</option>{zones.map((entry) => <option key={entry.zone}>{entry.zone}</option>)}
      </select>
      <select aria-label="Woreda" disabled={!zone} onChange={(event) => setWoreda(event.target.value)} value={woreda}>
        <option value="">Woreda…</option>{woredas.map((entry) => <option key={entry}>{entry}</option>)}
      </select>
      <input name={name} type="hidden" value={[region, zone, woreda].filter(Boolean).join(" › ")} />{help}
    </fieldset>
  );
}

function LocationInput({ label, help, name, disabled, value }: Slot & { value: string }) {
  const parts = value.split(" › ");
  const [town, setTown] = useState(parts[0] ?? "");
  const [subTown, setSubTown] = useState(parts[1] ?? "");
  const [kebele, setKebele] = useState(parts[2] ?? "");
  return (
    <fieldset className="field-control field-cascade form-wide" disabled={disabled}>
      <legend>{label}</legend>
      <input aria-label="Town" maxLength={120} onChange={(event) => setTown(event.target.value)} placeholder="Town" value={town} />
      <input aria-label="Sub-town" maxLength={120} onChange={(event) => setSubTown(event.target.value)} placeholder="Sub-town" value={subTown} />
      <input aria-label="Kebele" maxLength={120} onChange={(event) => setKebele(event.target.value)} placeholder="Kebele" value={kebele} />
      <input name={name} type="hidden" value={[town, subTown, kebele].map((part) => part.trim()).filter(Boolean).join(" › ")} />{help}
    </fieldset>
  );
}

function SignatureInput({ field, files, label, help, disabled }: { field: InputField; files: StoredFile[]; label: ReactNode; help: ReactNode; disabled?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [data, setData] = useState("");
  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return [(event.clientX - box.left) * (event.currentTarget.width / box.width), (event.clientY - box.top) * (event.currentTarget.height / box.height)];
  };
  return (
    <div className="field-control form-wide">{label}
      <StoredFiles disabled={disabled} field={field} files={files} />
      <canvas
        aria-label="Signature pad: draw with the mouse or a finger"
        className="signature-pad"
        height={160}
        onPointerDown={(event) => {
          if (disabled) return;
          drawing.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          const context = event.currentTarget.getContext("2d")!;
          const [x, y] = point(event);
          context.lineWidth = 2.5;
          context.lineCap = "round";
          context.strokeStyle = "#111";
          context.beginPath();
          context.moveTo(x, y);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const context = event.currentTarget.getContext("2d")!;
          const [x, y] = point(event);
          context.lineTo(x, y);
          context.stroke();
        }}
        onPointerUp={(event) => { drawing.current = false; setData(event.currentTarget.toDataURL("image/png")); }}
        ref={canvas}
        width={480}
      />
      <span className="inline-actions">
        <button className="secondary-button" disabled={disabled} onClick={() => { canvas.current?.getContext("2d")?.clearRect(0, 0, 480, 160); setData(""); }} type="button">Clear</button>
      </span>
      <input name={`sig:${field.fieldKey}`} type="hidden" value={data} />{help}
    </div>
  );
}
