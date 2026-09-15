# Help build James's next adventure

James's parent works in AI operations and wanted to spend time creating things with him. By two and a half, James was already creating complete games with his parent's help and AI. Now three, he helps create Monster Skyway through his ideas and playtesting, with his parent guiding development and AI helping build it.

This project is about expanding what people can create and bringing them closer together through making things. We welcome other families, developers, artists, and testers who want to help little drivers enjoy it too.

Start by [playing the game](https://yanivalfasykeelusa.github.io/james-monster-skyway/) and reading [our story](https://yanivalfasykeelusa.github.io/james-monster-skyway/about.html). You can help without writing any code.

## Share an idea or a play observation

Use **Grown-up settings → Share an idea** in the game, or visit [GitHub issues](https://github.com/yanivalfasykeelusa/james-monster-skyway/issues). The in-game form prepares a public issue for a parent to review and submit through GitHub. A GitHub account is needed to submit an issue; none is needed to play.

Useful feedback includes:

- What was fun, surprising, or confusing during play.
- A feature idea and what it would let a little driver do.
- For a problem: the track, race mode, chosen truck, steps to reproduce it, and what you expected to happen.
- For control or display problems: the device, browser, portrait or landscape orientation, and whether you used touch, a keyboard, or a controller.

Real iPad and controller observations are especially useful. Please keep public reports free of children's identifying details and private information. Screenshots of the game can help; family photos are not needed for a bug report.

We review suggestions for suitability, duplicates, feasibility, compatibility, and performance before choosing changes. Ideas are welcome even when they need to wait for a later adventure. See [the feedback review workflow](docs/FEEDBACK.md) for how maintainers collect and assess suggestions with `npm run feedback:queue`.

## Make a change

1. Check existing issues and the [roadmap](docs/ROADMAP.md). For a larger feature or a new dependency, describe the idea in an issue before investing a lot of work.
2. Fork the repository and make a focused change in your fork. The [README](README.md#run-locally) has installation, development, and browser-test instructions.
3. Try the affected interaction yourself. For game behavior, run `npm test` and `npm run build`, then the relevant browser checks. Include meaningful tests for changed rules or a reproduced bug; documentation-only edits need link and wording checks.
4. Open a pull request against this repository's `main`. Explain the problem or idea, what changes for the player, what you checked, and any limitations. Link the related issue and include a game screenshot or short recording when a visual change benefits from one.

AI-assisted contributions are welcome. Read and understand the changes you submit, check them in the game, and describe the validation you actually performed. A generated test result or a claim from an assistant is not a substitute for running the check.

## Keep it welcoming for little drivers

- Keep **Cruise** forgiving and playable without constant steering. **Rival Race** can offer a real contest; its difficulty should remain an explicit choice.
- Preserve large touch targets, clear controls, keyboard and controller access, pause behavior, and the gentler-motion option.
- Keep existing stars, garage unlocks, and saved preferences working when the game changes.
- Keep crushing and celebrations playful: toy vehicles spring back, and finishing remains rewarding.
- Check phone and tablet layouts as well as desktop. Watch rendering cost when adding scenery, effects, or models.
- Use original or appropriately licensed assets and keep their credits. Do not add branded characters or copied game assets.
- Keep the game playable without an account. Discuss changes that add a service, collect data, or introduce a new dependency before implementing them.

The project uses the [MIT license](LICENSE). Contributions must be compatible with it; include any required notices for third-party material. [Design notes](docs/DESIGN.md), [asset guidance](docs/ASSETS.md), and the [validation record](docs/VALIDATION.md) provide more context for existing decisions.
