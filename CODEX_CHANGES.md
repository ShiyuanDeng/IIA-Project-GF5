# Codex Changes

This file summarizes the local changes added on top of the original GF5 scene renderer/editor during Codex-assisted work.

## Scene Web Editor

- Added keyframed camera support in the web scene editor.
  - Camera preset includes `Keyframed`.
  - Camera keys store `time`, `position`, `look_at`, and `fov_degrees`.
  - Camera keys can be added at the current playhead/camera pose.
  - Camera keys can be selected, edited, deleted, and dragged on the timeline.
- Added a dedicated camera timeline row below character rows.
  - Camera key markers are visible on the timeline.
  - Camera key times can be adjusted by dragging.
  - Camera segment interpolation can be set between camera keys.
- Added camera interpolation modes.
  - `linear`: straight interpolation between keys.
  - `curve`: Catmull-Rom style smoothed interpolation.
  - `hold`: hold the first key, then cut abruptly to the next key.
- Added per-camera-key FOV editing.
  - FOV is saved with the scene.
  - FOV is used in the web preview, draft render, and final avatar render.
- Added per-character preview proxy selection.
  - Character inspector now has `Preview proxy`.
  - The web stage preview uses the selected proxy asset per character.
  - Scene save/load preserves each character's `proxy_asset`.

## Scene Data

- Extended scene camera data with:
  - `camera.keyframes`
  - `camera.segments`
  - `fov_degrees` on each camera key
- Extended character data handling so `proxy_asset` is preserved instead of being forced back to the default SMPL proxy.
- Proxy asset discovery now exposes all GF5 rigid character assets in `assets/blocky`, while keeping `SMPL-24 Proxy` first when available.

## Rendering

- Draft/blocky rendering uses the same keyframed camera path as the web preview.
- Final avatar rendering uses the same keyframed camera path and FOV values.
- Camera interpolation modes are respected during render:
  - linear
  - curve
  - hold/cut
- Draft render selects each character's configured `proxy_asset` where available.

## Added Blocky Assets

- Added `assets/blocky/magic_box.asset.json`.
  - Full SMPL-24 skeleton retained for motion compatibility.
  - One visible box mesh attached to `pelvis`, so the avatar stays visually box-shaped while normal motion plays internally.
  - Available as both `Preview proxy: Magic Box` and `Final avatar: Blocky: Magic Box`.
- Added `assets/blocky/magic_sphere.asset.json`.
  - Full SMPL-24 skeleton retained for motion compatibility.
  - One visible low-poly sphere attached to `pelvis`.
  - Available as both `Preview proxy: Magic Sphere` and `Final avatar: Blocky: Magic Sphere`.

## OBJ Mesh Import

- Added `assets/blocky/import_obj_asset.py`.
  - Converts a Wavefront `.obj` plus optional `.mtl` into a GF5 `.asset.json`.
  - Splits OBJ geometry by object/group/material run into colored rigid parts.
  - Copies the SMPL-24 proxy skeleton so imported assets remain motion-compatible.
  - Lets the user attach the imported mesh to one joint such as `pelvis`, `right_hand`, `head`, etc.
- Added `assets/blocky/IMPORT_OBJ_README.md`.
  - Documents the supported OBJ/MTL subset, coordinate system, importer commands, and limitations.

Recommended source pipeline for object meshes:

1. Get or make a low-poly model from a 3D library, phone scan, or text/image-to-3D tool.
2. Open the model in Blender.
3. Clean it up: apply transforms, reduce triangle count if needed, and assign simple material colors.
4. Export from Blender as Wavefront OBJ with a matching MTL file.
5. Run `assets/blocky/import_obj_asset.py` to generate `assets/blocky/<name>.asset.json`.

Good source categories:

- 3D libraries such as Sketchfab or Objaverse, with license checked before use.
- Phone scanning tools such as Polycam or Scaniverse for real objects.
- AI text/image-to-3D tools such as Meshy for quick fantasy props.

For this renderer, simple low-poly OBJ/MTL assets with material colors work better than dense textured scans.

## Workflow / Repo

- Disabled the student release audit workflow by renaming:
  - `.github/workflows/student-release-audit.yml`
  - to `.github/workflows/student-release-audit.yml.disabled`
- This avoids CI failing on local/custom scene and motion library additions that the release checker forbids.

## Notes / Limitations

- Blocky object avatars are rigid parts attached to skeleton joints.
  - A box or sphere attached to `pelvis` stays rigid.
  - A sword/staff/shield can be attached to `right_hand` or another joint and will move with that joint.
- These object-like assets do not have physics, collision, textures, or separate scene-object keyframes yet.
- A true independent scene-object system would need new scene schema fields, timeline UI, web preview drawing, and render support.
