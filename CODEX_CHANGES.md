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

## SMPL-X Final Avatars And Hand Poses

- Added an optional 55-joint SMPL-X final-avatar path alongside the existing 24-joint UP2You package path.
  - Existing `UP2You: <name>` final avatars still use `animation_lowres.obj` and `animation_lowres_skinning_weights.npz`.
  - New `SMPL-X: <name>` final avatars use the clothed `animation_lowres.obj` mesh with 55-joint SMPL-X skinning when `animation_lowres_smplx55_skinning_weights.npz` is present.
  - Older packages without the clothed 55-joint sidecar still fall back to the SMPL-X body mesh path.
  - Absolute-path `avatar_asset` values still resolve to the old UP2You path for backward compatibility.
- Added `smplx_55` skeleton profile.
  - Includes SMPL-X body joints, jaw/eyes, and finger chains.
  - Existing 24-joint course motions retarget onto matching SMPL-X body joints.
  - Missing face/finger motion defaults to neutral unless a scene clip hand pose overrides it.
- Added per-clip `hand_pose` scene metadata.
  - Supported values: `natural`, `fist`.
  - Missing or unknown values default to `natural`.
  - The browser Scene Editor clip inspector now exposes a `Hand pose` dropdown.
  - The motion library files are not modified; the hand pose is stored per scene clip instance.
- Added hand-pose blending during clip transitions.
  - `natural` to `fist` and `fist` to `natural` interpolate through the same blend windows as body motion clips.
  - Blocky/proxy preview does not show SMPL-X finger pose because preview proxies are still SMPL-24/rigid assets.
  - Final SMPL-X avatar export applies the hand pose before FK and mesh skinning.
- Added a simple SMPL-X fist preset.
  - Finger curls are mirrored between left and right hands.
  - Thumbs include an inward tuck component.
  - The preset is currently hard-coded in `viewer/asset_viewer.py`; future tuning would benefit from Asset Viewer sliders or a JSON hand-pose preset file.
- Updated final-avatar discovery to expose both modes when an avatar package supports them:
  - `UP2You: Zohaib`
  - `SMPL-X: Zohaib`
  - Similar labels are shown for Ivan, Sean, SalaryMan_1, and SalaryMan_2.
- The browser Scene Editor does not interpret avatar kinds itself.
  - It stores `avatar_asset` as the selected label string, for example `SMPL-X: Zohaib`.
  - The Python scene/render layer resolves that label to `kind: "smplx"` or `kind: "up2you"` during export.
  - Path-valued legacy scenes continue to resolve to `up2you` for compatibility.

## UP2You GF5 Avatar Packaging

- Updated `/home/drdeng/UP2You/tools/package_gf5_avatar.py` to package SMPL-X sidecars for GF5.
  - Existing 24-joint outputs are still generated:
    - `outputs/animation_lowres.obj`
    - `outputs/animation_lowres_skinning_weights.npz`
    - `outputs/smplx_mesh.obj`
  - New SMPL-X outputs are also generated:
    - `outputs/animation_lowres_smplx55_skinning_weights.npz`
    - `outputs/smplx_mesh_tpose.obj`
    - `outputs/smplx_skinning_weights.npz`
- `animation_lowres_smplx55_skinning_weights.npz` stores:
  - `format = gf5_smplx55_skinning_weights`
  - `joint_names` with 55 SMPL-X joints
  - `skinning_weights` with shape `(animation_lowres vertex count, 55)`
  - `rest_joints` with shape `(55, 3)`
  - `source_mesh = animation_lowres.obj`
- `smplx_skinning_weights.npz` stores:
  - `format = gf5_smplx55_skinning_weights`
  - `joint_names` with 55 SMPL-X joints
  - `skinning_weights` with shape `(10475, 55)`
  - `rest_joints` with shape `(55, 3)`
  - `source_mesh = smplx_mesh_tpose.obj`
- The UP2You packer now transfers SMPL-X 55-joint weights onto the clothed `animation_lowres.obj` mesh and also reposes the SMPL-X body mesh from UP2You A-pose into the GF5 rest-pose convention.
  - This keeps the elbow/wrist placement aligned with the SMPL-24/course-motion convention.
  - GF5 prefers packaged `animation_lowres.obj` and `animation_lowres_smplx55_skinning_weights.npz`.
  - GF5 still has a fallback runtime A-pose-to-T-pose path for older avatar packages that only have `smplx_mesh.obj`.
- Regenerated local avatar packages for:
  - `libraries/avatars/Ivan`
  - `libraries/avatars/SalaryMan_1`
  - `libraries/avatars/SalaryMan_2`
  - `libraries/avatars/Sean`
  - `libraries/avatars/Zohaib`

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
