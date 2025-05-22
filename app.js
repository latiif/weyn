// Load the cities data from cities.json
let cities = [];
let attemptsLeft = getAttemptsLeft(); // Initialize attempts from localStorage

const successRange = 10; // Distance in km for a successful guess

const directionMap = {
  N: '⬆️',
  NE: '↗️',
  E: '➡️',
  SE: '↘️',
  S: '⬇️',
  SW: '↙️',
  W: '⬅️',
  NW: '↖️'
};

// Function to handle copying to clipboard
async function copyToClipboard(text) {
  try {
    // Try using the modern clipboard API
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Clipboard API might not be available or permissions might be denied
    console.error('Failed to copy using Clipboard API: ', err);

    // Fallback to using the older document.execCommand('copy')
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Make the textarea out of viewport
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (!successful) {
        console.error('Failed to copy using document.execCommand("copy")');
        return false;
      }
      return true;
    } catch (err) {
      console.error('Failed to copy using document.execCommand("copy"): ', err);
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

fetch('cities.json')
  .then(response => response.json())
  .then(data => {
    cities = data;

    // Get today's city index from localStorage (for daily change)
    const cityIndex = getTodayCityIndex();
    const dailyCity = cities[cityIndex];

    // Display the daily city name
    document.getElementById('city-name').innerText = 'وين صارت مدينة ';
    const cityNameSpan = document.createElement('strong');
    cityNameSpan.innerText = dailyCity.name_ar;
    document.getElementById('city-name').appendChild(cityNameSpan);
    document.getElementById('city-name').appendChild(document.createTextNode('؟'));

    // Display the initial attempts left
    const today = new Date().toDateString();
    const savedGuesses = JSON.parse(localStorage.getItem('dailyGuesses')) || {};
    updateAttemptsCounter(savedGuesses[today]?.at(-1)?.distance || Infinity);

    // Handle the guess submission
    document.getElementById('submit-guess').addEventListener('click', function () {
      if (attemptsLeft > 0) {
        if (userMarker) {
          const userLat = userMarker.getLatLng().lat;
          const userLon = userMarker.getLatLng().lng;
          const { distance, direction } = haversineWithDirection(userLat, userLon, dailyCity.lat, dailyCity.lon);

          // Get existing guesses or initialize new array
          const today = new Date().toDateString();
          const savedGuesses = JSON.parse(localStorage.getItem('dailyGuesses')) || {};

          if (!savedGuesses[today]) {
            savedGuesses[today] = [];
          }

          // Save this guess
          savedGuesses[today].push({
            distance: Math.round(distance),
            direction: direction,
            lat: userLat,
            lon: userLon,
            timestamp: new Date().getTime()
          });

          // Save to localStorage
          localStorage.setItem('dailyGuesses', JSON.stringify(savedGuesses));

          // Update display
          document.getElementById('guess-result').innerText = savedGuesses[today]
            .map((guess, index) => `${guess.distance}كم${directionMap[guess.direction]}`)
            .join('\n');

          // Decrease attempts and update UI
          attemptsLeft--;
          saveAttemptsLeft(attemptsLeft);
          updateAttemptsCounter(distance);
          loadPreviousGuesses();
        } else {
          document.getElementById('guess-info').innerText = "يرجى وضع تخمينك على الخريطة!";
        }
      }
    });

    // Handle the copy result button
    document.getElementById('copy-result').addEventListener('click', function () {
      const today = new Date().toDateString();
      const savedGuesses = JSON.parse(localStorage.getItem('dailyGuesses')) || {};
      const todayGuesses = savedGuesses[today] || [];

      // Calculate the days since game launch (e.g., from May 22, 2025)
      const launchDate = new Date(2025, 4, 22); // Month is 0-based
      const currentDate = new Date();
      const daysSinceLaunch = Math.floor((currentDate - launchDate) / (1000 * 60 * 60 * 24)) + 1;

      // Get today's city index from localStorage (for daily change)
      const cityIndex = getTodayCityIndex();
      const dailyCity = cities[cityIndex];


      // Create the result text
      const guessResults = todayGuesses
        .map((guess, _) => guess.distance <= successRange ? `📍${dailyCity.name_ar}` : `${guess.distance}${directionMap[guess.direction]}`)
        .join('\n');

      // Add game title, day counter and URL
      const fullResult = `#وين_بسوريا ${daysSinceLaunch} ${todayGuesses.length}\\5 \n${guessResults}\n\nhttps://weyn.latiif.se`;

      // Copy to clipboard
      copyToClipboard(fullResult).then(success => {
        if (success) {
          const originalText = document.getElementById('copy-result').innerText;
          document.getElementById('copy-result').innerText = 'تم النسخ!';
          setTimeout(() => {
            document.getElementById('copy-result').innerText = originalText;
          }, 2000);
        } else {
          alert('فشل النسخ. يرجى المحاولة مرة أخرى.');
        }
      });
    });

    loadPreviousGuesses(); // Add this line
  })
  .catch(error => console.error('Error loading cities.json:', error));

// Helper function to calculate distance and direction
function haversineWithDirection(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const toRad = (deg) => deg * Math.PI / 180;
  const toDeg = (rad) => rad * 180 / Math.PI;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  // Haversine formula for distance
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Formula for initial bearing
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  let bearing = toDeg(Math.atan2(y, x));
  bearing = (bearing + 360) % 360; // Normalize to 0-360 degrees

  // Map bearing to compass direction
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  const direction = directions[index];

  return { distance, direction };
}

// Add this function to show the countdown timer
function showNextCityTimer() {
  let timerDiv = document.getElementById('next-city-timer');
  if (!timerDiv) {
    timerDiv = document.createElement('div');
    timerDiv.id = 'next-city-timer';
    timerDiv.style.cssText = 'margin-top:16px;font-size:18px;color:#007a3d;font-weight:bold;text-align:center;';
    document.querySelector('.container').insertBefore(timerDiv, document.querySelector('.container').firstChild);
  }

  function updateTimer() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0); // Next midnight
    const diff = tomorrow - now;
    if (diff > 0) {
      const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0');
      const minutes = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, '0');
      const seconds = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');
      let parts = [];
      if (parseInt(hours) > 0) parts.push(`${parseInt(hours)} ساعة`);
      if (parseInt(minutes) > 0) parts.push(`${parseInt(minutes)} دقيقة`);
      if (parseInt(seconds) > 0) parts.push(`${parseInt(seconds)} ثانية`);
      timerDiv.innerText = `سيتم الكشف عن المدينة الجديدة بعد:\n${parts.join(' و ')}`;
    } else {
      timerDiv.innerText = 'تم الكشف عن المدينة الجديدة!';
    }
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

// Update the attempts counter on the page
function updateAttemptsCounter(distance) {
  const attemptsCounter = document.getElementById('attempts-counter');
  const submitButton = document.getElementById('submit-guess');
  const shareButton = document.getElementById('copy-result');

  if ((attemptsLeft === 0) || (distance <= successRange)) {
    attemptsCounter.innerText = distance > successRange ? `لقد استنفذت محاولاتك اليوم، حاول مجدداً غداً` : 'أحسنت!';
    submitButton.style.display = 'none';
    shareButton.style.display = 'block';
    showNextCityTimer(); // Show timer when game ends
  } else {
    attemptsCounter.innerText = `المحاولات المتبقية: ${attemptsLeft}`;
    submitButton.style.display = 'block';
    shareButton.style.display = 'none';
    // Hide timer if it exists
    const timerDiv = document.getElementById('next-city-timer');
    if (timerDiv) timerDiv.style.display = 'none';
  }
}

// Get today's city index from localStorage (for daily change)
function getTodayCityIndex() {
  const date = new Date();
  return date.getDate() % cities.length; // Cycle through cities daily
}

// Get attempts left from localStorage or initialize it
function getAttemptsLeft() {
  const today = new Date().toDateString();
  const savedData = JSON.parse(localStorage.getItem('attemptsData'));

  if (savedData && savedData.date === today) {
    return savedData.attemptsLeft;
  } else {
    // Reset attempts for a new day
    saveAttemptsLeft(5);
    return 5;
  }
}

// Save attempts left to localStorage
function saveAttemptsLeft(attempts) {
  const today = new Date().toDateString();
  localStorage.setItem('attemptsData', JSON.stringify({ date: today, attemptsLeft: attempts }));
}

// Initialize the map using Leaflet
const map = L.map('map').setView([35.0, 37.0], 6); // Default view centered on Syria

// Define base layers
const baseLayers = {
  "خريطة مبسطة": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors & CartoDB',
    maxZoom: 19
  }),
  "صورة فضائية": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19
  })
};

// Add the default base layer
baseLayers["خريطة مبسطة"].addTo(map);

// Add layer control to switch between map and satellite
L.control.layers(baseLayers).addTo(map);

// Add a marker to show where the user clicked
let userMarker = null;
// Store all guess markers
let guessMarkers = [];

// Add map click listener
map.on('click', function (e) {
  if (userMarker) {
    userMarker.setLatLng(e.latlng); // Move the existing marker
  } else {
    userMarker = L.marker(e.latlng).addTo(map); // Add a new marker
  }
});

function loadPreviousGuesses() {
  const today = new Date().toDateString();
  const savedGuesses = JSON.parse(localStorage.getItem('dailyGuesses')) || {};

  // Remove old guess markers from map
  guessMarkers.forEach(marker => map.removeLayer(marker));
  guessMarkers = [];

  // Get today's city index from localStorage (for daily change)
  const cityIndex = getTodayCityIndex();
  const dailyCity = cities[cityIndex];

  if (savedGuesses[today]) {
    document.getElementById('guess-result').innerText = savedGuesses[today]
      .map((guess, _) => `${guess.distance} كم ${directionMap[guess.direction]}`)
      .join('\n');
    // Add a marker for each guess, with popup showing distance and direction
    savedGuesses[today].forEach(guess => {
      const marker = L.marker([guess.lat, guess.lon], {
        icon: L.divIcon({
          iconSize: "auto",
          html: guess.distance <= successRange ? "<b>" + `📍${dailyCity.name_ar}` + "</b>" : "<b>" + `${guess.distance}كم${directionMap[guess.direction]}` + "</b>"
        })
      }).addTo(map)
      guessMarkers.push(marker);
    });
    // Move userMarker to the last guess
    const lastGuess = savedGuesses[today].at(-1);
    if (lastGuess) {
      if (userMarker) {
        userMarker.setLatLng(new L.LatLng(lastGuess.lat, lastGuess.lon));
      } else {
        userMarker = L.marker(new L.LatLng(lastGuess.lat, lastGuess.lon)).addTo(map);
      }
    }
  }
}
