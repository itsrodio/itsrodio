<div align="center">
  <img src="./dist/profile.svg" alt="rodio terminal profile" width="100%" />
</div>

<br />

<details>
<summary><b>⚡ How this works & How to use this template for your own profile</b></summary>

<br />

This profile card is a dynamically generated **animated SVG** built with TypeScript — zero external runtime dependencies, native GitHub **Light / Dark mode** support (`prefers-color-scheme`), live GitHub stats, daily `Uptime` calculation, and **automatic seasonal/holiday ASCII shaders**.

### ✨ Features
- **6 High-Res (`60×26`) Animated ASCII Shaders with Multi-Color Palettes**:
  - `plasma` — Dynamic 6-stop contour plasma wave flowing across `#2D68C4` → `#6E56CF` *(default)*
  - `snow` — Decorated Christmas tree with twinkling ornaments & natural diagonal snowfall *(Dec 20 – Jan 10)*
  - `heart` — 3D beating heart with specular highlight & pulse rings *(Feb 13 – Feb 15)*
  - `fireworks` — Multi-color rising rockets & gravity-affected firework bursts *(Sep 01 – Sep 03, Birthday)*
  - `matrix` — Authentic 4-stop phosphor digital rain *(Sep 12 – Sep 14, Programmer's Day)*
  - `pumpkin` — Carved Jack-o'-lantern with flickering candlelight & rising embers *(Oct 29 – Nov 01, Halloween)*
- **Dynamic Palette & Event Greetings**: The 6 color swatches at the bottom and the `Event:` row automatically adapt to the active holiday shader.
- **Automated Daily Updates**: A GitHub Actions workflow rebuilds the SVG every day at `00:00 UTC` so your `Uptime` and GitHub stats stay up to date.

---

### 🚀 Quick Start (Fork & Customize)

1. **Fork** or click **Use this template** on [`itsrodio/itsrodio`](https://github.com/itsrodio/itsrodio) (and rename the repo to `<your-github-username>/<your-github-username>`).
2. **Install dependencies**:
   ```bash
   pnpm install
   ```
3. **Preview all shaders locally** with live reload & theme switcher (`http://localhost:3333`):
   ```bash
   pnpm dev
   ```
4. **Customize your profile** in [`src/profile.config.ts`](./src/profile.config.ts):
   - Change `githubUsername`, `terminal` prompt/title, and `info` rows.
   - Set your `birthDate` in the `Uptime` row (`YYYY-MM-DD`).
   - Adjust `shader.mode` (`'auto'` for date schedule, or force `'plasma' | 'pumpkin' | 'snow' | 'heart' | 'matrix' | 'fireworks'`).
   - Customize `shader.schedule` dates (e.g. set the `Birthday` rule to your own birthday!).
5. **Generate the production SVG**:
   ```bash
   pnpm run build
   ```

### 🔒 Counting Private Repositories & Contributions (Optional)
By default, the generator fetches your total contributions (including private contributions if *"Include private contributions on my profile"* is enabled in your GitHub settings) directly from your contribution calendar.

If you also want the **`repos` count** to automatically include your private repositories:
1. Create a classic GitHub Personal Access Token (PAT) with `repo` (or `read:user`) scope.
2. Add it to your repository secrets (**Settings → Secrets and variables → Actions**) as `GH_STATS_TOKEN` (or set `minRepos` in [`src/profile.config.ts`](./src/profile.config.ts)).

---

### ⭐ Credits & Attribution

If you use this template for your own GitHub profile, please:
1. **Give a ⭐ to the original repository**: [`itsrodio/itsrodio`](https://github.com/itsrodio/itsrodio)
2. **Keep the author credit line below** in your `README.md` (do not remove the link to [`@itsrodio`](https://github.com/itsrodio)):

```markdown
<div align="center">
  <sub>Terminal profile template crafted by <a href="https://github.com/itsrodio">@itsrodio</a></sub>
</div>
```

</details>

<div align="center">
  <sub>Terminal profile template crafted by <a href="https://github.com/itsrodio">@itsrodio</a></sub>
</div>
