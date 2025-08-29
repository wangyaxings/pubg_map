// 显示卦象搜索对话框
async function showHexagramSearchDialog(latlng) {
  // 创建搜索对话框
  const dialog = document.createElement('div');
  dialog.className = 'hexagram-search-dialog';
  dialog.innerHTML = `
    <div class="search-dialog-content">
      <div class="search-dialog-header">
        <h3>选择卦象</h3>
        <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
      </div>
      <div class="search-input-container">
        <input type="text" id="hexagramSearchInput" placeholder="搜索卦象名称、符号或编号..." class="search-input">
        <button onclick="searchHexagramsFromDialog()" class="search-btn">搜索</button>
      </div>
      <div id="searchResults" class="search-results">
        <div style="text-align: center; padding: 20px; color: rgba(236, 240, 241, 0.6);">正在加载卦象列表...</div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // 存储点击位置
  dialog.dataset.latlng = JSON.stringify(latlng);

  // 添加搜索输入事件
  const searchInput = dialog.querySelector('#hexagramSearchInput');
  searchInput.addEventListener('input', debounce(async (e) => {
    const query = e.target.value.trim();
    if (query.length >= 1) {
      await searchHexagramsFromDialog(query);
    } else {
      // 如果搜索框为空，显示所有卦象
      await loadAllHexagrams();
    }
  }, 300));

  // 初始加载所有卦象
  await loadAllHexagrams();

  // 自动聚焦搜索框
  searchInput.focus();
}

// 加载所有卦象
async function loadAllHexagrams() {
  try {
    const response = await fetch('/api/hexagrams');
    const hexagrams = await response.json();
    displaySearchResults(hexagrams);
  } catch (error) {
    console.error('加载卦象失败:', error);
    document.getElementById('searchResults').innerHTML = '<div class="error">加载卦象失败，请检查后端服务</div>';
  }
}

// 从对话框搜索卦象
async function searchHexagramsFromDialog(query = null) {
  try {
    const searchInput = document.getElementById('hexagramSearchInput');
    const queryText = query || searchInput.value.trim();

    if (queryText.length < 1) {
      await loadAllHexagrams();
      return;
    }

    const results = await window.searchHexagrams(queryText);
    displaySearchResults(results);
  } catch (error) {
    console.error('搜索失败:', error);
    document.getElementById('searchResults').innerHTML = '<div class="error">搜索失败，请重试</div>';
  }
}

// 显示搜索结果
function displaySearchResults(results) {
  const resultsContainer = document.getElementById('searchResults');

  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="no-results">未找到匹配的卦象</div>';
    return;
  }

  // Build count map from current markers on the map
  let countMap = {};
  try {
    const markersData = (window.getMarkersData && window.getMarkersData()) || [];
    markersData.forEach(m => {
      const num = (m && (m.number || (m.hexagram && m.hexagram.number))) || null;
      if (num != null) {
        countMap[num] = (countMap[num] || 0) + 1;
      }
    });
  } catch (e) {
    console.warn('统计卦象出现次数失败:', e);
  }

  // Sort: by count ascending; 0-count first; ties by number ascending
  const sorted = [...results].sort((a, b) => {
    const ca = countMap[a.number] || 0;
    const cb = countMap[b.number] || 0;
    if (ca !== cb) return ca - cb; // ascending; 0s first
    return (a.number || 0) - (b.number || 0);
  });

  const resultsHtml = sorted.map(hexagram => {
    const count = countMap[hexagram.number] || 0;
    const rightHtml = count > 0
      ? `<button class="locate-btn" onclick="event.stopPropagation(); locateHexagram(${hexagram.number})" title="定位到已添加的位置">定位 x${count}</button>`
      : `<span class="unused-badge" title="未添加">未添加</span>`;

    return `
      <div class="search-result-item" onclick="selectHexagram(${hexagram.number}, '${hexagram.name}', '${hexagram.symbol}')">
        <div class="hexagram-info">
          <span class="hexagram-symbol">${hexagram.symbol}</span>
          <span class="hexagram-name">${hexagram.name}</span>
          <span class="hexagram-number">#${hexagram.number}</span>
        </div>
        <div class="hexagram-actions">${rightHtml}</div>
      </div>
    `;
  }).join('');

  resultsContainer.innerHTML = resultsHtml;
}

// 快速定位到地图上已存在的卦象位置（如存在多个，自动框选）
function locateHexagram(number) {
  try {
    const map = window.getMap();
    const markersData = (window.getMarkersData && window.getMarkersData()) || [];
    const matches = markersData.filter(m => (m.number || (m.hexagram && m.hexagram.number)) === number);
    if (!matches.length) {
      showNotification('该卦尚未添加到地图', 'info');
      return;
    }

    const latlngs = matches.map(m => window.toLatLngFromNormalized(m.x, m.y));
    if (latlngs.length === 1) {
      const target = latlngs[0];
      const targetZoom = Math.max(map.getZoom(), 5);
      map.setView(target, targetZoom, { animate: true });
    } else {
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds.pad(0.2));
    }
  } catch (e) {
    console.error('定位失败:', e);
  }
}

// 选择卦象
async function selectHexagram(number, name, symbol) {
  try {
    const dialog = document.querySelector('.hexagram-search-dialog');
    const latlng = JSON.parse(dialog.dataset.latlng);

    // 标准化坐标 - Convert from pixel coordinates to normalized [0..1]
    const latLngObj = L.latLng(latlng.lat, latlng.lng);
    const normalizedCoords = window.normalizeCoordinates(latLngObj);

    // 添加到数据库
    const newMarker = await window.addMarkerToDatabase(number, normalizedCoords.x, normalizedCoords.y);

    // 添加到地图
    addMarkerToMap(newMarker);

    // 关闭对话框
    dialog.remove();

    // 显示成功消息
    showNotification(`已添加 ${name} (${symbol}) 到地图`, 'success');

  } catch (error) {
    console.error('添加标记失败:', error);
    showNotification('添加标记失败，请重试', 'error');
  }
}

// 添加标记到地图
function addMarkerToMap(markerData) {
  // 将新标记数据添加到全局数组
  const markersData = window.getMarkersData();
  markersData.push(markerData);
  window.setMarkersData(markersData);

  // Convert normalized coordinates to pixel coordinates for CRS.Simple
  const position = window.toLatLngFromNormalized(markerData.x, markerData.y);

  // Use circleMarker for pixel-accurate positioning in CRS.Simple
  const marker = L.circleMarker(position, {
    radius: 5,          // Dot radius in pixels
    weight: 0,          // No stroke
    fill: true,
    fillOpacity: 1,
    fillColor: '#e11d48', // Rose-600
    draggable: window.getDragMode(),
    hexagram: markerData,
    zIndexOffset: 1000,
  }).addTo(window.getMap());

  // 设置外观
  window.updateMarkerAppearance(markerData);

  // 工具提示
  const label = `<span class="sym">${markerData.symbol}</span><span class="name">${markerData.name}</span><span class="num">#${markerData.number}</span>`;

  marker.bindTooltip(label, {
    permanent: true,
    direction: "right",
    offset: [8, 0],
    className: "hex-tip",
  });

  // 弹窗 - 确保与marker使用相同的位置
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

  // 点击事件
  marker.on("click", (e) => {
    window.setCurrentEditingHexagram(markerData);
    window.createPopupContent(markerData, marker);
    marker.openPopup();
    e.originalEvent.stopPropagation();
  });

  // 拖拽事件
  marker.on("dragstart", (e) => {
    e.target.getElement().classList.add("dragging");
    e.target.closeTooltip();
    e.target.closePopup();
  });

  marker.on("dragend", async (e) => {
    e.target.getElement().classList.remove("dragging");

    const newPos = e.target.getLatLng();
    const normalizedCoords = window.normalizeCoordinates(newPos);

    // 更新数据库
    try {
      await window.updateMarkerInDatabase(markerData.id, normalizedCoords.x, normalizedCoords.y, markerData.image);
      markerData.x = normalizedCoords.x;
      markerData.y = normalizedCoords.y;
      console.log(`${markerData.name} 新坐标: (${markerData.x.toFixed(4)}, ${markerData.y.toFixed(4)})`);
    } catch (error) {
      console.error('更新坐标失败:', error);
      showNotification('更新坐标失败', 'error');
    }

    e.target.openTooltip();

    if (marker.isPopupOpen()) {
      window.createPopupContent(markerData, marker);
    }
  });

    // 右键删除事件
  marker.on("contextmenu", async (e) => {
    e.originalEvent.preventDefault();
    const isConfirmed = confirm(`确定要删除 ${markerData.name} 吗？`);
    if (isConfirmed) {
      try {
        await window.deleteMarkerFromDatabase(markerData.id);
        window.getMap().removeLayer(marker);

        // 从全局数组中移除
        const markersData = window.getMarkersData();
        const dataIndex = markersData.findIndex(m => m.id === markerData.id);
        if (dataIndex > -1) {
          markersData.splice(dataIndex, 1);
          window.setMarkersData(markersData);
        }

        const markers = window.getMarkers();
        const markerIndex = markers.indexOf(marker);
        if (markerIndex > -1) {
          markers.splice(markerIndex, 1);
        }

        showNotification(`已删除 ${markerData.name}`, 'success');
        window.updateCounts();
      } catch (error) {
        console.error('删除标记失败:', error);
        showNotification('删除标记失败', 'error');
      }
    }
  });

  const markers = window.getMarkers();
  markers.push(marker);
  window.updateCounts();
}

// 显示通知
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // 自动移除
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}



// 将函数暴露到全局作用域
window.showHexagramSearchDialog = showHexagramSearchDialog;
window.loadAllHexagrams = loadAllHexagrams;
window.searchHexagramsFromDialog = searchHexagramsFromDialog;
window.displaySearchResults = displaySearchResults;
window.selectHexagram = selectHexagram;
window.addMarkerToMap = addMarkerToMap;
window.showNotification = showNotification;
window.debounce = debounce;
window.locateHexagram = locateHexagram;

// 初始化右侧快速搜索框
function initQuickSearch() {
  const input = document.getElementById('quickSearchInput');
  const box = document.getElementById('quickSearchResults');
  if (!input || !box) return;

  async function doSearch(q) {
    try {
      if (!q || q.trim().length < 1) {
        box.classList.remove('show');
        box.innerHTML = '';
        return;
      }
      let results;
      if (window.searchHexagrams) {
        results = await window.searchHexagrams(q.trim());
      } else {
        const resp = await fetch(`/api/hexagrams/search?q=${encodeURIComponent(q.trim())}`);
        results = await resp.json();
      }
      renderQuickSearch(results);
    } catch (e) {
      console.error('快速搜索失败:', e);
    }
  }

  function renderQuickSearch(results) {
    const markersData = (window.getMarkersData && window.getMarkersData()) || [];
    const countMap = {};
    markersData.forEach(m => {
      const num = m.number || (m.hexagram && m.hexagram.number);
      if (num != null) countMap[num] = (countMap[num] || 0) + 1;
    });

    const top = (results || []).slice(0, 12).map(h => {
      const count = countMap[h.number] || 0;
      const badge = count > 0 ? `<span class="qs-badge used">x${count}</span>` : `<span class="qs-badge unused">未添加</span>`;
      return `
        <div class="qs-item" data-number="${h.number}">
          <div class="qs-left">
            <span class="qs-symbol">${h.symbol}</span>
            <span class="qs-name">${h.name}</span>
            <span class="qs-num">#${h.number}</span>
          </div>
          ${badge}
        </div>
      `;
    }).join('');
    box.innerHTML = top || '<div class="qs-item">无匹配结果</div>';
    box.classList.add('show');
  }

  input.addEventListener('input', (e) => doSearch(e.target.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = box.querySelector('.qs-item');
      if (first) {
        const num = parseInt(first.getAttribute('data-number'), 10);
        if (!isNaN(num)) window.locateHexagram(num);
        box.classList.remove('show');
      }
    }
    if (e.key === 'Escape') {
      box.classList.remove('show');
    }
  });
  box.addEventListener('click', (e) => {
    const item = e.target.closest('.qs-item');
    if (!item) return;
    const num = parseInt(item.getAttribute('data-number'), 10);
    if (!isNaN(num)) window.locateHexagram(num);
    box.classList.remove('show');
  });
  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && e.target !== input) box.classList.remove('show');
  });
}

document.addEventListener('DOMContentLoaded', initQuickSearch);
