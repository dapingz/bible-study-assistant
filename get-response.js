const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        console.log("Function invoked. Event body:", event.body); // Log the incoming request
        
        const { userMessage } = JSON.parse(event.body);
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error("CRITICAL: GEMINI_API_KEY environment variable not found.");
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Server configuration error: Missing API key.' }),
            };
        }
        console.log("API Key was found successfully.");

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const systemPrompt = "You are a loving, humble, friendly, and patient Bible study assistant... [rest of prompt]"; // Abridged for clarity

        const payload = {
            contents: [{ parts: [{ text: userMessage }] }],
            tools: [{ "google_search": { "restricted_search": { "uris": ["jw.org"] } } }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };
        
        console.log("Sending request to Gemini API...");
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        console.log("Received response from Gemini API with status:", response.status);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Gemini API Error:', errorBody);
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            let sources = [];
            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(att => ({ uri: att.web?.uri, title: att.web?.title }))
                    .filter(source => source.uri && source.title);
            }
            return {
                statusCode: 200,
                body: JSON.stringify({ text, sources }),
            };
        } else {
            throw new Error("Invalid response structure from API.");
        }

    } catch (error) {
        console.error("An error occurred in the function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

