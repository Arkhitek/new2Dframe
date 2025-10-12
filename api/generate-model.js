// 外部と通信するための道具をインポートします
const fetch = require('node-fetch');

// Vercelのサーバーレス関数のエントリーポイント
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        const { prompt: userPrompt } = req.body;
        if (!userPrompt) {
            res.status(400).json({ error: '指示内容が空です。' });
            return;
        }

        const API_KEY = process.env.MISTRAL_API_KEY;
        if (!API_KEY) {
            throw new Error("Mistral AIのAPIキーがサーバーに設定されていません。");
        }
        
        const API_URL = 'https://api.mistral.ai/v1/chat/completions';
        
        const systemPrompt = createSystemPromptForBackend();

        const requestBody = {
            model: "mistral-large-latest",
            messages: [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": userPrompt }
            ],
            response_format: { "type": "json_object" }
        };

        const mistralResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(requestBody),
        });

        const data = await mistralResponse.json();

        if (!mistralResponse.ok) {
            console.error('Mistral AI Error:', data);
            throw new Error(data.message || 'Mistral AIでエラーが発生しました。');
        }

        if (!data.choices || !data.choices[0] || !data.choices[0].message.content) {
             throw new Error("Mistral AIから予期しない形式のレスポンスがありました。");
        }
        const generatedText = data.choices[0].message.content;

        const responseForFrontend = {
            candidates: [{
                content: {
                    parts: [{
                        text: generatedText
                    }]
                }
            }]
        };

        res.status(200).json(responseForFrontend);

    } catch (error) {
        console.error('サーバーレス関数エラー:', error);
        res.status(500).json({ error: error.message });
    }
}

function createSystemPromptForBackend() {
    return `
あなたは2Dフレーム構造解析モデルを生成する専門のアシスタントです。
ユーザーからの自然言語による指示に基づいて、以下のJSON形式で構造モデルデータを出力してください。
JSONデータのみを出力し、前後の説明やマークダウンの\`\`\`json ... \`\`\`は含めないでください。

**JSONデータ構造の例:**
\`\`\`json
{
  "nodes": [
    {"x": 0, "y": 0, "s": "p"},
    {"x": 8, "y": 0, "s": "r"}
  ],
  "members": [
    {"i": 1, "j": 2, "E": 205000, "I": 0.00011, "A": 0.005245, "Z": 0.000638}
  ],
  "nl": [
    {"n": 1, "px": 10, "py": -20, "mz": 5}
  ],
  "ml": [
    {"m": 1, "w": 10}
  ]
}
\`\`\`

**各キーの詳細説明:**
- **nodes**: 節点の配列
  - \`x\`: X座標 (単位: m)
  - \`y\`: Y座標 (単位: m)
  - \`s\`: 境界条件。文字列で "f" (自由), "p" (ピン), "r" (ローラー), "x" (固定) のいずれか。
- **members**: 部材の配列
  - \`i\`, \`j\`: 始点と終点の節点番号 (1から始まる整数)。
  - \`E\`: ヤング係数 (単位: N/mm²)。指定がなければ鋼材の \`205000\` を使用。
  - \`A\`: 断面積 (単位: m²)。
  - \`I\`: 断面二次モーメント (単位: m⁴)。
  - \`Z\`: 断面係数 (単位: m³)。
  - \`i_conn\`, \`j_conn\`: 接合条件。"rigid" (剛接合) または "pinned" (ピン接合)。指定がなければ "rigid" とする。
- **nl**: 節点荷重の配列 (オプション)
  - \`n\`: 荷重がかかる節点番号 (1から始まる整数)。
  - \`px\`: X方向荷重 (単位: kN)。右向きが正。
  - \`py\`: Y方向荷重 (単位: kN)。上向きが正。
  - \`mz\`: モーメント荷重 (単位: kN・m)。反時計回りが正。
- **ml**: 部材荷重の配列 (オプション)
  - \`m\`: 荷重がかかる部材番号 (1から始まる整数)。
  - \`w\`: 部材座標系y軸方向の等分布荷重 (単位: kN/m)。部材の上から下向きにかかる場合は正の値。

**重要なルール:**
- 座標系は、右方向がX軸の正、上方向がY軸の正です。
- 荷重の向きに注意してください。「下向き」の鉛直荷重は \`py\` が負の値になります。
- 部材の断面性能値 (\`A\`, \`I\`, \`Z\`) が不明な場合は、一般的な鋼材断面（例：H-300x150x6.5x9）の値を仮定して設定してください (A=0.004678, I=0.0000721, Z=0.000481)。
- 節点番号と部材番号は1から始まる連番です。
- 存在しない節点番号や部材番号を参照しないでください。
- ユーザーの指示に曖昧な点がある場合は、最も一般的で合理的な構造を仮定してモデルを作成してください。
`;
}