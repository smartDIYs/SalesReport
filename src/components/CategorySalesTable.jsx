const CATEGORY_COLORS = [
  '#1a73e8', // blue
  '#e8710a', // orange
  '#f9ab00', // yellow
  '#1e8e3e', // green
  '#a142f4', // purple
  '#e52592', // pink
];

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

function formatPeriod(data) {
  const { startYear, startMonth, endYear, endMonth, year, month } = data;
  if (startYear != null && endYear != null) {
    if (startYear === endYear && startMonth === endMonth) {
      return `${startYear}年${startMonth}月`;
    }
    return `${startYear}年${startMonth}月 〜 ${endYear}年${endMonth}月`;
  }
  return `${year}年${month}月`;
}

function CategorySalesTable({ data }) {
  const { totalSales, orderCount, categories, uncategorized } = data;

  const totalMain = categories.reduce((s, c) => s + c.main.total, 0);
  const totalOption = categories.reduce((s, c) => s + c.option.total, 0);
  const avgOrderValue = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;

  return (
    <>
      {/* Metric Cards */}
      <div className="metrics-row">
        <div className="metric-card primary">
          <div className="metric-label">売上合計</div>
          <div className="metric-value">{formatCurrency(totalSales)}</div>
          <div className="metric-sub">{formatPeriod(data)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">注文数</div>
          <div className="metric-value">{formatNumber(orderCount)}</div>
          <div className="metric-sub">件</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">平均注文額</div>
          <div className="metric-value small">{formatCurrency(avgOrderValue)}</div>
          <div className="metric-sub">/ 注文</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">カテゴリ数</div>
          <div className="metric-value">{categories.length}</div>
          <div className="metric-sub">アクティブ</div>
        </div>
      </div>

      {/* Category Breakdown Table */}
      {categories.length > 0 ? (
        <div className="table-card">
          <div className="table-header">
            <div className="table-title">カテゴリ別売上</div>
          </div>
          <table className="sales-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>カテゴリ</th>
                <th className="right" style={{ width: '18%' }}>本体</th>
                <th className="right" style={{ width: '18%' }}>オプション・消耗品</th>
                <th className="right" style={{ width: '16%' }}>小計</th>
                <th style={{ width: '18%' }}>割合</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, i) => {
                const pct = totalSales > 0 ? (cat.subtotal / totalSales) * 100 : 0;
                const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                return (
                  <tr key={cat.key}>
                    <td>
                      <div className="cat-name">
                        <span className="cat-dot" style={{ background: color }} />
                        {cat.name}
                      </div>
                    </td>
                    <td className="right">
                      <div className="cell-amount">{formatCurrency(cat.main.total)}</div>
                      <div className="cell-count">{formatNumber(cat.main.count)}個</div>
                    </td>
                    <td className="right">
                      <div className="cell-amount">{formatCurrency(cat.option.total)}</div>
                      <div className="cell-count">{formatNumber(cat.option.count)}個</div>
                    </td>
                    <td className="right subtotal-cell">
                      <div className="cell-amount">{formatCurrency(cat.subtotal)}</div>
                    </td>
                    <td>
                      <div className="bar-wrapper">
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${pct}%`,
                              background: color,
                              minWidth: pct > 0 ? 2 : 0,
                            }}
                          />
                        </div>
                        <span className="percentage">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>合計</td>
                <td className="right">{formatCurrency(totalMain)}</td>
                <td className="right">{formatCurrency(totalOption)}</td>
                <td className="right">{formatCurrency(totalSales)}</td>
                <td>
                  <span className="percentage" style={{ marginLeft: 0 }}>100.0%</span>
                </td>
              </tr>
            </tfoot>
          </table>
          {uncategorized.total > 0 && (
            <div className="excluded-note">
              ※ 未分類の売上: {formatCurrency(uncategorized.total)}（{formatNumber(uncategorized.count)}個）
            </div>
          )}
        </div>
      ) : (
        <div className="empty">該当期間の売上データがありません</div>
      )}
    </>
  );
}

export default CategorySalesTable;
