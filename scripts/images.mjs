// Rebuilds public/img from the app repo's store art and the owner's photo folder.
//   npm i --no-save sharp && node scripts/images.mjs [path/to/south-island] [path/to/Pictures/southisland]
// Only images listed in docs/photo-sources.md may go on the site.
import sharp from "sharp";
import { copyFile } from "node:fs/promises";
import { join } from "node:path";

const app = process.argv[2] ?? "../south-island";
const pics = process.argv[3] ?? join(process.env.USERPROFILE ?? "", "Pictures/southisland");
const out = "public/img";

// [source in the photo folder, output name]. Open licences only; see docs/photo-sources.md.
const photos = [
  ["wanaka/resized/full/that-wanaka-tree.webp", "photo-wanaka-tree"],
  ["twizel/resized/full/peters-lookout.webp", "photo-pukaki"],
  ["oamaru/resized/full/moeraki-boulders.webp", "photo-moeraki"],
  ["twizel/resized/full/clay-cliffs-omarama.webp", "photo-clay-cliffs"],
  ["arrowtown/resized/full/crown-range-summit-lookout.webp", "photo-crown-range"],
  ["queenstown/resized/full/shotover-jet.webp", "photo-shotover-jet"],
  ["kaikoura/resized/full/cathedral-cliffs-gore-bay.webp", "photo-gore-bay"],
  ["wanaka/resized/full/diamond-lake-rocky-mountain-track.webp", "photo-diamond-lake"],
  ["carcamp-pexels-30131065.jpg", "photo-campervan"],
];
for (const [src, name] of photos) {
  for (const w of [800, 1200]) {
    await sharp(join(pics, src)).resize({ width: w, withoutEnlargement: true }).webp({ quality: 74 }).toFile(join(out, `${name}-${w}.webp`));
  }
}

// Raw app screens (no store caption or frame), for the CSS phone frames.
for (const s of ["map", "explore", "place", "suggested-trips", "trip-days", "guide"]) {
  for (const w of [300, 600]) {
    await sharp(join(app, `store/screenshots/source/${s}-capture-1320x2868.png`)).resize({ width: w }).webp({ quality: 80 }).toFile(join(out, `screen-${s}-${w}.webp`));
  }
}

const shots = ["01-poster", "02-trip-days", "03-trip-hours", "04-suggested-trips", "05-map", "06-explore", "07-place", "08-guide"];
const ipad = ["02-trip", "04-map", "05-explore"];

const jobs = [
  // The hero: the header art's CC0 source photo, without the sign (its text repeated the headline).
  ...[800, 1600, 2400].map((w) => ["store/header/source/road-towards-mount-cook-5184x2916.jpg", `hero-road-${w}.webp`, w]),
  ...shots.flatMap((s) => [360, 720].map((w) => [`store/screenshots/kiwi-guide-${s}.png`, `shot-${s}-${w}.webp`, w])),
  ...ipad.flatMap((s) => [600, 1200].map((w) => [`store/screenshots/ipad/kiwi-guide-ipad-${s}.png`, `ipad-${s}-${w}.webp`, w])),
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
