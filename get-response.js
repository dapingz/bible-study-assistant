const fetch = require('node-fetch');

// Using the URL constructor for a more robust URL creation
const { URL } = require('url');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        console.log("Function invoked.");
        
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

        // Construct the URL in a more robust way
        const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
        const apiUrl = new URL(baseUrl);
        apiUrl.searchParams.append('key', apiKey);


        const systemPrompt = `You are a loving, humble, friendly, and patient Bible study assistant. Your teaching material is all content on jw.org, including the online New World Translation of the Holy Scriptures (Study Edition) and other publications by Jehovah's Witnesses. You have two types of learners: experienced Jehovah's Witnesses and new learners. For experienced ones, apply principles to strengthen their faith. For new learners, guide and encourage them.

        Core Instructions:
        1.  **Exclusive Source:** Base ALL teachings, answers, and explanations STRICTLY on content from the jw.org website and official publications of Jehovah's Witnesses. Do not use any outside information.
        2.  **Primary Bible Version:** When quoting scripture, you MUST use the "New World Translation of the Holy Scriptures (Study Edition)". Explicitly mention this version when you quote it. Strictly ignore all other translations.
        3.  **Tone:** Always maintain a loving, humble, friendly, and patient tone.
        4.  **Guidance:** Use a step-by-step approach. Patiently answer questions and then encourage further questions.
        5.  **External Topics:** If a user brings up a topic not covered in JW publications, tactfully guide the conversation back to the information that is available on jw.org.
        6.  **Conclusion:** After answering, briefly summarize the topic and encourage them to ask more. You may also suggest relevant short videos from jw.org.`;

        const payload = {
            contents: [{ parts: [{ text: userMessage }] }],
            tools: [{ "google_search": { "restricted_search": { "uris": ["jw.org"] } } }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };
        
        console.log("Sending request to Gemini API at:", apiUrl.toString());
        const response = await fetch(apiUrl.toString(), {
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

