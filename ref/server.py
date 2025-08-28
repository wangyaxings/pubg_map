import os
import sqlite3
from flask_cors import CORS
from flask import Flask, send_from_directory, jsonify, request

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "erange")
DB_PATH = r"D:\1-TestCode\20231008\PUBG MP\grammar_pubg.db"
app = Flask(__name__, static_folder=STATIC_DIR)
CORS(app)


@app.route('/<int:z>/<int:x>/<int:y>.png')
def serve_tile(z, x, y):
    tile_path = f'{z}/{x}/{y}.png'
    return send_from_directory(app.static_folder, tile_path)


@app.route('/add_marker', methods=['POST'])
def add_marker():
    data = request.json
    marker_type = data.get('type')
    coord = data.get('coord')
    image_base64 = data.get('image_base64')
    name = data.get("name")
    content = ""
    level = "5"

    # 连接到 SQLite 数据库
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS markers_pubg (
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
    INSERT INTO markers_pubg (level,type,name, coord, image_base64, content)
    VALUES (?, ?, ?, ?, ?, ?)
    ''', (marker_type, level, name, coord, image_base64, content))

    # 提交事务
    conn.commit()

    # 关闭数据库连接
    conn.close()

    return jsonify({'message': 'Marker added successfully!'})


@app.route('/get_markers', methods=['GET'])
def get_markers():
    # 连接到 SQLite 数据库
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 从数据库获取所有标记
    cursor.execute('SELECT id, level, type, name, coord, image_base64, content FROM markers_pubg')
    markers = cursor.fetchall()

    # 关闭数据库连接
    conn.close()

    # 创建包含所有标记的列表
    markers_list = [
        {'id': marker[0], 'type': marker[1], 'level': marker[2], 'name': marker[3], 'coord': marker[4],
         'image_base64': marker[5], 'content': marker[6]} for marker in markers]

    return jsonify(markers_list)


@app.route('/delete_marker', methods=['DELETE'])
def delete_marker():
    data = request.json
    coord = data.get('coord')

    # 连接到 SQLite 数据库
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 从数据库删除指定的标记
    cursor.execute('''
    DELETE FROM markers_pubg WHERE coord = ?
    ''', (coord,))

    # 提交事务
    conn.commit()

    # 关闭数据库连接
    conn.close()

    return jsonify({'message': 'Marker deleted successfully!'})


@app.route('/update_marker', methods=['POST'])
def update_marker():
    data = request.json
    new_image_base64 = data.get('image_base64')
    lat = data.get('lat')
    lng = data.get('lng')
    new_grammar_val = data.get('name')
    # Basic data validation
    required_keys = ['image_base64', 'lat', 'lng', 'name']

    if not all(key in data for key in required_keys):
        return jsonify(success=False, error="Incomplete data provided"), 400
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            coord = f"{lat}, {lng}"
            cursor.execute('UPDATE markers_pubg SET image_base64 = ?, content = ? WHERE coord = ?',
                           (new_image_base64, new_grammar_val, coord))
            conn.commit()
    except sqlite3.Error as e:
        return jsonify(success=False, error="Database error"), 500

    return jsonify(success=True), 200


def query_db(query, args=(), one=False):
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute(query, args)
    rv = cur.fetchall()
    cur.close()
    con.close()
    return (rv[0] if rv else None) if one else rv


@app.route('/get_marker', methods=['GET'])
def get_marker():
    lat = request.args.get('latitude')
    lng = request.args.get('longitude')

    coord = f"{lat}, {lng}"
    if not coord:
        return jsonify({"error": "Please provide coord value"}), 400

    entry = query_db('SELECT * FROM markers_pubg WHERE coord = ?', (coord,), one=True)
    if not entry:
        return jsonify({"error": "No marker found with given coord"}), 404

    # Assuming the grammar table has columns named markerID, attr1, attr2, ...
    marker_data = {"level": entry[1], "type": entry[2], "name": entry[3], "coord": entry[4], "image_base64": entry[5],
                   'content': entry[6]}
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
    # 从前端接收新的坐标
    new_lat = request.json.get('new_lat')
    new_lng = request.json.get('new_lng')
    marker_id = request.json.get('marker_id')
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            coord = f"{new_lat}, {new_lng}"
            cursor.execute('UPDATE markers_pubg SET coord = ? WHERE id = ?', (coord, marker_id))
            conn.commit()
    except sqlite3.Error as e:
        return jsonify(success=False, error="Database error"), 500
    finally:
        return jsonify(success=True), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=19000, debug=True)
