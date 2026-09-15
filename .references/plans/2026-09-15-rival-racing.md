# Rival racing, rescue shoulders, and player feedback

James should see closer truck detail, steer through real bends, recover from an off-road adventure with a tow, and race opponents who can win. The actual winner celebrates by squashing toy rivals, who spring back intact. Parents can suggest improvements through a reviewable shared queue.

Standing authorization: the user delegated design decisions, implementation, playtesting, and publication to this existing GitHub project. Continue on main; no worktrees or another design approval gate. Preserve unrelated work. Base:326fb05. Superpowers planning, parallel implementation, independent review and verification are in use; user explicitly reaffirmed /using-superpowers during this release.

## Global constraints

- Fresh and existing saves default to Cruise; preserve its forgiving physics, events and rewards. Rival Race is an explicit choice available on all five courses. Difficulty is chosen explicitly, never secretly raised from stars or wins.
- Four deterministic local rivals use personal pace, boost timing and passing choices. No network or account is needed to race. Real interpolated crossing times determine the winner permanently; equal final distances must never turn an NPC win into a player win.
- Every finisher keeps12 completion stars plus capped bonus. Ceremony replay cannot award again. No star deductions for losing.
- Shared route centerline aligns road, terrain, props, actors and camera. Preserve loop/canyon station timing. Recovery is confined to supported marked shoulders with matching rail openings and an18-unit clear corridor for the largest articulated truck.
- A tow holds player station while rivals continue, freezes on pause, merges safely without passing through another body, and cannot skip gaps/finish/rewards or reactivate held input.
- Close and Wide camera choices retain gameplay touch zoom/selection protections. Parent feedback text must remain editable/selectable.
- Ceremony owns model copies of actual five entrants, uses the recorded winner, makes four contact squashes and restores every toy. Pause/skip/replay/reset/disposal are safe; use existing renderer and borrow environment without disposing it.
- Feedback prepares a public GitHub issue for a parent to review and submit. GitHub sign-in required; no browser secrets, false sent confirmation, automatic execution of issue contents or unsupervised implementation. Local drafts/copy fallback stay separate from shared inbox. Collector is bounded, paginated and read-only.
- Desktop keyboard, touch and browser-standard controllers remain usable. Verify Chromium and WebKit and inspect rendered gameplay. Do not claim physical iPad/controller testing.

## Tasks and current state

- [x] Rules: raceMode/rank/camera save normalization; independent competitors and finish ledger; safe recovery/drift; actual tire clearance regression. Implementer report .tmp/rival-rules-report.md.
- [x] Route/rescue: pure bends/shoulders; aligned terrain/geometry; rail openings, signs and owned winch truck. Report .tmp/rival-route-report.md.
- [x] Ceremony: owned presentation scene, gold trophy, actual winner, contact/restore sequence and lifecycle tests. Report .tmp/rival-ceremony-report.md. Root inspected source and rendered contact frames.
- [x] Integration: mode/camera/rank UI, main/scene/ceremony/tow, feedback form/drafts/collector/template/docs and initial browser tests.
- [x] Independent rules review: no open material findings.49 independent finish cases and2041 mixed-input Cruise frames matched the prior baseline; report .tmp/rival-rules-review.md.
- [ ] Feedback review fixes: preserve new preferences during garage reset; preserve top-level modal opener across feedback/settings. Review .tmp/rival-feedback-review.md. Two regressions exist; resumed agent finish_ui_fixes owns minimal fixes plus controller feature coverage.
- [ ] Final rendering/browser regression:237 unit tests passed before restart; four initial new production browser flows passed. Full Chrome/WebKit suites were interrupted at7/4 cases by environment restart, so complete them against final production build. Camera captures were partly completed with zero player/control intersections, but the aggregate JSON was interrupted; recover evidence from completed logs/images and finish remaining views.
- [ ] Publication: update validation/screenshots, commit and push main, dispatch Pages, verify public assets and key flows.

## Review and verification ledger

- Preserve station-based speed consistently for every actor instead of introducing a partial metric conversion.
- Feedback defaults to parent GitHub sign-in after optional unanswered question; no anonymous hosted backend exists.
- Initial235-unit run found one renderer-free lifecycle fixture missing newly owned TowTruck; fixture updated, ten covering tests passed. Full current237-unit suite passed.
- Actual-model probe found a bent-road Rumbler Robot/Splash tow tire overlap. Competitive-only side margin increased by0.8;20,997 actual tire comparisons passed across all8trucks and both forms.240 full contrasting race runs still permit genuine wins and losses.
- Four production browser cases passed: parent draft/edit/URL; phone preference persistence; actual NPC win and ceremony replay with one award; off-road tow/pause/rivals advancing. Earlier dev HMR invalidated a trophy attempt; stable-build rerun passed.
- Root visual review found results panel covering a front toy; compact grid layout implemented to fit reserved ceremony space, pending final integrated capture.
- Review found two P2 preference/focus defects, accepted for bounded repair with browser regressions. No other material rules or feedback security findings.
- Environment restart interrupted active processes and aggregate scratch writes. Runtime source/tests/docs scanned with no NUL bytes. This plan was restored from its recorded design and progress; interrupted aggregate camera JSON is not evidence of completion.
