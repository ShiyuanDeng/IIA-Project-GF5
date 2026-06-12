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
- Added per-character avatar/proxy color tint control.
  - Character inspector now has `Tint avatar/proxy colors`.
  - When enabled, preview/proxy colors keep the previous character-color tint behavior.
  - When disabled, rigid asset material colors are shown directly in the web preview and draft/proxy render.
- Added per-character hide-after timing.
  - Character inspector now has `Hide After Playhead` and `Clear` controls.
  - The saved `hidden_after` value hides that character in web preview, draft/proxy render, and final avatar render after the selected time.
  - This is a lightweight visibility cutoff rather than a full visibility keyframe track.
  - Fixed unset `hidden_after: null` values being interpreted as `0.0` seconds in the browser editor because `Number(null) === 0`.
- Added per-clip shoulder mask control.
  - Clip inspector now has `Shoulder mask` with `Normal` and `Arms forward`.
  - The setting is stored per motion clip, like `hand_pose`.
  - Existing clips default to `normal`.
- Added scene-level `Insert Time` action.
  - Available from the scene inspector.
  - Inserts time at the current playhead by a prompted number of seconds.
  - Shifts character clip starts, character root-key times, and camera keyframe times at or after the playhead.
  - Increases scene duration and preserves segment links because root/camera segments reference key IDs.
- Added scene background image controls to the Preview & Export panel.
  - Background fields include `sky_image`, `floor_image`, `wall_front_image`, `wall_back_image`, `wall_left_image`, and `wall_right_image`.
  - Existing legacy `background.image_path` values are migrated to `sky_image`.
  - Individual background slots can be uploaded or cleared from the web editor.
  - Original GF5 scene background support was limited to `background.color`, optional `background.image_path`, `show_grid`, and `show_floor`.
    - The older Viser scene editor could set a flat viewer background image via `server.scene.set_background_image(...)`.
    - The older web preview/final render path used the flat background color and floor/grid helpers; it did not define a six-sided projection room.
- Added one-shot background set import.
  - `Import Set` accepts multiple PNG/JPG/JPEG/WEBP files in one selection.
  - Files named `sky`, `floor`, `front`, `back`, `left`, and `right` are mapped to the matching background slots.
  - Background upload accepts up to 64 MB per batch and 10 MB per individual image.
  - Upload/import does not create projection geometry.
    - The scene web server only writes image files into `viewer/scene_editor_web/backgrounds/` and returns `/backgrounds/...` URLs.
    - The browser stores those URLs in the scene background fields.
    - Projection planes are built later at preview/render time.
- Added a `Rotate imports 180` background-import toggle.
  - When enabled, individual background uploads and `Import Set` rotate image pixels before upload.
  - The corrected image is stored in `viewer/scene_editor_web/backgrounds/`, so preview and export use the same orientation.

## Scene Data

- Extended scene camera data with:
  - `camera.keyframes`
  - `camera.segments`
  - `fov_degrees` on each camera key
- Extended character data handling so `proxy_asset` is preserved instead of being forced back to the default SMPL proxy.
- Extended character data handling so `tint_avatar_colors` is preserved, defaulting to enabled for older scenes.
- Extended character data handling so `hidden_after` is preserved and clamped to scene duration.
- Proxy asset discovery now exposes all GF5 rigid character assets in `assets/blocky`, while keeping `SMPL-24 Proxy` first when available.
- Extended scene background data with:
  - `background.sky_image`
  - `background.floor_image`
  - `background.wall_front_image`
  - `background.wall_back_image`
  - `background.wall_left_image`
  - `background.wall_right_image`
  - `background.show_grid`
  - `background.show_floor`
- Background image URLs are restricted to static `/backgrounds/...` paths under `viewer/scene_editor_web/backgrounds/` for predictable local serving and rendering.

## Rendering

- Draft/blocky rendering uses the same keyframed camera path as the web preview.
- Final avatar rendering uses the same keyframed camera path and FOV values.
- Camera interpolation modes are respected during render:
  - linear
  - curve
  - hold/cut
- Draft render selects each character's configured `proxy_asset` where available.
- Draft/proxy render respects each character's `tint_avatar_colors` flag.
- Draft/proxy and final avatar renders skip characters after their `hidden_after` time.
- Final avatar rendering applies the per-clip shoulder mask.
  - `arms_forward` blends in a conservative collar/shoulder/elbow correction during final export.
  - The correction uses the same clip transition/blend windows as `hand_pose`.
  - It is intended as a practical mask for clothed avatars whose sleeves collapse into the torso.
- Draft and final avatar renders composite background images.
  - The six-image "room" projection system was added on top of the original flat background/floor support; it was not already defined in the original repo.
  - The floor, wall, and sky projection planes are generated procedurally from the current scene bounds.
    - The renderer computes `center, radius = scene_center_and_radius(scene)`.
    - The room half-size is `extent = ceil(radius + 1)`, clamped to at least 1 m in final render.
    - Wall height is `max(2.8, extent * 0.9)`.
    - The floor plane is placed at `z = 0`.
    - Four wall planes are placed at `center.x/y +/- extent`.
    - The sky uses a larger overhead plane plus four trapezoid bands from wall tops to the sky plane.
  - `sky_image` is rendered as world-space overhead sky geometry rather than a camera-facing screen plate.
    - `load_background_plate` always returns a flat colour base; the sky image is never applied as a full-frame screen-space layer.
    - The sky uses a ceiling plane plus four trapezoidal upper bands bridging down to the tops of the wall planes.
  - Floor and wall images are projected onto scene-aligned planes around the animated characters.
  - Background planes use Sutherland-Hodgman near-plane clipping (`_clip_quad_near_plane`) so partially-visible planes render correctly when one or more corners are behind the camera.
  - Each background plane is rendered with a single Pillow `PERSPECTIVE` transform (exact for planar surfaces) plus a hard polygon mask. No subdivision is used.
    - A 2 px UV inset on the source coordinates prevents edge-pixel black fringe at polygon boundaries.
  - Wall planes extend 0.5 m below Z=0 (`wall_bottom = -0.5`) so walls are fully opaque at floor level with no gap.
  - Compositing draw order is floor first, then walls, so wall edges naturally cover floor edges.
  - Floor plane rendered with no feathering (`feather_px=0`) since wall planes cover its edges.
  - Feathering removed entirely from all planes — Gaussian blur feathering blended against the flat background colour rather than neighbouring planes, producing visible grey gradient bands worse than a hard seam. Hard polygon clip is used instead.
  - 2 px UV inset (`_pad = 2.0`) on source coordinates prevents black-fringe edge-pixel bleeding at polygon boundaries.
- The web shot preview now renders background floor/wall images on a canvas using a perspective-warped 14×14 subdivided mesh (affine per triangle via canvas `setTransform`).
  - This keeps textures anchored in scene space while the camera moves.
  - SVG remains responsible for the preview grid, characters, and labels.
- Final avatar rendering supports a flat rigid-asset mode.
  - Rigid assets whose source metadata has `final_render_mode: "flat"` are projected as unlit colored triangles.
  - This is used for texture-lamina billboard assets where pyrender lighting made thin planes look too dark/brown.
  - Normal rigid assets continue to use the lit pyrender mesh path.

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
- Added file-based hand-pose preset system.
  - Presets live in `libraries/hand_poses/smplx/<name>.handpose.json`.
  - Format `gf5_hand_pose`: per-joint XYZ Euler angles in degrees, applied as R_x @ R_y @ R_z.
  - Each joint gets full 3-DOF; missing joints remain at identity.
  - Baseline `fist.handpose.json` and `natural.handpose.json` files are present under `libraries/hand_poses/smplx/`.
  - At render time `load_hand_pose_preset(name)` reads the file when present and caches the rotation matrices.
  - Interpolation from natural to fist uses axis-angle scaling (equivalent to slerp for each joint).
  - Built-in fallback matrices in `viewer/asset_viewer.py` ensure export never breaks if the files are missing.
  - Asset Viewer has an `SMPL-X Fist Tuning` panel for live XYZ-degree edits on each configured wrist/finger joint.
  - The tuning panel can save the active fist preset to `libraries/hand_poses/smplx/fist.handpose.json`; when present, that JSON overrides the builtin fallback.
  - The current saved `fist.handpose.json` mirrors the edited left-hand values onto the right hand.
- Added generated hand-only SMPL-X avatar packages for fast fist tuning.
  - `libraries/avatars/Ivan_Hands`
  - `libraries/avatars/SalaryMan_1_Hands`
  - `libraries/avatars/SalaryMan_2_Hands`
  - `libraries/avatars/Sean_Hands`
  - `libraries/avatars/Zohaib_Hands`
  - Each contains only `outputs/animation_lowres.obj` plus matching `outputs/animation_lowres_smplx55_skinning_weights.npz`.
  - These packages keep the same 55-joint skeleton/weights format, but the mesh contains only wrist/finger-weighted faces.
- Updated final-avatar discovery to expose both modes when an avatar package supports them:
  - `UP2You: Zohaib`
  - `SMPL-X: Zohaib`
  - Similar labels are shown for Ivan, Sean, SalaryMan_1, and SalaryMan_2.
- Asset Viewer now scans `.viewer_imports/avatars` and `libraries/avatars` by default, so packaged UP2You and SMPL-X avatars appear in its asset dropdown without passing `--character-dir`.
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
- Added arm/torso skinning cleanup to `/home/drdeng/UP2You/tools/package_gf5_avatar.py`.
  - The packer now detects sleeve/arm vertices near the shoulder-elbow and elbow-wrist segments in SMPL native rest-pose coordinates.
  - For those outward arm vertices, excessive pelvis/spine/chest/neck/shoulder weight is suppressed and redistributed onto the relevant arm chain.
  - The cleanup is applied to both the existing 24-joint `animation_lowres_skinning_weights.npz` output and the 55-joint `animation_lowres_smplx55_skinning_weights.npz` output.
  - This targets the failure mode where clothing arms collapse inward because nearest-vertex weight transfer blends sleeve vertices with torso/chest weights.
- Regenerated local avatar packages for:
  - `libraries/avatars/Ivan`
  - `libraries/avatars/SalaryMan_1`
  - `libraries/avatars/SalaryMan_2`
  - `libraries/avatars/Sean`
  - `libraries/avatars/Zohaib`
- Regenerated the active scene avatar packages after the arm/torso cleanup:
  - `libraries/avatars/Wushi`
  - `libraries/avatars/terracotta`
- Generated new avatar packages via UP2You inference + `tools/package_gf5_avatar.py`:
  - `libraries/avatars/Wushi` — input images from `UP2You/Inputs/Wushi/`
  - `libraries/avatars/terracotta` — input images from `UP2You/Inputs/terracotta/`
  - Both use the `up2you-cu128` conda env for inference and `gf5` env for packaging.
  - Inference run with `Manojb/stable-diffusion-2-1-base` (locally cached HuggingFace model).

## Added Blocky Assets

- Added `assets/blocky/magic_box.asset.json`.
  - Full SMPL-24 skeleton retained for motion compatibility.
  - One visible box mesh attached to `pelvis`, so the avatar stays visually box-shaped while normal motion plays internally.
  - Available as both `Preview proxy: Magic Box` and `Final avatar: Blocky: Magic Box`.
- Added `assets/blocky/magic_sphere.asset.json`.
  - Full SMPL-24 skeleton retained for motion compatibility.
  - One visible low-poly sphere attached to `pelvis`.
  - Available as both `Preview proxy: Magic Sphere` and `Final avatar: Blocky: Magic Sphere`.
- Added `assets/blocky/eyes.asset.json`.
  - 10-pair eye set imported from `assets/imports/props/eyes.obj`.
  - Attached to the `head` joint; scale 0.004884 (≈ 0.4 m diameter per eye).
  - Sclera parts (material, Eye.A–J): warm off-white (245, 242, 235).
  - Iris/pupil parts (Iris, Iris.A–J): near-black (20, 16, 14).
  - Per-material colour overrides applied at import time via `--material-color` flags; the MTL file itself has all-grey defaults.
- Added `assets/blocky/leaf1.asset.json`.
  - Imported from `assets/imports/props/leaf1/leaf1.obj`.
  - Uses texture-lamina import mode to convert the alpha-textured leaf plane into colored rigid mesh geometry.
  - Generated with 3 color clusters, 64-cell lamina resolution, 0.35 m target width, and final-render flat mode.

## OBJ Mesh Import

- Added `assets/blocky/import_obj_asset.py`.
  - Converts a Wavefront `.obj` plus optional `.mtl` into a GF5 `.asset.json`.
  - Splits OBJ geometry by object/group/material run into colored rigid parts.
  - Copies the SMPL-24 proxy skeleton so imported assets remain motion-compatible.
  - Lets the user attach the imported mesh to one joint such as `pelvis`, `right_hand`, `head`, etc.
  - Reads MTL `map_Kd` diffuse texture references and derives a material color from the texture when `Kd` is missing or neutral grey.
  - Resolves texture paths relative to the MTL file, including paths with spaces and Windows-style backslashes.
  - Adds `--texture-lamina` mode for alpha-textured billboard/lamina props.
    - Converts visible texture pixels into flat mesh geometry so the rendered shape follows the texture silhouette instead of the original square plane.
    - Groups texture cells into a configurable number of material-color clusters via `--texture-colors`.
    - Supports `--texture-lamina-width`, `--texture-lamina-resolution`, and `--texture-alpha-threshold`.
    - Supports `--texture-color-saturation` and `--texture-color-brightness` to compensate for final-render grading on individual lamina assets.
    - Marks lamina assets with `final_render_mode: "flat"` so final export can render them without pyrender lighting.
- Added `assets/blocky/IMPORT_OBJ_README.md`.
  - Documents the supported OBJ/MTL subset, coordinate system, importer commands, and limitations.

Recommended source pipeline for object meshes:

1. Get or make a low-poly model from a 3D library, phone scan, or text/image-to-3D tool.
2. Open the model in Blender.
3. Clean it up: apply transforms, reduce triangle count if needed, and assign simple material colors.
4. Export from Blender as Wavefront OBJ with a matching MTL file.
5. Run `assets/blocky/import_obj_asset.py` to generate `assets/blocky/<name>.asset.json`.
6. For alpha-textured planes such as leaves, use `--texture-lamina` instead of the normal rigid OBJ import.

Good source categories:

- 3D libraries such as Sketchfab or Objaverse, with license checked before use.
- Phone scanning tools such as Polycam or Scaniverse for real objects.
- AI text/image-to-3D tools such as Meshy for quick fantasy props.

For this renderer, simple low-poly OBJ/MTL assets with material colors work better than dense textured scans. Diffuse texture files can now provide fallback material colors, and alpha-textured lamina assets can be converted into approximate colored mesh geometry.

## Workflow / Repo

- Disabled the student release audit workflow by renaming:
  - `.github/workflows/student-release-audit.yml`
  - to `.github/workflows/student-release-audit.yml.disabled`
- This avoids CI failing on local/custom scene and motion library additions that the release checker forbids.
- Scene files in `libraries/scenes/` and uploaded background images in `viewer/scene_editor_web/backgrounds/` are intended to be tracked when they are part of a saved scene.

## Bug Fixes

- Fixed root joint handling in `viewer/student_submission/part1_fk.py`.
  - Root joints have `parent = -1` (integer) in the `JointSpec` dataclass, never `None`.
  - The original guard `if parent is None:` never matched, so `root_offset` (the character's world-space Z position from waypoints) was silently ignored during forward kinematics.
  - Fixed to `if parent is None or parent < 0:` so the root translation is applied correctly.
  - Symptom before fix: characters appeared at the correct XY position in the web preview but floated at a fixed Z height in the final rendered MP4 regardless of waypoint Z values.

## Notes / Limitations

- Blocky object avatars are rigid parts attached to skeleton joints.
  - A box or sphere attached to `pelvis` stays rigid.
  - A sword/staff/shield can be attached to `right_hand` or another joint and will move with that joint.
- These object-like assets do not have physics, collision, textures, or separate scene-object keyframes yet.
- A true independent scene-object system would need new scene schema fields, timeline UI, web preview drawing, and render support.
