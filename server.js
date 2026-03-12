const express = require("express");
const axios = require("axios");
const http = require("http");
const https = require("https");
const cors = require("cors");
const cheerio = require('cheerio');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const axiosInstance = axios.create({
    httpAgent: new http.Agent({ family: 4 }),
    httpsAgent: new https.Agent({ family: 4 }),
});
// Codeforces
async function scrapeCodeforces() {
    try {
        const { data } = await axios.get("https://codeforces.com/contests");
        const $ = cheerio.load(data);

        const contests = [];
        $("#contestList tr").each((i, el) => {
            const name = $(el).find("td:nth-child(1) a").text();
            const timeStr = $(el).find("td:nth-child(2)").text();
            const phase = $(el).find("td:nth-child(3)").text();
            if (phase === "BEFORE") {
                const startTime = new Date(timeStr).getTime() / 1000;
                contests.push({ platform: "Codeforces", name, startTime });
            }
        });

        return contests.slice(0, 5);
    } catch (err) {
        console.error("Codeforces scraper failed:", err.message);
        return [];
    }
}

// HackerRank
async function scrapeHackerRank() {
    try {
        const { data } = await axios.get("https://www.hackerrank.com/contests");
        const $ = cheerio.load(data);

        const contests = [];
        $(".contest-card").each((i, el) => {
            const name = $(el).find(".contest-name").text();
            const timeStr = $(el).find(".contest-date").text();
            const startTime = new Date(timeStr).getTime() / 1000;
            contests.push({ platform: "HackerRank", name, startTime });
        });

        return contests.slice(0, 5);
    } catch (err) {
        console.error("HackerRank scraper failed:", err.message);
        return [];
    }
}

// ------------------ Combine All Scrapers ------------------ //
async function getAllContests() {
    const results = await Promise.all([
        scrapeCodeforces(),
        scrapeHackerRank()
        // Add more scrapers here
    ]);

    const contests = results.flat();
    contests.sort((a, b) => a.startTime - b.startTime); // sort by startTime
    return contests;
}
app.get("/contestsscrape", async (req, res) => {
    try {
        const contests = await getAllContests();
        res.json(contests); // simply return all contests
    } catch (err) {
        console.error("Error in /contests endpoint:", err.message);
        res.status(500).json({ error: "Failed to fetch contests" });
    }
});

// CODEFORCES CONTESTS
async function getCodeforcesContests() {
    const res = await axiosInstance.get("https://codeforces.com/api/contest.list");

    return res.data.result
        .filter(c => c.phase === "BEFORE")
        .map(c => ({
            platform: "Codeforces",
            name: c.name,
            startTime: c.startTimeSeconds,
            duration: c.durationSeconds
        }))
        .slice(0, 5);
}

// LEETCODE CONTESTS
async function getLeetcodeContests() {
    const res = await axiosInstance.get("https://kontests.net/api/v1/leet_code");

    return res.data.map(c => ({
        platform: "LeetCode",
        name: c.name,
        startTime: new Date(c.start_time).getTime() / 1000,
        duration: 7200
    }));
}

// HACKERRANK CONTESTS
async function getHackerRankContests() {
    const res = await axiosInstance.get("https://kontests.net/api/v1/hacker_rank");

    return res.data.map(c => ({
        platform: "HackerRank",
        name: c.name,
        startTime: new Date(c.start_time).getTime() / 1000,
        duration: 7200
    }));
}

// MAIN API
app.get("/contests", async (req, res) => {
    try {
        const [codeforces, leetcode, hackerrank] = await Promise.all([
            getCodeforcesContests().catch(e => {
                console.error("Codeforces API failed:", e.message);
                return [];
            }),
            getLeetcodeContests().catch(e => {
                console.error("LeetCode API failed:", e.message);
                return [];
            }),
            getHackerRankContests().catch(e => {
                console.error("HackerRank API failed:", e.message);
                return [];
            }),
        ]);


        const allContests = [...codeforces, ...leetcode, ...hackerrank];

        res.json(allContests);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch contests" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});