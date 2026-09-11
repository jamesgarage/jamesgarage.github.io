# Working rear coils for Mega Titan

Shorten Titan's existing rear spring assembly during the existing landing dip. Keep every body, wheel, arm and driving pose unchanged. This is a small mechanical detail, using the current squash value rather than a new motion controller or event timer.

The model exposes a frozen borrowed descriptor for its existing three-material suspension group: lower anchor 1.77 and span 0.95. A stateless helper clamps compression to 0–0.2, scales vertically around the lower anchor, and compensates the body's existing dip. The lower mount stays fixed relative to the undipped body while the upper crossbar follows it. Other trucks have no descriptor and keep their exact existing appearance and motion.

The scene applies the pose after its existing body movement. Compression stays full through a body lean of 0.14 radians, then fades to the authored neutral pose by 0.18 radians in either direction. This avoids adding spring/tire contact during rapid accessible steering reversals. Menu, reset, truck replacement, gentler motion and the guided loop also restore neutral. A paused update retains the existing squash and lean values and therefore the same spring pose. No new geometry, materials, clocks, particles or inputs are added.

The matched study checks 28 pairs at both tablet orientations across a crush and landing. Body/wheel/camera positions, outer geometry bounds, vertex counts and rendering resources stay identical. At landing the projected mount span changes from 21.70 to 17.48 pixels in landscape, and 23.19 to 18.67 pixels in portrait, returning to neutral with the existing dip. Crushing remains unchanged. Root and independent visual review judged this a restrained, visible detail rather than a different landing animation.

A deeper body-compression experiment was rejected: it caused bumper and arm overlap with the actual tire profile. The accepted version changes only the springs and does not retain that extra body response. Scratch study and review records remain under `.tmp/`.
