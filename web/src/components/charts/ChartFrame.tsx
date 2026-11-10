import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardHeader } from '@/components/ui/Card';

export interface SeriesSpec {
  key: string;
  label: string;
  color: string;
  /** Dashed stroke for a baseline/comparison series so identity never relies on color alone. */
  dashed?: boolean;
}

interface ChartFrameProps {
  title: string;
  description?: ReactNode;
  series?: readonly SeriesSpec[];
  /** Table view: column headers and rows of already formatted cells. */
  table: { headers: string[]; rows: (string | number)[][] };
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Card wrapper every chart uses: title, legend (two or more series),
 * the chart itself, and a table view so values never depend on seeing the chart.
 */
export function ChartFrame({
  title,
  description,
  series = [],
  table,
  action,
  children,
  className,
}: ChartFrameProps) {
  const { t } = useTranslation();
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  return (
    <Card className={className}>
      <CardHeader
        id={titleId}
        title={title}
        description={description}
        action={
          <div className="flex items-center gap-2">
            {action}
            <button
              type="button"
              className="text-brand whitespace-nowrap text-xs font-medium hover:underline"
              aria-expanded={showTable}
              onClick={() => {
                setShowTable(!showTable);
              }}
            >
              {showTable ? t('common.hideTable') : t('common.showTable')}
            </button>
          </div>
        }
      />
      {series.length >= 2 && (
        <ul
          className="text-ink-muted mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"
          aria-label={t('charts.legend')}
        >
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <svg width="18" height="8" aria-hidden="true">
                <line
                  x1="1"
                  y1="4"
                  x2="17"
                  y2="4"
                  stroke={s.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={s.dashed === true ? '4 3' : undefined}
                />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {showTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="tabular w-full text-sm" aria-labelledby={titleId}>
            <thead>
              <tr className="text-ink-muted border-line border-b text-start">
                {table.headers.map((h) => (
                  <th key={h} scope="col" className="py-1.5 pe-3 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i} className="border-line border-b last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="py-1.5 pe-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-labelledby={titleId}>
          {children}
        </div>
      )}
    </Card>
  );
}
