var markers = []
var isMarkerMode = false;
// 初始化地图
var map = L.map('map').setView([0, 0], 2);

// 添加地图层
L.tileLayer('http://127.0.0.1:19000/{z}/{x}/{y}.png', {
    maxZoom: 8,
    noWrap: true
}).addTo(map);
var MarkerModeControl = L.Control.extend({
    options: {
        position: 'topleft' // 控件的位置
    },

    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

        var button = L.DomUtil.create('button', '', container);
        button.innerHTML = 'M';
        button.title = '开启添加标记模式';

        button.onclick = function (e) {
            isMarkerMode = !isMarkerMode;
            console.log(isMarkerMode);
            button.innerHTML = isMarkerMode ? 'X' : 'M';
            button.title = isMarkerMode ? '关闭添加标记模式' : '开启添加标记模式';
            L.DomEvent.stopPropagation(e);  // Prevent the event from propagating to the map
        };

        L.DomEvent.disableClickPropagation(container);  // Prevent clicks on the container from propagating to the map

        return container;
    }
});

// 将自定义控件添加到地图
map.addControl(new MarkerModeControl());


function setPopupContent(marker) {
    var xhr = new XMLHttpRequest();
    var url = 'http://192.168.50.197:19000/get_marker';
    var latitude = encodeURIComponent(marker.getLatLng().lat);
    var longitude = encodeURIComponent(marker.getLatLng().lng);
    var params = 'latitude=' + latitude + '&longitude=' + longitude;

    xhr.open('GET', url + '?' + params, true);
    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 400) {
            var response = JSON.parse(xhr.responseText);
            if (response.success) {
                var popupContent = "<h5>Coordinates: " + marker.getLatLng().lat + ", " + marker.getLatLng().lng + "</h5>";
                let image_part;
                if (!response.image_base64) {
                    image_part = `<br><div style="width: 300px; height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; color: gray; background-color: #f7f7f7; border: 1px solid #e0e0e0; border-radius: 10px;">
                                                <i style="font-size: 48px; margin-bottom: 10px;"></i><p>Placeholder Image</p></div>`;
                }
                else {
                    image_part = "<br><img src='" + response.image_base64 + "' style='max-width: 300px; max-height: 200px;' alt='Uploaded Image'>";
                }
                popupContent += image_part;
                let level_str = `<br><span style="cursor: auto; font-style: normal; box-sizing: border-box; display: inline-block; font-family: 'Helvetica Neue', Helvetica, Arial, 'Source Han Sans', '源ノ角ゴシック', 'Hiragino Sans', 'HiraKakuProN-W3', 'Hiragino Kaku Gothic ProN W3', 'Hiragino Kaku Gothic ProN', 'ヒラギノ角ゴ ProN W3', 'Noto Sans', 'Noto Sans CJK JP', 'メイリオ', Meiryo, '游ゴシック', YuGothic, 'ＭＳ Ｐゴシック', 'MS PGothic', 'ＭＳ ゴシック', 'MS Gothic', sans-serif; line-height: 1; position: relative; text-align: center; text-decoration: none; white-space: nowrap; width: 100px; clear: right; margin: 4px 0 8px 0; padding: 2px 5px 3px 5px; font-size: 10px; -webkit-font-smoothing: antialiased; background-color: #909dc0; border-radius: 3px; text-transform: lowercase; color: #fff; font-weight: bold;">${response.level}</span>`;
                popupContent += level_str + '<br><div class="notecard">' + response.name + '</div>';
                popupContent += '<br><input type="text" id="textInput" class="ant_input"><br><br>';
                // 添加上传和保存功能
                new_content = `
                            <input type="file" id="imageUpload" accept=".png, .jpg, .jpeg">
                            <br>
                            <img id="uploadedImage" src="" alt="Uploaded Image" style="max-width: 100%; max-height: 150px; display: none;">
                            <br>
                            <button id="saveChanges">Save Changes</button>
                            `;
                popupContent += new_content;
                // Create a new popup and bind it to the marker
                var popup = L.popup().setContent(popupContent);
                marker.bindPopup(popup);
            } else {
                console.error("Error retrieving marker data:", response.error);
            }
        } else {
            console.error('Server responded with a status:', xhr.status);
        }
    };
    xhr.onerror = function () {
        console.error('Connection error');
    };
    xhr.send();

}

$(document).on('click', '#saveChanges', function () {
    var uploaded_img_src = $(this).siblings('#uploadedImage').attr('src');
    console.log($(this).siblings('#uploadedImage'));
    var marker_coords = $(this).siblings('h5:nth-of-type(1)').text().replace('Coordinates: ', '').split(', ');
    var marker_grammar = $('#textInput').val();
    console.log(uploaded_img_src);
    // Prepare the data to send to the backend
    var data_to_send = {
        'lat': parseFloat(marker_coords[0]),
        'lng': parseFloat(marker_coords[1]),
        'image_base64': uploaded_img_src,
        'name': marker_grammar
    };

    $.ajax({
        url: 'http://192.168.50.197:19000/update_marker',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data_to_send),
        success: function (response) {
            if (response.success) {
                console.log("Data saved successfully.");
            } else {
                console.error("Error saving data:", response.error);
            }
        },
        error: function (error) {
            console.error("Error:", error);
        }
    });

});
// 为地图添加点击事件监听器
map.on('click', function (e) {
    var marker = L.marker(e.latlng, { draggable: true });
    if (isMarkerMode) {  // Check if marker mode is enabled
        marker.addTo(map)
            .on('click', function () {
                setPopupContent(marker);
                if (!isMarkerMode) {
                    marker.openPopup();
                    // Function to save the grammar/text inputted by the user
                    window.saveGrammar = function () {
                        var grammar = document.getElementById('grammarInput').value;
                        var image_base64 = $(this).siblings("#imageUpload").attr('src');
                        fetch('http://127.0.0.1:19000/update_marker', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                coord: e.latlng.lat + ',' + e.latlng.lng,
                                content: grammar,
                                image_base64: image_base64
                            })
                        }).then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    alert('Saved successfully!');
                                } else {
                                    alert('Error saving data.');
                                }
                            });
                    };
                }
            });
        markers.push(marker);
        addMarker('normal', "", e.latlng.lat + ', ' + e.latlng.lng, '', '');
        marker.on('contextmenu', function () {
            var isConfirmed = confirm('Do you want to delete this marker?');
            if (isConfirmed) {
                map.removeLayer(marker);
            }
        });
        marker.on('dragend', function (event) {
            var position = this.getLatLng();
            this.setLatLng(position, {
                draggable: 'true'
            }).bindPopup('Moved to: ' + position.toString()).update();
        });
    }
});


// 添加标记的函数
function addMarker(type, name, coord, imageBase64, grammar) {
    var data = {
        type: type,
        coord: coord,
        name: name,
        image_base64: imageBase64,
        content: grammar,
    };

    fetch('http://127.0.0.1:19000/add_marker', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .then(data => console.log(data))
        .catch((error) => console.error('Error:', error));
}

function getAndDisplayMarkersOld() {
    fetch('http://127.0.0.1:19000/get_markers')
        .then(response => response.json())
        .then(data => {
            data.forEach(marker => {
                var coord = marker.coord.split(',');
                var latlng = L.latLng(coord[0], coord[1]);
                var mapMarker = L.marker(latlng, { draggable: true }).addTo(map);
                handleMarkerDragEnd(mapMarker, marker.id);
                setPopupContent(mapMarker);
                markers.push(mapMarker);
            });
        })
        .catch((error) => console.error('Error:', error));
}


function getAndDisplayMarkers() {
    fetch('http://127.0.0.1:19000/get_markers')
    .then(response => response.json())
    .then(data => {
        const chunkSize = 100; // 每批次100个标记
        const totalChunks = Math.ceil(data.length / chunkSize);

        let currentChunk = 0;

        function renderChunk() {
            const start = currentChunk * chunkSize;
            const end = start + chunkSize;
            const chunk = data.slice(start, end);

            chunk.forEach(marker => {
                var coord = marker.coord.split(',');
                var latlng = L.latLng(coord[0], coord[1]);
                var mapMarker = L.marker(latlng, { draggable: true }).addTo(map);
                handleMarkerDragEnd(mapMarker, marker.id);
                setPopupContent(mapMarker);
                markers.push(mapMarker);
            });

            currentChunk++;
            if (currentChunk < totalChunks) {
                // 使用setTimeout来调度下一批次
                setTimeout(renderChunk, 0);
            }
        }

        // 开始渲染第一批次
        renderChunk();
    })
    .catch((error) => console.error('Error:', error));
}


function handleMarkerDragEnd(marker, markerId) {
    marker.on('dragend', function (event) {
        var position = marker.getLatLng();

        // 发送 AJAX 请求到 Flask 服务器以更新坐标
        $.ajax({
            url: 'http://127.0.0.1:19000/update_marker_pos',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                'new_lat': position.lat,
                'new_lng': position.lng,
                'marker_id': markerId  // markerId 是你从数据库中获取的 marker 的 ID
            }),
            success: function(response) {
                console.log(response.message);
            },
            error: function(error) {
                console.log(error);
            }
        });
    });
}
getAndDisplayMarkers();
// 发送请求到服务器以删除标记的函数
function deleteMarker(coord) {
    fetch('http://127.0.0.1:19000/delete_marker', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ coord: coord })
    })
        .then(response => response.json())
        .then(data => console.log(data))
        .catch((error) => console.error('Error:', error));
}
var drawControl = new L.Control.Draw({
    draw: {
        polyline: false,
        polygon: false,
        circle: false,
        circlemarker: false,
        marker: false,
        rectangle: true
    }
});
map.addControl(drawControl);
map.on(L.Draw.Event.CREATED, function (event) {
    var layer = event.layer;
    var bounds = layer.getBounds();

    // 检查哪些标记位于矩形内，并删除这些标记
    markers.forEach(marker => {
        if (bounds.contains(marker.getLatLng())) {
            map.removeLayer(marker);

            console.log("delete")
            deleteMarker(marker.getLatLng().lat + ', ' + marker.getLatLng().lng);
        }
    });
});

document.getElementById('toggleMarkerMode').addEventListener('click', function () {
    isMarkerMode = !isMarkerMode;  // 切换“添加标记”模式的状态
    this.textContent = isMarkerMode ? '关闭添加标记模式' : '开启添加标记模式';
});


$(document).on('change', '#imageUpload', function (event) {
    var file = event.target.files[0];
    if (file) {
        var reader = new FileReader();

        reader.onload = function (e) {
            // Set the uploaded image's source to the selected file's data
            var uploadedImage = $('#uploadedImage');
            uploadedImage.attr('src', e.target.result);
            uploadedImage.attr('data-base64', e.target.result);
            uploadedImage.show();
        };

        reader.readAsDataURL(file);
    }
});

