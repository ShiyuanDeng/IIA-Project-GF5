from __future__ import annotations

import numpy as np


def make_one_hot_skinning_weights(weights: np.ndarray) -> np.ndarray:

    one_hot_weights = [[0 if j != np.argmax(row) else 1 for j in range(len(row))] for row in weights]
    
    return np.array(one_hot_weights)

def skin_smpl_mesh(
    model_data: object,
    world_rotations: np.ndarray,
    world_positions: np.ndarray,
    *,
    use_blended_weights: bool,
) -> np.ndarray:
    
    weights = model_data.skinning_weights if use_blended_weights else make_one_hot_skinning_weights(model_data.skinning_weights)
    
    rest_vertices = np.asarray(model_data.rest_vertices, dtype=np.float32)
    rest_joints = np.asarray(model_data.rest_joints, dtype=np.float32)
    world_positions = np.asarray(world_positions, dtype=np.float32)
    world_rotations = np.asarray(world_rotations, dtype=np.float32)
    
    blended_vertices = np.zeros_like(rest_vertices, dtype=np.float32)
          
    '''for i in range(len(weights)):
        for j in range(len(rest_joints)):
            blended_vertices[i] += weights[i,j] * (world_rotations[j] @ (rest_vertices[i] - rest_joints[j]) + world_positions[j])
    '''
    
    for j in range(len(rest_joints)):
        offset = rest_vertices - rest_joints[j]
        transformed_offset = offset @ world_rotations[j].T
        blended_vertices += weights[:, j][:, np.newaxis] * (transformed_offset + world_positions[j])
    
    return blended_vertices

