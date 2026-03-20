import { useState, useEffect, useCallback } from 'react';
import MonthSelector from './components/MonthSelector';
import CategorySalesTable from './components/CategorySalesTable';
import CategoryTrends from './components/CategoryTrends';
import CustomerRanking from './components/CustomerRanking';

function App() {
  const now = new Date();
  const [page, setPage] = useState('overview');
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [startMonth, setStartMonth] = useState(now.getMonth() + 1);
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authenticated, setAuthenticated] = useState(null);

  const handleAuthError = useCallback(() => setAuthenticated(false), []);

  useEffect(() => {
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((body) => setAuthenticated(body.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      setAuthenticated(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    try {
      // 開始月から終了月までのリストを生成
      const months = [];
      let y = startYear, m = startMonth;
      while (y < endYear || (y === endYear && m <= endMonth)) {
        months.push({ year: y, month: m });
        m++;
        if (m > 12) { m = 1; y++; }
      }
      if (months.length === 0) {
        throw new Error('開始月が終了月より後になっています');
      }

      const results = await Promise.all(
        months.map(async ({ year, month }) => {
          const res = await fetch(`/api/sales?year=${year}&month=${month}`);
          if (res.status === 401) {
            setAuthenticated(false);
            throw new Error('認証が切れました。再度ログインしてください');
          }
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          return res.json();
        })
      );

      // 複数月の結果をマージ
      const merged = {
        startYear, startMonth, endYear, endMonth,
        totalSales: 0,
        orderCount: 0,
        categories: [],
        uncategorized: { total: 0, count: 0 },
      };
      const catMap = new Map();

      for (const r of results) {
        merged.totalSales += r.totalSales;
        merged.orderCount += r.orderCount;
        merged.uncategorized.total += r.uncategorized.total;
        merged.uncategorized.count += r.uncategorized.count;
        for (const cat of r.categories) {
          if (catMap.has(cat.key)) {
            const e = catMap.get(cat.key);
            e.main.total += cat.main.total;
            e.main.count += cat.main.count;
            e.option.total += cat.option.total;
            e.option.count += cat.option.count;
            e.subtotal += cat.subtotal;
          } else {
            catMap.set(cat.key, {
              key: cat.key,
              name: cat.name,
              main: { ...cat.main },
              option: { ...cat.option },
              subtotal: cat.subtotal,
            });
          }
        }
      }
      merged.categories = Array.from(catMap.values()).sort((a, b) => b.subtotal - a.subtotal);

      setData(merged);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthenticated(false);
    setData(null);
  };

  if (authenticated === null) {
    return (
      <div className="app">
        <div className="topbar">
          <div className="topbar-logo">
            <AnalyticsIcon />
            <div className="topbar-title">smartDIYs <span>売上分析</span></div>
          </div>
        </div>
        <div className="loading"><div className="spinner" /> 読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-logo">
          <AnalyticsIcon />
          <div className="topbar-title">smartDIYs <span>売上分析</span></div>
        </div>
        <div className="topbar-actions">
          {authenticated && (
            <button className="logout-btn" onClick={handleLogout}>ログアウト</button>
          )}
        </div>
      </div>

      {authenticated && (
        <div className="nav-tabs">
          <button
            className={`nav-tab ${page === 'overview' ? 'active' : ''}`}
            onClick={() => setPage('overview')}
          >
            概要
          </button>
          <button
            className={`nav-tab ${page === 'trends' ? 'active' : ''}`}
            onClick={() => setPage('trends')}
          >
            売上推移
          </button>
          <button
            className={`nav-tab ${page === 'ranking' ? 'active' : ''}`}
            onClick={() => setPage('ranking')}
          >
            顧客ランキング
          </button>
        </div>
      )}

      {!authenticated ? (
        <div className="auth-prompt">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dadce0" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p style={{ marginTop: 16 }}>EC-CUBEへの認証が必要です</p>
          <a href="/auth/login" className="login-btn">ログイン</a>
        </div>
      ) : (
        <>
          <div className="main-content" style={{ display: page === 'overview' ? 'block' : 'none' }}>
            <MonthSelector
              startYear={startYear}
              startMonth={startMonth}
              endYear={endYear}
              endMonth={endMonth}
              onStartYearChange={setStartYear}
              onStartMonthChange={setStartMonth}
              onEndYearChange={setEndYear}
              onEndMonthChange={setEndMonth}
              onFetch={fetchSales}
              loading={loading}
            />

            {error && <div className="error">{error}</div>}

            {loading && <div className="loading"><div className="spinner" /> データを取得中...</div>}

            {data && !loading && <CategorySalesTable data={data} />}

            {!data && !loading && !error && (
              <div className="empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dadce0" strokeWidth="1.5">
                  <path d="M3 3v18h18" />
                  <path d="M7 16l4-4 4 4 5-6" />
                </svg>
                期間を選択して売上データを取得してください
              </div>
            )}
          </div>
          <div className="main-content" style={{ display: page === 'trends' ? 'block' : 'none' }}>
            <CategoryTrends onAuthError={handleAuthError} />
          </div>
          <div className="main-content" style={{ display: page === 'ranking' ? 'block' : 'none' }}>
            <CustomerRanking onAuthError={handleAuthError} />
          </div>
        </>
      )}
    </div>
  );
}

function AnalyticsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="13" width="4" height="9" rx="1" fill="#f9ab00" />
      <rect x="10" y="8" width="4" height="14" rx="1" fill="#1a73e8" />
      <rect x="18" y="3" width="4" height="19" rx="1" fill="#e8710a" />
    </svg>
  );
}

export default App;
