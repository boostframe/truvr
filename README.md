# Truvr Chrome Extension (MV3)

## Load Unpacked
- Build not required; assets are included in `dist/`.
- Open Chrome and go to `chrome://extensions`.
- Enable Developer mode (top right).
- Click "Load unpacked" and select this folder.
- Pin the extension and click its icon to open the Side Panel.
- Navigate to an Amazon product page; the panel will process it automatically.

## Backend
- A drop-in local backend is included under `backend/` using FastAPI.
- Default extension target is `http://localhost:8000` (see `sidepanel.js`).

### Run locally (Netlify Functions)
1. Ensure Python 3.9+ is installed.
2. For Netlify functions (Node):
   - `npm install`
   - Install Netlify CLI: `npm i -g netlify-cli`
   - Run local dev server: `netlify dev`
   - Functions will be served at `http://localhost:8888/.netlify/functions/...`
   - The extension is already configured to call this base.
3. Reload the extension and open an Amazon product page.

### Optional: LLM pros/cons via OpenAI (FastAPI backend only)
- Set env vars before starting uvicorn:
  - `OPENAI_API_KEY=...`
  - `USE_OPENAI=1`
- The backend will attempt to enhance Pros/Cons; otherwise it uses heuristics.

## Notes
- Permissions minimized for MV3 compliance; background worker is non-blocking.
- DaisyUI CSS is vendored locally in `dist/daisyui.css`.
 - Host permissions include `http://localhost:8000/*` and the original EC2 host. Update as needed.
 - For Netlify dev, host permissions include `http://localhost:8888/*`. For production, add your `https://<your-site>.netlify.app/*` URL in `manifest.json`.

## Deploy to Netlify
1. `netlify init` (choose or create a site)
2. Ensure `netlify/functions/` exists (it does) and `netlify.toml` points to it.
3. `netlify deploy --prod`
4. Update `API_BASE` in `sidepanel.js` to `https://<your-site>.netlify.app/.netlify/functions` and add the same host to `manifest.json` `host_permissions`.
5. Reload the extension.
