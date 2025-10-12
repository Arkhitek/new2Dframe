// 木材基準強度データ (N/mm²)
const WOOD_BASE_STRENGTH_DATA = {
    "Matsu_Group": { name: "あかまつ、くろまつ、べいまつ", fc: 22.2, ft: 17.7, fb: 28.2, fs: 2.4 },
    "Hinoki_Group": { name: "からまつ、ひば、ひのき、べいひ", fc: 20.7, ft: 16.2, fb: 26.7, fs: 2.1 },
    "Tsuga_Group": { name: "つが、べいつが", fc: 19.2, ft: 14.7, fb: 25.2, fs: 2.1 },
    "Sugi_Group": { name: "もみ、えぞまつ、すぎ、べいすぎ等", fc: 17.7, ft: 13.5, fb: 22.2, fs: 1.8 },
    "Kashi": { name: "かし", fc: 20.7, ft: 16.2, fb: 26.7, fs: 4.2 },
    "Keyaki_Group": { name: "くり、なら、ぶな、けやき", fc: 19.2, ft: 14.7, fb: 25.2, fs: 3.0 }
};

// 材料密度データ (kg/m³)
const MATERIAL_DENSITY_DATA = {
    // 金属材料
    "205000": 7850,    // スチール
    "193000": 7900,    // ステンレス
    "70000": 2700,     // アルミニウム
    
    // 木材
    "7000": 400,       // 軟材（杉、もみ等）
    "8000": 500,       // 中硬材（松類、つが等）
    "9000": 550,       // やや硬材（カラマツ、檜等）
    "10000": 800,      // 硬材（樫）
    
    // デフォルト値
    "custom": 7850     // 任意入力時のデフォルト（スチール相当）
};

// 設定オブジェクト
const CONFIG = {
    validation: {
        minPositiveValue: 0.001,
        maxDimension: 10000,
        maxMemberCount: 1000,
        maxNodeCount: 1000
    },
    ui: {
        animationDuration: 200,
        errorDisplayTime: 3000,
        canvasResolutionScale: 2.0,
        panZoomDefaults: { scale: 1, offsetX: 0, offsetY: 0, isInitialized: false }
    },
    materials: {
        steelElasticModulus: 2.05e5,
        steelShearModulus: 7.7e4,
        defaultSteelStrength: 235
    }
};

// 単位変換定数
const UNIT_CONVERSION = {
    // 断面性能の単位変換係数（cm → mm）
    CM4_TO_MM4: 1e4,    // 断面二次モーメント（cm⁴ → mm⁴）
    CM3_TO_MM3: 1e3,    // 断面係数（cm³ → mm³）
    CM2_TO_MM2: 1e2,    // 断面積（cm² → mm²）
    
    // 材料特性の基準値（N/mm²）
    E_STEEL: CONFIG.materials.steelElasticModulus,
    G_STEEL: CONFIG.materials.steelShearModulus,
};

// ユーティリティ関数
const utils = {
    /**
     * 数値を指定した小数点以下桁数でフォーマット
     * @param {number} num - フォーマットする数値
     * @param {number} decimals - 小数点以下桁数
     * @returns {string} フォーマットされた文字列
     */
    formatNumber: (num, decimals = 2) => {
        if (typeof num !== 'number' || isNaN(num)) return '0';
        return Number(num.toFixed(decimals)).toLocaleString();
    },

    /**
     * ユーザーフレンドリーなメッセージ表示
     * @param {string} message - 表示するメッセージ
     * @param {string} type - メッセージタイプ ('info', 'warning', 'error', 'success')
     * @param {number} duration - 表示時間（ミリ秒）
     */
    showMessage: (message, type = 'info', duration = CONFIG.ui.errorDisplayTime) => {
        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            max-width: 400px;
            word-wrap: break-word;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        const colors = {
            info: '#007bff',
            warning: '#ffc107', 
            error: '#dc3545',
            success: '#28a745'
        };
        
        messageElement.style.backgroundColor = colors[type] || colors.info;
        messageElement.textContent = message;
        document.body.appendChild(messageElement);
        
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, duration);
    },

    /**
     * 包括的エラーハンドリング
     * @param {Function} operation - 実行する処理
     * @param {object} context - エラー発生時のコンテキスト情報
     * @param {string} userMessage - ユーザー向けエラーメッセージ
     */
    executeWithErrorHandling: (operation, context = {}, userMessage = 'エラーが発生しました') => {
        try {
            const result = operation();
            if (result && typeof result.then === 'function') {
                return result.catch(error => {
                    utils.logError(error, context);
                    utils.showMessage(`${userMessage}: ${error.message}`, 'error');
                    throw error;
                });
            }
            return result;
        } catch (error) {
            utils.logError(error, context);
            utils.showMessage(`${userMessage}: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * 詳細なエラーログ出力
     * @param {Error} error - エラーオブジェクト
     * @param {object} context - コンテキスト情報
     */
    logError: (error, context = {}) => {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            context
        };
        console.error('詳細エラー情報:', errorInfo);
    },

    /**
     * 入力値の検証
     * @param {any} value - 検証する値
     * @param {object} rules - 検証ルール
     * @returns {object} 検証結果 { isValid: boolean, error: string }
     */
    validateInput: (value, rules = {}) => {
        const result = { isValid: true, error: '' };
        
        if (rules.required && (value === null || value === undefined || value === '')) {
            return { isValid: false, error: '必須項目です' };
        }
        
        if (rules.type === 'number') {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                return { isValid: false, error: '数値を入力してください' };
            }
            
            if (rules.min !== undefined && numValue < rules.min) {
                return { isValid: false, error: `${rules.min}以上の値を入力してください` };
            }
            
            if (rules.max !== undefined && numValue > rules.max) {
                return { isValid: false, error: `${rules.max}以下の値を入力してください` };
            }
        }
        
        return result;
    },

    /**
     * メモリリークを防ぐクリーンアップユーティリティ
     * @param {Array} cleanupCallbacks - クリーンアップコールバック関数の配列
     */
    cleanup: (cleanupCallbacks = []) => {
        cleanupCallbacks.forEach(callback => {
            try {
                if (typeof callback === 'function') {
                    callback();
                }
            } catch (error) {
                console.warn('クリーンアップエラー:', error);
            }
        });
    }
};

// 自重計算関数
const calculateSelfWeight = {
    /**
     * 部材の自重を計算する
     * @param {number} density - 密度 (kg/m³)
     * @param {number} area - 断面積 (cm²)
     * @param {number} length - 部材長さ (m)
     * @returns {number} 自重による分布荷重 (kN/m)
     */
    getMemberSelfWeight: (density, area, length) => {
        if (!density || !area || !length || density <= 0 || area <= 0 || length <= 0) {
            return 0;
        }
        
        // 単位変換を考慮した計算
        // 密度: kg/m³, 断面積: cm² -> m², 重力加速度: 9.807 m/s²
        // 結果: kN/m
        const areaInM2 = area * 1e-4; // cm² → m²
        const weightPerMeter = density * areaInM2 * 9.807 / 1000; // N/m → kN/m
        
        return weightPerMeter;
    },
    
    /**
     * 全部材の自重荷重を計算し、節点荷重として分散
     * @param {Array} nodes - 節点配列
     * @param {Array} members - 部材配列
     * @param {HTMLElement} considerSelfWeightCheckbox - 自重考慮チェックボックス要素
     * @param {HTMLElement} membersTableBody - 部材テーブルのtbody要素
     * @returns {Object} {memberSelfWeights: 表示用部材自重配列, nodeSelfWeights: 解析用節点自重配列}
     */
    calculateAllSelfWeights: (nodes, members, considerSelfWeightCheckbox, membersTableBody) => {
        const memberSelfWeights = []; // 表示用
        const nodeSelfWeights = [];   // 解析用節点荷重
        
        if (!considerSelfWeightCheckbox || !considerSelfWeightCheckbox.checked) {
            return { memberSelfWeights, nodeSelfWeights };
        }
        
        // 節点ごとの自重荷重を集計するマップ
        const nodeWeightMap = new Map();
        
        members.forEach((member, index) => {
            // 部材長さを計算
            const node1 = nodes[member.i];
            const node2 = nodes[member.j];
            const dx = node2.x - node1.x;
            const dy = node2.y - node1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            // 部材行から密度を取得
            const memberRow = membersTableBody.rows[index];
            if (!memberRow) return;
            
            const densityCell = memberRow.querySelector('.density-cell');
            if (!densityCell) return;
            
            const densityInput = densityCell.querySelector('input');
            const density = densityInput ? parseFloat(densityInput.value) : 0;
            
            // 断面積を取得 (cm²)
            const areaInput = memberRow.cells[6].querySelector('input');
            const area = areaInput ? parseFloat(areaInput.value) : 0;
            
            // 部材全体の自重を計算 (kN)
            if (density > 0 && area > 0 && length > 0) {
                const areaInM2 = area * 1e-4; // cm² → m²
                const totalWeight = density * areaInM2 * length * 9.807 / 1000; // kN
                const weightPerMeter = totalWeight / length; // kN/m (表示用)
                
                // デバッグ用：計算詳細をログ出力（最初の1回のみ）
                if (!window.selfWeightCalcLogCount) window.selfWeightCalcLogCount = 0;
                if (window.selfWeightCalcLogCount === 0) {
                    console.log(`部材${index + 1}自重計算詳細:`);
                    console.log(`  密度: ${density} kg/m³`);
                    console.log(`  断面積: ${area} cm² (${areaInM2.toFixed(6)} m²)`);
                    console.log(`  部材長: ${length.toFixed(3)} m`);
                    console.log(`  総重量: ${totalWeight.toFixed(4)} kN`);
                    console.log(`  単位重量: ${weightPerMeter.toFixed(4)} kN/m`);
                    window.selfWeightCalcLogCount = 1;
                }
                
                // 部材の角度を計算（ラジアン）
                const angle = Math.atan2(dy, dx);
                const angleDegrees = Math.abs(angle * 180 / Math.PI);
                
                // 角度の許容範囲（度）
                const HORIZONTAL_TOLERANCE = 5; // ±5度
                const VERTICAL_TOLERANCE = 5; // ±5度
                
                // 部材の種類を判定
                let memberType;
                if (angleDegrees <= HORIZONTAL_TOLERANCE || angleDegrees >= (180 - HORIZONTAL_TOLERANCE)) {
                    memberType = 'horizontal';
                } else if (Math.abs(angleDegrees - 90) <= VERTICAL_TOLERANCE) {
                    memberType = 'vertical';
                } else {
                    memberType = 'inclined';
                }
                
                // デバッグログ（最初の5回のみ）
                if (!window.memberTypeLogCount) window.memberTypeLogCount = 0;
                if (window.memberTypeLogCount < 5) {
                    console.log(`部材${index + 1}: 角度=${angleDegrees.toFixed(1)}°, タイプ=${memberType}, 総重量=${totalWeight.toFixed(2)}kN, 長さ=${length.toFixed(2)}m`);
                    window.memberTypeLogCount++;
                }
                
                if (memberType === 'horizontal') {
                    // 水平部材：等分布荷重として作用
                    const selfWeightValue = weightPerMeter; // システムの符号規約に合わせて正の値で下向き
                    memberSelfWeights.push({
                        memberIndex: index,
                        member: index + 1,
                        w: selfWeightValue,
                        totalWeight: totalWeight,
                        isFromSelfWeight: true,
                        loadType: 'distributed'
                    });
                    
                    // 詳細デバッグログ（最初の1回のみ）
                    if (window.memberTypeLogCount === 0) {
                        console.log(`水平部材${index + 1}: w=${selfWeightValue.toFixed(4)}kN/m (正の値=下向き[システム規約])`);
                    }
                    
                    // 水平部材は等分布荷重として処理するため、節点荷重には追加しない
                    // （等分布荷重は構造解析の固定端力として自動処理される）
                    
                } else if (memberType === 'vertical') {
                    // 垂直部材：節点集中荷重として作用
                    const lowerNodeIndex = node1.y > node2.y ? member.i : member.j;
                    
                    memberSelfWeights.push({
                        memberIndex: index,
                        member: index + 1,
                        w: 0, // 等分布荷重は0
                        totalWeight: totalWeight,
                        isFromSelfWeight: true,
                        loadType: 'concentrated',
                        appliedNodeIndex: lowerNodeIndex  // 作用節点のインデックスを追加
                    });
                    
                    // 全重量を下側の節点に集中
                    if (!nodeWeightMap.has(lowerNodeIndex)) {
                        nodeWeightMap.set(lowerNodeIndex, { nodeIndex: lowerNodeIndex, px: 0, py: 0, mz: 0 });
                    }
                    nodeWeightMap.get(lowerNodeIndex).py -= totalWeight;
                    
                    // デバッグログ
                    if (window.memberTypeLogCount <= 5) {
                        console.log(`  → 垂直部材: 節点${lowerNodeIndex + 1}にpy=${-totalWeight.toFixed(3)}kN追加`);
                    }
                    
                } else {
                    // 斜め部材：垂直成分を等分布荷重、水平成分を節点荷重として処理
                    const cosAngle = Math.abs(Math.cos(angle));
                    const sinAngle = Math.abs(Math.sin(angle));
                    
                    // 垂直成分（等分布荷重相当）
                    const verticalComponent = weightPerMeter * cosAngle; // システム規約で正の値=下向き
                    // 水平成分（節点荷重として分散）
                    const horizontalWeight = totalWeight * sinAngle;
                    
                    memberSelfWeights.push({
                        memberIndex: index,
                        member: index + 1,
                        w: verticalComponent, // 垂直成分（既に負の値）
                        totalWeight: totalWeight,
                        isFromSelfWeight: true,
                        loadType: 'mixed',
                        horizontalComponent: horizontalWeight,
                        appliedNodeIndexes: [member.i, member.j]  // 水平成分が作用する節点
                    });
                    
                    // 垂直成分は等分布荷重として処理されるため、節点荷重には追加しない
                    // 水平成分のみを節点荷重として追加
                    const horizontalHalfWeight = horizontalWeight / 2;
                    const horizontalDirection = dx > 0 ? 1 : -1;
                    
                    // 節点iに水平成分
                    if (!nodeWeightMap.has(member.i)) {
                        nodeWeightMap.set(member.i, { nodeIndex: member.i, px: 0, py: 0, mz: 0 });
                    }
                    nodeWeightMap.get(member.i).px += horizontalDirection * horizontalHalfWeight;
                    
                    // 節点jに水平成分
                    if (!nodeWeightMap.has(member.j)) {
                        nodeWeightMap.set(member.j, { nodeIndex: member.j, px: 0, py: 0, mz: 0 });
                    }
                    nodeWeightMap.get(member.j).px += horizontalDirection * horizontalHalfWeight;
                    
                    // デバッグログ
                    if (window.memberTypeLogCount <= 5) {
                        console.log(`  → 斜め部材: 節点${member.i + 1}にpx=${(horizontalDirection * horizontalHalfWeight).toFixed(3)}kN, 節点${member.j + 1}にpx=${(horizontalDirection * horizontalHalfWeight).toFixed(3)}kN追加`);
                    }
                }
            }
        });
        
        // 節点荷重配列に変換
        nodeWeightMap.forEach(nodeLoad => {
            nodeSelfWeights.push(nodeLoad);
        });
        
        // デバッグ用ログ
        console.log('📊 自重計算結果:');
        console.log('  部材自重数:', memberSelfWeights.length);
        console.log('  節点自重数:', nodeSelfWeights.length);
        nodeSelfWeights.forEach((load, index) => {
            console.log(`  節点${load.nodeIndex + 1}: px=${load.px.toFixed(3)}, py=${load.py.toFixed(3)}, mz=${load.mz.toFixed(3)}`);
        });
        
        return { memberSelfWeights, nodeSelfWeights };
    }
};

// 断面性能の単位変換関数

// 複数選択をクリアする関数
function clearMultiSelection() {
    console.log('複数選択をクリア - 以前の状態:', {
        selectedNodes: Array.from(selectedNodes),
        selectedMembers: Array.from(selectedMembers)
    });
    selectedNodes.clear();
    selectedMembers.clear();
    isMultiSelecting = false;
    if (typeof drawOnCanvas === 'function') {
        drawOnCanvas();
    }
    console.log('複数選択クリア完了');
}

// 単一選択をクリアする関数
function clearSingleSelection() {
    console.log('単一選択をクリア - 以前の状態:', {
        selectedNodeIndex,
        selectedMemberIndex
    });
    selectedNodeIndex = null;
    selectedMemberIndex = null;
    
    // window変数も同期
    window.selectedNodeIndex = null;
    window.selectedMemberIndex = null;
    
    if (typeof drawOnCanvas === 'function') {
        drawOnCanvas(); // ハイライト表示をクリアするため再描画
    }
    console.log('単一選択クリア完了');
}

// 選択された要素を表示で強調する関数
function highlightSelectedElements() {
    const canvas = document.getElementById("canvas") || document.getElementById("model-canvas");
    if (!canvas) {
        console.error('キャンバス要素が見つかりません');
        return;
    }
    
    const ctx = canvas.getContext("2d");
    if (!window.lastDrawingContext) {
        console.error('window.lastDrawingContext が利用できません');
        return;
    }
    
    try {
        const { nodes, members } = window.parseInputs();
        
        // 単一選択処理：節点が優先、節点がない場合のみ部材を表示
        const hasValidNode = window.selectedNodeIndex !== null && window.selectedNodeIndex >= 0;
        const hasValidMember = window.selectedMemberIndex !== null && window.selectedMemberIndex >= 0;
        
        if (hasValidNode) {
            // 節点が選択されている場合は節点のみを強調（青色で強調）
            console.log('単一節点選択処理開始:', window.selectedNodeIndex);
            const nodeIndex = window.selectedNodeIndex; // 0ベースの配列インデックス
            const node = nodes[nodeIndex];
            console.log('単一節点選択チェック:', { selectedNodeIndex: window.selectedNodeIndex, nodeIndex, node, nodeExists: !!node });
            if (node) {
                const transformResult = window.lastDrawingContext.transform(node.x, node.y);
                console.log('変換結果:', { nodeCoords: {x: node.x, y: node.y}, transformResult });
                const drawX = transformResult.x;
                const drawY = transformResult.y;
                ctx.save();
                ctx.strokeStyle = '#0066ff';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(drawX, drawY, 10, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();
                console.log('✅ 単一節点強調表示実行:', nodeIndex, { drawX, drawY });
            } else {
                console.log('❌ 節点が見つかりません:', nodeIndex);
            }
        } else if (hasValidMember) {
            // 節点が選択されていない場合のみ部材を強調（青色で強調）
            console.log('単一部材選択処理開始:', window.selectedMemberIndex);
            const memberIndex = window.selectedMemberIndex; // 0ベースの配列インデックス
            const member = members[memberIndex];
            console.log('単一部材選択チェック:', { selectedMemberIndex: window.selectedMemberIndex, memberIndex, member, memberExists: !!member });
            if (member) {
                const node1 = nodes[member.i];
                const node2 = nodes[member.j];
                if (node1 && node2) {
                    const pos1 = window.lastDrawingContext.transform(node1.x, node1.y);
                    const pos2 = window.lastDrawingContext.transform(node2.x, node2.y);
                    ctx.save();
                    ctx.strokeStyle = '#0066ff';
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.moveTo(pos1.x, pos1.y);
                    ctx.lineTo(pos2.x, pos2.y);
                    ctx.stroke();
                    ctx.restore();
                    console.log('✅ 単一部材強調表示実行:', memberIndex, { pos1, pos2 });
                } else {
                    // 選択されたノードが見つからない場合はスキップ
                }
            } else {
                // 選択された部材が見つからない場合はスキップ
            }
        } else {
            // 単一選択がない場合
        }
        
        // 複数選択された節点を強調（赤色で強調）
        if (window.selectedNodes && window.selectedNodes.size > 0) {
            for (const nodeId of window.selectedNodes) {
                const node = nodes[nodeId];
                if (node) {
                    const transformResult = window.lastDrawingContext.transform(node.x, node.y);
                    const drawX = transformResult.x;
                    const drawY = transformResult.y;
                    ctx.save();
                    ctx.strokeStyle = '#ff4444';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(drawX, drawY, 8, 0, 2 * Math.PI);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }
        
        // 複数選択された部材を強調（赤色で強調）
        if (window.selectedMembers && window.selectedMembers.size > 0) {
            for (const memberId of window.selectedMembers) {
                const member = members[memberId];
                if (member) {
                    const node1 = nodes[member.i];
                    const node2 = nodes[member.j];
                    if (node1 && node2) {
                        const pos1 = window.lastDrawingContext.transform(node1.x, node1.y);
                        const pos2 = window.lastDrawingContext.transform(node2.x, node2.y);
                        ctx.save();
                        ctx.strokeStyle = '#ff4444';
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.moveTo(pos1.x, pos1.y);
                        ctx.lineTo(pos2.x, pos2.y);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }
        }
    } catch (e) {
        console.error('❌ 強調表示エラー:', e);
    }
}

// グローバルに確実に登録
window.highlightSelectedElements = highlightSelectedElements;

// 複数選択をクリアする関数
function clearMultiSelection() {
    console.log('複数選択をクリア - 以前の状態:', {
        selectedNodes: Array.from(selectedNodes),
        selectedMembers: Array.from(selectedMembers)
    });
    selectedNodes.clear();
    selectedMembers.clear();
    isMultiSelecting = false;
    if (typeof drawOnCanvas === 'function') {
        drawOnCanvas();
    }
    console.log('複数選択クリア完了');
}

function convertSectionProperties(props) {
    return {
        E: UNIT_CONVERSION.E_STEEL,  // N/mm²
        G: UNIT_CONVERSION.G_STEEL,  // N/mm²
        I: props.I * UNIT_CONVERSION.CM4_TO_MM4,  // cm⁴ → mm⁴
        A: props.A * UNIT_CONVERSION.CM2_TO_MM2,  // cm² → mm²
        Z: props.Z * UNIT_CONVERSION.CM3_TO_MM3   // cm³ → mm³
    };
}

function inverseTransform(mouseX, mouseY) {
    const drawingContext = window.lastDrawingContext;
    if (!drawingContext) {
        return null;
    }

    const { scale, offsetX, offsetY } = drawingContext;
    const modelX = (mouseX - offsetX) / scale;
    const modelY = (mouseY - offsetY) / -scale;

    return { x: modelX, y: modelY };
}

window.inverseTransform = inverseTransform;

function normalizeAxisInfo(axisInfo) {
    if (!axisInfo || typeof axisInfo !== 'object') return null;

    const fallbackKeyFromMode = (mode) => {
        switch (mode) {
            case 'weak':
                return 'y';
            case 'both':
                return 'both';
            case 'strong':
                return 'x';
            default:
                return null;
        }
    };

    const fallbackModeFromKey = (key) => {
        switch (key) {
            case 'y':
                return 'weak';
            case 'both':
                return 'both';
            case 'x':
            default:
                return 'strong';
        }
    };

    const fallbackLabelFromKey = (key) => {
        switch (key) {
            case 'y':
                return '弱軸 (Y軸)';
            case 'both':
                return '両軸 (X=Y)';
            case 'x':
            default:
                return '強軸 (X軸)';
        }
    };

    const candidateKey = typeof axisInfo.key === 'string' ? axisInfo.key.trim().toLowerCase() : '';
    const candidateMode = typeof axisInfo.mode === 'string' ? axisInfo.mode.trim().toLowerCase() : '';
    const candidateLabel = typeof axisInfo.label === 'string' ? axisInfo.label.trim() : '';

    const resolvedKey = ['x', 'y', 'both'].includes(candidateKey)
        ? candidateKey
        : (fallbackKeyFromMode(candidateMode) || 'x');
    const normalizedKey = ['x', 'y', 'both'].includes(resolvedKey) ? resolvedKey : 'x';

    const resolvedMode = ['strong', 'weak', 'both'].includes(candidateMode)
        ? (normalizedKey === 'both' ? 'both' : (candidateMode === 'both' ? fallbackModeFromKey(normalizedKey) : candidateMode))
        : fallbackModeFromKey(normalizedKey);

    const resolvedLabel = candidateLabel || fallbackLabelFromKey(normalizedKey);

    return { key: normalizedKey, mode: resolvedMode, label: resolvedLabel };
}

// 部材ツールチップ関数
function detectMemberAtPosition(clientX, clientY) {
    console.log('🔍 detectMemberAtPosition呼び出し - 座標:', clientX, clientY);
    
    // DOM要素から部材データを取得
    const membersTable = document.getElementById('members-table')?.getElementsByTagName('tbody')[0];
    if (!membersTable || membersTable.rows.length === 0) {
        console.log('❌ 部材テーブルが見つからない - 行数:', membersTable?.rows?.length || 0);
        return null;
    }
    
    const nodesTable = document.getElementById('nodes-table')?.getElementsByTagName('tbody')[0];
    if (!nodesTable || nodesTable.rows.length === 0) {
        console.log('❌ 節点テーブルが見つからない - 行数:', nodesTable?.rows?.length || 0);
        return null;
    }
    
    console.log('📊 テーブル確認 - 部材:', membersTable.rows.length, '行, 節点:', nodesTable.rows.length, '行');
    
    // キャンバス要素を取得
    const canvas = document.getElementById("model-canvas");
    if (!canvas) {
        console.log('❌ キャンバス要素が見つからない');
        return null;
    }
    
    const getCellValue = (cell) => {
        if (!cell) return '';
        const input = cell.querySelector('input');
        if (input && typeof input.value === 'string') {
            const value = input.value.trim();
            if (value !== '') {
                return value;
            }
        }
        const select = cell.querySelector('select');
        if (select) {
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption) {
                const optionLabel = selectedOption.textContent?.trim();
                if (optionLabel) {
                    return optionLabel;
                }
            }
            const selectValue = select.value?.trim();
            if (selectValue) {
                return selectValue;
            }
        }
        return cell.textContent?.trim() || '';
    };
    const getCellNumber = (cell) => {
        const rawValue = getCellValue(cell);
        if (!rawValue) return NaN;
        const numericValue = parseFloat(rawValue.replace(/,/g, ''));
        return Number.isFinite(numericValue) ? numericValue : NaN;
    };
    const getCellInteger = (cell) => {
        const rawValue = getCellValue(cell);
        if (!rawValue) return NaN;
        const integerValue = parseInt(rawValue.replace(/,/g, ''), 10);
        return Number.isFinite(integerValue) ? integerValue : NaN;
    };

    const parseOptionalFloat = (value) => {
        if (value === undefined || value === null) return null;
        const numeric = Number.parseFloat(String(value).replace(/,/g, ''));
        return Number.isFinite(numeric) ? numeric : null;
    };

    const getSelectLabel = (select) => {
        if (!select) return '';
        const option = select.options?.[select.selectedIndex];
        if (option && typeof option.textContent === 'string') {
            const trimmed = option.textContent.trim();
            if (trimmed) return trimmed;
        }
        return select.value || '';
    };

    // 節点データを取得（ヘッダー行をスキップ）
    const nodesMap = {};
    const nodeRows = Array.from(nodesTable.rows);
    console.log('📊 節点テーブル行数:', nodeRows.length);
    
    // 最初の行がヘッダーの場合はスキップ
    nodeRows.forEach((row, index) => {
        const firstCellText = getCellValue(row.cells[0]);
        
        // ヘッダー行の識別（数値以外または特定キーワードを含む場合はヘッダーとみなす）
        const isHeader = isNaN(parseInt(firstCellText)) || 
                        firstCellText.includes('節点') || 
                        firstCellText.includes('Node') ||
                        firstCellText.includes('番号');
        
        if (index === 0) {
            console.log('📊 節点最初の行:', Array.from(row.cells).map(cell => cell.textContent?.trim()));
            console.log('📊 ヘッダー判定:', isHeader, '(firstCell:', firstCellText, ')');
        }
        
        if (isHeader) {
            console.log(`📊 節点行${index}スキップ (ヘッダー):`, firstCellText);
            return;
        }
        
        const nodeNumber = getCellInteger(row.cells[0]);
        const x = getCellNumber(row.cells[1]);
        const y = getCellNumber(row.cells[2]);
        
        console.log(`📊 節点行${index}: number=${nodeNumber}, x=${x}, y=${y}`);
        
        if (!isNaN(nodeNumber) && !isNaN(x) && !isNaN(y)) {
            nodesMap[nodeNumber] = { x, y };
            console.log(`✅ 節点${nodeNumber}追加: (${x}, ${y})`);
        }
    });
    
    // 部材データを取得（ヘッダー行をスキップ）
    const members = [];
    const memberRows = Array.from(membersTable.rows);
    console.log('📊 部材テーブル行数:', memberRows.length);
    
    const uniformLoadMap = new Map();
    const memberLoadsTable = document.getElementById('member-loads-table')?.getElementsByTagName('tbody')[0];
    if (memberLoadsTable && memberLoadsTable.rows) {
        Array.from(memberLoadsTable.rows).forEach((loadRow) => {
            const memberInput = loadRow.cells?.[0]?.querySelector('input');
            const loadInput = loadRow.cells?.[1]?.querySelector('input');
            const memberId = parseInt(memberInput?.value, 10);
            const loadValue = parseOptionalFloat(loadInput?.value);
            if (Number.isFinite(memberId)) {
                uniformLoadMap.set(memberId, loadValue);
            }
        });
    }

    memberRows.forEach((row, index) => {
        const firstCellText = getCellValue(row.cells[0]);
        
        // ヘッダー行の識別（数値以外または特定キーワードを含む場合はヘッダーとみなす）
        const isHeader = isNaN(parseInt(firstCellText)) || 
                        firstCellText.includes('部材') || 
                        firstCellText.includes('Member') ||
                        firstCellText.includes('番号');
        
        if (index === 0) {
            console.log('📊 部材最初の行:', Array.from(row.cells).map(cell => cell.textContent?.trim()));
            console.log('📊 ヘッダー判定:', isHeader, '(firstCell:', firstCellText, ')');
        }
        
        if (isHeader) {
            console.log(`📊 部材行${index}スキップ (ヘッダー):`, firstCellText);
            return;
        }
        
        const memberNumber = getCellInteger(row.cells[0]);
        const nodeI = getCellInteger(row.cells[1]);
        const nodeJ = getCellInteger(row.cells[2]);

        const materialSelect = row.cells[3]?.querySelector('select');
        const materialSelectLabel = getSelectLabel(materialSelect);
        let material = '';
        if (materialSelectLabel) {
            material = materialSelectLabel;
        } else {
            material = getCellValue(row.cells[3]);
        }

        const strengthSelect = row.cells[4]?.querySelector('select');
        const strengthInput = row.cells[4]?.querySelector('input');
        let section = '';
        if (strengthSelect) {
            const selectedStrength = strengthSelect.options[strengthSelect.selectedIndex];
            const strengthLabel = selectedStrength?.textContent?.trim();
            if (strengthSelect.value === 'custom' && strengthInput && strengthInput.value.trim() !== '') {
                section = `任意 (${strengthInput.value.trim()} N/mm²)`;
            } else {
                section = strengthLabel || strengthSelect.value || '';
            }
        } else {
            section = getCellValue(row.cells[4]);
        }

        let sectionInfo = null;
        if (row.dataset.sectionInfo) {
            try {
                sectionInfo = JSON.parse(decodeURIComponent(row.dataset.sectionInfo));
                sectionInfo = ensureSectionSvgMarkup(sectionInfo);
            } catch (error) {
                console.warn('Failed to parse sectionInfo for row', index, error);
            }
        }
        const sectionLabel = row.dataset.sectionLabel || sectionInfo?.label;
        const sectionSummary = row.dataset.sectionSummary || sectionInfo?.dimensionSummary || '';
        if (sectionLabel) {
            section = sectionLabel;
        }

        const eInput = row.cells[3]?.querySelector('input[type="number"]');
        const elasticModulus = {
            value: eInput?.value?.trim() || '',
            numeric: parseOptionalFloat(eInput?.value),
            label: materialSelectLabel,
            optionValue: materialSelect?.value || ''
        };

        const strengthCell = row.cells[4];
        const strengthContainer = strengthCell?.querySelector('[data-strength-type]') || strengthCell?.firstElementChild || null;
        const strengthType = strengthContainer?.dataset?.strengthType || 'F-value';
        const strengthSelectEl = strengthContainer?.querySelector('select');
        const strengthInputs = strengthContainer ? Array.from(strengthContainer.querySelectorAll('input')) : [];
        let strengthValue = '';
        let strengthLabel = '';
        let strengthDetails = null;
        if (strengthType === 'wood-type') {
            strengthValue = strengthSelectEl?.value || '';
            strengthLabel = getSelectLabel(strengthSelectEl);
            strengthDetails = strengthInputs.reduce((acc, input) => {
                const key = input.id ? input.id.split('-').pop() : input.name || '';
                if (key) {
                    acc[key] = input.value;
                }
                return acc;
            }, {});
        } else {
            const strengthPrimaryInput = strengthInputs[0] || strengthInput;
            strengthValue = strengthPrimaryInput?.value || '';
            strengthLabel = getSelectLabel(strengthSelectEl) || strengthValue;
        }

        const inertiaInput = row.cells[5]?.querySelector('input[type="number"]');
        const areaInput = row.cells[6]?.querySelector('input[type="number"]');
        const modulusInput = row.cells[7]?.querySelector('input[type="number"]');

        const densityCell = row.querySelector('.density-cell');
        const densitySelect = densityCell?.querySelector('select');
        const densityInput = densityCell?.querySelector('input');
        const densityInfo = densityCell ? {
            value: densityInput?.value || '',
            numeric: parseOptionalFloat(densityInput?.value),
            label: getSelectLabel(densitySelect),
            optionValue: densitySelect?.value || ''
        } : null;

        let sectionAxis = null;
        if (row.dataset.sectionAxisKey || row.dataset.sectionAxisLabel || row.dataset.sectionAxisMode) {
            sectionAxis = normalizeAxisInfo({
                key: row.dataset.sectionAxisKey,
                mode: row.dataset.sectionAxisMode,
                label: row.dataset.sectionAxisLabel
            });
        } else if (sectionInfo && sectionInfo.axis) {
            sectionAxis = normalizeAxisInfo(sectionInfo.axis);
        }
        
        const hasDensityColumn = Boolean(densityCell);
        const startConnCell = hasDensityColumn ? row.cells[10] : row.cells[9];
        const endConnCell = hasDensityColumn ? row.cells[11] : row.cells[10];
        const startConnSelect = startConnCell?.querySelector('select');
        const endConnSelect = endConnCell?.querySelector('select');

        const areaNumeric = parseOptionalFloat(areaInput?.value);
        const densityNumeric = densityInfo?.numeric;
        const selfWeightPerLength = (densityNumeric !== null && areaNumeric !== null)
            ? (densityNumeric * (areaNumeric * 1e-4) * 9.80665 / 1000)
            : null;

        const uniformLoad = uniformLoadMap.get(memberNumber) ?? null;

        console.log(`📊 部材行${index}: member=${memberNumber}, nodeI=${nodeI}, nodeJ=${nodeJ}`);
        
        if (!isNaN(memberNumber) && !isNaN(nodeI) && !isNaN(nodeJ) && 
            nodesMap[nodeI] && nodesMap[nodeJ]) {
            members.push({
                number: memberNumber,
                nodeI,
                nodeJ,
                material,
                materialValue: materialSelect?.value || '',
                section,
                sectionLabel,
                sectionInfo,
                sectionSummary,
                sectionAxis,
                sectionSource: row.dataset.sectionSource || sectionInfo?.source || '',
                nodes: {
                    i: nodesMap[nodeI],
                    j: nodesMap[nodeJ]
                },
                properties: {
                    elasticModulus,
                    strength: {
                        type: strengthType,
                        value: strengthValue,
                        label: strengthLabel,
                        numeric: strengthType === 'wood-type' ? null : parseOptionalFloat(strengthValue),
                        details: strengthDetails
                    },
                    inertia: {
                        value: inertiaInput?.value || '',
                        numeric: parseOptionalFloat(inertiaInput?.value),
                        unit: 'cm⁴'
                    },
                    area: {
                        value: areaInput?.value || '',
                        numeric: areaNumeric,
                        unit: 'cm²'
                    },
                    sectionModulus: {
                        value: modulusInput?.value || '',
                        numeric: parseOptionalFloat(modulusInput?.value),
                        unit: 'cm³',
                        zx: row.dataset.zx || '',
                        zy: row.dataset.zy || '',
                        zxNumeric: parseOptionalFloat(row.dataset.zx),
                        zyNumeric: parseOptionalFloat(row.dataset.zy)
                    },
                    radiusOfGyration: {
                        ix: row.dataset.ix || '',
                        iy: row.dataset.iy || '',
                        ixNumeric: parseOptionalFloat(row.dataset.ix),
                        iyNumeric: parseOptionalFloat(row.dataset.iy)
                    },
                    density: densityInfo,
                    selfWeightPerLength
                },
                connections: {
                    start: {
                        value: startConnSelect?.value || 'rigid',
                        label: getSelectLabel(startConnSelect) || '剛'
                    },
                    end: {
                        value: endConnSelect?.value || 'rigid',
                        label: getSelectLabel(endConnSelect) || '剛'
                    }
                },
                loads: {
                    uniform: uniformLoad
                }
            });
            console.log(`✅ 部材${memberNumber}追加: ${nodeI}-${nodeJ}`);
        }
    });
    
    if (members.length === 0 || Object.keys(nodesMap).length === 0) {
        console.log('❌ データ不足 - 部材:', members.length, '個, 節点:', Object.keys(nodesMap).length, '個');
        return null;
    }
    
    console.log('📏 有効データ - 部材:', members.length, '個, 節点:', Object.keys(nodesMap).length, '個');
    
    // キャンバス座標からモデル座標への変換（既存のinverseTransform関数を使用）
    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    
    console.log('🖱️ マウス位置: キャンバス内=', mouseX.toFixed(2), mouseY.toFixed(2));
    
    // 既存の座標変換システムを使用
    const worldCoords = inverseTransform(mouseX, mouseY);
    if (!worldCoords) {
        console.log('❌ 座標変換失敗 - lastDrawingContextが未初期化');
        return null;
    }
    
    const { x: worldX, y: worldY } = worldCoords;
    console.log('🌍 ワールド座標:', worldX.toFixed(2), worldY.toFixed(2));
    
    // 現在の描画コンテキスト情報を取得
    const currentDrawingContext = window.lastDrawingContext;
    const currentScale = currentDrawingContext?.scale || 1;
    const transformFn = currentDrawingContext?.transform;

    // 画面上の近接判定はピクセル単位で行い、閾値を一定に保つ
    const tolerancePixels = 12;
    console.log('📏 近接判定しきい値:', `${tolerancePixels}px`, '(スケール:', currentScale.toFixed(2), ')');
    
    let closestMember = null;
    let closestDistancePixels = Infinity;
    let memberDistances = []; // デバッグ用
    
    members.forEach((member) => {
        const node1 = member.nodes.i;
        const node2 = member.nodes.j;
        
        // ワールド座標と画面座標の両方で距離を計算
        const worldDistance = distanceFromPointToLine(
            worldX, worldY,
            node1.x, node1.y,
            node2.x, node2.y
        );

        let screenDistance = Infinity;
        if (transformFn) {
            const screenNode1 = transformFn(node1.x, node1.y);
            const screenNode2 = transformFn(node2.x, node2.y);
            screenDistance = distanceFromPointToLine(
                mouseX, mouseY,
                screenNode1.x, screenNode1.y,
                screenNode2.x, screenNode2.y
            );
        }

        memberDistances.push({
            部材: member.number,
            距離_mm: worldDistance.toFixed(2),
            画面距離_px: Number.isFinite(screenDistance) ? screenDistance.toFixed(2) : 'N/A',
            座標: `(${node1.x},${node1.y})-(${node2.x},${node2.y})`
        });
        
        if (Number.isFinite(screenDistance) && screenDistance <= tolerancePixels && screenDistance < closestDistancePixels) {
            closestDistancePixels = screenDistance;
            closestMember = {
                ...member,
                distance: worldDistance
            };
        }
    });
    
    // 最初の5個の部材の距離をログ出力
    console.log('📊 部材距離 (最初の5個):', memberDistances.slice(0, 5));
    console.log('🎯 検出結果:', closestMember ? `部材${closestMember.number} (画面距離: ${closestDistancePixels.toFixed(2)}px, ワールド距離: ${closestMember.distance.toFixed(2)})` : '部材なし');
    
    return closestMember;
}

function distanceFromPointToLine(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
        return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }
    
    // 点から線分への射影を計算
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    
    return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
}

function showMemberTooltip(memberData, mouseX, mouseY) {
    console.log('🔧 ツールチップ表示開始 - 部材:', memberData.number);
    
    const tooltip = document.querySelector('.member-tooltip');
    if (!tooltip || !memberData) {
        console.log('❌ ツールチップ表示失敗:', !tooltip ? 'DOM要素なし' : '部材データなし');
        return;
    }
    
    console.log('✅ ツールチップDOM要素確認完了');
    
    const { number, nodeI, nodeJ, material, section, nodes, sectionInfo, sectionSummary, sectionAxis, properties = {}, connections = {}, loads = {} } = memberData;

    const length = Math.sqrt(Math.pow(nodes.j.x - nodes.i.x, 2) + Math.pow(nodes.j.y - nodes.i.y, 2));
    const axisLabel = sectionAxis?.label || sectionInfo?.axis?.label || '';

    const asNumeric = (value) => {
        if (value === undefined || value === null || value === '') return null;
        const numeric = Number.parseFloat(String(value).replace(/,/g, ''));
        return Number.isFinite(numeric) ? numeric : null;
    };

    const createChip = ({ label, numeric, raw, unit, digits, suffix, emphasis, wide, subValue }) => {
        let displayValue = null;
        if (numeric !== null && numeric !== undefined && Number.isFinite(numeric)) {
            const precision = digits !== undefined ? digits : (Math.abs(numeric) >= 1000 ? 0 : 2);
            displayValue = numeric.toLocaleString(undefined, {
                maximumFractionDigits: precision,
                minimumFractionDigits: 0
            });
        } else if (typeof raw === 'string' && raw.trim() !== '') {
            displayValue = raw.trim();
        }

        if (!displayValue) return '';

        const valueWithUnit = unit ? `${displayValue} ${unit}` : displayValue;
        const suffixText = suffix ? `<span class="chip-suffix">${suffix}</span>` : '';
        const subValueText = subValue ? `<span class="chip-subvalue">${subValue}</span>` : '';
        const modifiers = [wide ? ' tooltip-chip--wide' : '', emphasis ? ' tooltip-chip--emphasis' : ''].join('');

        return `<div class="tooltip-chip${modifiers}"><span class="chip-label">${label}</span><span class="chip-value">${valueWithUnit}</span>${suffixText}${subValueText}</div>`;
    };

    const generalInfoRows = [
        { label: 'I座標', value: `(${nodes.i.x.toFixed(1)}, ${nodes.i.y.toFixed(1)})` },
        { label: 'J座標', value: `(${nodes.j.x.toFixed(1)}, ${nodes.j.y.toFixed(1)})` }
    ];

    if (!sectionInfo && section) {
        generalInfoRows.push({ label: '断面', value: section });
    }

    const summaryChips = [
        { label: '節点', value: `${nodeI} → ${nodeJ}` },
        { label: '長さ', value: `${length.toFixed(1)} mm` }
    ];

    if (axisLabel) {
        summaryChips.push({ label: '軸', value: axisLabel });
    }

    if (material) {
        summaryChips.push({ label: '材料', value: material });
    }

    const summaryChipsHTML = summaryChips
        .map(chip => `<div class="tooltip-chip tooltip-chip--summary"><span class="chip-label">${chip.label}</span><span class="chip-value">${chip.value}</span></div>`)
        .join('');

    const generalInfoHTML = generalInfoRows
        .map(row => `<div class="tooltip-stat-item"><span class="stat-label">${row.label}</span><span class="stat-value">${row.value}</span></div>`)
        .join('');

    const generalInfoSectionHTML = generalInfoHTML
        ? `<div class="tooltip-subsection"><div class="tooltip-subtitle">概要</div><div class="tooltip-stat-grid">${generalInfoHTML}</div></div>`
        : '';

    const {
        elasticModulus = {},
        strength = {},
        inertia = {},
        area: areaProp = {},
        sectionModulus = {},
        radiusOfGyration = {},
        density: densityPropRaw = null,
        selfWeightPerLength = null
    } = properties;

    const densityProp = (densityPropRaw && typeof densityPropRaw === 'object') ? densityPropRaw : {};

    const propertyChips = [];

    if (elasticModulus.value || Number.isFinite(elasticModulus.numeric)) {
        const suffix = elasticModulus.label && elasticModulus.label !== material ? elasticModulus.label : '';
        propertyChips.push(createChip({
            label: 'E',
            numeric: elasticModulus.numeric ?? asNumeric(elasticModulus.value),
            raw: elasticModulus.value,
            unit: 'N/mm²',
            digits: 0,
            suffix
        }));
    }

    if (strength.type === 'wood-type') {
        const detailEntries = strength.details
            ? Object.entries(strength.details).map(([key, value]) => `${key.toUpperCase()}: ${value}`).join(' / ')
            : '';
        propertyChips.push(createChip({
            label: '木材',
            raw: strength.label || 'カスタム',
            unit: '',
            wide: true,
            subValue: detailEntries ? `${detailEntries} N/mm²` : ''
        }));
    } else if (strength.value || Number.isFinite(strength.numeric)) {
        const suffix = strength.label && strength.label !== strength.value ? strength.label : '';
        propertyChips.push(createChip({
            label: 'F',
            numeric: strength.numeric ?? asNumeric(strength.value),
            raw: strength.value,
            unit: 'N/mm²',
            digits: 0,
            suffix
        }));
    }

    if (inertia.value || Number.isFinite(inertia.numeric)) {
        propertyChips.push(createChip({
            label: 'I',
            numeric: inertia.numeric ?? asNumeric(inertia.value),
            raw: inertia.value,
            unit: 'cm⁴'
        }));
    }

    if (areaProp.value || Number.isFinite(areaProp.numeric)) {
        propertyChips.push(createChip({
            label: 'A',
            numeric: areaProp.numeric ?? asNumeric(areaProp.value),
            raw: areaProp.value,
            unit: 'cm²'
        }));
    }

    const zxNumeric = sectionModulus.zxNumeric ?? asNumeric(sectionModulus.zx);
    const zyNumeric = sectionModulus.zyNumeric ?? asNumeric(sectionModulus.zy);
    const primaryZNumeric = sectionModulus.numeric ??
        (sectionAxis?.key === 'y' ? (zyNumeric ?? zxNumeric) : sectionAxis?.key === 'x' ? (zxNumeric ?? zyNumeric) : asNumeric(sectionModulus.value));
    const primaryZRaw = sectionModulus.value || (sectionAxis?.key === 'y' ? sectionModulus.zy : sectionModulus.zx);
    const zUnit = 'cm³';

    const primaryZLabel = sectionAxis?.key === 'y' ? 'Zy' : sectionAxis?.key === 'x' ? 'Zx' : 'Z';
    if (primaryZRaw || Number.isFinite(primaryZNumeric)) {
        propertyChips.push(createChip({
            label: primaryZLabel,
            numeric: primaryZNumeric ?? asNumeric(primaryZRaw),
            raw: primaryZRaw,
            unit: zUnit
        }));
    }

    const zTolerance = 1e-6;
    if (sectionAxis?.key === 'x' && zyNumeric !== null && Math.abs((primaryZNumeric ?? zyNumeric) - zyNumeric) > zTolerance) {
        propertyChips.push(createChip({ label: 'Zy', numeric: zyNumeric, raw: sectionModulus.zy, unit: zUnit }));
    } else if (sectionAxis?.key === 'y' && zxNumeric !== null && Math.abs((primaryZNumeric ?? zxNumeric) - zxNumeric) > zTolerance) {
        propertyChips.push(createChip({ label: 'Zx', numeric: zxNumeric, raw: sectionModulus.zx, unit: zUnit }));
    } else if (!sectionAxis && zxNumeric !== null && zyNumeric !== null && Math.abs(zxNumeric - zyNumeric) > zTolerance) {
        propertyChips.push(createChip({ label: 'Zx', numeric: zxNumeric, raw: sectionModulus.zx, unit: zUnit }));
        propertyChips.push(createChip({ label: 'Zy', numeric: zyNumeric, raw: sectionModulus.zy, unit: zUnit }));
    }

    if (radiusOfGyration.ix || Number.isFinite(radiusOfGyration.ixNumeric)) {
        propertyChips.push(createChip({
            label: 'ix',
            numeric: radiusOfGyration.ixNumeric ?? asNumeric(radiusOfGyration.ix),
            raw: radiusOfGyration.ix,
            unit: 'cm'
        }));
    }

    if (radiusOfGyration.iy || Number.isFinite(radiusOfGyration.iyNumeric)) {
        propertyChips.push(createChip({
            label: 'iy',
            numeric: radiusOfGyration.iyNumeric ?? asNumeric(radiusOfGyration.iy),
            raw: radiusOfGyration.iy,
            unit: 'cm'
        }));
    }

    if (densityProp.value || Number.isFinite(densityProp.numeric)) {
        propertyChips.push(createChip({
            label: 'ρ',
            numeric: densityProp.numeric ?? asNumeric(densityProp.value),
            raw: densityProp.value,
            unit: 'kg/m³',
            suffix: densityProp.label && densityProp.label !== densityProp.value ? densityProp.label : ''
        }));
    }

    const propertySectionHTML = propertyChips.length
        ? `<div class="tooltip-subsection"><div class="tooltip-subtitle">物性値</div><div class="tooltip-chip-list">${propertyChips.join('')}</div></div>`
        : '';

    const connectionChips = [];
    if (connections.start?.label || connections.start?.value) {
        connectionChips.push(`<div class="tooltip-chip tooltip-chip--connection"><span class="chip-label">始端</span><span class="chip-value">${connections.start.label || connections.start.value}</span></div>`);
    }
    if (connections.end?.label || connections.end?.value) {
        connectionChips.push(`<div class="tooltip-chip tooltip-chip--connection"><span class="chip-label">終端</span><span class="chip-value">${connections.end.label || connections.end.value}</span></div>`);
    }

    const connectionSectionHTML = connectionChips.length
        ? `<div class="tooltip-subsection"><div class="tooltip-subtitle">接合条件</div><div class="tooltip-chip-list compact">${connectionChips.join('')}</div></div>`
        : '';

    const loadChips = [];
    const uniformLoadNumeric = asNumeric(loads.uniform);
    if (uniformLoadNumeric !== null) {
        loadChips.push(createChip({ label: 'w', numeric: uniformLoadNumeric, unit: 'kN/m', digits: 2 }));
    } else if (loads.uniform !== null && loads.uniform !== undefined && String(loads.uniform).trim() !== '') {
        loadChips.push(createChip({ label: 'w', raw: String(loads.uniform).trim(), unit: 'kN/m' }));
    }
    if (selfWeightPerLength !== null && selfWeightPerLength !== undefined) {
        loadChips.push(createChip({ label: '自重', numeric: selfWeightPerLength, unit: 'kN/m', digits: 3 }));
    }

    const loadSectionHTML = loadChips.length
        ? `<div class="tooltip-subsection"><div class="tooltip-subtitle">荷重</div><div class="tooltip-chip-list compact">${loadChips.join('')}</div></div>`
        : '';

    // ==========================================================
    // 解析結果セクション
    // ==========================================================
    let analysisSectionHTML = '';

    // 解析結果がグローバル変数に存在するかチェック
    if (window.lastResults && window.lastSectionCheckResults && window.lastBucklingResults) {
        const memberIndex = memberData.number - 1;

        const summaryChips = [];
        const statItems = [];

        // --- 断面算定結果 ---
        const checkResult = window.lastSectionCheckResults[memberIndex];
        if (checkResult && checkResult.maxRatio !== 'N/A') {
            const isNg = checkResult.status === 'NG';

            // 最大合成応力度を計算
            let maxCombinedStress = null;
            const N = asNumeric(checkResult.N);
            const M = asNumeric(checkResult.M);
            const A_m2 = asNumeric(properties?.area?.numeric) * 1e-4; // cm2 -> m2
            const Z_m3 = asNumeric(properties?.sectionModulus?.numeric) * 1e-6; // cm3 -> m3

            if (N !== null && M !== null && A_m2 !== null && Z_m3 !== null && A_m2 > 0 && Z_m3 > 0) {
                const sigma_a = (Math.abs(N) * 1000) / (A_m2 * 1e6); // kN -> N, m2 -> mm2 => N/mm2
                const sigma_b = (Math.abs(M) * 1e6) / (Z_m3 * 1e9); // kNm -> Nmm, m3 -> mm3 => N/mm2
                maxCombinedStress = sigma_a + sigma_b;
                statItems.push(`<div class="tooltip-stat-item"><span class="stat-label">最大合成応力度</span><span class="stat-value">${maxCombinedStress.toFixed(1)} N/mm²</span></div>`);
            }

            summaryChips.push(createChip({
                label: '最大検定比',
                numeric: checkResult.maxRatio,
                digits: 3,
                emphasis: isNg, // NGの場合は強調表示
                wide: true,
                subValue: `判定: ${checkResult.status}`
            }));
        }

        // --- 座屈解析結果 ---
        const bucklingResult = window.lastBucklingResults[memberIndex];
        if (bucklingResult && typeof bucklingResult.safetyFactor === 'number' && isFinite(bucklingResult.safetyFactor)) {
            const isDangerous = bucklingResult.status === '座屈危険';
            const isWarning = bucklingResult.status === '要注意';
            summaryChips.push(createChip({
                label: '座屈安全率',
                numeric: bucklingResult.safetyFactor,
                digits: 2,
                emphasis: isDangerous || isWarning, // 危険・要注意の場合は強調表示
                wide: true,
                subValue: `判定: ${bucklingResult.status}`
            }));
        }

        // --- 最大断面力 ---
        const forceResult = window.lastResults.forces[memberIndex];
        if (forceResult) {
            const maxAxial = Math.max(Math.abs(forceResult.N_i), Math.abs(forceResult.N_j));
            const maxShear = Math.max(Math.abs(forceResult.Q_i), Math.abs(forceResult.Q_j));
            const maxMoment = Math.max(Math.abs(forceResult.M_i), Math.abs(forceResult.M_j));

            statItems.push(`<div class="tooltip-stat-item"><span class="stat-label">最大軸力</span><span class="stat-value">${maxAxial.toFixed(1)} kN</span></div>`);
            statItems.push(`<div class="tooltip-stat-item"><span class="stat-label">最大せん断力</span><span class="stat-value">${maxShear.toFixed(1)} kN</span></div>`);
            statItems.push(`<div class="tooltip-stat-item"><span class="stat-label">最大曲げM</span><span class="stat-value">${maxMoment.toFixed(1)} kN·m</span></div>`);
        }

        if (summaryChips.length > 0 || statItems.length > 0) {
            analysisSectionHTML = `
                <div class="tooltip-subsection">
                    <div class="tooltip-subtitle">📈 解析結果</div>
                    ${summaryChips.length > 0 ? `<div class="tooltip-chip-list">${summaryChips.join('')}</div>` : ''}
                    ${statItems.length > 0 ? `<div class="tooltip-stat-grid" style="margin-top: 8px;">${statItems.join('')}</div>` : ''}
                </div>`;
        }
    }
    // ==========================================================

    let sectionColumnHTML = '';
    const axisChip = axisLabel ? `<span class="section-axis-chip">${axisLabel}</span>` : '';
    const sectionSummaryText = sectionSummary || sectionInfo?.dimensionSummary;

    if (sectionInfo) {
        const dimensionItems = Array.isArray(sectionInfo.dimensions)
            ? sectionInfo.dimensions.filter(dim => dim && typeof dim.value === 'number' && isFinite(dim.value))
            : [];
        const limitedItems = dimensionItems.slice(0, 8);

        const dimensionsHTML = limitedItems.length > 0
            ? `<div class="section-dimension-grid">${limitedItems.map(dim => `<div class="section-dimension-item"><span class="dim-key">${dim.label || dim.key}</span><span class="dim-value">${dim.value} mm</span></div>`).join('')}</div>`
            : '';

        sectionColumnHTML = `
            <div class="section-preview-card">
                <div class="section-preview-header">
                    <span class="section-title">${sectionInfo.label || '断面情報'}</span>
                    ${axisChip}
                </div>
                ${sectionSummaryText ? `<div class="section-summary-text">${sectionSummaryText}</div>` : ''}
                ${sectionInfo.svgMarkup ? `<div class="tooltip-section-preview">${sectionInfo.svgMarkup}</div>` : ''}
                ${dimensionsHTML}
                ${sectionInfo.source ? `<div class="section-source">参照: ${sectionInfo.source}</div>` : ''}
            </div>
        `.trim();
    } else {
        sectionColumnHTML = `
            <div class="section-preview-card">
                <div class="section-preview-header">
                    <span class="section-title">断面情報</span>
                    ${axisChip}
                </div>
                <div class="section-placeholder">断面情報が設定されていません。</div>
                ${sectionSummaryText ? `<div class="section-summary-text">${sectionSummaryText}</div>` : ''}
            </div>
        `.trim();
    }

    // 3列レイアウト用に情報を分割
    const column1HTML = [
        summaryChipsHTML ? `<div class="tooltip-summary-chip-row">${summaryChipsHTML}</div>` : '',
        generalInfoSectionHTML,
        connectionSectionHTML
    ].filter(Boolean).join('');

    const column2HTML = [
        propertySectionHTML,
        loadSectionHTML,
        analysisSectionHTML
    ].filter(Boolean).join('');

    let content = `<div class="tooltip-header">部材 ${number}</div>`;
    content += `<div class="tooltip-body">`;
    content += `<div class="tooltip-info-pane">${column1HTML}</div>`;
    content += `<div class="tooltip-info-pane">${column2HTML}</div>`;
    content += `<div class="tooltip-figure-pane">${sectionColumnHTML}</div>`;
    content += `</div>`;
    
    tooltip.innerHTML = content;
    console.log('📝 ツールチップコンテンツ設定完了');
    
    // hiddenクラスを削除してツールチップを表示
    tooltip.classList.remove('hidden');
    tooltip.style.display = 'block';
    console.log('👁️ ツールチップ表示状態変更完了');
    
    // ツールチップの位置を調整
    const rect = tooltip.getBoundingClientRect();
    const offsetParent = tooltip.offsetParent;
    const padding = 10;
    let computedLeft;
    let computedTop;

    if (offsetParent) {
        const parentRect = offsetParent.getBoundingClientRect();
        const parentScrollLeft = offsetParent.scrollLeft || 0;
        const parentScrollTop = offsetParent.scrollTop || 0;
        const parentWidth = offsetParent.clientWidth || window.innerWidth;
        const parentHeight = offsetParent.clientHeight || window.innerHeight;

        const relativeX = mouseX - parentRect.left + parentScrollLeft;
        const relativeY = mouseY - parentRect.top + parentScrollTop;

        let left = relativeX + padding;
        let top = relativeY - padding;

        const maxLeft = parentScrollLeft + parentWidth - rect.width - padding;
        if (left > maxLeft) {
            left = Math.max(parentScrollLeft + padding, relativeX - rect.width - padding);
        }

        const maxTop = parentScrollTop + parentHeight - rect.height - padding;
        if (top > maxTop) {
            top = Math.max(parentScrollTop + padding, relativeY - rect.height - padding);
        }

        computedLeft = left;
        computedTop = top;
    } else {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = mouseX + padding;
        let top = mouseY - padding;

        if (left + rect.width > viewportWidth) {
            left = Math.max(padding, mouseX - rect.width - padding);
        }

        if (top + rect.height > viewportHeight) {
            top = Math.max(padding, mouseY - rect.height - padding);
        }

        computedLeft = left;
        computedTop = top;
    }

    tooltip.style.left = `${computedLeft}px`;
    tooltip.style.top = `${computedTop}px`;

    console.log('✅ ツールチップ表示完了:', {
        位置: `${computedLeft}px, ${computedTop}px`,
        サイズ: `${rect.width}px × ${rect.height}px`,
        visible: tooltip.style.display,
        hiddenClass: tooltip.classList.contains('hidden')
    });
}

function hideMemberTooltip() {
    const tooltip = document.querySelector('.member-tooltip');
    if (tooltip) {
        tooltip.classList.add('hidden');
        tooltip.style.display = 'none';
        console.log('🔧 ツールチップ非表示完了');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔍 DOMContentLoadedイベントが発火しました');
    
    // DOM Elements
    const elements = {
        nodesTable: document.getElementById('nodes-table').getElementsByTagName('tbody')[0],
        membersTable: document.getElementById('members-table').getElementsByTagName('tbody')[0],
        nodeLoadsTable: document.getElementById('node-loads-table').getElementsByTagName('tbody')[0],
        memberLoadsTable: document.getElementById('member-loads-table').getElementsByTagName('tbody')[0],
        addNodeBtn: document.getElementById('add-node-btn'),
        addMemberBtn: document.getElementById('add-member-btn'),
        addNodeLoadBtn: document.getElementById('add-node-load-btn'),
        addMemberLoadBtn: document.getElementById('add-member-load-btn'),
        calculateBtn: document.getElementById('calculate-btn'),
        calculateAndAnimateBtn: document.getElementById('calculate-and-animate-btn'),
        presetSelector: document.getElementById('preset-selector'),
        displacementResults: document.getElementById('displacement-results'),
        reactionResults: document.getElementById('reaction-results'),
        forceResults: document.getElementById('force-results'),
        errorMessage: document.getElementById('error-message'),
        modelCanvas: document.getElementById('model-canvas'),
        displacementCanvas: document.getElementById('displacement-canvas'),
        momentCanvas: document.getElementById('moment-canvas'),
        axialCanvas: document.getElementById('axial-canvas'),
        shearCanvas: document.getElementById('shear-canvas'),
        stressCanvas: document.getElementById('stress-canvas'),
        modeSelectBtn: document.getElementById('mode-select'),
        modeAddNodeBtn: document.getElementById('mode-add-node'),
        modeAddMemberBtn: document.getElementById('mode-add-member'),
        undoBtn: document.getElementById('undo-btn'),
        nodeContextMenu: document.getElementById('node-context-menu'),
        memberPropsPopup: document.getElementById('member-props-popup'),
        nodePropsPopup: document.getElementById('node-props-popup'),
        nodeLoadPopup: document.getElementById('node-load-popup'),
        nodeCoordsPopup: document.getElementById('node-coords-popup'),
        addMemberPopup: document.getElementById('add-member-popup'),
        gridToggle: document.getElementById('grid-toggle'),
        memberInfoToggle: document.getElementById('member-info-toggle'),
        gridSpacing: document.getElementById('grid-spacing'),
        animScaleInput: document.getElementById('anim-scale-input'),
        saveBtn: document.getElementById('save-btn'),
        loadBtn: document.getElementById('load-btn'),
        exportExcelBtn: document.getElementById('export-excel-btn'),
        reportBtn: document.getElementById('report-btn'),
        ratioCanvas: document.getElementById('ratio-canvas'),
        sectionCheckResults: document.getElementById('section-check-results'),
        loadTermRadios: document.querySelectorAll('input[name="load-term"]'),
        resetModelBtn: document.getElementById('reset-model-btn'),
        autoScaleBtn: document.getElementById('auto-scale-btn'),
        zoomInBtn: document.getElementById('zoom-in-btn'),
        zoomOutBtn: document.getElementById('zoom-out-btn'),
        considerSelfWeightCheckbox: document.getElementById('consider-self-weight-checkbox'),
    };

    // Make elements object globally accessible
    window.elements = elements;

    // AIモデル生成ボタンのイベントリスナー
    const aiGenerateBtn = document.getElementById('generate-model-btn');
    if (aiGenerateBtn) {
        aiGenerateBtn.addEventListener('click', () => {
            const promptInput = document.getElementById('natural-language-input');
            const prompt = promptInput.value.trim();
            if (prompt) {
                generateModelWithAI(prompt);
            } else {
                alert('指示内容を入力してください。');
            }
        });
    }

    // デバッグ: エクセル出力ボタンの存在確認
    console.log('エクセル出力ボタンの要素:', elements.exportExcelBtn);
    console.log('ボタンが存在するか:', !!elements.exportExcelBtn);
    
    // デバッグ: 重要なポップアップ要素の存在確認
    console.log('🔍 ポップアップ要素チェック:', {
        memberPropsPopup: !!elements.memberPropsPopup,
        nodePropsPopup: !!elements.nodePropsPopup,
        addMemberPopup: !!elements.addMemberPopup
    });
    
    // デバッグ: 部材追加ボタンの存在確認
    console.log('🔍 部材追加ボタンチェック:', {
        modeAddMemberBtn: !!elements.modeAddMemberBtn,
        buttonElement: elements.modeAddMemberBtn
    });

    let panZoomState = { scale: 1, offsetX: 0, offsetY: 0, isInitialized: false };
    
    // Make panZoomState globally accessible
    window.panZoomState = panZoomState;
    
    let lastResults = null;
    let lastAnalysisResult = null;
    let lastSectionCheckResults = null;
    let lastDisplacementScale = 0;
    
    // マウス位置を追跡（視覚的フィードバック用）
    let currentMouseX = 0;
    let currentMouseY = 0;
    
    // 結果図のパン・ズーム状態を管理
    let resultPanZoomStates = {
        displacement: { scale: 1, offsetX: 0, offsetY: 0, isInitialized: false },
        moment: { scale: 1, offsetX: 0, offsetY: 0, isInitialized: false },
        axial: { scale: 1, offsetX: 0, offsetY: 0, isInitialized: false },
        shear: { scale: 1, offsetX: 0, offsetY: 0, isInitialized: false },
        ratio: { scale: 1, offsetX: 0, offsetY: 0, isInitialized: false }
    };

    const dispScaleInput = document.getElementById('disp-scale-input');
    dispScaleInput.addEventListener('change', (e) => {
        if(lastResults) {
            const newScale = parseFloat(e.target.value);
            if(!isNaN(newScale)) {
                drawDisplacementDiagram(lastResults.nodes, lastResults.members, lastResults.D, lastResults.memberLoads, newScale);
            }
        }
    });

    // Global State
    let canvasMode = 'select';
    let firstMemberNode = null;
    let selectedNodeIndex = null;
    let selectedMemberIndex = null;
    let isDragging = false;
    let isDraggingCanvas = false;
    
    // ツールチップ要素の存在確認（デバッグ用）
    const tooltipElement = document.querySelector('.member-tooltip');
    console.log('🔍 初期化時ツールチップ要素チェック:', {
        存在: !!tooltipElement,
        id: tooltipElement?.id,
        クラス: tooltipElement?.className,
        表示状態: tooltipElement?.style.display,
        hiddenクラス: tooltipElement?.classList.contains('hidden')
    });
    
    if (!tooltipElement) {
        console.warn('⚠️ ツールチップ要素が見つかりません！HTMLを確認してください。');
    }
    let lastMouseX = 0;
    let lastMouseY = 0;
    let historyStack = [];
    const resolutionScale = 2.0;
    let newMemberDefaults = { E: '205000', F: '235', I: '18400', A: '2340', Z: '1230', i_conn: 'rigid', j_conn: 'rigid' };
    
    // ポップアップの初期化（確実に非表示にする）
    if (elements.memberPropsPopup) {
        elements.memberPropsPopup.style.display = 'none';
        elements.memberPropsPopup.style.visibility = 'hidden';
        console.log('✅ memberPropsPopup初期化完了 (非表示設定)');
    }
    if (elements.nodePropsPopup) {
        elements.nodePropsPopup.style.display = 'none';
        elements.nodePropsPopup.style.visibility = 'hidden';
        console.log('✅ nodePropsPopup初期化完了 (非表示設定)');
    }
    if (elements.nodeLoadPopup) {
        elements.nodeLoadPopup.style.display = 'none';
        elements.nodeLoadPopup.style.visibility = 'hidden';
    }
    if (elements.nodeCoordsPopup) {
        elements.nodeCoordsPopup.style.display = 'none';
        elements.nodeCoordsPopup.style.visibility = 'hidden';
    }
    if (elements.addMemberPopup) {
        elements.addMemberPopup.style.display = 'none';
        elements.addMemberPopup.style.visibility = 'hidden';
    }
    
    // ツールチップ表示の状態管理
    let hoveredMember = null;
    let tooltipTimeout = null;
    
    // グローバル変数をwindowオブジェクトに登録（ハイライト関数からアクセスできるように）
    window.selectedNodeIndex = null;
    window.selectedMemberIndex = null;
    
    // 複数選択機能の状態
    let isMultiSelecting = false;
    let multiSelectStart = { x: 0, y: 0 };
    let multiSelectEnd = { x: 0, y: 0 };
    let selectedNodes = new Set();
    let selectedMembers = new Set();
    let isShiftPressed = false;
    let isRangeSelecting = false;
    let rangeSelectionAdditive = false;
    let selectionChoiceMenu = null;
    
    // window変数として登録（クロススコープアクセス用）
    window.selectedNodes = selectedNodes;
    window.selectedMembers = selectedMembers;
    
    // 複数選択用の関数
    const clearMultiSelection = () => {
        console.log('複数選択をクリア - 以前の状態:', {
            selectedNodes: Array.from(selectedNodes),
            selectedMembers: Array.from(selectedMembers),
            windowSelectedNodes: Array.from(window.selectedNodes || []),
            windowSelectedMembers: Array.from(window.selectedMembers || [])
        });
        selectedNodes.clear();
        selectedMembers.clear();
        console.log('複数選択クリア後 - window同期確認:', {
            windowSelectedNodesSize: window.selectedNodes ? window.selectedNodes.size : 'undefined',
            windowSelectedMembersSize: window.selectedMembers ? window.selectedMembers.size : 'undefined'
        });
        isMultiSelecting = false;
        isRangeSelecting = false;
        rangeSelectionAdditive = false;
        multiSelectStart = { x: 0, y: 0 };
        multiSelectEnd = { x: 0, y: 0 };
        hideSelectionChoiceMenu();
        if (typeof drawOnCanvas === 'function') {
            drawOnCanvas();
        }
        console.log('複数選択クリア完了');
    };

    const hideSelectionChoiceMenu = () => {
        if (selectionChoiceMenu) {
            selectionChoiceMenu.remove();
            selectionChoiceMenu = null;
        }
    };

    // 不安定構造の分析機能
    let unstableNodes = new Set();
    let unstableMembers = new Set();
    let instabilityMessage = '';

    const analyzeInstability = (K_global, reduced_indices, nodes, members) => {
        const analysis = {
            message: '',
            unstableNodes: new Set(),
            unstableMembers: new Set()
        };

        try {
            // 1. 拘束不足の節点を検出
            const constraintAnalysis = analyzeConstraints(nodes);
            if (constraintAnalysis.unconstrainedNodes.length > 0) {
                analysis.unstableNodes = new Set(constraintAnalysis.unconstrainedNodes);
                analysis.message += `拘束が不足している節点: ${constraintAnalysis.unconstrainedNodes.map(i => i+1).join(', ')}`;
            }

            // 2. 機構（メカニズム）を検出
            const mechanismAnalysis = analyzeMechanisms(nodes, members);
            if (mechanismAnalysis.problematicMembers.length > 0) {
                mechanismAnalysis.problematicMembers.forEach(idx => analysis.unstableMembers.add(idx));
                if (analysis.message) analysis.message += '\n';
                analysis.message += `不安定な部材構成: ${mechanismAnalysis.problematicMembers.map(i => i+1).join(', ')}`;
            }

            // 3. 剛性マトリックスの特異性を分析
            const matrixAnalysis = analyzeStiffnessMatrix(K_global, reduced_indices);
            if (matrixAnalysis.zeroEnergyModes.length > 0) {
                if (analysis.message) analysis.message += '\n';
                analysis.message += `特異モード（零エネルギーモード）が検出されました`;
            }

            // グローバル変数に設定（描画用）
            unstableNodes = analysis.unstableNodes;
            unstableMembers = analysis.unstableMembers;
            instabilityMessage = analysis.message;

            return analysis;
        } catch (error) {
            console.error('不安定性解析中にエラー:', error);
            return {
                message: '不安定性の詳細分析中にエラーが発生しました',
                unstableNodes: new Set(),
                unstableMembers: new Set()
            };
        }
    };

    const analyzeConstraints = (nodes) => {
        const unconstrainedNodes = [];
        
        nodes.forEach((node, index) => {
            let constraintCount = 0;
            if (node.restraint_x) constraintCount++;
            if (node.restraint_y) constraintCount++;
            if (node.restraint_r) constraintCount++;
            
            // 全く拘束されていない節点、または不十分な拘束の節点を検出
            if (constraintCount === 0) {
                unconstrainedNodes.push(index);
            }
        });

        return { unconstrainedNodes };
    };

    const analyzeMechanisms = (nodes, members) => {
        const problematicMembers = [];
        
        // 基本的なメカニズム検出
        // 1. 孤立した部材（どちらかの端が拘束されていない）
        members.forEach((member, index) => {
            const startNode = nodes[member.start];
            const endNode = nodes[member.end];
            
            const startConstraints = (startNode.restraint_x ? 1 : 0) + 
                                   (startNode.restraint_y ? 1 : 0) + 
                                   (startNode.restraint_r ? 1 : 0);
            const endConstraints = (endNode.restraint_x ? 1 : 0) + 
                                 (endNode.restraint_y ? 1 : 0) + 
                                 (endNode.restraint_r ? 1 : 0);
            
            // 両端とも十分な拘束がない場合
            if (startConstraints < 2 && endConstraints < 2) {
                problematicMembers.push(index);
            }
        });

        return { problematicMembers };
    };

    const analyzeStiffnessMatrix = (K_global, reduced_indices) => {
        const zeroEnergyModes = [];
        
        try {
            // 簡易的な特異性検出
            // 対角要素がゼロまたは極小の要素を検出
            reduced_indices.forEach((idx, i) => {
                if (Math.abs(K_global[idx][idx]) < 1e-10) {
                    zeroEnergyModes.push(idx);
                }
            });
        } catch (error) {
            console.error('剛性マトリックス解析エラー:', error);
        }

        return { zeroEnergyModes };
    };

    // 不安定要素をハイライト表示する関数
    const highlightInstabilityElements = (ctx, transform) => {
        if (!ctx || !transform) return;
        
        const { nodes, members } = parseInputs();
        if (!nodes.length) return;

        // 不安定な節点をハイライト
        if (unstableNodes.size > 0) {
            ctx.save();
            ctx.strokeStyle = '#FF6B35'; // オレンジ色
            ctx.fillStyle = 'rgba(255, 107, 53, 0.3)';
            ctx.lineWidth = 4;

            unstableNodes.forEach(nodeIndex => {
                if (nodeIndex < nodes.length) {
                    const node = nodes[nodeIndex];
                    const x = node.x * transform.scale + transform.offsetX;
                    const y = node.y * transform.scale + transform.offsetY;
                    
                    // 点滅効果のための大きめの円
                    ctx.beginPath();
                    ctx.arc(x, y, 12, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                    
                    // 警告マーク
                    ctx.fillStyle = '#FF6B35';
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('⚠', x, y + 5);
                }
            });
            ctx.restore();
        }

        // 不安定な部材をハイライト
        if (unstableMembers.size > 0) {
            ctx.save();
            ctx.strokeStyle = '#FF6B35'; // オレンジ色
            ctx.lineWidth = 6;
            ctx.setLineDash([10, 5]); // 破線

            unstableMembers.forEach(memberIndex => {
                if (memberIndex < members.length) {
                    const member = members[memberIndex];
                    const startNode = nodes[member.start];
                    const endNode = nodes[member.end];
                    
                    if (startNode && endNode) {
                        const x1 = startNode.x * transform.scale + transform.offsetX;
                        const y1 = startNode.y * transform.scale + transform.offsetY;
                        const x2 = endNode.x * transform.scale + transform.offsetX;
                        const y2 = endNode.y * transform.scale + transform.offsetY;
                        
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                }
            });
            ctx.restore();
        }

        // 不安定性メッセージがある場合は画面上部に表示
        if (instabilityMessage) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 107, 53, 0.9)';
            ctx.strokeStyle = '#FF6B35';
            ctx.lineWidth = 2;
            
            // メッセージボックス
            const boxWidth = Math.min(800, ctx.canvas.width - 40);
            const boxHeight = 60 + (instabilityMessage.split('\n').length - 1) * 20;
            const boxX = (ctx.canvas.width - boxWidth) / 2;
            const boxY = 20;
            
            ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
            
            // テキスト
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            
            const lines = instabilityMessage.split('\n');
            lines.forEach((line, index) => {
                ctx.fillText(line, ctx.canvas.width / 2, boxY + 25 + index * 20);
            });
            
            ctx.restore();
        }
    };

    // 不安定性分析結果をクリアする関数
    const clearInstabilityHighlight = () => {
        unstableNodes.clear();
        unstableMembers.clear();
        instabilityMessage = '';
    };

    // 入力値のリアルタイム検証機能
    const validateInputValue = (input, validationType) => {
        const value = input.value.trim();
        let isValid = true;
        let errorMessage = '';

        try {
            const { nodes, members } = parseInputs();
            
            switch (validationType) {
                case 'node-reference':
                    // 節点番号の参照チェック
                    if (value && !isNaN(value)) {
                        const nodeIndex = parseInt(value) - 1;
                        if (nodeIndex < 0 || nodeIndex >= nodes.length) {
                            isValid = false;
                            errorMessage = `節点 ${value} は存在しません`;
                        }
                    }
                    break;
                
                case 'member-reference':
                    // 部材番号の参照チェック
                    if (value && !isNaN(value)) {
                        const memberIndex = parseInt(value) - 1;
                        if (memberIndex < 0 || memberIndex >= members.length) {
                            isValid = false;
                            errorMessage = `部材 ${value} は存在しません`;
                        }
                    }
                    break;
                
                case 'member-nodes':
                    // 部材表の節点番号チェック
                    if (value && !isNaN(value)) {
                        const nodeIndex = parseInt(value) - 1;
                        if (nodeIndex < 0 || nodeIndex >= nodes.length) {
                            isValid = false;
                            errorMessage = `節点 ${value} は存在しません`;
                        }
                    }
                    break;
                
                case 'positive-number':
                    // 正の数値チェック
                    if (value && !isNaN(value)) {
                        if (parseFloat(value) <= 0) {
                            isValid = false;
                            errorMessage = '正の値を入力してください';
                        }
                    }
                    break;
                
                case 'non-negative-number':
                    // 非負数値チェック
                    if (value && !isNaN(value)) {
                        if (parseFloat(value) < 0) {
                            isValid = false;
                            errorMessage = '0以上の値を入力してください';
                        }
                    }
                    break;
            }
        } catch (error) {
            // parseInputs が失敗した場合は検証をスキップ
            console.debug('入力検証中にparseInputsエラー:', error);
        }

        // スタイルの適用
        if (isValid) {
            input.style.backgroundColor = '';
            input.style.borderColor = '';
            input.removeAttribute('title');
        } else {
            input.style.backgroundColor = '#ffebee';
            input.style.borderColor = '#f44336';
            input.setAttribute('title', errorMessage);
        }

        return isValid;
    };

    // 入力フィールドに検証機能を設定
    const setupInputValidation = (input, validationType) => {
        input.addEventListener('input', () => {
            validateInputValue(input, validationType);
        });
        input.addEventListener('blur', () => {
            validateInputValue(input, validationType);
        });
        
        // 初期検証
        setTimeout(() => validateInputValue(input, validationType), 100);
    };

    // テーブルの行に応じた入力検証を設定
    const setupTableInputValidation = (row, tableBody) => {
        if (tableBody === elements.membersTable) {
            // 部材表：始点・終点の節点番号検証
            const startNodeInput = row.cells[1]?.querySelector('input');
            const endNodeInput = row.cells[2]?.querySelector('input');
            if (startNodeInput) setupInputValidation(startNodeInput, 'member-nodes');
            if (endNodeInput) setupInputValidation(endNodeInput, 'member-nodes');
            
            // 断面性能は正の値
            const iInput = row.cells[5]?.querySelector('input');
            const aInput = row.cells[6]?.querySelector('input');
            if (iInput) setupInputValidation(iInput, 'positive-number');
            if (aInput) setupInputValidation(aInput, 'positive-number');
            
        } else if (tableBody === elements.nodeLoadsTable) {
            // 節点荷重表：節点番号検証
            const nodeInput = row.cells[0]?.querySelector('input');
            if (nodeInput) setupInputValidation(nodeInput, 'node-reference');
            
        } else if (tableBody === elements.memberLoadsTable) {
            // 部材荷重表：部材番号検証
            const memberInput = row.cells[0]?.querySelector('input');
            if (memberInput) setupInputValidation(memberInput, 'member-reference');
        }
    };

    // 既存のテーブル行に入力検証を適用
    const initializeExistingInputValidation = () => {
        // 部材表の検証
        Array.from(elements.membersTable.rows).forEach(row => {
            setupTableInputValidation(row, elements.membersTable);
        });
        
        // 節点荷重表の検証
        Array.from(elements.nodeLoadsTable.rows).forEach(row => {
            setupTableInputValidation(row, elements.nodeLoadsTable);
        });
        
        // 部材荷重表の検証
        Array.from(elements.memberLoadsTable.rows).forEach(row => {
            setupTableInputValidation(row, elements.memberLoadsTable);
        });
    };

    const showSelectionChoiceMenu = (pageX, pageY, onSelectNodes, onSelectMembers) => {
        console.log('showSelectionChoiceMenu が呼び出されました:', { pageX, pageY });
        hideSelectionChoiceMenu();

        // 表示位置を調整して画面内に収まるようにする（マウス位置の近くに表示）
        const maxX = window.innerWidth - 280; // メニューの幅を考慮
        const maxY = window.innerHeight - 150; // メニューの高さを考慮
        const adjustedX = Math.min(Math.max(50, pageX), maxX);
        const adjustedY = Math.min(Math.max(50, pageY + 20), maxY); // マウス位置から少し下に表示
        
        console.log('メニュー位置調整:', { 
            original: { pageX, pageY }, 
            adjusted: { adjustedX, adjustedY },
            windowSize: { width: window.innerWidth, height: window.innerHeight }
        });

        const menu = document.createElement('div');
        menu.style.cssText = `
            position: fixed;
            top: ${adjustedY}px;
            left: ${adjustedX}px;
            transform: translate(-50%, 0px);
            background: #ffffff;
            border: 3px solid #007bff;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            padding: 16px 20px;
            z-index: 9999999;
            font-family: Arial, sans-serif;
            max-width: 260px;
            color: #333;
            min-width: 200px;
        `;

        const message = document.createElement('div');
        message.textContent = '節点と部材が両方含まれています。どちらを選択状態にしますか？';
        message.style.cssText = `
            margin-bottom: 10px;
            font-size: 14px;
            line-height: 1.4;
        `;
        menu.appendChild(message);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        `;

        const createButton = (label, color, handler) => {
            const button = document.createElement('button');
            button.textContent = label;
            button.style.cssText = `
                padding: 8px 10px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-size: 13px;
                transition: background 0.2s ease;
                color: #ffffff;
                background-color: ${color};
            `;
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                hideSelectionChoiceMenu();
                handler();
            });
            button.addEventListener('mouseenter', () => {
                button.style.filter = 'brightness(1.1)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.filter = 'none';
            });
            return button;
        };

        buttonContainer.appendChild(createButton('節点のみ', '#007bff', onSelectNodes));
        buttonContainer.appendChild(createButton('部材のみ', '#28a745', onSelectMembers));

        menu.appendChild(buttonContainer);

        menu.addEventListener('click', (event) => event.stopPropagation());

        selectionChoiceMenu = menu;
        document.body.appendChild(menu);
        console.log('選択メニューをDOMに追加しました:', menu);

        setTimeout(() => {
            const outsideHandler = () => hideSelectionChoiceMenu();
            document.addEventListener('click', outsideHandler, { once: true });
        }, 0);
    };

    const getSelectionRectangle = () => {
        const left = Math.min(multiSelectStart.x, multiSelectEnd.x);
        const right = Math.max(multiSelectStart.x, multiSelectEnd.x);
        const top = Math.min(multiSelectStart.y, multiSelectEnd.y);
        const bottom = Math.max(multiSelectStart.y, multiSelectEnd.y);
        return {
            left,
            right,
            top,
            bottom,
            width: Math.abs(right - left),
            height: Math.abs(bottom - top)
        };
    };

    const isPointInsideRect = (point, rect) => (
        point.x >= rect.left && point.x <= rect.right &&
        point.y >= rect.top && point.y <= rect.bottom
    );

    const segmentsIntersect = (p1, p2, q1, q2) => {
        const EPS = 1e-6;
        const orientation = (a, b, c) => {
            const val = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
            if (Math.abs(val) < EPS) return 0;
            return val > 0 ? 1 : 2;
        };
        const onSegment = (a, b, c) => (
            Math.min(a.x, c.x) - EPS <= b.x && b.x <= Math.max(a.x, c.x) + EPS &&
            Math.min(a.y, c.y) - EPS <= b.y && b.y <= Math.max(a.y, c.y) + EPS
        );

        const o1 = orientation(p1, p2, q1);
        const o2 = orientation(p1, p2, q2);
        const o3 = orientation(q1, q2, p1);
        const o4 = orientation(q1, q2, p2);

        if (o1 !== o2 && o3 !== o4) return true;
        if (o1 === 0 && onSegment(p1, q1, p2)) return true;
        if (o2 === 0 && onSegment(p1, q2, p2)) return true;
        if (o3 === 0 && onSegment(q1, p1, q2)) return true;
        if (o4 === 0 && onSegment(q1, p2, q2)) return true;
        return false;
    };

    const segmentIntersectsRect = (p1, p2, rect) => {
        const { left, right, top, bottom } = rect;
        if (Math.max(p1.x, p2.x) < left || Math.min(p1.x, p2.x) > right ||
            Math.max(p1.y, p2.y) < top || Math.min(p1.y, p2.y) > bottom) {
            return false;
        }
        if (isPointInsideRect(p1, rect) || isPointInsideRect(p2, rect)) {
            return true;
        }
        const rectPoints = [
            { x: left, y: top },
            { x: right, y: top },
            { x: right, y: bottom },
            { x: left, y: bottom }
        ];
        for (let i = 0; i < 4; i++) {
            const q1 = rectPoints[i];
            const q2 = rectPoints[(i + 1) % 4];
            if (segmentsIntersect(p1, p2, q1, q2)) {
                return true;
            }
        }
        return false;
    };

    const drawSelectionRectangle = (ctx) => {
        if (!isRangeSelecting || !isMultiSelecting) return;
        const rect = getSelectionRectangle();
        if (rect.width < 2 && rect.height < 2) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 123, 255, 0.9)';
        ctx.fillStyle = 'rgba(0, 123, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
        ctx.setLineDash([]);
        ctx.fillRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
        ctx.restore();
    };

    const finalizeRangeSelection = (event = null) => {
        console.log('finalizeRangeSelection開始');
        if (!lastDrawingContext) {
            console.log('lastDrawingContext が null のため終了');
            return;
        }
        const rect = getSelectionRectangle();
        console.log('選択範囲:', rect);
        if (rect.width < 3 && rect.height < 3) {
            console.log('選択範囲が小さすぎるため終了');
            return;
        }

        try {
            const { nodes, members } = parseInputs();
            console.log('parseInputs成功 - nodes:', nodes.length, 'members:', members.length);
            const nodesInRect = [];
            nodes.forEach((node, idx) => {
                const pos = lastDrawingContext.transform(node.x, node.y);
                if (isPointInsideRect(pos, rect)) {
                    nodesInRect.push(idx);
                    console.log('範囲内の節点:', idx, 'pos:', pos);
                }
            });

            const membersInRect = [];
            members.forEach((member, idx) => {
                const start = lastDrawingContext.transform(nodes[member.i].x, nodes[member.i].y);
                const end = lastDrawingContext.transform(nodes[member.j].x, nodes[member.j].y);
                if (segmentIntersectsRect(start, end, rect)) {
                    membersInRect.push(idx);
                    console.log('範囲内の部材:', idx, 'start:', start, 'end:', end);
                }
            });
            
            console.log('検出結果 - nodesInRect:', nodesInRect.length, 'membersInRect:', membersInRect.length);

            const additiveMode = rangeSelectionAdditive;
            const applySelection = (target) => {
                console.log('applySelection called with target:', target, 'additiveMode:', additiveMode);
                console.log('nodesInRect:', nodesInRect, 'membersInRect:', membersInRect);
                if (target === 'nodes') {
                    if (selectedMembers.size > 0) {
                        selectedMembers.clear();
                    }
                    if (!additiveMode) {
                        selectedNodes.clear();
                    }
                    nodesInRect.forEach(idx => {
                        if (additiveMode && selectedNodes.has(idx)) {
                            selectedNodes.delete(idx);
                        } else {
                            selectedNodes.add(idx);
                        }
                    });
                    console.log('nodes selected:', Array.from(selectedNodes));
                } else if (target === 'members') {
                    if (selectedNodes.size > 0) {
                        selectedNodes.clear();
                    }
                    if (!additiveMode) {
                        selectedMembers.clear();
                    }
                    membersInRect.forEach(idx => {
                        if (additiveMode && selectedMembers.has(idx)) {
                            selectedMembers.delete(idx);
                        } else {
                            selectedMembers.add(idx);
                        }
                    });
                    console.log('members selected:', Array.from(selectedMembers));
                }
                if (typeof drawOnCanvas === 'function') {
                    drawOnCanvas();
                }
            };

            if (!nodesInRect.length && !membersInRect.length) {
                console.log('範囲内に要素が見つからなかったため終了');
                return;
            }

            console.log('選択処理を開始 - nodesInRect:', nodesInRect, 'membersInRect:', membersInRect);
            console.log('現在の選択状態 - selectedNodes.size:', selectedNodes.size, 'selectedMembers.size:', selectedMembers.size);

            if (nodesInRect.length && membersInRect.length) {
                console.log('節点と部材の両方が検出されました');
                // 既存の選択状態に応じて優先的に選択するタイプを決定
                if (selectedNodes.size > 0 && selectedMembers.size === 0) {
                    console.log('既存の節点選択があるため節点を選択');
                    applySelection('nodes');
                } else if (selectedMembers.size > 0 && selectedNodes.size === 0) {
                    console.log('既存の部材選択があるため部材を選択');
                    applySelection('members');
                } else {
                    // 節点と部材の両方が含まれる場合は常に選択メニューを表示
                    console.log('節点と部材の両方が含まれるため選択メニューを表示');
                    // マウスの現在位置を取得（マウスアップ時の位置）
                    const pageX = event ? event.clientX : window.innerWidth / 2;
                    const pageY = event ? event.clientY : window.innerHeight / 2;
                    console.log('メニュー表示位置:', { pageX, pageY, eventType: event?.type });
                    showSelectionChoiceMenu(pageX, pageY, () => applySelection('nodes'), () => applySelection('members'));
                }
            } else if (nodesInRect.length) {
                applySelection('nodes');
            } else {
                applySelection('members');
            }
        } catch (error) {
            console.error('範囲選択の処理中にエラーが発生しました:', error);
        }
    };

    // 一括編集メニューを表示する関数
    const showBulkEditMenu = (pageX, pageY) => {
        console.log('showBulkEditMenu 関数が呼び出されました', { pageX, pageY, selectedMembers: Array.from(selectedMembers) });
        
        // 既存のすべてのメニューとポップアップを確実に隠す
        const existingMenu = document.getElementById('bulk-edit-menu');
        if (existingMenu) {
            console.log('既存のメニューを削除');
            existingMenu.remove();
        }
        
        // 他のコンテキストメニューとポップアップも隠す
        if (elements.nodeContextMenu) elements.nodeContextMenu.style.display = 'none';
        if (elements.memberPropsPopup) elements.memberPropsPopup.style.display = 'none';
        if (elements.nodeLoadPopup) elements.nodeLoadPopup.style.display = 'none';
        if (elements.nodeCoordsPopup) elements.nodeCoordsPopup.style.display = 'none';
        
        // ページ上のすべてのコンテキストメニューを隠す
        document.querySelectorAll('.context-menu').forEach(menu => {
            if (menu.id !== 'bulk-edit-menu') {
                menu.style.display = 'none';
            }
        });
        
        // 一括編集メニューを作成
        const menu = document.createElement('div');
        menu.id = 'bulk-edit-menu';
        // CSSクラスを使わずにすべてインラインスタイルで設定
        menu.style.cssText = `
            position: fixed !important;
            background-color: white !important;
            border: 2px solid #007bff !important;
            border-radius: 4px !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
            padding: 8px 0px !important;
            min-width: 200px !important;
            z-index: 999999 !important;
            font-size: 14px !important;
            font-family: Arial, sans-serif !important;
            display: block !important;
            visibility: visible !important;
            pointer-events: auto !important;
            opacity: 1 !important;
            transform: scale(1) !important;
            transition: none !important;
        `;
        
        console.log('メニュー要素を作成:', menu);
        
        const menuItem = document.createElement('div');
        menuItem.textContent = `選択した${selectedMembers.size}つの部材を一括編集...`;
        // CSSクラスを使わずにすべてインラインスタイルで設定
        menuItem.style.cssText = `
            padding: 10px 20px !important;
            cursor: pointer !important;
            font-size: 16px !important;
            font-weight: bold !important;
            color: #007bff !important;
            border-bottom: 1px solid #eee !important;
            transition: background-color 0.2s !important;
            display: block !important;
            width: 100% !important;
            box-sizing: border-box !important;
        `;
        
        console.log('メニューアイテムを作成:', menuItem);
        
        menuItem.addEventListener('click', () => {
            console.log('メニューアイテムがクリックされました');
            menu.remove();
            showBulkEditDialog();
        });
        
        menuItem.addEventListener('mouseover', () => {
            menuItem.style.backgroundColor = '#f0f0f0';
        });
        
        menuItem.addEventListener('mouseout', () => {
            menuItem.style.backgroundColor = 'white';
        });
        
        menu.appendChild(menuItem);
        
        // 確実にbodyの最後に追加
        console.log('body要素:', document.body);
        console.log('body要素の子要素数（追加前）:', document.body.children.length);
        document.body.appendChild(menu);
        console.log('body要素の子要素数（追加後）:', document.body.children.length);
        console.log('追加されたメニュー要素:', document.getElementById('bulk-edit-menu'));
        
        // メニューのサイズを取得してから位置を調整
        const menuRect = menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // マウス位置をクライアント座標に変換
        let menuLeft = pageX - window.scrollX;
        let menuTop = pageY - window.scrollY;
        
        // 画面からはみ出さないように調整
        if (menuLeft + menuRect.width > windowWidth) {
            menuLeft = windowWidth - menuRect.width - 10;
        }
        if (menuTop + menuRect.height > windowHeight) {
            menuTop = windowHeight - menuRect.height - 10;
        }
        if (menuLeft < 0) menuLeft = 10;
        if (menuTop < 0) menuTop = 10;
        
        menu.style.left = `${menuLeft}px`;
        menu.style.top = `${menuTop}px`;
        
        // アニメーション効果を無効化（デバッグのため）
        /*
        menu.style.opacity = '0';
        menu.style.transform = 'scale(0.8)';
        menu.style.transition = 'all 0.2s ease-out';
        
        // アニメーションを開始
        setTimeout(() => {
            menu.style.opacity = '1';
            menu.style.transform = 'scale(1)';
        }, 10);
        */
        
        console.log('メニューをDOMに追加しました。調整後の位置:', { 
            left: menu.style.left, 
            top: menu.style.top,
            originalPageX: pageX,
            originalPageY: pageY,
            windowSize: { width: windowWidth, height: windowHeight },
            menuSize: { width: menuRect.width, height: menuRect.height }
        });
        
        // メニュー外クリックで閉じる
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    };

    // 一括編集ダイアログを表示する関数
    const showBulkEditDialog = () => {
        console.log('一括編集ダイアログを表示:', Array.from(selectedMembers));
        
        // 既存のダイアログがあれば削除
        const existingDialog = document.getElementById('bulk-edit-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        // ダイアログを作成
        const dialog = document.createElement('div');
        dialog.id = 'bulk-edit-dialog';
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.backgroundColor = 'white';
        dialog.style.border = '2px solid #007bff';
        dialog.style.borderRadius = '8px';
        dialog.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        dialog.style.padding = '20px';
        dialog.style.minWidth = '400px';
        dialog.style.maxWidth = '90vw';
        dialog.style.maxHeight = '90vh';
        dialog.style.overflowY = 'auto';
        dialog.style.zIndex = '3000';
        
        dialog.innerHTML = `
            <h3>部材一括編集 (${selectedMembers.size}つの部材)</h3>
            <div style="margin-bottom: 15px;">
                <label><input type="checkbox" id="bulk-edit-e"> 弾性係数 E (N/mm²)</label>
                <div id="bulk-e-container" style="margin-left: 20px; display: none;"></div>
            </div>
            <div style="margin-bottom: 15px;">
                <label><input type="checkbox" id="bulk-edit-f"> 基準強度 F (N/mm²)</label>
                <div id="bulk-f-container" style="margin-left: 20px; display: none;"></div>
            </div>
            <div style="margin-bottom: 15px;">
                <label><input type="checkbox" id="bulk-edit-i"> 断面二次モーメント I (cm⁴)</label>
                <input type="number" id="bulk-i" style="margin-left: 20px; display: none;" step="0.01">
            </div>
            <div style="margin-bottom: 15px;">
                <label><input type="checkbox" id="bulk-edit-a"> 断面積 A (cm²)</label>
                <input type="number" id="bulk-a" style="margin-left: 20px; display: none;" step="0.01">
            </div>
            <div style="margin-bottom: 15px;">
                <label><input type="checkbox" id="bulk-edit-z"> 断面係数 Z (cm³)</label>
                <input type="number" id="bulk-z" style="margin-left: 20px; display: none;" step="0.01">
            </div>
            <div style="margin-bottom: 15px;">
                <label><input type="checkbox" id="bulk-edit-section"> 断面選択</label>
                <div id="bulk-section-container" style="margin-left: 20px; display: none;">
                    <button id="bulk-section-btn" style="padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">断面選択ツール</button>
                    <div id="bulk-section-info" style="margin-top: 5px; font-size: 12px; color: #666;"></div>
                </div>
            </div>
            <div style="margin-bottom: 15px;">
                <label><input type="checkbox" id="bulk-edit-i-conn"> 始端接合</label>
                <select id="bulk-i-conn" style="margin-left: 20px; display: none;">
                    <option value="rigid">剛接合</option>
                    <option value="pinned">ピン接合</option>
                </select>
            </div>
            <div style="margin-bottom: 15px;">
                <label><input type="checkbox" id="bulk-edit-j-conn"> 終端接合</label>
                <select id="bulk-j-conn" style="margin-left: 20px; display: none;">
                    <option value="rigid">剛接合</option>
                    <option value="pinned">ピン接合</option>
                </select>
            </div>
            <div style="margin-bottom: 15px;">
                <label><input type="checkbox" id="bulk-edit-load"> 等分布荷重</label>
                <div id="bulk-load-container" style="margin-left: 20px; display: none;">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <label>部材座標系y方向 w:</label>
                        <input type="number" id="bulk-load-w" step="0.01" placeholder="kN/m" style="width: 100px;">
                        <span style="font-size: 12px;">kN/m</span>
                    </div>
                </div>
            </div>
            <div style="margin-top: 20px; text-align: center;">
                <button id="bulk-apply-btn" style="margin-right: 10px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">適用</button>
                <button id="bulk-cancel-btn" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">キャンセル</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // チェックボックスの変更イベント
        dialog.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const targetId = checkbox.id.replace('bulk-edit-', 'bulk-');
                const targetElement = document.getElementById(targetId);
                const containerElement = document.getElementById(targetId + '-container');
                
                if (targetElement) {
                    targetElement.style.display = checkbox.checked ? 'inline-block' : 'none';
                } else if (containerElement) {
                    containerElement.style.display = checkbox.checked ? 'block' : 'none';
                    if (checkbox.checked && targetId === 'bulk-e') {
                        // E値選択UIを生成
                        containerElement.innerHTML = createEInputHTML('bulk-e', '205000');
                    } else if (checkbox.checked && targetId === 'bulk-f') {
                        // F値選択UIを生成
                        containerElement.appendChild(createStrengthInputHTML('steel', 'bulk-f'));
                    }
                }
            });
        });
        
        // 断面選択ボタンのイベントリスナー
        const sectionBtn = document.getElementById('bulk-section-btn');
        if (sectionBtn) {
            sectionBtn.addEventListener('click', () => {
                // 一括編集用の断面選択ツールを開く
                openBulkSectionSelector();
            });
        }
        
        // 断面選択ツール用のグローバル変数（一括編集用）
        window.bulkSectionProperties = null;
        
        // 一括編集用断面選択ツールを開く関数
        const openBulkSectionSelector = () => {
            const url = `steel_selector.html?targetMember=bulk&bulk=true`;
            const popup = window.open(url, 'BulkSteelSelector', 'width=1200,height=800,scrollbars=yes,resizable=yes');
            
            if (!popup) {
                alert('ポップアップブロッカーにより断面選択ツールを開けませんでした。ポップアップを許可してください。');
                return;
            }
            
            // ポップアップから戻った時の処理
            const checkPopup = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkPopup);
                    // localStorageから断面性能データを取得
                    const storedData = localStorage.getItem('steelSelectionForFrameAnalyzer');
                    if (storedData) {
                        try {
                            const data = JSON.parse(storedData);
                            if (data.targetMemberIndex === 'bulk' && data.properties) {
                                window.bulkSectionProperties = data.properties;
                                updateBulkSectionInfo(data.properties);
                                localStorage.removeItem('steelSelectionForFrameAnalyzer');
                            }
                        } catch (e) {
                            console.error('断面選択データの解析エラー:', e);
                        }
                    }
                }
            }, 500);
        };
        
        // 一括編集の断面情報表示を更新
        const updateBulkSectionInfo = (properties) => {
            const infoElement = document.getElementById('bulk-section-info');
            if (infoElement && properties) {
                infoElement.textContent = `選択済み: I=${properties.I}cm⁴, A=${properties.A}cm², Z=${properties.Z}cm³`;
                infoElement.style.color = '#28a745';
            }
        };
        
        // 適用ボタンのイベント
        document.getElementById('bulk-apply-btn').addEventListener('click', () => {
            applyBulkEdit();
            dialog.remove();
        });
        
        // キャンセルボタンのイベント
        document.getElementById('bulk-cancel-btn').addEventListener('click', () => {
            dialog.remove();
        });
    };

    // 一括編集を適用する関数
    const applyBulkEdit = () => {
        console.log('一括編集を適用開始');
        
        const updates = {};
        
        // チェックされた項目を収集
        if (document.getElementById('bulk-edit-e').checked) {
            const eSelect = document.getElementById('bulk-e-select');
            const eInput = document.getElementById('bulk-e-input');
            updates.E = eSelect && eInput ? (eSelect.value === 'custom' ? eInput.value : eSelect.value) : null;
        }
        
        if (document.getElementById('bulk-edit-i').checked) {
            updates.I = document.getElementById('bulk-i').value;
        }
        
        if (document.getElementById('bulk-edit-a').checked) {
            updates.A = document.getElementById('bulk-a').value;
        }
        
        if (document.getElementById('bulk-edit-z').checked) {
            updates.Z = document.getElementById('bulk-z').value;
        }
        
        if (document.getElementById('bulk-edit-i-conn').checked) {
            updates.i_conn = document.getElementById('bulk-i-conn').value;
        }
        
        if (document.getElementById('bulk-edit-j-conn').checked) {
            updates.j_conn = document.getElementById('bulk-j-conn').value;
        }
        
        // 断面選択の処理
        if (document.getElementById('bulk-edit-section').checked && window.bulkSectionProperties) {
            updates.sectionProperties = window.bulkSectionProperties;
        }
        
        // 等分布荷重の処理
        if (document.getElementById('bulk-edit-load').checked) {
            const w = document.getElementById('bulk-load-w').value;
            if (w) {
                updates.memberLoad = {
                    w: parseFloat(w)
                };
            }
        }
        
        console.log('一括編集内容:', updates);
        
        // 選択された部材に変更を適用
        pushState(); // 変更前の状態を保存
        
        for (const memberIndex of selectedMembers) {
            const row = elements.membersTable.rows[memberIndex];
            if (!row) continue;
            
            // E値の更新
            if (updates.E) {
                const eSelect = row.cells[3].querySelector('select');
                const eInput = row.cells[3].querySelector('input[type="number"]');
                if (eSelect && eInput) {
                    eSelect.value = Array.from(eSelect.options).some(opt => opt.value === updates.E) ? updates.E : 'custom';
                    eInput.value = updates.E;
                    eInput.readOnly = eSelect.value !== 'custom';
                    eSelect.dispatchEvent(new Event('change'));
                }
            }
            
            // 断面性能の更新
            if (updates.I) row.cells[5].querySelector('input').value = updates.I;
            if (updates.A) row.cells[6].querySelector('input').value = updates.A;
            if (updates.Z) row.cells[7].querySelector('input').value = updates.Z;
            
            // 断面選択による断面性能の一括更新
            if (updates.sectionProperties) {
                if (updates.sectionProperties.I) row.cells[5].querySelector('input').value = updates.sectionProperties.I;
                if (updates.sectionProperties.A) row.cells[6].querySelector('input').value = updates.sectionProperties.A;
                if (updates.sectionProperties.Z) row.cells[7].querySelector('input').value = updates.sectionProperties.Z;
                
                // 追加の断面性能をデータ属性として保存
                if (updates.sectionProperties.Zx) row.dataset.zx = updates.sectionProperties.Zx;
                if (updates.sectionProperties.Zy) row.dataset.zy = updates.sectionProperties.Zy;
                if (updates.sectionProperties.ix) row.dataset.ix = updates.sectionProperties.ix;
                if (updates.sectionProperties.iy) row.dataset.iy = updates.sectionProperties.iy;

                if (updates.sectionProperties.sectionInfo) {
                    setRowSectionInfo(row, updates.sectionProperties.sectionInfo);
                }

                if (Object.prototype.hasOwnProperty.call(updates.sectionProperties, 'sectionAxis')) {
                    applySectionAxisDataset(row, updates.sectionProperties.sectionAxis);
                } else if (updates.sectionProperties.sectionInfo && updates.sectionProperties.sectionInfo.axis) {
                    applySectionAxisDataset(row, updates.sectionProperties.sectionInfo.axis);
                }
            }
            
            // 接合条件の更新 - 密度列を考慮したインデックス調整
            const hasDensityColumn = row.querySelector('.density-cell') !== null;
            // 基本列(7) + 密度列(0or1) + 断面名称列(1) + 軸方向列(1) + 接続列(2)
            const iConnIndex = hasDensityColumn ? 12 : 11; // 始端のインデックス
            const jConnIndex = hasDensityColumn ? 13 : 12; // 終端のインデックス

            if (updates.i_conn) row.cells[iConnIndex].querySelector('select').value = updates.i_conn;
            if (updates.j_conn) row.cells[jConnIndex].querySelector('select').value = updates.j_conn;
            
            // 等分布荷重の処理
            if (updates.memberLoad) {
                // 既存の部材荷重を検索
                const existingLoadRow = Array.from(elements.memberLoadsTable.rows).find(loadRow => {
                    const memberInput = loadRow.cells[0].querySelector('input');
                    return parseInt(memberInput.value) - 1 === memberIndex;
                });
                
                if (existingLoadRow) {
                    // 既存の荷重を更新（部材座標系y方向のw値）
                    existingLoadRow.cells[1].querySelector('input').value = updates.memberLoad.w;
                } else {
                    // 新しい部材荷重を追加
                    if (updates.memberLoad.w !== 0) {
                        const newLoadRow = elements.memberLoadsTable.insertRow();
                        newLoadRow.innerHTML = `
                            <td><input type="number" value="${memberIndex + 1}" min="1"></td>
                            <td><input type="number" value="${updates.memberLoad.w}" step="0.01"></td>
                            <td><button class="delete-row-btn">×</button></td>
                        `;
                        
                        // 削除ボタンのイベントリスナーを追加
                        const deleteBtn = newLoadRow.querySelector('.delete-row-btn');
                        deleteBtn.onclick = () => {
                            pushState();
                            newLoadRow.remove();
                            if (typeof drawOnCanvas === 'function') {
                                drawOnCanvas();
                            }
                        };
                        
                        // 入力変更時の再描画
                        newLoadRow.querySelectorAll('input').forEach(input => {
                            input.addEventListener('change', () => {
                                if (typeof drawOnCanvas === 'function') {
                                    drawOnCanvas();
                                }
                            });
                        });
                    }
                }
            }
        }
        
        // 表示を更新
        if (typeof drawOnCanvas === 'function') {
            drawOnCanvas();
        }
        
        console.log(`${selectedMembers.size}つの部材に一括編集を適用しました`);
        
        // 成功メッセージを表示
        const message = document.createElement('div');
        message.style.position = 'fixed';
        message.style.top = '20px';
        message.style.right = '20px';
        message.style.background = '#28a745';
        message.style.color = 'white';
        message.style.padding = '10px 15px';
        message.style.borderRadius = '4px';
        message.style.zIndex = '4000';
        message.textContent = `${selectedMembers.size}つの部材を一括編集しました`;
        document.body.appendChild(message);
        
        setTimeout(() => message.remove(), 3000);
    };

    // 節点一括編集メニュー表示関数
    const showBulkNodeEditMenu = (pageX, pageY) => {
        // 既存のすべてのメニューとポップアップを確実に隠す
        const existingMenu = document.getElementById('bulk-node-edit-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // 他のコンテキストメニューとポップアップも隠す
        if (elements.nodeContextMenu) elements.nodeContextMenu.style.display = 'none';
        if (elements.memberPropsPopup) elements.memberPropsPopup.style.display = 'none';
        if (elements.nodeLoadPopup) elements.nodeLoadPopup.style.display = 'none';
        if (elements.nodeCoordsPopup) elements.nodeCoordsPopup.style.display = 'none';
        
        // 節点一括編集メニューを作成
        const menu = document.createElement('div');
        menu.id = 'bulk-node-edit-menu';
        menu.style.cssText = `
            position: fixed !important;
            background-color: white !important;
            border: 1px solid #ccc !important;
            border-radius: 6px !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2) !important;
            padding: 4px 0px !important;
            z-index: 9999999 !important;
            min-width: 180px !important;
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
        `;
        
        const menuItem = document.createElement('div');
        menuItem.style.cssText = `
            padding: 10px 16px;
            cursor: pointer;
            background-color: white !important;
            color: #333 !important;
            font-size: 14px !important;
        `;
        menuItem.textContent = '選択した節点を一括編集';
        
        menuItem.addEventListener('mouseover', () => {
            menuItem.style.backgroundColor = '#f0f8ff';
        });
        
        menuItem.addEventListener('mouseout', () => {
            menuItem.style.backgroundColor = 'white';
        });
        
        menuItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // メニューを削除
            if (document.getElementById('bulk-node-edit-menu')) {
                document.getElementById('bulk-node-edit-menu').remove();
            }
            
            // ダイアログを表示
            window.showBulkNodeEditDialog();
        });
        menu.appendChild(menuItem);
        document.body.appendChild(menu);
        
        // メニューのサイズを取得してから位置を調整（部材一括編集と同じ方式）
        const menuRect = menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // マウス位置をクライアント座標に変換
        let menuLeft = pageX - window.scrollX;
        let menuTop = pageY - window.scrollY;
        
        // 画面からはみ出さないように調整
        if (menuLeft + menuRect.width > windowWidth) {
            menuLeft = windowWidth - menuRect.width - 10;
        }
        if (menuTop + menuRect.height > windowHeight) {
            menuTop = windowHeight - menuRect.height - 10;
        }
        if (menuLeft < 0) menuLeft = 10;
        if (menuTop < 0) menuTop = 10;
        
        menu.style.left = `${menuLeft}px`;
        menu.style.top = `${menuTop}px`;
        
        console.log('メニュー位置設定:', {
            mouse: { x: pageX, y: pageY },
            client: { x: pageX - window.scrollX, y: pageY - window.scrollY },
            menuRect: { width: menuRect.width, height: menuRect.height },
            final: { x: menuLeft, y: menuTop }
        });
        
        // メニュー外クリックで閉じる
        const closeMenu = (event) => {
            if (!menu.contains(event.target)) {
                if (document.body.contains(menu)) {
                    document.body.removeChild(menu);
                }
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 200);
    };

    // 節点一括編集ダイアログ表示関数
    const showBulkNodeEditDialog = () => {
        // 既存のダイアログがあれば削除
        const existingDialog = document.getElementById('bulk-node-edit-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        const dialog = document.createElement('div');
        dialog.id = 'bulk-node-edit-dialog';
        dialog.style.cssText = `
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 20px;
            z-index: 10001;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            min-width: 400px;
            max-height: 80vh;
            overflow-y: auto;
            font-family: Arial, sans-serif;
        `;
        
        dialog.innerHTML = `
            <h3>節点一括編集 (${selectedNodes.size}個の節点)</h3>
            
            <div style="margin-bottom: 15px;">
                <label><input type="checkbox" id="bulk-edit-coords"> 座標</label>
                <div id="bulk-coords-container" style="margin-left: 20px; display: none;">
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 5px;">
                        <label style="min-width: 50px;">X座標:</label>
                        <select id="bulk-coord-x-mode" style="width: 80px;">
                            <option value="set">設定</option>
                            <option value="add">加算</option>
                        </select>
                        <input type="number" id="bulk-coord-x" step="0.01" placeholder="m" style="width: 100px;">
                        <span style="font-size: 12px;">m</span>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <label style="min-width: 50px;">Y座標:</label>
                        <select id="bulk-coord-y-mode" style="width: 80px;">
                            <option value="set">設定</option>
                            <option value="add">加算</option>
                        </select>
                        <input type="number" id="bulk-coord-y" step="0.01" placeholder="m" style="width: 100px;">
                        <span style="font-size: 12px;">m</span>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label><input type="checkbox" id="bulk-edit-support"> 境界条件</label>
                <div id="bulk-support-container" style="margin-left: 20px; display: none;">
                    <select id="bulk-support-type" style="width: 150px;">
                        <option value="free">自由</option>
                        <option value="pinned">ピン</option>
                        <option value="fixed">固定</option>
                        <option value="roller">ローラー</option>
                    </select>
                </div>
            </div>
            
            <div class="dialog-buttons" style="margin-top: 20px; text-align: right;">
                <button onclick="window.applyBulkNodeEdit()" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-right: 10px; cursor: pointer;">適用</button>
                <button onclick="document.body.removeChild(document.getElementById('bulk-node-edit-dialog'))" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">キャンセル</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        console.log('節点一括編集ダイアログが作成されました');
        
        // チェックボックスのイベントリスナーを追加
        document.getElementById('bulk-edit-coords').addEventListener('change', function() {
            document.getElementById('bulk-coords-container').style.display = this.checked ? 'block' : 'none';
        });
        
        document.getElementById('bulk-edit-support').addEventListener('change', function() {
            document.getElementById('bulk-support-container').style.display = this.checked ? 'block' : 'none';
        });
    };

    // ウィンドウオブジェクトに関数をアタッチ
    window.showBulkNodeEditDialog = showBulkNodeEditDialog;

    // 節点一括編集適用関数
    const applyBulkNodeEdit = () => {
        const updates = {};
        
        // 座標の処理
        if (document.getElementById('bulk-edit-coords').checked) {
            const xMode = document.getElementById('bulk-coord-x-mode').value;
            const yMode = document.getElementById('bulk-coord-y-mode').value;
            const x = document.getElementById('bulk-coord-x').value;
            const y = document.getElementById('bulk-coord-y').value;
            
            if (x) {
                updates.coordX = { mode: xMode, value: parseFloat(x) };
            }
            if (y) {
                updates.coordY = { mode: yMode, value: parseFloat(y) };
            }
        }
        
        // 境界条件の処理
        if (document.getElementById('bulk-edit-support').checked) {
            updates.support = document.getElementById('bulk-support-type').value;
        }
        
        console.log('節点一括編集内容:', updates);
        
        // 選択された節点に変更を適用
        pushState(); // 変更前の状態を保存
        
        const editedCount = selectedNodes.size;
        for (const nodeIndex of selectedNodes) {
            const row = elements.nodesTable.rows[nodeIndex];
            if (!row) continue;
            // 座標の更新
            if (updates.coordX) {
                const currentX = parseFloat(row.cells[1].querySelector('input').value);
                const newX = updates.coordX.mode === 'set' ? 
                    updates.coordX.value : 
                    currentX + updates.coordX.value;
                row.cells[1].querySelector('input').value = newX.toFixed(2);
            }
            if (updates.coordY) {
                const currentY = parseFloat(row.cells[2].querySelector('input').value);
                const newY = updates.coordY.mode === 'set' ? 
                    updates.coordY.value : 
                    currentY + updates.coordY.value;
                row.cells[2].querySelector('input').value = newY.toFixed(2);
            }
            // 境界条件の更新
            if (updates.support) {
                row.cells[3].querySelector('select').value = updates.support;
            }
        }
        if (typeof drawOnCanvas === 'function') {
            drawOnCanvas();
        }
        document.body.removeChild(document.getElementById('bulk-node-edit-dialog'));
        clearMultiSelection(); // 編集後に選択をクリア
        // 成功メッセージを表示
        const message = document.createElement('div');
        message.style.position = 'fixed';
        message.style.top = '20px';
        message.style.right = '20px';
        message.style.background = '#28a745';
        message.style.color = 'white';
        message.style.padding = '10px 15px';
        message.style.borderRadius = '4px';
        message.style.zIndex = '4000';
        message.textContent = `${editedCount}つの節点を一括編集しました`;
        document.body.appendChild(message);
        setTimeout(() => message.remove(), 3000);
    };

    // ウィンドウオブジェクトに関数をアタッチ
    window.applyBulkNodeEdit = applyBulkNodeEdit;
    
    // --- Matrix Math Library ---
    const mat = {
        create: (rows, cols, value = 0) => Array(rows).fill().map(() => Array(cols).fill(value)),
        
        multiply: (A, B) => {
            // undefinedチェックを追加
            if (!A || !B || !A.length || !B[0] || !B[0].length) {
                console.error('Matrix multiply: Invalid matrices', { A, B });
                return null;
            }
            const C = mat.create(A.length, B[0].length);
            for (let i = 0; i < A.length; i++) {
                for (let j = 0; j < B[0].length; j++) {
                    for (let k = 0; k < A[0].length; k++) {
                        C[i][j] += A[i][k] * B[k][j];
                    }
                }
            }
            return C;
        },
        
        transpose: (A) => {
            if (!A || !A[0]) return null;
            return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
        },
        
        add: (A, B) => {
            if (!A || !B || A.length !== B.length) return null;
            return A.map((row, i) => row.map((val, j) => val + B[i][j]));
        },
        
        subtract: (A, B) => {
            if (!A || !B || A.length !== B.length) return null;
            return A.map((row, i) => row.map((val, j) => val - B[i][j]));
        },
        
        solve: (A, b) => {
            if (!A || !b || !A.length) return null;
            const n = A.length;
            const aug = A.map((row, i) => [...row, b[i][0]]);
            for (let i = 0; i < n; i++) {
                let maxRow = i;
                for (let k = i + 1; k < n; k++) {
                    if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
                }
                [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
                if (aug[i][i] === 0) continue;
                for (let k = i + 1; k < n; k++) {
                    const factor = aug[k][i] / aug[i][i];
                    for (let j = i; j < n + 1; j++) aug[k][j] -= factor * aug[i][j];
                }
            }
            const x = mat.create(n, 1);
            for (let i = n - 1; i >= 0; i--) {
                let sum = 0;
                for (let j = i + 1; j < n; j++) sum += aug[i][j] * x[j][0];
                if (aug[i][i] === 0 && aug[i][n] - sum !== 0) return null;
                x[i][0] = aug[i][i] === 0 ? 0 : (aug[i][n] - sum) / aug[i][i];
            }
            return x;
        }
    };
    
    // --- State and History Management ---
    const getCurrentState = () => {
        const state = { nodes: [], members: [], nodeLoads: [], memberLoads: [] };
        Array.from(elements.nodesTable.rows).forEach(row => {
            state.nodes.push({
                x: row.cells[1].querySelector('input').value,
                y: row.cells[2].querySelector('input').value,
                support: row.cells[3].querySelector('select').value,
                dx_forced: row.cells[4]?.querySelector('input')?.value || 0,
                dy_forced: row.cells[5]?.querySelector('input')?.value || 0,
                r_forced: row.cells[6]?.querySelector('input')?.value || 0
            });
        });
        Array.from(elements.membersTable.rows).forEach(row => {
            const e_select = row.cells[3].querySelector('select');
            const e_input = row.cells[3].querySelector('input[type="number"]');
            const strengthInputContainer = row.cells[4].firstElementChild;
            const strengthType = strengthInputContainer.dataset.strengthType;
            let strengthValue;
            if (strengthType === 'F-value' || strengthType === 'Fc' || strengthType === 'F-stainless' || strengthType === 'F-aluminum') {
                strengthValue = strengthInputContainer.querySelector('input').value;
            } else if (strengthType === 'wood-type') {
                strengthValue = strengthInputContainer.querySelector('select').value;
            }

            state.members.push({
                i: row.cells[1].querySelector('input').value,
                j: row.cells[2].querySelector('input').value,
                E: e_select.value === 'custom' ? e_input.value : e_select.value,
                strengthType: strengthType,
                strengthValue: strengthValue,
                I: row.cells[5].querySelector('input').value,
                A: row.cells[6].querySelector('input').value,
                Z: row.cells[7].querySelector('input').value,
            });
            
            // 接合条件の取得 - 動的にselect要素を検索
            const cellCount = row.cells.length;
            const lastCellIndex = cellCount - 1; // 削除ボタン
            
            let iConnIndex = -1, jConnIndex = -1;
            let selectCount = 0;
            for (let i = lastCellIndex - 1; i >= 0; i--) {
                const cell = row.cells[i];
                if (cell && cell.querySelector('select')) {
                    selectCount++;
                    if (selectCount === 1) {
                        jConnIndex = i; // 最初に見つかったselectは終端接続
                    } else if (selectCount === 2) {
                        iConnIndex = i; // 2番目に見つかったselectは始端接続
                        break;
                    }
                }
            }
            
            // 接合条件を追加（安全な取得）
            const currentMember = state.members[state.members.length - 1];
            const iConnSelect = iConnIndex >= 0 ? row.cells[iConnIndex]?.querySelector('select') : null;
            const jConnSelect = jConnIndex >= 0 ? row.cells[jConnIndex]?.querySelector('select') : null;
            currentMember.i_conn = iConnSelect?.value || 'rigid';
            currentMember.j_conn = jConnSelect?.value || 'rigid';
            currentMember.Zx = row.dataset.zx;
            currentMember.Zy = row.dataset.zy;
            currentMember.ix = row.dataset.ix;
            currentMember.iy = row.dataset.iy;

            // 断面情報と軸設定を保存
            const sectionInfoEncoded = row.dataset.sectionInfo;
            let sectionInfo = null;
            if (sectionInfoEncoded) {
                try {
                    sectionInfo = JSON.parse(decodeURIComponent(sectionInfoEncoded));
                } catch (error) {
                    console.warn('Failed to parse sectionInfo from dataset:', error);
                }
            }

            const resolveAxisInfo = () => {
                const datasetAxis = normalizeAxisInfo({
                    key: row.dataset.sectionAxisKey,
                    mode: row.dataset.sectionAxisMode,
                    label: row.dataset.sectionAxisLabel
                });

                if (datasetAxis) {
                    return datasetAxis;
                }

                if (sectionInfo && sectionInfo.axis) {
                    return normalizeAxisInfo(sectionInfo.axis);
                }

                return null;
            };

            const sectionAxis = resolveAxisInfo();

            currentMember.sectionInfo = sectionInfo || null;
            currentMember.sectionInfoEncoded = sectionInfoEncoded || '';
            currentMember.sectionLabel = row.dataset.sectionLabel || sectionInfo?.label || '';
            currentMember.sectionSummary = row.dataset.sectionSummary || sectionInfo?.dimensionSummary || '';
            currentMember.sectionSource = row.dataset.sectionSource || sectionInfo?.source || '';
            currentMember.sectionAxis = sectionAxis;
            currentMember.sectionAxisKey = sectionAxis?.key || '';
            currentMember.sectionAxisMode = sectionAxis?.mode || '';
            currentMember.sectionAxisLabel = sectionAxis?.label || '';
        });
        Array.from(elements.nodeLoadsTable.rows).forEach(row => {
            state.nodeLoads.push({ node: row.cells[0].querySelector('input').value, px: row.cells[1].querySelector('input').value, py: row.cells[2].querySelector('input').value, mz: row.cells[3].querySelector('input').value });
        });
        Array.from(elements.memberLoadsTable.rows).forEach(row => {
            state.memberLoads.push({ member: row.cells[0].querySelector('input').value, w: row.cells[1].querySelector('input').value });
        });
        return state;
    };

    const pushState = () => { historyStack.push(getCurrentState()); };

    const restoreState = (state) => {
        if (!state) return;
        
        const safeDecode = (value) => {
            if (typeof value !== 'string' || value.length === 0) return value || '';
            try {
                return decodeURIComponent(value);
            } catch (error) {
                return value;
            }
        };

        const parseSectionInfo = (member) => {
            if (!member) return null;
            if (member.sectionInfo && typeof member.sectionInfo === 'object' && !Array.isArray(member.sectionInfo)) {
                return ensureSectionSvgMarkup(cloneDeep(member.sectionInfo));
            }

            let encoded = '';
            if (typeof member.sectionInfo === 'string' && member.sectionInfo.trim()) {
                encoded = member.sectionInfo.trim();
            } else if (typeof member.sectionInfoEncoded === 'string' && member.sectionInfoEncoded.trim()) {
                encoded = member.sectionInfoEncoded.trim();
            }

            if (!encoded) return null;

            const decoded = safeDecode(encoded);
            try {
                const parsed = JSON.parse(decoded);
                return parsed && typeof parsed === 'object' ? ensureSectionSvgMarkup(parsed) : null;
            } catch (error) {
                console.warn('Failed to parse sectionInfo during restoreState:', error, member);
                return null;
            }
        };
        const toNumberOrDefault = (value, defaultValue = 0) => {
            const num = typeof value === 'number' ? value : parseFloat(value);
            return Number.isFinite(num) ? num : defaultValue;
        };

        try {
            elements.nodesTable.innerHTML = '';
            elements.membersTable.innerHTML = '';
            elements.nodeLoadsTable.innerHTML = '';
            elements.memberLoadsTable.innerHTML = '';
            
            // 節点復元
            state.nodes.forEach((n, index) => {
                // 節点データのログ出力
                console.log(`🔍 復元中の節点 ${index + 1}:`, {
                    x: n.x,
                    y: n.y,
                    support: n.support,
                    dx_forced: n.dx_forced,
                    dy_forced: n.dy_forced,
                    r_forced: n.r_forced
                });
                
                // 境界条件の詳細チェック
                console.log(`🔍 節点 ${index + 1} 境界条件詳細チェック:`, {
                    support: n.support,
                    supportStringified: JSON.stringify(n.support),
                    type: typeof n.support,
                    length: n.support ? n.support.length : 'undefined',
                    isFree: n.support === 'free',
                    isPinned: n.support === 'pinned', 
                    isFixed: n.support === 'fixed',
                    isRoller: n.support === 'roller'
                });
                console.log(`🔍 節点 ${index + 1} 境界条件値: "${n.support}"`);
                
                // select要素のHTMLをログ出力
                const selectHTML = `<select><option value="free"${n.support==='free'?' selected':''}>自由</option><option value="pinned"${n.support==='pinned'?' selected':''}>ピン</option><option value="fixed"${n.support==='fixed'?' selected':''}>固定</option><option value="roller"${n.support==='roller'?' selected':''}>ローラー</option></select>`;
                console.log(`🔍 節点 ${index + 1} のselect要素HTML:`, selectHTML);
                
                addRow(elements.nodesTable, [
                    `#`, 
                    `<input type="number" value="${n.x}">`, 
                    `<input type="number" value="${n.y}">`, 
                    `<select><option value="free"${n.support==='free'?' selected':''}>自由</option><option value="pinned"${n.support==='pinned'?' selected':''}>ピン</option><option value="fixed"${n.support==='fixed'?' selected':''}>固定</option><option value="roller"${n.support==='roller'?' selected':''}>ローラー</option></select>`, 
                    `<input type="number" value="${n.dx_forced || 0}" step="0.1">`, 
                    `<input type="number" value="${n.dy_forced || 0}" step="0.1">`, 
                    `<input type="number" value="${n.r_forced || 0}" step="0.001">`
                ], false);
                
                // 作成されたselect要素の実際の値を確認
                const lastRow = elements.nodesTable.rows[elements.nodesTable.rows.length - 1];
                if (lastRow && lastRow.cells[3]) {
                    const selectElement = lastRow.cells[3].querySelector('select');
                    if (selectElement) {
                        console.log(`🔍 節点 ${index + 1} の実際のselect値:`, selectElement.value);
                    }
                }
            });
            
            // 部材復元
            state.members.forEach(m => {
                try {
                    const I_m4 = toNumberOrDefault(m.I) * 1e-8;
                    const A_m2 = toNumberOrDefault(m.A) * 1e-4;
                    const Z_m3 = toNumberOrDefault(m.Z) * 1e-6;
                    
                    // memberRowHTML の戻り値を安全に取得
                    const memberHTML = memberRowHTML(m.i, m.j, m.E, "235", I_m4, A_m2, Z_m3, m.i_conn, m.j_conn);
                    if (!memberHTML || !Array.isArray(memberHTML)) {
                        console.warn('memberRowHTML returned invalid data:', memberHTML);
                        return;
                    }
                    
                    const newRow = addRow(elements.membersTable, [`#`, ...memberHTML], false);
                    
                    if (newRow && newRow.cells && newRow.cells.length > 4) {
                        // 弾性係数の復元
                        const eSelect = newRow.cells[3] ? newRow.cells[3].querySelector('select') : null;
                        if (eSelect) {
                            eSelect.value = m.E === 'custom' ? 'custom' : m.E;
                            eSelect.dispatchEvent(new Event('change')); // Trigger update
                        }
                        
                        // 降伏強度の復元
                        const strengthCell = newRow.cells[4];
                        if (strengthCell) {
                            const strengthInputContainer = strengthCell.firstElementChild;
                            if (strengthInputContainer) {
                                if (m.strengthType === 'F-value' || m.strengthType === 'Fc' || m.strengthType === 'F-stainless' || m.strengthType === 'F-aluminum') {
                                    const strengthInput = strengthInputContainer.querySelector('input');
                                    if (strengthInput) strengthInput.value = m.strengthValue;
                                    const strengthSelect = strengthInputContainer.querySelector('select');
                                    if (strengthSelect) strengthSelect.value = 'custom';
                                } else if (m.strengthType === 'wood-type') {
                                    const strengthSelect = strengthInputContainer.querySelector('select');
                                    if (strengthSelect) strengthSelect.value = m.strengthValue;
                                }
                            }
                        }

                        // その他のデータ復元
                        if(m.Zx) newRow.dataset.zx = m.Zx;
                        if(m.Zy) newRow.dataset.zy = m.Zy;
                        if(m.ix) newRow.dataset.ix = m.ix;
                        if(m.iy) newRow.dataset.iy = m.iy;

                        // 断面情報と軸情報を復元
                        let sectionInfoToApply = parseSectionInfo(m);
                        const decodedLabel = safeDecode(m.sectionLabel || '');
                        const decodedSummary = safeDecode(m.sectionSummary || '');
                        const decodedSource = safeDecode(m.sectionSource || '');

                        if (!sectionInfoToApply && (decodedLabel || decodedSummary || decodedSource)) {
                            sectionInfoToApply = {};
                            if (decodedLabel) sectionInfoToApply.label = decodedLabel;
                            if (decodedSummary) sectionInfoToApply.dimensionSummary = decodedSummary;
                            if (decodedSource) sectionInfoToApply.source = decodedSource;
                        }

                        const axisInfo = buildAxisInfo(m, sectionInfoToApply);
                        if (axisInfo) {
                            if (!sectionInfoToApply) sectionInfoToApply = {};
                            sectionInfoToApply.axis = { ...axisInfo };
                        }

                        if (sectionInfoToApply) {
                            setRowSectionInfo(newRow, sectionInfoToApply);
                        } else if (axisInfo) {
                            applySectionAxisDataset(newRow, axisInfo);
                        } else {
                            // 念のため既存のデータセットをクリア
                            applySectionAxisDataset(newRow, null);
                        }
                    }
                } catch (memberError) {
                    console.error('Error restoring member:', memberError, m);
                }
            });
            
            // 節点荷重復元
            state.nodeLoads.forEach(l => addRow(elements.nodeLoadsTable, [`<input type="number" value="${l.node}">`, `<input type="number" value="${l.px}">`, `<input type="number" value="${l.py}">`, `<input type="number" value="${l.mz}">`], false));
            
            // 部材荷重復元
            state.memberLoads.forEach(l => addRow(elements.memberLoadsTable, [`<input type="number" value="${l.member}">`, `<input type="number" value="${l.w}">`], false));
            
            renumberTables();
            if (typeof drawOnCanvas === 'function') {
                drawOnCanvas();
            }
        } catch (error) {
            console.error('Error in restoreState:', error);
            alert('元に戻す処理中にエラーが発生しました。コンソールで詳細を確認してください。');
        }
    };
    
    elements.undoBtn.onclick = () => { if (historyStack.length > 0) { const lastState = historyStack.pop(); if(lastState) restoreState(lastState); } };
    
    // Make state management functions globally accessible
    window.pushState = pushState;
    window.restoreState = restoreState;
    window.getCurrentState = getCurrentState;
    
    /**
     * テーブル行の基本構造を作成
     * @param {HTMLTableSectionElement} tableBody - 対象のテーブルボディ
     * @param {Array} cells - セルの内容配列
     * @returns {HTMLTableRowElement} 作成された行要素
     */
    const createTableRow = (tableBody, cells) => {
        const newRow = tableBody.insertRow();
        cells.forEach(cellHTML => { 
            const cell = newRow.insertCell(); 
            cell.innerHTML = cellHTML; 
        });
        
        // 削除ボタンセルを追加
        const deleteCell = newRow.insertCell();
        deleteCell.innerHTML = '<button class="delete-row-btn">×</button>';
        
        return newRow;
    };

    /**
     * 部材テーブル用の特別な設定を適用
     * @param {HTMLTableRowElement} row - 設定対象の行
     */
    const setupMemberRowSpecialFeatures = (row) => {
        // 断面算定関連のクラスを追加
        row.cells[4].classList.add('section-check-item');
        row.cells[7].classList.add('section-check-item');
        
        // 断面選択ボタンを始端selectの直前に挿入
        // 現在の構造: [#, 始点, 終点, E, 強度, I, A, Z, (密度), 始端, 終端, 削除]
        // 挿入後の構造: [#, 始点, 終点, E, 強度, I, A, Z, (密度), 断面選択, 始端, 終端, 削除]
        
        // 密度セルの存在を確認
        const hasDensityColumn = row.querySelector('.density-cell') !== null;
        
        // 始端selectのインデックスを計算（削除ボタンから逆算）
        // 削除ボタン(-1) ← 終端select(-2) ← 始端select(-3) ← ここに挿入
        const connectionStartIndex = row.cells.length - 3;
        
        const selectCell = row.insertCell(connectionStartIndex);
        selectCell.innerHTML = `<button class="select-props-btn" title="鋼材データツールを開く">選択</button>`;
    };

    /**
     * 材料タイプ変更時の強度入力UIを設定
     * @param {HTMLTableRowElement} row - 対象の行
     */
    const setupMaterialTypeHandling = (row) => {
        const eSelect = row.cells[3].querySelector('select');
        const strengthCell = row.cells[4];
        
        const handleMaterialChange = () => {
            const selectedOption = eSelect.options[eSelect.selectedIndex];
            let materialType = 'steel';
            
            if (selectedOption.textContent.includes('木材')) materialType = 'wood';
            else if (selectedOption.textContent.includes('コンクリート')) materialType = 'concrete';
            else if (selectedOption.textContent.includes('ステンレス')) materialType = 'stainless';
            else if (selectedOption.textContent.includes('アルミニウム')) materialType = 'aluminum';
            
            strengthCell.innerHTML = '';
            strengthCell.appendChild(createStrengthInputHTML(materialType, `member-strength-${row.rowIndex}`));
            
            // 自重考慮がオンの場合、密度も更新
            if (elements.considerSelfWeightCheckbox && elements.considerSelfWeightCheckbox.checked) {
                const densityCell = row.querySelector('.density-cell');
                if (densityCell) {
                    const eInput = row.cells[3].querySelector('input[type="number"]');
                    const eValue = eSelect.value === 'custom' ? eInput.value : eSelect.value;
                    const newDensity = MATERIAL_DENSITY_DATA[eValue] || MATERIAL_DENSITY_DATA['custom'];
                    
                    // 密度セルのHTMLを更新
                    densityCell.innerHTML = createDensityInputHTML(`member-density-${row.rowIndex}`, newDensity);
                }
            }
            
            // 木材選択時の弾性係数連動処理
            if (materialType === 'wood') {
                setTimeout(() => setupWoodElasticModulusSync(row, strengthCell), 100);
            }
        };
        
        eSelect.addEventListener('change', handleMaterialChange);
        
        // 初期化処理
        try {
            handleMaterialChange();
        } catch (error) {
            console.warn('材料タイプ初期化失敗:', error);
        }
    };

    /**
     * 木材選択時の弾性係数自動更新を設定
     * @param {HTMLTableRowElement} row - 対象の行
     * @param {HTMLTableCellElement} strengthCell - 強度入力セル
     */
    const setupWoodElasticModulusSync = (row, strengthCell) => {
        const strengthSelect = strengthCell.querySelector('select');
        const eInput = row.cells[3].querySelector('input');
        
        if (!strengthSelect || !eInput) return;
        
        const woodElasticModuli = {
            'Akamatsu_Group': 8000, 'Kuromatsu_Group': 8000, 'Beimatsu_Group': 8000,
            'Karamatsu_Group': 9000, 'Hiba_Group': 9000, 'Hinoki_Group': 9000, 'Beihi_Group': 9000,
            'Tuga_Group': 8000, 'Beituga_Group': 8000,
            'Momi_Group': 7000, 'Ezomatsu_Group': 7000, 'Todomatsu_Group': 7000, 'Benimatsu_Group': 7000,
            'Sugi_Group': 7000, 'Beisugi_Group': 7000, 'Spruce_Group': 7000,
            'Kashi_Group': 10000,
            'Kuri_Group': 8000, 'Nara_Group': 8000, 'Buna_Group': 8000, 'Keyaki_Group': 8000
        };
        
        const updateElasticModulus = () => {
            const woodType = strengthSelect.value;
            if (woodElasticModuli[woodType]) {
                eInput.value = woodElasticModuli[woodType];
            }
        };
        
        strengthSelect.addEventListener('change', updateElasticModulus);
        updateElasticModulus(); // 初期値設定
    };

    /**
     * 行削除ボタンのイベントリスナーを設定
     * @param {HTMLTableRowElement} row - 対象の行
     * @param {HTMLTableSectionElement} tableBody - 所属するテーブルボディ
     */
    const setupRowDeleteHandler = (row, tableBody) => {
        const deleteBtn = row.querySelector('.delete-row-btn');
        
        if (tableBody === elements.membersTable) {
            deleteBtn.onclick = () => handleMemberRowDeletion(row);
        } else if (tableBody === elements.nodesTable) {
            deleteBtn.onclick = () => handleNodeRowDeletion(row);
        } else {
            deleteBtn.onclick = () => handleGenericRowDeletion(row);
        }
    };

    /**
     * 部材行削除の処理
     * @param {HTMLTableRowElement} row - 削除対象の行
     */
    const handleMemberRowDeletion = (row) => {
        pushState();
        const deletedMemberNumber = row.rowIndex;
        
        // 関連する部材荷重を削除
        const loadsToDelete = Array.from(elements.memberLoadsTable.rows)
            .filter(r => parseInt(r.cells[0].querySelector('input').value) - 1 === deletedMemberNumber);
        loadsToDelete.forEach(r => r.remove());
        
        // 後続の部材荷重の番号を調整
        Array.from(elements.memberLoadsTable.rows).forEach(r => {
            const input = r.cells[0].querySelector('input');
            const current = parseInt(input.value);
            if (current - 1 > deletedMemberNumber) {
                input.value = current - 1;
            }
        });
        
        row.remove();
        renumberTables();
        if (typeof drawOnCanvas === 'function') {
            drawOnCanvas();
        }
    };

    /**
     * 節点行削除の処理
     * @param {HTMLTableRowElement} row - 削除対象の行
     */
    const handleNodeRowDeletion = (row) => {
        pushState();
        const deletedNodeIndex = row.rowIndex - 1;
        const deletedNodeNumber = deletedNodeIndex + 1;
        
        const membersToDelete = [];
        const membersToUpdate = [];
        
        // 関連する部材の処理
        Array.from(elements.membersTable.rows).forEach(r => {
            const i = r.cells[1].querySelector('input');
            const j = r.cells[2].querySelector('input');
            const c_i = parseInt(i.value);
            const c_j = parseInt(j.value);
            
            if (c_i === deletedNodeNumber || c_j === deletedNodeNumber) {
                membersToDelete.push(r);
            } else {
                if (c_i > deletedNodeNumber) {
                    membersToUpdate.push({ input: i, newValue: c_i - 1 });
                }
                if (c_j > deletedNodeNumber) {
                    membersToUpdate.push({ input: j, newValue: c_j - 1 });
                }
            }
        });
        
        // 関連する節点荷重の処理
        const nodeLoadsToDelete = [];
        const nodeLoadsToUpdate = [];
        
        Array.from(elements.nodeLoadsTable.rows).forEach(r => {
            const n = r.cells[0].querySelector('input');
            const current = parseInt(n.value);
            
            if (current === deletedNodeNumber) {
                nodeLoadsToDelete.push(r);
            } else if (current > deletedNodeNumber) {
                nodeLoadsToUpdate.push({ input: n, newValue: current - 1 });
            }
        });
        
        // 関連する部材荷重の処理
        const memberLoadsToDelete = [];
        const memberLoadsToUpdate = [];
        
        // 削除される部材の番号を取得
        const deletedMemberNumbers = membersToDelete.map(r => {
            const memberIndex = Array.from(elements.membersTable.rows).indexOf(r);
            return memberIndex + 1; // 1ベースの番号
        });
        
        Array.from(elements.memberLoadsTable.rows).forEach(r => {
            const m = r.cells[0].querySelector('input');
            const current = parseInt(m.value);
            
            if (deletedMemberNumbers.includes(current)) {
                memberLoadsToDelete.push(r);
            } else {
                // 削除される部材より後の番号を更新
                const adjustment = deletedMemberNumbers.filter(num => num < current).length;
                if (adjustment > 0) {
                    memberLoadsToUpdate.push({ input: m, newValue: current - adjustment });
                }
            }
        });
        
        // 削除と更新を実行
        membersToDelete.forEach(r => r.remove());
        nodeLoadsToDelete.forEach(r => r.remove());
        memberLoadsToDelete.forEach(r => r.remove());
        membersToUpdate.forEach(item => item.input.value = item.newValue);
        nodeLoadsToUpdate.forEach(item => item.input.value = item.newValue);
        memberLoadsToUpdate.forEach(item => item.input.value = item.newValue);
        
        row.remove();
        renumberTables();
        if (typeof drawOnCanvas === 'function') {
            drawOnCanvas();
        }
    };

    /**
     * 一般的な行削除の処理
     * @param {HTMLTableRowElement} row - 削除対象の行
     */
    const handleGenericRowDeletion = (row) => {
        pushState();
        row.remove();
        renumberTables();
        if (typeof drawOnCanvas === 'function') {
            drawOnCanvas();
        }
    };

    /**
     * 行の入力フィールドにイベントリスナーを設定
     * @param {HTMLTableRowElement} row - 対象の行
     * @param {HTMLTableSectionElement} tableBody - 所属するテーブルボディ
     */
    const setupRowInputListeners = (row, tableBody) => {
        row.querySelectorAll('input, select').forEach(element => {
            element.addEventListener('focus', pushState);
            element.addEventListener('change', () => {
                if (typeof drawOnCanvas === 'function') {
                    drawOnCanvas();
                }
            });
        });
        
        // 入力検証の設定
        setupTableInputValidation(row, tableBody);
    };

    const addRow = (tableBody, cells, saveHistory = true) => {
        return utils.executeWithErrorHandling(() => {
            if (saveHistory) pushState();
            
            const newRow = createTableRow(tableBody, cells);
            
            // テーブル固有の設定
            if (tableBody === elements.membersTable) {
                setupMemberRowSpecialFeatures(newRow);
                setupMaterialTypeHandling(newRow);
            }
            
            // イベントリスナーの設定
            setupRowDeleteHandler(newRow, tableBody);
            setupRowInputListeners(newRow, tableBody);
            
            if (saveHistory) {
                renumberTables();
                // プリセット読み込み中は描画をスキップ
                if (typeof drawOnCanvas === 'function' && !window.isLoadingPreset) {
                    drawOnCanvas();
                }
            }
            
            return newRow;
        }, { tableType: tableBody.id, cellCount: cells.length }, 'テーブル行の追加に失敗しました');
    };

    const renumberTables = () => {
        elements.nodesTable.querySelectorAll('tr').forEach((row, i) => row.cells[0].textContent = i + 1);
        elements.membersTable.querySelectorAll('tr').forEach((row, i) => row.cells[0].textContent = i + 1);
    };
    
    const calculate = () => {
        try {
            elements.errorMessage.style.display = 'none';
            clearResults(); 
            const { nodes, members, nodeLoads, memberLoads, memberSelfWeights, nodeSelfWeights } = parseInputs();
            
            // 解析用に自重の等分布荷重を部材荷重に合成
            const combinedMemberLoads = [...memberLoads];
            if (memberSelfWeights && memberSelfWeights.length > 0) {
                memberSelfWeights.forEach(selfWeightLoad => {
                    if (selfWeightLoad.loadType === 'distributed') {
                        // 水平部材の自重を等分布荷重として追加
                        const distributedLoad = {
                            memberIndex: selfWeightLoad.memberIndex,
                            w: selfWeightLoad.w // 既に適切な符号（負の値）が設定済み
                        };
                        combinedMemberLoads.push(distributedLoad);
                        
                        // デバッグログ（最初の1回のみ）
                        if (!window.distributedLoadLogCount) window.distributedLoadLogCount = 0;
                        if (window.distributedLoadLogCount === 0) {
                            console.log(`等分布荷重追加: 部材${selfWeightLoad.memberIndex + 1}, w=${distributedLoad.w.toFixed(4)}kN/m`);
                            window.distributedLoadLogCount = 1;
                        }
                    } else if (selfWeightLoad.loadType === 'mixed' && selfWeightLoad.w !== 0) {
                        // 斜め部材の垂直成分を等分布荷重として追加
                        const distributedLoad = {
                            memberIndex: selfWeightLoad.memberIndex,
                            w: selfWeightLoad.w // 既に適切な符号（負の値）が設定済み
                        };
                        combinedMemberLoads.push(distributedLoad);
                        
                        // デバッグログ
                        if (!window.distributedLoadLogCount) window.distributedLoadLogCount = 0;
                        if (window.distributedLoadLogCount < 3) {
                            console.log(`混合荷重(垂直成分)追加: 部材${selfWeightLoad.memberIndex + 1}, w=${distributedLoad.w.toFixed(4)}kN/m`);
                            window.distributedLoadLogCount++;
                        }
                    }
                });
            }
            
            // 構造解析で使用される最終的な部材荷重をログ出力
            if (!window.finalMemberLoadsLogCount) window.finalMemberLoadsLogCount = 0;
            if (window.finalMemberLoadsLogCount === 0) {
                console.log('=== 構造解析で使用される部材荷重 ===');
                combinedMemberLoads.forEach((load, idx) => {
                    console.log(`部材${load.memberIndex + 1}: w=${load.w.toFixed(4)}kN/m`);
                });
                console.log('================================');
                window.finalMemberLoadsLogCount = 1;
            }
            
            // 解析用に自重荷重を節点荷重に合成
            const combinedNodeLoads = [...nodeLoads];
            if (nodeSelfWeights && nodeSelfWeights.length > 0) {
                nodeSelfWeights.forEach(selfWeightLoad => {
                    const existingLoad = combinedNodeLoads.find(load => load.nodeIndex === selfWeightLoad.nodeIndex);
                    if (existingLoad) {
                        // 既存荷重に自重を加算
                        existingLoad.px += selfWeightLoad.px;
                        existingLoad.py += selfWeightLoad.py;
                        existingLoad.mz += selfWeightLoad.mz;
                    } else {
                        // 新しい節点荷重として追加
                        combinedNodeLoads.push({
                            nodeIndex: selfWeightLoad.nodeIndex,
                            px: selfWeightLoad.px,
                            py: selfWeightLoad.py,
                            mz: selfWeightLoad.mz
                        });
                    }
                });
            }
            const dof = nodes.length * 3;
            let K_global = mat.create(dof, dof);
            let F_global = mat.create(dof, 1);
            const fixedEndForces = {};
            
            // 同一部材の荷重を合計して重複を防ぐ
            const memberLoadMap = new Map();
            combinedMemberLoads.forEach(load => {
                const memberIndex = load.memberIndex;
                if (memberLoadMap.has(memberIndex)) {
                    // 既存荷重に加算
                    memberLoadMap.get(memberIndex).w += load.w;
                } else {
                    // 新規追加
                    memberLoadMap.set(memberIndex, { memberIndex, w: load.w });
                }
            });
            
            // デバッグログ：合計された荷重を確認
            if (!window.mergedLoadLogCount) window.mergedLoadLogCount = 0;
            if (window.mergedLoadLogCount === 0) {
                console.log('=== 合計された部材荷重 ===');
                memberLoadMap.forEach((load, memberIndex) => {
                    console.log(`部材${memberIndex + 1}: w=${load.w.toFixed(4)}kN/m`);
                });
                console.log('========================');
                window.mergedLoadLogCount = 1;
            }
            
            // 合計された荷重で固定端力を計算
            memberLoadMap.forEach(load => {
                const member = members[load.memberIndex];
                const L = member.length, w = load.w;
                let fel;
                if (member.i_conn === 'rigid' && member.j_conn === 'rigid') { fel = [0, w*L/2, w*L**2/12, 0, w*L/2, -w*L**2/12]; } 
                else if (member.i_conn === 'pinned' && member.j_conn === 'rigid') { fel = [0, 3*w*L/8, 0, 0, 5*w*L/8, -w*L**2/8]; } 
                else if (member.i_conn === 'rigid' && member.j_conn === 'pinned') { fel = [0, 5*w*L/8, w*L**2/8, 0, 3*w*L/8, 0]; } 
                else { fel = [0, w*L/2, 0, 0, w*L/2, 0]; }
                const T_t = mat.transpose(member.T), feg = mat.multiply(T_t, fel.map(v => [v])), i = member.i, j = member.j;
                F_global[i*3][0] -= feg[0][0]; F_global[i*3+1][0] -= feg[1][0]; F_global[i*3+2][0] -= feg[2][0];
                F_global[j*3][0] -= feg[3][0]; F_global[j*3+1][0] -= feg[4][0]; F_global[j*3+2][0] -= feg[5][0];
                fixedEndForces[load.memberIndex] = fel; // 部材インデックスで正しく保存
            });
            combinedNodeLoads.forEach(load => { const i = load.nodeIndex * 3; F_global[i][0] += load.px; F_global[i+1][0] += load.py; F_global[i+2][0] += load.mz; });
            members.forEach((member) => {
                const {k_local, T, i, j} = member;
                const T_t = mat.transpose(T);
                if (!T_t) {
                    console.error('Matrix transpose failed for member:', member);
                    return;
                }
                const k_global_member = mat.multiply(mat.multiply(T_t, k_local), T);
                if (!k_global_member) {
                    console.error('Matrix multiply failed for member:', member);
                    return;
                }
                const indices = [i*3, i*3+1, i*3+2, j*3, j*3+1, j*3+2];
                for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) K_global[indices[row]][indices[col]] += k_global_member[row][col];
            });
            // ==========================================================
            // 強制変位を考慮した解析ロジック（自由節点も対応）
            // ==========================================================

            // 1. 物理的な支点による拘束自由度を定義
            const support_constraints = new Set();
            nodes.forEach((node, i) => {
                if (node.support === 'fixed') {
                    support_constraints.add(i * 3);
                    support_constraints.add(i * 3 + 1);
                    support_constraints.add(i * 3 + 2);
                } else if (node.support === 'pinned') {
                    support_constraints.add(i * 3);
                    support_constraints.add(i * 3 + 1);
                } else if (node.support === 'roller') {
                    support_constraints.add(i * 3 + 1);
                }
            });

            // 2. 強制変位が与えられた自由度を特定し、既知変位ベクトルD_sを作成
            const D_s = mat.create(dof, 1);
            const forced_disp_constraints = new Set();
            nodes.forEach((node, i) => {
                if (Math.abs(node.dx_forced) > 1e-9) {
                    D_s[i * 3][0] = node.dx_forced;
                    forced_disp_constraints.add(i * 3);
                }
                if (Math.abs(node.dy_forced) > 1e-9) {
                    D_s[i * 3 + 1][0] = node.dy_forced;
                    forced_disp_constraints.add(i * 3 + 1);
                }
                if (Math.abs(node.r_forced) > 1e-9) {
                    D_s[i * 3 + 2][0] = node.r_forced;
                    forced_disp_constraints.add(i * 3 + 2);
                }
            });

            // 3. 物理支点と強制変位を合算し、最終的な「拘束自由度」と「自由度」を決定
            const constrained_indices_set = new Set([...support_constraints, ...forced_disp_constraints]);
            const constrained_indices = Array.from(constrained_indices_set).sort((a, b) => a - b);
            const free_indices = [...Array(dof).keys()].filter(i => !constrained_indices_set.has(i));

            if (free_indices.length === 0) { // 完全拘束モデルの場合
                const D_global = D_s;
                const K_D = mat.multiply(K_global, D_global);
                if (!K_D) {
                    console.error('Matrix multiply failed: K_global * D_global');
                    return;
                }
                const R = mat.subtract(K_D, F_global);
                const memberForces = members.map((member, idx) => {
                    const { T, k_local, i, j } = member;
                    const d_global_member = [ ...D_global.slice(i * 3, i * 3 + 3), ...D_global.slice(j * 3, j * 3 + 3) ];
                    const d_local = mat.multiply(T, d_global_member);
                    if (!d_local) {
                        console.error('Matrix multiply failed: T * d_global_member for member', idx);
                        return { N_i: 0, Q_i: 0, M_i: 0, N_j: 0, Q_j: 0, M_j: 0 };
                    }
                    let f_local = mat.multiply(k_local, d_local);
                    if (!f_local) {
                        console.error('Matrix multiply failed: k_local * d_local for member', idx);
                        return { N_i: 0, Q_i: 0, M_i: 0, N_j: 0, Q_j: 0, M_j: 0 };
                    }
                    if(fixedEndForces[idx]) { const fel_mat = fixedEndForces[idx].map(v=>[v]); f_local = mat.add(f_local, fel_mat); }
                    return { N_i: f_local[0][0], Q_i: f_local[1][0], M_i: f_local[2][0], N_j: f_local[3][0], Q_j: f_local[4][0], M_j: f_local[5][0] };
                });
                displayResults(D_global, R, memberForces, nodes, members, nodeLoads, memberLoads);
                return;
            }

            // 3. 行列を分割 (K_ff, K_fs, K_sf, K_ss)
            const K_ff = free_indices.map(r => free_indices.map(c => K_global[r][c]));
            const K_fs = free_indices.map(r => constrained_indices.map(c => K_global[r][c]));
            const K_sf = constrained_indices.map(r => free_indices.map(c => K_global[r][c]));
            const K_ss = constrained_indices.map(r => constrained_indices.map(c => K_global[r][c]));

            // 4. ベクトルを分割
            const F_f = free_indices.map(idx => [F_global[idx][0]]);
            const F_s = constrained_indices.map(idx => [F_global[idx][0]]);
            const D_s_constrained = constrained_indices.map(idx => [D_s[idx][0]]);

            // 5. 強制変位による等価節点力を計算し、荷重ベクトルを修正
            // F_modified = F_f - K_fs * D_s_constrained
            const Kfs_Ds = mat.multiply(K_fs, D_s_constrained);
            const F_modified = mat.subtract(F_f, Kfs_Ds);

            // 6. 未知変位 D_f を解く
            const D_f = mat.solve(K_ff, F_modified);
            if (!D_f) {
                const instabilityAnalysis = analyzeInstability(K_global, free_indices, nodes, members);
                throw new Error(`解を求めることができませんでした。構造が不安定であるか、拘束が不適切である可能性があります。\n${instabilityAnalysis.message}`);
            }

            // 7. 全体変位ベクトル D_global を組み立てる
            const D_global = mat.create(dof, 1);
            free_indices.forEach((val, i) => { D_global[val][0] = D_f[i][0]; });
            constrained_indices.forEach((val, i) => { D_global[val][0] = D_s_constrained[i][0]; });

            // 8. 反力 R を計算
            // R = K_sf * D_f + K_ss * D_s_constrained - F_s
            const Ksf_Df = mat.multiply(K_sf, D_f);
            const Kss_Ds = mat.multiply(K_ss, D_s_constrained);
            let R_constrained = mat.add(Ksf_Df, Kss_Ds);
            R_constrained = mat.subtract(R_constrained, F_s);

            const R = mat.create(dof, 1);
            constrained_indices.forEach((val, i) => { R[val][0] = R_constrained[i][0]; });

            // ==========================================================
            const memberForces = members.map((member, idx) => {
                const { T, k_local, i, j } = member;
                const d_global_member = [ ...D_global.slice(i * 3, i * 3 + 3), ...D_global.slice(j * 3, j * 3 + 3) ];
                const d_local = mat.multiply(T, d_global_member);
                let f_local = mat.multiply(k_local, d_local);
                if(fixedEndForces[idx]) { const fel_mat = fixedEndForces[idx].map(v=>[v]); f_local = mat.add(f_local, fel_mat); }
                return { N_i: f_local[0][0], Q_i: f_local[1][0], M_i: f_local[2][0], N_j: f_local[3][0], Q_j: f_local[4][0], M_j: f_local[5][0] };
            });
            
            // 計算成功時は不安定性ハイライトをクリア
            clearInstabilityHighlight();
            
            // 解析結果をグローバルに保存（応力度コンター図用）
            window.lastAnalysisResults = {
                displacements: D_global,
                reactions: R,
                forces: memberForces,
                nodes: nodes,
                members: members
            };
            
            // 合計された部材荷重を配列に変換
            const finalMemberLoads = Array.from(memberLoadMap.values());
            
            displayResults(D_global, R, memberForces, nodes, members, combinedNodeLoads, finalMemberLoads);
        } catch (error) {
            elements.errorMessage.textContent = `エラー: ${error.message}`;
            elements.errorMessage.style.display = 'block';
            console.error(error);
            
            // 不安定要素をハイライト表示
            if (typeof drawOnCanvas === 'function') {
                drawOnCanvas();
            }
        }
    };
    
    const parseInputs = () => {
        // プリセット読み込み中は簡易的なダミーデータを返してエラーを回避
        if (window.isLoadingPreset) {
            return {
                nodes: [],
                members: [],
                nodeLoads: [],
                memberLoads: [],
                memberSelfWeights: [],
                nodeSelfWeights: []
            };
        }
        
        // エラーログをリセット（新しい解析サイクルの開始時）
        if (window.resetErrorLogs) {
            window.memberErrorLogged = {};
            window.cellCountErrorLogged = {};
            window.cellMissingErrorLogged = {};
            window.selfWeightLogCount = 0;
            window.resetErrorLogs = false;
        }
        
        const nodes = Array.from(elements.nodesTable.rows).map((row, i) => {
            // 安全な値取得
            const xInput = row.cells[1]?.querySelector('input');
            const yInput = row.cells[2]?.querySelector('input');
            const supportSelect = row.cells[3]?.querySelector('select');

            if (!xInput || !yInput || !supportSelect) {
                throw new Error(`節点 ${i + 1}: 入力フィールドが見つかりません`);
            }

            // 強制変位の読み取りを追加
            const dx_forced_mm = parseFloat(row.cells[4]?.querySelector('input')?.value) || 0;
            const dy_forced_mm = parseFloat(row.cells[5]?.querySelector('input')?.value) || 0;
            const r_forced_rad = parseFloat(row.cells[6]?.querySelector('input')?.value) || 0;

            return {
                id: i + 1,
                x: parseFloat(xInput.value),
                y: parseFloat(yInput.value),
                support: supportSelect.value,
                // 強制変位を基本単位(m, rad)で格納
                dx_forced: dx_forced_mm / 1000,
                dy_forced: dy_forced_mm / 1000,
                r_forced: r_forced_rad
            };
        });
        const members = Array.from(elements.membersTable.rows).map((row, index) => {
            // 安全な節点番号取得
            const iNodeInput = row.cells[1]?.querySelector('input');
            const jNodeInput = row.cells[2]?.querySelector('input');
            
            if (!iNodeInput || !jNodeInput) {
                throw new Error(`部材 ${index + 1}: 節点番号の入力フィールドが見つかりません`);
            }
            
            const i = parseInt(iNodeInput.value) - 1;
            const j = parseInt(jNodeInput.value) - 1;
            
            // 弾性係数の取得も安全に
            const e_select = row.cells[3]?.querySelector('select');
            const e_input = row.cells[3]?.querySelector('input[type="number"]');
            
            if (!e_select) {
                throw new Error(`部材 ${index + 1}: 弾性係数の選択フィールドが見つかりません`);
            }
            
            let E = (e_select.value === 'custom' ? parseFloat(e_input?.value || 0) : parseFloat(e_select.value)) * 1000;
            
            // 弾性係数選択欄から材料名を直接取得
            const getMaterialNameFromSelect = (selectElement) => {
                const selectedOption = selectElement.options[selectElement.selectedIndex];
                if (selectedOption.value === 'custom') {
                    const eValue = parseFloat(e_input?.value || 0);
                    return `任意材料(E=${(eValue/1000).toLocaleString()}GPa)`;
                }
                return selectedOption.textContent; // "スチール", "ステンレス", "アルミニウム", "木材" など
            };
            const material = getMaterialNameFromSelect(e_select);
            
            const strengthInputContainer = row.cells[4].firstElementChild;
            if (!strengthInputContainer) {
                console.warn(`行 ${index} の強度入力コンテナが見つかりません`);
                return { i, j, E, A: parseFloat(row.cells[5].querySelector('input').value), material, strengthProps: { type: 'unknown' } };
            }
            const strengthType = strengthInputContainer.dataset.strengthType;
            let strengthProps = { type: strengthType };

            if (strengthType === 'wood-type') {
                    const presetSelect = strengthInputContainer.querySelector('select');
                    if (presetSelect) {
                        strengthProps.preset = presetSelect.value;
                        if (presetSelect.value === 'custom') {
                            // 任意入力の場合、基準強度として値を読み取る
                            const ftInput = strengthInputContainer.querySelector('input[id*="-ft"]');
                            const fcInput = strengthInputContainer.querySelector('input[id*="-fc"]');
                            const fbInput = strengthInputContainer.querySelector('input[id*="-fb"]');
                            const fsInput = strengthInputContainer.querySelector('input[id*="-fs"]');
                            
                            if (ftInput && fcInput && fbInput && fsInput) {
                                strengthProps.baseStrengths = {
                                    ft: parseFloat(ftInput.value),
                                    fc: parseFloat(fcInput.value),
                                    fb: parseFloat(fbInput.value),
                                    fs: parseFloat(fsInput.value)
                                };
                            }
                        }
                    }
                }
            else { // Steel, Stainless, Aluminum
                const strengthInput = strengthInputContainer.querySelector('input');
                if (strengthInput) {
                    strengthProps.value = parseFloat(strengthInput.value);
                }
            }

            // 安全な値取得（断面諸量）
            const iMomentInput = row.cells[5]?.querySelector('input');
            const aAreaInput = row.cells[6]?.querySelector('input');
            const zSectionInput = row.cells[7]?.querySelector('input');
            
            if (!iMomentInput || !aAreaInput || !zSectionInput) {
                throw new Error(`部材 ${index + 1}: 断面諸量の入力フィールドが見つかりません`);
            }
            
            const I = parseFloat(iMomentInput.value) * 1e-8;
            const A = parseFloat(aAreaInput.value) * 1e-4;
            const Z = parseFloat(zSectionInput.value) * 1e-6;
            
            // 密度列が存在するかどうかでインデックスを調整（より安全な方法）
            const cellCount = row.cells.length;
            let hasDensityColumn = false;
            
            // セル数で判定（密度列がある場合は13列、ない場合は12列）
            if (cellCount >= 13) {
                hasDensityColumn = true;
            } else if (cellCount >= 12) {
                hasDensityColumn = false;
            } else {
                if (!window.cellCountErrorLogged || !window.cellCountErrorLogged[index]) {
                    if (!window.cellCountErrorLogged) window.cellCountErrorLogged = {};
                    window.cellCountErrorLogged[index] = true;
                    console.warn(`部材 ${index + 1}: セル数が不足しています (${cellCount})`);
                }
                // デフォルトで密度列なしと仮定
                hasDensityColumn = false;
            }
            
            // 実際のセル構造を動的に解析してselect要素を探す
            let iConnIndex = -1, jConnIndex = -1;
            
            // 後ろから2番目と3番目のセルをチェック（削除ボタンを除く）
            // 通常の構造: [..., 始端select, 終端select, 削除ボタン] または [..., 始端select, 終端select, 断面選択ボタン, 削除ボタン]
            const lastCellIndex = cellCount - 1; // 削除ボタン
            
            // 最後から逆順にselect要素を探す
            let selectCount = 0;
            for (let i = lastCellIndex - 1; i >= 0; i--) {
                const cell = row.cells[i];
                if (cell && cell.querySelector('select')) {
                    selectCount++;
                    if (selectCount === 1) {
                        jConnIndex = i; // 最初に見つかったselectは終端接続
                    } else if (selectCount === 2) {
                        iConnIndex = i; // 2番目に見つかったselectは始端接続
                        break;
                    }
                }
            }
            
            // select要素が見つからない場合の処理
            if (iConnIndex === -1 || jConnIndex === -1) {
                if (!window.cellMissingErrorLogged || !window.cellMissingErrorLogged[index]) {
                    if (!window.cellMissingErrorLogged) window.cellMissingErrorLogged = {};
                    window.cellMissingErrorLogged[index] = true;
                    console.warn(`部材 ${index + 1}: 接続条件のselect要素が見つかりません (cellCount: ${cellCount}, found selects: ${selectCount})`);
                }
                // デフォルト値を設定してエラーを回避
                return {
                    i: parseInt(row.cells[1].querySelector('input').value) - 1,
                    j: parseInt(row.cells[2].querySelector('input').value) - 1,
                    E: parseFloat(eInput.value),
                    strengthProps: { Fy: parseFloat(fInput.value) },
                    I: I,
                    A: A,
                    Z: Z,
                    Zx: 0,
                    Zy: 0,
                    ix: Math.sqrt(I / A),
                    iy: Math.sqrt(I / A),
                    length: 0,
                    c: 1,
                    s: 0,
                    T: [[1,0,0,0,0,0],[0,1,0,0,0,0],[0,0,1,0,0,0],[0,0,0,1,0,0],[0,0,0,0,1,0],[0,0,0,0,0,1]],
                    i_conn: 'rigid',
                    j_conn: 'rigid',
                    k_local: [[1,0,0,0,0,0],[0,1,0,0,0,0],[0,0,1,0,0,0],[0,0,0,1,0,0],[0,0,0,0,1,0],[0,0,0,0,0,1]],
                    material: 'steel'
                };
            }
            
            // 安全な値取得（nullチェック付き）
            const iConnSelect = iConnIndex >= 0 ? row.cells[iConnIndex]?.querySelector('select') : null;
            const jConnSelect = jConnIndex >= 0 ? row.cells[jConnIndex]?.querySelector('select') : null;
            
            let i_conn, j_conn;
            if (!iConnSelect || !jConnSelect) {
                // エラー状況の詳細ログを一度だけ出力（デバッグのため一時的に制限解除）
                if (!window.memberErrorLogged || !window.memberErrorLogged[index] || window.memberErrorLogged[index] < 2) {
                    if (!window.memberErrorLogged) window.memberErrorLogged = {};
                    window.memberErrorLogged[index] = (window.memberErrorLogged[index] || 0) + 1;
                    console.warn(`部材 ${index + 1}: 接続条件のselect要素にアクセスできません`, {
                        cellCount: cellCount,
                        hasDensityColumn: hasDensityColumn,
                        iConnIndex: iConnIndex,
                        jConnIndex: jConnIndex,
                        hasIConnCell: iConnIndex >= 0 ? !!row.cells[iConnIndex] : false,
                        hasJConnCell: jConnIndex >= 0 ? !!row.cells[jConnIndex] : false,
                        hasIConnSelect: !!iConnSelect,
                        hasJConnSelect: !!jConnSelect,
                        selectCount: selectCount,
                        cellsWithSelects: Array.from(row.cells).map((cell, i) => ({
                            index: i,
                            hasSelect: !!cell.querySelector('select'),
                            innerHTML: cell.innerHTML.substring(0, 50) + '...'
                        })).filter(c => c.hasSelect)
                    });
                }
                // デフォルト値を設定
                i_conn = iConnSelect?.value || 'rigid';
                j_conn = jConnSelect?.value || 'rigid';
            } else {
                i_conn = iConnSelect.value;
                j_conn = jConnSelect.value;
            }
            const Zx = parseFloat(row.dataset.zx) * 1e-6, Zy = parseFloat(row.dataset.zy) * 1e-6;
            const ix = parseFloat(row.dataset.ix) * 1e-2 || Math.sqrt(I / A), iy = parseFloat(row.dataset.iy) * 1e-2 || ix;
            if (isNaN(E) || isNaN(I) || isNaN(A) || isNaN(Z)) throw new Error(`部材 ${index + 1} の物性値が無効です。`);
            if (i < 0 || j < 0 || i >= nodes.length || j >= nodes.length) throw new Error(`部材 ${index + 1} の節点番号が不正です。`);
            const ni = nodes[i], nj = nodes[j], dx = nj.x - ni.x, dy = nj.y - ni.y, L = Math.sqrt(dx**2 + dy**2);
            if(L === 0) throw new Error(`部材 ${index+1} の長さが0です。`);
            const c = dx/L, s = dy/L, T = [ [c,s,0,0,0,0], [-s,c,0,0,0,0], [0,0,1,0,0,0], [0,0,0,c,s,0], [0,0,0,-s,c,0], [0,0,0,0,0,1] ];
            const EAL=E*A/L, EIL=E*I/L, EIL2=E*I/L**2, EIL3=E*I/L**3;
            let k_local;
            if (i_conn === 'rigid' && j_conn === 'rigid') k_local = [[EAL,0,0,-EAL,0,0],[0,12*EIL3,6*EIL2,0,-12*EIL3,6*EIL2],[0,6*EIL2,4*EIL,0,-6*EIL2,2*EIL],[-EAL,0,0,EAL,0,0],[0,-12*EIL3,-6*EIL2,0,12*EIL3,-6*EIL2],[0,6*EIL2,2*EIL,0,-6*EIL2,4*EIL]];
            else if (i_conn === 'pinned' && j_conn === 'rigid') k_local = [[EAL,0,0,-EAL,0,0],[0,3*EIL3,0,0,-3*EIL3,3*EIL2],[0,0,0,0,0,0],[-EAL,0,0,EAL,0,0],[0,-3*EIL3,0,0,3*EIL3,-3*EIL2],[0,3*EIL2,0,0,-3*EIL2,3*EIL]];
            else if (i_conn === 'rigid' && j_conn === 'pinned') k_local = [[EAL,0,0,-EAL,0,0],[0,3*EIL3,3*EIL2,0,-3*EIL3,0],[0,3*EIL2,3*EIL,0,-3*EIL2,0],[-EAL,0,0,EAL,0,0],[0,-3*EIL3,-3*EIL2,0,3*EIL3,0],[0,0,0,0,0,0]];
            else k_local = [[EAL,0,0,-EAL,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[-EAL,0,0,EAL,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]];

            // 断面情報を取得（3Dビューア用）
            let sectionInfo = null;
            let sectionAxis = null;
            if (row.dataset.sectionInfo) {
                try {
                    sectionInfo = JSON.parse(decodeURIComponent(row.dataset.sectionInfo));
                } catch (error) {
                    console.warn(`部材 ${index + 1}: 断面情報のパースに失敗`, error);
                }
            }

            // 軸情報を取得（3つの個別属性から構築）
            if (row.dataset.sectionAxisKey || row.dataset.sectionAxisMode || row.dataset.sectionAxisLabel) {
                sectionAxis = {
                    key: row.dataset.sectionAxisKey,
                    mode: row.dataset.sectionAxisMode,
                    label: row.dataset.sectionAxisLabel
                };
            }

            return { i,j,E,strengthProps,I,A,Z,Zx,Zy,ix,iy,length:L,c,s,T,i_conn,j_conn,k_local,material,sectionInfo,sectionAxis };
        });
        const nodeLoads = Array.from(elements.nodeLoadsTable.rows).map((r, i) => { 
            const n = parseInt(r.cells[0].querySelector('input').value) - 1; 
            if (n < 0 || n >= nodes.length) {
                console.warn(`節点荷重 ${i+1} の節点番号が不正です (節点番号: ${n + 1}, 最大節点数: ${nodes.length})。この荷重はスキップされます。`);
                return null; // 無効な荷重は null を返す
            }
            return { nodeIndex:n, px:parseFloat(r.cells[1].querySelector('input').value)||0, py:parseFloat(r.cells[2].querySelector('input').value)||0, mz:parseFloat(r.cells[3].querySelector('input').value)||0 }; 
        }).filter(load => load !== null); // null の荷重を除外
        const memberLoads = Array.from(elements.memberLoadsTable.rows).map((r, i) => { 
            const m = parseInt(r.cells[0].querySelector('input').value) - 1; 
            if (m < 0 || m >= members.length) {
                console.warn(`部材荷重 ${i+1} の部材番号が不正です (部材番号: ${m + 1}, 最大部材数: ${members.length})。この荷重はスキップされます。`);
                return null; // 無効な荷重は null を返す
            }
            return { memberIndex:m, w:parseFloat(r.cells[1].querySelector('input').value)||0 }; 
        }).filter(load => load !== null); // null の荷重を除外
        
        // 自重荷重を追加
        const considerSelfWeightCheckbox = document.getElementById('consider-self-weight-checkbox');
        const membersTableBody = document.getElementById('members-table').getElementsByTagName('tbody')[0];
        const { memberSelfWeights, nodeSelfWeights } = calculateSelfWeight.calculateAllSelfWeights(
            nodes, 
            members, 
            considerSelfWeightCheckbox, 
            membersTableBody
        );
        
        if (memberSelfWeights.length > 0) {
            // 自重荷重ログの頻度制限
            if (!window.selfWeightLogCount) window.selfWeightLogCount = 0;
            if (window.selfWeightLogCount < 3) {
                console.log('自重荷重を追加:', memberSelfWeights);
                window.selfWeightLogCount++;
            }
        }
        
        return { nodes, members, nodeLoads, memberLoads, memberSelfWeights, nodeSelfWeights };
    };
    
    // window変数として登録（クロススコープアクセス用）
    window.parseInputs = parseInputs;
    
    const clearResults = () => {
        const canvases = [elements.displacementCanvas, elements.momentCanvas, elements.axialCanvas, elements.shearCanvas, elements.ratioCanvas];
        canvases.forEach(c => { if (c) { const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); } });
        const tables = [elements.displacementResults, elements.reactionResults, elements.forceResults, elements.sectionCheckResults];
        tables.forEach(t => { if(t) t.innerHTML = ''; });
        lastResults = null;
        lastAnalysisResult = null;
        lastSectionCheckResults = null;
        window.lastResults = null; // グローバル変数もクリア
        window.lastSectionCheckResults = null;
        window.lastBucklingResults = null;
    };
    
    const displayResults = (D, R, forces, nodes, members, nodeLoads, memberLoads) => {
        lastResults = { D, R, forces, nodes, members, nodeLoads, memberLoads };
        window.lastResults = lastResults; // グローバルに保存

        // エクセル出力用の解析結果を保存
        lastAnalysisResult = {
            displacements: D ? Array.from({length: D.length / 3}, (_, i) => ({
                x: D[i*3][0],
                y: D[i*3+1][0],
                rotation: D[i*3+2][0]
            })) : [],
            forces: forces ? forces.map(f => ({
                i: { N: -f.N_i, Q: f.Q_i, M: f.M_i },
                j: { N: f.N_j, Q: -f.Q_j, M: f.M_j }
            })) : [],
            reactions: R ? Array.from({length: R.length / 3}, (_, i) => ({
                x: -R[i*3][0] || 0,
                y: -R[i*3+1][0] || 0,
                mz: -R[i*3+2][0] || 0
            })) : [],
            nodes: nodes || [],
            members: members || [],
            sectionCheckResults: null  // 後で断面検定実行時に設定される
        };

        // 構造解析完了後に自動で座屈解析を実行
        if (forces && forces.length > 0) {
            try {
                lastBucklingResults = calculateBucklingAnalysis();
                window.lastBucklingResults = lastBucklingResults; // グローバルに保存
                // 座屈解析結果も自動で表示
                displayBucklingResults();
            } catch (error) {
                console.warn('座屈解析中にエラーが発生しましたが、処理を続行します:', error);
            }
        }
        
        elements.errorMessage.style.display = 'none';
        let dispHTML = `<thead><tr><th>節点 #</th><th>変位 δx (mm)</th><th>変位 δy (mm)</th><th>回転角 θz (rad)</th></tr></thead><tbody>`; for (let i = 0; i < D.length / 3; i++) { dispHTML += `<tr><td>${i+1}</td><td>${(D[i*3][0]*1000).toFixed(2)}</td><td>${(D[i*3+1][0]*1000).toFixed(2)}</td><td>${D[i*3+2][0].toFixed(2)}</td></tr>`; } elements.displacementResults.innerHTML = dispHTML + '</tbody>';
        let reactHTML = `<thead><tr><th>節点 #</th><th>反力 Rx (kN)</th><th>反力 Ry (kN)</th><th>反力 Mz (kN・m)</th></tr></thead><tbody>`; nodes.forEach((n, i) => { if (n.support !== 'free') { const rx = -R[i*3][0]||0, ry = -R[i*3+1][0]||0, mz = -R[i*3+2][0]||0; reactHTML += `<tr><td>${i+1}</td><td>${rx.toFixed(2)}</td><td>${ry.toFixed(2)}</td><td>${mz.toFixed(2)}</td></tr>`; } }); elements.reactionResults.innerHTML = reactHTML + '</tbody>';
        let forceHTML = `<thead><tr><th>部材 #</th><th>始端 #i</th><th>終端 #j</th><th>軸力 N (kN)</th><th>せん断力 Q (kN)</th><th>曲げM (kN・m)</th></tr></thead><tbody>`; forces.forEach((f, i) => { const ni = members[i].i+1, nj = members[i].j+1; forceHTML += `<tr><td rowspan="2">${i+1}</td><td>${ni} (i端)</td><td>-</td><td>${(-f.N_i).toFixed(2)}</td><td>${f.Q_i.toFixed(2)}</td><td>${f.M_i.toFixed(2)}</td></tr><tr><td>-</td><td>${nj} (j端)</td><td>${f.N_j.toFixed(2)}</td><td>${(-f.Q_j).toFixed(2)}</td><td>${f.M_j.toFixed(2)}</td></tr>`; }); elements.forceResults.innerHTML = forceHTML + '</tbody>';
        drawDisplacementDiagram(nodes, members, D, memberLoads);
        drawMomentDiagram(nodes, members, forces, memberLoads);
        drawAxialForceDiagram(nodes, members, forces);
        drawShearForceDiagram(nodes, members, forces, memberLoads);
    };

// --- Canvas Drawing ---
    let lastDrawingContext = null;
    
    // 重複判定用のヘルパー関数
    function boxesOverlap(box1, box2) {
        return !(box1.x + box1.width < box2.x || 
                box2.x + box2.width < box1.x || 
                box1.y + box1.height < box2.y || 
                box2.y + box2.height < box1.y);
    }
    
    // 重複面積計算用のヘルパー関数
    function calculateOverlapArea(box1, box2) {
        const overlapX = Math.max(0, Math.min(box1.x + box1.width, box2.x + box2.width) - Math.max(box1.x, box2.x));
        const overlapY = Math.max(0, Math.min(box1.y + box1.height, box2.y + box2.height) - Math.max(box1.y, box2.y));
        return overlapX * overlapY;
    }
    
    // 部材番号の重複回避位置計算（部材上に制限）
    function calculateMemberLabelPositions(members, nodes, transform, ctx) {
        const memberLabelPositions = [];
        
        members.forEach((m, memberIndex) => {
            const start = transform(nodes[m.i].x, nodes[m.i].y);
            const end = transform(nodes[m.j].x, nodes[m.j].y);
            
            ctx.font = "10px Arial";
            const memberText = (memberIndex + 1).toString();
            const textMetrics = ctx.measureText(memberText);
            const textWidth = textMetrics.width;
            const textHeight = 10;
            const padding = 2;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = textHeight + padding * 2;
            
            // 部材上の候補位置を生成（部材線上の複数点）
            const candidates = [];
            const numCandidates = 7; // 候補数を増やして選択肢を豊富にする
            
            for (let i = 0; i < numCandidates; i++) {
                const t = i / (numCandidates - 1); // 0から1の間で分割
                const x = start.x + (end.x - start.x) * t;
                const y = start.y + (end.y - start.y) * t;
                
                candidates.push({ x, y, t });
            }
            
            // 最適な位置を選択（他のラベルと重複しない部材上の点）
            let bestPosition = candidates[Math.floor(numCandidates / 2)]; // デフォルトは中点
            let minOverlap = Infinity;
            
            for (const candidate of candidates) {
                const candidateBox = {
                    x: candidate.x - boxWidth / 2,
                    y: candidate.y - boxHeight / 2,
                    width: boxWidth,
                    height: boxHeight
                };
                
                let overlapCount = 0;
                let totalOverlapArea = 0;
                
                // 既存のラベル位置との重複チェック
                for (const existing of memberLabelPositions) {
                    if (boxesOverlap(candidateBox, existing)) {
                        overlapCount++;
                        totalOverlapArea += calculateOverlapArea(candidateBox, existing);
                    }
                }
                
                // 重複度の計算 + 中心に近いほど好ましい（中心からの距離によるペナルティ）
                const centerBias = Math.abs(candidate.t - 0.5) * 100; // 中心から離れるほどペナルティ
                const overlapScore = overlapCount * 1000 + totalOverlapArea + centerBias;
                
                if (overlapScore < minOverlap) {
                    minOverlap = overlapScore;
                    bestPosition = candidate;
                }
            }
            
            // 選択された位置をラベル位置リストに追加
            memberLabelPositions.push({
                x: bestPosition.x - boxWidth / 2,
                y: bestPosition.y - boxHeight / 2,
                width: boxWidth,
                height: boxHeight,
                memberIndex: memberIndex,
                textX: bestPosition.x,
                textY: bestPosition.y,
                t: bestPosition.t // 部材上の位置パラメータ
            });
        });
        
        return memberLabelPositions;
    }
    
    // window変数として登録（クロススコープアクセス用）
    window.lastDrawingContext = null;
    const getDrawingContext = (canvas) => {
        let nodes;
        try { nodes = parseInputs().nodes; } catch (e) { nodes = []; }
        if (!canvas) return null;
        
        const isModelCanvas = canvas.id === 'model-canvas';
        const isResultCanvas = ['displacement-canvas', 'moment-canvas', 'axial-canvas', 'shear-canvas', 'ratio-canvas'].includes(canvas.id);
        
        const minX = nodes.length > 0 ? Math.min(...nodes.map(n => n.x)) : 0;
        const maxX = nodes.length > 0 ? Math.max(...nodes.map(n => n.x)) : 0;
        const minY = nodes.length > 0 ? Math.min(...nodes.map(n => n.y)) : 0;
        const maxY = nodes.length > 0 ? Math.max(...nodes.map(n => n.y)) : 0;
        const modelWidth = maxX - minX;
        const modelHeight = maxY - minY;
        
        const padding = 70;
        const isRatioCanvas = canvas.id === 'ratio-canvas';
        const minHeight = isRatioCanvas ? 350 : 250;
        const maxHeight = isRatioCanvas ? 1200 : 800;
        
        // キャンバスの高さを先に決定する
        let requiredHeight;
        if (nodes.length === 0) {
            requiredHeight = isRatioCanvas ? 500 : 400;
        } else if (modelWidth === 0 && modelHeight === 0) {
            requiredHeight = isRatioCanvas ? 500 : 400;
        } else {
            // まず仮のコンテナサイズでスケールを計算
            const containerRect = canvas.parentElement.getBoundingClientRect();
            const tempScaleX = (containerRect.width - 2 * padding) / (modelWidth || 1);
            const tempScaleY = (containerRect.height - 2 * padding) / (modelHeight || 1);
            const tempScale = Math.min(tempScaleX, tempScaleY) * 0.9;
            requiredHeight = modelHeight * tempScale + 2 * padding;
            requiredHeight = Math.max(minHeight, Math.min(maxHeight, requiredHeight));
        }

        canvas.style.height = `${requiredHeight}px`;
        
        // キャンバスの高さを変更した後に、新しいサイズを取得してスケールを再計算
        const rect = canvas.getBoundingClientRect();
        const containerRect = canvas.parentElement.getBoundingClientRect();
        
        let scale, offsetX, offsetY;
        
        if (nodes.length === 0) {
            scale = 50; // An arbitrary scale for an empty grid
            offsetX = padding;
            offsetY = rect.height - padding;
        } else if (modelWidth === 0 && modelHeight === 0) {
            // Single node or all nodes at the same location. Center the view on the first node.
            scale = 50; // Default zoom level
            const nodeX = nodes[0].x;
            const nodeY = nodes[0].y;
            offsetX = (rect.width / 2) - (nodeX * scale);
            offsetY = (rect.height / 2) + (nodeY * scale);
        } else {
            // 新しいサイズでスケールを正確に計算
            const scaleX = (rect.width - 2 * padding) / (modelWidth || 1);
            const scaleY = (rect.height - 2 * padding) / (modelHeight || 1);
            scale = Math.min(scaleX, scaleY) * 0.9;
            
            // リサイズ時は常に自動スケーリングを実行（panZoomState.isInitialized = falseの場合）
            if (isModelCanvas && panZoomState.isInitialized) {
                // モデル図が初期化済みの場合、既存のパン・ズーム情報を使用
                ({ scale, offsetX, offsetY } = panZoomState);
            } else if (isResultCanvas) {
                // 結果図の場合、対応するパン・ズーム状態を取得
                const resultState = resultPanZoomStates[canvas.id.replace('-canvas', '')];
                if (resultState.isInitialized) {
                    // 結果図が初期化済みの場合、既存のパン・ズーム情報を使用
                    ({ scale, offsetX, offsetY } = resultState);
            } else {
                    // 結果図の初回描画時は、常に中央に配置
                    offsetX = padding + (rect.width - 2 * padding - modelWidth * scale) / 2 - minX * scale;
                    offsetY = padding + (rect.height - 2 * padding - modelHeight * scale) / 2 + maxY * scale;
                    
                    // 結果図の状態を保存
                    Object.assign(resultState, { scale, offsetX, offsetY, isInitialized: true });
                }
            } else {
                // モデル図の初回描画時/リサイズ時は、常に中央に配置
                offsetX = padding + (rect.width - 2 * padding - modelWidth * scale) / 2 - minX * scale;
                offsetY = padding + (rect.height - 2 * padding - modelHeight * scale) / 2 + maxY * scale;

                if (isModelCanvas) {
                    // モデル図の状態を保存
                    panZoomState = { scale, offsetX, offsetY, isInitialized: true };
                }
            }
        }

        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr * resolutionScale;
        canvas.height = rect.height * dpr * resolutionScale;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr * resolutionScale, dpr * resolutionScale);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "12px Arial";
        
        const transform = (x, y) => ({ x: x * scale + offsetX, y: -y * scale + offsetY });
        
        return { ctx, transform, scale, offsetX, offsetY };
    };
    // 座標軸を描画する関数
    const drawCoordinateAxes = (ctx, transform, scale, offsetX, offsetY, canvasWidth, canvasHeight) => {
        // 実際のキャンバスの描画領域のサイズを使用
        const rect = ctx.canvas.getBoundingClientRect();
        const actualWidth = rect.width;
        const actualHeight = rect.height;
        
        // 座標軸の範囲を計算
        const leftX = (-offsetX) / scale; // 左端のX座標
        const rightX = (actualWidth - offsetX) / scale; // 右端のX座標
        const topY = (offsetY) / scale; // 上端のY座標（Y軸は反転している）
        const bottomY = (offsetY - actualHeight) / scale; // 下端のY座標
        
        // グリッド間隔を取得
        const gridSpacing = parseFloat(elements.gridSpacing.value);
        if (isNaN(gridSpacing) || gridSpacing <= 0) return;
        
        // グリッド設定値の小数点以下桁数を取得
        const gridSpacingStr = elements.gridSpacing.value.toString();
        const decimalPlaces = gridSpacingStr.includes('.') ? 
            gridSpacingStr.split('.')[1].length : 0;
        
        // 適切な目盛間隔を計算（グリッド間隔の倍数）
        const xRange = rightX - leftX;
        const yRange = topY - bottomY;
        const getTickInterval = (range, baseSpacing) => {
            const desiredTicks = 10; // 10個程度の目盛りが目安
            const rawInterval = range / desiredTicks;
            const multiplier = Math.ceil(rawInterval / baseSpacing);
            return Math.max(1, multiplier) * baseSpacing;
        };
        
        const xTickInterval = getTickInterval(xRange, gridSpacing);
        const yTickInterval = getTickInterval(yRange, gridSpacing);
        
        ctx.save();
        ctx.strokeStyle = '#999';
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.lineWidth = 1;
        
        // X軸の目盛り（下端）
        const xStart = Math.floor(leftX / xTickInterval) * xTickInterval;
        const xEnd = Math.ceil(rightX / xTickInterval) * xTickInterval;
        
        for (let x = xStart; x <= xEnd; x += xTickInterval) {
            const screenPos = transform(x, bottomY);
            if (screenPos.x >= 0 && screenPos.x <= actualWidth) {
                // 目盛り線（短い縦線）
                ctx.beginPath();
                ctx.moveTo(screenPos.x, actualHeight - 15);
                ctx.lineTo(screenPos.x, actualHeight - 5);
                ctx.stroke();
                
                // 数値表示（グリッド設定値と同じ小数点以下桁数）
                ctx.textAlign = 'center';
                ctx.fillText(x.toFixed(decimalPlaces), screenPos.x, actualHeight - 18);
            }
        }
        
        // Y軸の目盛り（左端）
        const yStart = Math.floor(bottomY / yTickInterval) * yTickInterval;
        const yEnd = Math.ceil(topY / yTickInterval) * yTickInterval;
        
        for (let y = yStart; y <= yEnd; y += yTickInterval) {
            const screenPos = transform(leftX, y);
            if (screenPos.y >= 0 && screenPos.y <= actualHeight) {
                // 目盛り線（短い横線）
                ctx.beginPath();
                ctx.moveTo(5, screenPos.y);
                ctx.lineTo(15, screenPos.y);
                ctx.stroke();
                
                // 数値表示（グリッド設定値と同じ小数点以下桁数）
                ctx.textAlign = 'right';
                ctx.fillText(y.toFixed(decimalPlaces), 50, screenPos.y + 3);
            }
        }
        
        ctx.restore();
    };

    const drawStructure = (ctx, transform, nodes, members, color, showNodeNumbers = true, showMemberNumbers = true, showCoordinateAxes = false, drawingContext = null) => { 
        ctx.strokeStyle = color; 
        ctx.lineWidth = 2; 
        
        // 座標軸を描画（必要な場合）
        if (showCoordinateAxes && drawingContext) {
            const canvas = ctx.canvas;
            drawCoordinateAxes(ctx, transform, drawingContext.scale, drawingContext.offsetX, drawingContext.offsetY, canvas.width, canvas.height);
        }
        
        // 部材番号の表示位置を計算（重複回避）
        const memberLabelPositions = showMemberNumbers ? 
            calculateMemberLabelPositions(members, nodes, transform, ctx) : [];
        
        members.forEach((m, memberIndex) => { 
            const start = transform(nodes[m.i].x, nodes[m.i].y); 
            const end = transform(nodes[m.j].x, nodes[m.j].y); 
            ctx.beginPath(); 
            ctx.moveTo(start.x, start.y); 
            ctx.lineTo(end.x, end.y); 
            ctx.stroke(); 
            
            // 部材番号を表示（改良版：重複回避）
            if (showMemberNumbers) {
                const labelInfo = memberLabelPositions.find(info => info.memberIndex === memberIndex);
                if (labelInfo) {
                    const memberText = (memberIndex + 1).toString();
                    
                    ctx.font = "10px Arial";
                    ctx.textAlign = "center";
                    
                    // 白背景の四角を描画
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(labelInfo.x, labelInfo.y, labelInfo.width, labelInfo.height);
                    
                    // 黒枠を描画
                    ctx.strokeStyle = "#000000";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(labelInfo.x, labelInfo.y, labelInfo.width, labelInfo.height);
                    
                    // 部材番号テキストを描画
                    ctx.fillStyle = "#000000";
                    ctx.fillText(memberText, labelInfo.textX, labelInfo.textY + 2);
                    
                    // 部材線描画用の設定を復元
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                }
            }
        });
        
        nodes.forEach((n, i) => { 
            const pos = transform(n.x, n.y); 
            ctx.fillStyle = "#000"; 
            ctx.beginPath(); 
            ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI); 
            ctx.fill(); 
            if (showNodeNumbers) { 
                ctx.fillStyle = "#333"; 
                ctx.font = "12px Arial";
                ctx.textAlign = "left";
                ctx.fillText(i + 1, pos.x + 8, pos.y - 8); 
            } 
        }); 
    };
    const drawConnections = (ctx, transform, nodes, members) => { ctx.fillStyle = 'white'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; const offset = 6; members.forEach(m => { const n_i = nodes[m.i]; const p_i = transform(n_i.x, n_i.y); if (m.i_conn === 'pinned') { const p_i_offset = { x: p_i.x + offset * m.c, y: p_i.y - offset * m.s }; ctx.beginPath(); ctx.arc(p_i_offset.x, p_i_offset.y, 3, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); } if (m.j_conn === 'pinned') { const n_j = nodes[m.j]; const p_j = transform(n_j.x, n_j.y); const p_j_offset = { x: p_j.x - offset * m.c, y: p_j.y + offset * m.s }; ctx.beginPath(); ctx.arc(p_j_offset.x, p_j_offset.y, 3, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); } }); };
    const drawBoundaryConditions = (ctx, transform, nodes) => { const size = 10; nodes.forEach(node => { if (node.support === 'free') return; const pos = transform(node.x, node.y); ctx.strokeStyle = '#008000'; ctx.fillStyle = '#008000'; ctx.lineWidth = 1.5; ctx.beginPath(); if (node.support === 'fixed') { ctx.moveTo(pos.x - size, pos.y + size); ctx.lineTo(pos.x + size, pos.y + size); for(let i=0; i < 5; i++){ ctx.moveTo(pos.x - size + i*size/2, pos.y + size); ctx.lineTo(pos.x - size + i*size/2 - size/2, pos.y + size + size/2); } } else if (node.support === 'pinned') { ctx.moveTo(pos.x, pos.y); ctx.lineTo(pos.x - size, pos.y + size); ctx.lineTo(pos.x + size, pos.y + size); ctx.closePath(); ctx.stroke(); ctx.moveTo(pos.x - size*1.2, pos.y + size); ctx.lineTo(pos.x + size*1.2, pos.y + size); } else if (node.support === 'roller') { ctx.moveTo(pos.x, pos.y); ctx.lineTo(pos.x - size, pos.y + size); ctx.lineTo(pos.x + size, pos.y + size); ctx.closePath(); ctx.stroke(); ctx.moveTo(pos.x - size, pos.y + size + 3); ctx.lineTo(pos.x + size, pos.y + size + 3); } ctx.stroke(); }); };
    const drawDimensions = (ctx, transform, nodes, members, labelManager, obstacles) => { const offset = 15; ctx.strokeStyle = '#0000ff'; ctx.lineWidth = 1; members.forEach(m => { const n1 = nodes[m.i]; const n2 = nodes[m.j]; const p1 = transform(n1.x, n1.y); const p2 = transform(n2.x, n2.y); const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2; const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x); const offsetX = offset * Math.sin(angle); const offsetY = -offset * Math.cos(angle); const labelTargetX = midX + offsetX; const labelTargetY = midY + offsetY; const labelText = `${m.length.toFixed(2)}m`; ctx.fillStyle = '#0000ff'; labelManager.draw(ctx, labelText, labelTargetX, labelTargetY, obstacles); }); };
    const drawExternalLoads = (ctx, transform, nodes, members, nodeLoads, memberLoads, memberSelfWeights, nodeSelfWeights, labelManager, obstacles) => { 
        const arrowSize = 10; 
        const loadScale = 3; 
        
        // 表示制御用チェックボックスの状態を取得
        const showExternalLoads = document.getElementById('show-external-loads')?.checked ?? true;
        const showSelfWeight = document.getElementById('show-self-weight')?.checked ?? true;
        
        // 両方のチェックが外れている場合は何も描画しない
        if (!showExternalLoads && !showSelfWeight) {
            return;
        }
        
        ctx.strokeStyle = '#ff4500'; 
        ctx.fillStyle = '#ff4500'; 
        ctx.lineWidth = 1.5; 
        
        // 分布荷重のテキスト領域を障害物として追加
        const loadObstacles = [...obstacles];
        
        // まず分布荷重を描画して、そのテキスト領域と矢印領域を障害物に追加
        memberLoads.forEach(load => { 
            if (load.w === 0) return; 
            
            // 荷重タイプに応じた表示制御
            if (load.isFromSelfWeight) {
                // 自重荷重の場合
                if (!showSelfWeight) return;
            } else {
                // 外部荷重の場合
                if (!showExternalLoads) return;
            }
            
            // 旧来のself-weightチェックボックスとの互換性を保持
            const considerSelfWeightCheckbox = document.getElementById('consider-self-weight');
            const isSelfWeightChecked = considerSelfWeightCheckbox && considerSelfWeightCheckbox.checked;
            
            // 自重荷重でチェックボックスがOFFの場合はスキップ
            if (load.isFromSelfWeight && !isSelfWeightChecked) {
                return;
            }
            
            const member = members[load.memberIndex]; 
            const p1 = transform(nodes[member.i].x, nodes[member.i].y); 
            const p2 = transform(nodes[member.j].x, nodes[member.j].y); 
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x); 
            const numArrows = 5; 
            const arrowLength = arrowSize * 1.5; 
            const arrowHeadSize = 5; 
            const dir = Math.sign(load.w); 
            const perpVecX = Math.sin(angle); 
            const perpVecY = -Math.cos(angle); 
            const firstArrowTipX = p1.x + dir * arrowLength * perpVecX; 
            const firstArrowTipY = p1.y + dir * arrowLength * perpVecY; 
            const lastArrowTipX = p2.x + dir * arrowLength * perpVecX; 
            const lastArrowTipY = p2.y + dir * arrowLength * perpVecY; 
            
            // 分布荷重の矢印領域を事前に計算して障害物として追加
            const arrowMinX = Math.min(p1.x, p2.x, firstArrowTipX, lastArrowTipX);
            const arrowMaxX = Math.max(p1.x, p2.x, firstArrowTipX, lastArrowTipX);
            const arrowMinY = Math.min(p1.y, p2.y, firstArrowTipY, lastArrowTipY);
            const arrowMaxY = Math.max(p1.y, p2.y, firstArrowTipY, lastArrowTipY);
            const arrowPadding = 5;
            const arrowObstacle = {
                x1: arrowMinX - arrowPadding,
                y1: arrowMinY - arrowPadding,
                x2: arrowMaxX + arrowPadding,
                y2: arrowMaxY + arrowPadding
            };
            loadObstacles.push(arrowObstacle);
            
            ctx.beginPath(); 
            ctx.moveTo(firstArrowTipX, firstArrowTipY); 
            ctx.lineTo(lastArrowTipX, lastArrowTipY); 
            ctx.stroke(); 
            
            for (let i = 0; i <= numArrows; i++) { 
                const ratio = i / numArrows; 
                const memberX = p1.x + (p2.x - p1.x) * ratio; 
                const memberY = p1.y + (p2.y - p1.y) * ratio; 
                const baseX = memberX + dir * arrowLength * perpVecX; 
                const baseY = memberY + dir * arrowLength * perpVecY; 
                ctx.beginPath(); 
                ctx.moveTo(baseX, baseY); 
                ctx.lineTo(memberX, memberY); 
                const headAngle = Math.atan2(memberY - baseY, memberX - baseX); 
                ctx.moveTo(memberX, memberY); 
                ctx.lineTo(memberX - arrowHeadSize * Math.cos(headAngle - Math.PI / 6), memberY - arrowHeadSize * Math.sin(headAngle - Math.PI / 6)); 
                ctx.moveTo(memberX, memberY); 
                ctx.lineTo(memberX - arrowHeadSize * Math.cos(headAngle + Math.PI / 6), memberY - arrowHeadSize * Math.sin(headAngle + Math.PI / 6)); 
                ctx.stroke(); 
            } 
            const textOffset = arrowLength + 10; 
            const textX = (p1.x + p2.x) / 2 + dir * textOffset * perpVecX; 
            const textY = (p1.y + p2.y) / 2 + dir * textOffset * perpVecY; 
            ctx.fillStyle = '#ff4500'; 
            
            // 等分布荷重のテキスト表示（自重でない荷重のみ）
            const loadText = `${Math.abs(load.w).toFixed(2)}kN/m`;
            labelManager.draw(ctx, loadText, textX, textY, [...obstacles, arrowObstacle], {
                type: 'member-load-w',
                index: load.memberIndex,
                value: load.w
            }); 
            
            // 分布荷重のテキスト領域を障害物として追加
            const displayText = loadText;
            const metrics = ctx.measureText(displayText);
            const w = metrics.width;
            const h = 12;
            const padding = 6;
            loadObstacles.push({
                x1: textX - w/2 - padding,
                y1: textY - h - padding,
                x2: textX + w/2 + padding,
                y2: textY + padding
            });
        }); 
        
        // 等分布荷重描画後に色をリセット
        ctx.strokeStyle = '#ff4500';
        ctx.fillStyle = '#ff4500';
        
        // 自重荷重を独立して描画（表示制御チェックボックスがONの場合のみ）
        const isSelfWeightChecked = document.getElementById('consider-self-weight-checkbox')?.checked;
        if (showSelfWeight && isSelfWeightChecked && memberSelfWeights && memberSelfWeights.length > 0) {
            ctx.strokeStyle = '#00aa00'; // 自重は緑色で表示
            ctx.fillStyle = '#00aa00';
            
            memberSelfWeights.forEach(load => {
                const member = members[load.memberIndex];
                const n1 = nodes[member.i], n2 = nodes[member.j];
                const p1 = transform(n1.x, n1.y), p2 = transform(n2.x, n2.y);
                const memberNumber = load.memberIndex + 1;
                
                if (load.loadType === 'distributed') {
                    // 水平部材：等分布荷重として描画
                    if (load.w === 0) return;
                    
                    const L = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
                    const arrowSpacing = 20, numArrows = Math.max(2, Math.floor(L / arrowSpacing));
                    const arrowLength = 15; // arrowLengthを外側で定義
                    
                    // 垂直下向きの矢印を描画
                    for (let i = 0; i <= numArrows; i++) {
                        const t = i / numArrows;
                        const x = p1.x + t * (p2.x - p1.x);
                        const y = p1.y + t * (p2.y - p1.y);
                        
                        ctx.beginPath();
                        ctx.moveTo(x, y - arrowLength);
                        ctx.lineTo(x, y);
                        ctx.lineTo(x - 3, y - 5);
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + 3, y - 5);
                        ctx.stroke();
                    }
                    
                    // 水平線を描画
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y - arrowLength);
                    ctx.lineTo(p2.x, p2.y - arrowLength);
                    ctx.stroke();
                    
                    const textX = (p1.x + p2.x) / 2;
                    const textY = (p1.y + p2.y) / 2 - 25;
                    const loadText = `部材${memberNumber}自重：${Math.abs(load.w).toFixed(2)}kN/m`;
                    labelManager.draw(ctx, loadText, textX, textY, loadObstacles);
                    
                } else if (load.loadType === 'concentrated') {
                    // 垂直部材：集中荷重として描画
                    const lowerY = Math.max(p1.y, p2.y);
                    const nodeX = p1.y > p2.y ? p1.x : p2.x;
                    const arrowLength = 20;
                    const arrowSize = 8;
                    
                    // 垂直下向きの集中荷重矢印
                    ctx.beginPath();
                    ctx.moveTo(nodeX, lowerY - arrowLength);
                    ctx.lineTo(nodeX, lowerY);
                    ctx.lineTo(nodeX - arrowSize/2, lowerY - arrowSize);
                    ctx.moveTo(nodeX, lowerY);
                    ctx.lineTo(nodeX + arrowSize/2, lowerY - arrowSize);
                    ctx.stroke();
                    
                    const textX = nodeX + 15;
                    const textY = lowerY - arrowLength/2;
                    // 集中荷重の個別表示は削除（節点合計で表示）
                    // const loadText = `部材${memberNumber}自重：${load.totalWeight.toFixed(2)}kN`;
                    // labelManager.draw(ctx, loadText, textX, textY, loadObstacles);
                    
                } else if (load.loadType === 'mixed') {
                    // 斜め部材：混合荷重として描画
                    
                    // 垂直成分（等分布荷重）の描画
                    if (load.w > 0) {
                        const L = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
                        const arrowSpacing = 20, numArrows = Math.max(2, Math.floor(L / arrowSpacing));
                        
                        for (let i = 0; i <= numArrows; i++) {
                            const t = i / numArrows;
                            const x = p1.x + t * (p2.x - p1.x);
                            const y = p1.y + t * (p2.y - p1.y);
                            const arrowLength = 12;
                            
                            // 垂直下向きの矢印
                            ctx.beginPath();
                            ctx.moveTo(x, y - arrowLength);
                            ctx.lineTo(x, y);
                            ctx.lineTo(x - 2, y - 4);
                            ctx.moveTo(x, y);
                            ctx.lineTo(x + 2, y - 4);
                            ctx.stroke();
                        }
                    }
                    
                    // 水平成分（節点荷重）の描画
                    if (load.horizontalComponent > 0) {
                        const arrowLength = 15;
                        const arrowSize = 6;
                        const horizontalDir = (p2.x - p1.x) > 0 ? 1 : -1;
                        
                        // 両端節点に水平矢印
                        [p1, p2].forEach((point, idx) => {
                            ctx.beginPath();
                            ctx.moveTo(point.x - arrowLength * horizontalDir, point.y);
                            ctx.lineTo(point.x, point.y);
                            ctx.lineTo(point.x - arrowSize * horizontalDir, point.y - arrowSize/2);
                            ctx.moveTo(point.x, point.y);
                            ctx.lineTo(point.x - arrowSize * horizontalDir, point.y + arrowSize/2);
                            ctx.stroke();
                        });
                    }
                    
                    const textX = (p1.x + p2.x) / 2;
                    const textY = (p1.y + p2.y) / 2 - 20;
                    // 混合荷重の個別表示は削除（節点合計で表示）
                    // const loadText = `部材${memberNumber}自重：${load.totalWeight.toFixed(2)}kN (混合)`;
                    // labelManager.draw(ctx, loadText, textX, textY, loadObstacles);
                }
                
                // 自重荷重のテキスト領域を障害物として追加（等分布荷重のみ）
                if (load.loadType === 'distributed') {
                    const displayText = `部材${memberNumber}自重：${Math.abs(load.w).toFixed(2)}kN/m`;
                    const metrics = ctx.measureText(displayText);
                    const w = metrics.width;
                    const h = 12;
                    const padding = 6;
                    const textX = (p1.x + p2.x) / 2;
                    const textY = (p1.y + p2.y) / 2 - 25;
                    loadObstacles.push({
                        x1: textX - w/2 - padding,
                        y1: textY - h - padding,
                        x2: textX + w/2 + padding,
                        y2: textY + padding
                    });
                }
            });
        }
        
        // 次に外部荷重による集中荷重を赤色で描画
        if (showExternalLoads) {
            nodeLoads.forEach(load => { 
                if (load.px === 0 && load.py === 0 && load.mz === 0) return; 
                const node = nodes[load.nodeIndex]; 
                const pos = transform(node.x, node.y); 
                
                // 外部荷重用の赤色で描画
                ctx.strokeStyle = '#ff4500';
                ctx.fillStyle = '#ff4500';
            
            if(load.px !== 0){ 
                const dir = Math.sign(load.px); 
                ctx.beginPath(); 
                ctx.moveTo(pos.x - arrowSize * loadScale * dir, pos.y); 
                ctx.lineTo(pos.x, pos.y); 
                ctx.lineTo(pos.x - arrowSize * dir, pos.y - arrowSize/2); 
                ctx.moveTo(pos.x, pos.y); 
                ctx.lineTo(pos.x - arrowSize * dir, pos.y + arrowSize/2); 
                ctx.stroke(); 
                
                // 荷重値のテキスト表示を矢印の先端近くに配置
                const textX = pos.x - (arrowSize * loadScale * 0.7) * dir;
                const textY = pos.y;
                ctx.fillStyle = '#ff4500';
                labelManager.draw(ctx, `${load.px}kN`, textX, textY, loadObstacles, {
                    type: 'node-load-px',
                    index: load.nodeIndex,
                    value: load.px
                });
            } 
            
            if(load.py !== 0){ 
                const dir = Math.sign(load.py); 
                ctx.beginPath(); 
                ctx.moveTo(pos.x, pos.y + arrowSize * loadScale * dir); 
                ctx.lineTo(pos.x, pos.y); 
                ctx.lineTo(pos.x - arrowSize/2, pos.y + arrowSize * dir); 
                ctx.moveTo(pos.x, pos.y); 
                ctx.lineTo(pos.x + arrowSize/2, pos.y + arrowSize * dir); 
                ctx.stroke(); 
                
                // 荷重値のテキスト表示を矢印の先端近くに配置
                const textX = pos.x;
                const textY = pos.y + (arrowSize * loadScale * 0.8) * dir;
                ctx.fillStyle = '#ff4500';
                labelManager.draw(ctx, `${load.py}kN`, textX, textY, loadObstacles, {
                    type: 'node-load-py',
                    index: load.nodeIndex,
                    value: load.py
                });
            } 
            
            if(load.mz !== 0){ 
                const dir = -Math.sign(load.mz); 
                const r = arrowSize * 1.5; 
                const arrowHeadSize = 5; 
                const startAngle = Math.PI; 
                const endAngle = Math.PI * 2.5; 
                ctx.beginPath(); 
                ctx.arc(pos.x, pos.y, r, startAngle, endAngle, dir < 0); 
                ctx.stroke(); 
                const endX = pos.x + r * Math.cos(endAngle); 
                const endY = pos.y + r * Math.sin(endAngle); 
                const smallAngleOffset = 0.05 * (dir > 0 ? -1 : 1); 
                const beforeX = pos.x + r * Math.cos(endAngle + smallAngleOffset); 
                const beforeY = pos.y + r * Math.sin(endAngle + smallAngleOffset); 
                const tangentAngle = Math.atan2(endY - beforeY, endX - beforeX); 
                ctx.beginPath(); 
                ctx.moveTo(endX, endY); 
                ctx.lineTo(endX - arrowHeadSize * Math.cos(tangentAngle - Math.PI / 6), endY - arrowHeadSize * Math.sin(tangentAngle - Math.PI / 6)); 
                ctx.lineTo(endX - arrowHeadSize * Math.cos(tangentAngle + Math.PI / 6), endY - arrowHeadSize * Math.sin(tangentAngle + Math.PI / 6)); 
                ctx.closePath(); 
                ctx.fill(); 
                
                // モーメント荷重値のテキスト表示を矢印の近くに配置
                const textX = pos.x;
                const textY = pos.y - r * 0.7;
                ctx.fillStyle = '#ff4500';
                labelManager.draw(ctx, `${load.mz}kN·m`, textX, textY, loadObstacles, {
                    type: 'node-load-mz',
                    index: load.nodeIndex,
                    value: load.mz
                });
            } 
            });
        }
        
        // 自重による集中荷重を緑色で描画
        if (showSelfWeight) {
            // 1. 個別の矢印描画
            nodeSelfWeights.forEach(load => { 
                if (load.px === 0 && load.py === 0 && load.mz === 0) return; 
                const node = nodes[load.nodeIndex]; 
                const pos = transform(node.x, node.y); 
                
                // 自重荷重用の緑色で描画
                ctx.strokeStyle = '#32CD32';
                ctx.fillStyle = '#32CD32';
            
            if(load.px !== 0){ 
                const dir = Math.sign(load.px); 
                ctx.beginPath(); 
                ctx.moveTo(pos.x - arrowSize * loadScale * dir, pos.y); 
                ctx.lineTo(pos.x, pos.y); 
                ctx.lineTo(pos.x - arrowSize * dir, pos.y - arrowSize/2); 
                ctx.moveTo(pos.x, pos.y); 
                ctx.lineTo(pos.x - arrowSize * dir, pos.y + arrowSize/2); 
                ctx.stroke(); 
            } 
            
            if(load.py !== 0){ 
                const dir = Math.sign(load.py); 
                ctx.beginPath(); 
                ctx.moveTo(pos.x, pos.y + arrowSize * loadScale * dir); 
                ctx.lineTo(pos.x, pos.y); 
                ctx.lineTo(pos.x - arrowSize/2, pos.y + arrowSize * dir); 
                ctx.moveTo(pos.x, pos.y); 
                ctx.lineTo(pos.x + arrowSize/2, pos.y + arrowSize * dir); 
                ctx.stroke(); 
            } 
            
            if(load.mz !== 0){ 
                const dir = -Math.sign(load.mz); 
                const r = arrowSize * 1.5; 
                const arrowHeadSize = 5; 
                const startAngle = Math.PI; 
                const endAngle = Math.PI * 2.5; 
                ctx.beginPath(); 
                ctx.arc(pos.x, pos.y, r, startAngle, endAngle, dir < 0); 
                ctx.stroke(); 
                const endX = pos.x + r * Math.cos(endAngle); 
                const endY = pos.y + r * Math.sin(endAngle); 
                const smallAngleOffset = 0.05 * (dir > 0 ? -1 : 1); 
                const beforeX = pos.x + r * Math.cos(endAngle + smallAngleOffset); 
                const beforeY = pos.y + r * Math.sin(endAngle + smallAngleOffset); 
                const tangentAngle = Math.atan2(endY - beforeY, endX - beforeX); 
                ctx.beginPath(); 
                ctx.moveTo(endX, endY); 
                ctx.lineTo(endX - arrowHeadSize * Math.cos(tangentAngle - Math.PI / 6), endY - arrowHeadSize * Math.sin(tangentAngle - Math.PI / 6)); 
                ctx.lineTo(endX - arrowHeadSize * Math.cos(tangentAngle + Math.PI / 6), endY - arrowHeadSize * Math.sin(tangentAngle + Math.PI / 6)); 
                ctx.closePath(); 
                ctx.fill(); 
            }
        });
        
        // 2. 節点ごとの合計荷重を計算してラベル表示
        const nodeWeightSummary = new Map();
        console.log('📊 nodeSelfWeights詳細:');
        nodeSelfWeights.forEach((load, idx) => {
            console.log(`  [${idx}] 節点${load.nodeIndex + 1}: px=${load.px.toFixed(3)}, py=${load.py.toFixed(3)}, mz=${load.mz.toFixed(3)}`);
            
            const nodeIndex = load.nodeIndex;
            if (!nodeWeightSummary.has(nodeIndex)) {
                nodeWeightSummary.set(nodeIndex, { px: 0, py: 0, mz: 0 });
            }
            
            const summary = nodeWeightSummary.get(nodeIndex);
            summary.px += load.px;
            summary.py += load.py;
            summary.mz += load.mz;
        });
        
        // デバッグログ
        console.log('📊 節点自重表示処理:');
        console.log('  対象節点荷重数:', nodeSelfWeights.length);
        console.log('  表示予定節点数:', nodeWeightSummary.size);
        nodeWeightSummary.forEach((totalLoad, nodeIndex) => {
            const totalForce = Math.sqrt(totalLoad.px * totalLoad.px + totalLoad.py * totalLoad.py);
            console.log(`  節点${nodeIndex + 1}: 合力=${totalForce.toFixed(3)}kN, px=${totalLoad.px.toFixed(3)}, py=${totalLoad.py.toFixed(3)}, mz=${totalLoad.mz.toFixed(3)}`);
        });
        
        // 3. 合計ラベルを描画
        nodeWeightSummary.forEach((totalLoad, nodeIndex) => {
            const node = nodes[nodeIndex];
            const pos = transform(node.x, node.y);
            const nodeNumber = nodeIndex + 1;
            
            // 合計荷重を計算
            const totalForce = Math.sqrt(totalLoad.px * totalLoad.px + totalLoad.py * totalLoad.py);
            const hasMoment = Math.abs(totalLoad.mz) > 0.001;
            
            // デバッグログ
            console.log(`  節点${nodeNumber}処理中: 合力=${totalForce.toFixed(3)}, モーメント=${hasMoment}, px=${totalLoad.px.toFixed(3)}, py=${totalLoad.py.toFixed(3)}`);
            
            // 表示のしきい値をより低く設定
            if (totalForce < 0.001 && !hasMoment) {
                console.log(`  節点${nodeNumber}: しきい値未満でスキップ (合力=${totalForce.toFixed(6)}, モーメント=${Math.abs(totalLoad.mz).toFixed(6)})`);
                return;
            }
            
            // 表示位置を決定（最も大きな荷重成分の位置を基準）
            let textX, textY;
            const maxPx = Math.abs(totalLoad.px);
            const maxPy = Math.abs(totalLoad.py);
            const maxMz = Math.abs(totalLoad.mz);
            
            if (maxPx >= maxPy && maxPx >= maxMz && totalLoad.px !== 0) {
                // X方向荷重が最大の場合
                const dir = Math.sign(totalLoad.px);
                textX = pos.x - (arrowSize * loadScale * 0.9) * dir;
                textY = pos.y - 8;
            } else if (maxPy >= maxPx && maxPy >= maxMz && totalLoad.py !== 0) {
                // Y方向荷重が最大の場合
                const dir = Math.sign(totalLoad.py);
                textX = pos.x + 8;
                textY = pos.y + (arrowSize * loadScale * 0.9) * dir;
            } else if (totalLoad.mz !== 0) {
                // モーメント荷重がある場合
                const r = arrowSize * 1.5;
                textX = pos.x + r * 0.8;
                textY = pos.y - r * 0.5;
            } else {
                // デフォルト位置
                textX = pos.x + 8;
                textY = pos.y - 8;
            }
            
            // 合計荷重値のテキスト表示
            ctx.fillStyle = '#32CD32';
            let labelText;
            if (hasMoment && totalForce > 0.001) {
                // 力とモーメントの両方がある場合
                labelText = `節点${nodeNumber}自重：${totalForce.toFixed(2)}kN, ${Math.abs(totalLoad.mz).toFixed(2)}kN·m`;
            } else if (hasMoment) {
                // モーメントのみの場合
                labelText = `節点${nodeNumber}自重：${Math.abs(totalLoad.mz).toFixed(2)}kN·m`;
            } else {
                // 力のみの場合
                labelText = `節点${nodeNumber}自重：${totalForce.toFixed(2)}kN`;
            }
            
            console.log(`  節点${nodeNumber}: "${labelText}" を位置 (${textX.toFixed(1)}, ${textY.toFixed(1)}) に表示`);
            labelManager.draw(ctx, labelText, textX, textY, loadObstacles);
        }); 
        }

        // ==========================================================
        // ▼▼▼ ここからが強制変位を描画するための追加コードです ▼▼▼
        // ==========================================================
        const dispArrowSize = 8;
        const dispScale = 2.5;

        // 強制変位用に色と線の太さを設定 (紫)
        ctx.strokeStyle = '#8e44ad';
        ctx.fillStyle = '#8e44ad';
        ctx.lineWidth = 2.0;

        nodes.forEach((node, i) => {
            const dx = node.dx_forced || 0; // m
            const dy = node.dy_forced || 0; // m
            const r = node.r_forced || 0;  // rad

            if (dx === 0 && dy === 0 && r === 0) return;

            const pos = transform(node.x, node.y);

            // X方向の強制変位を描画
            if (dx !== 0) {
                const dir = Math.sign(dx);
                const text = `${(dx * 1000).toFixed(1)}mm`;
                ctx.beginPath();
                ctx.moveTo(pos.x - dispArrowSize * dispScale * dir, pos.y);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
                // 荷重と区別するための二重矢印
                ctx.beginPath();
                ctx.moveTo(pos.x - dispArrowSize * dir, pos.y - dispArrowSize / 2);
                ctx.lineTo(pos.x, pos.y);
                ctx.lineTo(pos.x - dispArrowSize * dir, pos.y + dispArrowSize / 2);
                ctx.moveTo(pos.x - dispArrowSize * 0.5 * dir, pos.y - dispArrowSize * 0.3);
                ctx.lineTo(pos.x, pos.y);
                ctx.lineTo(pos.x - dispArrowSize * 0.5 * dir, pos.y + dispArrowSize * 0.3);
                ctx.stroke();
                const textX = pos.x - (dispArrowSize * dispScale * 0.7) * dir;
                labelManager.draw(ctx, text, textX, pos.y, loadObstacles);
            }

            // Y方向の強制変位を描画
            if (dy !== 0) {
                const dir = Math.sign(dy);
                const text = `${(dy * 1000).toFixed(1)}mm`;
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y + dispArrowSize * dispScale * dir);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
                // 荷重と区別するための二重矢印
                ctx.beginPath();
                ctx.moveTo(pos.x - dispArrowSize / 2, pos.y + dispArrowSize * dir);
                ctx.lineTo(pos.x, pos.y);
                ctx.lineTo(pos.x + dispArrowSize / 2, pos.y + dispArrowSize * dir);
                ctx.moveTo(pos.x - dispArrowSize * 0.3, pos.y + dispArrowSize * 0.5 * dir);
                ctx.lineTo(pos.x, pos.y);
                ctx.lineTo(pos.x + dispArrowSize * 0.3, pos.y + dispArrowSize * 0.5 * dir);
                ctx.stroke();
                const textY = pos.y + (dispArrowSize * dispScale * 0.8) * dir;
                labelManager.draw(ctx, text, pos.x, textY, loadObstacles);
            }

            // 強制回転を描画
            if (r !== 0) {
                const dir = -Math.sign(r);
                const radius = dispArrowSize * 1.8;
                const arrowHeadSize = 6;
                const startAngle = Math.PI, endAngle = Math.PI * 2.5;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, radius, startAngle, endAngle, dir < 0);
                ctx.stroke();
                const endX = pos.x + radius * Math.cos(endAngle), endY = pos.y + radius * Math.sin(endAngle);
                const smallAngleOffset = 0.05 * (dir > 0 ? -1 : 1);
                const beforeX = pos.x + radius * Math.cos(endAngle + smallAngleOffset), beforeY = pos.y + radius * Math.sin(endAngle + smallAngleOffset);
                const tangentAngle = Math.atan2(endY - beforeY, endX - beforeX);
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - arrowHeadSize * Math.cos(tangentAngle - Math.PI / 4), endY - arrowHeadSize * Math.sin(tangentAngle - Math.PI / 4));
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - arrowHeadSize * Math.cos(tangentAngle + Math.PI / 4), endY - arrowHeadSize * Math.sin(tangentAngle + Math.PI / 4));
                ctx.stroke();
                const textY = pos.y - radius * 1.2;
                labelManager.draw(ctx, `${r.toFixed(3)}rad`, pos.x, textY, loadObstacles);
            }
        });
        // ==========================================================
        // ▲▲▲ ここまでが追加コードです ▲▲▲
        // ==========================================================
    };
    const drawGrid = (ctx, transform, width, height) => { const { x: minX, y: maxY } = inverseTransform(0,0); const { x: maxX, y: minY } = inverseTransform(width, height); const spacing = parseFloat(elements.gridSpacing.value); if (isNaN(spacing) || spacing <= 0) return; ctx.strokeStyle = '#e9e9e9'; ctx.lineWidth = 1; const startX = Math.floor(minX / spacing) * spacing; for (let x = startX; x <= maxX; x += spacing) { const p1 = transform(x, minY); const p2 = transform(x, maxY); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); } const startY = Math.floor(minY / spacing) * spacing; for (let y = startY; y <= maxY; y += spacing) { const p1 = transform(minX, y); const p2 = transform(maxX, y); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); } };
    const LabelManager = () => {
        const drawnLabels = []; // 描画したラベル情報をすべて保存する配列
        const isOverlapping = (rect1, rect2) => !(rect1.x2 < rect2.x1 || rect1.x1 > rect2.x2 || rect1.y2 < rect2.y1 || rect1.y1 > rect2.y2);
        return {
            draw: (ctx, text, targetX, targetY, obstacles = [], options = {}) => {
                const bounds = options.bounds || null;
                const metrics = ctx.measureText(text);
                const w = metrics.width;
                const h = metrics.fontBoundingBoxAscent ?? 12;
                const padding = 12; // パディングを増やして重複を避ける
                const candidates = [
                    [w/2 + padding, -padding, 'left', 'bottom'],
                    [-w/2 - padding, -padding, 'right', 'bottom'],
                    [w/2 + padding, h + padding, 'left', 'top'],
                    [-w/2 - padding, h + padding, 'right', 'top'],
                    [0, -h - padding, 'center', 'bottom'],
                    [0, h + padding, 'center', 'top'],
                    [w/2 + padding, h/2, 'left', 'middle'],
                    [-w/2 - padding, h/2, 'right', 'middle'],
                    // フォールバック候補（より遠い位置）
                    [w/2 + padding * 3, -padding * 3, 'left', 'bottom'],
                    [-w/2 - padding * 3, -padding * 3, 'right', 'bottom'],
                    [0, -h - padding * 3, 'center', 'bottom'],
                    [0, h + padding * 3, 'center', 'top']
                ];

                for (const cand of candidates) {
                    const x = targetX + cand[0];
                    const y = targetY + cand[1];
                    let rect;
                    if (cand[2] === 'left') rect = { x1: x, y1: y - h, x2: x + w, y2: y };
                    else if (cand[2] === 'right') rect = { x1: x - w, y1: y - h, x2: x, y2: y };
                    else rect = { x1: x - w/2, y1: y - h, x2: x + w/2, y2: y };

                    const paddedRect = {x1: rect.x1 - padding, y1: rect.y1 - padding, x2: rect.x2 + padding, y2: rect.y2 + padding};
                    let isInvalid = false;

                    for (const existing of [...drawnLabels.map(l => l.rect), ...obstacles]) {
                        if (isOverlapping(paddedRect, existing)) {
                            isInvalid = true;
                            break;
                        }
                    }
                    if (isInvalid) continue;

                    if (bounds) {
                        if (paddedRect.x1 < bounds.x1 || paddedRect.x2 > bounds.x2 || paddedRect.y1 < bounds.y1 || paddedRect.y2 > bounds.y2) {
                            isInvalid = true;
                        }
                    }
                    if (isInvalid) continue;

                    ctx.textAlign = cand[2];
                    ctx.textBaseline = cand[3];
                    ctx.fillText(text, x, y);

                    // 編集に必要な情報を保存
                    const centerX = (rect.x1 + rect.x2) / 2;
                    const centerY = (rect.y1 + rect.y2) / 2;
                    drawnLabels.push({
                        rect: paddedRect,
                        center: { x: centerX, y: centerY },
                        width: w + padding * 2,
                        value: options.value,
                        type: options.type,
                        index: options.index,
                    });
                    return;
                }

                // フォールバック: 全候補がブロックされた場合、最初の候補位置に強制表示
                const fallbackCand = candidates[0];
                const x = targetX + fallbackCand[0];
                const y = targetY + fallbackCand[1];
                let rect;
                if (fallbackCand[2] === 'left') rect = { x1: x, y1: y - h, x2: x + w, y2: y };
                else if (fallbackCand[2] === 'right') rect = { x1: x - w, y1: y - h, x2: x, y2: y };
                else rect = { x1: x - w/2, y1: y - h, x2: x + w/2, y2: y };

                const paddedRect = {x1: rect.x1 - padding, y1: rect.y1 - padding, x2: rect.x2 + padding, y2: rect.y2 + padding};
                ctx.textAlign = fallbackCand[2];
                ctx.textBaseline = fallbackCand[3];
                ctx.fillText(text, x, y);

                // フォールバックの場合も情報を保存
                const centerX = (rect.x1 + rect.x2) / 2;
                const centerY = (rect.y1 + rect.y2) / 2;
                drawnLabels.push({
                    rect: paddedRect,
                    center: { x: centerX, y: centerY },
                    width: w + padding * 2,
                    value: options.value,
                    type: options.type,
                    index: options.index,
                });
            },
            getLabelAt: (x, y) => {
                // 最も手前に描画されたラベルから逆順に検索
                for (let i = drawnLabels.length - 1; i >= 0; i--) {
                    const label = drawnLabels[i];
                    if (x >= label.rect.x1 && x <= label.rect.x2 && y >= label.rect.y1 && y <= label.rect.y2) {
                        return label;
                    }
                }
                return null;
            },
            clear: () => {
                drawnLabels.length = 0;
            }
        };
    };
    const drawOnCanvas = () => {
        const drawingCtx = getDrawingContext(elements.modelCanvas);
        if (!drawingCtx) return; // Should not happen with the modified getDrawingContext

        lastDrawingContext = drawingCtx;
        window.lastDrawingContext = drawingCtx;
        const { ctx, transform } = drawingCtx;
        try {
            if (elements.gridToggle.checked) {
                drawGrid(ctx, transform, elements.modelCanvas.clientWidth, elements.modelCanvas.clientHeight);
            }
            const { nodes, members, nodeLoads, memberLoads, memberSelfWeights, nodeSelfWeights } = parseInputs();
            if (nodes.length > 0) {
                const labelManager = LabelManager();
                window.lastLabelManager = labelManager; // グローバルにアクセス可能にする
                const nodeObstacles = nodes.map(n => {
                    const pos = transform(n.x, n.y);
                    const metrics = ctx.measureText(nodes.indexOf(n) + 1);
                    const textWidth = metrics.width;
                    return { x1: pos.x - 12, y1: pos.y - 12 - 16, x2: pos.x + 12 + textWidth, y2: pos.y + 12 }; // 障害物サイズを拡大
                });
                drawStructure(ctx, transform, nodes, members, '#333', true, true, true, drawingCtx);
                drawConnections(ctx, transform, nodes, members);
                drawBoundaryConditions(ctx, transform, nodes);
                drawDimensions(ctx, transform, nodes, members, labelManager, nodeObstacles);
                drawExternalLoads(ctx, transform, nodes, members, nodeLoads, memberLoads, memberSelfWeights, nodeSelfWeights, labelManager, nodeObstacles);
                if (canvasMode === 'addMember' && firstMemberNode !== null) {
                    const node = nodes[firstMemberNode];
                    const pos = transform(node.x, node.y);
                    ctx.fillStyle = 'rgba(255, 165, 0, 0.5)';
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
                    ctx.fill();
                }
                
                // 部材追加モードでの視覚的フィードバック
                if (canvasMode === 'addMember') {
                    ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.arc(currentMouseX, currentMouseY, 12, 0, 2 * Math.PI);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    // 新規節点作成予定を示すテキスト
                    ctx.fillStyle = 'rgba(0, 150, 255, 0.9)';
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('クリックで節点選択または新規作成', currentMouseX, currentMouseY - 20);
                }
            }
        } catch (e) {
            console.error("Drawing error:", e);
        }
        
        // 複数選択された要素を強調表示
        highlightSelectedElements();

        // 不安定要素をハイライト表示
        highlightInstabilityElements(ctx, transform);

        drawSelectionRectangle(ctx);

        // 3Dビューアにモデルデータを送信
        sendModelToViewer();
    };
    
    // Make drawOnCanvas globally accessible
    window.drawOnCanvas = drawOnCanvas;
    
    const drawDisplacementDiagram = (nodes, members, D_global, memberLoads, manualScale = null) => {
        const drawingCtx = getDrawingContext(elements.displacementCanvas);
        if (!drawingCtx) return;
        const { ctx, transform, scale } = drawingCtx;
        
        // D_globalが未定義または空の場合は描画をスキップ
        if (!D_global || !Array.isArray(D_global) || D_global.length === 0) {
            console.warn('変位図: D_globalが未定義または空です');
            return;
        }
        
        console.log('変位図: 描画開始', { 
            hasNodes: !!nodes, 
            hasMembers: !!members, 
            d_global_length: D_global.length,
            displacement_state: resultPanZoomStates.displacement
        });
        
        let dispScale = 0;
        if (D_global.length > 0) {
            if (manualScale !== null) {
                dispScale = manualScale;
            } else {
                let max_dx = 0, max_dy = 0;
                members.forEach((m, idx) => {
                    const L = m.length, c = m.c, s = m.s;
                    const d_global_member_vec = [ ...D_global.slice(m.i * 3, m.i * 3 + 3), ...D_global.slice(m.j * 3, m.j * 3 + 3) ];
                    const d_local_vec = mat.multiply(m.T, d_global_member_vec);
                    const [ui, vi, thi, uj, vj, thj] = d_local_vec.map(v => v[0]);
                    const load = memberLoads.find(l => l.memberIndex === idx), w = load ? load.w : 0, E = m.E, I = m.I;
                    for (let k = 0; k <= 20; k++) {
                        const x = (k / 20) * L, xi = x / L;
                        const N1 = 1 - 3*xi**2 + 2*xi**3, N2 = x * (1 - xi)**2, N3 = 3*xi**2 - 2*xi**3, N4 = (x**2 / L) * (xi - 1);
                        const u_local = (1 - xi) * ui + xi * uj, v_homogeneous = N1*vi + N2*thi + N3*vj + N4*thj;
                        let v_particular = 0;
                        if (w !== 0 && E > 0 && I > 0) {
                            if (m.i_conn === 'rigid' && m.j_conn === 'rigid') v_particular = (w * x**2 * (L - x)**2) / (24 * E * I);
                            else if (m.i_conn === 'pinned' && m.j_conn === 'pinned') v_particular = (w * x * (L**3 - 2 * L * x**2 + x**3)) / (24 * E * I);
                            else if (m.i_conn === 'rigid' && m.j_conn === 'pinned') v_particular = (w * x**2 * (3 * L**2 - 5 * L * x + 2 * x**2)) / (48 * E * I);
                            else if (m.i_conn === 'pinned' && m.j_conn === 'rigid') v_particular = (w * x * (L**3 - 3 * L * x**2 + 2 * x**3)) / (48 * E * I);
                        }
                        const v_local = v_homogeneous - v_particular;
                        max_dx = Math.max(max_dx, Math.abs(u_local * c - v_local * s));
                        max_dy = Math.max(max_dy, Math.abs(u_local * s + v_local * c));
                    }
                });
                // モデルの最大変位量 (モデル単位)
                const max_model_disp = Math.max(max_dx, max_dy);

                // 目標とする画面上の最大変位ピクセル数 (この値を変えると、変位図の見た目の大きさが変わります)
                const TARGET_MAX_DISP_PIXELS = 40;

                if (max_model_disp > 1e-12 && scale > 1e-12) {
                    // 表示倍率 = (目標ピクセル数) / (モデル単位の最大変位量 * 描画スケール)
                    const autoScale = TARGET_MAX_DISP_PIXELS / (max_model_disp * scale);
                    // 極端に大きい値や小さい値にならないように調整
                    dispScale = isFinite(autoScale) ? Math.max(0.1, Math.min(autoScale, 5000)) : 0;
                } else {
                    dispScale = 0;
                }
                lastDisplacementScale = dispScale;
                dispScaleInput.value = dispScale.toFixed(2);
            }
        }
        drawStructure(ctx, transform, nodes, members, '#ccc', true, true);
        ctx.fillStyle = '#333'; ctx.textAlign = 'left'; ctx.fillText(`表示倍率: ${dispScale.toFixed(2)} 倍`, 10, 20);
        ctx.strokeStyle = 'red'; ctx.lineWidth = 2;
        const maxIntermediateLabels = [];
        members.forEach((m, idx) => {
            const L = m.length, c = m.c, s = m.s, ni = nodes[m.i];
            const d_global_member_vec = [ ...D_global.slice(m.i * 3, m.i * 3 + 3), ...D_global.slice(m.j * 3, m.j * 3 + 3) ];
            const d_local_vec = mat.multiply(m.T, d_global_member_vec), [ui, vi, thi, uj, vj, thj] = d_local_vec.map(v => v[0]);
            const load = memberLoads.find(l => l.memberIndex === idx), w = load ? load.w : 0, E = m.E, I = m.I;
            let maxDispMag = 0, maxDispPoint = null;
            ctx.beginPath();
            for (let k = 0; k <= 20; k++) {
                const x = (k / 20) * L, xi = x / L;
                const N1=1-3*xi**2+2*xi**3, N2=x*(1-xi)**2, N3=3*xi**2-2*xi**3, N4=(x**2/L)*(xi-1);
                const u_local = (1-xi)*ui+xi*uj, v_homogeneous = N1*vi+N2*thi+N3*vj+N4*thj;
                let v_particular = 0;
                if (w !== 0 && E > 0 && I > 0) {
                    if (m.i_conn==='rigid'&&m.j_conn==='rigid') v_particular=(w*x**2*(L-x)**2)/(24*E*I);
                    else if(m.i_conn==='pinned'&&m.j_conn==='pinned')v_particular=(w*x*(L**3-2*L*x**2+x**3))/(24*E*I);
                    else if(m.i_conn==='rigid'&&m.j_conn==='pinned')v_particular=(w*x**2*(3*L**2-5*L*x+2*x**2))/(48*E*I);
                    else if(m.i_conn==='pinned'&&m.j_conn==='rigid')v_particular=(w*x*(L**3-3*L*x**2+2*x**3))/(48*E*I);
                }
                const v_local = v_homogeneous - v_particular;
                const disp_x_global=u_local*c-v_local*s, disp_y_global=u_local*s+v_local*c, dispMag=Math.sqrt(disp_x_global**2+disp_y_global**2);
                if (dispMag > maxDispMag) { maxDispMag=dispMag; const original_x=ni.x+x*c, original_y=ni.y+x*s; maxDispPoint={x:original_x,y:original_y,dx:disp_x_global,dy:disp_y_global,mag:maxDispMag}; }
                const p = transform(ni.x+x*c+disp_x_global*dispScale, ni.y+x*s+disp_y_global*dispScale);
                if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
            const disp_i_mag = Math.sqrt(D_global[m.i*3][0]**2 + D_global[m.i*3+1][0]**2);
            const disp_j_mag = Math.sqrt(D_global[m.j*3][0]**2 + D_global[m.j*3+1][0]**2);
            if (maxDispPoint && maxDispMag > disp_i_mag && maxDispMag > disp_j_mag) { maxIntermediateLabels.push({x:maxDispPoint.x+maxDispPoint.dx*dispScale,y:maxDispPoint.y+maxDispPoint.dy*dispScale,label:`${(maxDispPoint.mag*1000).toFixed(2)}mm`}); }
        });
        const labelManager = LabelManager(), allObstacles = [];
        const rect = elements.displacementCanvas.getBoundingClientRect(), canvasBounds = { x1: 5, y1: 25, x2: rect.width - 5, y2: rect.height - 5 };
        nodes.forEach((n,i) => { const dx=D_global[i*3][0], dy=D_global[i*3+1][0]; const p_def = transform(n.x+dx*dispScale, n.y+dy*dispScale); allObstacles.push({x1:p_def.x-12,y1:p_def.y-12,x2:p_def.x+12,y2:p_def.y+12}); const p_orig = transform(n.x,n.y); const metrics = ctx.measureText(`${i+1}`); allObstacles.push({x1:p_orig.x+12,y1:p_orig.y-12-16,x2:p_orig.x+12+metrics.width,y2:p_orig.y+12}); });
        ctx.fillStyle='#00008b'; ctx.font="bold 22px Arial"; // 11pxから22pxに変更（2倍）
        nodes.forEach((n, i) => { const dx_mm=D_global[i*3][0]*1000, dy_mm=D_global[i*3+1][0]*1000; if (Math.sqrt(dx_mm**2+dy_mm**2)>1e-3) { const dx=D_global[i*3][0], dy=D_global[i*3+1][0]; const p_def=transform(n.x+dx*dispScale,n.y+dy*dispScale); const labelText=`(${dx_mm.toFixed(2)}, ${dy_mm.toFixed(2)})mm`; labelManager.draw(ctx,labelText,p_def.x,p_def.y,allObstacles,canvasBounds); } });
        ctx.fillStyle='#8b0000'; ctx.font="bold 22px Arial"; // 2倍のサイズに変更
        maxIntermediateLabels.forEach(lbl => { const p_def=transform(lbl.x,lbl.y); allObstacles.push({x1:p_def.x-12,y1:p_def.y-12,x2:p_def.x+12,y2:p_def.y+12}); labelManager.draw(ctx,lbl.label,p_def.x,p_def.y,allObstacles,canvasBounds); });
    };

    // 曲げモーメント図専用のラベル描画関数
    const drawNodeMomentLabel = (ctx, nodeIndex, text, nodeX, nodeY, nodeLabels, drawnLabels, memberIndex, memberEnd, memberDirection, memberLineStart, memberLineEnd) => {
        const metrics = ctx.measureText(text);
        const w = metrics.width;
        const h = 24; // フォントサイズ
        const padding = 12; // パディングを増やして重なりを防ぐ
        
        // 節点のモーメント情報を管理（部材インデックスと端部情報を含む）
        const momentKey = `${nodeIndex}_${memberIndex}_${memberEnd}`;
        
        // 部材ライン上での位置を計算
        let labelX, labelY;
        
        if (memberLineStart && memberLineEnd) {
            // 部材ライン上で節点から少し離れた位置に配置
            const memberLength = Math.sqrt((memberLineEnd.x - memberLineStart.x) ** 2 + (memberLineEnd.y - memberLineStart.y) ** 2);
            const offsetFromNode = 30; // 節点から30ピクセル離れた位置に変更
            
            if (memberEnd === 'i') {
                // 節点i側の場合、部材ライン上で節点から少し離れた位置
                const ratio = Math.min(offsetFromNode / memberLength, 0.25); // 最大25%の位置まで
                labelX = memberLineStart.x + (memberLineEnd.x - memberLineStart.x) * ratio;
                labelY = memberLineStart.y + (memberLineEnd.y - memberLineStart.y) * ratio;
            } else {
                // 節点j側の場合、部材ライン上で節点から少し離れた位置
                const ratio = Math.max(1 - offsetFromNode / memberLength, 0.75); // 最小75%の位置から
                labelX = memberLineStart.x + (memberLineEnd.x - memberLineStart.x) * ratio;
                labelY = memberLineStart.y + (memberLineEnd.y - memberLineStart.y) * ratio;
            }
        } else {
            // フォールバック: 節点位置を使用
            labelX = nodeX;
            labelY = nodeY - h - padding;
        }
        
        // 重複チェックと位置調整
        let finalLabelX = labelX;
        let finalLabelY = labelY;
        const rect = { x1: labelX - w/2, y1: labelY - h/2, x2: labelX + w/2, y2: labelY + h/2 };
        const paddedRect = { x1: rect.x1 - padding, y1: rect.y1 - padding, x2: rect.x2 + padding, y2: rect.y2 + padding };
        
        // 既存のラベルとの重複をチェック
        let isOverlapping = false;
        for (const existing of drawnLabels) {
            if (!(paddedRect.x2 < existing.x1 || paddedRect.x1 > existing.x2 || paddedRect.y2 < existing.y1 || paddedRect.y1 > existing.y2)) {
                isOverlapping = true;
                break;
            }
        }
        
        // 重複している場合は位置を調整
        if (isOverlapping && memberLineStart && memberLineEnd) {
            // 部材ライン上でより離れた位置を試す
            const memberLength = Math.sqrt((memberLineEnd.x - memberLineStart.x) ** 2 + (memberLineEnd.y - memberLineStart.y) ** 2);
            const extendedOffset = 50; // より離れた位置
            
            if (memberEnd === 'i') {
                const ratio = Math.min(extendedOffset / memberLength, 0.4);
                finalLabelX = memberLineStart.x + (memberLineEnd.x - memberLineStart.x) * ratio;
                finalLabelY = memberLineStart.y + (memberLineEnd.y - memberLineStart.y) * ratio;
            } else {
                const ratio = Math.max(1 - extendedOffset / memberLength, 0.6);
                finalLabelX = memberLineStart.x + (memberLineEnd.x - memberLineStart.x) * ratio;
                finalLabelY = memberLineStart.y + (memberLineEnd.y - memberLineStart.y) * ratio;
            }
        }
        
        // テキストを描画（四角囲いなし）
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, finalLabelX, finalLabelY);
        
        // 描画済みラベルとして登録（重複チェック用）
        const finalRect = { x1: finalLabelX - w/2, y1: finalLabelY - h/2, x2: finalLabelX + w/2, y2: finalLabelY + h/2 };
        const finalPaddedRect = { x1: finalRect.x1 - padding, y1: finalRect.y1 - padding, x2: finalRect.x2 + padding, y2: finalRect.y2 + padding };
        drawnLabels.push(finalPaddedRect);
        
        nodeLabels.set(momentKey, {
            text: text,
            position: { x: finalLabelX, y: finalLabelY },
            nodePosition: { x: nodeX, y: nodeY }
        });
    };

    const drawIntermediateMomentLabel = (ctx, text, x, y, drawnLabels, memberIndex, memberEnd) => {
        const metrics = ctx.measureText(text);
        const w = metrics.width;
        const h = 24;
        const padding = 8;
        
        const candidates = [
            [0, -h - padding, 'center', 'bottom'],
            [w/2 + padding, -padding, 'left', 'bottom'],
            [-w/2 - padding, -padding, 'right', 'bottom'],
            [0, h + padding, 'center', 'top'],
            [w/2 + padding, h + padding, 'left', 'top'],
            [-w/2 - padding, h + padding, 'right', 'top']
        ];
        
        for (const cand of candidates) {
            const labelX = x + cand[0];
            const labelY = y + cand[1];
            let rect;
            if (cand[2] === 'left') rect = { x1: labelX, y1: labelY - h, x2: labelX + w, y2: labelY };
            else if (cand[2] === 'right') rect = { x1: labelX - w, y1: labelY - h, x2: labelX, y2: labelY };
            else rect = { x1: labelX - w/2, y1: labelY - h, x2: labelX + w/2, y2: labelY };
            
            const paddedRect = { x1: rect.x1 - padding, y1: rect.y1 - padding, x2: rect.x2 + padding, y2: rect.y2 + padding };
            
            // 重複チェック
            let isOverlapping = false;
            for (const existing of drawnLabels) {
                if (!(paddedRect.x2 < existing.x1 || paddedRect.x1 > existing.x2 || paddedRect.y2 < existing.y1 || paddedRect.y1 > existing.y2)) {
                    isOverlapping = true;
                    break;
                }
            }
            
            if (!isOverlapping) {
                // テキストのみ描画（四角囲いなし）
                ctx.fillStyle = '#333';
                ctx.textAlign = cand[2];
                ctx.textBaseline = cand[3];
                ctx.fillText(text, labelX, labelY);
                
                // 接続線を描画（モーメント描画部分からラベルへ）
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(labelX, labelY);
                ctx.stroke();
                
                // 描画済みラベルとして登録
                drawnLabels.push(paddedRect);
                return;
            }
        }
        
        // フォールバック: 強制描画
        const labelX = x;
        const labelY = y - h - padding;
        const rect = { x1: labelX - w/2, y1: labelY - h, x2: labelX + w/2, y2: labelY };
        const paddedRect = { x1: rect.x1 - padding, y1: rect.y1 - padding, x2: rect.x2 + padding, y2: rect.y2 + padding };
        
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, labelX, labelY);
        
        // 接続線を描画
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(labelX, labelY);
        ctx.stroke();
        
        drawnLabels.push(paddedRect);
    };

    const drawMomentDiagram = (nodes, members, forces, memberLoads) => { 
        const drawingCtx = getDrawingContext(elements.momentCanvas); 
        if (!drawingCtx) return; 
        const { ctx, transform, scale } = drawingCtx; 
        const labelManager = LabelManager(); 
        
        // 部材番号も表示する
        drawStructure(ctx, transform, nodes, members, '#ccc', false, true); 
        
        // 曲げモーメント図専用のラベル管理システム
        const nodeLabels = new Map(); // 節点ごとのラベル情報を管理
        const drawnLabels = []; // 描画済みラベルの位置情報
        
        // 節点障害物の設定
        const nodeObstacles = nodes.map(n => { 
            const pos = transform(n.x, n.y); 
            return {x1: pos.x - 20, y1: pos.y - 20, x2: pos.x + 20, y2: pos.y + 20}; 
        }); 
        let maxMoment = 0; 
        forces.forEach((f, idx) => { 
            const member = members[idx]; 
            const load = memberLoads.find(l => l.memberIndex === idx); 
            const w = load ? load.w : 0; 
            const L = member.length; 
            let localMax = Math.max(Math.abs(f.M_i), Math.abs(f.M_j)); 
            if (w !== 0 && Math.abs(f.Q_i) > 1e-9) { 
                const x_q_zero = f.Q_i / w; 
                if (x_q_zero > 0 && x_q_zero < L) { 
                    const M_max_parabolic = -f.M_i * (1 - x_q_zero / L) + f.M_j * (x_q_zero / L) + w * L * x_q_zero / 2 - w * x_q_zero**2 / 2; 
                    localMax = Math.max(localMax, Math.abs(M_max_parabolic)); 
                } 
            } 
            maxMoment = Math.max(maxMoment, localMax); 
        }); 
        const maxOffsetPixels = 60; 
        let momentScale = 0; 
        if (scale > 0 && maxMoment > 1e-9) { 
            const maxOffsetModelUnits = maxOffsetPixels / scale; 
            momentScale = maxOffsetModelUnits / maxMoment; 
        } 
        members.forEach((m, idx) => { 
            const force = forces[idx]; 
            const load = memberLoads.find(l => l.memberIndex === idx); 
            const w = load ? load.w : 0; 
            const n_i = nodes[m.i], n_j = nodes[m.j]; 
            ctx.beginPath(); 
            const start = transform(n_i.x, n_i.y); 
            ctx.moveTo(start.x, start.y); 
            const numPoints = 20; 
            for (let i = 0; i <= numPoints; i++) { 
                const x_local = (i / numPoints) * m.length, M_linear = -force.M_i * (1 - x_local / m.length) + force.M_j * (x_local / m.length), M_parabolic = w * m.length * x_local / 2 - w * x_local**2 / 2; 
                const m_local = M_linear + M_parabolic, offset = -m_local * momentScale; 
                const globalX = n_i.x + x_local * m.c - offset * m.s, globalY = n_i.y + x_local * m.s + offset * m.c; 
                const pt = transform(globalX, globalY); 
                ctx.lineTo(pt.x, pt.y); 
            } 
            const end = transform(n_j.x, n_j.y); 
            ctx.lineTo(end.x, end.y); 
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'; 
            ctx.strokeStyle = 'red'; 
            ctx.lineWidth = 1; 
            ctx.closePath(); 
            ctx.fill(); 
            ctx.stroke(); 
            ctx.fillStyle = '#333'; ctx.font = "bold 24px Arial"; // 2倍のサイズに変更
            
            // 節点モーメント値を表示（専用のラベル管理システムを使用）
            if (Math.abs(force.M_i) > 1e-3) {
                // 節点iでのモーメント描画位置を計算（オフセット適用）
                const offset_i = -force.M_i * momentScale;
                const momentPos_i = transform(n_i.x - offset_i * m.s, n_i.y + offset_i * m.c);
                // 部材の方向情報とライン情報を渡す
                const memberDirection = { c: m.c, s: m.s };
                const memberLineStart = start; // 部材ラインの開始点
                const memberLineEnd = end; // 部材ラインの終了点
                drawNodeMomentLabel(ctx, m.i, `${force.M_i.toFixed(2)}`, momentPos_i.x, momentPos_i.y, nodeLabels, drawnLabels, idx, 'i', memberDirection, memberLineStart, memberLineEnd);
            }
            if (Math.abs(force.M_j) > 1e-3) {
                // 節点jでのモーメント描画位置を計算（オフセット適用）
                const offset_j = -force.M_j * momentScale;
                const momentPos_j = transform(n_j.x - offset_j * m.s, n_j.y + offset_j * m.c);
                // 部材の方向情報とライン情報を渡す
                const memberDirection = { c: m.c, s: m.s };
                const memberLineStart = start; // 部材ラインの開始点
                const memberLineEnd = end; // 部材ラインの終了点
                drawNodeMomentLabel(ctx, m.j, `${force.M_j.toFixed(2)}`, momentPos_j.x, momentPos_j.y, nodeLabels, drawnLabels, idx, 'j', memberDirection, memberLineStart, memberLineEnd);
            } 
            if (w !== 0 && Math.abs(force.Q_i) > 1e-9) { 
                const x_max = force.Q_i / w; 
                if (x_max > 1e-6 && x_max < m.length - 1e-6) { 
                    const M_linear = -force.M_i*(1-x_max/m.length)+force.M_j*(x_max/m.length), M_parabolic=w*m.length*x_max/2-w*x_max**2/2; 
                    const M_max=M_linear+M_parabolic, offset=-M_max*momentScale; 
                    const globalX=n_i.x+x_max*m.c-offset*m.s, globalY=n_i.y+x_max*m.s+offset*m.c; 
                    const pt=transform(globalX,globalY); 
                    ctx.font = "bold 24px Arial"; // 2倍のサイズに変更
                    drawIntermediateMomentLabel(ctx, `${M_max.toFixed(2)}`, pt.x, pt.y, drawnLabels, idx, 'max'); 
                } 
            } 
        }); 
    };
    const drawAxialForceDiagram = (nodes, members, forces) => { 
        const drawingCtx = getDrawingContext(elements.axialCanvas); 
        if (!drawingCtx) return; 
        const { ctx, transform, scale } = drawingCtx; 
        const labelManager = LabelManager(); 
        
        // 部材番号も表示する
        drawStructure(ctx, transform, nodes, members, '#ccc', false, true); 
        
        // より詳細な障害物管理
        const nodeObstacles = nodes.map(n => { 
            const pos = transform(n.x, n.y); 
            return {x1: pos.x - 16, y1: pos.y - 16, x2: pos.x + 16, y2: pos.y + 16}; 
        });
        const allObstacles = [...nodeObstacles]; 
        let maxAxial = 0; 
        forces.forEach(f => maxAxial = Math.max(maxAxial, Math.abs(f.N_i), Math.abs(f.N_j))); 
        const maxOffsetPixels = 40; 
        let axialScale = 0; 
        if (scale > 0 && maxAxial > 0) { 
            const maxOffsetModelUnits = maxOffsetPixels / scale; 
            axialScale = maxOffsetModelUnits / maxAxial; 
        } 
        members.forEach((m, idx) => { 
            const N = -forces[idx].N_i, offset = -N * axialScale; 
            const n_i = nodes[m.i], n_j = nodes[m.j]; 
            const p1_offset_x = -offset*m.s, p1_offset_y = offset*m.c; 
            const p1 = transform(n_i.x+p1_offset_x, n_i.y+p1_offset_y), p2=transform(n_j.x+p1_offset_x, n_j.y+p1_offset_y); 
            const p_start=transform(n_i.x,n_i.y), p_end=transform(n_j.x,n_j.y); 
            ctx.beginPath(); 
            ctx.moveTo(p_start.x, p_start.y); 
            ctx.lineTo(p1.x, p1.y); 
            ctx.lineTo(p2.x, p2.y); 
            ctx.lineTo(p_end.x, p_end.y); 
            ctx.closePath(); 
            ctx.fillStyle = N > 0 ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,255,0.2)'; 
            ctx.strokeStyle = N > 0 ? 'red' : 'blue'; 
            ctx.fill(); 
            ctx.stroke(); 
            ctx.fillStyle = '#333'; ctx.font = "bold 24px Arial"; // 2倍のサイズに変更
            if (Math.abs(N) > 1e-3) { 
                const mid_offset_x=p1_offset_x*0.5, mid_offset_y=p1_offset_y*0.5; 
                const mid_pos=transform((n_i.x+n_j.x)/2+mid_offset_x, (n_i.y+n_j.y)/2+mid_offset_y); 
                labelManager.draw(ctx,`${N.toFixed(2)}`,mid_pos.x,mid_pos.y,allObstacles);
                // 描画したラベルの位置を障害物として追加
                const labelMetrics = ctx.measureText(`${N.toFixed(2)}`);
                const labelWidth = labelMetrics.width;
                const labelHeight = 24;
                allObstacles.push({
                    x1: mid_pos.x - labelWidth/2 - 8, 
                    y1: mid_pos.y - labelHeight - 8, 
                    x2: mid_pos.x + labelWidth/2 + 8, 
                    y2: mid_pos.y + 8
                });
            } 
        }); 
    };
    const drawShearForceDiagram = (nodes, members, forces, memberLoads) => { 
        const drawingCtx = getDrawingContext(elements.shearCanvas); 
        if (!drawingCtx) return; 
        const { ctx, transform, scale } = drawingCtx; 
        const labelManager = LabelManager(); 
        
        // 部材番号も表示する
        drawStructure(ctx, transform, nodes, members, '#ccc', false, true); 
        
        // より詳細な障害物管理
        const nodeObstacles = nodes.map(n => { 
            const pos = transform(n.x, n.y); 
            return {x1: pos.x - 16, y1: pos.y - 16, x2: pos.x + 16, y2: pos.y + 16}; 
        });
        const allObstacles = [...nodeObstacles]; 
        let maxShear = 0; 
        forces.forEach(f => maxShear = Math.max(maxShear, Math.abs(f.Q_i), Math.abs(f.Q_j))); 
        const maxOffsetPixels = 50; 
        let shearScale = 0; 
        if (scale > 0 && maxShear > 0) { 
            const maxOffsetModelUnits = maxOffsetPixels / scale; 
            shearScale = maxOffsetModelUnits / maxShear; 
        } 
        members.forEach((m, idx) => { 
            const Q_i = forces[idx].Q_i, Q_j = -forces[idx].Q_j; 
            const load=memberLoads.find(l=>l.memberIndex===idx), w=load?load.w:0; 
            const n_i=nodes[m.i], n_j=nodes[m.j]; 
            const offset_i=-Q_i*shearScale; 
            const p1_offset_x=-offset_i*m.s, p1_offset_y=offset_i*m.c; 
            const p1=transform(n_i.x+p1_offset_x, n_i.y+p1_offset_y); 
            const p_start=transform(n_i.x,n_i.y), p_end=transform(n_j.x,n_j.y); 
            ctx.beginPath(); 
            ctx.moveTo(p_start.x, p_start.y); 
            ctx.lineTo(p1.x, p1.y); 
            let p2; 
            if (w === 0) { 
                const offset_j=-Q_j*shearScale; 
                const p2_offset_x=-offset_j*m.s, p2_offset_y=offset_j*m.c; 
                p2=transform(n_j.x+p2_offset_x, n_j.y+p2_offset_y); 
                ctx.lineTo(p2.x, p2.y); 
            } else { 
                const numPoints = 10; 
                for(let i=1; i<=numPoints; i++){ 
                    const x_local=(i/numPoints)*m.length, Q_local=Q_i-w*x_local, offset_local=-Q_local*shearScale; 
                    const globalX=n_i.x+x_local*m.c-offset_local*m.s, globalY=n_i.y+x_local*m.s+offset_local*m.c; 
                    p2=transform(globalX, globalY); 
                    ctx.lineTo(p2.x, p2.y); 
                } 
            } 
            ctx.lineTo(p_end.x, p_end.y); 
            ctx.closePath(); 
            ctx.fillStyle = Q_i > 0 ? 'rgba(0,128,0,0.2)' : 'rgba(255,165,0,0.2)'; 
            ctx.strokeStyle = Q_i > 0 ? 'green' : 'orange'; 
            ctx.fill(); 
            ctx.stroke(); 
            ctx.fillStyle = '#333'; ctx.font = "bold 24px Arial"; // 2倍のサイズに変更
            if(Math.abs(Q_i)>1e-3) {
                labelManager.draw(ctx,`${Q_i.toFixed(2)}`,p1.x,p1.y,allObstacles);
                // 描画したラベルの位置を障害物として追加
                const labelMetrics = ctx.measureText(`${Q_i.toFixed(2)}`);
                const labelWidth = labelMetrics.width;
                const labelHeight = 24;
                allObstacles.push({
                    x1: p1.x - labelWidth/2 - 8, 
                    y1: p1.y - labelHeight - 8, 
                    x2: p1.x + labelWidth/2 + 8, 
                    y2: p1.y + 8
                });
            }
            if(Math.abs(Q_j)>1e-3) {
                labelManager.draw(ctx,`${Q_j.toFixed(2)}`,p2.x,p2.y,allObstacles);
                // 描画したラベルの位置を障害物として追加
                const labelMetrics = ctx.measureText(`${Q_j.toFixed(2)}`);
                const labelWidth = labelMetrics.width;
                const labelHeight = 24;
                allObstacles.push({
                    x1: p2.x - labelWidth/2 - 8, 
                    y1: p2.y - labelHeight - 8, 
                    x2: p2.x + labelWidth/2 + 8, 
                    y2: p2.y + 8
                });
            } 
        }); 
    };

// --- 応力度の計算とカラーマッピング ---
    const calculateCombinedStress = (force, sectionData) => {
        const { N_i, M_i, N_j, M_j } = force;
        const { A, Iy } = sectionData;
        
        // 部材両端での応力度を計算
        const stress_i = {
            axial: N_i / A,
            bending_top: Math.abs(M_i) / Iy * (sectionData.H / 2),  // 上端での曲げ応力
            bending_bottom: Math.abs(M_i) / Iy * (sectionData.H / 2) // 下端での曲げ応力
        };
        
        const stress_j = {
            axial: N_j / A,
            bending_top: Math.abs(M_j) / Iy * (sectionData.H / 2),
            bending_bottom: Math.abs(M_j) / Iy * (sectionData.H / 2)
        };
        
        // 合成応力度（最大値）
        const combined_i = Math.max(
            Math.abs(stress_i.axial + stress_i.bending_top),
            Math.abs(stress_i.axial - stress_i.bending_bottom)
        );
        
        const combined_j = Math.max(
            Math.abs(stress_j.axial + stress_j.bending_top),
            Math.abs(stress_j.axial - stress_j.bending_bottom)
        );
        
        return Math.max(combined_i, combined_j);
    };

    const getStressColor = (stress, maxStress) => {
        if (maxStress === 0) return 'rgb(0, 0, 255)'; // 青
        
        const ratio = Math.min(stress / maxStress, 1.0);
        
        // 4段階の色相変化：青→緑→黄→赤
        if (ratio <= 0.33) {
            // 青から緑へ (0-33%)
            const localRatio = ratio / 0.33;
            const r = 0;
            const g = Math.round(255 * localRatio);
            const b = Math.round(255 * (1 - localRatio));
            return `rgb(${r}, ${g}, ${b})`;
        } else if (ratio <= 0.66) {
            // 緑から黄へ (33-66%)
            const localRatio = (ratio - 0.33) / 0.33;
            const r = Math.round(255 * localRatio);
            const g = 255;
            const b = 0;
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // 黄から赤へ (66-100%)
            const localRatio = (ratio - 0.66) / 0.34;
            const r = 255;
            const g = Math.round(255 * (1 - localRatio));
            const b = 0;
            return `rgb(${r}, ${g}, ${b})`;
        }
    };

    const drawStressContour = (nodes, members, forces, sections) => {
        console.log('=== DRAWING STRESS CONTOUR START ===');
        console.log('Received parameters:', {
            nodesCount: nodes ? nodes.length : 'null',
            membersCount: members ? members.length : 'null',
            forcesCount: forces ? forces.length : 'null',
            sectionsCount: sections ? sections.length : 'null'
        });
        
        if (!elements.stressCanvas) {
            console.error('❌ Stress canvas element not found!');
            return;
        }
        
        console.log('✅ Stress canvas element found:', elements.stressCanvas);
        
        const drawingCtx = getDrawingContext(elements.stressCanvas);
        if (!drawingCtx) {
            console.log('❌ Failed to get drawing context for stress canvas');
            return;
        }
        
        const { ctx, transform, scale } = drawingCtx;
        console.log('✅ Drawing context obtained successfully');
        
        // キャンバスをクリア
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        console.log('✅ Canvas cleared');
        
        // 最大応力度を計算
        let maxStress = 0;
        const memberStresses = [];
        
        members.forEach((member, idx) => {
            const force = forces[idx];
            const sectionData = sections[member.sectionIndex];
            
            if (sectionData) {
                const stress = calculateCombinedStress(force, sectionData);
                memberStresses[idx] = stress;
                maxStress = Math.max(maxStress, stress);
            } else {
                memberStresses[idx] = 0;
            }
        });
        
        console.log(`Maximum stress: ${maxStress.toFixed(2)} N/mm²`);
        console.log('Member stresses:', memberStresses.slice(0, 5)); // 最初の5つを表示
        
        // 各部材を応力度に応じて色分けして描画
        let drawnMembers = 0;
        members.forEach((member, idx) => {
            const stress = memberStresses[idx];
            const color = getStressColor(stress, maxStress);
            const n_i = nodes[member.i];
            const n_j = nodes[member.j];
            
            if (!n_i || !n_j) {
                console.log(`Missing nodes for member ${idx}:`, { i: member.i, j: member.j });
                return;
            }
            
            const start = transform(n_i.x, n_i.y);
            const end = transform(n_j.x, n_j.y);
            
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = 4; // 太い線で表示
            ctx.stroke();
            
            drawnMembers++;
            
            // 最初の3つの部材の情報をログ出力
            if (idx < 3) {
                console.log(`Member ${idx}: stress=${stress.toFixed(2)}, color=${color}, start=(${start.x.toFixed(1)},${start.y.toFixed(1)}), end=(${end.x.toFixed(1)},${end.y.toFixed(1)})`);
            }
        });
        
        console.log(`Drew ${drawnMembers} members`);
        
        // 節点を描画
        let drawnNodes = 0;
        nodes.forEach((node, idx) => {
            const pos = transform(node.x, node.y);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#333';
            ctx.fill();
            drawnNodes++;
        });
        
        console.log(`Drew ${drawnNodes} nodes`);
        
        // 凡例を描画
        drawStressLegend(ctx, maxStress);
        console.log('Legend drawn');
        console.log('=== DRAWING STRESS CONTOUR COMPLETED ===');
    };

    const drawStressLegend = (ctx, maxStress) => {
        const legendX = 20;
        const legendY = 20;
        const legendWidth = 200;
        const legendHeight = 20;
        
        // 背景
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(legendX - 5, legendY - 5, legendWidth + 60, legendHeight + 30);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(legendX - 5, legendY - 5, legendWidth + 60, legendHeight + 30);
        
        // グラデーション
        for (let i = 0; i <= legendWidth; i++) {
            const ratio = i / legendWidth;
            const color = getStressColor(ratio * maxStress, maxStress);
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(legendX + i, legendY);
            ctx.lineTo(legendX + i, legendY + legendHeight);
            ctx.stroke();
        }
        
        // ラベル
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.fillText('0', legendX - 2, legendY + legendHeight + 15);
        ctx.fillText(`${maxStress.toFixed(1)} N/mm²`, legendX + legendWidth - 30, legendY + legendHeight + 15);
        ctx.fillText('応力度コンター', legendX + 70, legendY - 10);
    };

    // 応力度関数をwindow変数として登録（クロススコープアクセス用）
    window.calculateCombinedStress = calculateCombinedStress;
    window.getStressColor = getStressColor;
    window.drawStressContour = drawStressContour;
    window.drawStressLegend = drawStressLegend;

// --- 弾性座屈解析機能 ---
    const calculateBucklingAnalysis = () => {
        if (!lastResults) return [];
        const { members, forces } = lastResults;
        const bucklingResults = [];

        members.forEach((member, idx) => {
            const { strengthProps, A, ix, iy, E, length, i_conn, j_conn } = member;
            const force = forces[idx];
            
            if (!A || !ix || !iy || isNaN(A) || isNaN(ix) || isNaN(iy)) {
                bucklingResults.push({
                    memberIndex: idx,
                    status: 'データ不足',
                    criticalLoad: 'N/A',
                    bucklingMode: 'N/A',
                    bucklingLength: 'N/A',
                    slendernessRatio: 'N/A',
                    safetyFactor: 'N/A'
                });
                return;
            }

            // 座屈長の計算（接合条件による係数）
            let bucklingLengthFactor = 1.0;
            if (i_conn === 'rigid' && j_conn === 'rigid') {
                bucklingLengthFactor = 0.5; // 両端固定
            } else if ((i_conn === 'rigid' && j_conn === 'pinned') || 
                      (i_conn === 'pinned' && j_conn === 'rigid')) {
                bucklingLengthFactor = 0.7; // 一端固定・一端ピン
            } else if (i_conn === 'pinned' && j_conn === 'pinned') {
                bucklingLengthFactor = 1.0; // 両端ピン
            }
            
            const bucklingLength = length * bucklingLengthFactor; // 座屈長 (m)
            
            // 弱軸まわりの座屈（通常はiy < ix）
            const i_min = Math.min(ix, iy); // 最小回転半径 (m)
            const slendernessRatio = bucklingLength / i_min; // 細長比
            
            // オイラー座屈荷重の計算
            const E_Pa = E * 1000; // N/mm² → Pa (実際はE*1000なのでE*1000*1000000)
            const I_min = i_min * i_min * A; // 最小断面二次モーメント (m⁴)
            const eulerLoad = (Math.PI * Math.PI * E_Pa * I_min) / (bucklingLength * bucklingLength); // N
            
            // 現在の軸力（負の値を圧縮として扱う）
            const N_i = force.N_i; // 解析結果そのまま
            const N_j = force.N_j; // 解析結果そのまま
            
            // より大きな軸力を選択
            const axialForceKN = (Math.abs(N_i) > Math.abs(N_j)) ? N_i : N_j; // kN単位での軸力
            const compressionForce = axialForceKN < 0 ? Math.abs(axialForceKN) * 1000 : 0; // 負の値を圧縮力として抽出、N単位に変換
            
            // 座屈モードの判定
            let bucklingMode = '';
            if (ix < iy) {
                bucklingMode = 'X軸まわり座屈（強軸）';
            } else if (iy < ix) {
                bucklingMode = 'Y軸まわり座屈（弱軸）';  
            } else {
                bucklingMode = '等方性断面';
            }
            
            // 安全率の計算
            let safetyFactor = 'N/A';
            let status = '安全';
            
            if (compressionForce > 0) { // 圧縮力がある場合（負の軸力を圧縮として判定）
                safetyFactor = eulerLoad / compressionForce;
                if (safetyFactor < 1.0) {
                    status = '座屈危険';
                } else if (safetyFactor < 2.0) {
                    status = '要注意';
                } else {
                    status = '安全';
                }
            } else if (axialForceKN > 0) {
                // 引張材の場合
                status = '引張材（座屈なし）';
                safetyFactor = '∞';
            } else {
                // 軸力が0の場合
                status = '座屈なし';
                safetyFactor = '∞';
            }

            bucklingResults.push({
                memberIndex: idx,
                status: status,
                criticalLoad: eulerLoad / 1000, // kNに変換
                bucklingLoad: eulerLoad / 1000, // kNに変換（エクセル出力用）
                bucklingMode: bucklingMode,
                bucklingLength: bucklingLength,
                slendernessRatio: slendernessRatio,
                safetyFactor: safetyFactor,
                axialForce: axialForceKN, // kN単位（負の値が圧縮、正の値が引張）
                bucklingLengthFactor: bucklingLengthFactor,
                connectionType: `i:${i_conn}, j:${j_conn}`,
                memberLength: length,
                momentOfInertia: I_min,
                radiusOfGyration: i_min,
                elasticModulus: E_Pa / 1000000 // GPa単位
            });
        });

        return bucklingResults;
    };

// --- Section Check Logic and Drawing ---
    const calculateSectionCheck = (loadTerm) => {
        if (!lastResults) return [];
        const { members, forces, memberLoads } = lastResults;
        const results = [];
        members.forEach((member, idx) => {
            const { strengthProps, A, Z, ix, iy, E, length } = member;
            if(!strengthProps || !A || !Z || isNaN(A) || isNaN(Z)) {
                results.push({ maxRatio: 'N/A', N: 0, M: 0, checkType: 'データ不足', status: 'error', ratios: Array(21).fill(0)});
                return;
            }
            let ft, fc, fb, fs;
            const termIndex = (loadTerm === 'long') ? 0 : 1;
            
            switch(strengthProps.type) {
                case 'F-value': case 'F-stainless': case 'F-aluminum':
                    const F = strengthProps.value;
                    if (!F || isNaN(F)) { results.push({ maxRatio: 'N/A', N: 0, M: 0, checkType: 'F値無効', status: 'error', ratios: Array(21).fill(0)}); return; }
                    const factor = (loadTerm === 'long') ? 1.5 : 1.0;
                    ft = F / factor; fb = F / factor; fs = F / (factor * Math.sqrt(3));
                    const lk = length, i_min = Math.min(ix, iy);
                    fc = ft;
                    if (i_min > 1e-9) {
                        const lambda = lk / i_min, E_n_mm2 = E * 1e-3;
                        const lambda_p = Math.PI * Math.sqrt(E_n_mm2 / (0.6 * F));
                        if (lambda <= lambda_p) { fc = (1 - 0.4 * (lambda / lambda_p)**2) * F / factor; } 
                        else { fc = (0.277 * F) / ((lambda / lambda_p)**2); }
                    }
                    break;
                case 'wood-type': {
                    let baseStresses;
                    if (strengthProps.preset === 'custom') {
                        baseStresses = strengthProps.baseStrengths;
                        if (!baseStresses || isNaN(baseStresses.ft) || isNaN(baseStresses.fc) || isNaN(baseStresses.fb) || isNaN(baseStresses.fs)) {
                            results.push({ maxRatio: 'N/A', N: 0, M: 0, checkType: '木材基準強度無効', status: 'error', ratios: Array(21).fill(0) });
                            return; // continue forEach
                        }
                    } else {
                        baseStresses = WOOD_BASE_STRENGTH_DATA[strengthProps.preset];
                        if (!baseStresses) {
                            results.push({ maxRatio: 'N/A', N: 0, M: 0, checkType: '木材データ無', status: 'error', ratios: Array(21).fill(0) });
                            return; // continue forEach
                        }
                    }
                    // プリセット・任意入力共通の計算ロジック
                    const factor = (loadTerm === 'long') ? (1.1 / 3) : (2 / 3);
                    ft = baseStresses.ft * factor;
                    fc = baseStresses.fc * factor;
                    fb = baseStresses.fb * factor;
                    fs = baseStresses.fs * factor;
                    break;
                }
                case 'Fc':
                default:
                    results.push({ maxRatio: 'N/A', N: 0, M: 0, checkType: '未対応材料', status: 'error', ratios: Array(21).fill(0)});
                    return;
            }

            const force = forces[idx], load = memberLoads.find(l => l.memberIndex === idx), w = load ? load.w : 0;
            const L = length, N = -force.N_i, Z_mm3 = Z * 1e9, A_mm2 = A * 1e6;
            let maxRatio = 0, M_at_max = 0;
            const ratios = [];
            for (let k = 0; k <= 20; k++) {
                const x = (k / 20) * L, M_linear = -force.M_i * (1 - x/L) + force.M_j * (x/L), M_parabolic = w * L * x / 2 - w * x**2 / 2;
                const M_x = M_linear + M_parabolic, sigma_a = (N * 1000) / A_mm2, sigma_b = (Math.abs(M_x) * 1e6) / Z_mm3;
                let ratio_x = 0;
                if(isNaN(sigma_a) || isNaN(sigma_b) || !ft || !fc || !fb) { ratio_x = Infinity; }
                else if (sigma_a >= 0) { // 引張
                    ratio_x = (sigma_a / ft) + (sigma_b / fb);
                } 
                else { // 圧縮
                    ratio_x = (Math.abs(sigma_a) / fc) + (sigma_b / fb);
                }
                ratios.push(ratio_x);
                if (ratio_x > maxRatio) { maxRatio = ratio_x; M_at_max = M_x; }
            }
            results.push({ maxRatio, N, M: M_at_max, checkType: '組合せ応力', status: maxRatio > 1.0 ? 'NG' : 'OK', ratios });
        });
        return results;
    };

    const displaySectionCheckResults = () => {
        if (!lastSectionCheckResults) { elements.sectionCheckResults.innerHTML = ''; return; }
        console.log("断面算定の計算結果:", lastSectionCheckResults);
        let html = `<thead><tr><th>部材 #</th><th>軸力 N (kN)</th><th>曲げ M (kN·m)</th><th>検定項目</th><th>検定比 (D/C)</th><th>判定</th><th>詳細</th></tr></thead><tbody>`;
        lastSectionCheckResults.forEach((res, i) => {
            const is_ng = res.status === 'NG';
            const maxRatioText = (typeof res.maxRatio === 'number' && isFinite(res.maxRatio)) ? res.maxRatio.toFixed(2) : res.maxRatio;
            const statusText = is_ng ? '❌ NG' : '✅ OK';
            html += `<tr ${is_ng ? 'style="background-color: #fdd;"' : ''}><td>${i + 1}</td><td>${res.N.toFixed(2)}</td><td>${res.M.toFixed(2)}</td><td>${res.checkType}</td><td style="font-weight: bold; ${is_ng ? 'color: red;' : ''}">${maxRatioText}</td><td>${statusText}</td><td><button onclick="showSectionCheckDetail(${i})">詳細</button></td></tr>`;
        });
        html += `</tbody>`;
        elements.sectionCheckResults.innerHTML = html;
    };

    const showSectionCheckDetail = (memberIndex) => {
        const res = lastSectionCheckResults[memberIndex];
        if (!res || !res.ratios) return;

        const { members, forces, memberLoads } = lastResults;
        const member = members[memberIndex];
        const force = forces[memberIndex];
        const load = memberLoads.find(l => l.memberIndex === memberIndex);
        const w = load ? load.w : 0;
        const L = member.length;
        const numPoints = res.ratios.length;

        // 材料特性の取得
        const { strengthProps, A, Z, ix, iy, E } = member;
        let materialInfo = '';
        let allowableStresses = { ft: 0, fc: 0, fb: 0, fs: 0 };
        
        // 部材データから直接材料名を取得（弾性係数選択で取得した材料名を使用）
        const materialName = member.material || `任意材料(E=${(E/1000).toLocaleString()}GPa)`;
        
        const selectedTerm = document.querySelector('input[name="load-term"]:checked').value;
        const termIndex = (selectedTerm === 'long') ? 0 : 1;
        
        switch(strengthProps.type) {
            case 'F-value':
            case 'F-stainless':
            case 'F-aluminum':
                const F = strengthProps.value;
                const factor = (selectedTerm === 'long') ? 1.5 : 1.0;
                materialInfo = `材料: ${materialName} (F=${F} N/mm²)`;
                allowableStresses.ft = F / factor;
                allowableStresses.fb = F / factor;
                allowableStresses.fs = F / (factor * Math.sqrt(3));
                
                // 座屈を考慮した圧縮許容応力度
                const lk = L, i_min = Math.min(ix, iy);
                allowableStresses.fc = allowableStresses.ft;
                if (i_min > 1e-9) {
                    const lambda = lk / i_min, E_n_mm2 = E * 1e-3;
                    const lambda_p = Math.PI * Math.sqrt(E_n_mm2 / (0.6 * F));
                    if (lambda <= lambda_p) {
                        allowableStresses.fc = (1 - 0.4 * (lambda / lambda_p)**2) * F / factor;
                    } else {
                        allowableStresses.fc = (0.277 * F) / ((lambda / lambda_p)**2);
                    }
                }
                break;
            case 'wood-type':
                const woodPreset = strengthProps.preset;
                if (woodPreset === 'custom') {
                    materialInfo = `材料: ${materialName} (任意入力)`;
                    const customShortStresses = strengthProps.stresses;
                    if (selectedTerm === 'long') {
                        allowableStresses.ft = customShortStresses.ft * 1.1 / 2;
                        allowableStresses.fc = customShortStresses.fc * 1.1 / 2;
                        allowableStresses.fb = customShortStresses.fb * 1.1 / 2;
                        allowableStresses.fs = customShortStresses.fs * 1.1 / 2;
                    } else {
                        allowableStresses.ft = customShortStresses.ft;
                        allowableStresses.fc = customShortStresses.fc;
                        allowableStresses.fb = customShortStresses.fb;
                        allowableStresses.fs = customShortStresses.fs;
                    }
                } else {
                    const baseStresses = WOOD_BASE_STRENGTH_DATA[woodPreset];
                    materialInfo = `材料: ${materialName} (${baseStresses.name})`;
                    const factor = (selectedTerm === 'long') ? (1.1 / 3) : (2 / 3);
                    allowableStresses.ft = baseStresses.ft * factor;
                    allowableStresses.fc = baseStresses.fc * factor;
                    allowableStresses.fb = baseStresses.fb * factor;
                    allowableStresses.fs = baseStresses.fs * factor;
                    materialInfo += `<br>基準強度: Fc=${baseStresses.fc}, Ft=${baseStresses.ft}, Fb=${baseStresses.fb}, Fs=${baseStresses.fs} (N/mm²)`;
                }
                break;
            default:
                materialInfo = `材料: ${materialName}`;
        }

        let detailHtml = `
            <div style="font-family: Arial, sans-serif;">
                <h3>部材 ${memberIndex + 1} の詳細応力度計算結果</h3>
                <div style="margin-bottom: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
                    <h4>部材情報</h4>
                    <p><strong>${materialInfo}</strong></p>
                    <p>弾性係数 E: ${(E/1000).toLocaleString()} N/mm²</p>
                    <p>部材長: ${L.toFixed(2)} m</p>
                    <p>断面積 A: ${(A * 1e4).toFixed(2)} cm²</p>
                    <p>断面係数 Z: ${(Z * 1e6).toFixed(2)} cm³</p>
                    <p>回転半径 ix: ${(ix * 1e2).toFixed(2)} cm, iy: ${(iy * 1e2).toFixed(2)} cm</p>
                    ${w !== 0 ? `<p>等分布荷重: ${w} kN/m</p>` : ''}
                </div>
                <div style="margin-bottom: 20px; padding: 10px; background-color: #e8f4fd; border-radius: 5px;">
                    <h4>許容応力度 (${selectedTerm === 'long' ? '長期' : '短期'})</h4>
                    <p>引張許容応力度 ft: ${allowableStresses.ft.toFixed(2)} N/mm²</p>
                    <p>圧縮許容応力度 fc: ${allowableStresses.fc.toFixed(2)} N/mm²</p>
                    <p>曲げ許容応力度 fb: ${allowableStresses.fb.toFixed(2)} N/mm²</p>
                    <p>せん断許容応力度 fs: ${allowableStresses.fs.toFixed(2)} N/mm²</p>
                </div>
                <div style="margin-bottom: 20px; padding: 10px; background-color: #fff2e8; border-radius: 5px;">
                    <h4>部材端力</h4>
                    <p>i端: N = ${(-force.N_i).toFixed(2)} kN, Q = ${force.Q_i.toFixed(2)} kN, M = ${force.M_i.toFixed(2)} kN·m</p>
                    <p>j端: N = ${force.N_j.toFixed(2)} kN, Q = ${(-force.Q_j).toFixed(2)} kN, M = ${force.M_j.toFixed(2)} kN·m</p>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background-color: #f0f0f0;">
                            <th style="border: 1px solid #ccc; padding: 8px;">位置 (m)</th>
                            <th style="border: 1px solid #ccc; padding: 8px;">軸力 N (kN)</th>
                            <th style="border: 1px solid #ccc; padding: 8px;">曲げ M (kN·m)</th>
                            <th style="border: 1px solid #ccc; padding: 8px;">軸応力度 σ_a (N/mm²)</th>
                            <th style="border: 1px solid #ccc; padding: 8px;">曲げ応力度 σ_b (N/mm²)</th>
                            <th style="border: 1px solid #ccc; padding: 8px;">検定比 (D/C)</th>
                            <th style="border: 1px solid #ccc; padding: 8px;">判定</th>
                        </tr>
                    </thead>
                    <tbody>`;

        for (let k = 0; k < numPoints; k++) {
            const x = (k / (numPoints - 1)) * L;
            const ratio = res.ratios[k];
            
            // 実際の曲げモーメント計算（等分布荷重を考慮）
            const M_linear = -force.M_i * (1 - x/L) + force.M_j * (x/L);
            const M_parabolic = w * L * x / 2 - w * x**2 / 2;
            const M_x = M_linear + M_parabolic;
            
            const N = -force.N_i; // 軸力は部材全体で一定
            const sigma_a = (N * 1000) / (A * 1e6);
            const sigma_b = (Math.abs(M_x) * 1e6) / (Z * 1e9);
            
            const status = ratio > 1.0 ? '❌ NG' : '✅ OK';
            const rowStyle = ratio > 1.0 ? 'background-color: #fdd;' : '';
            
            detailHtml += `
                <tr style="${rowStyle}">
                    <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${x.toFixed(2)}</td>
                    <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${N.toFixed(2)}</td>
                    <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${M_x.toFixed(2)}</td>
                    <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${sigma_a.toFixed(2)}</td>
                    <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${sigma_b.toFixed(2)}</td>
                    <td style="border: 1px solid #ccc; padding: 8px; text-align: center; font-weight: bold;">${ratio.toFixed(3)}</td>
                    <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${status}</td>
                </tr>`;
        }

        detailHtml += `
                    </tbody>
                </table>
                <div style="margin-top: 20px; padding: 10px; background-color: #f9f9f9; border-radius: 5px;">
                    <h4>検定式</h4>
                    <p>軸力が引張の場合: D/C = σ_a/ft + σ_b/fb</p>
                    <p>軸力が圧縮の場合: D/C = σ_a/fc + σ_b/fb</p>
                    <p>※ σ_a = N/A, σ_b = |M|/Z</p>
                </div>
            </div>`;

        // ポップアップで表示
        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.background = 'white';
        popup.style.border = '2px solid #ccc';
        popup.style.borderRadius = '10px';
        popup.style.padding = '20px';
        popup.style.zIndex = '1000';
        popup.style.maxHeight = '90vh';
        popup.style.maxWidth = '90vw';
        popup.style.overflowY = 'auto';
        popup.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '閉じる';
        closeButton.style.marginTop = '20px';
        closeButton.style.padding = '10px 20px';
        closeButton.style.backgroundColor = '#007bff';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '5px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => popup.remove();
        
        popup.innerHTML = detailHtml;
        popup.appendChild(closeButton);
        document.body.appendChild(popup);
    };

    // グローバルスコープに関数を公開
    window.showSectionCheckDetail = showSectionCheckDetail;

    // 座屈解析結果表示関数
    let lastBucklingResults = null;
    
    const displayBucklingResults = () => {
        if (!lastBucklingResults) { 
            document.getElementById('buckling-analysis-results').innerHTML = ''; 
            return; 
        }
        
        console.log("座屈解析の計算結果:", lastBucklingResults);
        let html = `<thead><tr>
            <th>部材 #</th>
            <th>軸力 (kN)</th>
            <th>座屈荷重 (kN)</th>
            <th>安全率</th>
            <th>座屈長 (m)</th>
            <th>細長比</th>
            <th>座屈モード</th>
            <th>接合条件</th>
            <th>判定</th>
            <th>詳細</th>
        </tr></thead><tbody>`;
        
        lastBucklingResults.forEach((result, i) => {
            const isDangerous = result.status === '座屈危険';
            const isWarning = result.status === '要注意';
            let statusColor = '';
            let statusIcon = '';
            
            if (isDangerous) {
                statusColor = 'color: red; font-weight: bold;';
                statusIcon = '❌';
            } else if (isWarning) {
                statusColor = 'color: orange; font-weight: bold;';
                statusIcon = '⚠️';
            } else if (result.status === '安全') {
                statusColor = 'color: green;';
                statusIcon = '✅';
            } else {
                statusColor = 'color: blue;';
                statusIcon = 'ℹ️';
            }
            
            const rowStyle = isDangerous ? 'style="background-color: #fdd;"' : 
                           isWarning ? 'style="background-color: #fff3cd;"' : '';
            
            html += `<tr ${rowStyle}>
                <td>${i + 1}</td>
                <td>${typeof result.axialForce === 'number' ? result.axialForce.toFixed(2) : result.axialForce}${typeof result.axialForce === 'number' && result.axialForce < 0 ? '(圧縮)' : typeof result.axialForce === 'number' && result.axialForce > 0 ? '(引張)' : ''}</td>
                <td>${typeof result.criticalLoad === 'number' ? result.criticalLoad.toFixed(0) : result.criticalLoad}</td>
                <td>${typeof result.safetyFactor === 'number' ? result.safetyFactor.toFixed(2) : result.safetyFactor}</td>
                <td>${typeof result.bucklingLength === 'number' ? result.bucklingLength.toFixed(2) : result.bucklingLength}</td>
                <td>${typeof result.slendernessRatio === 'number' ? result.slendernessRatio.toFixed(1) : result.slendernessRatio}</td>
                <td>${result.bucklingMode}</td>
                <td>${result.connectionType}</td>
                <td style="${statusColor}">${statusIcon} ${result.status}</td>
                <td><button onclick="showBucklingDetail(${i})">詳細</button></td>
            </tr>`;
        });
        html += `</tbody>`;
        document.getElementById('buckling-analysis-results').innerHTML = html;
    };

    const showBucklingDetail = (memberIndex) => {
        const result = lastBucklingResults[memberIndex];
        if (!result) return;

        const { members } = lastResults;
        const member = members[memberIndex];
        
        let detailHtml = `
            <div style="font-family: Arial, sans-serif;">
                <h3>部材 ${memberIndex + 1} の座屈解析詳細</h3>
                <div style="margin-bottom: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
                    <h4>部材情報</h4>
                    <p><strong>材料:</strong> ${member.material || '不明'}</p>
                    <p>弾性係数 E: ${(member.E/1000).toLocaleString()} N/mm²</p>
                    <p>部材長: ${member.length.toFixed(2)} m</p>
                    <p>断面積 A: ${(member.A * 1e4).toFixed(2)} cm²</p>
                    <p>回転半径 ix: ${(member.ix * 1e2).toFixed(2)} cm, iy: ${(member.iy * 1e2).toFixed(2)} cm</p>
                    <p>接合条件: ${result.connectionType}</p>
                </div>
                <div style="margin-bottom: 20px; padding: 10px; background-color: #e8f4fd; border-radius: 5px;">
                    <h4>座屈解析結果</h4>
                    <p>座屈長: ${typeof result.bucklingLength === 'number' ? result.bucklingLength.toFixed(2) : result.bucklingLength} m</p>
                    <p>座屈長係数: ${result.bucklingLengthFactor}</p>
                    <p>細長比 λ: ${typeof result.slendernessRatio === 'number' ? result.slendernessRatio.toFixed(1) : result.slendernessRatio}</p>
                    <p>オイラー座屈荷重: ${typeof result.criticalLoad === 'number' ? result.criticalLoad.toFixed(0) : result.criticalLoad} kN</p>
                    <p>現在の軸力: ${typeof result.axialForce === 'number' ? result.axialForce.toFixed(2) : result.axialForce} kN ${typeof result.axialForce === 'number' && result.axialForce < 0 ? '(圧縮)' : result.axialForce > 0 ? '(引張)' : ''}</p>
                    <p>座屈モード: ${result.bucklingMode}</p>
                </div>
                <div style="margin-bottom: 20px; padding: 10px; background-color: #fff2e8; border-radius: 5px;">
                    <h4>安全性評価</h4>
                    <p style="font-size: 1.1em;"><strong>安全率: ${typeof result.safetyFactor === 'number' ? result.safetyFactor.toFixed(2) : result.safetyFactor}</strong></p>
                    <p><strong>判定: ${result.status}</strong></p>
                    ${result.status === '座屈危険' ? '<p style="color: red;"><strong>⚠️ 警告: 座屈の危険があります。断面の見直しが必要です。</strong></p>' : ''}
                    ${result.status === '要注意' ? '<p style="color: orange;"><strong>⚠️ 注意: 安全率が低いため、断面の検討を推奨します。</strong></p>' : ''}
                </div>
                <div style="margin-bottom: 20px; padding: 10px; background-color: #f0f8ff; border-radius: 5px;">
                    <h4>座屈理論（参考）</h4>
                    <p>オイラー座屈荷重: P<sub>cr</sub> = π²EI/(lk)²</p>
                    <p>ここで、E: 弾性係数、I: 最小断面二次モーメント、lk: 座屈長</p>
                    <p><strong>軸力の符号規則:</strong> マイナス値が圧縮力、プラス値が引張力</p>
                    <p>座屈長は接合条件により決まります：</p>
                    <ul>
                        <li>両端ピン: lk = L (係数 1.0)</li>
                        <li>一端固定・一端ピン: lk = 0.7L (係数 0.7)</li>
                        <li>両端固定: lk = 0.5L (係数 0.5)</li>
                    </ul>
                </div>
            </div>
        `;

        const popup = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        popup.document.write(`
            <html>
                <head><title>座屈解析詳細 - 部材 ${memberIndex + 1}</title></head>
                <body style="margin: 20px;">${detailHtml}</body>
            </html>
        `);
        popup.document.close();
    };

    window.showBucklingDetail = showBucklingDetail;

    const drawRatioDiagram = () => {
        const drawingCtx = getDrawingContext(elements.ratioCanvas);
        if (!drawingCtx || !lastResults || !lastSectionCheckResults) return;
        const { ctx, transform, scale } = drawingCtx;
        const { nodes, members } = lastResults;
        drawStructure(ctx, transform, nodes, members, '#ccc', false);
        const labelManager = LabelManager();
        const nodeObstacles = nodes.map(n => { const pos = transform(n.x, n.y); return {x1: pos.x - 12, y1: pos.y - 12, x2: pos.x + 12, y2: pos.y + 12}; });
        const maxOffsetPixels = 60, ratioScale = maxOffsetPixels / (scale * 2.0);
        members.forEach((m, idx) => {
            const res = lastSectionCheckResults[idx];
            if(res.status === 'error') return;
            const n_i = nodes[m.i], n_j = nodes[m.j];
            if (res.maxRatio > 1.0) {
                 ctx.beginPath();
                 const start = transform(n_i.x, n_i.y), end = transform(n_j.x, n_j.y);
                 ctx.moveTo(start.x, start.y);
                 for (let k = 0; k <= 20; k++) {
                    const ratio = res.ratios[k], offset = -ratio * ratioScale, x_local = (k/20) * m.length;
                    const globalX = n_i.x + x_local * m.c - offset * m.s, globalY = n_i.y + x_local * m.s + offset * m.c;
                    ctx.lineTo(transform(globalX, globalY).x, transform(globalX, globalY).y);
                 }
                 ctx.lineTo(end.x, end.y);
                 ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; ctx.strokeStyle = 'red'; ctx.lineWidth = 1; ctx.closePath(); ctx.fill(); ctx.stroke();
            }
            ctx.beginPath();
            const start = transform(n_i.x, n_i.y);
            ctx.moveTo(start.x, start.y);
            for (let k = 0; k <= 20; k++) {
                const ratio = Math.min(res.ratios[k], 1.0), offset = -ratio * ratioScale, x_local = (k/20) * m.length;
                const globalX = n_i.x + x_local * m.c - offset * m.s, globalY = n_i.y + x_local * m.s + offset * m.c;
                ctx.lineTo(transform(globalX, globalY).x, transform(globalX, globalY).y);
            }
            const end = transform(n_j.x, n_j.y);
            ctx.lineTo(end.x, end.y);
            ctx.fillStyle = 'rgba(0,0,255,0.2)'; ctx.strokeStyle = 'blue'; ctx.lineWidth = 1; ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.beginPath();
            const offset_1 = -1.0 * ratioScale;
            const p1_offset_x = -offset_1 * m.s, p1_offset_y = offset_1 * m.c;
            const p1 = transform(n_i.x+p1_offset_x, n_i.y+p1_offset_y), p2 = transform(n_j.x+p1_offset_x, n_j.y+p1_offset_y);
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
            // 最大検定比の位置を計算
            let maxRatioPos = null;
            let maxRatioValue = 0;
            let maxRatioK = 0;
            
            // 各部材の最大検定比の位置を特定
            for (let k = 0; k <= 20; k++) {
                if (res.ratios[k] > maxRatioValue) {
                    maxRatioValue = res.ratios[k];
                    maxRatioK = k;
                }
            }
            
            // 最大検定比の位置の座標を計算
            const x_local_max = (maxRatioK/20) * m.length;
            const offset_max = -maxRatioValue * ratioScale;
            const globalX_max = n_i.x + x_local_max * m.c - offset_max * m.s;
            const globalY_max = n_i.y + x_local_max * m.s + offset_max * m.c;
            maxRatioPos = transform(globalX_max, globalY_max);
            
            // 赤丸印を描画（サイズを半分に）
            ctx.beginPath();
            ctx.arc(maxRatioPos.x, maxRatioPos.y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();
            ctx.strokeStyle = 'darkred';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // 数値を赤丸印の近傍に表示（フォントサイズを2倍に）
            const originalFont = ctx.font;
            ctx.font = 'bold 28px Arial'; // 元の14pxから28pxに変更
            ctx.fillStyle = res.maxRatio > 1.0 ? 'red' : '#333';
            
            const text = res.maxRatio.toFixed(2);
            const metrics = ctx.measureText(text);
            const w = metrics.width;
            const h = metrics.fontBoundingBoxAscent ?? 12;
            const padding = 6;
            
            // 線の終点を決定（赤丸印から適度な距離の位置）
            const lineLength = 35; // 線の長さを固定
            const lineEndX = maxRatioPos.x + lineLength;
            const lineEndY = maxRatioPos.y - lineLength * 0.4; // 少し上向き
            
            // 赤丸印から線の終点まで線を描画
            ctx.beginPath();
            ctx.moveTo(maxRatioPos.x, maxRatioPos.y);
            ctx.lineTo(lineEndX, lineEndY);
            ctx.strokeStyle = res.maxRatio > 1.0 ? 'red' : '#333';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // 線の終点に数値を直接描画（LabelManagerを使わずに直接描画）
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = res.maxRatio > 1.0 ? 'red' : '#333';
            
            // 背景を白で塗りつぶして読みやすくする
            const bgPadding = 4;
            const bgX = lineEndX - bgPadding;
            const bgY = lineEndY - h - bgPadding;
            const bgWidth = w + bgPadding * 2;
            const bgHeight = h + bgPadding * 2;
            
            ctx.fillStyle = 'white';
            ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
            ctx.strokeStyle = res.maxRatio > 1.0 ? 'red' : '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
            
            // 数値を描画
            ctx.fillStyle = res.maxRatio > 1.0 ? 'red' : '#333';
            ctx.fillText(text, lineEndX, lineEndY);
            
            // フォントを元に戻す
            ctx.font = originalFont;
        });

        // 部材番号を表示（重複回避版）
        ctx.fillStyle = '#0066cc';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 検定比表示用の部材番号位置計算（部材上に制限）
        const ratioLabelPositions = [];
        members.forEach((m, idx) => {
            const n_i = nodes[m.i], n_j = nodes[m.j];
            const start_pos = transform(n_i.x, n_i.y);
            const end_pos = transform(n_j.x, n_j.y);
            
            const text = `${idx + 1}`;
            const textWidth = ctx.measureText(text).width;
            const textHeight = 14;
            const padding = 4;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = textHeight + padding * 2;
            
            // 部材上の候補位置を生成
            const candidates = [];
            const numCandidates = 7;
            
            for (let i = 0; i < numCandidates; i++) {
                const t = i / (numCandidates - 1);
                const x = start_pos.x + (end_pos.x - start_pos.x) * t;
                const y = start_pos.y + (end_pos.y - start_pos.y) * t;
                
                candidates.push({ x, y, t });
            }
            
            // 最適な位置を選択
            let bestPosition = candidates[Math.floor(numCandidates / 2)]; // デフォルトは中点
            let minOverlap = Infinity;
            
            for (const candidate of candidates) {
                const candidateBox = {
                    x: candidate.x - boxWidth / 2,
                    y: candidate.y - boxHeight / 2,
                    width: boxWidth,
                    height: boxHeight
                };
                
                let overlapCount = 0;
                let totalOverlapArea = 0;
                
                for (const existing of ratioLabelPositions) {
                    if (boxesOverlap(candidateBox, existing)) {
                        overlapCount++;
                        totalOverlapArea += calculateOverlapArea(candidateBox, existing);
                    }
                }
                
                // 中心寄りを優遇
                const centerBias = Math.abs(candidate.t - 0.5) * 200;
                const overlapScore = overlapCount * 1000 + totalOverlapArea + centerBias;
                
                if (overlapScore < minOverlap) {
                    minOverlap = overlapScore;
                    bestPosition = candidate;
                }
            }
            
            ratioLabelPositions.push({
                x: bestPosition.x - boxWidth / 2,
                y: bestPosition.y - boxHeight / 2,
                width: boxWidth,
                height: boxHeight,
                memberIndex: idx,
                textX: bestPosition.x,
                textY: bestPosition.y,
                text: text
            });
        });
        
        // 部材番号を描画
        ratioLabelPositions.forEach(labelInfo => {
            // 部材番号の背景を描画（視認性向上のため）
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(labelInfo.x, labelInfo.y, labelInfo.width, labelInfo.height);

            // 部材番号を描画
            ctx.fillStyle = '#0066cc';
            ctx.fillText(labelInfo.text, labelInfo.textX, labelInfo.textY);
        });

        // 選択要素のハイライト表示
        console.log('drawOnCanvas内でハイライト関数を呼び出し中...');
        if (window.highlightSelectedElements) {
            window.highlightSelectedElements();
        } else {
            console.error('❌ window.highlightSelectedElements が見つかりません');
        }
    };
    const zoom = (factor, centerX, centerY) => {
        if (!panZoomState.isInitialized) return;
        const { scale, offsetX, offsetY } = panZoomState;
        const modelX = (centerX - offsetX) / scale;
        const modelY = (offsetY - centerY) / scale;
        const newScale = scale * factor;
        panZoomState.scale = newScale;
        panZoomState.offsetX = centerX - modelX * newScale;
        panZoomState.offsetY = centerY + modelY * newScale;
        drawOnCanvas();
    };

    // 結果図用のズーム関数
    const zoomResultCanvas = (canvasId, factor, centerX, centerY) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const state = resultPanZoomStates[canvasId.replace('-canvas', '')];
        if (!state.isInitialized) return;
        
        const { scale, offsetX, offsetY } = state;
        const modelX = (centerX - offsetX) / scale;
        const modelY = (offsetY - centerY) / scale;
        const newScale = scale * factor;
        
        state.scale = newScale;
        state.offsetX = centerX - modelX * newScale;
        state.offsetY = centerY + modelY * newScale;
        
        // 該当する結果図を再描画
        if (canvasId === 'displacement-canvas') {
            if (lastResults && lastResults.D && lastResults.D.length > 0) {
                console.log('変位図: ズーム操作で再描画', { hasLastResults: !!lastResults, hasD: !!lastResults.D, d_length: lastResults.D.length });
                drawDisplacementDiagram(lastResults.nodes, lastResults.members, lastResults.D, lastResults.memberLoads);
            } else {
                console.log('変位図: データ不足で再描画スキップ', { hasLastResults: !!lastResults, hasD: lastResults ? !!lastResults.D : false });
            }
        } else if (canvasId === 'moment-canvas' && lastResults && lastResults.forces) {
            drawMomentDiagram(lastResults.nodes, lastResults.members, lastResults.forces, lastResults.memberLoads);
        } else if (canvasId === 'axial-canvas' && lastResults && lastResults.forces) {
            drawAxialForceDiagram(lastResults.nodes, lastResults.members, lastResults.forces);
        } else if (canvasId === 'shear-canvas' && lastResults && lastResults.forces) {
            drawShearForceDiagram(lastResults.nodes, lastResults.members, lastResults.forces, lastResults.memberLoads);
        } else if (canvasId === 'ratio-canvas') {
            drawRatioDiagram();
        }
    };

    // 結果図用のパン関数
    const panResultCanvas = (canvasId, deltaX, deltaY) => {
        const state = resultPanZoomStates[canvasId.replace('-canvas', '')];
        if (!state.isInitialized) return;
        
        state.offsetX += deltaX;
        state.offsetY += deltaY;
        
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        // 該当する結果図を再描画
        if (canvasId === 'displacement-canvas') {
            if (lastResults && lastResults.D && lastResults.D.length > 0) {
                console.log('変位図: パン操作で再描画', { hasLastResults: !!lastResults, hasD: !!lastResults.D, d_length: lastResults.D.length });
                drawDisplacementDiagram(lastResults.nodes, lastResults.members, lastResults.D, lastResults.memberLoads);
            } else {
                console.log('変位図: データ不足で再描画スキップ', { hasLastResults: !!lastResults, hasD: lastResults ? !!lastResults.D : false });
            }
        } else if (canvasId === 'moment-canvas' && lastResults && lastResults.forces) {
            drawMomentDiagram(lastResults.nodes, lastResults.members, lastResults.forces, lastResults.memberLoads);
        } else if (canvasId === 'axial-canvas' && lastResults && lastResults.forces) {
            drawAxialForceDiagram(lastResults.nodes, lastResults.members, lastResults.forces);
        } else if (canvasId === 'shear-canvas' && lastResults && lastResults.forces) {
            drawShearForceDiagram(lastResults.nodes, lastResults.members, lastResults.forces, lastResults.memberLoads);
        } else if (canvasId === 'ratio-canvas') {
            drawRatioDiagram();
        }
    };

    // 結果図のキャンバスにマウス操作機能を追加
    const addResultCanvasMouseControls = (canvasId) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`キャンバスが見つかりません: ${canvasId}`);
            return;
        }

        console.log(`マウス操作機能を追加: ${canvasId}`, { canvas: canvas });

        let isDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;

        // マウスダウンイベント
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // 左クリック
                console.log(`マウスダウン: ${canvasId}`, { 
                    hasLastResults: !!lastResults, 
                    hasD: lastResults ? !!lastResults.D : false,
                    d_length: lastResults && lastResults.D ? lastResults.D.length : 0
                });
                isDragging = true;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                canvas.style.cursor = 'grabbing';
            }
        });

        // マウス移動イベント
        canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - lastMouseX;
                const deltaY = e.clientY - lastMouseY;
                panResultCanvas(canvasId, deltaX, deltaY);
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            }
        });

        // マウスアップイベント
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                isDragging = false;
                canvas.style.cursor = 'grab';
            }
        });

        // マウスリーブイベント
        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
            canvas.style.cursor = 'grab';
        });

        // ホイールイベント（ズーム）
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const centerX = e.clientX - rect.left;
            const centerY = e.clientY - rect.top;
            const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            zoomResultCanvas(canvasId, zoomFactor, centerX, centerY);
        }, { passive: false });

        // カーソルスタイルを設定
        canvas.style.cursor = 'grab';
    };

    const animateDisplacement = (nodes, members, D_global, memberLoads) => {
        const drawingCtx = getDrawingContext(elements.modelCanvas);
        if (!drawingCtx) return;
        const { ctx, transform, scale } = drawingCtx;

        let dispScale = parseFloat(elements.animScaleInput.value);

        if (isNaN(dispScale)) {
            dispScale = lastDisplacementScale || 0;
            elements.animScaleInput.placeholder = `自動(${dispScale.toFixed(2)})`;
        }
        
        const duration = 2000;
        let startTime = null;

        const animationFrame = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsedTime = timestamp - startTime;
            let progress = Math.min(elapsedTime / duration, 1);
            progress = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            const currentDrawingCtx = getDrawingContext(elements.modelCanvas);
            if (!currentDrawingCtx) return;
            
            const { ctx, transform } = currentDrawingCtx;
            if (elements.gridToggle.checked) { drawGrid(ctx, transform, elements.modelCanvas.clientWidth, elements.modelCanvas.clientHeight); }
            drawStructure(ctx, transform, nodes, members, '#ccc', true, true);
            drawBoundaryConditions(ctx, transform, nodes);
            
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            members.forEach((m, idx) => {
                const L = m.length, c = m.c, s = m.s, ni = nodes[m.i];
                const d_global_member_vec = [ ...D_global.slice(m.i * 3, m.i * 3 + 3), ...D_global.slice(m.j * 3, m.j * 3 + 3) ];
                const d_local_vec = mat.multiply(m.T, d_global_member_vec);
                const [ui, vi, thi, uj, vj, thj] = d_local_vec.map(v => v[0]);
                const load = memberLoads.find(l => l.memberIndex === idx), w = load ? load.w : 0, E = m.E, I = m.I;
                ctx.beginPath();
                for (let k = 0; k <= 20; k++) {
                    const x = (k / 20) * L, xi = x / L;
                    const N1 = 1 - 3*xi**2 + 2*xi**3, N2 = x * (1 - xi)**2, N3 = 3*xi**2 - 2*xi**3, N4 = (x**2 / L) * (xi - 1);
                    const u_local = (1 - xi) * ui + xi * uj, v_homogeneous = N1*vi + N2*thi + N3*vj + N4*thj;
                    let v_particular = 0;
                    if (w !== 0 && E > 0 && I > 0) {
                        if (m.i_conn === 'rigid' && m.j_conn === 'rigid') v_particular = (w * x**2 * (L - x)**2) / (24 * E * I);
                        else if (m.i_conn === 'pinned' && m.j_conn === 'pinned') v_particular = (w * x * (L**3 - 2 * L * x**2 + x**3)) / (24 * E * I);
                        else if (m.i_conn === 'rigid' && m.j_conn === 'pinned') v_particular = (w * x**2 * (3 * L**2 - 5 * L * x + 2 * x**2)) / (48 * E * I);
                        else if (m.i_conn === 'pinned' && m.j_conn === 'rigid') v_particular = (w * x * (L**3 - 3 * L * x**2 + 2 * x**3)) / (48 * E * I);
                    }
                    const v_local = v_homogeneous - v_particular;
                    const p_deformed = { x: ni.x + (x*c - (v_local*dispScale*progress)*s) + (u_local*dispScale*progress*c), y: ni.y + (x*s + (v_local*dispScale*progress)*c) + (u_local*dispScale*progress*s) };
                    const p = transform(p_deformed.x, p_deformed.y);
                    if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            });

            if (progress < 1) { requestAnimationFrame(animationFrame); } 
            else { drawOnCanvas(); }
        };
        requestAnimationFrame(animationFrame);
    };

    // --- Canvas Interaction ---
    const getNodeAt = (canvasX, canvasY) => { 
        console.log('getNodeAt called:', { canvasX, canvasY, hasLastDrawingContext: !!lastDrawingContext });
        if (!lastDrawingContext) return -1; 
        try { 
            const { nodes } = parseInputs(); 
            console.log('getNodeAt nodes:', { nodeCount: nodes.length });
            const tolerance = 10; 
            for (let i = 0; i < nodes.length; i++) { 
                const nodePos = lastDrawingContext.transform(nodes[i].x, nodes[i].y); 
                const dist = Math.sqrt((canvasX - nodePos.x)**2 + (canvasY - nodePos.y)**2); 
                console.log(`getNodeAt node ${i}:`, { nodePos, dist, tolerance, hit: dist < tolerance });
                if (dist < tolerance) return i; 
            } 
        } catch(e) { 
            console.error('getNodeAt error:', e);
        } 
        return -1; 
    };
    const getMemberAt = (canvasX, canvasY) => { 
        console.log('getMemberAt called:', { canvasX, canvasY, hasLastDrawingContext: !!lastDrawingContext });
        if (!lastDrawingContext) return -1; 
        try { 
            const { nodes, members } = parseInputs(); 
            console.log('getMemberAt data:', { nodeCount: nodes.length, memberCount: members.length });
            const tolerance = 5; 
            for (let i = 0; i < members.length; i++) { 
                const member = members[i]; 
                const p1 = lastDrawingContext.transform(nodes[member.i].x, nodes[member.i].y);
                const p2 = lastDrawingContext.transform(nodes[member.j].x, nodes[member.j].y); 
                const dx = p2.x - p1.x, dy = p2.y - p1.y, lenSq = dx*dx + dy*dy; 
                if (lenSq === 0) continue; 
                let t = ((canvasX - p1.x) * dx + (canvasY - p1.y) * dy) / lenSq; 
                t = Math.max(0, Math.min(1, t)); 
                const closestX = p1.x + t * dx, closestY = p1.y + t * dy; 
                const dist = Math.sqrt((canvasX - closestX)**2 + (canvasY - closestY)**2); 
                console.log(`getMemberAt member ${i}:`, { p1, p2, dist, tolerance, hit: dist < tolerance });
                if (dist < tolerance) return i; 
            } 
        } catch (e) { 
            console.error('getMemberAt error:', e);
        } 
        return -1; 
    };
    const setCanvasMode = (newMode) => { canvasMode = newMode; firstMemberNode = null; const kebabCaseMode = newMode.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`); document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(`mode-${kebabCaseMode}`).classList.add('active'); elements.modelCanvas.style.cursor = { select: 'default', addNode: 'crosshair', addMember: 'copy' }[newMode]; };

    elements.zoomInBtn.onclick = () => {
        const rect = elements.modelCanvas.getBoundingClientRect();
        zoom(1.2, rect.width / 2, rect.height / 2);
    };
    elements.zoomOutBtn.onclick = () => {
        const rect = elements.modelCanvas.getBoundingClientRect();
        zoom(1 / 1.2, rect.width / 2, rect.height / 2);
    };
    
    // 自重考慮の表示を更新する関数
    const updateSelfWeightDisplay = () => {
        const considerSelfWeightCheckbox = document.getElementById('consider-self-weight-checkbox');
        if (!considerSelfWeightCheckbox) return;
        
        const isChecked = considerSelfWeightCheckbox.checked;
        
        // 密度列のヘッダーの表示/非表示を切り替え（HTMLに既に存在するヘッダー）
        const densityColumns = document.querySelectorAll('.density-column');
        densityColumns.forEach(column => {
            column.style.display = isChecked ? '' : 'none';
        });
        
        // 既存の部材行に密度列を追加/削除
        const memberRows = elements.membersTable.rows;
        for (let i = 0; i < memberRows.length; i++) {
            const row = memberRows[i];
            
            if (isChecked) {
                // 密度列が存在しない場合は追加（重複チェック強化）
                let densityCell = row.querySelector('.density-cell');
                const existingDensityCells = row.querySelectorAll('.density-cell');
                
                // 複数の密度セルがある場合は余分なものを削除
                if (existingDensityCells.length > 1) {
                    for (let j = 1; j < existingDensityCells.length; j++) {
                        existingDensityCells[j].remove();
                    }
                    densityCell = existingDensityCells[0];
                }
                
                if (!densityCell) {
                    // 挿入位置を動的に決定（断面係数Zセルの後、位置8）
                    let insertPosition = 8;
                    // より安全に、Z値セルを探してその次に挿入
                    for (let k = 0; k < row.cells.length; k++) {
                        const cell = row.cells[k];
                        if (cell.querySelector('input[title*="断面係数"]')) {
                            insertPosition = k + 1;
                            break;
                        }
                    }
                    
                    densityCell = row.insertCell(insertPosition);
                    densityCell.className = 'density-cell';
                    
                    // 現在のE値から密度を推定して設定
                    const eCell = row.cells[3];
                    const eSelect = eCell.querySelector('select');
                    const eValue = eSelect ? eSelect.value : '205000';
                    const density = MATERIAL_DENSITY_DATA[eValue] || MATERIAL_DENSITY_DATA['custom'];
                    
                    densityCell.innerHTML = createDensityInputHTML(`member-density-${i}`, density);
                }
            } else {
                // 密度列を削除
                const densityCell = row.querySelector('.density-cell');
                if (densityCell) {
                    densityCell.remove();
                }
            }
        }
        
        // 部材プロパティポップアップが開いている場合は位置を再調整
        if (elements.memberPropsPopup && elements.memberPropsPopup.style.display === 'block') {
            setTimeout(() => adjustPopupPosition(elements.memberPropsPopup), 0);
        }
        
        drawOnCanvas();
    };
    
    // Make updateSelfWeightDisplay globally accessible
    window.updateSelfWeightDisplay = updateSelfWeightDisplay;
    
    // 自重考慮チェックボックスのイベントリスナー
    elements.considerSelfWeightCheckbox.addEventListener('change', function() {
        updateSelfWeightDisplay();
    });
    
    // ウィンドウサイズ変更時のポップアップ位置調整
    window.addEventListener('resize', () => {
        if (elements.memberPropsPopup && elements.memberPropsPopup.style.display === 'block') {
            setTimeout(() => adjustPopupPosition(elements.memberPropsPopup), 100);
        }
        if (elements.addMemberPopup && elements.addMemberPopup.style.display === 'block') {
            setTimeout(() => adjustPopupPosition(elements.addMemberPopup), 100);
        }
        if (elements.nodeLoadPopup && elements.nodeLoadPopup.style.display === 'block') {
            setTimeout(() => adjustPopupPosition(elements.nodeLoadPopup), 100);
        }
    });
    
    elements.modelCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = elements.modelCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        zoom(zoomFactor, mouseX, mouseY);
    }, { passive: false });
    
    // 断面選択ツールを開く関数
    const openSteelSelector = (memberIndex, options = {}) => {
        const url = `steel_selector.html?targetMember=${memberIndex}`;
        const popup = window.open(url, 'SteelSelector', 'width=1200,height=800,scrollbars=yes,resizable=yes');

        if (!popup) {
            alert('ポップアップブロッカーにより断面選択ツールを開けませんでした。ポップアップを許可してください。');
            return;
        }

        // 必要に応じてオプション情報をlocalStorageに保存
        if (options && Object.keys(options).length > 0) {
            sessionStorage.setItem('steelSelectorOptions', JSON.stringify(options));
        }
    };

    elements.membersTable.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('select-props-btn')) {
        const row = e.target.closest('tr');
        if (row) {
            const memberIndex = Array.from(row.parentNode.children).indexOf(row);

            // 材料情報を取得して渡す
            const eSelect = row.cells[3].querySelector('select');
            const selectedOption = eSelect.options[eSelect.selectedIndex];
            let materialType = 'steel'; // デフォルト
            if (selectedOption.textContent.includes('木材')) materialType = 'wood';
            else if (selectedOption.textContent.includes('コンクリート')) materialType = 'concrete';
            else if (selectedOption.textContent.includes('ステンレス')) materialType = 'stainless';
            else if (selectedOption.textContent.includes('アルミニウム')) materialType = 'aluminum';

            const strengthInputContainer = row.cells[4].firstElementChild;
            let strengthValue = '';
            if (strengthInputContainer.querySelector('input')) strengthValue = strengthInputContainer.querySelector('input').value;
            if (strengthInputContainer.querySelector('select')) strengthValue = strengthInputContainer.querySelector('select').value;

            openSteelSelector(memberIndex, {
                material: materialType,
                E: eSelect.value === 'custom' ? row.cells[3].querySelector('input[type="number"]').value : eSelect.value,
                strengthValue: strengthValue
            });
        }
    }
});

    elements.modeSelectBtn.onclick = () => setCanvasMode('select');
    elements.modeAddNodeBtn.onclick = () => setCanvasMode('addNode');
    elements.modeAddMemberBtn.onclick = () => {
        console.log('🔍 部材追加ボタンがクリックされました');
        
        // ポップアップ内のE入力欄を生成
        const eContainer = document.getElementById('add-popup-e-container');
        if (!eContainer) {
            console.error('❌ add-popup-e-container要素が見つかりません');
            return;
        }
        eContainer.innerHTML = createEInputHTML('add-popup-e', newMemberDefaults.E);

        // ポップアップ内のF入力欄を生成
        const fContainer = document.getElementById('add-popup-f-container');
        fContainer.innerHTML = '';
        fContainer.appendChild(createStrengthInputHTML('steel', 'add-popup-f', newMemberDefaults.F));

        // ポップアップ内のE選択に応じてF入力欄を更新するイベントリスナーを追加
        const addPopupESelect = document.getElementById('add-popup-e-select');
        if (addPopupESelect) {
            addPopupESelect.addEventListener('change', () => {
                const selectedOpt = addPopupESelect.options[addPopupESelect.selectedIndex];
                let newMaterialType = 'steel';
                if (selectedOpt.textContent.includes('木材')) newMaterialType = 'wood';
                else if (selectedOpt.textContent.includes('ステンレス')) newMaterialType = 'stainless';
                else if (selectedOpt.textContent.includes('アルミニウム')) newMaterialType = 'aluminum';
                
                fContainer.innerHTML = '';
                fContainer.appendChild(createStrengthInputHTML(newMaterialType, 'add-popup-f'));
                
                // 密度も更新（自重考慮がオンの場合）
                const hasDensityColumn = document.querySelector('.density-column') && document.querySelector('.density-column').style.display !== 'none';
                if (hasDensityColumn) {
                    const addPopupEInput = document.getElementById('add-popup-e-input');
                    const eValue = addPopupESelect.value === 'custom' ? addPopupEInput.value : addPopupESelect.value;
                    const newDensity = MATERIAL_DENSITY_DATA[eValue] || MATERIAL_DENSITY_DATA['custom'];
                    
                    // 新規部材追加ポップアップの密度欄を更新
                    const densityContainer = document.getElementById('add-popup-density-container');
                    if (densityContainer) {
                        densityContainer.innerHTML = createDensityInputHTML('add-popup-density', newDensity);
                        
                        // 密度欄更新後にポップアップ位置を再調整
                        setTimeout(() => adjustPopupPosition(elements.addMemberPopup), 0);
                    }
                }
            });
        }
        
        // その他のプロパティを設定
        document.getElementById('add-popup-i').value = newMemberDefaults.I;
        document.getElementById('add-popup-a').value = newMemberDefaults.A;
        document.getElementById('add-popup-z').value = newMemberDefaults.Z;
        document.getElementById('add-popup-i-conn').value = newMemberDefaults.i_conn;
        document.getElementById('add-popup-j-conn').value = newMemberDefaults.j_conn;
        
        // ポップアップを画面中央に表示
        const popup = elements.addMemberPopup;
        if (!popup) {
            console.error('❌ addMemberPopup要素が見つかりません');
            return;
        }
        console.log('✅ ポップアップを表示します');
        popup.style.display = 'block';
        
        // ポップアップを一度表示してサイズを取得
        popup.style.display = 'block';
        popup.style.visibility = 'hidden'; // 一時的に非表示にしてサイズ取得
        
        // ポップアップのサイズを取得
        const popupRect = popup.getBoundingClientRect();
        const popupWidth = popupRect.width || 380;  // デフォルト幅
        const popupHeight = popupRect.height || 400; // デフォルト高さ
        
        console.log('🔍 ポップアップサイズ:', { width: popupWidth, height: popupHeight });
        
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const minMargin = 20;
        
        // 画面中央に配置
        const left = Math.max(minMargin, (windowWidth - popupWidth) / 2);
        const top = Math.max(minMargin, (windowHeight - popupHeight) / 2);
        
        console.log('🔍 ポップアップ位置:', { left, top, windowWidth, windowHeight });
        
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
        popup.style.position = 'fixed';
        popup.style.visibility = 'visible'; // 表示に戻す
        popup.style.display = 'block';
        
        // ポップアップが実際に表示されているかチェック
        setTimeout(() => {
            const finalRect = popup.getBoundingClientRect();
            console.log('🔍 ポップアップ最終状態:', {
                display: popup.style.display,
                visibility: popup.style.visibility,
                position: popup.style.position,
                left: popup.style.left,
                top: popup.style.top,
                zIndex: popup.style.zIndex,
                rect: finalRect
            });
            
            if (finalRect.width === 0 || finalRect.height === 0) {
                console.error('❌ ポップアップのサイズが0です');
            }
            
            if (finalRect.left < 0 || finalRect.top < 0 || 
                finalRect.right > window.innerWidth || finalRect.bottom > window.innerHeight) {
                console.warn('⚠️ ポップアップが画面外に表示されています');
            }
        }, 100);
    };
    // 部材追加設定の断面選択ボタン
    document.getElementById('add-popup-select-section').onclick = () => {
        const url = `steel_selector.html?targetMember=addDefaults`;
        console.log('🚀 断面選択ウィンドウを開きます:', url);
        const popup = window.open(url, 'SteelSelector', 'width=1200,height=800,scrollbars=yes,resizable=yes');

        if (!popup) {
            alert('ポップアップブロッカーにより断面選択ツールを開けませんでした。ポップアップを許可してください。');
            console.error('❌ ポップアップブロック: 断面選択ウィンドウが開けませんでした');
        } else {
            console.log('✅ 断面選択ウィンドウが開きました。storageイベントでデータ受信を待機します。');
        }
    };

    document.getElementById('add-popup-ok').onclick = () => {
        const e_select = document.getElementById('add-popup-e-select'), e_input = document.getElementById('add-popup-e-input');
        if (e_select && e_input) {
            newMemberDefaults.E = e_select.value === 'custom' ? e_input.value : e_select.value;
        }

        // F値の取得 - 強度コンテナから現在のUIに応じて値を取得
        const fContainer = document.getElementById('add-popup-f-container');
        if (fContainer && fContainer.firstElementChild) {
            const strengthContainer = fContainer.firstElementChild;
            const strengthType = strengthContainer.dataset?.strengthType;

            if (strengthType === 'wood-type') {
                // 木材の場合 - プリセット値または カスタム値を取得
                const presetSelect = strengthContainer.querySelector('select');
                if (presetSelect) {
                    newMemberDefaults.F = presetSelect.value;
                    // カスタム値の場合は基準強度データを保存
                    if (presetSelect.value === 'custom') {
                        const ftInput = strengthContainer.querySelector('input[id*="-ft"]');
                        const fcInput = strengthContainer.querySelector('input[id*="-fc"]');
                        const fbInput = strengthContainer.querySelector('input[id*="-fb"]');
                        const fsInput = strengthContainer.querySelector('input[id*="-fs"]');

                        if (ftInput && fcInput && fbInput && fsInput) {
                            newMemberDefaults.F = {
                                baseStrengths: {
                                    ft: parseFloat(ftInput.value),
                                    fc: parseFloat(fcInput.value),
                                    fb: parseFloat(fbInput.value),
                                    fs: parseFloat(fsInput.value)
                                }
                            };
                        }
                    }
                }
            } else {
                // 従来の金属材料の場合
                const f_select = document.getElementById('add-popup-f-select');
                const f_input = document.getElementById('add-popup-f-input');
                if (f_select && f_input) {
                    newMemberDefaults.F = f_select.value === 'custom' ? f_input.value : f_select.value;
                } else {
                    // セレクトボックスがない場合は直接入力値を取得
                    const strengthInput = strengthContainer.querySelector('input');
                    if (strengthInput) {
                        newMemberDefaults.F = strengthInput.value;
                    }
                }
            }
        }

        const iInput = document.getElementById('add-popup-i');
        const aInput = document.getElementById('add-popup-a');
        const zInput = document.getElementById('add-popup-z');
        const iConnSelect = document.getElementById('add-popup-i-conn');
        const jConnSelect = document.getElementById('add-popup-j-conn');

        if (iInput) newMemberDefaults.I = iInput.value;
        if (aInput) newMemberDefaults.A = aInput.value;
        if (zInput) newMemberDefaults.Z = zInput.value;
        if (iConnSelect) newMemberDefaults.i_conn = iConnSelect.value;
        if (jConnSelect) newMemberDefaults.j_conn = jConnSelect.value;

        elements.addMemberPopup.style.display = 'none';
        setCanvasMode('addMember');
    };
    document.getElementById('add-popup-cancel').onclick = () => { elements.addMemberPopup.style.display = 'none'; };

    elements.modelCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const rect = elements.modelCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        selectedNodeIndex = getNodeAt(mouseX, mouseY);
        selectedMemberIndex = getMemberAt(mouseX, mouseY);
        
        // window変数も同期
        window.selectedNodeIndex = selectedNodeIndex;
        window.selectedMemberIndex = selectedMemberIndex;
        
        console.log('マウスクリック:', { mouseX, mouseY, selectedNodeIndex, selectedMemberIndex, isShiftPressed });
        
        if (canvasMode === 'select') {
            if (isShiftPressed && (selectedNodeIndex !== -1 || selectedMemberIndex !== -1)) {
                // Shiftキーが押されている場合の複数選択
                if (selectedNodeIndex !== -1) {
                    // 節点を選択する場合、既に部材が選択されていたらクリア
                    if (selectedMembers.size > 0) {
                        console.log('部材選択をクリアして節点選択モードに切り替え');
                        selectedMembers.clear();
                    }
                    
                    if (selectedNodes.has(selectedNodeIndex)) {
                        selectedNodes.delete(selectedNodeIndex);
                        console.log('節点の選択解除:', selectedNodeIndex);
                    } else {
                        selectedNodes.add(selectedNodeIndex);
                        console.log('節点を選択:', selectedNodeIndex);
                    }
                } else if (selectedMemberIndex !== -1) {
                    // 部材を選択する場合、既に節点が選択されていたらクリア
                    if (selectedNodes.size > 0) {
                        console.log('節点選択をクリアして部材選択モードに切り替え');
                        selectedNodes.clear();
                    }
                    
                    if (selectedMembers.has(selectedMemberIndex)) {
                        selectedMembers.delete(selectedMemberIndex);
                        console.log('部材の選択解除:', selectedMemberIndex);
                    } else {
                        selectedMembers.add(selectedMemberIndex);
                        console.log('部材を選択:', selectedMemberIndex);
                    }
                }
                console.log('現在の選択状態:', { 
                    selectedNodes: Array.from(selectedNodes), 
                    selectedMembers: Array.from(selectedMembers) 
                });
                if (typeof drawOnCanvas === 'function') {
                    drawOnCanvas();
                }
                return;
            }
            
            if (selectedNodeIndex !== -1) {
                // 単一選択：既存の動作
                if (!isShiftPressed) {
                    clearMultiSelection();
                    // 部材の選択をクリア（節点を選択する場合）
                    selectedMemberIndex = null;
                    window.selectedMemberIndex = null;
                }
                isDragging = true;
                pushState();
                // 単一選択ハイライト表示
                if (typeof drawOnCanvas === 'function') {
                    drawOnCanvas(); // ハイライト表示のため再描画
                }
            } else if (selectedMemberIndex !== -1) {
                // 部材の単一選択
                if (!isShiftPressed) {
                    clearMultiSelection();
                    // 節点の選択をクリア（部材を選択する場合）
                    selectedNodeIndex = null;
                }
                // 部材選択ハイライト表示
                if (typeof drawOnCanvas === 'function') {
                    drawOnCanvas(); // ハイライト表示のため再描画
                }
            } else {
                // 空の場所をクリックした場合の処理
                if (isShiftPressed) {
                    // Shiftキーが押されている場合は範囲選択を開始
                    console.log('範囲選択を開始します');
                    hideSelectionChoiceMenu();
                    isRangeSelecting = true;
                    isMultiSelecting = true;
                    rangeSelectionAdditive = isShiftPressed;
                    multiSelectStart = { x: mouseX, y: mouseY };
                    multiSelectEnd = { x: mouseX, y: mouseY };
                    drawOnCanvas();
                } else {
                    // 通常のクリック：パンドラッグを開始
                    console.log('キャンバスパンを開始します');
                    clearMultiSelection();
                    clearSingleSelection(); // 単一選択もクリア
                    isDraggingCanvas = true;
                    lastMouseX = mouseX;
                    lastMouseY = mouseY;
                }
            }
        }
    });
    elements.modelCanvas.addEventListener('mousemove', (e) => {
        const rect = elements.modelCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // マウス位置を保存（視覚的フィードバック用）
        currentMouseX = mouseX;
        currentMouseY = mouseY;
        
        // 部材追加モードの場合はリアルタイムで視覚的フィードバックを更新
        if (canvasMode === 'addMember') {
            drawOnCanvas();
        }
        
        // デバッグ：1%の確率でマウス移動の詳細を出力
        if (Math.random() < 0.01) {
            console.log('🖱️ マウス移動デバッグ:', {
                canvasMode,
                isRangeSelecting,
                isDragging, 
                isDraggingCanvas,
                条件OK: canvasMode === 'select' && !isRangeSelecting && !isDragging && !isDraggingCanvas,
                lastDrawingContext: !!window.lastDrawingContext
            });
        }
        
        // 部材ホバー検出とツールチップ表示
        if (canvasMode === 'select' && !isRangeSelecting && !isDragging && !isDraggingCanvas) {
            // lastDrawingContextが初期化されているかチェック
            if (!window.lastDrawingContext) {
                // 初回の場合は無視（まだ描画が完了していない）
                return;
            }
            
            // 部材情報表示チェックボックスの状態を確認
            const memberInfoToggle = document.getElementById('member-info-toggle');
            if (!memberInfoToggle || !memberInfoToggle.checked) {
                // チェックボックスが未チェックの場合はツールチップを非表示
                hideMemberTooltip();
                return;
            }
            
            try {
                const hoveredMember = detectMemberAtPosition(e.clientX, e.clientY);
                if (hoveredMember !== null) {
                    console.log('✅ 部材検出成功:', hoveredMember.number);
                    showMemberTooltip(hoveredMember, e.clientX, e.clientY);
                } else {
                    hideMemberTooltip();
                }
            } catch (error) {
                console.error('❌ ツールチップエラー:', error);
            }
        } else {
            // ツールチップ条件を満たさない場合は非表示
            hideMemberTooltip();
        }
        
        if (isRangeSelecting && canvasMode === 'select') {
            multiSelectEnd = { x: mouseX, y: mouseY };
            drawOnCanvas();
        } else if (isDragging && canvasMode === 'select' && selectedNodeIndex !== null) {
            let modelCoords = inverseTransform(mouseX, mouseY);
            if (modelCoords) {
                if (elements.gridToggle.checked) {
                    const spacing = parseFloat(elements.gridSpacing.value);
                    modelCoords.x = Math.round(modelCoords.x / spacing) * spacing;
                    modelCoords.y = Math.round(modelCoords.y / spacing) * spacing;
                }
                const nodeRow = elements.nodesTable.rows[selectedNodeIndex];
                nodeRow.cells[1].querySelector('input').value = modelCoords.x.toFixed(2);
                nodeRow.cells[2].querySelector('input').value = modelCoords.y.toFixed(2);
                drawOnCanvas();
            }
        } else if (isDraggingCanvas && canvasMode === 'select') {
            const deltaX = mouseX - lastMouseX;
            const deltaY = mouseY - lastMouseY;
            panZoomState.offsetX += deltaX;
            panZoomState.offsetY += deltaY;
            lastMouseX = mouseX;
            lastMouseY = mouseY;
            drawOnCanvas();
        }
    });
    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            if (isRangeSelecting) {
                console.log('範囲選択完了 - finalizeRangeSelectionを呼び出します');
                finalizeRangeSelection(e);
                isRangeSelecting = false;
                rangeSelectionAdditive = false;
                multiSelectStart = { x: 0, y: 0 };
                multiSelectEnd = { x: 0, y: 0 };
                drawOnCanvas();
            }
            if (isDragging) {
                elements.nodesTable.rows[selectedNodeIndex]?.cells[1].querySelector('input').dispatchEvent(new Event('change'));
                isDragging = false;
            }
            if (isDraggingCanvas) {
                isDraggingCanvas = false;
            }
        }
    });
    elements.modelCanvas.addEventListener('click', (e) => { 
        const rect = elements.modelCanvas.getBoundingClientRect(); let mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top; const clickedNodeIndex = getNodeAt(mouseX, mouseY); 
        if (canvasMode === 'addNode') {
            const targetMemberIndex = getMemberAt(mouseX, mouseY);
            let modelCoords = inverseTransform(mouseX, mouseY); if (!modelCoords) return;
            if (targetMemberIndex !== -1) {
                pushState();
                const { nodes } = parseInputs(), memberRow = elements.membersTable.rows[targetMemberIndex];
                const startNodeId = parseInt(memberRow.cells[1].querySelector('input').value), endNodeId = parseInt(memberRow.cells[2].querySelector('input').value);
                const p1 = nodes[startNodeId - 1], p2 = nodes[endNodeId - 1];
                let finalCoords;
                if (elements.gridToggle.checked) {
                    const spacing = parseFloat(elements.gridSpacing.value), snapTolerance = spacing / 2.5;
                    const nearestGridX = Math.round(modelCoords.x / spacing) * spacing, nearestGridY = Math.round(modelCoords.y / spacing) * spacing;
                    const distToGrid = Math.sqrt((modelCoords.x - nearestGridX)**2 + (modelCoords.y - nearestGridY)**2);
                    if (distToGrid < snapTolerance) {
                        const isCollinear = Math.abs((nearestGridY - p1.y)*(p2.x - p1.x) - (nearestGridX - p1.x)*(p2.y - p1.y)) < 1e-6;
                        const isWithinBounds = (nearestGridX >= Math.min(p1.x,p2.x)-1e-6 && nearestGridX <= Math.max(p1.x,p2.x)+1e-6 && nearestGridY >= Math.min(p1.y,p2.y)-1e-6 && nearestGridY <= Math.max(p1.y,p2.y)+1e-6);
                        if (isCollinear && isWithinBounds) finalCoords = { x: nearestGridX, y: nearestGridY };
                    }
                }
                if (!finalCoords) { const dx = p2.x-p1.x, dy = p2.y-p1.y, lenSq = dx*dx+dy*dy, t = lenSq===0 ? 0 : ((modelCoords.x-p1.x)*dx + (modelCoords.y-p1.y)*dy)/lenSq; const clampedT=Math.max(0,Math.min(1,t)); finalCoords={x:p1.x+clampedT*dx,y:p1.y+clampedT*dy}; }
                const e_select=memberRow.cells[3].querySelector('select'), e_input=memberRow.cells[3].querySelector('input[type="number"]'); const E_val = e_select.value==='custom'?e_input.value:e_select.value;
                const f_select=memberRow.cells[4].querySelector('select'), f_input=memberRow.cells[4].querySelector('input[type="number"]'); const F_val = f_select ? (f_select.value==='custom'?f_input.value:f_select.value) : '235';
                const I_m4 = parseFloat(memberRow.cells[5].querySelector('input').value)*1e-8, A_m2 = parseFloat(memberRow.cells[6].querySelector('input').value)*1e-4, Z_m3 = parseFloat(memberRow.cells[7].querySelector('input').value)*1e-6;
                
                // Dynamic cell index calculation for connections
                const hasDensityColumn = document.querySelector('.density-column') && document.querySelector('.density-column').style.display !== 'none';
                // 基本列(7) + 密度列(0or1) + 断面名称列(1) + 軸方向列(1) + 接続列(2)
                const iConnIndex = hasDensityColumn ? 12 : 11;
                const jConnIndex = hasDensityColumn ? 13 : 12;

                const props = {E:E_val, F:F_val, I:I_m4, A:A_m2, Z:Z_m3, i_conn:memberRow.cells[iConnIndex].querySelector('select').value, j_conn:memberRow.cells[jConnIndex].querySelector('select').value};
                memberRow.querySelector('.delete-row-btn').onclick.apply(memberRow.querySelector('.delete-row-btn'));
                addRow(elements.nodesTable, [`#`,`<input type="number" value="${finalCoords.x.toFixed(2)}">`,`<input type="number" value="${finalCoords.y.toFixed(2)}">`,`<select><option value="free" selected>自由</option><option value="pinned">ピン</option><option value="fixed">固定</option><option value="roller">ローラー</option></select>`, `<input type="number" value="0" step="0.1">`, `<input type="number" value="0" step="0.1">`, `<input type="number" value="0" step="0.001">`], false);
                const newNodeId = elements.nodesTable.rows.length;
                addRow(elements.membersTable, [`#`, ...memberRowHTML(startNodeId, newNodeId, props.E, props.F, props.I, props.A, props.Z, props.i_conn, 'rigid')], false);
                addRow(elements.membersTable, [`#`, ...memberRowHTML(newNodeId, endNodeId, props.E, props.F, props.I, props.A, props.Z, 'rigid', props.j_conn)], false);
                renumberTables(); drawOnCanvas();
            } else { 
                const spacing=parseFloat(elements.gridSpacing.value), snapTolerance=spacing/2.5;
                const snappedX=Math.round(modelCoords.x/spacing)*spacing, snappedY=Math.round(modelCoords.y/spacing)*spacing;
                const dist=Math.sqrt((modelCoords.x-snappedX)**2+(modelCoords.y-snappedY)**2);
                if (elements.gridToggle.checked && dist < snapTolerance) { modelCoords.x=snappedX; modelCoords.y=snappedY; }
                addRow(elements.nodesTable, [`#`,`<input type="number" value="${modelCoords.x.toFixed(2)}">`,`<input type="number" value="${modelCoords.y.toFixed(2)}">`,`<select><option value="free" selected>自由</option><option value="pinned">ピン</option><option value="fixed">固定</option><option value="roller">ローラー</option></select>`, `<input type="number" value="0" step="0.1">`, `<input type="number" value="0" step="0.1">`, `<input type="number" value="0" step="0.001">`]); 
            }
        } else if (canvasMode === 'addMember') {
            let targetNodeIndex = clickedNodeIndex;
            
            // 節点が存在しない場合は新規節点を作成
            if (clickedNodeIndex === -1) {
                console.log('🔍 節点が存在しない位置をクリック - 新規節点を作成します');
                
                // マウス位置をモデル座標に変換
                let modelCoords = inverseTransform(mouseX, mouseY);
                if (!modelCoords) {
                    console.error('❌ 座標変換に失敗しました');
                    return;
                }
                
                // グリッドスナップ処理
                const spacing = parseFloat(elements.gridSpacing.value);
                const snapTolerance = spacing * 0.3;
                let snappedX = modelCoords.x;
                let snappedY = modelCoords.y;
                
                if (elements.gridToggle.checked) {
                    const gridX = Math.round(modelCoords.x / spacing) * spacing;
                    const gridY = Math.round(modelCoords.y / spacing) * spacing;
                    const dist = Math.sqrt((modelCoords.x - gridX) ** 2 + (modelCoords.y - gridY) ** 2);
                    if (dist < snapTolerance) {
                        // グリッドに近い場合はグリッド座標に配置
                        snappedX = gridX;
                        snappedY = gridY;
                        console.log('🔍 グリッドスナップ適用:', { original: { x: modelCoords.x, y: modelCoords.y }, snapped: { x: snappedX, y: snappedY }, distance: dist });
                    } else {
                        // グリッドから遠い場合は元の座標を維持
                        snappedX = modelCoords.x;
                        snappedY = modelCoords.y;
                        console.log('🔍 グリッドスナップ無し:', { original: { x: modelCoords.x, y: modelCoords.y }, distance: dist });
                    }
                }
                
                // 新規節点をテーブルに追加
                addRow(elements.nodesTable, [`#`, `<input type="number" value="${snappedX.toFixed(2)}">`, `<input type="number" value="${snappedY.toFixed(2)}">`, `<select><option value="free" selected>自由</option><option value="pinned">ピン</option><option value="fixed">固定</option><option value="roller">ローラー</option></select>`, `<input type="number" value="0" step="0.1">`, `<input type="number" value="0" step="0.1">`, `<input type="number" value="0" step="0.001">`]);
                
                // 新規作成された節点のインデックスを取得（テーブルの最後の行）
                const nodeRows = elements.nodesTable.getElementsByTagName('tr');
                targetNodeIndex = nodeRows.length - 1;
                
                console.log('✅ 新規節点を作成しました:', { index: targetNodeIndex, x: snappedX, y: snappedY });
            }
            
            if (targetNodeIndex !== -1) {
                if (firstMemberNode === null) { 
                    firstMemberNode = targetNodeIndex;
                    console.log('🔍 部材の始点を設定:', firstMemberNode);
                } else {
                    if (firstMemberNode !== targetNodeIndex) {
                        const I_m4 = parseFloat(newMemberDefaults.I)*1e-8, A_m2 = parseFloat(newMemberDefaults.A)*1e-4, Z_m3 = parseFloat(newMemberDefaults.Z)*1e-6;
                        const sectionName = newMemberDefaults.sectionName || '';
                        const sectionAxis = newMemberDefaults.sectionAxis || '';
                        console.log('🔍 部材追加: newMemberDefaults:', { sectionName, sectionAxis, I: newMemberDefaults.I, A: newMemberDefaults.A, Z: newMemberDefaults.Z });
                        addRow(elements.membersTable, [`#`, ...memberRowHTML(firstMemberNode+1, targetNodeIndex+1, newMemberDefaults.E, newMemberDefaults.F, I_m4, A_m2, Z_m3, newMemberDefaults.i_conn, newMemberDefaults.j_conn, sectionName, sectionAxis)]);
                        console.log('✅ 部材を作成しました:', { from: firstMemberNode, to: targetNodeIndex });
                    }
                    firstMemberNode = null;
                }
                drawOnCanvas();
            }
        } 
    });

    const getNodeLoadAt = (canvasX, canvasY) => { if (!lastDrawingContext) return -1; try { const { nodes, nodeLoads } = parseInputs(); const arrowSize = 10, loadScale = 3, tolerance = 5; for (const load of nodeLoads) { if (load.px===0&&load.py===0&&load.mz===0) continue; const node=nodes[load.nodeIndex], pos=lastDrawingContext.transform(node.x, node.y); if (load.px!==0) { const dir=Math.sign(load.px), x1=pos.x, x2=pos.x-arrowSize*loadScale*dir; const rect={left:Math.min(x1,x2)-tolerance,right:Math.max(x1,x2)+tolerance,top:pos.y-(arrowSize/2)-tolerance,bottom:pos.y+(arrowSize/2)+tolerance}; if (canvasX>=rect.left&&canvasX<=rect.right&&canvasY>=rect.top&&canvasY<=rect.bottom) return load.nodeIndex; } if (load.py!==0) { const dir=Math.sign(load.py), y1=pos.y, y2=pos.y+arrowSize*loadScale*dir; const rect={top:Math.min(y1,y2)-tolerance,bottom:Math.max(y1,y2)+tolerance,left:pos.x-(arrowSize/2)-tolerance,right:pos.x+(arrowSize/2)+tolerance}; if (canvasX>=rect.left&&canvasX<=rect.right&&canvasY>=rect.top&&canvasY<=rect.bottom) return load.nodeIndex; } if (load.mz!==0) { const radius=arrowSize*1.5, dist=Math.sqrt((canvasX-pos.x)**2+(canvasY-pos.y)**2); if (dist>=radius-tolerance&&dist<=radius+tolerance) return load.nodeIndex; } } } catch (e) {} return -1; };

    elements.modelCanvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const rect = elements.modelCanvas.getBoundingClientRect(), mouseX = e.clientX-rect.left, mouseY = e.clientY-rect.top;
        
        // 全てのポップアップとメニューを確実に非表示（null チェック付き）
        if (elements.nodeContextMenu) elements.nodeContextMenu.style.display='none';
        if (elements.memberPropsPopup) {
            elements.memberPropsPopup.style.display='none';
            elements.memberPropsPopup.style.visibility='hidden';
        }
        if (elements.nodePropsPopup) {
            elements.nodePropsPopup.style.display='none';
            elements.nodePropsPopup.style.visibility='hidden';
        }
        if (elements.nodeLoadPopup) {
            elements.nodeLoadPopup.style.display='none';
            elements.nodeLoadPopup.style.visibility='hidden';
        }
        if (elements.nodeCoordsPopup) {
            elements.nodeCoordsPopup.style.display='none';
            elements.nodeCoordsPopup.style.visibility='hidden';
        }
        
        // デバッグログを追加
        console.log('🖱️ 右クリックイベント発生 - マウス位置:', { mouseX, mouseY });
        console.log('現在の複数選択状態:', {
            selectedMembers: Array.from(selectedMembers),
            selectedNodes: Array.from(selectedNodes),
            selectedMembersSize: selectedMembers.size,
            selectedNodesSize: selectedNodes.size
        });
        
        // 複数選択状態をチェック
        if (selectedMembers.size > 1) {
            console.log('✅ 複数部材選択時の右クリック - 一括編集メニュー表示:', Array.from(selectedMembers));
            showBulkEditMenu(e.pageX, e.pageY);
            return;
        } else if (selectedNodes.size > 1) {
            console.log('✅ 複数節点選択時の右クリック - 一括編集メニュー表示:', Array.from(selectedNodes));
            showBulkNodeEditMenu(e.pageX, e.pageY);
            return;
        }
        
        console.log('📍 単一選択判定開始');
        selectedNodeIndex = getNodeAt(mouseX, mouseY);
        let loadedNodeIndex = -1; 
        if (selectedNodeIndex === -1) { 
            loadedNodeIndex = getNodeLoadAt(mouseX, mouseY); 
        }
        selectedMemberIndex = getMemberAt(mouseX, mouseY);

        // window変数も同期
        window.selectedNodeIndex = selectedNodeIndex;
        window.selectedMemberIndex = selectedMemberIndex;

        console.log('✅ 右クリック後の選択状態:', {
            selectedNodeIndex,
            selectedMemberIndex,
            loadedNodeIndex,
            windowSelectedNodeIndex: window.selectedNodeIndex,
            windowSelectedMemberIndex: window.selectedMemberIndex
        });

        if (loadedNodeIndex !== -1) {
            selectedNodeIndex = loadedNodeIndex;
            console.log('💡 荷重編集ポップアップ表示開始 - 節点:', selectedNodeIndex + 1);
            const currentLoads = Array.from(elements.nodeLoadsTable.rows).find(row => parseInt(row.cells[0].querySelector('input').value)-1 === selectedNodeIndex);
            document.getElementById('popup-px').value=currentLoads?currentLoads.cells[1].querySelector('input').value:'0';
            document.getElementById('popup-py').value=currentLoads?currentLoads.cells[2].querySelector('input').value:'0';
            document.getElementById('popup-mz').value=currentLoads?currentLoads.cells[3].querySelector('input').value:'0';
            
            // ポップアップを画面中央に表示（null チェック付き）
            const popup = elements.nodeLoadPopup;
            if (popup) {
                popup.style.display = 'block';
                popup.style.visibility = 'visible';
                console.log('✅ 荷重編集ポップアップ表示設定完了');
                
                // ポップアップのサイズを取得（デフォルト値を設定）
                const popupRect = popup.getBoundingClientRect();
                const popupWidth = popupRect.width || 300;  // デフォルト幅
                const popupHeight = popupRect.height || 250; // デフォルト高さ
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                const availableHeight = Math.min(windowHeight, document.documentElement.clientHeight);
                const minMargin = 10;
                const bottomMargin = 20; // タスクバー対策
                
                // 画面内に収まるように配置
                const left = Math.max(minMargin, Math.min((windowWidth - popupWidth) / 2, windowWidth - popupWidth - minMargin));
                const top = Math.max(minMargin, Math.min((availableHeight - popupHeight) / 2, availableHeight - popupHeight - bottomMargin));
                
                popup.style.left = `${left}px`;
                popup.style.top = `${top}px`;
                popup.style.position = 'fixed';
            } else {
                console.error('❌ nodeLoadPopup 要素が見つかりません');
            }
        } else if (selectedNodeIndex !== -1) {
            console.log('💡 節点プロパティ編集表示 - 節点:', selectedNodeIndex + 1);
            // 直接節点プロパティ編集を開く
            openNodeEditor(selectedNodeIndex);
        } else if (selectedMemberIndex !== -1) {
            console.log('💡 部材プロパティポップアップ表示開始 - 部材:', selectedMemberIndex + 1);
            const memberRow = elements.membersTable.rows[selectedMemberIndex];
            const e_select = memberRow.cells[3].querySelector('select'), e_input = memberRow.cells[3].querySelector('input[type="number"]');
            const currentE = (e_select.value === 'custom') ? e_input.value : e_select.value;
            
            // ポップアップ内のE入力欄を生成
            const eContainer = document.getElementById('popup-e-container');
            eContainer.innerHTML = createEInputHTML('popup-e', currentE);
            
            // 現在の材料タイプと基準強度を取得
            const strengthContainer = memberRow.cells[4].firstElementChild;
            if (!strengthContainer) {
                console.error('強度入力コンテナが見つかりません');
                return;
            }
            const strengthType = strengthContainer.dataset.strengthType;
            let currentStrength;
            if (strengthType === 'wood-type') {
                const presetSelect = strengthContainer.querySelector('select');
                if (presetSelect.value === 'custom') {
                    currentStrength = { baseStrengths: {} };
                    ['ft', 'fc', 'fb', 'fs'].forEach(key => {
                        currentStrength.baseStrengths[key] = parseFloat(strengthContainer.querySelector(`input[id*="-${key}"]`).value);
                    });
                } else {
                    currentStrength = presetSelect.value;
                }
            } else {
                currentStrength = strengthContainer.querySelector('input').value;
            }

            const popupFContainer = document.getElementById('popup-f-container');
            const selectedOption = e_select.options[e_select.selectedIndex];
            let materialType = 'steel';
            if (selectedOption.textContent.includes('木材')) materialType = 'wood';
            else if (selectedOption.textContent.includes('ステンレス')) materialType = 'stainless';
            else if (selectedOption.textContent.includes('アルミニウム')) materialType = 'aluminum';
            
            // ポップアップ内のF入力欄を生成
            popupFContainer.innerHTML = '';
            popupFContainer.appendChild(createStrengthInputHTML(materialType, 'popup-f', currentStrength));

            // ポップアップ内のE選択に応じてF入力欄を更新するイベントリスナーを追加
            const popupESelect = document.getElementById('popup-e-select');
            if (popupESelect) {
                popupESelect.addEventListener('change', () => {
                    const selectedOpt = popupESelect.options[popupESelect.selectedIndex];
                    let newMaterialType = 'steel';
                    if (selectedOpt.textContent.includes('木材')) newMaterialType = 'wood';
                    else if (selectedOpt.textContent.includes('ステンレス')) newMaterialType = 'stainless';
                    else if (selectedOpt.textContent.includes('アルミニウム')) newMaterialType = 'aluminum';
                    
                    popupFContainer.innerHTML = '';
                    popupFContainer.appendChild(createStrengthInputHTML(newMaterialType, 'popup-f'));
                    
                    // 密度も更新（自重考慮がオンの場合）
                    const hasDensityColumn = document.querySelector('.density-column') && document.querySelector('.density-column').style.display !== 'none';
                    if (hasDensityColumn) {
                        const popupEInput = document.getElementById('popup-e-input');
                        const eValue = popupESelect.value === 'custom' ? popupEInput.value : popupESelect.value;
                        const newDensity = MATERIAL_DENSITY_DATA[eValue] || MATERIAL_DENSITY_DATA['custom'];
                        
                        // ポップアップの密度欄を更新
                        const densityContainer = document.getElementById('popup-density-container');
                        if (densityContainer) {
                            densityContainer.innerHTML = createDensityInputHTML('popup-density', newDensity);
                        }
                    }
                });
            }

            // その他のプロパティを設定
            document.getElementById('popup-i').value = memberRow.cells[5].querySelector('input').value;
            document.getElementById('popup-a').value = memberRow.cells[6].querySelector('input').value;
            document.getElementById('popup-z').value = memberRow.cells[7].querySelector('input').value;
            
            // 密度欄の表示/非表示と値設定
            const hasDensityColumn = document.querySelector('.density-column') && document.querySelector('.density-column').style.display !== 'none';
            let existingDensityLabel = document.getElementById('popup-density-label');
            let existingDensityContainer = document.getElementById('popup-density-container');
            
            if (hasDensityColumn) {
                // 密度欄が必要な場合
                if (!existingDensityLabel || !existingDensityContainer) {
                    // 密度欄を動的に作成
                    const propsGrid = document.querySelector('#member-props-popup .props-grid');
                    const zInput = document.getElementById('popup-z');
                    
                    // 密度ラベルを作成
                    const densityLabel = document.createElement('label');
                    densityLabel.setAttribute('for', 'popup-density');
                    densityLabel.textContent = '密度 ρ (kg/m³)';
                    densityLabel.id = 'popup-density-label';
                    
                    // 密度入力欄を作成
                    const densityContainer = document.createElement('div');
                    densityContainer.id = 'popup-density-container';
                    
                    // Z入力欄の直後に密度欄を挿入
                    // Z入力欄の次に挿入（より安全な方法）
                    const iConnLabel = document.querySelector('label[for="popup-i-conn"]');
                    if (iConnLabel) {
                        propsGrid.insertBefore(densityLabel, iConnLabel);
                        propsGrid.insertBefore(densityContainer, iConnLabel);
                    } else {
                        // 挿入位置が見つからない場合は末尾に追加
                        propsGrid.appendChild(densityLabel);
                        propsGrid.appendChild(densityContainer);
                    }
                    
                    // 作成した要素を変数に保存
                    existingDensityLabel = densityLabel;
                    existingDensityContainer = densityContainer;
                }
                
                // 密度値を取得してポップアップに設定
                const densityCell = memberRow.cells[8]; // 密度は8番目のセル
                if (densityCell && densityCell.classList.contains('density-cell')) {
                    const densitySelect = densityCell.querySelector('select');
                    const densityInput = densityCell.querySelector('input[type="number"]');
                    const currentDensity = (densitySelect && densitySelect.value === 'custom') ? densityInput.value : (densitySelect ? densitySelect.value : '7850');
                    
                    // 密度入力欄にHTMLを設定
                    if (existingDensityContainer) {
                        existingDensityContainer.innerHTML = createDensityInputHTML('popup-density', currentDensity);
                    }
                }
                
                // 密度欄を表示
                if (existingDensityLabel) existingDensityLabel.style.display = '';
                if (existingDensityContainer) existingDensityContainer.style.display = '';
                
                // 密度フィールド表示後にポップアップ位置を再調整
                setTimeout(() => adjustPopupPosition(elements.memberPropsPopup), 0);
            } else {
                // 密度欄を非表示
                if (existingDensityLabel) existingDensityLabel.style.display = 'none';
                if (existingDensityContainer) existingDensityContainer.style.display = 'none';
                
                // 密度フィールド非表示後にポップアップ位置を再調整
                setTimeout(() => adjustPopupPosition(elements.memberPropsPopup), 0);
            }
            
            // Dynamic cell index calculation for connections
            // 基本列(7) + 密度列(0or1) + 断面名称列(1) + 軸方向列(1) + 接続列(2)
            const iConnIndex = hasDensityColumn ? 12 : 11;
            const jConnIndex = hasDensityColumn ? 13 : 12;

            document.getElementById('popup-i-conn').value = memberRow.cells[iConnIndex].querySelector('select').value;
            document.getElementById('popup-j-conn').value = memberRow.cells[jConnIndex].querySelector('select').value;
            const memberLoadRow = Array.from(elements.memberLoadsTable.rows).find(row => parseInt(row.cells[0].querySelector('input').value)-1 === selectedMemberIndex);
            document.getElementById('popup-w').value = memberLoadRow ? memberLoadRow.cells[1].querySelector('input').value : '0';
            
            // ポップアップを部材に重ならない位置に表示（null チェック付き）
            const popup = elements.memberPropsPopup;
            if (!popup) {
                console.error('❌ memberPropsPopup 要素が見つかりません');
                return;
            }
            
            popup.style.display = 'block';
            popup.style.visibility = 'visible';
            console.log('📦 部材プロパティポップアップ - 表示設定:', {
                display: popup.style.display,
                visibility: popup.style.visibility,
                position: popup.style.position
            });
            
            // ポップアップのサイズを取得（デフォルト値を設定）
            const popupRect = popup.getBoundingClientRect();
            const popupWidth = popupRect.width || 400;  // デフォルト幅
            const popupHeight = popupRect.height || 350; // デフォルト高さ
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const availableHeight = Math.min(windowHeight, document.documentElement.clientHeight);
            const canvasRect = elements.modelCanvas.getBoundingClientRect();
            
            // スクロール位置を考慮
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            
            // 選択された部材の位置を取得
            let memberBounds = null;
            if (window.selectedMemberIndex !== null && window.selectedMemberIndex >= 0) {
                try {
                    const { nodes, members } = window.parseInputs();
                    const member = members[window.selectedMemberIndex];
                    if (member && window.lastDrawingContext) {
                        const node1 = nodes[member.i];
                        const node2 = nodes[member.j];
                        if (node1 && node2) {
                            const pos1 = window.lastDrawingContext.transform(node1.x, node1.y);
                            const pos2 = window.lastDrawingContext.transform(node2.x, node2.y);
                            
                            // 部材の境界ボックスを計算（キャンバス座標系）
                            const minX = Math.min(pos1.x, pos2.x);
                            const maxX = Math.max(pos1.x, pos2.x);
                            const minY = Math.min(pos1.y, pos2.y);
                            const maxY = Math.max(pos1.y, pos2.y);
                            
                            // ページ座標系に変換
                            memberBounds = {
                                left: canvasRect.left + minX - 50,   // マージンを追加
                                right: canvasRect.left + maxX + 50,
                                top: canvasRect.top + minY - 50,
                                bottom: canvasRect.top + maxY + 50
                            };
                        }
                    }
                } catch (error) {
                    console.warn('部材位置の取得に失敗:', error);
                }
            }
            
            let left, top;
            
            if (memberBounds) {
                // 部材の位置を避けてポップアップを配置
                const margin = 20;
                const minMargin = 10;
                const bottomMargin = 20; // タスクバー対策
                
                // 右側に配置を試行
                left = memberBounds.right + margin;
                if (left + popupWidth > windowWidth - minMargin) {
                    // 右側に収まらない場合は左側に配置
                    left = memberBounds.left - popupWidth - margin;
                    if (left < minMargin) {
                        // 左側にも収まらない場合は上下に配置
                        left = Math.max(minMargin, Math.min((windowWidth - popupWidth) / 2, windowWidth - popupWidth - minMargin));
                        top = memberBounds.bottom + margin;
                        if (top + popupHeight > availableHeight - bottomMargin) {
                            // 下側に収まらない場合は上側に配置
                            top = memberBounds.top - popupHeight - margin;
                            if (top < minMargin) {
                                // どこにも収まらない場合は画面中央（強制的に収める）
                                left = Math.max(minMargin, (windowWidth - popupWidth) / 2);
                                top = Math.max(minMargin, (availableHeight - popupHeight) / 2);
                                // ウィンドウより大きい場合は調整
                                if (left + popupWidth > windowWidth - minMargin) {
                                    left = minMargin;
                                }
                                if (top + popupHeight > availableHeight - bottomMargin) {
                                    top = minMargin;
                                }
                            }
                        }
                    } else {
                        // 左側に配置できる場合の縦位置
                        top = Math.max(minMargin, Math.min(memberBounds.top, availableHeight - popupHeight - bottomMargin));
                    }
                } else {
                    // 右側に配置できる場合の縦位置
                    top = Math.max(minMargin, Math.min(memberBounds.top, availableHeight - popupHeight - bottomMargin));
                }
            } else {
                // 部材の位置が取得できない場合は画面中央に配置
                left = Math.max(10, Math.min((windowWidth - popupWidth) / 2, windowWidth - popupWidth - 10));
                top = Math.max(10, Math.min((availableHeight - popupHeight) / 2, availableHeight - popupHeight - 20));
            }
            
            popup.style.left = `${left}px`;
            popup.style.top = `${top}px`;
            popup.style.position = 'fixed';
            popup.style.zIndex = '10000';
            
            console.log('✅ 部材プロパティポップアップ表示完了:', {
                left: popup.style.left,
                top: popup.style.top,
                display: popup.style.display,
                visibility: popup.style.visibility,
                position: popup.style.position,
                zIndex: popup.style.zIndex
            });
        } else {
            console.log('❌ クリック位置に節点・部材・荷重が見つかりませんでした');
        }

        // 選択状態をハイライト表示するため再描画
        drawOnCanvas();
    });
    
    // ポップアップの位置を動的に再調整する関数
    function adjustPopupPosition(popup, targetBounds = null) {
        console.log('📐 adjustPopupPosition呼び出し:', {
            popup: popup?.id,
            display: popup?.style.display,
            targetBounds: targetBounds
        });
        
        if (!popup || popup.style.display === 'none') {
            console.log('❌ ポップアップが非表示または存在しません');
            return;
        }
        
        // 現在のポップアップサイズを取得
        const popupRect = popup.getBoundingClientRect();
        const popupWidth = popupRect.width;
        const popupHeight = popupRect.height;
        
        console.log('📏 ポップアップサイズ:', {
            width: popupWidth,
            height: popupHeight,
            currentRect: popupRect
        });
        const windowWidth = window.innerWidth;
        
        // 実際に利用可能な画面高さを取得（タスクバーなどを除く）
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.clientHeight;
        const availableHeight = Math.min(windowHeight, documentHeight);
        
        const minMargin = 10;
        const bottomMargin = 20; // タスクバー対策でより大きなマージン
        
        let left = parseInt(popup.style.left) || 0;
        let top = parseInt(popup.style.top) || 0;
        
        if (targetBounds) {
            // 部材位置を避けて再配置
            const margin = 20;
            
            // 右側に配置を試行
            left = targetBounds.right + margin;
            if (left + popupWidth > windowWidth - minMargin) {
                // 右側に収まらない場合は左側に配置
                left = targetBounds.left - popupWidth - margin;
                if (left < minMargin) {
                    // 左側にも収まらない場合は上下に配置
                    left = Math.max(minMargin, Math.min((windowWidth - popupWidth) / 2, windowWidth - popupWidth - minMargin));
                    top = targetBounds.bottom + margin;
                    if (top + popupHeight > availableHeight - bottomMargin) {
                        // 下側に収まらない場合は上側に配置
                        top = targetBounds.top - popupHeight - margin;
                        if (top < minMargin) {
                            // どこにも収まらない場合は画面中央（強制的に収める）
                            left = Math.max(minMargin, (windowWidth - popupWidth) / 2);
                            top = Math.max(minMargin, (availableHeight - popupHeight) / 2);
                        }
                    }
                } else {
                    // 左側に配置できる場合の縦位置
                    top = Math.max(minMargin, Math.min(targetBounds.top, availableHeight - popupHeight - bottomMargin));
                }
            } else {
                // 右側に配置できる場合の縦位置
                top = Math.max(minMargin, Math.min(targetBounds.top, availableHeight - popupHeight - bottomMargin));
            }
        } else {
            // 画面境界チェックのみ
            // 右端チェック
            if (left + popupWidth > windowWidth - minMargin) {
                left = windowWidth - popupWidth - minMargin;
            }
            // 左端チェック
            if (left < minMargin) {
                left = minMargin;
            }
            // 下端チェック（タスクバー対応）
            if (top + popupHeight > availableHeight - bottomMargin) {
                top = availableHeight - popupHeight - bottomMargin;
            }
            // 上端チェック
            if (top < minMargin) {
                top = minMargin;
            }
        }
        
        // 最終的に画面内に強制的に収める
        left = Math.max(minMargin, Math.min(left, windowWidth - popupWidth - minMargin));
        top = Math.max(minMargin, Math.min(top, availableHeight - popupHeight - bottomMargin));
        
        console.log('✅ ポップアップ最終位置:', {
            left: left,
            top: top,
            windowWidth: windowWidth,
            availableHeight: availableHeight,
            popupDisplay: popup.style.display
        });
        
        // position: fixedを明示的に設定
        popup.style.position = 'fixed';
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
        popup.style.zIndex = '10000'; // 非常に高いz-indexを設定
        
        console.log('🎯 ポップアップ位置設定完了:', {
            styleLeft: popup.style.left,
            styleTop: popup.style.top,
            styleDisplay: popup.style.display,
            stylePosition: popup.style.position,
            styleZIndex: popup.style.zIndex,
            boundingRect: popup.getBoundingClientRect()
        });
    }
    
    // ポップアップのドラッグ機能を追加する関数
    function makePopupDraggable(popup) {
        if (!popup) return;
        
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        // ヘッダー部分を取得（h4タグまたはポップアップ全体）
        const header = popup.querySelector('h4') || popup;
        if (!header) return;
        
        // ヘッダーにドラッグ可能であることを示すスタイルを適用
        header.style.cursor = 'move';
        header.style.userSelect = 'none';
        
        function startDrag(e) {
            isDragging = true;
            const popupRect = popup.getBoundingClientRect();
            dragOffset.x = e.clientX - popupRect.left;
            dragOffset.y = e.clientY - popupRect.top;
            
            // ポップアップを最前面に移動とドラッグスタイル適用
            popup.style.zIndex = '1002';
            popup.classList.add('popup-dragging');
            
            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', stopDrag);
            e.preventDefault();
        }
        
        function doDrag(e) {
            if (!isDragging) return;
            
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const availableHeight = Math.min(windowHeight, document.documentElement.clientHeight);
            const popupRect = popup.getBoundingClientRect();
            const minMargin = 5;
            const bottomMargin = 20;
            
            // 新しい位置を計算
            let newLeft = e.clientX - dragOffset.x;
            let newTop = e.clientY - dragOffset.y;
            
            // 画面境界内に制限
            newLeft = Math.max(minMargin, Math.min(newLeft, windowWidth - popupRect.width - minMargin));
            newTop = Math.max(minMargin, Math.min(newTop, availableHeight - popupRect.height - bottomMargin));
            
            popup.style.left = `${newLeft}px`;
            popup.style.top = `${newTop}px`;
        }
        
        function stopDrag() {
            if (isDragging) {
                isDragging = false;
                // z-indexを元に戻してドラッグスタイルを削除
                popup.style.zIndex = '1001';
                popup.classList.remove('popup-dragging');
                document.removeEventListener('mousemove', doDrag);
                document.removeEventListener('mouseup', stopDrag);
            }
        }
        
        header.addEventListener('mousedown', startDrag);
        
        // タッチデバイス対応
        function startTouchDrag(e) {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                startDrag(mouseEvent);
            }
        }
        
        function handleTouchMove(e) {
            if (isDragging && e.touches.length === 1) {
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                doDrag(mouseEvent);
                e.preventDefault();
            }
        }
        
        function handleTouchEnd(e) {
            if (isDragging) {
                stopDrag();
                e.preventDefault();
            }
        }
        
        header.addEventListener('touchstart', startTouchDrag, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
    }
    
    // 全てのポップアップにドラッグ機能を適用
    if(elements.memberPropsPopup) makePopupDraggable(elements.memberPropsPopup);
    if(elements.addMemberPopup) makePopupDraggable(elements.addMemberPopup);
    if(elements.nodeLoadPopup) makePopupDraggable(elements.nodeLoadPopup);

    // 結果図のキャンバスにマウス操作機能を追加
    addResultCanvasMouseControls('displacement-canvas');
    addResultCanvasMouseControls('moment-canvas');
    addResultCanvasMouseControls('axial-canvas');
    addResultCanvasMouseControls('shear-canvas');
    addResultCanvasMouseControls('ratio-canvas');

    document.addEventListener('click', (e) => { 
        if (elements.modeAddMemberBtn && elements.modeAddMemberBtn.contains(e.target)) return;
        if(elements.memberPropsPopup && elements.addMemberPopup && !elements.memberPropsPopup.contains(e.target) && !elements.addMemberPopup.contains(e.target)) { 
            if(elements.memberPropsPopup) elements.memberPropsPopup.style.display='none'; 
            if(elements.addMemberPopup) elements.addMemberPopup.style.display='none'; 
        }
        if(elements.nodeLoadPopup && !elements.nodeLoadPopup.contains(e.target)) elements.nodeLoadPopup.style.display='none';
        if(elements.nodeCoordsPopup && !elements.nodeCoordsPopup.contains(e.target)) elements.nodeCoordsPopup.style.display='none';
        if(elements.nodeContextMenu && !elements.nodeContextMenu.contains(e.target)) elements.nodeContextMenu.style.display='none';
    });

    elements.nodeContextMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.target;
        if (selectedNodeIndex === null) return;

        if (target.id === 'menu-edit-node-props') {
            openNodeEditor(selectedNodeIndex);
        } else if (target.id === 'menu-delete-node') {
            elements.nodesTable.rows[selectedNodeIndex].querySelector('.delete-row-btn').click();
        }
        elements.nodeContextMenu.style.display = 'none';
    });

    document.getElementById('popup-select-section').onclick = () => {
    if (selectedMemberIndex !== null) {
        // ポップアップ内の情報から材料情報を取得
        const popup_e_select = document.getElementById('popup-e-select');
        const selectedOption = popup_e_select.options[popup_e_select.selectedIndex];
        let materialType = 'steel';
        if (selectedOption.textContent.includes('木材')) materialType = 'wood';
        else if (selectedOption.textContent.includes('コンクリート')) materialType = 'concrete';
        else if (selectedOption.textContent.includes('ステンレス')) materialType = 'stainless';
        else if (selectedOption.textContent.includes('アルミニウム')) materialType = 'aluminum';
        
        const strengthContainer = document.getElementById('popup-f-container').firstElementChild;
        let strengthValue = '';
        if (strengthContainer.querySelector('input')) strengthValue = strengthContainer.querySelector('input').value;
        if (strengthContainer.querySelector('select')) strengthValue = strengthContainer.querySelector('select').value;

        openSteelSelector(selectedMemberIndex, {
            material: materialType,
            E: popup_e_select.value === 'custom' ? document.getElementById('popup-e-input').value : popup_e_select.value,
            strengthValue: strengthValue
        });
        elements.memberPropsPopup.style.display = 'none';
    }
};

    document.getElementById('popup-save').onclick = () => {
        if (selectedMemberIndex === null) return;
        pushState();
        const memberRow = elements.membersTable.rows[selectedMemberIndex];

        // 1. ポップアップからE係数の値を取得し、テーブルに反映
        const popup_e_select = document.getElementById('popup-e-select');
        const popup_e_input = document.getElementById('popup-e-input');
        const newEValue = popup_e_select.value === 'custom' ? popup_e_input.value : popup_e_select.value;
        
        const table_e_select = memberRow.cells[3].querySelector('select');
        const table_e_input = memberRow.cells[3].querySelector('input[type="number"]');
        
        const matching_option = Array.from(table_e_select.options).find(opt => opt.value === newEValue);
        if (matching_option) {
            table_e_select.value = newEValue;
        } else {
            table_e_select.value = 'custom';
        }
        table_e_input.value = newEValue;
        table_e_input.readOnly = (table_e_select.value !== 'custom');
        
        // 2. E係数の変更イベントを発火させ、基準強度UIを正しく再生成させる
        table_e_select.dispatchEvent(new Event('change'));

        // 3. ポップアップの基準強度UIの状態を、テーブルにコピーする
        const popupStrengthContainer = document.getElementById('popup-f-container').firstElementChild;
        const tableStrengthContainer = memberRow.cells[4].firstElementChild; // 再生成された最新のUI
        if (!popupStrengthContainer) {
            console.error('ポップアップ強度コンテナが見つかりません');
            return;
        }
        const strengthType = popupStrengthContainer.dataset.strengthType;

        if (strengthType === 'wood-type') {
            const popupPresetSelect = popupStrengthContainer.querySelector('select');
            const tablePresetSelect = tableStrengthContainer.querySelector('select');
            tablePresetSelect.value = popupPresetSelect.value;
            tablePresetSelect.dispatchEvent(new Event('change')); // UIの状態（readonlyなど）を更新
            
            if (popupPresetSelect.value === 'custom') {
                ['ft', 'fc', 'fb', 'fs'].forEach(key => {
                    const popupInput = popupStrengthContainer.querySelector(`input[id*="-${key}"]`);
                    const tableInput = tableStrengthContainer.querySelector(`input[id*="-${key}"]`);
                    if(popupInput && tableInput) tableInput.value = popupInput.value;
                });
            }
        } else { // 鋼材などの場合
            const popupSelect = popupStrengthContainer.querySelector('select');
            const popupInput = popupStrengthContainer.querySelector('input');
            const tableSelect = tableStrengthContainer.querySelector('select');
            const tableInput = tableStrengthContainer.querySelector('input');
            if(popupSelect && tableSelect) tableSelect.value = popupSelect.value;
            if(popupInput && tableInput) {
                tableInput.value = popupInput.value;
                tableInput.readOnly = popupInput.readOnly;
            }
        }

        // 4. その他のプロパティを更新
        memberRow.cells[5].querySelector('input').value = document.getElementById('popup-i').value;
        memberRow.cells[6].querySelector('input').value = document.getElementById('popup-a').value;
        memberRow.cells[7].querySelector('input').value = document.getElementById('popup-z').value;
        
        // 密度の保存処理
        const hasDensityColumn = document.querySelector('.density-column') && document.querySelector('.density-column').style.display !== 'none';
        if (hasDensityColumn) {
            const popupDensitySelect = document.getElementById('popup-density-select');
            const popupDensityInput = document.getElementById('popup-density-input');
            
            if (popupDensitySelect && popupDensityInput) {
                const densityCell = memberRow.cells[8]; // 密度は8番目のセル
                if (densityCell && densityCell.classList.contains('density-cell')) {
                    const tableDensitySelect = densityCell.querySelector('select');
                    const tableDensityInput = densityCell.querySelector('input[type="number"]');
                    
                    if (tableDensitySelect && tableDensityInput) {
                        tableDensitySelect.value = popupDensitySelect.value;
                        tableDensityInput.value = popupDensityInput.value;
                        tableDensityInput.readOnly = (popupDensitySelect.value !== 'custom');
                    }
                }
            }
        }
        
        // Dynamic cell index calculation for connections
        // 基本列(7) + 密度列(0or1) + 断面名称列(1) + 軸方向列(1) + 接続列(2)
        const iConnIndex = hasDensityColumn ? 12 : 11;
        const jConnIndex = hasDensityColumn ? 13 : 12;

        memberRow.cells[iConnIndex].querySelector('select').value = document.getElementById('popup-i-conn').value;
        memberRow.cells[jConnIndex].querySelector('select').value = document.getElementById('popup-j-conn').value;
        const wValue = parseFloat(document.getElementById('popup-w').value) || 0;
        const memberLoadRow = Array.from(elements.memberLoadsTable.rows).find(row => parseInt(row.cells[0].querySelector('input').value) - 1 === selectedMemberIndex);
        if (wValue !== 0) {
            if (memberLoadRow) {
                memberLoadRow.cells[1].querySelector('input').value = wValue;
            } else {
                addRow(elements.memberLoadsTable, [`<input type="number" value="${selectedMemberIndex + 1}">`, `<input type="number" value="${wValue}">`]);
            }
        } else if (memberLoadRow) {
            memberLoadRow.querySelector('.delete-row-btn').click();
        }
        elements.memberPropsPopup.style.display = 'none';
        runFullAnalysis();
        drawOnCanvas();
    };
    document.getElementById('popup-cancel').onclick = () => { elements.memberPropsPopup.style.display = 'none'; };
    document.getElementById('popup-delete-member').onclick = () => { if(selectedMemberIndex !== null) { elements.membersTable.rows[selectedMemberIndex].querySelector('.delete-row-btn').click(); elements.memberPropsPopup.style.display='none'; } };

    // 節点プロパティ編集ポップアップを開き、データを設定する関数
    const openNodeEditor = (nodeIndex) => {
        selectedNodeIndex = nodeIndex;
        window.selectedNodeIndex = nodeIndex;

        const nodeRow = elements.nodesTable.rows[nodeIndex];
        
        // 節点テーブルの行が存在しない場合のエラーハンドリング
        if (!nodeRow) {
            console.error('❌ 節点テーブルの行が見つかりません:', nodeIndex);
            alert(`節点 ${nodeIndex + 1} のテーブル行が見つかりません。`);
            return;
        }

        const loadRow = Array.from(elements.nodeLoadsTable.rows).find(row => {
            const input = row.cells[0]?.querySelector('input');
            return input && parseInt(input.value) - 1 === nodeIndex;
        });

        // 各入力フィールドに現在の値を設定（nullチェック付き）
        const xInput = nodeRow.cells[1]?.querySelector('input');
        const yInput = nodeRow.cells[2]?.querySelector('input');
        const supportSelect = nodeRow.cells[3]?.querySelector('select');
        const dxInput = nodeRow.cells[4]?.querySelector('input');
        const dyInput = nodeRow.cells[5]?.querySelector('input');
        const drInput = nodeRow.cells[6]?.querySelector('input');

        document.getElementById('popup-x').value = xInput ? xInput.value : '0';
        document.getElementById('popup-y').value = yInput ? yInput.value : '0';
        document.getElementById('popup-support').value = supportSelect ? supportSelect.value : 'free';
        document.getElementById('popup-dx').value = dxInput ? dxInput.value : '0';
        document.getElementById('popup-dy').value = dyInput ? dyInput.value : '0';
        document.getElementById('popup-dr').value = drInput ? drInput.value : '0';

        // 荷重データの設定（nullチェック付き）
        const pxInput = loadRow?.cells[1]?.querySelector('input');
        const pyInput = loadRow?.cells[2]?.querySelector('input');
        const mzInput = loadRow?.cells[3]?.querySelector('input');
        
        document.getElementById('popup-px').value = pxInput ? pxInput.value : '0';
        document.getElementById('popup-py').value = pyInput ? pyInput.value : '0';
        document.getElementById('popup-mz').value = mzInput ? mzInput.value : '0';
        
        const popup = elements.nodePropsPopup;
        if (!popup) {
            console.error('❌ nodePropsPopup 要素が見つかりません');
            return;
        }
        
        popup.style.display = 'block';
        popup.style.visibility = 'visible';

        // ポップアップを画面中央に配置
        const popupRect = popup.getBoundingClientRect();
        popup.style.left = `${(window.innerWidth - popupRect.width) / 2}px`;
        popup.style.top = `${(window.innerHeight - popupRect.height) / 2}px`;
        popup.style.position = 'fixed';
        popup.style.zIndex = '10000';
        
        console.log('✅ 節点プロパティポップアップ表示完了:', {
            nodeIndex: selectedNodeIndex + 1,
            display: popup.style.display,
            visibility: popup.style.visibility
        });
    };

    // 新しい節点プロパティポップアップの保存ボタンの処理
    document.getElementById('popup-node-props-save').onclick = () => {
        if (selectedNodeIndex === null) return;
        pushState();
        
        // 節点テーブルの値を更新
        const nodeRow = elements.nodesTable.rows[selectedNodeIndex];
        nodeRow.cells[1].querySelector('input').value = document.getElementById('popup-x').value;
        nodeRow.cells[2].querySelector('input').value = document.getElementById('popup-y').value;
        nodeRow.cells[3].querySelector('select').value = document.getElementById('popup-support').value;
        nodeRow.cells[4].querySelector('input').value = document.getElementById('popup-dx').value;
        nodeRow.cells[5].querySelector('input').value = document.getElementById('popup-dy').value;
        nodeRow.cells[6].querySelector('input').value = document.getElementById('popup-dr').value;

        // 節点荷重テーブルの値を更新または作成/削除
        const px = document.getElementById('popup-px').value || 0;
        const py = document.getElementById('popup-py').value || 0;
        const mz = document.getElementById('popup-mz').value || 0;

        let loadRow = Array.from(elements.nodeLoadsTable.rows).find(row => parseInt(row.cells[0].querySelector('input').value) - 1 === selectedNodeIndex);

        if (parseFloat(px) === 0 && parseFloat(py) === 0 && parseFloat(mz) === 0) {
            if (loadRow) loadRow.remove(); // 全ての荷重が0なら行を削除
        } else {
            if (loadRow) { // 既存の行があれば更新
                loadRow.cells[1].querySelector('input').value = px;
                loadRow.cells[2].querySelector('input').value = py;
                loadRow.cells[3].querySelector('input').value = mz;
            } else { // なければ新規作成
                addRow(elements.nodeLoadsTable, [`<input type="number" value="${selectedNodeIndex + 1}">`, `<input type="number" value="${px}">`, `<input type="number" value="${py}">`, `<input type="number" value="${mz}">`]);
            }
        }
        
        elements.nodePropsPopup.style.display = 'none';
        runFullAnalysis();
        drawOnCanvas();
    };

    // 新しい節点プロパティポップアップのキャンセルボタンの処理
    document.getElementById('popup-node-props-cancel').onclick = () => {
        elements.nodePropsPopup.style.display = 'none';
    };

    // 節点削除ボタンの処理
    document.getElementById('popup-delete-node').onclick = () => {
        if (selectedNodeIndex === null) return;
        
        // 確認ダイアログを表示
        if (confirm(`節点 ${selectedNodeIndex + 1} を削除しますか？\nこの節点に接続されている部材も削除されます。`)) {
            // 節点テーブルの行と削除ボタンの存在確認
            const nodeRow = elements.nodesTable.rows[selectedNodeIndex];
            const deleteBtn = nodeRow?.querySelector('.delete-row-btn');
            
            if (deleteBtn) {
                // 節点テーブルの削除ボタンをクリック（既存の削除処理を利用）
                deleteBtn.click();
            } else {
                console.error('❌ 削除ボタンが見つかりません:', selectedNodeIndex);
                alert('削除ボタンが見つかりません。テーブルから直接削除してください。');
            }
            
            // ポップアップを閉じる
            elements.nodePropsPopup.style.display = 'none';
            
            // 選択状態をリセット
            selectedNodeIndex = null;
            window.selectedNodeIndex = null;
        }
    };

    document.getElementById('help-select').onclick = () => alert('【選択/移動モード】\n・節点をクリック＆ドラッグして移動します。\n・節点、部材、荷重を右クリックすると、編集メニューが表示されます。\n・Shiftキーを押しながら空白部分をドラッグすると矩形範囲で節点または部材を追加/解除選択できます。\n・Ctrl（⌘）キーを押しながら空白部分をドラッグすると範囲選択をやり直せます。\n・矩形内に節点と部材が混在する場合は、解除後にどちらを選択するかのメニューが表示されます。\n\n■複数選択機能：\n・Shiftキーを押しながら節点や部材をクリックすると複数選択できます。\n・選択された要素は赤色で強調表示されます。\n・Escapeキーで選択をクリアできます。\n・選択中の要素は一括編集が可能です。');
    document.getElementById('help-add-node').onclick = () => alert('【節点追加モード】\n・キャンバス上の好きな位置をクリックすると、新しい節点が追加されます。\n・グリッド表示時、交点近くをクリックすると自動で交点上に配置されます。\n・既存の部材上をクリックすると、その部材を2つに分割する形で節点が追加されます。');
    document.getElementById('help-add-member').onclick = () => alert('【部材追加モード】\n始点となる節点をクリックし、次に終点となる節点をクリックすると、2つの節点を結ぶ部材が追加されます。');

    // キーボードショートカット機能とイベントリスナー（複数選択機能）
    document.addEventListener('keydown', (e) => {
        // 入力フィールドがアクティブな場合はショートカットをスキップ（Delete/BackspaceとCtrl+Z以外）
        const isInputActive = document.activeElement && 
            (document.activeElement.tagName === 'INPUT' || 
             document.activeElement.tagName === 'TEXTAREA' || 
             document.activeElement.tagName === 'SELECT' ||
             document.activeElement.isContentEditable);

        // Shiftキー処理（複数選択用）
        if (e.key === 'Shift') {
            isShiftPressed = true;
            console.log('Shiftキー押下:', isShiftPressed);
        }
        
        // Escapeキー - 選択をクリア
        if (e.key === 'Escape') {
            console.log('Escapeキー押下 - 複数選択をクリア');
            clearMultiSelection();
            e.preventDefault();
        }
        
        // Delete/Backspaceキー - 選択された要素を削除
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (isInputActive) return; // 入力フィールドでは削除処理をスキップ
            
            console.log('Deleteキー押下 - 選択された要素を削除');
            e.preventDefault();
            deleteSelectedElements();
        }

        // 入力フィールドがアクティブな場合、以下のショートカットをスキップ
        if (isInputActive && !(e.ctrlKey && e.key === 'z')) return;

        // キーボードショートカット
        if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
            switch(e.key.toLowerCase()) {
                case 's':
                    // 選択/移動モード
                    console.log('ショートカット: 選択/移動モード (S)');
                    setCanvasMode('select');
                    e.preventDefault();
                    break;
                case 'n':
                    // 節点追加モード
                    console.log('ショートカット: 節点追加モード (N)');
                    setCanvasMode('addNode');
                    e.preventDefault();
                    break;
                case 'm':
                    // 部材追加モード
                    console.log('ショートカット: 部材追加モード (M)');
                    setCanvasMode('addMember');
                    e.preventDefault();
                    break;
                case 'c':
                    // 計算実行
                    console.log('ショートカット: 計算実行 (C)');
                    if (elements.calculateBtn && !elements.calculateBtn.disabled) {
                        elements.calculateBtn.click();
                    }
                    e.preventDefault();
                    break;
                case 'r':
                    // レポート出力
                    console.log('ショートカット: レポート出力 (R)');
                    if (elements.reportBtn && !elements.reportBtn.disabled) {
                        elements.reportBtn.click();
                    }
                    e.preventDefault();
                    break;
                case 'a':
                    // 自動スケーリング
                    console.log('ショートカット: 自動スケーリング (A)');
                    if (elements.autoScaleBtn) {
                        elements.autoScaleBtn.click();
                    }
                    e.preventDefault();
                    break;
                case 'g':
                    // グリッド表示切替
                    console.log('ショートカット: グリッド表示切替 (G)');
                    if (elements.gridToggle) {
                        elements.gridToggle.checked = !elements.gridToggle.checked;
                        drawOnCanvas();
                    }
                    e.preventDefault();
                    break;
            }
        }
        
        // Ctrl+キー の組み合わせ
        if (e.ctrlKey) {
            switch(e.key.toLowerCase()) {
                case 'z':
                    // 元に戻す
                    console.log('ショートカット: 元に戻す (Ctrl+Z)');
                    if (elements.undoBtn && !elements.undoBtn.disabled) {
                        elements.undoBtn.click();
                    }
                    e.preventDefault();
                    break;
                case 's':
                    // 入力保存
                    console.log('ショートカット: 入力保存 (Ctrl+S)');
                    if (elements.saveBtn) {
                        elements.saveBtn.click();
                    }
                    e.preventDefault();
                    break;
                case 'o':
                    // 入力読込
                    console.log('ショートカット: 入力読込 (Ctrl+O)');
                    if (elements.loadBtn) {
                        elements.loadBtn.click();
                    }
                    e.preventDefault();
                    break;
            }
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            isShiftPressed = false;
            console.log('Shiftキー解放:', isShiftPressed);
        }
    });

// --- Table Row Templates & Presets ---
const createEInputHTML = (idPrefix, currentE = '205000') => {

        const materials = { "205000": "スチール", "193000": "ステンレス", "70000": "アルミニウム", "8000": "木材" };
        const e_val_str = parseFloat(currentE).toString();
        let isPresetMaterial = materials.hasOwnProperty(e_val_str);
        let options_html = '';
        for (const [value, name] of Object.entries(materials)) { options_html += `<option value="${value}" ${e_val_str === value ? 'selected' : ''}>${name}</option>`; }
        options_html += `<option value="custom" ${!isPresetMaterial ? 'selected' : ''}>任意入力</option>`;
        const selectId = `${idPrefix}-select`, inputId = `${idPrefix}-input`;
        
        // HTMLを生成
        const html = `<div style="display: flex; flex-direction: column; gap: 2px;">
            <select id="${selectId}">
                ${options_html}
            </select>
            <input id="${inputId}" type="number" value="${currentE}" title="弾性係数 E (N/mm²)" style="display: inline-block;" ${!isPresetMaterial ? '' : 'readonly'}>
        </div>`;
        
        // イベントリスナーを後で設定するために、setTimeout を使用
        setTimeout(() => {
            const select = document.getElementById(selectId);
            const input = document.getElementById(inputId);
            if (select && input) {
                select.addEventListener('change', function() {
                    if (this.value !== 'custom') {
                        input.value = this.value;
                    }
                    input.readOnly = (this.value !== 'custom');
                    input.dispatchEvent(new Event('change'));
                    
                    // 木材が選択された場合、基準強度変更時に弾性係数を更新するイベントリスナーを設定
                    if (this.value === '8000') {
                        setTimeout(() => {
                            const strengthContainer = this.closest('tr')?.cells[4]?.firstElementChild || 
                                                   document.querySelector('[data-strength-type="wood-type"]');
                            if (strengthContainer) {
                                const strengthSelect = strengthContainer.querySelector('select');
                                if (strengthSelect) {
                                    const updateElasticModulus = () => {
                                        const woodType = strengthSelect.value;
                                        const woodElasticModuli = {
                                            'Akamatsu_Group': 8000, 'Kuromatsu_Group': 8000, 'Beimatsu_Group': 8000,
                                            'Karamatsu_Group': 9000, 'Hiba_Group': 9000, 'Hinoki_Group': 9000, 'Beihi_Group': 9000,
                                            'Tuga_Group': 8000, 'Beituga_Group': 8000,
                                            'Momi_Group': 7000, 'Ezomatsu_Group': 7000, 'Todomatsu_Group': 7000, 'Benimatsu_Group': 7000, 
                                            'Sugi_Group': 7000, 'Beisugi_Group': 7000, 'Spruce_Group': 7000,
                                            'Kashi_Group': 10000,
                                            'Kuri_Group': 8000, 'Nara_Group': 8000, 'Buna_Group': 8000, 'Keyaki_Group': 8000
                                        };
                                        if (woodElasticModuli[woodType]) {
                                            input.value = woodElasticModuli[woodType];
                                            input.dispatchEvent(new Event('change'));
                                        }
                                    };
                                    
                                    strengthSelect.removeEventListener('change', updateElasticModulus);
                                    strengthSelect.addEventListener('change', updateElasticModulus);
                                    updateElasticModulus(); // 初期値を設定
                                }
                            }
                        }, 100);
                    }
                });
            }
        }, 10);
        
        return html;
    };
   
    const createStrengthInputHTML = (materialType, idPrefix, currentValue) => {
        const wrapper = document.createElement('div');
        let htmlContent = '';
        const selectId = `${idPrefix}-select`;
        const inputId = `${idPrefix}-input`;

        switch(materialType) {
            case 'steel': {
                const materials = { "235": "SS400, SN400B", "295": "SM490", "325": "SN490B", "355": "SM520" };
                const f_val_str = currentValue || '235';
                let isPreset = materials.hasOwnProperty(f_val_str);
                let options_html = '';
                for (const [value, name] of Object.entries(materials)) { 
                    options_html += `<option value="${value}" ${f_val_str === value ? 'selected' : ''}>${name} (F=${value})</option>`; 
                }
                options_html += `<option value="custom" ${!isPreset ? 'selected' : ''}>任意入力</option>`;
                
                const select = document.createElement('select');
                select.id = selectId;
                select.innerHTML = options_html;
                
                const input = document.createElement('input');
                input.id = inputId;
                input.type = 'number';
                input.value = f_val_str;
                input.readOnly = isPreset;
                
                const div = document.createElement('div');
                div.setAttribute('data-strength-type', 'F-value');
                div.appendChild(select);
                div.appendChild(input);
                
                select.addEventListener('change', function() {
                    input.value = this.value !== 'custom' ? this.value : input.value;
                    input.readOnly = this.value !== 'custom';
                });
                
                return div;
            }
            case 'wood': {
                const wood_val_str = currentValue ? (typeof currentValue === 'object' ? 'custom' : currentValue) : 'Sugi_Group';
                const isCustom = wood_val_str === 'custom';

                const baseStresses = isCustom
                    ? (currentValue.baseStrengths || WOOD_BASE_STRENGTH_DATA['Sugi_Group'])
                    : WOOD_BASE_STRENGTH_DATA[wood_val_str];

                const container = document.createElement('div');
                container.dataset.strengthType = 'wood-type';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.gap = '4px';

                const select = document.createElement('select');
                select.id = `${idPrefix}-preset`;

                for (const [key, value] of Object.entries(WOOD_BASE_STRENGTH_DATA)) {
                    const option = new Option(value.name, key);
                    if (wood_val_str === key) option.selected = true;
                    select.add(option);
                }
                const customOption = new Option('任意入力 (基準強度)', 'custom');
                if (isCustom) customOption.selected = true;
                select.add(customOption);
                
                const inputsContainer = document.createElement('div');
                inputsContainer.style.display = 'grid';
                inputsContainer.style.gridTemplateColumns = 'auto 1fr';
                inputsContainer.style.gap = '2px 5px';
                inputsContainer.style.alignItems = 'center';
                inputsContainer.style.fontSize = '0.9em';

                const inputs = {};
                const stressLabels = {ft: "基準引張強度 Ft", fc: "基準圧縮強度 Fc", fb: "基準曲げ強度 Fb", fs: "基準せん断強度 Fs"};

                for (const key of ['ft', 'fc', 'fb', 'fs']) {
                    const label = document.createElement('label');
                    label.htmlFor = `${idPrefix}-${key}`;
                    label.title = stressLabels[key];
                    label.textContent = `${key} :`;
                    
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.id = `${idPrefix}-${key}`;
                    input.value = baseStresses[key].toFixed(2);
                    input.readOnly = !isCustom;
                    
                    inputs[key] = input;
                    inputsContainer.appendChild(label);
                    inputsContainer.appendChild(input);
                }

                select.onchange = () => {
                    const isCustomSelection = select.value === 'custom';
                    if (isCustomSelection) {
                        Object.values(inputs).forEach(input => { input.readOnly = false; });
                    } else {
                        const selectedBaseStresses = WOOD_BASE_STRENGTH_DATA[select.value];
                        inputs.ft.value = selectedBaseStresses.ft.toFixed(2);
                        inputs.fc.value = selectedBaseStresses.fc.toFixed(2);
                        inputs.fb.value = selectedBaseStresses.fb.toFixed(2);
                        inputs.fs.value = selectedBaseStresses.fs.toFixed(2);
                        Object.values(inputs).forEach(input => { input.readOnly = true; });
                    }
                };

                container.appendChild(select);
                container.appendChild(inputsContainer);
                return container;
            }
            case 'stainless': {
                const stainValue = currentValue || '205';
                const isPreset = ['205', '235'].includes(stainValue);
                htmlContent = `<div data-strength-type="F-stainless"><select id="${selectId}" onchange="const input = document.getElementById('${inputId}'); input.value = this.value; input.readOnly = (this.value !== 'custom');"><option value="205" ${stainValue === '205' ? 'selected' : ''}>SUS304</option><option value="235" ${stainValue === '235' ? 'selected' : ''}>SUS316</option><option value="custom" ${!isPreset ? 'selected' : ''}>任意入力</option></select><input id="${inputId}" type="number" value="${stainValue}" ${isPreset ? 'readonly' : ''}></div>`;
                wrapper.innerHTML = htmlContent;
                return wrapper.firstElementChild;
            }
            case 'aluminum': {
                const alumValue = currentValue || '150';
                const isPreset = ['150', '185'].includes(alumValue);
                htmlContent = `<div data-strength-type="F-aluminum"><select id="${selectId}" onchange="const input = document.getElementById('${inputId}'); input.value = this.value; input.readOnly = (this.value !== 'custom');"><option value="150" ${alumValue === '150' ? 'selected' : ''}>A5052</option><option value="185" ${alumValue === '185' ? 'selected' : ''}>A6061-T6</option><option value="custom" ${!isPreset ? 'selected' : ''}>任意入力</option></select><input id="${inputId}" type="number" value="${alumValue}" ${isPreset ? 'readonly' : ''}></div>`;
                wrapper.innerHTML = htmlContent;
                return wrapper.firstElementChild;
            }
            default: 
                htmlContent = '<div>-</div>';
                wrapper.innerHTML = htmlContent;
                return wrapper.firstElementChild;
        }
    };

    // 密度入力HTML作成関数
    const createDensityInputHTML = (idPrefix, currentDensity = 7850) => {
        const inputId = `${idPrefix}-input`;
        const selectId = `${idPrefix}-select`;
        
        // 材料別の標準密度オプション
        const densityOptions = {
            "7850": "スチール",
            "7900": "ステンレス",
            "2700": "アルミニウム",
            "400": "軟材（杉等）",
            "500": "中硬材（松等）",
            "550": "やや硬材（檜等）",
            "800": "硬材（樫）"
        };
        
        const density_val_str = currentDensity.toString();
        const isPreset = densityOptions.hasOwnProperty(density_val_str);
        
        let options_html = '';
        for (const [value, name] of Object.entries(densityOptions)) {
            options_html += `<option value="${value}" ${density_val_str === value ? 'selected' : ''}>${name} (${value})</option>`;
        }
        options_html += `<option value="custom" ${!isPreset ? 'selected' : ''}>任意入力</option>`;
        
        const html = `<div style="display: flex; flex-direction: column; gap: 2px;">
            <select id="${selectId}">
                ${options_html}
            </select>
            <input id="${inputId}" type="number" value="${currentDensity}" title="密度 ρ (kg/m³)" min="0" ${isPreset ? 'readonly' : ''}>
        </div>`;
        
        // イベントリスナーを後で設定
        setTimeout(() => {
            const select = document.getElementById(selectId);
            const input = document.getElementById(inputId);
            if (select && input) {
                select.addEventListener('change', function() {
                    if (this.value !== 'custom') {
                        input.value = this.value;
                        input.readOnly = true;
                    } else {
                        input.readOnly = false;
                    }
                });
            }
        }, 10);
        
        return html;
    };

    const memberRowHTML = (i, j, E = '205000', F='235', I = 1.84e-5, A = 2.34e-3, Z = 1.23e-3, i_conn = 'rigid', j_conn = 'rigid', sectionName = '', sectionAxis = '') => {
        const baseColumns = [
            `<input type="number" value="${i}">`,
            `<input type="number" value="${j}">`,
            createEInputHTML(`member-e-${i}-${j}`, E),
            createStrengthInputHTML('steel', `member-strength-${i}-${j}`, F),
            `<input type="number" value="${(I * 1e8).toFixed(2)}" title="断面二次モーメント I (cm⁴)">`,
            `<input type="number" value="${(A * 1e4).toFixed(2)}" title="断面積 A (cm²)">`,
            `<input type="number" value="${(Z * 1e6).toFixed(2)}" title="断面係数 Z (cm³)">`
        ];

        // 自重考慮チェックボックスがオンの場合、密度列を追加
        // プリセット読み込み中は密度列の表示状態に関係なく追加しない
        const shouldAddDensity = !window.isLoadingPreset &&
                                elements.considerSelfWeightCheckbox &&
                                elements.considerSelfWeightCheckbox.checked;

        if (shouldAddDensity) {
            const density = MATERIAL_DENSITY_DATA[E] || MATERIAL_DENSITY_DATA['custom'];
            baseColumns.push(createDensityInputHTML(`member-density-${i}-${j}`, density));
        }

        // 断面名称と軸方向の列を追加
        baseColumns.push(`<span class="section-name-cell">${sectionName || '-'}</span>`);
        baseColumns.push(`<span class="section-axis-cell">${sectionAxis || '-'}</span>`);

        // 接続条件列を追加
        baseColumns.push(`<select><option value="rigid" ${i_conn === 'rigid' ? 'selected' : ''}>剛</option><option value="pinned" ${i_conn === 'pinned' || i_conn === 'p' ? 'selected' : ''}>ピン</option></select>`);
        baseColumns.push(`<select><option value="rigid" ${j_conn === 'rigid' ? 'selected' : ''}>剛</option><option value="pinned" ${j_conn === 'pinned' || j_conn === 'p' ? 'selected' : ''}>ピン</option></select>`);

        return baseColumns;
    };
    
const p_truss = {
    ic: 'p',
    jc: 'p',
    E: UNIT_CONVERSION.E_STEEL,
    I: 1e-7, // 表示時に0にならないダミー値
    Z: 1e-6, // 表示時に0にならないダミー値
};

const STRONG_AXIS_INFO = Object.freeze({ key: 'x', mode: 'strong', label: '強軸 (X軸)' });

const PRESET_SECTION_IMAGE_URLS = {
    hkatakou_hoso: 'https://arkhitek.co.jp/wp-content/uploads/2025/09/H形鋼.png',
    hkatakou_hiro: 'https://arkhitek.co.jp/wp-content/uploads/2025/09/H形鋼.png'
};

const cloneDeep = (value) => (value === undefined || value === null) ? value : JSON.parse(JSON.stringify(value));

const approxEqual = (a, b) => {
    if (typeof a !== 'number' || typeof b !== 'number') return false;
    const tolerance = Math.max(1e-9, Math.abs(a) * 1e-4);
    return Math.abs(a - b) <= tolerance;
};

const formatDimensionValue = (value) => {
    if (typeof value !== 'number' || !isFinite(value)) return value;
    return Math.abs(value - Math.round(value)) < 1e-6 ? Math.round(value) : Number(value.toFixed(2));
};

const buildSectionDiagramData = (typeKey, rawDims = {}, options = {}) => {
    const {
        labelScaleMultiplier = 1,
        showDimensions = true  // 寸法線と寸法値の表示/非表示を制御
    } = options || {};

    const numericDims = Object.fromEntries(
        Object.entries(rawDims).map(([key, value]) => {
            const num = Number(value);
            return [key, Number.isFinite(num) ? num : null];
        })
    );

    const sanitize = (value) => (Number.isFinite(value) && value > 0 ? value : null);

    const formatPrimaryDimension = (value) => {
        if (!Number.isFinite(value)) return '';
        return Math.round(value).toString();
    };

    const formatThicknessDimension = (value) => {
        if (!Number.isFinite(value)) return '';
        return (Math.round(value * 10) / 10).toFixed(1);
    };

    const buildLabelLines = (lines) => {
        if (!Array.isArray(lines)) return [];
        return lines
            .map((line) => (line === null || line === undefined ? '' : String(line).trim()))
            .filter((line) => line.length > 0);
    };

    const mmLabel = (symbol, value) => {
        const formatted = formatPrimaryDimension(value);
        if (symbol === 'B') {
            const singleLine = formatted ? `${symbol} = ${formatted} mm` : `${symbol} = ―`;
            return buildLabelLines([singleLine]);
        }
        return buildLabelLines([`${symbol} =`, formatted ? `${formatted} mm` : '―']);
    };

    const thicknessLabel = (symbol, value) => {
        const formatted = formatThicknessDimension(value);
        return buildLabelLines([`${symbol} =`, formatted ? `${formatted} mm` : '―']);
    };

    const phiLabel = (value) => {
        const formatted = formatPrimaryDimension(value);
        return buildLabelLines([formatted ? `φ ${formatted} mm` : 'φ ―']);
    };

    const createHelpers = (maxDim, fontSize) => {
        const baseGap = Math.max(maxDim * 0.12, fontSize * 0.85, 18);
        const smallGap = Math.max(maxDim * 0.08, fontSize * 0.7, 14);
        const lineHeight = fontSize * 1.2;

        const normalizeLabelLines = (label) => {
            if (Array.isArray(label)) {
                const cleaned = label.filter((line) => line !== null && line !== undefined && String(line).trim().length > 0).map(String);
                return cleaned.length > 0 ? cleaned : ['―'];
            }
            if (label && typeof label === 'object' && Array.isArray(label.lines)) {
                const cleaned = label.lines.filter((line) => line !== null && line !== undefined && String(line).trim().length > 0).map(String);
                return cleaned.length > 0 ? cleaned : ['―'];
            }
            if (label === null || label === undefined) return ['―'];
            const value = String(label).trim();
            return value.length > 0 ? [value] : ['―'];
        };

        const buildLabelMarkup = (lines, x) => {
            if (!Array.isArray(lines) || lines.length === 0) return '';
            const totalHeight = lineHeight * Math.max(0, lines.length - 1);
            const firstDy = lines.length === 1 ? 0 : -(totalHeight / 2);

            return lines
                .map((line, index) => {
                    const dyValue = index === 0 ? firstDy : lineHeight;
                    const dyAttr = index === 0 && lines.length === 1 ? '' : ` dy="${dyValue.toFixed(2)}px"`;
                    return `<tspan x="${x}"${dyAttr}>${line}</tspan>`;
                })
                .join('');
        };

        const adjustGapForLines = (gap, lineCount) => {
            if (!Number.isFinite(gap) || lineCount <= 1) return gap;
            const extra = lineHeight * (lineCount - 1) * 0.65;
            return gap + extra;
        };

        const horizontalDim = (x1, x2, y, label, { position = 'below', gap = baseGap, anchor = 'middle', extraClass = '' } = {}) => {
            const textX = anchor === 'start' ? x1 : anchor === 'end' ? x2 : (x1 + x2) / 2;
            const lines = normalizeLabelLines(label);
            const lineCount = lines.length;
            const adjustedGap = adjustGapForLines(gap, lineCount);
            const textY = position === 'below' ? y + adjustedGap : y - adjustedGap;
            const markup = buildLabelMarkup(lines, textX);
            return `
                <g class="dimension horizontal ${extraClass}">
                    <line class="dim-line" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" />
                    <text class="dim-label" x="${textX}" y="${textY}" text-anchor="${anchor}" dominant-baseline="middle">${markup}</text>
                </g>
            `;
        };

        const verticalDim = (x, y1, y2, label, { side = 'left', gap = baseGap, extraClass = '' } = {}) => {
            const textAnchor = side === 'right' ? 'start' : 'end';
            const textY = (y1 + y2) / 2;
            const lines = normalizeLabelLines(label);
            const lineCount = lines.length;
            const adjustedGap = adjustGapForLines(gap, lineCount);
            const finalX = side === 'right' ? x + adjustedGap : x - adjustedGap;
            const markup = buildLabelMarkup(lines, finalX);
            return `
                <g class="dimension vertical ${extraClass}">
                    <line class="dim-line" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" />
                    <text class="dim-label" x="${finalX}" y="${textY}" text-anchor="${textAnchor}" dominant-baseline="middle">${markup}</text>
                </g>
            `;
        };

        return { horizontalDim, verticalDim, baseGap, smallGap };
    };

    const calculateLabelOptions = (maxDim, scale = 1) => {
        const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

        if (!Number.isFinite(maxDim) || maxDim <= 0) {
            const baseFontSize = 28;
            const fontSize = baseFontSize * safeScale;
            return {
                fontSize,
                baseFontSize,
                scale: safeScale,
                labelStrokeWidth: 0.6 * Math.max(1, safeScale)
            };
        }

        const baseFontSize = Math.max(24, Math.min(56, maxDim * 0.18));
        const fontSize = baseFontSize * safeScale;
        const labelStrokeWidth = (fontSize >= 42 ? 0.8 : 0.6) * Math.max(1, safeScale * 0.9);
        return { fontSize, baseFontSize, scale: safeScale, labelStrokeWidth };
    };

    const calculateDiagramMargin = (maxDim, labelOptions = {}) => {
        let options = labelOptions;
        if (typeof labelOptions === 'number') {
            options = { fontSize: labelOptions, baseFontSize: labelOptions, scale: 1 };
        } else if (!labelOptions || typeof labelOptions !== 'object') {
            options = {};
        }

        const { fontSize, baseFontSize, scale = 1 } = options;
        const safeFont = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 32;
        const safeBase = Number.isFinite(baseFontSize) && baseFontSize > 0 ? baseFontSize : safeFont;
        const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
        const scaleFactor = Math.pow(safeScale, 0.65);

        if (!Number.isFinite(maxDim) || maxDim <= 0) {
            const fallbackGap = Math.max(safeBase * 0.9, 24);
            const baseMargin = Math.max(72, safeBase * 3.2, fallbackGap * 2.8);
            return baseMargin / scaleFactor;
        }

        const gapEstimate = Math.max(maxDim * 0.12, safeBase * 0.9, 20);
        const sideGapEstimate = Math.max(maxDim * 0.16, safeBase * 1.1, 24);
        const baseMargin = Math.max(maxDim * 0.52, 60);
        const fontMargin = safeFont * 3.2;
        const rawMargin = Math.max(baseMargin, fontMargin, gapEstimate * 3, sideGapEstimate * 2.4);
        return rawMargin / scaleFactor;
    };

    const wrapSvg = (viewBox, bodyMarkup, dimensionMarkup = '', thicknessMarkup = '', { fontSize = 18, labelStrokeWidth = 0.6 } = {}) => {
        const style = `
            .section-body {
                fill: #3b82f6;
                stroke: #1d4ed8;
                stroke-width: 1.4;
                stroke-linejoin: round;
            }
            .section-body * {
                fill: inherit;
                stroke: inherit;
            }
            .section-body .void {
                fill: #ffffff;
            }
            .dimension .dim-line {
                stroke: #0f172a;
                stroke-width: 1.2;
                fill: none;
                vector-effect: non-scaling-stroke;
            }
            .dimension .dim-label {
                font-family: 'Segoe UI', 'Hiragino Sans', sans-serif;
                font-weight: 600;
                font-size: ${fontSize}px;
                fill: #0f172a;
                stroke: #ffffff;
                stroke-width: ${labelStrokeWidth};
                paint-order: stroke fill;
            }
            .dimension.thickness .dim-line {
                stroke: #1e3a8a;
            }
            .dimension.thickness .dim-label {
                fill: #1e3a8a;
            }
        `;

        const defs = `
            <defs>
                <style>${style}</style>
            </defs>
        `;

        // showDimensionsがfalseの場合は寸法線を非表示
        const finalDimensionMarkup = showDimensions ? dimensionMarkup : '';
        const finalThicknessMarkup = showDimensions ? thicknessMarkup : '';

        return {
            viewBox,
            markup: `${defs}<g class="section-body">${bodyMarkup}</g><g class="dim-layer">${finalDimensionMarkup}</g><g class="dim-layer thickness">${finalThicknessMarkup}</g>`
        };
    };

    const renderHSection = (dims, { includeLip = false } = {}) => {
        const H = sanitize(dims.H);
        const B = sanitize(dims.B);
        const web = sanitize(dims.t1);
        const flange = sanitize(dims.t2);
        const lip = includeLip ? sanitize(dims.C) : null;

        if (!H || !B || !web || !flange) return null;

        const width = B;
        const height = H;
        const maxDim = Math.max(width, height);
        const labelOptions = calculateLabelOptions(maxDim, labelScaleMultiplier);
        const margin = calculateDiagramMargin(maxDim, labelOptions);
        const viewBox = `${-width / 2 - margin} ${-height / 2 - margin} ${width + margin * 2} ${height + margin * 2}`;
        const { horizontalDim, verticalDim, baseGap, smallGap } = createHelpers(maxDim, labelOptions.fontSize);

        const shapes = [
            `<rect x="${-web / 2}" y="${-height / 2}" width="${web}" height="${height}" />`,
            `<rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${flange}" />`,
            `<rect x="${-width / 2}" y="${height / 2 - flange}" width="${width}" height="${flange}" />`
        ];

        if (includeLip && lip && lip > flange / 1.5) {
            const lipHeight = Math.min(lip, height / 2);
            shapes.push(`<rect x="${-width / 2}" y="${-height / 2}" width="${flange}" height="${lipHeight}" />`);
            shapes.push(`<rect x="${width / 2 - flange}" y="${-height / 2}" width="${flange}" height="${lipHeight}" />`);
            shapes.push(`<rect x="${-width / 2}" y="${height / 2 - lipHeight}" width="${flange}" height="${lipHeight}" />`);
            shapes.push(`<rect x="${width / 2 - flange}" y="${height / 2 - lipHeight}" width="${flange}" height="${lipHeight}" />`);
        }

        const dimensions = [
            verticalDim(-width / 2 - margin * 0.55, -height / 2, height / 2, mmLabel('H', H), { side: 'left', gap: baseGap }),
            horizontalDim(-width / 2, width / 2, height / 2 + margin * 0.55, mmLabel('B', B), { position: 'below', gap: baseGap })
        ].join('');

        const thickness = [
            horizontalDim(-web / 2, web / 2, -height / 2 - margin * 0.35, thicknessLabel('t₁', web), { position: 'above', gap: smallGap }),
            verticalDim(width / 2 + margin * 0.45, -height / 2, -height / 2 + flange, thicknessLabel('t₂', flange), { side: 'right', gap: baseGap })
        ];

        if (includeLip && lip) {
            thickness.push(
                verticalDim(width / 2 + margin * 0.7, -height / 2, -height / 2 + lip, thicknessLabel('C', lip), { side: 'right', gap: baseGap * 0.8 })
            );
        }

        return wrapSvg(viewBox, shapes.join(''), dimensions, thickness.join(''), labelOptions);
    };

    const renderChannelSection = (dims) => {
        const H = sanitize(dims.H);
        const flangeWidth = sanitize(dims.B) || sanitize(dims.A);
        const webThickness = sanitize(dims.t1) || sanitize(dims.t);
        const flangeThickness = sanitize(dims.t2) || sanitize(dims.t);
        const lip = sanitize(dims.C);

        if (!H || !flangeWidth || !webThickness || !flangeThickness) return null;

        const width = flangeWidth;
        const height = H;
        const maxDim = Math.max(width, height);
        const labelOptions = calculateLabelOptions(maxDim, labelScaleMultiplier);
        const margin = calculateDiagramMargin(maxDim, labelOptions.fontSize);
        const viewBox = `${-width / 2 - margin} ${-height / 2 - margin} ${width + margin * 2} ${height + margin * 2}`;
        const { horizontalDim, verticalDim, baseGap, smallGap } = createHelpers(maxDim, labelOptions.fontSize);

        const webX = -width / 2;
        const shapes = [
            `<rect x="${webX}" y="${-height / 2}" width="${webThickness}" height="${height}" />`,
            `<rect x="${webX}" y="${-height / 2}" width="${width}" height="${flangeThickness}" />`,
            `<rect x="${webX}" y="${height / 2 - flangeThickness}" width="${width}" height="${flangeThickness}" />`
        ];

        if (lip && lip > flangeThickness) {
            const lipHeight = Math.min(lip, height / 2);
            shapes.push(`<rect x="${width / 2 - flangeThickness}" y="${-height / 2}" width="${flangeThickness}" height="${lipHeight}" />`);
            shapes.push(`<rect x="${width / 2 - flangeThickness}" y="${height / 2 - lipHeight}" width="${flangeThickness}" height="${lipHeight}" />`);
        }

        const dimensions = [
            verticalDim(-width / 2 - margin * 0.55, -height / 2, height / 2, mmLabel('H', H), { side: 'left', gap: baseGap }),
            horizontalDim(-width / 2, width / 2, height / 2 + margin * 0.55, mmLabel('B', flangeWidth), { position: 'below', gap: baseGap })
        ].join('');

        const thickness = [
            horizontalDim(-webThickness / 2, webThickness / 2, -height / 2 - margin * 0.3, thicknessLabel('t₁', webThickness), { position: 'above', gap: smallGap }),
            verticalDim(width / 2 + margin * 0.45, -height / 2, -height / 2 + flangeThickness, thicknessLabel('t₂', flangeThickness), { side: 'right', gap: baseGap })
        ];

        if (lip && lip > flangeThickness) {
            thickness.push(
                verticalDim(width / 2 + margin * 0.7, -height / 2, -height / 2 + lip, thicknessLabel('C', lip), { side: 'right', gap: baseGap * 0.8 })
            );
        }

        return wrapSvg(viewBox, shapes.join(''), dimensions, thickness.join(''), labelOptions);
    };

    // 軽みぞ形鋼とリップ溝形鋼用の専用描画関数（板厚 t のみ表示）
    const renderLightChannelSection = (dims) => {
        const H = sanitize(dims.H);
        const flangeWidth = sanitize(dims.B) || sanitize(dims.A);
        const t = sanitize(dims.t) || sanitize(dims.t1) || sanitize(dims.t2); // 統一された板厚 't' を使用
        const lip = sanitize(dims.C);

        if (!H || !flangeWidth || !t) return null;

        const width = flangeWidth;
        const height = H;
        const maxDim = Math.max(width, height);
        const labelOptions = calculateLabelOptions(maxDim, labelScaleMultiplier);
        const margin = calculateDiagramMargin(maxDim, labelOptions);
        const viewBox = `${-width / 2 - margin} ${-height / 2 - margin} ${width + margin * 2} ${height + margin * 2}`;
        const { horizontalDim, verticalDim, baseGap, smallGap } = createHelpers(maxDim, labelOptions.fontSize);

        const webX = -width / 2;
        const shapes = [
            `<rect x="${webX}" y="${-height / 2}" width="${t}" height="${height}" />`, // webThickness -> t
            `<rect x="${webX}" y="${-height / 2}" width="${width}" height="${t}" />`, // flangeThickness -> t
            `<rect x="${webX}" y="${height / 2 - t}" width="${width}" height="${t}" />`  // flangeThickness -> t
        ];

        if (lip && lip > t) { // flangeThickness -> t
            const lipHeight = Math.min(lip, height / 2);
            shapes.push(`<rect x="${width / 2 - t}" y="${-height / 2}" width="${t}" height="${lipHeight}" />`); // flangeThickness -> t
            shapes.push(`<rect x="${width / 2 - t}" y="${height / 2 - lipHeight}" width="${t}" height="${lipHeight}" />`); // flangeThickness -> t
        }

        const dimensions = [
            verticalDim(-width / 2 - margin * 0.55, -height / 2, height / 2, mmLabel('H', H), { side: 'left', gap: baseGap }),
            horizontalDim(-width / 2, width / 2, height / 2 + margin * 0.55, mmLabel('B', flangeWidth), { position: 'below', gap: baseGap })
        ].join('');

        const thickness = [
            // 統一された板厚 't' のラベルを1つだけ表示
            verticalDim(width / 2 + margin * 0.45, height / 2 - t, height / 2, thicknessLabel('t', t), { side: 'right', gap: baseGap })
        ];

        if (lip && lip > t) {
            thickness.push(
                // C（リップ）の寸法表示は維持
                verticalDim(width / 2 + margin * 0.7, -height / 2, -height / 2 + lip, thicknessLabel('C', lip), { side: 'right', gap: baseGap * 0.8 })
            );
        }

        return wrapSvg(viewBox, shapes.join(''), dimensions, thickness.join(''), labelOptions);
    };

    const renderAngleSection = (dims) => {
        const A = sanitize(dims.A);
        const B = sanitize(dims.B) || A;
        const t = sanitize(dims.t);

        if (!A || !B || !t) return null;

        const width = B;
        const height = A;
        const maxDim = Math.max(width, height);
        const labelOptions = calculateLabelOptions(maxDim, labelScaleMultiplier);
        const margin = calculateDiagramMargin(maxDim, labelOptions);
        const viewBox = `${-width / 2 - margin} ${-height / 2 - margin} ${width + margin * 2} ${height + margin * 2}`;
        const { horizontalDim, verticalDim, baseGap, smallGap } = createHelpers(maxDim, labelOptions.fontSize);

        const leftX = -width / 2;
        const rightX = width / 2;
        const topY = -height / 2;
        const bottomY = height / 2;

        const verticalLeg = `<rect x="${leftX}" y="${topY}" width="${t}" height="${height}" />`;
        const horizontalLeg = `<rect x="${leftX}" y="${bottomY - t}" width="${width}" height="${t}" />`;
        const body = `<g>${verticalLeg}${horizontalLeg}</g>`;

        const dimensions = [
            verticalDim(leftX - margin * 0.45, topY, bottomY, mmLabel('A', A), { side: 'left', gap: baseGap }),
            horizontalDim(leftX, rightX, bottomY + margin * 0.55, mmLabel('B', B), { position: 'below', gap: baseGap })
        ].join('');

        const thickness = [
            horizontalDim(leftX, leftX + t, topY - margin * 0.3, thicknessLabel('t', t), { position: 'above', gap: smallGap, anchor: 'start' })
        ];

        return wrapSvg(viewBox, body, dimensions, thickness.join(''), labelOptions);
    };

    const renderRectTube = (dims) => {
        const outerH = sanitize(dims.A) || sanitize(dims.H);
        const outerB = sanitize(dims.B) || sanitize(dims.A);
        const t = sanitize(dims.t);

        if (!outerH || !outerB || !t) return null;

        const width = outerB;
        const height = outerH;
        const maxDim = Math.max(width, height);
        const labelOptions = calculateLabelOptions(maxDim, labelScaleMultiplier);
        const margin = calculateDiagramMargin(maxDim, labelOptions);
        const viewBox = `${-width / 2 - margin} ${-height / 2 - margin} ${width + margin * 2} ${height + margin * 2}`;
        const { horizontalDim, verticalDim, baseGap, smallGap } = createHelpers(maxDim, labelOptions.fontSize);

        const outerRect = `<rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" />`;
        const innerRect = `<rect class="void" x="${-width / 2 + t}" y="${-height / 2 + t}" width="${width - 2 * t}" height="${height - 2 * t}" />`;
        const body = `<g>${outerRect}${innerRect}</g>`;

        const dimensions = [
            verticalDim(-width / 2 - margin * 0.45, -height / 2, height / 2, mmLabel('H', outerH), { side: 'left', gap: baseGap }),
            horizontalDim(-width / 2, width / 2, height / 2 + margin * 0.5, mmLabel('B', outerB), { position: 'below', gap: baseGap })
        ].join('');

        const thickness = [
            verticalDim(width / 2 + margin * 0.45, -height / 2, -height / 2 + t, thicknessLabel('t', t), { side: 'right', gap: smallGap })
        ].join('');

        return wrapSvg(viewBox, body, dimensions, thickness, labelOptions);
    };

    const renderPipe = (dims) => {
        const D = sanitize(dims.D);
        const t = sanitize(dims.t);

        if (!D) return null;

        const width = D;
        const height = D;
        const maxDim = D;
        const labelOptions = calculateLabelOptions(maxDim, labelScaleMultiplier);
        const margin = calculateDiagramMargin(maxDim, labelOptions);
        const viewBox = `${-width / 2 - margin} ${-height / 2 - margin} ${width + margin * 2} ${height + margin * 2}`;
        const { horizontalDim, verticalDim, baseGap, smallGap } = createHelpers(maxDim, labelOptions.fontSize);

        const outerCircle = `<circle cx="0" cy="0" r="${D / 2}" />`;
        const innerCircle = t && t < D / 2 ? `<circle class="void" cx="0" cy="0" r="${D / 2 - t}" />` : '';
        const body = `<g>${outerCircle}${innerCircle}</g>`;

        const dimensions = horizontalDim(-D / 2, D / 2, D / 2 + margin * 0.55, phiLabel(D), { position: 'below', gap: baseGap });

        const thickness = t
            ? verticalDim(D / 2 + margin * 0.45, -D / 2, -D / 2 + t, thicknessLabel('t', t), { side: 'right', gap: smallGap })
            : '';

        return wrapSvg(viewBox, body, dimensions, thickness, labelOptions);
    };

    const renderSolidRect = (dims) => {
        const H = sanitize(dims.H);
        const B = sanitize(dims.B);

        if (!H || !B) return null;

        const width = B;
        const height = H;
        const maxDim = Math.max(width, height);
        const labelOptions = calculateLabelOptions(maxDim, labelScaleMultiplier);
        const margin = calculateDiagramMargin(maxDim, labelOptions);
        const viewBox = `${-width / 2 - margin} ${-height / 2 - margin} ${width + margin * 2} ${height + margin * 2}`;
        const { horizontalDim, verticalDim, baseGap } = createHelpers(maxDim, labelOptions.fontSize);

        const body = `<rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" />`;

        const dimensions = [
            verticalDim(-width / 2 - margin * 0.5, -height / 2, height / 2, mmLabel('H', H), { side: 'left', gap: baseGap }),
            horizontalDim(-width / 2, width / 2, height / 2 + margin * 0.5, mmLabel('B', B), { position: 'below', gap: baseGap })
        ].join('');

        return wrapSvg(viewBox, body, dimensions, '', labelOptions);
    };

    const renderSolidCircle = (dims) => {
        const D = sanitize(dims.D);

        if (!D) return null;

        const width = D;
        const maxDim = D;
    const labelOptions = calculateLabelOptions(maxDim, labelScaleMultiplier);
    const margin = calculateDiagramMargin(maxDim, labelOptions);
        const viewBox = `${-width / 2 - margin} ${-width / 2 - margin} ${width + margin * 2} ${width + margin * 2}`;
        const { horizontalDim, baseGap } = createHelpers(maxDim, labelOptions.fontSize);

        const body = `<circle cx="0" cy="0" r="${D / 2}" />`;
        const dimensions = horizontalDim(-D / 2, D / 2, D / 2 + margin * 0.5, phiLabel(D), { position: 'below', gap: baseGap });

        return wrapSvg(viewBox, body, dimensions, '', labelOptions);
    };

    const sectionBuilders = {
        hkatakou_hiro: (dims) => renderHSection(dims),
        hkatakou_naka: (dims) => renderHSection(dims),
        hkatakou_hoso: (dims) => renderHSection(dims),
        ikatakou: (dims) => renderHSection(dims),
        keiryouhkatakou: (dims) => renderHSection(dims),
        keiryourippuhkatakou: (dims) => renderHSection(dims, { includeLip: true }),
        mizogatakou: (dims) => renderChannelSection(dims), // みぞ形鋼は既存の関数を継続使用
        keimizogatakou: (dims) => renderLightChannelSection(dims), // 軽みぞ形鋼は専用関数使用
        rippumizokatakou: (dims) => renderLightChannelSection(dims), // リップ溝形鋼は専用関数使用
        touhenyamakatakou: (dims) => renderAngleSection(dims),
        futouhenyamagata: (dims) => renderAngleSection(dims),
        seihoukei: (dims) => renderRectTube({ ...dims, A: sanitize(dims.A), B: sanitize(dims.A), t: sanitize(dims.t) }),
        tyouhoukei: (dims) => renderRectTube(dims),
        koukan: (dims) => renderPipe(dims),
        '矩形': (dims) => renderSolidRect(dims),
        '円形': (dims) => renderSolidCircle(dims)
    };

    const builder = sectionBuilders[typeKey];
    const result = builder ? builder(numericDims) : null;

    if (result) {
        return result;
    }

    const fallbackViewBox = '-120 -80 240 160';
    const fallbackMarkup = `<g class="section-body"><rect x="-40" y="-40" width="80" height="80" /></g>`;
    return {
        viewBox: fallbackViewBox,
        markup: `
            <defs>
                <style>
                    .section-body * { fill: #94a3b8; stroke: #475569; stroke-width: 1.2; }
                </style>
            </defs>
            ${fallbackMarkup}
        `
    };
};

const generateSectionSvgMarkup = (typeKey, dims) => {
    if (!typeKey || !dims) return '';
    const diagram = buildSectionDiagramData(typeKey, dims, { labelScaleMultiplier: 0.5, showDimensions: false });
    if (!diagram || !diagram.markup) return '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${diagram.viewBox}" width="240" height="180" role="img" aria-label="断面図">${diagram.markup}</svg>`;
};

const deriveSectionTypeKey = (sectionInfo) => {
    if (!sectionInfo || typeof sectionInfo !== 'object') return null;
    const candidates = [
        sectionInfo.typeKey,
        sectionInfo.sectionType,
        sectionInfo.type,
        sectionInfo.profileKey,
        sectionInfo.profileType,
        sectionInfo.categoryKey
    ];
    return candidates.find(value => typeof value === 'string' && value.trim().length > 0) || null;
};

const parseDimensionValue = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const numeric = Number.parseFloat(String(value).replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(numeric) ? numeric : null;
};

const deriveSectionDimensions = (sectionInfo) => {
    if (!sectionInfo || typeof sectionInfo !== 'object') return null;

    const sourceCandidates = [sectionInfo.rawDims, sectionInfo.dims, sectionInfo.dimensionsMap];
    for (const candidate of sourceCandidates) {
        if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
            return Object.fromEntries(
                Object.entries(candidate)
                    .map(([key, value]) => [key, parseDimensionValue(value)])
                    .filter(([, value]) => Number.isFinite(value) && value > 0)
            );
        }
    }

    if (Array.isArray(sectionInfo.dimensions)) {
        const fromArray = Object.fromEntries(
            sectionInfo.dimensions
                .map((dim) => {
                    if (!dim || typeof dim !== 'object') return null;
                    const key = dim.key || dim.name || dim.label;
                    const value = parseDimensionValue(dim.value);
                    if (!key || !Number.isFinite(value) || value <= 0) return null;
                    return [key, value];
                })
                .filter(Boolean)
        );
        if (Object.keys(fromArray).length > 0) return fromArray;
    }

    return null;
};

const ensureSectionSvgMarkup = (sectionInfo) => {
    if (!sectionInfo || typeof sectionInfo !== 'object') return sectionInfo;
    if (sectionInfo.svgMarkup && sectionInfo.svgMarkup.includes('<svg')) return sectionInfo;

    const typeKey = deriveSectionTypeKey(sectionInfo);
    const dims = deriveSectionDimensions(sectionInfo);

    if (!typeKey || !dims) return sectionInfo;

    const diagram = buildSectionDiagramData(typeKey, dims, { labelScaleMultiplier: 0.5, showDimensions: false });
    if (diagram && diagram.markup) {
        sectionInfo.svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${diagram.viewBox}" width="240" height="180" role="img" aria-label="断面図">${diagram.markup}</svg>`;
        if (!sectionInfo.rawDims) {
            sectionInfo.rawDims = { ...dims };
        }
    }

    return sectionInfo;
};

const buildPresetSectionInfo = ({ typeKey, typeLabel, designation, dims }) => {
    const axis = { ...STRONG_AXIS_INFO };
    const dimensionEntries = [
        { key: 'H', label: 'H', value: formatDimensionValue(dims.H) },
        { key: 'B', label: 'B', value: formatDimensionValue(dims.B) },
        { key: 't1', label: 't₁', value: formatDimensionValue(dims.t1) },
        { key: 't2', label: 't₂', value: formatDimensionValue(dims.t2) }
    ];

    if (dims.r !== undefined) {
        dimensionEntries.push({ key: 'r', label: 'r', value: formatDimensionValue(dims.r) });
    }

    const dimensionSummary = dimensionEntries.map(d => `${d.label}=${d.value}`).join(', ');

    // 板厚まで含んだ詳細な名称を生成
    let detailedLabel = typeLabel;
    if (designation) {
        // 基本寸法（高さ×幅）に加えて板厚情報を追加
        if (dims.t1 !== undefined && dims.t2 !== undefined) {
            detailedLabel = `${typeLabel} ${designation}×${dims.t1}×${dims.t2}`;
        } else if (dims.t !== undefined) {
            detailedLabel = `${typeLabel} ${designation}×${dims.t}`;
        } else {
            detailedLabel = `${typeLabel} ${designation}`;
        }
    }

    const sectionInfo = {
        typeKey,
        typeLabel,
        designation,
        label: detailedLabel.trim(),
        dimensions: dimensionEntries,
        dimensionSummary,
    svgMarkup: generateSectionSvgMarkup(typeKey, dims),
        imageUrl: PRESET_SECTION_IMAGE_URLS[typeKey] || '',
        rawDims: { ...dims },
        source: 'library',
        axis
    };

    return ensureSectionSvgMarkup(sectionInfo);
};

const PRESET_SECTION_PROFILES = [
    {
        target: { I: 7.21e-5, A: 4.678e-3, Z: 4.81e-4 },
        sectionInfo: buildPresetSectionInfo({
            typeKey: 'hkatakou_hoso',
            typeLabel: 'H形鋼（細幅）',
            designation: '300×150',
            dims: { H: 300, B: 150, t1: 6.5, t2: 9, r: 13 }
        }),
        properties: { Zx: 481, Zy: 67.7, ix: 12.4, iy: 3.29 }
    },
    {
        target: { I: 1.10e-4, A: 5.245e-3, Z: 6.38e-4 },
        sectionInfo: buildPresetSectionInfo({
            typeKey: 'hkatakou_hoso',
            typeLabel: 'H形鋼（細幅）',
            designation: '346×174',
            dims: { H: 346, B: 174, t1: 6, t2: 9, r: 13 }
        }),
        properties: { Zx: 638, Zy: 91, ix: 14.5, iy: 3.88 }
    },
    {
        target: { I: 1.81e-5, A: 2.667e-3, Z: 1.81e-4 },
        sectionInfo: buildPresetSectionInfo({
            typeKey: 'hkatakou_hoso',
            typeLabel: 'H形鋼（細幅）',
            designation: '200×100',
            dims: { H: 200, B: 100, t1: 5.5, t2: 8, r: 8 }
        }),
        properties: { Zx: 181, Zy: 26.7, ix: 8.23, iy: 2.24 }
    },
    {
        target: { I: 3.96e-5, A: 3.697e-3, Z: 3.17e-4 },
        sectionInfo: buildPresetSectionInfo({
            typeKey: 'hkatakou_hoso',
            typeLabel: 'H形鋼（細幅）',
            designation: '250×125',
            dims: { H: 250, B: 125, t1: 6, t2: 9, r: 8 }
        }),
        properties: { Zx: 317, Zy: 47, ix: 10.4, iy: 2.82 }
    },
    {
        target: { I: 1.35e-4, A: 6.291e-3, Z: 7.71e-4 },
        sectionInfo: buildPresetSectionInfo({
            typeKey: 'hkatakou_hoso',
            typeLabel: 'H形鋼（細幅）',
            designation: '350×175',
            dims: { H: 350, B: 175, t1: 7, t2: 11, r: 13 }
        }),
        properties: { Zx: 771, Zy: 112, ix: 14.6, iy: 3.96 }
    },
    {
        target: { I: 2.35e-4, A: 8.337e-3, Z: 1.17e-3 },
        sectionInfo: buildPresetSectionInfo({
            typeKey: 'hkatakou_hoso',
            typeLabel: 'H形鋼（細幅）',
            designation: '400×200',
            dims: { H: 400, B: 200, t1: 8, t2: 13, r: 13 }
        }),
        properties: { Zx: 1170, Zy: 174, ix: 16.8, iy: 4.56 }
    },
    {
        target: { I: 3.98e-4, A: 1.719e-2, Z: 2.28e-3 },
        sectionInfo: buildPresetSectionInfo({
            typeKey: 'hkatakou_hiro',
            typeLabel: 'H形鋼（広幅）',
            designation: '350×350',
            dims: { H: 350, B: 350, t1: 12, t2: 19, r: 13 }
        }),
        properties: { Zx: 2280, Zy: 776, ix: 15.2, iy: 8.89 }
    },
    {
        target: { I: 5.61e-4, A: 1.868e-2, Z: 2.85e-3 },
        sectionInfo: buildPresetSectionInfo({
            typeKey: 'hkatakou_hiro',
            typeLabel: 'H形鋼（広幅）',
            designation: '394×398',
            dims: { H: 394, B: 398, t1: 11, t2: 18, r: 22 }
        }),
        properties: { Zx: 2850, Zy: 951, ix: 17.3, iy: 10.1 }
    },
    {
        target: { I: 6.66e-4, A: 2.187e-2, Z: 3.33e-3 },
        sectionInfo: buildPresetSectionInfo({
            typeKey: 'hkatakou_hiro',
            typeLabel: 'H形鋼（広幅）',
            designation: '400×400',
            dims: { H: 400, B: 400, t1: 13, t2: 21, r: 22 }
        }),
        properties: { Zx: 3330, Zy: 1120, ix: 17.5, iy: 10.1 }
    }
];

const findPresetSectionProfile = (member) => {
    if (!member || typeof member !== 'object') return null;
    return PRESET_SECTION_PROFILES.find(({ target }) =>
        approxEqual(member.I, target.I) &&
        approxEqual(member.A, target.A) &&
        approxEqual(member.Z, target.Z)
    ) || null;
};

const parseSectionInfoFromMember = (member) => {
    if (!member || typeof member !== 'object') return null;

    if (member.sectionInfo && typeof member.sectionInfo === 'object' && !Array.isArray(member.sectionInfo)) {
        const info = cloneDeep(member.sectionInfo);
        return ensureSectionSvgMarkup(info);
    }

    const resolveCandidate = (raw) => {
        if (typeof raw !== 'string') return null;
        const trimmed = raw.trim();
        if (!trimmed) return null;
        let decoded = trimmed;
        try {
            decoded = decodeURIComponent(trimmed);
        } catch (error) {
            // デコードに失敗した場合は元の文字列を使用
        }
        try {
            const parsed = JSON.parse(decoded);
            return parsed && typeof parsed === 'object' ? ensureSectionSvgMarkup(parsed) : null;
        } catch (error) {
            console.warn('Failed to parse sectionInfo from preset member definition:', error, member);
            return null;
        }
    };

    return resolveCandidate(member.sectionInfo) || resolveCandidate(member.sectionInfoEncoded) || null;
};

const safeDecodeString = (value) => {
    if (typeof value !== 'string') return value;
    if (value.length === 0) return '';
    try {
        return decodeURIComponent(value);
    } catch (error) {
        return value;
    }
};

const buildAxisInfo = (member, existingSectionInfo) => {
    if (!member || typeof member !== 'object') return null;

    const axisFromSection = existingSectionInfo && typeof existingSectionInfo === 'object'
        ? existingSectionInfo.axis
        : null;

    const rawKey = member.sectionAxisKey || axisFromSection?.key;
    const rawMode = member.sectionAxisMode || axisFromSection?.mode;
    const rawLabelValue = typeof member.sectionAxisLabel === 'string'
        ? safeDecodeString(member.sectionAxisLabel)
        : axisFromSection?.label;

    if (!(rawKey || rawMode || rawLabelValue)) return null;

    return normalizeAxisInfo({
        key: rawKey,
        mode: rawMode,
        label: rawLabelValue
    });
};

const presets = [
    { name: '--- 1. 基本モデル (Basic Models) ---', disabled: true },
    // 1A-1: 単純梁(中央集中荷重) / Zreq≈425cm³ -> H-300x150x6.5x9 (Zx=481cm³) を選択
    { name: '1A-1: 単純梁 (中央集中荷重)', data: { nodes: [{x:0,y:0,s:'p'},{x:8,y:0,s:'r'},{x:4,y:0,s:'f'}], members: [{i:1,j:3, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:3,j:2, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4}], nl: [{n:3, py:-50}], ml: []} },
    // 1A-2: 単純梁(等分布荷重) / Zreq≈531cm³ -> H-346x174x6x9 (Zx=638cm³) を選択
    { name: '1A-2: 単純梁 (等分布荷重)', data: { nodes: [{x:0,y:0,s:'p'},{x:10,y:0,s:'r'}], members: [{i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4}], nl: [], ml: [{m:1,w:10}]} },
    // 1A-3: 片持ち梁(先端集中荷重) / Zreq≈510cm³ -> H-346x174x6x9 (Zx=638cm³) を選択
    { name: '1A-3: 片持ち梁 (先端集中荷重)', data: { nodes: [{x:0,y:0,s:'x'},{x:6,y:0,s:'f'}], members: [{i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4}], nl: [{n:2,py:-20}], ml: []} },
    // 1A-4: 片持ち梁(等分布荷重) / Zreq≈425cm³ -> H-300x150x6.5x9 (Zx=481cm³) を選択
    { name: '1A-4: 片持ち梁 (等分布荷重)', data: { nodes: [{x:0,y:0,s:'x'},{x:5,y:0,s:'f'}], members: [{i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4}], nl: [], ml: [{m:1,w:8}]} },
    // 1A-5: 両端固定梁(等分布荷重) / Zreq≈510cm³ -> H-346x174x6x9 (Zx=638cm³) を選択
    { name: '1A-5: 両端固定梁 (等分布荷重)', data: { nodes: [{x:0,y:0,s:'x'},{x:12,y:0,s:'x'}], members: [{i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4}], nl:[], ml:[{m:1,w:10}]} },
    // 1A-6: 持ち出し梁 / Zreq≈191cm³ -> H-200x100x5.5x8 (Zx=181cm³) を選択
    { name: '1A-6: 持ち出し梁', data: { nodes: [{x:0,y:0,s:'p'},{x:6,y:0,s:'r'},{x:9,y:0,s:'f'}], members: [{i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:2,j:3, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4}], nl: [{n:3,py:-15}], ml: []} },
    // 1A-7: 2径間連続梁 / Zreq≈340cm³ -> H-300x150x6.5x9 (Zx=481cm³) を選択
    { name: '1A-7: 2径間連続梁', data: { nodes: [{x:0,y:0,s:'p'},{x:8,y:0,s:'r'},{x:16,y:0,s:'r'}], members:[{i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:2,j:3, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4}], nl:[], ml:[{m:1,w:10},{m:2,w:10}]} },
    // 1A-8: L形ラーメン / Zreq≈255cm³ -> H-250x125x6x9 (Zx=317cm³) を選択
    { name: '1A-8: L形ラーメン (複合荷重)', data: { nodes: [{x:0,y:0,s:'x'},{x:0,y:4,s:'f'},{x:6,y:4,s:'f'}], members:[{i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:2,j:3, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4}], nl:[{n:3, py:-20},{n:2, px:15}], ml:[] } },
    // 1A-9: 門形ラーメン / Zreq≈255cm³ -> H-250x125x6x9 (Zx=317cm³) を選択
    { name: '1A-9: 門形ラーメン (水平荷重)', data: { nodes: [{x:0, y:0, s:'x'},{x:0, y:4, s:'f'},{x:6, y:4, s:'f'},{x:6, y:0, s:'x'}], members: [{i:1, j:2, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:2, j:3, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:3, j:4, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4}], nl: [{n:2, px:30}], ml: [] } },
    { name: '--- 2. 建築・トラス構造 (Buildings & Trusses) ---', disabled: true },
    // 2A-1: 2層ラーメン / 梁:H-200x100 (Zx=181), 柱:H-250x125 (Zx=317) を選択
    { name: '2A-1: 2層ラーメン', data: { nodes: [{x:0,y:0,s:'x'},{x:6,y:0,s:'x'},{x:12,y:0,s:'x'},{x:0,y:3.5,s:'f'},{x:6,y:3.5,s:'f'},{x:12,y:3.5,s:'f'},{x:0,y:7,s:'f'},{x:6,y:7,s:'f'},{x:12,y:7,s:'f'}], members: [
        {i:1,j:4, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:2,j:5, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:3,j:6, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:4,j:7, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:5,j:8, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:6,j:9, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},
        {i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:8,j:9, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4}
    ], nl:[], ml:[{m:7,w:15},{m:8,w:15},{m:9,w:10},{m:10,w:10}]} },
    // 2A-2, 2A-3, 2A-4, 2A-5, 2B-1, 2B-2 ... 4C-4 全てに同様の調整を実施
    { name: '2A-2: 3層ラーメン', data: { nodes: [{x:0,y:0,s:'x'},{x:6,y:0,s:'x'},{x:12,y:0,s:'x'},{x:18,y:0,s:'x'},{x:0,y:3.5,s:'f'},{x:6,y:3.5,s:'f'},{x:12,y:3.5,s:'f'},{x:18,y:3.5,s:'f'},{x:0,y:7,s:'f'},{x:6,y:7,s:'f'},{x:12,y:7,s:'f'},{x:18,y:7,s:'f'},{x:0,y:10.5,s:'f'},{x:6,y:10.5,s:'f'},{x:12,y:10.5,s:'f'},{x:18,y:10.5,s:'f'}], members: [
        {i:1,j:5, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:2,j:6, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:3,j:7, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:4,j:8, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:5,j:9, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:6,j:10, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:7,j:11, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:8,j:12, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:9,j:13, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:10,j:14, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:11,j:15, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:12,j:16, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:6,j:7, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:9,j:10, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:10,j:11, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:11,j:12, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:13,j:14, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:14,j:15, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:15,j:16, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4}
    ], nl:[], ml:[{m:13,w:15},{m:14,w:15},{m:15,w:15},{m:16,w:12},{m:17,w:12},{m:18,w:12},{m:19,w:10},{m:20,w:10},{m:21,w:10}]} },
    { name: '2A-3: 5層ラーメン', data: { nodes: [{x:0,y:0,s:'x'},{x:7,y:0,s:'x'},{x:14,y:0,s:'x'},{x:0,y:3.5,s:'f'},{x:7,y:3.5,s:'f'},{x:14,y:3.5,s:'f'},{x:0,y:7,s:'f'},{x:7,y:7,s:'f'},{x:14,y:7,s:'f'},{x:0,y:10.5,s:'f'},{x:7,y:10.5,s:'f'},{x:14,y:10.5,s:'f'},{x:0,y:14,s:'f'},{x:7,y:14,s:'f'},{x:14,y:14,s:'f'},{x:0,y:17.5,s:'f'},{x:7,y:17.5,s:'f'},{x:14,y:17.5,s:'f'}], members: [
        {i:1,j:4, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:2,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:3,j:6, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},
        {i:4,j:7, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:5,j:8, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:6,j:9, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},
        {i:7,j:10, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:8,j:11, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:9,j:12, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:10,j:13, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:11,j:14, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:12,j:15, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:13,j:16, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:14,j:17, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:15,j:18, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:8,j:9, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:10,j:11, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:11,j:12, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:13,j:14, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:14,j:15, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},
        {i:16,j:17, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:17,j:18, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4}
    ], nl:[], ml:[{m:16,w:18},{m:17,w:18},{m:18,w:15},{m:19,w:15},{m:20,w:15},{m:21,w:15},{m:22,w:12},{m:23,w:12},{m:24,w:10},{m:25,w:10}]} },
    { name: '2A-4: ブレース付3層ラーメン', data: { nodes: [{x:0,y:0,s:'x'},{x:6,y:0,s:'x'},{x:12,y:0,s:'x'},{x:0,y:3.5,s:'f'},{x:6,y:3.5,s:'f'},{x:12,y:3.5,s:'f'},{x:0,y:7,s:'f'},{x:6,y:7,s:'f'},{x:12,y:7,s:'f'},{x:0,y:10.5,s:'f'},{x:6,y:10.5,s:'f'},{x:12,y:10.5,s:'f'}], members: [
        {i:1,j:4, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:2,j:5, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:3,j:6, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:4,j:7, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:5,j:8, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:6,j:9, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:7,j:10, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:8,j:11, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:9,j:12, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},
        {i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},
        {i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:8,j:9, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},
        {i:10,j:11, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:11,j:12, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},
        {i:1,j:5, ...p_truss, A:1.269e-3},{i:2,j:4, ...p_truss, A:1.269e-3},{i:2,j:6, ...p_truss, A:1.269e-3},{i:3,j:5, ...p_truss, A:1.269e-3},
        {i:4,j:8, ...p_truss, A:1.269e-3},{i:5,j:7, ...p_truss, A:1.269e-3},{i:5,j:9, ...p_truss, A:1.269e-3},{i:6,j:8, ...p_truss, A:1.269e-3}
    ], nl:[{n:4,px:15},{n:5,px:15},{n:6,px:15},{n:7,px:12},{n:8,px:12},{n:9,px:12},{n:10,px:8},{n:11,px:8},{n:12,px:8}], ml:[{m:10,w:15},{m:11,w:15},{m:12,w:12},{m:13,w:12},{m:14,w:10},{m:15,w:10}]} },
    { name: '2A-5: 地震力の作用する3層ラーメン', data: { nodes: [{x:0,y:0,s:'x'},{x:8,y:0,s:'x'},{x:16,y:0,s:'x'},{x:0,y:4,s:'f'},{x:8,y:4,s:'f'},{x:16,y:4,s:'f'},{x:0,y:8,s:'f'},{x:8,y:8,s:'f'},{x:16,y:8,s:'f'},{x:0,y:12,s:'f'},{x:8,y:12,s:'f'},{x:16,y:12,s:'f'}], members: [
        {i:1,j:4, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:2,j:5, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:3,j:6, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:4,j:7, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:5,j:8, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:6,j:9, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:7,j:10, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:8,j:11, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:9,j:12, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:8,j:9, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:10,j:11, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:11,j:12, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4}
    ], nl:[{n:4,px:25},{n:5,px:25},{n:6,px:25},{n:7,px:20},{n:8,px:20},{n:9,px:20},{n:10,px:15},{n:11,px:15},{n:12,px:15}], ml:[{m:10,w:20},{m:11,w:20},{m:12,w:15},{m:13,w:15},{m:14,w:12},{m:15,w:12}]} },
    { name: '2B-1: 建築ラーメン (2層2スパン)', data: { nodes: [{x:0,y:0,s:'x'},{x:6,y:0,s:'x'},{x:12,y:0,s:'x'},{x:0,y:4,s:'f'},{x:6,y:4,s:'f'},{x:12,y:4,s:'f'},{x:0,y:8,s:'f'},{x:6,y:8,s:'f'},{x:12,y:8,s:'f'}], members:[
        {i:1,j:4, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:2,j:5, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:3,j:6, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:4,j:7, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:5,j:8, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:6,j:9, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:8,j:9, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4}
    ], nl:[{n:4,py:-15},{n:5,py:-15},{n:6,py:-15},{n:7,py:-15},{n:8,py:-15},{n:9,py:-15}], ml:[] } },
    { name: '2B-2: 建築ラーメン (2層2スパン・ブレース付き)', data: { nodes: [{x:0,y:0,s:'x'},{x:6,y:0,s:'x'},{x:12,y:0,s:'x'},{x:0,y:4,s:'f'},{x:6,y:4,s:'f'},{x:12,y:4,s:'f'},{x:0,y:8,s:'f'},{x:6,y:8,s:'f'},{x:12,y:8,s:'f'}], members:[
        {i:1,j:4, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:2,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:3,j:6, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},
        {i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},
        {i:4,j:7, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:5,j:8, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:6,j:9, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},
        {i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:8,j:9, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},
        {i:1,j:5, ...p_truss, A:1.269e-3},{i:5,j:9, ...p_truss, A:1.269e-3}
    ], nl:[{n:4,py:-15},{n:5,py:-15},{n:6,py:-15},{n:7,py:-15},{n:8,py:-15},{n:9,py:-15}], ml:[] } },
    { name: '2C-1: トラス屋根', data: { nodes: [{x:0,y:0,s:'p'},{x:6,y:0,s:'r'},{x:12,y:0,s:'r'},{x:3,y:2,s:'f'},{x:9,y:2,s:'f'},{x:6,y:4,s:'f'}], members:[
        {i:1,j:4, ...p_truss, A:1.269e-3},{i:4,j:6, ...p_truss, A:1.269e-3},{i:6,j:5, ...p_truss, A:1.269e-3},{i:5,j:3, ...p_truss, A:1.269e-3},
        {i:1,j:2, ...p_truss, A:1.269e-3},{i:2,j:3, ...p_truss, A:1.269e-3},{i:4,j:2, ...p_truss, A:1.269e-3},{i:2,j:5, ...p_truss, A:1.269e-3}
    ], nl:[{n:4,py:-10},{n:5,py:-10},{n:6,py:-10}], ml:[] } },
    { name: '2C-2: 平行弦トラス', data: { nodes: [{x:0,y:0,s:'p'},{x:4,y:0,s:'f'},{x:8,y:0,s:'f'},{x:12,y:0,s:'r'},{x:0,y:2,s:'f'},{x:4,y:2,s:'f'},{x:8,y:2,s:'f'},{x:12,y:2,s:'f'}], members:[
        {i:1,j:2, ...p_truss, A:1.7e-3},{i:2,j:3, ...p_truss, A:1.7e-3},{i:3,j:4, ...p_truss, A:1.7e-3},{i:5,j:6, ...p_truss, A:1.7e-3},{i:6,j:7, ...p_truss, A:1.7e-3},
        {i:7,j:8, ...p_truss, A:1.7e-3},{i:1,j:5, ...p_truss, A:1.7e-3},{i:2,j:6, ...p_truss, A:1.7e-3},{i:3,j:7, ...p_truss, A:1.7e-3},{i:4,j:8, ...p_truss, A:1.7e-3},
        {i:1,j:6, ...p_truss, A:1.7e-3},{i:2,j:7, ...p_truss, A:1.7e-3},{i:3,j:8, ...p_truss, A:1.7e-3}
    ], nl:[{n:5,py:-10},{n:6,py:-10},{n:7,py:-10},{n:8,py:-10}], ml:[] } },
    { name: '2C-3: プラット・トラス', data: { nodes: [{x:0,y:0,s:'p'},{x:3,y:0,s:'f'},{x:6,y:0,s:'f'},{x:9,y:0,s:'f'},{x:12,y:0,s:'r'},{x:0,y:2,s:'f'},{x:3,y:2,s:'f'},{x:6,y:2,s:'f'},{x:9,y:2,s:'f'},{x:12,y:2,s:'f'}], members:[
        {i:1,j:2, ...p_truss, A:1.7e-3},{i:2,j:3, ...p_truss, A:1.7e-3},{i:3,j:4, ...p_truss, A:1.7e-3},{i:4,j:5, ...p_truss, A:1.7e-3},
        {i:6,j:7, ...p_truss, A:1.7e-3},{i:7,j:8, ...p_truss, A:1.7e-3},{i:8,j:9, ...p_truss, A:1.7e-3},{i:9,j:10, ...p_truss, A:1.7e-3},
        {i:1,j:6, ...p_truss, A:1.269e-3},{i:2,j:7, ...p_truss, A:1.269e-3},{i:3,j:8, ...p_truss, A:1.269e-3},{i:4,j:9, ...p_truss, A:1.269e-3},{i:5,j:10, ...p_truss, A:1.269e-3},
        {i:1,j:7, ...p_truss, A:1.269e-3},{i:2,j:8, ...p_truss, A:1.269e-3},{i:3,j:9, ...p_truss, A:1.269e-3},{i:4,j:10, ...p_truss, A:1.269e-3}
    ], nl:[{n:6,py:-10},{n:7,py:-10},{n:8,py:-10},{n:9,py:-10},{n:10,py:-10}], ml:[] } },
    { name: '2C-4: ハウ・トラス', data: { nodes: [{x:0,y:0,s:'p'},{x:3,y:0,s:'f'},{x:6,y:0,s:'f'},{x:9,y:0,s:'f'},{x:12,y:0,s:'r'},{x:0,y:2,s:'f'},{x:3,y:2,s:'f'},{x:6,y:2,s:'f'},{x:9,y:2,s:'f'},{x:12,y:2,s:'f'}], members:[
        {i:1,j:2, ...p_truss, A:1.7e-3},{i:2,j:3, ...p_truss, A:1.7e-3},{i:3,j:4, ...p_truss, A:1.7e-3},{i:4,j:5, ...p_truss, A:1.7e-3},
        {i:6,j:7, ...p_truss, A:1.7e-3},{i:7,j:8, ...p_truss, A:1.7e-3},{i:8,j:9, ...p_truss, A:1.7e-3},{i:9,j:10, ...p_truss, A:1.7e-3},
        {i:1,j:6, ...p_truss, A:1.269e-3},{i:2,j:7, ...p_truss, A:1.269e-3},{i:3,j:8, ...p_truss, A:1.269e-3},{i:4,j:9, ...p_truss, A:1.269e-3},{i:5,j:10, ...p_truss, A:1.269e-3},
        {i:6,j:2, ...p_truss, A:1.269e-3},{i:7,j:3, ...p_truss, A:1.269e-3},{i:8,j:4, ...p_truss, A:1.269e-3},{i:9,j:5, ...p_truss, A:1.269e-3}
    ], nl:[{n:6,py:-10},{n:7,py:-10},{n:8,py:-10},{n:9,py:-10},{n:10,py:-10}], ml:[] } },
    { name: '2C-5: ワーレン・トラス', data: { nodes: [{x:0,y:0,s:'p'},{x:6,y:0,s:'r'},{x:12,y:0,s:'f'},{x:3,y:2,s:'f'},{x:9,y:2,s:'f'}], members:[
        {i:1,j:4, ...p_truss, A:1.7e-3},{i:4,j:2, ...p_truss, A:1.7e-3},{i:2,j:5, ...p_truss, A:1.7e-3},{i:5,j:3, ...p_truss, A:1.7e-3},
        {i:4,j:5, ...p_truss, A:1.7e-3},{i:1,j:2, ...p_truss, A:1.7e-3},{i:2,j:3, ...p_truss, A:1.7e-3}
    ], nl:[{n:4,py:-15},{n:5,py:-15}], ml:[] } },
    { name: '--- 3. 橋梁構造物 (Bridge Structures) ---', disabled: true },
    { name: '3A-1: 単純支持桁橋', data: { nodes: [{x:0,y:0,s:'p'},{x:3,y:0,s:'f'},{x:6,y:0,s:'f'},{x:9,y:0,s:'f'},{x:12,y:0,s:'r'}], members:[
        {i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:2.35e-4, A:8.337e-3, Z:1.17e-3},{i:2,j:3, E:UNIT_CONVERSION.E_STEEL, I:2.35e-4, A:8.337e-3, Z:1.17e-3},
        {i:3,j:4, E:UNIT_CONVERSION.E_STEEL, I:2.35e-4, A:8.337e-3, Z:1.17e-3},{i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:2.35e-4, A:8.337e-3, Z:1.17e-3}
    ], nl:[], ml:[{m:1,w:20},{m:2,w:20},{m:3,w:20},{m:4,w:20}] } },
    { name: '3A-2: 2径間連続桁橋', data: { nodes: [{x:0,y:0,s:'p'},{x:4,y:0,s:'f'},{x:8,y:0,s:'r'},{x:12,y:0,s:'f'},{x:16,y:0,s:'r'}], members:[
        {i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:2,j:3, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},
        {i:3,j:4, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4}
    ], nl:[], ml:[{m:1,w:20},{m:2,w:20},{m:3,w:20},{m:4,w:20}] } },
    { name: '3A-3: ゲルバー桁橋', data: { nodes: [{x:0, y:0, s:'p'},{x:4, y:0, s:'f'},{x:8, y:0, s:'r'},{x:12, y:0, s:'f'},{x:16, y:0, s:'r'}], members: [
        {i:1, j:2, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:2, j:3, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4, i_conn:'p', j_conn:'rigid'},
        {i:3, j:4, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4, i_conn:'rigid', j_conn:'p'},{i:4, j:5, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4}
    ], nl: [], ml: [{m:1, w:20},{m:2, w:20},{m:3, w:20},{m:4, w:20}] } },
    { name: '3B-1: 単純トラス橋', data: { nodes: [{x:0,y:0,s:'p'},{x:6,y:0,s:'f'},{x:12,y:0,s:'r'},{x:0,y:3,s:'f'},{x:6,y:3,s:'f'},{x:12,y:3,s:'f'}], members:[
        {i:1,j:2, ...p_truss, A:3.697e-3},{i:2,j:3, ...p_truss, A:3.697e-3},
        {i:4,j:5, ...p_truss, A:3.697e-3},{i:5,j:6, ...p_truss, A:3.697e-3},
        {i:1,j:4, ...p_truss, A:1.7e-3},{i:2,j:5, ...p_truss, A:1.7e-3},{i:3,j:6, ...p_truss, A:1.7e-3},
        {i:1,j:5, ...p_truss, A:1.7e-3},{i:2,j:6, ...p_truss, A:1.7e-3}
    ], nl:[{n:1,py:-30},{n:2,py:-30},{n:3,py:-30}], ml:[] } },
    { name: '3B-2: 2径間連続トラス橋', data: { nodes: [{x:0,y:0,s:'p'},{x:6,y:0,s:'f'},{x:12,y:0,s:'r'},{x:18,y:0,s:'f'},{x:24,y:0,s:'r'},{x:0,y:3,s:'f'},{x:6,y:3,s:'f'},{x:12,y:3,s:'f'},{x:18,y:3,s:'f'},{x:24,y:3,s:'f'}], members:[
        {i:1,j:2, ...p_truss, A:4.678e-3},{i:2,j:3, ...p_truss, A:4.678e-3},{i:3,j:4, ...p_truss, A:4.678e-3},{i:4,j:5, ...p_truss, A:4.678e-3},
        {i:6,j:7, ...p_truss, A:4.678e-3},{i:7,j:8, ...p_truss, A:4.678e-3},{i:8,j:9, ...p_truss, A:4.678e-3},{i:9,j:10, ...p_truss, A:4.678e-3},
        {i:1,j:6, ...p_truss, A:1.7e-3},{i:2,j:7, ...p_truss, A:1.7e-3},{i:3,j:8, ...p_truss, A:1.7e-3},{i:4,j:9, ...p_truss, A:1.7e-3},{i:5,j:10, ...p_truss, A:1.7e-3},
        {i:6,j:2, ...p_truss, A:1.7e-3},{i:7,j:3, ...p_truss, A:1.7e-3},{i:8,j:4, ...p_truss, A:1.7e-3},{i:9,j:5, ...p_truss, A:1.7e-3},
        {i:7,j:2, ...p_truss, A:1.7e-3},{i:8,j:3, ...p_truss, A:1.7e-3},{i:9,j:4, ...p_truss, A:1.7e-3}
    ], nl:[{n:1,py:-40},{n:2,py:-40},{n:3,py:-40},{n:4,py:-40},{n:5,py:-40}], ml:[] } },
    { name: '3B-3: ゲルバートラス橋', data: { nodes: [{x:0,y:0,s:'p'},{x:6,y:0,s:'f'},{x:12,y:0,s:'r'},{x:18,y:0,s:'f'},{x:24,y:0,s:'r'},{x:0,y:3,s:'f'},{x:6,y:3,s:'f'},{x:12,y:3,s:'f'},{x:18,y:3,s:'f'},{x:24,y:3,s:'f'},{x:9,y:0,s:'f'},{x:15,y:0,s:'f'}], members:[
        {i:1,j:2, ...p_truss, A:3.697e-3},{i:2,j:11, ...p_truss, A:3.697e-3},{i:11,j:12, ...p_truss, A:3.697e-3},{i:12,j:4, ...p_truss, A:3.697e-3},{i:4,j:5, ...p_truss, A:3.697e-3},
        {i:6,j:7, ...p_truss, A:3.697e-3},{i:7,j:8, ...p_truss, A:3.697e-3},{i:8,j:9, ...p_truss, A:3.697e-3},{i:9,j:10, ...p_truss, A:3.697e-3},
        {i:1,j:6, ...p_truss, A:1.7e-3},{i:2,j:7, ...p_truss, A:1.7e-3},{i:11,j:8, ...p_truss, A:1.7e-3},{i:12,j:8, ...p_truss, A:1.7e-3},{i:4,j:9, ...p_truss, A:1.7e-3},{i:5,j:10, ...p_truss, A:1.7e-3},
        {i:1,j:7, ...p_truss, A:1.7e-3},{i:2,j:6, ...p_truss, A:1.7e-3},{i:2,j:8, ...p_truss, A:1.7e-3},{i:4,j:8, ...p_truss, A:1.7e-3},{i:4,j:10, ...p_truss, A:1.7e-3},{i:5,j:9, ...p_truss, A:1.7e-3}
    ], nl:[{n:1,py:-40},{n:2,py:-40},{n:11,py:-40},{n:12,py:-40},{n:4,py:-40},{n:5,py:-40}], ml:[] } },
    { name: '3C-1: 2ヒンジアーチ橋', data: { nodes: [{x:0,y:0,s:'p'},{x:4,y:2,s:'f'},{x:8,y:3,s:'f'},{x:12,y:3.5,s:'f'},{x:16,y:3,s:'f'},{x:20,y:2,s:'f'},{x:24,y:0,s:'r'}], members:[
        {i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:2,j:3, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},
        {i:3,j:4, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},
        {i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:6,j:7, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4}
    ], nl:[{n:2,py:-20},{n:3,py:-20},{n:4,py:-20},{n:5,py:-20},{n:6,py:-20}], ml:[] } },
    { name: '3C-2: 3ヒンジアーチ橋', data: { nodes: [{x:0,y:0,s:'p'},{x:4,y:2,s:'f'},{x:8,y:3,s:'f'},{x:12,y:3.5,s:'f'},{x:16,y:3,s:'f'},{x:20,y:2,s:'f'},{x:24,y:0,s:'r'}], members:[
        {i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:2,j:3, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:3,j:4, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4, j_conn:'p'},
        {i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4, i_conn:'p'},{i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:6,j:7, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4}
    ], nl:[{n:2,py:-20},{n:3,py:-20},{n:4,py:-20},{n:5,py:-20},{n:6,py:-20}], ml:[] } },
    { name: '3C-3: タイドアーチ橋', data: { nodes: [{x:0,y:0,s:'p'},{x:4,y:2,s:'f'},{x:8,y:3,s:'f'},{x:12,y:3.5,s:'f'},{x:16,y:3,s:'f'},{x:20,y:2,s:'f'},{x:24,y:0,s:'r'}], members:[
        {i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:2,j:3, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:3,j:4, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},
        {i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:6,j:7, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},
        {i:1,j:7, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4}
    ], nl:[{n:2,py:-20},{n:3,py:-20},{n:4,py:-20},{n:5,py:-20},{n:6,py:-20}], ml:[] } },
    { name: '3D-1: ランガー橋', data: { nodes: [{x:0,y:0,s:'p'},{x:6,y:0,s:'f'},{x:12,y:0,s:'f'},{x:18,y:0,s:'f'},{x:24,y:0,s:'r'},{x:6,y:4,s:'f'},{x:12,y:5,s:'f'},{x:18,y:4,s:'f'}], members:[
        {i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:2,j:3, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:3,j:4, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},
        {i:1,j:6, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:6,j:7, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:8,j:5, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:2,j:6, ...p_truss, A:1.7e-3},{i:3,j:7, ...p_truss, A:1.7e-3},{i:4,j:8, ...p_truss, A:1.7e-3}
    ], nl:[{n:2,py:-20},{n:3,py:-20},{n:4,py:-20}], ml:[] } },
    { name: '3D-2: ローゼ橋', data: { nodes: [{x:0,y:0,s:'p'},{x:6,y:0,s:'f'},{x:12,y:0,s:'f'},{x:18,y:0,s:'f'},{x:24,y:0,s:'r'},{x:0,y:4,s:'f'},{x:6,y:5,s:'f'},{x:12,y:5.5,s:'f'},{x:18,y:5,s:'f'},{x:24,y:4,s:'f'}], members:[
        {i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:2,j:3, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:3,j:4, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},
        {i:6,j:7, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:8,j:9, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:9,j:10, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:1,j:6, ...p_truss, A:1.7e-3},{i:2,j:7, ...p_truss, A:1.7e-3},{i:3,j:8, ...p_truss, A:1.7e-3},{i:4,j:9, ...p_truss, A:1.7e-3},{i:5,j:10, ...p_truss, A:1.7e-3},
        {i:2,j:6, ...p_truss, A:1.7e-3},{i:3,j:7, ...p_truss, A:1.7e-3},{i:4,j:8, ...p_truss, A:1.7e-3},{i:5,j:9, ...p_truss, A:1.7e-3}
    ], nl:[{n:2,py:-20},{n:3,py:-20},{n:4,py:-20}], ml:[] } },
    { name: '3D-3: 斜張橋', data: { nodes: [{x:0,y:0,s:'p'},{x:6,y:0,s:'f'},{x:12,y:0,s:'r'},{x:18,y:0,s:'f'},{x:24,y:0,s:'r'},{x:12,y:8,s:'f'}], members:[
        {i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:2,j:3, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:3,j:4, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:3,j:6, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},
        {i:1,j:6, ...p_truss, A:2.667e-3},{i:2,j:6, ...p_truss, A:2.667e-3},{i:4,j:6, ...p_truss, A:2.667e-3},{i:5,j:6, ...p_truss, A:2.667e-3}
    ], nl:[{n:2,py:-20},{n:4,py:-20}], ml:[] } },
    { name: '--- 4. その他・特殊構造 (Misc. & Special) ---', disabled: true },
    { name: '4A-1: 高層ビル', data: { nodes: [{x:0,y:0,s:'x'},{x:8,y:0,s:'x'},{x:16,y:0,s:'x'},{x:0,y:4,s:'f'},{x:8,y:4,s:'f'},{x:16,y:4,s:'f'},{x:0,y:8,s:'f'},{x:8,y:8,s:'f'},{x:16,y:8,s:'f'},{x:0,y:12,s:'f'},{x:8,y:12,s:'f'},{x:16,y:12,s:'f'},{x:0,y:16,s:'f'},{x:8,y:16,s:'f'},{x:16,y:16,s:'f'}], members:[
        {i:1,j:4, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:2,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},{i:3,j:6, E:UNIT_CONVERSION.E_STEEL, I:1.35e-4, A:6.291e-3, Z:7.71e-4},
        {i:4,j:7, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},{i:5,j:8, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},{i:6,j:9, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},
        {i:7,j:10, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:8,j:11, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:9,j:12, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:10,j:13, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:11,j:14, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:12,j:15, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:8,j:9, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:10,j:11, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:11,j:12, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},
        {i:13,j:14, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:14,j:15, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4}
    ], nl:[{n:13,px:10},{n:14,px:10},{n:15,px:10},{n:13,py:-30},{n:14,py:-30},{n:15,py:-30}], ml:[] } },
    { name: '4A-2: 大スパン屋根', data: { nodes: [{x:0,y:0,s:'p'},{x:8,y:0,s:'r'},{x:16,y:0,s:'r'},{x:24,y:0,s:'p'},{x:4,y:7,s:'f'},{x:12,y:9,s:'f'},{x:20,y:7,s:'f'}], members:[
        {i:1,j:5, ...p_truss, A:3.697e-3},{i:5,j:2, ...p_truss, A:3.697e-3},{i:2,j:6, ...p_truss, A:3.697e-3},{i:6,j:3, ...p_truss, A:3.697e-3},
        {i:3,j:7, ...p_truss, A:3.697e-3},{i:7,j:4, ...p_truss, A:3.697e-3},{i:5,j:6, ...p_truss, A:3.697e-3},{i:6,j:7, ...p_truss, A:3.697e-3},
        {i:1,j:2, ...p_truss, A:2.667e-3},{i:2,j:3, ...p_truss, A:2.667e-3},{i:3,j:4, ...p_truss, A:2.667e-3}
    ], nl:[{n:5,py:-10},{n:6,py:-10},{n:7,py:-10}], ml:[] } },
    { name: '4A-3: 複合ラーメン構造', data: { nodes: [{x:0,y:0,s:'x'},{x:8,y:0,s:'x'},{x:16,y:0,s:'x'},{x:24,y:0,s:'x'},{x:0,y:4,s:'f'},{x:8,y:4,s:'f'},{x:16,y:4,s:'f'},{x:24,y:4,s:'f'},{x:0,y:8,s:'f'},{x:8,y:8,s:'f'},{x:16,y:8,s:'f'},{x:24,y:8,s:'f'}], members:[
        {i:1,j:5, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:2,j:6, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:3,j:7, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:4,j:8, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:5,j:9, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:6,j:10, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:7,j:11, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:8,j:12, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:6,j:7, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:9,j:10, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:10,j:11, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:11,j:12, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:1,j:6, ...p_truss, A:1.7e-3},{i:2,j:5, ...p_truss, A:1.7e-3},{i:2,j:7, ...p_truss, A:1.7e-3},{i:3,j:6, ...p_truss, A:1.7e-3},
        {i:3,j:8, ...p_truss, A:1.7e-3},{i:4,j:7, ...p_truss, A:1.7e-3},{i:5,j:10, ...p_truss, A:1.7e-3},{i:6,j:9, ...p_truss, A:1.7e-3},
        {i:6,j:11, ...p_truss, A:1.7e-3},{i:7,j:10, ...p_truss, A:1.7e-3},{i:7,j:12, ...p_truss, A:1.7e-3},{i:8,j:11, ...p_truss, A:1.7e-3}
    ], nl:[{n:9,px:20},{n:10,px:20},{n:11,px:20},{n:12,px:20},{n:9,py:-30},{n:10,py:-30},{n:11,py:-30},{n:12,py:-30}], ml:[] } },
    { name: '4B-1: 下路アーチ橋', data: { nodes: [{x:0,y:0,s:'p'},{x:6,y:0,s:'f'},{x:12,y:0,s:'f'},{x:18,y:0,s:'f'},{x:24,y:0,s:'r'},{x:6,y:4,s:'f'},{x:12,y:5,s:'f'},{x:18,y:4,s:'f'}], members:[
        {i:1,j:2, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:2,j:3, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:3,j:4, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:1,j:6, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:6,j:7, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},{i:8,j:5, E:UNIT_CONVERSION.E_STEEL, I:3.96e-5, A:3.697e-3, Z:3.17e-4},
        {i:2,j:6, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:3,j:7, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4},{i:4,j:8, E:UNIT_CONVERSION.E_STEEL, I:1.81e-5, A:2.667e-3, Z:1.81e-4}
    ], nl:[{n:2,py:-20},{n:3,py:-20},{n:4,py:-20}], ml:[] } },
    { name: '4B-2: 複合トラス橋', data: { nodes: [{x:0,y:0,s:'p'},{x:6,y:0,s:'f'},{x:12,y:0,s:'f'},{x:18,y:0,s:'f'},{x:24,y:0,s:'r'},{x:0,y:4,s:'f'},{x:6,y:4,s:'f'},{x:12,y:4,s:'f'},{x:18,y:4,s:'f'},{x:24,y:4,s:'f'},{x:6,y:8,s:'f'},{x:12,y:9,s:'f'},{x:18,y:8,s:'f'}], members:[
        {i:1,j:2, ...p_truss, A:3.697e-3},{i:2,j:3, ...p_truss, A:3.697e-3},{i:3,j:4, ...p_truss, A:3.697e-3},{i:4,j:5, ...p_truss, A:3.697e-3},
        {i:6,j:7, ...p_truss, A:3.697e-3},{i:7,j:8, ...p_truss, A:3.697e-3},{i:8,j:9, ...p_truss, A:3.697e-3},{i:9,j:10, ...p_truss, A:3.697e-3},
        {i:7,j:11, ...p_truss, A:2.667e-3},{i:8,j:12, ...p_truss, A:2.667e-3},{i:9,j:13, ...p_truss, A:2.667e-3},{i:11,j:12, ...p_truss, A:2.667e-3},{i:12,j:13, ...p_truss, A:2.667e-3},
        {i:1,j:6, ...p_truss, A:1.7e-3},{i:2,j:7, ...p_truss, A:1.7e-3},{i:3,j:8, ...p_truss, A:1.7e-3},{i:4,j:9, ...p_truss, A:1.7e-3},{i:5,j:10, ...p_truss, A:1.7e-3},
        {i:6,j:2, ...p_truss, A:1.7e-3},{i:7,j:3, ...p_truss, A:1.7e-3},{i:8,j:4, ...p_truss, A:1.7e-3},{i:9,j:5, ...p_truss, A:1.7e-3},
        {i:7,j:12, ...p_truss, A:1.7e-3},{i:8,j:11, ...p_truss, A:1.7e-3},{i:8,j:13, ...p_truss, A:1.7e-3},{i:9,j:12, ...p_truss, A:1.7e-3}
    ], nl:[{n:1,py:-20},{n:2,py:-20},{n:3,py:-20},{n:4,py:-20},{n:5,py:-20}], ml:[] } },
    { name: '4B-3: 吊床版橋', data: { nodes: [{x:0,y:0,s:'x'},{x:36,y:0,s:'x'},{x:0,y:12,s:'f'},{x:36,y:12,s:'f'},{x:6,y:0,s:'f'},{x:12,y:0,s:'f'},{x:18,y:0,s:'f'},{x:24,y:0,s:'f'},{x:30,y:0,s:'f'},{x:6,y:9,s:'f'},{x:12,y:8,s:'f'},{x:18,y:7,s:'f'},{x:24,y:8,s:'f'},{x:30,y:9,s:'f'}], members:[
        {i:1,j:3, E:UNIT_CONVERSION.E_STEEL, I:2.35e-4, A:8.337e-3, Z:1.17e-3},{i:2,j:4, E:UNIT_CONVERSION.E_STEEL, I:2.35e-4, A:8.337e-3, Z:1.17e-3},
        {i:3,j:10, ...p_truss, A:4.678e-3},{i:10,j:11, ...p_truss, A:4.678e-3},{i:11,j:12, ...p_truss, A:4.678e-3},{i:12,j:13, ...p_truss, A:4.678e-3},
        {i:13,j:14, ...p_truss, A:4.678e-3},{i:14,j:4, ...p_truss, A:4.678e-3},
        {i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:6,j:7, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:8,j:9, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:5,j:10, ...p_truss, A:1.7e-3},{i:6,j:11, ...p_truss, A:1.7e-3},{i:7,j:12, ...p_truss, A:1.7e-3},{i:8,j:13, ...p_truss, A:1.7e-3},{i:9,j:14, ...p_truss, A:1.7e-3}
    ], nl:[{n:5,py:-15},{n:6,py:-15},{n:7,py:-15},{n:8,py:-15},{n:9,py:-15}], ml:[] } },
    { name: '4B-4: 斜張橋', data: { nodes: [{x:0,y:0,s:'p'},{x:50,y:0,s:'r'},{x:25,y:0,s:'r'},{x:25,y:20,s:'f'},{x:10,y:0,s:'f'},{x:20,y:0,s:'f'},{x:30,y:0,s:'f'},{x:40,y:0,s:'f'}], members:[
        {i:3,j:4, E:UNIT_CONVERSION.E_STEEL, I:2.35e-4, A:8.337e-3, Z:1.17e-3},
        {i:4,j:5, ...p_truss, A:3.697e-3},{i:4,j:6, ...p_truss, A:3.697e-3},{i:4,j:7, ...p_truss, A:3.697e-3},{i:4,j:8, ...p_truss, A:3.697e-3},
        {i:1,j:5, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:6,j:3, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:3,j:7, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:8,j:2, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4}
    ], nl:[{n:5,py:-20},{n:6,py:-20},{n:7,py:-20},{n:8,py:-20}], ml:[] } },
    { name: '4B-5: 複合アーチ橋', data: { nodes: [{x:0,y:0,s:'x'},{x:40,y:0,s:'p'},{x:8,y:0,s:'f'},{x:16,y:0,s:'f'},{x:24,y:0,s:'f'},{x:32,y:0,s:'f'},{x:8,y:6,s:'f'},{x:16,y:8,s:'f'},{x:24,y:8,s:'f'},{x:32,y:6,s:'f'},{x:20,y:10,s:'f'}], members:[
        {i:1,j:3, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:3,j:4, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},{i:6,j:2, E:UNIT_CONVERSION.E_STEEL, I:7.21e-5, A:4.678e-3, Z:4.81e-4},
        {i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},{i:8,j:11, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},
        {i:11,j:9, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},{i:9,j:10, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},
        {i:3,j:7, ...p_truss, A:1.7e-3},{i:4,j:8, ...p_truss, A:1.7e-3},{i:5,j:9, ...p_truss, A:1.7e-3},{i:6,j:10, ...p_truss, A:1.7e-3},
        {i:3,j:8, ...p_truss, A:1.7e-3},{i:4,j:7, ...p_truss, A:1.7e-3},{i:4,j:9, ...p_truss, A:1.7e-3},{i:5,j:8, ...p_truss, A:1.7e-3},
        {i:5,j:10, ...p_truss, A:1.7e-3},{i:6,j:9, ...p_truss, A:1.7e-3}
    ], nl:[{n:3,py:-15},{n:4,py:-15},{n:5,py:-15},{n:6,py:-15}], ml:[] } },
    { name: '4C-1: 高層建物＋制振装置', data: { nodes: [{x:0,y:0,s:'x'},{x:8,y:0,s:'x'},{x:16,y:0,s:'x'},{x:0,y:4,s:'f'},{x:8,y:4,s:'f'},{x:16,y:4,s:'f'},{x:0,y:8,s:'f'},{x:8,y:8,s:'f'},{x:16,y:8,s:'f'},{x:0,y:12,s:'f'},{x:8,y:12,s:'f'},{x:16,y:12,s:'f'},{x:0,y:16,s:'f'},{x:8,y:16,s:'f'},{x:16,y:16,s:'f'},{x:0,y:20,s:'f'},{x:8,y:20,s:'f'},{x:16,y:20,s:'f'},{x:0,y:24,s:'f'},{x:8,y:24,s:'f'},{x:16,y:24,s:'f'},{x:0,y:28,s:'f'},{x:8,y:28,s:'f'},{x:16,y:28,s:'f'},{x:0,y:32,s:'f'},{x:8,y:32,s:'f'},{x:16,y:32,s:'f'},{x:0,y:36,s:'f'},{x:8,y:36,s:'f'},{x:16,y:36,s:'f'}], members:[
        {i:1,j:4,E:205000,I:6.66e-4,A:2.187e-2,Z:3.33e-3},{i:4,j:7,E:205000,I:6.66e-4,A:2.187e-2,Z:3.33e-3},{i:7,j:10,E:205000,I:5.61e-4,A:1.868e-2,Z:2.85e-3},{i:10,j:13,E:205000,I:5.61e-4,A:1.868e-2,Z:2.85e-3},{i:13,j:16,E:205000,I:3.98e-4,A:1.719e-2,Z:2.28e-3},{i:16,j:19,E:205000,I:3.98e-4,A:1.719e-2,Z:2.28e-3},{i:19,j:22,E:205000,I:2.35e-4,A:8.337e-3,Z:1.17e-3},{i:22,j:25,E:205000,I:2.35e-4,A:8.337e-3,Z:1.17e-3},{i:25,j:28,E:205000,I:1.35e-4,A:6.291e-3,Z:7.71e-4},
        {i:2,j:5,E:205000,I:6.66e-4,A:2.187e-2,Z:3.33e-3},{i:5,j:8,E:205000,I:6.66e-4,A:2.187e-2,Z:3.33e-3},{i:8,j:11,E:205000,I:5.61e-4,A:1.868e-2,Z:2.85e-3},{i:11,j:14,E:205000,I:5.61e-4,A:1.868e-2,Z:2.85e-3},{i:14,j:17,E:205000,I:3.98e-4,A:1.719e-2,Z:2.28e-3},{i:17,j:20,E:205000,I:3.98e-4,A:1.719e-2,Z:2.28e-3},{i:20,j:23,E:205000,I:2.35e-4,A:8.337e-3,Z:1.17e-3},{i:23,j:26,E:205000,I:2.35e-4,A:8.337e-3,Z:1.17e-3},{i:26,j:29,E:205000,I:1.35e-4,A:6.291e-3,Z:7.71e-4},
        {i:3,j:6,E:205000,I:6.66e-4,A:2.187e-2,Z:3.33e-3},{i:6,j:9,E:205000,I:6.66e-4,A:2.187e-2,Z:3.33e-3},{i:9,j:12,E:205000,I:5.61e-4,A:1.868e-2,Z:2.85e-3},{i:12,j:15,E:205000,I:5.61e-4,A:1.868e-2,Z:2.85e-3},{i:15,j:18,E:205000,I:3.98e-4,A:1.719e-2,Z:2.28e-3},{i:18,j:21,E:205000,I:3.98e-4,A:1.719e-2,Z:2.28e-3},{i:21,j:24,E:205000,I:2.35e-4,A:8.337e-3,Z:1.17e-3},{i:24,j:27,E:205000,I:2.35e-4,A:8.337e-3,Z:1.17e-3},{i:27,j:30,E:205000,I:1.35e-4,A:6.291e-3,Z:7.71e-4},
        {i:4,j:5,E:205000,I:2.35e-4,A:8.337e-3,Z:1.17e-3},{i:5,j:6,E:205000,I:2.35e-4,A:8.337e-3,Z:1.17e-3},{i:7,j:8,E:205000,I:2.35e-4,A:8.337e-3,Z:1.17e-3},{i:8,j:9,E:205000,I:2.35e-4,A:8.337e-3,Z:1.17e-3},{i:10,j:11,E:205000,I:1.35e-4,A:6.291e-3,Z:7.71e-4},{i:11,j:12,E:205000,I:1.35e-4,A:6.291e-3,Z:7.71e-4},{i:13,j:14,E:205000,I:1.35e-4,A:6.291e-3,Z:7.71e-4},{i:14,j:15,E:205000,I:1.35e-4,A:6.291e-3,Z:7.71e-4},{i:16,j:17,E:205000,I:1.35e-4,A:6.291e-3,Z:7.71e-4},{i:17,j:18,E:205000,I:1.35e-4,A:6.291e-3,Z:7.71e-4},{i:19,j:20,E:205000,I:7.21e-5,A:4.678e-3,Z:4.81e-4},{i:20,j:21,E:205000,I:7.21e-5,A:4.678e-3,Z:4.81e-4},{i:22,j:23,E:205000,I:7.21e-5,A:4.678e-3,Z:4.81e-4},{i:23,j:24,E:205000,I:7.21e-5,A:4.678e-3,Z:4.81e-4},{i:25,j:26,E:205000,I:7.21e-5,A:4.678e-3,Z:4.81e-4},{i:26,j:27,E:205000,I:7.21e-5,A:4.678e-3,Z:4.81e-4},{i:28,j:29,E:205000,I:7.21e-5,A:4.678e-3,Z:4.81e-4},{i:29,j:30,E:205000,I:7.21e-5,A:4.678e-3,Z:4.81e-4},
        {i:4,j:8, ...p_truss, A:1.269e-3},{i:5,j:9, ...p_truss, A:1.269e-3},{i:7,j:11, ...p_truss, A:1.269e-3},{i:8,j:12, ...p_truss, A:1.269e-3},
        {i:13,j:17, ...p_truss, A:1.269e-3},{i:14,j:18, ...p_truss, A:1.269e-3},{i:16,j:20, ...p_truss, A:1.269e-3},{i:17,j:21, ...p_truss, A:1.269e-3},
        {i:22,j:26, ...p_truss, A:1.269e-3},{i:23,j:27, ...p_truss, A:1.269e-3},{i:25,j:29, ...p_truss, A:1.269e-3},{i:26,j:30, ...p_truss, A:1.269e-3}
    ], nl:[{n:4,px:10},{n:7,px:10},{n:10,px:10},{n:13,px:10},{n:16,px:10},{n:19,px:10},{n:22,px:10},{n:25,px:10},{n:28,px:10}], ml:[] } },
    { name: '4C-2: 大スパン立体トラス', data: { nodes: [{x:0, y:0, s:'p'},{x:6, y:0, s:'f'},{x:12, y:0, s:'f'},{x:18, y:0, s:'f'},{x:24, y:0, s:'f'},{x:30, y:0, s:'f'},{x:36, y:0, s:'r'},{x:0, y:6, s:'f'},{x:6, y:6, s:'f'},{x:12, y:6, s:'f'},{x:18, y:6, s:'f'},{x:24, y:6, s:'f'},{x:30, y:6, s:'f'},{x:36, y:6, s:'f'}], members:[
        {i:1,j:2, ...p_truss, A:2.667e-3},{i:2,j:3, ...p_truss, A:2.667e-3},{i:3,j:4, ...p_truss, A:2.667e-3},{i:4,j:5, ...p_truss, A:2.667e-3},{i:5,j:6, ...p_truss, A:2.667e-3},{i:6,j:7, ...p_truss, A:2.667e-3},
        {i:8,j:9, ...p_truss, A:2.667e-3},{i:9,j:10, ...p_truss, A:2.667e-3},{i:10,j:11, ...p_truss, A:2.667e-3},{i:11,j:12, ...p_truss, A:2.667e-3},{i:12,j:13, ...p_truss, A:2.667e-3},{i:13,j:14, ...p_truss, A:2.667e-3},
        {i:1,j:8, ...p_truss, A:1.7e-3},{i:2,j:9, ...p_truss, A:1.7e-3},{i:3,j:10, ...p_truss, A:1.7e-3},{i:4,j:11, ...p_truss, A:1.7e-3},{i:5,j:12, ...p_truss, A:1.7e-3},{i:6,j:13, ...p_truss, A:1.7e-3},{i:7,j:14, ...p_truss, A:1.7e-3},
        {i:1,j:9, ...p_truss, A:1.7e-3},{i:2,j:10, ...p_truss, A:1.7e-3},{i:3,j:11, ...p_truss, A:1.7e-3},{i:4,j:12, ...p_truss, A:1.7e-3},{i:5,j:13, ...p_truss, A:1.7e-3},{i:6,j:14, ...p_truss, A:1.7e-3},
        {i:8,j:2, ...p_truss, A:1.7e-3},{i:9,j:3, ...p_truss, A:1.7e-3},{i:10,j:4, ...p_truss, A:1.7e-3},{i:11,j:5, ...p_truss, A:1.7e-3},{i:12,j:6, ...p_truss, A:1.7e-3},{i:13,j:7, ...p_truss, A:1.7e-3}
    ], nl:[{n:8,py:-15},{n:9,py:-15},{n:10,py:-15},{n:11,py:-15},{n:12,py:-15},{n:13,py:-15},{n:14,py:-15}], ml:[] } },
    { name: '4C-3: 特殊ドーム構造', data: { nodes: [{x:0,y:0,s:'p'},{x:40,y:0,s:'r'},{x:5,y:3,s:'f'},{x:10,y:6,s:'f'},{x:15,y:9,s:'f'},{x:20,y:10,s:'f'},{x:25,y:9,s:'f'},{x:30,y:6,s:'f'},{x:35,y:3,s:'f'},{x:2.5,y:1.5,s:'f'},{x:37.5,y:1.5,s:'f'}], members:[
        {i:1,j:10, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},{i:10,j:3, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},{i:3,j:4, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},{i:4,j:5, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},{i:5,j:6, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},
        {i:6,j:7, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},{i:7,j:8, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},{i:8,j:9, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},{i:9,j:11, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4},{i:11,j:2, E:UNIT_CONVERSION.E_STEEL, I:1.10e-4, A:5.245e-3, Z:6.38e-4}
    ], nl:[{n:3,py:-10},{n:4,py:-10},{n:5,py:-10},{n:6,py:-10},{n:7,py:-10},{n:8,py:-10},{n:9,py:-10}], ml:[] } },
    { name: '4C-4: 多層メガストラクチャー', data: { nodes: [{x:0,y:0,s:'x'},{x:12,y:0,s:'x'},{x:24,y:0,s:'x'},{x:36,y:0,s:'x'},{x:48,y:0,s:'x'},{x:0,y:12,s:'f'},{x:12,y:12,s:'f'},{x:24,y:12,s:'f'},{x:36,y:12,s:'f'},{x:48,y:12,s:'f'},{x:0,y:24,s:'f'},{x:12,y:24,s:'f'},{x:24,y:24,s:'f'},{x:36,y:24,s:'f'},{x:48,y:24,s:'f'},{x:0,y:36,s:'f'},{x:12,y:36,s:'f'},{x:24,y:36,s:'f'},{x:36,y:36,s:'f'},{x:48,y:36,s:'f'},{x:0,y:48,s:'f'},{x:12,y:48,s:'f'},{x:24,y:48,s:'f'},{x:36,y:48,s:'f'},{x:48,y:48,s:'f'}], members: [
        {i:1,j:6, E:UNIT_CONVERSION.E_STEEL, I:6.66e-4, A:2.187e-2, Z:3.33e-3},{i:6,j:11, E:UNIT_CONVERSION.E_STEEL, I:6.66e-4, A:2.187e-2, Z:3.33e-3},{i:11,j:16, E:UNIT_CONVERSION.E_STEEL, I:5.61e-4, A:1.868e-2, Z:2.85e-3},{i:16,j:21, E:UNIT_CONVERSION.E_STEEL, I:5.61e-4, A:1.868e-2, Z:2.85e-3},
        {i:2,j:7, E:UNIT_CONVERSION.E_STEEL, I:6.66e-4, A:2.187e-2, Z:3.33e-3},{i:7,j:12, E:UNIT_CONVERSION.E_STEEL, I:6.66e-4, A:2.187e-2, Z:3.33e-3},{i:12,j:17, E:UNIT_CONVERSION.E_STEEL, I:5.61e-4, A:1.868e-2, Z:2.85e-3},{i:17,j:22, E:UNIT_CONVERSION.E_STEEL, I:5.61e-4, A:1.868e-2, Z:2.85e-3},
        {i:3,j:8, E:UNIT_CONVERSION.E_STEEL, I:6.66e-4, A:2.187e-2, Z:3.33e-3},{i:8,j:13, E:UNIT_CONVERSION.E_STEEL, I:6.66e-4, A:2.187e-2, Z:3.33e-3},{i:13,j:18, E:UNIT_CONVERSION.E_STEEL, I:5.61e-4, A:1.868e-2, Z:2.85e-3},{i:18,j:23, E:UNIT_CONVERSION.E_STEEL, I:5.61e-4, A:1.868e-2, Z:2.85e-3},
        {i:4,j:9, E:UNIT_CONVERSION.E_STEEL, I:6.66e-4, A:2.187e-2, Z:3.33e-3},{i:9,j:14, E:UNIT_CONVERSION.E_STEEL, I:6.66e-4, A:2.187e-2, Z:3.33e-3},{i:14,j:19, E:UNIT_CONVERSION.E_STEEL, I:5.61e-4, A:1.868e-2, Z:2.85e-3},{i:19,j:24, E:UNIT_CONVERSION.E_STEEL, I:5.61e-4, A:1.868e-2, Z:2.85e-3},
        {i:5,j:10, E:UNIT_CONVERSION.E_STEEL, I:6.66e-4, A:2.187e-2, Z:3.33e-3},{i:10,j:15, E:UNIT_CONVERSION.E_STEEL, I:6.66e-4, A:2.187e-2, Z:3.33e-3},{i:15,j:20, E:UNIT_CONVERSION.E_STEEL, I:5.61e-4, A:1.868e-2, Z:2.85e-3},{i:20,j:25, E:UNIT_CONVERSION.E_STEEL, I:5.61e-4, A:1.868e-2, Z:2.85e-3},
        {i:6,j:10, ...p_truss, A:6.291e-3},{i:11,j:15, ...p_truss, A:6.291e-3},{i:16,j:20, ...p_truss, A:6.291e-3},{i:21,j:25, ...p_truss, A:6.291e-3},
        {i:1,j:7, ...p_truss, A:6.291e-3},{i:2,j:6, ...p_truss, A:6.291e-3},{i:2,j:8, ...p_truss, A:6.291e-3},{i:3,j:7, ...p_truss, A:6.291e-3},
        {i:3,j:9, ...p_truss, A:6.291e-3},{i:4,j:8, ...p_truss, A:6.291e-3},{i:4,j:10, ...p_truss, A:6.291e-3},{i:5,j:9, ...p_truss, A:6.291e-3},
        {i:6,j:12, ...p_truss, A:6.291e-3},{i:7,j:11, ...p_truss, A:6.291e-3},{i:7,j:13, ...p_truss, A:6.291e-3},{i:8,j:12, ...p_truss, A:6.291e-3},
        {i:8,j:14, ...p_truss, A:6.291e-3},{i:9,j:13, ...p_truss, A:6.291e-3},{i:9,j:15, ...p_truss, A:6.291e-3},{i:10,j:14, ...p_truss, A:6.291e-3},
        {i:11,j:17, ...p_truss, A:4.678e-3},{i:12,j:16, ...p_truss, A:4.678e-3},{i:12,j:18, ...p_truss, A:4.678e-3},{i:13,j:17, ...p_truss, A:4.678e-3},
        {i:13,j:19, ...p_truss, A:4.678e-3},{i:14,j:18, ...p_truss, A:4.678e-3},{i:14,j:20, ...p_truss, A:4.678e-3},{i:15,j:19, ...p_truss, A:4.678e-3},
        {i:16,j:22, ...p_truss, A:4.678e-3},{i:17,j:21, ...p_truss, A:4.678e-3},{i:17,j:23, ...p_truss, A:4.678e-3},{i:18,j:22, ...p_truss, A:4.678e-3},
        {i:18,j:24, ...p_truss, A:4.678e-3},{i:19,j:23, ...p_truss, A:4.678e-3},{i:19,j:25, ...p_truss, A:4.678e-3},{i:20,j:24, ...p_truss, A:4.678e-3}
    ], nl:[{n:6,px:20},{n:7,px:20},{n:8,px:20},{n:9,px:20},{n:10,px:20},{n:11,px:20},{n:12,px:20},{n:13,px:20},{n:14,px:20},{n:15,px:20},{n:16,px:20},{n:17,px:20},{n:18,px:20},{n:19,px:20},{n:20,px:20},{n:21,px:20},{n:22,px:20},{n:23,px:20},{n:24,px:20},{n:25,px:20}], ml:[] } }
];

const loadPreset = (index) => {
        const preset = presets[index];
        if (!preset || !preset.data) return;
        const p = preset.data;
        
        // プリセット読み込み中フラグを設定（描画処理をスキップするため）
        window.isLoadingPreset = true;
        
        historyStack = [];
        elements.nodesTable.innerHTML = '';
        elements.membersTable.innerHTML = '';
        elements.nodeLoadsTable.innerHTML = '';
        elements.memberLoadsTable.innerHTML = '';
        p.nodes.forEach(n => addRow(elements.nodesTable, [`#`, `<input type="number" value="${n.x}">`, `<input type="number" value="${n.y}">`, `<select><option value="free"${n.s==='f'?' selected':''}>自由</option><option value="pinned"${n.s==='p'?' selected':''}>ピン</option><option value="fixed"${n.s==='x'?' selected':''}>固定</option><option value="roller"${n.s==='r'?' selected':''}>ローラー</option></select>`, `<input type="number" value="0" step="0.1">`, `<input type="number" value="0" step="0.1">`, `<input type="number" value="0" step="0.001">`], false));
        p.members.forEach(m => {
            const E_N_mm2 = m.E || '205000';
            const F_N_mm2 = m.F || '235';
            const I_m4 = m.I || 1e-9;
            const A_m2 = m.A || 1e-3;
            const Z_m3 = m.Z || 1e-9;

            // プリセットから断面情報と軸情報を取得
            const presetProfile = findPresetSectionProfile(m);
            const sectionInfoFromPreset = presetProfile ? cloneDeep(presetProfile.sectionInfo) : parseSectionInfoFromMember(m);
            const axisInfo = buildAxisInfo(m, sectionInfoFromPreset);

            // 断面名称と軸方向を取得
            const sectionName = sectionInfoFromPreset?.label || '';
            const sectionAxis = axisInfo?.label || '';

            const rowCells = memberRowHTML(m.i, m.j, E_N_mm2, F_N_mm2, I_m4, A_m2, Z_m3, m.i_conn || m.ic, m.j_conn || m.jc, sectionName, sectionAxis);
            if (!rowCells || !Array.isArray(rowCells)) {
                console.warn('Failed to build member row cells for preset member:', m);
                return;
            }

            let newRow = addRow(elements.membersTable, [`#`, ...rowCells], false);
            if (!(newRow instanceof HTMLTableRowElement)) {
                if (newRow && typeof newRow.then === 'function') {
                    console.warn('addRow returned a Promise; falling back to last table row for preset member handling.', m);
                } else if (newRow !== undefined) {
                    console.warn('addRow returned a non-row value; attempting fallback.', newRow);
                }

                const memberRows = elements.membersTable?.rows;
                if (memberRows && memberRows.length > 0) {
                    newRow = memberRows[memberRows.length - 1];
                } else {
                    newRow = null;
                }
            }

            if (!(newRow instanceof HTMLTableRowElement)) {
                console.warn('Failed to obtain member row element for preset member:', m);
                return;
            }

            const propertySource = presetProfile ? presetProfile.properties : null;

            if (sectionInfoFromPreset) {
                if (axisInfo && !sectionInfoFromPreset.axis) {
                    sectionInfoFromPreset.axis = { ...axisInfo };
                }
                setRowSectionInfo(newRow, sectionInfoFromPreset);
            } else if (axisInfo) {
                applySectionAxisDataset(newRow, axisInfo);
            }

            const zxToApply = propertySource?.Zx ?? m.Zx;
            const zyToApply = propertySource?.Zy ?? m.Zy;
            const ixToApply = propertySource?.ix ?? m.ix;
            const iyToApply = propertySource?.iy ?? m.iy;

            if (zxToApply != null) newRow.dataset.zx = zxToApply;
            if (zyToApply != null) newRow.dataset.zy = zyToApply;
            if (ixToApply != null) newRow.dataset.ix = ixToApply;
            if (iyToApply != null) newRow.dataset.iy = iyToApply;
        });
        p.nl.forEach(l => addRow(elements.nodeLoadsTable, [`<input type="number" value="${l.n || l.node}">`, `<input type="number" value="${l.px||0}">`, `<input type="number" value="${l.py||0}">`, `<input type="number" value="${l.mz||0}">`], false));
        p.ml.forEach(l => addRow(elements.memberLoadsTable, [`<input type="number" value="${l.m || l.member}">`, `<input type="number" value="${l.w||0}">`], false));
        renumberTables();
        
        // プリセット読み込み完了フラグをクリア
        window.isLoadingPreset = false;
        
        // 自重考慮チェックボックスがONの場合、自重を再計算して表示を更新
        const considerSelfWeightCheckbox = document.getElementById('consider-self-weight-checkbox');
        if (considerSelfWeightCheckbox && considerSelfWeightCheckbox.checked) {
            // 自重考慮の表示を更新（密度列の追加など）
            updateSelfWeightDisplay();
        }
        
        // ★★★★★ 修正箇所 ★★★★★
        // 描画範囲の自動調整フラグをリセット
        panZoomState.isInitialized = false; 
        
        // 結果図のパン・ズーム状態もリセット
        Object.keys(resultPanZoomStates).forEach(key => {
            resultPanZoomStates[key].isInitialized = false;
        }); 
        
        drawOnCanvas();
        runFullAnalysis();
    };
    presets.forEach((p, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = p.name;
        if (p.disabled) {
            option.disabled = true;
            option.style.fontWeight = 'bold';
            option.style.backgroundColor = '#eee';
        }
        elements.presetSelector.appendChild(option);
    });
    elements.presetSelector.addEventListener('change', (e) => {
        loadPreset(e.target.value);
    });

    elements.addNodeBtn.onclick = () => {
        const nodes = Array.from(elements.nodesTable.rows).map(row => ({
            x: parseFloat(row.cells[1].querySelector('input').value),
            y: parseFloat(row.cells[2].querySelector('input').value)
        }));
        let newX = 0, newY = 0;
        if(nodes.length > 0) {
            const maxX = Math.max(...nodes.map(n => n.x));
            const nodeAtMaxX = nodes.find(n => n.x === maxX);
            newX = maxX + parseFloat(elements.gridSpacing.value);
            newY = nodeAtMaxX.y;
        }
        addRow(elements.nodesTable, [`#`, `<input type="number" value="${newX.toFixed(2)}">`, `<input type="number" value="${newY.toFixed(2)}">`, `<select><option value="free">自由</option><option value="pinned">ピン</option><option value="fixed">固定</option><option value="roller">ローラー</option></select>`, `<input type="number" value="0" step="0.1">`, `<input type="number" value="0" step="0.1">`, `<input type="number" value="0" step="0.001">`]);
    };
    elements.addMemberBtn.onclick = () => {
        const nodeCount = elements.nodesTable.rows.length;
        if (nodeCount < 2) {
            alert('部材を追加するには少なくとも2つの節点が必要です。');
            return;
        }
        const existingMembers = new Set();
        Array.from(elements.membersTable.rows).forEach(row => {
            const i = parseInt(row.cells[1].querySelector('input').value);
            const j = parseInt(row.cells[2].querySelector('input').value);
            existingMembers.add(`${Math.min(i,j)}-${Math.max(i,j)}`);
        });
        for (let i = 1; i <= nodeCount; i++) {
            for (let j = i + 1; j <= nodeCount; j++) {
                if (!existingMembers.has(`${i}-${j}`)) {
                    const I_m4 = parseFloat(newMemberDefaults.I) * 1e-8;
                    const A_m2 = parseFloat(newMemberDefaults.A) * 1e-4;
                    const Z_m3 = parseFloat(newMemberDefaults.Z) * 1e-6;
                    addRow(elements.membersTable, [`#`, ...memberRowHTML(i,j,newMemberDefaults.E,newMemberDefaults.F,I_m4,A_m2,Z_m3,newMemberDefaults.i_conn,newMemberDefaults.j_conn)]);
                    return;
                }
            }
        }
        alert('接続可能なすべての節点ペアは既に接続されています。');
    };
    elements.addNodeLoadBtn.onclick = () => { addRow(elements.nodeLoadsTable, ['<input type="number" value="1">', '<input type="number" value="0">', '<input type="number" value="0">', '<input type="number" value="0">']); };
    elements.addMemberLoadBtn.onclick = () => { addRow(elements.memberLoadsTable, ['<input type="number" value="1">', '<input type="number" value="0">']); };
    
    
    const saveInputData = () => {
        try {
            const state = getCurrentState();
            const csvSections = [];
            if (state.nodes.length > 0) {
                const header = 'x,y,support';
                const rows = state.nodes.map(n => `${n.x},${n.y},${n.support}`);
                csvSections.push('#NODES\n' + header + '\n' + rows.join('\n'));
            }
            if (state.members.length > 0) {
                const header = 'i,j,E,strengthType,strengthValue,I,A,Z,i_conn,j_conn,Zx,Zy,ix,iy,sectionLabel,sectionSummary,sectionSource,sectionInfo,sectionAxisKey,sectionAxisMode,sectionAxisLabel';
                const rows = state.members.map(m => {
                    const sectionLabel = m.sectionLabel ? encodeURIComponent(m.sectionLabel) : '';
                    const sectionSummary = m.sectionSummary ? encodeURIComponent(m.sectionSummary) : '';
                    const sectionSource = m.sectionSource ? encodeURIComponent(m.sectionSource) : '';
                    const sectionInfoEncoded = m.sectionInfoEncoded || (m.sectionInfo ? encodeURIComponent(JSON.stringify(m.sectionInfo)) : '');
                    const sectionAxisKey = m.sectionAxisKey || (m.sectionAxis && m.sectionAxis.key) || '';
                    const sectionAxisMode = m.sectionAxisMode || (m.sectionAxis && m.sectionAxis.mode) || '';
                    const sectionAxisLabelRaw = m.sectionAxisLabel || (m.sectionAxis && m.sectionAxis.label) || '';
                    const sectionAxisLabel = sectionAxisLabelRaw ? encodeURIComponent(sectionAxisLabelRaw) : '';
                    return `${m.i},${m.j},${m.E},${m.strengthType},${m.strengthValue},${m.I},${m.A},${m.Z},${m.i_conn},${m.j_conn},${m.Zx || ''},${m.Zy || ''},${m.ix || ''},${m.iy || ''},${sectionLabel},${sectionSummary},${sectionSource},${sectionInfoEncoded},${sectionAxisKey},${sectionAxisMode},${sectionAxisLabel}`;
                });
                csvSections.push('#MEMBERS\n' + header + '\n' + rows.join('\n'));
            }
            if (state.nodeLoads.length > 0) {
                const header = 'node,px,py,mz';
                const rows = state.nodeLoads.map(l => `${l.node},${l.px},${l.py},${l.mz}`);
                csvSections.push('#NODELOADS\n' + header + '\n' + rows.join('\n'));
            }
            if (state.memberLoads.length > 0) {
                const header = 'member,w';
                const rows = state.memberLoads.map(l => `${l.member},${l.w}`);
                csvSections.push('#MEMBERLOADS\n' + header + '\n' + rows.join('\n'));
            }
            const csvString = csvSections.join('\n\n');
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'frame-model.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            alert('CSVデータの保存に失敗しました: ' + error.message);
        }
    };
    const loadInputData = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.csv,text/csv';
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const text = event.target.result;
                    const state = { nodes: [], members: [], nodeLoads: [], memberLoads: [] };
                    const sections = text.split(/#\w+\s*/).filter(s => s.trim() !== '');
                    const headers = text.match(/#\w+/g) || [];
                    if (headers.length === 0 || sections.length === 0) throw new Error('有効なセクション（#NODESなど）が見つかりませんでした。');
                    headers.forEach((header, index) => {
                        const sectionText = sections[index];
                        if (!sectionText) return;
                        const lines = sectionText.trim().split(/\r?\n/), headerLine = lines.shift(), keys = headerLine.split(',');
                        lines.forEach(line => {
                            if (!line.trim()) return;
                            const values = line.split(','), obj = {};
                            keys.forEach((key, i) => obj[key.trim()] = values[i] ? values[i].trim() : '');
                            if (header === '#NODES') state.nodes.push(obj);
                            else if (header === '#MEMBERS') state.members.push(obj);
                            else if (header === '#NODELOADS') state.nodeLoads.push(obj);
                            else if (header === '#MEMBERLOADS') state.memberLoads.push(obj);
                        });
                    });
                    if (state.nodes.length === 0 && state.members.length === 0) throw new Error('ファイルから有効なデータを読み込めませんでした。');
                    historyStack = [];
                    pushState();
                    restoreState(state);
                    runFullAnalysis();
                } catch (error) {
                    alert('CSVファイルの読み込みに失敗しました: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    };
    // レポート用のテーブル HTML を生成する関数
    const generateReportTableHTML = (tableId) => {
        const table = document.getElementById(tableId);
        if (!table) return '';
        
        let html = '<table style="width:100%;border-collapse:collapse;margin-bottom:2em;">';
        
        // ヘッダー
        const thead = table.querySelector('thead');
        if (thead) {
            html += '<thead>';
            Array.from(thead.rows).forEach(row => {
                html += '<tr>';
                Array.from(row.cells).forEach(cell => {
                    html += `<th style="border:1px solid #ccc;padding:8px;text-align:center;background-color:#f0f8ff;">${cell.textContent}</th>`;
                });
                html += '</tr>';
            });
            html += '</thead>';
        }
        
        // ボディ
        const tbody = table.querySelector('tbody');
        if (tbody) {
            html += '<tbody>';
            Array.from(tbody.rows).forEach(row => {
                html += '<tr>';
                Array.from(row.cells).forEach((cell, cellIndex) => {
                    let cellContent = '';
                    
                    // 部材テーブルの基準強度列（4番目の列、インデックス3）の特別処理
                    if (tableId === 'members-table' && cellIndex === 4) {
                        const strengthContainer = cell.firstElementChild;
                        if (strengthContainer) {
                            const strengthType = strengthContainer.dataset.strengthType;
                            
                            switch(strengthType) {
                                case 'F-value':
                                case 'F-stainless':
                                case 'F-aluminum':
                                    const select = strengthContainer.querySelector('select');
                                    const input = strengthContainer.querySelector('input');
                                    if (select && input) {
                                        const selectedOption = select.options[select.selectedIndex];
                                        if (select.value === 'custom') {
                                            cellContent = `任意入力 (F=${input.value})`;
                                        } else {
                                            cellContent = selectedOption.textContent;
                                        }
                                    }
                                    break;
                                case 'wood-type':
                                    const presetSelect = strengthContainer.querySelector('select');
                                    if (presetSelect) {
                                        if (presetSelect.value === 'custom') {
                                            const inputs = strengthContainer.querySelectorAll('input');
                                            const values = Array.from(inputs).map(input => 
                                                `${input.id.split('-').pop()}=${input.value}`
                                            ).join(', ');
                                            cellContent = `任意入力 (${values})`;
                                        } else {
                                            const selectedOption = presetSelect.options[presetSelect.selectedIndex];
                                            cellContent = selectedOption.textContent;
                                        }
                                    }
                                    break;
                                default:
                                    cellContent = cell.textContent || '-';
                            }
                        } else {
                            cellContent = cell.textContent || '-';
                        }
                    } else {
                        // 通常のセル処理
                        const input = cell.querySelector('input');
                        const select = cell.querySelector('select');
                        if (input) {
                            cellContent = input.value || '-';
                        } else if (select) {
                            const selectedOption = select.options[select.selectedIndex];
                            cellContent = selectedOption ? selectedOption.textContent : '-';
                        } else {
                            cellContent = cell.textContent || '-';
                        }
                    }
                    
                    html += `<td style="border:1px solid #ccc;padding:8px;text-align:center;">${cellContent}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody>';
        }
        
        html += '</table>';
        return html;
    };

    const generateReport = () => {
        try {
            const modelCanvasImg=elements.modelCanvas.toDataURL('image/png');
            const displacementCanvasImg=elements.displacementCanvas.toDataURL('image/png');
            const momentCanvasImg=elements.momentCanvas.toDataURL('image/png');
            const axialCanvasImg=elements.axialCanvas.toDataURL('image/png');
            const shearCanvasImg=elements.shearCanvas.toDataURL('image/png');
            const ratioCanvasImg = elements.ratioCanvas.toDataURL('image/png');

            const reportWindow = window.open('', '_blank');
            // 座屈解析結果のレポート用HTML生成
            let bucklingReportHTML = '';
            if (lastBucklingResults && lastBucklingResults.length > 0) {
                bucklingReportHTML = `<div class="no-break"><h2>弾性座屈解析結果</h2>${generateReportTableHTML('buckling-analysis-results')}</div>`;
            }

            reportWindow.document.write(`<html><head><title>構造解析レポート</title><style>body{font-family:sans-serif;margin:2em;}h1,h2,h3{color:#005A9C;border-bottom:2px solid #f0f8ff;padding-bottom:5px;}table{width:100%;border-collapse:collapse;margin-bottom:2em;}th,td{border:1px solid #ccc;padding:8px;text-align:center;}th{background-color:#f0f8ff;}img{max-width:100%;height:auto;border:1px solid #ccc;margin:1em 0;}.grid{display:grid;grid-template-columns:1fr;gap:20px;}.no-break{page-break-inside:avoid;}@media print{body{margin:1em;}button{display:none;}}</style></head><body><button onclick="window.print()">レポートを印刷</button><h1>構造解析レポート</h1><p>生成日時: ${new Date().toLocaleString()}</p><div class="no-break"><h2>モデル図</h2><img src="${modelCanvasImg}"></div><h2>入力データ</h2><div class="no-break"><h3>節点座標と境界条件</h3>${generateReportTableHTML('nodes-table')}</div><div class="no-break"><h3>部材 (物性値・接合条件)</h3>${generateReportTableHTML('members-table')}</div><div class="no-break"><h3>節点荷重</h3>${generateReportTableHTML('node-loads-table')}</div><div class="no-break"><h3>部材等分布荷重</h3>${generateReportTableHTML('member-loads-table')}</div><h2>計算結果</h2><div class="no-break grid"><div><h3>変位図</h3><img src="${displacementCanvasImg}"></div><div><h3>曲げモーメント図</h3><img src="${momentCanvasImg}"></div><div><h3>軸力図</h3><img src="${axialCanvasImg}"></div><div><h3>せん断力図</h3><img src="${shearCanvasImg}"></div></div><div class="no-break">${generateReportTableHTML('displacement-results')}</div><div class="no-break">${generateReportTableHTML('reaction-results')}</div><div class="no-break">${generateReportTableHTML('force-results')}</div><div class="no-break"><h2>断面算定結果</h2><h3>検定比図</h3><img src="${ratioCanvasImg}"><h3>検定比 詳細</h3>${generateReportTableHTML('section-check-results')}</div>${bucklingReportHTML}</body></html>`);
            reportWindow.document.close();
        } catch (e) {
            alert('レポートの生成に失敗しました: ' + e.message);
            console.error("Report generation failed: ", e);
        }
    };
    
    const runFullAnalysis = () => {
        // プリセット読み込み中は解析をスキップ
        if (window.isLoadingPreset) {
            return;
        }
        calculate();
        runSectionCheck();
    };
    
    // Make runFullAnalysis globally accessible
    window.runFullAnalysis = runFullAnalysis;
    
    const runSectionCheck = () => {
        if (!lastResults) return;
        const selectedTerm = document.querySelector('input[name="load-term"]:checked').value;
        lastSectionCheckResults = calculateSectionCheck(selectedTerm);
        window.lastSectionCheckResults = lastSectionCheckResults; // グローバルに保存

        // エクセル出力用にも断面検定結果を保存
        if (lastAnalysisResult) {
            lastAnalysisResult.sectionCheckResults = lastSectionCheckResults;
        }

        displaySectionCheckResults();
        drawRatioDiagram();
    };
    elements.calculateBtn.addEventListener('click', runFullAnalysis);
    

    elements.calculateAndAnimateBtn.addEventListener('click', () => {
        runFullAnalysis();
        if (lastResults && lastResults.D) {
            animateDisplacement(lastResults.nodes, lastResults.members, lastResults.D, lastResults.memberLoads);
        }
    });
    
    document.body.classList.remove('section-check-disabled');
    elements.loadTermRadios.forEach(radio => radio.addEventListener('change', () => {
        if (lastResults) {
            runSectionCheck();
        }
    }));
    
    elements.gridToggle.addEventListener('change', drawOnCanvas);
    elements.gridSpacing.addEventListener('change', drawOnCanvas);
    
    // 部材情報表示チェックボックスのイベントリスナー
    if (elements.memberInfoToggle) {
        elements.memberInfoToggle.addEventListener('change', () => {
            // チェックが外された場合はツールチップを即座に非表示
            if (!elements.memberInfoToggle.checked) {
                hideMemberTooltip();
            }
        });
    }
    
    // 荷重表示制御チェックボックスのイベントリスナー
    const showExternalLoadsCheckbox = document.getElementById('show-external-loads');
    const showSelfWeightCheckbox = document.getElementById('show-self-weight');
    if (showExternalLoadsCheckbox) {
        showExternalLoadsCheckbox.addEventListener('change', drawOnCanvas);
    }
    if (showSelfWeightCheckbox) {
        showSelfWeightCheckbox.addEventListener('change', drawOnCanvas);
    }
    
    elements.saveBtn.addEventListener('click', saveInputData);
    elements.loadBtn.addEventListener('click', loadInputData);
    
    // ==========================================================================
    // モデル共有リンク機能
    // ==========================================================================
    const createShareLinkBtn = document.getElementById('create-share-link-btn');
    const shareLinkModal = document.getElementById('share-link-modal');
    const shareLinkModalClose = document.getElementById('share-link-modal-close');
    const shareLinkTextarea = document.getElementById('share-link-textarea');
    const copyShareLinkBtn = document.getElementById('copy-share-link-btn');
    let isShareLinkLoaded = false;

    // URLセーフなBase64エンコード関数
    function toBase64Url(u8) {
        return btoa(String.fromCharCode.apply(null, u8))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    // URLセーフなBase64デコード関数
    function fromBase64Url(str) {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) {
            str += '=';
        }
        const decoded = atob(str);
        const u8 = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; ++i) {
            u8[i] = decoded.charCodeAt(i);
        }
        return u8;
    }

    // 共有リンクを生成する関数
    const generateShareLink = () => {
        try {
            const state = getCurrentState();
            const jsonString = JSON.stringify(state);
            const compressed = pako.deflate(jsonString);
            const encodedData = toBase64Url(compressed);
            const baseUrl = window.location.href.split('#')[0];
            const shareUrl = `${baseUrl}#model=${encodedData}`;

            shareLinkTextarea.value = shareUrl;
            shareLinkModal.style.display = 'flex';
        } catch (error) {
            console.error("共有リンクの生成に失敗しました:", error);
            alert("共有リンクの生成に失敗しました。");
        }
    };

    // 共有リンクからモデルを読み込む関数
    const loadFromShareLink = () => {
        try {
            if (window.location.hash && window.location.hash.startsWith('#model=')) {
                console.log("共有リンクからモデルを読み込みます...");
                const encodedData = window.location.hash.substring(7);
                if (!encodedData) return;

                const compressed = fromBase64Url(encodedData);
                const jsonString = pako.inflate(compressed, { to: 'string' });
                const state = JSON.parse(jsonString);
                
                if (state && state.nodes) {
                    historyStack = [];
                    elements.nodesTable.innerHTML = '';
                    elements.membersTable.innerHTML = '';
                    elements.nodeLoadsTable.innerHTML = '';
                    elements.memberLoadsTable.innerHTML = '';
                    clearResults();

                    restoreState(state);
                    runFullAnalysis();
                    console.log("モデルの読み込みが完了しました。");
                    isShareLinkLoaded = true;
                    window.isShareLinkLoaded = true;
                    
                    history.replaceState(null, document.title, window.location.pathname + window.location.search);
                }
            }
        } catch (error) {
            console.error("共有リンクからのモデル読み込みに失敗しました:", error);
            alert("共有リンクからのモデル読み込みに失敗しました。リンクが破損している可能性があります。");
        }
    };

    // 共有モーダルのイベントリスナー
    if (createShareLinkBtn) {
        createShareLinkBtn.addEventListener('click', generateShareLink);
    }
    if (shareLinkModalClose) {
        shareLinkModalClose.addEventListener('click', () => shareLinkModal.style.display = 'none');
    }
    if (shareLinkModal) {
        shareLinkModal.addEventListener('click', (e) => {
            if (e.target === shareLinkModal) {
                shareLinkModal.style.display = 'none';
            }
        });
    }
    if (copyShareLinkBtn) {
        copyShareLinkBtn.addEventListener('click', () => {
            shareLinkTextarea.select();
            document.execCommand('copy');
            copyShareLinkBtn.textContent = 'コピーしました！';
            setTimeout(() => {
                copyShareLinkBtn.textContent = 'リンクをコピー';
            }, 2000);
        });
    }

    // ページ読み込み時に共有リンクをチェック
    loadFromShareLink();
    
    // エクセル出力ボタンのイベントリスナー追加（エラーチェック付き）
    if (elements.exportExcelBtn) {
        console.log('エクセル出力ボタンにイベントリスナーを追加しています...');
        elements.exportExcelBtn.addEventListener('click', exportToExcelHandler);
        console.log('エクセル出力ボタンのイベントリスナーが追加されました');
    } else {
        console.error('エクセル出力ボタンが見つかりません！');
    }
    
    elements.reportBtn.addEventListener('click', generateReport);
    window.addEventListener('resize', drawOnCanvas);

    elements.autoScaleBtn.addEventListener('click', () => {
        console.log('=== AUTO SCALE BUTTON CLICKED ===');
        console.log('panZoomState before reset:', JSON.stringify(panZoomState));
        panZoomState.isInitialized = false;
        console.log('panZoomState after reset:', JSON.stringify(panZoomState));
        console.log('Calling drawOnCanvas()...');
        drawOnCanvas();
        console.log('drawOnCanvas() completed');
        console.log('panZoomState after drawOnCanvas:', JSON.stringify(panZoomState));
        console.log('=== AUTO SCALE BUTTON PROCESS COMPLETED ===');
    });

    // 入力検証の初期化
    initializeExistingInputValidation();

    // 選択された要素を削除する関数
    const deleteSelectedElements = () => {
        if (selectedNodes.size === 0 && selectedMembers.size === 0) {
            console.log('削除対象の要素が選択されていません');
            return;
        }

        const nodeCount = selectedNodes.size;
        const memberCount = selectedMembers.size;
        
        // 確認ダイアログ
        let confirmMessage = '';
        if (nodeCount > 0 && memberCount > 0) {
            confirmMessage = `選択された節点${nodeCount}個と部材${memberCount}個を削除しますか？\n関連する荷重も同時に削除されます。`;
        } else if (nodeCount > 0) {
            confirmMessage = `選択された節点${nodeCount}個を削除しますか？\n関連する部材と荷重も同時に削除されます。`;
        } else {
            confirmMessage = `選択された部材${memberCount}個を削除しますか？\n関連する荷重も同時に削除されます。`;
        }
        
        if (!confirm(confirmMessage)) {
            return;
        }

        pushState(); // 元に戻す用の状態保存

        try {
            // 節点の削除処理
            if (selectedNodes.size > 0) {
                deleteSelectedNodes();
            }

            // 部材の削除処理
            if (selectedMembers.size > 0) {
                deleteSelectedMembers();
            }

            // 選択をクリア
            clearMultiSelection();

            // テーブルの番号を振り直し
            renumberTables();

            // 再描画
            drawOnCanvas();

            console.log(`削除完了: 節点${nodeCount}個, 部材${memberCount}個`);
            
        } catch (error) {
            console.error('削除処理中にエラーが発生しました:', error);
            alert('削除処理中にエラーが発生しました: ' + error.message);
        }
    };

    // 選択された節点を削除する関数
    const deleteSelectedNodes = () => {
        // 節点インデックスを降順でソート（後ろから削除して番号ずれを防ぐ）
        const sortedNodeIndices = Array.from(selectedNodes).sort((a, b) => b - a);
        
        sortedNodeIndices.forEach(nodeIndex => {
            if (nodeIndex < elements.nodesTable.rows.length) {
                const deletedNodeNumber = nodeIndex + 1;
                
                // この節点に関連する部材を削除
                const membersToDelete = [];
                Array.from(elements.membersTable.rows).forEach((row, idx) => {
                    const startInput = row.cells[1].querySelector('input');
                    const endInput = row.cells[2].querySelector('input');
                    const startNode = parseInt(startInput.value);
                    const endNode = parseInt(endInput.value);
                    
                    if (startNode === deletedNodeNumber || endNode === deletedNodeNumber) {
                        membersToDelete.push(row);
                    }
                });
                
                // 部材を削除
                membersToDelete.forEach(row => row.remove());
                
                // この節点に関連する荷重を削除
                const nodeLoadsToDelete = [];
                Array.from(elements.nodeLoadsTable.rows).forEach(row => {
                    const nodeInput = row.cells[0].querySelector('input');
                    const nodeNumber = parseInt(nodeInput.value);
                    if (nodeNumber === deletedNodeNumber) {
                        nodeLoadsToDelete.push(row);
                    }
                });
                
                nodeLoadsToDelete.forEach(row => row.remove());
                
                // 節点を削除
                elements.nodesTable.rows[nodeIndex].remove();
                
                // より大きな番号の節点番号を調整
                updateNodeNumbersAfterDeletion(deletedNodeNumber);
            }
        });
    };

    // 選択された部材を削除する関数
    const deleteSelectedMembers = () => {
        // 部材インデックスを降順でソート
        const sortedMemberIndices = Array.from(selectedMembers).sort((a, b) => b - a);
        
        sortedMemberIndices.forEach(memberIndex => {
            if (memberIndex < elements.membersTable.rows.length) {
                const deletedMemberNumber = memberIndex + 1;
                
                // この部材に関連する荷重を削除
                const memberLoadsToDelete = [];
                Array.from(elements.memberLoadsTable.rows).forEach(row => {
                    const memberInput = row.cells[0].querySelector('input');
                    const memberNumber = parseInt(memberInput.value);
                    if (memberNumber === deletedMemberNumber) {
                        memberLoadsToDelete.push(row);
                    }
                });
                
                memberLoadsToDelete.forEach(row => row.remove());
                
                // 部材を削除
                elements.membersTable.rows[memberIndex].remove();
                
                // より大きな番号の部材番号を調整
                updateMemberNumbersAfterDeletion(deletedMemberNumber);
            }
        });
    };

    // 節点削除後の番号調整
    const updateNodeNumbersAfterDeletion = (deletedNodeNumber) => {
        // 部材表の節点番号を更新
        Array.from(elements.membersTable.rows).forEach(row => {
            const startInput = row.cells[1].querySelector('input');
            const endInput = row.cells[2].querySelector('input');
            
            const startNode = parseInt(startInput.value);
            const endNode = parseInt(endInput.value);
            
            if (startNode > deletedNodeNumber) {
                startInput.value = startNode - 1;
            }
            if (endNode > deletedNodeNumber) {
                endInput.value = endNode - 1;
            }
        });
        
        // 節点荷重表の節点番号を更新
        Array.from(elements.nodeLoadsTable.rows).forEach(row => {
            const nodeInput = row.cells[0].querySelector('input');
            const nodeNumber = parseInt(nodeInput.value);
            
            if (nodeNumber > deletedNodeNumber) {
                nodeInput.value = nodeNumber - 1;
            }
        });
    };

    // 部材削除後の番号調整
    const updateMemberNumbersAfterDeletion = (deletedMemberNumber) => {
        // 部材荷重表の部材番号を更新
        Array.from(elements.memberLoadsTable.rows).forEach(row => {
            const memberInput = row.cells[0].querySelector('input');
            const memberNumber = parseInt(memberInput.value);
            
            if (memberNumber > deletedMemberNumber) {
                memberInput.value = memberNumber - 1;
            }
        });
    };

    elements.resetModelBtn.addEventListener('click', () => {
        if (confirm('本当にモデル情報を全てリセットしますか？この操作は元に戻せません。')) {
            panZoomState.isInitialized = false;
            historyStack = [];
            elements.nodesTable.innerHTML = '';
            elements.membersTable.innerHTML = '';
            elements.nodeLoadsTable.innerHTML = '';
            elements.memberLoadsTable.innerHTML = '';
            clearResults();
            drawOnCanvas();
        }
    });
    
    // Initial Load
    let initializedWithPreset = false;
    if (!isShareLinkLoaded) {
        loadPreset(15);
        if (elements.presetSelector) {
            elements.presetSelector.value = 15;
        }
        initializedWithPreset = true;
    } else {
        console.log('共有リンクからモデルを読み込んだため、初期プリセットをスキップします。');
    }
    setCanvasMode('select');
    
    // 初期化時に自重表示を更新
    if (initializedWithPreset) {
        setTimeout(() => {
            updateSelfWeightDisplay();
        }, 100); // プリセット読み込み後に実行
    }

    function applySectionAxisDataset(row, axisInfo) {
        if (!row) return;

        const normalizedAxis = normalizeAxisInfo(axisInfo);
        if (normalizedAxis) {
            row.dataset.sectionAxisKey = normalizedAxis.key;
            row.dataset.sectionAxisMode = normalizedAxis.mode;
            row.dataset.sectionAxisLabel = normalizedAxis.label;
        } else {
            delete row.dataset.sectionAxisKey;
            delete row.dataset.sectionAxisMode;
            delete row.dataset.sectionAxisLabel;
        }
    }

    function setRowSectionInfo(row, sectionInfo) {
        if (!(row instanceof HTMLTableRowElement) || !row.cells || typeof row.querySelector !== 'function') {
            console.warn('setRowSectionInfo called with invalid row element:', row);
            return;
        }

        const hasDensityColumn = row.querySelector('.density-cell') !== null;
        const sectionNameCellIndex = hasDensityColumn ? 9 : 8;
        const sectionAxisCellIndex = hasDensityColumn ? 10 : 9;

        if (sectionInfo) {
            const enrichedInfo = ensureSectionSvgMarkup(sectionInfo);
            try {
                row.dataset.sectionInfo = encodeURIComponent(JSON.stringify(enrichedInfo));
            } catch (error) {
                console.error('Failed to encode sectionInfo:', error, enrichedInfo);
                row.dataset.sectionInfo = '';
            }
            row.dataset.sectionLabel = enrichedInfo.label || '';
            row.dataset.sectionSummary = enrichedInfo.dimensionSummary || '';
            row.dataset.sectionSource = enrichedInfo.source || '';
            applySectionAxisDataset(row, enrichedInfo.axis);

            // 断面名称セルを更新
            const sectionNameCell = row.cells[sectionNameCellIndex];
            if (sectionNameCell) {
                const nameSpan = sectionNameCell.querySelector('.section-name-cell');
                if (nameSpan) {
                    nameSpan.textContent = enrichedInfo.label || '-';
                }
            }

            // 軸方向セルを更新
            const sectionAxisCell = row.cells[sectionAxisCellIndex];
            if (sectionAxisCell) {
                const axisSpan = sectionAxisCell.querySelector('.section-axis-cell');
                if (axisSpan) {
                    axisSpan.textContent = enrichedInfo.axis?.label || '-';
                }
            }
        } else {
            delete row.dataset.sectionInfo;
            delete row.dataset.sectionLabel;
            delete row.dataset.sectionSummary;
            delete row.dataset.sectionSource;
            applySectionAxisDataset(row, null);

            // 断面名称セルをクリア
            const sectionNameCell = row.cells[sectionNameCellIndex];
            if (sectionNameCell) {
                const nameSpan = sectionNameCell.querySelector('.section-name-cell');
                if (nameSpan) {
                    nameSpan.textContent = '-';
                }
            }

            // 軸方向セルをクリア
            const sectionAxisCell = row.cells[sectionAxisCellIndex];
            if (sectionAxisCell) {
                const axisSpan = sectionAxisCell.querySelector('.section-axis-cell');
                if (axisSpan) {
                    axisSpan.textContent = '-';
                }
            }
        }
    }

    function updateMemberProperties(memberIndex, props) {
        if (memberIndex >= 0 && memberIndex < elements.membersTable.rows.length) {
            const row = elements.membersTable.rows[memberIndex];
            const eSelect = row.cells[3].querySelector('select'), eInput = row.cells[3].querySelector('input[type="number"]');

            // E値の更新 (もしあれば)
            if (props.E) {
                const eValue = props.E.toString();
                eInput.value = eValue;
                eSelect.value = Array.from(eSelect.options).some(opt=>opt.value===eValue) ? eValue : 'custom';
                eInput.readOnly = eSelect.value !== 'custom';
                // E値の変更は強度入力欄の再生成をトリガーするため、changeイベントを発火させる
                eSelect.dispatchEvent(new Event('change'));
            }

            // ========== ここからが主要な修正点 ==========
            // props.F ではなく props.strengthValue をチェックし、タイプに応じて値を設定
            if (props.strengthValue) {
                // E値変更で再生成された後の要素を確実につかむため、少し待機する
                setTimeout(() => {
                    const strengthInputContainer = row.cells[4].firstElementChild;
                    if (strengthInputContainer) {
                        const s_input = strengthInputContainer.querySelector('input');
                        const s_select = strengthInputContainer.querySelector('select');
                        const s_type = props.strengthType;
                        const s_value = props.strengthValue;

                        if (s_type === 'wood-type') {
                            // 木材の場合：selectの値を更新
                            if(s_select) s_select.value = s_value;
                        } else {
                            // 鋼材、コンクリート、その他F値を持つ材料の場合
                            if(s_select && s_input) {
                                // プリセットに値が存在するかチェック
                                const isPreset = Array.from(s_select.options).some(opt => opt.value === s_value.toString());
                                if(isPreset) {
                                    s_select.value = s_value;
                                    s_input.value = s_value;
                                    s_input.readOnly = true;
                                } else {
                                    s_select.value = 'custom';
                                    s_input.value = s_value;
                                    s_input.readOnly = false;
                                }
                            }
                        }
                    }
                }, 0);
            }
            // ========== ここまでが主要な修正点 ==========
            
            const inertiaInputEl = row.cells[5]?.querySelector('input[type="number"]');
            const areaInputEl = row.cells[6]?.querySelector('input[type="number"]');
            const modulusInputEl = row.cells[7]?.querySelector('input[type="number"]');

            if (typeof memberIndex === 'number') {
                if (inertiaInputEl && props.I !== undefined && props.I !== null) {
                    inertiaInputEl.value = props.I;
                }
                if (areaInputEl && props.A !== undefined && props.A !== null) {
                    areaInputEl.value = props.A;
                }
                if (modulusInputEl && props.Z !== undefined && props.Z !== null) {
                    modulusInputEl.value = props.Z;
                }

                // 断面名称と軸方向のセルを更新（密度列の有無を考慮）
                const hasDensityColumn = row.querySelector('.density-cell') !== null;
                const sectionNameCellIndex = hasDensityColumn ? 9 : 8;
                const sectionAxisCellIndex = hasDensityColumn ? 10 : 9;

                const sectionNameCell = row.cells[sectionNameCellIndex];
                const sectionAxisCell = row.cells[sectionAxisCellIndex];

                // sectionNameまたはsectionLabelを取得
                const displaySectionName = props.sectionName || props.sectionLabel || '';
                // axisまたはsectionAxisLabelを取得
                const displayAxisLabel = props.sectionAxisLabel || (props.sectionAxis ? props.sectionAxis.label : null) || props.axis || '';

                if (sectionNameCell) {
                    const sectionNameSpan = sectionNameCell.querySelector('.section-name-cell');
                    if (sectionNameSpan && displaySectionName) {
                        sectionNameSpan.textContent = displaySectionName;
                    }
                }

                if (sectionAxisCell) {
                    const sectionAxisSpan = sectionAxisCell.querySelector('.section-axis-cell');
                    if (sectionAxisSpan && displayAxisLabel) {
                        sectionAxisSpan.textContent = displayAxisLabel;
                    }
                }
            }

            const normalizeAxisFromProps = () => {
                if (props.sectionAxis) {
                    return normalizeAxisInfo(props.sectionAxis);
                }
                if (props.sectionInfo?.axis) {
                    return normalizeAxisInfo(props.sectionInfo.axis);
                }
                if (row.dataset.sectionAxisKey || row.dataset.sectionAxisMode || row.dataset.sectionAxisLabel) {
                    return normalizeAxisInfo({
                        key: row.dataset.sectionAxisKey,
                        mode: row.dataset.sectionAxisMode,
                        label: row.dataset.sectionAxisLabel
                    });
                }
                return null;
            };

            const axisInfo = normalizeAxisFromProps();
            const setDatasetValue = (key, value) => {
                if (value !== undefined && value !== null && value !== '') {
                    row.dataset[key] = value;
                } else {
                    delete row.dataset[key];
                }
            };

            const resolvedZx = props.Zx ?? (axisInfo?.key === 'both' ? props.Z : undefined);
            const resolvedZy = props.Zy ?? (axisInfo?.key === 'both' ? props.Z : undefined);
            const resolvedIx = props.ix ?? (axisInfo?.key === 'both' ? props.iy : undefined);
            const resolvedIy = props.iy ?? (axisInfo?.key === 'both' ? props.ix : undefined);

            setDatasetValue('zx', resolvedZx);
            setDatasetValue('zy', resolvedZy);
            setDatasetValue('ix', resolvedIx);
            setDatasetValue('iy', resolvedIy);

            if (props.sectionInfo) {
                setRowSectionInfo(row, props.sectionInfo);
            } else if (props.sectionAxis) {
                applySectionAxisDataset(row, props.sectionAxis);
            }
            
            // 変更を計算に反映させるためにchangeイベントを発火
            inertiaInputEl?.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            console.error(`無効な部材インデックス: ${memberIndex}`);
        }
    }


    window.addEventListener('storage', (e) => {
        if (e.key === 'steelSelectionForFrameAnalyzer' && e.newValue) {
            try {
                const data = JSON.parse(e.newValue);
                if (data && data.targetMemberIndex !== undefined && data.properties) {
                    if (data.targetMemberIndex === 'bulk') {
                        window.bulkSectionProperties = data.properties;
                        if (typeof updateBulkSectionInfo === 'function') {
                            updateBulkSectionInfo(data.properties);
                        }
                    } else if (data.targetMemberIndex === 'addDefaults') {
                        // 新規部材追加時の処理
                        const props = data.properties;
                        console.log('✅ 部材追加設定(addDefaults)の断面データを受信:', props);

                        // ポップアップ内の入力欄を更新
                        document.getElementById('add-popup-i').value = props.I;
                        document.getElementById('add-popup-a').value = props.A;
                        document.getElementById('add-popup-z').value = props.Z;

                        // デフォルト値を更新
                        newMemberDefaults.I = props.I;
                        newMemberDefaults.A = props.A;
                        newMemberDefaults.Z = props.Z;

                        // 断面情報（名称と軸）を保存・表示
                        const sectionName = props.sectionName || props.sectionLabel || '';
                        const axisLabel = props.selectedAxis || props.sectionAxisLabel || (props.sectionAxis ? props.sectionAxis.label : null) || '-';

                        if (sectionName) {
                            newMemberDefaults.sectionName = sectionName;
                            newMemberDefaults.sectionAxis = axisLabel;

                            const infoDiv = document.getElementById('add-popup-section-info');
                            const nameSpan = document.getElementById('add-popup-section-name');
                            const axisSpan = document.getElementById('add-popup-section-axis');

                            if (infoDiv && nameSpan && axisSpan) {
                                nameSpan.textContent = sectionName;
                                axisSpan.textContent = axisLabel;
                                infoDiv.style.display = 'block';
                            }
                        }
                    } else {
                        updateMemberProperties(data.targetMemberIndex, data.properties);
                    }
                    localStorage.removeItem('steelSelectionForFrameAnalyzer');
                }
            } catch (error) {
                console.error('localStorageからのデータ解析に失敗しました:', error);
            }
        }
    });

    // 自動スケーリング機能（手動ボタン用）
    window.triggerAutoScale = () => {
        console.log('Auto scale button clicked - resetting panZoomState');
        panZoomState.isInitialized = false;
        drawOnCanvas();
        console.log('Auto scale completed. New panZoomState:', panZoomState);
    };
    
    // 手動でリサイズを実行する関数（デバッグ用）
    window.triggerManualResize = () => {
        console.log('Manual resize triggered');
        panZoomState.isInitialized = false;
        drawOnCanvas();
    };

    // リサイズ検出機能（ResizeObserverを使用）
    const modelCanvasContainer = document.querySelector('.input-section .canvas-container');
    console.log('modelCanvasContainer element:', modelCanvasContainer);
    
    if (modelCanvasContainer) {
        console.log('Container found, setting up ResizeObserver...');
        let lastKnownSize = { width: 0, height: 0 };
        
        // ResizeObserver対応確認
        if (typeof ResizeObserver === 'undefined') {
            console.error('ResizeObserver is not supported in this browser');
            return;
        }
        
        console.log('ResizeObserver is supported, creating observer...');
        
        // ResizeObserverを使用してコンテナのリサイズを監視
        const resizeObserver = new ResizeObserver((entries) => {
            console.log('=== ResizeObserver triggered ===');
            console.log('Entries count:', entries.length);
            
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                const currentSize = { width: Math.round(width), height: Math.round(height) };
                
                console.log('Current size:', currentSize, 'Last known size:', lastKnownSize);
                
                // サイズが実際に変更された場合のみ処理
                if (currentSize.width !== lastKnownSize.width || currentSize.height !== lastKnownSize.height) {
                    console.log('ResizeObserver: Container resized from', lastKnownSize, 'to', currentSize);
                    lastKnownSize = currentSize;
                    
                    console.log('panZoomState before reset:', JSON.stringify(panZoomState));
                    // 自動スケーリングを実行
                    panZoomState.isInitialized = false;
                    console.log('panZoomState after reset:', JSON.stringify(panZoomState));
                    console.log('Calling drawOnCanvas...');
                    drawOnCanvas();
                    console.log('drawOnCanvas completed');
                } else {
                    console.log('Size unchanged, skipping resize processing');
                }
            }
            console.log('=== ResizeObserver processing completed ===');
        });
        
        console.log('ResizeObserver created, now observing container...');
        resizeObserver.observe(modelCanvasContainer);
        console.log('ResizeObserver.observe() called successfully');
        
        // 初期サイズを記録
        setTimeout(() => {
            const rect = modelCanvasContainer.getBoundingClientRect();
            lastKnownSize = { width: Math.round(rect.width), height: Math.round(rect.height) };
            console.log('Initial container size recorded:', lastKnownSize);
        }, 100);
    } else {
        console.error('modelCanvasContainer not found! Selector: .input-section .canvas-container');
        
        // デバッグ用: 存在する要素を確認
        const inputSection = document.querySelector('.input-section');
        const canvasContainers = document.querySelectorAll('.canvas-container');
        console.log('inputSection found:', inputSection);
        console.log('All canvas-container elements:', canvasContainers);
    }

    // 代替リサイズ検出方法（フォールバック）
    let fallbackLastSize = { width: 0, height: 0 };
    
    const fallbackResizeCheck = () => {
        const container = document.querySelector('.input-section .canvas-container');
        if (container) {
            const rect = container.getBoundingClientRect();
            const currentSize = { width: Math.round(rect.width), height: Math.round(rect.height) };
            
            if (currentSize.width !== fallbackLastSize.width || currentSize.height !== fallbackLastSize.height) {
                console.log('=== FALLBACK RESIZE DETECTED ===');
                console.log('Size changed from', fallbackLastSize, 'to', currentSize);
                fallbackLastSize = currentSize;
                
                console.log('panZoomState before reset:', JSON.stringify(panZoomState));
                panZoomState.isInitialized = false;
                console.log('panZoomState after reset:', JSON.stringify(panZoomState));
                console.log('Calling drawOnCanvas...');
                drawOnCanvas();
                console.log('Fallback resize processing completed');
            }
        }
    };
    
    // 初期サイズを記録（フォールバック用）
    setTimeout(() => {
        const container = document.querySelector('.input-section .canvas-container');
        if (container) {
            const rect = container.getBoundingClientRect();
            fallbackLastSize = { width: Math.round(rect.width), height: Math.round(rect.height) };
            console.log('Fallback initial size recorded:', fallbackLastSize);
        }
    }, 200);
    
    // 定期的なサイズチェック（フォールバック）
    setInterval(fallbackResizeCheck, 500);
    
    // マウスイベント時のチェック（リサイズハンドル操作検出）
    document.addEventListener('mouseup', () => {
        console.log('Mouse up detected, checking for resize...');
        setTimeout(fallbackResizeCheck, 50);
    });
    
    document.addEventListener('mousemove', (e) => {
        // リサイズ中かどうかをチェック（カーソルがリサイズ用の場合）
        if (e.target && e.target.closest && e.target.closest('.input-section .canvas-container')) {
            const container = e.target.closest('.input-section .canvas-container');
            const rect = container.getBoundingClientRect();
            const isNearBottomRight = (e.clientY > rect.bottom - 20) && (e.clientX > rect.right - 20);
            
            if (isNearBottomRight) {
                // リサイズハンドル付近でのマウス移動を検出
                setTimeout(fallbackResizeCheck, 100);
            }
        }
    });



    // SheetJSライブラリの動的読み込み
    function loadSheetJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => {
                console.log('SheetJSライブラリが読み込まれました');
                resolve();
            };
            script.onerror = () => {
                reject(new Error('SheetJSライブラリの読み込みに失敗しました'));
            };
            document.head.appendChild(script);
        });
    }

    // エクセルファイル生成・出力
    async function exportToExcel() {
        console.log('エクセルファイルを生成中...');
        
        // ワークブック作成
        const workbook = XLSX.utils.book_new();
        
        try {
            // 1. 入力データシート
            await addInputDataSheet(workbook);
            
            // 2. 解析結果シート
            if (lastAnalysisResult && lastAnalysisResult.displacements) {
                await addAnalysisResultSheet(workbook);
            }
            
            // 3. 断面検定結果シート
            if ((lastAnalysisResult && lastAnalysisResult.sectionCheckResults && lastAnalysisResult.sectionCheckResults.length > 0) ||
                (lastSectionCheckResults && lastSectionCheckResults.length > 0)) {
                await addSectionCheckSheet(workbook);
            }
            
            // 4. 座屈解析結果シート
            if (lastBucklingResults && lastBucklingResults.length > 0) {
                await addBucklingAnalysisSheet(workbook);
            }
            
            // ファイル名生成
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-T]/g, '');
            const filename = `構造解析結果_${timestamp}.xlsx`;
            
            // エクセルファイル出力
            XLSX.writeFile(workbook, filename);
            
            console.log('エクセルファイルが正常に出力されました:', filename);
            alert('エクセルファイルが正常に出力されました: ' + filename);
            
        } catch (error) {
            console.error('エクセルファイル生成でエラーが発生しました:', error);
            throw error;
        }
    }

    // 入力データシート作成
    async function addInputDataSheet(workbook) {
        console.log('入力データシートを作成中...');
        
        const data = [];
        
        // ヘッダー情報
        data.push(['2次元フレームの構造解析結果']);
        data.push(['生成日時', new Date().toLocaleString('ja-JP')]);
        data.push([]);
        
        try {
            const inputs = parseInputs();
            
            // 節点データ
            data.push(['■ 節点データ']);
            data.push(['節点番号', 'X座標(m)', 'Y座標(m)', '境界条件']);
            inputs.nodes.forEach((node, i) => {
                data.push([i + 1, node.x, node.y, node.support]);
            });
            data.push([]);
            
            // 部材データ
            data.push(['■ 部材データ']);
            data.push(['部材番号', 'i節点', 'j節点', '長さ(m)', '材料', 'E(N/mm²)', 'A(mm²)', 'I(mm⁴)', 'i端接合', 'j端接合']);
            inputs.members.forEach((member, i) => {
                data.push([
                    i + 1, 
                    member.i + 1, 
                    member.j + 1, 
                    member.length.toFixed(3),
                    member.material || '不明',
                    member.E || 0,
                    member.A || 0,
                    member.I || 0,
                    member.i_conn || 'fixed',
                    member.j_conn || 'fixed'
                ]);
            });
            data.push([]);
            
            // 節点荷重データ
            if (inputs.nodeLoads && inputs.nodeLoads.length > 0) {
                data.push(['■ 節点荷重データ']);
                data.push(['節点番号', 'Px(kN)', 'Py(kN)', 'Mz(kN·m)']);
                inputs.nodeLoads.forEach(load => {
                    if (load.px !== 0 || load.py !== 0 || load.mz !== 0) {
                        data.push([load.nodeIndex + 1, load.px, load.py, load.mz]);
                    }
                });
                data.push([]);
            }
            
            // 部材荷重データ
            if (inputs.memberLoads && inputs.memberLoads.length > 0) {
                data.push(['■ 部材荷重データ']);
                data.push(['部材番号', '分布荷重(kN/m)']);
                inputs.memberLoads.forEach(load => {
                    if (load.w !== 0) {
                        data.push([load.memberIndex + 1, load.w]);
                    }
                });
            }
            
        } catch (error) {
            console.error('入力データの解析でエラーが発生しました:', error);
            data.push(['※入力データの解析でエラーが発生しました']);
        }
        
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, '入力データ');
    }

    // 解析結果シート作成
    async function addAnalysisResultSheet(workbook) {
        console.log('解析結果シートを作成中...');
        
        const data = [];
        data.push(['■ 解析結果']);
        data.push([]);
        
        if (lastAnalysisResult && lastAnalysisResult.displacements && lastAnalysisResult.displacements.length > 0) {
            data.push(['■ 節点変位結果']);
            data.push(['節点番号', 'X変位(mm)', 'Y変位(mm)', '回転(rad)']);
            lastAnalysisResult.displacements.forEach((disp, i) => {
                data.push([i + 1, (disp.x * 1000).toFixed(3), (disp.y * 1000).toFixed(3), disp.rotation.toFixed(6)]);
            });
            data.push([]);
        } else {
            data.push(['※ 節点変位結果がありません']);
            data.push([]);
        }
        
        if (lastAnalysisResult && lastAnalysisResult.forces && lastAnalysisResult.forces.length > 0) {
            data.push(['■ 部材力結果']);
            data.push(['部材番号', 'i端軸力(kN)', 'i端せん断力(kN)', 'i端曲げモーメント(kN·m)', 'j端軸力(kN)', 'j端せん断力(kN)', 'j端曲げモーメント(kN·m)']);
            lastAnalysisResult.forces.forEach((force, i) => {
                data.push([
                    i + 1, 
                    force.i.N.toFixed(2), 
                    force.i.Q.toFixed(2), 
                    force.i.M.toFixed(2),
                    force.j.N.toFixed(2), 
                    force.j.Q.toFixed(2), 
                    force.j.M.toFixed(2)
                ]);
            });
        } else {
            data.push(['※ 部材力結果がありません']);
        }
        
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, '解析結果');
    }

    // 断面検定結果シート作成
    async function addSectionCheckSheet(workbook) {
        console.log('断面検定結果シートを作成中...');
        
        const data = [];
        data.push(['■ 断面検定結果']);
        data.push([]);
        data.push(['部材番号', '軸力(kN)', '曲げモーメント(kN·m)', '検定項目', '検定比', '判定', '材料情報', '詳細計算結果']);
        
        // 優先順位: lastAnalysisResult.sectionCheckResults > lastSectionCheckResults
        const sectionResults = (lastAnalysisResult && lastAnalysisResult.sectionCheckResults) || lastSectionCheckResults;
        
        if (sectionResults && sectionResults.length > 0) {
            sectionResults.forEach((result, i) => {
                // 検定比の表示
                let ratioText = '-';
                if (typeof result.maxRatio === 'number' && isFinite(result.maxRatio)) {
                    ratioText = result.maxRatio.toFixed(3);
                } else if (result.maxRatio) {
                    ratioText = result.maxRatio.toString();
                }
                
                // 判定
                let judgment = '-';
                if (result.status) {
                    judgment = result.status === 'NG' ? 'NG' : 'OK';
                } else if (typeof result.maxRatio === 'number') {
                    judgment = result.maxRatio <= 1.0 ? 'OK' : 'NG';
                }
                
                // 材料情報の取得（弾性係数から材料名を取得）
                let materialInfo = '';
                if (lastAnalysisResult && lastAnalysisResult.members && lastAnalysisResult.members[i]) {
                    const member = lastAnalysisResult.members[i];
                    
                    // 弾性係数から材料名を取得
                    const getMaterialNameFromE = (eValue) => {
                        const materials = { 
                            "205000000": "スチール", 
                            "193000000": "ステンレス", 
                            "70000000": "アルミニウム", 
                            "7000000": "木材", 
                            "8000000": "木材", 
                            "9000000": "木材", 
                            "10000000": "木材" 
                        };
                        const eStr = Math.round(eValue).toString();
                        return materials[eStr] || `任意材料(E=${(eValue/1000000).toLocaleString()}GPa)`;
                    };
                    
                    if (member.E) {
                        const materialName = getMaterialNameFromE(member.E);
                        if (member.strengthProps && member.strengthProps.value) {
                            materialInfo = `${materialName} (F=${member.strengthProps.value})`;
                        } else {
                            materialInfo = materialName;
                        }
                    } else if (member.strengthProps) {
                        materialInfo = `${member.strengthProps.type}: ${member.strengthProps.value}`;
                    } else if (member.material) {
                        materialInfo = member.material;
                    }
                }
                
                // 詳細計算結果の作成
                let detailResults = '';
                if (result.details) {
                    detailResults = result.details;
                } else if (result.ratios && result.ratios.length > 0) {
                    // 応力度と許容応力度の詳細
                    const details = [];
                    if (result.σt !== undefined && result.ft !== undefined) {
                        details.push(`引張: σt=${result.σt?.toFixed(2) || 0} ≤ ft=${result.ft?.toFixed(2) || 0} (${(result.σt/result.ft)?.toFixed(3) || 0})`);
                    }
                    if (result.σc !== undefined && result.fc !== undefined) {
                        details.push(`圧縮: σc=${result.σc?.toFixed(2) || 0} ≤ fc=${result.fc?.toFixed(2) || 0} (${(result.σc/result.fc)?.toFixed(3) || 0})`);
                    }
                    if (result.σb !== undefined && result.fb !== undefined) {
                        details.push(`曲げ: σb=${result.σb?.toFixed(2) || 0} ≤ fb=${result.fb?.toFixed(2) || 0} (${(result.σb/result.fb)?.toFixed(3) || 0})`);
                    }
                    if (result.τ !== undefined && result.fs !== undefined) {
                        details.push(`せん断: τ=${result.τ?.toFixed(2) || 0} ≤ fs=${result.fs?.toFixed(2) || 0} (${(result.τ/result.fs)?.toFixed(3) || 0})`);
                    }
                    
                    if (details.length > 0) {
                        detailResults = details.join('; ');
                    } else if (lastAnalysisResult && lastAnalysisResult.members && lastAnalysisResult.members[i]) {
                        const member = lastAnalysisResult.members[i];
                        const N = result.N || 0;
                        const M = result.M || 0;
                        const A = member.A || 1;
                        const Z = member.Z || 1;
                        
                        const σ_axial = Math.abs(N * 1000 / (A * 1e6)); // N/mm²
                        const σ_bending = Math.abs(M * 1e6 / (Z * 1e9)); // N/mm²
                        const σ_combined = σ_axial + σ_bending;
                        
                        detailResults = `軸応力度: ${σ_axial.toFixed(2)} N/mm²; 曲げ応力度: ${σ_bending.toFixed(2)} N/mm²; 合成: ${σ_combined.toFixed(2)} N/mm²`;
                    }
                }
                
                data.push([
                    i + 1,
                    (result.N || 0).toFixed(2),
                    (result.M || 0).toFixed(2),
                    result.checkType || '不明',
                    ratioText,
                    judgment,
                    materialInfo || '不明',
                    detailResults || '-'
                ]);
            });
            
            // 各部材の詳細応力度計算結果を追加
            data.push([]);
            data.push(['■ 各部材の詳細応力度計算結果']);
            data.push([]);
            
            // 計算に必要なデータを取得
            if (lastResults) {
                const { members, forces, memberLoads } = lastResults;
                const selectedTerm = document.querySelector('input[name="load-term"]:checked')?.value || 'short';
                
                sectionResults.forEach((result, memberIndex) => {
                    const member = members[memberIndex];
                    const force = forces[memberIndex];
                    const load = memberLoads.find(l => l.memberIndex === memberIndex);
                    const w = load ? load.w : 0;
                    const L = member.length;
                    
                    // 材料特性の取得
                    const { strengthProps, A, Z, ix, iy, E } = member;
                    let materialInfo = '';
                    let allowableStresses = { ft: 0, fc: 0, fb: 0, fs: 0 };
                    
                    // 弾性係数から材料名を取得する関数
                    const getMaterialNameFromE_Detail = (eValue) => {
                        const materials = { 
                            "205000000": "スチール", 
                            "193000000": "ステンレス", 
                            "70000000": "アルミニウム", 
                            "7000000": "木材", 
                            "8000000": "木材", 
                            "9000000": "木材", 
                            "10000000": "木材" 
                        };
                        const eStr = Math.round(eValue).toString();
                        return materials[eStr] || `任意材料(E=${(eValue/1000000).toLocaleString()}GPa)`;
                    };
                    
                    const termIndex = (selectedTerm === 'long') ? 0 : 1;
                    
                    switch(strengthProps.type) {
                        case 'F-value':
                        case 'F-stainless':
                        case 'F-aluminum':
                            const F = strengthProps.value;
                            const factor = (selectedTerm === 'long') ? 1.5 : 1.0;
                            const materialName = getMaterialNameFromE_Detail(E);
                            materialInfo = `${materialName} (F=${F} N/mm²)`;
                            allowableStresses.ft = F / factor;
                            allowableStresses.fb = F / factor;
                            allowableStresses.fs = F / (factor * Math.sqrt(3));
                            
                            // 座屈を考慮した圧縮許容応力度
                            const lk = L, i_min = Math.min(ix, iy);
                            allowableStresses.fc = allowableStresses.ft;
                            if (i_min > 1e-9) {
                                const lambda = lk / i_min, E_n_mm2 = E * 1e-3;
                                const lambda_p = Math.PI * Math.sqrt(E_n_mm2 / (0.6 * F));
                                if (lambda <= lambda_p) {
                                    allowableStresses.fc = (1 - 0.4 * (lambda / lambda_p)**2) * F / factor;
                                } else {
                                    allowableStresses.fc = (0.277 * F) / ((lambda / lambda_p)**2);
                                }
                            }
                            break;
                        case 'wood-type':
                            const woodPreset = strengthProps.preset;
                            const woodMaterialName = getMaterialNameFromE_Detail(E);
                            if (woodPreset === 'custom') {
                                materialInfo = `${woodMaterialName} (任意入力)`;
                                const customShortStresses = strengthProps.stresses;
                                if (selectedTerm === 'long') {
                                    allowableStresses.ft = customShortStresses.ft * 1.1 / 2;
                                    allowableStresses.fc = customShortStresses.fc * 1.1 / 2;
                                    allowableStresses.fb = customShortStresses.fb * 1.1 / 2;
                                    allowableStresses.fs = customShortStresses.fs * 1.1 / 2;
                                } else {
                                    allowableStresses.ft = customShortStresses.ft;
                                    allowableStresses.fc = customShortStresses.fc;
                                    allowableStresses.fb = customShortStresses.fb;
                                    allowableStresses.fs = customShortStresses.fs;
                                }
                            } else {
                                const baseStresses = WOOD_BASE_STRENGTH_DATA[woodPreset];
                                materialInfo = `${woodMaterialName} (${baseStresses.name})`;
                                const factor = (selectedTerm === 'long') ? (1.1 / 3) : (2 / 3);
                                allowableStresses.ft = baseStresses.ft * factor;
                                allowableStresses.fc = baseStresses.fc * factor;
                                allowableStresses.fb = baseStresses.fb * factor;
                                allowableStresses.fs = baseStresses.fs * factor;
                            }
                            break;
                        default:
                            const defaultMaterialName = getMaterialNameFromE_Detail(E);
                            materialInfo = defaultMaterialName;
                    }
                    
                    // 部材の詳細情報を出力
                    data.push([`部材 ${memberIndex + 1} の詳細計算`]);
                    data.push([]);
                    data.push(['項目', '値', '単位', '備考']);
                    
                    // 部材情報
                    data.push(['材料', materialInfo, '', '']);
                    data.push(['部材長', L.toFixed(3), 'm', '']);
                    data.push(['断面積 A', (A * 1e4).toFixed(2), 'cm²', '']);
                    data.push(['断面係数 Z', (Z * 1e6).toFixed(2), 'cm³', '']);
                    data.push(['回転半径 ix', (ix * 1e2).toFixed(2), 'cm', '']);
                    data.push(['回転半径 iy', (iy * 1e2).toFixed(2), 'cm', '']);
                    if (w !== 0) data.push(['等分布荷重', w, 'kN/m', '']);
                    data.push([]);
                    
                    // 許容応力度
                    data.push(['許容応力度', `(${selectedTerm === 'long' ? '長期' : '短期'})`, '', '']);
                    data.push(['引張許容応力度 ft', allowableStresses.ft.toFixed(2), 'N/mm²', '']);
                    data.push(['圧縮許容応力度 fc', allowableStresses.fc.toFixed(2), 'N/mm²', '']);
                    data.push(['曲げ許容応力度 fb', allowableStresses.fb.toFixed(2), 'N/mm²', '']);
                    data.push(['せん断許容応力度 fs', allowableStresses.fs.toFixed(2), 'N/mm²', '']);
                    data.push([]);
                    
                    // 部材端力
                    data.push(['部材端力']);
                    data.push(['i端 軸力', (-force.N_i).toFixed(2), 'kN', '']);
                    data.push(['i端 せん断力', force.Q_i.toFixed(2), 'kN', '']);
                    data.push(['i端 曲げモーメント', force.M_i.toFixed(2), 'kN·m', '']);
                    data.push(['j端 軸力', force.N_j.toFixed(2), 'kN', '']);
                    data.push(['j端 せん断力', (-force.Q_j).toFixed(2), 'kN', '']);
                    data.push(['j端 曲げモーメント', force.M_j.toFixed(2), 'kN·m', '']);
                    data.push([]);
                    
                    // 応力度計算結果（21点での詳細計算）
                    data.push(['位置別応力度計算結果']);
                    data.push(['位置(m)', '軸力(kN)', 'モーメント(kN·m)', '軸応力度(N/mm²)', '曲げ応力度(N/mm²)', '合成応力度(N/mm²)', '検定比']);
                    
                    const numPoints = result.ratios ? result.ratios.length : 21;
                    for (let k = 0; k < numPoints; k++) {
                        const x = (k / (numPoints - 1)) * L;
                        
                        // 軸力（一定）
                        const N = Math.abs(-force.N_i);
                        
                        // モーメントの計算
                        let M;
                        if (w !== 0) {
                            M = Math.abs(force.M_i + force.Q_i * x - 0.5 * w * x**2);
                        } else {
                            M = Math.abs(force.M_i + force.Q_i * x);
                        }
                        
                        // 応力度計算
                        const sigma_axial = N * 1000 / (A * 1e6);
                        const sigma_bending = M * 1e6 / (Z * 1e9);
                        const sigma_combined = sigma_axial + sigma_bending;
                        
                        // 検定比計算
                        let checkRatio = 0;
                        if (N >= 0) { // 引張
                            checkRatio = sigma_combined / allowableStresses.ft;
                        } else { // 圧縮
                            checkRatio = sigma_combined / allowableStresses.fc;
                        }
                        
                        data.push([
                            x.toFixed(3),
                            N.toFixed(2),
                            M.toFixed(2),
                            sigma_axial.toFixed(2),
                            sigma_bending.toFixed(2),
                            sigma_combined.toFixed(2),
                            (result.ratios ? result.ratios[k] : checkRatio).toFixed(3)
                        ]);
                    }
                    data.push([]);
                });
            }
            
        } else {
            data.push(['※ 断面検定結果がありません']);
            data.push(['※ 「計算実行 & アニメーション表示」ボタンで解析を実行してから出力してください']);
        }
        
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, '断面検定結果');
    }

    // 座屈解析結果シート作成
    async function addBucklingAnalysisSheet(workbook) {
        console.log('座屈解析結果シートを作成中...');
        console.log('座屈解析結果データ:', lastBucklingResults);
        
        const data = [];
        data.push(['■ 弾性座屈解析結果']);
        data.push([]);
        
        if (lastBucklingResults && lastBucklingResults.length > 0) {
            data.push(['部材番号', '軸力(kN)', '座屈長さ(m)', '座屈荷重(kN)', '安全率', '判定', '細長比', '座屈モード', '理論的背景']);
            
            lastBucklingResults.forEach((result, i) => {
                // 判定
                let judgment = '-';
                if (result.safetyFactor >= 2.0) {
                    judgment = 'OK';
                } else if (result.safetyFactor >= 1.0) {
                    judgment = '要注意';
                } else {
                    judgment = 'NG';
                }
                
                // 座屈モードの決定
                let bucklingMode = '-';
                if (result.slendernessRatio < 50) {
                    bucklingMode = '短柱（局部座屈）';
                } else if (result.slendernessRatio < 200) {
                    bucklingMode = '中間柱（全体座屈）';
                } else {
                    bucklingMode = '長柱（オイラー座屈）';
                }
                
                // 理論的背景
                const bucklingFactor = result.bucklingLengthFactor !== undefined ? result.bucklingLengthFactor : '-';
                const theory = `オイラー座屈理論: P_cr = π²EI/(lk)², 座屈長さ係数k=${bucklingFactor}`;
                
                data.push([
                    i + 1,
                    result.axialForce !== undefined ? result.axialForce.toFixed(2) : '-',
                    result.bucklingLength !== undefined ? result.bucklingLength.toFixed(3) : '-',
                    result.bucklingLoad !== undefined ? result.bucklingLoad.toFixed(2) : '-',
                    result.safetyFactor !== undefined ? result.safetyFactor.toFixed(2) : '-',
                    judgment,
                    result.slendernessRatio !== undefined ? Math.round(result.slendernessRatio) : '-',
                    bucklingMode,
                    theory
                ]);
            });
            
            data.push([]);
            data.push(['■ 座屈解析の詳細計算過程']);
            data.push([]);
            
            lastBucklingResults.forEach((result, i) => {
                // 判定を再計算（詳細計算過程用）
                let detailJudgment = '-';
                if (result.safetyFactor !== undefined) {
                    if (result.safetyFactor >= 2.0) {
                        detailJudgment = 'OK';
                    } else if (result.safetyFactor >= 1.0) {
                        detailJudgment = '要注意';
                    } else {
                        detailJudgment = 'NG';
                    }
                }
                
                data.push([`部材 ${i + 1} の詳細計算`]);
                data.push(['計算項目', '値', '単位', '式・備考']);
                data.push(['軸力 P', result.axialForce !== undefined ? result.axialForce.toFixed(2) : '-', 'kN', '負の値が圧縮、正の値が引張']);
                data.push(['部材長 L', result.memberLength !== undefined ? result.memberLength.toFixed(3) : '-', 'm', '']);
                data.push(['座屈長さ係数 k', result.bucklingLengthFactor !== undefined ? result.bucklingLengthFactor.toFixed(1) : '-', '', '端部条件による']);
                data.push(['座屈長さ lk', result.bucklingLength !== undefined ? result.bucklingLength.toFixed(3) : '-', 'm', 'lk = k × L']);
                data.push(['断面二次モーメント I', result.momentOfInertia !== undefined ? (result.momentOfInertia * 1e12).toFixed(2) : '-', 'mm⁴', '']);
                data.push(['回転半径 i', result.radiusOfGyration !== undefined ? (result.radiusOfGyration * 1e3).toFixed(2) : '-', 'mm', 'i = √(I/A)']);
                data.push(['細長比 λ', result.slendernessRatio !== undefined ? Math.round(result.slendernessRatio) : '-', '', 'λ = lk/i']);
                data.push(['弾性係数 E', result.elasticModulus !== undefined ? (result.elasticModulus / 1000).toFixed(0) : '-', 'GPa', '']);
                data.push(['オイラー座屈荷重 P_cr', result.bucklingLoad !== undefined ? result.bucklingLoad.toFixed(2) : '-', 'kN', 'P_cr = π²EI/(lk)²']);
                data.push(['安全率 SF', result.safetyFactor !== undefined ? result.safetyFactor.toFixed(2) : '-', '', 'SF = P_cr / P']);
                data.push(['座屈判定', detailJudgment, '', 'SF≥2.0:OK, 1.0≤SF<2.0:要注意, SF<1.0:NG']);
                data.push([]);
            });
            
        } else {
            data.push(['※ 座屈解析結果がありません']);
            data.push(['※ 圧縮荷重を受ける部材がない場合は座屈解析は実行されません']);
        }
        
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, '座屈解析結果');
    }

    // エクセル出力のイベントハンドラー
    async function exportToExcelHandler() {
        console.log('=== エクセル出力ボタンがクリックされました ===');
        try {
            console.log('エクセル出力を開始します...');
            
            // SheetJSライブラリの動的読み込み
            if (typeof XLSX === 'undefined') {
                console.log('SheetJSライブラリを読み込み中...');
                await loadSheetJS();
            }
            
            await exportToExcel();
            console.log('エクセル出力が完了しました');
        } catch (error) {
            console.error('エクセル出力でエラーが発生しました:', error);
            alert('エクセル出力でエラーが発生しました: ' + error.message);
        }
    }

    // ==========================================================================
    // オンキャンバス直接編集機能
    // ==========================================================================
    let activeEditor = null;

    const showInPlaceEditor = (labelInfo) => {
        // 既存のエディタがあれば削除
        if (activeEditor) activeEditor.remove();

        const canvasRect = elements.modelCanvas.getBoundingClientRect();
        const editor = document.createElement('input');
        editor.type = 'number';
        editor.className = 'on-canvas-editor';
        editor.value = labelInfo.value;

        // エディタの位置とサイズを調整
        editor.style.left = `${canvasRect.left + window.scrollX + labelInfo.center.x}px`;
        editor.style.top = `${canvasRect.top + window.scrollY + labelInfo.center.y}px`;
        editor.style.width = `${labelInfo.width + 20}px`; // 少し幅に余裕を持たせる

        document.body.appendChild(editor);
        activeEditor = editor;

        editor.focus();
        editor.select();

        const commitEdit = () => {
            if (!activeEditor) return;

            // エディタの参照を保存してクリア
            const editorToRemove = activeEditor;
            activeEditor = null;

            // 値を取得して更新
            const newValue = parseFloat(editorToRemove.value);
            if (!isNaN(newValue)) {
                updateModelData(labelInfo, newValue);
            }

            // エディタを削除（既に削除されている場合もあるのでtry-catchで保護）
            try {
                if (editorToRemove && editorToRemove.parentNode) {
                    editorToRemove.remove();
                }
            } catch (e) {
                // エディタが既に削除されている場合は無視
            }
        };

        const cancelEdit = () => {
            if (!activeEditor) return;

            // エディタの参照を保存してクリア
            const editorToRemove = activeEditor;
            activeEditor = null;

            // エディタを削除
            try {
                if (editorToRemove && editorToRemove.parentNode) {
                    editorToRemove.remove();
                }
            } catch (e) {
                // エディタが既に削除されている場合は無視
            }
        };

        editor.addEventListener('blur', commitEdit);
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
    };

    const updateModelData = (labelInfo, newValue) => {
        pushState(); // 変更を履歴に保存
        const { type, index } = labelInfo;

        switch (type) {
            case 'node-load-px':
            case 'node-load-py':
            case 'node-load-mz': {
                let loadRow = Array.from(elements.nodeLoadsTable.rows).find(r => parseInt(r.cells[0].querySelector('input').value) - 1 === index);
                if (!loadRow) {
                    // 荷重行が存在しない場合は新規作成
                    addRow(elements.nodeLoadsTable, [`<input type="number" value="${index + 1}">`, '<input type="number" value="0">', '<input type="number" value="0">', '<input type="number" value="0">']);
                    loadRow = elements.nodeLoadsTable.rows[elements.nodeLoadsTable.rows.length - 1];
                }
                const cellIndex = { 'node-load-px': 1, 'node-load-py': 2, 'node-load-mz': 3 }[type];
                loadRow.cells[cellIndex].querySelector('input').value = newValue;
                break;
            }
            case 'member-load-w': {
                let loadRow = Array.from(elements.memberLoadsTable.rows).find(r => parseInt(r.cells[0].querySelector('input').value) - 1 === index);
                if (!loadRow) {
                    addRow(elements.memberLoadsTable, [`<input type="number" value="${index + 1}">`, '<input type="number" value="0">']);
                    loadRow = elements.memberLoadsTable.rows[elements.memberLoadsTable.rows.length - 1];
                }
                loadRow.cells[1].querySelector('input').value = newValue;
                break;
            }
        }

        // データを更新後に即座に再描画
        drawOnCanvas();

        // 解析結果がある場合は再計算も実行
        runFullAnalysis();
    };

    elements.modelCanvas.addEventListener('dblclick', (e) => {
        console.log('🖱️ ダブルクリックイベント発生');
        
        // 他のポップアップが表示されている場合は何もしない
        const existingPopup = document.querySelector('.popup-box[style*="display: block"]');
        if (existingPopup) {
            console.log('❌ ポップアップが既に表示されているため処理を停止:', existingPopup);
            return;
        }

        const rect = elements.modelCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // まず荷重ラベルのクリックをチェック
        let labelClicked = false;
        if (window.lastLabelManager) {
            const clickedLabel = window.lastLabelManager.getLabelAt(mouseX, mouseY);
            if (clickedLabel && clickedLabel.type && clickedLabel.index !== undefined) {
                e.preventDefault();
                e.stopPropagation();
                showInPlaceEditor(clickedLabel);
                labelClicked = true;
            }
        }

        // 荷重ラベルがクリックされていない場合、節点または部材をチェック
        if (!labelClicked) {
            const clickedNodeIndex = getNodeAt(mouseX, mouseY);
            const clickedMemberIndex = getMemberAt(mouseX, mouseY);
            
            console.log('🔍 ダブルクリック要素チェック:', {
                mouseX, mouseY, 
                clickedNodeIndex, 
                clickedMemberIndex,
                labelClicked
            });

            if (clickedNodeIndex !== -1) {
                // 節点のプロパティ編集ポップアップを表示
                e.preventDefault();
                e.stopPropagation();
                openNodeEditor(clickedNodeIndex);
                drawOnCanvas();
            } else if (clickedMemberIndex !== -1) {
                // 部材のプロパティ編集ポップアップを表示
                console.log('🔧 部材ダブルクリック処理開始:', {
                    clickedMemberIndex,
                    selectedMemberIndex
                });
                
                e.preventDefault();
                e.stopPropagation();
                selectedMemberIndex = clickedMemberIndex;
                window.selectedMemberIndex = clickedMemberIndex;

                // 右クリックメニューの「menu-edit-member」をクリックした時と同じ処理を実行
                // この処理は行7025-7180付近にある
                const memberRow = elements.membersTable.rows[selectedMemberIndex];
                console.log('📋 部材行データ:', {
                    memberRow: memberRow,
                    rowExists: !!memberRow,
                    selectedMemberIndex: selectedMemberIndex,
                    totalRows: elements.membersTable.rows.length
                });
                
                if (!memberRow) {
                    console.error('❌ 部材行が見つかりません');
                    return;
                }
                const e_select = memberRow.cells[3].querySelector('select');
                const e_input = memberRow.cells[3].querySelector('input[type="number"]');
                const currentE = (e_select.value === 'custom') ? e_input.value : e_select.value;

                // ポップアップ内のE入力欄を生成
                const eContainer = document.getElementById('popup-e-container');
                eContainer.innerHTML = createEInputHTML('popup-e', currentE);

                // 現在の材料タイプと基準強度を取得
                const strengthContainer = memberRow.cells[4].firstElementChild;
                if (!strengthContainer) {
                    console.error('強度入力コンテナが見つかりません');
                    return;
                }
                const strengthType = strengthContainer.dataset.strengthType;
                let currentStrength;
                if (strengthType === 'wood-type') {
                    const presetSelect = strengthContainer.querySelector('select');
                    if (presetSelect.value === 'custom') {
                        currentStrength = { baseStrengths: {} };
                        ['ft', 'fc', 'fb', 'fs'].forEach(key => {
                            currentStrength.baseStrengths[key] = parseFloat(strengthContainer.querySelector(`input[id*="-${key}"]`).value);
                        });
                    } else {
                        currentStrength = presetSelect.value;
                    }
                } else {
                    currentStrength = strengthContainer.querySelector('input').value;
                }

                const popupFContainer = document.getElementById('popup-f-container');
                const selectedOption = e_select.options[e_select.selectedIndex];
                let materialType = 'steel';
                if (selectedOption.textContent.includes('木材')) materialType = 'wood';
                else if (selectedOption.textContent.includes('ステンレス')) materialType = 'stainless';
                else if (selectedOption.textContent.includes('アルミニウム')) materialType = 'aluminum';

                // ポップアップ内のF入力欄を生成
                popupFContainer.innerHTML = '';
                popupFContainer.appendChild(createStrengthInputHTML(materialType, 'popup-f', currentStrength));

                // その他のプロパティを設定
                document.getElementById('popup-i').value = memberRow.cells[5].querySelector('input').value;
                document.getElementById('popup-a').value = memberRow.cells[6].querySelector('input').value;
                document.getElementById('popup-z').value = memberRow.cells[7].querySelector('input').value;

                // 密度欄の表示/非表示と値設定
                const hasDensityColumn = document.querySelector('.density-column') && document.querySelector('.density-column').style.display !== 'none';
                let existingDensityLabel = document.getElementById('popup-density-label');
                let existingDensityContainer = document.getElementById('popup-density-container');

                if (hasDensityColumn) {
                    // 密度欄が表示されている場合の処理
                    if (!existingDensityLabel || !existingDensityContainer) {
                        // ポップアップ内に密度入力欄を挿入
                        const popupZContainer = document.getElementById('popup-z').parentElement.parentElement;
                        const densityLabel = document.createElement('label');
                        densityLabel.textContent = '密度 (kg/m³):';
                        densityLabel.id = 'popup-density-label';

                        const densityContainer = document.createElement('div');
                        densityContainer.id = 'popup-density-container';

                        popupZContainer.parentElement.insertBefore(densityLabel, popupZContainer.nextSibling);
                        popupZContainer.parentElement.insertBefore(densityContainer, densityLabel.nextSibling);

                        existingDensityLabel = densityLabel;
                        existingDensityContainer = densityContainer;
                    }

                    // 密度値を取得してポップアップに設定
                    const densityCell = memberRow.cells[8];
                    if (densityCell && densityCell.classList.contains('density-cell')) {
                        const densitySelect = densityCell.querySelector('select');
                        const densityInput = densityCell.querySelector('input[type="number"]');
                        const currentDensity = (densitySelect && densitySelect.value === 'custom') ? densityInput.value : (densitySelect ? densitySelect.value : '7850');

                        if (existingDensityContainer) {
                            existingDensityContainer.innerHTML = createDensityInputHTML('popup-density', currentDensity);
                        }
                    }

                    if (existingDensityLabel) existingDensityLabel.style.display = '';
                    if (existingDensityContainer) existingDensityContainer.style.display = '';
                } else {
                    if (existingDensityLabel) existingDensityLabel.style.display = 'none';
                    if (existingDensityContainer) existingDensityContainer.style.display = 'none';
                }

                // 接続条件を設定
                const iConnIndex = hasDensityColumn ? 12 : 11;
                const jConnIndex = hasDensityColumn ? 13 : 12;
                document.getElementById('popup-i-conn').value = memberRow.cells[iConnIndex].querySelector('select').value;
                document.getElementById('popup-j-conn').value = memberRow.cells[jConnIndex].querySelector('select').value;

                // 部材荷重を設定
                const memberLoadRow = Array.from(elements.memberLoadsTable.rows).find(row => parseInt(row.cells[0].querySelector('input').value)-1 === selectedMemberIndex);
                document.getElementById('popup-w').value = memberLoadRow ? memberLoadRow.cells[1].querySelector('input').value : '0';

                // ポップアップを表示
                const popup = elements.memberPropsPopup;
                console.log('📦 部材プロパティポップアップ表示:', {
                    popup: popup,
                    popupExists: !!popup,
                    popupDisplay: popup ? popup.style.display : 'undefined'
                });
                
                if (popup) {
                    popup.style.display = 'block';
                    console.log('✅ ポップアップ表示設定完了:', popup.style.display);
                } else {
                    console.error('❌ memberPropsPopup要素が見つかりません');
                }

                // ポップアップ位置を調整
                setTimeout(() => {
                    console.log('📍 ポップアップ位置調整実行');
                    adjustPopupPosition(elements.memberPropsPopup);
                }, 0);

                drawOnCanvas();
            }
        }
    });
});

// ==========================================================================
// フレームジェネレーター機能
// ==========================================================================

// フレームジェネレーターの初期化
const initializeFrameGenerator = () => {
    const frameGeneratorBtn = document.getElementById('frame-generator-btn');
    const frameGeneratorModal = document.getElementById('frame-generator-modal');
    const modalClose = frameGeneratorModal.querySelector('.modal-close');
    const cancelBtn = document.getElementById('frame-generator-cancel');
    const generateBtn = document.getElementById('frame-generator-generate');
    
    // 入力要素
    const floorsInput = document.getElementById('frame-floors');
    const spansInput = document.getElementById('frame-spans');
    const spanLengthInput = document.getElementById('frame-span-length');
    const floorHeightInput = document.getElementById('frame-floor-height');
    const fixBaseCheckbox = document.getElementById('frame-fix-base');
    const startXInput = document.getElementById('frame-start-x');
    const startYInput = document.getElementById('frame-start-y');
    
    // プレビュー要素
    const previewNodes = document.getElementById('preview-nodes');
    const previewMembers = document.getElementById('preview-members');
    const previewSupport = document.getElementById('preview-support');
    
    // プレビュー更新関数
    const updatePreview = () => {
        const floors = parseInt(floorsInput.value) || 1;
        const spans = parseInt(spansInput.value) || 1;
        const fixBase = fixBaseCheckbox.checked;
        
        const totalNodes = (spans + 1) * (floors + 1);
        const horizontalMembers = spans * (floors + 1); // 各階の梁
        const verticalMembers = (spans + 1) * floors; // 各柱
        const totalMembers = horizontalMembers + verticalMembers;
        
        previewNodes.textContent = totalNodes;
        previewMembers.textContent = totalMembers;
        previewSupport.textContent = fixBase ? '固定支点' : 'ピン支点';
    };
    
    // 入力値変更時のプレビュー更新
    [floorsInput, spansInput].forEach(input => {
        input.addEventListener('input', updatePreview);
    });
    
    // チェックボックス変更時のプレビュー更新
    fixBaseCheckbox.addEventListener('change', updatePreview);
    
    // モーダル表示
    const showModal = () => {
        frameGeneratorModal.style.display = 'flex';
        updatePreview();
    };
    
    // モーダル非表示
    const hideModal = () => {
        frameGeneratorModal.style.display = 'none';
    };
    
    // フレーム生成関数
    // フレームジェネレーター用ヘルパー関数
    const clearAllTables = () => {
        // 全てのテーブル行を削除（ヘッダーを除く）
        const nodesTable = document.getElementById('nodes-table')?.getElementsByTagName('tbody')[0];
        const membersTable = document.getElementById('members-table')?.getElementsByTagName('tbody')[0];
        const nodeLoadsTable = document.getElementById('node-loads-table')?.getElementsByTagName('tbody')[0];
        const memberLoadsTable = document.getElementById('member-loads-table')?.getElementsByTagName('tbody')[0];
        
        const tables = [nodesTable, membersTable, nodeLoadsTable, memberLoadsTable];
        
        tables.forEach(table => {
            if (table && table.rows) {
                // 逆順で削除（インデックスの変更を避けるため）
                for (let i = table.rows.length - 1; i >= 0; i--) {
                    table.deleteRow(i);
                }
            }
        });
    };
    
    const addNodeToTable = (id, x, y, support) => {
        const nodesTable = document.getElementById('nodes-table')?.getElementsByTagName('tbody')[0];
        if (!nodesTable) {
            console.error('nodes-table not found');
            return null;
        }
        
        const cells = [
            '#', // 後で renumberTables() で番号が振り直されます
            `<input type="number" step="0.001" value="${x}">`,
            `<input type="number" step="0.001" value="${y}">`,
            `<select>
                <option value="free" ${support === 'free' ? 'selected' : ''}>自由</option>
                <option value="pinned" ${support === 'pinned' ? 'selected' : ''}>ピン</option>
                <option value="fixed" ${support === 'fixed' ? 'selected' : ''}>固定</option>
                <option value="roller-x" ${support === 'roller-x' ? 'selected' : ''}>ローラー(X)</option>
                <option value="roller-y" ${support === 'roller-y' ? 'selected' : ''}>ローラー(Y)</option>
            </select>`,
            `<input type="number" value="0" step="0.1">`, // 強制変位 δx (mm)
            `<input type="number" value="0" step="0.1">`, // 強制変位 δy (mm)
            `<input type="number" value="0" step="0.001">` // 強制回転 θz (rad)
        ];
        
        // 行を手動で作成
        const newRow = nodesTable.insertRow();
        cells.forEach(cellHTML => { 
            const cell = newRow.insertCell(); 
            cell.innerHTML = cellHTML; 
        });
        
        // 削除ボタンセルを追加
        const deleteCell = newRow.insertCell();
        deleteCell.innerHTML = '<button class="delete-row-btn">×</button>';
        
        // 削除ボタンのイベントリスナーを設定
        const deleteBtn = deleteCell.querySelector('.delete-row-btn');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                if (confirm('この行を削除しますか？')) {
                    newRow.remove();
                    if (typeof drawOnCanvas === 'function') {
                        drawOnCanvas();
                    }
                }
            };
        }
        
        return newRow;
    };
    
    const addMemberToTable = (id, nodeI, nodeJ, E, G, nu, A, Iz, J, startPin, endPin) => {
        try {
            // 既存のシステムが期待する単位に変換
            const E_GPa = E / 1000; // N/mm² → GPa
            const F = '235'; // デフォルトの降伏強度
            const I_m4 = Iz; // 断面二次モーメント (m⁴)
            const A_m2 = A;  // 断面積 (m²)
            const Z_m3 = J;  // 断面係数 (m³) - 暫定的にねじり定数を使用
            
            // 弾性係数選択フィールドを手動で作成（205GPaスチールを選択）
            const eSelectHTML = `<div style="display: flex; flex-direction: column; gap: 2px;">
                <select id="member-e-${nodeI}-${nodeJ}-select">
                    <option value="205000" selected>スチール</option>
                    <option value="193000">ステンレス</option>
                    <option value="70000">アルミニウム</option>
                    <option value="8000">木材</option>
                    <option value="custom">任意入力</option>
                </select>
                <input id="member-e-${nodeI}-${nodeJ}-input" type="number" value="205000" title="弾性係数 E (N/mm²)" readonly>
            </div>`;
            
            // 降伏強度選択フィールドを手動で作成
            const strengthSelectHTML = `<div style="display: flex; flex-direction: column; gap: 2px;">
                <select id="member-strength-${nodeI}-${nodeJ}-select">
                    <option value="235" selected>SS400 (235N/mm²)</option>
                    <option value="325">SS490 (325N/mm²)</option>
                    <option value="400">SM490A (400N/mm²)</option>
                    <option value="custom">任意入力</option>
                </select>
                <input id="member-strength-${nodeI}-${nodeJ}-input" type="number" value="235" title="降伏強度 F (N/mm²)" readonly>
            </div>`;
            
            const cells = [
                '#', // 後で renumberTables() で番号が振り直されます
                `<input type="number" value="${nodeI}">`,
                `<input type="number" value="${nodeJ}">`,
                eSelectHTML,
                strengthSelectHTML,
                `<input type="number" value="${(I_m4 * 1e8).toFixed(2)}" title="断面二次モーメント I (cm⁴)">`,
                `<input type="number" value="${(A_m2 * 1e4).toFixed(2)}" title="断面積 A (cm²)">`,
                `<input type="number" value="${(Z_m3 * 1e6).toFixed(2)}" title="断面係数 Z (cm³)">`,
                `<input type="number" value="7850" title="密度 ρ (kg/m³)" style="display: none;">`, // 密度列（デフォルト非表示）
                `<button class="section-select-btn">断面選択</button>`, // 部材断面選択ボタン
                `<select><option value="rigid" ${startPin === 'rigid' ? 'selected' : ''}>剛</option><option value="pinned" ${startPin === 'pinned' ? 'selected' : ''}>ピン</option></select>`,
                `<select><option value="rigid" ${endPin === 'rigid' ? 'selected' : ''}>剛</option><option value="pinned" ${endPin === 'pinned' ? 'selected' : ''}>ピン</option></select>`
            ];
            
            const membersTable = document.getElementById('members-table')?.getElementsByTagName('tbody')[0];
            if (!membersTable) {
                console.error('members-table not found');
                return null;
            }
            
            // 行を作成
            const newRow = membersTable.insertRow();
            cells.forEach((cellHTML, index) => { 
                const cell = newRow.insertCell(); 
                cell.innerHTML = cellHTML;
                
                // 密度列（8番目のセル）の表示/非表示設定
                if (index === 8) { // 密度列
                    const densityColumns = document.querySelectorAll('.density-column');
                    const isDensityVisible = densityColumns.length > 0 && densityColumns[0].style.display !== 'none';
                    cell.style.display = isDensityVisible ? '' : 'none';
                    cell.classList.add('density-column');
                }
            });
            
            // 削除ボタンセルを追加
            const deleteCell = newRow.insertCell();
            deleteCell.innerHTML = '<button class="delete-row-btn">×</button>';
            
            // 削除ボタンのイベントリスナーを設定
            const deleteBtn = deleteCell.querySelector('.delete-row-btn');
            if (deleteBtn) {
                deleteBtn.onclick = () => {
                    if (confirm('この行を削除しますか？')) {
                        newRow.remove();
                        if (typeof drawOnCanvas === 'function') {
                            drawOnCanvas();
                        }
                    }
                };
            }
            
            // 断面選択ボタンのイベントリスナーを設定
            const sectionBtn = newRow.querySelector('.section-select-btn');
            if (sectionBtn) {
                sectionBtn.onclick = () => {
                    // 部材追加ポップアップ内の行用の断面選択機能
                    console.log('断面選択ボタンがクリックされました');

                    // steel_selector.htmlを開く（特別な識別子を使用）
                    const rowId = `add-temp-${nodeI}-${nodeJ}`;
                    const url = `steel_selector.html?targetMember=${encodeURIComponent(rowId)}`;
                    const popup = window.open(url, 'SteelSelector', 'width=1200,height=800,scrollbars=yes,resizable=yes');

                    if (!popup) {
                        alert('ポップアップブロッカーにより断面選択ツールを開けませんでした。ポップアップを許可してください。');
                        return;
                    }

                    // ポップアップから戻った時の処理
                    const checkPopup = setInterval(() => {
                        if (popup.closed) {
                            clearInterval(checkPopup);
                            const storedData = localStorage.getItem('steelSelectionForFrameAnalyzer');
                            if (storedData) {
                                try {
                                    const data = JSON.parse(storedData);
                                    if (data.targetMemberIndex === rowId && data.properties) {
                                        // 行内の入力フィールドを更新
                                        const iInput = newRow.querySelector('input[placeholder="断面二次モーメント"]');
                                        const aInput = newRow.querySelector('input[placeholder="断面積"]');
                                        const zInput = newRow.querySelector('input[placeholder="断面係数"]');
                                        const eInput = document.getElementById(`member-e-${nodeI}-${nodeJ}-input`);
                                        const strengthInput = document.getElementById(`member-strength-${nodeI}-${nodeJ}-input`);

                                        if (iInput) iInput.value = data.properties.I;
                                        if (aInput) aInput.value = data.properties.A;
                                        if (zInput) zInput.value = data.properties.Z;
                                        if (eInput && data.properties.E) eInput.value = data.properties.E;
                                        if (strengthInput && data.properties.strengthValue) strengthInput.value = data.properties.strengthValue;

                                        // 断面情報を表示
                                        const sectionName = data.properties.sectionName || data.properties.sectionLabel || '';
                                        const selectedAxis = data.properties.selectedAxis || data.properties.sectionAxisLabel || '';

                                        if (sectionName) {
                                            // 断面情報表示エリアを探す
                                            const sectionInfoCell = newRow.cells[newRow.cells.length - 3]; // 削除ボタンの2つ前
                                            if (sectionInfoCell) {
                                                // 既存の断面情報があれば更新、なければ作成
                                                let infoDiv = sectionInfoCell.querySelector('.section-info-display');
                                                if (!infoDiv) {
                                                    infoDiv = document.createElement('div');
                                                    infoDiv.className = 'section-info-display';
                                                    infoDiv.style.cssText = 'font-size: 0.85em; color: #0066cc; margin-top: 4px;';
                                                    sectionInfoCell.appendChild(infoDiv);
                                                }

                                                infoDiv.innerHTML = `<strong>${sectionName}</strong> ${selectedAxis}`;
                                            }
                                        }

                                        localStorage.removeItem('steelSelectionForFrameAnalyzer');
                                        console.log('✅ 部材追加行: 断面データを適用しました');
                                    }
                                } catch (e) {
                                    console.error('断面選択データの解析エラー:', e);
                                }
                            }
                        }
                    }, 500);
                };
            }
            
            // 弾性係数と降伏強度の選択フィールドにイベントリスナーを設定
            setTimeout(() => {
                const eSelect = document.getElementById(`member-e-${nodeI}-${nodeJ}-select`);
                const eInput = document.getElementById(`member-e-${nodeI}-${nodeJ}-input`);
                const strengthSelect = document.getElementById(`member-strength-${nodeI}-${nodeJ}-select`);
                const strengthInput = document.getElementById(`member-strength-${nodeI}-${nodeJ}-input`);
                
                if (eSelect && eInput) {
                    eSelect.addEventListener('change', function() {
                        if (this.value !== 'custom') {
                            eInput.value = this.value;
                        }
                        eInput.readOnly = (this.value !== 'custom');
                        eInput.dispatchEvent(new Event('change'));
                    });
                }
                
                if (strengthSelect && strengthInput) {
                    strengthSelect.addEventListener('change', function() {
                        if (this.value !== 'custom') {
                            strengthInput.value = this.value;
                        }
                        strengthInput.readOnly = (this.value !== 'custom');
                        strengthInput.dispatchEvent(new Event('change'));
                    });
                }
            }, 100);
            
            return newRow;
        } catch (error) {
            console.error('addMemberToTable error:', error);
            return null;
        }
    };

    const generateFrame = () => {
        try {
            const floors = parseInt(floorsInput.value) || 1;
            const spans = parseInt(spansInput.value) || 1;
            const spanLength = parseFloat(spanLengthInput.value) || 6.0;
            const floorHeight = parseFloat(floorHeightInput.value) || 3.5;
            const fixBase = fixBaseCheckbox.checked;
            const startX = parseFloat(startXInput.value) || 0.0;
            const startY = parseFloat(startYInput.value) || 0.0;
            
            // 入力値検証
            if (floors < 1 || floors > 20) {
                alert('層数は1から20の間で設定してください。');
                return;
            }
            if (spans < 1 || spans > 20) {
                alert('スパン数は1から20の間で設定してください。');
                return;
            }
            if (spanLength <= 0 || spanLength > 50) {
                alert('スパン長は0より大きく50以下で設定してください。');
                return;
            }
            if (floorHeight <= 0 || floorHeight > 20) {
                alert('階高は0より大きく20以下で設定してください。');
                return;
            }
            
            // 現在のテーブルデータをクリア（確認ダイアログ）
            const nodesTable = document.getElementById('nodes-table')?.getElementsByTagName('tbody')[0];
            const membersTable = document.getElementById('members-table')?.getElementsByTagName('tbody')[0];
            
            const existingNodes = nodesTable?.rows.length > 0;
            const existingMembers = membersTable?.rows.length > 0;
            
            if (existingNodes || existingMembers) {
                if (!confirm('現在のモデルデータはクリアされます。続行しますか？')) {
                    return;
                }
                
                // テーブルをクリア
                clearAllTables();
            }
            
            // 節点生成とテーブル追加
            let nodeIndex = 0;
            const totalNodes = (floors + 1) * (spans + 1);
            
            for (let floor = 0; floor <= floors; floor++) {
                for (let span = 0; span <= spans; span++) {
                    const x = startX + span * spanLength;
                    const y = startY + floor * floorHeight;
                    
                    let fixity = 'free';
                    if (floor === 0) {
                        if (fixBase) {
                            fixity = 'fixed'; // 基礎部は固定支点
                        } else {
                            fixity = 'pin';   // 基礎部はピン支点
                        }
                    }
                    
                    // 節点をテーブルに追加
                    addNodeToTable(nodeIndex + 1, x.toFixed(2), y.toFixed(2), fixity);
                    nodeIndex++;
                }
            }
            
            // 部材生成とテーブル追加
            let memberIndex = 0;
            const nodesPerFloor = spans + 1;
            
            // 水平部材（梁）の生成
            for (let floor = 0; floor <= floors; floor++) {
                for (let span = 0; span < spans; span++) {
                    const nodeI = floor * nodesPerFloor + span + 1; // 1から始まる節点番号
                    const nodeJ = nodeI + 1;
                    
                    addMemberToTable(memberIndex + 1, nodeI, nodeJ, 210000, 30000, 0.3, 0.0002083, 0.0002083, 0.0001, 'rigid', 'rigid');
                    memberIndex++;
                }
            }
            
            // 垂直部材（柱）の生成
            for (let floor = 0; floor < floors; floor++) {
                for (let span = 0; span <= spans; span++) {
                    const nodeI = floor * nodesPerFloor + span + 1; // 1から始まる節点番号（下層）
                    const nodeJ = (floor + 1) * nodesPerFloor + span + 1; // 上層
                    
                    addMemberToTable(memberIndex + 1, nodeI, nodeJ, 210000, 30000, 0.3, 0.0002083, 0.0002083, 0.0001, 'rigid', 'rigid');
                    memberIndex++;
                }
            }
            
            // モーダルを閉じる
            hideModal();
            
            // テーブル番号を手動で更新
            const nodesTableForUpdate = document.getElementById('nodes-table')?.getElementsByTagName('tbody')[0];
            const membersTableForUpdate = document.getElementById('members-table')?.getElementsByTagName('tbody')[0];
            
            if (nodesTableForUpdate) {
                Array.from(nodesTableForUpdate.rows).forEach((row, i) => {
                    row.cells[0].textContent = i + 1;
                });
            }
            
            if (membersTableForUpdate) {
                Array.from(membersTableForUpdate.rows).forEach((row, i) => {
                    row.cells[0].textContent = i + 1;
                });
            }
            
            // 解析と描画を実行
            if (typeof runFullAnalysis === 'function') {
                runFullAnalysis();
            }
            
            // キャンバスを再描画
            if (typeof drawOnCanvas === 'function') {
                drawOnCanvas();
            }
            
            // 自動スケーリングを実行
            setTimeout(() => {
                try {
                    console.log('フレームジェネレーター: 自動スケーリングを実行中...');
                    
                    // 方法1: 自動スケールボタンをクリックして実行
                    const autoScaleBtn = document.getElementById('auto-scale-btn');
                    if (autoScaleBtn) {
                        console.log('フレームジェネレーター: 自動スケールボタンを発見、クリック実行');
                        autoScaleBtn.click();
                        return;
                    }
                    
                    // 方法2: triggerAutoScale関数を呼び出し
                    if (typeof window.triggerAutoScale === 'function') {
                        console.log('フレームジェネレーター: triggerAutoScale関数を実行');
                        window.triggerAutoScale();
                        return;
                    }
                    
                    // 方法3: panZoomStateに直接アクセス
                    if (typeof window.panZoomState !== 'undefined') {
                        console.log('フレームジェネレーター: panZoomState直接リセット');
                        window.panZoomState.isInitialized = false;
                        drawOnCanvas();
                        return;
                    }
                    
                    // 方法4: 最後の手段として再描画のみ実行
                    console.log('フレームジェネレーター: 通常の再描画のみ実行');
                    drawOnCanvas();
                    
                } catch (error) {
                    console.error('フレームジェネレーター: 自動スケーリングエラー:', error);
                    // エラーが発生しても最低限再描画は実行
                    try {
                        drawOnCanvas();
                    } catch (drawError) {
                        console.error('フレームジェネレーター: 再描画エラー:', drawError);
                    }
                }
            }, 500); // さらに遅延を増やして確実に実行
            
            // 成功メッセージ
            const totalMembers = memberIndex;
            
            // アラート前にも自動スケーリングを試行
            setTimeout(() => {
                const autoScaleBtn = document.getElementById('auto-scale-btn');
                if (autoScaleBtn) {
                    console.log('フレームジェネレーター: アラート前最終自動スケーリング試行');
                    autoScaleBtn.click();
                }
            }, 700);
            
            alert(`フレーム構造を生成しました！\n節点数: ${totalNodes}\n部材数: ${totalMembers}`);
            
        } catch (error) {
            console.error('フレーム生成エラー:', error);
            alert('フレーム生成中にエラーが発生しました: ' + error.message);
        }
    };
    
    // イベントリスナー
    frameGeneratorBtn.addEventListener('click', showModal);
    modalClose.addEventListener('click', hideModal);
    cancelBtn.addEventListener('click', hideModal);
    generateBtn.addEventListener('click', generateFrame);
    
    // モーダル背景クリックで閉じる
    frameGeneratorModal.addEventListener('click', (e) => {
        if (e.target === frameGeneratorModal) {
            hideModal();
        }
    });
    
    // ESCキーでモーダルを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && frameGeneratorModal.style.display === 'flex') {
            hideModal();
        }
    });
    
    // 初期プレビュー更新
    updatePreview();
};

// フレームジェネレーターの初期化を実行
document.addEventListener('DOMContentLoaded', () => {
    // 他の初期化コードの後で実行されるように遅延
    setTimeout(() => {
        console.log('フレームジェネレーターの初期化を開始');
        try {
            initializeFrameGenerator();
            console.log('フレームジェネレーターの初期化が完了');
        } catch (error) {
            console.error('フレームジェネレーターの初期化エラー:', error);
        }
    }, 100);
});

// デバッグ用：フレームジェネレーター要素の存在を確認する関数
window.checkFrameGenerator = () => {
    console.log('=== フレームジェネレーター要素チェック ===');
    
    const elements = [
        'frame-generator-btn',
        'frame-generator-modal', 
        'modal-close',
        'floors-input',
        'spans-input',
        'span-length-input',
        'floor-height-input',
        'fix-base',
        'start-x',
        'start-y',
        'cancel-btn',
        'generate-btn'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        console.log(`${id}: ${element ? '見つかりました' : '見つかりません'}`);
    });
};

// ========================================
// 3Dビューア機能（独立ウィンドウ版）
// ========================================

// 3Dビューアウィンドウの参照を保持
let viewerWindow = null;

// 3Dビューアにモデルデータを送信する関数
function sendModelToViewer() {
    if (viewerWindow && !viewerWindow.closed) {
        try {
            const modelData = parseInputs();
            viewerWindow.postMessage({ type: 'updateModel', data: modelData }, '*');
        } catch (error) {
            console.error("3Dビューアへのモデル更新送信に失敗しました:", error);
        }
    } else {
        viewerWindow = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const view3dBtn = document.getElementById('view-3d-btn');

    if (view3dBtn) {
        view3dBtn.addEventListener('click', () => {
            // 既に開いている場合はフォーカスするだけ
            if (viewerWindow && !viewerWindow.closed) {
                viewerWindow.focus();
                return;
            }

            try {
                const { nodes } = parseInputs();
                if (nodes.length === 0) {
                    alert('3D表示するモデルがありません。');
                    return;
                }

                // 新しいウィンドウで3Dビューアを開く
                viewerWindow = window.open('viewer_3d.html', 'Statica3DViewer', 'width=800,height=600,resizable=yes,scrollbars=yes');

                if (!viewerWindow) {
                    alert('ポップアップがブロックされた可能性があります。3Dビューアを開けませんでした。');
                    return;
                }

                // 1秒後に最初のモデルデータを送信
                setTimeout(() => {
                    sendModelToViewer();
                }, 1000);

            } catch (error) {
                console.error('3Dビューアの起動に失敗しました:', error);
                alert('3Dビューアの起動に失敗しました: ' + error.message);
            }
        });
    }
});

// ==========================================================================
// Gemini APIによるAIモデル生成機能
// ==========================================================================

/**
 * Gemini APIを使用して自然言語からモデルを生成するメイン関数
 * @param {string} userPrompt ユーザーが入力した指示
 */
async function generateModelWithAI(userPrompt) {
    const aiGenerateBtn = document.getElementById('generate-model-btn');
    const aiStatus = document.getElementById('gemini-status-indicator');

    // ★★★ 変更点 ★★★
    // 宛先をGoogleから、我々が作った仲介役プログラムの住所に変更します。
    // netlify.tomlの設定により、このURLへのアクセスは自動的にサーバーレス関数に転送されます。
    const API_URL = '/api/generate-model'; 

    // UIを「生成中」の状態にします
    aiGenerateBtn.disabled = true;
    aiStatus.style.display = 'block';
    aiStatus.textContent = '🧠 AIがモデルを生成中です...';
    aiStatus.style.color = '#005A9C';

    try {
        // ★★★ 変更点 ★★★
        // 仲介役に送るリクエストを作成します。秘密の鍵(APIキー)は含めません。
        const requestBody = {
            prompt: userPrompt
        };

        // 我々の仲介役プログラムにリクエストを送信します
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        // 仲介役からの返答を受け取ります
        const data = await response.json();

        // 返答に問題があった場合のエラー処理
        if (!response.ok) {
            throw new Error(data.error || 'サーバーでエラーが発生しました。');
        }

        // 仲介役が転送してくれたGeminiの応答から、JSON部分だけを安全に取り出します
        const jsonText = extractJsonFromResponse(data);
        const modelData = JSON.parse(jsonText);

        aiStatus.textContent = '✅ モデルデータを適用しています...';

        // 取り出したモデルデータを、アプリケーションのテーブルに反映させます
        applyGeneratedModel(modelData, prompt);

        alert('AIによるモデル生成が完了しました。');

    } catch (error) {
        console.error('AIモデル生成エラー:', error);
        aiStatus.textContent = `❌ エラー: ${error.message}`;
        aiStatus.style.color = '#dc3545';
        alert(`AIによるモデル生成に失敗しました。\nエラー: ${error.message}`);
    } finally {
        // UIの状態を元に戻します
        aiGenerateBtn.disabled = false;
        setTimeout(() => {
            if (aiStatus.textContent.startsWith('❌')) {
                 // エラーメッセージは少し長めに表示
            } else {
                aiStatus.style.display = 'none';
            }
        }, 5000);
    }
}

/**
 * Gemini APIのレスポンスからJSON部分を安全に抽出する関数
 * @param {object} apiResponse APIからのレスポンスオブジェクト
 * @returns {string} 抽出されたJSON文字列
 */
function extractJsonFromResponse(apiResponse) {
    if (!apiResponse.candidates || !apiResponse.candidates[0].content.parts || !apiResponse.candidates[0].content.parts[0].text) {
        throw new Error('APIからのレスポンス形式が不正です。');
    }
    
    let text = apiResponse.candidates[0].content.parts[0].text;
    
    const jsonMatch = text.match(/```(json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[2]) {
        text = jsonMatch[2];
    }
    
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        throw new Error('レスポンス内に有効なJSONオブジェクトが見つかりません。');
    }
    
    return text.substring(startIndex, endIndex + 1);
}

/**
 * 自然言語から柱脚の境界条件を解析する関数
 * @param {string} naturalLanguageInput 自然言語の入力テキスト
 * @returns {string} 境界条件 ('free', 'pinned', 'fixed', 'roller')
 */
function parseFoundationCondition(naturalLanguageInput) {
    console.log(`🔍 parseFoundationCondition 開始:`, {
        input: naturalLanguageInput,
        type: typeof naturalLanguageInput
    });
    
    // 入力が文字列でない場合は文字列に変換、null/undefined の場合は空文字列
    if (typeof naturalLanguageInput !== 'string') {
        naturalLanguageInput = String(naturalLanguageInput || '');
    }
    
    // 空文字列の場合はデフォルト値を返す
    if (!naturalLanguageInput.trim()) {
        console.log('🔍 入力が空文字列のため free を返す');
        return 'free'; // 入力がない場合は自由
    }
    
    const text = naturalLanguageInput.toLowerCase();
    console.log(`🔍 小文字変換後: "${text}"`);
    
    // 柱脚関連のキーワードを検索
    const foundationKeywords = ['柱脚', '基礎', '支点', '固定', 'ピン', 'ローラー', '自由'];
    const hasFoundationMention = foundationKeywords.some(keyword => text.includes(keyword));
    
    console.log(`🔍 柱脚関連キーワード検索:`, {
        keywords: foundationKeywords,
        hasFoundationMention: hasFoundationMention
    });
    
    if (!hasFoundationMention) {
        console.log('🔍 柱脚関連キーワードが見つからないため free を返す');
        return 'free'; // デフォルトは自由
    }
    
    // 境界条件のキーワードを検索
    console.log('🔍 境界条件キーワード検索開始');
    
    if (text.includes('固定') || text.includes('剛')) {
        console.log('🔍 "固定" または "剛" が見つかったため fixed を返す');
        return 'fixed';
    } else if (text.includes('ピン') || text.includes('ヒンジ')) {
        console.log('🔍 "ピン" または "ヒンジ" が見つかったため pinned を返す');
        return 'pinned';
    } else if (text.includes('ローラー') || text.includes('ローラ')) {
        console.log('🔍 "ローラー" または "ローラ" が見つかったため roller を返す');
        return 'roller';
    } else if (text.includes('自由')) {
        console.log('🔍 "自由" が見つかったため free を返す');
        return 'free';
    }
    
    // デフォルトは固定（一般的な柱脚の条件）
    console.log('🔍 境界条件キーワードが見つからないためデフォルトで fixed を返す');
    return 'fixed';
}

/**
 * 生成されたモデルデータをアプリケーションに適用する関数
 * @param {object} modelData APIから受け取ったモデルデータ
 * @param {string} naturalLanguageInput 元の自然言語入力（柱脚条件解析用）
 */
function applyGeneratedModel(modelData, naturalLanguageInput = '') {
    if (!modelData || !modelData.nodes) {
        throw new Error('生成されたモデルデータが無効です。');
    }

    if (confirm('AIが生成したモデルを適用します。現在のモデルデータはクリアされますが、よろしいですか？')) {
        // 既存の`restoreState`関数を再利用して、データをテーブルに反映します
        
        // 適用中の再描画などを一時的に抑制するためのフラグ
        window.isLoadingPreset = true; 
        
        window.pushState(); // 現在の状態を「元に戻す」ために保存
        
        // 全てのテーブルをクリア
        window.elements.nodesTable.innerHTML = '';
        window.elements.membersTable.innerHTML = '';
        window.elements.nodeLoadsTable.innerHTML = '';
        window.elements.memberLoadsTable.innerHTML = '';
        
        // 柱脚の境界条件を解析
        console.log(`🔍 自然言語入力: "${naturalLanguageInput}"`);
        const foundationCondition = parseFoundationCondition(naturalLanguageInput);
        console.log('🔍 柱脚境界条件解析結果:', {
            naturalLanguageInput: naturalLanguageInput,
            foundationCondition: foundationCondition
        });
        console.log(`🔍 柱脚境界条件値: "${foundationCondition}"`);
        
        // AIが生成した元のデータをログ出力
        console.log('🔍 AI生成データ:', modelData);
        
        // AI生成の境界条件値をアプリケーション形式に変換する関数
        const convertSupportCondition = (aiSupport) => {
            console.log(`🔍 convertSupportCondition 入力:`, {
                aiSupport: aiSupport,
                type: typeof aiSupport,
                stringified: JSON.stringify(aiSupport)
            });
            console.log(`🔍 convertSupportCondition 入力値: "${aiSupport}"`);
            
            const supportMap = {
                'f': 'free',
                'p': 'pinned', 
                'r': 'roller',
                'x': 'fixed'
            };
            const result = supportMap[aiSupport] || aiSupport; // マッピングがない場合はそのまま
            
            console.log(`🔍 convertSupportCondition 結果:`, {
                input: aiSupport,
                output: result,
                mapped: supportMap[aiSupport] !== undefined
            });
            console.log(`🔍 convertSupportCondition 出力値: "${result}"`);
            
            return result;
        };
        
        // APIからのデータを、アプリが理解できる形式に変換
        const state = {
            nodes: modelData.nodes.map((n, index) => {
                // Y座標が0の節点（地面に接する節点）の境界条件を自然言語の指示に従って設定
                const isFoundationNode = Math.abs(n.y) < 0.01; // Y座標が0に近い節点
                const originalSupport = convertSupportCondition(n.s);
                const support = isFoundationNode ? foundationCondition : originalSupport;
                
                console.log(`🔍 節点 ${index + 1} 境界条件決定:`, {
                    y: n.y,
                    isFoundationNode: isFoundationNode,
                    originalSupport: originalSupport,
                    foundationCondition: foundationCondition,
                    finalSupport: support
                });
                
                // 柱脚節点の詳細ログ
                if (isFoundationNode) {
                    console.log(`🔍 柱脚節点 ${index + 1}:`, {
                        aiSupport: n.s,
                        convertedSupport: originalSupport,
                        newSupport: support,
                        y: n.y,
                        foundationCondition: foundationCondition,
                        isFoundationNode: isFoundationNode
                    });
                } else {
                    console.log(`🔍 非柱脚節点 ${index + 1}:`, {
                        aiSupport: n.s,
                        convertedSupport: originalSupport,
                        newSupport: support,
                        y: n.y,
                        isFoundationNode: isFoundationNode
                    });
                }
                
                return { 
                    x: n.x, 
                    y: n.y, 
                    support: support, 
                    dx_forced: 0, 
                    dy_forced: 0, 
                    r_forced: 0 
                };
            }),
            members: modelData.members.map(m => ({
                i: m.i, j: m.j,
                E: m.E || '205000',
                strengthType: 'F-value', // デフォルト
                strengthValue: m.F || '235',
                I: (m.I * 1e8).toString(), // m4 -> cm4
                A: (m.A * 1e4).toString(), // m2 -> cm2
                Z: (m.Z * 1e6).toString(), // m3 -> cm3
                i_conn: m.i_conn || 'rigid',
                j_conn: m.j_conn || 'rigid'
            })),
            nodeLoads: (modelData.nl || []).map(l => ({ 
                node: l.n, px: l.px || 0, py: l.py || 0, mz: l.mz || 0 
            })),
            memberLoads: (modelData.ml || []).map(l => ({ 
                member: l.m, w: l.w || 0 
            }))
        };
        
        // データをテーブルに流し込み
        console.log('🔍 復元前のstate確認:', state);
        window.restoreState(state);
        
        window.isLoadingPreset = false;

        // 表示を更新
        window.updateSelfWeightDisplay();
        window.panZoomState.isInitialized = false; 
        
        // データが正しく設定されているか確認
        console.log('AI生成後のデータ確認:');
        console.log('節点数:', window.elements.nodesTable.rows.length);
        console.log('部材数:', window.elements.membersTable.rows.length);
        
        // 再描画と再計算
        window.drawOnCanvas();
        
        // データが存在する場合のみ解析を実行
        if (window.elements.nodesTable.rows.length > 0 && window.elements.membersTable.rows.length > 0) {
            window.runFullAnalysis();
        } else {
            console.warn('AI生成後のデータが不完全です。解析をスキップします。');
        }
    }
}
