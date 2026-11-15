import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { formatCurrency } from '../utils/format';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface BudgetBarItem {
  label: string;
  approvedBudget: number;
  recordedExpenditure: number;
}

interface BudgetComparisonChartProps {
  title: string;
  items: BudgetBarItem[];
  budgetLabel?: string;
  spendLabel?: string;
}

export const BudgetComparisonChart: React.FC<BudgetComparisonChartProps> = ({
  title,
  items,
  budgetLabel = 'Approved Budget',
  spendLabel = 'Recorded Expenditure',
}) => {
  const [showTable, setShowTable] = useState(false);

  const data = {
    labels: items.map((i) => i.label),
    datasets: [
      {
        label: budgetLabel,
        data: items.map((i) => i.approvedBudget),
        backgroundColor: '#1d4ed8',
        borderRadius: 4,
      },
      {
        label: spendLabel,
        data: items.map((i) => i.recordedExpenditure),
        backgroundColor: '#0f766e',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          boxWidth: 12,
          color: '#334155',
          font: { size: 12 },
        },
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: { color: '#475569', font: { size: 11 } },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: '#475569',
          font: { size: 11 },
          callback: (val: string | number) => `$${Number(val).toLocaleString()}`,
        },
        grid: { color: '#e2e8f0' },
      },
    },
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm font-semibold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          aria-expanded={showTable}
          className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0"
        >
          {showTable ? 'Show Chart' : 'View Data Table'}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">
          No records match the selected fiscal year or filters.
        </p>
      ) : showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-4 font-semibold">Entity</th>
                <th className="py-2 pr-4 text-right font-semibold">{budgetLabel}</th>
                <th className="py-2 text-right font-semibold">{spendLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => (
                <tr key={row.label}>
                  <td className="py-2 pr-4 text-slate-800">{row.label}</td>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums text-slate-900">
                    {formatCurrency(row.approvedBudget)}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-slate-900">
                    {formatCurrency(row.recordedExpenditure)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64" role="img" aria-label={`${title} bar chart`}>
          <Bar data={data} options={options} />
        </div>
      )}
    </div>
  );
};

interface CategoryShareItem {
  category: string;
  total: number;
}

interface CategoryBreakdownChartProps {
  title: string;
  items: CategoryShareItem[];
}

const CHART_PALETTE = ['#1d4ed8', '#0f766e', '#b45309', '#475569', '#0369a1', '#6d28d9'];

export const CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = ({
  title,
  items,
}) => {
  const [showTable, setShowTable] = useState(false);

  const data = {
    labels: items.map((i) => i.category),
    datasets: [
      {
        data: items.map((i) => i.total),
        backgroundColor: items.map((_, idx) => CHART_PALETTE[idx % CHART_PALETTE.length]),
        borderWidth: 1,
        borderColor: '#ffffff',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { boxWidth: 12, color: '#334155', font: { size: 11 } },
      },
    },
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm font-semibold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          aria-expanded={showTable}
          className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0"
        >
          {showTable ? 'Show Chart' : 'View Data Table'}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">
          No categorized records available for this selection.
        </p>
      ) : showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-4 font-semibold">Category</th>
                <th className="py-2 text-right font-semibold">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => (
                <tr key={row.category}>
                  <td className="py-2 pr-4 text-slate-800">{row.category}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-slate-900">
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64" role="img" aria-label={`${title} breakdown chart`}>
          <Doughnut data={data} options={options} />
        </div>
      )}
    </div>
  );
};
