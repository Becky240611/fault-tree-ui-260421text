/**
 * 流程圖引導工具 - 核心邏輯 (乾淨版)
 * 移除硬編碼資料，專注於 XML 解析與動態生成
 */

let faultTree = {}; // 初始為空
const ADMIN_PASSWORD_DEFAULT = "ecoco888";

function getAdminPassword() {
    return localStorage.getItem('adminPassword') || ADMIN_PASSWORD_DEFAULT;
}

let currentXmlData = ""; // 儲存當前 XML 內容用於導出

let historyStack = [];
let currentNodeId = 'start';
let parentsMap = {};

function buildParents() {
    parentsMap = {};
    let queue = ['start'];
    let visited = new Set(['start']);

    while (queue.length > 0) {
        let u = queue.shift();
        if (!faultTree[u] || !faultTree[u].options) continue;

        faultTree[u].options.forEach(opt => {
            if (!visited.has(opt.nextId)) {
                visited.add(opt.nextId);
                parentsMap[opt.nextId] = u;
                queue.push(opt.nextId);
            }
        });
    }
}

const nodeContainer = document.getElementById('tree-node');
const backBtn = document.getElementById('back-btn');
const restartBtn = document.getElementById('restart-btn');
const breadcrumbsContainer = document.getElementById('breadcrumbs');

function updateBreadcrumbs(nodeId) {
    if (!breadcrumbsContainer) return;
    if (nodeId === 'start') {
        breadcrumbsContainer.innerHTML = '';
        return;
    }

    let html = `<span class="breadcrumb-item" onclick="handleOptionClick('start', true)">首頁</span>`;
    for (let i = 0; i < historyStack.length; i++) {
        if (historyStack[i] === 'start') continue;
        let id = historyStack[i];
        let title = faultTree[id]?.title || id;
        html += `<span class="breadcrumb-separator">➔</span>`;
        html += `<span class="breadcrumb-item" onclick="jumpToHistory(${i})">${title}</span>`;
    }

    let activeTitle = faultTree[nodeId]?.title || nodeId;
    html += `<span class="breadcrumb-separator">➔</span>`;
    html += `<span style="color: white; font-weight: 600;">${activeTitle}</span>`;
    breadcrumbsContainer.innerHTML = html;
}

window.jumpToHistory = function (index) {
    const targetId = historyStack[index];
    historyStack = historyStack.slice(0, index);
    nodeContainer.className = 'glass-card fade-in';
    setTimeout(() => {
        renderNode(targetId, 'back');
    }, 50);
};

function renderNode(nodeId, direction = 'forward') {
    const node = faultTree[nodeId];
    if (!node) {
        // 如果沒有資料，顯示引導畫面
        nodeContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-muted);">
                <h2 class="node-title">請問機台目前的狀況是？</h2>
                <p>請根據現場觀察，選擇最符合的敘述。</p>
                <div style="margin-top: 20px;">
                    <button class="primary-option" onclick="document.getElementById('xml-upload').click()" style="margin: 0 auto;">立即匯入 XML</button>
                </div>
            </div>
        `;
        return;
    };

    updateBreadcrumbs(nodeId);

    // Apply animation classes
    nodeContainer.className = 'glass-card'; // reset

    // Force DOM reflow to restart animation
    void nodeContainer.offsetWidth;

    if (direction === 'forward') {
        nodeContainer.classList.add('slide-in-right');
    } else if (direction === 'back') {
        nodeContainer.classList.add('fade-in');
    } else {
        nodeContainer.classList.add('fade-in');
    }

    // Determine back/restart buttons visibility
    if (nodeId === 'start') {
        backBtn.style.display = 'none';
        restartBtn.style.display = 'none';
        historyStack = [];
    } else {
        backBtn.style.display = 'inline-block';
        restartBtn.style.display = 'inline-block';
    }

    // Prepare HTML content
    const descText = node.desc ? `<p class="node-desc">${node.desc.replace(/\\n/g, '<br>')}</p>` : '';
    let buttonsHtml = '';

    if (node.options && node.options.length > 0) {
        node.options.forEach(opt => {
            const btnClass = opt.style ? opt.style : '';
            buttonsHtml += `<button class="${btnClass}" onclick="handleOptionClick('${opt.nextId}')">
                <span>${opt.label}</span>
                ${!opt.style || opt.style === 'primary-option' ? '<span>➜</span>' : ''}
            </button>`;
        });
    }

    let extraStartHtml = '';
    if (nodeId === 'start') {
        extraStartHtml = `
            <div style="margin-top: 20px; text-align: center;">
                <span id="replay-user-guide" class="hidden-guide-btn">ⓘ 重新顯示操作提示</span>
            </div>
        `;
    }

    nodeContainer.innerHTML = `
        <h2 class="node-title">${node.title}</h2>
        ${descText}
        <div class="options-list">
            ${buttonsHtml}
        </div>
        ${extraStartHtml}
    `;

    currentNodeId = nodeId;

    // --- History Support: Push state when navigating ---
    // Only push if it's a new state (not from popstate or initial load)
    if (direction === 'forward' || direction === 'restart') {
        const state = { nodeId: nodeId, historyLength: historyStack.length };
        history.pushState(state, "", "");
    }
}

window.handleOptionClick = function (nextId, isBreadcrumbJump = false) {
    if (!isBreadcrumbJump) {
        historyStack.push(currentNodeId);
    } else {
        historyStack = [];
    }

    nodeContainer.className = 'glass-card slide-out-left';
    setTimeout(() => {
        renderNode(nextId, 'forward');
    }, 250);
};

backBtn.addEventListener('click', () => {
    if (historyStack.length > 0) {
        const prevId = historyStack.pop();
        nodeContainer.className = 'glass-card fade-in';
        setTimeout(() => {
            renderNode(prevId, 'back');
        }, 50);
    }
});

restartBtn.addEventListener('click', () => {
    nodeContainer.className = 'glass-card slide-out-left';
    setTimeout(() => {
        renderNode('start', 'restart');
    }, 250);
});

// ====== 瀏覽器/手機 返回鍵監聽 (History API) ======
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.nodeId) {
        // 如果有 nodeId，代表是內部的路由狀態
        const targetId = e.state.nodeId;
        
        // 更新歷史堆疊：popstate 時我們需要從 stack 中移除項目
        // 因為 popstate 是「已經發生」的回退
        if (historyStack.length > 0) {
            historyStack.pop();
        }
        
        nodeContainer.className = 'glass-card fade-in';
        setTimeout(() => {
            renderNode(targetId, 'back');
        }, 50);
    } else {
        // 如果沒有狀態（例如回到最原始進入頁面時），回到起點
        if (currentNodeId !== 'start') {
            nodeContainer.className = 'glass-card fade-in';
            renderNode('start', 'back');
        }
    }
});

// ====== XML 匯入與解析邏輯 ======
const uploadBtn = document.getElementById('upload-btn');
const xmlUpload = document.getElementById('xml-upload');

if (uploadBtn && xmlUpload) {
    uploadBtn.addEventListener('click', () => {
        xmlUpload.click();
    });

    xmlUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 再次確認
        if (!confirm("確定要匯入此流程圖並覆蓋目前的資料嗎？")) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
            const xmlString = evt.target.result;
            try {
                parseDrawioXml(xmlString, false);
                // 匯入成功的雙重回饋：改變按鈕外觀 2 秒
                const uploadBtn = document.getElementById('upload-btn');
                if (uploadBtn) {
                    const originalText = uploadBtn.innerHTML;
                    uploadBtn.innerHTML = '✅ 匯入成功！';
                    uploadBtn.style.backgroundColor = 'rgba(16, 185, 129, 0.4)'; // translucent emerald
                    setTimeout(() => {
                        uploadBtn.innerHTML = originalText;
                        uploadBtn.style.backgroundColor = '';
                    }, 2000);
                }
            } catch (err) {
                console.error(err);
                alert("解析失敗，請確認是否為正確的 draw.io XML 檔案。");
            }
        };
        reader.readAsText(file);
    });
}

// 導出功能
const exportBtn = document.getElementById('export-btn');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const xmlToExport = currentXmlData || localStorage.getItem('faultTreeXml_blank');
        if (!xmlToExport) {
            alert("目前沒有可導出的資料。");
            return;
        }

        const blob = new Blob([xmlToExport], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fault-tree-export-${new Date().toISOString().slice(0,10)}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

// 管理權限組合鍵切換為：連點標題 5 次 (彈出自定義視窗)
const adminTrigger = document.getElementById('admin-trigger');
const adminLoginModal = document.getElementById('admin-login-modal');
const adminLoginOverlay = document.getElementById('admin-login-overlay');
const adminPwdInput = document.getElementById('admin-pwd-input');
const verifyAdminBtn = document.getElementById('verify-admin-btn');
const closeAdminLoginBtn = document.getElementById('close-admin-login-btn');

let clickCount = 0;
let clickTimer = null;

if (adminTrigger && adminLoginModal && adminLoginOverlay) {
    adminTrigger.addEventListener('click', () => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 1000);

        if (clickCount >= 5) {
            clickCount = 0;
            const controls = document.getElementById('admin-controls');
            // 如果管理面板已經開啟，則縮回
            if (controls && controls.style.display === 'block') {
                controls.style.display = 'none';
                return;
            }
            // 否則開啟登入彈窗
            adminLoginModal.style.display = 'block';
            adminLoginOverlay.style.display = 'block';
            adminPwdInput.value = '';
            adminPwdInput.focus();
        }
    });

    const closeLogin = () => {
        adminLoginModal.style.display = 'none';
        adminLoginOverlay.style.display = 'none';
    };

    closeAdminLoginBtn.addEventListener('click', closeLogin);
    adminLoginOverlay.addEventListener('click', closeLogin);

    verifyAdminBtn.addEventListener('click', () => {
        const pwd = adminPwdInput.value;
        if (pwd === getAdminPassword()) {
            const controls = document.getElementById('admin-controls');
            if (controls) controls.style.display = 'block';
            closeLogin();
        } else {
            alert("口令錯誤。");
            adminPwdInput.value = '';
            adminPwdInput.focus();
        }
    });

    // 支援 Enter 鍵登入
    adminPwdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verifyAdminBtn.click();
    });
}

// 修改口令功能
const changePwdBtn = document.getElementById('change-pwd-btn');
if (changePwdBtn) {
    changePwdBtn.addEventListener('click', () => {
        const oldPwd = prompt("請輸入目前的管理口令：");
        if (oldPwd !== getAdminPassword()) {
            if (oldPwd !== null) alert("口令錯誤，無法修改。");
            return;
        }
        
        const newPwd = prompt("請輸入新口令（至少 4 個字元）：");
        if (!newPwd || newPwd.length < 4) {
            if (newPwd !== null) alert("口令太短，請至少輸入 4 個字元。");
            return;
        }
        
        const confirmPwd = prompt("請再次輸入新口令以確認：");
        if (confirmPwd !== newPwd) {
            if (confirmPwd !== null) alert("兩次輸入不一致，口令未變更。");
            return;
        }
        
        localStorage.setItem('adminPassword', newPwd);
        alert("✅ 管理口令已成功更新！");
    });
}

function parseDrawioXml(xmlString, isInitialLoad = false, isFromServer = false) {
    // XML 防呆與防惡意過濾 (Anti-malice filter)
    const blacklist = ['幹', '靠杯', '靠北', '垃圾', '廢物', '白痴', '智障'];
    const hasMaliciousContent = blacklist.some(word => xmlString.includes(word));
    if (hasMaliciousContent) {
        if (!isInitialLoad) alert("❌ 匯入失敗：流程圖中包含不適當的文字，已拒絕匯入。");
        return;
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const diagrams = xmlDoc.querySelectorAll("diagram");

    if (diagrams.length === 0) {
        if (!isInitialLoad) alert("找不到任何圖表。請確認檔案格式是否正確。");
        return;
    }

    let sourceText = isFromServer ? '伺服器' : (isInitialLoad ? '快取' : '新匯入');
    let newFaultTree = {
        "start": {
            "title": "請問機台目前的狀況是？",
            "desc": `請根據現場觀察，選擇最符合的敘述。`,
            "options": []
        }
    };

    // 通用結束節點
    newFaultTree["resolved"] = {
        "title": "✅ 任務完成",
        "desc": "流程已完成，感謝您的操作。",
        "options": [
            { label: "返回首頁", nextId: "start", style: "primary-option" }
        ]
    };
    newFaultTree["contact_l2"] = {
        "title": "⚠️ 需要進一步處理",
        "desc": "請拍照記錄目前狀況，並回報給負責人員。",
        "options": [
            { label: "返回首頁", nextId: "start", style: "primary-option" }
        ]
    };

    diagrams.forEach(diagram => {
        let diagName = diagram.getAttribute("name") || "未命名分頁";

        let cells = diagram.querySelectorAll("mxCell");
        let edgesRaw = [];
        let nodes = {};
        let nodeGeoms = {};

        // PASS 1: 提取節點、幾何資訊、邊定義
        cells.forEach(cell => {
            let id = cell.getAttribute("id");
            let isVertex = cell.getAttribute("vertex") === "1";
            let isEdge = cell.getAttribute("edge") === "1";
            let value = cell.getAttribute("value");

            if (isVertex) {
                if (value !== null && value !== undefined) {
                    let div = document.createElement("div");
                    div.innerHTML = value.replace(/&nbsp;/g, ' ').replace(/<br\s*\/?>/g, ' ');
                    nodes[id] = div.innerText.replace(/\s+/g, " ").trim();
                } else {
                    nodes[id] = ""; // 邏輯閘 (OR/AND gate)
                }

                let geo = cell.querySelector("mxGeometry");
                if (geo) {
                    let x = parseFloat(geo.getAttribute("x") || 0);
                    let y = parseFloat(geo.getAttribute("y") || 0);
                    let w = parseFloat(geo.getAttribute("width") || 0);
                    let h = parseFloat(geo.getAttribute("height") || 0);
                    nodeGeoms[id] = { x, y, r: x + w, b: y + h };
                }
            } else if (isEdge) {
                let source = cell.getAttribute("source");
                let target = cell.getAttribute("target");
                let geo = cell.querySelector("mxGeometry");

                let sourcePoint = null;
                let targetPoint = null;

                if (geo) {
                    let sp = geo.querySelector("mxPoint[as='sourcePoint']");
                    let tp = geo.querySelector("mxPoint[as='targetPoint']");
                    if (sp) sourcePoint = { x: parseFloat(sp.getAttribute("x")), y: parseFloat(sp.getAttribute("y")) };
                    if (tp) targetPoint = { x: parseFloat(tp.getAttribute("x")), y: parseFloat(tp.getAttribute("y")) };
                }

                edgesRaw.push({ source, target, sourcePoint, targetPoint });
            }
        });

        // 幾何座標匹配 (用於沒有明確 source/target 的邊)
        function findNearestNode(pt) {
            if (!pt) return null;
            let bestId = null;
            let bestDist = Infinity;
            const TOLERANCE = 10;

            for (let id in nodeGeoms) {
                let g = nodeGeoms[id];
                if (pt.x >= g.x - TOLERANCE && pt.x <= g.r + TOLERANCE &&
                    pt.y >= g.y - TOLERANCE && pt.y <= g.b + TOLERANCE) {
                    let cx = (g.x + g.r) / 2;
                    let cy = (g.y + g.b) / 2;
                    let dist = Math.hypot(pt.x - cx, pt.y - cy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestId = id;
                    }
                }
            }
            return bestId;
        }

        // PASS 2: 解析未匹配的邊
        let edges = [];
        edgesRaw.forEach(e => {
            let u = e.source || findNearestNode(e.sourcePoint);
            let v = e.target || findNearestNode(e.targetPoint);
            if (u && v) {
                edges.push({ source: u, target: v });
            }
        });

        // PASS 3: 合成隱式邊 (垂直相鄰的形狀)
        let nodesArr = Object.keys(nodeGeoms);
        for (let i = 0; i < nodesArr.length; i++) {
            for (let j = 0; j < nodesArr.length; j++) {
                if (i === j) continue;
                let idA = nodesArr[i];
                let idB = nodesArr[j];
                let gA = nodeGeoms[idA];
                let gB = nodeGeoms[idB];

                let aBottom = gA.b;
                let bTop = gB.y;
                let aCx = (gA.x + gA.r) / 2;
                let bCx = (gB.x + gB.r) / 2;

                if (Math.abs(aBottom - bTop) <= 5 && Math.abs(aCx - bCx) <= 30) {
                    let hasEdge = edges.some(e => e.source === idA && e.target === idB);
                    if (!hasEdge) {
                        edges.push({ source: idA, target: idB });
                    }
                }
            }
        }

        // 建立鄰接表
        let adj = {};
        for (let id in nodes) adj[id] = [];
        edges.forEach(e => {
            if (adj[e.source]) adj[e.source].push(e.target);
        });

        // 解析空節點 (邏輯閘) — 穿透到有文字的子節點
        function getRealChildren(u, visited = new Set()) {
            let res = [];
            if (!adj[u]) return res;
            for (let nxt of adj[u]) {
                if (visited.has(nxt)) continue;
                visited.add(nxt);
                if (nodes[nxt]) {
                    res.push(nxt);
                } else {
                    res.push(...getRealChildren(nxt, visited));
                }
            }
            return [...new Set(res)];
        }

        let realNodes = Object.keys(nodes).filter(id => nodes[id]);
        let inDegree = {};
        realNodes.forEach(id => inDegree[id] = 0);

        // 用 getRealChildren 計算入度
        realNodes.forEach(u => {
            let children = getRealChildren(u);
            children.forEach(c => {
                if (inDegree[c] !== undefined) inDegree[c]++;
            });

            let options = children.map(c => ({
                "label": nodes[c],
                "nextId": `diag_${diagName}_${c}`
            }));

            let nodeTitle = nodes[u];
            let nodeDesc = "請選擇相應的狀況進行排除：";

            if (options.length === 0) {
                // 終點節點
                options = [
                    { label: "✅ 狀況排除", nextId: "resolved", style: "success-btn" },
                    { label: "❌ 狀況仍在", nextId: "contact_l2", style: "danger-btn" }
                ];
                nodeDesc = "請確認上述排除動作是否有效：";
            }

            newFaultTree[`diag_${diagName}_${u}`] = {
                "title": nodeTitle,
                "desc": nodeDesc,
                "options": options
            };
        });

        // 尋找根節點
        let potentialRoots = realNodes.filter(id => inDegree[id] === 0);
        let actualRoots = potentialRoots.filter(id => getRealChildren(id).length > 0);
        let rootIds = actualRoots.length > 0 ? actualRoots : potentialRoots;

        if (rootIds.length > 0) {
            let topRoot = rootIds.reduce((best, curr) => {
                let gCurr = nodeGeoms[curr];
                let gBest = nodeGeoms[best];
                if (!gCurr) return best;
                if (!gBest) return curr;
                return gCurr.y < gBest.y ? curr : best;
            });

            newFaultTree["start"].options.push({
                "label": `🏭 ${diagName}`,
                "nextId": `diag_${diagName}_${topRoot}`
            });
        }
    });

    if (newFaultTree["start"].options.length > 0) {
        faultTree = newFaultTree;
        currentXmlData = xmlString; // 更新當前資料
        historyStack = [];
        buildParents();
        if (!isInitialLoad && !isFromServer) {
            localStorage.setItem('faultTreeXml_blank', xmlString);
            alert("成功匯入流程圖！系統已自動記憶。");
        }
        renderNode('start', isInitialLoad ? 'init' : 'restart');
    } else {
        if (!isInitialLoad) alert("匯入失敗：未找到有效的起點。");
    }
}

// ====== 搜尋邏輯 ======
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

if (searchInput && searchResults) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query === '' || Object.keys(faultTree).length === 0) {
            searchResults.style.display = 'none';
            return;
        }

        let results = [];
        for (let id in faultTree) {
            if (id === 'start') continue;
            let node = faultTree[id];
            if ((node.title && node.title.toLowerCase().includes(query)) ||
                (node.desc && node.desc.toLowerCase().includes(query))) {
                results.push({ id, title: node.title, desc: node.desc });
            }
        }

        if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-item empty" style="padding: 15px; text-align: center; color: rgba(255,255,255,0.5);">🤔 找不到相關內容</div>';
    } else {
            let html = '';
            results.slice(0, 8).forEach(r => {
                let shortDesc = r.desc ? r.desc.substring(0, 30) + '...' : '';
                html += `<div class="search-item" onclick="jumpToSearchResult('${r.id}')">
                    <strong>${r.title}</strong>
                    <span style="color:#666; font-size:0.85em;">${shortDesc}</span>
                </div>`;
            });
            searchResults.innerHTML = html;
        }
        searchResults.style.display = 'flex';
    });

    window.jumpToSearchResult = function (targetId) {
        searchResults.style.display = 'none';
        searchInput.value = '';
        renderNode(targetId, 'forward');
    };
}

// 初始化：嘗試載入快取或伺服器 XML
function init() {
    // 優先讀取目前的 data.xml，確保是最新的版本
    fetch('data.xml')
        .then(res => {
            if (!res.ok) throw new Error();
            return res.text();
        })
        .then(xml => parseDrawioXml(xml, true, true))
        .catch(() => {
            // 如果 data.xml 讀取失敗，嘗試載入本地變數 xmlData (如果存在)
            if (typeof xmlData !== 'undefined' && xmlData) {
                parseDrawioXml(xmlData, true, true);
            } else {
                renderNode('start');
            }
        });

    // 首次引導提示
    showOnboardingTip();
}

// ====== 步驟計數器 ======
const stepCounter = document.getElementById('step-counter');

function updateStepCounter() {
    if (!stepCounter) return;
    if (currentNodeId === 'start' || Object.keys(faultTree).length === 0) {
        stepCounter.style.display = 'none';
        return;
    }
    const step = historyStack.length + 1;
    stepCounter.textContent = `📍 目前在第 ${step} 步`;
    stepCounter.style.display = 'block';
}

// 包裝原始 renderNode 以加入步驟計數器
const _originalRenderNode = renderNode;
// 我們需要在 renderNode 結尾時更新步驟計數，所以用 MutationObserver 代替
// 直接在 handleOptionClick / backBtn / restartBtn 的回呼中更新
const originalHandleOptionClick = window.handleOptionClick;
window.handleOptionClick = function(nextId, isBreadcrumbJump = false) {
    originalHandleOptionClick(nextId, isBreadcrumbJump);
    setTimeout(updateStepCounter, 300);
};

const originalBackHandler = backBtn.onclick;
backBtn.addEventListener('click', () => {
    setTimeout(updateStepCounter, 100);
});

restartBtn.addEventListener('click', () => {
    setTimeout(updateStepCounter, 300);
});

// ====== 首次引導提示 ======
function showOnboardingTip() {
    const tipEl = document.getElementById('onboarding-tip');
    if (!tipEl) return;
    if (localStorage.getItem('onboardingSeen') === 'true') return;

    setTimeout(() => {
        tipEl.style.display = 'block';
        tipEl.addEventListener('click', () => {
            tipEl.style.display = 'none';
            localStorage.setItem('onboardingSeen', 'true');
        });
    }, 1500);
}

// ====== 操作摘要生成 ======
function generateSummary(result) {
    const now = new Date();
    const timestamp = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    let lines = [`📋 維修排查記錄`, `時間：${timestamp}`, `結果：${result}`, ``, `排查路徑：`];
    
    const fullPath = [...historyStack, currentNodeId];
    fullPath.forEach((id, i) => {
        const node = faultTree[id];
        if (node && id !== 'start') {
            lines.push(`  ${i}. ${node.title}`);
        }
    });
    
    return lines.join('\n');
}

window.copySummary = function(result) {
    const text = generateSummary(result);
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.copy-btn');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<span>✅ 已複製到剪貼簿！</span>';
            setTimeout(() => { btn.innerHTML = original; }, 2000);
        }
    }).catch(() => {
        // 備用：用 textarea 複製
        const ta = document.createElement('textarea');
        ta.value = generateSummary(result);
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('已複製排查記錄！');
    });
};

// ====== 終點頁面增強 ======
// 覆寫原始的 resolved 和 contact_l2 節點渲染
const _origRenderNode = renderNode;

// 重新定義 renderNode 以增強終點頁面
window.renderNodeEnhanced = function(nodeId, direction) {
    _origRenderNode(nodeId, direction);
    updateStepCounter();
    
    // 增強 resolved 節點
    if (nodeId === 'resolved') {
        const summary = generateSummary('✅ 狀況排除');
        const extra = `
            <div class="summary-box">${summary}</div>
            <button class="copy-btn" onclick="copySummary('✅ 狀況排除')">
                <span>📋 複製排查記錄</span>
            </button>
        `;
        nodeContainer.innerHTML += extra;
    }
    
    // 增強 contact_l2 節點
    if (nodeId === 'contact_l2') {
        const summary = generateSummary('⚠️ 需要進一步處理');
        const extra = `
            <div class="contact-card">
                📞 緊急聯絡：<a href="tel:0908175116">0908-175-116</a>（營運一課 課長）<br>
                請拍照記錄後撥打上方電話回報
            </div>
            <div class="summary-box">${summary}</div>
            <button class="copy-btn" onclick="copySummary('⚠️ 需要進一步處理')">
                <span>📋 複製排查記錄</span>
            </button>
        `;
        nodeContainer.innerHTML += extra;
    }
};

// 替換所有 renderNode 的調用點
// 由於 handleOptionClick / backBtn / restartBtn 都在 setTimeout 中調用 renderNode
// 我們直接覆寫全域的 renderNode 引用
// 注意：renderNode 已經在原始代碼中定義為函式宣告，無法直接覆寫
// 所以我們改用 MutationObserver 來偵測內容變化並注入額外內容

const nodeObserver = new MutationObserver(() => {
    updateStepCounter();
    
    if (currentNodeId === 'resolved' && !nodeContainer.querySelector('.summary-box')) {
        const summary = generateSummary('✅ 狀況排除');
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="summary-box">${summary}</div>
            <button class="copy-btn" onclick="copySummary('✅ 狀況排除')">
                <span>📋 複製排查記錄</span>
            </button>
        `;
        nodeContainer.appendChild(div);
    }
    
    if (currentNodeId === 'contact_l2' && !nodeContainer.querySelector('.contact-card')) {
        const summary = generateSummary('⚠️ 需要進一步處理');
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="contact-card">
                📞 緊急聯絡：<a href="tel:0908175116">0908-175-116</a>（營運一課 課長）<br>
                請拍照記錄後撥打上方電話回報
            </div>
            <div class="summary-box">${summary}</div>
            <button class="copy-btn" onclick="copySummary('⚠️ 需要進一步處理')">
                <span>📋 複製排查記錄</span>
            </button>
        `;
        nodeContainer.appendChild(div);
    }
});

nodeObserver.observe(nodeContainer, { childList: true, subtree: true });

// ====== SOP 面板邏輯 ======
const sopFab = document.getElementById('sop-fab-btn');
const sopPanel = document.getElementById('sop-panel');
const sopOverlay = document.getElementById('sop-overlay');
const sopCloseBtn = document.getElementById('sop-close-btn');

function openSopPanel() {
    sopPanel.classList.add('active');
    sopOverlay.classList.add('active');
}

function closeSopPanel() {
    sopPanel.classList.remove('active');
    sopOverlay.classList.remove('active');
}

if (sopFab) sopFab.addEventListener('click', openSopPanel);
if (sopCloseBtn) sopCloseBtn.addEventListener('click', closeSopPanel);
if (sopOverlay) sopOverlay.addEventListener('click', closeSopPanel);

// SOP 階段卡片收合
window.toggleStage = function(headerEl) {
    const stage = headerEl.closest('.sop-stage');
    if (stage) stage.classList.toggle('open');
};

// ====== 教學重播與彩蛋邏輯 ======
// 彩蛋：晉升管理層的隱藏入口 (防呆機制)
let titleClickCount = 0;
let titleClickTimer = null;
const headerIcon = document.querySelector('.app-header h1 svg');
if (headerIcon) {
    headerIcon.style.cursor = 'pointer';
}

// 管理層指南切換與關閉
const toggleAdminGuideBtn = document.getElementById('toggle-admin-guide');
const adminGuide = document.getElementById('admin-guide');
const closeAdminBtn = document.getElementById('close-admin-btn');
const adminControls = document.getElementById('admin-controls');

if (toggleAdminGuideBtn && adminGuide) {
    toggleAdminGuideBtn.addEventListener('click', () => {
        if (adminGuide.style.display === 'none') {
            adminGuide.style.display = 'block';
            toggleAdminGuideBtn.innerHTML = '<span>📖</span> 隱藏說明';
        } else {
            adminGuide.style.display = 'none';
            toggleAdminGuideBtn.innerHTML = '<span>📖</span> 顯示說明';
        }
    });
}

if (closeAdminBtn && adminControls) {
    closeAdminBtn.addEventListener('click', () => {
        adminControls.style.display = 'none';
    });
}

// 執行層教學重播
function bindUserGuideReplay() {
    const replayBtn = document.getElementById('replay-user-guide');
    if (replayBtn) {
        replayBtn.addEventListener('click', () => {
            localStorage.removeItem('onboardingSeen');
            showOnboardingTip(0); // 立即顯示
        });
    }
}

// 攔截原本的 showOnboardingTip 增加 delay 參數
const originalShowOnboardingTip = showOnboardingTip;
window.showOnboardingTip = function(delayms = 1500) {
    const tipEl = document.getElementById('onboarding-tip');
    if (!tipEl) return;
    if (localStorage.getItem('onboardingSeen') === 'true') return;

    setTimeout(() => {
        tipEl.style.display = 'block';
        tipEl.addEventListener('click', () => {
            tipEl.style.display = 'none';
            localStorage.setItem('onboardingSeen', 'true');
        });
    }, delayms);
};

// 使用 MutationObserver 確保當渲染 'start' 時，重播按鈕能綁定事件
const guideObserver = new MutationObserver(() => {
    if (currentNodeId === 'start') {
        bindUserGuideReplay();
    }
});
guideObserver.observe(nodeContainer, { childList: true });

// ====== SOP 動態渲染與編輯器 lógica ======
const defaultSopData = {
    contactTitle: "營運一課 課長",
    contactPhone: "0908-175-116",
    content: `# ⚡ 第一階段：立即斷電
1. *機台端斷電：*開啟機台倉門，關閉內部的 *NFB（無熔絲開關）*
2. *門市端斷電（例外）：*若倉門無法開啟，進入門市請店方協助關閉該機台總電源

# 🔥 第二階段：火勢評估與滅火
1. *火勢微小：*向門市借用滅火器，針對起火點撲滅
2. *火勢過大：*絕對以人身安全為優先，立即放棄滅火！退至安全距離，撥打 *119*

# 📞 第三階段：協同與回報
1. *配合店方：*若有延燒風險，完全配合門市緊急處置（廣播、疏散）
2. *主管通報：*確認自身安全後，*立即撥打 0908-175-116* 回報

# 📷 第四階段：蒐證與現場管制
1. *拍照蒐證：*拍下機台外觀、受損部位、周遭環境，傳送給主管
2. *記錄外部單位：*若消防或警方介入，拍名片或記錄聯絡資訊
3. *現場隔離：*借用三角錐/警示帶隔離受損機台
4. *留守待命：*在安全距離外留守，直到課長下達指示`
};

function parseSopMarkdown(text) {
    let stagesHtml = '';
    let stages = text.split(/(?=# )/); // 以 '# ' 分割章節
    stages.forEach((stage, index) => {
        if (!stage.trim()) return;
        let lines = stage.trim().split('\n');
        let title = lines.shift().replace('# ', '').trim();
        let bodyHtml = '';
        let inList = false;
        
        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            // 簡易粗體解析 *粗體* -> <strong>粗體</strong>
            line = line.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
            
            // 判斷是否為列表項目 (數字. 或 - 開頭)
            if (line.match(/^[0-9]+\.|\-/)) {
                if (!inList) { bodyHtml += '<ol>'; inList = true; }
                let listItemText = line.replace(/^[0-9]+\.|\-/, '').trim();
                bodyHtml += `<li>${listItemText}</li>`;
            } else {
                if (inList) { bodyHtml += '</ol>'; inList = false; }
                bodyHtml += `<p>${line}</p>`;
            }
        });
        if (inList) bodyHtml += '</ol>';
        
        let isOpen = index === 0 ? 'open' : '';
        stagesHtml += `
        <div class="sop-stage ${isOpen}" data-stage="${index + 1}">
            <div class="sop-stage-header" onclick="toggleStage(this)">
                <h3>${title}</h3>
                <span class="chevron">▼</span>
            </div>
            <div class="sop-stage-body">
                <div class="sop-stage-body-inner">
                    ${bodyHtml}
                </div>
            </div>
        </div>
        `;
    });
    return stagesHtml;
}

function renderSopPanel() {
    let sopData;
    try {
        sopData = JSON.parse(localStorage.getItem('customSop')) || defaultSopData;
    } catch(e) { sopData = defaultSopData; }
    
    const container = document.getElementById('sop-content-container');
    if (!container) return;
    
    const phoneLink = sopData.contactPhone.replace(/[-\s]/g, '');
    let html = `
        <div class="emergency-call">
            <p>第一通報窗口：${sopData.contactTitle}</p>
            <a href="tel:${phoneLink}">📞 ${sopData.contactPhone}</a>
        </div>
        ${parseSopMarkdown(sopData.content)}
    `;
    container.innerHTML = html;
}

// SOP 編輯器邏輯
const editSopAdminBtn = document.getElementById('edit-sop-admin-btn');
const sopEditorModal = document.getElementById('sop-editor-modal');
const sopEditorOverlay = document.getElementById('sop-editor-overlay');
const closeSopEditorBtn = document.getElementById('close-sop-editor-btn');
const saveSopBtn = document.getElementById('save-sop-btn');
const resetSopBtn = document.getElementById('reset-sop-btn');

function closeSopEditor() {
    if(sopEditorModal) sopEditorModal.style.display = 'none';
    if(sopEditorOverlay) sopEditorOverlay.style.display = 'none';
}

if (editSopAdminBtn && sopEditorModal) {
    editSopAdminBtn.addEventListener('click', () => {
        let sopData;
        try {
            sopData = JSON.parse(localStorage.getItem('customSop')) || defaultSopData;
        } catch(e) { sopData = defaultSopData; }
        
        document.getElementById('sop-edit-contact-title').value = sopData.contactTitle;
        document.getElementById('sop-edit-contact-phone').value = sopData.contactPhone;
        document.getElementById('sop-edit-content').value = sopData.content;
        
        sopEditorModal.style.display = 'flex';
        sopEditorOverlay.style.display = 'block';
    });
    
    closeSopEditorBtn.addEventListener('click', closeSopEditor);
    sopEditorOverlay.addEventListener('click', closeSopEditor);
    
    saveSopBtn.addEventListener('click', () => {
        const newData = {
            contactTitle: document.getElementById('sop-edit-contact-title').value.trim() || defaultSopData.contactTitle,
            contactPhone: document.getElementById('sop-edit-contact-phone').value.trim() || defaultSopData.contactPhone,
            content: document.getElementById('sop-edit-content').value.trim() || defaultSopData.content
        };
        localStorage.setItem('customSop', JSON.stringify(newData));
        renderSopPanel();
        closeSopEditor();
        alert("✅ SOP 更新成功！");
    });
    
    resetSopBtn.addEventListener('click', () => {
        if(confirm("確定要恢復原廠預設的 SOP 嗎？這將覆蓋您所有的修改。")) {
            localStorage.removeItem('customSop');
            renderSopPanel();
            closeSopEditor();
            alert("✅ SOP 已恢復預設內容。");
        }
    });
}

// 記得初始化時渲染 SOP
renderSopPanel();
init();

