import { useMemo, useState, useCallback } from 'react';
import cx from './cx';
import EmptyState from './EmptyState';

// Standings, Stats, Roster and the FA pool each hand-rolled a table with
// different sort handling, different header styling and no sticky header.
//
// columns: [{
//   id, header, accessor(row) -> sortable primitive, cell(row) -> node,
//   align?: 'left'|'right'|'center', width?: string, sortable?: boolean,
//   numeric?: boolean
// }]

export function DataTable({
  columns,
  rows,
  getRowId = (r, i) => r.id ?? i,
  initialSort,
  onRowClick,
  highlightRow,
  stickyHeader = true,
  dense = false,
  empty,
  className = '',
  caption,
}) {
  const [sort, setSort] = useState(
    initialSort ?? { id: columns.find(c => c.sortable !== false)?.id, dir: 'desc' },
  );

  const toggleSort = useCallback((col) => {
    if (col.sortable === false) return;
    setSort(s => (s.id === col.id
      ? { id: col.id, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { id: col.id, dir: col.numeric ? 'desc' : 'asc' }));
  }, []);

  const sorted = useMemo(() => {
    const col = columns.find(c => c.id === sort?.id);
    if (!col?.accessor) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, columns, sort]);

  if (!rows.length) {
    return empty ?? <EmptyState icon="∅" title="Nothing to show yet" size="sm" />;
  }

  const pad = dense ? 'px-3 py-1.5' : 'px-3 py-2.5';

  return (
    <div className={cx('min-h-0 overflow-auto', className)}>
      <table className="w-full border-collapse text-label">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className={cx(stickyHeader && 'sticky top-0 z-10')}>
          <tr className="bg-surface-sunken">
            {columns.map(col => {
              const active = sort?.id === col.id;
              const sortable = col.sortable !== false && !!col.accessor;
              return (
                <th
                  key={col.id}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cx(
                    pad, 'border-b-2 border-ink text-micro uppercase text-fg-muted font-bold',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    !col.align && 'text-left',
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className={cx(
                        'inline-flex items-center gap-1 transition-colors hover:text-fg',
                        active && 'text-fg',
                      )}
                    >
                      {col.header}
                      <span aria-hidden="true" className={cx('text-[9px]', !active && 'opacity-0')}>
                        {sort?.dir === 'asc' ? '▲' : '▼'}
                      </span>
                    </button>
                  ) : col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const id = getRowId(row, i);
            const isHighlight = highlightRow?.(row);
            return (
              <tr
                key={id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                className={cx(
                  'border-b border-line-subtle transition-colors duration-micro',
                  i % 2 === 1 && 'bg-surface-hover',
                  onRowClick && 'cursor-pointer hover:bg-surface-hover',
                  isHighlight && 'bg-team-16 hover:bg-team-24 shadow-[inset_4px_0_0_var(--team-primary)]',
                )}
              >
                {columns.map(col => (
                  <td
                    key={col.id}
                    className={cx(
                      pad, 'text-fg-secondary align-middle',
                      col.numeric && 'tabular-nums',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                    )}
                  >
                    {col.cell ? col.cell(row) : col.accessor?.(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
