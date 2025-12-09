const customStyle = [
  { elementType: "labels", stylers: [{ visibility: "off" }] },

  // 行政ラベル非表示
  { featureType: "administrative", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.country", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.province", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },

  // POI はすでに全 OFF なので natural_feature は不要
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", stylers: [{ visibility: "off" }] },
  { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.place_of_worship", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },

  // 道路
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },

  // 水域
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#888f94ff" }] },

  // 地形
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#e0e0e0" }] }
];

// 鉄道 ON
const railOn = {
  featureType: "transit.line",
  stylers: [{ visibility: "on" }]
};

// 鉄道 OFF
const railOff = {
  featureType: "transit.line",
  stylers: [{ visibility: "off" }]
};

// 道路 ON
const roadOn = {
  featureType: "road",
  elementType: "geometry",
  stylers: [{ visibility: "on" }]
};

// 道路 OFF
const roadOff = {
  featureType: "road",
  elementType: "geometry",
  stylers: [{ visibility: "off" }]
};

// ================================
// ★ 都道府県ごとの達成率計算
// ================================
function updatePrefProgress() {
  const box = document.getElementById("progressList");
  if (!box) return;

  const prefStats = {}; // { "北海道": { total: 0, visited: 0 } }

  // ★ cityLayer にロードされている市区町村から計算
  Object.keys(cityFeaturesByRegion).forEach(region => {
    const features = cityFeaturesByRegion[region];
    features.forEach(f => {
      const pref = f.getProperty("N03_001");
      const key = getFeatureKey(f);

      if (!pref) return;

      if (!prefStats[pref]) {
        prefStats[pref] = { total: 0, visited: 0 };
      }

      prefStats[pref].total++;

      if (selectedData.city.includes(key)) {
        prefStats[pref].visited++;
      }
    });
  });

  // ★ 表示更新
  box.innerHTML = "";
  Object.keys(prefStats).forEach(pref => {
    const s = prefStats[pref];
    const percent = ((s.visited / s.total) * 100).toFixed(1);

    const div = document.createElement("div");
    div.textContent = `${pref}：${percent}% 達成`;
    box.appendChild(div);
  });
}


// ================================
// 市区町村 JSON ファイルマップ & 地方ごとの bbox
// ================================
const CITY_JSON = {
  hokkaido: "/data/hokkaido-p.json",
  touhoku:  "/data/touhoku-p.json",
  kantou:   "/data/kantou-p.json",
  hokuriku: "/data/hokuriku-p.json", // 新潟・富山・石川・福井・山梨・長野
  toukai:   "/data/toukai-p.json",   // 愛知・岐阜・三重・静岡
  kinki:    "/data/kinki-p.json",
  chugoku:  "/data/chugoku-p.json",
  shikoku:  "/data/shikoku-p.json",
  kyushu:   "/data/kyushu-p.json",
  okinawa:  "/data/okinawa-p.json"
};

// 各地方のおおまかな範囲（lat/lng）
// 多少広めに取ってあるので誤差OK
const REGION_BBOX = {
  hokkaido: { minLat: 41.0, maxLat: 46.0, minLng: 139.0, maxLng: 146.5 },
  touhoku:  { minLat: 37.0, maxLat: 41.8, minLng: 139.0, maxLng: 142.5 },
  kantou:   { minLat: 34.8, maxLat: 37.2, minLng: 138.0, maxLng: 141.5 },
  hokuriku: { minLat: 35.0, maxLat: 38.8, minLng: 136.0, maxLng: 139.8 },
  toukai:   { minLat: 34.0, maxLat: 36.8, minLng: 136.0, maxLng: 139.5 },
  kinki:    { minLat: 33.5, maxLat: 35.8, minLng: 134.0, maxLng: 136.9 },
  chugoku:  { minLat: 33.5, maxLat: 35.0, minLng: 131.0, maxLng: 134.8 },
  shikoku:  { minLat: 32.0, maxLat: 34.5, minLng: 132.0, maxLng: 134.8 },
  kyushu:   { minLat: 31.0, maxLat: 34.0, minLng: 128.5, maxLng: 132.5 },
  okinawa:  { minLat: 24.0, maxLat: 27.0, minLng: 122.0, maxLng: 132.0 }
};

let regionLayer;
let prefLayer;
let cityLayer;

// ラベル
let cityLabels = [];                 // 全ラベル集合
let prefLabels = [];            // 都道府県ラベル一覧
let cityLabelsByRegion = {};         // 地方別ラベル

// ロード済みフラグ & feature 管理
let loadedRegions = {};              // { region: true/false }
let cityFeaturesByRegion = {};       // { region: Feature[] }

// ================================
// 選択状態の保存（localStorage）
// ================================
const STORAGE_KEY = "selectedAreas";

let selectedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
if (!selectedData.region) selectedData.region = [];
if (!selectedData.pref)   selectedData.pref   = [];
if (!selectedData.city)   selectedData.city   = [];

function saveSelection() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedData));
  } catch (e) {
    // Edge の Tracking Prevention などでブロックされる場合は無視
    console.warn("localStorage 保存に失敗しました:", e);
  }
}

// ================================
// feature のユニークID取得
// ================================
function getFeatureKey(feature) {
  const directId = feature.getId();
  if (directId) return directId;

  const pref = feature.getProperty("N03_001");
  const city = feature.getProperty("N03_004");

  if (pref && city) return `${pref}-${city}`;

  return (
    feature.getProperty("id") ||
    feature.getProperty("name") ||
    feature.getProperty("code")
  );
}

// ================================
// 色塗りスタイル
// ================================
function applyStyles() {
  if (regionLayer) {
    regionLayer.setStyle(f => {
      const key = getFeatureKey(f);
      const selected = selectedData.region.includes(key);
      return {
        fillColor: selected ? "#ff6666" : "#cccccc",
        fillOpacity: selected ? 0.9 : 0.6,
        strokeColor: "#888",
        strokeWeight: 1
      };
    });
  }

  if (prefLayer) {
    prefLayer.setStyle(f => {
      const key = getFeatureKey(f);
      const selected = selectedData.pref.includes(key);
      return {
        fillColor: selected ? "#ff6666" : "#cccccc",
        fillOpacity: selected ? 0.9 : 0.6,
        strokeColor: "#888",
        strokeWeight: 1
      };
    });
  }

  if (cityLayer) {
    cityLayer.setStyle(f => {
      const key = getFeatureKey(f);
      const selected = selectedData.city.includes(key);
      return {
        fillColor: selected ? "#ff6666" : "#cccccc",
        fillOpacity: selected ? 0.9 : 0.6,
        strokeColor: "#888",
        strokeWeight: 1
      };
    });
  }
}

// ================================
// クリックイベント
// ================================
function registerClickEvents() {
  if (regionLayer) {
    regionLayer.addListener("click", e => {
      const key = getFeatureKey(e.feature);
      if (!key) return;
      const arr = selectedData.region;
      selectedData.region = arr.includes(key)
        ? arr.filter(v => v !== key)
        : [...arr, key];
      saveSelection();
      applyStyles();
    });
  }

  if (prefLayer) {
    prefLayer.addListener("click", e => {
      const key = getFeatureKey(e.feature);
      if (!key) return;
      const arr = selectedData.pref;
      selectedData.pref = arr.includes(key)
        ? arr.filter(v => v !== key)
        : [...arr, key];
      saveSelection();
      applyStyles();
    });
  }

if (cityLayer) {
  cityLayer.addListener("click", e => {
    const key = getFeatureKey(e.feature);
    if (!key) return;

    const arr = selectedData.city;
    selectedData.city = arr.includes(key)
      ? arr.filter(v => v !== key)
      : [...arr, key];

    saveSelection();
    applyStyles();

    // ★ 追加：進捗更新
    updatePrefProgress();
  });
}

}

// ================================
// ★ 重心計算（市区町村ラベル用）
// ================================
function getFeatureCenter(geometry) {
  let bounds = new google.maps.LatLngBounds();

  function walk(g) {
    if (!g) return;
    if (g.type === "Polygon") {
      g.coordinates[0].forEach(c => bounds.extend({ lat: c[1], lng: c[0] }));
    } else if (g.type === "MultiPolygon") {
      g.coordinates.forEach(poly => {
        poly[0].forEach(c => bounds.extend({ lat: c[1], lng: c[0] }));
      });
    }
  }

  walk(geometry);
  return bounds.isEmpty() ? null : bounds.getCenter();
}

// ================================
// ★ bbox と表示範囲の交差判定
// ================================
function intersects(bounds, regionBox) {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();

  return !(
    ne.lat() < regionBox.minLat ||
    sw.lat() > regionBox.maxLat ||
    ne.lng() < regionBox.minLng ||
    sw.lng() > regionBox.maxLng
  );
}

// ================================
// ★ 地方ごとに市区町村をロード
// ================================
function loadRegionCities(region, map) {
  if (loadedRegions[region]) return;

  const url = CITY_JSON[region];
  const box = REGION_BBOX[region];
  if (!url || !box) return;

  fetch(url)
    .then(res => res.json())
    .then(json => {
      // DataLayer に追加 & features を保持
      const features = cityLayer.addGeoJson(json);
      cityFeaturesByRegion[region] = features;
      loadedRegions[region] = true;

      applyStyles();
      createCityLabelsForRegion(json, map, region);
    })
    .catch(err => {
      console.error("市区町村 JSON 読み込み失敗:", region, url, err);
    });
}

// ================================
// ★ 都道府県ラベル生成
// ================================
function createPrefLabels(geojson, map) {
  // 既存ラベル消去
  prefLabels.forEach(l => l.setMap(null));
  prefLabels = [];

  const added = {}; // 重複防止（都道府県名は1つだけ）

  geojson.features.forEach(f => {
    const props = f.properties || {};
    const name = props.N03_001 || props.name;
    if (!name) return;

    if (added[name]) return;
    added[name] = true;

    const center = getFeatureCenter(f.geometry);
    if (!center) return;

    const marker = new google.maps.Marker({
      position: center,
      map: null, // ズームに応じて表示
      label: {
        text: name,
        color: "#000",
        fontSize: "14px",
        fontWeight: "bold"
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0
      }
    });

    prefLabels.push(marker);
  });
}


// ================================
// ★ 地方ごとの市区町村をアンロード（削除）
// ================================
function unloadRegionCities(region) {
  if (!loadedRegions[region]) return;

  const feats = cityFeaturesByRegion[region] || [];
  feats.forEach(f => cityLayer.remove(f));
  delete cityFeaturesByRegion[region];
  loadedRegions[region] = false;

  const labels = cityLabelsByRegion[region] || [];
  labels.forEach(m => m.setMap(null));
  delete cityLabelsByRegion[region];

  // cityLabels からも消しておく（強制ではないが整理用）
  cityLabels = cityLabels.filter(m => !labels.includes(m));
}

// ================================
// ★ 表示範囲に入っている地方だけロード/アンロード
// ================================
function updateVisibleMunicipalities(map) {
  const bounds = map.getBounds();
  if (!bounds) return;

  Object.keys(CITY_JSON).forEach(region => {
    const box = REGION_BBOX[region];
    if (!box) return;

    if (intersects(bounds, box)) {
      // 見えている → ロード
      loadRegionCities(region, map);
    } else {
      // 見えていない → アンロード
      unloadRegionCities(region);
    }
  });

  // ★ 市区町村が更新されたあと 1回だけ進捗を更新
  updatePrefProgress();
}


// ================================
// ★ ラベル生成（地方ごと）
// ================================
function createCityLabelsForRegion(geojson, map, region) {
  if (!cityLabelsByRegion[region]) cityLabelsByRegion[region] = [];

  const addedNames = {}; // 地方内で同名市区町村を1回だけ

  geojson.features.forEach(f => {
    const props = f.properties || {};
    const name = props.N03_004;
    if (!name) return;

    if (addedNames[name]) return;
    addedNames[name] = true;

    const center = getFeatureCenter(f.geometry);
    if (!center) return;

    const marker = new google.maps.Marker({
      position: center,
      map: null, // ズーム条件で後から map に載せる
      label: {
        text: name,
        color: "#333",
        fontSize: "10px",
        fontWeight: "bold"
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0
      }
    });

    cityLabels.push(marker);
    cityLabelsByRegion[region].push(marker);
  });
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

  // 地方レイヤー
  regionLayer = new google.maps.Data({ map });
  fetch("/data/japan.json")
    .then(r => r.json())
    .then(json => {
      regionLayer.addGeoJson(json);
      applyStyles();
    });

// 都県レイヤー
prefLayer = new google.maps.Data({ map: null });

fetch("/data/japan.json")
  .then(r => r.json())
  .then(json => {
    const features = prefLayer.addGeoJson(json);

    // ★ 各 feature に都道府県名を付与する（既にあるなら上書きしない）
    features.forEach(f => {
      const name =
        f.getProperty("NAME_1") ||
        f.getProperty("name") ||
        f.getProperty("pref") ||
        null;

      if (name) {
        f.setProperty("N03_001", name); // ★ 市町村と同じ key を付与
      }
    });

    applyStyles();
    createPrefLabels(json, map);
  });

// UI とマップを連動させる
document.getElementById("toggleRail").addEventListener("change", () => updateMapStyle(map));
document.getElementById("toggleRoad").addEventListener("change", () => updateMapStyle(map));

// 初期適用
updateMapStyle(map);


  // 市区町村レイヤー（最初は空・非表示）
  cityLayer = new google.maps.Data({ map: null });

  registerClickEvents();
  applyStyles();

  // ★ ズームでレイヤーとラベル切替 + 動的ロード
map.addListener("zoom_changed", () => {
  const z = map.getZoom();

  if (z < 7) {
    // 地方のみ
    regionLayer.setMap(map);
    prefLayer.setMap(null);
    cityLayer.setMap(null);

    // ラベル消す
    cityLabels.forEach(l => l.setMap(null));
    prefLabels.forEach(l => l.setMap(null));

    // 市区町村 unload
    Object.keys(CITY_JSON).forEach(region => unloadRegionCities(region));

  } else if (z >= 7 && z < 11) {
    // 都道府県レベル
    regionLayer.setMap(null);
    prefLayer.setMap(map);
    cityLayer.setMap(null);

    // ★ 都道府県ラベル表示
    prefLabels.forEach(l => l.setMap(map));

    // 市区町村ラベル非表示
    cityLabels.forEach(l => l.setMap(null));

    // 市区町村 unload
    Object.keys(CITY_JSON).forEach(region => unloadRegionCities(region));

  } else {
    // 市区町村レベル
    regionLayer.setMap(null);
    prefLayer.setMap(null);
    cityLayer.setMap(map);

    // 都道府県ラベル消す
    prefLabels.forEach(l => l.setMap(null));

    // 見えている地方だけロード
    updateVisibleMunicipalities(map);

    // ★市区町村ラベル表示
    Object.keys(cityLabelsByRegion).forEach(region => {
      cityLabelsByRegion[region].forEach(m => m.setMap(map));
    });
  }
});

function updateMapStyle(map) {
  const rail = document.getElementById("toggleRail").checked;
  const road = document.getElementById("toggleRoad").checked;

  let newStyle = [...customStyle];
  newStyle.push(rail ? railOn : railOff);
  newStyle.push(road ? roadOn : roadOff);

  map.setOptions({ styles: newStyle });
}


  // 初期表示時に一応呼んでおく（zoom=5 なので実質何もしない）
  updateVisibleMunicipalities(map);
}
