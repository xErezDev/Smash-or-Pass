// Verificación de edad
const ageVerification = document.getElementById('age-verification');
const confirmAgeButton = document.getElementById('confirm-age');
confirmAgeButton.addEventListener('click', () => {
  ageVerification.classList.add('hidden');
  initCards();
});

// Tema oscuro/claro
const toggle = document.getElementById('theme-toggle');
function updateIcon() {
  toggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
}
toggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  updateIcon();
});
if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.body.classList.add('dark');
}
updateIcon();

// Lógica de tarjetas y modo ronda
const BUFFER = 2;
const ROUND_LIMIT = 100;
const SUMMARY_PAGE_SIZE = 20;
const container = document.querySelector('.card-container');
const leftOverlay = document.querySelector('.side-indicator.left');
const rightOverlay = document.querySelector('.side-indicator.right');
const upOverlay = document.querySelector('.side-indicator.up');
const downOverlay = document.querySelector('.side-indicator.down');
const searchBar = document.getElementById('search-bar');
const roundModeToggle = document.getElementById('round-mode-toggle');
const roundSummary = document.getElementById('round-summary');
const smashImages = document.getElementById('smash-images');
const passImages = document.getElementById('pass-images');
const restartRoundButton = document.getElementById('restart-round');
const roscoCanvas = document.getElementById('rosco-canvas');
const roscoPercentage = document.getElementById('rosco-percentage');
const config = { swipeThreshold: 100, verticalThreshold: 100 };
let currentTags = '';
let isRoundMode = false;
let roundCount = 0;
let smashList = [];
let passList = [];

async function getRandomUrl() {
  try {
    const tagsQuery = currentTags ? `&tags=${encodeURIComponent(currentTags)}` : '';
    const response = await fetch(`https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=100${tagsQuery}`);
    const data = await response.json();
    if (!data || data.length === 0) throw new Error('No se encontraron imágenes');
    const randomPost = data[Math.floor(Math.random() * data.length)];
    return randomPost.file_url;
  } catch (error) {
    console.error('Error al obtener imagen:', error);
    return '';
  }
}

async function createCard() {
  const imageUrl = await getRandomUrl();
  const card = document.createElement('div');
  card.className = 'card';
  card.style.backgroundImage = `url('${imageUrl}')`;
  container.appendChild(card);
  attachSwipeTo(card);
  while (container.children.length > BUFFER) {
    container.firstChild.remove();
  }
}

function initCards() {
  container.innerHTML = '';
  for (let i = 0; i < BUFFER; i++) createCard();
}

function clearCards() {
  container.innerHTML = '';
  initCards();
}

// Búsqueda
searchBar.addEventListener('input', (e) => {
  currentTags = e.target.value.trim();
  clearCards();
  if (isRoundMode) {
    resetRound();
  }
});

// Modo ronda
roundModeToggle.addEventListener('click', () => {
  isRoundMode = !isRoundMode;
  roundModeToggle.classList.toggle('active');
  roundModeToggle.textContent = isRoundMode ? `Modo Ronda (${roundCount}/${ROUND_LIMIT})` : 'Activar Modo Ronda (100 imágenes)';
  if (isRoundMode) {
    roundCount = 0;
    smashList = [];
    passList = [];
    clearCards();
  } else {
    roundSummary.style.display = 'none';
    clearCards();
  }
});

// Rosco
function animateRosco(percentage) {
  const ctx = roscoCanvas.getContext('2d');
  const centerX = roscoCanvas.width / 2;
  const centerY = roscoCanvas.height / 2;
  const radius = roscoCanvas.width / 2 - 10;
  const innerRadius = radius - 15;
  let currentAngle = -Math.PI / 2;
  const targetAngle = -Math.PI / 2 + (percentage / 100) * 2 * Math.PI;
  const animationDuration = 1000;
  const startTime = performance.now();

  function drawFrame() {
    const currentTime = performance.now();
    const progress = Math.min((currentTime - startTime) / animationDuration, 1);
    const animatedAngle = currentAngle + (targetAngle - currentAngle) * progress;

    ctx.clearRect(0, 0, roscoCanvas.width, roscoCanvas.height);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = radius - innerRadius;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, animatedAngle);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--rosco-color');
    ctx.lineWidth = radius - innerRadius;
    ctx.stroke();

    const currentPercentage = Math.round(progress * percentage);
    roscoPercentage.textContent = `${currentPercentage}%`;

    if (progress < 1) {
      requestAnimationFrame(drawFrame);
    }
  }

  requestAnimationFrame(drawFrame);
}

function showRoundSummary() {
  container.style.display = 'none';
  searchBar.style.display = 'none';
  roundModeToggle.style.display = 'none';
  roundSummary.style.display = 'flex';

  const smashPercentage = Math.round((smashList.length / ROUND_LIMIT) * 100);
  animateRosco(smashPercentage);

  smashImages.innerHTML = '';
  passImages.innerHTML = '';

  const loadImages = (list, container, max) => {
    list.slice(0, max).forEach(url => {
      const img = document.createElement('img');
      img.src = url;
      img.loading = 'lazy';
      container.appendChild(img);
    });
  };

  loadImages(smashList, smashImages, SUMMARY_PAGE_SIZE);
  loadImages(passList, passImages, SUMMARY_PAGE_SIZE);
}

restartRoundButton.addEventListener('click', () => {
  isRoundMode = false;
  roundModeToggle.classList.remove('active');
  roundModeToggle.textContent = 'Activar Modo Ronda (100 imágenes)';
  roundSummary.style.display = 'none';
  container.style.display = 'block';
  searchBar.style.display = 'block';
  roundModeToggle.style.display = 'block';
  roundCount = 0;
  smashList = [];
  passList = [];
  roscoCanvas.getContext('2d').clearRect(0, 0, roscoCanvas.width, roscoCanvas.height);
  clearCards();
});

function attachSwipeTo(card) {
  let isDragging = false, startX = 0, startY = 0, dx = 0, dy = 0;
  const onDragStart = e => {
    e.preventDefault();
    isDragging = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    card.style.transition = 'none';
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', onDragEnd);
  };
  const onDrag = e => {
    if (!isDragging) return;
    e.preventDefault();
    const currentX = e.touches ? e.touches[0].clientX : e.clientX;
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    dx = currentX - startX;
    dy = currentY - startY;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx/20}deg)`;

    const horizontalPct = Math.min(Math.abs(dx) / container.offsetWidth, 1);
    const verticalPct = Math.min(Math.abs(dy) / container.offsetHeight, 1);

    if (dx > 0) {
      rightOverlay.style.width = `${horizontalPct * container.offsetWidth}px`;
      rightOverlay.querySelector('span').style.opacity = horizontalPct;
      leftOverlay.style.width = '0';
    } else if (dx < 0) {
      leftOverlay.style.width = `${horizontalPct * container.offsetWidth}px`;
      leftOverlay.querySelector('span').style.opacity = horizontalPct;
      rightOverlay.style.width = '0';
    }

    if (dy < 0) {
      upOverlay.style.height = `${verticalPct * container.offsetHeight}px`;
      upOverlay.querySelector('span').style.opacity = verticalPct;
      downOverlay.style.height = '0';
    } else if (dy > 0) {
      downOverlay.style.height = `${verticalPct * container.offsetHeight}px`;
      downOverlay.querySelector('span').style.opacity = verticalPct;
      upOverlay.style.height = '0';
    }
  };
  const onDragEnd = () => {
    isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', onDragEnd);
    card.style.transition = 'transform 0.3s ease-out';

    const imageUrl = card.style.backgroundImage.slice(5, -2);

    if (Math.abs(dy) > config.verticalThreshold) {
      if (dy < -config.verticalThreshold) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        card.style.transform = '';
      } else if (dy > config.verticalThreshold) {
        downloadImage(imageUrl);
        card.style.transform = '';
      }
    } else if (dx > config.swipeThreshold) {
      card.classList.add('swipe-right');
      if (isRoundMode) {
        smashList.push(imageUrl);
        roundCount++;
        roundModeToggle.textContent = `Modo Ronda (${roundCount}/${ROUND_LIMIT})`;
        if (roundCount >= ROUND_LIMIT) {
          showRoundSummary();
        }
      }
      popCard(card);
    } else if (dx < -config.swipeThreshold) {
      card.classList.add('swipe-left');
      if (isRoundMode) {
        passList.push(imageUrl);
        roundCount++;
        roundModeToggle.textContent = `Modo Ronda (${roundCount}/${ROUND_LIMIT})`;
        if (roundCount >= ROUND_LIMIT) {
          showRoundSummary();
        }
      }
      popCard(card);
    } else {
      card.style.transform = '';
    }

    leftOverlay.style.width = rightOverlay.style.width = '0';
    upOverlay.style.height = downOverlay.style.height = '0';
    leftOverlay.querySelector('span').style.opacity = rightOverlay.querySelector('span').style.opacity = 0;
    upOverlay.querySelector('span').style.opacity = downOverlay.querySelector('span').style.opacity = 0;
  };
  card.addEventListener('mousedown', onDragStart);
  card.addEventListener('touchstart', onDragStart, { passive: false });
}

function popCard(card) {
  setTimeout(() => {
    card.remove();
    if (!isRoundMode || roundCount < ROUND_LIMIT) {
      createCard();
    }
  }, 300);
}

async function downloadImage(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'image.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error('Error al descargar la imagen:', error);
    alert('No se pudo descargar la imagen. Intenta de nuevo.');
  }
}

function resetRound() {
  roundCount = 0;
  smashList = [];
  passList = [];
  roundModeToggle.textContent = `Modo Ronda (${roundCount}/${ROUND_LIMIT})`;
  roundSummary.style.display = 'none';
  container.style.display = 'block';
  searchBar.style.display = 'block';
  roundModeToggle.style.display = 'block';
}
