# UP2You To GF5 Pipeline

This page describes the boundary between the UP2You character reconstruction
tool and the GF5 avatar package that the scene editor and renderer consume.

## What UP2You Produces

UP2You is the upstream reconstruction step. In this workflow it starts from a
custom character capture or reconstruction input and produces a reconstruction
output folder.

Raw UP2You inference does not write GF5 skinning-weight `.npz` files. The
inference scripts write reference images, generated multi-view images, normal
maps, videos, and reconstructed OBJ meshes. The skinning `.npz` files used by
GF5 are created later by `package_gf5_avatar.py`.

Typical raw UP2You inference output layout:

```text
outputs/
  <avatar_name>/
    ref_rgbs.png
    target_pose.png
    render.mp4
    normal.mp4
    pred_rgbs/
      0.png
      ...
    pred_normals/
      0.png
      ...
    pred_corr_maps/
      0.png
      ...
    ref_imgs/
      ...
    meshes/
      smplx_mesh.obj
      mesh_remeshed.obj
      mesh_final.obj
      result_clr.obj
```

The most important raw mesh files are:

- `meshes/smplx_mesh.obj`: the fitted SMPL-X body mesh produced from the
  predicted body shape
- `meshes/result_clr.obj`: the reconstructed colored/clothed mesh produced by
  normal-based reconstruction and color projection
- `meshes/mesh_remeshed.obj` and `meshes/mesh_final.obj`: intermediate
  reconstruction meshes

At this point the visible character exists as geometry, but it is not yet a
GF5-ready animated avatar. GF5 still needs a canonical rest pose, joint names,
rest joints, and per-vertex skinning weights stored in the format its renderer
expects.

## What GF5 Needs

GF5 scenes refer to avatar packages under `libraries/avatars/<name>/`.

A packaged GF5 avatar contains a stable layout such as:

```text
libraries/avatars/alex/
  outputs/
    animation_lowres.obj
    animation_lowres_skinning_weights.npz
    animation_lowres_smplx55_skinning_weights.npz
    smplx_mesh.obj
    smplx_mesh_tpose.obj
    smplx_skinning_weights.npz
```

The most important packaged files are:

- `animation_lowres.obj`: the visible, lower-resolution clothed mesh used by GF5
- `animation_lowres_skinning_weights.npz`: the 24-joint GF5-compatible skinning
  data for the low-res mesh
- `animation_lowres_smplx55_skinning_weights.npz`: the optional 55-joint
  SMPL-X sidecar used when the avatar package supports the more detailed body
  rig
- `smplx_mesh.obj` and `smplx_mesh_tpose.obj`: the body mesh versions used for
  SMPL-X alignment and rest-pose conversion
- `smplx_skinning_weights.npz`: the SMPL-X joint-weight data for the body mesh

The scene editor treats this package as an available final avatar choice.

## What `package_gf5_avatar.py` Does

`/home/drdeng/UP2You/tools/package_gf5_avatar.py` is the bridge between the two
systems. Conceptually, it does four things:

1. Reads the raw UP2You meshes, especially `meshes/result_clr.obj` and
   `meshes/smplx_mesh.obj`.
2. Rebuilds the avatar into a GF5-friendly package layout.
3. Aligns the mesh, skeleton, and skinning data so GF5 can animate it with the
   same motion pipeline as the built-in assets.
4. Writes the packaged result into `libraries/avatars/<name>/` so the scene
   editor can pick it up.

The important alignment work is:

- convert the UP2You A-pose output into the GF5 rest-pose convention
- transfer skinning weights from the fitted SMPL-X template onto the
  reconstructed clothed mesh
- collapse SMPL-X template weights into the GF5 24-joint layout for
  `UP2You: <name>` final avatars
- keep the 55-joint SMPL-X sidecar for `SMPL-X: <name>` final avatars
- write the GF5 `.npz` files with `joint_names`, `skinning_weights`,
  `rest_joints`, rest-pose metadata, and source-mesh metadata
- keep the exported files in the layout that GF5 discovers automatically

This is why the script matters even when UP2You already produced a usable mesh.
UP2You gives you the reconstruction; the packager turns it into a GF5 animated
avatar package.

## How Skinning Weights Are Attached

The raw reconstructed mesh from UP2You, `meshes/result_clr.obj`, has vertex
positions and colors, but it does not carry GF5 skinning weights. The packager
creates those weights by transferring them from the fitted SMPL-X body mesh,
`meshes/smplx_mesh.obj`.

The transfer is geometric nearest-neighbor transfer in the UP2You/SMPL native
A-pose coordinate space:

1. Read every vertex from `result_clr.obj`. These are the clothed mesh vertices
   that will become `animation_lowres.obj`.
2. Read every vertex from `smplx_mesh.obj`. This mesh has the same topology as
   the SMPL-X template, so its vertex order matches the SMPL-X model `.npz`
   template weights.
3. Load `weights` from the SMPL-X model file, for example
   `human_models/models/smplx/SMPLX_NEUTRAL.npz`.
4. Build a `scipy.spatial.cKDTree` over the fitted SMPL-X body vertices.
5. For each clothed mesh vertex, query the nearest fitted SMPL-X body vertices.
6. Copy or blend the SMPL-X template weights from those nearest body vertices
   onto the clothed vertex.

If `--weight-neighbors 1` is used, the clothed vertex simply receives the
weights of the closest SMPL-X body vertex.

If more than one neighbor is used, the packager blends the neighbor weights by
inverse distance:

```text
neighbor_factor[k] = 1 / max(distance[k], 1e-6)
blend_weight[k] = neighbor_factor[k] / sum(neighbor_factor)
clothed_weights = sum_k blend_weight[k] * smplx_template_weights[neighbor[k]]
```

The result is renormalized so each vertex's weights sum to `1.0`.

This means the method is closest-distance based. It does not compute
barycentric coordinates on the SMPL-X surface, does not ray-cast onto triangles,
and does not solve a deformation optimization. It assumes the reconstructed
clothed mesh is spatially close enough to the fitted SMPL-X body that nearest
SMPL-X vertices give useful skinning weights.

## 24-Joint And 55-Joint Weights

The packager creates two versions of the transferred weights.

For `SMPL-X: <name>`, the packager keeps the first 55 SMPL-X weight columns:

```text
pelvis, hips, spine, legs, neck, collars, head,
shoulders, elbows, wrists, jaw, eyes, fingers
```

These are saved to:

```text
animation_lowres_smplx55_skinning_weights.npz
```

For `UP2You: <name>`, GF5 needs the coarser 24-joint course body layout. The
packager collapses SMPL-X weights into SMPL-24 weights:

- body joints `0..21` are copied directly
- jaw and eye weights `22..24` are added to `head`
- left finger weights `25..39` are summed into `left_hand`
- right finger weights `40..54` are summed into `right_hand`
- each row is normalized again

These collapsed weights are saved to:

```text
animation_lowres_skinning_weights.npz
```

## Arm/Torso Cleanup

Nearest-distance transfer is fast and usually reasonable, but it can bleed
torso weights onto clothing around shoulders, sleeves, and armpits. This is
especially visible when a loose sleeve vertex lies physically closer to the
chest than to the upper-arm surface.

The GF5 packager includes a conservative cleanup pass for that failure mode.
For each side of the body, it:

1. Measures each clothed vertex's distance to the shoulder-elbow segment and
   elbow-wrist segment.
2. Keeps only outward-side vertices near those arm segments.
3. Checks whether the vertex already has meaningful arm weight but also too
   much torso weight.
4. Moves weight from torso joints onto the relevant arm chain.
5. Renormalizes the vertex weights.

For the 24-joint package, the suppressed torso joints are:

```text
pelvis, spine1, spine2, spine3, neck, left_collar, right_collar, head
```

For the left arm, moved weight is redistributed to:

```text
left_shoulder, left_elbow, left_wrist, left_hand
```

For the right arm, moved weight is redistributed to:

```text
right_shoulder, right_elbow, right_wrist, right_hand
```

The same idea is applied to the 55-joint package, except the hand side includes
the SMPL-X finger joints.

This cleanup is not a full automatic rigging system. It is a targeted correction
for nearest-neighbor torso bleed on sleeve and upper-arm vertices.

## Rest-Pose Conversion

UP2You's generated meshes are in an A-pose. GF5 motion clips assume a T-pose
style bind pose where the arms are horizontal in the zero-rotation reference.

The packager handles this by:

1. Regressing rest joints from the fitted SMPL-X mesh using the SMPL-X
   `J_regressor`.
2. Inverting UP2You's known shoulder A-pose rotations:
   - left shoulder: `-pi/4` around SMPL native Z
   - right shoulder: `+pi/4` around SMPL native Z
3. Computing T-pose rest joints for the arm chains.
4. Reposing the clothed mesh from A-pose to T-pose using inverse linear blend
   skinning.

The inverse LBS step solves, per vertex:

```text
v_A = sum_j w_j * G_j * v_T
v_T = inverse(sum_j w_j * G_j) * v_A
```

where `v_A` is the UP2You A-pose vertex, `v_T` is the GF5 T-pose vertex, `w_j`
are the transferred skinning weights, and `G_j` are the known joint transforms
from T-pose to A-pose.

The output `animation_lowres.obj` is therefore not just a copy of
`result_clr.obj`. It preserves the OBJ faces, normals, UVs, and vertex color
fields, but replaces the vertex positions with the GF5-compatible T-pose
positions.

## How GF5 Uses The Package

Once packaged, GF5 loads the avatar in the final renderer and applies normal
scene motion to it.

- `UP2You: <name>` uses the 24-joint package path.
- `SMPL-X: <name>` uses the 55-joint SMPL-X sidecar when present.

That is why the package has to contain both the visible mesh and the matching
skinning data. The mesh alone is just geometry. The weights and rest-pose data
are what let GF5 move it with the scene motion clips.

## Practical Notes

- Keep the raw UP2You output folder intact until packaging is complete.
- Put each packaged avatar in its own folder under `libraries/avatars/`.
- Refresh the scene editor after adding a new package so it appears in the
  `Final avatar` dropdown.
- If the avatar looks offset, collapsed, or too gray in GF5, the problem is
  usually in the packaging/alignment step rather than in the raw UP2You mesh.
