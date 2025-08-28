import L from 'leaflet';
import axios from 'axios';

// Inject missing styles for add-marker dialog and notifications
(function injectUIStyles() {
  try {
    const css = `
      .hexagram-search-dialog{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);z-index:3000}
      .hexagram-search-dialog .search-dialog-content{width:640px;max-width:92vw;max-height:82vh;display:flex;flex-direction:column;background:rgba(15,42,66,.98);color:rgba(236,240,241,1);border:1px solid rgba(255,255,255,.12);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.35);overflow:hidden}
      .hexagram-search-dialog .search-dialog-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05)}
      .hexagram-search-dialog .search-dialog-header h3{margin:0;font-size:16px;font-weight:700}
      .hexagram-search-dialog .close-btn{appearance:none;border:1px solid rgba(255,255,255,.2);background:transparent;color:rgba(236,240,241,1);width:28px;height:28px;line-height:26px;text-align:center;border-radius:50%;cursor:pointer;transition:all .3s cubic-bezier(.4,0,.2,1)}
      .hexagram-search-dialog .close-btn:hover{background:rgba(255,255,255,.08);border-color:#3498db}
      .hexagram-search-dialog .search-input-container{display:grid;grid-template-columns:1fr auto;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03)}
      .hexagram-search-dialog .search-input{padding:10px 12px;border-radius:4px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:rgba(236,240,241,1);font-size:14px}
      .hexagram-search-dialog .search-btn{padding:10px 14px;border-radius:4px;border:1px solid rgba(255,255,255,.2);background:#3498db;color:#fff;cursor:pointer;font-weight:600;transition:all .3s cubic-bezier(.4,0,.2,1)}
      .hexagram-search-dialog .search-btn:hover{filter:brightness(1.05)}
      .hexagram-search-dialog .search-results{flex:1;overflow:auto;padding:8px 0}
      .hexagram-search-dialog .search-result-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;cursor:pointer;transition:all .3s cubic-bezier(.4,0,.2,1);border-bottom:1px solid rgba(255,255,255,.06)}
      .hexagram-search-dialog .search-result-item:hover{background:rgba(255,255,255,.06)}
      .hexagram-search-dialog .hexagram-info{display:flex;align-items:center;gap:10px}
      .hexagram-search-dialog .hexagram-symbol{font-size:18px;color:#f39c12}
      .hexagram-search-dialog .hexagram-name{font-weight:600}
      .hexagram-search-dialog .hexagram-number{font-size:12px;color:rgba(236,240,241,.7);background:rgba(255,255,255,.08);padding:2px 6px;border-radius:10px}
      .hexagram-search-dialog .hexagram-actions .locate-btn{padding:6px 10px;border-radius:4px;border:1px solid rgba(255,255,255,.2);background:rgba(46,204,113,.18);color:#2ecc71;font-size:12px;cursor:pointer}
      .hexagram-search-dialog .unused-badge{padding:4px 8px;border-radius:4px;font-size:12px;background:rgba(231,76,60,.18);color:#e74c3c;border:1px solid rgba(231,76,60,.3)}
      .hexagram-search-dialog .error,.hexagram-search-dialog .no-results{text-align:center;padding:20px;color:rgba(236,240,241,.7)}
      .notification{position:fixed;top:20px;right:20px;z-index:3001;padding:10px 14px;border-radius:4px;border:1px solid rgba(255,255,255,.12);background:#0f2a42;color:rgba(236,240,241,1);box-shadow:0 4px 16px rgba(0,0,0,.25);animation:popupFadeIn .2s ease-out}
      .notification-success{border-left:3px solid #2ecc71}
      .notification-error{border-left:3px solid #e74c3c}
      .notification-info{border-left:3px solid #3498db}
      @media (max-width:768px){.hexagram-search-dialog .search-dialog-content{width:94vw;max-height:86vh}}
    `;
    const style = document.createElement('style');
    style.setAttribute('data-injected', 'hexagram-dialog-styles');
    style.textContent = css;
    document.head.appendChild(style);
  } catch (e) {
    console.warn('样式注入失败:', e);
  }
})();

// =============================
// Configuration & Global Variables (Pure Image Tiles with CRS.Simple)
// =============================
const WORLD_WIDTH = 1024;               // Level 2 tiles: 4x4 tiles * 256px = 1024px
const WORLD_HEIGHT = 1024;              // Level 2 tiles: 4x4 tiles * 256px = 1024px
const MAX_NATIVE_ZOOM = 8;              // Highest zoom level for native resolution tiles
const TILE_SIZE = 128;                  // Tile size in pixels
const EXTRA_ZOOM = 0;                   // Allow zooming beyond native resolution
const MAX_ZOOM = MAX_NATIVE_ZOOM + EXTRA_ZOOM;
const MIN_ZOOM = 2;                     // Tiles start from zoom level 2

// DOM elements
const pointImageUpload = document.getElementById("pointImageUpload");

// Global state
let map, overlay, markers = [];
let labelsVisible = true;
let dragMode = false;
let currentImageData = null;
let currentEditingHexagram = null;
let markersData = []; // 初始为空，用户通过搜索添加
let isMarkerMode = false; // 添加标记模式状态
let searchResults = []; // 搜索结果
let selectedHexagram = null; // 选中的卦象

// =============================
// Coordinate Conversion Functions (CRS.Simple pixel coordinates)
// =============================
// Convert normalized coordinates [0..1] to Leaflet LatLng (pixel coordinates)
function toLatLngFromNormalized(xNorm, yNorm) {
  const xPx = xNorm * WORLD_WIDTH;
  const yPx = yNorm * WORLD_HEIGHT;
  // In CRS.Simple, y axis is inverted: pixelY -> lat = -pixelY
  return L.latLng(-yPx, xPx);
}

// Convert pixel coordinates to Leaflet LatLng
function toLatLngFromPixel(xPx, yPx) {
  // In CRS.Simple: lat = -pixelY, lng = pixelX
  return L.latLng(-yPx, xPx);
}

// Convert Leaflet LatLng to normalized coordinates [0..1]
function normalizeCoordinates(latLng) {
  const xNorm = latLng.lng / WORLD_WIDTH;
  const yNorm = -latLng.lat / WORLD_HEIGHT; // invert back
  return { x: Math.max(0, Math.min(1, xNorm)), y: Math.max(0, Math.min(1, yNorm)) };
}

// Removed denormalizeCoordinates - using toLatLngFromNormalized instead

// =============================
// API Functions
// =============================
async function fetchMarkers() {
  try {
    const response = await axios.get('http://localhost:8080/api/markers');
    markersData = response.data;
    return markersData;
  } catch (error) {
    console.error('Failed to fetch markers:', error);
    throw error;
  }
}

async function fetchHexagramDetails(hexagramId) {
  try {
    const response = await axios.get(`http://localhost:8080/api/hexagrams/${hexagramId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch hexagram details:', error);
    throw error;
  }
}

async function searchHexagrams(query) {
  try {
    const response = await axios.get(`http://localhost:8080/api/hexagrams/search?q=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    console.error('Failed to search hexagrams:', error);
    throw error;
  }
}

async function addMarkerToDatabase(hexagramNumber, x, y) {
  try {
    const response = await axios.post('http://localhost:8080/api/markers', {
      hexagram_number: hexagramNumber,
      x: x,
      y: y
    });
    return response.data;
  } catch (error) {
    console.error('Failed to add marker:', error);
    throw error;
  }
}

async function updateMarkerInDatabase(markerId, x, y, image) {
  try {
    const response = await axios.put(`http://localhost:8080/api/markers/${markerId}`, {
      x: x,
      y: y,
      image: image
    });
    return response.data;
  } catch (error) {
    console.error('Failed to update marker:', error);
    throw error;
  }
}

async function deleteMarkerFromDatabase(markerId) {
  try {
    const response = await axios.delete(`http://localhost:8080/api/markers/${markerId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete marker:', error);
    throw error;
  }
}

async function uploadPointImage(file, hexagramId) {
  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('hexagramId', hexagramId);

    const response = await axios.post('http://localhost:8080/api/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data.url;
  } catch (error) {
    console.error('Failed to upload image:', error);
    throw error;
  }
}

// =============================
// File Upload Handlers
// =============================
pointImageUpload.addEventListener("change", (e) => {
  if (e.target.files.length > 0 && currentEditingHexagram) {
    handlePointImageUpload(e.target.files[0], currentEditingHexagram);
  }
});

async function handlePointImageUpload(file, hexagram) {
  if (!file.type.startsWith("image/")) {
    alert("请选择有效的图片文件！");
    return;
  }

  try {
    const imageUrl = await uploadPointImage(file, hexagram.number);
    hexagram.image = imageUrl;
    updateMarkerAppearance(hexagram);
    updateImageCount();

    const marker = markers.find((m) => m.options.hexagram === hexagram);
    if (marker && marker.isPopupOpen()) {
      createPopupContent(hexagram, marker);
    }

    console.log(`${hexagram.name} 的图片已更新`);
  } catch (error) {
    alert('图片上传失败！');
  }
}

function updateMarkerAppearance(hexagram) {
  const marker = markers.find((m) => m.options.hexagram === hexagram);
  if (marker) {
    const element = marker.getElement();
    if (hexagram.image) {
      element.classList.add("has-image");
    } else {
      element.classList.remove("has-image");
    }
  }
}

// =============================
// Map Initialization
// =============================
// Custom projection with explicit bounds matching our image pixels
const PixelProjection = {
  project: function (latlng) {
    return L.point(latlng.lng, latlng.lat);
  },
  unproject: function (point) {
    return L.latLng(point.y, point.x);
  },
  // Bounds in projected (latlng) space before transformation
  // Southwest [0, -WORLD_HEIGHT], Northeast [WORLD_WIDTH, 0]
  bounds: L.bounds([0, -WORLD_HEIGHT], [WORLD_WIDTH, 0])
};

// Custom CRS to align tile zoom levels with provided pyramid starting at MIN_ZOOM.
// scale(zoom) = 2^(zoom - MIN_ZOOM) so at zoom=MIN_ZOOM 1 unit == 1 pixel.
const ImageCRS = L.extend({}, L.CRS, {
  projection: PixelProjection,
  transformation: new L.Transformation(1, 0, -1, 0),
  scale: function (zoom) { return Math.pow(2, zoom - MIN_ZOOM); },
  zoom: function (scale) { return Math.log(scale) / Math.LN2 + MIN_ZOOM; },
  infinite: false
});
function createTileLayer() {
  // Pure image tile layer for CRS.Simple
  // With CRS.Simple, Y axis is inverted, so bottom latitude is -WORLD_HEIGHT
  const bounds = L.latLngBounds([[0, 0], [-WORLD_HEIGHT, WORLD_WIDTH]]);

    // Simple tile layer with TMS coordinate system
  // Fetch tiles via backend static server (proxied by Vite in dev)
  const tileLayerInstance = L.tileLayer('/static/tiles/{z}/{x}/{y}.png', {
    tileSize: TILE_SIZE,
    // Declare the native levels available on disk to prevent over-fetching
    minNativeZoom: MIN_ZOOM,
    maxNativeZoom: MAX_NATIVE_ZOOM,
    // Cap the tile requests at the native max; map can still zoom further
    // and Leaflet will upscale tiles instead of requesting higher z.
    maxZoom: MAX_NATIVE_ZOOM,
    noWrap: true,
    // XYZ scheme (top-left origin). Set to true only if your
    // tile set is TMS (bottom-left origin).
    tms: false,
    bounds: bounds,
    attribution: 'Erangel Map',
    errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  });

  tileLayerInstance.addTo(map);
  return tileLayerInstance;
}

// 添加自定义标记模式控件（参考index.js）
function createMarkerModeControl() {
  const MarkerModeControl = L.Control.extend({
    options: {
      position: 'topleft'
    },

    onAdd: function (map) {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

      const button = L.DomUtil.create('button', '', container);
      button.innerHTML = 'M';
      button.title = '开启添加标记模式';
      button.style.cssText = `
        width: 30px;
        height: 30px;
        background: white;
        border: 2px solid rgba(0,0,0,0.2);
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        color: #333;
      `;

      button.onclick = function (e) {
        isMarkerMode = !isMarkerMode;
        console.log('Marker mode:', isMarkerMode);
        button.innerHTML = isMarkerMode ? 'X' : 'M';
        button.title = isMarkerMode ? '关闭添加标记模式' : '开启添加标记模式';
        button.style.background = isMarkerMode ? '#ff6b6b' : 'white';
        button.style.color = isMarkerMode ? 'white' : '#333';
        L.DomEvent.stopPropagation(e);
      };

      L.DomEvent.disableClickPropagation(container);
      return container;
    }
  });

  return new MarkerModeControl();
}

async function initMap() {
  try {
    console.log('正在初始化地图...');

    // Setup bounds for CRS.Simple (y inverted): top-left [0,0], bottom-right [-H, W]
    const bounds = L.latLngBounds([[0, 0], [-WORLD_HEIGHT, WORLD_WIDTH]]);

    // Initialize map with CRS.Simple for pure image tiles
    map = L.map("map", {
      crs: ImageCRS,              // Pure image with adjusted zoom scaling
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      zoomSnap: 1,
      attributionControl: false,
      zoomControl: true,
      maxBounds: bounds,          // Strictly clamp to image bounds
      maxBoundsViscosity: 1.0,    // Prevent panning outside bounds
    });

    // Fit to full image bounds on load
    map.fitBounds(bounds);

    // 创建瓦片层
    overlay = createTileLayer();

    // 添加标记模式控件
    map.addControl(createMarkerModeControl());

    // 不再自动加载现有标记，改为通过用户添加

    // 加载保存的坐标
    loadCoordinatesFromStorage();

    // Default view is already set by fitBounds above

    // 添加地图点击事件（参考index.js）
    map.on('click', function (e) {
      if (isMarkerMode) {
        showHexagramSearchDialog(e.latlng);
      }
    });

    // 添加地图缩放事件监听器，优化标记显示
    map.on('zoomend', function() {
      const currentZoom = map.getZoom();
      console.log('地图缩放级别:', currentZoom);

      // 根据缩放级别调整标记显示
      markers.forEach(marker => {
        // 对于 CircleMarker，使用 setRadius 调整大小，避免对 SVG path 应用 CSS transform 导致位置错乱或不可见
        if (marker instanceof L.CircleMarker) {
          const base = 5; // 初始半径
          let r = base;
          if (currentZoom < 3) {
            r = base * 0.8;
          } else if (currentZoom > 6) {
            r = base * 1.2;
          }
          marker.setRadius(r);
        } else {
          // 仅对使用 DivIcon 的 L.Marker 应用 transform
          const element = marker.getElement();
          if (element) {
            if (currentZoom < 3) {
              element.style.transform = 'translate(-50%, -50%) scale(0.8)';
            } else if (currentZoom > 6) {
              element.style.transform = 'translate(-50%, -50%) scale(1.2)';
            } else {
              element.style.transform = 'translate(-50%, -50%) scale(1)';
            }
          }
        }
      });
    });

    console.log('地图初始化完成');

    // 在地图初始化完成后暴露变量到全局作用域
    exposeGlobalVariables();
  } catch (error) {
    console.error("地图初始化失败:", error);
    alert('地图初始化失败，请检查控制台');
  }
}

// 添加自定义标记功能（参考index.js）
function addCustomMarker(latlng) {
  const marker = L.marker(latlng, {
    draggable: true,
    icon: L.divIcon({
      className: "custom-marker",
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -12],
    })
  }).addTo(map);

  // 添加右键删除功能
  marker.on('contextmenu', function () {
    const isConfirmed = confirm('确定要删除这个标记吗？');
    if (isConfirmed) {
      map.removeLayer(marker);
    }
  });

  // 添加拖拽结束事件
  marker.on('dragend', function (event) {
    const position = this.getLatLng();
    console.log('标记移动到:', position.toString());
  });

  return marker;
}

// =============================
// Marker Creation and Management
// =============================
function dotIcon() {
  return L.divIcon({
    className: "hex-dot",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -12],
  });
}

// Function to sort lines by position
function sortLinesByPosition(lines) {
  const positionOrder = {
    '初九': 1, '初六': 1,
    '九二': 2, '六二': 2,
    '九三': 3, '六三': 3,
    '九四': 4, '六四': 4,
    '九五': 5, '六五': 5,
    '上九': 6, '上六': 6,
    '用九': 7, '用六': 7
  };

  return lines.sort((a, b) => {
    const orderA = positionOrder[a.position] || 999;
    const orderB = positionOrder[b.position] || 999;
    return orderA - orderB;
  });
}

async function createPopupContent(hexagram, marker) {
  try {
    // Fetch detailed hexagram data
    const hexagramData = await fetchHexagramDetails(hexagram.number);

    const coverSection = hexagram.image
      ? `<img src="${hexagram.image}" alt="点位图片" class="cover-image">`
      : `<div class="cover-placeholder">
          <i class="fas fa-image" style="font-size: 24px; opacity: 0.5;"></i>
          <div>暂无图片</div>
        </div>`;

    let contentSections = '';

    // Add hexagram content sections
    if (hexagramData.hexagram.gua_ci) {
      contentSections += `
        <div class="content-section">
          <div class="content-title">卦辞</div>
          <div class="content-text">${hexagramData.hexagram.gua_ci}</div>
          ${hexagramData.hexagram.gua_ci_translation ? `<div class="content-text"><strong>译文：</strong>${hexagramData.hexagram.gua_ci_translation}</div>` : ''}
          ${hexagramData.hexagram.gua_ci_commentary ? `<div class="content-text"><strong>辨证：</strong>${hexagramData.hexagram.gua_ci_commentary}</div>` : ''}
        </div>
      `;
    }

    if (hexagramData.hexagram.tuan_ci) {
      contentSections += `
        <div class="content-section">
          <div class="content-title">彖辞</div>
          <div class="content-text">${hexagramData.hexagram.tuan_ci}</div>
          ${hexagramData.hexagram.tuan_ci_translation ? `<div class="content-text"><strong>译文：</strong>${hexagramData.hexagram.tuan_ci_translation}</div>` : ''}
          ${hexagramData.hexagram.tuan_ci_commentary ? `<div class="content-text"><strong>辨证：</strong>${hexagramData.hexagram.tuan_ci_commentary}</div>` : ''}
        </div>
      `;
    }

    if (hexagramData.hexagram.da_xiang_ci) {
      contentSections += `
        <div class="content-section">
          <div class="content-title">大象辞</div>
          <div class="content-text">${hexagramData.hexagram.da_xiang_ci}</div>
          ${hexagramData.hexagram.da_xiang_translation ? `<div class="content-text"><strong>译文：</strong>${hexagramData.hexagram.da_xiang_translation}</div>` : ''}
          ${hexagramData.hexagram.da_xiang_commentary ? `<div class="content-text"><strong>辨证：</strong>${hexagramData.hexagram.da_xiang_commentary}</div>` : ''}
        </div>
      `;
    }

    // Add lines section
    if (hexagramData.lines && hexagramData.lines.length > 0) {
      let linesContent = '<div class="lines-section">';
      // Sort lines by position
      const sortedLines = sortLinesByPosition([...hexagramData.lines]);

      sortedLines.forEach(line => {
        // Filter out lines that contain only "六" or "九"
        const yaoCi = line.yao_ci || '';
        if (yaoCi.trim() === '六' || yaoCi.trim() === '九') {
          return; // Skip this line
        }

        linesContent += `
          <div class="line-item">
            <div class="line-header">
              <span class="line-position">${line.position}</span>
              <span class="line-title">爻辞</span>
            </div>
            <div class="content-text">${yaoCi || '暂无内容'}</div>
            ${line.yao_translation ? `<div class="content-text"><strong>译文：</strong>${line.yao_translation}</div>` : ''}
            ${line.yao_commentary ? `<div class="content-text"><strong>辨证：</strong>${line.yao_commentary}</div>` : ''}
            ${line.small_xiang_ci ? `<div class="content-text"><strong>小象：</strong>${line.small_xiang_ci}</div>` : ''}
            ${line.small_xiang_translation ? `<div class="content-text"><strong>小象译文：</strong>${line.small_xiang_translation}</div>` : ''}
            ${line.small_xiang_commentary ? `<div class="content-text"><strong>小象辨证：</strong>${line.small_xiang_commentary}</div>` : ''}
          </div>
        `;
      });
      linesContent += '</div>';
      contentSections += linesContent;
    }

    const content = `
      <div class="popup-header">
        <div class="popup-title">
          <span style="font-size: 20px; margin-right: 8px;">${hexagram.symbol}</span>
          ${hexagram.name}
        </div>
        <div class="popup-subtitle">第 ${hexagram.number} 卦</div>
      </div>
      <div class="popup-body">
        <div class="cover-section">
          ${coverSection}
          <button class="upload-btn" onclick="uploadPointImage(${hexagram.number})">
            <i class="fas fa-camera"></i>
            ${hexagram.image ? "更换" : "上传"}
          </button>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">X 坐标</div>
            <div class="info-value">${hexagram.x.toFixed(4)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Y 坐标</div>
            <div class="info-value">${hexagram.y.toFixed(4)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">内卦</div>
            <div class="info-value">${hexagramData.hexagram.inner_trigram || '未知'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">外卦</div>
            <div class="info-value">${hexagramData.hexagram.outer_trigram || '未知'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">图片状态</div>
            <div class="info-value">
              <span class="status-badge ${hexagram.image ? "status-active" : "status-inactive"}">
                <i class="fas fa-${hexagram.image ? "check" : "times"}" style="margin-right: 3px; font-size: 9px;"></i>
                ${hexagram.image ? "已配图" : "未配图"}
              </span>
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">编辑状态</div>
            <div class="info-value">
              <span class="status-badge status-active">
                <i class="fas fa-edit" style="margin-right: 3px; font-size: 9px;"></i>
                可编辑
              </span>
            </div>
          </div>
        </div>
        ${contentSections}
      </div>
    `;

    marker.setPopupContent(content);
  } catch (error) {
    console.error('Failed to create popup content:', error);
    marker.setPopupContent('<div>加载失败</div>');
  }
}

function addMarkers() {
  // Clear existing markers
  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];

  // 如果没有标记数据，直接返回
  if (!markersData || markersData.length === 0) {
    updateCounts();
    return;
  }

  // 使用分批渲染优化性能（参考index.js）
  const chunkSize = 50; // 每批次50个标记
  const totalChunks = Math.ceil(markersData.length / chunkSize);
  let currentChunk = 0;

  function renderChunk() {
    const start = currentChunk * chunkSize;
    const end = start + chunkSize;
    const chunk = markersData.slice(start, end);

    chunk.forEach((markerData) => {
      // Convert normalized coordinates to pixel coordinates for CRS.Simple
      const position = toLatLngFromNormalized(markerData.x, markerData.y);

      // Use circleMarker for pixel-accurate positioning in CRS.Simple
      const marker = L.circleMarker(position, {
        radius: 5,          // Dot radius in pixels
        weight: 0,          // No stroke
        fill: true,
        fillOpacity: 1,
        fillColor: '#e11d48', // Rose-600
        draggable: dragMode,
        hexagram: markerData,
        zIndexOffset: 1000,
      }).addTo(map);

      // Set appearance
      updateMarkerAppearance(markerData);

      // Tooltip
      const label = `<span class="sym">${markerData.symbol}</span><span class="name">${markerData.name}</span><span class="num">#${markerData.number}</span>`;

      marker.bindTooltip(label, {
        permanent: true,
        direction: "right",
        offset: [8, 0],
        className: "hex-tip",
      });

      // Popup - 确保与marker使用相同的位置
      const popupOptions = {
        maxWidth: 450,
        minWidth: 320,
        className: "custom-popup",
        closeButton: true,
        autoClose: false,
        autoPan: true,
        keepInView: true,
        offset: [0, 0], // 不使用偏移，确保与marker位置完全一致
      };

      marker.bindPopup("", popupOptions);

      // Click event
      marker.on("click", (e) => {
        currentEditingHexagram = markerData;
        createPopupContent(markerData, marker);
        marker.openPopup();
        e.originalEvent.stopPropagation();
      });

      // Drag events - 优化拖拽处理（参考index.js）
      marker.on("dragstart", (e) => {
        e.target.getElement().classList.add("dragging");
        e.target.closeTooltip();
        e.target.closePopup();
      });

      marker.on("dragend", async (e) => {
        e.target.getElement().classList.remove("dragging");

        const newPos = e.target.getLatLng();
        const normalizedCoords = normalizeCoordinates(newPos);

        // 更新数据库
        try {
          await updateMarkerInDatabase(markerData.id, normalizedCoords.x, normalizedCoords.y, markerData.image);
          markerData.x = normalizedCoords.x;
          markerData.y = normalizedCoords.y;
          console.log(`${markerData.name} 新坐标: (${markerData.x.toFixed(4)}, ${markerData.y.toFixed(4)})`);
        } catch (error) {
          console.error('更新坐标失败:', error);
          showNotification('更新坐标失败', 'error');
        }

        e.target.openTooltip();

        if (marker.isPopupOpen()) {
          createPopupContent(markerData, marker);
        }
      });

      // 右键删除事件
      marker.on("contextmenu", async (e) => {
        e.originalEvent.preventDefault();
        const isConfirmed = confirm(`确定要删除 ${markerData.name} 吗？`);
        if (isConfirmed) {
          try {
            await deleteMarkerFromDatabase(markerData.id);
            map.removeLayer(marker);
            const index = markers.indexOf(marker);
            if (index > -1) {
              markers.splice(index, 1);
            }
            showNotification(`已删除 ${markerData.name}`, 'success');
          } catch (error) {
            console.error('删除标记失败:', error);
            showNotification('删除标记失败', 'error');
          }
        }
      });

      markers.push(marker);
    });

    currentChunk++;
    if (currentChunk < totalChunks) {
      // 使用setTimeout来调度下一批次，避免阻塞UI
      setTimeout(renderChunk, 0);
    } else {
      // 所有标记渲染完成
      updateCounts();
    }
  }

  // 开始渲染第一批次
  renderChunk();
}

// Global function for popup
window.uploadPointImage = function (hexagramNum) {
  const hexagram = markersData.find((h) => h.number === hexagramNum);
  if (hexagram) {
    currentEditingHexagram = hexagram;
    pointImageUpload.click();
  }
};

// =============================
// Control Functions
// =============================
function toggleAllLabels() {
  labelsVisible = !labelsVisible;
  const labelToggleText = document.getElementById("labelToggleText");
  labelToggleText.textContent = labelsVisible ? "隐藏标签" : "显示标签";

  markers.forEach((marker) => {
    const tt = marker.getTooltip();
    if (tt && tt._container) {
      tt._container.style.display = labelsVisible ? "block" : "none";
    }
  });
}

function resetView() {
  if (map) {
    // Fit to full image bounds for CRS.Simple (y inverted)
    const bounds = L.latLngBounds([[0, 0], [-WORLD_HEIGHT, WORLD_WIDTH]]);
    map.fitBounds(bounds);
  }
}

function toggleDragMode() {
  dragMode = !dragMode;
  const dragModeText = document.getElementById("dragModeText");
  const dragIcon = document.getElementById("dragIcon");
  const editModeStatus = document.getElementById("editModeStatus");

  dragModeText.textContent = dragMode ? "禁用拖拽" : "启用拖拽";
  dragIcon.className = dragMode ? "fas fa-lock" : "fas fa-arrows-alt";
  editModeStatus.textContent = dragMode ? "编辑模式" : "查看模式";

  markers.forEach((marker) => {
    if (dragMode) {
      if (marker.dragging && typeof marker.dragging.enable === 'function') {
        marker.dragging.enable();
      }
      const el = marker.getElement && marker.getElement();
      if (el) el.style.cursor = "move";
    } else {
      if (marker.dragging && typeof marker.dragging.disable === 'function') {
        marker.dragging.disable();
      }
      const el = marker.getElement && marker.getElement();
      if (el) el.style.cursor = "pointer";
    }
  });
}

// =============================
// Data Persistence
// =============================
function saveCoordinates() {
  const data = {
    markers: markersData,
    timestamp: new Date().toISOString(),
    version: "2.0",
  };

  try {
    localStorage.setItem("hexagram_coordinates", JSON.stringify(data));

    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hexagram_coordinates_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification("坐标数据已保存并下载！", 'success');
  } catch (error) {
    console.error("保存失败:", error);
    showNotification("保存失败！", 'error');
  }
}

function loadCoordinates() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.markers && Array.isArray(data.markers)) {
          markersData = data.markers;
          addMarkers();
          showNotification("坐标数据已成功加载！", 'success');
        } else {
          throw new Error("无效的数据格式");
        }
      } catch (error) {
        console.error("加载失败:", error);
        showNotification("加载失败：文件格式不正确！", 'error');
      }
    };
    reader.readAsText(file);
  };

  fileInput.click();
}

function loadCoordinatesFromStorage() {
  try {
    const saved = localStorage.getItem("hexagram_coordinates");
    if (saved) {
      const data = JSON.parse(saved);
      if (data.markers && Array.isArray(data.markers)) {
        markersData = data.markers;
        addMarkers();
        console.log("从本地存储加载坐标数据");
      }
    }
  } catch (error) {
    console.error("加载本地存储失败:", error);
  }
}

function resetCoordinates() {
  if (confirm("确定要重置所有坐标到默认位置吗？这将清除所有上传的图片！")) {
    // Reset to original data from API
    markersData.forEach((marker, index) => {
      // Keep original coordinates from API
      marker.image = null;
    });
    addMarkers();
    updateCounts();
    localStorage.removeItem("hexagram_coordinates");
    resetView();
    showNotification("坐标已重置！", 'success');
  }
}

function updateCounts() {
  document.getElementById("hexagramCount").textContent = markers.length;
  updateImageCount();
}

function updateImageCount() {
  const imageCount = markersData.filter((h) => h.image).length;
  document.getElementById("imageCount").textContent = imageCount;
}

// =============================
// Initialization
// =============================
document.addEventListener("DOMContentLoaded", () => {
  console.log("开始初始化地图应用");
  initMap();
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    saveCoordinates();
  }
});

// 暴露全局变量和函数的函数
function exposeGlobalVariables() {
  // 将必要的函数和变量暴露到全局作用域供search-functions.js使用
  window.searchHexagrams = searchHexagrams;
  window.addMarkerToDatabase = addMarkerToDatabase;
  window.updateMarkerInDatabase = updateMarkerInDatabase;
  window.deleteMarkerFromDatabase = deleteMarkerFromDatabase;
  window.normalizeCoordinates = normalizeCoordinates;
  window.toLatLngFromNormalized = toLatLngFromNormalized;
  window.toLatLngFromPixel = toLatLngFromPixel;
  window.dotIcon = dotIcon;
  window.updateMarkerAppearance = updateMarkerAppearance;
  window.createPopupContent = createPopupContent;
  window.updateCounts = updateCounts;

  // 暴露控制面板函数到全局作用域供HTML onclick使用
  window.toggleAllLabels = toggleAllLabels;
  window.resetView = resetView;
  window.saveCoordinates = saveCoordinates;
  window.loadCoordinates = loadCoordinates;
  window.resetCoordinates = resetCoordinates;
  window.toggleDragMode = toggleDragMode;

  // 暴露变量 - 这些需要在运行时动态更新
  window.getMarkersData = () => markersData;
  window.setMarkersData = (data) => { markersData = data; };
  window.getMarkers = () => markers;
  window.getDragMode = () => dragMode;
  window.getCurrentEditingHexagram = () => currentEditingHexagram;
  window.setCurrentEditingHexagram = (hexagram) => { currentEditingHexagram = hexagram; };
  window.getMap = () => map;
}
