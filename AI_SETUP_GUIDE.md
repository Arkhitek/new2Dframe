# AIモデル生成機能セットアップガイド

## 概要
このガイドでは、2D構造解析システムにAIモデル生成機能を追加するための手順を説明します。

## 必要な準備

### 1. Mistral AI APIキーの取得
1. [Mistral AI Platform](https://console.mistral.ai/) にアクセス
2. Mistral AIアカウントでログイン
3. 「API Keys」セクションに移動
4. 「Create new secret key」をクリック
5. 新しいAPIキーを作成
6. 生成されたAPIキーをコピー（後で使用します）

### 2. Netlifyアカウントの準備
1. [Netlify](https://netlify.com/) でアカウントを作成
2. プロジェクトをNetlifyにデプロイ

## セットアップ手順

### ステップ1: ローカル開発環境の準備

#### 1.1 Netlify CLIのインストール
```bash
npm install -g netlify-cli
```

#### 1.2 依存関係のインストール
```bash
npm install
```

#### 1.3 環境変数の設定
ローカル開発用に環境変数を設定します：

**Windows (PowerShell):**
```powershell
$env:MISTRAL_API_KEY="FjuAEorphVEPBIjqJVLagjfqlFYyRzFC"
```

**Windows (Command Prompt):**
```cmd
set MISTRAL_API_KEY=FjuAEorphVEPBIjqJVLagjfqlFYyRzFC
```

**macOS/Linux:**
```bash
export MISTRAL_API_KEY="FjuAEorphVEPBIjqJVLagjfqlFYyRzFC"
```

### ステップ2: ローカルサーバーの起動

```bash
netlify dev
```

これにより、ローカルサーバーが起動し、AI機能を含む全ての機能がテストできます。

### ステップ3: テストの実行

1. ブラウザで `http://localhost:8888/test-ai.html` にアクセス
2. 「API接続テスト」ボタンをクリック
3. 接続が成功したら、「基本テスト」を実行
4. 問題がなければ、メインアプリケーション `http://localhost:8888/index.html` でAI機能をテスト

### ステップ4: Netlifyへのデプロイ

#### 4.1 Netlifyにログイン
```bash
netlify login
```

#### 4.2 サイトの作成とデプロイ
```bash
netlify init
netlify deploy --prod
```

#### 4.3 環境変数の設定（Netlify管理画面）
1. Netlify管理画面でサイトを選択
2. 「Site settings」→「Environment variables」をクリック
3. 「Add variable」をクリック
4. 以下の設定を追加：
   - **Key**: `MISTRAL_API_KEY`
   - **Value**: 取得したMistral AI APIキー
5. 「Save」をクリック

## 使用方法

### メインアプリケーションでの使用
1. `index.html` を開く
2. 「🤖 AIによるモデル生成 (Mistral AI)」セクションを見つける
3. テキストエリアに構造モデルの説明を入力
   - 例: "高さ5m、スパン10mの門型ラーメン。柱脚は固定。"
4. 「AIで生成」ボタンをクリック
5. AIがモデルを生成し、自動的にアプリケーションに適用されます

### サポートされる指示例
- "高さ3m、スパン6mの門型ラーメン"
- "2層2スパンのラーメン構造"
- "片持梁、長さ4m、先端に集中荷重10kN"
- "単純梁、スパン8m、等分布荷重5kN/m"

## トラブルシューティング

### よくある問題

#### 1. "APIキーがサーバーに設定されていません"
- **原因**: Mistral AI APIキーが正しく設定されていない
- **解決策**: 上記の環境変数設定手順を確認

#### 2. "APIからのレスポンス形式が不正です"
- **原因**: Mistral AI APIからの応答が期待される形式と異なる
- **解決策**: APIキーが有効か確認、または指示内容を簡潔にする

#### 3. "ネットワークエラー"
- **原因**: サーバーレス関数への接続に失敗
- **解決策**: `netlify dev`が正しく起動しているか確認

#### 4. "CORS エラー"
- **原因**: ブラウザのセキュリティポリシー
- **解決策**: Netlifyのリダイレクト設定が正しく機能しているか確認

### デバッグ方法

#### 1. ブラウザの開発者ツールを使用
- F12キーを押して開発者ツールを開く
- 「Console」タブでエラーメッセージを確認
- 「Network」タブでAPIリクエストの状況を確認

#### 2. Netlify CLIのログを確認
```bash
netlify dev --debug
```

#### 3. サーバーレス関数のログを確認
Netlify管理画面の「Functions」タブでログを確認できます。

## セキュリティ注意事項

1. **APIキーの保護**: APIキーは絶対にブラウザのコードに含めないでください
2. **環境変数の使用**: 本番環境では必ず環境変数を使用してください
3. **HTTPSの使用**: 本番環境では必ずHTTPSを使用してください

## サポート

問題が発生した場合は、以下を確認してください：

1. Mistral AI APIキーが有効であること
2. Netlifyの環境変数が正しく設定されていること
3. `netlify.toml`ファイルが正しく配置されていること
4. サーバーレス関数が正しくデプロイされていること

## ファイル構成

```
プロジェクトルート/
├── index.html              # メインアプリケーション
├── frame_analyzer.js       # メインのJavaScriptファイル
├── style.css              # スタイルシート
├── test-ai.html           # AI機能テスト用ページ
├── package.json           # 依存関係管理
├── netlify.toml           # Netlify設定ファイル
└── netlify/
    └── functions/
        └── generate-model.js  # サーバーレス関数
```

## 更新履歴

- 2024-01-XX: Mistral AI API連携
  - Mistral AI APIへの移行
  - より効率的なプロンプト生成
  - クォータ制限対応

- 2024-01-XX: 初回リリース
  - AIモデル生成機能の追加
  - OpenAI API連携
  - Netlify Functions実装
