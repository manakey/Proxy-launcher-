const defaultProxies = [
    { name: "サンプル串A", url: "https://google.com", folder: "デフォルト" },
    { name: "サンプル串B (未起動)", url: "http://127.0.0.1:9999", folder: "デフォルト" }
];
const defaultFolders = ["デフォルト", "お気に入り"];

let customProxies = JSON.parse(localStorage.getItem('savedProxies')) || defaultProxies;
let customFolders = JSON.parse(localStorage.getItem('savedFolders')) || defaultFolders;
let collapsedFolders = JSON.parse(localStorage.getItem('collapsedFolders')) || [];

let isDarkMode = localStorage.getItem('themeDarkMode') === 'true';
let selectedIndex = null;
let editingIndex = null; 
let isBulkMode = false; // 🛠️ 現在一括追加モードを開いているかどうかの状態フラグ

let canvas, ctx;
let particles = [];
const particleCount = 45;
let mouse = { x: null, y: null };

function saveToLocalStorage() { localStorage.setItem('savedProxies', JSON.stringify(customProxies)); }
function saveFoldersToLocalStorage() { localStorage.setItem('savedFolders', JSON.stringify(customFolders)); }
function saveCollapsedToLocalStorage() { localStorage.setItem('collapsedFolders', JSON.stringify(collapsedFolders)); }

function initTheme() {
    const btn = document.getElementById('btnToggleDark');
    document.body.classList.toggle('dark-mode', isDarkMode);
    if (btn) btn.innerText = isDarkMode ? "ON" : "OFF";
}

function toggleDarkMode() { isDarkMode = !isDarkMode; localStorage.setItem('themeDarkMode', isDarkMode); initTheme(); }

function openSettingsModal() { 
    const m = document.getElementById('settingsModal'); 
    if (m) m.style.display = 'flex'; 
    document.getElementById('inputNewFolder').value = ''; 
    document.getElementById('inputRenameFolder').value = ''; 
    updateSettingFolderSelect();
    initTheme(); 
}

function closeSettingsModal() { 
    const m = document.getElementById('settingsModal'); 
    if (m) m.style.display = 'none'; 
}

function createNewFolder() {
    const folderInput = document.getElementById('inputNewFolder');
    const folderName = folderInput.value.trim();
    if (!folderName || customFolders.includes(folderName)) return alert('フォルダ名が不正か既に存在します。');
    customFolders.push(folderName);
    saveFoldersToLocalStorage();
    folderInput.value = '';
    alert('フォルダ「' + folderName + '」を追加しました。');
    updateSettingFolderSelect();
    fetchProxyStatus();
}

function updateSettingFolderSelect() {
    const select = document.getElementById('selectRenameTarget');
    if (!select) return;
    select.innerHTML = '';
    for (let i = 0; i < customFolders.length; i++) {
        const opt = document.createElement('option');
        opt.value = customFolders[i]; opt.innerText = customFolders[i];
        select.appendChild(opt);
    }
}

function renameFolder() {
    const oldName = document.getElementById('selectRenameTarget').value;
    const newName = document.getElementById('inputRenameFolder').value.trim();
    if (!newName) return alert('新しい名前を入力してください。');
    if (customFolders.includes(newName)) return alert('そのフォルダ名は既に存在します。');
    if (oldName === "デフォルト") return alert('デフォルトフォルダの名前は変更できません。');

    const idx = customFolders.indexOf(oldName);
    if (idx !== -1) customFolders[idx] = newName;

    for (let i = 0; i < customProxies.length; i++) {
        if (customProxies[i].folder === oldName) customProxies[i].folder = newName;
    }

    const cIdx = collapsedFolders.indexOf(oldName);
    if (cIdx !== -1) collapsedFolders[cIdx] = newName;

    saveFoldersToLocalStorage(); saveToLocalStorage(); saveCollapsedToLocalStorage();
    document.getElementById('inputRenameFolder').value = '';
    alert('フォルダ名を「' + newName + '」に変更しました。');
    updateSettingFolderSelect();
    fetchProxyStatus();
}

function deleteFolder(folderName) {
    if (folderName === "デフォルト") return alert("デフォルトフォルダは削除できません。");
    if (!confirm('フォルダ「' + folderName + '」を削除しますか？\n中身はデフォルトへ移動します。')) return;
    for (let i = 0; i < customProxies.length; i++) {
        if ((customProxies[i].folder || "デフォルト") === folderName) customProxies[i].folder = "デフォルト";
    }
    customFolders = customFolders.filter(f => f !== folderName);
    collapsedFolders = collapsedFolders.filter(f => f !== folderName);
    saveFoldersToLocalStorage(); saveToLocalStorage(); saveCollapsedToLocalStorage();
    fetchProxyStatus();
}

function toggleFolderCollapse(folderName) {
    const idx = collapsedFolders.indexOf(folderName);
    if (idx === -1) { collapsedFolders.push(folderName); } else { collapsedFolders.splice(idx, 1); }
    saveCollapsedToLocalStorage(); fetchProxyStatus();
}

// 🛠️ 追加モーダルの「単体追加」と「一括追加」の見た目と入力を切り替えるトグル関数
function switchAddMode(toBulk) {
    isBulkMode = toBulk;
    const sTab = document.getElementById('tabSingle');
    const bTab = document.getElementById('tabBulk');
    const sArea = document.getElementById('areaSingleMode');
    const bArea = document.getElementById('areaBulkMode');

    if (isBulkMode) {
        sTab.style.cssText = 'cursor:pointer; font-weight:bold; font-size:13px; padding:4px 8px; color:gray; border-bottom:none;';
        bTab.style.cssText = 'cursor:pointer; font-weight:bold; font-size:13px; padding:4px 8px; border-bottom:2px solid var(--title-color);';
        sArea.style.display = 'none';
        bArea.style.display = 'block';
    } else {
        sTab.style.cssText = 'cursor:pointer; font-weight:bold; font-size:13px; padding:4px 8px; border-bottom:2px solid var(--title-color);';
        bTab.style.cssText = 'cursor:pointer; font-weight:bold; font-size:13px; padding:4px 8px; color:gray; border-bottom:none;';
        sArea.style.display = 'block';
        bArea.style.display = 'none';
    }
}
async function fetchProxyStatus() {
    const listElement = document.getElementById('serverList');
    const searchingText = document.getElementById('searchingText');
    if (!listElement) return;
    listElement.innerHTML = ''; selectedIndex = null; updateButtonStates();
    if (searchingText) searchingText.style.display = 'block';
    const checkPromises = [];

    for (let f = 0; f < customFolders.length; f++) {
        const folderName = customFolders[f];
        const folderProxies = [];
        for (let i = 0; i < customProxies.length; i++) {
            if ((customProxies[i].folder || "デフォルト") === folderName) {
                folderProxies.push({ originalIndex: i, data: customProxies[i] });
            }
        }
        
        const isCollapsed = collapsedFolders.includes(folderName);
        const arrowIcon = isCollapsed ? '▶' : '▼';

        const folderBlock = document.createElement('div');
        folderBlock.className = 'folder-section';
        let delBtn = folderName !== "デフォルト" ? '<button class="btn-delete-folder" id="del-f-' + f + '">削除</button>' : '';
        
        folderBlock.innerHTML = '<div class="folder-header" id="f-head-' + f + '"><div class="folder-title-area"><span>' + arrowIcon + ' 📁 ' + folderName + ' (' + folderProxies.length + ')</span></div>' + delBtn + '</div><div id="folder-list-' + f + '" class="folder-content-wrapper' + (isCollapsed ? ' collapsed' : '') + '"></div>';
        listElement.appendChild(folderBlock);
        
        document.getElementById('f-head-' + f).addEventListener('click', function(e) {
            if (e.target.className === 'btn-delete-folder') return;
            toggleFolderCollapse(folderName);
        });

        if (folderName !== "デフォルト") {
            document.getElementById('del-f-' + f).addEventListener('click', function() { deleteFolder(folderName); });
        }
        const folderListContainer = document.getElementById('folder-list-' + f);

        for (let subIndex = 0; subIndex < folderProxies.length; subIndex++) {
            const itemObj = folderProxies[subIndex];
            const actualIndex = itemObj.originalIndex;
            const proxy = itemObj.data;
            const item = document.createElement('div');
            item.className = 'server-item'; item.id = 'item-' + actualIndex;
            item.onclick = function() { selectServer(actualIndex); };
            item.ondblclick = function() { connectServer(); };
            
            let domain = "google.com";
            try { domain = new URL(proxy.url).hostname; } catch (e) {}
            const faviconUrl = 'https://duckduckgo.com' + domain + '.ico';

            item.innerHTML = '<div class="server-meta"><img class="server-icon" id="icon-' + actualIndex + '" src="' + faviconUrl + '"><div class="server-info"><span class="server-name">' + proxy.name + '</span><span class="server-sub">' + proxy.url + '</span></div></div><div class="server-right-pane"><div id="status-' + actualIndex + '">計測中</div><div class="sort-buttons"><button class="btn-sort" id="btn-up-' + actualIndex + '">▲</button><button class="btn-sort" id="btn-down-' + actualIndex + '">▼</button></div></div>';
            folderListContainer.appendChild(item);

            document.getElementById('btn-up-' + actualIndex).addEventListener('click', function(e) { e.stopPropagation(); moveServerInFolder(actualIndex, -1, folderName); });
            document.getElementById('btn-down-' + actualIndex).addEventListener('click', function(e) { e.stopPropagation(); moveServerInFolder(actualIndex, 1, folderName); });
            
            const imgElement = document.getElementById('icon-' + actualIndex);
            if (imgElement) {
                imgElement.addEventListener('load', function() { if (this.naturalWidth <= 1) switchToFallback(this); });
                imgElement.addEventListener('error', function() { switchToFallback(this); });
            }
            checkPromises.push(checkSingleProxy(proxy, actualIndex));
        }
    }
    await Promise.all(checkPromises);
    if (searchingText) searchingText.style.display = 'none';
}
function switchToFallback(imgNode) {
    if (!imgNode || !imgNode.parentNode) return;
    const fallback = document.createElement('span');
    fallback.style.cssText = 'font-size:24px;width:32px;text-align:center;display:inline-block;';
    fallback.innerText = '🌐';
    imgNode.parentNode.replaceChild(fallback, imgNode);
}

function moveServerInFolder(actualIndex, direction, folderName) {
    const folderIndices = [];
    for (let i = 0; i < customProxies.length; i++) {
        if ((customProxies[i].folder || "デフォルト") === folderName) folderIndices.push(i);
    }
    const pos = folderIndices.indexOf(actualIndex);
    const tPos = pos + direction;
    if (tPos < 0 || tPos >= folderIndices.length) return;
    const targetActualIndex = folderIndices[tPos];
    const temp = customProxies[actualIndex];
    customProxies[actualIndex] = customProxies[targetActualIndex];
    customProxies[targetActualIndex] = temp;
    saveToLocalStorage(); fetchProxyStatus();
}

async function checkSingleProxy(proxy, index) {
    const statusContainer = document.getElementById('status-' + index);
    if (!statusContainer) return;
    const startTime = Date.now(), controller = new AbortController();
    const timeoutId = setTimeout(function() { controller.abort(); }, 2500);
    try {
        await fetch(proxy.url, { mode: 'no-cors', signal: controller.signal }); clearTimeout(timeoutId);
        const ping = Date.now() - startTime;
        let c = ping < 150 ? "#2ecc71" : ping < 300 ? "#27ae60" : ping < 500 ? "#f1c40f" : ping < 1000 ? "#e67e22" : "#e74c3c";
        let bars = ping < 150 ? 5 : ping < 300 ? 4 : ping < 500 ? 3 : ping < 1000 ? 2 : 1;
        let barsHtml = '';
        for(let b=1; b<=5; b++) barsHtml += '<div class="signal-bar bar' + b + '" style="background-color:' + (bars >= b ? c : '#ccc') + '"></div>';
        statusContainer.innerHTML = '<div class="status-box" title="' + ping + 'ms">' + barsHtml + '</div>';
    } catch (e) { statusContainer.innerHTML = '<div class="signal-offline" title="接続失敗">🔴</div>'; }
}

function selectServer(index) {
    if (selectedIndex !== null) { const prev = document.getElementById('item-' + selectedIndex); if (prev) prev.classList.remove('selected'); }
    selectedIndex = index;
    const currentItem = document.getElementById('item-' + index);
    if (currentItem) currentItem.classList.add('selected');
    updateButtonStates();
}

function updateButtonStates() {
    const isSelected = selectedIndex !== null;
    document.getElementById('btnConnect').disabled = !isSelected;
    document.getElementById('btnEdit').disabled = !isSelected;
    document.getElementById('btnDelete').disabled = !isSelected;
}

function updateFolderSelectOptions(selectedFolderName) {
    const select = document.getElementById('selectFolder');
    if (!select) return;
    select.innerHTML = '';
    for (let i = 0; i < customFolders.length; i++) {
        const opt = document.createElement('option');
        opt.value = customFolders[i]; opt.innerText = customFolders[i];
        if (customFolders[i] === selectedFolderName) opt.selected = true;
        select.appendChild(opt);
    }
}

function openModal(isEdit) {
    const modal = document.getElementById('proxyModal');
    let targetFolder = "デフォルト";
    
    switchAddMode(false);
    document.getElementById('textareaBulk').value = '';

    if (isEdit && selectedIndex !== null) {
        editingIndex = selectedIndex;
        document.getElementById('modalTitle').innerText = "サーバー情報の編集";
        document.getElementById('inputName').value = customProxies[selectedIndex].name;
        document.getElementById('inputAddress').value = customProxies[selectedIndex].url;
        targetFolder = customProxies[selectedIndex].folder || "デフォルト";
        document.getElementById('tabBulk').style.display = 'none';
    } else {
        editingIndex = null;
        document.getElementById('modalTitle').innerText = "サーバー情報の追加";
        document.getElementById('inputName').value = "新しい串サーバー";
        document.getElementById('inputAddress').value = "";
        document.getElementById('tabBulk').style.display = 'block';
    }
    updateFolderSelectOptions(targetFolder);
    if (modal) modal.style.display = 'flex';
}

function closeModal() { const modal = document.getElementById('proxyModal'); if (modal) modal.style.display = 'none'; }
// 🛠️ サーバー保存処理（単体追加と一括自動解析の切り分け）
function saveServer() {
    const folder = document.getElementById('selectFolder').value || "デフォルト";

    if (isBulkMode) {
        // 一括追加モード時の自動解析処理
        const bulkText = document.getElementById('textareaBulk').value.trim();
        if (!bulkText) return alert('一括データが空欄です。');

        // 改行、またはカンマで1行ずつに切り分ける
        const lines = bulkText.split(/[\n,]/);
        let addedCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // 行の中にスペース、タブがあるかチェック（「名前 URL」のペアを切り分けるため）
            const parts = line.split(/[\s\t]+/);
            let finalName = "";
            let finalUrl = "";

            if (parts.length >= 2) {
                // 先頭を名前、2番目をURLとする（3番目以降は無視）
                finalName = parts[0];
                finalUrl = parts[1];
            } else {
                // 文字列が1つだけ（＝URLのみ）の場合
                finalUrl = parts[0];
                // 名前は自動的にドメイン名にする
                try { finalName = new URL(finalUrl.startsWith('http') ? finalUrl : 'http://' + finalUrl).hostname; } catch(e) { finalName = "一括追加の串"; }
            }

            if (!finalUrl) continue;
            if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) finalUrl = 'http://' + finalUrl;

            customProxies.push({ name: finalName, url: finalUrl, folder: folder });
            addedCount++;
        }

        if (addedCount === 0) return alert('有効なURLが見つかりませんでした。');
        alert(addedCount + '件のサーバーを一括追加しました！');

    } else {
        // 通常の単体追加（または編集）
        const name = document.getElementById('inputName').value || "名無しの串プロキシ";
        let url = document.getElementById('inputAddress').value;
        if (!url) return alert('URLを入力してください。');
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'http://' + url;
        
        if (editingIndex !== null) {
            customProxies[editingIndex] = { name: name, url: url, folder: folder };
        } else {
            customProxies.push({ name: name, url: url, folder: folder });
        }
    }

    saveToLocalStorage(); closeModal(); fetchProxyStatus();
}

function editServer() { openModal(true); }
function deleteServer() { if (selectedIndex !== null && confirm("このサーバーを削除しますか？")) { customProxies.splice(selectedIndex, 1); saveToLocalStorage(); fetchProxyStatus(); } }
function connectServer() { if (selectedIndex !== null) window.open(customProxies[selectedIndex].url, '_blank'); }

function setupCyberBg() {
    canvas = document.getElementById('cyberBg'); if (!canvas) return; ctx = canvas.getContext('2d');
    resizeCanvas(); window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', function(e) { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mouseleave', function() { mouse.x = null; mouse.y = null; });
    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2.5 + 1.5,
            speedX: (Math.random() - 0.5) * 0.4, speedY: (Math.random() - 0.5) * 0.4, baseAlpha: Math.random() * 0.4 + 0.1, alpha: 0
        });
    }
    animateCyberBg();
}
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

function animateCyberBg() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); const isDark = document.body.classList.contains('dark-mode');
    ctx.strokeStyle = isDark ? 'rgba(0, 255, 100, 0.025)' : 'rgba(0, 150, 255, 0.02)'; ctx.lineWidth = 1; const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    for (let i = 0; i < particles.length; i++) {
        let p = particles[i]; p.x += p.speedX; p.y += p.speedY;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0; if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        p.alpha = p.baseAlpha + Math.sin(Date.now() * 0.001 + i) * 0.08;
        if (mouse.x !== null && mouse.y !== null) {
            let dx = mouse.x - p.x; let dy = mouse.y - p.y; let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) { p.alpha += (1 - dist / 120) * 0.3; }
        }
        ctx.fillStyle = isDark ? 'rgba(46, 204, 113, ' + p.alpha + ')' : 'rgba(52, 152, 219, ' + p.alpha + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(animateCyberBg);
}

window.addEventListener('DOMContentLoaded', function() {
    initTheme(); setupCyberBg(); fetchProxyStatus();

    document.getElementById('btnConnect').addEventListener('click', connectServer);
    document.getElementById('btnSettingsOpen').addEventListener('click', openSettingsModal);
    document.getElementById('btnServerAddOpen').addEventListener('click', function() { openModal(false); });
    document.getElementById('btnEdit').addEventListener('click', editServer);
    document.getElementById('btnDelete').addEventListener('click', deleteServer);
    document.getElementById('btnRefresh').addEventListener('click', fetchProxyStatus);

    document.getElementById('btnModalSave').addEventListener('click', saveServer);
    document.getElementById('btnModalClose').addEventListener('click', closeModal);

    document.getElementById('btnToggleDark').addEventListener('click', toggleDarkMode);
    document.getElementById('btnCreateFolder').addEventListener('click', createNewFolder);
    document.getElementById('btnRenameFolder').addEventListener('click', renameFolder);
    document.getElementById('btnSettingsClose').addEventListener('click', closeSettingsModal);

    document.getElementById('tabSingle').addEventListener('click', function() { switchAddMode(false); });
    document.getElementById('tabBulk').addEventListener('click', function() { switchAddMode(true); });
});
