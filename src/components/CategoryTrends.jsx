import { useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const CATEGORY_COLORS = [
  '#1a73e8', '#e8710a', '#f9ab00', '#1e8e3e', '#a142f4', '#e52592',
];

function formatCurrency(amount) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getMonthRange(sy, sm, ey, em) {
  const months = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

function CategoryTrends({ onAuthError }) {
  const now = new Date();
  const [startYear, setStartYear] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return d.getFullYear();
  });
  const [startMonth, setStartMonth] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return d.getMonth() + 1;
  });
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);
  const [chartData, setChartData] = useState(null);
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTrends = useCallback(async () => {
    const months = getMonthRange(startYear, startMonth, endYear, endMonth);
    if (months.length === 0) {
      setError('開始月が終了月より後になっています');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        months.map(async ({ year, month }) => {
          const res = await fetch(`/api/sales?year=${year}&month=${month}`);
          if (res.status === 401) {
            onAuthError();
            throw new Error('認証が切れました。再度ログインしてください');
          }
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          return res.json();
        })
      );

      const catMap = new Map();
      for (const result of results) {
        for (const cat of result.categories) {
          if (!catMap.has(cat.key)) {
            catMap.set(cat.key, cat.name);
          }
        }
      }
      const cats = Array.from(catMap.entries()).map(([key, name]) => ({ key, name }));
      setAllCategories(cats);

      const data = results.map((result, i) => {
        const { year, month } = months[i];
        const point = {
          label: `${year}/${month}`,
          total: result.totalSales,
        };
        for (const cat of cats) {
          const found = result.categories.find((c) => c.key === cat.key);
          point[cat.key] = found ? found.subtotal : 0;
          point[`${cat.key}_main`] = found ? found.main.total : 0;
          point[`${cat.key}_option`] = found ? found.option.total : 0;
        }
        return point;
      });
      setChartData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startYear, startMonth, endYear, endMonth, onAuthError]);

  const formatYAxis = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value;
  };

  const TotalTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="trends-tooltip">
        <div className="trends-tooltip-label">{label}</div>
        <div className="trends-tooltip-row">
          <span className="trends-tooltip-dot" style={{ background: '#1a73e8' }} />
          <span className="trends-tooltip-name">売上合計</span>
          <span className="trends-tooltip-value">{formatCurrency(payload[0].value)}</span>
        </div>
      </div>
    );
  };

  const CategoryTooltip = ({ active, payload, label, catName, color }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="trends-tooltip">
        <div className="trends-tooltip-label">{label}</div>
        <div className="trends-tooltip-row">
          <span className="trends-tooltip-dot" style={{ background: color }} />
          <span className="trends-tooltip-name">{catName} 合計</span>
          <span className="trends-tooltip-value">{formatCurrency(payload[0]?.value)}</span>
        </div>
        <div className="trends-tooltip-row">
          <span className="trends-tooltip-dot" style={{ background: color, opacity: 0.7 }} />
          <span className="trends-tooltip-name">本体</span>
          <span className="trends-tooltip-value">{formatCurrency(payload[1]?.value)}</span>
        </div>
        <div className="trends-tooltip-row">
          <span className="trends-tooltip-dot" style={{ background: color, opacity: 0.4 }} />
          <span className="trends-tooltip-name">オプション</span>
          <span className="trends-tooltip-value">{formatCurrency(payload[2]?.value)}</span>
        </div>
      </div>
    );
  };

  const currentYear = now.getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y);
  }
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="trends-page">
      <div className="controls-bar">
        <h2 className="page-title">売上推移</h2>
        <div className="controls-left">
          <div className="date-selector">
            <select value={startYear} onChange={(e) => setStartYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}年</option>)}
            </select>
            <span className="date-separator">/</span>
            <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}>
              {monthOptions.map((m) => <option key={m} value={m}>{m}月</option>)}
            </select>
          </div>
          <span className="date-range-arrow">→</span>
          <div className="date-selector">
            <select value={endYear} onChange={(e) => setEndYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}年</option>)}
            </select>
            <span className="date-separator">/</span>
            <select value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))}>
              {monthOptions.map((m) => <option key={m} value={m}>{m}月</option>)}
            </select>
          </div>
          <button className="fetch-btn" onClick={fetchTrends} disabled={loading}>
            {loading ? '取得中...' : '適用'}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {loading && (
        <div className="loading"><div className="spinner" /> データを取得中...</div>
      )}

      {chartData && !loading && (
        <>
          {/* Total Sales Chart */}
          <div className="table-card">
            <div className="table-header">
              <div className="table-title">売上合計推移</div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1a73e8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5f6368' }} />
                  <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12, fill: '#5f6368' }} />
                  <Tooltip content={<TotalTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#1a73e8"
                    strokeWidth={2.5}
                    fill="url(#totalGrad)"
                    dot={{ r: 4, fill: '#1a73e8', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Individual Category Charts */}
          <div className="category-charts-grid">
            {allCategories.map((cat, i) => {
              const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
              const gradId = `grad-${cat.key}`;
              return (
                <div key={cat.key} className="table-card category-chart-card">
                  <div className="table-header">
                    <div className="table-title">
                      <span className="cat-dot" style={{ background: color }} />
                      {cat.name}
                    </div>
                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5f6368' }} />
                        <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11, fill: '#5f6368' }} width={50} />
                        <Tooltip content={<CategoryTooltip catName={cat.name} color={color} />} />
                        <Area
                          type="monotone"
                          dataKey={cat.key}
                          stroke={color}
                          strokeWidth={2}
                          fill={`url(#${gradId})`}
                          dot={{ r: 3, fill: color, stroke: '#fff', strokeWidth: 2 }}
                          activeDot={{ r: 5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey={`${cat.key}_main`}
                          stroke={color}
                          strokeWidth={1.5}
                          strokeDasharray="6 3"
                          dot={false}
                          name="本体"
                        />
                        <Line
                          type="monotone"
                          dataKey={`${cat.key}_option`}
                          stroke={color}
                          strokeWidth={1}
                          strokeDasharray="2 2"
                          dot={false}
                          opacity={0.5}
                          name="オプション"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Data Table */}
          <div className="table-card">
            <div className="table-header">
              <div className="table-title">月別データ</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>月</th>
                    {allCategories.map((cat, i) => (
                      <th key={cat.key} className="right">
                        <span className="cat-dot" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length], display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                        {cat.name}
                      </th>
                    ))}
                    <th className="right">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row) => (
                    <tr key={row.label}>
                      <td style={{ fontWeight: 500 }}>{row.label}</td>
                      {allCategories.map((cat) => (
                        <td key={cat.key} className="right">
                          <div className="cell-amount">{formatCurrency(row[cat.key])}</div>
                        </td>
                      ))}
                      <td className="right">
                        <div className="cell-amount" style={{ fontWeight: 600 }}>{formatCurrency(row.total)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!chartData && !loading && !error && (
        <div className="empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dadce0" strokeWidth="1.5">
            <path d="M3 3v18h18" />
            <path d="M7 16l4-4 4 4 5-6" />
          </svg>
          期間を選択して「適用」を押してください
        </div>
      )}
    </div>
  );
}

export default CategoryTrends;
