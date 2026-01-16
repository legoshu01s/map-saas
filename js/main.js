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

// 選択状態の保存
const STORAGE_KEY = 'japanTrackerSelected';
let selected = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

// 全フィーチャー
let allFeatures = [];
let dataLayer = null;

function saveSelection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
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

  // 初期化
  Object.keys(REGION_NAMES).forEach(region => {
    regionStats[region] = { visited: 0, total: 0 };
  });

  // 集計
  allFeatures.forEach(f => {
    const id = f.getProperty('id');
    const region = f.getProperty('region');
    if (regionStats[region]) {
      regionStats[region].total++;
      if (selected.has(id)) {
        regionStats[region].visited++;
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

// 表示設定
function initDisplayToggles(map) {
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

// 地図初期化
function initMap() {
  const map = new google.maps.Map(document.getElementById('map'), {
    zoom: 5,
    center: { lat: 36.5, lng: 138.0 },
    styles: mapStyle,
    disableDefaultUI: true,
    backgroundColor: '#0f0f1a'
  });

  initPanelToggle();
  initDisplayToggles(map);

  // Data Layer
  dataLayer = new google.maps.Data({ map: map });

  // クリックイベント
  dataLayer.addListener('click', function(event) {
    const id = event.feature.getProperty('id');
    const name = event.feature.getProperty('name');
    const pref = event.feature.getProperty('pref');

    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }

    saveSelection();
    updateStyle();
    updateDashboard();
  });

  // データ読み込み
  const dataUrl = './data/japan-merged.json';
  console.log('データ読み込み開始:', dataUrl);

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
        return;
      }
      allFeatures = dataLayer.addGeoJson(data);
      console.log('地図に追加完了:', allFeatures.length, 'フィーチャー');
      updateStyle();
      updateDashboard();
    })
    .catch(err => {
      console.error('データ読み込みエラー:', err);
      console.error('ヒント: file://ではなくhttp://localhost:8080でアクセスしてください');
    });
}
