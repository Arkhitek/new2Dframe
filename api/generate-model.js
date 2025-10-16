// Gemini APIと通信するための道具をインポートします
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Vercelのサーバーレス関数のエントリーポイント
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt: userPrompt, mode = 'new', currentModel } = req.body;
        if (!userPrompt) {
            return res.status(400).json({ error: '指示内容が空です。' });
        }

        // ▼▼▼【変更点 1】APIキーの環境変数名を変更 ▼▼▼
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            throw new Error("Gemini APIのキーがサーバーに設定されていません。");
        }
        
        // ▼▼▼【変更点 2】Gemini APIクライアントを初期化 ▼▼▼
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // ▼▼▼【変更点 3】プロンプトを結合して単一のテキストにする ▼▼▼
        // (既存のプロンプト生成ロジックはそのまま利用します)
        const systemPrompt = createSystemPromptForBackend(mode, currentModel);
        let userMessage = userPrompt;
        if (mode === 'edit' && currentModel) {
            userMessage = createEditPrompt(userPrompt, currentModel);
        }
        // システムプロンプトとユーザープロンプトを結合
        const fullPrompt = `${systemPrompt}\n\nユーザーの指示: "${userMessage}"`;
        

        // ▼▼▼【変更点 4】Mistral API呼び出しをGemini API呼び出しに置き換え ▼▼▼
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        if (!response) {
            throw new Error("Gemini AIから予期しない形式のレスポンスがありました。");
        }
        const generatedText = response.text();

        // フロントエンドが期待するレスポンス形式に合わせる
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
        let errorMessage = 'AIモデルの生成に失敗しました。';
        if (error.message.includes('SAFETY')) {
            errorMessage = '安全性の設定により、応答がブロックされました。より一般的な表現で試してください。';
        } else if (error instanceof SyntaxError) {
             errorMessage = 'AIからの応答が不正な形式でした。少し表現を変えて再度試してください。';
        } else {
            errorMessage = error.message;
        }
        res.status(500).json({ error: errorMessage });
    }
}


// ▼▼▼ 以下、既存のプロンプト生成関数 (変更なし) ▼▼▼

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

**単純な2節点構造:**
\`\`\`json
{
  "nodes": [
    {"x": 0, "y": 0, "s": "x"},
    {"x": 8, "y": 0, "s": "x"}
  ],
  "members": [
    {"i": 1, "j": 2, "E": 205000, "I": 0.00011, "A": 0.005245, "Z": 0.000638}
  ]
}
\`\`\`

**2層2スパンラーメン構造の例:**
\`\`\`json
{
  "nodes": [
    {"x": 0, "y": 0, "s": "x"},
    {"x": 6, "y": 0, "s": "x"},
    {"x": 0, "y": 4, "s": "f"},
    {"x": 6, "y": 4, "s": "f"}
  ],
  "members": [
    {"i": 1, "j": 3, "E": 205000, "I": 0.00011, "A": 0.005245, "Z": 0.000638},
    {"i": 2, "j": 4, "E": 205000, "I": 0.00011, "A": 0.005245, "Z": 0.000638},
    {"i": 3, "j": 4, "E": 205000, "I": 0.00011, "A": 0.005245, "Z": 0.000638}
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
  - **重要**: 部材は配列の順序で識別されます。1番目の部材、2番目の部材として扱われます。
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
- **節点番号と部材参照の重要ルール:**
  - 節点は配列の順序（1から始まる）で決まります
  - 部材の\`i\`と\`j\`は必ず存在する節点番号を参照してください
  - 例: 節点配列に3つの節点がある場合、部材は節点1、2、3のみを参照できます
  - 複数層の構造では、下層から上層へ順序良く節点を配置してください
  - ラーメン構造では、柱と梁の接続点が正確に一致するように節点番号を設定してください
  - **複数層ラーメン構造の生成ルール:**
    - 各層の柱は垂直に並べ、同じX座標に配置してください
    - 梁は各層の柱間を水平に接続してください
    - 節点番号は下層から上層へ、左から右へ順序良く付けてください
    - 例: 2層2スパンの場合、1層左柱=1、1層右柱=2、2層左柱=3、2層右柱=4
- **柱脚の境界条件に関する重要なルール:**
  - Y座標が0の節点（地面に接する節点）は柱脚として扱います。
  - ユーザーの指示で「柱脚は固定」「基礎は固定」「支点は固定」などの記述がある場合、Y座標=0の節点の境界条件を "x" (固定) に設定してください。
  - 「柱脚はピン」「基礎はピン」「支点はピン」などの記述がある場合、Y座標=0の節点の境界条件を "p" (ピン) に設定してください。
  - 「柱脚はローラー」「基礎はローラー」「支点はローラー」などの記述がある場合、Y座標=0の節点の境界条件を "r" (ローラー) に設定してください。
  - 柱脚に関する明示的な指示がない場合でも、一般的な構造では柱脚は固定とするのが合理的です。特に「門型ラーメン」「フレーム」「ラーメン構造」などの記述がある場合は、Y座標=0の節点を "x" (固定) に設定してください。
- ユーザーの指示に曖昧な点がある場合は、最も一般的で合理的な構造を仮定してモデルを作成してください。
- **構造生成時の注意事項:**
  - 節点番号は配列の順序（1から始まる）で決まります
  - 部材の\`i\`と\`j\`は必ず存在する節点番号を参照してください
  - ラーメン構造では、柱と梁の接続が正確になるよう節点配置を確認してください
  - 複数層構造では、各層の高さを適切に設定してください（例: 1層=4m、2層=8m）
  - スパン長は一般的な値を設定してください（例: 6m、8m、10m）
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
- **節点の座標変更の場合**:
  - 「スパンを○mに変更」「梁の長さを○mに変更」などの指示では、既存の節点の座標を変更してください
  - 既存の節点の座標（x, y）を新しい座標に変更することで、構造の形状を修正できます
  - 既存の節点を修正する場合は、同じ配列位置で節点データを出力してください
  - 例: 1番目の節点の座標を変更する場合、nodes配列の1番目として新しい座標を持つデータを出力してください
- **部材の長さ変更や位置変更の場合**:
  - 「スパンを○mに変更」「梁の長さを○mに変更」などの指示では、既存の部材の節点番号を変更して長さを調整してください
  - 既存の部材の節点番号（i, j）を新しい座標の節点に変更することで、部材の長さや位置を修正できます
  - 必要に応じて新しい節点を追加し、既存部材の接続先を変更してください
  - **重要**: 既存の部材を修正する場合は、同じ配列位置で部材データを出力してください
  - 例: 既存の1番目の部材が節点1→2で、これを節点1→3に変更する場合、members配列の1番目として節点1→3のデータを出力してください
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
        
        editPrompt += `節点修正時の注意事項:\n`;
        editPrompt += `- 既存の節点を修正する場合は、同じ配列位置（1番目、2番目など）で出力してください\n`;
        editPrompt += `- 座標（x, y）を変更することで節点の位置を修正できます\n`;
        editPrompt += `- 例: 1番目の節点の座標を変更する場合、nodes配列の1番目として新しい座標を持つデータを出力してください\n`;
        editPrompt += `- 既存の節点を削除する場合は、その節点を出力しないでください\n`;
        editPrompt += `\n`;
    }
    
    if (currentModel && currentModel.members && currentModel.members.length > 0) {
        editPrompt += `現在の部材情報:\n`;
        currentModel.members.forEach((member, index) => {
            const length = member.length ? ` (長さ: ${member.length.toFixed(2)}m)` : '';
            const section = member.sectionName ? ` (断面: ${member.sectionName})` : '';
            editPrompt += `部材${index + 1}: 節点${member.i} → 節点${member.j}${length}${section}\n`;
        });
        editPrompt += `\n`;
        
        editPrompt += `部材修正時の注意事項:\n`;
        editPrompt += `- 既存の部材を修正する場合は、同じ配列位置（1番目、2番目など）で出力してください\n`;
        editPrompt += `- 節点番号（i, j）を変更することで部材の長さや位置を修正できます\n`;
        editPrompt += `- 例: 1番目の部材の長さを変更する場合、members配列の1番目として新しい節点番号を持つデータを出力してください\n`;
        editPrompt += `- 既存の部材を削除する場合は、その部材を出力しないでください\n`;
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