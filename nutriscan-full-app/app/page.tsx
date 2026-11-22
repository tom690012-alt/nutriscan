"use client";
import { useState } from "react";
import { scale } from "@/lib/nutrition";
import { MAX_SCAN_BYTES, SCAN_IMAGE_TYPES } from "@/lib/scan-image";

type N = { calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number; sugar?: number; sodium?: number };
const F: [keyof N, string, string][] = [["calories","Calories","kcal"],["protein","Protein","g"],["carbs","Carbs","g"],["fat","Fat","g"],["fiber","Fibre","g"],["sugar","Sugar","g"],["sodium","Sodium","mg"]];
const Stats = ({ n }: { n?: N | null }) => n
  ? <div className="stats">{F.map(([k, l, u]) => <span key={k}><b>{n[k] ?? "–"} {u}</b><small>{l}</small></span>)}</div>
  : <p className="m">No database match for this item.</p>;

async function call(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => null);
  if (response.status === 413) throw new Error("This photo is too large. Try a smaller photo.");
  if (!response.ok || !result) throw new Error(result?.error ?? "Something went wrong. Please try again.");
  return result;
}

async function prepareScanImage(file: File) {
  if (SCAN_IMAGE_TYPES.has(file.type) && file.size <= MAX_SCAN_BYTES) return file;

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error("This photo format couldn’t be opened. Try a JPG, PNG or WebP photo."); });
    const ratio = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This photo couldn’t be prepared. Try a smaller JPG photo.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!jpeg || jpeg.size > MAX_SCAN_BYTES) throw new Error("This photo is too large. Try a smaller photo.");
    return new File([jpeg], "scan.jpg", { type: "image/jpeg" });
  } finally { URL.revokeObjectURL(url); }
}

async function upload(file: File) {
  const form = new FormData();
  form.append("image", await prepareScanImage(file));
  return { method: "POST", body: form };
}

export default function Page() {
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const [items, setItems] = useState<any[]>([]); const [info, setInfo] = useState<any>(null);
  const [q, setQ] = useState(""); const [res, setRes] = useState<any>(null);

  const run = (label: string, fn: () => Promise<void>) => async () => {
    setBusy(label); setErr("");
    try { await fn(); } catch (e: any) { setErr(e.message || "Something went wrong."); } finally { setBusy(""); }
  };
  const pick = (fn: (f: File) => Promise<void>, label: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (f) run(label, () => fn(f))();
  };
  const scanPhoto = async (f: File) => { setInfo(null); setItems((await call("/api/scan", await upload(f))).items); };
  const readLabel = async (f: File) => { setItems([]); setInfo(await call("/api/label", await upload(f))); };
  const readBarcode = async (f: File) => {
    const { BrowserMultiFormatReader } = await import("@zxing/library");
    const url = URL.createObjectURL(f);
    let code = "";
    try { code = (await new BrowserMultiFormatReader().decodeFromImageUrl(url)).getText(); }
    catch { throw new Error("No barcode found. Try a closer, sharper photo of just the barcode."); }
    finally { URL.revokeObjectURL(url); }
    if (!/^\d{8,14}$/.test(code)) throw new Error("Use a product barcode, not a QR code.");
    setItems([]); setInfo(await call(`/api/barcode/${code}`));
  };
  const setGrams = (i: number, g: number) => setItems(items.map((it, j) => j !== i ? it
    : { ...it, grams: g, nutrition: it.match ? scale(it.match.per100g, g) : null }));

  return (
    <main>
      <h1>NutriScan AI</h1><p className="m">Snap. Scan. Know what’s inside.</p>
      <div className="card">
        <label className="b">Scan food photo<input className="scan-input" type="file" accept="image/*" disabled={!!busy} onChange={pick(scanPhoto, "Analyzing your meal…")} /></label>
        <label className="b">Read nutrition label<input className="scan-input" type="file" accept="image/*" disabled={!!busy} onChange={pick(readLabel, "Reading the label…")} /></label>
        <label className="b">Scan barcode<input className="scan-input" type="file" accept="image/*" disabled={!!busy} onChange={pick(readBarcode, "Reading the barcode…")} /></label>
        {busy && <p className="note" role="status">{busy}</p>}{err && <p className="err" role="alert">{err}</p>}
        <p className="m">Take a photo or choose one from your device.</p>
        <p className="m" style={{ fontSize: 13 }}>Estimates from photographs may not be exact.</p>
      </div>

      {items.map((it, i) => (
        <div className="card" key={i}>
          <b>{it.name}</b> <small>{it.confidence} confidence</small>
          <p className="m" style={{ margin: "2px 0" }}>{it.match ? `Matched: ${it.match.name} (${it.match.source === "CNF" ? "Canadian Nutrient File" : "USDA"})` : "No match"}</p>
          <input type="number" min={1} value={it.grams} onChange={(e) => +e.target.value > 0 && setGrams(i, +e.target.value)} /> g
          <Stats n={it.nutrition} />
        </div>))}

      {info && <div className="card"><b>{info.name}</b> {info.brand && <small>{info.brand}</small>}
        <p className="m" style={{ margin: "2px 0" }}>Per 100 g{info.servingSize ? ` · serving ${info.servingSize.amount} ${info.servingSize.unit}` : ""}</p>
        <Stats n={info.per100g} />
        {info.ingredients && <p><b>Ingredients:</b> {info.ingredients}</p>}
        {info.allergens?.length > 0 && <p><b>Allergens:</b> {info.allergens.join(", ")}</p>}</div>}

      <div className="card"><h2>Search foods</h2>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Big Mac, Oreo cookies, chicken breast…" />{" "}
        <button disabled={q.trim().length < 2} onClick={run("Searching…", async () => setRes(await call(`/api/foods/search?q=${encodeURIComponent(q)}`)))}>Search</button>
        {res && <>
          <h2 style={{ marginTop: 14 }}>Canadian Nutrient File</h2>
          {res.canadian.length ? res.canadian.map((f: any) => <div key={f.id}><button onClick={run("Loading…", async () => { setItems([]); setInfo(await call(`/api/cnf/${f.id}`)); })}>{f.name}</button></div>) : <p className="m">No matches.</p>}
          <h2>USDA FoodData Central</h2>
          {res.usda.length ? res.usda.map((f: any) => <div key={f.id}><button onClick={() => { setItems([]); setInfo(f); }}>{f.name}{f.brand ? ` — ${f.brand}` : ""}</button></div>) : <p className="m">No matches.</p>}
        </>}
      </div>
    </main>);
}
