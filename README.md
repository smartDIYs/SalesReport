# smartDIYs 売上分析ダッシュボード

smartDIYs Store（EC-CUBE 4）の売上データを可視化する社内向け分析ツール。

## 機能

- **カテゴリ別売上集計** — 月別のカテゴリ（CO2レーザー、レーザーマーカー等）× 本体/オプション売上テーブル
- **売上推移チャート** — 月別の売上推移グラフ、カテゴリ別個別グラフ
- **顧客ランキング** — 期間指定の購入金額TOP N、主要購入商品表示

## 技術スタック

- **バックエンド**: Express (Node.js) — EC-CUBE GraphQL API に OAuth2 接続
- **フロントエンド**: React 18 + Vite + Recharts

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# 環境変数の設定
cp .env.example .env
# .env を編集して EC-CUBE OAuth2 クレデンシャルを設定

# 開発サーバー起動（サーバー:3001 + クライアント:5173）
npm run dev
```

## コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | サーバー + クライアント同時起動 |
| `npm run dev:server` | Express サーバーのみ起動 |
| `npm run dev:client` | Vite 開発サーバーのみ起動 |
| `npm run build` | フロントエンドのプロダクションビルド |
| `npm start` | 本番サーバー起動（dist/ を配信） |

## デプロイ

Render（Free プラン）にデプロイ済み。

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- 環境変数: `ECCUBE_BASE_URL`, `ECCUBE_AUTHORIZE_URL`, `ECCUBE_TOKEN_URL`, `ECCUBE_CLIENT_ID`, `ECCUBE_CLIENT_SECRET`, `BASE_URL`
