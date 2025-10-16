// 必要なライブラリを読み込む
const express = require('express');
const path = require('path');
const apiRouter = require('./api/generate-model'); // APIロジックをインポート

// Expressアプリケーションを作成
const app = express();
const PORT = process.env.PORT || 3000;

// JSONリクエストを解析するための設定
app.use(express.json());

// 静的ファイル（HTML, CSS, JS）を配信する設定
// publicフォルダやdistフォルダがあればそちらを指定しますが、今回はルートを直接指定します。
app.use(express.static(path.join(__dirname, '')));

// APIエンドポイント "/api/generate-model" を設定
app.use('/api/generate-model', apiRouter);

// ルートURL ("/") にアクセスがあった場合にindex.htmlを返す
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// サーバーを起動
app.listen(PORT, () => {
    console.log(`サーバーが起動しました。 http://localhost:${PORT} でアクセスできます。`);
});