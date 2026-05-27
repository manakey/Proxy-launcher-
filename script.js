const defaultProxies = [
    { name: "サンプル串A", url: "https://google.com" },
    { name: "サンプル串B (未起動)", url: "http://127.0.0.1:9999" }
];

let customProxies = JSON.parse(localStorage.getItem('savedProxies'));
if (!customProxies) {
    customProxies = defaultProxies;
    localStorage.setItem('savedProxies', JSON.stringify(customProxies));
}

let selectedIndex = null;
let editingIndex = null; 

function saveToLocalStorage() {
    localStorage.setItem('savedProxies', JSON.stringify(customProxies));
}

async function fetchProxyStatus() {
    const listElement = document.getElementById('serverList');
    const searchingText = document.getElementById('searchingText');
    if (!listElement) return;
    
    listElement.innerHTML = ''; 
    selectedIndex = null;
    updateButtonStates();

    // 「テスト中...」の文字を再表示する（更新ボタンが押されたとき用）
    if (searchingText) searchingText.style.display = 'block';

    // すべてのチェックが終わったかを監視するためのプロミス配列
    const checkPromises = [];

    for (let [index, proxy] of customProxies.entries()) {
        const item = document.createElement('div');
        item.className = 'server-item';
        item.id = `item-${index}`;
        item.onclick = () => selectServer(index);
        item.ondblclick = () => connectServer();
        
        item.innerHTML = `
            <div class="server-info">
                <span class="server-name">${proxy.name}</span>
                <span class="server-sub">${proxy.url}</span>
            </div>
            <div id="status-${index}">
                <div class="status-box">
                    <div class="signal-bar bar1"></div>
                    <div class="signal-bar bar2"></div>
                    <div class="signal-bar bar3"></div>
                    <div class="signal-bar bar4"></div>
                    <div class="signal-bar bar5"></div>
                </div>
            </div>
        `;
        listElement.appendChild(item);
        
        // チェック処理を配列に追加
        checkPromises.push(checkSingleProxy(proxy, index));
    }

    // ⭐ すべてのプロキシの接続テストが終わったら「テスト中...」を非表示にする
    await Promise.all(checkPromises);
    if (searchingText) searchingText.style.display = 'none';
}

async function checkSingleProxy(proxy, index) {
    const statusContainer = document.getElementById(`status-${index}`);
    if (!statusContainer) return;
    
    const startTime = Date.now();
    try {
        await fetch(proxy.url, { mode: 'no-cors', signal: AbortSignal.timeout(2500) });
        const ping = Date.now() - startTime;
        
        let barsCount = 0;
        let color = "#cccccc";

        if (ping < 150) { barsCount = 5; color = "#2ecc71"; }       // 緑
        else if (ping < 300) { barsCount = 4; color = "#27ae60"; }  // 深緑
        else if (ping < 500) { barsCount = 3; color = "#f1c40f"; }  // 黄色
        else if (ping < 1000) { barsCount = 2; color = "#e67e22"; } // オレンジ
        else { barsCount = 1; color = "#e74c3c"; }                  // 赤

        statusContainer.innerHTML = `
            <div class="status-box" title="${ping}ms">
                <div class="signal-bar bar1" style="background-color: ${barsCount >= 1 ? color : '#ccc'}"></div>
                <div class="signal-bar bar2" style="background-color: ${barsCount >= 2 ? color : '#ccc'}"></div>
                <div class="signal-bar bar3" style="background-color: ${barsCount >= 3 ? color : '#ccc'}"></div>
                <div class="signal-bar bar4" style="background-color: ${barsCount >= 4 ? color : '#ccc'}"></div>
                <div class="signal-bar bar5" style="background-color: ${barsCount >= 5 ? color : '#ccc'}"></div>
            </div>
        `;
    } catch (e) {
        statusContainer.innerHTML = `<div class="signal-offline" title="接続失敗">🔴</div>`;
    }
}

function selectServer(index) {
    if (selectedIndex !== null) {
        const prevItem = document.getElementById(`item-${selectedIndex}`);
        if (prevItem) prevItem.classList.remove('selected');
    }
    selectedIndex = index;
    const currentItem = document.getElementById(`item-${index}`);
    if (currentItem) currentItem.classList.add('selected');
    updateButtonStates();
}

function updateButtonStates() {
    const isSelected = selectedIndex !== null;
    document.getElementById('btnConnect').disabled = !isSelected;
    document.getElementById('btnEdit').disabled = !isSelected;
    document.getElementById('btnDelete').disabled = !isSelected;
}

function openModal(isEdit) {
    const modal = document.getElementById('proxyModal');
    const title = document.getElementById('modalTitle');
    if (isEdit && selectedIndex !== null) {
        editingIndex = selectedIndex;
        title.innerText = "サーバー情報の編集";
        document.getElementById('inputName').value = customProxies[selectedIndex].name;
        document.getElementById('inputAddress').value = customProxies[selectedIndex].url;
    } else {
        editingIndex = null;
        title.innerText = "サーバー情報の追加";
        document.getElementById('inputName').value = "新しい串サーバー";
        document.getElementById('inputAddress').value = "";
    }
    if (modal) modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('proxyModal');
    if (modal) modal.style.display = 'none';
}

function saveServer() {
    const name = document.getElementById('inputName').value || "名無しの串プロキシ";
    let url = document.getElementById('inputAddress').value;
    if (!url) {
        alert('URLを入力してください。');
        return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
    }
    if (editingIndex !== null) {
        customProxies[editingIndex] = { name, url };
    } else {
        customProxies.push({ name, url });
    }
    saveToLocalStorage();
    closeModal();
    fetchProxyStatus();
}

function editServer() { openModal(true); }

function deleteServer() {
    if (selectedIndex !== null && confirm("このサーバーを削除しますか？")) {
        customProxies.splice(selectedIndex, 1);
        saveToLocalStorage();
        fetchProxyStatus();
    }
}

function connectServer() {
    if (selectedIndex !== null) {
        const proxy = customProxies[selectedIndex];
        window.open(proxy.url, '_blank');
    }
}

window.addEventListener('DOMContentLoaded', fetchProxyStatus);
