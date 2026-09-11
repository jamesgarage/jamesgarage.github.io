# Smoother nearby forest crowns

Use 20 perimeter segments and 12 rings for the existing nearby organic crown shape, replacing 14×9. Keep distant crowns at 8×6 and retain every tree's placement, scale, material and batched ownership. This improves the nearest rim and broad shading without increasing draw calls or adding textures.

A matched 54-view study compared 14×9, 20×12 and 24×14 across three course positions, normal/guardian poses, and tablet/phone views. Root and independent review chose 20×12: the nearest outlines visibly improve, while 24×14 adds cost for a small further gain. The accepted world has 377,240 triangles and 1,049,207 position vertices, 604 mesh batches, 69 materials and 9 textures. Its closest actual canopy vertex remains 12.954 units from the road center, above the 12-unit rule. Existing world/guardian/loop tests still govern acceptance.

The study's peak frame is 428,552 triangles / 622 calls with the earlier individual-particle renderer and original player models. The integrated final release must measure its own budget after the particle and truck updates; these figures are not physical iPad frame rates.
