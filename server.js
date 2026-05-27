const express = require('express');
const net = require('net');
const path = require('path');
const app = express();
const PORT = 3000;

// チェックしたいプロキシのリスト
const proxies = [
    { name: "テスト用プロキシ1 (正常)", host: "1.1.1.1", port: 80 }, // 例としてCloudflare
    { name: "テスト用プロキシ2 (死んでる)", host: "127.0.0.1", port: 9999 },
    { name: "テスト用プロキシ3 (正常)", host: "8.8.8.8", port: 53 } // 例としてGoogle DNS
];

// 静的ファイル（HTMLなど）を公開する設定
app.use(express.static(path.join(__dirname)));

// プロキシの生存確認（Ping）を行うAPI
app.get('/api/ping', async (req, res) => {
    const results = [];

    for (let proxy of proxies) {
        const startTime = Date.now();
        
        const isAlive = await new Promise((resolve) => {
            // Socket（TCP通信）を使ってポートが開いているか直接チェック
            const socket = new net.Socket();
            socket.setTimeout(1500); // 1.5秒でタイムアウト

            socket.connect(proxy.port, proxy.host, () => {
                socket.end();
                resolve(true); // 接続成功
            });

            socket.on('error', () => {
                socket.destroy();
                resolve(false); // 接続失敗（死んでいる）
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve(false); // タイムアウト
            });
        });

        const duration = Date.now() - startTime;

        results.push({
            name: proxy.name,
            host: proxy.host,
            port: proxy.port,
            online: isAlive,
            ping: isAlive ? duration : null
        });
    }

    res.json(results);
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
