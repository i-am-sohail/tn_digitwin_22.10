/**
 * Main Client Application Engine & UI Controller
 * Orchestrates rendering, map integration, Chart.js instances, tab switching, and live sync.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Global Application State
  const state = {
    selectedDistrictCode: 'COI', // Default: Coimbatore
    districtDataCache: {},
    leafletMap: null,
    mapMarker: null,
    chartInstance: null,
    isSyncing: false
  };

  // UI DOM Elements
  const districtSelect = document.getElementById('district-select');
  const compareSelectA = document.getElementById('compare-dist-a');
  const compareSelectB = document.getElementById('compare-dist-b');
  const updateDataBtn = document.getElementById('update-data-btn');
  const syncProgressContainer = document.getElementById('sync-progress-container');
  const syncProgressBar = document.getElementById('sync-progress-bar');
  
  // Modal Elements
  const keyModal = document.getElementById('key-modal');
  const openKeyModalBtn = document.getElementById('open-key-modal-btn');
  const closeKeyModalBtn = document.getElementById('close-key-modal-btn');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const clearKeyBtn = document.getElementById('clear-key-btn');
  const geminiKeyInput = document.getElementById('gemini-key-input');
  const geminiStatusLabel = document.getElementById('gemini-status-label');

  // AI Feature Elements
  const runAiCompareBtn = document.getElementById('run-ai-compare-btn');
  const aiCompareOutputContainer = document.getElementById('ai-compare-output-container');
  const aiCompareText = document.getElementById('ai-compare-text');

  const qaInput = document.getElementById('qa-input');
  const askGeminiBtn = document.getElementById('ask-gemini-btn');
  const qaResponseBox = document.getElementById('qa-response-box');
  const qaResponseText = document.getElementById('qa-response-text');

  // ==================== INITIALIZATION ====================

  function init() {
    startClock();
    populateDistrictSelectors();
    initLeafletMap();
    checkSavedGeminiKey();
    setupEventListeners();
    
    // Initial Data Load for default district
    loadDistrictDashboard(state.selectedDistrictCode);
  }

  function startClock() {
    const clockEl = document.getElementById('live-clock');
    const dateEl = document.getElementById('live-date');

    function update() {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      dateEl.textContent = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
    update();
    setInterval(update, 1000);
  }

  function populateDistrictSelectors() {
    const districts = APIService.getBaselineDistricts();
    const sorted = Object.keys(districts).map(code => ({
      code,
      name: districts[code].name
    })).sort((a, b) => a.name.localeCompare(b.name));

    let optionsHtml = '';
    sorted.forEach(d => {
      optionsHtml += `<option value="${d.code}">${d.name}</option>`;
    });

    districtSelect.innerHTML = optionsHtml;
    compareSelectA.innerHTML = optionsHtml;
    compareSelectB.innerHTML = optionsHtml;

    districtSelect.value = state.selectedDistrictCode;
    compareSelectA.value = 'COI'; // Coimbatore
    compareSelectB.value = 'MAD'; // Madurai
  }

  function checkSavedGeminiKey() {
    const savedKey = GeminiService.getApiKey();
    if (savedKey) {
      geminiStatusLabel.textContent = "Gemini: Active";
      geminiKeyInput.value = savedKey;
    } else {
      geminiStatusLabel.textContent = "Gemini API";
    }
  }

  // ==================== DASHBOARD RENDER LOGIC ====================

  async function loadDistrictDashboard(code) {
    state.selectedDistrictCode = code;

    try {
      // Fetch combined live + govt baseline data
      const data = await APIService.fetchDistrictData(code);
      state.districtDataCache[code] = data;

      // Update UI Banner
      document.getElementById('weather-temp').textContent = `${data.weather.temp} °C`;
      document.getElementById('weather-condition').textContent = data.weather.condition;
      document.getElementById('weather-humidity').textContent = `${data.weather.humidity} %`;
      document.getElementById('weather-wind').textContent = `${data.weather.wind_speed} km/h`;
      document.getElementById('weather-rain').textContent = `${data.weather.rainfall_mm} mm`;

      const weatherIconEl = document.getElementById('weather-icon');
      weatherIconEl.className = `fa-solid ${data.weather.icon}`;

      // Update AQI
      document.getElementById('aqi-value').textContent = data.aqi.value;
      const aqiStatusEl = document.getElementById('aqi-status');
      aqiStatusEl.textContent = data.aqi.status;
      aqiStatusEl.className = `text-xs px-2 py-0.5 rounded-full font-bold ${data.aqi.color.bg} ${data.aqi.color.text}`;
      document.getElementById('aqi-pm25').textContent = data.aqi.pm25;
      document.getElementById('aqi-pm10').textContent = data.aqi.pm10;

      // Update Data Source Badges
      document.getElementById('data-source-weather').textContent = data.weather.isLive ? "Weather: OpenWeather (Live)" : "Weather: Baseline Feed";
      document.getElementById('data-source-aqi').textContent = data.aqi.isLive ? "AQI: WAQI Station (Live)" : "AQI: Baseline Feed";

      // Demographics & Depts
      document.getElementById('dist-population').textContent = data.population.toLocaleString('en-IN');
      document.getElementById('dist-area').textContent = `${data.area_km2.toLocaleString('en-IN')} km²`;

      // Agriculture
      document.getElementById('agri-yield').textContent = `${data.agriculture.yield_t_ha} tonnes/ha`;
      document.getElementById('agri-soil').textContent = `${data.agriculture.soil_health_index} / 100`;
      document.getElementById('agri-irrigation').textContent = `${data.agriculture.irrigation_pct} %`;

      const cropsPillsEl = document.getElementById('agri-crops-pills');
      cropsPillsEl.innerHTML = data.agriculture.crops.map(c => `<span class="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-medium">${c}</span>`).join('');

      // Health & Edu
      document.getElementById('edu-literacy').textContent = `${data.health_education.literacy_pct} %`;
      document.getElementById('health-hospitals').textContent = data.health_education.hospitals;
      document.getElementById('health-phc').textContent = data.health_education.phc_count;
      document.getElementById('edu-school-density').textContent = data.health_education.school_density_10k;

      // Infra
      document.getElementById('infra-roads').textContent = `${data.infrastructure.road_network_km} km`;
      document.getElementById('infra-expenditure').textContent = `₹ ${data.infrastructure.expenditure_cr} Cr`;

      const land = data.infrastructure.land_use;
      document.getElementById('land-urban').style.width = `${land.urban}%`;
      document.getElementById('land-agri').style.width = `${land.agri}%`;
      document.getElementById('land-forest').style.width = `${land.forest}%`;
      document.getElementById('land-urban-val').textContent = `${land.urban}%`;
      document.getElementById('land-agri-val').textContent = `${land.agri}%`;
      document.getElementById('land-forest-val').textContent = `${land.forest}%`;

      // Update Geospatial Map
      updateLeafletMap(data);

      // Update Comparative Chart
      updateDistrictChart(data);

      // Also update side-by-side comparator view
      renderComparatorCards();

    } catch (error) {
      showToast(`Failed loading district data: ${error.message}`, 'error');
    }
  }

  // ==================== LEAFLET MAP ENGINE ====================

  function initLeafletMap() {
    // Centered on Tamil Nadu
    state.leafletMap = L.map('district-map', {
      zoomControl: true,
      attributionControl: false
    }).setView([11.1271, 78.6569], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      subdomains: 'abcd'
    }).addTo(state.leafletMap);
  }

  function updateLeafletMap(data) {
    if (!state.leafletMap) return;

    state.leafletMap.setView([data.lat, data.lon], 9, { animate: true });

    if (state.mapMarker) {
      state.leafletMap.removeLayer(state.mapMarker);
    }

    state.mapMarker = L.marker([data.lat, data.lon]).addTo(state.leafletMap);
    state.mapMarker.bindPopup(`
      <div>
        <h4>${data.name} District</h4>
        <p class="text-xs">Headquarters: <b>${data.headquarters}</b></p>
        <p class="text-xs">Temp: <b>${data.weather.temp}°C</b> | AQI: <b>${data.aqi.value}</b></p>
      </div>
    `).openPopup();

    document.getElementById('map-coords').textContent = `Lat: ${data.lat} | Lon: ${data.lon}`;
  }

  // ==================== CHART.JS ANALYTICS ENGINE ====================

  function updateDistrictChart(data) {
    const ctx = document.getElementById('district-chart').getContext('2d');

    // TN State Averages Baseline
    const stateAvg = {
      literacy: 80.1,
      soilHealth: 75.0,
      irrigation: 71.2,
      aqi: 68.0
    };

    if (state.chartInstance) {
      state.chartInstance.destroy();
    }

    state.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Literacy %', 'Soil Health', 'Irrigation %', 'AQI Index'],
        datasets: [
          {
            label: data.name,
            data: [
              data.literacy_pct,
              data.agriculture.soil_health_index,
              data.agriculture.irrigation_pct,
              data.aqi.value
            ],
            backgroundColor: 'rgba(245, 158, 11, 0.8)',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'TN State Average',
            data: [
              stateAvg.literacy,
              stateAvg.soilHealth,
              stateAvg.irrigation,
              stateAvg.aqi
            ],
            backgroundColor: 'rgba(56, 189, 248, 0.4)',
            borderColor: '#38bdf8',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { size: 11 } }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 } },
            grid: { color: 'rgba(51, 65, 85, 0.3)' }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#94a3b8', font: { size: 10 } },
            grid: { color: 'rgba(51, 65, 85, 0.3)' }
          }
        }
      }
    });
  }

  // ==================== COMPARATOR LOGIC ====================

  async function renderComparatorCards() {
    const codeA = compareSelectA.value;
    const codeB = compareSelectB.value;

    const dataA = state.districtDataCache[codeA] || await APIService.fetchDistrictData(codeA);
    const dataB = state.districtDataCache[codeB] || await APIService.fetchDistrictData(codeB);

    state.districtDataCache[codeA] = dataA;
    state.districtDataCache[codeB] = dataB;

    document.getElementById('compare-card-a').innerHTML = createDistrictCompareCardHtml(dataA, 'amber');
    document.getElementById('compare-card-b').innerHTML = createDistrictCompareCardHtml(dataB, 'sky');
  }

  function createDistrictCompareCardHtml(data, colorTheme) {
    const textTheme = colorTheme === 'amber' ? 'text-amber-400' : 'text-sky-400';
    return `
      <div class="border-b border-slate-700 pb-3">
        <h3 class="text-lg font-bold ${textTheme}">${data.name} District</h3>
        <p class="text-xs text-slate-400">Headquarters: ${data.headquarters} | Density: ${data.density}/km²</p>
      </div>
      <div class="space-y-2 text-xs">
        <div class="flex justify-between py-1 border-b border-slate-700/50">
          <span class="text-slate-400">Temperature & AQI:</span>
          <span class="font-bold text-slate-200">${data.weather.temp}°C | AQI ${data.aqi.value} (${data.aqi.status})</span>
        </div>
        <div class="flex justify-between py-1 border-b border-slate-700/50">
          <span class="text-slate-400">Literacy Rate:</span>
          <span class="font-bold text-slate-200">${data.literacy_pct}%</span>
        </div>
        <div class="flex justify-between py-1 border-b border-slate-700/50">
          <span class="text-slate-400">Crop Yield Estimate:</span>
          <span class="font-bold text-slate-200">${data.agriculture.yield_t_ha} tonnes/ha</span>
        </div>
        <div class="flex justify-between py-1 border-b border-slate-700/50">
          <span class="text-slate-400">Irrigation Coverage:</span>
          <span class="font-bold text-slate-200">${data.agriculture.irrigation_pct}%</span>
        </div>
        <div class="flex justify-between py-1 border-b border-slate-700/50">
          <span class="text-slate-400">Hospitals / PHCs:</span>
          <span class="font-bold text-slate-200">${data.health_education.hospitals} / ${data.health_education.phc_count}</span>
        </div>
        <div class="flex justify-between py-1">
          <span class="text-slate-400">Municipal Expenditure:</span>
          <span class="font-bold ${textTheme}">₹ ${data.infrastructure.expenditure_cr} Cr</span>
        </div>
      </div>
    `;
  }

  // ==================== LIVE DATA SYNC ENGINE ====================

  async function triggerLiveDataUpdate() {
    if (state.isSyncing) return;
    state.isSyncing = true;

    const syncIcon = updateDataBtn.querySelector('.id-sync-icon');
    syncIcon.classList.add('spinning');
    updateDataBtn.disabled = true;

    syncProgressContainer.classList.remove('hidden');
    syncProgressBar.style.width = '0%';

    showToast("Initiating live feed update across 38 districts...", "info");

    try {
      const updatedCache = await APIService.syncAllDistricts((progress) => {
        syncProgressBar.style.width = `${progress}%`;
      });

      state.districtDataCache = updatedCache;

      // Re-render current dashboard
      await loadDistrictDashboard(state.selectedDistrictCode);

      showToast("Live District Data & AQI feeds successfully updated!", "success");
    } catch (err) {
      showToast(`Data update encountered an issue: ${err.message}`, "error");
    } finally {
      setTimeout(() => {
        syncProgressContainer.classList.add('hidden');
        syncProgressBar.style.width = '0%';
      }, 800);

      syncIcon.classList.remove('spinning');
      updateDataBtn.disabled = false;
      state.isSyncing = false;
    }
  }

  // ==================== EVENT LISTENERS & HANDLERS ====================

  function setupEventListeners() {
    // Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active-tab'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

        tabBtn.classList.add('active-tab');
        const targetId = tabBtn.getAttribute('data-tab');
        document.getElementById(targetId).classList.remove('hidden');

        // Leaflet map refresh when returning to main dashboard
        if (targetId === 'dashboard-tab' && state.leafletMap) {
          setTimeout(() => state.leafletMap.invalidateSize(), 100);
        }
      });
    });

    // District Selector Dropdown
    districtSelect.addEventListener('change', (e) => {
      loadDistrictDashboard(e.target.value);
    });

    // Comparator Dropdowns
    compareSelectA.addEventListener('change', renderComparatorCards);
    compareSelectB.addEventListener('change', renderComparatorCards);

    // Live Sync Trigger
    updateDataBtn.addEventListener('click', triggerLiveDataUpdate);

    // Modal Events
    openKeyModalBtn.addEventListener('click', () => keyModal.classList.remove('hidden'));
    closeKeyModalBtn.addEventListener('click', () => keyModal.classList.add('hidden'));

    saveKeyBtn.addEventListener('click', () => {
      const val = geminiKeyInput.value;
      if (val) {
        GeminiService.setApiKey(val);
        checkSavedGeminiKey();
        keyModal.classList.add('hidden');
        showToast("Gemini API key saved successfully!", "success");
      } else {
        showToast("Please enter a valid API key.", "error");
      }
    });

    clearKeyBtn.addEventListener('click', () => {
      GeminiService.setApiKey('');
      geminiKeyInput.value = '';
      checkSavedGeminiKey();
      showToast("Gemini API key cleared.", "info");
    });

    // Gemini Comparator Analysis Button
    runAiCompareBtn.addEventListener('click', async () => {
      const dataA = state.districtDataCache[compareSelectA.value];
      const dataB = state.districtDataCache[compareSelectB.value];

      if (!dataA || !dataB) {
        showToast("Please select two valid districts first.", "error");
        return;
      }

      aiCompareOutputContainer.classList.remove('hidden');
      aiCompareText.textContent = "Synthesizing AI Comparative Analysis with Gemini 2.5 Flash...";

      try {
        const report = await GeminiService.generateComparisonReport(dataA, dataB);
        aiCompareText.textContent = report;
      } catch (err) {
        aiCompareText.textContent = `Error generating report: ${err.message}`;
      }
    });

    // Gemini Smart Q&A Handlers
    askGeminiBtn.addEventListener('click', handleSmartQA);
    qaInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSmartQA();
    });

    document.querySelectorAll('.preset-query-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        qaInput.value = btn.textContent.trim();
        handleSmartQA();
      });
    });
  }

  async function handleSmartQA() {
    const query = qaInput.value.trim();
    if (!query) return;

    qaResponseBox.classList.remove('hidden');
    qaResponseText.textContent = "Querying Gemini AI Engine...";

    try {
      const currentData = state.districtDataCache[state.selectedDistrictCode];
      const response = await GeminiService.askSmartQA(query, currentData, state.districtDataCache);
      qaResponseText.textContent = response;
    } catch (err) {
      qaResponseText.textContent = `Error: ${err.message}`;
    }
  }

  // Global Google OAuth Callback Handler
  window.handleGoogleOAuthResponse = function (response) {
    try {
      // Decode JWT Payload
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      
      const payload = JSON.parse(jsonPayload);
      GeminiService.setUser({
        name: payload.name,
        email: payload.email,
        picture: payload.picture
      });

      document.getElementById('user-display-name').textContent = payload.given_name || payload.name;
      showToast(`Welcome, ${payload.name}! Authenticated via Google.`, "success");
    } catch (err) {
      showToast("Google Authentication succeeded.", "info");
    }
  };

  // Toast Notification Helper
  function showToast(message, type = "info") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const colorMap = {
      success: "bg-emerald-800 border-emerald-600 text-emerald-100",
      error: "bg-rose-800 border-rose-600 text-rose-100",
      info: "bg-slate-800 border-slate-600 text-slate-100"
    };

    const iconMap = {
      success: "fa-circle-check text-emerald-400",
      error: "fa-triangle-exclamation text-rose-400",
      info: "fa-circle-info text-sky-400"
    };

    toast.className = `pointer-events-auto border px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center space-x-3 toast-slide-in ${colorMap[type] || colorMap.info}`;
    toast.innerHTML = `
      <i class="fa-solid ${iconMap[type] || iconMap.info} text-base"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Run initialization
  init();
});