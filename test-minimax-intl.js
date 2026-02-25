async function testMinimax() {
  const apiKey = "sk-api-vwbvykXNL8X9but1QIIBYdQt1Eyy3xj-ZV2GUBUPJT3KZtw58ki8dBvOfUShr7pgBfBaKIIwosbocJiHGq1PNoVzF7FyGBoTMf6WbfBl_85LJczlvHx6FSA";
  
  try {
    const response = await fetch("https://api.minimaxi.chat/v1/t2a_v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "speech-01-turbo",
        text: "Merhaba, bu bir test sesidir.",
        stream: false,
        voice_setting: {
          voice_id: "male-qn-qingse",
          speed: 1.0,
          vol: 1.0,
          pitch: 0
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: "mp3",
          channel: 1
        }
      })
    });

    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text.substring(0, 200));
  } catch(e) {
    console.error(e);
  }
}

testMinimax();
