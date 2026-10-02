import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export const excelColumns = [
  ["name", "Nome"], ["cpf", "CPF"], ["niche", "Área de atuação"],
  ["email", "E-mail"], ["phone", "Celular"], ["company", "Grupo ou empresa"],
  ["city", "Cidade"], ["address", "Endereço"], ["availability", "Disponibilidade"],
  ["status", "Situação"], ["stage", "Etapa"],
] as const;

type Row = Record<string, string | number>;
const xml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const col = (index: number) => {
  let n = index + 1, value = "";
  while (n > 0) { n--; value = String.fromCharCode(65 + n % 26) + value; n = Math.floor(n / 26); }
  return value;
};
const textCell = (address: string, value: unknown, style: number) =>
  `<c r="${address}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;

export function makeExcel(records: Row[]): Uint8Array {
  const head = excelColumns.map(([, label], i) => textCell(`${col(i)}1`, label, 1)).join("");
  const body = records.map((record, index) =>
    `<row r="${index + 2}">${excelColumns.map(([key], i) => textCell(`${col(i)}${index + 2}`, record[key], index % 2 ? 3 : 2)).join("")}</row>`
  ).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:K${records.length + 1}"/><sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="25" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="3" width="25" customWidth="1"/><col min="4" max="4" width="29" customWidth="1"/><col min="5" max="5" width="18" customWidth="1"/><col min="6" max="11" width="23" customWidth="1"/></cols>
<sheetData><row r="1" ht="28" customHeight="1">${head}</row>${body}</sheetData>
<autoFilter ref="A1:K${records.length + 1}"/></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF163744"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F7F7"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Voluntários" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(styles),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  };
  return zipSync(files, { level: 6 });
}

export function readExcel(bytes: Uint8Array): Record<string, string>[] {
  let declaredBytes = 0;
  const files = unzipSync(bytes, { filter: (file) => {
    if (!(/^xl\/worksheets\/sheet\d+\.xml$/.test(file.name) || file.name === "xl/sharedStrings.xml")) return false;
    declaredBytes += file.originalSize;
    if (file.originalSize > 15_000_000 || declaredBytes > 20_000_000) throw new Error("Planilha expandida grande demais.");
    return true;
  } });
  const filename = Object.keys(files).find((key) => /^xl\/worksheets\/sheet\d+\.xml$/.test(key));
  if (!filename || files[filename].length > 15_000_000) throw new Error("Planilha inválida ou grande demais.");
  const parser = new DOMParser();
  const sheet = parser.parseFromString(strFromU8(files[filename]), "application/xml");
  if (sheet.querySelector("parsererror")) throw new Error("Não foi possível ler a planilha.");
  let shared: string[] = [];
  if (files["xl/sharedStrings.xml"]) {
    if (files["xl/sharedStrings.xml"].length > 15_000_000) throw new Error("Planilha inválida ou grande demais.");
    const strings = parser.parseFromString(strFromU8(files["xl/sharedStrings.xml"]), "application/xml");
    shared = Array.from(strings.getElementsByTagName("si")).map((si) => Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
  }
  const table = Array.from(sheet.getElementsByTagName("row")).map((row) => {
    const cells: string[] = [];
    for (const cell of Array.from(row.getElementsByTagName("c"))) {
      const ref = cell.getAttribute("r") ?? "A1";
      const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
      const index = [...letters].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0) - 1;
      if (index < 0 || index > 100) continue;
      const type = cell.getAttribute("t");
      const raw = cell.getElementsByTagName("v")[0]?.textContent ?? "";
      cells[index] = type === "s" ? (shared[Number(raw)] ?? "") : type === "inlineStr" ? Array.from(cell.getElementsByTagName("t")).map((t) => t.textContent ?? "").join("") : raw;
    }
    return cells;
  }).filter((row) => row.some((cell) => String(cell ?? "").trim()));
  if (table.length < 2) throw new Error("A planilha precisa de cabeçalho e pelo menos uma pessoa.");
  if (table.length > 2001) throw new Error("Importe até 2.000 pessoas por arquivo.");
  const headers = table.shift()!;
  return table.map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""])));
}
