# UP2You To GF5 Pipeline

This page describes the boundary between the UP2You character reconstruction
tool and the GF5 avatar package that the scene editor and renderer consume.

## What UP2You Produces

UP2You is the upstream reconstruction step. In this workflow it starts from a
custom character capture or reconstruction input and produces a downloadable
avatar package.

The package is not a single mesh file. It is a small folder containing a
visible mesh plus the data needed to make that mesh move with a body skeleton.

Typical UP2You output layout:

```text
outputs/
  animation_lowres.obj
  animation_lowres_skinning_weights.npz
  animation_lowres_smplx55_skinning_weights.npz
  smplx_mesh.obj
  smplx_mesh_tpose.obj
  smplx_skinning_weights.npz
```

The most important pieces are:

- `animation_lowres.obj`: the visible, lower-resolution clothed mesh used by GF5
- `animation_lowres_skinning_weights.npz`: the 24-joint GF5-compatible skinning
  data for the low-res mesh
- `animation_lowres_smplx55_skinning_weights.npz`: the optional 55-joint
  SMPL-X sidecar used when the avatar package supports the more detailed body
  rig
- `smplx_mesh.obj` and `smplx_mesh_tpose.obj`: the body mesh versions used for
  SMPL-X alignment and rest-pose conversion
- `smplx_skinning_weights.npz`: the SMPL-X joint-weight data for the body mesh

In practice, GF5 does not use the raw UP2You output folder directly. It packages
the useful parts into a GF5 avatar directory with the naming and metadata that
the scene editor expects.

## What GF5 Needs

GF5 scenes refer to avatar packages under `libraries/avatars/<name>/`.

A packaged avatar must contain the output files in a stable layout such as:

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

The scene editor then treats that package as an available final avatar choice.

## What `package_gf5_avatar.py` Does

`/home/drdeng/UP2You/tools/package_gf5_avatar.py` is the bridge between the two
systems. Conceptually, it does four things:

1. Reads the reconstructed UP2You outputs.
2. Rebuilds the avatar into a GF5-friendly package layout.
3. Aligns the mesh, skeleton, and skinning data so GF5 can animate it with the
   same motion pipeline as the built-in assets.
4. Writes the packaged result into `libraries/avatars/<name>/` so the scene
   editor can pick it up.

The important alignment work is:

- convert the UP2You rest pose into the GF5 rest-pose convention
- map the reconstructed mesh onto the GF5 joint layout
- package both the standard 24-joint low-res output and the optional 55-joint
  SMPL-X sidecar
- keep the exported files in the layout that GF5 discovers automatically

This is why the script matters even when UP2You already produced a usable
avatar. UP2You gives you the reconstruction; the packager turns it into a GF5
asset.

## How GF5 Uses The Package

Once packaged, GF5 loads the avatar in the final renderer and applies normal
scene motion to it.

- `UP2You: <name>` uses the 24-joint package path.
- `SMPL-X: <name>` uses the 55-joint SMPL-X sidecar when present.

That is why the package has to contain both the visible mesh and the matching
skinning data. The mesh alone is just geometry. The weights and rest-pose data
are what let GF5 move it with the scene motion clips.

## Practical Notes

- Keep the output folder intact when extracting a downloaded ZIP.
- Put each avatar in its own folder under `libraries/avatars/`.
- Refresh the scene editor after adding a new package so it appears in the
  `Final avatar` dropdown.
- If the avatar looks offset, collapsed, or too gray in GF5, the problem is
  usually in the packaging/alignment step rather than in the raw UP2You mesh.

