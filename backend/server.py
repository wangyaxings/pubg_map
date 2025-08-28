import os
import sqlite3
from flask_cors import CORS
from flask import Flask, send_from_directory, jsonify, request

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DB_PATH = os.path.join(BASE_DIR, "zhouyi_map.db")  # 使用相对路径
app = Flask(__name__, static_folder=STATIC_DIR)
CORS(app)

print(f"数据库路径: {DB_PATH}")
print(f"静态文件目录: {STATIC_DIR}")

@app.route('/<int:z>/<int:x>/<int:y>.png')
def serve_tile(z, x, y):
    """提供地图瓦片服务"""
    tile_path = f'{z}/{x}/{y}.png'
    print(f"请求瓦片: {tile_path}")
    return send_from_directory(app.static_folder, tile_path)

@app.route('/add_marker', methods=['POST'])
def add_marker():
    """添加标记到数据库"""
    data = request.json
    marker_type = data.get('type', 'normal')
    coord = data.get('coord', '')
    image_base64 = data.get('image_base64', '')
    name = data.get("name", "未命名标记")
    content = data.get("content", "")
    level = data.get("level", "5")

    print(f"添加标记: {name} at {coord}")

    # 连接到 SQLite 数据库
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 创建表（如果不存在）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS markers_zhouyi (
            id INTEGER PRIMARY KEY,
            type TEXT NOT NULL,
            level TEXT NOT NULL,
            name TEXT NOT NULL,
            coord TEXT NOT NULL,
            image_base64 TEXT,
            content TEXT
        )
    ''')

    # 向数据库插入新的标记数据
    cursor.execute('''
    INSERT INTO markers_zhouyi (level, type, name, coord, image_base64, content)
    VALUES (?, ?, ?, ?, ?, ?)
    ''', (level, marker_type, name, coord, image_base64, content))

    # 提交事务
    conn.commit()
    conn.close()

    return jsonify({'message': 'Marker added successfully!'})

@app.route('/get_markers', methods=['GET'])
def get_markers():
    """获取所有标记"""
    print("获取所有标记")

    # 连接到 SQLite 数据库
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 创建表（如果不存在）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS markers_zhouyi (
            id INTEGER PRIMARY KEY,
            type TEXT NOT NULL,
            level TEXT NOT NULL,
            name TEXT NOT NULL,
            coord TEXT NOT NULL,
            image_base64 TEXT,
            content TEXT
        )
    ''')

    # 从数据库获取所有标记
    cursor.execute('SELECT id, level, type, name, coord, image_base64, content FROM markers_zhouyi')
    markers = cursor.fetchall()

    # 关闭数据库连接
    conn.close()

    # 创建包含所有标记的列表
    markers_list = [
        {'id': marker[0], 'level': marker[1], 'type': marker[2], 'name': marker[3], 'coord': marker[4],
         'image_base64': marker[5], 'content': marker[6]} for marker in markers
    ]

    print(f"返回 {len(markers_list)} 个标记")
    return jsonify(markers_list)

@app.route('/delete_marker', methods=['DELETE'])
def delete_marker():
    """删除标记"""
    data = request.json
    coord = data.get('coord')

    print(f"删除标记: {coord}")

    # 连接到 SQLite 数据库
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 从数据库删除指定的标记
    cursor.execute('''
    DELETE FROM markers_zhouyi WHERE coord = ?
    ''', (coord,))

    # 提交事务
    conn.commit()
    conn.close()

    return jsonify({'message': 'Marker deleted successfully!'})

@app.route('/update_marker', methods=['POST'])
def update_marker():
    """更新标记"""
    data = request.json
    new_image_base64 = data.get('image_base64', '')
    lat = data.get('lat')
    lng = data.get('lng')
    new_grammar_val = data.get('name', '')

    print(f"更新标记: lat={lat}, lng={lng}")

    # Basic data validation
    required_keys = ['lat', 'lng', 'name']

    if not all(key in data for key in required_keys):
        return jsonify(success=False, error="Incomplete data provided"), 400

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            coord = f"{lat}, {lng}"
            cursor.execute('UPDATE markers_zhouyi SET image_base64 = ?, content = ? WHERE coord = ?',
                           (new_image_base64, new_grammar_val, coord))
            conn.commit()
    except sqlite3.Error as e:
        print(f"数据库错误: {e}")
        return jsonify(success=False, error="Database error"), 500

    return jsonify(success=True), 200

def query_db(query, args=(), one=False):
    """数据库查询辅助函数"""
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute(query, args)
    rv = cur.fetchall()
    cur.close()
    con.close()
    return (rv[0] if rv else None) if one else rv

@app.route('/get_marker', methods=['GET'])
def get_marker():
    """获取单个标记详情"""
    lat = request.args.get('latitude')
    lng = request.args.get('longitude')

    coord = f"{lat}, {lng}"
    print(f"获取标记详情: {coord}")

    if not coord:
        return jsonify({"error": "Please provide coord value"}), 400

    entry = query_db('SELECT * FROM markers_zhouyi WHERE coord = ?', (coord,), one=True)
    if not entry:
        return jsonify({"error": "No marker found with given coord"}), 404

    # 返回标记数据
    marker_data = {
        "level": entry[1],
        "type": entry[2],
        "name": entry[3],
        "coord": entry[4],
        "image_base64": entry[5],
        'content': entry[6]
    }

    if marker_data:
        return jsonify({
            "success": True,
            "type": marker_data["type"],
            "name": marker_data['name'],
            "level": marker_data['level'],
            "coord": marker_data['coord'],
            "content": marker_data['content'],
            "image_base64": marker_data['image_base64']
        })
    else:
        return jsonify({
            "success": False,
            "error": "No marker data found for the given coordinates."
        })

@app.route('/update_marker_pos', methods=['POST'])
def update_marker_pos():
    """更新标记位置"""
    # 从前端接收新的坐标
    new_lat = request.json.get('new_lat')
    new_lng = request.json.get('new_lng')
    marker_id = request.json.get('marker_id')

    print(f"更新标记位置: ID={marker_id}, lat={new_lat}, lng={new_lng}")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            coord = f"{new_lat}, {new_lng}"
            cursor.execute('UPDATE markers_zhouyi SET coord = ? WHERE id = ?', (coord, marker_id))
            conn.commit()
    except sqlite3.Error as e:
        print(f"数据库错误: {e}")
        return jsonify(success=False, error="Database error"), 500

    return jsonify(success=True), 200

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({
        "status": "healthy",
        "database": DB_PATH,
        "static_folder": STATIC_DIR
    })

if __name__ == '__main__':
    print("启动周易地图服务器...")
    print(f"服务器地址: http://127.0.0.1:19000")
    print(f"数据库路径: {DB_PATH}")
    print(f"静态文件目录: {STATIC_DIR}")

    # 确保静态文件目录存在
    os.makedirs(STATIC_DIR, exist_ok=True)

    app.run(host='0.0.0.0', port=19000, debug=True)
