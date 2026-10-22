export default async function handler(req, res) {
  const { lat, lon } = req.query;
  const token = process.env.WAQI_TOKEN;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Latitude and longitude required" });
  }

  try {
    const response = await fetch(
      `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${token}`
    );
    const data = await response.json();

    if (!response.ok || data.status !== "ok") {
      return res.status(400).json({ error: "AQI station data unavailable" });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Internal AQI Proxy Error" });
  }
}
