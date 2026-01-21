// ================================
// Japan Tracker - Main JavaScript
// ================================

// Google Maps Custom Style (Dark Mode)
const mapStyle = [
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', stylers: [{ color: '#0c1929' }] },
  { featureType: 'landscape', stylers: [{ color: '#0f0f1a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d5c' }] },
  { featureType: 'transit.line', stylers: [{ visibility: 'on' }, { color: '#4a4a6a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', stylers: [{ visibility: 'off' }] }
];

// 地方名マッピング
const REGION_NAMES = {
  hokkaido: '北海道',
  touhoku: '東北',
  kantou: '関東',
  hokuriku: '北陸',
  toukai: '東海',
  kinki: '近畿',
  chugoku: '中国',
  shikoku: '四国',
  kyushu: '九州',
  okinawa: '沖縄'
};

// 都道府県リスト（地方順）
const PREFECTURES = [
  '北海道',
  '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県',
  '沖縄県'
];

// 選択状態の保存
const STORAGE_KEY = 'japanTrackerSelected';
const WELCOME_KEY = 'japanTrackerWelcomeSeen';
let selected = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

// Undo履歴
let undoHistory = [];
const MAX_UNDO = 50;

// 全フィーチャー
let allFeatures = [];
let dataLayer = null;
let map = null;

// 制覇済み都道府県の記録
let completedPrefs = new Set();

function saveSelection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
}

// Undo履歴に追加
function pushUndo(action, id) {
  undoHistory.push({ action, id });
  if (undoHistory.length > MAX_UNDO) {
    undoHistory.shift();
  }
  updateUndoButton();
}

// Undoボタン状態更新
function updateUndoButton() {
  const btn = document.getElementById('undoButton');
  if (btn) {
    btn.disabled = undoHistory.length === 0;
  }
}

// Undo実行
function performUndo() {
  if (undoHistory.length === 0) return;

  const last = undoHistory.pop();
  if (last.action === 'add') {
    selected.delete(last.id);
  } else {
    selected.add(last.id);
  }

  saveSelection();
  updateStyle();
  updateDashboard();
  updateUndoButton();
}

// スタイル更新
function updateStyle() {
  if (!dataLayer) return;

  dataLayer.setStyle(function(feature) {
    const id = feature.getProperty('id');
    const isSelected = selected.has(id);

    return {
      fillColor: isSelected ? '#4ade80' : '#334155',
      fillOpacity: isSelected ? 0.8 : 0.6,
      strokeColor: '#64748b',
      strokeWeight: 0.5
    };
  });
}

// ダッシュボード更新
function updateDashboard() {
  const regionStats = {};
  const prefStats = {};

  // 初期化
  Object.keys(REGION_NAMES).forEach(region => {
    regionStats[region] = { visited: 0, total: 0 };
  });
  PREFECTURES.forEach(pref => {
    prefStats[pref] = { visited: 0, total: 0 };
  });

  // 集計
  allFeatures.forEach(f => {
    const id = f.getProperty('id');
    const region = f.getProperty('region');
    const pref = f.getProperty('pref');

    if (regionStats[region]) {
      regionStats[region].total++;
      if (selected.has(id)) {
        regionStats[region].visited++;
      }
    }

    if (prefStats[pref]) {
      prefStats[pref].total++;
      if (selected.has(id)) {
        prefStats[pref].visited++;
      }
    }
  });

  // 全体進捗
  let totalVisited = 0;
  let totalCities = 0;
  Object.values(regionStats).forEach(s => {
    totalVisited += s.visited;
    totalCities += s.total;
  });

  const totalPercent = totalCities > 0 ? ((totalVisited / totalCities) * 100).toFixed(1) : 0;

  const percentEl = document.getElementById('totalPercent');
  const progressBarEl = document.getElementById('totalProgressBar');
  const detailEl = document.getElementById('totalDetail');

  if (percentEl) percentEl.textContent = totalPercent;
  if (progressBarEl) progressBarEl.style.width = totalPercent + '%';
  if (detailEl) detailEl.textContent = `${totalVisited} / ${totalCities} 市区町村`;

  // 地方別進捗
  const regionProgressEl = document.getElementById('regionProgress');
  if (regionProgressEl) {
    regionProgressEl.innerHTML = '';

    Object.keys(REGION_NAMES).forEach(region => {
      const stats = regionStats[region];
      const percent = stats.total > 0 ? ((stats.visited / stats.total) * 100).toFixed(1) : 0;

      const item = document.createElement('div');
      item.className = 'region-item';
      item.innerHTML = `
        <span class="region-name">${REGION_NAMES[region]}</span>
        <div class="region-bar-container">
          <div class="region-bar" style="width: ${percent}%"></div>
        </div>
        <span class="region-percent">${percent}%</span>
      `;
      regionProgressEl.appendChild(item);
    });
  }

  // 都道府県別進捗
  const prefProgressEl = document.getElementById('prefProgress');
  if (prefProgressEl) {
    prefProgressEl.innerHTML = '';

    PREFECTURES.forEach(pref => {
      const stats = prefStats[pref];
      const percent = stats.total > 0 ? ((stats.visited / stats.total) * 100).toFixed(1) : 0;
      const isComplete = parseFloat(percent) === 100 && stats.total > 0;

      // 新規制覇チェック
      const wasComplete = completedPrefs.has(pref);
      if (isComplete && !wasComplete) {
        completedPrefs.add(pref);
      } else if (!isComplete && wasComplete) {
        completedPrefs.delete(pref);
      }
      const isNewComplete = isComplete && !wasComplete;

      const item = document.createElement('div');
      item.className = 'pref-item';
      item.innerHTML = `
        <span class="pref-name">
          ${isComplete ? `<span class="pref-badge ${isNewComplete ? 'new' : ''}">🏆</span>` : ''}
          ${pref}
        </span>
        <div class="pref-bar-container">
          <div class="pref-bar ${isComplete ? 'complete' : ''}" style="width: ${percent}%"></div>
        </div>
        <span class="pref-percent">${percent}%</span>
      `;
      prefProgressEl.appendChild(item);
    });
  }
}

// ツールチップ
function initTooltip() {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip || !dataLayer) return;

  dataLayer.addListener('mouseover', function(event) {
    const name = event.feature.getProperty('name');
    const pref = event.feature.getProperty('pref');
    const id = event.feature.getProperty('id');
    const isVisited = selected.has(id);

    tooltip.innerHTML = `
      <div class="tooltip-name">${name}</div>
      <div class="tooltip-pref">${pref}</div>
      ${isVisited ? '<div class="tooltip-status">訪問済み</div>' : ''}
    `;
    tooltip.classList.add('visible');
  });

  dataLayer.addListener('mouseout', function() {
    tooltip.classList.remove('visible');
  });

  // マウス位置追従
  document.addEventListener('mousemove', function(e) {
    if (tooltip.classList.contains('visible')) {
      tooltip.style.left = (e.clientX + 15) + 'px';
      tooltip.style.top = (e.clientY + 15) + 'px';
    }
  });
}

// 検索機能
function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const searchClear = document.getElementById('searchClear');

  if (!searchInput || !searchResults) return;

  searchInput.addEventListener('input', function() {
    const query = this.value.trim().toLowerCase();

    if (query.length < 1) {
      searchResults.innerHTML = '';
      searchResults.classList.remove('active');
      return;
    }

    const matches = allFeatures
      .filter(f => {
        const name = f.getProperty('name').toLowerCase();
        const pref = f.getProperty('pref').toLowerCase();
        return name.includes(query) || pref.includes(query);
      })
      .slice(0, 10);

    if (matches.length === 0) {
      searchResults.innerHTML = '<li class="search-result-item"><span class="search-result-name">結果なし</span></li>';
      searchResults.classList.add('active');
      return;
    }

    searchResults.innerHTML = matches.map(f => {
      const id = f.getProperty('id');
      const name = f.getProperty('name');
      const pref = f.getProperty('pref');
      const isVisited = selected.has(id);
      return `
        <li class="search-result-item ${isVisited ? 'visited' : ''}" data-id="${id}">
          <div class="search-result-name">${name}</div>
          <div class="search-result-pref">${pref}</div>
        </li>
      `;
    }).join('');
    searchResults.classList.add('active');
  });

  // 検索結果クリック
  searchResults.addEventListener('click', function(e) {
    const item = e.target.closest('.search-result-item');
    if (!item) return;

    const id = item.dataset.id;
    if (!id) return;

    // 該当フィーチャーを検索してズーム
    const feature = allFeatures.find(f => f.getProperty('id') === id);
    if (feature && map) {
      // バウンディングボックスを計算
      const bounds = new google.maps.LatLngBounds();
      feature.getGeometry().forEachLatLng(function(latlng) {
        bounds.extend(latlng);
      });
      map.fitBounds(bounds, { padding: 100 });
    }

    // 検索をクリア
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchResults.classList.remove('active');
  });

  // クリアボタン
  if (searchClear) {
    searchClear.addEventListener('click', function() {
      searchInput.value = '';
      searchResults.innerHTML = '';
      searchResults.classList.remove('active');
    });
  }

  // 外側クリックで閉じる
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-section')) {
      searchResults.classList.remove('active');
    }
  });
}

// パネル折りたたみ
function initPanelToggle() {
  const controlPanel = document.getElementById('controlPanel');
  const panelToggle = document.getElementById('panelToggle');
  const statsDashboard = document.getElementById('statsDashboard');
  const dashboardToggle = document.getElementById('dashboardToggle');

  if (panelToggle && controlPanel) {
    panelToggle.addEventListener('click', () => {
      controlPanel.classList.toggle('collapsed');
    });
  }

  if (dashboardToggle && statsDashboard) {
    dashboardToggle.addEventListener('click', () => {
      statsDashboard.classList.toggle('collapsed');
    });
  }
}

// タブ切り替え
function initTabs() {
  const tabs = document.querySelectorAll('.stats-tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const targetTab = this.dataset.tab;

      // タブ切り替え
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      // コンテンツ切り替え
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(targetTab + 'Tab')?.classList.add('active');
    });
  });
}

// 表示設定
function initDisplayToggles() {
  const toggleRail = document.getElementById('toggleRail');
  const toggleRoad = document.getElementById('toggleRoad');

  function updateMapStyle() {
    const styles = [...mapStyle];

    if (!toggleRail?.checked) {
      styles.push({ featureType: 'transit.line', stylers: [{ visibility: 'off' }] });
    }
    if (!toggleRoad?.checked) {
      styles.push({ featureType: 'road', stylers: [{ visibility: 'off' }] });
    }

    map.setOptions({ styles: styles });
  }

  toggleRail?.addEventListener('change', updateMapStyle);
  toggleRoad?.addEventListener('change', updateMapStyle);

  updateMapStyle();
}

// Undoボタン初期化
function initUndo() {
  const undoButton = document.getElementById('undoButton');
  if (undoButton) {
    undoButton.addEventListener('click', performUndo);
  }
  updateUndoButton();
}

// ウェルカムポップアップ
function initWelcome() {
  const overlay = document.getElementById('welcomeOverlay');
  const closeBtn = document.getElementById('welcomeClose');
  const dontShowCheckbox = document.getElementById('dontShowAgain');

  if (!overlay) return;

  // 既に「次回から表示しない」を選択済みなら非表示
  if (localStorage.getItem(WELCOME_KEY) === 'true') {
    overlay.classList.add('hidden');
    return;
  }

  // 閉じるボタン
  closeBtn?.addEventListener('click', function() {
    if (dontShowCheckbox?.checked) {
      localStorage.setItem(WELCOME_KEY, 'true');
    }
    overlay.classList.add('hidden');
  });

  // オーバーレイクリックで閉じる（モーダル外）
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      if (dontShowCheckbox?.checked) {
        localStorage.setItem(WELCOME_KEY, 'true');
      }
      overlay.classList.add('hidden');
    }
  });
}

// 地図初期化
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 5,
    center: { lat: 36.5, lng: 138.0 },
    styles: mapStyle,
    disableDefaultUI: true,
    backgroundColor: '#0f0f1a'
  });

  initPanelToggle();
  initTabs();
  initDisplayToggles();
  initUndo();
  initWelcome();

  // Data Layer
  dataLayer = new google.maps.Data({ map: map });

  // クリックイベント
  dataLayer.addListener('click', function(event) {
    const id = event.feature.getProperty('id');

    if (selected.has(id)) {
      selected.delete(id);
      pushUndo('remove', id);
    } else {
      selected.add(id);
      pushUndo('add', id);
    }

    saveSelection();
    updateStyle();
    updateDashboard();
  });

  // データ読み込み
  const dataUrl = './data/japan-merged.json';
  console.log('データ読み込み開始:', dataUrl);

  // エラーメッセージ表示用関数
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(220, 38, 38, 0.95);
      color: white;
      padding: 24px 32px;
      border-radius: 12px;
      z-index: 1000;
      max-width: 400px;
      text-align: center;
      font-size: 14px;
      line-height: 1.6;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    `;
    errorDiv.innerHTML = message;
    document.body.appendChild(errorDiv);
  }

  // file://プロトコルのチェック
  if (window.location.protocol === 'file:') {
    showError(`
      <strong>ローカルサーバーが必要です</strong><br><br>
      ブラウザのセキュリティ制限により、<br>
      直接HTMLファイルを開くとデータを読み込めません。<br><br>
      以下のコマンドでサーバーを起動してください：<br>
      <code style="background:#1e1e1e;padding:8px 12px;border-radius:6px;display:block;margin-top:12px;">
        cd map-saas<br>
        npm start
      </code>
      <br>または<br>
      <code style="background:#1e1e1e;padding:8px 12px;border-radius:6px;display:block;margin-top:12px;">
        python3 -m http.server 8080
      </code>
    `);
    console.error('file://プロトコルでは動作しません。ローカルサーバーを起動してください。');
    return;
  }

  fetch(dataUrl)
    .then(r => {
      console.log('fetch応答:', r.status, r.statusText);
      if (!r.ok) throw new Error('データ読み込み失敗: ' + r.status);
      return r.json();
    })
    .then(data => {
      console.log('読み込み完了:', data.features.length, '市区町村');
      if (!data.features || data.features.length === 0) {
        console.error('GeoJSONにfeaturesがありません');
        showError('GeoJSONデータにfeaturesがありません');
        return;
      }
      allFeatures = dataLayer.addGeoJson(data);
      console.log('地図に追加完了:', allFeatures.length, 'フィーチャー');

      // ツールチップと検索を初期化
      initTooltip();
      initSearch();

      updateStyle();
      updateDashboard();
    })
    .catch(err => {
      console.error('データ読み込みエラー:', err);
      showError(`
        <strong>データ読み込みエラー</strong><br><br>
        ${err.message}<br><br>
        data/japan-merged.json が存在するか確認してください。
      `);
    });
}
