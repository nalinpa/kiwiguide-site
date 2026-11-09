// Suggested trips filter. Without JS the buttons stay hidden and every card shows.
const bar = document.querySelector('.trip-filter');
const cards = document.querySelectorAll('.trip-cards li');

// town "" means all trips; a card's data-start can list more than one town
function pick(town) {
  for (const b of bar.querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.start === town);
  for (const c of cards) c.hidden = town !== '' && !c.dataset.start.split(' ').includes(town);
}

bar.hidden = false;
bar.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) pick(b.dataset.start);
});
// Hero pills are plain #trips links that also pick their town
for (const a of document.querySelectorAll('.pills a')) a.addEventListener('click', () => pick(a.dataset.start));
