# 🎮 logMachine (Proof Log) 🎮

A private, retro pixel-art daily accomplishment and habit logger designed with a soft, cozy, **MapleStory-like** aesthetic. 

Keep track of your daily accomplishments ("proofs") and routine habit completions in style, without SaaS clutter or complex task managers.

---

## ✨ Features

- **Cozy Retro Game UI**: Double-bordered panels, parchment cream elements, pulsing pixel stars, and sage-green controls.
- **Silent Anonymous Auth**: Authenticates instantly in the background.
- **Multi-Pillar Habit Carousel**: One-tap scrollable logging ribbon supporting Physical, Mental, Assets, Build, Social, and Skill categories.
- **Custom Parameters Input**: Select quantity quantities (e.g. `20 reps`) or time durations (e.g. `45 mins`) with custom notes.
- **Local Timezone Day Navigation**: Jump back and forth day-by-day to backfill or view past logs cleanly.
- **Dual-Engine Cache & Sync**: Works 100% offline out-of-the-box using local storage caching, and displays a sage-green `[SYNC CACHE]` button when you go online or configure your database keys.
- **Log clipboard copies**: Export formatted text logs of your wins in one click.

---

## 🛠️ Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start Dev Server**:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` to view your accomplishments log locally!

---

## 🚀 Static Exports & Deployment to GitHub Pages

This project is configured with an **automated GitHub Actions deployment workflow**! 

To enable GitHub Pages to build and host your website automatically whenever you push to GitHub:
1. On your GitHub Repository page (`oron01/logMachine`), click on the **Settings** tab at the top.
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment > Source**, select **GitHub Actions** from the dropdown menu.
4. That's it! GitHub will now automatically compile and deploy your live website in the background.

To view your live site, go to:
`https://oron01.github.io/logMachine/`
