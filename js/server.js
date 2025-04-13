import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import Openai from "openai";
import { Messages } from "openai/resources/chat/completions/messages.mjs";
import pkg from "play-sound";
import express from "express";
import cors from "cors";

const player = pkg({});
const app = express();

const ai = new Openai({
    apiKey: process.env.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
});

app.use(express.json());
app.use(cors());

let talkMode = true;

async function cultureViewPoint(culturalInput, userInput, tokensUsed) {
    try {
        const messages = [
            {
                role: "system",
                content: `You are a helpful AI explaining to a user. Your cultural perspective is ${culturalInput}, and you will answer the user from that perspective. Make sure your response sounds like it comes from someone of that culture. Heavily rely on the culture's viewpoints while answering the question.`,
            },
            {
                role: "user",
                content: userInput + ". Answer in less than " + tokensUsed + " tokens",
            },
        ];

        const chatComp = await ai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            max_tokens: tokensUsed,
        });

        console.log(chatComp["choices"][0]["message"]["content"]);

        if (talkMode) {
            speak(chatComp["choices"][0]["message"]["content"]);
        }

        return chatComp["choices"][0]["message"]["content"];
    } 
    catch (error) {
        console.error("Error in cultureViewPoint:", error);
        throw error;
    }
}

async function compareContrast(cultureOne, cultureTwo, question, maxTokens) {
    talkMode = false;

    const cultureOneViewPoint = await cultureViewPoint(cultureOne, question, maxTokens);
    const cultureTwoViewPoint = await cultureViewPoint(cultureTwo, question, maxTokens);

    try {
        const messages = [
            {
                role: "system",
                content: `You are a helpful AI tasked with comparing and contrasting cultural viewpoints. 
                        You will receive two cultural perspectives on the same question. 
                        Analyze how they are similar and how they differ, and write a detailed comparison.
                        Culture One: ${cultureOne}  
                        Viewpoint: ${cultureOneViewPoint}  
                                    
                        Culture Two: ${cultureTwo}  
                        Viewpoint: ${cultureTwoViewPoint}  
                                    
                        Focus on how their values, beliefs, or historical context shape their answers.`,
            },
            {
                role: "user",
                content: "Compare and Contrast both viewpoints provided. Answer in less than " + maxTokens + " tokens",
            },
        ];

        const chatComp = await ai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            max_tokens: maxTokens,
        });

        const comparison = chatComp["choices"][0]["message"]["content"];
        console.log(comparison);

        talkMode = true;
        await speak(comparison)

        console.log("Culture One Viewpoint:", cultureOneViewPoint);
        console.log("Culture Two Viewpoint:", cultureTwoViewPoint);
        console.log("Comparison:", comparison);

        return [cultureOneViewPoint, cultureTwoViewPoint, comparison];
    } 
    catch (error) {
        console.error("Error in compareContrast:", error);
        throw error;
    }
}

async function speak(userInput) {
    try {
        const response = await ai.audio.speech.create({
            model: "gpt-4o-mini-tts",
            voice: "ash",
            input: userInput,
            instructions: "Speak clearly and authoritatively.",
            response_format: "wav",
        });

        const dest = fs.createWriteStream("output.wav");
        response.body.pipe(dest);

        dest.on("finish", () => {
            console.log("Audio file created. Playing now...");
            player.play("output.wav", (err) => {
                if (err) {
                    console.error("Error playing audio:", err);
                } else {
                    console.log("Audio played successfully.");
                }
            });
        });
    } 
    catch (error) {
        console.error("Error in speak:", error);
    }
}

app.post("/compareContrast", async (req, res) => {
    try {
        const { cultureOne, cultureTwo, question, maxTokens } = req.body;
        const response = await compareContrast(cultureOne, cultureTwo, question, maxTokens);
        res.json(response);
    } 
    catch (error) {
        console.error("Error in /compareContrast:", error);
        res.status(500).send({ error: "An error occurred while processing the request." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});