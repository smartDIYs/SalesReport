import { useState, useCallback } from 'react';

function formatCurrency(amount) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(n) {
  return new Intl.NumberFormat('ja-JP').format(n);
}

const RANK_COLORS = ['#f9ab00', '#9aa0a6', '#e8710a'];

function CustomerRanking({ onAuthError }) {
  const now = new Date();
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [startMonth, setStartMonth] = useState(now.getMonth() + 1);
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);
  const [topN, setTopN] = useState(10);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRanking = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startYear, startMonth, endYear, endMonth, limit: topN,
      });
      const res = await fetch(`/api/customer-ranking?${params}`);
      if (res.status === 401) {
        onAuthError();
        throw new Error('認証が切れました。再度ログインしてください');
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startYear, startMonth, endYear, endMonth, topN, onAuthError]);

  const currentYear = now.getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y);
  }
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="ranking-page">
      <div className="controls-bar">
        <h2 className="page-title">顧客ランキング</h2>
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
          <div className="date-selector">
            <select value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
              {[5, 10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>TOP {n}</option>
              ))}
            </select>
          </div>
          <button className="fetch-btn" onClick={fetchRanking} disabled={loading}>
            {loading ? '取得中...' : '適用'}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {loading && (
        <div className="loading"><div className="spinner" /> データを取得中...</div>
      )}

      {data && !loading && (
        <>
          <div className="metrics-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="metric-card primary">
              <div className="metric-label">対象注文数</div>
              <div className="metric-value">{formatNumber(data.totalOrders)}</div>
              <div className="metric-sub">件</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">ランキング対象</div>
              <div className="metric-value">{formatNumber(data.ranking.length)}</div>
              <div className="metric-sub">顧客</div>
            </div>
          </div>

          {data.ranking.length > 0 ? (
            <div className="table-card">
              <div className="table-header">
                <div className="table-title">購入金額 TOP{data.ranking.length}</div>
              </div>
              <table className="sales-table ranking-table">
                <thead>
                  <tr>
                    <th style={{ width: '4%' }}>#</th>
                    <th style={{ width: '25%' }}>会社名</th>
                    <th className="right" style={{ width: '7%' }}>注文数</th>
                    <th className="right" style={{ width: '14%' }}>購入合計</th>
                    <th style={{ width: '50%' }}>主要購入商品</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ranking.map((cust, i) => (
                    <tr key={cust.id || cust.email || i}>
                      <td>
                        <span
                          className="rank-badge"
                          style={{
                            background: RANK_COLORS[i] || '#e8eaed',
                            color: i < 3 ? '#fff' : '#5f6368',
                          }}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td>
                        <div className="customer-company">{(cust.company && !/^\d+$/.test(cust.company)) ? cust.company : cust.name || '-'}</div>
                      </td>
                      <td className="right">
                        <div className="cell-amount">{formatNumber(cust.orderCount)}</div>
                      </td>
                      <td className="right">
                        <div className="cell-amount">{formatCurrency(cust.total)}</div>
                      </td>
                      <td>
                        <div className="top-products">
                          {(cust.topProducts || []).map((p, j) => (
                            <div key={j} className="top-product-row">
                              <span className="top-product-name">{p.name}</span>
                              <span className="top-product-detail">
                                x{p.quantity} {formatCurrency(p.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">該当期間の注文データがありません</div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <div className="empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dadce0" strokeWidth="1.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          期間を選択して「適用」を押してください
        </div>
      )}
    </div>
  );
}

export default CustomerRanking;
