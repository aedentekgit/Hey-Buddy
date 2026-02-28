const googleTTS = require('google-tts-api');

async function test() {
    try {
        const url = googleTTS.getAudioUrl('Hello world', {
            lang: 'en',
            slow: false,
            host: 'https://translate.google.com',
        });
        console.log("Success! URL:", url);
    } catch (e) {
        console.error(e);
    }
}
test();
