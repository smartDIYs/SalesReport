import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ベーシック認証（BASIC_AUTH_USER / BASIC_AUTH_PASS が設定されている場合のみ有効）
const BASIC_USER = process.env.BASIC_AUTH_USER;
const BASIC_PASS = process.env.BASIC_AUTH_PASS;
if (BASIC_USER && BASIC_PASS) {
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (auth) {
      const [, encoded] = auth.split(' ');
      const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
      if (user === BASIC_USER && pass === BASIC_PASS) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="SalesReport"');
    res.status(401).send('認証が必要です');
  });
}

// 本番環境: ビルド済みフロントエンドを配信
app.use(express.static(path.join(__dirname, 'dist')));

const ECCUBE_BASE_URL = process.env.ECCUBE_BASE_URL;
const ECCUBE_AUTHORIZE_URL = process.env.ECCUBE_AUTHORIZE_URL;
const ECCUBE_TOKEN_URL = process.env.ECCUBE_TOKEN_URL;
const ECCUBE_CLIENT_ID = process.env.ECCUBE_CLIENT_ID;
const ECCUBE_CLIENT_SECRET = process.env.ECCUBE_CLIENT_SECRET;
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const REDIRECT_URI = `${BASE_URL}/auth/callback`;
const TOKEN_FILE = '.token.json';

// === 6カテゴリ定義 ===
// 販売終了品のプレフィックス(EL,ES=Etcher Laser, FM=FABOOL Laser Mini, DS=FABOOL Laser DS)は除外済み
const CATEGORIES = [
  { key: 'co2-laser',      name: 'CO2レーザー加工機',   prefixes: ['EP', 'HL', 'LC', 'FC'] },
  { key: 'laser-marker',   name: 'レーザーマーカー',     prefixes: ['MC', 'MF', 'MM', 'MU', 'MP', 'LM', 'MR'] },
  { key: 'laser-welding',  name: 'レーザー溶接機',       prefixes: ['SL', 'SW'] },
  { key: 'sheet-metal',    name: '金属切断機',            prefixes: ['PL', 'FL'] },
  { key: 'laser-cleaner',  name: 'レーザークリーナー',   prefixes: ['SC'] },
  { key: 'laser-safety',   name: '保護具・安全対策',     prefixes: ['AE'] },
];

// 保護具・安全対策のキーワード
const SAFETY_KEYWORDS = ['保護メガネ', '保護めがね', 'パーテーション', '安全衛生', '保護パネル', 'カーテン', '標識シール'];

// 販売終了品の判定
function isDiscontinuedProduct(productCode) {
  const code = (productCode || '').toUpperCase();
  const prefix = code.substring(0, 2);

  // 販売終了品のコードプレフィックス
  // EL/ES: Etcher Laser, FM: FABOOL Laser Mini, EA: Etcher Laser(ジョイフル本田)
  // ただしELB01(排気ファンキット),ELB02(集塵機)はEtcher Laser Proと共有のため除外しない
  if (['EL', 'ES', 'FM', 'EA'].includes(prefix)) {
    if (/^ELB0[1-9]/.test(code)) return false;
    return true;
  }

  // MCN: 旧FABOOL/Smart Laser系全般, CFD: 旧FABOOLクラウドファンディング
  if (code.startsWith('MCN') || code.startsWith('CFD')) return true;

  // 共有プレフィックス内の販売終了品
  if (/^LC13/.test(code)) return true;      // FABOOL Laser CO2 (LC950とは別)
  if (/^SCB01/.test(code)) return true;     // SC300本体
  if (/^SCO/.test(code)) return true;       // SC300保守部品

  return false;
}

// 商品コード・商品名からカテゴリと種別を判定
function classifyProduct(productCode, productName) {
  const code = (productCode || '').toUpperCase();
  const name = productName || '';

  // 0. 販売終了品を除外
  if (isDiscontinuedProduct(productCode)) {
    return { categoryKey: null, categoryName: null, type: 'option' };
  }

  // 0.5. Etcher Laser Pro共有アクセサリ（ELコードだがEP扱い）
  // ELB01:排気ファンキット, ELB02:集塵機, ELB03:集塵機, ELB04-09:集塵機フィルタ類
  if (/^ELB0[1-9]/.test(code)) {
    return { categoryKey: 'co2-laser', categoryName: 'CO2レーザー加工機', type: 'option' };
  }

  // 1. 保護具・安全対策（商品名で判定）
  if (SAFETY_KEYWORDS.some((kw) => name.includes(kw))) {
    return { categoryKey: 'laser-safety', categoryName: '保護具・安全対策', type: 'option' };
  }

  // 2. 標準プレフィックス判定
  const prefix = code.substring(0, 2);
  const category = CATEGORIES.find((c) => c.prefixes.includes(prefix));

  // 本体判定:
  // - 3文字目が'A' → 本体
  // - 3文字目が'B'かつハイフン付き → 本体バリエーション or 延長保証
  // - 商品名に「延長保証」を含む → 本体
  const isMainUnit = code.length >= 3 && (
    code[2] === 'A' ||
    (code[2] === 'B' && code.includes('-'))
  );
  const isWarranty = /延長保証/.test(name);

  return {
    categoryKey: category?.key ?? null,
    categoryName: category?.name ?? null,
    type: (isMainUnit || isWarranty) ? 'main' : 'option',
  };
}

// トークン保持（ファイル永続化で再起動に対応）
let tokenData = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
};

function saveToken() {
  try { fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData)); } catch {}
}

function loadToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    }
  } catch {}
}

loadToken();

// EC-CUBEの売上集計から除外する注文ステータスID
// 3:注文取消し, 9:返品 を除外（EC-CUBE管理画面の売上集計と一致させる）
const EXCLUDED_STATUS_IDS = [3, 9];

// OAuth2: 認可ページへリダイレクト
app.get('/auth/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: ECCUBE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'read',
    state,
  });
  res.redirect(`${ECCUBE_AUTHORIZE_URL}?${params}`);
});

// OAuth2: コールバック
app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`認証エラー: ${error}`);
  if (!code) return res.status(400).send('認可コードがありません');

  try {
    const basicAuth = Buffer.from(`${ECCUBE_CLIENT_ID}:${ECCUBE_CLIENT_SECRET}`).toString('base64');
    const tokenRes = await axios.post(
      `${ECCUBE_TOKEN_URL}`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;
    tokenData = {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in ?? 3600) * 1000,
    };
    saveToken();
    res.redirect(`${BASE_URL}/?auth=success`);
  } catch (err) {
    console.error('トークン取得エラー:', err.response?.data ?? err.message);
    res.status(500).send('トークンの取得に失敗しました');
  }
});

// トークンリフレッシュ
async function refreshAccessToken() {
  if (!tokenData.refreshToken) return false;
  try {
    const basicAuth = Buffer.from(`${ECCUBE_CLIENT_ID}:${ECCUBE_CLIENT_SECRET}`).toString('base64');
    const tokenRes = await axios.post(
      `${ECCUBE_TOKEN_URL}`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenData.refreshToken,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
      }
    );
    const { access_token, refresh_token, expires_in } = tokenRes.data;
    tokenData = {
      accessToken: access_token,
      refreshToken: refresh_token ?? tokenData.refreshToken,
      expiresAt: Date.now() + (expires_in ?? 3600) * 1000,
    };
    saveToken();
    return true;
  } catch {
    tokenData = { accessToken: null, refreshToken: null, expiresAt: null };
    saveToken();
    return false;
  }
}

async function ensureToken() {
  if (!tokenData.accessToken) {
    throw new Error('未認証です。先にログインしてください');
  }
  if (tokenData.expiresAt && Date.now() > tokenData.expiresAt - 60000) {
    const ok = await refreshAccessToken();
    if (!ok) throw new Error('トークンの更新に失敗しました。再認証してください');
  }
}

// GraphQL クエリ実行
async function gql(query, variables = {}) {
  await ensureToken();
  const res = await axios.post(
    `${ECCUBE_BASE_URL}/api`,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${tokenData.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (res.data.errors) {
    throw new Error(`GraphQL Error: ${res.data.errors[0].message}`);
  }
  return res.data.data;
}

// 認証状態
app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: !!tokenData.accessToken });
});

app.post('/api/auth/logout', (req, res) => {
  tokenData = { accessToken: null, refreshToken: null, expiresAt: null };
  saveToken();
  res.json({ ok: true });
});

// 注文取得クエリ（OrderStatus, payment_total を追加）
const ORDERS_QUERY = `
  query ($limit: Int) {
    orders(limit: $limit) {
      edges {
        node {
          id
          order_date
          payment_total
          OrderStatus { id name }
          OrderItems {
            id
            product_name
            product_code
            price
            quantity
            tax
            tax_rate
            Product {
              id
            }
          }
        }
      }
    }
  }
`;

// 顧客付き注文取得クエリ（商品情報含む）
const ORDERS_WITH_CUSTOMER_QUERY = `
  query ($limit: Int) {
    orders(limit: $limit) {
      edges {
        node {
          id
          order_date
          payment_total
          OrderStatus { id name }
          name01
          name02
          kana01
          kana02
          email
          company_name
          Customer {
            id
            name01
            name02
            kana01
            kana02
            email
            company_name
          }
          OrderItems {
            product_name
            product_code
            price
            quantity
            tax
            Product { id }
          }
        }
      }
    }
  }
`;

// 顧客ランキングAPI
app.get('/api/customer-ranking', async (req, res) => {
  try {
    const { startYear, startMonth, endYear, endMonth } = req.query;
    if (!startYear || !startMonth || !endYear || !endMonth) {
      return res.status(400).json({ error: 'startYear, startMonth, endYear, endMonth パラメータが必要です' });
    }

    const sy = parseInt(startYear, 10), sm = parseInt(startMonth, 10);
    const ey = parseInt(endYear, 10), em = parseInt(endMonth, 10);
    const startDate = new Date(sy, sm - 1, 1);
    const endDate = new Date(ey, em, 0, 23, 59, 59);

    const data = await gql(ORDERS_WITH_CUSTOMER_QUERY, { limit: 1000 });
    const allOrders = data.orders.edges.map((e) => e.node);

    const orders = allOrders.filter((order) => {
      if (!order.order_date) return false;
      const d = new Date(order.order_date);
      if (d < startDate || d > endDate) return false;
      const statusId = parseInt(order.OrderStatus?.id, 10);
      if (EXCLUDED_STATUS_IDS.includes(statusId)) return false;
      return true;
    });

    // 顧客ごとに集計（商品情報も含む）
    const customerMap = new Map();
    for (const order of orders) {
      const cust = order.Customer;
      const key = cust?.id || order.email || `${order.name01}${order.name02}`;
      if (!key) continue;

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          id: cust?.id || null,
          name: `${(cust?.name01 || order.name01 || '')} ${(cust?.name02 || order.name02 || '')}`.trim(),
          kana: `${(cust?.kana01 || order.kana01 || '')} ${(cust?.kana02 || order.kana02 || '')}`.trim(),
          email: cust?.email || order.email || '',
          company: cust?.company_name || order.company_name || '',
          total: 0,
          orderCount: 0,
          products: new Map(),
        });
      }
      const entry = customerMap.get(key);
      entry.total += order.payment_total;
      entry.orderCount += 1;

      for (const item of (order.OrderItems || [])) {
        if (!item.Product) continue;
        const amount = Math.round(item.price * item.quantity + (item.tax ?? 0));
        const pkey = item.product_code || item.product_name;
        if (entry.products.has(pkey)) {
          const p = entry.products.get(pkey);
          p.amount += amount;
          p.quantity += item.quantity;
        } else {
          entry.products.set(pkey, {
            code: item.product_code || '',
            name: item.product_name || '',
            amount,
            quantity: item.quantity,
          });
        }
      }
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const ranking = Array.from(customerMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
      .map((c) => {
        // 金額上位の商品を取得
        const topProducts = Array.from(c.products.values())
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
          .map(({ code, name, amount, quantity }) => ({ code, name, amount, quantity }));
        const { products, ...rest } = c;
        return { ...rest, topProducts };
      });

    res.json({
      startYear: sy, startMonth: sm, endYear: ey, endMonth: em,
      totalOrders: orders.length,
      ranking,
    });
  } catch (err) {
    console.error('顧客ランキングエラー:', err.message);
    const status = err.message.includes('未認証') || err.message.includes('再認証') ? 401 : 500;
    res.status(status).json({ error: err.message });
  }
});

// 売上集計API
app.get('/api/sales', async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: 'year と month パラメータが必要です' });
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    // 注文取得
    const data = await gql(ORDERS_QUERY, { limit: 1000 });
    const allOrders = data.orders.edges.map((e) => e.node);

    // 指定月フィルタ + 注文ステータスフィルタ（キャンセル・返品除外）
    const orders = allOrders.filter((order) => {
      if (!order.order_date) return false;
      const d = new Date(order.order_date);
      if (d < startDate || d > endDate) return false;
      // 注文取消し・返品を除外
      const statusId = parseInt(order.OrderStatus?.id, 10);
      if (EXCLUDED_STATUS_IDS.includes(statusId)) return false;
      return true;
    });

    console.log(`${y}年${m}月: ${orders.length}件 / 全${allOrders.length}件`);

    // 集計: カテゴリ × 種別(本体/オプション)
    const salesMap = new Map();
    let uncategorizedTotal = 0;
    let uncategorizedCount = 0;
    let totalSales = 0;

    for (const order of orders) {
      // 注文単位の payment_total を売上合計に加算（EC-CUBE管理画面の「購入合計」と一致させる）
      totalSales += order.payment_total;

      for (const item of (order.OrderItems || [])) {
        if (!item.Product) continue; // 送料・手数料等を除外

        const { categoryKey, categoryName, type } = classifyProduct(item.product_code, item.product_name);
        // 税込金額 = 単価 × 数量 + 消費税
        const amount = Math.round(item.price * item.quantity + (item.tax ?? 0));

        if (!categoryKey) {
          uncategorizedTotal += amount;
          uncategorizedCount += item.quantity;
          continue;
        }

        const mapKey = `${categoryKey}:${type}`;
        if (salesMap.has(mapKey)) {
          const entry = salesMap.get(mapKey);
          entry.total += amount;
          entry.count += item.quantity;
        } else {
          salesMap.set(mapKey, {
            categoryKey,
            categoryName,
            type,
            total: amount,
            count: item.quantity,
          });
        }
      }
    }

    // カテゴリごとにまとめる
    const categories = CATEGORIES.map((cat) => {
      const main = salesMap.get(`${cat.key}:main`) || { total: 0, count: 0 };
      const option = salesMap.get(`${cat.key}:option`) || { total: 0, count: 0 };
      return {
        key: cat.key,
        name: cat.name,
        main: { total: main.total, count: main.count },
        option: { total: option.total, count: option.count },
        subtotal: main.total + option.total,
      };
    }).filter((c) => c.subtotal > 0)
      .sort((a, b) => b.subtotal - a.subtotal);

    res.json({
      year: y,
      month: m,
      totalSales,
      orderCount: orders.length,
      categories,
      uncategorized: { total: uncategorizedTotal, count: uncategorizedCount },
    });
  } catch (err) {
    console.error('売上取得エラー:', err.message);
    const status = err.message.includes('未認証') || err.message.includes('再認証') ? 401 : 500;
    res.status(status).json({ error: err.message });
  }
});

// SPA フォールバック: API/auth 以外のリクエストは index.html を返す
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});
