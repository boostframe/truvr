# Truvr Chrome Extension (MV3)

## Load Unpacked
- Build not required; assets are included in `dist/`.
- Open Chrome and go to `chrome://extensions`.
- Enable Developer mode (top right).
- Click "Load unpacked" and select this folder.
- Pin the extension and click its icon to open the Side Panel.
- Navigate to an Amazon product page; the panel will process it automatically.

## Backend
- The extension talks to: `http://ec2-18-194-45-243.eu-central-1.compute.amazonaws.com:8000`.
- If this host changes, update the URLs in `sidepanel.js` and add the new host to `manifest.json` under `host_permissions`.

## Notes
- Permissions minimized for MV3 compliance; background worker is non-blocking.
- DaisyUI CSS is vendored locally in `dist/daisyui.css`.
