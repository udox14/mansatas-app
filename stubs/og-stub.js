// Stub untuk @vercel/og — fitur OG image tidak dipakai di app ini
// File ini menggantikan next/dist/compiled/@vercel/og/index.edge.js
// agar resvg.wasm (~1.3 MB) dan yoga.wasm (~70 KB) tidak ikut ter-bundle

export class ImageResponse {
  constructor() {
    throw new Error('ImageResponse is not supported in this deployment')
  }
}

export default { ImageResponse }
