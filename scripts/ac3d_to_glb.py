#!/usr/bin/env python3
"""
AC3D (.ac/.acc) to GLB converter for Speed Dreams car models.

Parses AC3D format files and outputs binary glTF (.glb) using pygltflib.
Handles:
  - Multi-object hierarchies (flattened to single mesh)
  - Texture references (embedded as base64 in GLB)
  - Material definitions (basic PBR mapping from AC3D materials)
  - Triangle fan/strip polygon tessellation

Usage:
  python ac3d_to_glb.py <input.ac> <output.glb> [--texture-dir <dir>]
"""

import struct
import sys
import os
import re
import numpy as np
from pathlib import Path
from PIL import Image
import io
import base64
import json

# pygltflib
from pygltflib import (
    GLTF2, Scene, Node, Mesh, Primitive, Buffer, BufferView, Accessor,
    Material as GltfMaterial, PbrMetallicRoughness, Image as GltfImage,
    Texture, TextureInfo, Asset, FLOAT, UNSIGNED_SHORT, UNSIGNED_INT,
    SCALAR, VEC2, VEC3, ELEMENT_ARRAY_BUFFER, ARRAY_BUFFER, TRIANGLES,
)


class AC3DParser:
    """Parse AC3D file format into intermediate representation."""

    def __init__(self, filepath, texture_dir=None):
        self.filepath = Path(filepath)
        self.texture_dir = Path(texture_dir) if texture_dir else self.filepath.parent
        self.materials = []
        self.objects = []
        self._lines = []
        self._pos = 0

    def parse(self):
        with open(self.filepath, 'r', errors='replace') as f:
            self._lines = f.readlines()
        self._pos = 0

        # First line must be AC3Db or AC3D
        header = self._lines[0].strip()
        if not header.startswith('AC3D'):
            raise ValueError(f"Not an AC3D file: {header}")
        self._pos = 1

        while self._pos < len(self._lines):
            line = self._lines[self._pos].strip()
            if line.startswith('MATERIAL'):
                self._parse_material(line)
            elif line.startswith('OBJECT'):
                obj = self._parse_object()
                if obj:
                    self.objects.append(obj)
            else:
                self._pos += 1

        return self

    def _parse_material(self, line):
        """Parse: MATERIAL "name" rgb R G B amb R G B emis R G B spec R G B shi S trans T"""
        mat = {'name': 'default', 'rgb': (0.8, 0.8, 0.8), 'amb': (0.2, 0.2, 0.2),
               'emis': (0, 0, 0), 'spec': (0.5, 0.5, 0.5), 'shi': 64, 'trans': 0}

        # Extract name
        name_match = re.search(r'"([^"]*)"', line)
        if name_match:
            mat['name'] = name_match.group(1)

        # Extract color values
        for key in ['rgb', 'amb', 'emis', 'spec']:
            m = re.search(rf'{key}\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)', line)
            if m:
                mat[key] = (float(m.group(1)), float(m.group(2)), float(m.group(3)))

        for key in ['shi', 'trans']:
            m = re.search(rf'{key}\s+([\d.]+)', line)
            if m:
                mat[key] = float(m.group(1))

        self.materials.append(mat)
        self._pos += 1

    def _parse_object(self):
        """Parse an OBJECT block."""
        line = self._lines[self._pos].strip()
        obj_type = line.split()[1] if len(line.split()) > 1 else 'world'
        self._pos += 1

        obj = {
            'type': obj_type,
            'name': '',
            'texture': '',
            'vertices': [],
            'surfaces': [],
            'children': [],
            'loc': (0, 0, 0),
            'rot': None,
        }

        num_kids = 0

        while self._pos < len(self._lines):
            line = self._lines[self._pos].strip()

            if line.startswith('name'):
                name_match = re.search(r'"([^"]*)"', line)
                if name_match:
                    obj['name'] = name_match.group(1)
                self._pos += 1

            elif line.startswith('texture'):
                tex_match = re.search(r'"([^"]*)"', line)
                if tex_match:
                    obj['texture'] = tex_match.group(1)
                self._pos += 1

            elif line.startswith('loc'):
                parts = line.split()
                if len(parts) >= 4:
                    obj['loc'] = (float(parts[1]), float(parts[2]), float(parts[3]))
                self._pos += 1

            elif line.startswith('rot'):
                parts = line.split()
                if len(parts) >= 10:
                    obj['rot'] = [float(x) for x in parts[1:10]]
                self._pos += 1

            elif line.startswith('numvert'):
                num_verts = int(line.split()[1])
                self._pos += 1
                for _ in range(num_verts):
                    vline = self._lines[self._pos].strip().split()
                    obj['vertices'].append((float(vline[0]), float(vline[1]), float(vline[2])))
                    self._pos += 1

            elif line.startswith('numsurf'):
                num_surfs = int(line.split()[1])
                self._pos += 1
                for _ in range(num_surfs):
                    surf = self._parse_surface()
                    if surf:
                        obj['surfaces'].append(surf)

            elif line.startswith('kids'):
                num_kids = int(line.split()[1])
                self._pos += 1
                for _ in range(num_kids):
                    if self._pos < len(self._lines):
                        child_line = self._lines[self._pos].strip()
                        if child_line.startswith('OBJECT'):
                            child = self._parse_object()
                            if child:
                                obj['children'].append(child)
                        else:
                            self._pos += 1
                break  # Done with this object after kids

            else:
                self._pos += 1

        return obj

    def _parse_surface(self):
        """Parse a SURF block."""
        line = self._lines[self._pos].strip()
        if not line.startswith('SURF'):
            return None

        surf = {'type': 0, 'mat': 0, 'refs': []}
        parts = line.split()
        if len(parts) >= 2:
            surf['type'] = int(parts[1], 0)  # Can be hex like 0x10
        self._pos += 1

        while self._pos < len(self._lines):
            line = self._lines[self._pos].strip()
            if line.startswith('mat'):
                surf['mat'] = int(line.split()[1])
                self._pos += 1
            elif line.startswith('refs'):
                num_refs = int(line.split()[1])
                self._pos += 1
                for _ in range(num_refs):
                    rline = self._lines[self._pos].strip().split()
                    idx = int(rline[0])
                    u = float(rline[1]) if len(rline) > 1 else 0.0
                    v = float(rline[2]) if len(rline) > 2 else 0.0
                    surf['refs'].append((idx, u, v))
                    self._pos += 1
                break
            else:
                self._pos += 1

        return surf


def flatten_objects(obj, parent_loc=(0, 0, 0), parent_rot=None):
    """Recursively flatten object hierarchy, applying transforms."""
    results = []
    loc = (
        parent_loc[0] + obj['loc'][0],
        parent_loc[1] + obj['loc'][1],
        parent_loc[2] + obj['loc'][2],
    )

    if obj['vertices'] and obj['surfaces']:
        # Apply location offset to vertices
        transformed_verts = [
            (v[0] + loc[0], v[1] + loc[1], v[2] + loc[2])
            for v in obj['vertices']
        ]
        results.append({
            'name': obj['name'],
            'texture': obj['texture'],
            'vertices': transformed_verts,
            'surfaces': obj['surfaces'],
        })

    for child in obj['children']:
        results.extend(flatten_objects(child, loc, obj.get('rot')))

    return results


def triangulate_polygon(refs):
    """Convert polygon refs to triangles using fan triangulation."""
    triangles = []
    if len(refs) < 3:
        return triangles
    for i in range(1, len(refs) - 1):
        triangles.append((refs[0], refs[i], refs[i + 1]))
    return triangles


def convert_ac3d_to_glb(ac_path, glb_path, texture_dir=None):
    """Convert an AC3D file to GLB format."""
    print(f"Parsing {ac_path}...")
    parser = AC3DParser(ac_path, texture_dir)
    parser.parse()

    print(f"  Found {len(parser.materials)} materials, {len(parser.objects)} top-level objects")

    # Flatten hierarchy
    flat_objects = []
    for obj in parser.objects:
        flat_objects.extend(flatten_objects(obj))

    print(f"  Flattened to {len(flat_objects)} mesh objects")

    if not flat_objects:
        print("  WARNING: No geometry found!")
        return False

    # Collect all vertices, normals, UVs, and indices grouped by material
    all_positions = []
    all_uvs = []
    all_indices = []
    vertex_count = 0

    for fobj in flat_objects:
        verts = fobj['vertices']
        for surf in fobj['surfaces']:
            refs = surf['refs']
            triangles = triangulate_polygon(refs)
            for tri in triangles:
                for idx, u, v in tri:
                    if idx < len(verts):
                        px, py, pz = verts[idx]
                        # AC3D uses Y-up, glTF also uses Y-up — keep as-is
                        all_positions.extend([px, py, pz])
                        all_uvs.extend([u, 1.0 - v])  # Flip V for glTF
                        all_indices.append(vertex_count)
                        vertex_count += 1

    if vertex_count == 0:
        print("  WARNING: No triangles generated!")
        return False

    print(f"  Generated {vertex_count} vertices, {vertex_count // 3} triangles")

    # Build numpy arrays
    positions = np.array(all_positions, dtype=np.float32).reshape(-1, 3)
    uvs = np.array(all_uvs, dtype=np.float32).reshape(-1, 2)

    # Use sequential indices (we already duplicated verts per-triangle)
    if vertex_count <= 65535:
        indices = np.arange(vertex_count, dtype=np.uint16)
        index_component_type = UNSIGNED_SHORT
    else:
        indices = np.arange(vertex_count, dtype=np.uint32)
        index_component_type = UNSIGNED_INT

    # Compute simple flat normals
    normals = np.zeros_like(positions)
    for i in range(0, len(positions), 3):
        if i + 2 < len(positions):
            v0, v1, v2 = positions[i], positions[i+1], positions[i+2]
            edge1 = v1 - v0
            edge2 = v2 - v0
            n = np.cross(edge1, edge2)
            length = np.linalg.norm(n)
            if length > 1e-8:
                n = n / length
            normals[i] = normals[i+1] = normals[i+2] = n

    # Compute bounding box for accessor min/max
    pos_min = positions.min(axis=0).tolist()
    pos_max = positions.max(axis=0).tolist()

    # Build binary buffer
    pos_bytes = positions.tobytes()
    norm_bytes = normals.tobytes()
    uv_bytes = uvs.tobytes()
    idx_bytes = indices.tobytes()

    # Pad each section to 4-byte alignment
    def pad4(data):
        remainder = len(data) % 4
        if remainder:
            data += b'\x00' * (4 - remainder)
        return data

    idx_bytes_padded = pad4(idx_bytes)
    pos_bytes_padded = pad4(pos_bytes)
    norm_bytes_padded = pad4(norm_bytes)
    uv_bytes_padded = pad4(uv_bytes)

    buffer_data = idx_bytes_padded + pos_bytes_padded + norm_bytes_padded + uv_bytes_padded

    # Try to find and embed texture
    texture_file = None
    texture_image_index = None
    tex_search_dir = Path(texture_dir) if texture_dir else Path(ac_path).parent
    # Collect all unique textures, prefer the most-used one (likely body, not interior)
    from collections import Counter
    tex_usage = Counter(f['texture'] for f in flat_objects if f['texture'])
    # Sort by usage count descending, skip interior/shadow textures
    for tex_name, _count in tex_usage.most_common():
        if '-int.' in tex_name or 'shadow' in tex_name.lower() or 'wheel' in tex_name.lower():
            continue
        tex_path = tex_search_dir / tex_name
        if tex_path.exists():
            texture_file = tex_path
            break
        tex_path2 = tex_search_dir / Path(tex_name).name
        if tex_path2.exists():
            texture_file = tex_path2
            break
    # Fallback: use any texture
    if not texture_file:
        for tex_name, _count in tex_usage.most_common():
            tex_path = tex_search_dir / tex_name
            if tex_path.exists():
                texture_file = tex_path
                break

    images = []
    textures = []
    texture_bytes = b''
    tex_bv_offset = len(buffer_data)

    if texture_file:
        print(f"  Embedding texture: {texture_file.name}")
        try:
            img = Image.open(texture_file)
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            # Resize large textures for file size
            if img.width > 1024 or img.height > 1024:
                img = img.resize((1024, 1024), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            texture_bytes = pad4(buf.getvalue())
            buffer_data += texture_bytes
        except Exception as e:
            print(f"  WARNING: Could not load texture: {e}")
            texture_file = None

    # Build glTF structure
    gltf = GLTF2()
    gltf.asset = Asset(version="2.0", generator="ac3d_to_glb.py")

    # Buffer
    gltf.buffers = [Buffer(byteLength=len(buffer_data))]

    # Buffer views
    offset = 0
    # 0: indices
    gltf.bufferViews = [
        BufferView(buffer=0, byteOffset=0, byteLength=len(idx_bytes),
                   target=ELEMENT_ARRAY_BUFFER),
    ]
    offset = len(idx_bytes_padded)

    # 1: positions
    gltf.bufferViews.append(
        BufferView(buffer=0, byteOffset=offset, byteLength=len(pos_bytes),
                   target=ARRAY_BUFFER, byteStride=12)
    )
    offset += len(pos_bytes_padded)

    # 2: normals
    gltf.bufferViews.append(
        BufferView(buffer=0, byteOffset=offset, byteLength=len(norm_bytes),
                   target=ARRAY_BUFFER, byteStride=12)
    )
    offset += len(norm_bytes_padded)

    # 3: UVs
    gltf.bufferViews.append(
        BufferView(buffer=0, byteOffset=offset, byteLength=len(uv_bytes),
                   target=ARRAY_BUFFER, byteStride=8)
    )
    offset += len(uv_bytes_padded)

    # 4: texture image (if any)
    if texture_file and texture_bytes:
        gltf.bufferViews.append(
            BufferView(buffer=0, byteOffset=tex_bv_offset, byteLength=len(texture_bytes))
        )

    # Accessors
    gltf.accessors = [
        # 0: indices
        Accessor(bufferView=0, byteOffset=0, componentType=index_component_type,
                 count=len(indices), type=SCALAR,
                 max=[int(indices.max())], min=[int(indices.min())]),
        # 1: positions
        Accessor(bufferView=1, byteOffset=0, componentType=FLOAT,
                 count=len(positions), type=VEC3,
                 max=pos_max, min=pos_min),
        # 2: normals
        Accessor(bufferView=2, byteOffset=0, componentType=FLOAT,
                 count=len(normals), type=VEC3),
        # 3: UVs
        Accessor(bufferView=3, byteOffset=0, componentType=FLOAT,
                 count=len(uvs), type=VEC2),
    ]

    # Material
    base_color = list(parser.materials[0]['rgb']) + [1.0] if parser.materials else [0.7, 0.7, 0.7, 1.0]
    pbr = PbrMetallicRoughness(
        baseColorFactor=base_color,
        metallicFactor=0.3,
        roughnessFactor=0.6,
    )

    if texture_file and texture_bytes:
        gltf.images = [GltfImage(bufferView=4, mimeType="image/png")]
        gltf.textures = [Texture(source=0)]
        pbr.baseColorTexture = TextureInfo(index=0)

    gltf.materials = [GltfMaterial(pbrMetallicRoughness=pbr, name="carBody")]

    # Mesh
    primitive = Primitive(
        attributes={"POSITION": 1, "NORMAL": 2, "TEXCOORD_0": 3},
        indices=0,
        material=0,
        mode=TRIANGLES,
    )
    gltf.meshes = [Mesh(primitives=[primitive], name="car")]

    # Node and Scene
    gltf.nodes = [Node(mesh=0, name="car")]
    gltf.scenes = [Scene(nodes=[0])]
    gltf.scene = 0

    # Set binary blob
    gltf.set_binary_blob(buffer_data)

    # Save
    print(f"  Writing {glb_path}...")
    gltf.save(glb_path)

    file_size = os.path.getsize(glb_path)
    print(f"  Done! {file_size / 1024:.1f} KB")
    return True


def batch_convert(models_config, output_dir):
    """Convert multiple AC3D files to GLB."""
    os.makedirs(output_dir, exist_ok=True)
    results = {}

    for name, config in models_config.items():
        ac_file = config['ac_file']
        glb_file = os.path.join(output_dir, f"{name}.glb")
        texture_dir = config.get('texture_dir', None)

        print(f"\n{'='*60}")
        print(f"Converting: {name}")
        print(f"  Source: {ac_file}")
        print(f"  Output: {glb_file}")

        try:
            success = convert_ac3d_to_glb(ac_file, glb_file, texture_dir)
            results[name] = {'success': success, 'file': glb_file}
        except Exception as e:
            print(f"  ERROR: {e}")
            results[name] = {'success': False, 'error': str(e)}

    return results


if __name__ == '__main__':
    # Batch configuration for our 5 car classes
    models = {
        'gt3': {
            'ac_file': '/tmp/sdcars/cars/ls2-bavaria-g3ls/ls2-bavaria-g3ls.ac',
            'texture_dir': '/tmp/sdcars/cars/ls2-bavaria-g3ls/',
        },
        'gtp': {
            'ac_file': '/tmp/sdcars/cars/sc-murasama-m35/sc-murasama-m35.ac',
            'texture_dir': '/tmp/sdcars/cars/sc-murasama-m35/',
        },
        'lmp2': {
            'ac_file': '/tmp/sdcars/cars/lp1-fictivio-pt/lp1-fictivio-pt.ac',
            'texture_dir': '/tmp/sdcars/cars/lp1-fictivio-pt/',
        },
        'formula': {
            'ac_file': '/tmp/sdcars/cars/mp1-pears-aichi/mp1-pears-aichi.ac',
            'texture_dir': '/tmp/sdcars/cars/mp1-pears-aichi/',
        },
        'sports': {
            'ac_file': '/tmp/sdcars/cars/sc-fmc-gt4/sc-fmc-gt4.acc',
            'texture_dir': '/tmp/sdcars/cars/sc-fmc-gt4/',
        },
    }

    output_dir = '/sessions/practical-quirky-ptolemy/mnt/media-coach-simhub-plugin/web/public/models/cars'
    results = batch_convert(models, output_dir)

    print(f"\n{'='*60}")
    print("SUMMARY:")
    for name, r in results.items():
        status = "OK" if r.get('success') else f"FAILED: {r.get('error', 'unknown')}"
        print(f"  {name}: {status}")
