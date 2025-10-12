// 外部と通信するための道具をインポートします
const fetch = require('node-fetch');

// Vercelのサーバーレス関数のエントリーポイント
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        const { prompt: userPrompt, mode = 'new', currentModel } = req.body;
        if (!userPrompt) {
            res.status(400).json({ error: '指示内容が空です。' });
            return;
        }

        const API_KEY = process.env.MISTRAL_API_KEY;
        if (!API_KEY) {
            throw new Error("Mistral AIのAPIキーがサーバーに設定されていません。");
        }
        
        const API_URL = 'https://api.mistral.ai/v1/chat/completions';
        
        const systemPrompt = createSystemPromptForBackend(mode, currentModel);
        
        // 追加編集モードの場合は現在のモデル情報を含めてプロンプトを作成
        let userMessage = userPrompt;
        if (mode === 'edit' && currentModel) {
            userMessage = createEditPrompt(userPrompt, currentModel);
        }

        const requestBody = {
            model: "mistral-large-latest",
            messages: [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": userMessage }
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

function createSystemPromptForBackend(mode = 'new', currentModel = null) {
    let prompt = `
あなたは2Dフレーム構造解析モデルを生成する専門のアシスタントです。`;

    if (mode === 'edit') {
        prompt += `
現在のモデル情報を基に、ユーザーの編集指示に従ってモデルを更新してください。
既存の構造を保持しつつ、指示された変更のみを適用してください。`;
    } else {
        prompt += `
ユーザーからの自然言語による指示に基づいて、新しい構造モデルを作成してください。`;
    }

    prompt += `
以下のJSON形式で構造モデルデータを出力してください。
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
- **柱脚の境界条件に関する重要なルール:**
  - Y座標が0の節点（地面に接する節点）は柱脚として扱います。
  - ユーザーの指示で「柱脚は固定」「基礎は固定」「支点は固定」などの記述がある場合、Y座標=0の節点の境界条件を "x" (固定) に設定してください。
  - 「柱脚はピン」「基礎はピン」「支点はピン」などの記述がある場合、Y座標=0の節点の境界条件を "p" (ピン) に設定してください。
  - 「柱脚はローラー」「基礎はローラー」「支点はローラー」などの記述がある場合、Y座標=0の節点の境界条件を "r" (ローラー) に設定してください。
  - 柱脚に関する明示的な指示がない場合でも、一般的な構造では柱脚は固定とするのが合理的です。特に「門型ラーメン」「フレーム」「ラーメン構造」などの記述がある場合は、Y座標=0の節点を "x" (固定) に設定してください。
- ユーザーの指示に曖昧な点がある場合は、最も一般的で合理的な構造を仮定してモデルを作成してください。
`;

    if (mode === 'edit' && currentModel) {
        prompt += `

**現在のモデル情報:**
節点数: ${currentModel.nodes ? currentModel.nodes.length : 0}
部材数: ${currentModel.members ? currentModel.members.length : 0}
節点荷重数: ${currentModel.nodeLoads ? currentModel.nodeLoads.length : 0}
部材荷重数: ${currentModel.memberLoads ? currentModel.memberLoads.length : 0}

編集時は以下の点に注意してください:
- 既存の節点番号と部材番号の連続性を保持してください
- 既存の構造の基本形状は維持し、指示された変更のみを適用してください
- 新しく追加する節点や部材は、既存の番号の続きから開始してください
- 削除する場合は、後続の番号を詰める必要はありません
`;
    }

    return prompt;
}

function createEditPrompt(userPrompt, currentModel) {
    let editPrompt = `編集指示: ${userPrompt}\n\n`;
    
    if (currentModel && currentModel.nodes && currentModel.nodes.length > 0) {
        editPrompt += `現在の節点情報:\n`;
        currentModel.nodes.forEach((node, index) => {
            const supportText = {
                'free': '自由',
                'pinned': 'ピン', 
                'fixed': '固定',
                'roller': 'ローラー'
            }[node.s] || node.s;
            editPrompt += `節点${index + 1}: (${node.x}, ${node.y}) - ${supportText}\n`;
        });
        editPrompt += `\n`;
    }
    
    if (currentModel && currentModel.members && currentModel.members.length > 0) {
        editPrompt += `現在の部材情報:\n`;
        currentModel.members.forEach((member, index) => {
            editPrompt += `部材${index + 1}: 節点${member.n1} → 節点${member.n2} (${member.s})\n`;
        });
        editPrompt += `\n`;
    }
    
    if (currentModel && currentModel.nodeLoads && currentModel.nodeLoads.length > 0) {
        editPrompt += `現在の節点荷重:\n`;
        currentModel.nodeLoads.forEach((load, index) => {
            editPrompt += `節点${load.n}: Fx=${load.fx}, Fy=${load.fy}, Mz=${load.mz}\n`;
        });
        editPrompt += `\n`;
    }
    
    if (currentModel && currentModel.memberLoads && currentModel.memberLoads.length > 0) {
        editPrompt += `現在の部材荷重:\n`;
        currentModel.memberLoads.forEach((load, index) => {
            editPrompt += `部材${load.m}: ${load.type} ${load.magnitude} (位置:${load.position})\n`;
        });
        editPrompt += `\n`;
    }
    
    editPrompt += `上記の現在のモデルに対して、指示された編集を適用してください。`;
    
    return editPrompt;
}