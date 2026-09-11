import { COURSES } from './courses.mjs';

// Original small landscape illustrations keep track choices readable before a
// child can read their names. They are UI artwork, not extra network assets.
function artwork(id) {
  const canyon = id === 'canyon', bay = id === 'bay';
  const sky = canyon ? '#ffd8a2' : '#b6e6ed';
  const land = canyon ? '#c97e50' : bay ? '#57b7c8' : '#88ba7a';
  const scenery = canyon
    ? '<path d="M0 125V83L35 76 43 33 90 33 103 83 122 105V180H0ZM230 180V115L253 91 265 47 314 47 327 88 360 78V180Z" fill="#bb6841"/><path d="M36 76H98M265 70H320" stroke="#efb078" stroke-width="9"/><path d="M145 180L156 105 191 92 218 180" fill="#6e4853"/>'
    : bay ? '<path d="M30 180Q80 96 147 158L153 180M244 180Q282 103 337 141L360 180" fill="#f1d7a1"/><path d="M85 151L79 72M293 157L305 68" stroke="#926e50" stroke-width="10"/><path d="M79 73q-32-38-47 4q22-13 47-4q26-30 49 9q-24-15-49-9M305 68q-33-31-44 10q22-17 44-10q25-31 40 6q-20-8-40-6" fill="#387e66"/>'
    : '<path d="M0 143Q69 32 159 136Q268 23 360 132V180H0Z" fill="#76a879"/><path d="M45 155V88M294 157V80" stroke="#886640" stroke-width="13"/><ellipse cx="45" cy="81" rx="29" ry="36" fill="#388f67"/><ellipse cx="294" cy="71" rx="32" ry="40" fill="#2b9473"/>';
  const road = id === 'loop'
    ? '<path d="M-15 170H146C228 169 256 59 195 35C116 2 99 122 161 153L370 163" fill="none" stroke="#ffd776" stroke-width="25"/><path d="M-15 170H146C228 169 256 59 195 35C116 2 99 122 161 153L370 163" fill="none" stroke="#f88238" stroke-width="17"/>'
    : canyon ? '<path d="M-10 178Q63 119 142 116M231 107Q291 91 374 135" fill="none" stroke="#ffe59a" stroke-width="35"/><path d="M-10 178Q63 119 142 116M231 107Q291 91 374 135" fill="none" stroke="#f28b47" stroke-width="26"/><path d="M150 104Q183 24 223 93" fill="none" stroke="#fff3bb" stroke-width="5" stroke-dasharray="8 9"/>'
    : '<path d="M-10 181Q137 191 140 124T219 76Q268 76 367 122" fill="none" stroke="#ffe398" stroke-width="37"/><path d="M-10 181Q137 191 140 124T219 76Q268 76 367 122" fill="none" stroke="#f78e40" stroke-width="27"/>';
  const grandTour=id==='skyway'?'<path d="M106 120V60H186V102" fill="none" stroke="#fff3bd" stroke-width="10"/><path d="M106 60H186" stroke="#366679" stroke-width="13"/><path d="M108 59h12m12 0h12m12 0h12m12 0h6" stroke="#fff6d1" stroke-width="12"/><path d="M203 106C241 111 262 78 244 57C215 25 197 87 223 101" fill="none" stroke="#ffc96e" stroke-width="13"/><path d="M203 106C241 111 262 78 244 57C215 25 197 87 223 101" fill="none" stroke="#ed803b" stroke-width="7"/>':'';
  return `<svg viewBox="0 0 360 200" aria-hidden="true"><rect width="360" height="200" fill="${sky}"/><circle cx="289" cy="32" r="20" fill="#fff0b5"/><path d="M0 116Q88 78 169 123T360 98V200H0Z" fill="${land}"/>${scenery}${road}${grandTour}</svg>`;
}

export function renderCourses(container, selectedId, onChoose) {
  const descriptions = { skyway: 'The whole big adventure', woods: 'Bears, big wheels & smashing', loop: 'Rocket runway & the giant loop', bay: 'Waterfalls, puddles & gators', canyon: 'Fly across four giant gaps!' };
  container.replaceChildren(...COURSES.map(course => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'course-card'; button.dataset.course = course.id;
    button.setAttribute('aria-label', `Race ${course.name}`);
    button.setAttribute('aria-pressed', String(course.id === selectedId));
    button.innerHTML = `${artwork(course.id)}<span class="course-card-copy"><strong>${course.name}</strong><span>${descriptions[course.id]}</span></span><span class="course-card-go" aria-hidden="true">▶</span>`;
    button.addEventListener('click', () => onChoose(course.id));
    return button;
  }));
}
