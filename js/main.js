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

// ================================
// 選択された領域を保存する（localStorage）
// ================================
const STORAGE_KEY = "selectedAreas";

// 保存形式：{ region: [], pref: [], city: [] }
let selectedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

if (!selectedData.region) selectedData.region = [];
if (!selectedData.pref) selectedData.pref = [];
if (!selectedData.city) selectedData.city = [];

function saveSelection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedData));
}


// ================================
// 各レイヤーのスタイル設定
// ================================
function applyStyles() {
  // 地方（regionLayer）
  regionLayer.setStyle(feature => {
    const id = feature.getId();
    const selected = selectedData.region.includes(id);
    return {
      fillColor: selected ? "#ff6666" : "#cccccc",
      fillOpacity: selected ? 0.9 : 0.6,
      strokeColor: "#888",
      strokeWeight: 1
    };
  });

  // 都県（prefLayer）
  prefLayer.setStyle(feature => {
    const id = feature.getId();
    const selected = selectedData.pref.includes(id);
    return {
      fillColor: selected ? "#ff6666" : "#cccccc",
      fillOpacity: selected ? 0.9 : 0.6,
      strokeColor: "#888",
      strokeWeight: 1
    };
  });

  // 市区町村（cityLayer）
  cityLayer.setStyle(feature => {
    const id = feature.getId();
    const selected = selectedData.city.includes(id);
    return {
      fillColor: selected ? "#ff6666" : "#cccccc",
      fillOpacity: selected ? 0.9 : 0.6,
      strokeColor: "#888",
      strokeWeight: 1
    };
  });
}


// ================================
// クリックイベント登録
// ================================
function registerClickEvents() {
  // 地方
  regionLayer.addListener("click", e => {
    const id = e.feature.getId();
    if (!id) return;

    const arr = selectedData.region;

    if (arr.includes(id)) {
      // 解除
      selectedData.region = arr.filter(v => v !== id);
    } else {
      // 選択
      arr.push(id);
    }

    saveSelection();
    applyStyles();
  });

  // 都県
  prefLayer.addListener("click", e => {
    const id = e.feature.getId();
    if (!id) return;

    const arr = selectedData.pref;

    if (arr.includes(id)) {
      selectedData.pref = arr.filter(v => v !== id);
    } else {
      arr.push(id);
    }

    saveSelection();
    applyStyles();
  });

  // 市区町村
  cityLayer.addListener("click", e => {
    const id = e.feature.getId();
    if (!id) return;

    const arr = selectedData.city;

    if (arr.includes(id)) {
      selectedData.city = arr.filter(v => v !== id);
    } else {
      arr.push(id);
    }

    saveSelection();
    applyStyles();
  });
}


let regionLayer;   // 地方レイヤー
let prefLayer;     // 都県レイヤー
let cityLayer;     // 市区町村レイヤー

function initMap() {

  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 5,
    center: { lat: 36.5, lng: 138.0 },
    styles: customStyle,
    disableDefaultUI: true
  });

  // ================================
  // ① 地方レイヤー（最初は表示）
  // ================================
  regionLayer = new google.maps.Data({ map });
  fetch("/data/japan.json")           // ← 地方データ
    .then(res => res.json())
    .then(json => regionLayer.addGeoJson(json));


  // ================================
  // ② 都県レイヤー（最初は非表示）
  // ================================
  prefLayer = new google.maps.Data({ map: null });
  fetch("/data/japan.json")      // ← 関東の都県データ
    .then(res => res.json())
    .then(json => prefLayer.addGeoJson(json));


  // ================================
  // ③ 市区町村レイヤー（最初は非表示）
  // ================================
  cityLayer = new google.maps.Data({ map: null });
  fetch("/data/kantou-p.json")      // ← 関東の市町村データ
    .then(res => res.json())
    .then(json => cityLayer.addGeoJson(json));


  // ================================
  // ★ ズームレベルでレイヤー切替
  // ================================
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
