curl --location "https://api.minimax.chat/v1/t2a_v2" \
--header "Authorization: Bearer sk-api-vwbvykXNL8X9but1QIIBYdQt1Eyy3xj-ZV2GUBUPJT3KZtw58ki8dBvOfUShr7pgBfBaKIIwosbocJiHGq1PNoVzF7FyGBoTMf6WbfBl_85LJczlvHx6FSA" \
--header "Content-Type: application/json" \
--data '{
    "model": "speech-01-turbo",
    "text": "Hello world",
    "stream": false,
    "voice_setting": {
        "voice_id": "male-qn-qingse",
        "speed": 1,
        "vol": 1,
        "pitch": 0
    },
    "audio_setting": {
        "sample_rate": 32000,
        "bitrate": 128000,
        "format": "mp3",
        "channel": 1
    }
}'
