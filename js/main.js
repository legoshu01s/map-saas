// ================================
// カスタムマップスタイル（グレー・道路白・水色）
// ================================
const customStyle = [
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#e0e0e0" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#a3d9ff" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#bbbbbb" }, { weight: 0.5 }]
  },
  {
    featureType: "administrative",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  }
];

let regionLayer;   // 地方レイヤー
let prefLayer;     // 都県レイヤー
let cityLayer;     // 市区町村レイヤー

// ================================
// 選択状態の保存（localStorage）
// ================================
const STORAGE_KEY = "selectedAreas";

// 保存形式：{ region: [], pref: [], city: [] }
let selectedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
if (!selectedData.region) selectedData.region = [];
if (!selectedData.pref) selectedData.pref = [];
if (!selectedData.city) selectedData.city = [];

// 保存
function saveSelection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedData));
}

// ================================
// feature から「キー」を取り出す（id が無くても対応）
// ================================
function getFeatureKey(feature) {
  // まず本物の ID を探す
  const directId = feature.getId();
  if (directId) return directId;

  // N03_001（都道府県）＋ N03_004（市区町村） の結合でユニークIDを生成
  const pref = feature.getProperty("N03_001");
  const city = feature.getProperty("N03_004");

  if (pref && city) {
    return `${pref}-${city}`;   // 例: "東京都-八王子市"
  }

  // 他に name や code があれば fallback
  return (
    feature.getProperty("id") ||
    feature.getProperty("name") ||
    feature.getProperty("code")
  );
}


// ================================
// 各レイヤーのスタイル設定
// ================================
function applyStyles() {
  if (regionLayer) {
    regionLayer.setStyle(feature => {
      const key = getFeatureKey(feature);
      const selected = selectedData.region.includes(key);
      return {
        fillColor: selected ? "#ff6666" : "#cccccc",
        fillOpacity: selected ? 0.9 : 0.6,
        strokeColor: "#888888",
        strokeWeight: 1
      };
    });
  }

  if (prefLayer) {
    prefLayer.setStyle(feature => {
      const key = getFeatureKey(feature);
      const selected = selectedData.pref.includes(key);
      return {
        fillColor: selected ? "#ff6666" : "#cccccc",
        fillOpacity: selected ? 0.9 : 0.6,
        strokeColor: "#888888",
        strokeWeight: 1
      };
    });
  }

  if (cityLayer) {
    cityLayer.setStyle(feature => {
      const key = getFeatureKey(feature);
      const selected = selectedData.city.includes(key);
      return {
        fillColor: selected ? "#ff6666" : "#cccccc",
        fillOpacity: selected ? 0.9 : 0.6,
        strokeColor: "#888888",
        strokeWeight: 1
      };
    });
  }
}

// ================================
// クリックイベント登録
// ================================
function registerClickEvents() {
  if (regionLayer) {
    regionLayer.addListener("click", e => {
      const key = getFeatureKey(e.feature);
      if (!key) return;

      const arr = selectedData.region;
      if (arr.includes(key)) {
        selectedData.region = arr.filter(v => v !== key);
      } else {
        arr.push(key);
      }
      saveSelection();
      applyStyles();
    });
  }

  if (prefLayer) {
    prefLayer.addListener("click", e => {
      const key = getFeatureKey(e.feature);
      if (!key) return;

      const arr = selectedData.pref;
      if (arr.includes(key)) {
        selectedData.pref = arr.filter(v => v !== key);
      } else {
        arr.push(key);
      }
      saveSelection();
      applyStyles();
    });
  }

  if (cityLayer) {
    cityLayer.addListener("click", e => {
      const key = getFeatureKey(e.feature);
      if (!key) return;

      const arr = selectedData.city;
      if (arr.includes(key)) {
        selectedData.city = arr.filter(v => v !== key);
      } else {
        arr.push(key);
      }
      saveSelection();
      applyStyles();
    });
  }
}

// ================================
// 地図初期化
// ================================
function initMap() {
  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 5,
    center: { lat: 36.5, lng: 138.0 },
    styles: customStyle,
    disableDefaultUI: true
  });

  // ① 地方レイヤー（最初は表示） japan.json を「地方 or 都道府県」GeoJSON として利用
  regionLayer = new google.maps.Data({ map });
  fetch("/data/japan.json")
    .then(res => res.json())
    .then(json => {
      regionLayer.addGeoJson(json);
      applyStyles();   // 読み込み後にも適用
    });

  // ② 都県レイヤー（最初は非表示） ここでも japan.json を使ってるが、あとで分けてOK
  prefLayer = new google.maps.Data({ map: null });
  fetch("/data/japan.json")
    .then(res => res.json())
    .then(json => {
      prefLayer.addGeoJson(json);
      applyStyles();
    });

  // ③ 市区町村レイヤー（最初は非表示） 関東だけなど
  cityLayer = new google.maps.Data({ map: null });
  fetch("/data/kantou-p.json")
    .then(res => res.json())
    .then(json => {
      cityLayer.addGeoJson(json);
      applyStyles();
    });

  // ★ クリックイベント登録
  registerClickEvents();

  // ★ ズームレベルでレイヤー切替
  map.addListener("zoom_changed", () => {
    const z = map.getZoom();

    if (z < 7) {
      // 地方のみ
      regionLayer.setMap(map);
      prefLayer.setMap(null);
      cityLayer.setMap(null);

    } else if (z >= 7 && z < 11) {
      // 都県のみ
      regionLayer.setMap(null);
      prefLayer.setMap(map);
      cityLayer.setMap(null);

    } else {
      // 市区町村のみ
      regionLayer.setMap(null);
      prefLayer.setMap(null);
      cityLayer.setMap(map);
    }
  });
}
