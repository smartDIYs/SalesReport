# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 言語

すべてのコミュニケーション、コメント、UIテキストは日本語で行う。

## 開発コマンド

```bash
npm run dev            # サーバー(3001) + クライアント(5173) 同時起動
npm run dev:server     # Express サーバーのみ (node --watch server.js)
npm run dev:client     # Vite 開発サーバーのみ
npm run build          # フロントエンドのプロダクションビルド (dist/)
npm start              # 本番サーバー起動（dist/ を配信）
```

CSV検証スクリプト（EC-CUBE管理画面の売上レポートCSVと比較）:
```bash
node verify.js <CSVファイル> <年> <月>
```

## アーキテクチャ

smartDIYs Store（EC-CUBE 4）の売上分析ダッシュボード。Express バックエンドが EC-CUBE GraphQL API に OAuth2 で接続し、React フロントエンドに集計データを提供する。

### バックエンド (server.js)

- ベーシック認証（`BASIC_AUTH_USER` / `BASIC_AUTH_PASS` 環境変数で制御、未設定時は無効）
- EC-CUBE OAuth2 認証フロー（認可コード + リフレッシュトークン）
- トークンは `.token.json` にファイル永続化
- GraphQL でオーダー・商品を取得し、サーバー側で集計
- 注文ステータス 3（取消し）・9（返品）を除外
- 本番環境では `dist/` の静的ファイルを配信し、SPA フォールバックで全ルートを処理

**API エンドポイント:**
- `/auth/login`, `/auth/callback` — OAuth2 フロー
- `/api/auth/status`, `/api/auth/logout` — 認証状態管理
- `/api/sales?year=&month=` — 月別カテゴリ売上集計
- `/api/customer-ranking?startYear=&startMonth=&endYear=&endMonth=&limit=` — 顧客購入ランキング

### フロントエンド (src/)

React 18 + Vite。3ページ構成（display切替でマウント維持）:
- **概要** — 期間指定のカテゴリ別売上テーブル (`CategorySalesTable`)
- **売上推移** — 月別チャート、カテゴリ別個別グラフ (`CategoryTrends`, Recharts)
- **顧客ランキング** — 購入金額TOP N、主要購入商品表示 (`CustomerRanking`)

Vite の proxy で `/api` と `/auth` をバックエンド (localhost:3001) に転送。

### 商品分類ロジック (server.js の classifyProduct)

商品コードの先頭2文字でカテゴリを判定し、3文字目で本体/オプションを区分する。`verify.js` にも同一ロジックがあり、変更時は両方を同期すること。

6カテゴリ:
- CO2レーザー加工機 (EP, HL, LC, FC)
- レーザーマーカー (MC, MF, MM, MU, MP, LM, MR)
- レーザー溶接機 (SL, SW)
- 金属切断機 (PL, FL)
- レーザークリーナー (SC)
- 保護具・安全対策 (AE + キーワードマッチ)

特殊ルール:
- 販売終了品（EL, ES, FM, EA）は除外。ただし ELB01-09 は CO2 レーザーのオプションとして残す
- MCN, CFD, LC13, SCB01, SCO も販売終了品
- 安全関連キーワード（保護メガネ、パーテーション等）は商品名で判定
- 延長保証は本体扱い

## 環境設定

`.env.example` を `.env` にコピーして EC-CUBE OAuth2 クレデンシャルを設定。

主な環境変数:
- `ECCUBE_BASE_URL` — EC-CUBE サイトURL
- `ECCUBE_AUTHORIZE_URL` — OAuth2 認可エンドポイント
- `ECCUBE_TOKEN_URL` — OAuth2 トークンエンドポイント
- `ECCUBE_CLIENT_ID` / `ECCUBE_CLIENT_SECRET` — OAuth2 クライアント認証情報
- `BASE_URL` — 本番環境のアプリURL（OAuth2 コールバック・リダイレクト先に使用）
- `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` — ベーシック認証（設定時のみ有効）
- `PORT` — サーバーポート（デフォルト: 3001）

## デプロイ

Render（Free プラン）にデプロイ。GitHub 連携で main ブランチへのプッシュ時に自動デプロイ。

- **URL**: https://salesreport-xcr2.onrender.com
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- EC-CUBE 側で本番用の OAuth2 クライアント（リダイレクトURI: `https://salesreport-xcr2.onrender.com/auth/callback`）を別途登録する必要がある
