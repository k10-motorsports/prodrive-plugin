/**
 * Server-side car model renderer.
 *
 * Loads a glTF/GLB car model, sets up a Three.js scene, positions the camera
 * at a 3/4 front angle, and produces a stylised cel-shaded PNG image via
 * software rasterization + sharp downsampling.
 *
 * Pipeline:
 *   1. Load GLB (manual parser — no DOM needed)
 *   2. Render at 2× resolution with conservative rasterization
 *   3. Cel-shade with per-class accent palette (3 tone bands)
 *   4. Dilate to fill sub-pixel gaps from AC3D triangle soup
 *   5. Downsample 2× via sharp lanczos3 → final PNG
 *
 * Production upgrade path: swap software rasterizer for headless-gl
 * (Docker + Mesa) for GPU-accelerated rendering with PBR materials.
 */

import * as THREE from 'three'
import sharp from 'sharp'
import { readFile } from 'fs/promises'
import type { CarClass } from './car-models'

/** Output dimensions */
const OUTPUT_W = 800
const OUTPUT_H = 500

/** Internal render at 2× for anti-aliasing */
const RENDER_W = OUTPUT_W * 2
const RENDER_H = OUTPUT_H * 2

export interface RenderOptions {
  carClass: string
  modelPath: string     // absolute path to .glb file
  paintUrl?: string     // optional paint texture URL (future)
  width?: number
  height?: number
}

/** Per-class cel-shading palette (RGB 0-1) */
interface CelPalette {
  highlight: [number, number, number]
  base: [number, number, number]
  dark: [number, number, number]
}

const PALETTES: Record<CarClass, CelPalette> = {
  gt3:     { base: [0.0, 0.67, 0.76], dark: [0.0, 0.40, 0.46], highlight: [0.55, 0.92, 0.97] },
  gtp:     { base: [0.85, 0.18, 0.18], dark: [0.50, 0.10, 0.10], highlight: [1.0, 0.55, 0.50] },
  lmp2:    { base: [0.15, 0.50, 0.88], dark: [0.08, 0.28, 0.50], highlight: [0.55, 0.75, 1.0] },
  formula: { base: [0.95, 0.68, 0.0],  dark: [0.55, 0.38, 0.0],  highlight: [1.0, 0.87, 0.45] },
  sports:  { base: [0.25, 0.62, 0.28], dark: [0.12, 0.34, 0.14], highlight: [0.55, 0.88, 0.55] },
}

// ─── Software rasterizer ────────────────────────────────────────────

class SoftwareRasterizer {
  width: number
  height: number
  colorBuffer: Uint8Array
  depthBuffer: Float32Array
  maskBuffer: Uint8Array

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.colorBuffer = new Uint8Array(width * height * 4)
    this.depthBuffer = new Float32Array(width * height)
    this.maskBuffer = new Uint8Array(width * height)
  }

  /** Fill with dark gradient background */
  clear() {
    for (let y = 0; y < this.height; y++) {
      const t = y / this.height
      const r = Math.floor(10 + t * 16)
      const g = Math.floor(10 + t * 16)
      const b = Math.floor(20 + t * 26)
      for (let x = 0; x < this.width; x++) {
        const idx = (y * this.width + x) * 4
        this.colorBuffer[idx] = r
        this.colorBuffer[idx + 1] = g
        this.colorBuffer[idx + 2] = b
        this.colorBuffer[idx + 3] = 255
      }
    }
    this.depthBuffer.fill(Infinity)
    this.maskBuffer.fill(0)
  }

  /** Render scene with cel-shaded 3-band lighting */
  render(scene: THREE.Scene, camera: THREE.Camera, palette: CelPalette) {
    camera.updateMatrixWorld(true)
    const vpMatrix = new THREE.Matrix4().multiplyMatrices(
      (camera as THREE.PerspectiveCamera).projectionMatrix,
      camera.matrixWorldInverse,
    )
    const lightDir = new THREE.Vector3(0.5, 0.7, 0.6).normalize()

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const geometry = (object as THREE.Mesh).geometry
      if (!geometry) return
      object.updateMatrixWorld(true)

      const mvpMatrix = new THREE.Matrix4().multiplyMatrices(vpMatrix, object.matrixWorld)
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
      if (!posAttr) return
      const indexAttr = geometry.getIndex()
      const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3

      for (let i = 0; i < triCount; i++) {
        const i0 = indexAttr ? indexAttr.getX(i * 3) : i * 3
        const i1 = indexAttr ? indexAttr.getX(i * 3 + 1) : i * 3 + 1
        const i2 = indexAttr ? indexAttr.getX(i * 3 + 2) : i * 3 + 2

        const v0 = new THREE.Vector3().fromBufferAttribute(posAttr, i0)
        const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i1)
        const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i2)

        // Project to clip space
        const p0 = v0.clone().applyMatrix4(mvpMatrix)
        const p1 = v1.clone().applyMatrix4(mvpMatrix)
        const p2 = v2.clone().applyMatrix4(mvpMatrix)

        if (p0.z < -1 || p1.z < -1 || p2.z < -1) continue
        if (p0.z > 1 && p1.z > 1 && p2.z > 1) continue

        // NDC → screen
        const sx0 = (p0.x * 0.5 + 0.5) * this.width
        const sy0 = (1 - (p0.y * 0.5 + 0.5)) * this.height
        const sx1 = (p1.x * 0.5 + 0.5) * this.width
        const sy1 = (1 - (p1.y * 0.5 + 0.5)) * this.height
        const sx2 = (p2.x * 0.5 + 0.5) * this.width
        const sy2 = (1 - (p2.y * 0.5 + 0.5)) * this.height

        // Face normal in world space for flat shading
        const wv0 = v0.clone().applyMatrix4(object.matrixWorld)
        const wv1 = v1.clone().applyMatrix4(object.matrixWorld)
        const wv2 = v2.clone().applyMatrix4(object.matrixWorld)
        const edge1 = wv1.clone().sub(wv0)
        const edge2 = wv2.clone().sub(wv0)
        const faceNormal = edge1.cross(edge2).normalize()

        // Cel-shade: 3 bands based on light angle (two-sided)
        const ndotl = Math.abs(faceNormal.dot(lightDir))
        let r: number, g: number, b: number
        if (ndotl > 0.55) {
          r = Math.floor(palette.highlight[0] * 255)
          g = Math.floor(palette.highlight[1] * 255)
          b = Math.floor(palette.highlight[2] * 255)
        } else if (ndotl > 0.2) {
          r = Math.floor(palette.base[0] * 255)
          g = Math.floor(palette.base[1] * 255)
          b = Math.floor(palette.base[2] * 255)
        } else {
          r = Math.floor(palette.dark[0] * 255)
          g = Math.floor(palette.dark[1] * 255)
          b = Math.floor(palette.dark[2] * 255)
        }

        this.rasterizeTriangle(sx0, sy0, p0.z, sx1, sy1, p1.z, sx2, sy2, p2.z, r, g, b)
      }
    })
  }

  /**
   * Conservative rasterization: expand each triangle ~1.5px outward
   * from its centroid to fill sub-pixel gaps between AC3D triangle soup.
   */
  private rasterizeTriangle(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    r: number, g: number, b: number,
  ) {
    const cx = (x0 + x1 + x2) / 3
    const cy = (y0 + y1 + y2) / 3
    const expand = 1.5

    const pushOut = (vx: number, vy: number): [number, number] => {
      const dx = vx - cx, dy = vy - cy
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      return [vx + (dx / d) * expand, vy + (dy / d) * expand]
    }

    const [ex0, ey0] = pushOut(x0, y0)
    const [ex1, ey1] = pushOut(x1, y1)
    const [ex2, ey2] = pushOut(x2, y2)

    const minX = Math.max(0, Math.floor(Math.min(ex0, ex1, ex2)))
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(ex0, ex1, ex2)))
    const minY = Math.max(0, Math.floor(Math.min(ey0, ey1, ey2)))
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(ey0, ey1, ey2)))

    if (minX > maxX || minY > maxY) return

    const area = (ex1 - ex0) * (ey2 - ey0) - (ex2 - ex0) * (ey1 - ey0)
    if (Math.abs(area) < 0.01) return
    const invArea = 1 / area

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5
        const py = y + 0.5

        const w0 = ((ex1 - ex2) * (py - ey2) - (ey1 - ey2) * (px - ex2)) * invArea
        const w1 = ((ex2 - ex0) * (py - ey0) - (ey2 - ey0) * (px - ex0)) * invArea
        const w2 = 1 - w0 - w1

        if (w0 < -0.01 || w1 < -0.01 || w2 < -0.01) continue

        // Interpolate depth from clamped barycentrics
        const ww0 = Math.max(0, w0), ww1 = Math.max(0, w1), ww2 = Math.max(0, w2)
        const ws = ww0 + ww1 + ww2 || 1
        const z = (ww0 * z0 + ww1 * z1 + ww2 * z2) / ws

        const pixIdx = y * this.width + x
        if (z < this.depthBuffer[pixIdx]) {
          this.depthBuffer[pixIdx] = z
          const idx = pixIdx * 4
          this.colorBuffer[idx] = r
          this.colorBuffer[idx + 1] = g
          this.colorBuffer[idx + 2] = b
          this.colorBuffer[idx + 3] = 255
          this.maskBuffer[pixIdx] = 1
        }
      }
    }
  }

  /**
   * Morphological dilation: spread car pixels into adjacent background gaps.
   * Each pass expands the mask by 1px in all 8 directions.
   */
  dilate(passes = 5) {
    for (let pass = 0; pass < passes; pass++) {
      const newColor = new Uint8Array(this.colorBuffer)
      const newMask = new Uint8Array(this.maskBuffer)

      for (let y = 1; y < this.height - 1; y++) {
        for (let x = 1; x < this.width - 1; x++) {
          const pidx = y * this.width + x
          if (this.maskBuffer[pidx] === 1) continue

          let totalR = 0, totalG = 0, totalB = 0, count = 0
          const offsets: [number, number][] = [
            [-1, 0], [1, 0], [0, -1], [0, 1],
            [-1, -1], [-1, 1], [1, -1], [1, 1],
          ]
          for (const [dy, dx] of offsets) {
            const ni = (y + dy) * this.width + (x + dx)
            if (this.maskBuffer[ni] === 1) {
              totalR += this.colorBuffer[ni * 4]
              totalG += this.colorBuffer[ni * 4 + 1]
              totalB += this.colorBuffer[ni * 4 + 2]
              count++
            }
          }
          if (count >= 1) {
            const idx = pidx * 4
            newColor[idx] = Math.floor(totalR / count)
            newColor[idx + 1] = Math.floor(totalG / count)
            newColor[idx + 2] = Math.floor(totalB / count)
            newMask[pidx] = 1
          }
        }
      }

      this.colorBuffer.set(newColor)
      this.maskBuffer.set(newMask)
    }
  }
}

// ─── GLB loader ─────────────────────────────────────────────────────

/**
 * Parse a GLB file into a Three.js scene.
 * Manual parser since GLTFLoader needs a browser/DOM environment.
 */
async function loadGLB(filepath: string): Promise<THREE.Scene> {
  const buffer = await readFile(filepath)
  const scene = new THREE.Scene()

  // Verify magic number
  const magic = buffer.readUInt32LE(0)
  if (magic !== 0x46546C67) throw new Error('Not a valid GLB file')

  const length = buffer.readUInt32LE(8)

  // Parse chunks
  let jsonChunk = ''
  let binChunk: Buffer | null = null
  let offset = 12

  while (offset < length) {
    const chunkLength = buffer.readUInt32LE(offset)
    const chunkType = buffer.readUInt32LE(offset + 4)
    if (chunkType === 0x4E4F534A) {
      jsonChunk = buffer.slice(offset + 8, offset + 8 + chunkLength).toString('utf8')
    } else if (chunkType === 0x004E4942) {
      binChunk = buffer.slice(offset + 8, offset + 8 + chunkLength)
    }
    offset += 8 + chunkLength
  }

  if (!jsonChunk) throw new Error('No JSON chunk in GLB')
  const gltf = JSON.parse(jsonChunk)
  if (!gltf.meshes?.length) throw new Error('No meshes in GLB')

  // Read typed array from accessor
  function readAccessor(accessorIdx: number): Float32Array | Uint16Array | Uint32Array {
    const accessor = gltf.accessors[accessorIdx]
    const bv = gltf.bufferViews[accessor.bufferView]
    const bo = (bv.byteOffset || 0) + (accessor.byteOffset || 0)
    if (!binChunk) throw new Error('No binary chunk')

    const typeSize: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }
    const total = accessor.count * (typeSize[accessor.type] || 1)

    switch (accessor.componentType) {
      case 5126: return new Float32Array(binChunk.buffer, binChunk.byteOffset + bo, total)
      case 5123: return new Uint16Array(binChunk.buffer, binChunk.byteOffset + bo, total)
      case 5125: return new Uint32Array(binChunk.buffer, binChunk.byteOffset + bo, total)
      default: throw new Error(`Unsupported component type: ${accessor.componentType}`)
    }
  }

  // Build Three.js meshes
  for (const gltfMesh of gltf.meshes) {
    for (const primitive of gltfMesh.primitives) {
      const geometry = new THREE.BufferGeometry()

      if (primitive.attributes.POSITION !== undefined) {
        const d = readAccessor(primitive.attributes.POSITION)
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d), 3))
      }
      if (primitive.indices !== undefined) {
        const d = readAccessor(primitive.indices)
        geometry.setIndex(
          d instanceof Uint16Array
            ? new THREE.BufferAttribute(new Uint16Array(d), 1)
            : new THREE.BufferAttribute(new Uint32Array(d), 1),
        )
      }

      geometry.computeBoundingBox()
      scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff })))
    }
  }

  return scene
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Render a car model to PNG.
 *
 * Renders at 2× resolution with cel-shading and conservative rasterization,
 * then downsamples via sharp for clean anti-aliased output.
 */
export async function renderCarImage(options: RenderOptions): Promise<Buffer> {
  const outW = options.width || OUTPUT_W
  const outH = options.height || OUTPUT_H
  const renderW = outW * 2
  const renderH = outH * 2

  const palette = PALETTES[options.carClass as CarClass] ?? PALETTES.sports

  // Load model
  const scene = await loadGLB(options.modelPath)

  // Auto-frame: compute bounding box
  const box = new THREE.Box3()
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.computeBoundingBox()
      box.union(obj.geometry.boundingBox!.clone().applyMatrix4(obj.matrixWorld))
    }
  })

  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)

  // Camera: 3/4 front view
  const camera = new THREE.PerspectiveCamera(35, renderW / renderH, 0.1, 1000)
  const distance = maxDim * 2.2
  const azimuth = (35 * Math.PI) / 180
  const elevation = (15 * Math.PI) / 180

  camera.position.set(
    center.x + distance * Math.sin(azimuth) * Math.cos(elevation),
    center.y + distance * Math.sin(elevation),
    center.z + distance * Math.cos(azimuth) * Math.cos(elevation),
  )
  camera.lookAt(center)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)

  // Render
  const rasterizer = new SoftwareRasterizer(renderW, renderH)
  rasterizer.clear()
  rasterizer.render(scene, camera, palette)
  rasterizer.dilate(5)

  // Downsample 2× for anti-aliasing
  const png = await sharp(Buffer.from(rasterizer.colorBuffer), {
    raw: { width: renderW, height: renderH, channels: 4 },
  })
    .resize(outW, outH, { kernel: 'lanczos3' })
    .png()
    .toBuffer()

  return png
}
