// Rebuilds public/img from the app repo's store art.
//   npm i --no-save sharp && node scripts/images.mjs [path/to/south-island]
// Only images listed in docs/photo-sources.md may go on the site.
import sharp from "sharp";
import { copyFile } from "node:fs/promises";
import { join } from "node:path";

const app = process.argv[2] ?? "../south-island";
const out = "public/img";

const shots = ["01-poster", "02-map", "03-explore", "04-place", "05-suggested-trips", "06-trip-days", "07-guide"];

const jobs = [
  // Phones get the 3:2 crop, wider screens the 21:9 one.
  ...[800, 1600].map((w) => ["store/header/kiwi-guide-search-3x2-3840x2560.png", `hero-3x2-${w}.webp`, w]),
  ...[1600, 2560].map((w) => ["store/header/kiwi-guide-header-21x9-3840x1646.png", `hero-21x9-${w}.webp`, w]),
  ...shots.flatMap((s) => [360, 720].map((w) => [`store/screenshots/kiwi-guide-${s}.png`, `shot-${s}-${w}.webp`, w])),
];

for (const [src, dest, width] of jobs) {
  await sharp(join(app, src)).resize({ width }).webp({ quality: 78 }).toFile(join(out, dest));
}

// Share preview: 1200x630 from the 16:9 art, centred so the kiwi sign stays in.
await sharp(join(app, "store/header/kiwi-guide-universal-16x9-5244x2950.png"))
  .resize(1200, 630, { fit: "cover" })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(join(out, "og.jpg"));

await sharp(join(app, "assets/icon.png")).resize(180).png().toFile(join(out, "apple-touch-icon.png"));
await copyFile(join(app, "assets/icon.svg"), join(out, "favicon.svg"));
await copyFile(join(app, "assets/icon-mark.svg"), join(out, "mark.svg"));
