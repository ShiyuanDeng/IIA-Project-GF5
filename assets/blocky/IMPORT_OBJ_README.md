# OBJ Importer

`import_obj_asset.py` converts a colored Wavefront OBJ mesh into the GF5 `.asset.json` format used by the scene web editor and renderer.

## Supported Input

Use:

```text
model.obj
model.mtl  optional, referenced from the OBJ by `mtllib model.mtl`
```

Supported OBJ statements:

- `v x y z` vertices
- `f i j k ...` polygon faces; triangles and n-gons are accepted, n-gons are fan-triangulated
- `mtllib file.mtl` material library
- `usemtl name` material assignment
- `o name` / `g name` object or group names

Supported MTL statements:

- `newmtl name`
- `Kd r g b` diffuse color

Ignored input data:

- UVs: `vt`
- normals: `vn`
- texture images: `map_Kd`
- metal/roughness/transparency/material shaders
- animation, armatures, skinning, bones

The importer preserves simple material colors by splitting the OBJ into one GF5 `rigid_part` per object/group/material run.

## Coordinate System

The generated mesh vertices are local to the selected SMPL-24 joint.

GF5 viewer convention:

- `+Z` is up
- `+Y` is forward
- `+X` is anatomical right
- units are meters

For example:

- `--joint pelvis`: mesh follows the character pelvis/root.
- `--joint right_hand`: mesh follows the right hand, useful for swords/staffs.
- `--joint head`: mesh follows the head, useful for helmets/masks.

Transform order:

1. uniform scale
2. Euler rotation in degrees: `x,y,z`
3. local offset in meters: `x,y,z`

## Usage

Import a static prop-like avatar attached to the pelvis:

```bash
python assets/blocky/import_obj_asset.py \
  --obj assets/imports/props/statue.obj \
  --name "Statue" \
  --joint pelvis \
  --scale 1.0 \
  --offset 0,0,0 \
  --out assets/blocky/statue.asset.json
```

Import a sword attached to the right hand:

```bash
python assets/blocky/import_obj_asset.py \
  --obj assets/imports/props/sword.obj \
  --name "Sword" \
  --joint right_hand \
  --scale 0.01 \
  --rotate-degrees 0,0,0 \
  --offset 0,0,0 \
  --out assets/blocky/sword.asset.json
```

Fallback color for faces without an MTL material:

```bash
python assets/blocky/import_obj_asset.py \
  --obj assets/imports/props/prop.obj \
  --name "Prop" \
  --joint pelvis \
  --default-color 160,160,180 \
  --out assets/blocky/prop.asset.json
```

Override colors when an MTL uses gray `Kd` values or missing texture images:

```bash
python assets/blocky/import_obj_asset.py \
  --obj assets/imports/props/indoor_plant.obj \
  --name "Indoor Plant" \
  --joint pelvis \
  --material-color IDP_leaves=42,128,58 \
  --material-color IDP_root=112,72,42 \
  --material-color IDP_Pot=148,84,54 \
  --out assets/blocky/indoor_plant.asset.json
```

After importing, refresh the web editor. The generated asset appears as:

- `Preview proxy: <name>`
- `Final avatar: Blocky: <name>`

## Recommended Source Pipeline

Use Blender as the normalization step between outside tools and this importer:

1. Get or make a low-poly object mesh.
2. Open it in Blender.
3. Apply transforms.
4. Reduce triangle count if the model is dense.
5. Replace image-texture-only materials with simple material colors if needed.
6. Export as Wavefront OBJ with a matching MTL file.
7. Run `import_obj_asset.py`.

Useful object sources:

- 3D libraries: Sketchfab, Objaverse, other OBJ/GLB/FBX model libraries. Check the model license before use.
- Phone scanning: Polycam or Scaniverse can export mesh formats such as OBJ; scanned meshes usually need cleanup/decimation.
- AI text/image-to-3D: Meshy or similar tools can generate quick fantasy props; export OBJ if available, otherwise convert through Blender.

Best results for the current renderer:

- Prefer low-poly assets.
- Prefer material colors over image textures.
- Keep one object per OBJ.
- Keep OBJ, MTL, and any texture files in the same folder, even though this importer currently reads only MTL diffuse color `Kd`.
- Keep each object to a few thousand triangles or less for responsive web preview.

## Limitations

- Imported meshes are rigid. They do not deform.
- All imported parts from one OBJ attach to one joint selected by `--joint`.
- Colors may be tinted by the character color in the current preview/render pipeline.
- This is not a full independent scene-object system. The imported mesh behaves like a character/avatar proxy.
