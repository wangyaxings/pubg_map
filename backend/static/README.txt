Place your map tile pyramid under this folder so the frontend can load them via `/static/tiles/{z}/{x}/{y}.png`.

Expected structure (TMS or XYZ depending on your generator):

static/
  tiles/
    2/
      0/
        0.png
        1.png
        ...
      1/
        0.png
        1.png
        ...
    3/
      ...

Notes:
- The current frontend config uses `tms: true` for Leaflet, which flips the Y axis. If your tiles are in standard XYZ, you can set `tms: false` in `frontend/src/main.js`.
- Make sure the available zoom levels in your tiles match `MIN_ZOOM` and `MAX_NATIVE_ZOOM` in `frontend/src/main.js`.
