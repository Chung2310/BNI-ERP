export function resultGridLayout(count: number) {
  const columns = count <= 3 ? count : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const remainder = count % columns;
  const hasPartialRow = remainder > 0;
  return {
    columns,
    rows,
    trackColumns: hasPartialRow ? columns * 2 : columns,
    itemSpan: hasPartialRow ? 2 : 1,
    lastRowStartIndex: hasPartialRow ? count - remainder : -1,
    lastRowStartColumn: hasPartialRow ? columns - remainder + 1 : 1,
  };
}
