function MonthSelector({ startYear, startMonth, endYear, endMonth, onStartYearChange, onStartMonthChange, onEndYearChange, onEndMonthChange, onFetch, loading }) {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y);
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="controls-bar">
      <h2 className="page-title">概要</h2>
      <div className="controls-left">
        <div className="date-selector">
          <select value={startYear} onChange={(e) => onStartYearChange(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <span className="date-separator">/</span>
          <select value={startMonth} onChange={(e) => onStartMonthChange(Number(e.target.value))}>
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </div>
        <span className="date-range-arrow">→</span>
        <div className="date-selector">
          <select value={endYear} onChange={(e) => onEndYearChange(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <span className="date-separator">/</span>
          <select value={endMonth} onChange={(e) => onEndMonthChange(Number(e.target.value))}>
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </div>
        <button className="fetch-btn" onClick={onFetch} disabled={loading}>
          {loading ? '取得中...' : '適用'}
        </button>
      </div>
    </div>
  );
}

export default MonthSelector;
