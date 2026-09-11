# Smoother horizon hills

Use 24 perimeter segments and 14 rings for the 38 existing organic hills. Preserve their positions, colors, scale, seven spatial groups and shared material ownership. Their large outlines are visible behind the road and benefit more from a rounded contour than fine surface texture.

A matched study compares 14×8, 24×14 and 32×18 at distances 40, 400 and 1320 in landscape 1024×768 and portrait 768×1024. All 18 captures use identical race, four-friend and camera states for each comparison. The accepted 24×14 shape removes obvious straight silhouette segments; 32×18 adds little visible improvement for another 17,632 static triangles. Root and independent review inspected the contours at actual size.

The accepted world uses 393,504 triangles and 1,097,999 position vertices, with the same 604 mesh batches, 69 materials and nine textures. This adds 16,264 triangles across the entire course. The study peaks at 585 calls / 427,856 triangles; slightly changed bounds can make one more existing batch visible. These samples are not whole-course or physical-device frame-time measurements.

Independent bounds of every authored hill remain at least 54.380 units from the sampled road centerline. Accounting for the driving half-width and maximum sample spacing leaves 46.105 units of conservative clearance. Existing finite-geometry, culling and full-world budget tests remain the release checks. Scratch evidence: `.tmp/horizon-study-metrics.json`, `.tmp/horizon-review.md` and the paired images.
