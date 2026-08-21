function clean(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function dateCode(value: string) {
  const match = clean(value).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!match) return "UNDATED";
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}${match[2].padStart(2, "0")}${match[1].padStart(2, "0")}`;
}

/**
 * Keeps an actual production job number when supplied by the source sheet.
 * Blank job cells receive a deterministic event reference based on the event
 * date and source-sheet row, so the same import produces the same unique value.
 */
export function qualityEventJobNumber(sourceJobNumber: string, sourceDate: string, sourceRowNumber: number) {
  const supplied = clean(sourceJobNumber);
  if (supplied) return supplied;
  const row = Math.max(1, Math.trunc(sourceRowNumber)).toString().padStart(5, "0");
  return `NCE-${dateCode(sourceDate)}-${row}`;
}
