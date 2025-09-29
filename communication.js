/**
 * ウィンドウ間通信ユーティリティ
 * フレーム解析ウィンドウと部材性能選択ウィンドウ間のデータ交換を管理
 */

/**
 * フレーム解析ウィンドウ (親) から部材性能選択ウィンドウ (子) を開く関数
 * @param {number} memberIndex - 更新対象となる部材の行インデックス
 * @param {object} currentProps - 部材の現在のプロパティ { material, E, strengthValue }
 * @returns {Window|null} 開いたウィンドウオブジェクト、失敗時はnull
 */
function openSteelSelector(memberIndex, currentProps = {}) {
    try {
        // 入力値の検証
        if (typeof memberIndex !== 'number' || memberIndex < 0) {
            throw new Error('無効な部材インデックスです');
        }

        // URLにパラメータを追加して、材料の種類や現在の値を渡す
        const params = new URLSearchParams({
            targetMember: memberIndex,
            material: currentProps.material || 'steel',
            eValue: currentProps.E || '205000',
            strengthValue: currentProps.strengthValue || '235'
        });
        
        const url = `steel_selector.html?${params.toString()}`;
        const windowFeatures = {
            width: 1200,
            height: 800,
            left: Math.max(0, (window.screen.width / 2) - 600),
            top: Math.max(0, (window.screen.height / 2) - 400),
            scrollbars: 'yes',
            resizable: 'yes'
        };
        
        const featuresString = Object.entries(windowFeatures)
            .map(([key, value]) => `${key}=${value}`)
            .join(',');
        
        const newWindow = window.open(url, 'SteelSelector', featuresString);
        
        if (!newWindow) {
            throw new Error('ポップアップブロッカーにより部材選択ツールを開けませんでした');
        }
        
        // ウィンドウが正常に開けたことを確認
        setTimeout(() => {
            if (newWindow.closed) {
                console.warn('部材選択ウィンドウが予期せず閉じられました');
            }
        }, 1000);
        
        return newWindow;
        
    } catch (error) {
        console.error('部材選択ツールオープンエラー:', {
            error: error.message,
            memberIndex,
            currentProps,
            stack: error.stack
        });
        alert(`部材選択ツールを開けませんでした: ${error.message}`);
        return null;
    }
}

/**
 * 部材性能選択ウィンドウ (子) から親ウィンドウにデータを送信する関数
 * localStorageを使用してデータを渡します。
 * @param {object} properties - { E, F, I, A, Z, Zx, Zy, ix, iy, strengthType, strengthValue } 等の形式のオブジェクト
 * @returns {boolean} 送信成功時はtrue、失敗時はfalse
 */
function sendDataToParent(properties) {
    try {
        // 入力値の検証
        if (!properties || typeof properties !== 'object') {
            throw new Error('無効なプロパティオブジェクトです');
        }
        
        // 必須プロパティの確認
        const requiredProps = ['I', 'A'];
        const missingProps = requiredProps.filter(prop => 
            properties[prop] === undefined || properties[prop] === null || properties[prop] === ''
        );
        
        if (missingProps.length > 0) {
            throw new Error(`必須プロパティが不足しています: ${missingProps.join(', ')}`);
        }
        
        const { targetMemberIndex: overrideTargetIndex, ...sanitizedProps } = properties;
        const urlParams = new URLSearchParams(window.location.search);

        const resolveTargetMemberIndex = (value) => {
            if (value === undefined || value === null) return null;
            if (typeof value === 'number') {
                return Number.isFinite(value) ? Math.trunc(value) : null;
            }
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed) return null;
                if (trimmed.toLowerCase() === 'bulk') return 'bulk';
                const numeric = parseInt(trimmed, 10);
                return Number.isNaN(numeric) ? null : numeric;
            }
            return null;
        };

        let resolvedTargetMemberIndex = resolveTargetMemberIndex(overrideTargetIndex);
        if (resolvedTargetMemberIndex === null) {
            resolvedTargetMemberIndex = resolveTargetMemberIndex(urlParams.get('targetMember'));
        }

        if (resolvedTargetMemberIndex === null) {
            try {
                const storedIndex = sessionStorage.getItem('steelSelectorTargetMemberIndex');
                resolvedTargetMemberIndex = resolveTargetMemberIndex(storedIndex);
            } catch (storageError) {
                console.warn('ターゲット部材インデックスの取得に失敗しました:', storageError);
            }
        }

        if (resolvedTargetMemberIndex === null) {
            try {
                const openerIndex = window.opener?.selectedMemberIndex;
                resolvedTargetMemberIndex = resolveTargetMemberIndex(openerIndex);
            } catch (openerError) {
                console.warn('ターゲット部材インデックスのオープナーからの取得に失敗しました:', openerError);
            }
        }

        if (resolvedTargetMemberIndex === null) {
            throw new Error('送信先の部材情報が見つかりません');
        }
        
        const sanitizedPropertyKeys = Object.keys(sanitizedProps);

        const dataToSend = {
            targetMemberIndex: resolvedTargetMemberIndex,
            properties: sanitizedProps,
            timestamp: new Date().getTime(), // 変更を検知するためのタイムスタンプ
            version: '1.0' // データ形式のバージョン
        };
        
        // データの整合性確認
        if (typeof dataToSend.targetMemberIndex === 'number' && !Number.isFinite(dataToSend.targetMemberIndex)) {
            throw new Error('部材インデックスが数値ではありません');
        }
        if (typeof dataToSend.targetMemberIndex !== 'number' && dataToSend.targetMemberIndex !== 'bulk') {
            throw new Error('部材インデックスが数値ではありません');
        }
        
        // localStorageにデータを保存
        const serializedData = JSON.stringify(dataToSend);
        localStorage.setItem('steelSelectionForFrameAnalyzer', serializedData);
        
        console.log('データ送信完了:', {
            targetMember: dataToSend.targetMemberIndex,
            propertiesCount: sanitizedPropertyKeys.length,
            timestamp: dataToSend.timestamp
        });
        
        // ウィンドウを閉じる
        window.close();
        return true;
        
    } catch (error) {
        console.error('データ送信エラー:', {
            error: error.message,
            properties,
            stack: error.stack
        });
        alert(`データの送信に失敗しました: ${error.message}`);
        return false;
    }
}