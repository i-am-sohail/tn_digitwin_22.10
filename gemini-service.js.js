/**
 * Gemini AI & Google OAuth Integration Service
 * Handles user authentication via GIS SDK and Gemini REST API generation requests.
 */

const GeminiService = (function () {
  let geminiApiKey = localStorage.getItem('tn_digital_twin_gemini_key') || '';
  let currentUser = JSON.parse(localStorage.getItem('tn_digital_twin_user') || 'null');

  return {
    getApiKey: function () {
      return geminiApiKey;
    },

    setApiKey: function (key) {
      geminiApiKey = key.trim();
      if (geminiApiKey) {
        localStorage.setItem('tn_digital_twin_gemini_key', geminiApiKey);
      } else {
        localStorage.removeItem('tn_digital_twin_gemini_key');
      }
    },

    getUser: function () {
      return currentUser;
    },

    setUser: function (userObj) {
      currentUser = userObj;
      if (userObj) {
        localStorage.setItem('tn_digital_twin_user', JSON.stringify(userObj));
      } else {
        localStorage.removeItem('tn_digital_twin_user');
      }
    },

    /**
     * Send Prompt to Google Gemini 2.5 Flash REST API Endpoint
     */
    generateContent: async function (promptText, systemInstruction = "") {
      if (!geminiApiKey) {
        throw new Error("Gemini API Key is not configured. Please click the 'Gemini API' button in the top navigation bar to enter your key.");
      }

      // Endpoint for Gemini 2.5 Flash model
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }]
          }
        ]
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Gemini API Error: Status ${response.status}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!generatedText) {
        throw new Error("Received empty response from Gemini API.");
      }

      return generatedText;
    },

    /**
     * Generate Side-by-Side District Comparative Synthesis
     */
    generateComparisonReport: async function (dataA, dataB) {
      const systemInstruction = "You are a Lead Data Analyst and Urban/Regional Planning Consultant for the Government of Tamil Nadu. Analyze the provided district statistics objectively and construct a professional, structured comparative breakdown.";

      const prompt = `
Generate a comparative analysis report comparing two Tamil Nadu districts: **${dataA.name}** vs **${dataB.name}**.

DATA SUMMARY FOR ${dataA.name.toUpperCase()}:
- Headquarters: ${dataA.headquarters} | Area: ${dataA.area_km2} km² | Population: ${dataA.population.toLocaleString('en-IN')} (Density: ${dataA.density}/km²)
- Weather: ${dataA.weather.temp}°C, ${dataA.weather.condition}, Humidity ${dataA.weather.humidity}%
- Air Quality Index (AQI): ${dataA.aqi.value} (${dataA.aqi.status})
- Agriculture: Crop Yield ${dataA.agriculture.yield_t_ha} t/ha, Soil Health ${dataA.agriculture.soil_health_index}/100, Irrigation ${dataA.agriculture.irrigation_pct}%, Major Crops: ${dataA.agriculture.crops.join(', ')}
- Health & Literacy: Literacy ${dataA.literacy_pct}%, Hospitals ${dataA.health_education.hospitals}, PHCs ${dataA.health_education.phc_count}, School Density ${dataA.health_education.school_density_10k}/10k
- Infrastructure: Roads ${dataA.infrastructure.road_network_km} km, Municipal Exp ₹${dataA.infrastructure.expenditure_cr} Cr

DATA SUMMARY FOR ${dataB.name.toUpperCase()}:
- Headquarters: ${dataB.headquarters} | Area: ${dataB.area_km2} km² | Population: ${dataB.population.toLocaleString('en-IN')} (Density: ${dataB.density}/km²)
- Weather: ${dataB.weather.temp}°C, ${dataB.weather.condition}, Humidity ${dataB.weather.humidity}%
- Air Quality Index (AQI): ${dataB.aqi.value} (${dataB.aqi.status})
- Agriculture: Crop Yield ${dataB.agriculture.yield_t_ha} t/ha, Soil Health ${dataB.agriculture.soil_health_index}/100, Irrigation ${dataB.agriculture.irrigation_pct}%, Major Crops: ${dataB.agriculture.crops.join(', ')}
- Health & Literacy: Literacy ${dataB.literacy_pct}%, Hospitals ${dataB.health_education.hospitals}, PHCs ${dataB.health_education.phc_count}, School Density ${dataB.health_education.school_density_10k}/10k
- Infrastructure: Roads ${dataB.infrastructure.road_network_km} km, Municipal Exp ₹${dataB.infrastructure.expenditure_cr} Cr

Please format the response into clear sections:
1. Executive Summary
2. Key Sectoral Contrasts (Agriculture, Environment, Infrastructure & Health)
3. Strategic Policy Recommendations for District Planning Authorities
`;

      return await this.generateContent(prompt, systemInstruction);
    },

    /**
     * Smart Q&A Query Assistant
     */
    askSmartQA: async function (queryText, currentDistrictData, allDistrictsData) {
      const systemInstruction = "You are the Gemini AI Data Assistant for the Tamil Nadu District Digital Twin Platform. Answer questions concisely using the real ground statistics provided in context.";

      const prompt = `
Context Data: Currently viewing ${currentDistrictData ? currentDistrictData.name : 'Tamil Nadu State'} Digital Twin dashboard.
Available 38 Tamil Nadu Districts Baseline dataset in memory.

User Question: "${queryText}"

Provide a clear, direct, facts-grounded response in readable Markdown format.
`;

      return await this.generateContent(prompt, systemInstruction);
    }
  };
})();