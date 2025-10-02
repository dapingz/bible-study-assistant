const fetch = require('node-fetch');

// This is your new "middleman" serverless function.
// When you deploy this to a host like Netlify, it will run in a secure environment.

// The system prompt is now stored here, on the backend, for security and consistency.
const systemPrompt = `You are a Bible study assistant. Your persona is loving, humble, friendly, and patient. 
Your teaching material is exclusively the content found on the official website jw.org. Your primary source for all scripture is the 'New World Translation of the Holy Scriptures (Study Edition)'.
You must base all your answers, explanations, and principles on information from jw.org publications.
You must NOT use information from any other website, religious publication, or external source.
Crucially, when quoting any Bible verse, you MUST identify it as being from the 'New World Translation of the Holy Scriptures (Study Edition)'. You are not to quote from any other translation, even older versions that might be on jw.org.
If a user brings up a topic or Bible verse not discussed on jw.org, do not reject it. Instead, tactfully use principles and information that are available on jw.org to guide the conversation and provide a helpful perspective.
Use a step-by-step approach. After answering a question, encourage the user to ask more questions. Keep your answers concise and easy to understand.`;

exports.handler = async function (event, context) {
    // We only allow POST requests to this function
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { userMessage } = JSON.parse(event.body);
        if (!userMessage) {
            return { statusCode: 400, body: 'Bad Request: Missing userMessage' };
        }
        
        // IMPORTANT: You must set your API key as an environment variable in your hosting provider's settings.
        // For Netlify, this is found in Site settings > Build & deploy > Environment > Environment variables.
        // Name the variable 'GEMINI_API_KEY'.
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set in environment variables.');
        }
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const groundedQuery = `site:jw.org ${userMessage}`;

        const payload = {
            contents: [{ parts: [{ text: groundedQuery }] }],
            tools: [{ "google_search": {} }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`API call failed with status: ${response.status}`);
            const errorBody = await response.text();
            console.error(`Error body: ${errorBody}`);
            return { statusCode: response.status, body: 'Error from Gemini API' };
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            let sources = [];
            const groundingMetadata = candidate.groundingMetadata;

            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri);
            }
            
            return {
                statusCode: 200,
                body: JSON.stringify({ text, sources })
            };

        } else {
             return {
                statusCode: 200,
                body: JSON.stringify({ text: "I'm sorry, I couldn't find a specific answer on jw.org for that. Could you try asking in a different way?", sources: [] })
            };
        }

    } catch (error) {
        console.error("Error in serverless function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ text: "I'm having a little trouble connecting right now. Please try again in a moment.", sources: [] })
        };
    }
};

