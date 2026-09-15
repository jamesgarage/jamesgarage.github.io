# Racing for the trophy

The family asked for opponents who can win, road turns, a closer view, going off course and being towed back, a winner's toy-smashing ceremony, and a way to contribute ideas. This release adds those choices while keeping the familiar easy game available.

## Two ways to play

Cruise is the default for fresh and existing saves. Its previous movement, event and reward behavior stays intact. Rival Race is a separate saved choice beside Play, available on every course. A parent explicitly chooses Learning, Racing or Fast rivals; unlocks and wins do not secretly increase difficulty.

Each rival runs a deterministic local decision model. Identity and race seed set personal pace and boost timing. Sunny, Splash, Pebble and Digger seek clear passes; Ember and Bolt sometimes defend a lane briefly, with an announcement. The mixed starting grid, independent movement and ordinary collision clearance allow rivals to win without scripted finishing positions or teleports. These decisions require no network or AI service.

Finish times are interpolated within each simulation step and stored permanently. A racer who already crossed stays ahead even after both rendered distances reach the line. The race ends when the player finishes; the ceremony receives the recorded winner and the actual five entrants. All finishers keep twelve completion stars plus the established capped bonus.

## Turns and recovery

Four smooth bends change the shared route centerline, including the terrain's road corridor. Logical station distances remain the common measure for player, rivals, collectibles and flights. Existing loop and canyon timing stays intact. Rival Race adds outward drift through grounded turns; steering corrects it. Cruise retains its established assistance.

Five authored shoulder areas have actual supported dirt, openings in the rails, and a clear eighteen-unit corridor. Canyon filters out the shoulder overlapping a gap. A driver may steer beyond the normal lane limit only inside safe grounded windows. Reaching the outer shoulder, or approaching its closing rail while off course, calls a tow.

The tow holds station for a short hook/pull/release sequence while rivals continue. Its winch and cable visibly return the truck toward the center. An occupied merge can extend recovery until the whole truck fits; it never snaps through a passing rival. Pause freezes it, and recovery cannot skip a gap or finish, collect rewards, or restart held actions. Actual articulated wheel bounds are checked through curved-road recoveries as well as numeric lane envelopes.

## View and celebration

Close view makes the existing bodywork, tires and suspension easier to see. Flying robots and towing get more room; the loop retains its upright overview. Wide view and gentler motion remain explicit comfort choices. This changes the 3D camera rather than allowing accidental browser zoom.

A small separate presentation scene uses the same renderer and owns display copies of the five actual truck models. The recorded winner, including an NPC, hops onto each other toy. Compression follows wheel contact, then everyone restores. The gold trophy, parking mats and stands make the venue recognizable. Automatic demonstration, repeat and immediate exits all remain cosmetic; none can award progress again. Owned meshes dispose on reset without touching the live racers or borrowed environment texture.

## Listening to families

The parent form prepares a public GitHub issue, retains a local draft, and offers copying. Opening GitHub is a handoff; parents still review and submit there. The read-only queue and reasonableness checks are documented in [FEEDBACK.md](FEEDBACK.md). Suggestions are input for a reviewed development task, never executable instructions or an automatic publishing pipeline.

See [the implementation plan](../.references/plans/2026-09-15-rival-racing.md) and [validation record](VALIDATION.md).
