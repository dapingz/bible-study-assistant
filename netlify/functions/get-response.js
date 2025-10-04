const fetch = require('node-fetch');
const { URL } = require('url');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const { userMessage } = JSON.parse(event.body);
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error("CRITICAL: GEMINI_API_KEY environment variable not found.");
            // Return a specific error message
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Server configuration error: The API key is missing. Please check Netlify environment variables.' }),
            };
        }

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
            // The 'tools' property is temporarily removed to resolve the 400 Bad Request error.
            // The system prompt still strictly enforces the use of jw.org.
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };
        
        const response = await fetch(apiUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Gemini API Error:', errorBody);
            // Return a specific error message
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: `The call to the Gemini API failed. Status: ${response.status}. Please check the API key and Google Cloud project settings.` }),
            };
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
             return {
                statusCode: 500,
                body: JSON.stringify({ error: "The response from the Gemini API was invalid or empty." }),
            };
        }

    } catch (error) {
        console.error("An error occurred in the function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `A critical error occurred in the serverless function: ${error.message}` }),
        };
    }
};

